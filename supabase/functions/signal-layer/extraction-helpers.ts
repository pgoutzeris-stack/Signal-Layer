// Extraktionshelfer fuer den Advanced-Crawl. Reine Funktionen, damit sie ohne
// Deno-Laufzeit getestet werden koennen (siehe tests/article-extraction.test.mjs).
//
// Aus der Handpruefung der am 5.8.2026 ergaenzten Quellen: Newsrooms wie
// beiersdorf.de tragen das Veroeffentlichungsdatum weder in JSON-LD noch in
// einem Meta-Tag, sondern nur in einem als Datum ausgewiesenen Element im
// Artikelkopf.

import { decodeArticleText } from "./pipeline-core.ts";

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

// Remove non-article page chrome (menus, headers, footers, sidebars, forms,
// cookie/consent widgets) BEFORE text extraction. Many sites put their huge
// navigation in plain <div>/<ul> menus that are not semantic <nav>, so we also
// drop elements whose id/class marks them as navigation/menu/footer/etc.
export function stripPageChrome(html: string): string {
  // Ein Durchgang fuer script, style und noscript: steht "<script" als Text
  // in einem Stylesheet (Wix, circana.com), schnitt die getrennte Entfernung
  // das schliessende </style> weg und das CSS blieb als Artikeltext stehen.
  let out = html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ")
    .replace(/<select[\s\S]*?<\/select>/gi, " ")
    .replace(/<menu[\s\S]*?<\/menu>/gi, " ");
  // Drop role=navigation/banner/contentinfo/search/dialog regions.
  out = out.replace(/<(?!(?:body|html|main|article)\b)([a-z0-9]+)\b[^>]*\brole=["'](?:navigation|banner|contentinfo|search|dialog|menu|menubar)["'][\s\S]*?<\/\1>/gi, " ");
  // Drop chrome by class/id keyword regardless of tag or theme naming
  // convention (sidebar widgets, related/teaser lists, share bars, comments,
  // promo/ad slots, breadcrumbs, tag/category lists, newsletter signup).
  // Tag-agnostic \1 backreference can truncate early on deeply nested same-
  // tag markup — an accepted tradeoff shared with the role-based strip above,
  // still net-positive since it removes far more chrome than it wrongly cuts.
  const CHROME_CLASS_KEYWORDS = "widget|sidebar|related[-_]?posts?|teaser|share[-_]?bar|social[-_]?share|comments?[-_]?(section|area|list)|promo|advert|breadcrumbs?|tag[-_]?list|categor(?:y|ie)[-_]?list|newsletter[-_]?(signup|box)|most[-_]?read|meistgelesen|weiterlesen[-_]?box|empfehlung";
  // body, html, main und article tragen oft Zustandsklassen wie
  // "ur-settings-sidebar-show" (rundschau.de) oder "enhanced-advertising"
  // (The Grocer). Ein Treffer dort loeschte bis 30.9.2026 die ganze Seite.
  out = out.replace(new RegExp(`<(?!(?:body|html|main|article)\\b)([a-z0-9]+)\\b[^>]*\\b(?:class|id)=["'][^"']*(?:${CHROME_CLASS_KEYWORDS})[^"']*["'][\\s\\S]*?<\\/\\1>`, "gi"), " ");
  return out;
}

// JSON-LD structured data (schema.org Article/NewsArticle) sometimes carries
// the full plain-text articleBody directly — the single most reliable source
// when present, since it needs no HTML-structure guessing at all. Markdown
// structure (headings/lists) is lost here since it's plain text, but the
// content itself is guaranteed to be the real article, never chrome.
export function extractJsonLdArticleBody(html: string): string | null {
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const block of scripts) {
    const raw = block.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();
    try {
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : (parsed["@graph"] || [parsed]);
      for (const node of nodes) {
        const body = node?.articleBody;
        if (typeof body === "string" && body.trim().length >= 400) return body.trim();
      }
    } catch { /* malformed/partial JSON-LD — skip, other strategies still apply */ }
  }
  return null;
}

// Next.js, React and several corporate newsroom platforms hydrate article
// data from JSON embedded in the initial HTML. Recover likely body fields
// before requiring a full browser render. This keeps most JS-heavy sources on
// the free native path while remaining bounded and source-agnostic.
/**
 * Fliesstext statt Daten, Markup oder CSS. Wix-Seiten (foodbev.com, Circana)
 * betten JSON-Vorlagen und Stylesheets als Strings ein; beides kam bis
 * 30.9.2026 als Artikeltext durch.
 */
function istFliesstext(wert: string): boolean {
  const text = wert.trim();
  if (/^[{[<#.@]/.test(text) || /\{\{/.test(text)) return false;
  const code = (text.match(/[{};<>]/g) || []).length;
  if (code > text.length * 0.005) return false;
  const buchstaben = (text.match(/[\p{L}\s.,;:!?'"„“”‘’()-]/gu) || []).length;
  return buchstaben >= text.length * 0.9;
}

export function extractEmbeddedArticleBody(html: string, bezug = ""): string | null {
  const blocks = html.match(/<script[^>]*(?:id=["']__NEXT_DATA__["']|type=["']application\/json["'])[^>]*>[\s\S]*?<\/script>/gi) || [];
  const candidates: string[] = [];
  const visit = (value: unknown, key = "", depth = 0): void => {
    if (depth > 14 || candidates.length > 300) return;
    if (typeof value === "string") {
      if (/^(articlebody|article_body|body|content|plaincontent|plain_content|storybody|story_body|text|richtext|rich_text|description)$/i.test(key)
          && value.trim().length >= 400 && value.length <= 100_000 && istFliesstext(value)) candidates.push(value.trim());
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 500)) visit(item, key, depth + 1);
    } else if (value && typeof value === "object") {
      for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) visit(child, childKey, depth + 1);
    }
  };
  for (const block of blocks) {
    const raw = block.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();
    try { visit(JSON.parse(raw)); } catch { /* malformed hydration payload */ }
  }
  if (!candidates.length) return null;
  // Wix-Seiten wie foodbev.com betten neben dem Artikel verwandte Beitraege
  // und Firmenportraets ein; der laengste Block war dort ein Werbetext. Ohne
  // Titel und Anriss bleibt es beim laengsten Block, sonst gewinnt der, der zu
  // ihnen passt.
  const woerter = (text: string) => new Set(text.toLowerCase().match(/[a-zäöüß]{4,}/g) || []);
  const hinweis = woerter(bezug);
  if (!hinweis.size) return candidates.sort((a, b) => b.length - a.length)[0];
  const passung = (kandidat: string) => {
    const eigene = woerter(kandidat.slice(0, 1500));
    let treffer = 0;
    for (const wort of hinweis) if (eigene.has(wort)) treffer += 1;
    return treffer;
  };
  const bewertet = candidates.map((kandidat) => ({ kandidat, treffer: passung(kandidat) }))
    .sort((a, b) => b.treffer - a.treffer || b.kandidat.length - a.kandidat.length);
  return bewertet[0].treffer >= 2 ? bewertet[0].kandidat : null;
}

// Density-scored container selection (lightweight Readability-style
// heuristic). Instead of trusting raw text length — which a nav/teaser block
// can win by sheer volume — score by paragraph density and penalize link-
// heavy or chrome-labelled blocks, so real prose wins even under a class name
// stripPageChrome/extractMainContentHtml's fixed keyword list doesn't know.
function scoreCandidateBlock(block: string): number {
  const textLen = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
  if (textLen < 200) return -1;
  const paragraphCount = (block.match(/<p\b[^>]*>/gi) || []).length;
  const linkTextLen = (block.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || [])
    .reduce((sum, a) => sum + a.replace(/<[^>]+>/g, " ").trim().length, 0);
  const linkDensity = textLen > 0 ? linkTextLen / textLen : 1;
  const chromeHit = /\b(nav|menu|sidebar|widget|footer|header|comment|share|social|promo|advert|related|teaser|breadcrumb)\b/i
    .test((block.match(/class=["'][^"']*["']/i) || [""])[0]);
  return textLen + paragraphCount * 80 - linkDensity * textLen * 1.5 - (chromeHit ? 2000 : 0);
}

// Best-effort main-content isolation. Prefers a semantic <article>/<main> or a
// content-flagged container and returns the richest one; returns null when
// nothing substantial is found so the caller can fall back to the whole body.
/**
 * Das ganze Element ab seinem oeffnenden Tag, verschachtelte gleichnamige
 * Elemente eingeschlossen. Bis 30.9.2026 endete ein Inhaltsbereich am ersten
 * schliessenden Tag; bei stores+shops gewann so ein verwandter Artikel.
 */
function ganzesElement(html: string, start: number, tag: string): string {
  const marke = new RegExp(`<(\\/?)${tag}\\b[^>]*?(\\/?)>`, "gi");
  marke.lastIndex = start;
  let tiefe = 0;
  for (let m = marke.exec(html); m; m = marke.exec(html)) {
    if (m[2]) continue;
    tiefe += m[1] ? -1 : 1;
    if (tiefe === 0) return html.slice(start, m.index + m[0].length);
  }
  return html.slice(start);
}

export function extractMainContentHtml(html: string): string | null {
  const candidates: string[] = [];
  const oeffner = [
    /<(article)\b[^>]*>/gi,
    /<(main)\b[^>]*>/gi,
    /<([a-z0-9]+)\b[^>]*\b(?:id|class)=["'][^"']*(?:article-?body|articlebody|article-?content|post-?content|entry-?content|story-?body|story-?content|content-?body|rich-?text|main-?content|c-article|news-detail|jeg_content|post_content_elementor|td-post-content|single-content|artikel-content|beitragstext)[^"']*["'][^>]*>/gi,
  ];
  for (const re of oeffner) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null && candidates.length < 80) candidates.push(ganzesElement(html, m.index, m[1].toLowerCase()));
  }
  // Score, don't just measure length — a sidebar/teaser block can be longer
  // than the real article; density scoring picks the block that actually
  // reads like prose (see scoreCandidateBlock).
  const bewertet = candidates
    .map((c) => ({ c, score: scoreCandidateBlock(c), absaetze: absatzText(c), laenge: sichtbareLaenge(c) }))
    .filter((k) => k.score >= 400);
  if (!bewertet.length) return null;
  // Seit die Bereiche ganz gelesen werden, enthaelt ein <main> oder <article>
  // auch Empfehlungslisten und Fusszeilen. Deshalb gewinnt der engste Bereich,
  // der fast alle Artikelabsaetze traegt. Ohne echte Absaetze bleibt es beim
  // besten Score.
  const meisteAbsaetze = Math.max(...bewertet.map((k) => k.absaetze));
  if (meisteAbsaetze < 300) return bewertet.sort((a, b) => b.score - a.score)[0].c;
  return bewertet
    .filter((k) => k.absaetze >= meisteAbsaetze * 0.85)
    .sort((a, b) => a.laenge - b.laenge)[0].c;
}

function sichtbareLaenge(block: string): number {
  return block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
}

/** Text in Absaetzen mit mindestens 40 Zeichen: der eigentliche Artikel. */
function absatzText(block: string): number {
  return (block.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [])
    .map((p) => sichtbareLaenge(p))
    .filter((laenge) => laenge >= 40)
    .reduce((summe, laenge) => summe + laenge, 0);
}

// Generic last resort when no named container matched (unknown/uncommon CMS
// themes — e.g. WordPress "Jnews"/Elementor sites that wrap content in
// theme-specific classes we don't know). Real article prose lives in <p>
// tags; site chrome (menus, teaser lists, sidebars) is built from <a>/<li>
// without paragraph text, so collecting substantial <p> blocks reliably
// skips navigation even when we can't name the surrounding container.
export function extractParagraphCluster(html: string): string | null {
  const paragraphs = html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [];
  const substantial = paragraphs.filter((p) => p.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length >= 40);
  if (!substantial.length) return null;
  const joined = substantial.join("\n");
  const len = joined.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
  return len >= 400 ? joined : null;
}

/**
 * Titel, Anriss und Artikeltext aus einer Seite. Reihenfolge der Quellen,
 * verlaesslichste zuerst: JSON-LD articleBody, eingebettete Hydrationsdaten,
 * ein benannter oder nach Absatzdichte bewerteter Inhaltsbereich, ein Block
 * aus Absaetzen, zuletzt der ganze bereinigte Body. Struktur bleibt als
 * leichtes Markdown erhalten.
 */
export function artikelAusHtml(html: string): { title: string; excerpt: string; text: string } {
  const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = (titleMatch?.[1] || "").trim();

  const descMatch = html.match(/<meta[^>]+(?:property=["']og:description["']|name=["']description["'])[^>]+content=["']([^"']+)["']/i);
  const excerpt = (descMatch?.[1] || "").trim();

  const bodyMatch = html.match(/<body[\s\S]*?<\/body>/i);
  const cleanedBody = stripPageChrome(bodyMatch ? bodyMatch[0] : html);
  // Extraction palette, most reliable first: (1) JSON-LD articleBody needs
  // no HTML-structure guessing at all when present; (2) a named/likely
  // article container scored by paragraph density beats chrome even under
  // an unknown theme's class name; (3) a generic <p>-block cluster catches
  // themes matched by neither; (4) the whole chrome-stripped body as the
  // final fallback so extraction never simply fails.
  let text = extractJsonLdArticleBody(html) || extractEmbeddedArticleBody(html, `${title} ${excerpt}`)
    || extractMainContentHtml(cleanedBody) || extractParagraphCluster(cleanedBody) || cleanedBody;
  text = text
    // Preserve structure as lightweight Markdown BEFORE the generic tag
    // strip below collapses everything into one flat blob — otherwise
    // headings/bold/lists are indistinguishable from body text once the
    // tags are gone, and that structure can't be reconstructed afterwards.
    // Only emit a Markdown marker when the element actually wraps text —
    // an empty or image-only <strong>/<em>/<h*> otherwise leaves orphaned
    // ** or * artifacts once its inner tags are stripped below.
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_m, inner) => inner.trim() ? `\n\n## ${inner}\n\n` : " ")
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, inner) => inner.trim() ? `**${inner}**` : " ")
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, inner) => inner.trim() ? `*${inner}*` : " ")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner) => inner.trim() ? `\n- ${inner}` : " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|blockquote)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    // Clean up markers left empty after an inner tag (e.g. an image) was
    // stripped. The bold pattern only matches an empty pair, and the italic
    // pattern requires whitespace between, so real **bold**/*italic* stay.
    .replace(/\*\*\s*\*\*/g, " ")
    .replace(/\*[ \t]+\*/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .split("\n").map((line) => line.trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  text = decodeArticleText(text);
  return { title: decodeArticleText(title), excerpt: decodeArticleText(excerpt), text };
}

/**
 * Seite ohne Artikeltext, die eine Bot- oder JavaScript-Pruefung zeigt. Nur mit
 * kurzem Text: "captcha" steht auch in Formularen und Skript-Konfigurationen
 * lesbarer Artikel (rundschau.de, foodbev.com und stores+shops wurden bis
 * 30.9.2026 deshalb ganz verworfen).
 */
export function istPruefseite(html: string, text: string): boolean {
  if (String(text || "").trim().length >= 400) return false;
  return /cf-chl-|checking your browser|just a moment|cloudflare ray id|enable javascript and cookies to continue|\bcaptcha\b/i.test(String(html || ""));
}

/**
 * Feed-Eintrag, der nur einen Auszug traegt und auf die Seite verweist
 * (Digiday "Continue reading this article on", WordPress "The post ...
 * appeared first on", "Der Beitrag ... erschien zuerst auf"). Dann muss die
 * Seite selbst geholt werden, auch wenn der Auszug lang ist.
 */
export function istFeedAuszug(text: string): boolean {
  const ende = String(text || "").trim().slice(-400);
  return /continue reading (this article|this story)?\s*on|appeared first on|erschien zuerst auf|read the full (story|article)|den (vollst.ndigen|ganzen) (artikel|beitrag) lesen|(\[(…|\.\.\.)\]|\[&hellip;\])\s*$/i.test(ende);
}

/**
 * Fliesstext mit echten Saetzen statt Menue, Linkliste oder Stylesheet. Beim
 * Nachholen am 30.9.2026 kamen sonst die Navigation von wiwo.de und das CSS
 * von circana.com als "laengerer Text" durch.
 */
export function istProsa(text: string): boolean {
  const inhalt = String(text || "").trim();
  if (inhalt.length < 300) return false;
  if ((inhalt.match(/[{};]/g) || []).length > inhalt.length * 0.01) return false;
  const saetze = (inhalt.match(/[\p{L}\d"“”»«)’][.!?](?=\s|$)/gu) || []).length;
  if (saetze < 3) return false;
  const zeilen = inhalt.split(/\n+/).map((z) => z.trim()).filter(Boolean);
  const listig = zeilen.filter((z) => /^(-|\*|•|##)\s/.test(z) || (z.length < 40 && !/[.!?:]$/.test(z))).length;
  return listig < zeilen.length * 0.6;
}
