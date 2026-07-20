alter table signal_layer.article_types
  add column if not exists description text not null default '';

update signal_layer.article_types set active = false, updated_at = now();

insert into signal_layer.article_types (id, label, description, non_relevant, active, updated_at)
values
  ('news', 'Nachricht', 'Redaktionelle Nachricht oder Meldung.', false, true, now()),
  ('analysis', 'Analyse', 'Fachliche Analyse oder Hintergrundstück mit Einordnung.', false, true, now()),
  ('interview', 'Interview', 'Redaktionelles Frage-Antwort- oder Gesprächsformat.', false, true, now()),
  ('opinion', 'Meinung / Kommentar', 'Kommentar, Kolumne oder klar gekennzeichnete Meinung.', false, true, now()),
  ('study', 'Studie', 'Empirische Studie, Survey oder Untersuchung mit Methode oder Stichprobe und Ergebnissen.', false, true, now()),
  ('whitepaper', 'Whitepaper', 'Substanzielles Whitepaper, Research Paper oder Playbook mit fachlichen Erkenntnissen.', false, true, now()),
  ('report', 'Report', 'Markt-, Trend-, Benchmark- oder Prognosebericht.', false, true, now()),
  ('case_study', 'Case Study', 'Dokumentierter Praxisfall mit Vorgehen und Ergebnissen.', false, true, now()),
  ('press_release', 'Pressemitteilung', 'Eigenständige Pressemitteilung mit zusammenhängendem Artikeltext.', false, true, now()),
  ('company_update', 'Unternehmens-Update', 'Strategie-, Produkt-, Kampagnen-, Finanz-, M&A-, Investitions-, Expansions-, Operations- oder Personalupdate.', false, true, now()),
  ('event_report', 'Event-Bericht', 'Redaktioneller Messe-, Event-, Panel- oder Vortragsbericht mit inhaltlicher Substanz.', false, true, now()),
  ('other', 'Sonstiges', 'Sonstiger oder nicht eigenständig redaktioneller Inhalt; kann nicht zuverlässig geroutet werden.', true, true, now())
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  non_relevant = excluded.non_relevant,
  active = excluded.active,
  updated_at = excluded.updated_at;

update signal_layer.articles
set article_type = case
  when article_type = 'editorial_news' then 'news'
  when article_type in ('analysis', 'background_report') then 'analysis'
  when article_type = 'interview' then 'interview'
  when article_type = 'commentary' then 'opinion'
  when article_type in ('study', 'survey') then 'study'
  when article_type = 'whitepaper' then 'whitepaper'
  when article_type in ('trend_report', 'market_report', 'benchmark', 'forecast') then 'report'
  when article_type = 'case_study' then 'case_study'
  when article_type = 'press_release' then 'press_release'
  when article_type in ('event_report', 'panel_summary') then 'event_report'
  when article_type in (
    'strategy_update', 'product_news', 'campaign_news', 'financial_news',
    'acquisition_news', 'partnership_news', 'investment_news', 'expansion_news',
    'restructuring_news', 'operations_news', 'personnel_news', 'event_announcement',
    'exhibitor_news'
  ) then 'company_update'
  else 'other'
end
where article_type is distinct from case
  when article_type = 'editorial_news' then 'news'
  when article_type in ('analysis', 'background_report') then 'analysis'
  when article_type = 'interview' then 'interview'
  when article_type = 'commentary' then 'opinion'
  when article_type in ('study', 'survey') then 'study'
  when article_type = 'whitepaper' then 'whitepaper'
  when article_type in ('trend_report', 'market_report', 'benchmark', 'forecast') then 'report'
  when article_type = 'case_study' then 'case_study'
  when article_type = 'press_release' then 'press_release'
  when article_type in ('event_report', 'panel_summary') then 'event_report'
  when article_type in (
    'strategy_update', 'product_news', 'campaign_news', 'financial_news',
    'acquisition_news', 'partnership_news', 'investment_news', 'expansion_news',
    'restructuring_news', 'operations_news', 'personnel_news', 'event_announcement',
    'exhibitor_news'
  ) then 'company_update'
  else 'other'
end;
