alter table signal_layer.articles
  add column if not exists cleaned_content text,
  add column if not exists article_type text,
  add column if not exists classification_status text not null default 'legacy',
  add column if not exists relevance_confidence numeric(5,4),
  add column if not exists tag_confidence jsonb not null default '{}'::jsonb,
  add column if not exists tag_evidence jsonb not null default '{}'::jsonb,
  add column if not exists primary_company text,
  add column if not exists company_mentions jsonb not null default '[]'::jsonb,
  add column if not exists person_mentions jsonb not null default '[]'::jsonb,
  add column if not exists rejection_reasons text[] not null default '{}'::text[],
  add column if not exists ai_summary text,
  add column if not exists ai_rationale text,
  add column if not exists language text,
  add column if not exists ai_model text,
  add column if not exists reviewer_model text,
  add column if not exists prompt_version text,
  add column if not exists classified_at timestamptz,
  add column if not exists content_hash text,
  add column if not exists event_cluster_key text,
  add column if not exists duplicate_of uuid references signal_layer.articles(id) on delete set null,
  add column if not exists classification_payload jsonb not null default '{}'::jsonb;

alter table signal_layer.findings
  add column if not exists confidence numeric(5,4),
  add column if not exists evidence text[] not null default '{}'::text[];

create index if not exists articles_classification_status_idx
  on signal_layer.articles (classification_status, crawled_at desc);

create index if not exists articles_event_cluster_key_idx
  on signal_layer.articles (event_cluster_key)
  where event_cluster_key is not null;

create index if not exists articles_content_hash_idx
  on signal_layer.articles (content_hash)
  where content_hash is not null;

create index if not exists articles_duplicate_of_idx
  on signal_layer.articles (duplicate_of)
  where duplicate_of is not null;

comment on column signal_layer.articles.classification_status is
  'AI classification lifecycle: legacy, pending, reliable, uncertain, rejected, error';
comment on column signal_layer.articles.tag_evidence is
  'Exact article excerpts supporting topic, territory, company and person classifications';
