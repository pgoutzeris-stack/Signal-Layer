-- Tagesmail an Pano, Richard und Jannik; bei Fehlern oder ohne neue Signale nur Debug-Mail an Pano.
select cron.unschedule('signal-layer-tagesmail');
select cron.schedule('signal-layer-tagesmail', '30 6 * * *', $$select net.http_post(
  url := 'https://csmguwcvzreefluhahyu.supabase.co/functions/v1/signal-layer',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', shared.get_api_key('signal_layer_cron_secret')),
  body := jsonb_build_object('action','send_signal_digest','taeglich',true,'days',1,
    'to', jsonb_build_array('pgoutzeris@roots-consultants.com','rerbler@roots-consultants.com','jmueller@roots-consultants.com'),
    'debug_to','pgoutzeris@roots-consultants.com'),
  timeout_milliseconds := 120000)$$);
