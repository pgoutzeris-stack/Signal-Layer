/**
 * Text aus einer öffentlichen Adresse holen: Transkript eines Videos, sonst
 * den Artikeltext. Portiert aus dem LinkedIn-Auto-Werkzeug, dort läuft die
 * Extraktion lokal mit yt-dlp und Whisper. Hier gibt es keine lokale Laufzeit,
 * deshalb nur, was ein Server über HTTP erreicht:
 *
 *   1. YouTube: die Untertitelspur aus der Wiedergabeseite (json3), erst
 *      manuelle, dann automatische, Deutsch vor Englisch.
 *   2. Jede andere Seite: sichtbarer Text der Seite.
 *
 * Ohne Untertitel gibt es kein Transkript. Das wird zurückgemeldet statt
 * geraten, denn ein Signal ohne Beleg ist keins.
 */

export type QuellenArt = "transcript" | "article" | "description";

export type QuellenText = {
  ok: boolean;
  art: QuellenArt | null;
  plattform: string;
  titel: string;
  text: string;
  zeichen: number;
  sprache: string | null;
  grund: string;
};

const MAX_ZEICHEN = 40_000;

/** Nur öffentliche Adressen. Ein Server, der interne Netze abruft, ist ein Loch. */
export function pruefeOeffentlicheUrl(rohwert: string): { ok: boolean; url: string; grund: string } {
  const wert = String(rohwert || "").trim();
  if (!wert) return { ok: false, url: "", grund: "Keine Adresse angegeben." };
  let url: URL;
  try {
    // Nur ein fehlendes Schema wird ergaenzt. "file:" oder "javascript:" bleiben
    // erhalten und fallen unten durch die Schemapruefung.
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(wert) ? wert : `https://${wert}`);
  } catch {
    return { ok: false, url: "", grund: "Das ist keine gültige Adresse." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, url: "", grund: "Nur http und https sind erlaubt." };
  }
  const host = url.hostname.toLowerCase();
  const verboten = host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")
    || /^(?:127|10)\./.test(host) || /^192\.168\./.test(host)
    || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)
    || /^169\.254\./.test(host) || host === "0.0.0.0" || host === "[::1]"
    || host.endsWith(".supabase.co");
  if (verboten) return { ok: false, url: "", grund: "Interne Adressen sind nicht erlaubt." };
  return { ok: true, url: url.toString(), grund: "" };
}

export function erkennePlattform(url: string): string {
  const host = (() => {
    try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
  })();
  if (/youtube\.com$|youtu\.be$/.test(host)) return "youtube";
  if (/linkedin\.com$/.test(host)) return "linkedin";
  if (/vimeo\.com$/.test(host)) return "vimeo";
  if (/spotify\.com$/.test(host)) return "spotify";
  if (/tiktok\.com$/.test(host)) return "tiktok";
  return host || "web";
}

export function youtubeId(url: string): string {
  try {
    const adresse = new URL(url);
    if (adresse.hostname.endsWith("youtu.be")) return adresse.pathname.slice(1, 20);
    return adresse.searchParams.get("v") || (adresse.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{6,20})/) || [])[1] || "";
  } catch {
    return "";
  }
}

/** Sichtbarer Text einer Seite. Skripte, Stile und Navigationsrümpfe raus. */
export function seitenText(html: string): { titel: string; text: string } {
  const roh = String(html || "");
  const titel = (roh.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)
    || roh.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i) || ["", ""])[1] || "";
  const kern = (roh.match(/<article[\s\S]*?<\/article>/i) || roh.match(/<main[\s\S]*?<\/main>/i) || [roh])[0];
  const text = kern
    .replace(/<(script|style|nav|footer|form|aside|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_treffer, ziffern) => String.fromCharCode(Number(ziffern)))
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { titel: entschaerfe(titel), text: text.slice(0, MAX_ZEICHEN) };
}

function entschaerfe(wert: string): string {
  return String(wert || "").replace(/\s+/g, " ").trim().slice(0, 300);
}

