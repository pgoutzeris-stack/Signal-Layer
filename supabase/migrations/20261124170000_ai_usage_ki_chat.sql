-- KI-Editor im Asset-Studio wird als eigene Operation gebucht.
alter table signal_layer.ai_usage_events drop constraint if exists ai_usage_events_operation_check;
alter table signal_layer.ai_usage_events add constraint ai_usage_events_operation_check check (operation = any (array[
  'classification', 'review', 'preview', 'test', 'translation', 'offering_match', 'company_profile', 'company_logo',
  'asset_generation', 'memo_benchmark_research', 'memo_market_research', 'memo_photo_research', 'memo_image_check',
  'memo_scene_image', 'memo_field_sharpen', 'memo_section_draft', 'manual_signal_check', 'manual_signal_draft',
  'person_research', 'person_verify', 'crawl_apify',
  'asset_ki_visual', 'asset_ki_bild', 'asset_privat_bild', 'asset_privat_bild_ci', 'asset_tone_score', 'asset_ki_chat'
]::text[]));
