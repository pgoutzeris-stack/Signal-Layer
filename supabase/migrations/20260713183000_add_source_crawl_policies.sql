alter table signal_layer.sources
  add column if not exists source_type text not null default 'editorial'
    check (source_type in ('editorial', 'corporate_newsroom', 'event', 'social')),
  add column if not exists crawl_config jsonb not null default '{}'::jsonb;

update signal_layer.sources
set source_type = case
  when category = 'Events & Messen' then 'event'
  when category = 'Social Media' then 'social'
  when category = 'Tier 1 Newsroom' then 'corporate_newsroom'
  else 'editorial'
end;

update signal_layer.sources
set crawl_config = jsonb_build_object(
  'max_depth', 1,
  'max_pages', 24,
  'max_candidates', 60,
  'require_tier1', true,
  'require_topic_signal', true
)
where source_type = 'event';

-- Manually verified editorial entry points. These replace generic home,
-- contact and company-overview pages that fan out into non-editorial areas.
update signal_layer.sources set url = 'https://www.anuga.com/press/press-releases/'
where company = 'Anuga';
update signal_layer.sources set url = 'https://www.anugafoodtec.com/press/press-releases/'
where company = 'Anuga FoodTec';
update signal_layer.sources set url = 'https://www.beauty.de/de/Media_News/Presse/Pressematerial/Pressemeldungen'
where company = 'BEAUTY DÜSSELDORF';
update signal_layer.sources set url = 'https://www.eurocis.com/de/Media-News'
where company = 'EuroCIS';
update signal_layer.sources set url = 'https://www.euroshop.de/de/Media-News'
where company = 'EuroShop';
update signal_layer.sources
set url = 'https://www.northerneurope.pepsico.com/our-stories/press-releases',
    feed_url = null, feed_type = 'apify',
    description = 'Verifizierte PepsiCo-Northern-Europe-Pressemitteilungen statt der bisherigen Kontaktseite.'
where company = 'PepsiCo Deutschland';
update signal_layer.sources
set url = 'https://www.muellergroup.com/medien/pressemitteilungen/',
    description = 'Pressemitteilungsbereich der Unternehmensgruppe statt der allgemeinen Über-uns-Seite.'
where company = 'Unternehmensgruppe Theo Müller';

comment on column signal_layer.sources.source_type is
  'Controls source-specific crawl policy: editorial, corporate_newsroom, event or social';
comment on column signal_layer.sources.crawl_config is
  'Bounded crawl settings and gates; event defaults require Tier-1 plus a supported topic signal';
