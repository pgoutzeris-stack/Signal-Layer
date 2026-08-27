// Steckbriefe der Tier-1-Unternehmen.
//
// Warum ein eigenes Modul und ein eigenes Modell: die Artikelbewertung laeuft auf
// DeepSeek, und DeepSeek hat ueber die API keine Websuche - die Dokumentation
// nennt Tool Calls, JSON, Caching und Reasoning, aber kein Search. Ein Profil aus
// reinem Modellwissen waere plausibel aussehende Erfindung, samt erfundener
// Quellen. Gemini kann dagegen mit Google-Search-Grounding aufgerufen werden und
// liefert echte Belege in groundingMetadata.groundingChunks.
//
// Empirisch geprueft am 3.8.2026: der native Aufruf generateContent mit
// tools: [{ google_search: {} }] antwortet mit 200, korrektem Umsatz und vier
// Quellen. Die in der Doku gezeigte Form mit input/steps/url_citation gilt fuer
// einen anderen Endpunkt und passt hier nicht.
//
// Gerechnet wird pro Suchanfrage, die das Modell absetzt. Deshalb ein Profil pro
// Unternehmen und weitere Stände nur nach ausdrücklicher Aktualisierung, nicht
// ein Profil pro Artikel.

export const COMPANY_PROFILE_MODEL = "gemini-2.5-flash";
/** Obergrenze je Verarbeitungspaket, damit ein Lauf nicht in Recherche umkippt. */
export const COMPANY_PROFILE_MAX_PER_BATCH = 2;
export const COMPANY_PROFILE_MAX_OUTPUT_TOKENS = 10_000;
export const COMPANY_LOGO_LOOKUP_VERSION = "2026-08-tier1-logo-registry-v1";

/** Die Karten des Steckbriefs, in der Reihenfolge der Anzeige. */
export const COMPANY_PROFILE_SECTIONS = [
  "Allgemeine Unternehmensdaten",
  "Buying Center / Relevante Personen",
  "Unternehmensstrategie",
  "Markenstrategie",
  "Themen zur Ansprache",
] as const;

/** Kommt nicht aus der Recherche, sondern je Artikel aus dem Bewertungsaufruf. */
export const COMPANY_PROFILE_ARTICLE_SECTION = "Trigger & Aufhänger — warum jetzt?";

/**
 * Eine Kennzahl gehoert immer zu einer Ebene: "global" ist der Konzern
 * weltweit, "de" ist das Deutschlandgeschaeft. Ohne diese Trennung stehen
 * Konzernumsatz und Landesumsatz nebeneinander in derselben Kachel und der
 * Steckbrief widerspricht jeder Google-Suche - beobachtet bei Aldi Sued:
 * 203.146 Mitarbeitende weltweit gegen rund 50.000 in Deutschland.
 * "source_url" traegt den Beleg genau dieser Zahl, nicht des ganzen Profils.
 */
export type CompanyProfileKpiScope = "global" | "de";
export type CompanyProfileKpi = {
  label: string;
  value: string;
  hint?: string;
  estimated?: boolean;
  scope?: CompanyProfileKpiScope;
  as_of?: string;
  source_url?: string;
  source_title?: string;
};
/**
 * "open" nennt, was auf genau dieser Karte offen blieb. Frueher stand das als
 * ein Satz unter dem ganzen Steckbrief ("Nicht belegt: Mediabudget,
 * Agenturbeziehungen, Personalwechsel") - dort war nicht erkennbar, welche
 * Karte gemeint ist, und der Satz las sich wie ein Mangel des ganzen Profils.
 */
export type CompanyProfileSection = { title: string; items: string[]; open?: string };
export type CompanyProfileSource = { title: string; uri: string };
export type CompanyProfileLogoSourceKind =
  | "official_media"
  | "official_structured_data"
  | "wikimedia_commons"
  | "worldvectorlogo";
export type CompanyProfileLogoFormat = "svg" | "png" | "webp" | "jpg";

export type CompanyProfile = {
  company: string;
  website: string | null;
  logo_url: string | null;
  logo_source_url: string | null;
  logo_source_kind: CompanyProfileLogoSourceKind | null;
  logo_format: CompanyProfileLogoFormat | null;
  headline: string | null;
  kpis: CompanyProfileKpi[];
  sections: CompanyProfileSection[];
  sources: CompanyProfileSource[];
  unverified_note: string | null;
};

export type CompanyArticleHint = {
  title: string | null;
  url: string | null;
  published_at: string | null;
  source_company: string | null;
};

