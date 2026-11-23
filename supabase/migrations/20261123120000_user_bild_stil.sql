-- Bildstil je Nutzer fuer das Bild privater LinkedIn-Assets.
-- Die Stile selbst (Masterprompt, Serienreferenzen, Format) liegen im
-- Image-Generation-Tool unter assets/master-styles.js und werden zur Laufzeit gelesen.
alter table signal_layer.user_asset_settings add column if not exists bild_stil text not null default 'master-li-privat';
comment on column signal_layer.user_asset_settings.bild_stil is 'Stil-ID aus Image-Generation-Tool assets/master-styles.js fuer das Bild privater LinkedIn-Assets';
