delete from signal_layer.findings
where track = 'marketing'
  and dimension = 'sub_branchen_insight';

delete from signal_layer.findings
where track = 'marketing'
  and dimension = 'ki_performance'
  and lower(array_to_string(evidence, ' ')) !~
    '(marketing|brand|customer|consumer|shopper|retail|campaign|media|assortment|pricing|promotion|marke|kunde|konsum|handel|kampagne|sortiment|preis)';

update signal_layer.articles article
set routing = array_remove(article.routing, 'marketing')
where 'marketing' = any(article.routing)
  and not exists (
    select 1 from signal_layer.findings finding
    where finding.article_id = article.id
      and finding.track = 'marketing'
  );
