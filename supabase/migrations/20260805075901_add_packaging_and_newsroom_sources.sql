-- Vier Quellen aus dem Ursprungskonzept, die bisher fehlten: die beiden
-- Verpackungstitel der Design-to-Print-Zeile und die Newsrooms von Beiersdorf
-- und Danone. Jede Zeile wurde am 5.8.2026 von Hand geprueft; der Kommentar
-- haelt fest, welcher Extraktionsweg traegt, damit der Advanced-Crawl nicht
-- raten muss.
--
-- Packaging Europe: kein brauchbares Volumen ueber die drei RSS-Feeds
-- (8 bzw. 3 bzw. 11 Positionen), aber ein Sitemap-Index mit Jahresdateien und
-- lastmod je Artikel. Artikelseiten tragen weder JSON-LD noch <article>; der
-- Text liegt in div.storytext, das Datum in <meta name="pubdate">.
--
-- Packaging Insights: vollstaendiger RSS-Feed mit 50 Positionen, Artikelseiten
-- liefern JSON-LD NewsArticle mit articleBody und datePublished. Bester Fall.
--
-- Beiersdorf: keine Feeds, aber eine flache Sitemap mit lastmod. Der Text einer
-- Pressemitteilung ist auf elf <article class="cp-text-module">-Bloecke
-- verteilt, das Datum steht in div.cw-date.
--
-- Danone D-A-CH: danone.de leitet auf danone.com/de/de weiter. Die deutsche
-- Sitemap listet 211 Pressemeldungen, aber ohne lastmod; das Datum steht nur im
-- Fliesstext ("Frankfurt am Main, 23. April 2026").

insert into signal_layer.sources
  (company, url, feed_url, feed_type, source_type, category, tags, description, active, crawl_config)
select * from (values
  (
    'Packaging Europe',
    'https://packagingeurope.com',
    'https://packagingeurope.com/GoogleSiteMapIndex.aspx',
    'sitemap', 'editorial', 'Verpackung & Druck (Design-to-Print)',
    array['Verpackung & Druck (Design-to-Print)', 'Design-to-Print'],
    'Europaeische Verpackungsfachpresse: Verpackungsdesign, Markenauftritt auf der Verpackung, Druck- und Artwork-Prozesse.',
    true,
    '{"include_url_pattern": ".article"}'::jsonb
  ),
  (
    'Packaging Insights',
    'https://www.packaginginsights.com',
    'https://resource-cns.cnsmedia.com/rss/pinews.xml',
    'rss', 'editorial', 'Verpackung & Druck (Design-to-Print)',
    array['Verpackung & Druck (Design-to-Print)', 'Design-to-Print'],
    'Internationale Verpackungsfachpresse: Verpackungsstrategie, Materialwechsel, Regulierung und Markenrelaunches auf der Verpackung.',
    true,
    '{}'::jsonb
  ),
  (
    'Beiersdorf',
    'https://www.beiersdorf.de/presse/presse-informationen/alle-pressemitteilungen',
    'https://www.beiersdorf.de/xml-sitemap',
    'sitemap', 'corporate_newsroom', 'Tier 1 Newsroom',
    array['Tier 1 Newsroom'],
    'Pressemitteilungen von Beiersdorf (NIVEA, Eucerin, Hansaplast, Labello): Fuehrungswechsel, Markenstrategie, Relaunches.',
    true,
    '{"include_url_pattern": "/presse/presse-informationen/alle-pressemitteilungen/"}'::jsonb
  ),
  (
    'Danone D-A-CH',
    'https://www.danone.com/de/de/newsroom/pressemeldungen.html',
    'https://www.danone.com/de/de/sitemap.xml',
    'sitemap', 'corporate_newsroom', 'Tier 1 Newsroom',
    array['Tier 1 Newsroom'],
    'Pressemeldungen von Danone Deutschland, Oesterreich und Schweiz (Alpro, Volvic, Evian, Activia, Aptamil): Personalien, Markenauftritt, Produkteinfuehrungen.',
    true,
    '{"include_url_pattern": "/de/de/newsroom/pressemeldungen/"}'::jsonb
  )
) as neu(company, url, feed_url, feed_type, source_type, category, tags, description, active, crawl_config)
where not exists (
  select 1 from signal_layer.sources vorhanden where vorhanden.company = neu.company
);
