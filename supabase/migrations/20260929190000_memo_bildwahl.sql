-- Bildwahl mit Sicht. attach_asset_image kannte nur src und pos: das
-- "fit": "contain" der Benchmark-Logos ging verloren, die Logos wurden wie
-- Fotos randlos gefuellt und abgeschnitten. Dazu nimmt die Funktion jetzt auch
-- Titelbild und Bild zum Befund an und merkt sich die Herkunftsseite.
drop function if exists signal_layer.attach_asset_image(uuid, text, text, text);

create or replace function signal_layer.attach_asset_image(
  p_id uuid,
  p_key text,
  p_src text,
  p_pos text default '50% 50%',
  p_fit text default null,
  p_quelle text default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  treffer text[];
  pfad text[];
  bild jsonb;
  n integer;
begin
  if p_src is null or p_src not like 'data:image/%' then
    raise exception 'invalid image src';
  end if;
  if p_key in ('cover', 'insight') then
    pfad := array[p_key];
  else
    treffer := regexp_match(p_key, '^(benchmarks|potentials)\.([0-9]+)$');
    if treffer is null then
      raise exception 'invalid image key';
    end if;
    pfad := array[treffer[1], treffer[2], 'image'];
  end if;
  bild := jsonb_build_object('src', p_src, 'pos', coalesce(nullif(p_pos, ''), '50% 50%'));
  if p_fit in ('cover', 'contain') then
    bild := bild || jsonb_build_object('fit', p_fit);
  end if;
  if coalesce(p_quelle, '') <> '' then
    bild := bild || jsonb_build_object('quelle', left(p_quelle, 400));
  end if;
  update signal_layer.generated_assets
  set
    payload = jsonb_set(coalesce(payload, '{}'::jsonb), pfad, bild, true),
    updated_at = now()
  where id = p_id
    and status = 'running';
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

comment on function signal_layer.attach_asset_image(uuid, text, text, text, text, text) is
  'Hängt ein Memo-Motiv (data:image/…) an cover, insight, benchmarks.N oder potentials.N, mit Einpassung und Herkunft, ohne die ganze Nutzlast zu ersetzen.';

revoke all on function signal_layer.attach_asset_image(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function signal_layer.attach_asset_image(uuid, text, text, text, text, text) to service_role;

-- Bestehende Memos: Benchmark-Bilder, die eine Wortmarke sind (SVG, PNG,
-- WebP), bekommen das verlorene "contain" zurueck.
update signal_layer.generated_assets a
set payload = jsonb_set(
  a.payload, '{benchmarks}',
  (select jsonb_agg(
    case when b ? 'image' and (b->'image'->>'src') ~ '^data:image/(svg\+xml|png|webp)' and not (b->'image' ? 'fit')
      then jsonb_set(b, '{image,fit}', '"contain"'::jsonb)
      else b end order by ord)
   from jsonb_array_elements(a.payload->'benchmarks') with ordinality as t(b, ord)))
where a.kind = 'memo'
  and jsonb_typeof(a.payload->'benchmarks') = 'array'
  and exists (
    select 1 from jsonb_array_elements(a.payload->'benchmarks') b
    where (b->'image'->>'src') ~ '^data:image/(svg\+xml|png|webp)' and not (b->'image' ? 'fit')
  );

alter table signal_layer.ai_usage_events
  drop constraint if exists ai_usage_events_operation_check;
alter table signal_layer.ai_usage_events
  add constraint ai_usage_events_operation_check
  check (operation in (
    'classification', 'review', 'preview', 'test', 'translation',
    'offering_match', 'company_profile', 'company_logo', 'asset_generation',
    'memo_benchmark_research', 'memo_market_research', 'memo_photo_research',
    'memo_image_check', 'memo_scene_image', 'memo_field_sharpen', 'memo_section_draft',
    'manual_signal_check', 'manual_signal_draft'
  ));

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
  coalesce(sum(e.estimated_cost_eur) filter (where e.step in ('szenenbild', 'fotosuche', 'bildsuche', 'bildpruefung')), 0) as image_cost_eur,
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
