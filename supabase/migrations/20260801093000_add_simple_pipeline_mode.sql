-- Simple ("Einfach") pipeline mode.
--
-- Purely additive: the advanced pipeline keeps writing to signal_layer.articles
-- exactly as before. Simple-mode results live in their own tables so a re-run
-- over stored articles can never overwrite an advanced classification.

create table if not exists signal_layer.simple_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running'
    check (status in ('running', 'done', 'error')),
  article_limit integer not null default 100,
  article_ids jsonb not null default '[]'::jsonb,
  cursor integer not null default 0,
  total_count integer not null default 0,
  processed_count integer not null default 0,
  signal_count integer not null default 0,
  rejected_count integer not null default 0,
  prompt_version text,
  model text,
  triggered_by uuid,
  started_at timestamptz not null default now(),
  last_progress_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text
);

comment on table signal_layer.simple_runs is
  'One re-analysis run of the simple pipeline over the newest stored articles. The simple mode never crawls.';

create table if not exists signal_layer.simple_signals (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null unique references signal_layer.articles (id) on delete cascade,
  run_id uuid references signal_layer.simple_runs (id) on delete set null,
  status text not null check (status in ('signal', 'rejected')),
  lane text check (lane in ('marketing', 'sales')),
  signal_id text,
  signal_label text,
  score smallint not null default 0 check (score >= 0 and score <= 100),
  confidence numeric,
  evidence text,
  headline_de text,
  why_de text,
  company text,
  matched_families text[] not null default '{}'::text[],
  reject_reason text,
  model text,
  prompt_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table signal_layer.simple_signals is
  'Latest simple-mode result per article: one confirmed signal family with verbatim evidence, or the reason it was rejected.';
comment on column signal_layer.simple_signals.matched_families is
  'Signal families the deterministic prefilter accepted; the model could only choose from these.';

create index if not exists simple_signals_lane_score_idx
  on signal_layer.simple_signals (lane, score desc)
  where status = 'signal';
create index if not exists simple_signals_run_idx
  on signal_layer.simple_signals (run_id);
create index if not exists simple_runs_status_idx
  on signal_layer.simple_runs (status, started_at desc);

-- Access follows the rest of the schema: the edge function talks to these
-- tables with the service role, no client ever reads them directly.
alter table signal_layer.simple_runs enable row level security;
alter table signal_layer.simple_signals enable row level security;

grant usage on schema signal_layer to service_role;
grant all on signal_layer.simple_runs to service_role;
grant all on signal_layer.simple_signals to service_role;
