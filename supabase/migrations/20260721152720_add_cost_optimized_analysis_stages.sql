alter table signal_layer.articles
  add column if not exists classification_stage_hash text,
  add column if not exists routing_stage_hash text,
  add column if not exists offering_stage_hash text,
  add column if not exists translation_stage_hash text,
  add column if not exists matched_offering_id text;

alter table signal_layer.ai_usage_events
  add column if not exists inference_mode text not null default 'standard'
  check (inference_mode in ('standard', 'batch'));

create index if not exists articles_classification_stage_hash_idx
  on signal_layer.articles (classification_stage_hash)
  where classification_stage_hash is not null;

alter table signal_layer.article_analysis_jobs
  add column if not exists processing_mode text not null default 'batch'
  check (processing_mode in ('batch', 'standard'));

create table if not exists signal_layer.ai_batch_jobs (
  id uuid primary key default gen_random_uuid(),
  provider_job_name text unique not null,
  model text not null,
  status text not null default 'submitted'
    check (status in ('submitted','running','succeeded','failed','expired','cancelled')),
  request_count integer not null,
  submitted_at timestamptz not null default now(),
  checked_at timestamptz,
  finished_at timestamptz,
  error_message text
);

create table if not exists signal_layer.ai_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references signal_layer.ai_batch_jobs(id) on delete cascade,
  analysis_job_id uuid not null references signal_layer.article_analysis_jobs(id) on delete cascade,
  article_id uuid not null references signal_layer.articles(id) on delete cascade,
  position integer not null,
  status text not null default 'submitted'
    check (status in ('submitted','succeeded','failed')),
  error_message text,
  unique (batch_id, position),
  unique (analysis_job_id)
);

create index if not exists ai_batch_jobs_poll_idx
  on signal_layer.ai_batch_jobs (status, checked_at, submitted_at);

alter table signal_layer.ai_batch_jobs enable row level security;
alter table signal_layer.ai_batch_items enable row level security;
create policy ai_batch_jobs_service_only on signal_layer.ai_batch_jobs
  for all to service_role using (true) with check (true);
create policy ai_batch_items_service_only on signal_layer.ai_batch_items
  for all to service_role using (true) with check (true);
revoke all on signal_layer.ai_batch_jobs from public, anon, authenticated;
revoke all on signal_layer.ai_batch_items from public, anon, authenticated;
grant all on signal_layer.ai_batch_jobs to service_role;
grant all on signal_layer.ai_batch_items to service_role;

create or replace function signal_layer.claim_article_analysis_jobs(p_limit integer default 8)
returns setof signal_layer.article_analysis_jobs
language sql
security invoker
set search_path = signal_layer, public
as $$
  with picked as (
    select j.id
    from signal_layer.article_analysis_jobs j
    join signal_layer.articles a on a.id = j.article_id
    where j.status = 'queued'
      and j.attempts < 2
      and j.processing_mode = 'batch'
      and char_length(coalesce(a.content, '')) >= 500
    order by j.id
    for update of j skip locked
    limit greatest(1, least(coalesce(p_limit, 8), 32))
  )
  update signal_layer.article_analysis_jobs j
  set status='running', attempts=j.attempts+1, started_at=now(), finished_at=null, error_message=null
  from picked
  where j.id=picked.id
  returning j.*;
$$;

create or replace function signal_layer.claim_article_analysis_job()
returns setof signal_layer.article_analysis_jobs
language sql
security invoker
set search_path = signal_layer, public
as $$
  with picked as (
    select j.id
    from signal_layer.article_analysis_jobs j
    join signal_layer.articles a on a.id = j.article_id
    where j.status = 'queued' and j.attempts < 2
      and (j.processing_mode = 'standard' or char_length(coalesce(a.content, '')) < 500)
    order by j.id
    for update of j skip locked
    limit 1
  )
  update signal_layer.article_analysis_jobs j
  set status='running', attempts=j.attempts+1, started_at=now(), finished_at=null, error_message=null,
      processing_mode='standard'
  from picked
  where j.id=picked.id
  returning j.*;
$$;

revoke all on function signal_layer.claim_article_analysis_jobs(integer) from public, anon, authenticated;
revoke all on function signal_layer.claim_article_analysis_job() from public, anon, authenticated;
grant execute on function signal_layer.claim_article_analysis_jobs(integer) to service_role;
grant execute on function signal_layer.claim_article_analysis_job() to service_role;

update signal_layer.pipeline_settings
set config = jsonb_set(
  jsonb_set(
    jsonb_set(config, '{ai,batch_enabled}', 'true'::jsonb, true),
    '{ai,batch_size}', '8'::jsonb, true
  ),
  '{ai,review_confidence_below}', '0.9'::jsonb, true
), version = version + 1, updated_at = now()
where id = 'active';

do $$
begin
  if exists (select 1 from cron.job where jobname = 'signal-layer-ai-batch-watchdog') then
    perform cron.unschedule('signal-layer-ai-batch-watchdog');
  end if;
end $$;

select cron.schedule(
  'signal-layer-ai-batch-watchdog',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://csmguwcvzreefluhahyu.supabase.co/functions/v1/signal-layer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', shared.get_api_key('signal_layer_cron_secret')
    ),
    body := '{"action":"process_analysis_batches"}'::jsonb
  );
  $$
);
