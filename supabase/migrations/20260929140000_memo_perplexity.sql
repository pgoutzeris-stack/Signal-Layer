-- Das Executive Memo schreibt Claude Opus ueber die Perplexity Agent API und
-- recherchiert dort auch Marktzahlen. Der pg_net-Weg kannte nur DeepSeek.
create or replace function signal_layer.start_asset_model_call(
  p_asset_id uuid,
  p_call text,
  p_attempt integer,
  p_model text,
  p_body jsonb,
  p_timeout_ms integer,
  p_events jsonb default '[]'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created_at timestamptz;
  v_key text;
  v_url text;
  v_timeout integer := least(greatest(coalesce(p_timeout_ms, 600000), 30000), 900000);
  v_attempt integer := greatest(coalesce(p_attempt, 1), 1);
  v_request_id bigint;
  v_t bigint;
begin
  if p_call is null or p_call not in ('entwurf', 'reparatur') then
    raise exception 'Unbekannter Modellaufruf: %', p_call;
  end if;
  if p_body is null or jsonb_typeof(p_body) <> 'object' then
    raise exception 'Der Modellaufruf braucht einen JSON-Body.';
  end if;

  select a.created_at into v_created_at
  from signal_layer.generated_assets a
  where a.id = p_asset_id and a.status = 'running'
  for update;
  if not found then
    return null;
  end if;

  -- Modelle mit Anbieter im Namen (anthropic/…, openai/…) laufen ueber die
  -- Perplexity Agent API, alles andere ueber DeepSeek.
  if position('/' in coalesce(p_model, '')) > 0 then
    v_url := 'https://api.perplexity.ai/v1/responses';
    v_key := shared.get_api_key('perplexity_api_key');
    if coalesce(v_key, '') = '' then
      raise exception 'Der API-Schlüssel für Perplexity fehlt im Supabase Vault.';
    end if;
  else
    v_url := 'https://api.deepseek.com/chat/completions';
    v_key := shared.get_api_key('signal_layer_deepseek_api_key');
    if coalesce(v_key, '') = '' then
      raise exception 'Der API-Schlüssel für DeepSeek fehlt im Supabase Vault.';
    end if;
  end if;

  v_request_id := net.http_post(
    url := v_url,
    body := p_body,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    timeout_milliseconds := v_timeout
  );

  insert into signal_layer.asset_model_calls (request_id, asset_id, call, attempt, model, timeout_ms, body)
  values (v_request_id, p_asset_id, p_call, v_attempt, coalesce(nullif(p_model, ''), 'deepseek'), v_timeout, p_body);

  v_t := floor(extract(epoch from (clock_timestamp() - v_created_at)) * 1000)::bigint;
  update signal_layer.generated_assets a
  set run_log = coalesce(a.run_log, '[]'::jsonb)
        || signal_layer.asset_log_events(p_events, v_t)
        || jsonb_build_array(jsonb_build_object(
          't', v_t, 'event', 'model_call', 'call', p_call, 'request_id', v_request_id,
          'attempt', v_attempt, 'timeout_ms', v_timeout
        )),
      stage = 'modell',
      updated_at = now(),
      duration_ms = v_t::integer
  where a.id = p_asset_id;

  return v_request_id;
end;
$$;
revoke all on function signal_layer.start_asset_model_call(uuid, text, integer, text, jsonb, integer, jsonb) from public, anon, authenticated;
grant execute on function signal_layer.start_asset_model_call(uuid, text, integer, text, jsonb, integer, jsonb) to service_role;

alter table signal_layer.ai_usage_events
  drop constraint if exists ai_usage_events_operation_check;
alter table signal_layer.ai_usage_events
  add constraint ai_usage_events_operation_check
  check (operation in (
    'classification', 'review', 'preview', 'test', 'translation',
    'offering_match', 'company_profile', 'company_logo', 'asset_generation',
    'memo_benchmark_research', 'memo_market_research', 'memo_scene_image', 'memo_field_sharpen',
    'memo_section_draft', 'manual_signal_check', 'manual_signal_draft'
  ));

create or replace view signal_layer.asset_cost_totals
with (security_invoker = true) as
select
  a.id as asset_id, a.kind, a.status, a.created_at,
  count(e.id) as calls,
  coalesce(sum(e.total_tokens), a.total_tokens, 0) as total_tokens,
  coalesce(sum(e.estimated_cost_eur) filter (where e.operation = 'asset_generation'), a.cost_eur, 0) as draft_cost_eur,
  coalesce(sum(e.estimated_cost_eur) filter (where e.operation in ('memo_benchmark_research', 'memo_market_research')), 0) as research_cost_eur,
  coalesce(sum(e.estimated_cost_eur) filter (where e.operation = 'memo_scene_image'), 0) as image_cost_eur,
  coalesce(sum(e.grounding_cost_usd), 0) as grounding_cost_usd,
  coalesce(sum(e.search_query_count), 0) as search_queries,
  case when count(e.id) > 0 then coalesce(sum(e.estimated_cost_eur), 0) else coalesce(a.cost_eur, 0) end as total_cost_eur
from signal_layer.generated_assets a
left join signal_layer.ai_usage_events e on e.asset_id = a.id
group by a.id;
