alter table signal_layer.articles
  add column if not exists manual_review_tracks text[] not null default '{}'::text[],
  add column if not exists manual_review_reason text,
  add column if not exists classification_audit jsonb not null default '{}'::jsonb;

comment on column signal_layer.articles.manual_review_tracks is
  'Borderline routes that need a human decision. Empty for reliable, rejected and technical-error articles.';

comment on column signal_layer.articles.manual_review_reason is
  'Human-readable explanation of which required Marketing or Sales checks remain unresolved.';

comment on column signal_layer.articles.classification_audit is
  'Versioned technical trace of extraction, deterministic filters, validated model outputs, routing gates and scoring.';

create index if not exists articles_manual_review_tracks_idx
  on signal_layer.articles using gin (manual_review_tracks)
  where classification_status = 'uncertain';
