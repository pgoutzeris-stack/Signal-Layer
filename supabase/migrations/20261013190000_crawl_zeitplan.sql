-- Zeitplan des taeglichen Crawls fuer den Status im Signal Layer. cron liegt
-- nicht im API-Schema, deshalb liest die Edge Function ihn ueber diese Funktion.
create or replace function signal_layer.crawl_zeitplan()
returns jsonb
language sql
security definer
set search_path = cron, pg_temp
stable
as $$
  select coalesce(
    (select jsonb_build_object('active', active, 'schedule', schedule)
       from cron.job where jobname = 'signal-layer-daily-crawl' limit 1),
    jsonb_build_object('active', false, 'schedule', null)
  );
$$;
revoke all on function signal_layer.crawl_zeitplan() from public, anon, authenticated;
grant execute on function signal_layer.crawl_zeitplan() to service_role;
