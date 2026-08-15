-- Die Prognose lernt aus echten Laufzeiten und Tokens. Läufe über sieben
-- Minuten (zuvor bei 380 s abgeschnitten) zählen mit; die Anzeige nimmt p75.

create or replace function signal_layer.asset_duration_forecast(
  p_kind text,
  p_asset_type text default null,
  p_slides integer default null,
  p_images text default null,
  p_benchmarks_mode text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
  exact_count integer := 0;
begin
  with pool as (
    select id, duration_ms, total_tokens, run_log
    from signal_layer.generated_assets
    where status = 'done'
      and duration_ms between 8000 and 1200000
      and kind = p_kind
      and (p_asset_type is null or coalesce(answers->>'asset_type', 'memo') = p_asset_type)
      and (p_slides is null or coalesce(nullif(answers->>'slides', '')::integer, 1) = p_slides)
      and (p_images is null or coalesce(answers->>'images', 'auto') = p_images)
      and (
        p_benchmarks_mode is null
        or coalesce(answers->>'benchmarks_mode', answers->>'benchmarks', 'auto') = p_benchmarks_mode
      )
    order by created_at desc
    limit 40
  ),
  totals as (
    select
      count(*)::integer as sample_count,
      round(percentile_cont(0.5) within group (order by duration_ms))::integer as median_ms,
      round(percentile_cont(0.75) within group (order by duration_ms))::integer as p75_ms,
      round(percentile_cont(0.5) within group (order by total_tokens))::integer as median_tokens
    from pool
  ),
  stage_rows as (
    select
      e->>'stage' as stage,
      greatest(200, coalesce(lead((e->>'t')::int) over (partition by p.id order by (e->>'t')::int), p.duration_ms) - (e->>'t')::int) as dur
    from pool p
    cross join lateral jsonb_array_elements(p.run_log) e
    where e->>'event' = 'stage'
      and e->>'stage' in ('lesen', 'recherchieren', 'modell', 'pruefen', 'bilder', 'fuellen')
  ),
  stage_med as (
    select stage, round(percentile_cont(0.5) within group (order by dur))::integer as median_ms
    from stage_rows
    where dur between 200 and 900000
    group by stage
    having count(*) >= 1
  )
  select
    jsonb_build_object(
      'sample_count', totals.sample_count,
      'median_ms', totals.median_ms,
      'p75_ms', totals.p75_ms,
      'median_tokens', totals.median_tokens,
      'scope', 'exact',
      'stages', coalesce((select jsonb_object_agg(stage, median_ms) from stage_med), '{}'::jsonb)
    )
  into result
  from totals;

  exact_count := coalesce((result->>'sample_count')::integer, 0);
  if exact_count >= 3 then
    return result;
  end if;

  with pool as (
    select id, duration_ms, total_tokens, run_log
    from signal_layer.generated_assets
    where status = 'done'
      and duration_ms between 8000 and 1200000
      and kind = p_kind
    order by created_at desc
    limit 40
  ),
  totals as (
    select
      count(*)::integer as sample_count,
      round(percentile_cont(0.5) within group (order by duration_ms))::integer as median_ms,
      round(percentile_cont(0.75) within group (order by duration_ms))::integer as p75_ms,
      round(percentile_cont(0.5) within group (order by total_tokens))::integer as median_tokens
    from pool
  ),
  stage_rows as (
    select
      e->>'stage' as stage,
      greatest(200, coalesce(lead((e->>'t')::int) over (partition by p.id order by (e->>'t')::int), p.duration_ms) - (e->>'t')::int) as dur
    from pool p
    cross join lateral jsonb_array_elements(p.run_log) e
    where e->>'event' = 'stage'
      and e->>'stage' in ('lesen', 'recherchieren', 'modell', 'pruefen', 'bilder', 'fuellen')
  ),
  stage_med as (
    select stage, round(percentile_cont(0.5) within group (order by dur))::integer as median_ms
    from stage_rows
    where dur between 200 and 900000
    group by stage
  )
  select
    jsonb_build_object(
      'sample_count', totals.sample_count,
      'median_ms', totals.median_ms,
      'p75_ms', totals.p75_ms,
      'median_tokens', totals.median_tokens,
      'scope', case when exact_count > 0 then 'mixed' else 'kind' end,
      'stages', coalesce((select jsonb_object_agg(stage, median_ms) from stage_med), '{}'::jsonb)
    )
  into result
  from totals;

  return result;
end;
$$;

comment on function signal_layer.asset_duration_forecast(text, text, integer, text, text) is
  'p75-Dauer, Median-Tokens und Stufenzeiten ähnlicher erfolgreicher Assets für die Restzeit-Anzeige.';

revoke all on function signal_layer.asset_duration_forecast(text, text, integer, text, text) from public, anon, authenticated;
grant execute on function signal_layer.asset_duration_forecast(text, text, integer, text, text) to service_role;
