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
  set gemini_request_count = coalesce(gemini_request_count, 0) + 1,
      gemini_input_tokens = coalesce(gemini_input_tokens, 0) + greatest(coalesce(p_input_tokens, 0), 0),
      gemini_output_tokens = coalesce(gemini_output_tokens, 0) + greatest(coalesce(p_output_tokens, 0), 0),
      gemini_thinking_tokens = coalesce(gemini_thinking_tokens, 0) + greatest(coalesce(p_thinking_tokens, 0), 0),
      gemini_total_tokens = coalesce(gemini_total_tokens, 0) + greatest(coalesce(p_total_tokens, 0), 0),
      gemini_cost_usd = coalesce(gemini_cost_usd, 0) + greatest(coalesce(p_cost_usd, 0), 0),
      gemini_cost_eur = case
        when p_usd_eur_rate is null then gemini_cost_eur
        else coalesce(gemini_cost_eur, 0) + greatest(coalesce(p_cost_usd, 0), 0) * p_usd_eur_rate
      end,
      gemini_usd_eur_rate = coalesce(p_usd_eur_rate, gemini_usd_eur_rate),
      gemini_cost_updated_at = timezone('utc', now())
  where id = p_article_id;
$$;

with totals as (
  select article_id,
    count(*)::integer as requests,
    sum(coalesce(input_tokens, 0))::bigint as input_tokens,
    sum(coalesce(output_tokens, 0))::bigint as output_tokens,
    sum(coalesce(thinking_tokens, 0))::bigint as thinking_tokens,
    sum(coalesce(total_tokens, 0))::bigint as total_tokens,
    sum(coalesce(estimated_cost_usd, 0))::numeric as cost_usd,
    max(created_at) as updated_at
  from signal_layer.ai_usage_events
  where article_id is not null and coalesce(total_tokens, 0) > 0
  group by article_id
)
update signal_layer.articles a
set gemini_request_count = t.requests,
    gemini_input_tokens = t.input_tokens,
    gemini_output_tokens = t.output_tokens,
    gemini_thinking_tokens = t.thinking_tokens,
    gemini_total_tokens = t.total_tokens,
    gemini_cost_usd = t.cost_usd,
    gemini_cost_updated_at = t.updated_at
from totals t
where a.id = t.article_id;
