-- Beiersdorf und Danone fehlten in der Tier-1-Liste, obwohl beide im
-- Ursprungskonzept in fuenf von sechs Signalfeldern als Zielunternehmen stehen.
-- Ohne Eintrag hier gibt es weder Tier-1-Pille noch Steckbrief, auch wenn ein
-- Artikel sie eindeutig benennt.
--
-- Die Aliasse enthalten die Marken, unter denen das Unternehmen in der
-- Fachpresse auftritt - wie bei Essity (Tempo, Zewa, Tork) bereits gepflegt.
-- Logos direkt mit gesetzt, damit der Steckbrief nicht auf eine Recherche
-- warten muss; beide Dateien wurden am 5.8.2026 abgerufen (HTTP 200,
-- image/svg+xml).

insert into signal_layer.tier1_companies
  (name, aliases, active, logo_url, logo_source_url, logo_source_kind, logo_format, logo_verified_at)
select * from (values
  (
    'Beiersdorf',
    array['Beiersdorf', 'Beiersdorf AG', 'NIVEA', 'Nivea', 'Eucerin', 'Hansaplast', 'Labello', 'La Prairie'],
    true,
    'https://cdn.worldvectorlogo.com/logos/beiersdorf.svg',
    'https://worldvectorlogo.com/logo/beiersdorf',
    'worldvectorlogo', 'svg', now()
  ),
  (
    'Danone',
    array['Danone', 'Danone Deutschland', 'Danone D-A-CH', 'Alpro', 'Volvic', 'Evian', 'evian', 'Activia', 'Actimel', 'Aptamil', 'Milupa', 'Nutricia'],
    true,
    'https://cdn.worldvectorlogo.com/logos/danone-2.svg',
    'https://worldvectorlogo.com/logo/danone-2',
    'worldvectorlogo', 'svg', now()
  )
) as neu(name, aliases, active, logo_url, logo_source_url, logo_source_kind, logo_format, logo_verified_at)
where not exists (
  select 1 from signal_layer.tier1_companies vorhanden where vorhanden.name = neu.name
);