/** Untertitelspuren aus der Wiedergabeseite. Deutsch zuerst, dann Englisch. */
export function untertitelSpur(html: string): { url: string; sprache: string; automatisch: boolean } | null {
  const treffer = String(html || "").match(/"captionTracks":(\[[\s\S]*?\])/);
  if (!treffer) return null;
  let spuren: Array<Record<string, unknown>> = [];
  try {
    spuren = JSON.parse(treffer[1].replace(/\\u0026/g, "&"));
  } catch {
    return null;
  }
  const punkte = (spur: Record<string, unknown>) => {
    const code = String((spur.languageCode as string) || "").toLowerCase();
    const automatisch = String((spur.kind as string) || "") === "asr";
    return (code.startsWith("de") ? 4 : code.startsWith("en") ? 2 : 0) + (automatisch ? 0 : 1);
  };
  const beste = spuren.filter((spur) => spur.baseUrl).sort((links, rechts) => punkte(rechts) - punkte(links))[0];
  if (!beste) return null;
  return {
    url: String(beste.baseUrl).replace(/\\u0026/g, "&") + "&fmt=json3",
    sprache: String((beste.languageCode as string) || ""),
    automatisch: String((beste.kind as string) || "") === "asr",
  };
}

/** json3 der Untertitel in fortlaufenden Text. */
export function untertitelText(json3: unknown): string {
  const ereignisse = (json3 as { events?: Array<{ segs?: Array<{ utf8?: string }> }> })?.events || [];
  const zeilen = ereignisse
    .map((ereignis) => (ereignis.segs || []).map((teil) => String(teil.utf8 || "")).join(""))
    .map((zeile) => zeile.replace(/\s+/g, " ").trim())
    .filter((zeile) => zeile && zeile !== "\n");
  const text: string[] = [];
  for (const zeile of zeilen) {
    if (text[text.length - 1] === zeile) continue;
    text.push(zeile);
  }
  return text.join(" ").replace(/\s+/g, " ").trim().slice(0, MAX_ZEICHEN);
}

type Holer = (url: string) => Promise<{ ok: boolean; text: string; json?: unknown }>;

/**
 * Der eigentliche Abruf. `holen` wird hereingegeben, damit die Logik ohne Netz
 * geprüft werden kann.
 */
