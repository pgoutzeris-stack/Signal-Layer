create table signal_layer.company_profile_jobs (
  id uuid primary key default gen_random_uuid(),
  company text not null unique,
  simple_run_id uuid references signal_layer.simple_runs(id) on delete set null,
  research_model text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'error')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  available_at timestamptz not null default now(),
  processing_token uuid,
  processing_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create index company_profile_jobs_claim_idx
  on signal_layer.company_profile_jobs (status, available_at, created_at)
  where status in ('queued', 'running');

alter table signal_layer.company_profile_jobs enable row level security;
revoke all on signal_layer.company_profile_jobs from public, anon, authenticated;
grant all on signal_layer.company_profile_jobs to service_role;

create or replace function signal_layer.claim_company_profile_job(p_lease_seconds integer default 150)
returns setof signal_layer.company_profile_jobs
language sql
security invoker
set search_path = ''
as $$
  with candidate as (
    select jobs.id
    from signal_layer.company_profile_jobs jobs
    where (
      jobs.status = 'queued' and jobs.available_at <= now()
    ) or (
      jobs.status = 'running' and jobs.processing_until < now()
    )
    order by jobs.available_at, jobs.created_at
    for update skip locked
    limit 1
  )
  update signal_layer.company_profile_jobs jobs
  set status = 'running',
      attempt_count = jobs.attempt_count + 1,
      processing_token = gen_random_uuid(),
      processing_until = now() + make_interval(secs => greatest(30, least(p_lease_seconds, 300))),
      updated_at = now()
  from candidate
  where jobs.id = candidate.id
  returning jobs.*;
$$;

revoke all on function signal_layer.claim_company_profile_job(integer) from public, anon, authenticated;
grant execute on function signal_layer.claim_company_profile_job(integer) to service_role;

-- Recover every Tier-1 company already classified but still lacking a profile.
insert into signal_layer.company_profile_jobs (
  company, simple_run_id, research_model, status, available_at
)
select distinct on (company_name)
  company_name,
  signals.run_id,
  coalesce(runs.research_model, 'gemini-2.5-flash'),
  'queued',
  now()
from signal_layer.simple_signals signals
cross join lateral unnest(coalesce(signals.tier1_companies, array[]::text[])) as companies(company_name)
left join signal_layer.simple_runs runs on runs.id = signals.run_id
left join signal_layer.company_profiles profiles
  on lower(btrim(profiles.company)) = lower(btrim(company_name))
where btrim(company_name) <> ''
  and profiles.company is null
order by company_name, signals.updated_at desc
on conflict (company) do nothing;
