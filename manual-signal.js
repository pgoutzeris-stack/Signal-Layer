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
import { ASSET_CHROME_CSS, openAssetStudio, closeAssetStudio } from "./asset-studio.js?v=20260819-1520";

const OVERLAY_ID = "ms-overlay";
const OWN_CSS = ASSET_CHROME_CSS.replace(/#as-overlay/g, `#${OVERLAY_ID}`);

const DEFAULT_ESCAPE = (value) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Sonderschluessel der Abschlusskarte, wie im Asset-Studio. */
const ENDE = "__ende";

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
    key: "mode", label: "Texte", frage: "Wer schreibt die Texte?", art: "pills",
    options: [
      ["ai", "Die KI, aus meinen Angaben"],
      ["hybrid", "KI, aber Kernaussage und Aufruf gebe ich vor"],
      ["manual", "Ich schreibe alle Texte selbst"],
    ],
    pflicht: true,
  },
  {
    key: "headline", label: "Beobachtung", frage: "Was hast du beobachtet?", art: "text",
    platzhalter: "Handel baut Eigenmarken schneller aus als geplant",
    pflicht: true, min: 10,
  },
  {
    key: "core", label: "Relevanz", frage: "Warum ist das für unsere Zielgruppe relevant?",
    art: "textarea", rows: 4,
    platzhalter: "Zwei bis drei Sätze: was passiert und welche Folge das hat",
    pflicht: true, min: 30,
  },
  {
    key: "evidence", label: "Beleg", frage: "Was belegt diese Beobachtung?",
    art: "textarea", rows: 5,
    platzhalter: "Zahlen, Zitate und Namen im Wortlaut",
    hinweis: "Nur was hier steht, darf im Asset als Zahl oder Zitat erscheinen.",
    pflicht: true, min: 20,
  },
  {
    key: "source", label: "Quelle", frage: "Woher stammt die Information?", art: "text",
    platzhalter: "Studie, Herausgeber, Jahr oder Link",
  },
  {
    key: "company", label: "Unternehmen", frage: "Um welches Unternehmen geht es?", art: "text",
    platzhalter: "Firmenname",
  },
  {
    key: "offering", label: "Leistung", frage: "Welche ROOTS-Leistung schließt daran an?", art: "text",
    platzhalter: "z. B. Markenstrategie",
  },
  {
    key: "audience", label: "Zielgruppe", frage: "Wen willst du damit erreichen?", art: "text",
    platzhalter: "Rolle oder Buying Center, z. B. Category Management",
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
    key: "competitor", label: "Wettbewerb", frage: "Macht das im Markt schon jemand vor?", art: "text",
    platzhalter: "Marke oder Wettbewerber",
  },
  {
    key: "storyline_text", label: "Kernaussage", frage: "Welche Aussage soll das Asset tragen?",
    art: "textarea", rows: 4,
    platzhalter: "Der Satz, um den herum gebaut wird",
    when: (a) => a.mode !== "ai", pflicht: true, min: 20,
  },
  {
    key: "cta_text", label: "Aufruf", frage: "Wozu sollen Leser am Ende aufgefordert werden?",
    art: "text",
    platzhalter: "z. B. Sortimentscheck vereinbaren",
    when: (a) => a.mode !== "ai", pflicht: true, min: 4,
  },
  {
    key: "caption_text", label: "Caption", frage: "Was soll als Beitragstext unter dem Bild stehen?",
    art: "textarea", rows: 4,
    platzhalter: "Der Text, den Leser im Feed lesen",
    when: (a) => a.mode === "manual" && a.lane === "marketing", pflicht: true, min: 20,
  },
  {
    key: "tone", label: "Tonalität", frage: "Wie soll es klingen?", art: "text",
    platzhalter: "z. B. sachlich, kurze Sätze, keine Superlative",
    when: (a) => a.mode !== "manual",
  },
];