export async function ziehteQuelle(rohwert: string, holen: Holer): Promise<QuellenText> {
  const gepruef = pruefeOeffentlicheUrl(rohwert);
  if (!gepruef.ok) {
    return { ok: false, art: null, plattform: "", titel: "", text: "", zeichen: 0, sprache: null, grund: gepruef.grund };
  }
  const url = gepruef.url;
  const plattform = erkennePlattform(url);
  const seite = await holen(url);
  if (!seite.ok) {
    return {
      ok: false, art: null, plattform, titel: "", text: "", zeichen: 0, sprache: null,
      grund: "Die Seite war nicht abrufbar. Öffentlich erreichbare Adresse prüfen.",
    };
  }
  const { titel, text } = seitenText(seite.text);

  if (plattform === "youtube") {
    const spur = untertitelSpur(seite.text);
    if (spur) {
      const untertitel = await holen(spur.url);
      const transkript = untertitel.ok ? untertitelText(untertitel.json ?? safeJson(untertitel.text)) : "";
      if (transkript.length > 200) {
        return {
          ok: true, art: "transcript", plattform, titel, text: transkript,
          zeichen: transkript.length, sprache: spur.sprache,
          grund: spur.automatisch ? "Automatisch erzeugte Untertitel: Zahlen und Namen gegenprüfen." : "",
        };
      }
    }
    const beschreibung = (seite.text.match(/"shortDescription":"([\s\S]{0,4000}?)","/) || ["", ""])[1]
      .replace(/\\n/g, " ").replace(/\\"/g, '"').replace(/\s+/g, " ").trim();
    if (beschreibung.length > 120) {
      return {
        ok: true, art: "description", plattform, titel, text: beschreibung,
        zeichen: beschreibung.length, sprache: null,
        grund: "Kein Transkript verfügbar, nur die Videobeschreibung. Belege daraus sind meist zu dünn.",
      };
    }
    return {
      ok: false, art: null, plattform, titel, text: "", zeichen: 0, sprache: null,
      grund: "Dieses Video hat keine öffentlichen Untertitel. Text bitte manuell einsetzen.",
    };
  }

  if (text.length < 400) {
    return {
      ok: false, art: null, plattform, titel, text, zeichen: text.length, sprache: null,
      grund: "Die Seite gibt zu wenig Text her, oft wegen Paywall oder JavaScript.",
    };
  }
  return { ok: true, art: "article", plattform, titel, text, zeichen: text.length, sprache: null, grund: "" };
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

/** Die Felder, die ein manuelles Signal braucht, in der Reihenfolge des Fragebogens. */
export const MANUAL_DRAFT_FIELDS = ["headline", "core", "evidence", "source", "company", "offering", "territory", "occasion", "competitor"] as const;

export const MANUAL_DRAFT_SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING", description: "Das Signal in einem Satz, höchstens 56 Zeichen wenn möglich." },
    core: { type: "STRING", description: "Zwei bis drei Sätze: was passiert, bei wem, seit wann." },
    evidence: { type: "STRING", description: "Zahlen, Zitate und Namen wortgleich aus der Quelle. Nichts hinzufügen." },
    source: { type: "STRING", description: "Herausgeber, Titel und Jahr der Quelle." },
    company: { type: "STRING", description: "Das Unternehmen, um das es geht. Leer, wenn keines genannt ist." },
    offering: { type: "STRING", description: "Passende ROOTS-Leistung oder leer." },
    territory: { type: "STRING", description: "Markt oder Branche oder leer." },
    occasion: { type: "STRING", description: "Konkreter Anlass oder leer." },
    competitor: { type: "STRING", description: "Genannte Wettbewerber als Firmennamen oder leer." },
    missing: { type: "ARRAY", items: { type: "STRING" }, description: "Feldnamen, die die Quelle nicht belegt." },
    verdict: { type: "STRING", description: "tragfaehig, duenn oder untauglich" },
    verdict_reason: { type: "STRING", description: "Ein Satz, warum." },
  },
  required: ["headline", "core", "evidence", "missing", "verdict", "verdict_reason"],
} as const;

/** Der Auftrag an das Modell. Erfundene Zahlen sind schlimmer als leere Felder. */
export function manualDraftPrompt(quelle: QuellenText, lane: "marketing" | "sales"): string {
  return `Du liest eine Quelle und füllst daraus ein Signal für ROOTS Brand Strategy Consultants.

<regeln>
Nur was in der Quelle steht. Keine Zahl, kein Name, kein Zitat, das dort nicht vorkommt.
evidence enthält ausschliesslich wortgleiche Ausschnitte aus der Quelle, mit ihren Zahlen.
Was die Quelle nicht hergibt, bleibt leer und wird in missing genannt. Ein leeres Feld ist richtig, eine erfundene Angabe ist ein Fehler.
verdict ist "tragfaehig", wenn Überschrift, Kern und mindestens ein belegter Ausschnitt aus der Quelle stammen; "duenn", wenn der Kern steht, aber Zahlen oder Zitate fehlen; "untauglich", wenn die Quelle kein Signal hergibt.
${lane === "sales"
    ? "Spur Sales: das Signal soll den Anlass für die Ansprache eines Unternehmens tragen. company ist wichtig."
    : "Spur Marketing: das Signal soll einen LinkedIn-Beitrag tragen. Eine belegte Zahl ist wichtiger als ein Firmenname."}
</regeln>

<quelle art="${quelle.art || "unbekannt"}" plattform="${quelle.plattform}" titel="${quelle.titel.replace(/"/g, "'")}">
${quelle.text.slice(0, 24_000)}
</quelle>`;
}

/** Antwort des Modells auf die Felder des Fragebogens abbilden. */
export function normalizeManualDraft(raw: unknown): {
  felder: Record<string, string>;
  missing: string[];
  verdict: "tragfaehig" | "duenn" | "untauglich";
  verdictReason: string;
} {
  const quelle = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const felder: Record<string, string> = {};
  for (const key of MANUAL_DRAFT_FIELDS) {
    felder[key] = String(quelle[key] ?? "").replace(/\s+/g, " ").trim().slice(0, 2_000);
  }
  const gemeldet = Array.isArray(quelle.missing) ? quelle.missing.map((wert) => String(wert)) : [];
  const leer = MANUAL_DRAFT_FIELDS.filter((key) => !felder[key]);
  const missing = [...new Set([...gemeldet.filter((key) => (MANUAL_DRAFT_FIELDS as readonly string[]).includes(key)), ...leer])];
  const rohVerdict = String(quelle.verdict ?? "").toLowerCase();
  const verdict = rohVerdict.startsWith("trag") ? "tragfaehig" : rohVerdict.startsWith("unt") ? "untauglich" : "duenn";
  return {
    felder,
    missing,
    verdict,
    verdictReason: String(quelle.verdict_reason ?? "").replace(/\s+/g, " ").trim().slice(0, 400),
  };
}

/* ------------------------------------------------------------------------- *
 * Zweite Stufe: die Prüfung des fertigen Signals.
 *
 * Der Entwurf oben füllt nur, was in der Quelle steht. Was fehlt, trägt der
 * Nutzer selbst nach, und genau dort entsteht das Risiko: eine Zahl, die die
 * Quelle nicht deckt, wird im Asset zu einer belegten Aussage. Deshalb liest
 * das Modell am Ende die fertigen Felder noch einmal gegen die Quelle und sagt,
 * was trägt, was dünn ist und was widerlegt wird.
 * ------------------------------------------------------------------------- */

export type PruefBefund = {
  field: string;
  severity: "blocker" | "warn" | "info";
  note: string;
};

export type ManualCheck = {
  verdict: "tragfaehig" | "duenn" | "untauglich";
  verdictReason: string;
  findings: PruefBefund[];
  missing: string[];
  unsupported: string[];
  blocker: boolean;
  ready: boolean;
};

export const MANUAL_CHECK_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", description: "tragfaehig, duenn oder untauglich" },
    verdict_reason: { type: "STRING", description: "Ein Satz, warum das Urteil so ausfällt." },
    findings: {
      type: "ARRAY",
      description: "Je Fund ein Eintrag. Nur echte Funde, keine Bestätigungen.",
      items: {
        type: "OBJECT",
        properties: {
          field: { type: "STRING", description: "Feldname aus der Liste, oder leer für das ganze Signal." },
          severity: { type: "STRING", description: "blocker, warn oder info" },
          note: { type: "STRING", description: "Ein Satz: was ist das Problem, was ist zu tun." },
        },
        required: ["field", "severity", "note"],
      },
    },
    missing: { type: "ARRAY", items: { type: "STRING" }, description: "Feldnamen, die für dieses Signal noch gebraucht werden." },
    unsupported: { type: "ARRAY", items: { type: "STRING" }, description: "Feldnamen mit Angaben, die die Quelle nicht deckt." },
  },
  required: ["verdict", "verdict_reason", "findings"],
} as const;

