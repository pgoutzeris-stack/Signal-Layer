-- Asset Studio: aus einem geprueften Signal entsteht ein LinkedIn-Asset oder
-- eine Entscheidervorlage. Beides ist ein KI-Aufruf und muss deshalb wie jede
-- andere Operation im Kostenledger auftauchen.

-- Der operation-Check kennt die neue Operation noch nicht. Ohne diese
-- Erweiterung scheitert der Insert NACH dem bereits bezahlten Modellaufruf,
-- die Kosten waeren also gezahlt, aber nirgends gebucht.
alter table signal_layer.ai_usage_events
  drop constraint if exists ai_usage_events_operation_check;
alter table signal_layer.ai_usage_events
  add constraint ai_usage_events_operation_check
  check (operation in (
    'classification', 'review', 'preview', 'test', 'translation',
    'offering_match', 'company_profile', 'company_logo', 'asset_generation'
  ));

create table if not exists signal_layer.generated_assets (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('linkedin', 'memo')),
  article_id uuid references signal_layer.articles (id) on delete set null,
  signal_id uuid references signal_layer.simple_signals (id) on delete set null,
  company text,
  answers jsonb not null default '{}'::jsonb,
  payload jsonb not null,
  edited_html text,
  model text not null,
  prompt_version text not null,
  usage_event_id uuid references signal_layer.ai_usage_events (id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists generated_assets_article_idx
  on signal_layer.generated_assets (article_id, created_at desc);

-- Zugriff wie im uebrigen Schema: nur die Edge Function mit der Service-Rolle
-- liest und schreibt hier, kein Client spricht die Tabelle direkt an.
alter table signal_layer.generated_assets enable row level security;
revoke all on table signal_layer.generated_assets from public, anon, authenticated;
grant all on table signal_layer.generated_assets to service_role;

comment on table signal_layer.generated_assets is
  'Ein erzeugtes Asset je Lauf: Fragebogenantworten, Modellnutzlast und der im Browser bearbeitete Stand.';
comment on column signal_layer.generated_assets.payload is
  'Unveraenderte, normalisierte Modellantwort. Bleibt erhalten, damit edited_html jederzeit neu aufgebaut werden kann.';
comment on column signal_layer.generated_assets.edited_html is
  'Vom Nutzer in der Werkbank bearbeiteter Stand. Null, solange nur der Entwurf existiert.';
comment on column signal_layer.generated_assets.usage_event_id is
  'Kostenereignis des erzeugenden Modellaufrufs, damit jedes Asset seinen Preis kennt.';