const STANDARD = {
  lane: "marketing", profile: "roots", mode: "ai",
  headline: "", core: "", evidence: "", source: "", company: "", offering: "",
  audience: "", territory: "", occasion: "", competitor: "", tone: "",
  storyline_text: "", cta_text: "", caption_text: "",
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

  const state = { answers: { ...STANDARD }, stepKey: "lane", busy: false, error: "", formError: "" };

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

  function aktiveFragen() {
    return FRAGEN.filter((q) => (typeof q.when === "function" ? q.when(state.answers) : true));
  }

  function wert(q) {
    return String(state.answers[q.key] ?? "");
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

  function koerper(q) {
    if (q.art === "pills") {
      const pillen = q.options.map(([value, label]) => `
        <button type="button" class="as-opt as-opt--btn${wert(q) === value ? " is-active" : ""}"
          data-act="pick" data-key="${esc(q.key)}" data-value="${esc(value)}"
          aria-pressed="${wert(q) === value ? "true" : "false"}"><span>${esc(label)}</span></button>`).join("");
      return `<div class="as-opts">${pillen}</div>`;
    }
    const gemeinsam = `class="as-free" data-feld="${esc(q.key)}" aria-label="${esc(q.label)}" placeholder="${esc(q.platzhalter || "")}"`;
    return q.art === "textarea"
      ? `<textarea ${gemeinsam} rows="${q.rows || 4}">${esc(wert(q))}</textarea>`
      : `<input ${gemeinsam} value="${esc(wert(q))}">`;
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
            <label>${esc(offen.frage || offen.label)}</label>
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
      a.mode === "ai" ? "KI schreibt" : a.mode === "hybrid" ? "KI + eigene Texte" : "Eigene Texte",
      a.company, a.territory, a.offering,
    ].filter(Boolean).map((text) => `<span class="ms-chip">${esc(text)}</span>`).join("");
    return `<div class="ms-karte">
      <div class="ms-chips">${chips}</div>
      <h4${a.headline ? "" : ' class="ms-leer"'}>${esc(a.headline || "Überschrift des Signals")}</h4>
      <p${a.core ? "" : ' class="ms-leer"'}>${esc(a.core || "Kernaussage")}</p>
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
    const feld = shell.querySelector("[data-stepcard] [data-feld]");
    if (feld && index < fragen.length) feld.focus({ preventScroll: true });
  }

  function pruefeOffen() {
    const fragen = aktiveFragen();
    const offen = fragen[schrittIndex(fragen)];
    if (!offen) return true;
    if (erledigt(offen)) return true;
    state.formError = offen.art === "pills"
      ? "Bitte eine Antwort wählen."
      : `Bitte ausfüllen, mindestens ${offen.min || 1} Zeichen.`;
    zeichne();
    return false;
  }

  /** Antworten fuer den Asset-Fragebogen. Dieselben Schluessel, damit dort
   *  nichts uebersetzt werden muss. */
  function assetVorbelegung() {
    const a = state.answers;
    const eigen = a.mode !== "ai";
    const out = {
      storyline: eigen ? "custom" : "auto",
      storyline_text: eigen ? a.storyline_text : "",
      cta: eigen ? "custom" : "auto",
      cta_text: eigen ? a.cta_text : "",
      sources: a.source ? "custom" : "auto",
      sources_text: a.source,
    };
    if (a.lane === "marketing") {
      out.profile = a.profile;
      out.caption = a.mode === "manual" ? "custom" : "ai";
      out.caption_text = a.mode === "manual" ? a.caption_text : "";
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
          source: a.source, company: a.company, offering: a.offering, audience: a.audience,
          territory: a.territory, occasion: a.occasion, competitor: a.competitor, tone: a.tone,
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
    state.answers[feld.getAttribute("data-feld")] = feld.value;
    const host = shell.querySelector(".ms-rechts");
    if (host) host.innerHTML = karteHtml();
  });

  document.addEventListener("keydown", onKey);
  zeichne();
  closeAssetStudio();
  return instanz;
}
