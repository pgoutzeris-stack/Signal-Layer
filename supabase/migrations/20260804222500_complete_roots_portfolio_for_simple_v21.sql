-- Two services explicitly described on the ROOTS website were missing from
-- the editable Signal Layer catalogue. They are now available to both the
-- settings UI and the family-scoped v2.1 article prompt.
insert into signal_layer.roots_offerings
  (id, pillar, sort_order, label, description, active)
values
  (
    'planning_markenarchitektur',
    'planning',
    100,
    'Markenarchitektur',
    'ROOTS analysiert die Markenlandschaft, klärt Rollen von Dachmarke, Submarken und Produktlinien, reduziert Überschneidungen und entwickelt eine zukunftsfähige Architektur, die Synergien, Orientierung und Wachstum unterstützt.',
    true
  ),
  (
    'productivity_design_to_print_artwork',
    'productivity',
    90,
    'D2P & Artwork Management',
    'ROOTS optimiert die Packaging Graphic Chain von Design bis Druck, einschließlich Artwork, Freigaben, Rollen, Daten und Dienstleistern, um Time-to-Market zu verkürzen, Markenkonsistenz zu sichern und Kosten zu senken.',
    true
  )
on conflict (id) do update set
  pillar = excluded.pillar,
  sort_order = excluded.sort_order,
  label = excluded.label,
  description = excluded.description,
  active = excluded.active,
  updated_at = now();
