-- Ein manuelles Signal entsteht über mehrere Schritte. Bis hierher lag der
-- Stand nur im Arbeitsspeicher des Fensters: wer es schloss, fing von vorn an.
create table if not exists signal_layer.manual_signal_drafts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  step_key text not null default 'weg',
  headline text not null default '',
  lane text not null default 'marketing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manual_signal_drafts_owner_idx
  on signal_layer.manual_signal_drafts (created_by, updated_at desc);

alter table signal_layer.manual_signal_drafts enable row level security;

-- Ein Entwurf gehört dem, der ihn tippt. Niemand sonst sieht ihn.
create policy manual_signal_drafts_own_read on signal_layer.manual_signal_drafts
  for select using (created_by = (select auth.uid()));
create policy manual_signal_drafts_own_insert on signal_layer.manual_signal_drafts
  for insert with check (created_by = (select auth.uid()));
create policy manual_signal_drafts_own_update on signal_layer.manual_signal_drafts
  for update using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
create policy manual_signal_drafts_own_delete on signal_layer.manual_signal_drafts
  for delete using (created_by = (select auth.uid()));
