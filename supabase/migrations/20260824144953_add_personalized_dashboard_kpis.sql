-- Persoenliches Performance-Dashboard fuer erzeugte Marketing- und Sales-Assets.
-- Schreiben laeuft weiterhin ueber die authentifizierte Edge Function; Select
-- ist fuer Realtime direkt erlaubt, aber strikt auf auth.uid() begrenzt.

create table if not exists signal_layer.user_dashboard_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_dashboard_settings_preferences_object
    check (jsonb_typeof(preferences) = 'object')
);

create table if not exists signal_layer.asset_performance (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references signal_layer.generated_assets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  lane text not null check (lane in ('marketing', 'sales')),
  channel text not null default 'linkedin' check (char_length(channel) between 1 and 40),
  published_at timestamptz,

  -- Marketing: kumulierte Werte des veroeffentlichten Postings.
  impressions bigint not null default 0 check (impressions >= 0),
  reactions bigint not null default 0 check (reactions >= 0),
  comments bigint not null default 0 check (comments >= 0),
  reposts bigint not null default 0 check (reposts >= 0),
  saves bigint not null default 0 check (saves >= 0),
  link_clicks bigint not null default 0 check (link_clicks >= 0),

  -- Sales: kumulierte Wirkung eines Executive Memos bzw. Sales-Assets.
  sends bigint not null default 0 check (sends >= 0),
  opens bigint not null default 0 check (opens >= 0),
  replies bigint not null default 0 check (replies >= 0),
  meetings bigint not null default 0 check (meetings >= 0),
  opportunities bigint not null default 0 check (opportunities >= 0),
  wins bigint not null default 0 check (wins >= 0),
  influenced_pipeline_eur numeric(16,2) not null default 0 check (influenced_pipeline_eur >= 0),
  revenue_eur numeric(16,2) not null default 0 check (revenue_eur >= 0),

  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, asset_id)
);

create index if not exists asset_performance_user_updated_idx
  on signal_layer.asset_performance (user_id, updated_at desc);
create index if not exists asset_performance_user_lane_published_idx
  on signal_layer.asset_performance (user_id, lane, published_at desc nulls last);

alter table signal_layer.user_dashboard_settings enable row level security;
alter table signal_layer.asset_performance enable row level security;

revoke all on table signal_layer.user_dashboard_settings from public, anon, authenticated;
revoke all on table signal_layer.asset_performance from public, anon, authenticated;
grant all on table signal_layer.user_dashboard_settings to service_role;
grant all on table signal_layer.asset_performance to service_role;

-- Der Browser braucht nur SELECT fuer eine RLS-gepruefte Realtime-
-- Subscription. Alle Mutationen validiert die Edge Function.
grant usage on schema signal_layer to authenticated;
grant select on table signal_layer.user_dashboard_settings to authenticated;
grant select on table signal_layer.asset_performance to authenticated;

drop policy if exists "dashboard settings visible to owner" on signal_layer.user_dashboard_settings;
create policy "dashboard settings visible to owner"
  on signal_layer.user_dashboard_settings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "asset performance visible to owner" on signal_layer.asset_performance;
create policy "asset performance visible to owner"
  on signal_layer.asset_performance
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Supabase Postgres Changes fuer sofortige Dashboard-Aktualisierung. Die
-- Select-Policies oben entscheiden, welche Zeilen ein Client empfaengt.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'signal_layer'
      and tablename = 'user_dashboard_settings'
  ) then
    alter publication supabase_realtime add table signal_layer.user_dashboard_settings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'signal_layer'
      and tablename = 'asset_performance'
  ) then
    alter publication supabase_realtime add table signal_layer.asset_performance;
  end if;
end
$$;

comment on table signal_layer.user_dashboard_settings is
  'Persoenliche Widget-Auswahl, Reihenfolge, Groesse und Zeitraum des Signal-Layer-Dashboards.';
comment on table signal_layer.asset_performance is
  'Kumulierte Marketing- oder Sales-KPIs je erzeugtem Asset und Nutzer; Quelle fuer persoenliche Dashboard-Insights.';
