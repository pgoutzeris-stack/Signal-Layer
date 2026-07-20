alter table signal_layer.articles
  add column if not exists extraction_diagnostic jsonb;

comment on column signal_layer.articles.extraction_diagnostic is
  'Structured result of the latest native article extraction attempt; contains no credentials or response body.';

create index if not exists articles_extraction_diagnostic_code_idx
  on signal_layer.articles ((extraction_diagnostic->>'code'))
  where extraction_diagnostic is not null;
