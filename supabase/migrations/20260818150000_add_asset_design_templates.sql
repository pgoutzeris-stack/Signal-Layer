-- Design-Vorlagen des Privatprofils. Der Tonfall gehoert der Person, das
-- Aussehen des privaten Beitrags ebenso: zwei Berater posten aus demselben
-- Signal unter eigenem Namen, eigener Fusszeile und eigenem Zeichen.
--
-- Die beiden ROOTS-Vorlagen stehen bewusst im Code und nicht hier: sie gehoeren
-- der Marke und sind fuer alle gleich.

alter table signal_layer.user_asset_settings
  add column if not exists design_templates jsonb not null default '[]'::jsonb;

alter table signal_layer.user_asset_settings
  drop constraint if exists user_asset_settings_design_templates_shape;
alter table signal_layer.user_asset_settings
  add constraint user_asset_settings_design_templates_shape
  check (jsonb_typeof(design_templates) = 'array'
         and jsonb_array_length(design_templates) <= 12);

comment on column signal_layer.user_asset_settings.design_templates is
  'Design-Vorlagen des Privatprofils je Nutzer: [{id,name,theme,footer_left,domain,logo}]. Reihenfolge = Anzeigereihenfolge im Fragebogen.';
