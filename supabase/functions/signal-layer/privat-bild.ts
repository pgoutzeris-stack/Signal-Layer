// Bild fuer private LinkedIn-Assets, im Stil eines Masterprompts aus dem
// Image-Generation-Tool. Quelle der Wahrheit bleibt assets/master-styles.js im
// Bildtool: Prompt, Serienreferenzen, Format und CI-Pruefung kommen von dort,
// damit Signal Layer und Bildtool dasselbe Bild bauen.

export const BILDTOOL_BASIS = "https://pgoutzeris-stack.github.io/Image-Generation-Tool/";
export const BILDSTIL_STANDARD = "master-li-privat";
/** Nano Banana 2, Standard im Bildtool (sel-model = nb2). */
export const BILDSTIL_MODELL = "gemini-3.1-flash-image";
export const BILDSTIL_PRUEF_MODELL = "gemini-2.5-flash-lite";
/** Der Browser schickt das fertige Bild zurueck; das Gateway haengt ab ca. 512 KB. */
export const PRIVAT_BILD_MAX_ZEICHEN = 480_000;

export interface BildStil {
  id: string;
  name: string;
  aspect: string;
  prompt: string;
  seriesRefs: string[];
  previewImages: string[];
  ciCheck: boolean;
  rootsLogo: boolean;
  needsPortraitInput: boolean;
}

/** Liest window.ROOTS_MASTER_STYLES aus der Datei des Bildtools. */
export function parseMasterStile(quelltext: string): BildStil[] {
  const treffer = /window\.ROOTS_MASTER_STYLES\s*=\s*(\[[\s\S]*?\n\]);/.exec(String(quelltext || ""));
  if (!treffer) return [];
  let roh: unknown;
  try { roh = JSON.parse(treffer[1]); } catch { return []; }
  if (!Array.isArray(roh)) return [];
  const liste = (wert: unknown) => Array.isArray(wert) ? wert.map(String).filter(Boolean) : [];
  return roh
    .filter((s) => s && typeof s === "object" && (s as Record<string, unknown>).id && (s as Record<string, unknown>).prompt)
    .map((s) => {
      const r = s as Record<string, unknown>;
      return {
        id: String(r.id),
        name: String(r.name || r.id),
        aspect: String(r.aspect || "1:1"),
        prompt: String(r.prompt),
        seriesRefs: liste(r.seriesRefs),
        previewImages: liste(r.previewImages),
        ciCheck: r.ciCheck === true,
        rootsLogo: r.rootsLogo === true,
        needsPortraitInput: r.needsPortraitInput === true,
      };
    });
}

/** Weisse ROOTS-Wortmarke, die das Bildtool bei rootsLogo-Stilen einsetzt. */
export function parseMasterLogo(quelltext: string): string {
  const treffer = /window\.ROOTS_LOGO_WHITE_PNG\s*=\s*"(data:image\/png;base64,[A-Za-z0-9+/=]+)"/.exec(String(quelltext || ""));
  return treffer ? treffer[1] : "";
}

/** Fuer LinkedIn-Posts taugen nur die LinkedIn-Stile ohne Porträt-Eingabe. */
export function linkedinBildStile(stile: BildStil[]): BildStil[] {
  return stile.filter((s) => /linkedin/i.test(s.name) && !s.needsPortraitInput);
}

export function waehleBildStil(stile: BildStil[], gewuenscht: string): BildStil | null {
  return stile.find((s) => s.id === gewuenscht) || stile.find((s) => s.id === BILDSTIL_STANDARD) || stile[0] || null;
}

export function bildVorschauUrls(stil: BildStil): string[] {
  const quelle = stil.previewImages.length ? stil.previewImages : stil.seriesRefs;
  return quelle.filter((pfad) => /^assets\/[a-z0-9/_.-]+\.(jpe?g|png|webp)(\?[a-z0-9=._-]*)?$/i.test(pfad)).map((pfad) => BILDTOOL_BASIS + pfad);
}

/** Wie loadAsset im Bildtool: nur Stilbilder aus assets/, ohne Cache-Marke. */
export function serienRefPfad(pfad: string): string {
  const sauber = String(pfad || "").split("?")[0];
  return /^assets\/(master-styles\/[a-z0-9-]+|team-dunkel\/[a-z0-9-]+|portrait-master(-hell)?)\.jpg$/.test(sauber) ? sauber : "";
}

/** Wortgleich zu STYLE_PRIORITY_RULE im Bildtool: Stil vor Gestaltungswunsch. */
export const BILDSTIL_RANGFOLGE = "RANGFOLGE: Der BILDAUFTRAG bestimmt Thema, Aussage, Motiv, Marken, Produkte und Fakten. Medium und Bildsprache, Farbwelt, Licht, Format und die Textregeln der Stilvorgabe sind verbindlich und haben Vorrang vor jeder Gestaltungsangabe im BILDAUFTRAG. Verlangt der BILDAUFTRAG etwas anderes, etwa Illustration statt Fotografie, eine Headline, ganze Sätze oder mehr Wörter als die Stilvorgabe erlaubt, ein anderes Format oder eine andere Farbwelt, setze die Stilvorgabe um und übernimm aus dem Auftrag nur Thema und Aussage. Headlines, Sätze und Slogans aus dem BILDAUFTRAG erscheinen nicht im Bild, auch nicht als Schild, Plakat, Anzeige, Bildschirm oder Aufdruck in der Szene. Zeige nur Marken, die der BILDAUFTRAG nennt.";

