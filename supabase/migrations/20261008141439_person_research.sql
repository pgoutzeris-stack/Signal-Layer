create table signal_layer.person_researches (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references signal_layer.articles(id) on delete cascade,
  person_name text not null,
  company text not null,
  signal_role text not null default '',
  mode text not null check (mode in ('simple','advanced')),
  status text not null default 'running' check (status in ('running','verified','uncertain','error')),
  stage text not null default 'start',
  profile jsonb,
  failure_code text,
  prompt_version text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint only_verified_person_data check ((status='verified' and profile is not null) or (status<>'verified' and profile is null))
);
create unique index person_research_one_running_idx on signal_layer.person_researches(article_id,person_name,company) where status='running';
create index person_research_latest_idx on signal_layer.person_researches(article_id,person_name,company,created_at desc);
alter table signal_layer.person_researches enable row level security;
revoke all on signal_layer.person_researches from public,anon,authenticated;
grant all on signal_layer.person_researches to service_role;
-- Reads and starts are authorized by the Edge Function; no raw candidate or
-- unverified source material is available through a client Data API policy.
alter table signal_layer.ai_usage_events add column person_research_id uuid references signal_layer.person_researches(id) on delete set null;
create index ai_usage_events_person_research_idx on signal_layer.ai_usage_events(person_research_id) where person_research_id is not null;
alter table signal_layer.ai_usage_events drop constraint ai_usage_events_operation_check;
alter table signal_layer.ai_usage_events add constraint ai_usage_events_operation_check check (operation in (
  'classification','review','preview','test','translation','offering_match','company_profile','company_logo',
  'asset_generation','memo_benchmark_research','memo_market_research','memo_photo_research','memo_image_check',
  'memo_scene_image','memo_field_sharpen','memo_section_draft','manual_signal_check','manual_signal_draft',
  'person_research','person_verify'
));
comment on table signal_layer.person_researches is 'Manually started, fail-closed professional person research. Unverified facts are never stored in profile.';
