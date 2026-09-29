-- Recherche, Szenenbilder und Entwurf eines Memos buchen getrennt. Die
-- Asset-Zuordnung macht die Gesamtkosten je Memo abfragbar, die
-- Grounding-Spalte zeigt, welcher Anteil auf Google Search entfaellt.
alter table signal_layer.ai_usage_events
  add column if not exists asset_id uuid references signal_layer.generated_assets(id) on delete set null,
  add column if not exists grounding_cost_usd numeric not null default 0;

create index if not exists ai_usage_events_asset_id_idx
  on signal_layer.ai_usage_events (asset_id) where asset_id is not null;

create index if not exists ai_usage_events_grounding_day_idx
  on signal_layer.ai_usage_events (created_at) where search_query_count > 0;

-- Gesamtkosten je Asset. Alte Assets ohne zugeordnete Buchungen fallen auf
-- die Modellkosten am Asset zurueck.
create or replace view signal_layer.asset_cost_totals
with (security_invoker = true) as
select
  a.id as asset_id,
  a.kind,
  a.status,
  a.created_at,
  count(e.id) as calls,
  coalesce(sum(e.total_tokens), a.total_tokens, 0) as total_tokens,
  coalesce(sum(e.estimated_cost_eur) filter (where e.operation = 'asset_generation'), a.cost_eur, 0) as draft_cost_eur,
  coalesce(sum(e.estimated_cost_eur) filter (where e.operation = 'memo_benchmark_research'), 0) as research_cost_eur,
  coalesce(sum(e.estimated_cost_eur) filter (where e.operation = 'memo_scene_image'), 0) as image_cost_eur,
  coalesce(sum(e.grounding_cost_usd), 0) as grounding_cost_usd,
  coalesce(sum(e.search_query_count), 0) as search_queries,
  case when count(e.id) > 0 then coalesce(sum(e.estimated_cost_eur), 0)
       else coalesce(a.cost_eur, 0) end as total_cost_eur
from signal_layer.generated_assets a
left join signal_layer.ai_usage_events e on e.asset_id = a.id
group by a.id;
