-- ROOTS-Assets haben genau einen teamweit gepflegten KPI-Datensatz. Private
-- LinkedIn-Assets bleiben ausschliesslich fuer ihren Ersteller sichtbar.

alter table signal_layer.asset_performance
  add column if not exists visibility text not null default 'private',
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

update signal_layer.asset_performance as performance
set
  visibility = case
    when asset.kind = 'linkedin' and asset.answers->>'profile' = 'private' then 'private'
    else 'roots'
  end,
  updated_by = coalesce(performance.updated_by, performance.user_id)
from signal_layer.generated_assets as asset
where asset.id = performance.asset_id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'asset_performance_visibility_check'
      and conrelid = 'signal_layer.asset_performance'::regclass
  ) then
    alter table signal_layer.asset_performance
      add constraint asset_performance_visibility_check
      check (visibility in ('roots', 'private'));
  end if;
end
$$;

-- Pro Asset existiert nur eine kumulierte KPI-Zeile. Das macht das Upsert
-- atomar und verhindert doppelte ROOTS-Werte bei gleichzeitiger Bearbeitung.
-- Der bisherige (user_id, asset_id)-Schluessel bleibt fuer eine
-- unterbrechungsfreie Umstellung der bereits laufenden Edge Function bestehen.
drop index if exists signal_layer.asset_performance_asset_idx;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'asset_performance_asset_id_key'
      and conrelid = 'signal_layer.asset_performance'::regclass
  ) then
    alter table signal_layer.asset_performance
      add constraint asset_performance_asset_id_key unique (asset_id);
  end if;
end
$$;

drop policy if exists "asset performance visible to owner" on signal_layer.asset_performance;
drop policy if exists "asset performance visible by asset scope" on signal_layer.asset_performance;
create policy "asset performance visible by asset scope"
  on signal_layer.asset_performance
  for select
  to authenticated
  using (
    (visibility = 'private' and (select auth.uid()) = user_id)
    or (
      visibility = 'roots'
      and exists (
        select 1
        from users.profiles as profile
        where profile.id = (select auth.uid())
          and (
            profile.app_role = 'admin'
            or coalesce(profile.app_settings->'allowed_tools', '[]'::jsonb) ? 'signal-layer'
          )
      )
    )
  );

comment on column signal_layer.asset_performance.visibility is
  'roots = teamweit sichtbare ROOTS-KPIs; private = nur fuer den Asset-Ersteller.';
comment on column signal_layer.asset_performance.updated_by is
  'Nutzer, der die KPI-Zeile zuletzt ueber die validierende Edge Function gepflegt hat.';
comment on table signal_layer.asset_performance is
  'Kumulierte Marketing- oder Sales-KPIs je Asset; ROOTS teamweit, private Assets eigentuemerbezogen.';
