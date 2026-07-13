update signal_layer.sources
set url = 'https://www.imm-cologne.com/press/press-releases/',
    feed_url = null,
    feed_type = 'apify'
where company = 'imm cologne';

update signal_layer.sources
set url = 'https://www.ism-cologne.com/press/press-releases/',
    feed_url = null,
    feed_type = 'apify'
where company = 'ISM';

update signal_layer.sources
set url = 'https://www.spogagafa.com/press/press-releases/',
    feed_url = null,
    feed_type = 'apify'
where company = 'spoga+gafa';
