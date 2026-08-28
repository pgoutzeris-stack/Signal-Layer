-- Worum es im Signal wirklich geht: Gegenstand, gemeldete Veraenderung,
-- Relevanz. Ein eigener Modellschritt bestimmt das vor dem Schreiben. Der
-- Schreibschritt und die spaetere Pruefung laufen in getrennten Aufrufen und
-- muessen denselben Gegenstand sehen - deshalb steht er an der Zeile, nicht
-- nur im Prompt.
alter table signal_layer.generated_assets
  add column if not exists subject jsonb;
