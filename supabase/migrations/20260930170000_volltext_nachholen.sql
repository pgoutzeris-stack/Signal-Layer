-- Nachholen von Volltexten nach den Extraktionskorrekturen vom 30.09.2026
-- (Chrome-Filter am body-Tag, captcha-Fehlalarm, http statt https,
-- Feed-Auszuege, Wix-Hydrationsdaten, abgeschnittene Inhaltsbereiche).
-- volltext_geprueft_at: einmal nachgeholt, egal mit welchem Ergebnis.
-- volltext_nachgeholt_at: der Text ist dabei deutlich laenger geworden; diese
-- Artikel sind die Kandidaten fuer einen neuen Pipeline-Lauf.

alter table signal_layer.articles
  add column if not exists volltext_geprueft_at timestamptz,
  add column if not exists volltext_nachgeholt_at timestamptz;

create or replace function signal_layer.volltext_kandidaten(p_limit integer)
returns table (id uuid, url text, source_id uuid, laenge integer)
language sql
volatile
security definer
set search_path = ''
as $$
  with auswahl as (
    select a.id
    from signal_layer.articles a
    where a.volltext_geprueft_at is null
      and not a.paywall_detected
      and a.url ~* '^https?://'
      and length(coalesce(nullif(a.cleaned_content, ''), a.content, '')) < 1500
      and exists (select 1 from signal_layer.simple_signals s where s.article_id = a.id)
    order by a.crawled_at desc nulls last
    limit greatest(1, least(coalesce(p_limit, 18), 60))
    for update of a skip locked
  )
  update signal_layer.articles a
    set volltext_geprueft_at = now()
  from auswahl
  where a.id = auswahl.id
  returning a.id, a.url, a.source_id, length(coalesce(nullif(a.cleaned_content, ''), a.content, ''))::integer
$$;

revoke all on function signal_layer.volltext_kandidaten(integer) from public, anon, authenticated;
grant execute on function signal_layer.volltext_kandidaten(integer) to service_role;
