create table if not exists signal_layer.pipeline_settings (
  id text primary key default 'active' check (id = 'active'),
  config jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into signal_layer.pipeline_settings (id, config)
values ('active', jsonb_build_object(
  'crawl', jsonb_build_object(
    'freshness_days', 183,
    'future_tolerance_hours', 24,
    'article_batch_size', 10,
    'default_max_depth', 2,
    'default_max_pages', 40,
    'event_max_depth', 1,
    'event_max_pages', 24
  ),
  'filters', jsonb_build_object(
    'minimum_text_length', 240,
    'require_professional_signal', true,
    'reject_career_pages', true,
    'reject_faq_pages', true,
    'reject_event_programs', true,
    'reject_future_dates', true,
    'deduplicate', true
  ),
  'ai', jsonb_build_object(
    'primary_model', 'gemini-3.5-flash',
    'review_model', 'gemini-3.1-pro-preview',
    'review_enabled', true,
    'review_confidence_below', 0.94,
    'review_rejected_articles', false,
    'thinking_level', 'low',
    'max_output_tokens', 4096,
    'daily_request_limit', 1000,
    'daily_review_limit', 250,
    'monthly_warning_usd', 10
  ),
  'quality', jsonb_build_object(
    'topic_confidence', 0.82,
    'territory_confidence', 0.84,
    'company_confidence', 0.86,
    'person_confidence', 0.86,
    'sales_trigger_confidence', 0.86,
    'routing_confidence', 0.88,
    'reliable_confidence', 0.90
  ),
  'routing', jsonb_build_object(
    'marketing_enabled', true,
    'sales_enabled', true,
    'buying_center_enabled', true,
    'sales_requires_tier1', true,
    'sales_requires_trigger', true,
    'buying_center_requires_person', true,
    'subsector_alone_is_marketing', false
  )
))
on conflict (id) do nothing;

comment on table signal_layer.pipeline_settings is
  'Active, versioned Signal Layer pipeline configuration edited through the Pipeline Studio.';
