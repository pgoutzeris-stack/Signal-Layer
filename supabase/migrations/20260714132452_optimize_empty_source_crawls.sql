-- Preserve the result of the July 2026 source-by-source recovery audit.
update signal_layer.sources s
set crawl_config = coalesce(s.crawl_config, '{}'::jsonb) ||
  case
    when s.source_type = 'event' then '{"max_depth":1,"max_pages":24,"max_candidates":60,"require_tier1":true,"require_topic_signal":true,"source_audit_status":"checked"}'::jsonb
    when s.source_type = 'corporate_newsroom' then '{"max_depth":2,"max_pages":50,"max_candidates":180,"source_audit_status":"checked"}'::jsonb
    else '{"max_depth":2,"max_pages":50,"max_candidates":250,"source_audit_status":"checked"}'::jsonb
  end
where s.active = true
  and not exists (select 1 from signal_layer.articles a where a.source_id = s.id);

-- Validated feeds are cheaper and more deterministic than browser crawling.
update signal_layer.sources set feed_type='rss', feed_url='https://www.capital.de/feed/standard/' where company='Capital';
update signal_layer.sources set feed_type='rss', feed_url='https://www.grocerydive.com/feeds/news/' where company ilike 'Grocery Dive%';
update signal_layer.sources set feed_type='rss', feed_url='https://www.retaildive.com/feeds/news/' where company ilike 'Retail Dive%';
update signal_layer.sources set feed_type='rss', feed_url='https://einzelhandel.de/themeninhalte/konjunkturundmarktdaten?format=feed&type=rss' where company ilike 'HDE%';
update signal_layer.sources set feed_type='rss', feed_url='https://brauwelt.com/de/?format=feed&type=rss' where company='BRAUWELT';
update signal_layer.sources set feed_type='rss', feed_url='https://international-dairy.com/feed' where company ilike 'International Dairy%';
update signal_layer.sources set feed_type='rss', feed_url='https://moproweb.de/feed/' where company ilike 'moproweb%';
update signal_layer.sources set feed_type='rss', feed_url='https://company.action.com/feed/' where company ilike 'Action%';
update signal_layer.sources set feed_type='rss', feed_url='https://www.kenvue.com/de-de/media.rss' where company ilike 'Kenvue%';

-- Verified editorial/newsroom entry points replacing obsolete or generic URLs.
update signal_layer.sources set url='https://iffa.messefrankfurt.com/frankfurt/de/presse/pressemeldungen.html', feed_type='apify', feed_url=null where company='IFFA';
update signal_layer.sources set url='https://www.messe-stuttgart.de/suedback/news/newsroom/meldungen/', feed_type='apify', feed_url=null where company='südback';
update signal_layer.sources set url='https://www.messe-stuttgart.de/sueffa/news/newsroom/meldungen/', feed_type='apify', feed_url=null where lower(company)='süffa';
update signal_layer.sources set url='https://www.investec.com/advisory/news-insights/?ps=consumer', feed_type='apify', feed_url=null where company ilike 'Investec Advisory%';
update signal_layer.sources set url='https://ma-review.de/', feed_type='apify', feed_url=null where company='M&A Review';
update signal_layer.sources set url='https://www.meininger.de/getraenke-zeitung/ausgaben', feed_type='apify', feed_url=null, crawl_config=coalesce(crawl_config,'{}'::jsonb)||'{"login_required":true,"paywall_detected":true}'::jsonb where company='Getränke Zeitung';
update signal_layer.sources set url='https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/en', feed_type='apify', feed_url=null where company='McKinsey CPG';
update signal_layer.sources set url='https://www.mckinsey.com/industries/retail/our-insights/en', feed_type='apify', feed_url=null where company='McKinsey Retail';
update signal_layer.sources set url='https://www.barry-callebaut.com/en-US/about-us/media', feed_type='apify', feed_url=null where company ilike 'Barry Callebaut%';
update signal_layer.sources set url='https://www.nestle.de/newsroom', feed_type='apify', feed_url=null where company='Nestlé Deutschland';
update signal_layer.sources set url='https://www.rewe-group.com/de/unternehmen/struktur-und-vertriebslinien/penny/', feed_type='apify', feed_url=null where company='Penny';
update signal_layer.sources set url='https://kpmg.com/de/de/medien/pressemitteilungen.html', feed_type='apify', feed_url=null where company ilike 'KPMG M&A%';
update signal_layer.sources set url='https://www.nim.org/presse/pressemitteilungen', feed_type='apify', feed_url=null where company ilike 'NIM%';
update signal_layer.sources set url='https://www.sg-network.org/de/neuigkeiten/presse', feed_type='apify', feed_url=null where company ilike 'Sweets Global%';
update signal_layer.sources set url='https://www.coca-cola.com/de/de/media-center', feed_type='apify', feed_url=null where company ilike 'Coca-Cola%';
update signal_layer.sources set url='https://corpsite.deichmann.com/de-DE/newsroom/pressemitteilungen', feed_type='apify', feed_url=null where company ilike 'Deichmann%';
update signal_layer.sources set url='https://newsroom.dm.de/latest_news/tag/pressemitteilungen', feed_type='apify', feed_url=null where company ilike 'dm-drogerie%';
update signal_layer.sources set url='https://www.essity.de/presse/pressemitteilungen-global/', feed_type='apify', feed_url=null where company ilike 'Essity%';
update signal_layer.sources set url='https://www.haleon.com/news/press-releases', feed_type='apify', feed_url=null where company ilike 'Haleon%';
update signal_layer.sources set url='https://www.ikea.com/de/de/newsroom/corporate-news/', feed_type='apify', feed_url=null where company ilike 'IKEA%';
update signal_layer.sources set url='https://www.unilever.de/news/press-releases/', feed_type='apify', feed_url=null where company ilike 'Unilever%';

update signal_layer.sources
set crawl_config=coalesce(crawl_config,'{}'::jsonb)||'{"login_required":true,"paywall_detected":true}'::jsonb
where company ilike 'Statista%';
