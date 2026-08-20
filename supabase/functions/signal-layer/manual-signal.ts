/**
 * Selbst entdecktes Signal. Die Pipeline findet Signale in Artikeln; hier
 * schreibt der Nutzer eines. Damit die bestehende Asset-Erzeugung unverändert
 * darauf laufen kann, wird aus seinen Angaben eine Artikelzeile mit Text und
 * eine bestätigte Signalzeile.
 *
 * Der Text ist zugleich der Belegkorpus: jede Zahl und jede Aussage im Asset
 * muss darin stehen. Wer nichts belegt, bekommt kein Asset mit Zahlen — das
 * ist dieselbe Regel wie bei einem gecrawlten Artikel, nur ist die Quelle
 * jetzt der Nutzer.
 */

export type ManualSignalLane = "marketing" | "sales";
export type ManualSignalMode = "ai" | "hybrid" | "manual";

export type ManualSignal = {
  lane: ManualSignalLane;
  mode: ManualSignalMode;
  headline: string;
  core: string;
  relevance: string;
  evidence: string;
  source: string;
  company: string;
  offering: string;
  signal_label: string;
  audience: string;
  territory: string;
  occasion: string;
  competitor: string;
  tone: string;
};

const GRENZEN: Record<keyof Omit<ManualSignal, "lane" | "mode">, number> = {
  headline: 200,
  core: 1_200,
  relevance: 800,
  evidence: 2_000,
  source: 300,
  company: 120,
  offering: 200,
  signal_label: 80,
  audience: 300,
  territory: 120,
  occasion: 300,
  competitor: 300,
  tone: 300,
};

function feld(raw: Record<string, unknown>, key: string, max: number): string {
  const wert = raw[key];
  return String(wert ?? "").replace(/\r/g, "").replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}

export function normalizeManualSignal(raw: unknown): ManualSignal {
  const quelle = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const laneRaw = String(quelle.lane ?? "").toLowerCase();
  const modeRaw = String(quelle.mode ?? "").toLowerCase();
  const werte = {} as ManualSignal;
  for (const [key, max] of Object.entries(GRENZEN)) {
    (werte as unknown as Record<string, string>)[key] = feld(quelle, key, max);
  }
  werte.lane = /sales|ansprache|memo/.test(laneRaw) ? "sales" : "marketing";
  werte.mode = modeRaw === "manual" ? "manual" : modeRaw === "hybrid" ? "hybrid" : "ai";
  return werte;
}

/** Ohne Überschrift, Kernaussage und Beleg ist es kein Signal, sondern eine Notiz. */
export function manualSignalIssue(signal: ManualSignal): string {
  if (signal.headline.length < 10) return "Die Überschrift des Signals fehlt oder ist zu kurz.";
  if (signal.core.length < 30) return "Der Kern des Signals fehlt oder ist zu kurz. Zwei bis drei Sätze, was das Signal besagt.";
  if (signal.evidence.length < 20) {
    return "Der Beleg fehlt. Ohne Beleg darf im Asset keine Zahl und keine Behauptung stehen: Zitat, Zahl oder Beobachtung eintragen.";
  }
  return "";
}

/**
 * Der Belegkorpus. Reihenfolge und Beschriftung sind bewusst wie ein
 * aufgeräumter Artikel: das Modell liest ihn wie eine Quelle, und die
 * Zahlenprüfung findet ihre Ausschnitte wortgleich wieder.
 */
export function manualSignalCorpus(signal: ManualSignal): string {
  const teile: string[] = [signal.headline, "", signal.core];
  if (signal.relevance) teile.push("", "Warum es zählt:", signal.relevance);
  teile.push("", "Belege und Zahlen:", signal.evidence);
  const zusatz: [string, string][] = [
    ["Quelle", signal.source],
    ["Unternehmen", signal.company],
    ["Zielgruppe", signal.audience],
    ["Markt", signal.territory],
    ["Anlass", signal.occasion],
    ["Wettbewerb", signal.competitor],
    ["ROOTS-Anschluss", signal.offering],
  ];
  const gefuellt = zusatz.filter(([, wert]) => wert);
  if (gefuellt.length) {
    teile.push("", "Kontext:");
    for (const [name, wert] of gefuellt) teile.push(`${name}: ${wert}`);
  }
  return teile.join("\n").trim();
}

/** Eine eigene, stabile Adresse je Signal: articles.url ist eindeutig. */
export function manualSignalUrl(id: string): string {
  return `manual://signal/${id}`;
}

/** Die Zeilen für articles und simple_signals, ohne Datenbankzugriff. */
export function manualSignalRows(signal: ManualSignal, articleId: string, jetzt: string): {
  article: Record<string, unknown>;
  signal: Record<string, unknown>;
} {
  const korpus = manualSignalCorpus(signal);
  const topics = signal.signal_label ? [signal.signal_label] : [];
  return {
    article: {
      id: articleId,
      url: manualSignalUrl(articleId),
      title: signal.headline,
      title_de: signal.headline,
      content: korpus,
      cleaned_content: korpus,
      content_de: korpus,
      published_at: jetzt,
      // Eigener Typ und eigener Status: manuelle Signale bleiben aus Dashboard,
      // Signal-Listen und Archiv heraus, sonst verfaelschen sie die Trefferquote
      // der Pipeline.
      article_type: MANUAL_ARTICLE_TYPE,
      classification_status: MANUAL_ARTICLE_TYPE,
      tag_status: "tagged",
      topics,
      territory: signal.territory || null,
    },
    signal: {
      article_id: articleId,
      status: "signal",
      lane: signal.lane,
      signal_label: signal.signal_label || null,
      score: 0,
      evidence: signal.evidence,
      headline_de: signal.headline,
      // why_de ist die Begruendung, summary_de der Inhalt. Der Asset-Prompt
      // liest summary_de als Signalzusammenfassung: dort gehoert der Kern hin,
      // nicht die Relevanz.
      why_de: signal.relevance || signal.core,
      summary_de: signal.core,
      company: signal.company || null,
      article_type: MANUAL_ARTICLE_TYPE,
      language: "de",
      roots_offering: signal.offering || null,
      buying_center_roles: signal.audience ? [signal.audience] : [],
      pipeline_version: MANUAL_ARTICLE_TYPE,
      trigger_de: signal.occasion || null,
    },
  };
}

export const MANUAL_ARTICLE_TYPE = "manual";

/**
 * Filter für alle Listen und Zähler: manuelle Signale gehören nicht in die
 * Pipeline-Auswertung. article_type ist bei gecrawlten Zeilen oft NULL, und
 * `<> 'manual'` waere dort NULL und wuerde die Zeile stumm wegwerfen — deshalb
 * die ausdrueckliche Oder-Bedingung.
 */
export const MANUAL_SIGNAL_EXCLUDE = `article_type.is.null,article_type.neq.${MANUAL_ARTICLE_TYPE}`;