function clean(value: unknown, max = 400): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function buildCompanyProfilePrompt(
  company: string,
  rootsPortfolio: string,
  articles: CompanyArticleHint[],
  // Ohne das heutige Datum kann das Modell nicht beurteilen, ob ein gefundener
  // Stand der aktuellste ist: sein Trainingswissen endet frueher als die Suche
  // reicht, und es gibt dann bevorzugt das Jahr aus, das es kennt.
  today: string = new Date().toISOString().slice(0, 10),
): string {
  const historie = articles.length
    ? articles.slice(0, 10).map((a) =>
      `- ${clean(a.published_at).slice(0, 10)} · ${clean(a.source_company) || "Quelle unbekannt"} · ${clean(a.title, 160)}`
    ).join("\n")
    : "(keine gespeicherten Artikel zu diesem Unternehmen)";

  return `Du erstellst ein Account-Profil für den Vertrieb einer Markenberatung.

UNTERNEHMEN: ${company}
HEUTIGES DATUM: ${today}

RECHERCHIERE mit der Google-Suche und stütze jede Zahl auf eine Quelle.

SUCHBUDGET: höchstens 8 Suchanfragen für das ganze Profil. Jede Suche kostet.
Bündele deshalb, statt jede Angabe einzeln zu suchen: eine gute Anfrage nach
Geschäftszahlen liefert Umsatz, Mitarbeitende und Märkte auf einmal, eine nach
Strategie liefert Ausrichtung, Markenportfolio und laufende Umbauten. Was eine
Unternehmensseite oder ein Geschäftsbericht bereits belegt, suchst du nicht
erneut. Was du innerhalb des Budgets nicht belegen kannst, lässt du weg oder
kennzeichnest es als Schätzung.

TRENNE KONZERN UND DEUTSCHLAND, aber nur wo sich die Zahl wirklich
unterscheidet: Umsatz, Wachstum, Mitarbeitende, Märkte, Marktanteil. Anteile und
Quoten wie der Eigenmarkenanteil brauchen keine zweite Ebene. Mische die Ebenen
niemals in einer Zahl - ein Konzernumsatz neben einer Landesmitarbeiterzahl ist
der schwerste Fehler in diesem Profil. Bringt eine zweite Ebene keinen neuen
Beleg, lässt du sie weg statt für sie zu suchen.

RECHERCHIERE AUSSERDEM DAS AKTUELLE UNTERNEHMENSLOGO. Nutze diese Quellen in
genau dieser Priorität:
A. Worldvectorlogo: exakte Unternehmensseite plus direkte SVG-Datei von
   cdn.worldvectorlogo.com,
B. offizielle Presse-, Brand-, Media- oder Download-Seite des Unternehmens,
C. das Organization.logo der offiziellen Website,
D. die Dateiseite auf Wikimedia Commons, wenn dort die aktuelle Identität und
   Herkunft eindeutig belegt sind.
Verwechsle Mutterkonzern, Marke und ähnlich benannte Unternehmen niemals.
Bevorzuge eine direkte, transparente SVG-Datei, sonst PNG oder WebP. Gib neben
der direkten Bilddatei immer die Herkunftsseite an. Nimm niemals Favicons,
Google-Ergebnislinks, ZIP/PDF-Dateien, Social-Media-Bilder, andere
Logo-Aggregatoren oder ein Produkt-/Shop-Logo, wenn das Profil den Mutterkonzern
meint. Wenn die aktuelle Identität nicht sicher belegt ist, lasse alle
Logo-Felder leer.

WAS DIE BERATUNG ANBIETET (für die Karte "Themen zur Ansprache"):
${rootsPortfolio || "Markenstrategie, Markenarchitektur, Design-to-Print, Customer Insights"}

SIGNALE AUS DEM EIGENEN ARTIKELBESTAND zu diesem Unternehmen, nur als Kontext -
der aktuelle Anlass kommt aus dem Artikel und wird separat eingesetzt:
${historie}

ANTWORTE AUSSCHLIESSLICH MIT JSON in genau dieser Form, ohne Text davor oder
danach, ohne Code-Zäune:

{
  "website": "hauptdomain.de",
  "logo_url": "https://.../aktuelles-logo.svg",
  "logo_source_url": "https://.../presse-oder-dateiseite",
  "logo_source_kind": "official_media | official_structured_data | wikimedia_commons | worldvectorlogo",
  "logo_format": "svg | png | webp | jpg",
  "headline": "Branche · Kurzcharakterisierung in maximal 8 Wörtern",
  "kpis": [
    {"label": "Umsatz", "value": "8,9 Mrd. €", "scope": "global", "as_of": "GJ 2025", "hint": "Konzern, brutto", "estimated": false, "source_url": "https://www.beispiel.de/geschaeftsbericht", "source_title": "beispiel.de"},
    {"label": "Mitarbeitende", "value": "50.000", "scope": "de", "as_of": "2025", "hint": "nur Deutschlandgeschäft", "estimated": false, "source_url": "https://www.beispiel.de/ueber-uns", "source_title": "beispiel.de"},
    {"label": "Marketingbudget", "value": "ca. 120 Mio. €", "scope": "de", "as_of": "2025", "hint": "geschätzt aus Branchenanteil 3-5% vom Umsatz", "estimated": true}
  ],
  "sections": [
    {"title": "Allgemeine Unternehmensdaten", "items": ["Hauptsitz: ...", "Gegründet: ..."], "open": "Mediabudget nicht belegt"}
  ]
}

REGELN, sie entscheiden über die Brauchbarkeit:
1. Sechs Einträge in "kpis" für die Hauptebene des Unternehmens, dazu nur die
   Kennzahlen der zweiten Ebene, die du ohne zusätzliche Suche belegen konntest -
   höchstens 12 zusammen. Hat das Unternehmen kein nennenswertes
   Deutschlandgeschäft, lieferst du nur "global"; ist es rein deutsch, nur "de".
   Jeder Eintrag mit kurzem "value",
   der als große Zahl lesbar ist. Konntest du eine Zahl per Suche belegen, setze
   "estimated": false. Findest du sie nicht, gib eine begründete Schätzung, setze
   "estimated": true und schreibe in "hint" in maximal 12 Wörtern,
   worauf die Schätzung beruht (Bezugsgröße, Branchenanteil,
   Vergleichsunternehmen, Vorjahr). Eine Schätzung ohne nachvollziehbare Grundlage lässt du weg.
   Kennzeichne sie im "value" zusätzlich mit "ca.".
1c. Nimm für jede Kennzahl den zuletzt veröffentlichten Stand. Suche dafür
   ausdrücklich nach dem laufenden und dem vorangegangenen Jahr, bevor du einen
   älteren Wert übernimmst. Gibt es für das jüngste Geschäftsjahr noch keine
   Zahl, nimm die letzte belegte und schreibe ihr Jahr in "as_of" - erfinde
   niemals eine Fortschreibung auf das laufende Jahr.
1a. "label" enthält weder Ebene noch Jahr - die stehen in "scope" und "as_of".
   Also "Umsatz", nicht "Umsatz GJ 2024 (weltweit)". In "as_of" steht der
   Stichtag oder das Geschäftsjahr, auf das sich der Wert bezieht, zum Beispiel
   "GJ 2024" oder "Q1 2026". Ohne belegten Stichtag lässt du "as_of" leer.
1b. Jede nicht geschätzte Kennzahl bekommt in "source_url" die vollständige
   Adresse der Seite, auf der genau dieser Wert steht, und in "source_title"
   deren Domain. Kein Google-Ergebnislink, keine Weiterleitung. Nicht zulässig
   als Beleg für Zahlen sind Foren, Bewertungs- und Social-Plattformen
   (reddit, kununu, gutefrage, facebook, instagram, tiktok, x.com, quora,
   pinterest, youtube). Findest du für eine Zahl nur solche Seiten, gilt sie als
   nicht belegt: entweder weglassen oder als Schätzung kennzeichnen.
2. Genau diese 5 Abschnitte in "sections", in dieser Reihenfolge, jeder mit 3 bis
   5 Einträgen, jeder Eintrag maximal 20 Wörter: ${COMPANY_PROFILE_SECTIONS.join(" | ")}
3. Bei "Buying Center / Relevante Personen": Name, Rolle, und wenn belegbar seit
   wann. Nur real belegte Personen. Keine erfundenen Namen, kein "vermutlich".
4. Ein Logo ist nur gültig, wenn "logo_url" direkt eine öffentliche Bilddatei
   lädt und "logo_source_url" die überprüfbare Herkunftsseite ist. Die angegebene
   Quelle und Datei müssen zum aktuellen Unternehmen passen. Bei Worldvectorlogo
   müssen Seiten- und SVG-Slug den exakten Unternehmensnamen eindeutig abbilden.
5. In "sections" stehen nur belegte Angaben. Eine geschätzte Zahl gehört
   ausschliesslich in "kpis", dort mit "estimated": true. Erfinde niemals eine
   Quelle.
5a. Konntest du auf einer Karte etwas Naheliegendes nicht belegen - etwa
   Agenturbeziehungen oder Personalwechsel - schreibst du es in "open" dieser
   Karte, in maximal 12 Wörtern und ohne ganzen Satz, zum Beispiel
   "Agenturbeziehungen und Personalwechsel nicht belegt". Ist auf einer Karte
   nichts offen, lässt du "open" weg. Kein Sammelhinweis über das ganze Profil.
6. Deutsch, knapp, keine Werbesprache. Kein Satz, der nur Offensichtliches sagt.
7. Keine Zeilenumbrueche innerhalb der Zeichenketten - jeder Eintrag ist eine Zeile.`;
}

