do $$
begin
  if exists (select 1 from cron.job where jobname = 'signal-layer-classification-backfill-watchdog') then
    perform cron.unschedule('signal-layer-classification-backfill-watchdog');
  end if;
end $$;

select cron.schedule(
  'signal-layer-classification-backfill-watchdog',
  '*/5 * * * *',
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
