-- Tone of Voice fuer den LinkedIn-Begleittext. Der Tonfall gehoert zur Person,
-- nicht zur Pipeline: zwei Berater schreiben denselben Signalbefund anders an.
-- Deshalb eine Zeile je Intranet-Nutzer statt eines Eintrags in
-- signal_layer.pipeline_settings.

create table if not exists signal_layer.user_asset_settings (
  user_id uuid primary key,
  tone_of_voice text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Zugriff wie im uebrigen Schema: nur die Edge Function mit der Service-Rolle
-- liest und schreibt, kein Client spricht die Tabelle direkt an. Die Function
-- gibt jedem Nutzer ausschliesslich seine eigene Zeile zurueck.
alter table signal_layer.user_asset_settings enable row level security;
revoke all on table signal_layer.user_asset_settings from public, anon, authenticated;
grant all on table signal_layer.user_asset_settings to service_role;

comment on table signal_layer.user_asset_settings is
  'Persoenliche Asset-Studio-Einstellungen je Intranet-Nutzer.';
comment on column signal_layer.user_asset_settings.tone_of_voice is
  'Tonfall fuer den LinkedIn-Begleittext. Leer heisst: die Option "KI + Tone of Voice" ist fuer diesen Nutzer nicht waehlbar.';
