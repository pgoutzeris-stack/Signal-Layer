alter table signal_layer.articles
  add column if not exists title_de text;

create table if not exists signal_layer.classification_backfill_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running' check (status in ('running', 'done', 'error')),
  cutoff_at timestamptz not null,
  total_count integer not null default 0,
  processed_count integer not null default 0,
  started_at timestamptz not null default now(),
  last_progress_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text
);

alter table signal_layer.classification_backfill_runs enable row level security;

comment on column signal_layer.articles.title_de is
  'Reliable German display-title generated during structured Gemini classification; original title remains unchanged.';
