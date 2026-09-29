-- Kompaktes Protokoll je Executive Memo, direkt an der Zeile in
-- generated_assets. run_log haelt jedes Ereignis (oft mehrere hundert); das
-- Protokoll sagt in einem Dutzend Zeilen, was geklappt hat, was nicht und
-- warum. Ein Trigger schreibt es, sobald ein Memo fertig oder fehlgeschlagen
-- ist, egal ueber welchen Code-Weg.
alter table signal_layer.generated_assets
  add column if not exists protokoll jsonb;

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

create or replace function signal_layer.memo_protokoll_trigger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Laufende Memos werden oft geschrieben (Herzschlag); fuer sie wird nichts
  -- verglichen oder berechnet.
  if new.kind = 'memo' then
    if new.status in ('done', 'error') then
      if old.status is distinct from new.status or new.protokoll is null or old.run_log is distinct from new.run_log then
        begin
          new.protokoll := signal_layer.memo_protokoll(new);
        exception when others then
          -- Das Protokoll darf nie den Abschluss eines Memos verhindern.
          new.protokoll := jsonb_build_object('fehler', jsonb_build_array('Protokoll: ' || left(sqlerrm, 200)), 'stand', now());
        end;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists generated_assets_memo_protokoll on signal_layer.generated_assets;
create trigger generated_assets_memo_protokoll
  before update on signal_layer.generated_assets
  for each row execute function signal_layer.memo_protokoll_trigger();

revoke all on function signal_layer.memo_protokoll(signal_layer.generated_assets) from public, anon, authenticated;
grant execute on function signal_layer.memo_protokoll(signal_layer.generated_assets) to service_role;

-- Bestehende Memos bekommen ihr Protokoll nachgetragen.
update signal_layer.generated_assets a
set protokoll = signal_layer.memo_protokoll(a)
where a.kind = 'memo' and a.status in ('done', 'error');

-- Lesesicht: neueste Memos mit Protokoll, Kosten und Titel.
create or replace view signal_layer.memo_protokolle
with (security_invoker = true) as
select a.id, a.created_at, a.status, a.payload->>'title' as title,
  a.protokoll->>'kosten_eur' as kosten_eur, a.protokoll->>'dauer_s' as dauer_s,
  a.protokoll->'ablauf' as ablauf, a.protokoll->'fehler' as fehler, a.protokoll->>'meldung' as meldung
from signal_layer.generated_assets a
where a.kind = 'memo';

revoke all on signal_layer.memo_protokolle from anon, authenticated;
grant select on signal_layer.memo_protokolle to service_role;
