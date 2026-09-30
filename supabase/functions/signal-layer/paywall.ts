// Paywall-Erkennung fuer gespeicherte Artikel. Reine Funktionen, damit sie
// ohne Deno-Laufzeit getestet werden koennen (tests/paywall.test.mjs).
//
// Aus der Pruefung aller 5.549 Artikel der Pipeline 2.6 am 30.09.2026:
// - Jedes Muster unten stammt aus einem echten Anreisser (dfv-Titel wie LZ,
//   TW, HORIZONT, afz; FAZ, Capital, Bild, Handelsblatt, Daehne-Titel). Keins
//   kam in einem vollstaendigen Artikel vor.
// - Die Laenge des gespeicherten Textes allein taeuscht: Bei der FAZ steht die
//   Angebotsbox im Median nach 380 bis 580 Zeichen, danach folgen Tausende
//   Zeichen Empfehlungen. Entscheidend ist, wie viel Text VOR dem Merkmal steht.
// - Wo ein Verlag keinen Hinweis in den Text schreibt (SZ, WiWo, W&V, t3n),
//   steht er im JSON-LD: isAccessibleForFree=false. FAZ und Adweek markieren
//   aber auch Seiten, deren voller Text im HTML steht. Deshalb zaehlt die
//   Markierung nur, wenn der Text kurz ist.
//
// Die Muster muessen in JavaScript (Flags "is") und in Postgres (regexp_instr
// mit Flag "i") dasselbe bedeuten: kein \b, keine Lookarounds. Dieselbe Liste
// steht in supabase/migrations/20260930150000_paywall_erkennung.sql; ein Test
// haelt beide gleich.

/** [Beleg im Klartext, Muster]. Reihenfolge egal, es zaehlt der fruehste Treffer. */
export const PAYWALL_MERKMALE: ReadonlyArray<readonly [string, string]> = [
  ["Lizenzangebot für Teams", "lizenz f.{1,2}r ihr team"],
  ["Vollzugriff-Angebot", "vollzugriff auf .{0,40}mit allen artikeln"],
  ["Angebot wählen und weiterlesen", "angebot w.{1,2}hlen und weiterlesen"],
  ["Noch kein Abonnement", "noch kein .{0,30}abonnement"],
  ["FAZ+-Angebot", "mit einem klick online k.{1,2}ndbar"],
  ["FAZ+-Preis", "originalpreis: ?[0-9,]+ ?€"],
  ["Capital+", "\\| capital\\+"],
  ["BILDplus", "lesen sie .{0,40}bild ?plus"],
  ["Probeabo-Angebot", "direkt weiterlesen.{0,40}kostenlos testen"],
  ["Nur Anreißer, Volltext im Abo", "lesen sie hier das vollst.{1,2}ndige"],
  ["Weiterlesen mit Abo", "weiterlesen mit .{0,25}(abo|plus)"],
  ["Artikel kostenpflichtig", "artikel ist kostenpflichtig"],
  ["Subscribe to continue", "subscribe (now )?to (continue|read|unlock)"],
  ["Already a subscriber", "already a subscriber"],
  ["Sign in to continue", "(sign|log) ?in to (continue|read)"],
];

/** So viel Text darf vor einem Merkmal stehen, damit es als Paywall zaehlt. */
export const PAYWALL_ANREISSER_MAX = 3_000;
/** Unter dieser Laenge gilt ein als kostenpflichtig markierter Artikel als Anreisser. */
export const PAYWALL_MARKIERT_MAX = 2_000;

const MUSTER = PAYWALL_MERKMALE.map(([beleg, muster]) => [beleg, new RegExp(muster, "is")] as const);

/** Beleg des fruehesten Merkmals innerhalb der Anreisser-Grenze, sonst null. */
export function paywallMerkmal(text: string): string | null {
  const kopf = String(text || "").slice(0, PAYWALL_ANREISSER_MAX + 200);
  let treffer: { beleg: string; stelle: number } | null = null;
  for (const [beleg, muster] of MUSTER) {
    const stelle = kopf.search(muster);
    if (stelle < 0 || stelle >= PAYWALL_ANREISSER_MAX) continue;
    if (!treffer || stelle < treffer.stelle) treffer = { beleg, stelle };
  }
  return treffer?.beleg ?? null;
}

