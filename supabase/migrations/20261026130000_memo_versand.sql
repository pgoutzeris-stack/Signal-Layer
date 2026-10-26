-- Executive Memos als abgeschickt markieren, Monatsziel und Erinnerungen.
-- Jedes Memo kann einmal als abgeschickt gelten; Aenderungen ueberschreiben.

create table if not exists signal_layer.memo_sends (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null unique references signal_layer.generated_assets(id) on delete cascade,
  channel text not null check (channel in ('mail', 'linkedin', 'sonstiges')),
  channel_other text,
  sent_on date not null,
  recipient text not null check (length(btrim(recipient)) > 0),
  sent_by uuid not null references users.profiles(id),
  marked_by uuid references users.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (channel <> 'sonstiges' or length(btrim(coalesce(channel_other, ''))) > 0)
);
alter table signal_layer.memo_sends enable row level security;
create index if not exists memo_sends_sent_on on signal_layer.memo_sends (sent_on);

-- Wer fuer das Monatsziel verantwortlich ist und wie hoch es liegt.
create table if not exists signal_layer.memo_ziel (
  id boolean primary key default true check (id),
  verantwortlich_email text not null,
  pro_monat integer not null default 5 check (pro_monat > 0)
);
alter table signal_layer.memo_ziel enable row level security;
insert into signal_layer.memo_ziel (verantwortlich_email, pro_monat)
values ('jmueller@roots-consultants.com', 5)
on conflict (id) do nothing;

-- Monatsstand fuer die Dashboard-Karte im Intranet.
create or replace function signal_layer.memo_monatsstand()
returns jsonb
language sql
stable
security definer
set search_path = signal_layer, public
as $$
  select jsonb_build_object(
    'gesendet', (select count(*) from signal_layer.memo_sends
                 where sent_on >= date_trunc('month', (now() at time zone 'Europe/Berlin'))::date
                   and sent_on < (date_trunc('month', (now() at time zone 'Europe/Berlin')) + interval '1 month')::date),
    'ziel', z.pro_monat,
    'verantwortlich_id', p.id,
    'verantwortlich_name', coalesce(p.full_name, p.email)
  )
  from signal_layer.memo_ziel z
  left join users.profiles p on lower(p.email) = lower(z.verantwortlich_email);
$$;
revoke all on function signal_layer.memo_monatsstand() from public, anon;
grant execute on function signal_layer.memo_monatsstand() to authenticated;

-- Erinnerung an den Verantwortlichen: montags, und ab dem 20. alle drei Tage,
-- solange das Monatsziel nicht erreicht ist. Hoechstens eine je Tag.
create or replace function signal_layer.memo_erinnerung()
returns text
language plpgsql
security definer
set search_path = signal_layer, public
as $$
declare
  stand jsonb := signal_layer.memo_monatsstand();
  heute date := (now() at time zone 'Europe/Berlin')::date;
  tag int := extract(day from heute);
  empfaenger uuid := nullif(stand->>'verantwortlich_id', '')::uuid;
  gesendet int := (stand->>'gesendet')::int;
  ziel int := (stand->>'ziel')::int;
  offen int;
begin
  if empfaenger is null then return 'kein Verantwortlicher'; end if;
  if gesendet >= ziel then return 'Ziel erreicht'; end if;
  if not (extract(isodow from heute) = 1 or (tag >= 20 and (tag - 20) % 3 = 0)) then return 'kein Erinnerungstag'; end if;
  if exists (select 1 from recruiting.notifications where user_id = empfaenger and type = 'signal_layer_memo'
             and (created_at at time zone 'Europe/Berlin')::date = heute) then return 'heute schon erinnert'; end if;
  offen := ziel - gesendet;
  insert into recruiting.notifications (user_id, type, title, message, meta)
  values (empfaenger, 'signal_layer_memo',
    format('Executive Memos: %s von %s abgeschickt', gesendet, ziel),
    format('Noch %s bis Monatsende als abgeschickt markieren.', offen),
    jsonb_build_object('tool_id', 'signal-layer', 'gesendet', gesendet, 'ziel', ziel));
  return 'erinnert';
end;
$$;
revoke all on function signal_layer.memo_erinnerung() from public, anon, authenticated;

select cron.schedule('signal-layer-memo-erinnerung', '0 8 * * *', 'select signal_layer.memo_erinnerung()');
