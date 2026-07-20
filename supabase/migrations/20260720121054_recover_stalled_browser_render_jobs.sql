create or replace function signal_layer.claim_browser_render_jobs(p_limit integer default 12)
returns setof signal_layer.browser_render_jobs
language sql
security definer
set search_path = ''
as $$
  with picked as (
    select id
    from signal_layer.browser_render_jobs
    where attempts < 3
      and (
        status = 'queued'
        or (status = 'running' and started_at < now() - interval '2 hours')
      )
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

revoke all on function signal_layer.claim_browser_render_jobs(integer) from public, anon, authenticated;
grant execute on function signal_layer.claim_browser_render_jobs(integer) to service_role;
