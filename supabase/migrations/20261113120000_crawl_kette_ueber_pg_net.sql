-- Crawl-Kette ueber pg_net statt Selbstaufruf.
-- Seit 05.11.2026 bricht Supabase lange Selbstaufruf-Ketten einer Edge
-- Function mit "Rate limit exceeded for trace" ab. Der naechste Quellenjob
-- wird deshalb aus der Datenbank angestossen: jeder Aufruf beginnt eine neue
-- Trace. Auth ueber das Cron-Secret wie bei den uebrigen Cron-Pfaden.
create or replace function signal_layer.crawl_kette_weiter(p_crawl_run_id uuid, p_analyse boolean default true)
returns void
language plpgsql
security definer
set search_path to 'signal_layer', 'shared', 'net'
as $$
declare
  v_headers jsonb := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', shared.get_api_key('signal_layer_cron_secret'));
  v_url text := 'https://csmguwcvzreefluhahyu.supabase.co/functions/v1/signal-layer';
begin
  perform net.http_post(url := v_url, headers := v_headers,
    body := jsonb_build_object('action', 'process_crawl_worker', 'crawl_run_id', p_crawl_run_id));
  if p_analyse then
    perform net.http_post(url := v_url, headers := v_headers,
      body := jsonb_build_object('action', 'process_analysis_batches'));
  end if;
end;
$$;

revoke all on function signal_layer.crawl_kette_weiter(uuid, boolean) from public, anon, authenticated;
grant execute on function signal_layer.crawl_kette_weiter(uuid, boolean) to service_role;

-- Auch der Schritt innerhalb einer Quelle (ein Artikel je Aufruf) laeuft ueber
-- pg_net, sonst reisst die Kette bei Quellen mit vielen Artikeln.
create or replace function signal_layer.crawl_schritt(p_body jsonb)
returns void
language plpgsql
security definer
set search_path to 'signal_layer', 'shared', 'net'
as $$
begin
  perform net.http_post(
    url := 'https://csmguwcvzreefluhahyu.supabase.co/functions/v1/signal-layer',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', shared.get_api_key('signal_layer_cron_secret')),
    body := p_body || jsonb_build_object('action', 'process_crawl'));
end;
$$;

revoke all on function signal_layer.crawl_schritt(jsonb) from public, anon, authenticated;
grant execute on function signal_layer.crawl_schritt(jsonb) to service_role;
