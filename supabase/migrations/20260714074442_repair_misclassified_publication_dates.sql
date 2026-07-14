create temporary table signal_layer_date_repairs on commit drop as
with extracted as (
  select
    id,
    (regexp_match(
      left(content, 1200),
      '(^|[^0-9])([0-3][0-9]\.[01][0-9]\.20[0-9]{2})([^0-9]|$)'
    ))[2] as visible_date
  from signal_layer.articles
  where published_at >= now() - interval '6 months'
    and left(content, 1200) ~ '(^|[^0-9])[0-3][0-9]\.[01][0-9]\.20[0-9]{2}([^0-9]|$)'
), parsed as (
  select id, visible_date, to_date(visible_date, 'DD.MM.YYYY') as actual_date
  from extracted
)
select id, actual_date
from parsed
where to_char(actual_date, 'DD.MM.YYYY') = visible_date
  and actual_date <= current_date;

update signal_layer.articles article
set published_at = repair.actual_date::timestamptz
from signal_layer_date_repairs repair
where article.id = repair.id;

delete from signal_layer.findings finding
using signal_layer_date_repairs repair
where finding.article_id = repair.id
  and repair.actual_date < current_date - interval '6 months';

update signal_layer.articles article
set
  classification_status = 'legacy',
  relevance_confidence = null,
  title_de = null,
  article_type = null,
  tag_confidence = '{}'::jsonb,
  tag_evidence = '{}'::jsonb,
  primary_company = null,
  company_mentions = '[]'::jsonb,
  person_mentions = '[]'::jsonb,
  rejection_reasons = '{}'::text[],
  ai_summary = null,
  ai_rationale = null,
  language = null,
  ai_model = null,
  reviewer_model = null,
  prompt_version = null,
  classified_at = null,
  event_cluster_key = null,
  duplicate_of = null,
  classification_payload = '{}'::jsonb,
  topics = '{}'::text[],
  territory = null,
  matched_companies = '{}'::text[],
  matched_persons = '{}'::text[],
  buying_center_candidate = false,
  routing = '{}'::text[],
  tag_status = 'untagged'
from signal_layer_date_repairs repair
where article.id = repair.id
  and repair.actual_date < current_date - interval '6 months';
