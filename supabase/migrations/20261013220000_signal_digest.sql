-- Protokoll der Wochenmail (Aktion send_signal_digest).
create table if not exists signal_layer.signal_digest_log (
  id uuid primary key default gen_random_uuid(),
  sent_at timestamptz not null default now(),
  recipients text[] not null,
  signal_count integer not null default 0,
  test boolean not null default false,
  resend_id text,
  error text
);
alter table signal_layer.signal_digest_log enable row level security;
