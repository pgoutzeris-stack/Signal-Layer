-- Bildaufrufe im Asset-Studio wurden nicht gebucht: der Check kannte die
-- Operationen nicht, der Insert scheiterte still. Neu: asset_privat_bild
-- (Einzelbild im Bildstil) und asset_privat_bild_ci (CI-Pruefung); dazu die
-- seit 02.11.2026 genutzten asset_ki_visual und asset_ki_bild.
alter table signal_layer.ai_usage_events drop constraint if exists ai_usage_events_operation_check;
alter table signal_layer.ai_usage_events add constraint ai_usage_events_operation_check check (operation = any (array[
  'classification', 'review', 'preview', 'test', 'translation', 'offering_match', 'company_profile', 'company_logo',
  'asset_generation', 'memo_benchmark_research', 'memo_market_research', 'memo_photo_research', 'memo_image_check',
  'memo_scene_image', 'memo_field_sharpen', 'memo_section_draft', 'manual_signal_check', 'manual_signal_draft',
  'person_research', 'person_verify', 'crawl_apify',
  'asset_ki_visual', 'asset_ki_bild', 'asset_privat_bild', 'asset_privat_bild_ci'
]::text[]));
