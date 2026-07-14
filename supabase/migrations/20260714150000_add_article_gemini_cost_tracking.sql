-- Cumulative Gemini usage is kept on the article itself for simple reporting.
-- The existing ai_usage_events table remains the detailed per-call audit trail.
alter table signal_layer.articles
  add column if not exists gemini_request_count integer not null default 0,
  add column if not exists gemini_input_tokens bigint not null default 0,
  add column if not exists gemini_output_tokens bigint not null default 0,
  add column if not exists gemini_thinking_tokens bigint not null default 0,
  add column if not exists gemini_total_tokens bigint not null default 0,
  add column if not exists gemini_cost_usd numeric(14, 8) not null default 0,
  add column if not exists gemini_cost_eur numeric(14, 8),
  add column if not exists gemini_usd_eur_rate numeric(12, 8),
  add column if not exists gemini_cost_updated_at timestamptz;

comment on column signal_layer.articles.gemini_cost_eur is
  'Calculated EUR estimate from Gemini token usage and the stored USD/EUR rate; Gemini does not return invoice amounts per request.';

create or replace function signal_layer.record_article_gemini_usage(
  p_article_id uuid,
  p_input_tokens integer,
  p_output_tokens integer,
  p_thinking_tokens integer,
  p_total_tokens integer,
  p_cost_usd numeric,
  p_usd_eur_rate numeric default null
)
returns void
language sql
security invoker
set search_path = signal_layer, pg_temp
as $$
  update signal_layer.articles
  set gemini_request_count = gemini_request_count + 1,
      gemini_input_tokens = gemini_input_tokens + greatest(coalesce(p_input_tokens, 0), 0),
      gemini_output_tokens = gemini_output_tokens + greatest(coalesce(p_output_tokens, 0), 0),
      gemini_thinking_tokens = gemini_thinking_tokens + greatest(coalesce(p_thinking_tokens, 0), 0),
      gemini_total_tokens = gemini_total_tokens + greatest(coalesce(p_total_tokens, 0), 0),
      gemini_cost_usd = gemini_cost_usd + greatest(coalesce(p_cost_usd, 0), 0),
      gemini_cost_eur = case
        when p_usd_eur_rate is null then null
        else coalesce(gemini_cost_eur, 0) + greatest(coalesce(p_cost_usd, 0), 0) * p_usd_eur_rate
      end,
      gemini_usd_eur_rate = p_usd_eur_rate,
      gemini_cost_updated_at = timezone('utc', now())
  where id = p_article_id;
$$;

revoke all on function signal_layer.record_article_gemini_usage(uuid, integer, integer, integer, integer, numeric, numeric) from public;
grant execute on function signal_layer.record_article_gemini_usage(uuid, integer, integer, integer, integer, numeric, numeric) to service_role;
