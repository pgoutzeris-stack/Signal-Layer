do $$
begin
  if exists (select 1 from cron.job where jobname = 'signal-layer-source-crawl-watchdog') then
    perform cron.unschedule('signal-layer-source-crawl-watchdog');
  end if;
end $$;

select cron.schedule(
  'signal-layer-source-crawl-watchdog',
  '*/2 * * * *',
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