/**
 * Steuerzeichen innerhalb von Zeichenketten maskieren. Gemini setzt in
 * Grounding-Antworten echte Zeilenumbrueche in Werte, was ungueltiges JSON
 * ergibt - beobachtet am 4.8.2026: "Bad control character in string literal at
 * position 381". Ein Ersetzen ueber den ganzen Text wuerde die Formatierung
 * zwischen den Feldern zerstoeren, deshalb wird der Zustand mitgefuehrt.
 */
function escapeControlCharsInStrings(raw: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const char of raw) {
    if (escaped) { out += char; escaped = false; continue; }
    if (char === "\\" && inString) { out += char; escaped = true; continue; }
    if (char === '"') { inString = !inString; out += char; continue; }
    if (inString && char < " ") {
      out += char === "\n" ? "\\n" : char === "\r" ? "\\r" : char === "\t" ? "\\t" : " ";
      continue;
    }
    out += char;
  }
  return out;
}

/** Toleranter JSON-Auszug: Grounding-Antworten kommen oft mit Rahmen-Text. */
function extractJson(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no json object in company profile answer");
  const slice = stripped.slice(start, end + 1);
  const attempts: Array<(value: string) => string> = [
    (value) => value,
    escapeControlCharsInStrings,
    // Letzte Stufe ohne Zustand: jedes Steuerzeichen wird zum Leerzeichen. Das
    // ist ausserhalb von Zeichenketten gueltiger Zwischenraum und innerhalb
    // gueltiger Inhalt, kann also nicht aus dem Takt geraten - anders als die
    // Zustandsverfolgung, die ein unmaskiertes Anfuehrungszeichen im Text
    // aushebelt (beobachtet 4.8.2026, Position 1193).
    (value) => value.replace(/[\u0000-\u001F]/g, " "),
  ];
  let lastError: unknown = null;
  for (const repair of attempts) {
    try {
      return JSON.parse(repair(slice));
    } catch (error) {
      lastError = error;
    }
  }
  console.error("Steckbrief-JSON unlesbar, Anfang der Antwort:", slice.slice(0, 400));
  throw lastError instanceof Error ? lastError : new Error("company profile json unreadable");
}

/**
 * Seiten, die als Beleg fuer eine Kennzahl nicht taugen. Gemini hat fuer Aldi
 * Sued unter anderem reddit.com und kununu.com als Quelle gefuehrt; fuer Umsatz
 * und Mitarbeitendenzahl ist das nicht zitierfaehig. Die Seite bleibt in der
 * allgemeinen Quellenzeile, aber nicht als Beleg an der Zahl.
 */
const KPI_SOURCE_BLOCKLIST = [
  "reddit.com",
  "kununu.com",
  "gutefrage.net",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "x.com",
  "twitter.com",
  "quora.com",
  "pinterest.de",
  "pinterest.com",
  "youtube.com",
];

