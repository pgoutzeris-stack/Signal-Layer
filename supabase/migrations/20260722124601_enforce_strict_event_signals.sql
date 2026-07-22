-- Every event source uses the same cheap deterministic gate before paid AI:
-- Tier-1 company + named credible person + real contribution + ROOTS topic.
update signal_layer.sources
set source_type = 'event',
    crawl_config = coalesce(crawl_config, '{}'::jsonb) ||
      '{"max_depth":1,"max_pages":8,"max_candidates":40,"require_tier1":true,"require_topic_signal":true}'::jsonb
where source_type = 'event' or category = 'Events & Messen';

-- OMR Daily is the editorial entry point. The general OMR source stays
-- inactive to avoid duplicate crawls.
update signal_layer.sources
set active = true,
    category = 'Events & Messen',
    source_type = 'event',
    url = 'https://omr.com/de/daily/',
    feed_type = 'crawler',
    feed_url = null,
    crawl_config = coalesce(crawl_config, '{}'::jsonb) ||
      '{"max_depth":1,"max_pages":8,"max_candidates":40,"require_tier1":true,"require_topic_signal":true,"recommended_entry_url":"https://omr.com/de/daily/","entrypoint_reason":"OMR Daily contains editorial Festival and qualified speaker coverage"}'::jsonb
where company = 'OMR Festival';
