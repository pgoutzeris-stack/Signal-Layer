-- Ein Lauf, der auf den Nebentarif wartet. DeepSeek verdoppelt in den
-- Spitzenzeiten jeden Token; wer zwei Stunden warten kann, zahlt die Haelfte.
-- Die Zeile haelt fest, was gestartet werden soll, und der Waechter startet es,
-- sobald der Zeitpunkt erreicht ist.
create table if not exists signal_layer.simple_run_schedule (
  id uuid primary key default gen_random_uuid(),
  planned_for timestamptz not null,
  article_ids jsonb not null default '[]'::jsonb,
  article_limit integer,
  status text not null default 'queued' check (status in ('queued', 'started', 'cancelled')),
  reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  started_run_id uuid,
  started_at timestamptz
);

create index if not exists simple_run_schedule_faellig_idx
  on signal_layer.simple_run_schedule (status, planned_for);

comment on table signal_layer.simple_run_schedule is
  'Geplante Simple-Laeufe. Der Pipeline-Waechter startet eine faellige Zeile und setzt status=started.';

-- Ein Lauf im Spitzentarif kostet das Doppelte. Er startet nur, wenn der
-- Nutzer das ausdruecklich akzeptiert hat.
alter table signal_layer.simple_run_schedule
  add column if not exists accept_peak boolean not null default false;

-- Ein Lauf, der in die Spitzenzeit hineinlaeuft, haelt an, statt zum doppelten
-- Preis weiterzurechnen. Der Waechter nimmt ihn im Nebentarif wieder auf.
alter table signal_layer.simple_runs drop constraint if exists simple_runs_status_check;
alter table signal_layer.simple_runs add constraint simple_runs_status_check
  check (status = any (array['running'::text, 'paused'::text, 'done'::text, 'error'::text]));
alter table signal_layer.simple_runs add column if not exists accept_peak boolean not null default false;
alter table signal_layer.simple_runs add column if not exists paused_at timestamptz;
alter table signal_layer.simple_runs add column if not exists paused_reason text;