const CHECK_FELDER = ["headline", "core", "evidence", "source", "company", "offering", "territory", "occasion", "competitor"] as const;

/**
 * Der Prüfauftrag. Zwei Sorten Felder, zwei Maßstäbe: was aus der Quelle
 * gezogen wurde, muss dort wortgleich wiederzufinden sein; was der Nutzer
 * selbst geschrieben hat, darf über die Quelle hinausgehen, ihr aber nicht
 * widersprechen.
 */
export function manualCheckPrompt(
  felder: Record<string, string>,
  quelle: QuellenText | null,
  lane: "marketing" | "sales",
  ausQuelle: string[],
): string {
  const liste = CHECK_FELDER
    .map((key) => `${key}${ausQuelle.includes(key) ? " (aus der Quelle gezogen)" : " (selbst geschrieben)"}: ${felder[key] || "(leer)"}`)
    .join("\n");
  const quellenblock = quelle && quelle.ok
    ? `<quelle art="${quelle.art || "unbekannt"}" plattform="${quelle.plattform}">
${quelle.text.slice(0, 20_000)}
</quelle>`
    : `<quelle>Keine Quelle vorhanden. Prüfe nur, ob die Angaben in sich tragen: konkret, widerspruchsfrei, mit einem Beleg, der eine Zahl oder ein Zitat enthält.</quelle>`;

  return `Du prüfst ein Signal für ROOTS Brand Strategy Consultants, bevor daraus ein Asset entsteht.

<maßstab>
Felder mit "(aus der Quelle gezogen)": jede Zahl, jeder Name und jedes Zitat darin muss in der Quelle stehen. Findest du eine Angabe dort nicht, ist das ein blocker.
Felder mit "(selbst geschrieben)": dürfen über die Quelle hinausgehen. Sie dürfen ihr nicht widersprechen, und sie müssen konkret sein. Platzhalter wie "diverse", "verschiedene", "siehe oben", "tbd", "k. A." sind ein blocker.
evidence trägt das ganze Asset. Ohne Zahl und ohne Zitat ist evidence höchstens "duenn".
headline und core müssen dasselbe Signal beschreiben. Ein Widerspruch zwischen beiden ist ein blocker.
${lane === "sales"
    ? "Spur Sales: ohne company gibt es kein Ziel für die Ansprache. Fehlt es, gehört company in missing."
    : "Spur Marketing: eine belegte Zahl trägt den Beitrag. Fehlt jede Zahl, gehört evidence in missing."}
verdict ist "untauglich", sobald ein blocker vorliegt; "duenn", wenn nur Warnungen bleiben; "tragfaehig", wenn nichts Wesentliches fehlt.
Keine Lobzeilen. Steht ein Feld, schreibe dazu nichts.
</maßstab>

<signal spur="${lane}">
${liste}
</signal>

${quellenblock}`;
}

