insert into signal_layer.tier1_companies (name, aliases, active)
select 'OLYMP', array['OLYMP Bezner KG', 'Olymp'], true
where not exists (
  select 1 from signal_layer.tier1_companies where lower(name) = 'olymp'
);

-- Repair the already approved article so the card immediately reflects the
-- confirmed Tier-1 company; keep its Marketing-only route unchanged.
update signal_layer.articles
set primary_company = 'OLYMP',
    matched_companies = array['OLYMP'],
    company_mentions = jsonb_build_array(jsonb_build_object(
      'name', 'OLYMP', 'role', 'primary_subject', 'confidence', 1,
      'evidence', 'OLYMP vereinheitlicht Markenauftritt'
    ))
where id = 'aa6827bf-e2ba-4a61-85be-8e4f4b3ffe71';
