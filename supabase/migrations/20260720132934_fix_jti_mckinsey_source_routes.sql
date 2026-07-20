update signal_layer.sources
set crawl_config = coalesce(crawl_config, '{}'::jsonb)
  || '{"include_url_pattern":"/media/documents/press-release/"}'::jsonb
where company = 'JTI (JT International Germany)';

update signal_layer.sources
set url = 'https://www.mckinsey.com/industries/retail/our-insights/',
    feed_type = 'crawler',
    feed_url = null,
    crawl_config = coalesce(crawl_config, '{}'::jsonb)
      || '{"recommended_entry_url":"https://www.mckinsey.com/industries/retail/our-insights/","include_url_pattern":"/industries/retail/our-insights/"}'::jsonb
where company = 'McKinsey Retail Insights';

insert into signal_layer.browser_source_discovery_jobs (source_id, status, attempts, created_at, updated_at)
select id, 'queued', 0, now(), now()
from signal_layer.sources
where company = 'McKinsey Retail Insights'
  and active = true
  and not exists (
    select 1
    from signal_layer.browser_source_discovery_jobs j
    where j.source_id = sources.id
      and j.status in ('queued', 'running')
  );
