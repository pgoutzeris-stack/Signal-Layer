-- Logo-Speicher fuer Memo-Benchmarks. Jedes Logo, das die Registry liefert
-- oder das die Pruefung mit Sicht bestaetigt, liegt hier und wird bei der
-- naechsten Suche zuerst geladen. Anlass (29.9.2026): fuer Lidl kam ueber
-- Worldvectorlogo ein fremdes Schriftzug-Logo, ungeprueft.
create table if not exists signal_layer.logo_cache (
  name_key text primary key,
  name text not null,
  src text not null check (src like 'data:image/%'),
  quelle text,
  via text not null,
  geprueft boolean not null default false,
  score integer,
  beschreibung text,
  treffer integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table signal_layer.logo_cache enable row level security;
revoke all on signal_layer.logo_cache from public, anon, authenticated;
grant all on signal_layer.logo_cache to service_role;

comment on table signal_layer.logo_cache is
  'Geprüfte Logos für Memo-Benchmarks. Ein falsches Logo: Zeile löschen, die nächste Suche prüft neu.';

-- Kostensicht: Logosuche und Logopruefung zaehlen zu den Bildern.
drop view if exists signal_layer.asset_cost_totals;
create view signal_layer.asset_cost_totals
with (security_invoker = true) as
select
  a.id as asset_id,
  a.kind,
  a.status,
  a.payload->>'title' as title,
  coalesce(nullif(a.answers->>'company', ''), a.payload->>'company') as company,
  a.created_by,
  a.created_at,
  count(e.id) as calls,
  count(e.id) filter (where e.status = 'error') as calls_error,
  coalesce(sum(e.total_tokens), a.total_tokens, 0) as total_tokens,
  coalesce(sum(e.estimated_cost_eur) filter (where e.step = 'entwurf'), case when count(e.id) = 0 then a.cost_eur end, 0) as draft_cost_eur,
  coalesce(sum(e.estimated_cost_eur) filter (where e.step in ('kritik', 'reparatur')), 0) as critic_cost_eur,
  coalesce(sum(e.estimated_cost_eur) filter (where e.step in ('benchmark_recherche', 'benchmark_pruefung')), 0) as benchmark_cost_eur,
  coalesce(sum(e.estimated_cost_eur) filter (where e.step = 'marktrecherche'), 0) as market_cost_eur,
  coalesce(sum(e.estimated_cost_eur) filter (where e.step in ('szenenbild', 'fotosuche', 'bildsuche', 'bildpruefung', 'logosuche', 'logopruefung')), 0) as image_cost_eur,
  coalesce(sum(e.grounding_cost_usd), 0) as search_cost_usd,
  coalesce(sum(e.search_query_count), 0) as search_queries,
  case when count(e.id) > 0 then coalesce(sum(e.estimated_cost_usd), 0) else coalesce(a.cost_usd, 0) end as total_cost_usd,
  case when count(e.id) > 0 then coalesce(sum(e.estimated_cost_eur), 0) else coalesce(a.cost_eur, 0) end as total_cost_eur,
  string_agg(distinct e.model, ', ') as models
from signal_layer.generated_assets a
left join signal_layer.ai_usage_events e on e.asset_id = a.id
group by a.id;

revoke all on signal_layer.asset_cost_totals from anon, authenticated;
grant select on signal_layer.asset_cost_totals to service_role;

-- Protokoll: verworfene Logos und abgebrochene Logopruefung als Fehlerzeilen.
create or replace function signal_layer.memo_protokoll(p_row signal_layer.generated_assets)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  ereignisse jsonb := coalesce(p_row.run_log, '[]'::jsonb);
  ablauf text[] := '{}';
  fehler text[] := '{}';
  zeile text;
  namen text;
  n integer;
  t_start bigint;
  t_ende bigint;
  kosten numeric;
  modelle text;
  bild record;
  teile text[];
  quelle_bild text;
begin
  -- Benchmarks und Verworfenes
  select string_agg(x, ', ') into namen
  from jsonb_array_elements_text(coalesce((
    select e->'names' from jsonb_array_elements(ereignisse) e
    where e->>'event' = 'benchmarks_ok' order by (e->>'t')::bigint desc limit 1), '[]'::jsonb)) x;
  if namen is not null then
    ablauf := ablauf || ('Benchmarks: ' || namen);
  elsif exists (select 1 from jsonb_array_elements(ereignisse) e where e->>'event' = 'benchmarks_user') then
    ablauf := ablauf || 'Benchmarks: eigene';
  end if;
  select string_agg(distinct x, ', ') into namen
  from jsonb_array_elements(ereignisse) e, jsonb_array_elements_text(coalesce(e->'names', '[]'::jsonb)) x
  where e->>'event' in ('benchmarks_fern', 'benchmarks_ohne_logo');
  if namen is not null then ablauf := ablauf || ('Verworfen: ' || namen); end if;

  -- Marktzahlen
  select 'Marktzahlen: ' || coalesce(e->>'kpis', '0') || ' aus ' || coalesce(jsonb_array_length(e->'herausgeber'), 0) || ' Quellen'
    into zeile
  from jsonb_array_elements(ereignisse) e where e->>'event' = 'markt_ok' limit 1;
  if zeile is null then
    select 'Marktzahlen: nur Artikel (' || left(coalesce(e->>'reason', 'keine Recherche'), 80) || ')' into zeile
    from jsonb_array_elements(ereignisse) e where e->>'event' = 'markt_skip' limit 1;
  end if;
  if zeile is not null then ablauf := ablauf || zeile; zeile := null; end if;

  -- Entwurf
  select (e->>'t')::bigint into t_start from jsonb_array_elements(ereignisse) e
  where e->>'event' = 'model_call' and coalesce(e->>'call', 'entwurf') = 'entwurf' order by (e->>'t')::bigint limit 1;
  select 'Entwurf: ok, ' || coalesce(e->>'tokens', '0') || ' Tokens'
    || case when t_start is not null then ', ' || round(((e->>'t')::bigint - t_start) / 1000.0) || ' s' else '' end
    into zeile
  from jsonb_array_elements(ereignisse) e where e->>'event' = 'model_ok' order by (e->>'t')::bigint limit 1;
  ablauf := ablauf || coalesce(zeile, 'Entwurf: keiner');
  zeile := null;

  -- Pruefung und Kritik
  select coalesce((e->>'n')::integer, 0) into n from jsonb_array_elements(ereignisse) e
  where e->>'event' = 'vertrag_verletzt' limit 1;
  select 'Kritik: ' || case when e->>'event' = 'repair_ok' then 'ok, ' || coalesce(e->>'tokens', '0') || ' Tokens' else 'fehlgeschlagen' end
    into zeile
  from jsonb_array_elements(ereignisse) e where e->>'event' in ('repair_ok', 'repair_fail') order by (e->>'t')::bigint desc limit 1;
  if zeile is not null then
    namen := null;
    select '; offen: ' || coalesce(e->>'n', '0')
      || coalesce(' (' || (select string_agg(left(split_part(f, ':', 1), 30), ', ') from jsonb_array_elements_text(e->'felder') f) || ')', '')
      into namen
    from jsonb_array_elements(ereignisse) e where e->>'event' = 'vertrag_rest' order by (e->>'t')::bigint desc limit 1;
    ablauf := ablauf || (zeile || coalesce(namen, '; offen: 0') || case when n is not null then ', vorher ' || n || ' Vertragsfehler' else '' end);
  end if;
  zeile := null;
  select 'Gekürzt: ' || string_agg(x, ', ') into zeile
  from jsonb_array_elements(ereignisse) e, jsonb_array_elements_text(coalesce(e->'felder', '[]'::jsonb)) x
  where e->>'event' = 'vertrag_gekuerzt';
  if zeile is not null then ablauf := ablauf || zeile; zeile := null; end if;

  -- Bilder je Rahmen: was im Memo steht, und woher
  teile := '{}';
  for bild in
    select k.schluessel, k.name,
      case when k.schluessel in ('cover', 'insight') then p_row.payload->k.schluessel->>'src'
        else p_row.payload->split_part(k.schluessel, '.', 1)->(split_part(k.schluessel, '.', 2)::integer)->'image'->>'src' end as src
    from (values ('cover', 'Titelbild'), ('insight', 'Befund'), ('potentials.0', 'Hebel 1'),
      ('potentials.1', 'Hebel 2'), ('potentials.2', 'Hebel 3')) as k(schluessel, name)
  loop
    select case e->>'event'
        when 'bild_gewaehlt' then 'Sicht ' || coalesce(e->>'score', '?') || '/10' || coalesce(' ' || nullif(e->>'quelle', ''), '')
        when 'bild_rueckfall' then 'Rückfall' || coalesce(' ' || nullif(e->>'quelle', ''), '')
        else 'Motivsuche' end
      into quelle_bild
    from jsonb_array_elements(ereignisse) e
    where e->>'key' = bild.schluessel and e->>'event' in ('bild_gewaehlt', 'bild_rueckfall', 'image_ok')
    order by (e->>'t')::bigint desc limit 1;
    teile := teile || (bild.name || ' ' || case when coalesce(bild.src, '') like 'data:image/%'
      then coalesce(quelle_bild, 'ok') else 'leer' end);
    quelle_bild := null;
  end loop;
  if exists (select 1 from jsonb_array_elements(ereignisse) e where e->>'event' = 'images_skip' and e->>'reason' = 'upload') then
    ablauf := ablauf || 'Bilder: eigene Uploads';
  else
    ablauf := ablauf || ('Bilder: ' || array_to_string(teile, ', '));
  end if;

  -- Logos der Benchmarks
  select count(*) into n from jsonb_array_elements(coalesce(p_row.payload->'benchmarks', '[]'::jsonb)) b
  where coalesce(b->'image'->>'src', '') like 'data:image/%';
  -- Quellen: registry, speicher (logo_cache), sicht (GPT-Pruefung), ungeprueft.
  select string_agg(distinct e->>'source', ', ') into namen from jsonb_array_elements(ereignisse) e where e->>'event' = 'logo_source';
  ablauf := ablauf || ('Logos: ' || n || ' von ' || coalesce(jsonb_array_length(p_row.payload->'benchmarks'), 0)
    || coalesce(' (' || namen || ')', ''));

  -- Fehler, zusammengefasst und gezaehlt
  select coalesce(array_agg(zeile_fehler order by anzahl desc), '{}') into fehler from (
    select meldung || case when count(*) > 1 then ' ×' || count(*) else '' end as zeile_fehler, count(*) as anzahl
    from (
      select case e->>'event'
        when 'error' then 'Fehler: ' || left(coalesce(e->>'message', e->>'code', ''), 120)
        when 'model_fail' then 'Modell: ' || coalesce(e->>'kind', '') || ' ' || left(coalesce(e->>'message', ''), 80)
        when 'repair_fail' then 'Kritik: ' || coalesce(e->>'kind', '') || ' ' || left(coalesce(e->>'message', ''), 80)
        when 'persist_fail' then 'Speichern ' || coalesce(e->>'key', e->>'phase', '') || ': ' || left(coalesce(e->>'message', ''), 60)
        when 'image_model_error' then 'Bildmodell: ' || left(coalesce(e->>'google', e->>'error', ''), 70)
        when 'image_fail' then 'Bild ' || coalesce(e->>'key', '') || ': ' || left(coalesce(e->>'error', ''), 60)
        when 'logo_miss' then 'Logo fehlt: ' || left(coalesce(e->>'tried', ''), 60)
        when 'logo_abgelehnt' then 'Logo verworfen: ' || left(coalesce(e->>'name', ''), 50) || ' (' || coalesce(e->>'score', '?') || '/10)'
        when 'logo_zeit' then 'Logoprüfung aus Zeitgründen beendet'
        when 'markt_skip' then 'Marktrecherche: ' || left(coalesce(e->>'reason', ''), 80)
        when 'images_incomplete' then 'Bilder: ' || left(coalesce(e->>'reason', ''), 80)
        when 'bilder_sicht_fehler' then 'Bildwahl: ' || left(coalesce(e->>'reason', ''), 80)
        when 'bild_rueckfall_leer' then 'Kein Bild für ' || coalesce(e->>'key', '')
        when 'bilder_zeit' then 'Bildwahl aus Zeitgründen beendet'
        when 'model_abandoned' then 'Modell ohne Antwort aufgegeben'
      end as meldung
      from jsonb_array_elements(ereignisse) e
    ) roh
    where meldung is not null
    group by meldung
    order by count(*) desc
    limit 8
  ) gezaehlt;

  select round(coalesce(sum(u.estimated_cost_eur), 0)::numeric, 3), string_agg(distinct u.model, ', ')
    into kosten, modelle
  from signal_layer.ai_usage_events u where u.asset_id = p_row.id;
  select max((e->>'t')::bigint) into t_ende from jsonb_array_elements(ereignisse) e;

  return jsonb_build_object(
    'status', case p_row.status when 'done' then 'fertig' when 'error' then 'fehler' else p_row.status end,
    'dauer_s', round(coalesce(t_ende, 0) / 1000.0),
    'kosten_eur', kosten,
    'modelle', modelle,
    'ablauf', to_jsonb(ablauf),
    'fehler', to_jsonb(fehler),
    'meldung', left(p_row.error_message, 300),
    'stand', now()
  );
end;
$$;

revoke all on function signal_layer.memo_protokoll(signal_layer.generated_assets) from public, anon, authenticated;
grant execute on function signal_layer.memo_protokoll(signal_layer.generated_assets) to service_role;
