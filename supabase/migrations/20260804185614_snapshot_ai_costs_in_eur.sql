alter table signal_layer.ai_usage_events
  add column if not exists cached_input_tokens integer not null default 0,
  add column if not exists estimated_cost_eur numeric(18, 9),
  add column if not exists native_cost numeric(18, 9),
  add column if not exists pricing_currency text,
  add column if not exists native_to_eur_rate numeric(18, 9),
  add column if not exists usd_to_eur_rate numeric(18, 9),
  add column if not exists pricing_version text,
  add column if not exists search_query_count integer not null default 0;

alter table signal_layer.ai_usage_events
  drop constraint if exists ai_usage_events_pricing_currency_check;
alter table signal_layer.ai_usage_events
  add constraint ai_usage_events_pricing_currency_check
  check (pricing_currency is null or pricing_currency in ('USD', 'CNY')) not valid;
alter table signal_layer.ai_usage_events
  validate constraint ai_usage_events_pricing_currency_check;

-- Existing events predate per-request FX snapshots. Freeze them once using
-- the ECB reference rates exposed by Frankfurter on 2026-08-04. DeepSeek's
-- old USD estimate used 6.896551724 CNY/USD; reversing that approximation
-- restores the provider's native CNY amount before conversion to EUR.
update signal_layer.ai_usage_events
set pricing_currency = case when model in ('deepseek-v4-pro', 'deepseek-v4-flash') then 'CNY' else 'USD' end,
    native_cost = case
      when model in ('deepseek-v4-pro', 'deepseek-v4-flash') then estimated_cost_usd * 6.896551724
      else estimated_cost_usd
    end,
    native_to_eur_rate = case when model in ('deepseek-v4-pro', 'deepseek-v4-flash') then 0.12861 else 0.86812 end,
    usd_to_eur_rate = 0.86812,
    estimated_cost_eur = case
      when model in ('deepseek-v4-pro', 'deepseek-v4-flash') then estimated_cost_usd * 6.896551724 * 0.12861
      else estimated_cost_usd * 0.86812
    end,
    pricing_version = 'legacy-reconstructed-2026-08-04'
where estimated_cost_eur is null;

alter table signal_layer.ai_cost_ledger_daily
  add column if not exists cached_input_tokens bigint not null default 0,
  add column if not exists estimated_cost_eur numeric(18, 9) not null default 0,
  add column if not exists search_query_count bigint not null default 0;

create or replace function signal_layer.accumulate_ai_cost_ledger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into signal_layer.ai_cost_ledger_daily (
    usage_date, model, operation, status, request_count, error_count,
    input_tokens, cached_input_tokens, output_tokens, thinking_tokens, total_tokens,
    estimated_cost_usd, estimated_cost_eur, search_query_count,
    first_event_at, last_event_at, updated_at
  ) values (
    (new.created_at at time zone 'UTC')::date,
    coalesce(new.model, 'unknown'), coalesce(new.operation, 'unknown'), coalesce(new.status, 'unknown'),
    1, case when new.status = 'error' then 1 else 0 end,
    coalesce(new.input_tokens, 0), coalesce(new.cached_input_tokens, 0),
    coalesce(new.output_tokens, 0), coalesce(new.thinking_tokens, 0), coalesce(new.total_tokens, 0),
    coalesce(new.estimated_cost_usd, 0), coalesce(new.estimated_cost_eur, 0),
    coalesce(new.search_query_count, 0), new.created_at, new.created_at, now()
  )
  on conflict (usage_date, model, operation, status) do update set
    request_count = signal_layer.ai_cost_ledger_daily.request_count + excluded.request_count,
    error_count = signal_layer.ai_cost_ledger_daily.error_count + excluded.error_count,
    input_tokens = signal_layer.ai_cost_ledger_daily.input_tokens + excluded.input_tokens,
    cached_input_tokens = signal_layer.ai_cost_ledger_daily.cached_input_tokens + excluded.cached_input_tokens,
    output_tokens = signal_layer.ai_cost_ledger_daily.output_tokens + excluded.output_tokens,
    thinking_tokens = signal_layer.ai_cost_ledger_daily.thinking_tokens + excluded.thinking_tokens,
    total_tokens = signal_layer.ai_cost_ledger_daily.total_tokens + excluded.total_tokens,
    estimated_cost_usd = signal_layer.ai_cost_ledger_daily.estimated_cost_usd + excluded.estimated_cost_usd,
    estimated_cost_eur = signal_layer.ai_cost_ledger_daily.estimated_cost_eur + excluded.estimated_cost_eur,
    search_query_count = signal_layer.ai_cost_ledger_daily.search_query_count + excluded.search_query_count,
    first_event_at = least(signal_layer.ai_cost_ledger_daily.first_event_at, excluded.first_event_at),
    last_event_at = greatest(signal_layer.ai_cost_ledger_daily.last_event_at, excluded.last_event_at),
    updated_at = now();
  return new;
