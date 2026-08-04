-- Prevent two Edge Function invocations from analysing the same simple-mode
-- batch. The lease is short-lived so the watchdog can recover after a crash.
alter table signal_layer.simple_runs
  add column if not exists processing_token uuid,
  add column if not exists processing_until timestamptz;

create index if not exists simple_runs_recoverable_lease_idx
  on signal_layer.simple_runs (processing_until)
  where status = 'running';

comment on column signal_layer.simple_runs.processing_token is
  'Opaque owner of the currently claimed processing batch.';
comment on column signal_layer.simple_runs.processing_until is
  'Lease expiry; permits automatic recovery when an Edge invocation dies.';
