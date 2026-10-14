-- Analyse auch nach einem abgebrochenen Crawl, und fuer alle Artikel der letzten
-- 30 Stunden statt nur fuer den letzten Crawl.
create or replace function signal_layer.analyse_nach_crawl()
returns text
language plpgsql
security definer
set search_path to 'signal_layer', 'shared', 'net'
as $$
declare
  v_crawl record;
  v_ids jsonb;
begin
  select id, status, started_at into v_crawl
    from signal_layer.crawl_runs order by started_at desc nulls last limit 1;
  if v_crawl is null or v_crawl.status not in ('done', 'error') then return 'crawl laeuft oder fehlt'; end if;
  if exists (select 1 from signal_layer.simple_runs where status in ('running', 'queued')) then return 'lauf aktiv'; end if;
  select coalesce(jsonb_agg(id), '[]'::jsonb) into v_ids from (
    select a.id from signal_layer.articles a
     where a.crawled_at >= greatest(now() - interval '30 hours', timestamptz '2026-10-14 00:00:00+00')
       and a.url not like 'manual://%'
       and not exists (select 1 from signal_layer.simple_signals s where s.article_id = a.id)
     order by a.crawled_at limit 3000
  ) x;
  if jsonb_array_length(v_ids) = 0 then return 'nichts offen'; end if;
  perform net.http_post(
    url := 'https://csmguwcvzreefluhahyu.supabase.co/functions/v1/signal-layer',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', shared.get_api_key('signal_layer_cron_secret')),
    body := jsonb_build_object('action', 'start_simple_run', 'article_ids', v_ids, 'accept_peak', true)
  );
  return 'gestartet ' || jsonb_array_length(v_ids);
end;
$$;
