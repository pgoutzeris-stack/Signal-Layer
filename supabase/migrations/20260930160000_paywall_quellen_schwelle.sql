-- Schwelle fuer den Paywall-Status einer Quelle von drei auf fuenf Artikel.
-- Nach der Nachpruefung vom 30.09.2026 blieben bei FashionUnited (3 von 318)
-- und Adweek (3 von 133) je drei Fehltreffer: kurze, vollstaendige Meldungen
-- auf Seiten, die alles als kostenpflichtig markieren. Handelsblatt (10) und
-- Markenartikel (7) bleiben Paywall-Quellen.

-- Status der Quelle aus ihren Artikeln der letzten 365 Tage. Paywall, sobald
-- mindestens fuenf Artikel oder ein Fuenftel nur Anreisser sind. Greift ein
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
      (stat.anreisser >= 5 or (stat.anreisser > 0 and stat.anreisser::numeric / greatest(stat.gesamt, 1) >= 0.2)) as paywall,
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

select signal_layer.paywall_quellen_aktualisieren();
