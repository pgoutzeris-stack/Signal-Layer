-- Steckbrief- und Logo-Recherchen sind echte Simple-KI-Operationen. Der alte
-- Check kannte nur die Advanced-Artikeloperationen und wies ihre
-- ai_usage_events deshalb nach dem bereits bezahlten Gemini-Aufruf ab.
alter table signal_layer.ai_usage_events
  drop constraint if exists ai_usage_events_operation_check;
alter table signal_layer.ai_usage_events
  add constraint ai_usage_events_operation_check
  check (operation in (
    'classification', 'review', 'preview', 'test', 'translation',
    'offering_match', 'company_profile', 'company_logo'
  ));

-- Zwei frühe, abgeschnittene DeepSeek-Antworten hatten noch keine
-- Kostenbuchung. total_tokens enthält Input + Completion korrekt; die damals
-- doppelt ausgewiesenen Reasoning-/Output-Felder werden deshalb nicht addiert.
with repaired as (
  select id,
    (((input_tokens - cached_input_tokens) * 3.0
      + cached_input_tokens * 0.025
      + greatest(total_tokens - input_tokens, 0) * 6.0) / 1000000.0)::numeric as cost_cny
  from signal_layer.ai_usage_events
  where prompt_version like 'roots-simple-v%'
    and model = 'deepseek-v4-pro'
    and total_tokens > 0
    and estimated_cost_eur = 0
    and estimated_cost_usd = 0
)
update signal_layer.ai_usage_events event
set native_cost = repaired.cost_cny,
    pricing_currency = 'CNY',
    native_to_eur_rate = 0.12861,
    usd_to_eur_rate = 0.86812,
    estimated_cost_eur = repaired.cost_cny * 0.12861,
    estimated_cost_usd = repaired.cost_cny * 0.12861 / 0.86812,
    pricing_version = 'legacy-zero-cost-reconstructed-2026-08-05'
from repaired
where event.id = repaired.id;

-- Vier weitere Simple-Ereignisse besaßen bereits den damals berechneten
-- USD-Wert. Rekonstruiere daraus wie beim bestehenden Legacy-Backfill den
-- CNY- und EUR-Snapshot, ohne Token oder Anbieterpreis neu zu schätzen.
update signal_layer.ai_usage_events
set native_cost = estimated_cost_usd * 6.896551724,
    pricing_currency = 'CNY',
    native_to_eur_rate = 0.12861,
    usd_to_eur_rate = 0.86812,
    estimated_cost_eur = estimated_cost_usd * 6.896551724 * 0.12861,
    pricing_version = 'legacy-zero-cost-reconstructed-2026-08-05'
where prompt_version like 'roots-simple-v%'
  and model = 'deepseek-v4-pro'
  and total_tokens > 0
  and estimated_cost_eur = 0
  and estimated_cost_usd > 0;

-- Die Tagesaggregation ist nur ein Cache. Aktualisiere ausschließlich die
-- betroffenen Tage statt wegen sechs Zeilen alle historischen Ereignisse neu
-- zu schreiben; das hält die Disk-I/O klein.
with affected_days as (
  select distinct (created_at at time zone 'UTC')::date as usage_date
  from signal_layer.ai_usage_events
  where pricing_version = 'legacy-zero-cost-reconstructed-2026-08-05'
), refreshed as (
  select (event.created_at at time zone 'UTC')::date as usage_date,
    coalesce(event.model, 'unknown') as model,
    coalesce(event.operation, 'unknown') as operation,
    coalesce(event.status, 'unknown') as status,
    count(*)::bigint as request_count,
    count(*) filter (where event.status = 'error')::bigint as error_count,
    coalesce(sum(event.input_tokens), 0)::bigint as input_tokens,
    coalesce(sum(event.cached_input_tokens), 0)::bigint as cached_input_tokens,
    coalesce(sum(event.output_tokens), 0)::bigint as output_tokens,
    coalesce(sum(event.thinking_tokens), 0)::bigint as thinking_tokens,
    coalesce(sum(event.total_tokens), 0)::bigint as total_tokens,
    coalesce(sum(event.estimated_cost_usd), 0)::numeric as estimated_cost_usd,
    coalesce(sum(event.estimated_cost_eur), 0)::numeric as estimated_cost_eur,
    coalesce(sum(event.search_query_count), 0)::bigint as search_query_count,
    min(event.created_at) as first_event_at,
    max(event.created_at) as last_event_at
  from signal_layer.ai_usage_events event
  join affected_days day
    on day.usage_date = (event.created_at at time zone 'UTC')::date
  group by 1, 2, 3, 4
)
update signal_layer.ai_cost_ledger_daily ledger
set request_count = refreshed.request_count,
    error_count = refreshed.error_count,
    input_tokens = refreshed.input_tokens,
    cached_input_tokens = refreshed.cached_input_tokens,
    output_tokens = refreshed.output_tokens,
    thinking_tokens = refreshed.thinking_tokens,
    total_tokens = refreshed.total_tokens,
    estimated_cost_usd = refreshed.estimated_cost_usd,
    estimated_cost_eur = refreshed.estimated_cost_eur,
    search_query_count = refreshed.search_query_count,
    first_event_at = refreshed.first_event_at,
    last_event_at = refreshed.last_event_at,
    updated_at = now()
from refreshed
where ledger.usage_date = refreshed.usage_date
  and ledger.model = refreshed.model
  and ledger.operation = refreshed.operation
  and ledger.status = refreshed.status;

-- Neue kostenpflichtige Aufrufe dürfen nie wieder als 0-Euro-Ereignis in das
-- Ledger gelangen. NOT VALID schützt neue Zeilen sofort, ohne wegen alter
-- anderer Pipelines eine große Validierungsprüfung oder Tabellenlast auszulösen.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_usage_events_paid_tokens_have_cost'
      and conrelid = 'signal_layer.ai_usage_events'::regclass
  ) then
    alter table signal_layer.ai_usage_events
      add constraint ai_usage_events_paid_tokens_have_cost
      check (total_tokens <= 0 or estimated_cost_eur > 0) not valid;
  end if;
end $$;
