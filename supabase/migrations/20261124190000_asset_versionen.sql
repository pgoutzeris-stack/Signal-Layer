-- Versionen von Caption und Visual eines Entwurfs, fuer Vor/Zurueck im
-- KI-Editor ueber Sitzungen hinweg. Nur anhaengen, nie ueberschreiben.
-- Zugriff ausschliesslich ueber die Edge Function (Service-Rolle).
create table if not exists signal_layer.asset_versionen (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references signal_layer.generated_assets(id) on delete cascade,
  art text not null check (art in ('caption', 'bild')),
  inhalt text not null,
  meta jsonb not null default '{}'::jsonb,
  quelle text not null default 'manuell' check (quelle in ('original', 'ki', 'manuell', 'generiert')),
  notiz text not null default '',
  erstellt_von uuid,
  created_at timestamptz not null default now()
);
create index if not exists asset_versionen_asset_art on signal_layer.asset_versionen (asset_id, art, created_at);
alter table signal_layer.asset_versionen enable row level security;
revoke all on signal_layer.asset_versionen from anon, authenticated;