/**
 * Wortgleich zu buildSystemInstruction im Bildtool (image-generation/index.ts)
 * fuer einen festen Stil (styleStrict) ohne Eingabe-, Stil- und Logobild.
 * Aendert sich dort der Text, muss er hier mitgehen.
 */
export function bildstilSystemInstruction(stylePrompt: string, seriesReferenceCount: number): string {
  const sections = [
    "Du bist ein professioneller Art Director und Bildgenerator. Erzeuge genau das vom Nutzer beschriebene Motiv.",
  ];
  if (stylePrompt) {
    sections.push(
      `VERBINDLICHE STILVORGABE:\n${stylePrompt}\n${BILDSTIL_RANGFOLGE}`,
    );
  }
  if (seriesReferenceCount > 0) {
    sections.push(
      `SERIENREFERENZEN: Die ${seriesReferenceCount} als Serienreferenz markierten Bilder sind freigegebene Beispiele dieser Bildserie. Halte ihr Qualitätsniveau, ihre Bildsprache, Lichtführung, Farbwelt und ihren Bildaufbau ein, damit das neue Bild erkennbar zur selben Serie gehört. Was genau übernommen wird, regelt die verbindliche Stilvorgabe. Übernimm daraus weder Motive noch Marken, Logos, Wasserzeichen oder Schrift, sofern die Stilvorgabe das nicht ausdrücklich verlangt.`,
    );
  }
  sections.push(
    "QUALITÄT: Liefere ein zusammenhängendes, professionelles Bild ohne Wasserzeichen, zufällige Zusatzlogos, ungewollte Schrift oder technische Artefakte.",
  );
  return sections.join("\n\n");
}

/**
 * Der BILDAUFTRAG, den man im Bildtool eintippen wuerde: der Beitrag selbst.
 * Die Platzhalter des Masterprompts ({{BEITRAG}}, {{KERNAUSSAGE}},
 * {{MARKEN_UND_PRODUKTE}}) fuellt das Modell daraus.
 */
export function privatBildAuftrag(eingabe: { postText?: string; titel?: string; firma?: string }): string {
  const teile: string[] = [];
  const post = String(eingabe.postText || "").trim();
  const titel = String(eingabe.titel || "").replace(/<[^>]+>/g, "").trim();
  const firma = String(eingabe.firma || "").trim();
  if (post) teile.push(`LinkedIn-Beitrag:\n${post}`);
  if (titel) teile.push(`Zentrale These: ${titel}`);
  if (firma) teile.push(`Relevante Marke: ${firma}`);
  return teile.join("\n\n").slice(0, 6000);
}

/** Wortgleich zur CI-Pruefung in finalize_image des Bildtools. */
export const BILDSTIL_CI_PRUEFUNG = [
  "Du prüfst ein KI-generiertes Bild gegen die ROOTS-Corporate-Identity. Antworte nur mit JSON.",
  "roots_mark: true, wenn irgendwo im Bild das Wort ROOTS (auch RCOTS, R∞TS, ähnliche Schreibweisen), ein ROOTS-Logo, ein Unendlich-Zeichen als Logo oder eine Nachahmung davon zu sehen ist.",
  "corner_clear: immer true. foreign_logo: immer false. Logos und Namen anderer Marken sind erlaubt und kein Verstoß.",
  "reason: ein kurzer deutscher Satz.",
].join("\n");

export const BILDSTIL_CI_SCHEMA = {
  type: "OBJECT",
  properties: {
    roots_mark: { type: "BOOLEAN" },
    corner_clear: { type: "BOOLEAN" },
    foreign_logo: { type: "BOOLEAN" },
    reason: { type: "STRING" },
  },
  required: ["roots_mark", "corner_clear", "foreign_logo", "reason"],
};

/** Seitenverhaeltnis "1:1" als Hoehe bei 1080 px Breite. */
export function bildHoehe(aspect: string): number {
  const [b, h] = String(aspect || "1:1").split(":").map(Number);
  return b > 0 && h > 0 ? Math.round(1080 * h / b) : 1080;
}

