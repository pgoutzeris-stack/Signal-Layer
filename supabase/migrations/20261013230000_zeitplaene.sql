-- Crawl 10:00 und 15:00 UTC (12:00 und 17:00 Berlin im Sommer), Tagesmail 06:30 UTC (08:30 Berlin).
select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'signal-layer-daily-crawl'), schedule := '0 10,15 * * *');
select cron.schedule('signal-layer-tagesmail', '30 6 * * *', $$select net.http_post(
  url := 'https://csmguwcvzreefluhahyu.supabase.co/functions/v1/signal-layer',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', shared.get_api_key('signal_layer_cron_secret')),
  body := jsonb_build_object('action','send_signal_digest','to', jsonb_build_array('pgoutzeris@roots-consultants.com'),'days',1),
  timeout_milliseconds := 60000)$$);