/** Nur direkte, oeffentliche Seiten zaehlen als Beleg - keine Weiterleitung. */
function acceptableKpiSource(raw: unknown): string {
  const value = clean(raw, 400);
  if (!/^https?:\/\//i.test(value)) return "";
  let host = "";
  try {
    host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
  if (!host) return "";
  if (host.endsWith("vertexaisearch.cloud.google.com") || host.endsWith("google.com")) return "";
  if (KPI_SOURCE_BLOCKLIST.some((bad) => host === bad || host.endsWith(`.${bad}`))) return "";
  return value;
}

function normalizeKpiScope(raw: unknown): CompanyProfileKpiScope | undefined {
  const value = clean(raw, 20).toLowerCase();
  if (value === "de" || value === "deutschland" || value === "germany") return "de";
  if (value === "global" || value === "weltweit" || value === "world" || value === "konzern") return "global";
  return undefined;
}

function normalizeKpis(raw: unknown): CompanyProfileKpi[] {
  if (!Array.isArray(raw)) return [];
  // Je Ebene sechs Kacheln, damit eine ueberlange Antwort das Raster nicht
  // sprengt und keine Ebene die andere verdraengt.
  const perScope = new Map<string, number>();
  const out: CompanyProfileKpi[] = [];
  for (const entry of raw) {
    const item = entry as Record<string, unknown>;
    const label = clean(item.label, 60);
    const value = clean(item.value, 40);
    if (!label || !value) continue;
    const scope = normalizeKpiScope(item.scope);
    const bucket = scope || "none";
    const used = perScope.get(bucket) || 0;
    if (used >= 6) continue;
    perScope.set(bucket, used + 1);
    const sourceUrl = acceptableKpiSource(item.source_url);
    out.push({
      label,
      value,
      hint: clean(item.hint, 80) || undefined,
      // Markierung immer mitnehmen, auch wenn das Modell die Grundlage in
      // "hint" schuldig bleibt: eine unmarkierte Schaetzung waere schlimmer als
      // eine Schaetzung ohne Begruendung.
      estimated: item.estimated === true ? true : undefined,
      scope,
      as_of: clean(item.as_of, 40) || undefined,
      source_url: sourceUrl || undefined,
      source_title: sourceUrl ? (clean(item.source_title, 60) || new URL(sourceUrl).hostname.replace(/^www\./, "")) : undefined,
    });
    if (out.length >= 12) break;
  }
  return out;
}

function normalizeSections(raw: unknown): CompanyProfileSection[] {
  if (!Array.isArray(raw)) return [];
  const byTitle = new Map<string, { items: string[]; open?: string }>();
  for (const entry of raw) {
    const item = entry as Record<string, unknown>;
    const title = clean(item.title, 80);
    const items = Array.isArray(item.items)
      ? item.items.map((line) => clean(line, 320)).filter(Boolean).slice(0, 8)
      : [];
    if (title && items.length) byTitle.set(title, { items, open: clean(item.open, 120) || undefined });
  }
  // Reihenfolge erzwingen, damit die Ansicht nicht vom Modell abhaengt.
  const ordered: CompanyProfileSection[] = [];
  for (const wanted of COMPANY_PROFILE_SECTIONS) {
    const match = [...byTitle.keys()].find((key) =>
      key.toLowerCase().startsWith(wanted.toLowerCase().slice(0, 12))
    );
    if (match) {
      const treffer = byTitle.get(match)!;
      ordered.push({ title: wanted, items: treffer.items, open: treffer.open });
      byTitle.delete(match);
    }
  }
  // Zusätzliche Modellkarten werden nicht übernommen. Insbesondere darf ein
  // recherchierter Abschnitt "Trigger & Aufhänger" nie neben dem individuellen
  // Artikel-Trigger erscheinen.
  return ordered;
}

const LOGO_KINDS = new Set<CompanyProfileLogoSourceKind>([
  "official_media", "official_structured_data", "wikimedia_commons", "worldvectorlogo",
]);
const LOGO_FORMATS = new Set<CompanyProfileLogoFormat>(["svg", "png", "webp", "jpg"]);
const BLOCKED_LOGO_HOST_PARTS = [
  "google.com", "gstatic.com", "clearbit.com", "brandfetch.io", "logo.dev",
  "seeklogo.com", "logos-world.net", "freepik.com", "vectorlogo.zone",
];

function safeHttpsUrl(value: unknown): URL | null {
  try {
    const url = new URL(String(value ?? "").trim());
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" ||
      host.startsWith("10.") || host.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return null;
    return url;
  } catch {
    return null;
  }
}

function websiteHost(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return safeHttpsUrl(/^https:\/\//i.test(raw) ? raw : `https://${raw}`)?.hostname.replace(/^www\./, "") || "";
}

function sameDomain(a: string, b: string): boolean {
  const left = a.replace(/^www\./, "").toLowerCase();
  const right = b.replace(/^www\./, "").toLowerCase();
  return Boolean(left && right && (left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`)));
}

function logoKind(value: unknown): CompanyProfileLogoSourceKind | null {
  const normalized = clean(value, 40) as CompanyProfileLogoSourceKind;
  return LOGO_KINDS.has(normalized) ? normalized : null;
}

function declaredLogoFormat(value: unknown): CompanyProfileLogoFormat | null {
  const normalized = clean(value, 10).toLowerCase().replace("jpeg", "jpg") as CompanyProfileLogoFormat;
  return LOGO_FORMATS.has(normalized) ? normalized : null;
}

type VerifiedLogo = {
  logo_url: string;
  logo_source_url: string;
  logo_source_kind: CompanyProfileLogoSourceKind;
  logo_format: CompanyProfileLogoFormat;
};

const GENERIC_COMPANY_WORDS = new Set([
  "ag", "co", "company", "corporation", "deutschland", "gmbh", "group",
  "gruppe", "holding", "inc", "incorporated", "kg", "markt", "plc", "se",
]);

const GENERIC_LOGO_TITLE_WORDS = new Set([
  ...GENERIC_COMPANY_WORDS,
  "aktuell", "current", "datei", "file", "jpeg", "jpg", "logo", "new", "neu", "official", "png", "svg", "webp",
]);

function brandLogoWords(value: string, dropLogoWord = false): string[] {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g, " und ").split(/[^a-z0-9]+/)
    .filter((word) => word && !GENERIC_COMPANY_WORDS.has(word) && (!dropLogoWord || word !== "logo"));
}

function brandLogoKey(value: string, dropLogoWord = false): string {
  return brandLogoWords(value, dropLogoWord).join("");
}

function commonsLogoTitleKey(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g, " und ").split(/[^a-z0-9]+/)
    .filter((word) => word && !/^\d{2,4}$/.test(word) && !GENERIC_LOGO_TITLE_WORDS.has(word))
    .join("");
}

export function commonsLogoTitleMatchesCompany(company: string, title: string): boolean {
  const companyKey = brandLogoKey(company);
  return companyKey.length >= 3 && commonsLogoTitleKey(title) === companyKey;
}

export function worldVectorLogoMatchesCompany(company: string, source: URL, asset: URL): boolean {
  const companyKey = brandLogoKey(company);
  if (companyKey.length < 3) return false;
  const sourceSlug = decodeURIComponent(source.pathname.split("/").filter(Boolean).pop() || "");
  const assetSlug = decodeURIComponent(asset.pathname.split("/").pop() || "").replace(/\.[a-z0-9]+$/i, "");
  const matches = (slug: string) => {
    const key = brandLogoKey(slug, true);
    if (key.length < 3) return false;
    return key === companyKey || key.startsWith(companyKey) || companyKey.startsWith(key);
  };
  return matches(sourceSlug) && matches(assetSlug);
}

/**
 * Das Modell darf eine Quelle vorschlagen, aber nur der Server entscheidet, ob
 * sie gespeichert wird. So landen weder erfundene Links noch HTML-Seiten,
 * Favicons oder Logo-Farmen im Steckbrief.
 */
async function verifyLogoCandidate(company: string, parsed: Record<string, unknown>): Promise<VerifiedLogo | null> {
  const source = safeHttpsUrl(parsed.logo_source_url);
  const kind = logoKind(parsed.logo_source_kind);
  if (!source || !kind) return null;

  // WorldVectorLogo schützt seine Suchseite teilweise per Cloudflare. Die
  // öffentliche SVG-CDN folgt jedoch dem dokumentierten Seiten-Slug. Wenn das
  // Modell die exakte Unternehmensseite belegt, darf der Server deshalb den
  // Direktlink deterministisch bilden und anschließend wie jeden anderen
  // Kandidaten vollständig prüfen.
  const worldVectorSource = kind === "worldvectorlogo" &&
    ["worldvectorlogo.com", "www.worldvectorlogo.com"].includes(source.hostname);
  const worldVectorSlug = worldVectorSource
    ? decodeURIComponent(source.pathname.split("/").filter(Boolean).pop() || "")
    : "";
  const derivedWorldVectorAsset = worldVectorSlug
    ? safeHttpsUrl(`https://cdn.worldvectorlogo.com/logos/${encodeURIComponent(worldVectorSlug)}.svg`)
    : null;
  const asset = safeHttpsUrl(parsed.logo_url) || derivedWorldVectorAsset;
  const declared = declaredLogoFormat(parsed.logo_format) || (derivedWorldVectorAsset ? "svg" : null);
  if (!asset || !declared) return null;

  const assetHost = asset.hostname.toLowerCase();
  if (BLOCKED_LOGO_HOST_PARTS.some((part) => assetHost === part || assetHost.endsWith(`.${part}`))) return null;
  const officialHost = websiteHost(parsed.website);
  if (kind === "wikimedia_commons") {
    if (source.hostname !== "commons.wikimedia.org" || asset.hostname !== "upload.wikimedia.org") return null;
  } else if (kind === "worldvectorlogo") {
    if (!worldVectorSource ||
      asset.hostname !== "cdn.worldvectorlogo.com" ||
      !worldVectorLogoMatchesCompany(company, source, asset)) return null;
  } else if (!officialHost || !sameDomain(source.hostname, officialHost)) {
    return null;
  }

  let response: Response;
  try {
    response = await fetch(asset.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      headers: {
        "Accept": "image/svg+xml,image/png,image/webp,image/jpeg;q=0.9,*/*;q=0.2",
        "User-Agent": "ROOTS-Signal-Layer/1.0 (verified company logo)",
      },
    });
  } catch {
    return null;
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }
  const length = Number(response.headers.get("content-length") || 0);
  if (length > 2_500_000) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }
  const mime = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  let actual: CompanyProfileLogoFormat | null = mime === "image/svg+xml" ? "svg"
    : mime === "image/png" ? "png"
    : mime === "image/webp" ? "webp"
    : (mime === "image/jpeg" || mime === "image/jpg") ? "jpg" : null;

  if (actual === "svg" || (!actual && asset.pathname.toLowerCase().endsWith(".svg"))) {
    const body = (await response.text()).slice(0, 200_000).replace(/^\uFEFF/, "").trimStart();
    if (!/(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(body)) return null;
    actual = "svg";
  } else {
    await response.body?.cancel().catch(() => undefined);
  }
  if (!actual || actual !== declared) return null;
  return {
    logo_url: response.url || asset.toString(),
    logo_source_url: source.toString(),
    logo_source_kind: kind,
    logo_format: actual,
  };
}

type CommonsPage = {
  title?: string;
  imageinfo?: Array<{ url?: string; mime?: string }>;
};

/**
 * Kostenlose, deterministische Logo-Suche. Es wird nur ein Commons-Dateiname
 * akzeptiert, dessen bereinigte Wörter exakt dem Unternehmensnamen entsprechen.
 * Dadurch fallen Untermarken wie "REWE To Go" oder "Henkel Loctite" heraus.
 */
export async function researchWikimediaLogo(company: string): Promise<VerifiedLogo | null> {
  const searchName = brandLogoWords(company).join(" ") || company;
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `${searchName} logo`,
    gsrnamespace: "6",
    gsrlimit: "12",
    prop: "imageinfo",
    iiprop: "url|mime",
    format: "json",
    origin: "*",
  });
  let response: Response;
  try {
    response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      signal: AbortSignal.timeout(12_000),
      headers: {
        "Accept": "application/json",
        "User-Agent": "ROOTS-Signal-Layer/1.0 (verified company logo; hello@roots-consultants.com)",
      },
    });
  } catch {
    return null;
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }
  const payload = await response.json() as { query?: { pages?: Record<string, CommonsPage> } };
  const candidates = Object.values(payload.query?.pages || {})
    .filter((page) => commonsLogoTitleMatchesCompany(company, String(page.title || "")))
    .map((page) => {
      const info = page.imageinfo?.[0];
      const mime = String(info?.mime || "").toLowerCase();
      const format: CompanyProfileLogoFormat | null = mime === "image/svg+xml" ? "svg"
        : mime === "image/png" ? "png"
        : mime === "image/webp" ? "webp"
        : mime === "image/jpeg" ? "jpg" : null;
      return { page, info, format, score: format === "svg" ? 2 : format ? 1 : 0 };
    })
    .filter((entry) => entry.format && entry.info?.url)
    .sort((a, b) => b.score - a.score);

  for (const candidate of candidates) {
    const title = String(candidate.page.title || "").replace(/ /g, "_");
    const verified = await verifyLogoCandidate(company, {
      logo_url: candidate.info?.url,
      logo_source_url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
      logo_source_kind: "wikimedia_commons",
      logo_format: candidate.format,
    });
    if (verified) return verified;
  }
  return null;
}

