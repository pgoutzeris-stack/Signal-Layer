create index if not exists articles_prompt_version_visible_idx
  on signal_layer.articles (prompt_version, classified_at desc)
  where classification_status in ('reliable', 'uncertain');

create or replace function signal_layer.list_advanced_pipeline_versions()
returns table (
  version text,
  article_count bigint,
  first_seen_at timestamptz,
  last_seen_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.prompt_version as version,
         count(*)::bigint as article_count,
         min(a.classified_at) as first_seen_at,
         max(a.classified_at) as last_seen_at
    from signal_layer.articles a
   where a.classification_status in ('reliable', 'uncertain')
     and a.prompt_version is not null
     and a.routing && array['marketing', 'sales']::text[]
   group by a.prompt_version
   order by max(a.classified_at) desc nulls last;
$$;

revoke all on function signal_layer.list_advanced_pipeline_versions() from public, anon, authenticated;
grant execute on function signal_layer.list_advanced_pipeline_versions() to service_role;

comment on function signal_layer.list_advanced_pipeline_versions() is
  'Liefert die tatsächlich gespeicherten Advanced-Regelstände für den Headerfilter.';