end;
$$;

-- The daily table is a derived cache. Rebuild it from the immutable events so
-- historic EUR snapshots and token totals remain internally consistent.
truncate table signal_layer.ai_cost_ledger_daily;
insert into signal_layer.ai_cost_ledger_daily (
  usage_date, model, operation, status, request_count, error_count,
  input_tokens, cached_input_tokens, output_tokens, thinking_tokens, total_tokens,
  estimated_cost_usd, estimated_cost_eur, search_query_count,
  first_event_at, last_event_at, updated_at
)
select (created_at at time zone 'UTC')::date, coalesce(model, 'unknown'),
       coalesce(operation, 'unknown'), coalesce(status, 'unknown'), count(*),
       count(*) filter (where status = 'error'), coalesce(sum(input_tokens), 0),
       coalesce(sum(cached_input_tokens), 0), coalesce(sum(output_tokens), 0),
       coalesce(sum(thinking_tokens), 0), coalesce(sum(total_tokens), 0),
       coalesce(sum(estimated_cost_usd), 0), coalesce(sum(estimated_cost_eur), 0),
       coalesce(sum(search_query_count), 0), min(created_at), max(created_at), now()
from signal_layer.ai_usage_events
group by 1, 2, 3, 4;

drop function if exists signal_layer.get_simple_cost_ledger();
create function signal_layer.get_simple_cost_ledger()
returns table(
  usage_date date, model text, operation text, status text,
  request_count bigint, error_count bigint, input_tokens bigint,
  cached_input_tokens bigint, output_tokens bigint, thinking_tokens bigint,
  total_tokens bigint, estimated_cost_usd numeric, estimated_cost_eur numeric,
  search_query_count bigint, first_event_at timestamptz, last_event_at timestamptz
)
language sql stable set search_path = ''
as $$
  select (events.created_at at time zone 'Europe/Berlin')::date, events.model,
    events.operation, events.status, count(*)::bigint,
    count(*) filter (where events.status = 'error')::bigint,
    coalesce(sum(events.input_tokens), 0)::bigint,
    coalesce(sum(events.cached_input_tokens), 0)::bigint,
    coalesce(sum(events.output_tokens), 0)::bigint,
    coalesce(sum(events.thinking_tokens), 0)::bigint,
    coalesce(sum(events.total_tokens), 0)::bigint,
    coalesce(sum(events.estimated_cost_usd), 0)::numeric,
    coalesce(sum(events.estimated_cost_eur), 0)::numeric,
    coalesce(sum(events.search_query_count), 0)::bigint,
    min(events.created_at), max(events.created_at)
  from signal_layer.ai_usage_events events
  where events.prompt_version ~ '^roots-simple-v[1-9][0-9]*(\.|$)'
  group by 1, 2, 3, 4
  order by 1, 2, 3, 4;
$$;
revoke all on function signal_layer.get_simple_cost_ledger() from public, anon, authenticated;
grant execute on function signal_layer.get_simple_cost_ledger() to service_role;

drop function if exists signal_layer.get_ai_usage_aggregate(timestamptz, uuid, boolean);
create function signal_layer.get_ai_usage_aggregate(
  p_since timestamptz, p_crawl_run_id uuid default null, p_uncrawled_only boolean default false
)
returns table(
  model text, operation text, status text, request_count bigint, article_count bigint,
  input_tokens bigint, output_tokens bigint, thinking_tokens bigint, total_tokens bigint,
  estimated_cost_usd numeric, estimated_cost_eur numeric
)
language sql stable set search_path = ''
as $$
  select coalesce(e.model, 'unknown'), coalesce(e.operation, 'unknown'), coalesce(e.status, 'unknown'),
    count(*), count(distinct e.article_id), coalesce(sum(e.input_tokens), 0),
    coalesce(sum(e.output_tokens), 0), coalesce(sum(e.thinking_tokens), 0),
    coalesce(sum(e.total_tokens), 0), coalesce(sum(e.estimated_cost_usd), 0),
    coalesce(sum(e.estimated_cost_eur), 0)
  from signal_layer.ai_usage_events e
  where e.created_at >= p_since
    and ((p_crawl_run_id is not null and e.crawl_run_id = p_crawl_run_id)
      or (p_crawl_run_id is null and p_uncrawled_only and e.crawl_run_id is null
        and e.simple_run_id is null and e.operation in ('classification', 'review', 'translation', 'offering_match'))
      or (p_crawl_run_id is null and not p_uncrawled_only))
  group by 1, 2, 3;
$$;
revoke all on function signal_layer.get_ai_usage_aggregate(timestamptz, uuid, boolean) from public, anon, authenticated;
grant execute on function signal_layer.get_ai_usage_aggregate(timestamptz, uuid, boolean) to service_role;