/**
 * Belege aus groundingMetadata. Google liefert Weiterleitungen ueber
 * vertexaisearch statt Direktlinks; der Anzeigename ist die Domain, deshalb
 * bleibt title die brauchbare Angabe fuer die Quellenzeile.
 */
function extractSources(candidate: Record<string, unknown>): CompanyProfileSource[] {
  const meta = candidate.groundingMetadata as Record<string, unknown> | undefined;
  const chunks = Array.isArray(meta?.groundingChunks) ? meta!.groundingChunks as unknown[] : [];
  const seen = new Set<string>();
  const out: CompanyProfileSource[] = [];
  for (const chunk of chunks) {
    const web = (chunk as Record<string, unknown>).web as Record<string, unknown> | undefined;
    const title = clean(web?.title, 80);
    const uri = String(web?.uri ?? "");
    if (!title || seen.has(title)) continue;
    seen.add(title);
    out.push({ title, uri });
    if (out.length >= 12) break;
  }
  return out;
}

/**
 * Google liefert Belege nur als Weiterleitung ueber vertexaisearch. Diese Links
 * sind zeitlich begrenzt gueltig - ein Steckbrief von heute zeigt in einigen
 * Wochen ins Leere. Deshalb wird die Weiterleitung einmal beim Speichern
 * aufgeloest und das Ziel abgelegt. Schlaegt das fehl, bleibt die Weiterleitung
 * stehen: ein Link, der vielleicht noch geht, ist besser als keiner.
 */
