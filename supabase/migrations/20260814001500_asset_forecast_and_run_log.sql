-- Laufprotokoll und lernende Zeitprognose fuer das Asset-Studio.
-- duration_ms und Tokens stehen schon auf der Zeile; run_log haelt den Ablauf,
-- forecast_ms die Schaetzung, mit der diese Generation gestartet wurde.

alter table signal_layer.generated_assets
  add column if not exists run_log jsonb not null default '[]'::jsonb,
  add column if not exists forecast_ms integer;

comment on column signal_layer.generated_assets.run_log is
  'Ablauf eines Entwurfs: Abschnitt, Tokens, Mangel. Damit ein Fehler nachvollziehbar bleibt.';
comment on column signal_layer.generated_assets.forecast_ms is
  'Median-Dauer aehnlicher erfolgreicher Laeufe zum Startzeitpunkt. Die Anzeige nutzt sie als Prognose.';

create index if not exists generated_assets_forecast_idx
  on signal_layer.generated_assets (kind, created_at desc)
  where status = 'done' and duration_ms is not null;

create or replace function signal_layer.asset_duration_forecast(
  p_kind text,
  p_asset_type text default null,
  p_slides integer default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  exact_count integer := 0;
  result jsonb;
begin
  select jsonb_build_object(
    'sample_count', count(*)::integer,
    'median_ms', round(percentile_cont(0.5) within group (order by duration_ms))::integer,
    'p75_ms', round(percentile_cont(0.75) within group (order by duration_ms))::integer,
    'median_tokens', round(percentile_cont(0.5) within group (order by total_tokens))::integer,
    'scope', 'exact'
  )
  into result
  from (
    select duration_ms, total_tokens
    from signal_layer.generated_assets
    where status = 'done'
      and duration_ms between 8000 and 380000
      and kind = p_kind
      and (p_asset_type is null or coalesce(answers->>'asset_type', 'memo') = p_asset_type)
      and (p_slides is null or coalesce(nullif(answers->>'slides', '')::integer, 1) = p_slides)
    order by created_at desc
    limit 40
  ) exact_pool;

  exact_count := coalesce((result->>'sample_count')::integer, 0);
  if exact_count >= 3 then
    return result;
  end if;

  select jsonb_build_object(
    'sample_count', count(*)::integer,
    'median_ms', round(percentile_cont(0.5) within group (order by duration_ms))::integer,
    'p75_ms', round(percentile_cont(0.75) within group (order by duration_ms))::integer,
    'median_tokens', round(percentile_cont(0.5) within group (order by total_tokens))::integer,
    'scope', 'kind'
  )
  into result
  from (
    select duration_ms, total_tokens
    from signal_layer.generated_assets
    where status = 'done'
      and duration_ms between 8000 and 380000
      and kind = p_kind
    order by created_at desc
    limit 40
  ) kind_pool;

  return result;
end;
$$;

comment on function signal_layer.asset_duration_forecast(text, text, integer) is
  'Median-Dauer und Tokens der letzten erfolgreichen Assets derselben Art. Jeder neue Lauf fliesst in die naechste Prognose.';

revoke all on function signal_layer.asset_duration_forecast(text, text, integer) from public, anon, authenticated;
grant execute on function signal_layer.asset_duration_forecast(text, text, integer) to service_role;
