create table if not exists signal_layer.source_crawl_jobs (
  id uuid primary key default gen_random_uuid(),
  crawl_run_id uuid not null references signal_layer.crawl_runs(id) on delete cascade,
  source_id uuid not null references signal_layer.sources(id) on delete cascade,
  position integer not null,
  status text not null default 'queued' check (status in ('queued','running','success','empty','error')),
  attempts integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  error_code text,
  error_message text,
  unique (crawl_run_id, source_id)
);

create index if not exists source_crawl_jobs_claim_idx
  on signal_layer.source_crawl_jobs (crawl_run_id, status, position);

create table if not exists signal_layer.article_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references signal_layer.articles(id) on delete cascade,
  crawl_run_id uuid references signal_layer.crawl_runs(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','done','error')),
  attempts integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  unique (article_id)
);

create index if not exists article_analysis_jobs_claim_idx
  on signal_layer.article_analysis_jobs (status, id);

create or replace function signal_layer.claim_source_crawl_job(p_crawl_run_id uuid)
returns setof signal_layer.source_crawl_jobs
language sql
security definer
set search_path = signal_layer, public
as $$
  with picked as (
    select id from signal_layer.source_crawl_jobs
    where crawl_run_id = p_crawl_run_id and status = 'queued' and attempts < 2
    order by position
    for update skip locked
    limit 1
  )
  update signal_layer.source_crawl_jobs j
  set status='running', attempts=j.attempts+1, started_at=now(), finished_at=null,
      error_code=null, error_message=null
  from picked
  where j.id=picked.id
  returning j.*;
$$;

create or replace function signal_layer.claim_article_analysis_job()
returns setof signal_layer.article_analysis_jobs
language sql
security definer
set search_path = signal_layer, public
as $$
  with picked as (
    select id from signal_layer.article_analysis_jobs
    where status = 'queued' and attempts < 2
    order by id
    for update skip locked
    limit 1
  )
  update signal_layer.article_analysis_jobs j
  set status='running', attempts=j.attempts+1, started_at=now(), finished_at=null, error_message=null
  from picked
  where j.id=picked.id
  returning j.*;
$$;

revoke all on function signal_layer.claim_source_crawl_job(uuid) from public, anon, authenticated;
revoke all on function signal_layer.claim_article_analysis_job() from public, anon, authenticated;
grant execute on function signal_layer.claim_source_crawl_job(uuid) to service_role;
grant execute on function signal_layer.claim_article_analysis_job() to service_role;
