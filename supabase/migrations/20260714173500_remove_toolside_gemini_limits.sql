update signal_layer.pipeline_settings
set config = config #- '{ai,daily_request_limit}' #- '{ai,daily_review_limit}',
    updated_at = now()
where config #> '{ai}' is not null;
