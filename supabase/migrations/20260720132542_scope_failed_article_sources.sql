update signal_layer.sources set crawl_config=coalesce(crawl_config,'{}'::jsonb)||'{"include_url_pattern":"/news-views/"}'::jsonb
where company='JTI (JT International Germany)';

update signal_layer.sources set crawl_config=coalesce(crawl_config,'{}'::jsonb)||'{"include_url_pattern":"/industries/retail/"}'::jsonb
where company='McKinsey Retail Insights';

update signal_layer.sources set crawl_config=coalesce(crawl_config,'{}'::jsonb)||'{"include_url_pattern":"purina"}'::jsonb
where company='Nestlé Purina Deutschland';

update signal_layer.sources set crawl_config=coalesce(crawl_config,'{}'::jsonb)||'{"include_url_pattern":"/corporate/presse/"}'::jsonb
where company='OBI Group';