/** Folie, die nur aus dem Bild besteht. data-ki-bild markiert sie im Studio. */
export function privatBildLayout(bild: string, aspect: string, stilName: string): string {
  const hoehe = bildHoehe(aspect);
  const alt = String(stilName || "").replace(/[<>"&]/g, "");
  return `<div class="li li-ki-bild" data-ki-bild="1" role="img" aria-label="${alt}" style="width:1080px;height:${hoehe}px;position:relative;overflow:hidden;background:#00163e"><img src="${bild}" alt="" style="display:block;width:100%;height:100%;object-fit:cover"></div>`;
}

export function istPrivatBild(wert: unknown): wert is string {
  const text = String(wert || "");
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(text) && text.length <= PRIVAT_BILD_MAX_ZEICHEN;
}

/**
 * Art-Director-Schritt vor dem Bild. Der ganze Beitrag als Bildauftrag ergab
 * Wimmelbilder mit jeder Marke und jedem Argument (Padel-Test 23.11.2026).
 * Im Bildtool tippt man einen kurzen Auftrag mit einer Idee; diesen Auftrag
 * schreibt hier ein Textmodell aus Beitrag und Stilvorgabe.
 */
export const BILDSTIL_BRIEF_MODELL = "gemini-2.5-flash";

/** voll: ausfuehrliche Szene; leicht: nur Thema, Aussage, Marken; idee: ein Satz Bildidee. */
export type BriefModus = "voll" | "leicht" | "idee";
export const BRIEF_MODI: BriefModus[] = ["voll", "leicht", "idee"];
export const BRIEF_STANDARD: BriefModus = "voll";

export function privatBildBriefPrompt(stylePrompt: string, postText: string, titel = "", modus: BriefModus = BRIEF_STANDARD): { system: string; user: string } {
  const motivRegel = modus === "idee"
    ? "Feld motiv: genau ein Satz, höchstens 20 Wörter, eine plakative Bildidee wie ein Kampagnenmotiv. Nur WAS zu sehen ist, keine Angaben zu Licht, Perspektive, Farben oder Stimmung; die Umsetzung macht der Stil."
    : modus === "leicht"
      ? "Feld motiv: leer lassen. Die Bildidee entwickelt der Bildgenerator selbst aus der Stilvorgabe."
      : "";
  const system = [
    "Du bist Art Director für persönliche LinkedIn-Beiträge und schreibst den Bildauftrag für einen Bildgenerator.",
    "Der Bildgenerator arbeitet nach der STILVORGABE unten. Entwickle genau eine Bildidee, die diese Stilvorgabe gut umsetzen kann, mit einem dominanten Blickfang und wenigen unterstützenden Elementen.",
    "Die Idee übersetzt die Kernaussage in eine konkrete, überraschende Szene: zum Beispiel ein Produkt in einem unerwarteten Kontext, ein klarer Vergleich zweier Zustände oder eine fotografisch glaubwürdige Metapher.",
    "Verboten: Wimmelbild, Sammlung aller Marken oder Argumente des Beitrags, Gruppe jubelnder Menschen als Ersatz für eine Idee, Schilder oder Bildschirme mit Text, Headlines, Zahlen.",
    "Marken: höchstens zwei, nur solche, die im Beitrag vorkommen und für die Kernaussage zentral sind. Keine erfundenen Marken.",
    motivRegel,
    "Antworte nur mit JSON.",
  ].filter(Boolean).join("\n");
  const user = `STILVORGABE:\n${String(stylePrompt || "").slice(0, 12000)}\n\nBEITRAG:\n${String(postText || "").slice(0, 5000)}${titel ? `\n\nTITEL DES ASSETS: ${titel}` : ""}`;
  return { system, user };
}

export const BILDSTIL_BRIEF_SCHEMA = {
  type: "OBJECT",
  properties: {
    thema: { type: "STRING" },
    kernaussage: { type: "STRING" },
    marken_und_produkte: { type: "STRING" },
    motiv: { type: "STRING" },
  },
  required: ["thema", "kernaussage", "marken_und_produkte", "motiv"],
};

/** Aus der Antwort des Art Directors den BILDAUFTRAG in der Sprache des Masterprompts bauen. */
export function privatBildAuftragAusBrief(brief: unknown, modus: BriefModus = BRIEF_STANDARD): string {
  const r = (brief && typeof brief === "object" ? brief : {}) as Record<string, unknown>;
  const feld = (wert: unknown, max: number) => String(wert ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const thema = feld(r.thema, 500);
  const kern = feld(r.kernaussage, 300);
  // Hoechstens zwei Marken, auch wenn das Modell mehr nennt.
  const marken = feld(r.marken_und_produkte, 200).split(/\s*(?:,|;|\bund\b|&)\s*/).filter(Boolean).slice(0, 2).join(", ");
  const motiv = feld(r.motiv, 900);
  if (!thema || (!motiv && modus !== "leicht")) return "";
  return [
    `Beitrag oder Thema: ${thema}`,
    kern ? `Kernaussage: ${kern}` : "",
    marken ? `Relevante Marken und Produkte: ${marken}` : "",
    modus !== "leicht" && motiv ? `Konkrete Motividee: ${motiv}` : "",
    "Zusätzlich erlaubte Wörter im Bild: keine",
  ].filter(Boolean).join("\n");
}
