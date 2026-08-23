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
