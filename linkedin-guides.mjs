/**
 * Schreibhilfen für die Felder, die der Nutzer selbst tippt.
 *
 * Die Zahlen sind nicht geraten: LinkedIn schneidet den Beitragstext im Feed
 * nach etwa 140 Zeichen auf dem Telefon und etwa 210 am Rechner ab, das harte
 * Limit liegt bei 3.000 Zeichen, und der Bereich mit der stärksten Interaktion
 * liegt zwischen 1.300 und 2.500 Zeichen. Für Dokumentbeiträge gelten 6 bis 12
 * Folien und 25 bis 50 Wörter je Folie als Arbeitsbereich; die Titelfolie
 * entscheidet, ob überhaupt gewischt wird.
 *
 * Quellen: authoredup.com/blog/linkedin-character-limit,
 * oktopost.com/blog/linkedin-carousel-pdf-best-practices,
 * aicarousels.com/blog/linkedin-carousel-design-tips-and-specs
 *
 * Bewusst nur Zahlen und Regeln, die der Nutzer nicht sieht, während er tippt.
 * Keine Ratschläge, die ohnehin im Feld stehen.
 */

export const LINKEDIN_LIMITS = {
  hookMobil: 140,
  hookDesktop: 210,
  captionStarkVon: 1_300,
  captionStarkBis: 2_500,
  captionHart: 3_000,
  captionCarouselMax: 900,
  slidesVon: 6,
  slidesBis: 12,
  worteJeFolieVon: 25,
  worteJeFolieBis: 50,
  ctaMax: 42,
  coverTitelMax: 56,
};

const ZAHL = /(?<!\d)\d+(?:[.,]\d+)?\s?(?:%|prozent|prozentpunkte|mio|mrd|millionen|milliarden|euro|€)?/gi;
const PROZENT = /(?<!\d)\d+(?:[.,]\d+)?\s?(?:%|prozent)/gi;
const ZITAT = /[„"»][^"“«]{12,}[""«]|[„"][^"“]{12,}/g;

const wortZahl = (text) => String(text || "").trim().split(/\s+/).filter(Boolean).length;
const satzZahl = (text) => String(text || "").split(/[.!?]+(?:\s|$)/).map((s) => s.trim()).filter(Boolean).length;

const URL_MUSTER = /\b(?:https?:\/\/|www\.)[^\s<>"']{4,}|\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\/[^\s<>"']*/i;

/** Die URL in einer Quellenangabe, falls eine drinsteht. */
export function erkenneUrl(text) {
  const treffer = String(text || "").match(URL_MUSTER);
  return treffer ? treffer[0].replace(/[.,;)]+$/, "") : "";
}

/** Erste Zeile des Beitragstexts: bis hierhin liest der Feed mit. */
export function ersteZeile(text) {
  const roh = String(text || "").replace(/\r/g, "");
  const bruch = roh.indexOf("\n");
  return (bruch === -1 ? roh : roh.slice(0, bruch)).trim();
}

/**
 * Was im Beleg steckt: Zahlen, Prozentwerte und wörtliche Zitate entscheiden,
 * welche Folienarten das Modell überhaupt bauen darf.
 */
export function belegProfil(text) {
  const roh = String(text || "");
  const zahlen = [...new Set((roh.match(ZAHL) || []).map((t) => t.trim()).filter((t) => /\d/.test(t) && t.replace(/\D/g, "").length >= 2))];
  const prozente = [...new Set((roh.match(PROZENT) || []).map((t) => t.trim()))];
  const zitate = (roh.match(ZITAT) || []).length;
  const moeglich = [];
  if (zahlen.length >= 1) moeglich.push("Große Kennzahl");
  if (zahlen.length >= 3) moeglich.push("Mehrere Kennzahlen", "Diagramme");
  if (zitate >= 1) moeglich.push("Zitat");
  return { zahlen: zahlen.length, prozente: prozente.length, zitate, moeglich };
}

function zeile(ton, text) {
  return { ton, text };
}

/**
 * Hinweise zu einem Feld. `kontext` trägt, was die Bewertung ändert: die Spur
 * (marketing/sales) und ob es ein Carousel wird.
 */
