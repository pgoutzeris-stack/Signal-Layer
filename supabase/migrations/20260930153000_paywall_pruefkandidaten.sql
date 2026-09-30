-- Kandidaten fuer die Nachpruefung der Seitenmarkierung (Aktion
-- paywall_nachpruefen): kurze Artikel der einfachen Pipeline ohne
-- Paywall-Merkmal im Text, deren Seite noch nicht gelesen wurde. Lange Texte
-- brauchen keine Pruefung, der Befund zaehlt die Markierung nur unter 2.000
-- Zeichen. Die Auswahl reserviert die Zeilen (paywall_geprueft_at), damit sich
-- parallele Laeufe nicht dieselben Artikel nehmen.

create or replace function signal_layer.paywall_pruefkandidaten(p_limit integer)
returns table (id uuid, url text)
language sql
volatile
security definer
set search_path = ''
as $$
  with auswahl as (
    select a.id
    from signal_layer.articles a
    where a.paywall_geprueft_at is null
      and not a.paywall_detected
      and a.url is not null
      and length(coalesce(nullif(a.cleaned_content, ''), a.content, '')) < 2000
      and exists (select 1 from signal_layer.simple_signals s where s.article_id = a.id)
    order by a.crawled_at desc nulls last
    limit greatest(1, least(coalesce(p_limit, 24), 100))
    for update of a skip locked
  )
  update signal_layer.articles a
    set paywall_geprueft_at = now()
  from auswahl
  where a.id = auswahl.id
  returning a.id, a.url
$$;

revoke all on function signal_layer.paywall_pruefkandidaten(integer) from public, anon, authenticated;
grant execute on function signal_layer.paywall_pruefkandidaten(integer) to service_role;
grant execute on function signal_layer.paywall_quellen_aktualisieren() to service_role;
