alter table signal_layer.company_profiles
  add column if not exists logo_url text,
  add column if not exists logo_source_url text,
  add column if not exists logo_source_kind text,
  add column if not exists logo_format text;

alter table signal_layer.company_profiles
  drop constraint if exists company_profiles_logo_source_kind_check,
  add constraint company_profiles_logo_source_kind_check
    check (logo_source_kind is null or logo_source_kind in (
      'official_media', 'official_structured_data', 'wikimedia_commons'
    )),
  drop constraint if exists company_profiles_logo_format_check,
  add constraint company_profiles_logo_format_check
    check (logo_format is null or logo_format in ('svg', 'png', 'webp', 'jpg'));

comment on column signal_layer.company_profiles.logo_url is
  'Serverseitig geprüfte direkte Bilddatei; bevorzugt transparentes SVG.';
comment on column signal_layer.company_profiles.logo_source_url is
  'Nachweisbare Herkunftsseite des Logos (offizielle Brand-/Presseseite oder Commons-Dateiseite).';
comment on column signal_layer.company_profiles.logo_source_kind is
  'Vertrauensstufe der Logoquelle: official_media, official_structured_data oder wikimedia_commons.';
comment on column signal_layer.company_profiles.logo_format is
  'Tatsächlich serverseitig erkannter Dateityp des Logos.';
