// ---------------------------------------------------------------------------
// Signal Layer - shared pure helpers (no database, no network)
//
// Deliberately limited to building blocks BOTH pipelines need: text
// normalization, entity/umlaut folding, verbatim evidence checks and small
// similarity measures. Business rules do NOT belong here - the advanced rules
// live in pipeline-advanced.ts, the simple ones in pipeline-simple.ts.
// ---------------------------------------------------------------------------

export type SourceType = "editorial" | "corporate_newsroom" | "event" | "social";

export type CrawlPolicy = {
  sourceType: SourceType;
  entryPath: string;
  maxDepth: number;
  maxPages: number;
  maxCandidates: number;
  requireTier1: boolean;
  requireTopicSignal: boolean;
};

export function looksLikePaywallTeaser(content: string): boolean {
  const normalized = normalizeMatchText(content);
  const explicitWall = /jetzt angebot wahlen und weiterlesen|noch kein .*abonnement|nur fur abonnenten|artikel ist kostenpflichtig|weiterlesen mit .*abo|subscribe to (?:continue|read)|sign in to continue|already a subscriber|remaining article/i.test(normalized);
  const pairedWall = content.trim().length < 1200
    && /\b(abonnent|abonnement|subscription|subscribe|premium)\b/i.test(normalized)
    && /\b(weiterlesen|vollstandigen artikel|continue reading|read more|sign in|login|anmelden)\b/i.test(normalized);
  return explicitWall || pairedWall;
}

export const MATCH_TERM_FAMILIES: Record<string, string[]> = {
  "kaufverhalten": ["kaufverhalten", "consumer buying behavior", "consumer behavior", "purchasing behavior"],
  "konsumverhalten": ["konsumverhalten", "consumer behavior", "consumer trends"],
  "kundenzufriedenheit": ["kundenzufriedenheit", "customer satisfaction", "customer sentiment"],
  "markenstrategie": ["markenstrategie", "brand strategy", "brand positioning"],
  "markenführung": ["markenführung", "brand management", "brand leadership"],
  "markentreue": ["markentreue", "brand loyalty", "customer loyalty"],
  "zielgruppenanalyse": ["zielgruppenanalyse", "target audience analysis", "audience insights", "consumer insights"],
  "customer experience": ["customer experience", "cx", "kundenerlebnis"],
  "einzelhandel": ["einzelhandel", "retail", "retailing"],
  "handelsmarke": ["handelsmarke", "private label", "own label"],
  "sortimentsstrategie": ["sortimentsstrategie", "assortment strategy", "range strategy"],
  "omnichannel": ["omnichannel", "omni-channel"],
  "produkteinführung": ["produkteinführung", "product launch", "product introduction"],
  "markenrelaunch": ["markenrelaunch", "brand relaunch", "brand refresh"],
  "kampagnenstart": ["kampagnenstart", "campaign launch", "campaign rollout"],
  "rebranding": ["rebranding", "brand repositioning", "repositioning"],
  "werbekampagne": ["werbekampagne", "advertising campaign", "marketing campaign"],
  "expansion": ["expansion", "market expansion", "international expansion"],
  "markteintritt": ["markteintritt", "market entry", "entering the market"],
  "übernahme": ["übernahme", "acquisition", "takeover"],
  "fusion": ["fusion", "merger"],
  "investition": ["investition", "investment", "capital investment"],
  "agenturwechsel": ["agenturwechsel", "agency change", "new agency appointment", "appoints agency"],
  "restrukturierung": ["restrukturierung", "restructuring", "transformation program"],
  "strategiewechsel": ["strategiewechsel", "strategy change", "strategic shift"],
  "generative ki": ["generative ki", "generative ai", "genai"],
  "künstliche intelligenz marketing": ["künstliche intelligenz marketing", "ai marketing", "artificial intelligence marketing"],
  "ai-agenten": ["ai-agenten", "ai agents", "autonomous ai agents"],
  "automatisierung marketing": ["automatisierung marketing", "marketing automation", "automated marketing"],
  "ki case study": ["ki case study", "ai case study", "artificial intelligence case study"],
  "ki umsatzsteigerung": ["ki umsatzsteigerung", "ai revenue growth", "ai-driven revenue growth"],
  "ki-gestützte kampagne": ["ki-gestützte kampagne", "ai-powered campaign", "ai-driven campaign"],
  "predictive analytics": ["predictive analytics", "prognoseanalyse", "predictive modelling"],
  "brand manager": ["brand manager", "brand director", "brand lead"],
  "chief marketing officer": ["chief marketing officer", "cmo", "neuer cmo", "new cmo", "marketingdirektor", "marketingleiter"],
  "jahresergebnis": ["jahresergebnis", "annual results", "annual report", "full-year results"],
  "quartalszahlen": ["quartalszahlen", "quarterly results", "quarterly figures", "earnings report"],
  "pressemitteilung": ["pressemitteilung", "press release", "company announcement"],
  "sponsoring": ["sponsoring", "sponsorship"],
  "ausschreibung": ["ausschreibung", "tender", "request for proposal", "rfp"],
  "budgetkürzung": ["budgetkürzung", "budget cut", "budget reduction"],
  "marketingbudget": ["marketingbudget", "marketing budget"],
  "pitch": ["pitch", "agency pitch", "creative pitch"],
  "sparprogramm": ["sparprogramm", "cost-cutting program", "cost reduction program"],
};

