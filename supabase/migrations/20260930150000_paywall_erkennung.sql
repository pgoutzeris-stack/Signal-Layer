-- Paywall je Artikel statt je letztem Abruf.
--
-- Bisher schrieb jeder Artikelabruf den Paywall-Status der Quelle neu: ein
-- freier Artikel setzte die Quelle auf "keine Paywall", ein Newsletter-Kasten
-- auf "Paywall". Die Einstellungen zeigten deshalb Zufall (LZ ohne Paywall bei
-- 199 von 202 Anreissern, L'Oreal-Newsroom mit Paywall).
--
-- Jetzt traegt jeder Artikel seinen eigenen Befund. Ein Trigger berechnet ihn
-- bei jedem Schreiben von Titel, Text oder Seitenmarkierung, egal aus welchem
-- Pfad (Crawl, Browser-Worker, Aufbereitung, manuelles Signal). Der Status der
-- Quelle ergibt sich aus ihren Artikeln.
--
-- Die Muster spiegeln PAYWALL_MERKMALE in
-- supabase/functions/signal-layer/paywall.ts (tests/paywall.test.mjs haelt beide
-- gleich). Postgres-Regex mit Flag "i": "." trifft auch Zeilenumbrueche, wie
-- das Flag "s" in JavaScript.

alter table signal_layer.articles
  add column if not exists paywall_markiert boolean,
  add column if not exists paywall_geprueft_at timestamptz,
  add column if not exists paywall_detected boolean not null default false,
  add column if not exists paywall_evidence text;

comment on column signal_layer.articles.paywall_markiert is
  'Angabe der Seite beim Abruf (JSON-LD isAccessibleForFree): true = kostenpflichtig, false = frei, null = keine Angabe';
comment on column signal_layer.articles.paywall_detected is
  'Gespeicherter Text ist wegen einer Paywall nur ein Anreisser. Wird per Trigger aus Text und paywall_markiert berechnet.';

create or replace function signal_layer.paywall_merkmal(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select m.beleg
  from (values
    ('Lizenzangebot für Teams', 'lizenz f.{1,2}r ihr team'),
    ('Vollzugriff-Angebot', 'vollzugriff auf .{0,40}mit allen artikeln'),
    ('Angebot wählen und weiterlesen', 'angebot w.{1,2}hlen und weiterlesen'),
    ('Noch kein Abonnement', 'noch kein .{0,30}abonnement'),
    ('FAZ+-Angebot', 'mit einem klick online k.{1,2}ndbar'),
    ('FAZ+-Preis', 'originalpreis: ?[0-9,]+ ?€'),
    ('Capital+', '\| capital\+'),
    ('BILDplus', 'lesen sie .{0,40}bild ?plus'),
    ('Probeabo-Angebot', 'direkt weiterlesen.{0,40}kostenlos testen'),
    ('Nur Anreißer, Volltext im Abo', 'lesen sie hier das vollst.{1,2}ndige'),
    ('Weiterlesen mit Abo', 'weiterlesen mit .{0,25}(abo|plus)'),
    ('Artikel kostenpflichtig', 'artikel ist kostenpflichtig'),
    ('Subscribe to continue', 'subscribe (now )?to (continue|read|unlock)'),
    ('Already a subscriber', 'already a subscriber'),
    ('Sign in to continue', '(sign|log) ?in to (continue|read)')
  ) as m(beleg, muster)
  cross join lateral (select regexp_instr(left(coalesce(p_text, ''), 3200), m.muster, 1, 1, 0, 'i') as stelle) s
  where s.stelle between 1 and 3000
  order by s.stelle
  limit 1
$$;

create or replace function signal_layer.paywall_befund(
  p_title text, p_content text, p_cleaned text, p_markiert boolean
)
returns table (erkannt boolean, beleg text)
language sql
immutable
parallel safe
set search_path = ''
as $$
  with x as (
    select coalesce(
             signal_layer.paywall_merkmal(coalesce(p_title, '') || E'\n' || coalesce(p_content, '')),
             signal_layer.paywall_merkmal(p_cleaned)
           ) as merkmal,
           length(coalesce(nullif(p_cleaned, ''), p_content, '')) as laenge
  )
  select
    x.merkmal is not null or (coalesce(p_markiert, false) and x.laenge < 2000),
    case
      when x.merkmal is not null then x.merkmal
      when coalesce(p_markiert, false) and x.laenge < 2000 then 'Seite als kostenpflichtig markiert'
    end
  from x
$$;

create or replace function signal_layer.articles_paywall_setzen()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  b record;
begin
  select * into b from signal_layer.paywall_befund(new.title, new.content, new.cleaned_content, new.paywall_markiert);
  new.paywall_detected := coalesce(b.erkannt, false);
  new.paywall_evidence := b.beleg;
  return new;
end
$$;

drop trigger if exists articles_paywall on signal_layer.articles;
create trigger articles_paywall
  before insert or update of title, content, cleaned_content, paywall_markiert
  on signal_layer.articles
  for each row execute function signal_layer.articles_paywall_setzen();

-- Status der Quelle aus ihren Artikeln der letzten 365 Tage. Paywall, sobald
-- mindestens drei Artikel oder ein Fuenftel nur Anreisser sind. Greift ein
-- hinterlegter Zugang nicht (seit dem Login weiter Anreisser), heisst der
-- Zugangsstatus credentials_ineffective.
create or replace function signal_layer.paywall_quellen_aktualisieren()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  geaendert integer;
begin
  with stat as (
    select s.id,
      count(a.id) as gesamt,
      count(a.id) filter (where a.paywall_detected) as anreisser,
      count(a.id) filter (where a.paywall_detected
        and a.crawled_at > nullif(s.crawl_config->>'login_configured_at', '')::timestamptz) as nach_login,
      max(a.crawled_at) filter (where a.paywall_detected) as zuletzt
    from signal_layer.sources s
    left join signal_layer.articles a on a.source_id = s.id and a.crawled_at > now() - interval '365 days'
    group by s.id
  ), ziel as (
    select stat.*,
      (stat.anreisser >= 3 or (stat.anreisser > 0 and stat.anreisser::numeric / greatest(stat.gesamt, 1) >= 0.2)) as paywall,
      (s.crawl_config->>'login_configured_at') is not null as mit_login
    from stat join signal_layer.sources s on s.id = stat.id
  ), neu as (
    select ziel.id, jsonb_build_object(
      'paywall_detected', ziel.paywall,
      'paywall_detected_at', case when ziel.paywall then ziel.zuletzt end,
      'paywall_evidence', case when ziel.paywall then format('%s von %s Artikeln nur Anreißer', ziel.anreisser, ziel.gesamt) end,
      'paywall_artikel', ziel.anreisser,
      'paywall_artikel_gesamt', ziel.gesamt,
      'paywall_credentials_missing', ziel.paywall and not ziel.mit_login,
      'paywall_access_status', case
        when not ziel.paywall then null
        when not ziel.mit_login then 'credentials_required'
        when ziel.nach_login >= 3 then 'credentials_ineffective'
        else 'credentials_configured'
      end
    ) as felder
    from ziel
  )
  update signal_layer.sources s
    set crawl_config = coalesce(s.crawl_config, '{}'::jsonb) || neu.felder
  from neu
  where neu.id = s.id
    and (coalesce(s.crawl_config, '{}'::jsonb) || neu.felder) is distinct from coalesce(s.crawl_config, '{}'::jsonb);
  get diagnostics geaendert = row_count;
  return geaendert;
end
$$;

revoke all on function signal_layer.paywall_quellen_aktualisieren() from public, anon, authenticated;

-- Bestand: Befund fuer alle gespeicherten Artikel aus dem vorhandenen Text.
-- Die Seitenmarkierung kommt danach ueber die Nachpruefung (paywall_nachpruefen).
update signal_layer.articles a
  set paywall_detected = coalesce(b.erkannt, false), paywall_evidence = b.beleg
from signal_layer.articles a2
cross join lateral signal_layer.paywall_befund(a2.title, a2.content, a2.cleaned_content, a2.paywall_markiert) b
where a2.id = a.id
  and (a.paywall_detected is distinct from coalesce(b.erkannt, false) or a.paywall_evidence is distinct from b.beleg);

select signal_layer.paywall_quellen_aktualisieren();

create index if not exists articles_paywall_offen_idx
  on signal_layer.articles (crawled_at desc)
  where paywall_geprueft_at is null;

select cron.schedule('signal-layer-paywall-quellen', '23 * * * *', 'select signal_layer.paywall_quellen_aktualisieren()');
