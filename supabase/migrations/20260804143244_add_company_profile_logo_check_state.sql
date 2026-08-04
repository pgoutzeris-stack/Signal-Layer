alter table signal_layer.company_profiles
  add column if not exists logo_checked_at timestamptz;

comment on column signal_layer.company_profiles.logo_checked_at is
  'Zeitpunkt des letzten geprüften Logo-Suchlaufs, auch wenn keine sichere Datei gefunden wurde.';
