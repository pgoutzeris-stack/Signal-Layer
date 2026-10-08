-- Access restrictions remain relevant even when an earlier full body is stored.
create or replace function signal_layer.paywall_befund(
  p_title text, p_content text, p_cleaned text, p_markiert boolean
) returns table(erkannt boolean, beleg text)
language sql immutable parallel safe set search_path = ''
as $function$
  with x as (
    select coalesce(
      signal_layer.paywall_merkmal(coalesce(p_title, '') || E'\n' || coalesce(p_content, '')),
      signal_layer.paywall_merkmal(p_cleaned)
    ) as merkmal
  )
  select x.merkmal is not null or coalesce(p_markiert, false),
    case when x.merkmal is not null then x.merkmal
      when coalesce(p_markiert, false) then 'Originalseite als kostenpflichtig markiert'
    end
  from x
$function$;

update signal_layer.articles a
set paywall_markiert = a.paywall_markiert
where exists(select 1 from signal_layer.simple_signals s
  where s.article_id=a.id and s.pipeline_version='2.6')
  and a.paywall_markiert is true;
