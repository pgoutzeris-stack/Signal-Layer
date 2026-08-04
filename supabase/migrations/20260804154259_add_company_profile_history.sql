alter table signal_layer.company_profiles
  add column if not exists logo_lookup_version text;

alter table signal_layer.company_profiles
  drop constraint if exists company_profiles_logo_source_kind_check,
  add constraint company_profiles_logo_source_kind_check
    check (logo_source_kind is null or logo_source_kind in (
      'official_media', 'official_structured_data', 'wikimedia_commons',
      'worldvectorlogo'
    ));

create table if not exists signal_layer.company_profile_history (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  researched_at timestamptz not null,
  profile jsonb not null,
  model text,
  pipeline_version text,
  created_at timestamptz not null default now(),
  unique (company, researched_at)
);

create index if not exists company_profile_history_company_researched_idx
  on signal_layer.company_profile_history (company, researched_at desc);

alter table signal_layer.company_profile_history enable row level security;
revoke all on table signal_layer.company_profile_history from public, anon, authenticated;
grant all on table signal_layer.company_profile_history to service_role;

insert into signal_layer.company_profile_history (
  company, researched_at, profile, model, pipeline_version
)
select company, researched_at, to_jsonb(company_profiles), model, pipeline_version
from signal_layer.company_profiles
on conflict (company, researched_at) do nothing;

comment on column signal_layer.company_profiles.logo_lookup_version is
  'Version der zuletzt ausgeführten serverseitigen Logoquellen-Prüfung.';
comment on table signal_layer.company_profile_history is
  'Unveränderliche, auswählbare Recherche-Stände der Tier-1-Steckbriefe.';
comment on column signal_layer.company_profile_history.profile is
  'Vollständiger Steckbrief-Snapshot; artikelbezogene Trigger werden bewusst nicht gespeichert.';
