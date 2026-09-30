-- Zweiter Nachhol-Lauf nach weiteren Extraktionskorrekturen (engster
-- Inhaltsbereich, CSS in Wix-Seiten, Prosa-Pruefung). Kandidaten sind jetzt
-- auch Texte mit kaputten Umlauten (Altbestand vor dem Zeichensatz-Fix,
-- Markenartikel und New Business) und die schon nachgeholten Artikel zur
-- Neubewertung. Liefert Titel und gespeicherten Text fuer den Vergleich.

drop function if exists signal_layer.volltext_kandidaten(integer);

create or replace function signal_layer.volltext_kandidaten(p_limit integer)
returns table (id uuid, url text, source_id uuid, title text, text text, nachgeholt boolean)
language sql
volatile
security definer
set search_path = ''
as $$
  with auswahl as (
    select a.id
    from signal_layer.articles a
    where a.volltext_geprueft_at is null
      and a.url ~* '^https?://'
      and exists (select 1 from signal_layer.simple_signals s where s.article_id = a.id)
      and (
        (not a.paywall_detected and length(coalesce(nullif(a.cleaned_content, ''), a.content, '')) < 1500)
        or a.volltext_nachgeholt_at is not null
        or coalesce(nullif(a.cleaned_content, ''), a.content, '') like '%' || chr(65533) || '%'
      )
    order by a.crawled_at desc nulls last
    limit greatest(1, least(coalesce(p_limit, 18), 60))
    for update of a skip locked
  )
  update signal_layer.articles a
    set volltext_geprueft_at = now()
  from auswahl
  where a.id = auswahl.id
  returning a.id, a.url, a.source_id, a.title, coalesce(nullif(a.cleaned_content, ''), a.content, ''), a.volltext_nachgeholt_at is not null
$$;

revoke all on function signal_layer.volltext_kandidaten(integer) from public, anon, authenticated;
grant execute on function signal_layer.volltext_kandidaten(integer) to service_role;
