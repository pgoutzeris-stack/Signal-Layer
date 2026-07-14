delete from signal_layer.tier1_companies
where lower(name) = 'olymp';

-- Restore the prior classifier output. OLYMP is not a ROOTS Tier-1 company.
update signal_layer.articles
set primary_company = null,
    matched_companies = '{}',
    company_mentions = '[]'::jsonb
where id = 'aa6827bf-e2ba-4a61-85be-8e4f4b3ffe71';
