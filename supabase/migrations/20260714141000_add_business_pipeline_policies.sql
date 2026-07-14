update signal_layer.pipeline_settings
set config = config || jsonb_build_object(
  'experience', jsonb_build_object(
    'quality_profile', 'strict'
  ),
  'relevance', jsonb_build_object(
    'customer_insights', 'relevant',
    'marketing_insights', 'relevant',
    'fmcg_retail_signale', 'relevant',
    'ki_performance', 'impact_required',
    'sub_branchen_insight', 'impact_required',
    'allow_product_launch_without_strategy', false,
    'allow_campaign_without_results', true,
    'allow_ai_pilot', true,
    'require_ai_application', true,
    'require_subsector_transferability', true
  ),
  'decisions', jsonb_build_object(
    'marketing_requires_direct_evidence', true,
    'customer_signal_qualifies_marketing', true,
    'retail_signal_qualifies_marketing', true,
    'sales_requires_implementation', false,
    'sales_allow_risks', true,
    'buying_center_allow_role_without_name', true,
    'reject_pure_appointments', true
  )
),
version = version + 1,
updated_at = now()
where id = 'active';
