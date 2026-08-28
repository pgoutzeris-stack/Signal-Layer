-- Wer ein Asset uebernimmt, steht dafuer ein: es geht auf seinen Namen raus.
-- Bisher zeigte die Artikelkarte jeden, der irgendwann einen Entwurf gebaut
-- hat - das sagt nichts darueber, wer den Beitrag am Ende verantwortet.
alter table signal_layer.generated_assets
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists owned_at timestamptz;

create index if not exists generated_assets_owner_idx
  on signal_layer.generated_assets (owner_id) where owner_id is not null;