async function resolveGroundingUri(uri: string): Promise<string> {
  if (!/^https?:\/\/[^/]*vertexaisearch\.cloud\.google\.com\//i.test(uri)) return uri;
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), 6000);
  try {
    const response = await fetch(uri, { redirect: "follow", signal: control.signal });
    // Der Rumpf wird nicht gebraucht, muss aber verworfen werden, damit die
    // Verbindung nicht offen bleibt.
    await response.body?.cancel();
    const target = String(response.url || "");
    return /^https?:\/\//i.test(target) && !target.includes("vertexaisearch.cloud.google.com") ? target : uri;
  } catch {
    return uri;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveSourceUris(sources: CompanyProfileSource[]): Promise<CompanyProfileSource[]> {
  return await Promise.all(sources.map(async (source) => ({
    ...source,
    uri: source.uri ? await resolveGroundingUri(source.uri) : source.uri,
  })));
}

function groundingSearchCount(candidate: Record<string, unknown>): number {
  const meta = candidate.groundingMetadata as Record<string, unknown> | undefined;
  const queries = Array.isArray(meta?.webSearchQueries) ? meta!.webSearchQueries as unknown[] : [];
  if (queries.length) return queries.length;
  return Array.isArray(meta?.groundingChunks) && meta!.groundingChunks.length ? 1 : 0;
}

export type CompanyProfileDeps = {
  apiKey: string;
  model?: string;
  rootsPortfolio: string;
};

export async function researchCompanyLogo(
  deps: Pick<CompanyProfileDeps, "apiKey" | "model">,
  company: string,
): Promise<{ logo: VerifiedLogo | null; usage: Record<string, number> }> {
  const model = deps.model || COMPANY_PROFILE_MODEL;
  const prompt = `Recherchiere das aktuelle Unternehmenslogo für exakt dieses Unternehmen: ${company}.

Priorität: 1. exakte Worldvectorlogo-Unternehmensseite mit direkter SVG-Datei
von cdn.worldvectorlogo.com, 2. offizielle Presse-/Brand-Seite,
3. Organization.logo der offiziellen Website, 4. Wikimedia Commons.
Verwechsle Mutterkonzern, Marke und ähnlich benannte Unternehmen niemals.
Bei Worldvectorlogo ist die exakte Seite /de/logo/{slug} der notwendige Beleg.
Wenn der direkte CDN-Link in der Suche nicht sichtbar ist, gib trotzdem diese
Seite, source_kind "worldvectorlogo" und logo_format "svg" zurück; der Server
bildet und validiert die SVG-Adresse anschließend selbst.

Antworte ausschließlich als JSON:
{"website":"hauptdomain.de","logo_url":"https://...","logo_source_url":"https://...","logo_source_kind":"official_media | official_structured_data | wikimedia_commons | worldvectorlogo","logo_format":"svg | png | webp | jpg"}

Wenn kein aktuelles Logo eindeutig belegt ist, setze alle Logo-Felder auf null.`;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(deps.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0, maxOutputTokens: 1_200 },
      }),
    },
  );
  if (!response.ok) throw new Error(`gemini logo grounding failed (${response.status})`);
  const payload = await response.json() as Record<string, unknown>;
  const candidate = (Array.isArray(payload.candidates) ? payload.candidates[0] : null) as Record<string, unknown> | null;
  if (!candidate) throw new Error("gemini logo grounding returned no candidate");
  const finish = String(candidate.finishReason ?? "");
  if (finish && finish !== "STOP") throw new Error(`gemini logo grounding endete mit ${finish}`);
  const parts = ((candidate.content as Record<string, unknown> | undefined)?.parts ?? []) as Array<Record<string, unknown>>;
  const parsed = extractJson(parts.map((part) => String(part.text ?? "")).join("\n")) as Record<string, unknown>;
  const usageMeta = (payload.usageMetadata ?? {}) as Record<string, number>;
  return {
    logo: await verifyLogoCandidate(company, parsed),
    usage: {
      prompt_tokens: Number(usageMeta.promptTokenCount || 0),
      cached_input_tokens: Number(usageMeta.cachedContentTokenCount || 0),
      output_tokens: Number(usageMeta.candidatesTokenCount || 0),
      thinking_tokens: Number(usageMeta.thoughtsTokenCount || 0),
      total_tokens: Number(usageMeta.totalTokenCount || 0),
      search_queries: groundingSearchCount(candidate),
    },
  };
}

