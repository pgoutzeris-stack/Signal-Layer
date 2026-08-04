-- Direct Advanced jobs and backfills have no crawl_run_id. Since Simple events
-- also have no crawl_run_id, exclude their explicit run IDs whenever the RPC
-- is asked for Advanced-only, uncrawled usage.
create or replace function signal_layer.get_ai_usage_aggregate(
  p_since timestamptz,
  p_crawl_run_id uuid default null,
  p_uncrawled_only boolean default false
)
returns table (
  model text, operation text, status text, request_count bigint,
  article_count bigint, input_tokens bigint, output_tokens bigint,
  thinking_tokens bigint, total_tokens bigint, estimated_cost_usd numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(e.model, 'unknown'), coalesce(e.operation, 'unknown'), coalesce(e.status, 'unknown'),
         count(*), count(distinct e.article_id), coalesce(sum(e.input_tokens), 0),
         coalesce(sum(e.output_tokens), 0), coalesce(sum(e.thinking_tokens), 0),
         coalesce(sum(e.total_tokens), 0), coalesce(sum(e.estimated_cost_usd), 0)
  from signal_layer.ai_usage_events e
  where e.created_at >= p_since
    and (
      (p_crawl_run_id is not null and e.crawl_run_id = p_crawl_run_id)
      or (p_crawl_run_id is null and p_uncrawled_only and e.crawl_run_id is null and e.simple_run_id is null)
      or (p_crawl_run_id is null and not p_uncrawled_only)
    )
  group by 1, 2, 3;
$$;

revoke all on function signal_layer.get_ai_usage_aggregate(timestamptz, uuid, boolean) from public, anon, authenticated;
grant execute on function signal_layer.get_ai_usage_aggregate(timestamptz, uuid, boolean) to service_role;
