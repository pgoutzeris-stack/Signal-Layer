-- Hauptstil: der eigene Post, dessen Gestaltung gilt, wenn kein Post zum
-- Inhaltstyp passt. kein_vorbild: Post zaehlt nicht als Stilvorlage.
alter table signal_layer.referenz_posts
  add column if not exists hauptstil boolean not null default false,
  add column if not exists kein_vorbild boolean not null default false;