export function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function containsMatchTerm(normalizedText: string, rawTerm: string): boolean {
  const term = normalizeMatchText(rawTerm);
  if (!term) return false;
  return ` ${normalizedText} `.includes(` ${term} `);
}

export function variantsForKeyword(keyword: string): string[] {
  const normalized = normalizeMatchText(keyword);
  const family = Object.entries(MATCH_TERM_FAMILIES).find(([, variants]) =>
    variants.some((variant) => normalizeMatchText(variant) === normalized),
  );
  return [...new Set([keyword, ...(family?.[1] || [])])];
}

export function hasAnyMatchTerm(normalizedText: string, terms: string[]): boolean {
  return terms.some((term) => containsMatchTerm(normalizedText, term));
}

export function decodeArticleText(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&auml;/g, "ä").replace(/&ouml;/g, "ö").replace(/&uuml;/g, "ü")
    .replace(/&Auml;/g, "Ä").replace(/&Ouml;/g, "Ö").replace(/&Uuml;/g, "Ü")
    .replace(/&szlig;/g, "ß")
    .replace(/&copy;/gi, "©").replace(/&reg;/gi, "®").replace(/&trade;/gi, "™")
    .replace(/&ndash;/gi, "–").replace(/&mdash;/gi, "—").replace(/&shy;/gi, "")
    .replace(/&hellip;/gi, "…").replace(/&euro;/gi, "€").replace(/&deg;/gi, "°")
    .replace(/&bdquo;/g, "„").replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”")
    .replace(/&sbquo;/g, "‚").replace(/&lsquo;/g, "‘").replace(/&rsquo;/g, "’")
    .replace(/&laquo;/gi, "«").replace(/&raquo;/gi, "»").replace(/&middot;/gi, "·")
    .replace(/&quot;/gi, '"').replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_m, n) => { try { return String.fromCodePoint(Number(n)); } catch { return _m; } })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return _m; } })
    .replace(/&amp;/gi, "&");
}

