create table if not exists signal_layer.browser_render_jobs (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references signal_layer.articles(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'error')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (article_id)
);

comment on table signal_layer.browser_render_jobs is
  'Internal Playwright render queue consumed by the authenticated GitHub Actions batch worker.';

create index if not exists browser_render_jobs_claim_idx
  on signal_layer.browser_render_jobs (status, created_at)
  where status in ('queued', 'running');

alter table signal_layer.browser_render_jobs enable row level security;

create or replace function signal_layer.claim_browser_render_jobs(p_limit integer default 12)
returns setof signal_layer.browser_render_jobs
language sql
security definer
set search_path = ''
as $$
  with picked as (
    select id
    from signal_layer.browser_render_jobs
    where status = 'queued' and attempts < 3
    order by created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 12), 25))
  )
  update signal_layer.browser_render_jobs job
  set status = 'running',
      attempts = job.attempts + 1,
      started_at = now(),
      finished_at = null,
      updated_at = now(),
      last_error = null
  from picked
  where job.id = picked.id
  returning job.*;
$$;

revoke all on table signal_layer.browser_render_jobs from public, anon, authenticated;
revoke all on function signal_layer.claim_browser_render_jobs(integer) from public, anon, authenticated;
grant all on table signal_layer.browser_render_jobs to service_role;
grant execute on function signal_layer.claim_browser_render_jobs(integer) to service_role;
