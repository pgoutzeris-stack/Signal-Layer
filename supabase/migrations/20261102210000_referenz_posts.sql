-- Eigene LinkedIn-Posts je Nutzer mit Impressions. Die drei staerksten
-- dienen beim Begleittext ("KI + Tone of Voice") als Schreibvorbild, die
-- Vorlage des staerksten Posts wird im Fragebogen vorgeschlagen.

create table if not exists signal_layer.referenz_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quelle text not null default 'linkedin' check (quelle in ('linkedin')),
  extern_id text not null,
  veroeffentlicht_am date,
  text text not null check (char_length(text) between 1 and 3000),
  impressions integer not null default 0 check (impressions >= 0),
  reaktionen integer not null default 0 check (reaktionen >= 0),
  kommentare integer not null default 0 check (kommentare >= 0),
  reposts integer not null default 0 check (reposts >= 0),
  vorlage_id text check (vorlage_id is null or vorlage_id ~ '^[a-z0-9-]{1,40}$'),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  unique (user_id, quelle, extern_id)
);

create index if not exists referenz_posts_user_impressions on signal_layer.referenz_posts (user_id, impressions desc);

alter table signal_layer.referenz_posts enable row level security;

drop policy if exists "referenz posts owner" on signal_layer.referenz_posts;
create policy "referenz posts owner" on signal_layer.referenz_posts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on signal_layer.referenz_posts from anon;
