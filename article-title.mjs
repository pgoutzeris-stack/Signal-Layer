/**
 * Ein Titel je Artikel, ueberall derselbe: Uebersicht, Archiv, Detail.
 *
 * Ein Signal hat zwei Titel. Die Signal-Ueberschrift (headline_de) sagt, was
 * der Artikel fuer ROOTS bedeutet, der Artikeltitel ist die Zeile der Quelle.
 * Bis 29.9.2026 zeigte die Karte die erste und das Detail die zweite: der
 * Intersport-Artikel hiess in der Liste „Intersport will Eigenmarken staerken
 * und Superstores testen“ und nach dem Klick „Intersport: Alexander von Preen
 * ueber die WM 2026“.
 */
export function articleDisplayTitle(article = {}, signal = {}) {
  const wert = [
    signal?.headline_de,
    article?.signal_headline,
    article?.title_de,
    article?.title,
    article?.url,
  ].map((eintrag) => String(eintrag || "").trim()).find(Boolean);
  return wert || "Ohne Titel";
}

/** Originaltitel der Quelle, wenn er vom angezeigten Titel abweicht. Sonst leer. */
export function articleOriginalTitle(article = {}, signal = {}) {
  const original = String(article?.title || "").trim();
  if (!original) return "";
  return original === articleDisplayTitle(article, signal) ? "" : original;
}
