-- The previous Worldvectorlogo entry resolves to an unrelated yellow PENNY
-- mark. Use the current red German PENNY wordmark from Wikimedia Commons as
-- the canonical, transparent SVG for both the registry and cached profiles.
update signal_layer.tier1_companies
set logo_url = 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Penny-Logo.svg',
    logo_source_url = 'https://commons.wikimedia.org/wiki/File:Penny-Logo.svg',
    logo_source_kind = 'wikimedia_commons',
    logo_format = 'svg',
    logo_verified_at = now()
where lower(name) = 'penny';

update signal_layer.company_profiles
set logo_url = 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Penny-Logo.svg',
    logo_source_url = 'https://commons.wikimedia.org/wiki/File:Penny-Logo.svg',
    logo_source_kind = 'wikimedia_commons',
    logo_format = 'svg',
    logo_checked_at = now(),
    updated_at = now()
where lower(company) = 'penny';