const ARTIKEL_TYP = /article|reportage|blogposting|report|webpage|creativework/i;

function freiWert(wert: unknown): boolean | null {
  if (typeof wert === "boolean") return wert;
  if (typeof wert === "string") {
    if (/^\s*false\s*$/i.test(wert)) return false;
    if (/^\s*true\s*$/i.test(wert)) return true;
  }
  return null;
}

/** Was die Seite im JSON-LD ueber Zugang und Umfang des Artikels sagt. */
export type SeitenZugang = {
  /** isAccessibleForFree: true = kostenpflichtig, false = frei, null = keine Angabe. */
  kostenpflichtig: boolean | null;
  /** wordCount des Artikels, null ohne Angabe. */
  woerter: number | null;
  /** Laenge von articleBody, 0 ohne. */
  koerper: number;
  /** Textlaenge im als kostenpflichtig markierten Bereich (hasPart.cssSelector), null ohne Bereich. */
  gesperrt: number | null;
};

const LEERE_ELEMENTE = new Set(["br", "img", "input", "meta", "link", "hr", "source", "area", "base", "col", "embed", "param", "track", "wbr"]);

/** Sichtbarer Text im ersten Element mit dieser Klasse, null wenn es fehlt. */
function textInKlasse(html: string, klasse: string): number | null {
  const kopf = new RegExp(`<([a-zA-Z0-9]+)\\b[^>]*class=["'][^"']*(?<![\\w-])${klasse.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])[^"']*["'][^>]*>`);
  const treffer = kopf.exec(html);
  if (!treffer) return null;
  const tag = treffer[1].toLowerCase();
  const marke = /<(\/?)([a-zA-Z0-9]+)\b[^>]*?(\/?)>/g;
  marke.lastIndex = treffer.index + treffer[0].length;
  let tiefe = 1;
  let ende = html.length;
  for (let m = marke.exec(html); m && tiefe > 0; m = marke.exec(html)) {
    const name = m[2].toLowerCase();
    if (name !== tag || LEERE_ELEMENTE.has(name) || m[3]) continue;
    tiefe += m[1] ? -1 : 1;
    if (tiefe === 0) ende = m.index;
  }
  return html.slice(treffer.index + treffer[0].length, ende)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

/**
 * Liest isAccessibleForFree, wordCount, articleBody und den gesperrten Bereich
 * aus dem JSON-LD. Listen verwandter Artikel zaehlen nicht mit, nur der Artikel
 * selbst und seine Teile (hasPart).
 */
export function seitenZugang(html: string): SeitenZugang {
  const quelle = String(html || "");
  const bloecke = quelle.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  let frei = false;
  let kostenpflichtig = false;
  let woerter: number | null = null;
  let koerper = 0;
  const selektoren = new Set<string>();
  const pruefe = (knoten: unknown, tiefe: number): void => {
    if (!knoten || typeof knoten !== "object" || tiefe > 3) return;
    if (Array.isArray(knoten)) { knoten.forEach((k) => pruefe(k, tiefe)); return; }
    const k = knoten as Record<string, unknown>;
    const typ = Array.isArray(k["@type"]) ? k["@type"].join(" ") : String(k["@type"] || "");
    const artikel = ARTIKEL_TYP.test(typ) || !typ;
    const teil = /webpageelement/i.test(typ);
    const wert = freiWert(k.isAccessibleForFree);
    if (wert !== null && (artikel || teil)) {
      if (wert === false) kostenpflichtig = true;
      else frei = true;
      if (wert === false && teil) {
        const sel = k.cssSelector;
        for (const s of Array.isArray(sel) ? sel : [sel]) if (typeof s === "string" && s.trim()) selektoren.add(s.trim());
      }
    }
    if (artikel && !teil) {
      const anzahl = Number(k.wordCount);
      if (Number.isFinite(anzahl) && anzahl > 0) woerter = Math.max(woerter ?? 0, Math.round(anzahl));
      if (typeof k.articleBody === "string") koerper = Math.max(koerper, k.articleBody.trim().length);
    }
    if (k["@graph"]) pruefe(k["@graph"], tiefe + 1);
    if (k.hasPart) pruefe(k.hasPart, tiefe + 1);
    if (k.mainEntity && typeof k.mainEntity === "object") pruefe(k.mainEntity, tiefe + 1);
  };
  for (const block of bloecke) {
    const roh = block.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();
    try {
      pruefe(JSON.parse(roh), 0);
    } catch {
      // Kaputtes JSON-LD: die Angabe selbst ist trotzdem eindeutig lesbar.
      const roheAngabe = roh.match(/"isAccessibleForFree"\s*:\s*"?(true|false)"?/i);
      if (roheAngabe) {
        if (roheAngabe[1].toLowerCase() === "false") kostenpflichtig = true;
        else frei = true;
      }
    }
  }
  let gesperrt: number | null = null;
  for (const sel of selektoren) {
    if (!/^\.[\w-]+$/.test(sel)) continue;
    const laenge = textInKlasse(quelle, sel.slice(1));
    if (laenge !== null) gesperrt = Math.max(gesperrt ?? 0, laenge);
  }
  return { kostenpflichtig: kostenpflichtig ? true : frei ? false : null, woerter, koerper, gesperrt };
}

/** So viel Text im gesperrten Bereich heisst: die Seite liefert ihn mit aus. */
export const PAYWALL_GELIEFERT_MIN = 800;

/**
 * Ob unser Text wegen einer Paywall nur ein Anreisser ist, gemessen an dem, was
 * die Seite selbst angibt. true = kostenpflichtig und unvollstaendig, false =
 * frei oder trotz Markierung vollstaendig geliefert, null = keine Angabe.
 *
 * Aus der Pruefung vom 30.09.2026: FashionUnited und top agrar markieren
 * Artikel als kostenpflichtig, liefern den Text aber ganz im HTML und blenden
 * ihn erst im Browser aus. The Grocer und Adweek liefern ihn ebenfalls mit;
 * dort fehlte der Text, weil die Extraktion ihn nicht fand, nicht wegen der
 * Paywall. SZ, t3n, Business Insider und Tabak Zeitung nennen die Wortzahl des
 * ganzen Artikels, unser Text hat davon ein Zehntel.
 */
export function paywallMarkierung(zugang: SeitenZugang, text = ""): boolean | null {
  if (zugang.kostenpflichtig !== true) return zugang.kostenpflichtig;
  const inhalt = String(text || "").trim();
  const woerter = inhalt ? inhalt.split(/\s+/).length : 0;
  if (zugang.woerter !== null && zugang.woerter >= 30) return woerter < zugang.woerter * 0.7;
  if ((zugang.gesperrt ?? 0) >= PAYWALL_GELIEFERT_MIN) return false;
  if (zugang.koerper >= Math.max(1000, inhalt.length * 1.5)) return false;
  return true;
}

/** Kurzform fuer den Abruf: Markierung der Seite gemessen am extrahierten Text. */
export function paywallAusHtml(html: string, text = ""): boolean | null {
  return paywallMarkierung(seitenZugang(html), text);
}

export type PaywallBefund = { erkannt: boolean; beleg: string | null };

/**
 * Ob der gespeicherte Text wegen einer Paywall nur ein Anreisser ist.
 * markiert: Ergebnis von paywallMarkierung beim Abruf (null = unbekannt).
 * Spiegelt signal_layer.paywall_befund in der Datenbank.
 */
export function paywallBefund({ title, content, cleaned, markiert }: {
  title?: string | null; content?: string | null; cleaned?: string | null; markiert?: boolean | null;
}): PaywallBefund {
  const merkmal = paywallMerkmal(`${title || ""}\n${content || ""}`) || paywallMerkmal(cleaned || "");
  if (merkmal) return { erkannt: true, beleg: merkmal };
  const laenge = (cleaned ? cleaned : content || "").length;
  if (markiert === true && laenge < PAYWALL_MARKIERT_MAX) return { erkannt: true, beleg: "Seite als kostenpflichtig markiert" };
  return { erkannt: false, beleg: null };
}