export async function researchCompanyProfile(
  deps: CompanyProfileDeps,
  company: string,
  articles: CompanyArticleHint[],
): Promise<{ profile: CompanyProfile; usage: Record<string, number> }> {
  const model = deps.model || COMPANY_PROFILE_MODEL;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(deps.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildCompanyProfilePrompt(company, deps.rootsPortfolio, articles) }] }],
        // Grounding laesst sich nicht mit responseSchema verbinden, deshalb wird
        // das JSON im Prompt verlangt und tolerant ausgelesen.
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2, maxOutputTokens: COMPANY_PROFILE_MAX_OUTPUT_TOKENS },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`gemini grounding failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }

  const payload = await response.json() as Record<string, unknown>;
  const candidate = (Array.isArray(payload.candidates) ? payload.candidates[0] : null) as Record<string, unknown> | null;
  if (!candidate) throw new Error("gemini grounding returned no candidate");

  const finish = String(candidate.finishReason ?? "");
  if (finish && finish !== "STOP") {
    // MAX_TOKENS liefert abgeschnittenes JSON und damit einen irrefuehrenden
    // Parser-Fehler. Beobachtet 4.8.2026 bei 4096 Token Ausgabegrenze.
    throw new Error(`gemini grounding endete mit ${finish}, Antwort unvollstaendig`);
  }
  const parts = ((candidate.content as Record<string, unknown> | undefined)?.parts ?? []) as Array<Record<string, unknown>>;
  const text = parts.map((part) => String(part.text ?? "")).join("\n");
  const parsed = extractJson(text) as Record<string, unknown>;
  const verifiedLogo = await verifyLogoCandidate(company, parsed);

  const usageMeta = (payload.usageMetadata ?? {}) as Record<string, number>;
  return {
    profile: {
      company,
      website: clean(parsed.website, 120) || null,
      logo_url: verifiedLogo?.logo_url || null,
      logo_source_url: verifiedLogo?.logo_source_url || null,
      logo_source_kind: verifiedLogo?.logo_source_kind || null,
      logo_format: verifiedLogo?.logo_format || null,
      headline: clean(parsed.headline, 160) || null,
      kpis: normalizeKpis(parsed.kpis),
      sections: normalizeSections(parsed.sections),
      sources: await resolveSourceUris(extractSources(candidate)),
      unverified_note: clean(parsed.unverified_note, 400) || null,
    },
    usage: {
      prompt_tokens: Number(usageMeta.promptTokenCount || 0),
      cached_input_tokens: Number(usageMeta.cachedContentTokenCount || 0),
      output_tokens: Number(usageMeta.candidatesTokenCount || 0),
      thinking_tokens: Number(usageMeta.thoughtsTokenCount || 0),
      total_tokens: Number(usageMeta.totalTokenCount || 0),
      search_queries: groundingSearchCount(candidate),
    },
  };
}

/**
 * Nachtrag statt Neurecherche.
 *
 * Bestehende Steckbriefe tragen brauchbare Zahlen, aber ohne Ebene, ohne
 * Stichtag und ohne Beleg an der einzelnen Kennzahl - die Felder gab es beim
 * Anlegen noch nicht. Ein vollstaendiger neuer Lauf kostet rund 8 Suchanfragen
 * und wuerde dieselben Karten noch einmal schreiben. Dieser Aufruf ordnet nur
 * die vorhandenen Werte ein: er darf sie belegen, ihre Ebene und ihren Stichtag
 * benennen und einen nachweislich falschen Wert korrigieren, aber keine neuen
 * Kennzahlen erfinden und keine Abschnitte anfassen.
 */
export function buildCompanyKpiEnrichPrompt(
  company: string,
  kpis: CompanyProfileKpi[],
  today: string = new Date().toISOString().slice(0, 10),
): string {
  const liste = kpis.map((kpi, index) =>
    `${index + 1}. label: "${kpi.label}" | value: "${kpi.value}"${kpi.hint ? ` | hint: "${kpi.hint}"` : ""}${kpi.estimated ? " | geschaetzt" : ""}`
  ).join("\n");
  return `Du ordnest vorhandene Kennzahlen eines Unternehmensprofils ein.

