-- Simple and Advanced share the immutable usage-event table. Aggregate only
-- calls written by Simple pipeline versions 1.0 and newer so its status never
-- includes Advanced costs and does not need to download thousands of events.
create index if not exists ai_usage_events_simple_cost_lookup_idx
  on signal_layer.ai_usage_events (created_at, model, operation, status)
  where prompt_version ~ '^roots-simple-v[1-9][0-9]*(\.|$)';

create or replace function signal_layer.get_simple_cost_ledger()
returns table (
  usage_date date,
  model text,
  operation text,
  status text,
  request_count bigint,
  error_count bigint,
  input_tokens bigint,
  output_tokens bigint,
  thinking_tokens bigint,
  total_tokens bigint,
  estimated_cost_usd numeric,
  first_event_at timestamptz,
  last_event_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (events.created_at at time zone 'Europe/Berlin')::date as usage_date,
    events.model,
    events.operation,
    events.status,
    count(*)::bigint as request_count,
    count(*) filter (where events.status = 'error')::bigint as error_count,
    coalesce(sum(events.input_tokens), 0)::bigint as input_tokens,
    coalesce(sum(events.output_tokens), 0)::bigint as output_tokens,
    coalesce(sum(events.thinking_tokens), 0)::bigint as thinking_tokens,
    coalesce(sum(events.total_tokens), 0)::bigint as total_tokens,
    coalesce(sum(events.estimated_cost_usd), 0)::numeric as estimated_cost_usd,
    min(events.created_at) as first_event_at,
    max(events.created_at) as last_event_at
  from signal_layer.ai_usage_events as events
  where events.prompt_version ~ '^roots-simple-v[1-9][0-9]*(\.|$)'
  group by 1, 2, 3, 4
  order by 1, 2, 3, 4;
$$;

comment on function signal_layer.get_simple_cost_ledger() is
  'All immutable Simple AI costs from roots-simple-v1.0 onward, aggregated for the status UI.';

revoke all on function signal_layer.get_simple_cost_ledger() from public, anon, authenticated;
grant execute on function signal_layer.get_simple_cost_ledger() to service_role;
