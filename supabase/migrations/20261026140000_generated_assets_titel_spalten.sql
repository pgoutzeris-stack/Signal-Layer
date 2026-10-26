-- Titel als eigene Spalten: payload->>title entpackt je Zeile das ganze
-- payload-JSON (im Schnitt ~540 kB mit Bildern). Das Dashboard brauchte
-- dafuer 5,9 s Datenbankzeit, mit den Spalten 12 ms.
alter table signal_layer.generated_assets
  add column if not exists payload_title text generated always as (payload->>'title') stored,
  add column if not exists payload_slide_title text generated always as (payload->'slides'->0->>'title') stored;
create index if not exists generated_assets_status_created on signal_layer.generated_assets (status, created_at desc);
