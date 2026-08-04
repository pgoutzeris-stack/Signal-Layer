create table signal_layer.simple_trigger_backfill_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running' check (status in ('running', 'done', 'error')),
  pipeline_version text not null default '1.9',
  article_ids jsonb not null default '[]'::jsonb,
  cursor integer not null default 0,
  total_count integer not null default 0,
  completed_count integer not null default 0,
  missing_count integer not null default 0,
  error_count integer not null default 0,
  model text,
  current_article text,
  error_message text,
  started_at timestamptz not null default now(),
  last_progress_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table signal_layer.simple_trigger_backfill_runs enable row level security;

create index simple_trigger_backfill_runs_active_idx
  on signal_layer.simple_trigger_backfill_runs (status, last_progress_at desc)
  where status = 'running';