export function feldHinweise(key, wert, kontext = {}) {
  const text = String(wert || "");
  const laenge = text.trim().length;
  const carousel = Boolean(kontext.carousel);
  const sales = kontext.lane === "sales";
  const hinweise = [];

  if (key === "caption_text") {
    const hook = ersteZeile(text);
    const grenze = LINKEDIN_LIMITS.hookMobil;
    hinweise.push(hook.length === 0
      ? zeile("info", `Erste Zeile ist der Hook: ${grenze} Zeichen sind im Feed sichtbar, danach steht „mehr anzeigen“.`)
      : zeile(hook.length <= grenze ? "ok" : "warn",
        `Hook: ${hook.length} von ${grenze} Zeichen sichtbar${hook.length > grenze ? " — der Rest wird abgeschnitten" : ""}.`));
    if (hook.length && !/\n/.test(text.trim())) {
      hinweise.push(zeile("warn", "Kein Zeilenumbruch nach dem Hook: LinkedIn zeigt die erste Zeile dann mitten im Satz an."));
    }
    if (carousel) {
      hinweise.push(zeile(laenge <= LINKEDIN_LIMITS.captionCarouselMax ? "ok" : "warn",
        `${laenge} von ${LINKEDIN_LIMITS.captionCarouselMax} Zeichen. Beim Dokumentbeitrag führt der Text ins Carousel, er ersetzt es nicht.`));
    } else {
      const stark = laenge >= LINKEDIN_LIMITS.captionStarkVon && laenge <= LINKEDIN_LIMITS.captionStarkBis;
      hinweise.push(zeile(laenge > LINKEDIN_LIMITS.captionHart ? "warn" : stark ? "ok" : "info",
        `${laenge} Zeichen · stärkster Bereich ${LINKEDIN_LIMITS.captionStarkVon.toLocaleString("de-DE")}–${LINKEDIN_LIMITS.captionStarkBis.toLocaleString("de-DE")} · Limit ${LINKEDIN_LIMITS.captionHart.toLocaleString("de-DE")}`));
    }
    if (laenge > 200 && !/\?|\bwie\b|\bwas\b|\bwelche/i.test(text.slice(-220))) {
      hinweise.push(zeile("info", "Am Ende fehlt eine Frage oder ein Aufruf — ohne den kommentiert kaum jemand."));
    }
    return hinweise;
  }

  if (key === "cta_text") {
    hinweise.push(zeile(laenge === 0 ? "info" : laenge <= LINKEDIN_LIMITS.ctaMax ? "ok" : "warn",
      `${laenge} von ${LINKEDIN_LIMITS.ctaMax} Zeichen — mehr passt nicht auf die Endfolie.`));
    if (sales) {
      hinweise.push(zeile(/\?$/.test(text.trim()) ? "ok" : "info",
        "In der Ansprache wirkt eine Frage besser als eine Aufforderung."));
    } else if (laenge) {
      hinweise.push(zeile(/^[A-ZÄÖÜ][a-zäöüß]+(en|ern|eln)\b/.test(text.trim()) ? "ok" : "info",
        "Ein Verb am Anfang macht daraus eine Handlung: „Termin vereinbaren“, nicht „Mehr Infos“."));
    }
    return hinweise;
  }

  if (key === "storyline_text") {
    const saetze = satzZahl(text);
    hinweise.push(zeile(laenge === 0 ? "info" : saetze <= 2 ? "ok" : "warn",
      `${saetze} ${saetze === 1 ? "Satz" : "Sätze"} · ${laenge} Zeichen. Eine Aussage trägt das Asset, mehrere teilen es auf.`));
    if (carousel) {
      hinweise.push(zeile("info",
        `Das Modell verteilt die Aussage auf ${LINKEDIN_LIMITS.slidesVon}–${LINKEDIN_LIMITS.slidesBis} Folien mit je ${LINKEDIN_LIMITS.worteJeFolieVon}–${LINKEDIN_LIMITS.worteJeFolieBis} Wörtern.`));
    }
    if (laenge && !/\d/.test(text)) {
      hinweise.push(zeile("info", "Ohne Zahl in der Aussage bleibt die Titelfolie eine Behauptung."));
    }
    return hinweise;
  }

  if (key === "headline") {
    hinweise.push(zeile(laenge === 0 ? "info" : laenge <= LINKEDIN_LIMITS.coverTitelMax ? "ok" : "info",
      `${laenge} Zeichen · bis ${LINKEDIN_LIMITS.coverTitelMax} passt der Satz ohne Umbruch auf die Titelfolie.`));
    if (laenge) {
      hinweise.push(zeile(satzZahl(text) === 1 ? "ok" : "warn",
        satzZahl(text) === 1 ? "Ein Satz — so gehört es auf die Titelfolie." : "Mehr als ein Satz: die Titelfolie trägt nur einen."));
    }
    return hinweise;
  }

  if (key === "evidence") {
    const profil = belegProfil(text);
    hinweise.push(zeile(profil.zahlen ? "ok" : "warn",
      profil.zahlen
        ? `${profil.zahlen} ${profil.zahlen === 1 ? "Zahl" : "Zahlen"}${profil.prozente ? `, davon ${profil.prozente} in Prozent` : ""}${profil.zitate ? `, ${profil.zitate} ${profil.zitate === 1 ? "Zitat" : "Zitate"}` : ""} erkannt.`
        : "Keine Zahl erkannt — dann bleibt nur eine Textfolie ohne Kennzahl."));
    if (profil.moeglich.length) {
      hinweise.push(zeile("info", `Damit möglich: ${profil.moeglich.join(", ")}.`));
    }
    if (!profil.zitate) {
      hinweise.push(zeile("info", "Ein wörtliches Zitat in Anführungszeichen macht die Zitatfolie möglich."));
    }
    return hinweise;
  }

  if (key === "source") {
    const url = erkenneUrl(text);
    if (!laenge) {
      hinweise.push(zeile("info", "Am besten eine URL nennen. Ohne Quelle geht es weiter, dann nennt das Asset keinen Beleghinweis."));
      return hinweise;
    }
    hinweise.push(url
      ? zeile("ok", `Link erkannt: ${url}`)
      : zeile("warn", "Keine URL erkannt. Bitte die Quelle als Link angeben — oder ohne Link fortfahren, dann bleibt nur die Textangabe."));
    if (!url && !/\d{4}/.test(text)) {
      hinweise.push(zeile("info", "Ohne Link mindestens Herausgeber und Jahr nennen, sonst ist der Beleg nicht nachprüfbar."));
    }
    return hinweise;
  }

  if (key === "core") {
    const worte = wortZahl(text);
    hinweise.push(zeile(laenge === 0 ? "info" : satzZahl(text) >= 2 && satzZahl(text) <= 4 ? "ok" : "info",
      `${satzZahl(text)} Sätze · ${worte} Wörter. Zwei bis drei Sätze reichen dem Modell als Kern.`));
    return hinweise;
  }

  return hinweise;
}

