alter table signal_layer.simple_runs
  add column if not exists research_model text;

alter table signal_layer.ai_usage_events
  add column if not exists simple_run_id uuid
  references signal_layer.simple_runs(id) on delete set null;

create index if not exists idx_ai_usage_events_simple_run_created
  on signal_layer.ai_usage_events (simple_run_id, created_at desc)
  where simple_run_id is not null;

-- Bestehende Simple-Ereignisse lassen sich ueber das unveraenderliche
-- Zeitfenster und die Prompt-Version ihres Laufs eindeutig zuordnen. Dadurch
-- stimmt auch der bereits aktive Lauf unmittelbar nach der Ausrollung.
update signal_layer.ai_usage_events as event
set simple_run_id = (
  select run.id
  from signal_layer.simple_runs as run
  where event.created_at >= run.started_at
    and event.created_at <= coalesce(run.finished_at, now())
    and event.prompt_version = run.prompt_version
  order by run.started_at desc
  limit 1
)
where event.simple_run_id is null
  and event.prompt_version like 'roots-simple-%';

update signal_layer.simple_runs
set research_model = 'gemini-2.5-flash'
where research_model is null;
