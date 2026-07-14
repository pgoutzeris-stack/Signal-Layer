-- Event sources should enter on editorial listings, not on ticket-, programme-
-- or generic event homepages. Eight rendered pages are sufficient for these
-- focused listings and materially reduce Apify runtime and cost.
update signal_layer.sources
set crawl_config = coalesce(crawl_config, '{}'::jsonb) ||
  '{"max_depth":1,"max_pages":8,"max_candidates":40,"require_tier1":true,"require_topic_signal":true}'::jsonb
where active = true and (source_type = 'event' or category = 'Events & Messen');

update signal_layer.sources set url='https://omr.com/de/daily/', feed_type='apify', feed_url=null,
  crawl_config=coalesce(crawl_config,'{}'::jsonb)||'{"recommended_entry_url":"https://omr.com/de/daily/","entrypoint_reason":"OMR Daily contains editorial Festival and speaker announcements"}'::jsonb
where company='OMR Festival';

update signal_layer.sources set url='https://dmexco.com/press/', feed_type='apify', feed_url=null,
  crawl_config=coalesce(crawl_config,'{}'::jsonb)||'{"recommended_entry_url":"https://dmexco.com/press/","entrypoint_reason":"Official DMEXCO press releases"}'::jsonb
where company='DMEXCO';

update signal_layer.sources set url='https://www.prowein.com/en/Media_News/Press/Press_Releases?local_lang=1', feed_type='apify', feed_url=null,
  crawl_config=coalesce(crawl_config,'{}'::jsonb)||'{"recommended_entry_url":"https://www.prowein.com/en/Media_News/Press/Press_Releases?local_lang=1","entrypoint_reason":"Official ProWein press-release listing"}'::jsonb
where company='ProWein';

update signal_layer.sources set url='https://www.eisenwarenmesse.de/presse/presseinformationen/', feed_type='apify', feed_url=null,
  crawl_config=coalesce(crawl_config,'{}'::jsonb)||'{"recommended_entry_url":"https://www.eisenwarenmesse.de/presse/presseinformationen/","entrypoint_reason":"Official trade-fair and exhibitor press information"}'::jsonb
where company='EISENWARENMESSE';

update signal_layer.sources set url='https://www.canneslions.com/news', feed_type='apify', feed_url=null,
  crawl_config=coalesce(crawl_config,'{}'::jsonb)||'{"recommended_entry_url":"https://www.canneslions.com/news","entrypoint_reason":"Official Cannes Lions news and updates"}'::jsonb
where company='Cannes Lions';

update signal_layer.sources set url='https://www.cosmetic-business.com/de/medien/pressemitteilungen/pressemitteilungen-uebersicht', feed_type='apify', feed_url=null,
  crawl_config=coalesce(crawl_config,'{}'::jsonb)||'{"recommended_entry_url":"https://www.cosmetic-business.com/de/medien/pressemitteilungen/pressemitteilungen-uebersicht","entrypoint_reason":"Official CosmeticBusiness press-release listing"}'::jsonb
where company='Cosmetic Business';

update signal_layer.sources set url='https://drinktec.com/de-DE/presse/', feed_type='apify', feed_url=null,
  crawl_config=coalesce(crawl_config,'{}'::jsonb)||'{"recommended_entry_url":"https://drinktec.com/de-DE/presse/","entrypoint_reason":"Official drinktec press information"}'::jsonb
where company='drinktec';

update signal_layer.sources set url='https://www.iba-tradefair.com/de/presse/pressemitteilungen', feed_type='apify', feed_url=null,
  crawl_config=coalesce(crawl_config,'{}'::jsonb)||'{"recommended_entry_url":"https://www.iba-tradefair.com/de/presse/pressemitteilungen","entrypoint_reason":"Official iba press-release listing"}'::jsonb
where company='iba';

update signal_layer.sources set url='https://www.ifa-berlin.com/press-releases/', feed_type='apify', feed_url=null,
  crawl_config=coalesce(crawl_config,'{}'::jsonb)||'{"recommended_entry_url":"https://www.ifa-berlin.com/press-releases/","entrypoint_reason":"Official IFA press releases"}'::jsonb
where company='IFA Berlin';

update signal_layer.sources set url='https://websummit.com/blog/', feed_type='apify', feed_url=null,
  crawl_config=coalesce(crawl_config,'{}'::jsonb)||'{"recommended_entry_url":"https://websummit.com/blog/","entrypoint_reason":"Official Web Summit editorial blog"}'::jsonb
where company='Web Summit';
