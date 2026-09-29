-- Kosten je Executive Memo, aufgeteilt nach Schritt und Modell. Bisher standen
-- Entwurf und zweiter Anlauf beide als asset_generation im Ledger, Recherche
-- und Pruefung beide als memo_benchmark_research, und die Gemini-Fotosuche
-- buchte sich ebenfalls als Benchmark-Recherche.
alter table signal_layer.ai_usage_events
  add column if not exists step text;

alter table signal_layer.ai_usage_events
  drop constraint if exists ai_usage_events_operation_check;
alter table signal_layer.ai_usage_events
  add constraint ai_usage_events_operation_check
  check (operation in (
    'classification', 'review', 'preview', 'test', 'translation',
    'offering_match', 'company_profile', 'company_logo', 'asset_generation',
    'memo_benchmark_research', 'memo_market_research', 'memo_photo_research',
    'memo_scene_image', 'memo_field_sharpen', 'memo_section_draft',
    'manual_signal_check', 'manual_signal_draft'
  ));

-- Alte Buchungen bekommen den Schritt, der sich aus Operation und Anlauf ergibt.
update signal_layer.ai_usage_events
set step = case
  when operation = 'asset_generation' and coalesce(attempt, 1) > 1 then 'reparatur'
  when operation = 'asset_generation' then 'entwurf'
  when operation = 'memo_benchmark_research' then 'benchmark_recherche'
  when operation = 'memo_market_research' then 'marktrecherche'
  when operation = 'memo_photo_research' then 'fotosuche'
  when operation = 'memo_scene_image' then 'szenenbild'
  when operation = 'memo_field_sharpen' then 'feld_schaerfen'
  when operation = 'memo_section_draft' then 'abschnitt_entwurf'
end
where step is null
  and operation in ('asset_generation', 'memo_benchmark_research', 'memo_market_research',
    'memo_photo_research', 'memo_scene_image', 'memo_field_sharpen', 'memo_section_draft');

create index if not exists ai_usage_events_asset_step_idx
  on signal_layer.ai_usage_events (asset_id, step) where asset_id is not null;

-- Eine Zeile je Asset, Schritt und Modell.
create or replace view signal_layer.asset_cost_steps
with (security_invoker = true) as
select
  e.asset_id,
  a.kind,
  a.payload->>'title' as title,
  coalesce(nullif(a.answers->>'company', ''), a.payload->>'company') as company,
  a.created_by,
  a.created_at as asset_created_at,
  coalesce(e.step, e.operation) as step,
  e.operation,
  e.model,
  count(*) as calls,
  count(*) filter (where e.status = 'success') as calls_ok,
  count(*) filter (where e.status = 'error') as calls_error,
  coalesce(sum(e.input_tokens), 0) as input_tokens,
  coalesce(sum(e.cached_input_tokens), 0) as cached_input_tokens,
  coalesce(sum(e.output_tokens), 0) as output_tokens,
  coalesce(sum(e.thinking_tokens), 0) as thinking_tokens,
  coalesce(sum(e.total_tokens), 0) as total_tokens,
  coalesce(sum(e.search_query_count), 0) as search_queries,
  coalesce(sum(e.grounding_cost_usd), 0) as search_cost_usd,
  coalesce(sum(e.estimated_cost_usd), 0) as cost_usd,
  coalesce(sum(e.estimated_cost_eur), 0) as cost_eur,
  bool_or(e.pricing_version = 'provider-reported') as cost_reported_by_provider,
  string_agg(distinct e.error_code, ', ') filter (where e.error_code is not null) as error_codes,
  min(e.created_at) as first_at,
  max(e.created_at) as last_at
from signal_layer.ai_usage_events e
join signal_layer.generated_assets a on a.id = e.asset_id
group by e.asset_id, a.kind, a.payload, a.answers, a.created_by, a.created_at,
  coalesce(e.step, e.operation), e.operation, e.model;

-- Eine Zeile je Asset: Gesamtkosten plus die Anteile der Schritte.
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
  coalesce(sum(e.estimated_cost_eur) filter (where e.step in ('szenenbild', 'fotosuche')), 0) as image_cost_eur,
  coalesce(sum(e.grounding_cost_usd), 0) as search_cost_usd,
  coalesce(sum(e.search_query_count), 0) as search_queries,
  case when count(e.id) > 0 then coalesce(sum(e.estimated_cost_usd), 0) else coalesce(a.cost_usd, 0) end as total_cost_usd,
  case when count(e.id) > 0 then coalesce(sum(e.estimated_cost_eur), 0) else coalesce(a.cost_eur, 0) end as total_cost_eur,
  string_agg(distinct e.model, ', ') as models
from signal_layer.generated_assets a
left join signal_layer.ai_usage_events e on e.asset_id = a.id
group by a.id;

revoke all on signal_layer.asset_cost_steps from anon, authenticated;
revoke all on signal_layer.asset_cost_totals from anon, authenticated;
grant select on signal_layer.asset_cost_steps to service_role;
grant select on signal_layer.asset_cost_totals to service_role;