UNTERNEHMEN: ${company}
HEUTIGES DATUM: ${today}

VORHANDENE KENNZAHLEN:
${liste}

AUFGABE: Belege jede dieser Kennzahlen mit der Google-Suche und ergaenze Ebene,
Stichtag und Quelle. Recherchiere keine zusaetzlichen Kennzahlen.

SUCHBUDGET: hoechstens 3 Suchanfragen. Eine Anfrage nach den Geschaeftszahlen
des Unternehmens belegt in der Regel mehrere dieser Werte auf einmal.

REGELN:
1. "scope" ist "global" fuer eine Konzernzahl weltweit und "de" fuer das
   Deutschlandgeschaeft. Steht die Ebene bereits im label oder hint, uebernimm
   sie von dort, ohne dafuer zu suchen. Bleibt sie unklar, lass "scope" leer.
2. "as_of" ist das Geschaeftsjahr oder der Stichtag des Wertes, zum Beispiel
   "GJ 2024". Steht ein Jahr im label, uebernimm es. Sonst leer lassen.
3. "label" enthaelt danach weder Ebene noch Jahr: aus
   "Umsatz GJ 2024 (weltweit)" wird "Umsatz".
4. "value" bleibt unveraendert. Einzige Ausnahme: die Suche belegt eindeutig,
   dass der Wert falsch oder veraltet ist - dann korrigierst du ihn und setzt
   "corrected": true. Im Zweifel bleibt der alte Wert stehen.
5. "source_url" ist die Seite, auf der genau dieser Wert steht, "source_title"
   deren Domain. Foren, Bewertungs- und Social-Plattformen (reddit, kununu,
   gutefrage, facebook, instagram, tiktok, x.com, quora, pinterest, youtube)
   gelten nicht als Beleg. Findest du keinen brauchbaren Beleg, laesst du beide
   Felder leer - erfinde niemals eine Quelle.
6. "estimated" bleibt, wie es war, ausser die Suche belegt den Wert: dann faellt
   die Markierung weg.

ANTWORTE AUSSCHLIESSLICH MIT JSON, ohne Text davor oder danach, ohne Code-Zaeune,
mit genau so vielen Eintraegen wie oben, in derselben Reihenfolge:

{"kpis": [{"label": "Umsatz", "value": "8,9 Mrd. €", "hint": "Konzern, brutto", "scope": "global", "as_of": "GJ 2024", "estimated": false, "corrected": false, "source_url": "https://...", "source_title": "beispiel.de"}]}`;
}

export async function enrichCompanyProfileKpis(
  deps: Pick<CompanyProfileDeps, "apiKey" | "model">,
  company: string,
  kpis: CompanyProfileKpi[],
): Promise<{ kpis: CompanyProfileKpi[]; sources: CompanyProfileSource[]; usage: Record<string, number> }> {
  if (!kpis.length) throw new Error("keine Kennzahlen zum Nachtragen");
  const model = deps.model || COMPANY_PROFILE_MODEL;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(deps.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildCompanyKpiEnrichPrompt(company, kpis) }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4_000 },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`gemini kpi enrich failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }
  const payload = await response.json() as Record<string, unknown>;
  const candidate = (Array.isArray(payload.candidates) ? payload.candidates[0] : null) as Record<string, unknown> | null;
  if (!candidate) throw new Error("gemini kpi enrich returned no candidate");
  const finish = String(candidate.finishReason ?? "");
  if (finish && finish !== "STOP") throw new Error(`gemini kpi enrich endete mit ${finish}`);
  const parts = ((candidate.content as Record<string, unknown> | undefined)?.parts ?? []) as Array<Record<string, unknown>>;
  const parsed = extractJson(parts.map((part) => String(part.text ?? "")).join("\n")) as Record<string, unknown>;
  const angereichert = normalizeKpis(parsed.kpis);
  // Eine Antwort, die Kennzahlen verliert, waere ein Rueckschritt gegenueber dem
  // gespeicherten Stand. Dann bleibt der alte Satz stehen.
  if (angereichert.length < kpis.length) {
    throw new Error(`kpi enrich lieferte ${angereichert.length} statt ${kpis.length} Kennzahlen`);
  }
  const usageMeta = (payload.usageMetadata ?? {}) as Record<string, number>;
  return {
    kpis: angereichert,
    sources: await resolveSourceUris(extractSources(candidate)),
    usage: {
      prompt_tokens: Number(usageMeta.promptTokenCount || 0),
      cached_input_tokens: Number(usageMeta.cachedContentTokenCount || 0),
      output_tokens: Number(usageMeta.candidatesTokenCount || 0),
      thinking_tokens: Number(usageMeta.thoughtsTokenCount || 0),
      total_tokens: Number(usageMeta.totalTokenCount || 0),
      search_queries: groundingSearchCount(candidate),
    },
  };
}

/** Ein Profil ist brauchbar, wenn es Kennzahlen, Karten und Belege hat. */
export function companyProfileIsUsable(profile: CompanyProfile): boolean {
  return profile.kpis.length >= 3 && profile.sections.length >= 3 && profile.sources.length >= 1;
}
