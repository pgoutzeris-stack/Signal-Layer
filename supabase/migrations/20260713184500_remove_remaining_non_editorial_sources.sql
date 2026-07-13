update signal_layer.sources
set feed_url = null,
    feed_type = 'apify'
where company = 'Unternehmensgruppe Theo Müller';

update signal_layer.sources
set active = false,
    description = 'Deaktiviert: Content Pool ist überwiegend eine Medien-Asset-Datenbank; kein belastbarer Corporate-Newsroom gefunden.'
where company = 'Red Bull';

update signal_layer.sources
set url = 'https://ma-review.de/artikel',
    feed_url = null,
    feed_type = 'apify',
    description = 'Aktuelle Artikelübersicht statt eines einzelnen historischen Food-&-Beverage-Beitrags.'
where company = 'M&A Review';
