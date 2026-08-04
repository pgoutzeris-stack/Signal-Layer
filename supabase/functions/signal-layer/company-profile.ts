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
// Unternehmen mit Verfallsdatum, nicht ein Profil pro Artikel.

export const COMPANY_PROFILE_MODEL = "gemini-2.5-flash";
export const COMPANY_PROFILE_TTL_DAYS = 30;
/** Obergrenze je Verarbeitungspaket, damit ein Lauf nicht in Recherche umkippt. */
export const COMPANY_PROFILE_MAX_PER_BATCH = 2;
export const COMPANY_PROFILE_MAX_OUTPUT_TOKENS = 10_000;

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

export type CompanyProfileKpi = { label: string; value: string; hint?: string };
export type CompanyProfileSection = { title: string; items: string[] };
export type CompanyProfileSource = { title: string; uri: string };

export type CompanyProfile = {
  company: string;
  website: string | null;
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
): string {
  const historie = articles.length
    ? articles.slice(0, 10).map((a) =>
      `- ${clean(a.published_at).slice(0, 10)} · ${clean(a.source_company) || "Quelle unbekannt"} · ${clean(a.title, 160)}`
    ).join("\n")
    : "(keine gespeicherten Artikel zu diesem Unternehmen)";

  return `Du erstellst ein Account-Profil für den Vertrieb einer Markenberatung.

UNTERNEHMEN: ${company}

RECHERCHIERE mit der Google-Suche und stütze jede Zahl auf eine Quelle. Suche
gezielt nach: Umsatz und Wachstum im letzten Geschäftsjahr, Mitarbeitenden,
Hauptsitz, Anzahl Märkte, Marktanteil, Eigenmarkenanteil, Mediabudget,
Agenturbeziehungen, aktuelle Strategie, Markenportfolio, Personalwechsel im
Marketing und in der Markenführung, laufende Umbauten.

WAS DIE BERATUNG ANBIETET (für die Karte "Themen zur Ansprache"):
${rootsPortfolio || "Markenstrategie, Markenarchitektur, Design-to-Print, Customer Insights"}

SIGNALE AUS DEM EIGENEN ARTIKELBESTAND zu diesem Unternehmen, nur als Kontext -
der aktuelle Anlass kommt aus dem Artikel und wird separat eingesetzt:
${historie}

ANTWORTE AUSSCHLIESSLICH MIT JSON in genau dieser Form, ohne Text davor oder
danach, ohne Code-Zäune:

{
  "website": "hauptdomain.de",
  "headline": "Branche · Kurzcharakterisierung in maximal 8 Wörtern",
  "kpis": [
    {"label": "Umsatz GJ 2025", "value": "8,9 Mrd. €", "hint": "Konzern, brutto"}
  ],
  "sections": [
    {"title": "Allgemeine Unternehmensdaten", "items": ["Hauptsitz: ...", "Gegründet: ..."]}
  ],
  "unverified_note": "Was du NICHT belegen konntest, in einem Satz. Leer lassen, wenn alles belegt ist."
}

REGELN, sie entscheiden über die Brauchbarkeit:
1. Genau 6 Einträge in "kpis". Jeder mit kurzem "value", der als große Zahl
   lesbar ist. Fehlt eine Zahl belegbar, nimm eine andere Kennzahl statt zu raten.
2. Genau diese 5 Abschnitte in "sections", in dieser Reihenfolge, jeder mit 3 bis
   5 Einträgen, jeder Eintrag maximal 20 Wörter: ${COMPANY_PROFILE_SECTIONS.join(" | ")}
3. Bei "Buying Center / Relevante Personen": Name, Rolle, und wenn belegbar seit
   wann. Nur real belegte Personen. Keine erfundenen Namen, kein "vermutlich".
5. Jede Zahl, die du nicht per Suche belegen konntest, gehört nicht in "kpis" oder
   "sections", sondern in "unverified_note". Erfinde niemals eine Quelle.
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

function normalizeKpis(raw: unknown): CompanyProfileKpi[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 6).map((entry) => {
    const item = entry as Record<string, unknown>;
    return {
      label: clean(item.label, 60),
      value: clean(item.value, 40),
      hint: clean(item.hint, 80) || undefined,
    };
  }).filter((kpi) => kpi.label && kpi.value);
}

function normalizeSections(raw: unknown): CompanyProfileSection[] {
  if (!Array.isArray(raw)) return [];
  const byTitle = new Map<string, string[]>();
  for (const entry of raw) {
    const item = entry as Record<string, unknown>;
    const title = clean(item.title, 80);
    const items = Array.isArray(item.items)
      ? item.items.map((line) => clean(line, 320)).filter(Boolean).slice(0, 8)
      : [];
    if (title && items.length) byTitle.set(title, items);
  }
  // Reihenfolge erzwingen, damit die Ansicht nicht vom Modell abhaengt.
  const ordered: CompanyProfileSection[] = [];
  for (const wanted of COMPANY_PROFILE_SECTIONS) {
    const match = [...byTitle.keys()].find((key) =>
      key.toLowerCase().startsWith(wanted.toLowerCase().slice(0, 12))
    );
    if (match) {
      ordered.push({ title: wanted, items: byTitle.get(match)! });
      byTitle.delete(match);
    }
  }
  for (const [title, items] of byTitle) ordered.push({ title, items });
  return ordered;
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

export type CompanyProfileDeps = {
  apiKey: string;
  model?: string;
  rootsPortfolio: string;
};

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

  const usageMeta = (payload.usageMetadata ?? {}) as Record<string, number>;
  return {
    profile: {
      company,
      website: clean(parsed.website, 120) || null,
      headline: clean(parsed.headline, 160) || null,
      kpis: normalizeKpis(parsed.kpis),
      sections: normalizeSections(parsed.sections),
      sources: extractSources(candidate),
      unverified_note: clean(parsed.unverified_note, 400) || null,
    },
    usage: {
      prompt_tokens: Number(usageMeta.promptTokenCount || 0),
      output_tokens: Number(usageMeta.candidatesTokenCount || 0),
      total_tokens: Number(usageMeta.totalTokenCount || 0),
    },
  };
}

/** Ein Profil ist brauchbar, wenn es Kennzahlen, Karten und Belege hat. */
export function companyProfileIsUsable(profile: CompanyProfile): boolean {
  return profile.kpis.length >= 3 && profile.sections.length >= 3 && profile.sources.length >= 1;
}
