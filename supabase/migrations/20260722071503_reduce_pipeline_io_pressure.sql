-- Reduce write amplification and overlapping Edge invocations on the small
-- production database. The daily crawl remains unchanged; recovery and batch
-- processing are coordinated by one five-minute watchdog.

create index if not exists article_analysis_jobs_batch_claim_idx
  on signal_layer.article_analysis_jobs (processing_mode, status, attempts, id)
  where status = 'queued' and attempts < 2;

create index if not exists browser_render_jobs_queued_claim_idx
  on signal_layer.browser_render_jobs (created_at, id)
  where status = 'queued' and attempts < 3;

create index if not exists browser_source_discovery_jobs_queued_claim_idx
  on signal_layer.browser_source_discovery_jobs (created_at, id)
  where status = 'queued' and attempts < 3;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'signal-layer-crawl-watchdog') then
    perform cron.unschedule('signal-layer-crawl-watchdog');
  end if;
  if exists (select 1 from cron.job where jobname = 'signal-layer-classification-backfill-watchdog') then
    perform cron.unschedule('signal-layer-classification-backfill-watchdog');
  end if;
  if exists (select 1 from cron.job where jobname = 'signal-layer-source-crawl-watchdog') then
    perform cron.unschedule('signal-layer-source-crawl-watchdog');
  end if;
  if exists (select 1 from cron.job where jobname = 'signal-layer-ai-batch-watchdog') then
    perform cron.unschedule('signal-layer-ai-batch-watchdog');
  end if;
end $$;

select cron.schedule(
  'signal-layer-pipeline-watchdog',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://csmguwcvzreefluhahyu.supabase.co/functions/v1/signal-layer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', shared.get_api_key('signal_layer_cron_secret')
    ),
    body := '{"action":"resume_stalled_crawls"}'::jsonb
  );
  $$
);

select cron.schedule(
  'signal-layer-backfill-watchdog',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://csmguwcvzreefluhahyu.supabase.co/functions/v1/signal-layer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', shared.get_api_key('signal_layer_cron_secret')
    ),
    body := '{"action":"resume_classification_backfill"}'::jsonb
  );
  $$
);
