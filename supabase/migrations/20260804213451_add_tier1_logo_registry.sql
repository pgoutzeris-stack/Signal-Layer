alter table signal_layer.tier1_companies
  add column if not exists logo_url text,
  add column if not exists logo_source_url text,
  add column if not exists logo_source_kind text,
  add column if not exists logo_format text,
  add column if not exists logo_verified_at timestamptz;

alter table signal_layer.tier1_companies
  drop constraint if exists tier1_companies_logo_source_kind_check,
  add constraint tier1_companies_logo_source_kind_check
    check (logo_source_kind is null or logo_source_kind in (
      'official_media', 'official_structured_data', 'wikimedia_commons', 'worldvectorlogo'
    )),
  drop constraint if exists tier1_companies_logo_format_check,
  add constraint tier1_companies_logo_format_check
    check (logo_format is null or logo_format in ('svg', 'png', 'webp', 'jpg'));

comment on column signal_layer.tier1_companies.logo_url is
  'Dauerhaft verifizierte direkte Logo-Datei; unabhängig von einer Steckbrief-Recherche verfügbar.';
comment on column signal_layer.tier1_companies.logo_source_url is
  'Nachvollziehbare Herkunftsseite der verifizierten Logo-Datei.';

with logos(name, logo_url, logo_source_url, logo_source_kind, logo_format) as (values
  ('AB InBev', 'https://cdn.worldvectorlogo.com/logos/ab-inbev-1.svg', 'https://worldvectorlogo.com/logo/ab-inbev-1', 'worldvectorlogo', 'svg'),
  ('Action', 'https://cdn.worldvectorlogo.com/logos/action-nederland-logo-2020.svg', 'https://worldvectorlogo.com/logo/action-nederland-logo-2020', 'worldvectorlogo', 'svg'),
  ('adidas', 'https://cdn.worldvectorlogo.com/logos/adidas.svg', 'https://worldvectorlogo.com/logo/adidas', 'worldvectorlogo', 'svg'),
  ('Ahold Delhaize', 'https://cdn.worldvectorlogo.com/logos/ahold-delhaize.svg', 'https://worldvectorlogo.com/logo/ahold-delhaize', 'worldvectorlogo', 'svg'),
  ('Aldi Nord', 'https://cdn.worldvectorlogo.com/logos/aldi-nord-logo.svg', 'https://worldvectorlogo.com/logo/aldi-nord-logo', 'worldvectorlogo', 'svg'),
  ('Aldi Süd', 'https://cdn.worldvectorlogo.com/logos/aldi-sued-2017-logo.svg', 'https://worldvectorlogo.com/logo/aldi-sued-2017-logo', 'worldvectorlogo', 'svg'),
  ('Amazon Online', 'https://cdn.worldvectorlogo.com/logos/logo-amazon.svg', 'https://worldvectorlogo.com/logo/logo-amazon', 'worldvectorlogo', 'svg'),
  ('Arla Foods', 'https://cdn.worldvectorlogo.com/logos/arla-foods-logo.svg', 'https://worldvectorlogo.com/logo/arla-foods-logo', 'worldvectorlogo', 'svg'),
  ('Barry Callebaut', 'https://cdn.worldvectorlogo.com/logos/barry-callebaut.svg', 'https://worldvectorlogo.com/logo/barry-callebaut', 'worldvectorlogo', 'svg'),
  ('British American Tobacco', 'https://cdn.worldvectorlogo.com/logos/british-american-tobacco.svg', 'https://worldvectorlogo.com/logo/british-american-tobacco', 'worldvectorlogo', 'svg'),
  ('Carrefour', 'https://cdn.worldvectorlogo.com/logos/carrefour.svg', 'https://worldvectorlogo.com/logo/carrefour', 'worldvectorlogo', 'svg'),
  ('CECONOMY', 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Ceconomy_2017_logo.svg', 'https://commons.wikimedia.org/wiki/File:Ceconomy_2017_logo.svg', 'wikimedia_commons', 'svg'),
  ('Coca-Cola GmbH Berlin', 'https://cdn.worldvectorlogo.com/logos/the-coca-cola-company.svg', 'https://worldvectorlogo.com/logo/the-coca-cola-company', 'worldvectorlogo', 'svg'),
  ('Colgate-Palmolive', 'https://cdn.worldvectorlogo.com/logos/colgate-palmolive.svg', 'https://worldvectorlogo.com/logo/colgate-palmolive', 'worldvectorlogo', 'svg'),
  ('Decathlon', 'https://cdn.worldvectorlogo.com/logos/decathlon-logo.svg', 'https://worldvectorlogo.com/logo/decathlon-logo', 'worldvectorlogo', 'svg'),
  ('Deichmann', 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Deichmann_logo.svg', 'https://commons.wikimedia.org/wiki/File:Deichmann_logo.svg', 'wikimedia_commons', 'svg'),
  ('Diageo', 'https://cdn.worldvectorlogo.com/logos/diageo.svg', 'https://worldvectorlogo.com/logo/diageo', 'worldvectorlogo', 'svg'),
  ('Dirk Rossmann', 'https://cdn.worldvectorlogo.com/logos/rossmann.svg', 'https://worldvectorlogo.com/logo/rossmann', 'worldvectorlogo', 'svg'),
  ('dm-drogerie markt', 'https://upload.wikimedia.org/wikipedia/commons/5/51/Dm-drogerie_markt_logo.svg', 'https://commons.wikimedia.org/wiki/File:Dm-drogerie_markt_logo.svg', 'wikimedia_commons', 'svg'),
  ('Dr. Oetker', 'https://cdn.worldvectorlogo.com/logos/dr-oetker.svg', 'https://worldvectorlogo.com/logo/dr-oetker', 'worldvectorlogo', 'svg'),
  ('EDEKA', 'https://cdn.worldvectorlogo.com/logos/edeka.svg', 'https://worldvectorlogo.com/logo/edeka', 'worldvectorlogo', 'svg'),
  ('Essity', 'https://upload.wikimedia.org/wikipedia/commons/9/93/Essity_Logo_neu.svg', 'https://commons.wikimedia.org/wiki/File:Essity_Logo_neu.svg', 'wikimedia_commons', 'svg'),
  ('Ferrero', 'https://cdn.worldvectorlogo.com/logos/ferrero.svg', 'https://worldvectorlogo.com/logo/ferrero', 'worldvectorlogo', 'svg'),
  ('FrieslandCampina', 'https://cdn.worldvectorlogo.com/logos/frieslandcampina-logo-2020-.svg', 'https://worldvectorlogo.com/logo/frieslandcampina-logo-2020-', 'worldvectorlogo', 'svg'),
  ('General Mills', 'https://cdn.worldvectorlogo.com/logos/general-mills.svg', 'https://worldvectorlogo.com/logo/general-mills', 'worldvectorlogo', 'svg'),
  ('GLOBUS', 'https://upload.wikimedia.org/wikipedia/commons/e/e7/Globus_Holding_logo.svg', 'https://commons.wikimedia.org/wiki/File:Globus_Holding_logo.svg', 'wikimedia_commons', 'svg'),
  ('H&M', 'https://cdn.worldvectorlogo.com/logos/h-m.svg', 'https://worldvectorlogo.com/logo/h-m', 'worldvectorlogo', 'svg'),
  ('Hagebau-Gruppe', 'https://www.hagebau.com/resource/blob/74620/6dacfc6b9539e23d947a4670757147d6/header-logo-desktop-data.svg', 'https://www.hagebau.com/start', 'official_media', 'svg'),
  ('Haleon', 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Haleon.svg', 'https://commons.wikimedia.org/wiki/File:Haleon.svg', 'wikimedia_commons', 'svg'),
  ('Heineken', 'https://cdn.worldvectorlogo.com/logos/heineken-14.svg', 'https://worldvectorlogo.com/logo/heineken-14', 'worldvectorlogo', 'svg'),
  ('Henkel', 'https://cdn.worldvectorlogo.com/logos/henkel.svg', 'https://worldvectorlogo.com/logo/henkel', 'worldvectorlogo', 'svg'),
  ('IKEA', 'https://cdn.worldvectorlogo.com/logos/ikea.svg', 'https://worldvectorlogo.com/logo/ikea', 'worldvectorlogo', 'svg'),
  ('Inditex', 'https://cdn.worldvectorlogo.com/logos/inditex.svg', 'https://worldvectorlogo.com/logo/inditex', 'worldvectorlogo', 'svg'),
  ('Intersport', 'https://cdn.worldvectorlogo.com/logos/intersport.svg', 'https://worldvectorlogo.com/logo/intersport', 'worldvectorlogo', 'svg'),
  ('Johnson & Johnson', 'https://cdn.worldvectorlogo.com/logos/johnson-johnson-2.svg', 'https://worldvectorlogo.com/logo/johnson-johnson-2', 'worldvectorlogo', 'svg'),
  ('JTI', 'https://upload.wikimedia.org/wikipedia/commons/1/17/JTI_Logo.svg', 'https://commons.wikimedia.org/wiki/File:JTI_Logo.svg', 'wikimedia_commons', 'svg'),
  ('Kaufland', 'https://cdn.worldvectorlogo.com/logos/kaufland.svg', 'https://worldvectorlogo.com/logo/kaufland', 'worldvectorlogo', 'svg'),
  ('Kellanova', 'https://upload.wikimedia.org/wikipedia/commons/5/59/Kellanova_logo.svg', 'https://commons.wikimedia.org/wiki/File:Kellanova_logo.svg', 'wikimedia_commons', 'svg'),
  ('Kraft Heinz', 'https://upload.wikimedia.org/wikipedia/commons/5/55/KraftHeinz.svg', 'https://commons.wikimedia.org/wiki/File:KraftHeinz.svg', 'wikimedia_commons', 'svg'),
  ('L''Oréal', 'https://cdn.worldvectorlogo.com/logos/l-oreal-3.svg', 'https://worldvectorlogo.com/logo/l-oreal-3', 'worldvectorlogo', 'svg'),
  ('Lactalis', 'https://cdn.worldvectorlogo.com/logos/lactalis.svg', 'https://worldvectorlogo.com/logo/lactalis', 'worldvectorlogo', 'svg'),
  ('Mars', 'https://cdn.worldvectorlogo.com/logos/mars-2.svg', 'https://worldvectorlogo.com/logo/mars-2', 'worldvectorlogo', 'svg'),
  ('Maxingvest', 'https://upload.wikimedia.org/wikipedia/commons/0/04/Maxingvest-ag.svg', 'https://commons.wikimedia.org/wiki/File:Maxingvest-ag.svg', 'wikimedia_commons', 'svg'),
  ('METRO', 'https://cdn.worldvectorlogo.com/logos/metro.svg', 'https://worldvectorlogo.com/logo/metro', 'worldvectorlogo', 'svg'),
  ('Mondelez', 'https://cdn.worldvectorlogo.com/logos/mondelez-international-1.svg', 'https://worldvectorlogo.com/logo/mondelez-international-1', 'worldvectorlogo', 'svg'),
  ('Mueller', 'https://mueller-dam-bucket.s3.eu-central-1.amazonaws.com/prod/website-assets/mueller-logo.svg', 'https://www.mueller.de/', 'official_structured_data', 'svg'),
  ('Nestlé', 'https://cdn.worldvectorlogo.com/logos/nestle-4.svg', 'https://worldvectorlogo.com/logo/nestle-4', 'worldvectorlogo', 'svg'),
  ('Nestlé Purina', 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Nestl%C3%A9_Purina_PetCare_logo.svg', 'https://commons.wikimedia.org/wiki/File:Nestl%C3%A9_Purina_PetCare_logo.svg', 'wikimedia_commons', 'svg'),
  ('Nike', 'https://cdn.worldvectorlogo.com/logos/nike-11.svg', 'https://worldvectorlogo.com/logo/nike-11', 'worldvectorlogo', 'svg'),
  ('OBI', 'https://cdn.worldvectorlogo.com/logos/obi.svg', 'https://worldvectorlogo.com/logo/obi', 'worldvectorlogo', 'svg'),
  ('Otto', 'https://upload.wikimedia.org/wikipedia/commons/1/11/Otto_Group_Logo_2022.svg', 'https://commons.wikimedia.org/wiki/File:Otto_Group_Logo_2022.svg', 'wikimedia_commons', 'svg'),
  ('Penny', 'https://cdn.worldvectorlogo.com/logos/penny.svg', 'https://worldvectorlogo.com/logo/penny', 'worldvectorlogo', 'svg'),
  ('PepsiCo', 'https://cdn.worldvectorlogo.com/logos/pepsico-logo.svg', 'https://worldvectorlogo.com/logo/pepsico-logo', 'worldvectorlogo', 'svg'),
  ('Pernod Ricard', 'https://cdn.worldvectorlogo.com/logos/pernod-ricard.svg', 'https://worldvectorlogo.com/logo/pernod-ricard', 'worldvectorlogo', 'svg'),
  ('Philip Morris', 'https://cdn.worldvectorlogo.com/logos/philip-morris-international.svg', 'https://worldvectorlogo.com/logo/philip-morris-international', 'worldvectorlogo', 'svg'),
  ('Procter & Gamble', 'https://cdn.worldvectorlogo.com/logos/procter-gamble.svg', 'https://worldvectorlogo.com/logo/procter-gamble', 'worldvectorlogo', 'svg'),
  ('Puma', 'https://cdn.worldvectorlogo.com/logos/puma-logo.svg', 'https://worldvectorlogo.com/logo/puma-logo', 'worldvectorlogo', 'svg'),
  ('QVC Handel', 'https://cdn.worldvectorlogo.com/logos/qvc.svg', 'https://worldvectorlogo.com/logo/qvc', 'worldvectorlogo', 'svg'),
  ('Red Bull', 'https://cdn.worldvectorlogo.com/logos/red-bull-logo.svg', 'https://worldvectorlogo.com/logo/red-bull-logo', 'worldvectorlogo', 'svg'),
  ('Reemtsma', 'https://cdn.worldvectorlogo.com/logos/imperial-brands-logo-1.svg', 'https://worldvectorlogo.com/logo/imperial-brands-logo-1', 'worldvectorlogo', 'svg'),
  ('REWE Markt', 'https://cdn.worldvectorlogo.com/logos/logo-rewe.svg', 'https://worldvectorlogo.com/logo/logo-rewe', 'worldvectorlogo', 'svg'),
  ('Südzucker-Gruppe', 'https://www.suedzuckergroup.com/themes/custom/suedzucker/logo.svg', 'https://www.suedzuckergroup.com/en', 'official_media', 'svg'),
  ('TEDI', 'https://cdn.worldvectorlogo.com/logos/tedi-logo.svg', 'https://worldvectorlogo.com/logo/tedi-logo', 'worldvectorlogo', 'svg'),
  ('Tönnies', 'https://upload.wikimedia.org/wikipedia/commons/9/9d/T%C3%B6nnies_Logo_4.2020.svg', 'https://commons.wikimedia.org/wiki/File:T%C3%B6nnies_Logo_4.2020.svg', 'wikimedia_commons', 'svg'),
  ('Unilever', 'https://cdn.worldvectorlogo.com/logos/unilever-2.svg', 'https://worldvectorlogo.com/logo/unilever-2', 'worldvectorlogo', 'svg'),
  ('Unternehmensgruppe Theo Müller', 'https://cdn.worldvectorlogo.com/logos/muller.svg', 'https://worldvectorlogo.com/logo/muller', 'worldvectorlogo', 'svg'),
  ('Wiesenhof', 'https://cdn.worldvectorlogo.com/logos/wiesenhof.svg', 'https://worldvectorlogo.com/logo/wiesenhof', 'worldvectorlogo', 'svg'),
  ('XXXLutz-Gruppe', 'https://upload.wikimedia.org/wikipedia/commons/9/99/XXXLutz_logo.svg', 'https://commons.wikimedia.org/wiki/File:XXXLutz_logo.svg', 'wikimedia_commons', 'svg'),
  ('Zalando', 'https://cdn.worldvectorlogo.com/logos/zalando.svg', 'https://worldvectorlogo.com/logo/zalando', 'worldvectorlogo', 'svg')
)
update signal_layer.tier1_companies companies
set logo_url = logos.logo_url,
    logo_source_url = logos.logo_source_url,
    logo_source_kind = logos.logo_source_kind,
    logo_format = logos.logo_format,
    logo_verified_at = now()
from logos
where companies.name = logos.name;

-- Vorhandene Steckbriefe verwenden sofort dieselbe geprüfte Registry. Die
-- eigentliche Recherche-Historie bleibt unverändert.
update signal_layer.company_profiles profiles
set logo_url = companies.logo_url,
    logo_source_url = companies.logo_source_url,
    logo_source_kind = companies.logo_source_kind,
    logo_format = companies.logo_format,
    logo_checked_at = companies.logo_verified_at,
    logo_lookup_version = '2026-08-tier1-logo-registry-v1',
    updated_at = now()
from signal_layer.tier1_companies companies
where lower(companies.name) = lower(profiles.company)
  and companies.logo_url is not null;

-- Alte KI-Recherchen konnten entgegen dem Vertrag eine zusätzliche
-- Trigger-Karte in den allgemeinen Steckbrief schreiben. Der individuelle
-- Trigger bleibt ausschließlich am Artikel in simple_signals/history.
update signal_layer.company_profiles profiles
set sections = jsonb_path_query_array(
      coalesce(profiles.sections, '[]'::jsonb),
      '$[*] ? (!(@.title like_regex "^Trigger" flag "i"))'
    ),
    updated_at = now()
where jsonb_path_exists(
  coalesce(profiles.sections, '[]'::jsonb),
  '$[*] ? (@.title like_regex "^Trigger" flag "i")'
);

update signal_layer.company_profile_history history
set profile = jsonb_set(
  history.profile,
  '{sections}',
  jsonb_path_query_array(
    coalesce(history.profile->'sections', '[]'::jsonb),
    '$[*] ? (!(@.title like_regex "^Trigger" flag "i"))'
  ),
  true
)
where jsonb_path_exists(
  coalesce(history.profile->'sections', '[]'::jsonb),
  '$[*] ? (@.title like_regex "^Trigger" flag "i")'
);