/** Empfehlung zur Folienzahl, mit Begründung statt nackter Zahl. */
export function slideEmpfehlung(anzahl) {
  const n = Number(anzahl || 0);
  if (!n) return null;
  if (n < LINKEDIN_LIMITS.slidesVon) {
    return zeile("info", `${n} Folien sind knapp. Unter ${LINKEDIN_LIMITS.slidesVon} bleibt für Beleg und Abschluss kaum Platz.`);
  }
  if (n > LINKEDIN_LIMITS.slidesBis) {
    return zeile("warn", `${n} Folien liegen über dem Arbeitsbereich von ${LINKEDIN_LIMITS.slidesVon}–${LINKEDIN_LIMITS.slidesBis}: die letzten Folien sehen die wenigsten Leser.`);
  }
  return zeile("ok", `${n} Folien liegen im Bereich, in dem Dokumentbeiträge am weitesten gewischt werden.`);
}

/**
 * Auszeichnung der Hinweise. Liegt hier, damit beide Fragebogen dieselbe
 * Darstellung benutzen; das CSS steckt im geteilten Oberflaechen-Stil.
 */
export function guideMarkup(hinweise, esc = (v) => String(v ?? "")) {
  const zeilen = (hinweise || []).filter(Boolean);
  if (!zeilen.length) return "";
  const ZEICHEN = { ok: "fa-circle-check", warn: "fa-triangle-exclamation", info: "fa-circle-info" };
  return `<ul class="lg-guide">${zeilen.map((h) => `
    <li class="lg-guide-row lg-guide-row--${esc(h.ton)}"><i class="fa-solid ${ZEICHEN[h.ton] || ZEICHEN.info}"></i><span>${esc(h.text)}</span></li>`).join("")}</ul>`;
}