export function cleanArticleText(raw: string): string {
  const boilerplate = /^(menu|menü|menü schließen|schließen|navigation|newsletter|jetzt anmelden|jetzt bewerben|mehr erfahren|zur startseite|weiter zum inhalt|kontakt|impressum|datenschutz|privacy|cookie|social media|facebook|instagram|linkedin|youtube|copyright|\(c\)|©|weitere artikel|mehr zum thema|lesen sie auch|related articles|sign up|subscribe|book tickets|apply now|anzeige|advertisement|werbung|zum inhalt springen|skip to content|nachrichten|startseite|home|teilen|share|drucken|print|newsletter abonnieren|cookies akzeptieren|mehr dazu|alle akzeptieren|suche|suchen|suchanfrage|suche anzeigen|suche öffnen|e-mailen|e-mail|kopieren|story-link in zwischenablage kopiert|merken|folgen|abonnieren|anmelden|registrieren|login|drucken|weiterlesen|zurück|vor|weiter)$/i;
  const seen = new Set<string>();
  const out: string[] = [];
  let lastBlank = true; // suppress a leading blank line
  const lines = decodeArticleText(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    // Keep the paragraph/heading/list structure by splitting on single
    // newlines instead of collapsing runs — blank lines become real
    // paragraph separators so the reader (and formatArticleBody) can rebuild
    // headings, lists and paragraphs instead of one undifferentiated block.
    .split("\n");
  for (const rawLine of lines) {
    let line = rawLine.replace(/[ \t]+/g, " ").trim();
    if (!line) { if (!lastBlank) { out.push(""); lastBlank = true; } continue; }
    // Drop unrendered client-side templating that leaked into the HTML
    // (e.g. "${content}", "${intro}", "{{title}}") — never real article text.
    if (/^\s*(\$\{[^}]*\}|\{\{[^}]*\}\})\s*$/.test(line)) continue;
    // Drop orphaned emphasis markers and empty heading/list markers left over
    // from image-only or empty source elements.
    line = line.replace(/\*\*\s*\*\*/g, "").replace(/(^|\s)\*{1,2}(\s|$)/g, "$1$2").replace(/\s+/g, " ").trim();
    if (/^#{1,6}\s*$/.test(line) || line === "-") continue;
    // A marker-only or single-glyph line (e.g. a stray "*", "-", "©") is noise.
    if (line.replace(/[*#\-•·➟>\s]/g, "").length < 2) continue;
    // Breadcrumb trails ("Home » News » ...", "Start › Presse › ...") are pure
    // navigation; the real headline is captured separately.
    if (/[»›]|›/.test(line) && line.length < 160 && (line.match(/[»›]/g) || []).length >= 1) continue;
    // No-JS / outdated-browser interstitials and consent walls are not article
    // text — they appear when the source needs JS the fetcher can't run.
    if (/\b(browser is out of date|enable javascript|javascript aktivieren|bitte aktivieren sie javascript|to get the best experience|activez javascript)\b/i.test(line)) continue;
    const isHeading = /^#{2,3}\s+/.test(line);
    const isListItem = /^-\s+/.test(line);
    const body = line.replace(/^#{2,3}\s+/, "").replace(/^-\s+/, "");
    if (boilerplate.test(body)) continue;
    // Generic nav/share/meta-fragment filter: real article sentences run long
    // or end in punctuation, while "Copy url", "Load More", "Skip to main
    // content" or a byline are short fragments without sentence punctuation.
    // Headings and list items are exempt so structure survives.
    if (!isHeading && !isListItem) {
      const words = body.split(/\s+/).filter(Boolean).length;
      const endsSentence = /[.!?:”»")]$/.test(body);
      if (!endsSentence && (words <= 4 || body.length < 30)) continue;
    }
    const key = normalizeMatchText(body);
    if (!key) continue;
    // Dedup body text, but never let a real heading/list marker survive as a
    // duplicate of earlier body text either.
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    lastBlank = false;
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 45_000);
}

export function detectLanguage(text: string): "de" | "en" | "other" {
  // Count complete function words, not substrings. The former implementation
  // accidentally found e.g. "der" inside unrelated words and allowed the
  // model to label clearly English articles as German.
  const tokens = normalizeMatchText(text).split(" ").filter(Boolean).slice(0, 2400);
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
  const score = (terms: string[]) => terms.reduce((sum, term) => sum + Math.min(counts.get(term) || 0, 8), 0);
  const de = score(["der", "die", "das", "den", "dem", "und", "mit", "fur", "von", "wird", "werden", "ist", "sind", "ein", "eine", "auf", "zu", "im", "des", "unternehmen"]);
  const en = score(["the", "and", "with", "for", "from", "company", "market", "will", "is", "are", "a", "an", "of", "to", "in", "on", "that", "this", "has"]);
  if (de >= 6 && de >= en * 1.35) return "de";
  if (en >= 6 && en >= de * 1.35) return "en";
  return "other";
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function evidenceExists(evidence: string, articleText: string): boolean {
  const needle = normalizeMatchText(evidence);
  return needle.length >= 12 && normalizeMatchText(articleText).includes(needle);
}

export function clampConfidence(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

export function selectClassifierContent(cleanedContent: string, maxChars = 12_000): string {
  if (cleanedContent.length <= maxChars) return cleanedContent;
  const blocks = cleanedContent.split(/\n{2,}|(?<=[.!?])\s+(?=[A-ZÄÖÜ])/)
    .map((block, index) => ({ block: block.trim(), index })).filter(({ block }) => block.length >= 40);
  const score = (value: string): number => {
    const normalized = normalizeMatchText(value);
    return [
      /\b(methodik|methodology|stichprobe|sample|befrag\w*|interviews?|erheb\w*|respondent\w*)\b/i,
      /\b(ergebnis\w*|findings?|zeigt|found|reveals?|fazit|conclusion\w*)\b/i,
      /\b\d+(?:[.,]\d+)?\s*(?:%|prozent|percent|mio|million|mrd|billion)\b/i,
      /\b(customer|consumer|shopper|kund\w*|konsum\w*|marketing|marke\w*|brand|retail|handel\w*)\b/i,
      /\b(trend\w*|insight\w*|benchmark\w*|strategie|strategy|framework|handlungsfeld\w*)\b/i,
    ].reduce((sum, pattern) => sum + (pattern.test(normalized) ? 1 : 0), 0);
  };
  const selected = new Map<number, string>();
  let used = 0;
  const add = ({ block, index }: { block: string; index: number }) => {
    if (selected.has(index) || used + block.length + 2 > maxChars) return;
    selected.set(index, block); used += block.length + 2;
  };
  for (const item of blocks.slice(0, 4)) add(item);
  for (const item of blocks.slice(-4)) add(item);
  for (const item of [...blocks].sort((a, b) => score(b.block) - score(a.block) || a.index - b.index)) add(item);
  return [...selected.entries()].sort((a, b) => a[0] - b[0]).map(([, block]) => block).join("\n\n").slice(0, maxChars);
}

export function canonicalHeadline(value: string): string {
  return normalizeMatchText(value)
    .replace(/\b(cosmeticbusiness|cosmetic business|pressemitteilung|press release)\b/g, " ")
    .replace(/\s+/g, " ").trim();
}

export function tokenSimilarity(left: string, right: string): { score: number; shared: number } {
  const tokens = (value: string) => new Set(canonicalHeadline(value).split(" ")
    .filter((token) => token.length >= 4 && !/^20\d{2}$/.test(token)));
  const a = tokens(left); const b = tokens(right);
  if (!a.size || !b.size) return { score: 0, shared: 0 };
  const shared = [...a].filter((token) => b.has(token)).length;
  return { score: shared / new Set([...a, ...b]).size, shared };
}
