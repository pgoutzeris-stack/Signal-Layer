-- Statista exposes category pages publicly, but the material research content
-- generally requires an authenticated subscription.
update signal_layer.sources
set crawl_config = coalesce(crawl_config, '{}'::jsonb)
  || jsonb_build_object('login_required', true)
where id = '6698a480-f96b-4bad-aff7-6a558c91c399';
