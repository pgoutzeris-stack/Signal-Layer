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

/**
 * Was die Seite selbst ueber den Zugang sagt (schema.org isAccessibleForFree,
 * das Verlage fuer Google setzen). true = Inhalt kostenpflichtig, false = frei,
 * null = keine Angabe. Listen verwandter Artikel zaehlen nicht mit, nur der
 * Artikel selbst und seine Teile (hasPart).
 */
export function paywallAusHtml(html: string): boolean | null {
  const bloecke = String(html || "").match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  let frei: boolean | null = null;
  let kostenpflichtig = false;
  const pruefe = (knoten: unknown, tiefe: number): void => {
    if (!knoten || typeof knoten !== "object" || tiefe > 3) return;
    if (Array.isArray(knoten)) { knoten.forEach((k) => pruefe(k, tiefe)); return; }
    const k = knoten as Record<string, unknown>;
    const typ = Array.isArray(k["@type"]) ? k["@type"].join(" ") : String(k["@type"] || "");
    const wert = freiWert(k.isAccessibleForFree);
    if (wert !== null && (ARTIKEL_TYP.test(typ) || /webpageelement/i.test(typ) || !typ)) {
      if (wert === false) kostenpflichtig = true;
      else if (frei === null) frei = true;
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
        else if (frei === null) frei = true;
      }
    }
  }
  if (kostenpflichtig) return true;
  if (frei) return false;
  return null;
}

export type PaywallBefund = { erkannt: boolean; beleg: string | null };

/**
 * Ob der gespeicherte Text wegen einer Paywall nur ein Anreisser ist.
 * markiert: Ergebnis von paywallAusHtml beim Abruf (null = unbekannt).
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
