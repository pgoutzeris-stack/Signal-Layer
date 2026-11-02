-- Mein Stil: Privat-Assets bekommen keine Vorlage mehr, sondern ein KI-Visual
-- im Stil des eigenen Posts mit den meisten Impressions. Dafuer das Bild je
-- Post (aus der Gastansicht von LinkedIn) und die persoenlichen Bausteine.

alter table signal_layer.referenz_posts
  add column if not exists visual text check (visual is null or (visual ~ '^data:image/(jpeg|png|webp);base64,' and char_length(visual) <= 2100000)),
  add column if not exists visual_geladen_am timestamptz,
  add column if not exists visual_fehler text,
  add column if not exists hat_visual boolean generated always as (visual is not null) stored;

alter table signal_layer.user_asset_settings
  add column if not exists mein_stil jsonb not null default '{}'::jsonb;
