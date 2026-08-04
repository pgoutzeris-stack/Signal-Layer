create index company_profile_jobs_simple_run_idx
  on signal_layer.company_profile_jobs (simple_run_id)
  where simple_run_id is not null;
