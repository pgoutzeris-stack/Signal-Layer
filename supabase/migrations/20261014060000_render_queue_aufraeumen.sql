-- Render-Auftraege, die nach 12 Stunden niemand abgearbeitet hat, abschliessen.
-- Der Browser-Worker laeuft seit 3.8.2026 nicht mehr planmaessig; sonst waechst
-- die Warteschlange bei jedem Crawl ueber 500 und die Schranke stoppt den Crawl.
create or replace function signal_layer.render_queue_aufraeumen()
returns integer
language sql
security definer
set search_path to 'signal_layer'
as $$
  with weg as (
    update signal_layer.browser_render_jobs
       set status = 'error', last_error = 'veraltet: nach 12 Stunden nicht abgearbeitet', finished_at = now(), updated_at = now()
     where status = 'queued' and created_at < now() - interval '12 hours'
    returning 1)
  select count(*)::integer from weg;
$$;
revoke all on function signal_layer.render_queue_aufraeumen() from public, anon, authenticated;
select cron.schedule('signal-layer-render-aufraeumen', '0 * * * *', 'select signal_layer.render_queue_aufraeumen()');
