alter table signal_layer.articles
  add column if not exists marketing_relevance_score smallint not null default 0 check (marketing_relevance_score between 0 and 100),
  add column if not exists marketing_relevance_reason text not null default 'Noch nicht mit dem ROOTS-Nutzwertmodell bewertet.',
  add column if not exists sales_relevance_score smallint not null default 0 check (sales_relevance_score between 0 and 100),
  add column if not exists sales_relevance_reason text not null default 'Noch nicht mit dem ROOTS-Nutzwertmodell bewertet.',
  add column if not exists relevance_scoring_version text,
  add column if not exists route_score_details jsonb not null default '{}'::jsonb;

comment on column signal_layer.articles.marketing_relevance_score is
  '0-100 Nutzwert als Grundlage eines Marketing-Assets für ROOTS-Kunden; keine Modellkonfidenz.';
comment on column signal_layer.articles.sales_relevance_score is
  '0-100 Stärke einer konkreten Tier-1-Sales-Opportunity mit ROOTS-Leistungsmatch; keine Modellkonfidenz.';
comment on column signal_layer.articles.route_score_details is
  'Auditierbare KI-Komponenten und deterministisch kalibrierte Endwerte des ROOTS-Nutzwertmodells.';
