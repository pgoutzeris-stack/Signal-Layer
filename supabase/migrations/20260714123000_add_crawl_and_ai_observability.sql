alter table signal_layer.sources
  add column if not exists last_attempted_at timestamptz,
  add column if not exists last_successful_at timestamptz,
  add column if not exists last_error text,
  add column if not exists last_candidate_count integer not null default 0,
  add column if not exists last_inserted_count integer not null default 0;

update signal_layer.sources
set last_successful_at = coalesce(last_successful_at, last_crawled_at),
    last_attempted_at = coalesce(last_attempted_at, last_crawled_at)
where last_crawled_at is not null;

-- Generic website crawling is not reliable for authenticated social networks.
-- Keep the records for later source-specific actors/APIs, but do not send them
-- through the general Apify Web Scraper in scheduled runs.
update signal_layer.sources
set active = false,
    last_error = 'Deaktiviert: benötigt eine plattformspezifische API oder einen spezialisierten Apify Actor'
where source_type = 'social' and feed_type = 'apify';

create table if not exists signal_layer.source_crawl_attempts (
  id uuid primary key default gen_random_uuid(),
  crawl_run_id uuid references signal_layer.crawl_runs(id) on delete set null,
  source_id uuid not null references signal_layer.sources(id) on delete cascade,
  feed_type text not null,
  status text not null check (status in ('running', 'success', 'empty', 'error')),
  provider_run_id text,
  http_status integer,
  discovered_count integer not null default 0,
  candidate_count integer not null default 0,
  rejected_count integer not null default 0,
  inserted_count integer not null default 0,
  rejection_breakdown jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer
);

create index if not exists source_crawl_attempts_source_started_idx
  on signal_layer.source_crawl_attempts (source_id, started_at desc);
create index if not exists source_crawl_attempts_run_idx
  on signal_layer.source_crawl_attempts (crawl_run_id);

create table if not exists signal_layer.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references signal_layer.articles(id) on delete set null,
  crawl_run_id uuid references signal_layer.crawl_runs(id) on delete set null,
  operation text not null check (operation in ('classification', 'review', 'preview', 'test')),
  model text not null,
  status text not null check (status in ('success', 'error')),
  attempt integer not null default 1,
  prompt_version text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  thinking_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0,
  duration_ms integer,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_created_idx
  on signal_layer.ai_usage_events (created_at desc);
create index if not exists ai_usage_events_article_idx
  on signal_layer.ai_usage_events (article_id);
create index if not exists ai_usage_events_model_idx
  on signal_layer.ai_usage_events (model, created_at desc);

comment on table signal_layer.source_crawl_attempts is
  'One observable result per source and crawl attempt, including Apify run metadata and rejection counts.';
comment on table signal_layer.ai_usage_events is
  'Gemini usageMetadata, errors and estimated USD cost for every classifier and reviewer request.';
