-- Cost and consistency guardrails for the Signal Layer analysis pipeline.
-- The existing five-minute pipeline watchdog remains the single coordinator;
-- throughput is increased in the Edge Function without overlapping cron jobs.

alter table signal_layer.articles
  add column if not exists body_hash text;

create index if not exists articles_body_hash_idx
  on signal_layer.articles (body_hash)
  where body_hash is not null;

create index if not exists articles_published_active_idx
  on signal_layer.articles (published_at, source_id)
  where duplicate_of is null and published_at is not null;

alter table signal_layer.ai_batch_jobs
  alter column provider_job_name drop not null;

alter table signal_layer.ai_batch_jobs
  drop constraint if exists ai_batch_jobs_status_check;
alter table signal_layer.ai_batch_jobs
  add constraint ai_batch_jobs_status_check
  check (status in ('reserving','submitted','running','succeeded','failed','expired','cancelled'));

alter table signal_layer.ai_batch_items
  add column if not exists content_fingerprint text;
alter table signal_layer.ai_batch_items
  drop constraint if exists ai_batch_items_status_check;
alter table signal_layer.ai_batch_items
  alter column status set default 'reserved';
alter table signal_layer.ai_batch_items
  add constraint ai_batch_items_status_check
  check (status in ('reserved','submitted','succeeded','failed'));

create or replace function signal_layer.reserve_ai_batch(
  p_model text,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = signal_layer, public
as $$
declare
  v_batch_id uuid;
  v_count integer;
begin
  if p_model is null or btrim(p_model) = '' then
    raise exception 'model_required';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'items_must_be_array';
  end if;
  v_count := jsonb_array_length(p_items);
  if v_count < 1 or v_count > 32 then
    raise exception 'invalid_batch_size';
  end if;

  insert into signal_layer.ai_batch_jobs (model, status, request_count)
  values (p_model, 'reserving', v_count)
  returning id into v_batch_id;

  insert into signal_layer.ai_batch_items (
    batch_id, analysis_job_id, article_id, position, status, content_fingerprint
  )
  select
    v_batch_id,
    j.id,
    j.article_id,
    item.ordinality - 1,
    'reserved',
    nullif(item.value->>'content_fingerprint', '')
  from jsonb_array_elements(p_items) with ordinality as item(value, ordinality)
  join signal_layer.article_analysis_jobs j
    on j.id = (item.value->>'analysis_job_id')::uuid
   and j.article_id = (item.value->>'article_id')::uuid
   and j.status = 'running'
   and j.processing_mode = 'batch';

  if (select count(*) from signal_layer.ai_batch_items where batch_id = v_batch_id) <> v_count then
    raise exception 'batch_item_count_mismatch';
  end if;
  return v_batch_id;
end;
$$;

revoke all on function signal_layer.reserve_ai_batch(text, jsonb) from public, anon, authenticated;
grant execute on function signal_layer.reserve_ai_batch(text, jsonb) to service_role;

comment on function signal_layer.reserve_ai_batch(text, jsonb) is
  'Atomically reserves a local batch and all item mappings before external provider submission.';

create or replace function signal_layer.finalize_ai_batch(
  p_batch_id uuid,
  p_provider_job_name text
)
returns boolean
language plpgsql
security invoker
set search_path = signal_layer, public
as $$
begin
  if p_provider_job_name is null or btrim(p_provider_job_name) = '' then
    raise exception 'provider_job_name_required';
  end if;
  update signal_layer.ai_batch_jobs
  set provider_job_name = p_provider_job_name,
      status = 'submitted',
      checked_at = now(),
      error_message = null
  where id = p_batch_id
    and status in ('reserving', 'submitted')
    and (provider_job_name is null or provider_job_name = p_provider_job_name);
  if not found then return false; end if;
  update signal_layer.ai_batch_items
  set status = 'submitted', error_message = null
  where batch_id = p_batch_id and status in ('reserved', 'submitted');
  return true;
end;
$$;

create or replace function signal_layer.fail_ai_batch_reservation(
  p_batch_id uuid,
  p_error text
)
returns void
language plpgsql
security invoker
set search_path = signal_layer, public
as $$
begin
  update signal_layer.ai_batch_jobs
  set status = 'failed', finished_at = now(), checked_at = now(),
      error_message = left(coalesce(p_error, 'batch_submission_failed'), 1000)
  where id = p_batch_id and status = 'reserving';
  if not found then return; end if;
  update signal_layer.ai_batch_items
  set status = 'failed', error_message = left(coalesce(p_error, 'batch_submission_failed'), 1000)
  where batch_id = p_batch_id and status = 'reserved';
  update signal_layer.article_analysis_jobs j
  set status = 'error', processing_mode = 'batch', finished_at = now(),
      error_message = left(coalesce(p_error, 'batch_submission_failed'), 500)
  from signal_layer.ai_batch_items i
  where i.batch_id = p_batch_id and j.id = i.analysis_job_id;
end;
$$;

revoke all on function signal_layer.finalize_ai_batch(uuid, text) from public, anon, authenticated;
revoke all on function signal_layer.fail_ai_batch_reservation(uuid, text) from public, anon, authenticated;
grant execute on function signal_layer.finalize_ai_batch(uuid, text) to service_role;
grant execute on function signal_layer.fail_ai_batch_reservation(uuid, text) to service_role;
