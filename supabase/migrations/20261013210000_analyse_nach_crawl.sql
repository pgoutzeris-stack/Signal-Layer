-- Taegliche Analyse nach dem Scraping. Der Crawl startet um 04:00 UTC (06:00
-- Berlin); dieser Job prueft alle 10 Minuten, ob der letzte Crawl fertig ist,
-- und startet dann einen Lauf fuer alle seither gespeicherten, noch nicht
-- analysierten Artikel. Laeuft schon ein Lauf, wartet er. Manuelle Signale
-- (manual://) bleiben aussen vor.
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
  if v_crawl is null or v_crawl.status <> 'done' then return 'crawl laeuft oder fehlt'; end if;
  -- Erst ab dem ersten taeglichen Crawl: der Nachhol-Crawl vom 12.10. bleibt bewusst unanalysiert.
  if v_crawl.started_at < timestamptz '2026-10-14 00:00:00+00' then return 'vor dem Start'; end if;
  if v_crawl.started_at < now() - interval '30 hours' then return 'kein frischer crawl'; end if;
  if exists (select 1 from signal_layer.simple_runs where status in ('running', 'queued')) then return 'lauf aktiv'; end if;
  select coalesce(jsonb_agg(id), '[]'::jsonb) into v_ids from (
    select a.id from signal_layer.articles a
     where a.crawled_at >= v_crawl.started_at
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
revoke all on function signal_layer.analyse_nach_crawl() from public, anon, authenticated;

select cron.schedule('signal-layer-analyse-nach-crawl', '*/10 * * * *', 'select signal_layer.analyse_nach_crawl()');
select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'signal-layer-daily-crawl'), active := true);
