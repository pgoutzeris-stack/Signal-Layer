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
import { ASSET_CHROME_CSS, openAssetStudio, closeAssetStudio } from "./asset-studio.js?v=20260821-0020";
import { feldHinweise, guideMarkup } from "./linkedin-guides.mjs?v=20260821-0020";

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
    platzhalter: "https://… — Link zur Studie, Meldung oder Seite",
    hinweis: "Am besten die URL einsetzen. Ohne Link nur Herausgeber und Jahr — oder überspringen.",
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
    hinweis: "Namen nennen, keine Kategorien: das Asset zitiert sie.",
  },
];

const STANDARD = { lane: "marketing", profile: "roots", mode: "ai" };

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
    stepKey: "lane", busy: false, error: "", formError: "",
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

  function setzeSchritt(key) {
    state.stepKey = key;
    state.formError = "";
    zeichne();
  }

  function antwortLabel(q) {
    const v = wert(q).trim();
    if (q.art === "pills") {
      const treffer = (q.options || []).find(([value]) => value === v);
      return treffer ? treffer[1] : v || "noch nicht gewählt";
    }
    if (!v) return "übersprungen";
    return v.length > 60 ? `${v.slice(0, 60)}…` : v;
  }

  /** Katalogleistung oder eigener Text. Wer nichts Passendes findet, tippt. */
  function auswahlKoerper(q) {
    const v = wert(q).trim();
    const katalog = state.offerings.filter((item) => item.active !== false && item.label);
    const treffer = katalog.some((item) => item.label === v);
    const frei = state.offeringFrei || (Boolean(v) && !treffer) || !katalog.length;
    const gruppen = ROOTS_PILLARS.map(([pillar, titel]) => {
      const eintraege = katalog.filter((item) => item.pillar === pillar);
      if (!eintraege.length) return "";
      const opts = eintraege.map((item) => `<option value="${esc(item.label)}"${!frei && item.label === v ? " selected" : ""}>${esc(item.label)}</option>`).join("");
      return `<optgroup label="${esc(titel)}">${opts}</optgroup>`;
    }).join("");
    const ohneGruppe = katalog.filter((item) => !ROOTS_PILLARS.some(([pillar]) => pillar === item.pillar))
      .map((item) => `<option value="${esc(item.label)}"${!frei && item.label === v ? " selected" : ""}>${esc(item.label)}</option>`).join("");
    const kopf = state.offeringsGeladen && !katalog.length
      ? "Kein Leistungskatalog geladen"
      : "Leistung aus dem ROOTS-Katalog wählen";
    const auswahl = `<select class="as-free" data-auswahl="${esc(q.key)}" aria-label="${esc(q.label)}">
      <option value=""${!frei && !v ? " selected" : ""}>${esc(kopf)}</option>
      ${gruppen}${ohneGruppe}
      <option value="${FREITEXT}"${frei ? " selected" : ""}>Andere Leistung eintragen</option>
    </select>`;
    const feld = frei
      ? `<input class="as-free" data-feld="${esc(q.key)}" aria-label="${esc(q.label)}" placeholder="${esc(textVon(q.platzhalter))}" value="${esc(wert(q))}">`
      : "";
    return `${auswahl}${feld}<div data-guide="${esc(q.key)}">${schreibhilfe(q.key)}</div>`;
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
    const gemeinsam = `class="as-free" data-feld="${esc(q.key)}" aria-label="${esc(q.label)}" placeholder="${esc(textVon(q.platzhalter))}"`;
    const feld = q.art === "textarea"
      ? `<textarea ${gemeinsam} rows="${q.rows || 4}">${esc(wert(q))}</textarea>`
      : `<input ${gemeinsam} value="${esc(wert(q))}">`;
    return `${feld}<div data-guide="${esc(q.key)}">${schreibhilfe(q.key)}</div>`;
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
            <span class="as-step-nr"><i class="fa-solid fa-check"></i></span>
            <label>Bereit</label>
          </div>
          ${state.error ? `<p class="as-form-error">${esc(state.error)}</p>` : ""}
          <div class="as-step-fuss">
            <button type="button" class="as-btn" data-act="back"><i class="fa-solid fa-arrow-left"></i>Zurück</button>
            <button type="button" class="as-btn as-btn--primary" data-act="submit"${state.busy ? " disabled" : ""}>
              ${state.busy ? '<i class="fa-solid fa-spinner fa-spin"></i>Signal wird angelegt' : '<i class="fa-solid fa-arrow-right"></i>Signal übernehmen'}
            </button>
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
    state.formError = offen.art === "pills"
      ? "Bitte eine Antwort wählen."
      : laenge
        ? `Noch ${(offen.min || 1) - laenge} Zeichen zu kurz.`
        : `Diese Angabe braucht das Asset. Mindestens ${offen.min || 1} Zeichen.`;
    zeichne();
    return false;
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
    if (state.busy) return;
    state.busy = true;
    state.error = "";
    zeichne();
    try {
      const a = state.answers;
      const res = await api("create_manual_signal", {
        signal: {
          lane: a.lane, mode: a.mode, headline: a.headline, core: a.core, evidence: a.evidence,
          source: a.source, company: a.company, offering: a.offering,
          territory: a.territory, occasion: a.occasion, competitor: a.competitor,
        },
      });
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
      if (key === "lane") uebernimmBeispiel(state.answers.lane);
      state.formError = "";
      // Eine Pille beantwortet die Frage vollstaendig, also weiter - wie im
      // Asset-Fragebogen.
      setzeSchritt(naechsterSchritt());
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
    const hilfe = shell.querySelector(`[data-guide="${key}"]`);
    if (hilfe) hilfe.innerHTML = schreibhilfe(key);
    const host = shell.querySelector(".ms-rechts");
    if (host) host.innerHTML = karteHtml();
  });

  overlay.addEventListener("change", (event) => {
    const feld = event.target.closest("[data-auswahl]");
    if (!feld) return;
    const key = feld.getAttribute("data-auswahl");
    state.beruehrt.add(key);
    if (feld.value === FREITEXT) {
      state.offeringFrei = true;
      state.answers[key] = "";
    } else {
      state.offeringFrei = false;
      state.answers[key] = feld.value;
    }
    state.formError = "";
    zeichne();
  });

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
  closeAssetStudio();
  return instanz;
}
