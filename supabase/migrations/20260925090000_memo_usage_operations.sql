-- Die Memo-Recherche, die Szenenbilder, der Zauberstab und das manuelle
-- Signal buchen eigene Operationen. Der Check kannte sie nicht, der Insert
-- scheiterte nach dem bezahlten Aufruf und riss das Memo mit.
alter table signal_layer.ai_usage_events
  drop constraint if exists ai_usage_events_operation_check;
alter table signal_layer.ai_usage_events
  add constraint ai_usage_events_operation_check
  check (operation in (
    'classification', 'review', 'preview', 'test', 'translation',
    'offering_match', 'company_profile', 'company_logo', 'asset_generation',
    'memo_benchmark_research', 'memo_scene_image', 'memo_field_sharpen',
    'memo_section_draft', 'manual_signal_check', 'manual_signal_draft'
  ));
