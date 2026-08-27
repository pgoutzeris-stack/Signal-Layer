/**
 * Manuelles Signal. Die Pipeline findet Signale in Artikeln; hier schreibt der
 * Nutzer eines selbst und erzeugt daraus ein Marketing- oder Sales-Asset.
 *
 * Der Fragebogen benutzt dieselbe Oberflaeche wie das Asset-Studio: dieselbe
 * Schiene links, dieselben Schrittkarten, dieselben Pillen. Das CSS kommt aus
 * asset-studio.js und wird nur auf die eigene Kennung umgeschrieben.
 *
 * Am Ende legt der Server Artikel- und Signalzeile an und das Asset-Studio
 * oeffnet mit vorbelegten Antworten: Profil, Modus und die schon geschriebenen
 * Texte stehen dort bereits, bleiben aber veraenderbar.
 */
import { ASSET_CHROME_CSS, openAssetStudio, closeAssetStudio } from "./asset-studio.js?v=20260828-1900";
import { feldHinweise, guideMarkup } from "./linkedin-guides.mjs?v=20260824-0305";

const OVERLAY_ID = "ms-overlay";
const OWN_CSS = ASSET_CHROME_CSS.replace(/#as-overlay/g, `#${OVERLAY_ID}`);

const DEFAULT_ESCAPE = (value) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Sonderschluessel der Abschlusskarte, wie im Asset-Studio. */
const ENDE = "__ende";

/** Sonderwert der Leistungsauswahl: eigener Text statt Katalogeintrag. */
const FREITEXT = "__frei";

/** Die 6P, in derselben Reihenfolge wie im Leistungskatalog der Einstellungen. */
const ROOTS_PILLARS = [
  ["planning", "Planning – Wachstumsstrategie"],
  ["purpose", "Purpose – Markenpositionierung"],
  ["presence", "Presence – Customer Experience"],
  ["people", "People – Marketing Capability"],
  ["productivity", "Productivity – Marketing Operations"],
  ["performance", "Performance – Marketing Analytics"],
];

/**
 * Die Fragen. `pflicht` entscheidet, ob „Weiter“ erst mit Inhalt greift;
 * optionale Fragen tragen einen Ueberspringen-Knopf. Reihenfolge ist die
 * Reihenfolge im Fragebogen.
 */
const FRAGEN = [
  {
    key: "weg", label: "Weg", frage: "Wie soll das Signal entstehen?", art: "pills",
    options: [["felder", "Manuell erstellen"], ["quelle", "Durch Transkript erzeugen"]],
    pflicht: true,
  },
  {
    key: "lane", label: "Asset", frage: "Was soll aus dem Signal entstehen?", art: "pills",
    options: [["marketing", "LinkedIn-Beitrag"], ["sales", "Ansprache an einen Kunden"]],
    pflicht: true,
  },
  {
    key: "profile", label: "Absender", frage: "Wer veröffentlicht den Beitrag?", art: "pills",
    options: [["roots", "ROOTS"], ["private", "Mein Privatprofil"]],
    when: (a) => a.lane === "marketing",
    pflicht: true,
  },
  {
    key: "quelle", label: "Quelle", frage: "Welche Adresse soll ausgelesen werden?", art: "quelle",
    platzhalter: "https://… Video, Artikel oder Beitrag",
    when: (a) => a.weg === "quelle",
    pflicht: true,
    fertig: (a) => String(a.quelle_url || "").trim().length >= 8,
    fehler: "Bitte eine vollständige Adresse eintragen.",
  },
  {
    key: "headline", label: "Signal", frage: "Wie lautet das Signal in einem Satz?", art: "text",
    platzhalter: "Handel baut Eigenmarken schneller aus als geplant",
    pflicht: true, min: 10,
  },
  {
    key: "core", label: "Kern", frage: "Was besagt das Signal im Kern?",
    art: "textarea", rows: 4,
    platzhalter: "Zwei bis drei Sätze: was passiert, bei wem, seit wann",
    pflicht: true, min: 30,
  },
  {
    key: "evidence", label: "Beleg", frage: "Was belegt diese Beobachtung?",
    art: "textarea", rows: 5,
    platzhalter: "Zahlen, Zitate und Namen im Wortlaut",
    pflicht: true, min: 20,
  },
  {
    key: "source", label: "Quelle", frage: "Woher stammt die Information?", art: "text",
    platzhalter: "https://… Link zur Studie oder Meldung",
  },
  {
    key: "company", label: "Unternehmen", art: "text", platzhalter: "Firmenname",
    frage: (a) => (a.lane === "sales"
      ? "Welches Unternehmen willst du ansprechen?"
      : "Um welches Unternehmen geht es?"),
  },
  {
    key: "offering", label: "Leistung", art: "auswahl", platzhalter: "Eigene Leistung eintragen",
    frage: (a) => (a.lane === "sales"
      ? "Welche ROOTS-Leistung willst du anbieten?"
      : "Welche ROOTS-Leistung schließt daran an?"),
  },
  {
    key: "territory", label: "Markt", frage: "Für welchen Markt gilt das?", art: "text",
    platzhalter: "z. B. DACH, Lebensmittelhandel",
  },
  {
    key: "occasion", label: "Anlass", frage: "Gibt es einen konkreten Anlass?", art: "text",
    platzhalter: "Messe, Quartalszahlen, Personalie",
  },
  {
    key: "competitor", label: "Benchmark", art: "text",
    frage: (a) => (a.lane === "sales"
      ? "Welche Wettbewerber des Kunden machen es schon vor?"
      : "Welche Wettbewerber des betroffenen Unternehmens machen es schon vor?"),
    platzhalter: "Firmennamen, z. B. Aldi Süd, dm, Rossmann",
  },
];

const STANDARD = { weg: "felder", lane: "marketing", profile: "roots", mode: "ai", quelle_url: "" };

/**
 * Vorbelegung für die Test- und Abnahmephase: jedes Feld traegt schon einen
 * brauchbaren Wert, damit ein Durchlauf keine fuenfzehn Eingaben braucht.
 * Wer tippt, ueberschreibt; wer die Spur wechselt, bekommt das Beispiel der
 * neuen Spur, solange er das Feld noch nicht selbst angefasst hat.
 */
const BEISPIEL = {
  marketing: {
    headline: "Handel baut Eigenmarken schneller aus als geplant",
    core: "Der Eigenmarkenanteil im Lebensmittelhandel steigt seit zwei Jahren deutlich schneller als von den Herstellern erwartet. Händler füllen mit eigenen Linien die Lücke, die Marken beim Preis offen lassen.",
    evidence: "Der Eigenmarkenanteil liegt bei 41 Prozent, 2024 waren es 34 Prozent. 68 Prozent der Käufer nennen den Preis als Hauptgrund.",
    source: "Handelsblatt, 2026",
    company: "Beispiel Handel AG",
    offering: "Markenstrategie",
    territory: "DACH, Lebensmittelhandel",
    occasion: "Quartalszahlen",
    competitor: "Aldi Süd, dm",
  },
  sales: {
    headline: "Beispiel Handel AG verliert Regalanteil an Eigenmarken",
    core: "Die eigene Marke des Kunden verliert im Lebensmittelhandel Fläche an Eigenmarken der Händler. Der Abstand hat sich in zwei Jahren mehr als verdoppelt.",
    evidence: "Der Eigenmarkenanteil liegt bei 41 Prozent, 2024 waren es 34 Prozent. Der Kunde nennt im Geschäftsbericht 12 Prozent Rückgang bei der Kernmarke.",
    source: "Geschäftsbericht 2026",
    company: "Beispiel Handel AG",
    offering: "Markenstrategie",
    territory: "DACH, Lebensmittelhandel",
    occasion: "Quartalszahlen",
    competitor: "Rossmann, dm",
  },
};

const EIGENES_CSS = `
#${OVERLAY_ID} .ms-split{
  display:grid; grid-template-columns:minmax(320px, 460px) minmax(0, 1fr);
  grid-template-rows:auto 1fr; gap:0 20px; align-items:stretch; width:100%;
}
#${OVERLAY_ID} .ms-kopf{display:flex; align-items:flex-end; padding-bottom:14px;}
#${OVERLAY_ID} .ms-kopf .as-progress{padding-bottom:0; width:100%;}
/* Die letzte Karte traegt keinen Abstand nach unten: sonst waere die Spalte
   um genau diesen Abstand hoeher als die Karte rechts. */
#${OVERLAY_ID} .ms-links{min-width:0;}
#${OVERLAY_ID} .ms-links > *:last-child{margin-bottom:0;}
#${OVERLAY_ID} .ms-rechts{min-width:0; display:flex;}
/* Die Signalkarte ist so hoch wie die Spalte links: gleicher Anfang, gleiches
   Ende. Ihr Inhalt bleibt oben. */
#${OVERLAY_ID} .ms-karte{
  flex:1; align-self:stretch;
  display:flex; flex-direction:column; gap:14px; padding:22px; border:1px solid var(--line,#e2e8f0);
  border-radius:16px; background:var(--bg,#fff); box-shadow:0 8px 26px rgba(15,23,42,.06);
}
#${OVERLAY_ID} .ms-karte .ms-fueller{flex:1;}
#${OVERLAY_ID} .ms-ddgroup{padding:8px 10px 4px; font-size:10px; font-weight:800; letter-spacing:.09em;
  text-transform:uppercase; color:var(--muted,#94a3b8);}
#${OVERLAY_ID} .ms-firmen{display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;}
#${OVERLAY_ID} .ms-firma{
  display:inline-flex; align-items:center; gap:6px; padding:5px 11px; border-radius:999px;
  border:1px solid var(--line,#e2e8f0); background:#fff; font:inherit; font-size:12px; font-weight:600;
  color:var(--ink,#0f172a); cursor:pointer; animation:lg-guide-in .18s cubic-bezier(.22,1,.36,1);
}
#${OVERLAY_ID} .ms-firma i{font-size:.62rem; color:var(--brand,#206efb);}
#${OVERLAY_ID} .ms-firma:hover{border-color:var(--brand,#206efb); color:var(--brand,#206efb);}
#${OVERLAY_ID} .ms-firma.is-erkannt{
  border-color:var(--brand,#206efb); background:var(--brand-light,#eff6ff); color:var(--brand-dark,#165fd9); cursor:default;
}
#${OVERLAY_ID} .as-tag.ms-tag-quelle{color:var(--brand,#206efb); border-color:currentColor; background:var(--brand-light,#eff6ff);}
#${OVERLAY_ID} .ms-ziehen{margin-top:8px;}
#${OVERLAY_ID} .ms-firma b{font-size:9px; font-weight:800; letter-spacing:.07em; text-transform:uppercase;
  padding:1px 6px; border-radius:999px; background:var(--brand,#206efb); color:#fff;}
/* Dieselbe Schwelle wie im Studio, und dieselbe Messgroesse: die Breite des
   Inhalts, nicht die des Fensters. */
@container (max-width: 860px){
  #${OVERLAY_ID} .ms-split{grid-template-columns:1fr; grid-template-rows:auto auto auto auto;}
  #${OVERLAY_ID} .ms-kopf:nth-of-type(2){display:none;}
}
#${OVERLAY_ID} .ms-karte h4{margin:0; font-size:22px; line-height:1.2; font-weight:700; color:var(--ink,#0f172a);}
#${OVERLAY_ID} .ms-karte p{margin:0; font-size:14px; line-height:1.5; color:var(--muted,#475569);}
#${OVERLAY_ID} .ms-karte .ms-leer{color:#94a3b8;}
#${OVERLAY_ID} .ms-beleg{
  border-left:3px solid var(--brand,#206efb); padding:2px 0 2px 12px; font-size:13px; line-height:1.5;
  color:var(--ink,#0f172a); white-space:pre-wrap;
}
#${OVERLAY_ID} .ms-chips{display:flex; flex-wrap:wrap; gap:6px;}
#${OVERLAY_ID} .ms-chip{
  font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase;
  color:var(--brand,#206efb); background:var(--brand-light,#eff6ff);
  border-radius:999px; padding:4px 10px;
}
#${OVERLAY_ID} .ms-fuss{display:flex; gap:8px; align-items:center; margin-top:4px;}
#${OVERLAY_ID} .ms-funde{margin-top:2px;}
#${OVERLAY_ID} .ms-funde .lg-guide-row{align-items:flex-start;}
#${OVERLAY_ID} .ms-fund-sprung{
  flex:0 0 auto; margin-left:auto; padding:3px 10px; border-radius:999px; cursor:pointer;
  border:1px solid currentColor; background:transparent; font:inherit; font-size:11px; font-weight:700;
  color:inherit;
}
#${OVERLAY_ID} .ms-fund-sprung:hover{background:var(--brand-light,#eff6ff);}
#${OVERLAY_ID} .ms-fund--blocker > i{color:var(--danger,#dc2626);}
#${OVERLAY_ID} .ms-pruefkopf{display:flex; align-items:center; gap:8px;}
`;

let offeneInstanz = null;

export function closeManualSignal() {
  if (offeneInstanz) offeneInstanz.close();
}

export function openManualSignal({ callApi, escapeHtml, openSettingsPanel, notify } = {}) {
  if (offeneInstanz) {
    if (offeneInstanz.lebt()) return offeneInstanz;
    offeneInstanz = null;
  }
  const esc = typeof escapeHtml === "function" ? escapeHtml : DEFAULT_ESCAPE;
  const api = typeof callApi === "function"
    ? callApi
    : async () => { throw new Error("Keine Verbindung zum Server verfügbar."); };
  const melde = typeof notify === "function" ? notify : () => {};

  const state = {
    answers: { ...STANDARD, ...BEISPIEL.marketing },
    // Selbst getippte Felder ueberlebt ein Spurwechsel.
    beruehrt: new Set(),
    firmen: [],
    firmenGeladen: false,
    quelleLaeuft: false,
    quelleBefund: null,
    ausQuelle: new Set(),
    // Pruefung des fertigen Signals. Sie gilt nur fuer die Antworten, mit denen
    // sie gelaufen ist: jede Aenderung macht sie ungueltig.
    pruefung: null,
    pruefungLaeuft: false,
    pruefungFrisch: false,
    pruefFehler: "",
    pruefTarif: null,
    freigabe: false,
    stepKey: "weg", busy: false, error: "", formError: "",
    // Leistungskatalog aus Supabase. Bis er da ist, bleibt nur das Freitextfeld.
    offerings: [], offeringsGeladen: false, offeringFrei: false,
  };

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Manuelles Signal");
  const style = document.createElement("style");
  style.textContent = `${OWN_CSS}\n${EIGENES_CSS}`;
  overlay.appendChild(style);
  const shell = document.createElement("div");
  shell.className = "ms-shell";
  shell.style.display = "contents";
  overlay.appendChild(shell);
  document.body.appendChild(overlay);

  const instanz = {
    lebt: () => overlay.isConnected,
    close: () => {
      overlay.remove();
      if (offeneInstanz === instanz) offeneInstanz = null;
      document.removeEventListener("keydown", onKey);
    },
  };
  offeneInstanz = instanz;

  /** Beispielwerte der Spur in alle Felder, die noch niemand angefasst hat. */
  function uebernimmBeispiel(lane) {
    // Wer die Quelle auslesen laesst, will keine Beispieltexte im Weg haben.
    if (state.answers.weg !== "felder") return;
    const vorlage = BEISPIEL[lane] || BEISPIEL.marketing;
    for (const [key, wert] of Object.entries(vorlage)) {
      if (!state.beruehrt.has(key)) state.answers[key] = wert;
    }
  }

  function aktiveFragen() {
    return FRAGEN.filter((q) => (typeof q.when === "function" ? q.when(state.answers) : true));
  }

  function wert(q) {
    return String(state.answers[q.key] ?? "");
  }

  /** Was LinkedIn vom Text erwartet: Hooklaenge, Limits, was der Beleg hergibt. */
  function schreibhilfe(key) {
    return guideMarkup(feldHinweise(key, state.answers[key], { lane: state.answers.lane }), esc);
  }

  /** Frage und Platzhalter dürfen je Spur anders lauten. */
  function textVon(feld) {
    return typeof feld === "function" ? feld(state.answers) : (feld || "");
  }

  function erledigt(q) {
    // Eine Karte mit zwei Feldern bringt ihre eigene Pruefung mit: eines von
    // beiden genuegt, und welches, weiss nur die Frage selbst.
    if (typeof q.fertig === "function") return q.fertig(state.answers) || !q.pflicht;
    const v = wert(q).trim();
    if (q.art === "pills") return Boolean(v);
    if (!q.pflicht) return true;
    return v.length >= (q.min || 1);
  }

  /** Beantwortet heisst: liegt vor dem offenen Schritt. */
  function schrittIndex(fragen) {
    if (state.stepKey === ENDE) return fragen.length;
    const i = fragen.findIndex((q) => q.key === state.stepKey);
    return i < 0 ? 0 : i;
  }

  function naechsterSchritt() {
    const fragen = aktiveFragen();
    const i = schrittIndex(fragen);
    for (let j = i + 1; j < fragen.length; j += 1) return fragen[j].key;
    return ENDE;
  }

  function vorigerSchritt() {
    const fragen = aktiveFragen();
    const i = schrittIndex(fragen);
    return i > 0 ? fragen[i - 1].key : fragen[0].key;
  }

  /** Jede Aenderung an einer Antwort macht den Befund ungueltig. */
  function verwerfePruefung() {
    state.pruefungFrisch = false;
    state.freigabe = false;
  }

  function setzeSchritt(key) {
    state.stepKey = key;
    state.formError = "";
    zeichne();
    // Am Ende des Fragebogens laeuft die Pruefung von selbst an: der Nutzer
    // soll nicht erst auf einen Knopf klicken muessen, um zu erfahren, dass
    // eine Zahl im Signal nicht belegt ist.
    if (key === ENDE && !state.pruefungFrisch && !state.pruefungLaeuft) void pruefeSignal();
  }

  function antwortLabel(q) {
    if (q.art === "quelle") return String(state.answers.quelle_url || "").trim() || "noch keine Quelle";
    const v = wert(q).trim();
    if (q.art === "pills") {
      const treffer = (q.options || []).find(([value]) => value === v);
      return treffer ? treffer[1] : v || "noch nicht gewählt";
    }
    if (!v) return "übersprungen";
    return v.length > 60 ? `${v.slice(0, 60)}…` : v;
  }

  /** Katalogleistung oder eigener Text. Wer nichts Passendes findet, tippt. */
  /** Leistungswahl im ROOTS-Aufklapper: dieselbe Form wie im Asset-Studio,
   *  kein Systemmenue des Browsers. Wer nichts Passendes findet, tippt. */
  function auswahlKoerper(q) {
    const v = wert(q).trim();
    const katalog = state.offerings.filter((item) => item.active !== false && item.label);
    const treffer = katalog.some((item) => item.label === v);
    const frei = state.offeringFrei || (Boolean(v) && !treffer) || !katalog.length;
    const kopf = frei
      ? "Eigene Leistung"
      : v || (state.offeringsGeladen && !katalog.length ? "Kein Leistungskatalog geladen" : "Leistung wählen");
    const zeilen = ROOTS_PILLARS.map(([pillar, titel]) => {
      const eintraege = katalog.filter((item) => item.pillar === pillar);
      if (!eintraege.length) return "";
      return `<div class="ms-ddgroup">${esc(titel)}</div>` + eintraege.map((item) => `
        <button type="button" class="as-ddrow${!frei && item.label === v ? " is-active" : ""}" data-act="leistung" data-value="${esc(item.label)}">
          <span class="as-ddtext">${esc(item.label)}</span>
          ${!frei && item.label === v ? '<span class="as-ddrow-add"><i class="fa-solid fa-check"></i></span>' : ""}
        </button>`).join("");
    }).join("");
    const feld = frei
      ? `<input class="as-free" data-feld="${esc(q.key)}" aria-label="${esc(q.label)}" placeholder="${esc(textVon(q.platzhalter))}" value="${esc(wert(q))}">`
      : "";
    return `<div class="as-dd as-dd--flow${state.ddOffen ? " is-open" : ""}">
      <button type="button" class="as-ddhead" data-act="leistung-auf" aria-expanded="${state.ddOffen ? "true" : "false"}">
        <span>${esc(kopf)}</span><i class="fa-solid fa-chevron-down"></i>
      </button>
      <div class="as-ddlist">
        ${zeilen}
        <button type="button" class="as-ddrow${frei ? " is-active" : ""}" data-act="leistung" data-value="${FREITEXT}">
          <span class="as-ddtext">Andere Leistung eintragen</span>
        </button>
      </div>
    </div>${feld}<div data-guide="${esc(q.key)}">${schreibhilfe(q.key)}</div>`;
  }

  /** Adresse, Knopf und der Befund der Quelle. */
  /**
   * Eine Adresse, ein Knopf. Was dahinter steckt, entscheidet der Server: bei
   * einem Video das Transkript ueber seine Kette, bei einer Seite den
   * Artikeltext, bei einer Seite mit Video beides.
   */
  function quelleKoerper(q) {
    const laeuft = state.quelleLaeuft;
    const adresse = String(state.answers.quelle_url || "");
    const feld = `<input class="as-free" data-feld="quelle_url" aria-label="Adresse"
      placeholder="${esc(textVon(q.platzhalter))}" value="${esc(adresse)}">`;
    const knopf = `<button type="button" class="as-btn as-btn--primary ms-ziehen" data-act="quelle-ziehen"${laeuft || adresse.trim().length < 8 ? " disabled" : ""}>
      ${laeuft
        ? '<i class="fa-solid fa-circle-notch fa-spin"></i>Quelle wird gelesen'
        : '<i class="fa-solid fa-wand-magic-sparkles"></i>Signal aus der Quelle ziehen'}</button>`;
    return `${feld}<div class="ms-fuss">${knopf}</div>${befundHtml(state.quelleBefund)}`;
  }

  /** Was die Quelle hergab und was noch fehlt. Zahlen statt Zuversicht. */
  function befundHtml(befund) {
    if (!befund) return "";
    if (befund.fehler) {
      return guideMarkup([{ ton: "warn", text: befund.fehler }], esc);
    }
    const artName = {
      transcript: "Transkript", article: "Artikeltext", description: "Videobeschreibung",
      mixed: "Artikeltext und Videotranskript",
    };
    const urteil = { tragfaehig: "ok", duenn: "warn", untauglich: "warn" }[befund.verdict] || "info";
    const zeilen = [
      { ton: "ok", text: `${artName[befund.art] || "Text"} gelesen · ${Number(befund.zeichen || 0).toLocaleString("de-DE")} Zeichen${befund.plattform ? ` · ${befund.plattform}` : ""}${befund.weg ? ` · ${befund.weg}` : ""}` },
      { ton: urteil, text: `Signalqualität: ${befund.verdict}${befund.verdictReason ? ` · ${befund.verdictReason}` : ""}` },
    ];
    if (befund.teile?.length > 1) zeilen.push({ ton: "ok", text: `Zusammengelegt: ${befund.teile.join(" + ")}` });
    if (befund.hinweis) zeilen.push({ ton: "info", text: befund.hinweis });
    if (befund.gefuellt?.length) {
      zeilen.push({ ton: "ok", text: `Aus der Quelle gefüllt: ${befund.gefuellt.map(feldName).join(", ")}` });
    }
    if (befund.missing?.length) {
      zeilen.push({ ton: "warn", text: `Bitte selbst ergänzen: ${befund.missing.map(feldName).join(", ")}` });
    }
    return guideMarkup(zeilen, esc);
  }

  function feldName(key) {
    return (FRAGEN.find((frage) => frage.key === key) || { label: key }).label;
  }

  function koerper(q) {
    if (q.art === "pills") {
      const pillen = q.options.map(([value, label]) => `
        <button type="button" class="as-opt as-opt--btn${wert(q) === value ? " is-active" : ""}"
          data-act="pick" data-key="${esc(q.key)}" data-value="${esc(value)}"
          aria-pressed="${wert(q) === value ? "true" : "false"}"><span>${esc(label)}</span></button>`).join("");
      return `<div class="as-opts">${pillen}</div>`;
    }
    if (q.art === "auswahl") return auswahlKoerper(q);
    if (q.art === "quelle") return quelleKoerper(q);
    const gemeinsam = `class="as-free" data-feld="${esc(q.key)}" aria-label="${esc(q.label)}" placeholder="${esc(textVon(q.platzhalter))}"`;
    const feld = q.art === "textarea"
      ? `<textarea ${gemeinsam} rows="${q.rows || 4}">${esc(wert(q))}</textarea>`
      : `<input ${gemeinsam} value="${esc(wert(q))}">`;
    const firmen = q.key === "competitor" || q.key === "company" ? firmenPillen(q.key) : "";
    return `${feld}${firmen}<div data-guide="${esc(q.key)}">${schreibhilfe(q.key)}</div>`;
  }

  /** Ein Fund, der die Uebernahme sperrt, bis er behoben oder freigegeben ist. */
  function blockiertJetzt() {
    const befund = state.pruefung;
    if (!befund || !state.pruefungFrisch) return false;
    return Boolean(befund.blocker) || befund.verdict === "untauglich";
  }

  /** Der Befund als Zeilen: Urteil, Quellenlage, Luecken, dann die Funde. */
  function pruefBefundHtml() {
    if (state.pruefungLaeuft) {
      return guideMarkup([{ ton: "info", text: "Die Angaben werden gegen die Quelle geprüft." }], esc);
    }
    if (state.pruefFehler) {
      return guideMarkup([{ ton: "warn", text: state.pruefFehler }], esc);
    }
    const befund = state.pruefung;
    if (!befund) return "";
    const zeilen = [];
    if (!state.pruefungFrisch) {
      zeilen.push({ ton: "info", text: "Der Befund stammt von vorher, seither wurden Antworten geändert." });
    }
    const urteil = { tragfaehig: "ok", duenn: "warn", untauglich: "warn" }[befund.verdict] || "info";
    zeilen.push({ ton: urteil, text: `Signalqualität: ${befund.verdict}${befund.verdictReason ? ` · ${befund.verdictReason}` : ""}` });
    zeilen.push(befund.quelleGeprueft
      ? { ton: "ok", text: "Jede Angabe aus der Quelle wurde dort nachgeschlagen." }
      : { ton: "info", text: befund.quellenFehler
        ? `Ohne Quelle geprüft: ${befund.quellenFehler}`
        : "Ohne Quelle geprüft, nur die Angaben selbst." });
    if (befund.missing?.length) {
      zeilen.push({ ton: "warn", text: `Fehlt noch: ${befund.missing.map(feldName).join(", ")}` });
    }
    const ZEICHEN = { blocker: "fa-circle-exclamation", warn: "fa-triangle-exclamation", info: "fa-circle-info" };
    const funde = (befund.findings || []).map((fund) => {
      const ton = fund.severity === "info" ? "info" : "warn";
      const sprung = fund.field
        ? `<button type="button" class="ms-fund-sprung" data-act="goto" data-key="${esc(fund.field)}">${esc(feldName(fund.field))}</button>`
        : "";
      return `<li class="lg-guide-row lg-guide-row--${ton}${fund.severity === "blocker" ? " ms-fund--blocker" : ""}">
        <i class="fa-solid ${ZEICHEN[fund.severity] || ZEICHEN.warn}"></i><span>${esc(fund.note)}</span>${sprung}</li>`;
    }).join("");
    return `${guideMarkup(zeilen, esc)}${funde ? `<ul class="lg-guide ms-funde">${funde}</ul>` : ""}`;
  }

  /**
   * Die Knoepfe am Ende. Solange ein Fund die Uebernahme sperrt, ist der Weg
   * nach vorn das Nachbessern; uebernehmen kann man trotzdem, aber nur mit
   * einem ausdruecklichen Klick, der das auch so nennt.
   */
  function endeKnoepfe() {
    if (state.pruefungLaeuft) {
      return `<button type="button" class="as-btn as-btn--primary" disabled><i class="fa-solid fa-circle-notch fa-spin"></i>Signal wird geprüft</button>`;
    }
    if (state.busy) {
      return `<button type="button" class="as-btn as-btn--primary" disabled><i class="fa-solid fa-spinner fa-spin"></i>Signal wird angelegt</button>`;
    }
    const uebernehmenKnopf = `<button type="button" class="as-btn as-btn--primary" data-act="submit"><i class="fa-solid fa-arrow-right"></i>Signal übernehmen</button>`;
    if (!state.pruefungFrisch || !state.pruefung) {
      // Im Spitzentarif kostet der Aufruf das Doppelte. Das steht auf dem
      // Knopf, damit der zweite Klick eine Zustimmung ist und kein Versehen.
      const tarif = state.pruefTarif
        ? `<i class="fa-solid fa-wand-magic-sparkles"></i>Im Spitzentarif prüfen (${esc(state.pruefTarif.faktor || 2)}-facher Preis)`
        : '<i class="fa-solid fa-wand-magic-sparkles"></i>Signal prüfen';
      return `${state.pruefung ? uebernehmenKnopf : ""}
        <button type="button" class="as-btn${state.pruefung ? "" : " as-btn--primary"}" data-act="pruefen">${tarif}</button>`;
    }
    if (blockiertJetzt() && !state.freigabe) {
      const ersterFund = (state.pruefung.findings || []).find((fund) => fund.severity === "blocker" && fund.field)
        || (state.pruefung.findings || []).find((fund) => fund.field);
      return `${ersterFund
        ? `<button type="button" class="as-btn as-btn--primary" data-act="goto" data-key="${esc(ersterFund.field)}"><i class="fa-solid fa-pen"></i>${esc(feldName(ersterFund.field))} nachbessern</button>`
        : `<button type="button" class="as-btn as-btn--primary" data-act="pruefen"><i class="fa-solid fa-rotate"></i>Erneut prüfen</button>`}
        <button type="button" class="as-btn" data-act="freigeben">Auf eigene Verantwortung übernehmen</button>`;
    }
    return `${uebernehmenKnopf}
      <button type="button" class="as-btn" data-act="pruefen"><i class="fa-solid fa-rotate"></i>Erneut prüfen</button>`;
  }

  function fortschrittHtml(fragen, index) {
    const gesamt = fragen.length + 1;
    const breite = Math.round(((index + 1) / gesamt) * 100);
    const text = state.stepKey === ENDE ? "Bereit" : `Frage ${index + 1} von ${fragen.length}`;
    return `<div class="as-progress">
      <div class="as-progress-bar"><span style="width:${breite}%"></span></div>
      <span class="as-progress-text">${esc(text)}</span>
    </div>`;
  }

  function formHtml() {
    const fragen = aktiveFragen();
    const index = schrittIndex(fragen);
    const beantwortet = fragen.slice(0, index).map((q, i) => `
      <button type="button" class="as-step as-step--done" data-act="goto" data-key="${esc(q.key)}">
        <span class="as-step-nr">${i + 1}</span>
        <span class="as-step-label">${esc(q.label)}</span>
        <span class="as-step-wert">${esc(antwortLabel(q))}</span>
        <span class="as-step-stift"><i class="fa-solid fa-pen"></i></span>
      </button>`).join("");
    const offen = fragen[index];
    const karte = offen
      ? `<div class="as-step as-step--open" data-stepcard>
          <div class="as-step-kopf">
            <span class="as-step-nr">${index + 1}</span>
            <label>${esc(textVon(offen.frage) || offen.label)}</label>
            ${state.ausQuelle.has(offen.key) ? '<i class="as-tag ms-tag-quelle">aus der Quelle</i>' : ""}
            ${offen.pflicht ? "" : '<i class="as-tag">Optional</i>'}
          </div>
          ${offen.hinweis ? `<p class="as-hint">${esc(offen.hinweis)}</p>` : ""}
          ${koerper(offen)}
          ${state.formError ? `<p class="as-form-error">${esc(state.formError)}</p>` : ""}
          <div class="as-step-fuss">
            ${index > 0 ? '<button type="button" class="as-btn as-step-zurueck" data-act="back"><i class="fa-solid fa-arrow-left"></i>Zurück</button>' : ""}
            ${offen.pflicht ? "" : '<button type="button" class="as-btn" data-act="skip">Überspringen</button>'}
            <button type="button" class="as-btn as-btn--primary as-step-weiter" data-act="next">Weiter<i class="fa-solid fa-arrow-right"></i></button>
          </div>
        </div>`
      : `<div class="as-step as-step--open" data-stepcard>
          <div class="as-step-kopf">
            <span class="as-step-nr">${state.pruefungLaeuft ? '<i class="fa-solid fa-circle-notch fa-spin"></i>' : '<i class="fa-solid fa-check"></i>'}</span>
            <label>${state.pruefungLaeuft ? "Prüfung läuft" : blockiertJetzt() ? "Prüfung: nachbessern" : "Bereit"}</label>
            ${state.freigabe ? '<i class="as-tag ms-tag-quelle">auf eigene Verantwortung</i>' : ""}
          </div>
          ${pruefBefundHtml()}
          ${state.error ? `<p class="as-form-error">${esc(state.error)}</p>` : ""}
          <div class="as-step-fuss">
            <button type="button" class="as-btn" data-act="back"><i class="fa-solid fa-arrow-left"></i>Zurück</button>
            ${endeKnoepfe()}
          </div>
        </div>`;
    return `${beantwortet}${karte}`;
  }

  /** Rechts steht das Signal, wie es das Modell lesen wird. */
  function karteHtml() {
    const a = state.answers;
    const chips = [
      a.lane === "sales" ? "Ansprache" : "LinkedIn",
      a.lane === "marketing" && a.profile === "private" ? "Privatprofil" : "ROOTS",
      a.company, a.territory, a.offering,
    ].filter(Boolean).map((text) => `<span class="ms-chip">${esc(text)}</span>`).join("");
    return `<div class="ms-karte">
      <div class="ms-chips">${chips}</div>
      <h4${a.headline ? "" : ' class="ms-leer"'}>${esc(a.headline || "Überschrift des Signals")}</h4>
      <p${a.core ? "" : ' class="ms-leer"'}>${esc(a.core || "Kern des Signals")}</p>
      ${a.evidence ? `<div class="ms-beleg">${esc(a.evidence)}</div>` : ""}
      ${a.source ? `<p>Quelle: ${esc(a.source)}</p>` : ""}
      <span class="ms-fueller"></span>
    </div>`;
  }

  function zeichne() {
    const fragen = aktiveFragen();
    const index = schrittIndex(fragen);
    shell.innerHTML = `
      <nav class="as-rail">
        <button type="button" class="as-back" data-act="close"><i class="fa-solid fa-arrow-left"></i>Zurück</button>
        <span class="as-railtitle">Manuelles Signal</span>
        <ol class="as-steps">
          <li data-state="active"><b>1</b>Signal beschreiben</li>
          <li><b>2</b>Asset erzeugen</li>
        </ol>
      </nav>
      <div class="as-main">
        <header class="as-topbar">
          <h2>Manuelles Signal</h2>
        </header>
        <div class="as-content">
          <div class="ms-split">
            <div class="ms-kopf">${fortschrittHtml(fragen, index)}</div>
            <div class="ms-kopf"><span class="as-prev-label">Signal</span></div>
            <div class="ms-links">${formHtml()}</div>
            <div class="ms-rechts">${karteHtml()}</div>
          </div>
        </div>
      </div>`;
    // Nach dem Sprung steht die offene Karte weit unten. Ohne Nachziehen
    // klickt man auf "Weiter" und sieht die naechste Frage nicht. Gerechnet
    // wird der Abstand selbst: scrollIntoView haengt am Kompositor und bleibt
    // in einem Hintergrund-Tab stehen.
    const karte = shell.querySelector("[data-stepcard]");
    const box = karte && karte.closest(".as-content");
    if (karte && box && box.scrollHeight > box.clientHeight) {
      const kr = karte.getBoundingClientRect();
      const br = box.getBoundingClientRect();
      const ziel = box.scrollTop + (kr.top - br.top) - Math.max(0, (br.height - kr.height) / 2);
      // Direkt gesetzt statt scrollTo({behavior:"smooth"}): das weiche Scrollen
      // liegt beim Kompositor und passierte in manchen Fenstern gar nicht.
      // Die Karte faehrt ohnehin mit ihrer eigenen Bewegung ein.
      box.scrollTop = Math.max(0, ziel);
    }
    const feld = karte && karte.querySelector("[data-feld]");
    if (feld && index < fragen.length) feld.focus({ preventScroll: true });
  }

  function pruefeOffen() {
    const fragen = aktiveFragen();
    const offen = fragen[schrittIndex(fragen)];
    if (!offen) return true;
    if (erledigt(offen)) return true;
    const laenge = wert(offen).trim().length;
    state.formError = offen.fehler
      ? offen.fehler
      : offen.art === "pills"
        ? "Bitte eine Antwort wählen."
        : laenge
          ? `Noch ${(offen.min || 1) - laenge} Zeichen zu kurz.`
          : `Diese Angabe braucht das Asset. Mindestens ${offen.min || 1} Zeichen.`;
    zeichne();
    return false;
  }

  /**
   * Quelle lesen und daraus die Felder fuellen. Was das Modell nicht belegen
   * kann, bleibt leer und steht im Befund: die Luecken traegt der Nutzer nach,
   * sonst waere die Belegpflicht spaeter nicht zu halten.
   */
  async function zieheQuelle() {
    const adresse = String(state.answers.quelle_url || "").trim();
    if (state.quelleLaeuft || adresse.length < 8) return;
    state.quelleLaeuft = true;
    state.quelleBefund = null;
    zeichne();
    try {
      const res = await api("draft_manual_signal_from_url", { url: adresse, lane: state.answers.lane });
      const quelle = res?.source || {};
      if (!res?.draft) {
        state.quelleBefund = { fehler: quelle.grund || res?.message || "Die Quelle gab keinen brauchbaren Text her." };
        return;
      }
      const felder = res.draft.felder || {};
      const gefuellt = [];
      for (const [key, wertNeu] of Object.entries(felder)) {
        if (!wertNeu) continue;
        // Selbst getippte Felder bleiben stehen: die Quelle ergaenzt, sie ueberschreibt nicht.
        if (state.beruehrt.has(key)) continue;
        state.answers[key] = wertNeu;
        state.ausQuelle.add(key);
        gefuellt.push(key);
      }
      verwerfePruefung();
      state.quelleBefund = {
        art: quelle.art, plattform: quelle.plattform, zeichen: quelle.zeichen,
        weg: quelle.weg || "", teile: quelle.teile || [],
        hinweis: quelle.grund || "",
        verdict: res.draft.verdict, verdictReason: res.draft.verdictReason,
        missing: res.draft.missing || [], gefuellt,
      };
      melde(res.draft.verdict === "tragfaehig"
        ? "Signal aus der Quelle gezogen."
        : "Quelle gelesen, aber Felder fehlen.", res.draft.verdict === "tragfaehig" ? "success" : "info");
    } catch (fehler) {
      state.quelleBefund = { fehler: fehler?.message || "Die Quelle war nicht lesbar." };
    } finally {
      state.quelleLaeuft = false;
      zeichne();
    }
  }

  /** Die Adresse, aus der gezogen wurde. Leer, wenn selbst geschrieben. */
  function quellenAdresse() {
    return state.answers.weg === "quelle" ? String(state.answers.quelle_url || "").trim() : "";
  }

  /** Die Felder des Signals, wie Server und Modell sie lesen. */
  function signalFelder() {
    const a = state.answers;
    return {
      lane: a.lane, mode: a.mode, headline: a.headline, core: a.core, evidence: a.evidence,
      source: a.source, company: a.company, offering: a.offering,
      territory: a.territory, occasion: a.occasion, competitor: a.competitor,
    };
  }

  /**
   * Die Pruefung vor dem Anlegen. Was aus der Quelle gezogen wurde, schlaegt
   * das Modell dort nach; was der Nutzer selbst nachgetragen hat, wird gegen
   * die Quelle gehalten und auf Konkretheit geprueft. Der Server holt die
   * Quelle dafuer selbst noch einmal: nur so prueft sich der Entwurf nicht
   * selbst.
   */
  async function pruefeSignal({ spitzentarif = false } = {}) {
    if (state.pruefungLaeuft) return;
    state.pruefungLaeuft = true;
    state.pruefFehler = "";
    state.pruefTarif = null;
    zeichne();
    try {
      const res = await api("check_manual_signal", {
        signal: signalFelder(),
        // Geprueft wird gegen dieselbe Quelle, aus der gezogen wurde: der
        // Server liest sie noch einmal selbst.
        url: quellenAdresse(),
        from_source: [...state.ausQuelle],
        accept_peak: spitzentarif === true,
      });
      if (!res?.check) {
        state.pruefFehler = res?.message || "Die Prüfung ist nicht durchgelaufen.";
        state.pruefTarif = res?.blocked === "peak_tariff" ? (res.pricing || null) : null;
        return;
      }
      state.pruefung = {
        ...res.check,
        quelleGeprueft: res.source_checked === true,
        quellenFehler: res.source_error || "",
      };
      state.pruefungFrisch = true;
      state.freigabe = false;
      const blocker = Boolean(res.check.blocker) || res.check.verdict === "untauglich";
      melde(blocker
        ? "Die Prüfung hat etwas gefunden, das im Asset nicht belegt wäre."
        : res.check.verdict === "tragfaehig" ? "Signal geprüft, es trägt." : "Signal geprüft, es bleibt dünn.",
      blocker ? "error" : res.check.verdict === "tragfaehig" ? "success" : "info");
    } catch (fehler) {
      state.pruefFehler = fehler?.message || "Die Prüfung war nicht erreichbar.";
    } finally {
      state.pruefungLaeuft = false;
      zeichne();
    }
  }

  /** Antworten fuer den Asset-Fragebogen. Dieselben Schluessel, damit dort
   *  nichts uebersetzt werden muss. */
  function assetVorbelegung() {
    const a = state.answers;
    // Wer die Texte schreibt, entscheidet der Asset-Fragebogen: dort entsteht
    // der Text. Das manuelle Signal liefert nur den Stoff.
    const out = {
      storyline: "auto",
      cta: "auto",
      sources: a.source ? "custom" : "auto",
      sources_text: a.source,
    };
    if (a.lane === "marketing") {
      out.profile = a.profile;
    } else if (a.company) {
      out.company_named = "yes";
      out.company_mode = "custom";
      out.company_text = a.company;
    }
    return out;
  }

  async function uebernehmen() {
    if (state.busy || state.pruefungLaeuft) return;
    // Ohne gueltigen Befund wird erst geprueft: ein Asset mit unbelegter Zahl
    // ist teurer als ein Modellaufruf.
    if (!state.pruefungFrisch && !state.freigabe) { void pruefeSignal(); return; }
    if (blockiertJetzt() && !state.freigabe) {
      state.error = "Die Prüfung hat einen Fund, der so nicht ins Asset darf. Nachbessern oder ausdrücklich freigeben.";
      zeichne();
      return;
    }
    state.busy = true;
    state.error = "";
    zeichne();
    try {
      const a = state.answers;
      const res = await api("create_manual_signal", { signal: signalFelder() });
      const articleId = res && (res.article_id || res.articleId);
      if (!articleId) throw new Error("Der Server hat kein Signal zurückgegeben.");
      instanz.close();
      openAssetStudio({
        kind: a.lane === "sales" ? "memo" : "linkedin",
        articleId,
        signal: res.signal || {},
        callApi: api,
        escapeHtml: esc,
        openSettingsPanel,
        notify,
        prefill: assetVorbelegung(),
      });
    } catch (fehler) {
      state.busy = false;
      state.error = fehler && fehler.message ? fehler.message : "Das Signal konnte nicht angelegt werden.";
      melde(state.error, "error");
      zeichne();
    }
  }

  function onKey(event) {
    if (event.key === "Escape") instanz.close();
  }

  overlay.addEventListener("click", (event) => {
    const hit = event.target.closest("[data-act]");
    if (!hit || !overlay.contains(hit)) return;
    const act = hit.getAttribute("data-act");
    if (act === "close") { instanz.close(); return; }
    if (act === "pick") {
      const key = hit.getAttribute("data-key");
      state.answers[key] = hit.getAttribute("data-value");
      verwerfePruefung();
      if (key === "lane") uebernimmBeispiel(state.answers.lane);
      if (key === "weg" && hit.getAttribute("data-value") !== "felder") {
        for (const feld of Object.keys(BEISPIEL.marketing)) {
          if (!state.beruehrt.has(feld)) state.answers[feld] = "";
        }
      }
      state.formError = "";
      // Eine Pille beantwortet die Frage vollstaendig, also weiter - wie im
      // Asset-Fragebogen.
      setzeSchritt(naechsterSchritt());
      return;
    }
    if (act === "leistung-auf") { state.ddOffen = !state.ddOffen; zeichne(); return; }
    if (act === "leistung") {
      const wahl = hit.getAttribute("data-value");
      state.beruehrt.add("offering");
      state.offeringFrei = wahl === FREITEXT;
      state.answers.offering = wahl === FREITEXT ? "" : wahl;
      verwerfePruefung();
      state.ddOffen = false;
      state.formError = "";
      zeichne();
      return;
    }
    if (act === "firma") {
      // Erkanntes Unternehmen anhaengen, statt es tippen zu lassen. Der
      // Steckbrief greift nur bei genau diesem Namen.
      const name = hit.getAttribute("data-value") || "";
      const key = hit.getAttribute("data-key") || "competitor";
      const bisher = String(state.answers[key] || "").trim();
      const teile = bisher ? bisher.split(/\s*,\s*/).filter(Boolean) : [];
      if (!teile.some((eintrag) => eintrag.toLowerCase() === name.toLowerCase())) teile.push(name);
      state.answers[key] = teile.join(", ");
      state.beruehrt.add(key);
      verwerfePruefung();
      zeichne();
      return;
    }
    if (act === "quelle-ziehen") { void zieheQuelle(); return; }
    if (act === "pruefen") { void pruefeSignal({ spitzentarif: Boolean(state.pruefTarif) }); return; }
    if (act === "freigeben") {
      // Ausdrueckliche Uebernahme trotz Fund. Sie steht danach als Merkmal in
      // der Karte, damit sie nicht in Vergessenheit geraet.
      state.freigabe = true;
      state.error = "";
      void uebernehmen();
      return;
    }
    if (act === "next") { if (pruefeOffen()) setzeSchritt(naechsterSchritt()); return; }
    if (act === "skip") { setzeSchritt(naechsterSchritt()); return; }
    if (act === "back") { setzeSchritt(vorigerSchritt()); return; }
    if (act === "goto") { setzeSchritt(hit.getAttribute("data-key")); return; }
    if (act === "submit") { void uebernehmen(); return; }
  });

  overlay.addEventListener("input", (event) => {
    const feld = event.target.closest("[data-feld]");
    if (!feld) return;
    const key = feld.getAttribute("data-feld");
    state.beruehrt.add(key);
    state.answers[key] = feld.value;
    verwerfePruefung();
    const hilfe = shell.querySelector(`[data-guide="${key}"]`);
    if (hilfe) hilfe.innerHTML = schreibhilfe(key);
    if (key === "quelle_url") {
      // Der Knopf haengt am Inhalt des Feldes. Ohne dieses Nachziehen bleibt er
      // gesperrt, bis irgendetwas anderes die Karte neu zeichnet.
      const knopf = shell.querySelector('[data-act="quelle-ziehen"]');
      if (knopf) knopf.disabled = state.quelleLaeuft || String(feld.value).trim().length < 8;
    }
    if (key === "competitor" || key === "company") {
      const firmen = shell.querySelector(".ms-firmen");
      const neu = firmenPillen(key);
      if (firmen) firmen.outerHTML = neu;
      else if (neu && hilfe) hilfe.insertAdjacentHTML("beforebegin", neu);
    }
    const host = shell.querySelector(".ms-rechts");
    if (host) host.innerHTML = karteHtml();
  });



  /** Tier-1-Unternehmen aus Supabase. Nur diese Namen haben spaeter einen
   *  Steckbrief; alles andere darf man trotzdem eintragen. */
  async function ladeFirmen() {
    try {
      const res = await api("list_known_companies");
      state.firmen = Array.isArray(res?.companies) ? res.companies : [];
    } catch (_fehler) {
      state.firmen = [];
    }
    state.firmenGeladen = true;
    zeichne();
  }

  /** Treffer im getippten Text: Name oder Aliasname eines Tier-1-Unternehmens. */
  function erkannteFirmen(text) {
    const roh = String(text || "").toLowerCase();
    if (!roh.trim() || !state.firmen.length) return [];
    return state.firmen.filter((firma) => {
      const namen = [firma.name, ...(firma.aliases || [])].filter(Boolean);
      return namen.some((name) => {
        const wort = String(name).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(^|[^a-zäöüß0-9])${wort}([^a-zäöüß0-9]|$)`, "i").test(roh);
      });
    }).slice(0, 6);
  }

  /** Vorschlaege, solange nichts erkannt ist: die haeufigsten Tier-1-Namen. */
  function firmenPillen(key) {
    if (!state.firmenGeladen || !state.firmen.length) return "";
    const wertJetzt = String(state.answers[key] || "");
    const erkannt = erkannteFirmen(wertJetzt);
    if (erkannt.length) {
      return `<div class="ms-firmen">${erkannt.map((firma) => `
        <span class="ms-firma is-erkannt" title="${esc(firma.name)}${firma.has_profile ? " mit Steckbrief" : ""}">
          <i class="fa-solid fa-circle-check"></i>${esc(firma.name)}${firma.has_profile ? '<b>Steckbrief</b>' : ""}
        </span>`).join("")}</div>`;
    }
    const suche = wertJetzt.split(/\s*,\s*/).pop().trim().toLowerCase();
    const vorschlag = (suche.length >= 2
      ? state.firmen.filter((firma) => [firma.name, ...(firma.aliases || [])]
        .some((name) => String(name).toLowerCase().startsWith(suche)))
      : state.firmen.filter((firma) => firma.has_profile)).slice(0, 6);
    if (!vorschlag.length) return "";
    return `<div class="ms-firmen">${vorschlag.map((firma) => `
      <button type="button" class="ms-firma" data-act="firma" data-key="${esc(key)}" data-value="${esc(firma.name)}">
        <i class="fa-solid fa-plus"></i>${esc(firma.name)}
      </button>`).join("")}</div>`;
  }

  /** Der Leistungskatalog steht in Supabase; ohne ihn bleibt das Freitextfeld. */
  async function ladeLeistungen() {
    try {
      const res = await api("list_offerings");
      state.offerings = (res && res.offerings) || [];
    } catch {
      state.offerings = [];
    }
    state.offeringsGeladen = true;
    if (instanz.lebt()) zeichne();
  }

  document.addEventListener("keydown", onKey);
  zeichne();
  void ladeLeistungen();
  void ladeFirmen();
  closeAssetStudio();
  return instanz;
}
