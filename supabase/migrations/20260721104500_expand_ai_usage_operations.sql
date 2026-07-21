alter table signal_layer.ai_usage_events
  drop constraint if exists ai_usage_events_operation_check;

alter table signal_layer.ai_usage_events
  add constraint ai_usage_events_operation_check
  check (operation in ('classification', 'review', 'preview', 'test', 'translation', 'offering_match'));