/** Antwort des Modells auf einen verlässlichen Befund abbilden. */
export function normalizeManualCheck(raw: unknown): ManualCheck {
  const quelle = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const erlaubt = CHECK_FELDER as readonly string[];
  const feldname = (wert: unknown) => {
    const key = String(wert ?? "").trim();
    return erlaubt.includes(key) ? key : "";
  };
  const findings: PruefBefund[] = (Array.isArray(quelle.findings) ? quelle.findings : [])
    .map((eintrag) => {
      const fund = (eintrag && typeof eintrag === "object" ? eintrag : {}) as Record<string, unknown>;
      const stufe = String(fund.severity ?? "").toLowerCase();
      return {
        field: feldname(fund.field),
        severity: stufe.startsWith("block") ? "blocker" as const : stufe.startsWith("info") ? "info" as const : "warn" as const,
        note: String(fund.note ?? "").replace(/\s+/g, " ").trim().slice(0, 400),
      };
    })
    .filter((fund) => fund.note);
  const liste = (wert: unknown) => [...new Set(
    (Array.isArray(wert) ? wert : []).map(feldname).filter(Boolean),
  )];
  const unsupported = liste(quelle.unsupported);
  const missing = liste(quelle.missing);
  // Ein Feld, dessen Angabe die Quelle nicht deckt, ist immer ein blocker,
  // auch wenn das Modell dazu nur eine Warnung geschrieben hat.
  const blocker = findings.some((fund) => fund.severity === "blocker") || unsupported.length > 0;
  const rohVerdict = String(quelle.verdict ?? "").toLowerCase();
  const verdict = blocker
    ? "untauglich" as const
    : rohVerdict.startsWith("trag") ? "tragfaehig" as const : rohVerdict.startsWith("unt") ? "untauglich" as const : "duenn" as const;
  return {
    verdict,
    verdictReason: String(quelle.verdict_reason ?? "").replace(/\s+/g, " ").trim().slice(0, 400),
    findings,
    missing,
    unsupported,
    blocker,
    ready: !blocker && verdict !== "untauglich",
  };
}
