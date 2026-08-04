update signal_layer.ai_usage_events
set estimated_cost_eur = 0,
    native_cost = coalesce(native_cost, 0),
    pricing_version = coalesce(pricing_version, 'zero-usage-repaired-2026-08-04')
where estimated_cost_eur is null;

alter table signal_layer.ai_usage_events
  alter column estimated_cost_eur set default 0,
  alter column estimated_cost_eur set not null;
