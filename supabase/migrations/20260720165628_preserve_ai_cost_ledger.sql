create table if not exists signal_layer.ai_cost_ledger_daily (
  usage_date date not null,
  model text not null,
  operation text not null,
  status text not null,
  request_count bigint not null default 0,
  error_count bigint not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  thinking_tokens bigint not null default 0,
  total_tokens bigint not null default 0,
  estimated_cost_usd numeric(18, 9) not null default 0,
  first_event_at timestamptz not null,
  last_event_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (usage_date, model, operation, status)
);

alter table signal_layer.ai_cost_ledger_daily enable row level security;
revoke all on signal_layer.ai_cost_ledger_daily from public, anon, authenticated;
grant select, insert, update on signal_layer.ai_cost_ledger_daily to service_role;

create or replace function signal_layer.accumulate_ai_cost_ledger()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into signal_layer.ai_cost_ledger_daily (
    usage_date, model, operation, status, request_count, error_count,
    input_tokens, output_tokens, thinking_tokens, total_tokens,
    estimated_cost_usd, first_event_at, last_event_at, updated_at
  ) values (
    (new.created_at at time zone 'UTC')::date,
    coalesce(new.model, 'unknown'), coalesce(new.operation, 'unknown'), coalesce(new.status, 'unknown'),
    1, case when new.status = 'error' then 1 else 0 end,
    coalesce(new.input_tokens, 0), coalesce(new.output_tokens, 0),
    coalesce(new.thinking_tokens, 0), coalesce(new.total_tokens, 0),
    coalesce(new.estimated_cost_usd, 0), new.created_at, new.created_at, now()
  )
  on conflict (usage_date, model, operation, status) do update set
    request_count = signal_layer.ai_cost_ledger_daily.request_count + excluded.request_count,
    error_count = signal_layer.ai_cost_ledger_daily.error_count + excluded.error_count,
    input_tokens = signal_layer.ai_cost_ledger_daily.input_tokens + excluded.input_tokens,
    output_tokens = signal_layer.ai_cost_ledger_daily.output_tokens + excluded.output_tokens,
    thinking_tokens = signal_layer.ai_cost_ledger_daily.thinking_tokens + excluded.thinking_tokens,
    total_tokens = signal_layer.ai_cost_ledger_daily.total_tokens + excluded.total_tokens,
    estimated_cost_usd = signal_layer.ai_cost_ledger_daily.estimated_cost_usd + excluded.estimated_cost_usd,
    first_event_at = least(signal_layer.ai_cost_ledger_daily.first_event_at, excluded.first_event_at),
    last_event_at = greatest(signal_layer.ai_cost_ledger_daily.last_event_at, excluded.last_event_at),
    updated_at = now();
  return new;
end;
$$;

revoke all on function signal_layer.accumulate_ai_cost_ledger() from public, anon, authenticated;

drop trigger if exists trg_accumulate_ai_cost_ledger on signal_layer.ai_usage_events;
create trigger trg_accumulate_ai_cost_ledger
after insert on signal_layer.ai_usage_events
for each row execute function signal_layer.accumulate_ai_cost_ledger();

insert into signal_layer.ai_cost_ledger_daily (
  usage_date, model, operation, status, request_count, error_count,
  input_tokens, output_tokens, thinking_tokens, total_tokens,
  estimated_cost_usd, first_event_at, last_event_at, updated_at
)
select
  (created_at at time zone 'UTC')::date,
  coalesce(model, 'unknown'), coalesce(operation, 'unknown'), coalesce(status, 'unknown'),
  count(*), count(*) filter (where status = 'error'),
  coalesce(sum(input_tokens), 0), coalesce(sum(output_tokens), 0),
  coalesce(sum(thinking_tokens), 0), coalesce(sum(total_tokens), 0),
  coalesce(sum(estimated_cost_usd), 0), min(created_at), max(created_at), now()
from signal_layer.ai_usage_events
group by 1, 2, 3, 4
on conflict (usage_date, model, operation, status) do nothing;

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
      or (p_crawl_run_id is null and p_uncrawled_only and e.crawl_run_id is null)
      or (p_crawl_run_id is null and not p_uncrawled_only)
    )
  group by 1, 2, 3;
$$;

revoke all on function signal_layer.get_ai_usage_aggregate(timestamptz, uuid, boolean) from public, anon, authenticated;
grant execute on function signal_layer.get_ai_usage_aggregate(timestamptz, uuid, boolean) to service_role;
