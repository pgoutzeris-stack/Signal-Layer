-- These sources expose entry pages publicly, but their material analysis is
-- subscription-only. The flag reveals an optional secure-login configuration
-- in the source settings; it does not bypass a publisher's access controls.
update signal_layer.sources
set crawl_config = coalesce(crawl_config, '{}'::jsonb)
  || jsonb_build_object('login_required', true)
where id in (
  'dc315d8c-15a1-4b08-9097-89923a013c73', -- Handelsblatt
  'd1790a92-7d08-42ec-b65e-718da452b761', -- WirtschaftsWoche
  'f62690ed-b404-43ce-889a-27631bfce4ed'  -- Capital
);
