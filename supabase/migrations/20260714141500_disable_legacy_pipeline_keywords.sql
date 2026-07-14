update signal_layer.keywords
set active = false,
    updated_at = now()
where active = true;

comment on table signal_layer.keywords is
  'Legacy keyword catalogue retained for audit only. The active pipeline uses curated code signal families and business policies.';
