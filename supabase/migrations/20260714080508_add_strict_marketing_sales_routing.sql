alter table signal_layer.articles
  add column if not exists sales_triggers text[] not null default '{}'::text[],
  add column if not exists routing_evidence jsonb not null default '{}'::jsonb,
  add column if not exists market_insight_transferable boolean,
  add column if not exists market_insight_explanation text;

comment on column signal_layer.articles.sales_triggers is
  'Evidence-validated strategic triggers that can qualify a Tier-1 article for Sales routing.';
comment on column signal_layer.articles.routing_evidence is
  'Validated, explicit Marketing and Sales routing decisions with confidence, evidence and reason.';
