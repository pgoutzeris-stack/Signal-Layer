// Extraktionshelfer fuer den Advanced-Crawl. Reine Funktionen, damit sie ohne
// Deno-Laufzeit getestet werden koennen (siehe tests/article-extraction.test.mjs).
//
// Aus der Handpruefung der am 5.8.2026 ergaenzten Quellen: Newsrooms wie
// beiersdorf.de tragen das Veroeffentlichungsdatum weder in JSON-LD noch in
// einem Meta-Tag, sondern nur in einem als Datum ausgewiesenen Element im
// Artikelkopf.

const GERMAN_MONTHS: Record<string, number> = {
  januar: 0, februar: 1, maerz: 2, marz: 2, april: 3, mai: 4, juni: 5,
  juli: 6, august: 7, september: 8, oktober: 9, november: 10, dezember: 11,
};

/**
 * Findet ein Datum in einem Element, dessen id/class es ausdruecklich als Datum
 * ausweist. Praezise und unabhaengig von der Position auf der Seite - anders als
 * die Textsuche in den ersten Zeichen der Seite, die bei Newsrooms mit langem
 * Kopfbereich (Beiersdorf: Datum erst nach 3.200 Zeichen) ins Leere laeuft.
 *
 * Akzeptiert 03.08.2026, 3. August 2026 und 2026-08-03. Gibt den ISO-Tag
 * zurueck oder null, wenn kein plausibles Datum im Element steht.
 */
export function extractDateFromDateElement(html: string, now = Date.now()): string | null {
  // Nur der Kopfbereich des Artikels zaehlt. horizont.net zeigt weiter unten
  // eine Teaser-Leiste, in der jeder Eintrag ein Datum in einem als Datum
  // ausgewiesenen Element traegt - ohne diese Grenze waere das Datum des
  // obersten Teasers gewonnen und der Artikel falsch einsortiert.
  const headlineIndex = html.search(/<h1\b/i);
  const limit = headlineIndex >= 0 ? headlineIndex + 3000 : 6000;
  const pattern = /<[a-z0-9]+\b[^>]*(?:id|class)=["'][^"']*\b(?:date|datum|pubdate|publish[a-z-]*|timestamp)\b[^"']*["'][^>]*>([\s\S]{0,200}?)<\//gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const element = match[0];
    if (match.index > limit) break;
    // Teaser-, Karten- und Listenmarkierungen ausschliessen: dort steht das
    // Datum eines fremden Artikels.
    if (/(?:feed|teaser|slider|carousel|\b(?:card|widget|sidebar|related|most-?read|popular|listing)\b)/i.test(element)) continue;
    const text = element.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    const iso = matchAnyGermanOrIsoDate(text);
    if (!iso) continue;
    const date = new Date(iso);
    if (isNaN(date.getTime())) continue;
    if (date.getUTCFullYear() < 1990) continue;
    if (date.getTime() > now + 24 * 60 * 60 * 1000) continue;
    return date.toISOString();
  }
  return null;
}

/** Erkennt 03.08.2026, 3. August 2026 und 2026-08-03 in einem kurzen Text. */
function matchAnyGermanOrIsoDate(text: string): string | null {
  const isoMatch = text.match(/\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00.000Z`;

  const numeric = text.match(/\b([0-3]?\d)\.\s?([01]?\d)\.\s?(20\d{2})\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return isoDay(Number(numeric[3]), month - 1, day);
    }
  }

  const longForm = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/\b([0-3]?\d)\.?\s+(januar|februar|maerz|marz|april|mai|juni|juli|august|september|oktober|november|dezember)\s+(20\d{2})\b/);
  if (longForm) {
    const day = Number(longForm[1]);
    if (day >= 1 && day <= 31) return isoDay(Number(longForm[3]), GERMAN_MONTHS[longForm[2]], day);
  }
  return null;
}

function isoDay(year: number, monthIndex: number, day: number): string | null {
  const date = new Date(Date.UTC(year, monthIndex, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== monthIndex || date.getUTCDate() !== day) return null;
  return date.toISOString();
}
