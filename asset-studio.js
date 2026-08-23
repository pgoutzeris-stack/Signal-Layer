// Asset Studio: Fragebogen, Entwurf und Werkbank für LinkedIn-Assets und
// Ansprachen. Das Modul baut sein Overlay selbst und bringt die Stile
// der Bühne mit, weil die heruntergeladene HTML-Datei ohne die App auskommen
// muss und das App-Thema die Markenfarben sonst umfärben würde.

/* ─────────────────────────  Konstanten und Vorgaben  ───────────────────────── */

const LOGO_PATH = "assets/roots-logo.png";
/** Ein Pixel ohne Farbe. Haelt den Platz des Logos, zeigt aber nichts. */
const LEER_BILD = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const SAVE_LIMIT = 900000;
// Platzhalter-Geometrie des Executive Memo. Uploads werden auf dieses
// Seitenverhältnis gezwungen, bevor sie in den Slot kommen.
const MEMO_SHOT_ASPECT = { benchmark: { w: 46, h: 28 }, potential: { w: 52, h: 36 } };
const MEMO_SHOT_PIXELS = { benchmark: { w: 920, h: 560 }, potential: { w: 936, h: 648 } };
const LINKEDIN_SHOT_PIXELS = { w: 1080, h: 1350 };
const BENCH_EXAMPLE = [
  { name: "Decathlon", text: "Hat die Eigenmarken unter eine Führung gestellt und den Auftritt vereinheitlicht.", tag: "Marke vor Fläche" },
  { name: "IKEA", text: "Führt Store und Online mit derselben Handschrift statt getrennter Auftritte.", tag: "Eine Linie, zwei Kanäle" },
  { name: "Zara", text: "Hat Saisonkampagnen durch eine haltbare Linie ersetzt, die über die Kollektion trägt.", tag: "Linie vor Saison" },
];
const TOPIC_KICKERS = {
  customer_insights: "CUSTOMER INSIGHTS",
  marketing_insights: "MARKETING INSIGHTS",
  fmcg_retail_signale: "FMCG / RETAIL",
  sub_branchen_insight: "SUB-BRANCHE",
  ki_performance: "KI & PERFORMANCE",
  kunde: "KUNDE",
  buying_center: "BUYING CENTER",
  wachstumstreiber: "WACHSTUMSTREIBER",
  markenaktivierung: "MARKENAKTIVIERUNG",
  marke_im_wandel: "MARKE IM WANDEL",
  operational_excellence: "OPERATIONAL EXCELLENCE",
  empowered_marketers: "EMPOWERED MARKETERS",
};
// Drei A4-Seiten, in der Vorschau einzeln. 210 mm × 297 mm bei 96 dpi.
const MEMO_SEITEN = 3;
const MEMO_SEITE_PX = { w: 794, h: 1123 };

// Nur diese Varianten sind vertraglich zugesagt; J fehlt bewusst.
const VARIANTS = [
  ["B", "Titel mit Einordnung"],
  ["A", "Zitat"],
  ["E", "Große Kennzahl"],
  ["F", "Aufzählung"],
  ["G", "Mythos und Fakt"],
  ["H", "Mehrere Kennzahlen"],
  ["I", "Prozess in Schritten"],
  ["L", "Kennzahl mit Anmerkung"],
  ["K", "Durchgestrichenes Wort"],
  ["M", "Titel dunkel"],
  ["C", "Titel mit Bild"],
  ["D", "Vollbild mit Overlay"],
  ["J", "Zitat über Bild"],
];
// Ein Carousel braucht einen klaren Einstieg und einen klaren Abschluss. Die
// beiden Rollen haben je eine helle und dunkle Vorlage; sie werden in der
// manuellen Auswahl zwingend an erster beziehungsweise letzter Stelle geführt.
const CAROUSEL_FRAMES = [
  ["U1", "Titelfolie mit Linie"],
  ["U2", "Titelfolie mit Linie"],
  ["U5", "Titelfolie zentriert"],
  ["U6", "Titelfolie zentriert"],
  ["U3", "Endfolie mit CTA-Pille"],
  ["U4", "Endfolie mit CTA-Pille"],
  ["U7", "Endfolie mit CTA-Karte"],
  ["U8", "Endfolie mit CTA-Karte"],
];
// Infografiken kommen aus denselben gebauten Assets. Sie sind Layouts, keine
// eigenen Signalarten: das Modell liefert weiter Titel und Einordnung, die
// Zeichnung traegt die Aussage und wird in der Werkbank mit eigenen Zahlen
// versehen.
const LAYOUT_KEYS = Object.keys(ASSET_LAYOUTS);
// Beschreibende Namen statt Kuerzel: "S2" sagt niemandem etwas.
const LAYOUT_NAMEN = {
  S1: "Schnittmengen-Modell", S2: "Reifepyramide", S3: "Strategie-Haus", S4: "Funnel-Modell",
  T1: "Marktwachstum als Säulen", T2: "Wasserfall", T3: "Anteile als Donut",
  T4: "Anwendungsfälle als Balken", T5: "Funnel mit Zahlen", T6: "Roadmap",
};
const CONTENT_VARIANTS = [...VARIANTS, ...LAYOUT_KEYS.map((k) => [k, LAYOUT_NAMEN[k] || ASSET_LAYOUT_LABELS[k] || k])];
const VARIANTS_ALL = [...CAROUSEL_FRAMES, ...CONTENT_VARIANTS];
const VARIANT_KEYS = VARIANTS_ALL.map(([key]) => key);

// Anmutung je Layout, abgelesen am Markup der gebauten Assets: dunkel heisst
// li-dark oder ein dunkles Overlay ueber dem Bild. Die Wahl filtert die Liste,
// sie faerbt nichts um - Umfaerben hatte weisse Schrift auf Weiss erzeugt.
const LOOK = {
  U1: "hell", U2: "dunkel", U3: "hell", U4: "dunkel",
  U5: "hell", U6: "dunkel", U7: "hell", U8: "dunkel",
  A: "dunkel", B: "hell", C: "hell", D: "dunkel", E: "hell", F: "hell",
  G: "hell", H: "dunkel", I: "hell", J: "dunkel", K: "hell", L: "hell", M: "dunkel",
  S1: "hell", S2: "dunkel", S3: "hell", S4: "dunkel",
  T1: "hell", T2: "hell", T3: "hell", T4: "hell", T5: "hell", T6: "hell",
};
const SLIDE_ROLE = {
  U1: "cover", U2: "cover", U5: "cover", U6: "cover",
  U3: "end", U4: "end", U7: "end", U8: "end",
};
const MIT_BILD = new Set(["C", "D", "J"]);
const CAROUSEL_RECOMMENDED_MIN = 8;
const CAROUSEL_RECOMMENDED_MAX = 12;
const LINKEDIN_DOCUMENT_PAGE_MAX = 300;

/** Sonderschluessel fuer die Abschlusskarte hinter der letzten Frage. */
const ENDE = "__ende";

/** Die beiden ROOTS-Vorlagen sind fest: Logo, Fusszeile und Domain gehoeren der
 *  Marke und werden nicht je Nutzer eingestellt. */
const ROOTS_DESIGNS = [
  { id: "roots-hell", name: "ROOTS Hell", theme: "hell", footer: "ROOTS Consultants", domain: "roots-consultants.com", logo: "" },
  { id: "roots-dunkel", name: "ROOTS Dunkel", theme: "dunkel", footer: "ROOTS Consultants", domain: "roots-consultants.com", logo: "" },
];

/** Ohne eigene Vorlage bleibt genau eine neutrale uebrig. Sie traegt kein
 *  ROOTS-Zeichen und keine ROOTS-Domain. */
const STANDARD_DESIGN = {
  id: "standard", name: "Standard", theme: "hell", footer: "", domain: "", logo: "",
};

/** Gleiche Aussage wie serverseitig, damit der teure Aufruf gar nicht startet. */
const TONE_FEHLT = "Für „KI + Tone of Voice“ ist noch kein Tonfall hinterlegt. Bitte in den Einstellungen unter Tone of Voice konfigurieren.";
const DESIGN_FEHLT = "Für das Privatprofil ist noch keine Design-Vorlage hinterlegt.";

/** Voraussetzungen, die nicht in der sichtbaren Antwort selbst stecken. Die
 *  Auswahl darf erst als abgeschlossen gelten, wenn die persoenliche
 *  Einstellung wirklich geladen und vorhanden ist. */
export function assetQuestionCanAdvance(questionKey, answers = {}, prerequisites = {}) {
  const key = String(questionKey || "");
  if ((key === "profile" || key === "design") && answers.profile === "private") {
    return Boolean(prerequisites.designsLoaded && Number(prerequisites.designCount) > 0);
  }
  if (key === "caption" && answers.caption === "ai_tone") {
    return Boolean(prerequisites.toneLoaded && String(prerequisites.toneOfVoice || "").trim());
  }
  return true;
}

/** Gewuenschte Laenge: bei eigener Abfolge entscheidet deren wirkliche
 *  Laenge, bei KI die Zahl aus Auswahl oder Freitext. Null bedeutet ungueltig. */
export function carouselRequestedSlides(answers = {}) {
  if (answers.slide_mix === "custom") {
    return String(answers.slide_pick || "").split(",").map((v) => v.trim()).filter(Boolean).length;
  }
  const raw = answers.slide_count === "custom" ? answers.slide_count_text : answers.slide_count;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 2 && n <= LINKEDIN_DOCUMENT_PAGE_MAX ? n : 0;
}

/** Die eigene Abfolge darf Inhaltsfolien wiederholen, braucht aber genau einen
 *  Einstieg vorne und einen Abschluss hinten. */
export function manualCarouselSelectionIssues(value, look = "hell") {
  const liste = Array.isArray(value)
    ? value.map(String).filter(Boolean)
    : String(value || "").split(",").map((v) => v.trim()).filter(Boolean);
  const probleme = [];
  if (!liste.length || SLIDE_ROLE[liste[0]] !== "cover") probleme.push("Die Titelfolie fehlt oder steht nicht am Anfang.");
  if (!liste.length || SLIDE_ROLE[liste[liste.length - 1]] !== "end") probleme.push("Die Endfolie fehlt oder steht nicht am Ende.");
  if (liste.slice(1).some((key) => SLIDE_ROLE[key] === "cover")) probleme.push("Die Titelfolie muss genau einmal und an erster Stelle stehen.");
  if (liste.slice(0, -1).some((key) => SLIDE_ROLE[key] === "end")) probleme.push("Die Endfolie muss genau einmal und an letzter Stelle stehen.");
  if (liste.some((key) => LOOK[key] && LOOK[key] !== look)) probleme.push("Alle Folien müssen zum gewählten Hell- oder Dunkel-Design passen.");
  if (liste.length > LINKEDIN_DOCUMENT_PAGE_MAX) probleme.push(`LinkedIn erlaubt höchstens ${LINKEDIN_DOCUMENT_PAGE_MAX} Dokumentseiten.`);
  return [...new Set(probleme)];
}

const FORM_LINKEDIN = [
  {
    key: "profile", label: "Für wen",
    options: [["roots", "ROOTS"], ["private", "Privatprofil"]],
  },
  // Die Auswahl haengt am Profil: ROOTS hat zwei feste Vorlagen, privat die in
  // den Einstellungen hinterlegten. Traegt zugleich hell/dunkel.
  { key: "design", label: "Design", art: "design", options: [["roots-hell", "ROOTS Hell"]] },
  { key: "asset_type", label: "Format", options: [["single", "Einzelbild"], ["carousel", "Carousel"]] },
  // Einzelbild: genau ein Layout. Carousel: entweder das Modell mischt die
  // Slide-Arten, oder der Nutzer waehlt sie selbst.
  {
    key: "variant_mode", label: "Layout",
    options: [["auto", "KI soll wählen"], ["custom", "Selbst auswählen"]],
    when: (answers) => answers.asset_type !== "carousel",
  },
  {
    key: "variant", label: "Vorlage", art: "dropdown",
    options: [["auto", "Modell wählt"], ...VARIANTS_ALL],
    when: (answers) => answers.asset_type !== "carousel" && answers.variant_mode === "custom",
  },
  {
    key: "slide_mix", label: "Inhalt",
    options: [["auto", "KI soll wählen"], ["custom", "Selbst auswählen"]],
    when: (answers) => answers.asset_type === "carousel",
  },
  {
    key: "slide_cover", label: "Titelfolie", art: "frame", role: "cover",
    options: CAROUSEL_FRAMES,
    when: (answers) => answers.asset_type === "carousel" && answers.slide_mix === "custom",
  },
  {
    key: "slide_content", label: "Inhaltsfolien", art: "multi-content",
    options: CONTENT_VARIANTS,
    when: (answers) => answers.asset_type === "carousel" && answers.slide_mix === "custom",
  },
  {
    key: "slide_end", label: "Endfolie", art: "frame", role: "end",
    options: CAROUSEL_FRAMES,
    when: (answers) => answers.asset_type === "carousel" && answers.slide_mix === "custom",
  },
  {
    key: "slide_count",
    label: "Anzahl der Slides",
    options: [["8", "8"], ["10", "10"], ["12", "12"], ["custom", "Andere Anzahl"]],
    free: { key: "slide_count_text", on: "custom", rows: 1, platzhalter: "2 bis 300" },
    when: (answers) => answers.asset_type === "carousel" && answers.slide_mix !== "custom",
  },
  {
    key: "storyline",
    label: "Kernaussage",
    options: [["auto", "Modell schreibt aus dem Signal"], ["custom", "Ich gebe den Text vor"]],
    free: { key: "storyline_text", on: "custom", rows: 5, platzhalter: "Kernaussage, Stichpunkte oder fertiger Text" },
  },
  {
    key: "cta",
    label: "Handlungsaufruf",
    options: [["auto", "Modell schlägt vor"], ["custom", "Eigener Text"]],
    free: { key: "cta_text", on: "custom", rows: 2, platzhalter: "z. B. Termin vereinbaren" },
  },
  {
    key: "sources",
    label: "Quellen",
    options: [["auto", "Nur belegte Aussagen aus dem Artikel"], ["custom", "Eigene Quellen angeben"]],
    free: { key: "sources_text", on: "custom", rows: 3, platzhalter: "Studie, Herausgeber, Jahr" },
  },
  // Die Caption ist der Beitragstext unter dem Bild. Der Tonfall fuer die
  // zweite Wahl liegt je Nutzer in den Einstellungen.
  {
    key: "caption",
    label: "Caption",
    options: [
      ["ai", "KI schreibt"],
      ["ai_tone", "KI + Tone of Voice"],
      ["custom", "Selbst schreiben"],
    ],
    free: { key: "caption_text", on: "custom", rows: 6, platzhalter: "Caption des Beitrags" },
  },
];

function memoQuestions(firma, cmoHundredDays = false) {
  const erkannt = String(firma || "").trim();
  const nurThema = (answers) => answers.memo_track !== "cmo100";
  return [
    {
      key: "memo_track",
      label: "Welche Unterlage",
      hint: "Ein CMO- oder Marketingleitungswechsel ist erkannt. Das Executive Memo behandelt die thematische Herausforderung. 100 Tage CMO ist ein eigener Sonderfall und noch in Ausarbeitung.",
      options: [
        ["theme", "Thematisches Executive Memo"],
        ["cmo100", "100 Tage CMO"],
      ],
      when: () => cmoHundredDays,
    },
    {
      key: "company_named",
      label: "Unternehmen",
      hint: "Nur bei Ja steht der Name im Cover-Titel. Nein lässt den Titel ohne Firma.",
      when: nurThema,
      options: [
        ["yes", "Ja, das Unternehmen nennen"],
        ["no", "Nein"],
      ],
    },
    {
      key: "company_mode",
      label: "Welches Unternehmen",
      when: (answers) => answers.company_named === "yes" && nurThema(answers),
      options: [
        ["auto", erkannt ? `Erkannt: ${erkannt}` : "Aus dem Signal übernehmen"],
        ["custom", "Anderes Unternehmen"],
      ],
      free: { key: "company_text", on: "custom", rows: 1, platzhalter: "Firmenname" },
    },
    {
      key: "storyline",
      label: "Inhalt",
      when: nurThema,
      options: [["auto", "Modell schreibt aus dem Signal"], ["custom", "Ich gebe den Text vor"]],
      free: { key: "storyline_text", on: "custom", rows: 5, platzhalter: "Kernaussage, Stichpunkte oder fertiger Text" },
    },
    {
      key: "benchmarks",
      label: "Benchmarking",
      when: nurThema,
      options: [
        ["auto", "Gemini recherchiert"],
        ["custom", "Eigene Benchmarks"],
      ],
    },
    {
      key: "images",
      label: "Bilder",
      when: nurThema,
      options: [
        ["auto", "Logos und Motive recherchieren"],
        ["upload", "Eigene Bilder zuschneiden"],
      ],
    },
    {
      key: "cta",
      label: "CTA",
      when: nurThema,
      options: [["auto", "Modell schreibt die Gesprächsfrage"], ["custom", "Eigene Frage"]],
      free: { key: "cta_text", on: "custom", rows: 2, platzhalter: "z. B. Sollen wir den Check gemeinsam durchgehen?" },
    },
  ];
}

const FORM_MEMO = memoQuestions("");

/* ─────────────────────────  Stile der Bühne  ───────────────────────── */

// Diese Regeln reisen mit in den Download, deshalb ausschließlich feste
// Markenwerte und keine Variablen der App.
const STAGE_CSS = `
.as-stage{
  --b:#206efb; --bd:#165fd9; --bl:#eff6ff;
  --ink:#0f172a; --mut:#475569; --xmut:#8899a6;
  --paper:#ffffff; --line:#e2e8f0; --soft:#f8fafc;
  --navy:#0b1f45; --navy-acc:#5a9bff; --navy-kick:#6ea3ff; --navy-txt:#c3d3f0;
  --band:#cfe0fd; --c0:#dbe7ff; --c1:#b4d0ff; --c2:#6b9ffb;
  --acc:var(--b); --acc-soft:var(--bl); --acc-line:var(--band);
  --round:28px;
  position:relative; overflow:hidden; box-sizing:border-box;
  background:var(--paper); color:var(--ink);
  font-family:'Circular Std', system-ui, -apple-system, sans-serif;
  font-feature-settings:"kern" 1; text-rendering:optimizeLegibility;
  -webkit-font-smoothing:antialiased;
}
.as-stage *{box-sizing:border-box;}
.as-stage[data-theme="dark"]{
  --paper:var(--navy); --ink:#ffffff; --mut:var(--navy-txt); --xmut:#8aa3cf;
  --line:rgba(255,255,255,.16); --soft:rgba(255,255,255,.06);
  --acc:var(--navy-kick); --acc-soft:rgba(90,155,255,.14); --acc-line:rgba(110,163,255,.4);
}
.as-stage[data-accent="navy"]{--acc:var(--navy); --acc-soft:#eef3fc; --acc-line:#d3ddf0;}
.as-stage[data-accent="ink"]{--acc:var(--ink); --acc-soft:var(--soft); --acc-line:var(--line);}
.as-stage[data-theme="dark"][data-accent="navy"]{--acc:var(--navy-acc); --acc-soft:rgba(90,155,255,.14); --acc-line:rgba(90,155,255,.38);}
.as-stage[data-theme="dark"][data-accent="ink"]{--acc:#ffffff; --acc-soft:rgba(255,255,255,.08); --acc-line:rgba(255,255,255,.28);}
.as-stage[data-corners="sharp"]{--round:0px;}

/* Lockup: der Untertitel ist exakt auf Logobreite gesperrt. */
.as-lockup{display:block; flex:0 0 auto;}
.as-lockup img{display:block; width:100%; height:auto;}
.as-lockup span{
  display:block; white-space:nowrap; text-transform:uppercase;
  font-weight:500; color:var(--ink);
}
.as-stage[data-theme="dark"] .as-lockup img{filter:brightness(0) invert(1);}

.as-edit:focus{outline:none; box-shadow:0 0 0 1.5px rgba(100,116,139,.4); border-radius:6px;}
.as-edit:empty::before{content:attr(data-ph); color:var(--xmut); opacity:.7;}
.as-edit ul{margin:0; padding-left:1.1em;}

/* ── LinkedIn-Slide, feste Bühne 1080x1350 ── */
.as-stage--li{
  width:1080px; height:1350px; padding:84px;
  display:flex; flex-direction:column; gap:44px;
}
.as-stage--li .as-head{display:flex; align-items:flex-start; justify-content:space-between; gap:32px; position:relative; z-index:2;}
.as-stage--li .as-lockup{width:260px;}
.as-stage--li .as-lockup span{font-size:13px; letter-spacing:2.132px; text-indent:-1.733px;}
.as-stage--li .as-kicker{
  font-size:22px; font-weight:700; letter-spacing:2.2px; text-transform:uppercase;
  color:var(--acc); text-align:right; max-width:430px; padding-top:6px;
}
.as-stage--li .as-mid{flex:1 1 auto; min-height:0; display:flex; flex-direction:column; justify-content:center; gap:28px; position:relative; z-index:2;}
.as-stage--li .as-title{font-size:68px; font-weight:800; line-height:1.08; letter-spacing:-1.4px;}
.as-stage--li .as-sub{font-size:30px; line-height:1.42; color:var(--mut); max-width:912px;}
.as-stage--li .as-quote{font-size:58px; font-weight:600; line-height:1.24;}
.as-stage--li .as-quote::before{content:"„"; color:var(--acc);}
.as-stage--li .as-quote::after{content:"“"; color:var(--acc);}
.as-stage--li .as-attr{font-size:24px; letter-spacing:1.4px; text-transform:uppercase; color:var(--mut);}
.as-stage--li .as-statbig{font-size:196px; font-weight:800; line-height:.92; letter-spacing:-6px; color:var(--acc);}
.as-stage--li .as-statlabel{font-size:28px; color:var(--mut); max-width:760px; line-height:1.4;}
.as-stage--li .as-bullets{display:flex; flex-direction:column; gap:20px;}
.as-stage--li .as-bullets li{font-size:34px; line-height:1.4; margin-bottom:16px;}
.as-stage--li .as-bullets li::marker{color:var(--acc);}
.as-stage--li .as-grid2{display:grid; grid-template-columns:1fr 1fr; gap:24px;}
.as-stage--li .as-grid3{display:grid; grid-template-columns:repeat(3,1fr); gap:20px;}
.as-stage--li .as-card{
  background:var(--soft); border:2px solid var(--line); border-radius:var(--round);
  padding:36px; display:flex; flex-direction:column; gap:14px;
}
.as-stage--li .as-card--acc{background:var(--acc-soft); border-color:var(--acc-line);}
.as-stage--li .as-cardhead{font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:var(--acc);}
.as-stage--li .as-cardtext{font-size:28px; line-height:1.36;}
.as-stage--li .as-statval{font-size:64px; font-weight:800; line-height:1; letter-spacing:-1.6px; color:var(--acc);}
.as-stage--li .as-statcap{font-size:20px; line-height:1.35; color:var(--mut);}
.as-stage--li .as-steps{display:flex; flex-direction:column; gap:22px;}
.as-stage--li .as-step{display:grid; grid-template-columns:96px 1fr; gap:26px; align-items:start;}
.as-stage--li .as-stepn{
  font-size:30px; font-weight:800; color:var(--acc); background:var(--acc-soft);
  border-radius:var(--round); padding:14px 0; text-align:center;
}
.as-stage--li .as-steptitle{font-size:32px; font-weight:700; line-height:1.2;}
.as-stage--li .as-steptext{font-size:24px; line-height:1.4; color:var(--mut); margin-top:8px;}
.as-stage--li .as-band{
  background:var(--acc-soft); border:2px solid var(--acc-line); border-radius:var(--round);
  padding:34px 40px; font-size:30px; line-height:1.38; font-weight:600; position:relative; z-index:2;
}
.as-stage--li .as-foot{
  display:flex; align-items:center; justify-content:space-between; gap:24px;
  border-top:2px solid var(--line); padding-top:26px;
  font-size:22px; color:var(--mut); position:relative; z-index:2;
}
.as-stage--li .as-foot b{color:var(--acc); font-weight:700;}

/* Bildplätze */
.as-img{position:relative; overflow:hidden; border-radius:var(--round); background:var(--soft); border:2px solid var(--line);}
.as-img img{display:block; width:100%; height:100%; object-fit:cover;}
.as-img--panel{flex:1 1 auto; min-height:0;}
/* Variante C: Text links, Bild rechts. Der Verlauf traegt den Uebergang, damit
   die Bildkante nicht als harte Linie in der Kachel steht. */
.as-stage--li .as-mid--split{display:grid; grid-template-columns:minmax(0,1fr) 400px; align-items:center; gap:44px;}
.as-mid--split .as-splittext{display:flex; flex-direction:column; gap:24px; min-width:0;}
.as-mid--split .as-title{font-size:78px;}
.as-mid--split .as-img--panel{align-self:stretch; min-height:520px; position:relative;}
.as-mid--split .as-img--panel::after{content:""; position:absolute; inset:0 auto 0 0; width:64px; pointer-events:none;
  background:linear-gradient(90deg, var(--paper) 0%, rgba(255,255,255,0) 100%);}
.as-stage--li[data-theme="dark"] .as-mid--split .as-img--panel::after{background:linear-gradient(90deg, var(--navy) 0%, rgba(11,31,69,0) 100%);}
.as-img--full{position:absolute; inset:0; border-radius:0; border:0; z-index:0;}
.as-stage--li.as-stage--full{padding:84px;}
.as-stage--li.as-stage--full .as-scrim{
  position:absolute; inset:0; z-index:1;
  background:linear-gradient(180deg, rgba(11,31,69,.72) 0%, rgba(11,31,69,.34) 42%, rgba(11,31,69,.86) 100%);
}
.as-stage--li.as-stage--full .as-title,
.as-stage--li.as-stage--full .as-sub,
.as-stage--li.as-stage--full .as-foot,
.as-stage--li.as-stage--full .as-lockup span{color:#ffffff;}
.as-stage--li.as-stage--full .as-lockup img{filter:brightness(0) invert(1);}
.as-stage--li.as-stage--full .as-foot{border-top-color:rgba(255,255,255,.32);}
.as-stage--li.as-stage--full .as-kicker{color:var(--navy-kick);}
.as-stage--li.as-stage--full .as-band{background:rgba(11,31,69,.62); border-color:rgba(255,255,255,.34); color:#ffffff;}

/* ── Ansprache, A4 ── */
.as-stage--a4{
  width:210mm; min-height:297mm; padding:16mm 15mm 14mm;
  display:flex; flex-direction:column; gap:18px;
}
.as-stage--a4 .as-head{display:flex; align-items:flex-start; justify-content:space-between; gap:24px; border-bottom:2px solid var(--acc); padding-bottom:14px;}
.as-stage--a4 .as-lockup{width:150px;}
.as-stage--a4 .as-lockup span{font-size:7.5px; letter-spacing:1.23px; text-indent:-1px;}
.as-stage--a4 .as-kicker{font-size:10px; font-weight:700; letter-spacing:1.6px; text-transform:uppercase; color:var(--acc); text-align:right; max-width:74mm;}
.as-stage--a4 .as-conf{display:block; font-size:8.5px; letter-spacing:1.2px; color:var(--mut); margin-top:4px;}
.as-stage--a4 .as-title{font-size:26px; font-weight:800; line-height:1.16; letter-spacing:-.5px;}
.as-stage--a4 .as-standfirst{font-size:13px; line-height:1.5; color:var(--mut); max-width:150mm;}
.as-stage--a4 .as-kpis{display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px;}
.as-stage--a4 .as-kpi{background:var(--acc-soft); border:1.5px solid var(--acc-line); border-radius:calc(var(--round) / 2.5); padding:12px 14px;}
.as-stage--a4 .as-kpival{font-size:26px; font-weight:800; line-height:1; letter-spacing:-.6px; color:var(--acc);}
.as-stage--a4 .as-kpilabel{font-size:9.5px; line-height:1.35; color:var(--mut); margin-top:6px;}
.as-stage--a4 .as-cols{display:grid; grid-template-columns:1fr 1fr; gap:16px; flex:1 1 auto;}
.as-stage--a4 .as-colhead{font-size:10px; font-weight:700; letter-spacing:1.6px; text-transform:uppercase; color:var(--acc); border-bottom:1.5px solid var(--line); padding-bottom:6px; margin-bottom:10px;}
.as-stage--a4 .as-point{margin-bottom:10px;}
.as-stage--a4 .as-pointlead{font-size:11.5px; font-weight:700; line-height:1.3;}
.as-stage--a4 .as-pointtext{font-size:11px; line-height:1.45; color:var(--mut); margin-top:3px;}
.as-stage--a4 .as-option{border:1.5px solid var(--line); border-radius:calc(var(--round) / 2.8); padding:10px 12px; margin-bottom:10px;}
.as-stage--a4 .as-optname{font-size:11.5px; font-weight:700; color:var(--ink);}
.as-stage--a4 .as-optline{font-size:10.5px; line-height:1.4; color:var(--mut); margin-top:5px; display:flex; gap:6px;}
.as-stage--a4 .as-optline i{font-style:normal; font-weight:700; color:var(--acc); flex:0 0 auto;}
.as-stage--a4 .as-band{background:var(--acc-soft); border:1.5px solid var(--acc-line); border-radius:calc(var(--round) / 2.5); padding:14px 16px; display:grid; grid-template-columns:1fr auto; gap:16px; align-items:center;}
.as-stage--a4 .as-bandhead{font-size:9.5px; font-weight:700; letter-spacing:1.6px; text-transform:uppercase; color:var(--acc);}
.as-stage--a4 .as-bandtext{font-size:12.5px; line-height:1.45; font-weight:600; margin-top:4px;}
.as-stage--a4 .as-bandnext{font-size:11px; line-height:1.4; color:var(--mut); margin-top:6px;}
.as-stage--a4 .as-cta{background:var(--acc); color:#ffffff; border-radius:999px; padding:10px 20px; font-size:11px; font-weight:700; letter-spacing:.4px; white-space:nowrap;}
.as-stage--a4 .as-sources{font-size:9.5px; line-height:1.5; color:var(--xmut);}
.as-stage--a4 .as-sources b{display:block; font-size:9px; letter-spacing:1.4px; text-transform:uppercase; color:var(--mut); margin-bottom:4px;}
.as-stage--a4 .as-foot{display:flex; align-items:center; justify-content:space-between; gap:16px; border-top:1.5px solid var(--line); padding-top:10px; font-size:9.5px; color:var(--xmut);}
`;

/* ─────────────────────────  Stile der Werkbank  ───────────────────────── */

// Alles unter #as-overlay, damit die Regeln nicht in die App streuen. Die
// Farben kommen aus den App-Variablen, damit der dunkle Modus mitgeht.
const CHROME_CSS = `
#as-overlay{
  position:fixed; inset:0; z-index:12000;
  background:var(--app-bg,#f4f7fb); color:var(--ink,#0f172a);
  font-family:'Circular Std', system-ui, -apple-system, sans-serif;
  display:grid; grid-template-columns:250px 1fr; overflow:hidden;
}
/* Im Artikel-Popup: absolute Ebene im Rahmen des Popups, eigene Rundung, damit
   die Ecken des Popups nicht ueberdeckt werden. */
#as-overlay.as-in-host{position:absolute; inset:0; z-index:40; border-radius:inherit;}
#as-overlay *{box-sizing:border-box;}
#as-overlay button{font:inherit; color:inherit; cursor:pointer;}
#as-overlay .as-rail{
  background:var(--bg,#fff); border-right:1px solid var(--line,#e2e8f0);
  padding:20px 18px; display:flex; flex-direction:column; gap:22px; overflow:auto;
  min-height:0; height:100%;
}
#as-overlay .as-back{
  display:inline-flex; align-items:center; gap:10px; align-self:flex-start;
  background:transparent; border:1px solid var(--line,#e2e8f0); border-radius:999px;
  padding:8px 16px; font-size:13px; font-weight:600;
}
#as-overlay .as-back:hover{border-color:var(--brand,#206efb); color:var(--brand,#206efb);}
#as-overlay .as-railtitle{font-size:11px; font-weight:700; letter-spacing:1.6px; text-transform:uppercase; color:var(--muted,#475569);}
#as-overlay .as-steps{list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px;}
#as-overlay .as-steps li{
  display:flex; align-items:center; gap:12px; padding:11px 12px; border-radius:12px;
  font-size:14px; color:var(--muted,#475569); border:1px solid transparent;
}
#as-overlay .as-steps li b{
  width:24px; height:24px; border-radius:999px; flex:0 0 auto;
  display:grid; place-items:center; font-size:12px;
  background:var(--surface,#f8fafc); color:var(--muted,#475569);
}
#as-overlay .as-steps li[data-state="done"]{color:var(--ink,#0f172a);}
#as-overlay .as-steps li[data-state="done"] b{background:var(--brand-light,#eff6ff); color:var(--brand,#206efb);}
#as-overlay .as-steps li[data-state="active"]{
  background:var(--brand-light,#eff6ff); color:var(--brand-dark,#165fd9);
  border-color:var(--brand,#206efb); font-weight:700;
}
#as-overlay .as-steps li[data-state="active"] b{background:var(--brand,#206efb); color:#fff;}
#as-overlay .as-steps li[data-act]{cursor:pointer;}
#as-overlay .as-steps li[data-act]:hover{
  background:var(--brand-light,#eff6ff); color:var(--brand,#206efb);
}
#as-overlay .as-rail-tab{
  display:flex; align-items:center; gap:12px; margin-top:auto; width:100%; flex-shrink:0;
  padding:11px 12px; border-radius:12px; font-size:14px; font-weight:600;
  color:var(--muted,#475569); background:transparent; border:1px solid transparent; text-align:left;
}
#as-overlay .as-rail-tab:hover{
  background:var(--brand-light,#eff6ff); color:var(--brand,#206efb); border-color:var(--brand,#206efb);
}
#as-overlay .as-rail-tab.is-on{
  background:var(--brand-light,#eff6ff); color:var(--brand-dark,#165fd9);
  border-color:var(--brand,#206efb); font-weight:700;
}
#as-overlay .as-rail-tab b{
  width:24px; height:24px; border-radius:999px; flex:0 0 auto;
  display:grid; place-items:center; font-size:11px;
  background:var(--surface,#f8fafc); color:var(--muted,#475569);
}
#as-overlay .as-rail-tab.is-on b{background:var(--brand,#206efb); color:#fff;}
#as-overlay .as-rail-tab:hover b{background:var(--brand-light,#eff6ff); color:var(--brand,#206efb);}

#as-overlay .as-main{display:grid; grid-template-rows:auto minmax(0, 1fr); min-width:0; min-height:0; overflow:hidden;}
#as-overlay .as-main:has(.as-ribbon){grid-template-rows:auto auto minmax(0, 1fr);}
#as-overlay .as-topbar{
  display:flex; align-items:center; justify-content:space-between; gap:16px;
  padding:16px 24px; border-bottom:1px solid var(--line,#e2e8f0); background:var(--bg,#fff);
  position:relative; z-index:12;
}
#as-overlay .as-topbar h2{margin:0; font-size:17px; font-weight:700;}
#as-overlay .as-topactions{display:flex; gap:8px; flex-wrap:wrap;}
#as-overlay .as-content{min-height:0; overflow:auto; padding:24px;}
/* Im Fragebogen scrollt ausschliesslich die Antwortspalte. Ein zweiter
   Scrollbereich in der Mitte war der Grund, dass sich das Studio nicht wie ein
   Fenster, sondern wie eine Webseite im Fenster anfuehlte. */
/* Unten extra Luft: die gerundete Vorschaukarte und ihr Schatten
   duerfen nicht am Signal-Layer-Rahmen anliegen und abgeschnitten werden. */
#as-overlay .as-content:has(.as-split2){overflow:hidden; padding:20px 24px 32px; display:flex; flex-direction:column;}
#as-overlay .as-content{container-type:inline-size;}

#as-overlay .as-btn{
  display:inline-flex; align-items:center; gap:8px; border-radius:10px;
  border:1px solid var(--line,#e2e8f0); background:var(--bg,#fff);
  padding:9px 14px; font-size:13px; font-weight:600;
}
#as-overlay .as-btn:hover{border-color:var(--brand,#206efb); color:var(--brand,#206efb);}
#as-overlay .as-btn[disabled]{opacity:.5; cursor:not-allowed;}
#as-overlay .as-btn--primary{background:var(--brand,#206efb); border-color:var(--brand,#206efb); color:#fff;}
#as-overlay .as-btn--primary:hover{background:var(--brand-dark,#165fd9); border-color:var(--brand-dark,#165fd9); color:#fff;}
#as-overlay .as-btn--ghost{border-style:dashed;}
#as-overlay .as-btn--icon{padding:8px 10px;}
#as-overlay .as-btn--icon.as-close{
  width:36px; height:36px; padding:0; display:grid; place-items:center; border-radius:10px;
}

#as-overlay .as-ribbon{
  display:flex; align-items:center; gap:4px; flex-wrap:wrap;
  padding:8px 16px; border-bottom:1px solid var(--line,#e2e8f0);
  background:#f8fafc;
}
#as-overlay .as-ribbon[data-open="1"]{display:flex;}
#as-overlay .as-ribbon button{
  border:0; background:transparent; border-radius:8px; width:34px; height:34px;
  display:grid; place-items:center; font-size:13px; color:#0f172a;
}
#as-overlay .as-ribbon button:hover{background:#fff; color:var(--brand,#206efb); box-shadow:0 0 0 1px var(--line,#e2e8f0);}
#as-overlay .as-ribbon hr{width:1px; height:22px; border:0; background:var(--line,#e2e8f0); margin:0 4px;}
#as-overlay .as-ribbon .as-swatch{width:16px; height:16px; border-radius:999px; border:1px solid rgba(15,23,42,.18); display:block;}
#as-overlay .as-ribbon select{
  font:inherit; font-size:12px; height:34px; border:1px solid var(--line,#e2e8f0);
  border-radius:8px; background:#fff; padding:0 8px; color:#0f172a;
}

#as-overlay .as-pagehost{position:relative; display:block; width:max-content; max-width:100%; max-height:100%;}
#as-overlay .as-fs-btn{
  position:absolute; right:8px; bottom:8px; z-index:8;
  width:34px; height:34px; border-radius:10px;
  border:1px solid var(--line,#e2e8f0); background:#fff; color:#0f172a;
  box-shadow:0 6px 18px rgba(15,23,42,.12);
  display:grid; place-items:center;
}
#as-overlay .as-pagehost > .as-fs-btn,
#as-overlay .as-prev-big > .as-fs-btn{right:8px; bottom:8px;}
#as-overlay .as-fs-btn:hover{border-color:var(--brand,#206efb); color:var(--brand,#206efb);}
#as-overlay .as-fs-exit{
  display:none; position:absolute; top:12px; right:12px; z-index:60;
  width:40px; height:40px; border-radius:12px;
  border:1px solid var(--line,#e2e8f0); background:#fff; color:#0f172a;
  box-shadow:0 8px 24px rgba(15,23,42,.16);
  place-items:center;
}
#as-overlay.as-fs-open .as-fs-exit{display:grid;}
#as-overlay.as-fs-open{grid-template-columns:1fr;}
#as-overlay.as-fs-open .as-rail,
#as-overlay.as-fs-open .as-topbar,
#as-overlay.as-fs-open .as-ribbon,
#as-overlay.as-fs-open .as-split2-form,
#as-overlay.as-fs-open .as-inspector,
#as-overlay.as-fs-open .as-prev-label{display:none !important;}
#as-overlay.as-fs-open .as-main{grid-template-rows:minmax(0,1fr);}
#as-overlay.as-fs-open .as-content{padding:16px 56px 16px 16px;}
#as-overlay.as-fs-open .as-split2{grid-template-columns:1fr;}
#as-overlay.as-fs-open .as-split2-prev{height:100%;}
#as-overlay.as-fs-open .as-work{grid-template-columns:1fr;}

#as-overlay .em-shot-hint{display:none !important;}
#as-overlay .li-photo-hint{display:none !important;}
#as-overlay .em-shot:not(:has(img[src]:not([src=""]))),
#as-overlay .as-img--tpl:not(:has(img[src]:not([src=""]))){
  background:#eff6ff;
}
#as-overlay .em-shot:has(img[src]:not([src=""])){
  background:var(--status-bg,#f8fafc);
}
#as-overlay .em-shot:not(:has(img[src]:not([src=""])))::after,
#as-overlay .as-img--tpl:not(:has(img[src]:not([src=""])))::after{
  content:""; position:absolute; inset:0; pointer-events:none; z-index:1;
  background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'><rect x='3' y='5' width='18' height='14' rx='2' stroke='%23206efb' stroke-width='1.75'/><circle cx='8.2' cy='10' r='1.4' fill='%23206efb'/><path d='M5 17l4.2-4.2 2.6 2.6 2.4-2.4L19 17' stroke='%23206efb' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'/></svg>") center/28px 28px no-repeat;
}

#as-overlay [data-field][contenteditable="true"]{
  outline:none !important; border-radius:6px; box-shadow:none;
}
#as-overlay p[data-field][contenteditable="true"],
#as-overlay h1[data-field][contenteditable="true"],
#as-overlay h2[data-field][contenteditable="true"],
#as-overlay h3[data-field][contenteditable="true"],
#as-overlay div[data-field][contenteditable="true"]{display:block;}
#as-overlay span[data-field][contenteditable="true"]{display:inline-block; max-width:100%; vertical-align:baseline;}
#as-overlay b[data-field][contenteditable="true"]{display:inline-block; max-width:100%; vertical-align:baseline;}
#as-overlay [data-field][contenteditable="true"]:focus,
#as-overlay [data-field][contenteditable="true"]:focus-visible{
  box-shadow:0 0 0 1.5px rgba(100,116,139,.4);
  background:rgba(248,250,252,.55);
}

#as-overlay .as-prev-host{overflow:visible;}
#as-overlay .as-split2-prev{overflow:visible;}
#as-overlay .as-stagearea.is-zoom{overflow:auto; justify-content:flex-start; align-items:flex-start;}

#as-overlay .as-form{max-width:none; display:flex; flex-direction:column; gap:0;}
/* Jede Frage ist ein Abschnitt mit Trennlinie statt einer freien Lücke: so
   liegen Label, Optionen und Freitext auf einer Kante. */
#as-overlay .as-q{display:flex; flex-direction:column; gap:10px; padding:16px 0; border-top:1px solid var(--line,#e2e8f0);}
#as-overlay .as-q:first-child{border-top:0; padding-top:0;}
#as-overlay .as-q > label{font-size:.72rem; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--muted,#475569);}
#as-overlay .as-q{display:flex; flex-direction:column; gap:10px;}
#as-overlay .as-q > label{font-size:14px; font-weight:700;}
#as-overlay .as-opts{display:flex; flex-wrap:wrap; gap:8px; align-items:stretch;}
#as-overlay .as-opt{
  position:relative; display:inline-flex; align-items:center; gap:8px; padding:9px 15px;
  border:1px solid var(--line,#e2e8f0); border-radius:999px;
  background:var(--bg,#fff); font-size:13px; cursor:pointer; user-select:none;
}
#as-overlay .as-opt input{position:absolute; opacity:0; pointer-events:none;}
/* Knopfvariante derselben Pille: gleiche Form, gleiche Farben. Sie traegt
   Zusatzdaten am Element, was ein Radio nicht kann. */
#as-overlay button.as-opt{font:inherit; font-size:13px; color:inherit; text-align:left;}
#as-overlay button.as-opt:hover:not(:disabled){border-color:var(--brand,#206efb); color:var(--brand,#206efb);}
#as-overlay button.as-opt:disabled{opacity:.45; cursor:not-allowed;}
#as-overlay .as-opt.is-active{
  border-color:var(--brand,#206efb); background:var(--brand-light,#eff6ff);
  color:var(--brand-dark,#165fd9); font-weight:700;
}
#as-overlay .as-opt.is-active .as-tag{color:var(--brand,#206efb); border-color:currentColor; background:transparent;}
#as-overlay .as-opt-plus{font-size:.62rem; opacity:.55; margin-left:2px;}

/* ── Schrittweiser Fragebogen ─────────────────────────────────────────────
   Eine Frage offen, die beantworteten darueber als Zeile. Der Fortschritt
   steht oben, damit die Laenge des Wegs sichtbar bleibt. */
#as-overlay .as-progress{display:flex; flex-direction:column; gap:6px; padding-bottom:14px;}
#as-overlay .as-progress-bar{height:4px; border-radius:999px; background:var(--line,#e2e8f0); overflow:hidden;}
#as-overlay .as-progress-bar span{display:block; height:100%; border-radius:999px; background:var(--brand,#206efb);
  transition:width .28s cubic-bezier(.22,1,.36,1);}
#as-overlay .as-progress-text{font-size:.7rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
  color:var(--muted,#475569);}

#as-overlay .as-step{display:block; width:100%; text-align:left; border:1px solid var(--line,#e2e8f0);
  border-radius:14px; background:var(--bg,#fff); margin-bottom:10px;}
#as-overlay .as-step--done{display:flex; align-items:center; gap:10px; padding:10px 14px; cursor:pointer;
  font:inherit; color:var(--muted,#475569);}
#as-overlay .as-step--done:hover{border-color:var(--brand,#206efb); color:var(--ink,#0f172a);}
#as-overlay .as-step--done .as-step-label{font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase;}
#as-overlay .as-step--done .as-step-wert{flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  font-size:13px; font-weight:600; color:var(--ink,#0f172a);}
#as-overlay .as-step--done .as-step-stift{font-size:11px; opacity:.5;}
#as-overlay .as-step-nr{display:grid; place-items:center; flex:0 0 auto; width:22px; height:22px; border-radius:999px;
  background:var(--brand-light,#eff6ff); color:var(--brand,#206efb); font-size:11px; font-weight:700;}
#as-overlay .as-step--done .as-step-nr{background:var(--brand,#206efb); color:#fff;}
#as-overlay .as-step--open:has(.as-dd.is-open) .as-step-fuss{position:relative; z-index:1; backdrop-filter:none;}
#as-overlay .as-step--open{padding:16px; box-shadow:0 8px 26px rgba(15,23,42,.07); border-color:#cfe0fd;
  animation:as-step-in .22s cubic-bezier(.22,1,.36,1);}
#as-overlay .as-step-kopf{display:flex; align-items:center; gap:10px; margin-bottom:12px;}
#as-overlay .as-step-kopf label{font-size:15px; font-weight:700; color:var(--ink,#0f172a);}
#as-overlay .as-step-fuss{position:sticky; bottom:-1px; z-index:30; display:flex; align-items:center; gap:8px;
  margin:16px -2px -2px; padding:12px 2px 2px; border-top:1px solid var(--line,#e2e8f0);
  background:linear-gradient(180deg,rgba(255,255,255,.94),#fff 34%); backdrop-filter:blur(8px);}
/* Ein geoeffnetes Auswahlmenue ist Teil des Schritts. Der klebende Fuss darf
   sich nicht davorlegen, wenn die Inhaltsliste bis an den unteren Rand reicht. */
#as-overlay .as-step-zurueck{margin-right:auto;}
@keyframes as-step-in{from{opacity:0; transform:translateY(6px);} to{opacity:1; transform:none;}}

/* Vorlagen als Kacheln: der Grundton ist die Aussage, deshalb wird er gezeigt
   und nicht beschrieben. */
#as-overlay .as-designs{display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:10px;}
#as-overlay .as-design{display:flex; flex-direction:column; gap:8px; padding:10px; border:1px solid var(--line,#e2e8f0);
  border-radius:12px; background:var(--bg,#fff); cursor:pointer; font:inherit; text-align:left;}
#as-overlay .as-design:hover{border-color:var(--brand,#206efb);}
#as-overlay .as-design.is-active{border-color:var(--brand,#206efb); box-shadow:0 0 0 2px rgba(32,110,251,.16);}
#as-overlay .as-design-probe{display:flex; flex-direction:column; justify-content:flex-end; gap:5px; height:64px;
  padding:10px; border-radius:8px; background:#fff; border:1px solid var(--line,#e2e8f0);}
#as-overlay .as-design-probe[data-theme="dunkel"]{background:#0b1f45; border-color:#0b1f45;}
#as-overlay .as-design-bar{display:block; width:26px; height:4px; border-radius:999px; background:var(--brand,#206efb);}
#as-overlay .as-design-zeile{display:block; height:6px; border-radius:3px; background:rgba(15,23,42,.16);}
#as-overlay .as-design-zeile--kurz{width:60%;}
#as-overlay .as-design-probe[data-theme="dunkel"] .as-design-zeile{background:rgba(255,255,255,.32);}
#as-overlay .as-design-name{font-size:12px; font-weight:700; color:var(--ink,#0f172a);}
#as-overlay .as-linkbtn{align-self:flex-start; margin-top:10px; display:inline-flex; align-items:center; gap:6px;
  padding:0; border:0; background:none; color:var(--brand,#206efb); font:inherit; font-size:12px; font-weight:700;
  cursor:pointer;}
#as-overlay .as-linkbtn:hover{text-decoration:underline;}

/* Fehlt eine Voraussetzung, zeigt der Kasten den Weg dorthin statt nur den
   Mangel zu melden. */
#as-overlay .as-notice{display:flex; align-items:center; gap:12px; margin-top:10px; padding:12px 14px;
  border:1px solid #cfe0fd; border-radius:12px;
  background:var(--brand-light,#eff6ff);}
#as-overlay .as-notice-icon{display:grid; place-items:center; flex:0 0 auto; width:30px; height:30px;
  border-radius:999px; background:#fff; color:var(--brand,#206efb);}
#as-overlay .as-notice-text{flex:1; min-width:0;}
#as-overlay .as-notice-text b{display:block; font-size:13px; color:var(--ink,#0f172a);}
#as-overlay .as-guidance{display:flex; gap:9px; align-items:flex-start; margin-top:10px; padding:10px 12px;
  border:1px solid #cfe0fd; border-radius:11px; background:var(--brand-light,#eff6ff);
  color:var(--muted,#475569); font-size:12px; line-height:1.45;}
#as-overlay .as-guidance i{margin-top:2px; color:var(--brand,#206efb);}
#as-overlay .as-guidance.is-warning{border-color:#f2c94c; background:#fffbeb; color:#7c5b00;}
#as-overlay .as-guidance.is-warning i{color:#b7791f;}
/* Fragebogen links, Vorschau rechts. Bei schmalem Popup untereinander. */
#as-overlay .as-split2{display:grid; grid-template-columns:minmax(320px, 460px) minmax(0, 1fr); gap:20px; align-items:stretch; flex:1; min-height:0; width:100%; height:auto;}
#as-overlay .as-split2-form{overflow-y:auto; max-height:100%; padding-right:10px; scrollbar-width:thin;}
#as-overlay .as-split2-form::-webkit-scrollbar{width:8px;}
#as-overlay .as-split2-form::-webkit-scrollbar-thumb{background:var(--line,#e2e8f0); border-radius:99px;}
#as-overlay .as-split2-prev{position:sticky; top:0; display:flex; flex-direction:column; gap:8px; min-height:0; align-self:stretch; overflow:visible; padding:0 8px 16px 0; box-sizing:border-box;}
#as-overlay .as-prev-label{font-size:.68rem; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--muted,#475569);}
/* Die Flaeche nimmt den Rest. Innenabstand haelt Radius und Schatten
   innerhalb des Hosts, damit overflow:hidden am Overlay sie nicht kappt. */
#as-overlay .as-prev-host{flex:1 1 auto; min-height:0; width:100%; display:flex; align-items:center; justify-content:center; position:relative; padding:8px 8px 18px; box-sizing:border-box;}
#as-overlay .as-prev-big{max-width:100%; max-height:100%; min-height:0;
  box-sizing:border-box; display:flex; align-items:flex-start; justify-content:flex-start;
  overflow:hidden; padding:0; border:0; border-radius:14px; background:#fff; position:relative;
  box-shadow:0 12px 40px rgba(15,23,42,.14);}
#as-overlay .as-prev-big[data-kind="linkedin"]{aspect-ratio:1080/1350; flex:0 0 auto;}
#as-overlay .as-prev-big[data-kind="memo"]{aspect-ratio:210/297;}
#as-overlay .as-caption{margin-top:10px; padding:12px 14px; border:1px solid var(--line,#e2e8f0); border-radius:12px;
  background:var(--bg,#fff); max-height:22vh; overflow-y:auto;}
#as-overlay .as-caption-head{display:block; font-size:.68rem; font-weight:700; letter-spacing:.09em;
  text-transform:uppercase; color:var(--muted,#475569); margin-bottom:6px;}
#as-overlay .as-caption p{font-size:13px; line-height:1.5; white-space:pre-wrap; color:var(--ink,#0f172a);}
#as-overlay .as-prev-scale{display:block; transform-origin:top left; flex:0 0 auto; pointer-events:none;}
#as-overlay .as-prev-scale .as-stage,
#as-overlay .as-prev-scale .li{box-shadow:none; border-radius:0;}
@container (max-width: 860px){
  #as-overlay .as-split2{grid-template-columns:1fr; grid-template-rows:auto minmax(220px, 40vh);}
  #as-overlay .as-split2-prev{position:static;}
}
/* Die Buehne aus der Vorlage traegt ihre Masse selbst, damit das Einpassen
   nicht auf einen zusammengefallenen Rahmen rechnet. */
#as-overlay .as-stage--tpl{width:1080px; height:1350px; flex:0 0 auto; overflow:hidden; border-radius:0;}

/* Bildplatz in der Vorlage: die Bedienung liegt als Auflage darauf. */
#as-overlay .as-img--tpl{position:relative; display:block;}
#as-overlay .as-img--bg{position:absolute; inset:0; z-index:3; display:block; pointer-events:none;}
#as-overlay .as-img--bg .as-img-ui{pointer-events:auto;}

/* Vorschau der Varianten: 150px breite Buehne, also Faktor 150/1080. */
/* Platzhalter, wenn das Modell das Layout waehlt. Kein Rahmen um Leere, sondern
   eine ruhige Aussage. */
#as-overlay .as-prev-empty{display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:8px; width:100%; height:100%; padding:24px 28px; text-align:center; text-wrap:balance;
  color:var(--muted,#475569);}
#as-overlay .as-prev-empty i{font-size:1.5rem; color:var(--brand,#206efb); opacity:.75;}
#as-overlay .as-prev-empty b{font-size:.92rem; color:var(--ink,#0f172a); max-width:26ch;}
#as-overlay .as-prev-empty span{font-size:.78rem; max-width:30ch; line-height:1.45;}
#as-overlay .as-prev-nav{position:absolute; bottom:10px; left:50%; transform:translateX(-50%);
  z-index:5; display:flex; align-items:center; gap:4px; padding:3px 5px; background:#fff;
  border:1px solid var(--line,#e2e8f0); border-radius:99px; box-shadow:0 6px 18px rgba(15,23,42,.12);}
#as-overlay .as-prev-nav span{font-size:.7rem; font-weight:700; color:var(--muted,#475569); padding:0 4px;}
#as-overlay .as-prev-nav button{width:26px; height:26px; display:flex; align-items:center; justify-content:center;
  border:0; border-radius:50%; background:transparent; color:var(--brand,#206efb); font-size:.72rem;}
#as-overlay .as-prev-nav button:hover{background:var(--brand-light,#eff6ff);}
#as-overlay .as-prev-note{position:absolute; bottom:10px; right:14px; font-size:.7rem; font-weight:600;
  color:var(--muted,#475569); background:#fff; border:1px solid var(--line,#e2e8f0); border-radius:99px; padding:2px 8px;}

/* Weisses Dropdown fuer das Layout. Eine Karte, die sich oeffnet, mit Miniatur
   je Zeile - kein natives select, weil dort kein Bild moeglich ist. */
#as-overlay .as-dd{position:relative;}
#as-overlay .as-ddhead{width:100%; display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:11px 14px; border:1px solid var(--line,#e2e8f0); border-radius:12px; background:#fff;
  font-size:.86rem; font-weight:600; color:var(--ink,#0f172a); box-shadow:0 1px 2px rgba(15,23,42,.04);}
#as-overlay .as-ddhead:hover{border-color:var(--brand,#206efb);}
#as-overlay .as-ddhead i{font-size:.7rem; color:var(--muted,#475569); transition:transform .15s;}
#as-overlay .as-dd.is-open .as-ddhead{border-color:var(--brand,#206efb); box-shadow:0 0 0 3px rgba(32,110,251,.12);}
#as-overlay .as-dd.is-open .as-ddhead i{transform:rotate(180deg);}
#as-overlay .as-ddlist{display:none; position:absolute; z-index:20; left:0; right:0; top:calc(100% + 6px);
  max-height:340px; overflow-y:auto; padding:6px; background:#fff; border:1px solid var(--line,#e2e8f0);
  border-radius:14px; box-shadow:0 18px 40px rgba(15,23,42,.16);}
#as-overlay .as-dd.is-open .as-ddlist{display:block;}
#as-overlay .as-dd--flow{isolation:isolate;}
#as-overlay .as-dd--flow .as-ddlist{position:static; z-index:2; margin-top:6px; max-height:min(340px,42vh);
  box-shadow:0 8px 24px rgba(15,23,42,.1);}
#as-overlay .as-ddrow{width:100%; display:flex; align-items:center; gap:10px; padding:6px 8px; border:0;
  border-radius:10px; background:transparent; text-align:left; font-size:.82rem; font-weight:600; color:var(--ink,#0f172a);}
#as-overlay .as-ddrow:hover{background:var(--surface,#f8fafc);}
#as-overlay .as-ddrow.is-active{background:var(--brand-light,#eff6ff); color:var(--brand-dark,#165fd9);}
#as-overlay .as-sequence{display:flex; flex-direction:column; gap:7px; margin-bottom:10px;}
#as-overlay .as-sequence-row{display:grid; grid-template-columns:24px 42px minmax(0,1fr) auto; align-items:center; gap:9px;
  padding:7px 8px; border:1px solid var(--line,#e2e8f0); border-radius:11px; background:#fff;}
#as-overlay .as-sequence-nr{display:grid; place-items:center; width:24px; height:24px; border-radius:999px;
  background:var(--brand-light,#eff6ff); color:var(--brand,#206efb); font-size:11px; font-weight:800;}
#as-overlay .as-sequence-copy{min-width:0; display:flex; flex-direction:column; gap:2px;}
#as-overlay .as-sequence-copy b{font-size:12px; color:var(--ink,#0f172a);}
#as-overlay .as-sequence-copy small{font-size:10px; color:var(--muted,#64748b);}
#as-overlay .as-sequence-actions{display:flex; gap:2px;}
#as-overlay .as-sequence-actions button{display:grid; place-items:center; width:26px; height:26px; border:0; border-radius:8px;
  background:transparent; color:var(--muted,#64748b);}
#as-overlay .as-sequence-actions button:hover:not(:disabled){background:var(--brand-light,#eff6ff); color:var(--brand,#206efb);}
#as-overlay .as-sequence-actions button:disabled{opacity:.25; cursor:default;}
#as-overlay .as-ddrow-add{margin-left:auto; display:grid; place-items:center; width:26px; height:26px; border-radius:999px;
  background:var(--brand-light,#eff6ff); color:var(--brand,#206efb);}
#as-overlay .as-ddtext{flex:1; min-width:0;}
#as-overlay .as-ddthumb{flex:0 0 auto; width:42px; height:52px; border-radius:6px; overflow:hidden;
  border:1px solid var(--line,#e2e8f0); background:#fff; display:flex; align-items:center; justify-content:center; color:var(--brand,#206efb);}
#as-overlay .as-mini{display:block; flex:0 0 40px; width:40px; height:50px; overflow:hidden;}
#as-overlay .as-mini-in{display:block; width:1080px; height:1350px; transform:scale(.037); transform-origin:top left; pointer-events:none;}

/* Auszeichnung am Layout: hell, dunkel, Bild oder Diagramm. Keine Miniatur
   mehr in der Antwortspalte - die Vorschau rechts zeigt es in gross. */
#as-overlay .as-tag{font-style:normal; font-size:.62rem; font-weight:700; letter-spacing:.05em;
  text-transform:uppercase; color:var(--muted,#475569); background:var(--surface,#f8fafc);
  border:1px solid var(--line,#e2e8f0); border-radius:99px; padding:1px 6px; margin-left:6px;}
#as-overlay .as-opt:has(input:checked) .as-tag{color:var(--brand,#206efb); border-color:currentColor; background:transparent;}
#as-overlay .as-opt:has(input:checked){
  border-color:var(--brand,#206efb); background:var(--brand-light,#eff6ff);
  color:var(--brand-dark,#165fd9); font-weight:700;
}
#as-overlay .as-free{
  width:100%; border:1px solid var(--line,#e2e8f0); border-radius:12px;
  padding:11px 13px; font:inherit; font-size:14px; resize:vertical;
  background:var(--bg,#fff); color:inherit;
}
#as-overlay .lg-guide{list-style:none; margin:6px 0 0; padding:0; display:flex; flex-direction:column; gap:4px;}
#as-overlay .lg-guide-row{display:flex; align-items:flex-start; gap:7px; font-size:12px; line-height:1.4; color:var(--muted,#475569);}
#as-overlay .lg-guide-row i{flex:0 0 auto; margin-top:2px; font-size:.68rem;}
#as-overlay .lg-guide-row--ok i{color:var(--brand,#206efb);}
#as-overlay .lg-guide-row--warn{color:var(--danger,#dc2626);}
#as-overlay .lg-guide-row--warn i{color:var(--danger,#dc2626);}
#as-overlay .lg-guide-row--info i{color:#94a3b8;}
/* Die Zeile faehrt beim Wechsel kurz ein, damit man sieht, dass sie neu gerechnet wurde. */
#as-overlay .lg-guide-row{animation:lg-guide-in .18s cubic-bezier(.22,1,.36,1);}
@keyframes lg-guide-in{from{opacity:0; transform:translateY(-2px);} to{opacity:1; transform:none;}}
#as-overlay .as-free:focus{outline:none; border-color:var(--brand,#206efb); box-shadow:var(--shadow-focus,0 0 0 3px rgba(32,110,251,.15));}

#as-overlay .as-benches{display:flex; flex-direction:column; gap:10px; margin-top:4px;}
#as-overlay .as-bench{
  display:grid; grid-template-columns:1fr; gap:6px;
  border:1px solid var(--line,#e2e8f0); border-radius:12px; padding:10px 12px; background:var(--surface,#f8fafc);
}
#as-overlay .as-bench b{font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted,#475569);}
#as-overlay .as-bench input, #as-overlay .as-bench textarea{
  width:100%; border:1px solid var(--line,#e2e8f0); border-radius:9px; padding:8px 10px;
  font:inherit; font-size:13px; background:#fff; color:inherit;
}
#as-overlay .as-bench textarea{min-height:52px; resize:vertical;}
#as-overlay .as-pill{
  align-self:flex-start; display:inline-flex; align-items:center; justify-content:center;
  border:1px solid var(--line,#e2e8f0); background:#fff; color:var(--ink,#0f172a);
  border-radius:999px; padding:6px 12px; font-size:12px; font-weight:700;
}
#as-overlay .as-pill:hover{
  border-color:var(--brand,#206efb); background:var(--brand-light,#eff6ff); color:var(--brand,#206efb);
}
/* Die Pflichtmeldung stand ungestaltet als nackter Absatz in der Karte. Sie
   traegt jetzt die Warnfarbe der Marke und liegt als eigener Kasten unter dem
   Feld, das sie betrifft. */
#as-overlay .as-form-error{
  display:block; margin:2px 0 0; padding:10px 12px; border-radius:12px;
  border:1px solid #fecaca; background:#fef2f2; color:var(--danger,#dc2626);
  font-size:13px; line-height:1.45; font-weight:600;
}
#as-overlay .as-q--muted > label, #as-overlay .as-q--muted .as-hint{color:#94a3b8;}
#as-overlay .as-q--muted .as-hint{font-size:12px; line-height:1.45;}
#as-overlay .as-slots{display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:4px;}
#as-overlay .as-slot{
  border:1px dashed var(--line,#cbd5e1); border-radius:12px; padding:8px;
  background:#fff; text-align:left; cursor:pointer; display:flex; flex-direction:column; gap:6px;
}
#as-overlay .as-slot:hover{border-color:var(--brand,#206efb);}
#as-overlay .as-slot b{font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted,#475569);}
#as-overlay .as-slot small{font-size:11px; color:var(--muted,#64748b);}
#as-overlay .as-slot-frame{
  width:100%; aspect-ratio:46/28; border-radius:8px; overflow:hidden;
  background:#f1f5f9; display:grid; place-items:center; color:#94a3b8; font-size:18px;
}
#as-overlay .as-slot-frame.is-pot{aspect-ratio:52/36;}
#as-overlay .as-slot-frame img{width:100%; height:100%; object-fit:cover; display:block;}
#as-overlay .as-drafts{display:flex; flex-direction:column; gap:12px; min-height:0;}
#as-overlay .as-drafts-head{
  width:100%; display:flex; align-items:center; justify-content:space-between; gap:8px;
  background:transparent; border:0; padding:0; font-size:13px; font-weight:700; text-align:left;
}
#as-overlay .as-drafts-head i{color:var(--muted,#64748b);}
#as-overlay .as-draft-list{display:flex; flex-direction:column; gap:8px; margin-top:10px;}
#as-overlay .as-draft{
  width:100%; text-align:left; border:1px solid var(--line,#e2e8f0); border-radius:12px;
  background:#fff; padding:10px 12px; display:flex; flex-direction:column; gap:4px;
}
#as-overlay .as-draft:hover{border-color:var(--brand,#206efb);}
#as-overlay .as-draft strong{font-size:13px;}
#as-overlay .as-draft span{font-size:12px; color:var(--muted,#64748b); line-height:1.4;}
#as-overlay .as-draft em{font-style:normal; font-size:11px; color:#64748b;}
#as-overlay .as-draft.is-error{border-color:#fecaca;}
#as-overlay .as-draft.is-run{border-color:#bfdbfe;}
#as-overlay .as-load-actions{margin-top:8px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;}
#as-overlay .as-load-actions .as-pill{
  min-width:148px; padding:10px 22px; font-size:13px; font-weight:700;
}
#as-overlay .as-load-actions .as-pill-danger:hover{
  border-color:#b42318; background:#fef3f2; color:#b42318;
}

/* Ladeanzeige: echte Abschnitte, gerundete Minuten, pulsierender Balken. */
#as-overlay .as-load{display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:14px; min-height:300px; text-align:center; padding:28px 24px; width:min(420px, 100%); margin:0 auto;}
#as-overlay .as-load-icon{color:var(--brand,#206efb); font-size:1.7rem; line-height:1;
  animation:as-pulse 1.4s ease-in-out infinite;}
@keyframes as-pulse{0%,100%{transform:scale(1); opacity:1;} 50%{transform:scale(1.12); opacity:.72;}}
#as-overlay .as-load-text{margin:0; font-size:1.05rem; font-weight:700; color:var(--ink,#0f172a);}
#as-overlay .as-load-eta{
  margin:2px 0 0; display:inline-flex; align-items:center; gap:7px;
  font-size:.78rem; font-weight:400; letter-spacing:.01em; color:#64748b;
}
#as-overlay .as-load-eta i{font-size:.72rem; color:#94a3b8;}
#as-overlay .as-load-bar{
  width:100%; height:10px; border-radius:99px; background:var(--line,#e2e8f0);
  overflow:hidden; position:relative;
}
#as-overlay .as-load-bar-fill{
  display:block; height:100%; border-radius:inherit; width:8%;
  background:linear-gradient(90deg,#1d4ed8,#206efb,#7dd3fc,#206efb);
  background-size:220% 100%;
  animation:as-bar-flow 1.6s linear infinite, as-bar-pulse 1.4s ease-in-out infinite;
  transition:width .45s cubic-bezier(.22,1,.36,1);
}
#as-overlay .as-load-bar::after{
  content:""; position:absolute; inset:0; pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);
  animation:as-bar-shimmer 1.5s ease-in-out infinite;
}
@keyframes as-bar-flow{from{background-position:200% 0;} to{background-position:0 0;}}
@keyframes as-bar-pulse{0%,100%{filter:brightness(1);} 50%{filter:brightness(1.35);}}
@keyframes as-bar-shimmer{from{transform:translateX(-100%);} to{transform:translateX(100%);}}
#as-overlay .as-load-log{
  margin:4px 0 0; padding:0; list-style:none; width:100%; text-align:left;
  font-size:.78rem; color:var(--muted,#475569); line-height:1.4;
}
#as-overlay .as-load-log li{display:flex; gap:8px; padding:3px 0; border-top:1px solid var(--line,#e2e8f0);}
#as-overlay .as-load-log li:first-child{border-top:0;}
#as-overlay .as-load-log b{flex:0 0 3.2em; font-weight:600; color:#64748b;}
#as-overlay .as-load-log span{min-width:0;}
@media (prefers-reduced-motion: reduce){
  #as-overlay .as-load-icon, #as-overlay .as-load-bar-fill, #as-overlay .as-load-bar::after{animation:none; opacity:1;}
  #as-overlay .as-load-bar-fill{background:#206efb;}
  #as-overlay .as-step--open{animation:none;}
  #as-overlay .as-progress-bar span{transition:none;}
}

#as-overlay .as-loader{display:flex; align-items:center; justify-content:center; min-height:280px;}
#as-overlay .as-loader::after{
  content:""; width:34px; height:34px; border-radius:50%;
  border:3px solid var(--brand-light,#eff6ff); border-top-color:var(--brand,#206efb);
  animation:as-spin .7s linear infinite;
}
@keyframes as-spin{to{transform:rotate(360deg);}}
#as-overlay .as-error{
  max-width:720px; border:1px solid var(--danger,#dc2626); border-radius:14px;
  padding:18px 20px; background:var(--bg,#fff); display:flex; flex-direction:column; gap:12px;
}
#as-overlay .as-error strong{font-size:14px; color:var(--danger,#dc2626);}
#as-overlay .as-error p{margin:0; font-size:13px; line-height:1.55; white-space:pre-wrap; word-break:break-word;}

#as-overlay .as-content:has(.as-work){overflow:hidden; display:flex; flex-direction:column; padding:24px 24px 32px;}
#as-overlay .as-work{display:grid; grid-template-columns:1fr 296px; gap:20px; align-items:stretch;
  flex:1; min-height:0; height:auto; position:relative;}
#as-overlay .as-work:not(:has(.as-inspector)){grid-template-columns:1fr;}
#as-overlay .as-stagearea{display:flex; flex-direction:column; align-items:center; justify-content:center;
  min-width:0; min-height:0; height:100%; overflow:hidden; position:relative;
  padding:12px 12px 20px; box-sizing:border-box;}
#as-overlay .as-frame{width:auto; max-width:100%; display:flex; flex-direction:column; gap:8px; align-items:center; position:relative;}
#as-overlay .as-frame.is-off{display:none !important;}
#as-overlay .as-scaler{position:relative; margin:0 auto; overflow:hidden; border-radius:14px;
  background:#fff; box-shadow:var(--shadow-lg,0 12px 40px rgba(15,23,42,.14));}
#as-overlay .as-scaler > .as-stage{position:absolute; top:0; left:0; transform-origin:top left; border-radius:14px;}
#as-overlay .as-scaler .li{border-radius:14px;}
#as-overlay .as-stagearea[data-readonly="true"] [data-field]{cursor:default; user-select:text;}

/* Fertiger LinkedIn-Entwurf: vertraute Feed-Hierarchie in der ROOTS-Anmutung.
   Die echte Asset-Buehne bleibt unveraendert und wird nur in den Post gesetzt. */
#as-overlay .as-work--feed{display:flex; justify-content:center; overflow:auto; padding:0 8px 8px;}
#as-overlay .as-linkedin-post{width:min(680px,100%); height:100%; min-height:520px; display:grid;
  grid-template-rows:auto auto minmax(260px,1fr) auto; overflow:hidden; background:#fff;
  border:1px solid var(--line,#e2e8f0); border-top:3px solid var(--brand,#206efb); border-radius:16px;
  box-shadow:0 14px 42px rgba(15,23,42,.12); color:#0f172a;}
#as-overlay .as-linkedin-head{display:flex; align-items:center; gap:11px; padding:14px 16px 10px;}
#as-overlay .as-linkedin-avatar{display:grid; place-items:center; flex:0 0 auto; width:46px; height:46px;
  padding:7px; overflow:hidden; border:1px solid #dbe7ff; border-radius:9px; background:#fff;}
#as-overlay .as-linkedin-avatar img{display:block; width:100%; height:100%; object-fit:contain;}
#as-overlay .as-linkedin-byline{display:flex; flex-direction:column; min-width:0; line-height:1.25;}
#as-overlay .as-linkedin-byline strong{font-size:14px; color:#0f172a;}
#as-overlay .as-linkedin-byline span,#as-overlay .as-linkedin-byline small{font-size:11px; color:#64748b;}
#as-overlay .as-linkedin-more{margin-left:auto; align-self:flex-start; border:0; background:transparent;
  color:#475569; font-size:18px; padding:5px 7px; pointer-events:none;}
#as-overlay .as-linkedin-caption{padding:2px 16px 12px;}
#as-overlay .as-linkedin-copy{margin:0; font-size:13px; line-height:1.48; white-space:pre-wrap; color:#1e293b;}
#as-overlay .as-linkedin-caption:empty{display:none;}
#as-overlay .as-stagearea--linkedin{min-height:260px; padding:8px 42px 20px; background:#f8fafc;
  border-top:1px solid #edf2f7; border-bottom:1px solid #edf2f7;}
#as-overlay .as-linkedin-actions{display:grid; grid-template-columns:repeat(4,1fr); gap:2px; padding:7px 10px; background:#fff;}
#as-overlay .as-linkedin-action{display:flex; align-items:center; justify-content:center; gap:6px; min-height:34px;
  border-radius:7px; color:#475569; font-size:11px; font-weight:600;}
#as-overlay .as-linkedin-action i{font-size:13px; color:#64748b;}
#as-overlay .as-stage--memo{border-radius:14px; background:#fff !important;}
#as-overlay .as-stage--memo .em-page{border-radius:14px; overflow:hidden;}
#as-overlay .as-stage--memo .em-cover{border-radius:14px;}
#as-overlay .as-slidetools{
  width:100%; display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  background:var(--bg,#fff); border:1px solid var(--line,#e2e8f0); border-radius:12px; padding:8px 10px;
}
#as-overlay .as-slidetools .as-num{font-size:12px; font-weight:700; color:var(--muted,#475569); margin-right:4px;}
#as-overlay .as-slidetools select{
  font:inherit; font-size:13px; padding:6px 10px; border-radius:9px;
  border:1px solid var(--line,#e2e8f0); background:var(--bg,#fff); color:inherit;
}
#as-overlay .as-stage--memo{width:210mm !important; height:297mm !important; background:#fff !important;}
#as-overlay .as-stage--memo .em-page.is-off{display:none !important;}

#as-overlay .as-inspector{
  position:sticky; top:0; display:flex; flex-direction:column; gap:16px;
  background:var(--bg,#fff); border:1px solid var(--line,#e2e8f0); border-radius:16px; padding:16px;
}
#as-overlay .as-group{display:flex; flex-direction:column; gap:9px;}
#as-overlay .as-group > span{font-size:11px; font-weight:700; letter-spacing:1.4px; text-transform:uppercase; color:var(--muted,#475569);}
#as-overlay .as-group .as-row{display:flex; gap:6px; flex-wrap:wrap;}
#as-overlay .as-seg{
  border:1px solid var(--line,#e2e8f0); background:var(--bg,#fff);
  border-radius:9px; padding:7px 12px; font-size:12.5px; font-weight:600;
}
#as-overlay .as-seg[aria-pressed="true"]{background:var(--brand,#206efb); border-color:var(--brand,#206efb); color:#fff;}
#as-overlay .as-inspector .as-btn{justify-content:center; width:100%;}
#as-overlay .as-savehint{font-size:12px; line-height:1.4; color:#b42318; min-height:1em; margin:0;}
#as-overlay .as-post{
  width:100%; min-height:170px; resize:vertical; font:inherit; font-size:13px; line-height:1.5;
  border:1px solid var(--line,#e2e8f0); border-radius:12px; padding:10px 12px;
  background:var(--bg,#fff); color:inherit;
}

#as-overlay .as-fmt{
  position:absolute; z-index:30; display:none; gap:2px; align-items:center; flex-wrap:nowrap;
  background:#fff; border:1px solid var(--line,#e2e8f0); border-radius:12px;
  padding:5px; box-shadow:0 10px 28px rgba(15,23,42,.14);
  pointer-events:auto;
}
#as-overlay .as-fmt[data-open="1"]{display:flex;}
#as-overlay .as-fmt button{
  border:0; background:transparent; border-radius:8px; width:30px; height:30px;
  display:grid; place-items:center; font-size:13px;
}
#as-overlay .as-fmt button:hover{background:var(--surface,#f8fafc); color:var(--brand,#206efb);}
#as-overlay .as-fmt hr{width:1px; height:20px; border:0; background:var(--line,#e2e8f0); margin:0 3px;}
#as-overlay .as-swatch{width:16px; height:16px; border-radius:999px; border:1px solid rgba(15,23,42,.18); display:block;}

#as-overlay .as-img-ui{
  position:absolute; right:8px; bottom:8px; z-index:6;
  display:flex; align-items:center; gap:6px;
}
#as-overlay .as-img-btn{
  width:32px; height:32px; border:0; border-radius:10px;
  background:rgba(15,23,42,.72); color:#fff;
  display:grid; place-items:center; font-size:13px;
  box-shadow:0 6px 16px rgba(15,23,42,.22);
}
#as-overlay .as-img-btn:hover{background:rgba(15,23,42,.88);}
#as-overlay .as-img-btn.is-clear{width:28px; height:28px; font-size:12px; background:rgba(255,255,255,.94); color:#0f172a;}
#as-overlay .as-shot:has(img[src]:not([src=""])) .as-img-btn:not(.is-clear),
#as-overlay .as-img--tpl:has(img[src]:not([src=""])) .as-img-btn:not(.is-clear),
#as-overlay .em-shot:has(img[src]:not([src=""])) .as-img-btn:not(.is-clear){opacity:0;}
#as-overlay .as-shot:hover .as-img-btn,
#as-overlay .as-img--tpl:hover .as-img-btn,
#as-overlay .em-shot:hover .as-img-btn{opacity:1;}

#as-overlay .as-hint{font-size:12px; line-height:1.5; color:var(--muted,#475569); margin:0;}
#as-overlay .as-q > .as-hint{margin-top:-2px;}
#as-overlay .as-wip{
  margin:4px 0 12px; padding:14px 16px; border-radius:12px;
  background:#fff7ed; border:1px solid #fdba74; color:#9a3412;
  font-size:13px; line-height:1.5;
}
#as-overlay .as-wip strong{display:block; margin-bottom:4px; font-size:13px;}
#as-overlay .as-wip p{margin:0;}
#as-overlay .as-file{display:none;}

#as-overlay .as-crop{
  position:absolute; inset:0; z-index:80;
  background:rgba(15,23,42,.5); display:grid; place-items:center; padding:24px;
}
#as-overlay .as-crop[hidden]{display:none;}
#as-overlay .as-crop-card{
  width:min(640px,100%); background:#fff; border-radius:20px; padding:22px 22px 18px;
  box-shadow:0 28px 70px rgba(15,23,42,.32); display:flex; flex-direction:column; gap:14px;
}
#as-overlay .as-crop-card h3{margin:0; font-size:18px;}
#as-overlay .as-crop-drop{
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;
  min-height:188px; border:1.5px dashed #cbd5e1; border-radius:16px;
  background:#f8fafc; color:#475569; text-align:center; padding:22px 16px;
}
#as-overlay .as-crop-drop.is-over{border-color:#206efb; background:#eff6ff;}
#as-overlay .as-crop-drop i{font-size:28px; color:#64748b;}
#as-overlay .as-crop-drop b{font-size:14px; color:#0f172a;}
#as-overlay .as-crop-drop span{font-size:12px; color:#94a3b8;}
#as-overlay .as-crop-drop[hidden],
#as-overlay .as-crop-editor[hidden]{display:none;}
#as-overlay .as-crop-editor{display:flex; flex-direction:column; gap:12px;}
#as-overlay .as-crop-modes{display:flex; flex-wrap:wrap; gap:6px;}
#as-overlay .as-crop-modes button{
  border:1px solid #e2e8f0; background:#fff; color:#334155;
  border-radius:999px; padding:6px 12px; font-size:12px; font-weight:600;
}
#as-overlay .as-crop-modes button.is-on{border-color:#206efb; background:#eff6ff; color:#165fd9;}
#as-overlay .as-crop-frame{
  width:100%; overflow:hidden; border-radius:12px; border:1px solid #e2e8f0;
  background:#0f172a; position:relative; cursor:grab; touch-action:none;
}
#as-overlay .as-crop-frame:active{cursor:grabbing;}
#as-overlay .as-crop-img{
  position:absolute; left:50%; top:50%; max-width:none;
  transform-origin:center center; pointer-events:none; user-select:none;
}
#as-overlay .as-crop-actions{display:flex; justify-content:flex-end; gap:8px;}
#as-overlay .as-crop-zoom{display:flex; align-items:center; gap:12px; font-size:13px; color:#475569;}
#as-overlay .as-crop-zoom input{flex:1; accent-color:#206efb;}

@media (max-width:1180px){
  #as-overlay{grid-template-columns:1fr;}
  #as-overlay .as-rail{flex-direction:row; align-items:center; border-right:0; border-bottom:1px solid var(--line,#e2e8f0); overflow-x:auto; height:auto;}
  #as-overlay .as-rail .as-railtitle{display:none;}
  #as-overlay .as-steps{flex-direction:row;}
  #as-overlay .as-rail-tab{margin-top:0; margin-left:auto; width:auto;}
  #as-overlay .as-work{grid-template-columns:1fr;}
  #as-overlay .as-inspector{position:static;}
}
`;

/* ─────────────────────────  Hilfsmittel  ───────────────────────── */

const DEFAULT_ESCAPE = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

function attr(value) {
  return DEFAULT_ESCAPE(value).replace(/'/g, "&#39;");
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function isCmoHundredDaysSignal(source = {}) {
  const id = String(source.signal_id || "").trim().toLowerCase();
  if (id === "cmo_wechsel") return true;
  const topics = toArray(source.topics).map((teil) => String(teil || "").trim().toLowerCase());
  if (topics.includes("cmo_wechsel")) return true;
  const offering = String(source.matched_offering || source.roots_offering || "");
  return /100[\s-]*tage.{0,80}cmo|cmo.{0,80}100[\s-]*tage|erste[n]?\s+100[\s-]*tage/i.test(offering);
}

function companyFrom(source) {
  return String(
    source?.primary_company
    || source?.company
    || (toArray(source?.tier1_companies)[0] || ""),
  ).trim();
}

/** Platzhalter-Titel der Fragebogen-Vorschau. Kein Modellaufruf. */
export const PREVIEW_MEMO_TITLE = "KI im Jahr 2026: Chancen und Herausforderungen";

export function previewMemoTitle(answers = {}, erkannt = "") {
  if (String(answers.company_named || "") === "no") return PREVIEW_MEMO_TITLE;
  const custom = String(answers.company_mode || "") === "custom";
  const firma = String((custom ? answers.company_text : erkannt) || "").trim();
  if (!firma) return PREVIEW_MEMO_TITLE;
  return `Wie kann ${firma} Thema XY umsetzen?`;
}

function themeKicker(source = {}) {
  for (const topic of toArray(source.topics)) {
    if (TOPIC_KICKERS[topic]) return TOPIC_KICKERS[topic];
  }
  if (TOPIC_KICKERS[source.signal_id]) return TOPIC_KICKERS[source.signal_id];
  if (TOPIC_KICKERS[source.territory]) return TOPIC_KICKERS[source.territory];
  const label = String(source.signal_label || "").trim();
  if (label) return label.replace(/[_-]+/g, " ").toUpperCase().slice(0, 26);
  return "INSIGHT";
}

function cropSpecFor(key) {
  const name = String(key || "");
  if (name.startsWith("benchmarks.")) {
    return { ...MEMO_SHOT_PIXELS.benchmark, mm: MEMO_SHOT_ASPECT.benchmark, label: "Benchmark" };
  }
  if (name.startsWith("potentials.")) {
    return { ...MEMO_SHOT_PIXELS.potential, mm: MEMO_SHOT_ASPECT.potential, label: "Potenzial" };
  }
  return { ...LINKEDIN_SHOT_PIXELS, mm: { w: 1080, h: 1350 }, label: "Folie" };
}

/** Sucht den Ausschnitt mit der höchsten Helligkeitsstreuung, also Kanten und Motiv. */
function smartCropPan(img, outW, outH) {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) return { panX: 0.5, panY: 0.5 };
  const tw = 64;
  const th = Math.max(8, Math.round(64 * srcH / srcW));
  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { panX: 0.5, panY: 0.5 };
  ctx.drawImage(img, 0, 0, tw, th);
  let data;
  try { data = ctx.getImageData(0, 0, tw, th).data; } catch (_) {
    return { panX: 0.5, panY: 0.5 };
  }
  const target = outW / outH;
  const imgRatio = srcW / srcH;
  let cw;
  let ch;
  if (imgRatio > target) {
    ch = th;
    cw = Math.max(1, th * target);
  } else {
    cw = tw;
    ch = Math.max(1, tw / target);
  }
  const maxX = Math.max(0, tw - cw);
  const maxY = Math.max(0, th - ch);
  const stepX = Math.max(1, Math.round(Math.max(1, maxX) / 8));
  const stepY = Math.max(1, Math.round(Math.max(1, maxY) / 8));
  let best = { score: -1, panX: 0.5, panY: 0.5 };
  const lumAt = (x, y) => {
    const i = (y * tw + x) * 4;
    return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  };
  for (let y0 = 0; y0 <= maxY; y0 += stepY) {
    for (let x0 = 0; x0 <= maxX; x0 += stepX) {
      let sum = 0;
      let sum2 = 0;
      let n = 0;
      const yEnd = Math.min(th, y0 + ch);
      const xEnd = Math.min(tw, x0 + cw);
      for (let y = y0; y < yEnd; y += 2) {
        for (let x = x0; x < xEnd; x += 2) {
          const L = lumAt(x, y);
          sum += L;
          sum2 += L * L;
          n += 1;
        }
      }
      const mean = sum / Math.max(1, n);
      const score = sum2 / Math.max(1, n) - mean * mean;
      if (score > best.score) {
        best = {
          score,
          panX: maxX ? x0 / maxX : 0.5,
          panY: maxY ? y0 / maxY : 0.5,
        };
      }
    }
  }
  return { panX: best.panX, panY: best.panY };
}

function uid() {
  return `s${Math.random().toString(36).slice(2, 9)}`;
}

// Eingefügter Fremdtext kann Markup mitbringen. Was danach gespeichert und
// heruntergeladen wird, darf nichts Ausführbares enthalten.
function sanitizeFragment(html) {
  const box = document.createElement("div");
  box.innerHTML = String(html ?? "");
  box.querySelectorAll("script, style, iframe, object, embed, link, meta, form").forEach((node) => node.remove());
  box.querySelectorAll("*").forEach((node) => {
    for (const name of [...node.getAttributeNames()]) {
      const value = node.getAttribute(name) || "";
      if (/^on/i.test(name) || (/^(href|src|xlink:href)$/i.test(name) && /^\s*javascript:/i.test(value))) {
        node.removeAttribute(name);
      }
    }
  });
  return box.innerHTML;
}

import { feldHinweise, guideMarkup, slideEmpfehlung } from "./linkedin-guides.mjs?v=20260823-2300";
import { ASSET_TEMPLATE_CSS, ASSET_LAYOUT_CSS, ASSET_TEMPLATES, ASSET_LAYOUTS, ASSET_LAYOUT_LABELS } from "./asset-templates.js?v=20260823-2300";
import { MEMO_TEMPLATE, MEMO_TEMPLATE_CSS } from "./memo-template.js?v=20260816-1500";
import { assetEtaLabel, assetEtaProgressPct, assetEtaRemainingMs, assetEtaStagesFromLog } from "./asset-eta.mjs?v=20260816-1126";

/* ─────────────────────────  Einstieg  ───────────────────────── */

let openInstance = null;

/** Schliesst ein offenes Studio. Von aussen aufrufbar, damit das Artikel-Popup
 *  seine Ebene abraeumen kann, bevor es selbst verschwindet. */
/** Der Fragebogen des manuellen Signals benutzt dieselbe Oberflaeche. Er
 *  ersetzt `#as-overlay` durch seine eigene Kennung, damit beide Ebenen
 *  gleich aussehen und trotzdem unabhaengig voneinander leben. */
export const ASSET_CHROME_CSS = CHROME_CSS;

export function closeAssetStudio() {
  if (openInstance) openInstance.close();
}

export function openAssetStudio({ kind, articleId, signal, callApi, escapeHtml, host, notify, openSettingsPanel, prefill } = {}) {
  // Zwei Studios gleichzeitig würden sich Tastatur und Auswahl streitig machen.
  // Eine Instanz, deren Overlay nicht mehr im Dokument haengt, ist aber keine
  // Instanz mehr: sie entsteht, wenn das Popup unter dem Studio geschlossen
  // wird, und blockierte danach jeden weiteren Klick auf den Knopf.
  if (openInstance) {
    if (openInstance.lebt()) return openInstance;
    openInstance = null;
  }

  const esc = typeof escapeHtml === "function" ? escapeHtml : DEFAULT_ESCAPE;
  const api = typeof callApi === "function" ? callApi : async () => { throw new Error("Keine Verbindung zum Server verfügbar."); };
  const assetKind = kind === "memo" ? "memo" : "linkedin";
  const isMemo = assetKind === "memo";
  const source = signal && typeof signal === "object" ? signal : {};
  const company = companyFrom(source);
  const cmoHundredDays = isMemo && isCmoHundredDaysSignal(source);
  const questions = isMemo ? memoQuestions(company, cmoHundredDays) : FORM_LINKEDIN;

  const state = {
    step: "form",
    // Ein manuelles Signal bringt Antworten mit: Profil, Modus und die Texte,
    // die der Nutzer schon geschrieben hat. Sie bleiben veraenderbar.
    answers: { ...defaultAnswers(questions), ...vorbelegung(questions, prefill) },
    payload: null,
    assetId: null,
    error: "",
    formError: "",
    busy: false,
    logo: LOGO_PATH,
    stage: { theme: "light", accent: "brand", band: true, corners: "round" },
    slides: [],
    memo: null,
    postText: "",
    toneOfVoice: "",
    toneGeladen: false,
    designs: [],
    designsGeladen: false,
    // Fusszeile, Domain und Logo der gewaehlten Vorlage. Was hier steht, steht
    // auch auf der Kachel.
    chrome: { footer_left: "ROOTS Consultants", domain: "roots-consultants.com", logo: "", custom: false },
    // Der Fragebogen zeigt eine Frage offen, die beantworteten darueber als
    // Zeile. formSeen merkt sich die weiteste Stelle, damit der Sprung zurueck
    // den Abschluss nicht wieder verriegelt.
    // Kommt das Signal aus dem manuellen Fragebogen, sind die dort schon
    // beantworteten Fragen erledigt. Der Fragebogen oeffnet bei der ersten
    // offenen Frage; die erledigten stehen darueber und bleiben anklickbar.
    ddOffen: false,
    multiOffen: false,
    stepKey: erstesOffenesSchritt(questions, prefill),
    stepSeen: [],
    formErrorKey: "",
    pendingImage: null,
    formImages: {},
    cancelRequested: false,
    leftRunning: false,
    drafts: [],
    formTab: "form",
    draftsUhr: 0,
    draftsError: "",
    prevIndex: 0,
    ladeAbschnitt: "lesen",
    ladeStart: 0,
    ladeUhr: 0,
    forecastMs: 0,
    laufLog: [],
    viewZoom: 1,
    updatedAt: "",
  };

  const cleanups = [];
  const overlay = document.createElement("div");
  overlay.id = "as-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", isMemo ? "Ansprache" : "LinkedIn-Asset");

  const styleIsland = document.createElement("style");
  styleIsland.textContent = `${CHROME_CSS}\n${ASSET_TEMPLATE_CSS}\n${ASSET_LAYOUT_CSS}\n${MEMO_TEMPLATE_CSS}\n${STAGE_CSS}\n${printCss(isMemo)}`;
  overlay.appendChild(styleIsland);

  const shell = document.createElement("div");
  shell.style.display = "contents";
  overlay.appendChild(shell);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.className = "as-file";
  overlay.appendChild(fileInput);

  const cropOverlay = document.createElement("div");
  cropOverlay.className = "as-crop";
  cropOverlay.hidden = true;
  cropOverlay.innerHTML = `
    <div class="as-crop-card">
      <h3>Bild in den Platzhalter legen</h3>
      <p class="as-hint" data-crop-hint>Zuerst Datei wählen, dann den Ausschnitt auf das exakte Format der Vorlage bringen.</p>
      <div class="as-crop-drop" data-crop-drop>
        <i class="fa-regular fa-image"></i>
        <b>Bild hierher ziehen</b>
        <span>oder</span>
        <button type="button" class="as-btn as-btn--primary" data-act="crop-browse">Datei auswählen</button>
      </div>
      <div class="as-crop-editor" data-crop-editor hidden>
        <div class="as-crop-modes" data-crop-modes>
          <button type="button" data-crop-mode="fill">Füllen</button>
          <button type="button" data-crop-mode="top">Oben</button>
          <button type="button" data-crop-mode="center" class="is-on">Mitte</button>
          <button type="button" data-crop-mode="bottom">Unten</button>
          <button type="button" data-crop-mode="smart">Intelligent</button>
        </div>
        <div class="as-crop-frame" data-crop-frame>
          <img class="as-crop-img" data-crop-img alt="">
        </div>
        <label class="as-crop-zoom">Zoom <input type="range" data-crop-zoom min="100" max="280" step="1" value="100"></label>
      </div>
      <div class="as-crop-actions">
        <button type="button" class="as-btn" data-act="crop-cancel">Abbrechen</button>
        <button type="button" class="as-btn as-btn--primary" data-act="crop-ok" data-crop-ok disabled>Zuschneiden</button>
      </div>
    </div>`;
  overlay.appendChild(cropOverlay);

  const fsExit = document.createElement("button");
  fsExit.type = "button";
  fsExit.className = "as-fs-exit";
  fsExit.setAttribute("data-act", "toggle-fs");
  fsExit.setAttribute("aria-label", "Vollbild beenden");
  fsExit.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
  overlay.appendChild(fsExit);

  // Das Studio gehoert in das Artikel-Popup, nicht darueber: der Artikel bleibt
  // stehen, das Studio legt sich als Ebene in denselben Rahmen, und Schliessen
  // gibt den Artikel unveraendert frei - ohne Nachladen.
  const mount = host instanceof HTMLElement ? host : document.body;
  const inHost = mount !== document.body;
  if (inHost) overlay.classList.add("as-in-host");
  const prevOverflow = inHost ? "" : document.body.style.overflow;
  mount.appendChild(overlay);
  if (!inHost) document.body.style.overflow = "hidden";

  /* ── Zustand aus dem Fragebogen ── */

  /** Alle Vorlagen, die zum gewaehlten Profil gehoeren. */
  function designListe(answers = state.answers) {
    if (answers.profile === "private") {
      return state.designs.length ? state.designs : [STANDARD_DESIGN];
    }
    return ROOTS_DESIGNS;
  }

  function aktivesDesign(answers = state.answers) {
    const liste = designListe(answers);
    return liste.find((d) => d.id === answers.design) || liste[0];
  }

  /** Die Vorlage traegt hell/dunkel. Die Layoutliste und der Prompt lesen
   *  weiterhin look, deshalb wird es hier nachgezogen. */
  function synchronisiereDesign() {
    const liste = designListe();
    if (!liste.some((d) => d.id === state.answers.design)) {
      state.answers.design = liste[0].id;
    }
    const design = aktivesDesign();
    state.answers.look = design.theme === "dunkel" ? "dunkel" : "hell";
    // Der Server liest theme, nicht look. Ohne diese Zeile blieb jede Wahl
    // "dunkel" im Browser stehen und der Prompt sprach weiter von hell.
    state.answers.theme = state.answers.look === "dunkel" ? "dark" : "light";
    state.chrome = {
      footer_left: design.footer || "",
      domain: design.domain || "",
      logo: design.logo || "",
      custom: state.answers.profile === "private",
    };
    const passt = layoutOptionen().some(([key]) => key === state.answers.variant);
    if (!passt) state.answers.variant = "auto";
    const rahmen = state.answers.look === "dunkel"
      ? { U1: "U2", U2: "U2", U3: "U4", U4: "U4", U5: "U6", U6: "U6", U7: "U8", U8: "U8" }
      : { U1: "U1", U2: "U1", U3: "U3", U4: "U3", U5: "U5", U6: "U5", U7: "U7", U8: "U7" };
    const arten = gewaehlteArten()
      .map((key) => rahmen[key] || key)
      .filter((key) => LOOK[key] === state.answers.look);
    state.answers.slide_pick = arten.join(",");
    state.answers.slide_cover = arten.find((key) => SLIDE_ROLE[key] === "cover") || "";
    state.answers.slide_content = arten.filter((key) => !SLIDE_ROLE[key]).join(",");
    state.answers.slide_end = arten.find((key) => SLIDE_ROLE[key] === "end") || "";
  }

  /** Der erste Schritt, den das manuelle Signal nicht schon beantwortet hat.
   *  Bedingte Fragen werden gegen die vorbelegten Antworten geprueft, sonst
   *  landet der Einstieg auf einer Frage, die gar nicht gestellt wird. */
  function erstesOffenesSchritt(list, prefill) {
    const vorbelegt = vorbelegung(list, prefill);
    const schluessel = new Set(Object.keys(vorbelegt));
    if (!schluessel.size) return "";
    const antworten = { ...defaultAnswers(list), ...vorbelegt };
    const offen = list
      .filter((q) => !q.when || q.when(antworten))
      .find((q) => !schluessel.has(q.key));
    return offen ? offen.key : ENDE;
  }

  /** Nur Schluessel, die der Fragebogen kennt: fremde Felder wuerden still in
   *  den Antworten liegen und beim Erzeugen mitgeschickt werden. */
  function vorbelegung(list, prefill) {
    const quelle = prefill && typeof prefill === "object" ? prefill : {};
    const erlaubt = new Set();
    for (const q of list) {
      erlaubt.add(q.key);
      if (q.free) erlaubt.add(q.free.key);
    }
    const out = {};
    for (const [key, wert] of Object.entries(quelle)) {
      if (erlaubt.has(key) && wert !== undefined && wert !== null) out[key] = wert;
    }
    return out;
  }

  function defaultAnswers(list) {
    const out = {};
    // Mehrfachauswahl startet leer: eine vorausgewaehlte Slide-Art waere eine
    // Entscheidung, die niemand getroffen hat.
    for (const q of list) out[q.key] = ["multi", "multi-content", "frame"].includes(q.art) ? "" : q.options[0][0];
    for (const q of list) if (q.free) out[q.free.key] = "";
    if (isMemo) {
      for (let i = 0; i < 3; i += 1) {
        out[`bench_${i}_name`] = "";
        out[`bench_${i}_text`] = "";
        out[`bench_${i}_tag`] = "";
      }
    }
    return out;
  }

  /* ── Aufbau der Schritte ── */

  function render() {
    shell.innerHTML = `
      <nav class="as-rail">
        <button type="button" class="as-back" data-act="close"><i class="fa-solid fa-arrow-left"></i>Zurück</button>
        <span class="as-railtitle">${isMemo ? "Ansprache" : "LinkedIn-Asset"}</span>
        <ol class="as-steps">
          ${stepItem(1, "Fragebogen", "form")}
          ${stepItem(2, "Entwurf", "draft")}
          ${stepItem(3, "Bearbeiten", "edit")}
        </ol>
        ${draftsTabHtml()}
      </nav>
      <div class="as-main">
        <header class="as-topbar">
          <h2>${esc(headline())}</h2>
          <div class="as-topactions">${topActions()}</div>
        </header>
        ${state.step === "edit" ? `<div class="as-ribbon" data-ribbon role="toolbar" aria-label="Formatierung"></div>` : ""}
        <div class="as-content">${stepContent()}</div>
      </div>`;
    // Direkt und noch einmal nach dem Umbruch: in einem verborgenen Tab
    // laeuft requestAnimationFrame nicht, dann traegt der direkte Aufruf.
    if (state.step === "form") { fitPreview(); requestAnimationFrame(fitPreview); }
    if (state.step === "draft" && state.payload) mountStages(false);
    if (state.step === "edit") {
      mountStages(true);
      mountFormatBar();
      updateFormatBar();
    } else if (fmtBar) {
      fmtBar.setAttribute("data-open", "0");
    }
  }

  function headline() {
    if (state.step === "form" && state.formTab === "drafts") return "Entwürfe";
    if (state.step === "form") return isMemo ? "Ansprache" : "LinkedIn-Asset";
    if (state.step === "draft") return state.busy ? "Entwurf wird erzeugt" : "Entwurf";
    return "Bearbeiten";
  }

  function stepItem(index, label, key) {
    const order = ["form", "draft", "edit"];
    const current = order.indexOf(state.step);
    const own = order.indexOf(key);
    let stateName = own === current ? "active" : own < current ? "done" : "todo";
    if (key === "form" && state.formTab === "drafts" && state.step === "form") stateName = "todo";
    const act = key === "form" ? ` data-act="to-form"` : "";
    return `<li data-state="${stateName}"${act}><b>${index}</b>${esc(label)}</li>`;
  }

  function draftsTabHtml() {
    const n = Array.isArray(state.drafts) ? state.drafts.length : 0;
    const on = state.formTab === "drafts" && state.step === "form";
    return `<button type="button" class="as-rail-tab${on ? " is-on" : ""}" data-act="show-drafts"${on ? ` aria-current="page"` : ""}>
      <b><i class="fa-regular fa-folder-open"></i></b>
      Entwürfe${n ? ` (${n})` : ""}
    </button>`;
  }

  function topActions() {
    if (state.step === "form" && state.formTab === "drafts") {
      return `<button type="button" class="as-btn" data-act="to-form"><i class="fa-solid fa-sliders"></i>Fragebogen</button>`;
    }
    if (state.step === "form") {
      // Der schrittweise Fragebogen endet bewusst mit seiner Bereit-Karte.
      // Ein zweiter Erzeugen-Knopf im Kopf wuerde alle offenen Fragen umgehen.
      return "";
    }
    if (state.step === "draft") {
      if (state.busy || !state.payload) {
        return `<button type="button" class="as-btn as-btn--icon as-close" data-act="close-popup" aria-label="Schließen"><i class="fa-solid fa-xmark"></i></button>`;
      }
      return `<button type="button" class="as-btn" data-act="to-form"><i class="fa-solid fa-sliders"></i>Fragebogen</button><button type="button" class="as-btn as-btn--primary" data-act="to-edit"><i class="fa-solid fa-pen-to-square"></i>Bearbeiten</button>`;
    }
    return `<button type="button" class="as-btn" data-act="to-draft"><i class="fa-solid fa-arrow-rotate-left"></i>Entwurf</button>`;
  }

  function stepContent() {
    if (state.step === "form") {
      // Links entscheiden, rechts sofort sehen. Die Vorschau ist dieselbe
      // Vorlage wie das spaetere Asset, nur mit Platzhaltertext.
      return `<div class="as-split2">
        <div class="as-split2-form">${state.formTab === "drafts" ? draftsHtml() : formHtml()}</div>
        <div class="as-split2-prev">
          <span class="as-prev-label">Vorschau</span>
          <div class="as-prev-host">
            <div class="as-pagehost">
              <div class="as-prev-big" data-kind="${isMemo ? "memo" : "linkedin"}" data-livepreview>${livePreviewHtml()}</div>
              <button type="button" class="as-fs-btn" data-act="toggle-fs" aria-label="Vollbild"><i class="fa-solid fa-expand"></i></button>
            </div>
          </div>
          <div data-captionhost>${captionPreviewHtml()}</div>
        </div>
      </div>`;
    }
    if (state.step === "draft") {
      if (state.busy) return ladeanzeigeHtml();
      if (state.error) {
        // Der Servertext ist die einzige belastbare Auskunft und steht deshalb
        // wortwoertlich da, nicht hinter einer Sammelmeldung.
        return `<div class="as-error">
          <strong>Der Entwurf konnte nicht erzeugt werden</strong>
          <p>${esc(state.error)}</p>
          <div class="as-actions">
            <button type="button" class="as-btn" data-act="to-form"><i class="fa-solid fa-sliders"></i>Zurück zum Fragebogen</button>
            <button type="button" class="as-btn as-btn--primary" data-act="generate"><i class="fa-solid fa-rotate-right"></i>Erneut versuchen</button>
          </div>
        </div>`;
      }
      if (isMemo) {
        return `<div class="as-work" data-kind="memo">
          <div class="as-stagearea" data-stagearea></div>
        </div>`;
      }
      return linkedinDraftHtml();
    }
      return `<div class="as-work" data-kind="${isMemo ? "memo" : "linkedin"}">
      <div class="as-stagearea" data-stagearea></div>
      ${inspectorHtml()}
    </div>`;
  }

  /** Der fertige Entwurf orientiert sich an der Hierarchie eines LinkedIn-Posts,
   *  bleibt aber als ROOTS-Karte klar Teil des Signal Layers. */
  function linkedinDraftHtml() {
    const privat = state.answers.profile === "private";
    const name = privat
      ? (state.chrome.footer_left || "Persönliches Beraterprofil")
      : "ROOTS Consultants";
    const rolle = privat ? "Beraterprofil" : "Brand Strategy Consultants";
    const logo = state.chrome.logo || state.logo || LOGO_PATH;
    return `<div class="as-work as-work--feed" data-kind="linkedin">
      <article class="as-linkedin-post" aria-label="LinkedIn-Vorschau">
        <header class="as-linkedin-head">
          <span class="as-linkedin-avatar"><img src="${attr(logo)}" alt=""></span>
          <span class="as-linkedin-byline"><strong>${esc(name)}</strong><span>${esc(rolle)}</span><small>Gerade eben · <i class="fa-solid fa-earth-europe"></i></small></span>
          <button type="button" class="as-linkedin-more" aria-label="Weitere Optionen" tabindex="-1"><i class="fa-solid fa-ellipsis"></i></button>
        </header>
        <div class="as-linkedin-caption" data-captionhost="feed">${captionPreviewHtml(true)}</div>
        <div class="as-stagearea as-stagearea--linkedin" data-stagearea></div>
        <footer class="as-linkedin-actions" aria-hidden="true">
          <span class="as-linkedin-action"><i class="fa-regular fa-thumbs-up"></i>Gefällt mir</span>
          <span class="as-linkedin-action"><i class="fa-regular fa-comment-dots"></i>Kommentieren</span>
          <span class="as-linkedin-action"><i class="fa-solid fa-retweet"></i>Teilen</span>
          <span class="as-linkedin-action"><i class="fa-regular fa-paper-plane"></i>Senden</span>
        </footer>
      </article>
    </div>`;
  }

  /** Die Caption gehoert zum Beitrag: im Fragebogen unter die Vorschau, im
   *  fertigen Entwurf wie bei LinkedIn oberhalb des Assets. */
  function captionPreviewHtml(feed = false) {
    if (isMemo) return "";
    const text = state.step === "form"
      ? (state.answers.caption === "custom" ? String(state.answers.caption_text || "") : "")
      : String(state.postText || "");
    if (!text.trim()) return "";
    if (feed) return `<p class="as-linkedin-copy">${esc(text)}</p>`;
    return `<div class="as-caption">
      <span class="as-caption-head">Caption</span>
      <p>${esc(text)}</p>
    </div>`;
  }

  function zeichneCaption() {
    shell.querySelectorAll("[data-captionhost]").forEach((host) => {
      host.innerHTML = captionPreviewHtml(host.getAttribute("data-captionhost") === "feed");
    });
  }

  /* ── Schritt 1: Fragebogen ── */

  /** Grosse Vorschau rechts. Dieselbe Vorlage wie das Ergebnis, kein Modellaufruf. */
  function livePreviewHtml() {
    if (isMemo) {
      if (state.answers.memo_track === "cmo100") {
        return `<div class="as-prev-empty">
          <i class="fa-solid fa-hourglass-half"></i>
          <b>100 Tage CMO</b>
          <span>Noch in Ausarbeitung, kein Executive Memo</span>
        </div>`;
      }
      if (state.prevIndex >= MEMO_SEITEN) state.prevIndex = 0;
      const html = markiereMemoSeiten(memoHtml(applyFormImages(demoMemo()), false).replace(/<div class="as-img-ui"[\s\S]*?<\/div>/g, ""));
      return `<span class="as-prev-scale">${html}</span>${blaetterNavHtml()}`;
    }
    const carousel = state.answers.asset_type === "carousel";
    const dunkel = state.answers.look === "dunkel";
    if (carousel) {
      const arten = fragebogenCarouselVarianten();
      if (state.prevIndex < 0 || state.prevIndex >= arten.length) state.prevIndex = 0;
      const variante = arten[state.prevIndex];
      return `<span class="as-prev-scale">${slideHtml(demoSlide(variante), false)}</span>${blaetterNavHtml()}`;
    }
    const schrittVorschau = state.stepKey === "design"
      ? (dunkel ? "U2" : "U1")
      : state.stepKey === "asset_type"
        ? (dunkel ? "A" : "B")
        : "";
    const variante = schrittVorschau || state.answers.variant;
    if (!variante || variante === "auto" || !VARIANT_KEYS.includes(variante)) return platzhalterHtml();
    return `<span class="as-prev-scale">${slideHtml(demoSlide(variante), false)}</span>${blaetterNavHtml()}`;
  }

  /** Reale Folienfolge fuer die Fragebogen-Vorschau. Bei eigener Auswahl zeigt
   *  sie sofort Titel, aktuelle Inhaltsfolge und Ende. Bei KI-Auswahl simuliert
   *  sie die gewaehlte Anzahl mit passenden hellen oder dunklen Vorlagen. */
  function fragebogenCarouselVarianten() {
    const dunkel = state.answers.look === "dunkel";
    const cover = dunkel ? "U2" : "U1";
    const ende = dunkel ? "U4" : "U3";
    const pool = dunkel ? ["A", "H", "S2", "D", "S4", "J"] : ["B", "E", "F", "G", "I", "L", "S1", "S3", "T3", "T6"];
    if (state.answers.slide_mix === "custom") {
      const inhalte = inhaltsArten();
      return [
        state.answers.slide_cover || cover,
        ...(inhalte.length ? inhalte : pool.slice(0, 2)),
        state.answers.slide_end || ende,
      ];
    }
    const ziel = Math.min(12, Math.max(3, carouselRequestedSlides(state.answers) || 8));
    return [cover, ...Array.from({ length: ziel - 2 }, (_v, i) => pool[i % pool.length]), ende];
  }

  function blaetterAnzahl() {
    if (isMemo) return MEMO_SEITEN;
    if (state.step === "form") {
      return state.answers.asset_type === "carousel" ? fragebogenCarouselVarianten().length : 1;
    }
    return Math.max(1, state.slides.length);
  }

  function blaetterNavHtml() {
    const n = blaetterAnzahl();
    if (n <= 1) return "";
    const wort = isMemo ? "Seite" : "Slide";
    return `<div class="as-prev-nav">
      <button type="button" data-act="prev-back" aria-label="Zurück"><i class="fa-solid fa-chevron-left"></i></button>
      <span>${wort} ${state.prevIndex + 1} von ${n}</span>
      <button type="button" data-act="prev-fwd" aria-label="Weiter"><i class="fa-solid fa-chevron-right"></i></button>
    </div>`;
  }

  function markiereMemoSeiten(html) {
    let n = 0;
    return html.replace(/class="em-page/g, () => {
      const i = n++;
      return i === state.prevIndex ? 'class="em-page' : 'class="em-page is-off';
    });
  }

  /** Nur die aktuelle Memo-Seite ist sichtbar, damit die Bühne eine A4-Seite misst. */
  function zeigeAktiveMemoSeite(wurzel = shell) {
    if (!isMemo || !wurzel) return;
    const seiten = [...wurzel.querySelectorAll(".em-page")];
    if (!seiten.length) return;
    if (state.prevIndex < 0 || state.prevIndex >= seiten.length) state.prevIndex = 0;
    seiten.forEach((seite, i) => seite.classList.toggle("is-off", i !== state.prevIndex));
  }

  function legeMemoSeiteMass(stage) {
    if (!stage?.classList.contains("as-stage--memo")) return;
    stage.style.width = "210mm";
    stage.style.height = "297mm";
  }

  function zeigeAktiveFolie() {
    if (isMemo) {
      zeigeAktiveMemoSeite();
      return;
    }
    const frames = [...shell.querySelectorAll("[data-stagearea] > .as-frame")];
    if (!frames.length) return;
    if (state.prevIndex < 0 || state.prevIndex >= frames.length) state.prevIndex = 0;
    frames.forEach((frame, i) => frame.classList.toggle("is-off", i !== state.prevIndex));
  }

  function aktualisiereBlaetterLabel() {
    const n = blaetterAnzahl();
    const wort = isMemo ? "Seite" : "Slide";
    shell.querySelectorAll(".as-prev-nav span").forEach((el) => {
      el.textContent = `${wort} ${state.prevIndex + 1} von ${n}`;
    });
  }

  /**
   * Die Abschnitte kommen vom Auftrag selbst: er schreibt seinen Stand auf die
   * Zeile, das Studio liest ihn beim Abfragen. Ein Durchblaettern nach der Uhr
   * behauptet einen Fortschritt, den niemand kennt.
   */
  const ABSCHNITTE = [
    ["lesen", "fa-file-lines", "Signal und Artikel werden gelesen"],
    ["recherchieren", "fa-magnifying-glass", "Gemini recherchiert aktuelle Benchmarks"],
    ["modell", "fa-brain", isMemo ? "Das Modell entwickelt die Ansprache" : "Das Modell schreibt Titel und Kernaussage"],
    ["pruefen", "fa-list-check", "Belege und Längen werden geprüft"],
    ["bilder", "fa-image", "Logos und Motive werden gesucht"],
    ["fuellen", "fa-wand-magic-sparkles", "Die Vorlage wird gefüllt"],
  ];

  function laufMs() {
    if (state.ladeStart) return Math.max(0, Date.now() - state.ladeStart);
    return 0;
  }

  function restMs() {
    return assetEtaRemainingMs({
      kind: isMemo ? "memo" : "linkedin",
      answers: state.answers || {},
      stage: state.ladeAbschnitt || "lesen",
      runLog: state.laufLog,
      elapsedMs: laufMs(),
      stages: assetEtaStagesFromLog(state.laufLog),
      forecastMs: state.forecastMs,
    });
  }

  function ladeFortschritt() {
    return assetEtaProgressPct(laufMs(), restMs());
  }

  function ladeEtaText() {
    return assetEtaLabel(restMs());
  }

  function laufEreignisText(entry) {
    const event = String(entry?.event || "");
    const phase = String(entry?.phase || "");
    const model = String(entry?.model || "");
    const chars = Number(entry?.chars || 0);
    const thinking = Number(entry?.thinking_chars || 0);
    const zahl = (n) => n.toLocaleString("de-DE");
    if (event === "pulse") {
      if (phase === "thinking") {
        return thinking
          ? `${model || "Das Modell"} denkt … ${zahl(thinking)} Zeichen Begründung`
          : `${model || "Das Modell"} denkt`;
      }
      if (phase === "writing") {
        return chars
          ? `${model || "Das Modell"} schreibt … ${zahl(chars)} Zeichen`
          : `${model || "Das Modell"} schreibt`;
      }
      if (phase === "search") {
        return chars
          ? `Gemini sucht und schreibt … ${zahl(chars)} Zeichen`
          : "Gemini sucht im Web";
      }
      if (phase === "headers") return `${model || "Das Modell"} hat die Verbindung geöffnet`;
      return `${model || "Das Modell"} sendet`;
    }
    if (event === "start") return "Auftrag gestartet";
    if (event === "stage") {
      const name = String(entry.stage || "");
      if (name === "recherchieren") return "Benchmark-Recherche gestartet";
      if (name === "modell") return "Schreiben gestartet";
      if (name === "pruefen") return "Belege werden geprüft";
      if (name === "bilder") return "Logos werden gesucht";
      if (name === "fuellen") return "Vorlage wird gefüllt";
      return "Nächster Schritt";
    }
    if (event === "model_start") return "Modellaufruf gestartet";
    if (event === "model_ok") return "Text angekommen";
    if (event === "handoff") return "Prüfung läuft in einem neuen Schritt weiter";
    if (event === "retry_model") return "Schreiben wird in einem neuen Schritt wiederholt";
    if (event === "finish_start") return "Belege und Längen werden geprüft";
    if (event === "payload_ok") return "Entwurf ist geprüft";
    if (event === "benchmarks_ok") {
      const names = Array.isArray(entry.names) ? entry.names.filter(Boolean).join(", ") : "";
      return names ? `Benchmarks: ${names}` : "Benchmarks gefunden";
    }
    if (event === "benchmarks_user") return "Eigene Benchmarks übernommen";
    if (event === "image_start") return "Logo wird gesucht";
    if (event === "images_done") return "Logos gefunden";
    if (event === "done") return "Entwurf steht";
    return "";
  }

  function laufLogZeilen() {
    const rows = Array.isArray(state.laufLog) ? state.laufLog : [];
    const visible = [];
    for (let i = rows.length - 1; i >= 0 && visible.length < 8; i -= 1) {
      const text = laufEreignisText(rows[i]);
      if (!text) continue;
      const sek = Math.max(0, Math.round(Number(rows[i]?.t || 0) / 1000));
      visible.push({ sek, text });
    }
    return visible.reverse();
  }

  function ladeanzeigeHtml() {
    const i = Math.max(0, ABSCHNITTE.findIndex(([key]) => key === state.ladeAbschnitt));
    const [, icon, text] = ABSCHNITTE[i];
    const pct = ladeFortschritt();
    const log = laufLogZeilen();
    return `<div class="as-load" role="status" aria-live="polite">
      <div class="as-load-icon"><i class="fa-solid ${icon}"></i></div>
      <p class="as-load-text">${esc(text)}</p>
      <div class="as-load-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Schritt ${i + 1} von ${ABSCHNITTE.length}">
        <span class="as-load-bar-fill" style="width:${pct}%"></span>
      </div>
      <p class="as-load-eta"><i class="fa-solid fa-hourglass-half" aria-hidden="true"></i><span data-eta-text>${esc(ladeEtaText())}</span></p>
      ${log.length ? `<ul class="as-load-log">${log.map((row) => `<li><b>${row.sek} s</b><span>${esc(row.text)}</span></li>`).join("")}</ul>` : ""}
      <div class="as-load-actions">
        <button type="button" class="as-pill" data-act="leave-generate">Im Hintergrund</button>
        <button type="button" class="as-pill as-pill-danger" data-act="cancel-generate">Abbrechen</button>
      </div>
    </div>`;
  }

  /** Balken und Restzeit laufen von selbst. Den Abschnitt meldet der Auftrag. */
  function ladeTaktStart(neu = false) {
    ladeTaktStop();
    if (neu) {
      state.ladeStart = Date.now();
      state.ladeAbschnitt = "lesen";
      state.laufLog = [];
      state.updatedAt = "";
    } else if (!state.ladeStart) {
      state.ladeStart = Date.now();
    }
    state.ladeUhr = window.setInterval(() => {
      if (!state.busy) { ladeTaktStop(); return; }
      const fill = shell.querySelector(".as-load-bar-fill");
      const bar = shell.querySelector(".as-load-bar");
      const eta = shell.querySelector("[data-eta-text]");
      const pct = ladeFortschritt();
      if (fill) fill.style.width = `${pct}%`;
      if (bar) bar.setAttribute("aria-valuenow", String(pct));
      if (eta) eta.textContent = ladeEtaText();
    }, 200);
  }

  function ladeTaktStop() {
    if (state.ladeUhr) window.clearInterval(state.ladeUhr);
    state.ladeUhr = 0;
  }

  /** Gemeldeter Abschnitt uebernehmen und die Anzeige tauschen. */
  function ladeAbschnittSetzen(name) {
    // "fertig" und alles Unbekannte werden ignoriert: sonst faende findIndex
    // nichts und die Anzeige sprang kurz vor dem Ergebnis auf Schritt eins.
    if (!name || name === state.ladeAbschnitt) return;
    if (!ABSCHNITTE.some(([key]) => key === name)) return;
    state.ladeAbschnitt = name;
    const box = shell.querySelector(".as-load");
    if (box) box.outerHTML = ladeanzeigeHtml();
  }

  function uebernehmeLaufstand(row) {
    if (!row || typeof row !== "object") return;
    if (Array.isArray(row.run_log)) state.laufLog = row.run_log;
    if (row.updated_at) state.updatedAt = String(row.updated_at);
    if (Number(row.forecast_ms) > 0) state.forecastMs = Number(row.forecast_ms);
    const created = Date.parse(String(row.created_at || ""));
    if (Number.isFinite(created)) state.ladeStart = created;
    const stage = row.stage;
    if (stage && stage !== state.ladeAbschnitt && ABSCHNITTE.some(([key]) => key === stage)) {
      ladeAbschnittSetzen(stage);
      return;
    }
    const eta = shell.querySelector("[data-eta-text]");
    if (eta) eta.textContent = ladeEtaText();
    const fill = shell.querySelector(".as-load-bar-fill");
    const bar = shell.querySelector(".as-load-bar");
    const pct = ladeFortschritt();
    if (fill) fill.style.width = `${pct}%`;
    if (bar) bar.setAttribute("aria-valuenow", String(pct));
    const logBox = shell.querySelector(".as-load-log");
    const zeilen = laufLogZeilen();
    const html = zeilen.length
      ? `<ul class="as-load-log">${zeilen.map((item) => `<li><b>${item.sek} s</b><span>${esc(item.text)}</span></li>`).join("")}</ul>`
      : "";
    if (logBox) logBox.outerHTML = html || `<ul class="as-load-log"></ul>`;
    else if (html) {
      const etaNode = shell.querySelector(".as-load-eta");
      if (etaNode) etaNode.insertAdjacentHTML("afterend", html);
    }
  }

  /** Ruhiger Platzhalter statt einer geratenen Kachel. */
  function platzhalterHtml() {
    return `<div class="as-prev-empty">
      <i class="fa-solid fa-wand-magic-sparkles"></i>
      <b>Das Modell wählt das Layout</b>
      <span>Vorschau erscheint nach „Entwurf erzeugen"</span>
    </div>`;
  }

  function demoMemo() {
    const gemini = state.answers.images !== "upload";
    const hint = (kind) => gemini
      ? `Unternehmenslogo für ${kind} (Worldvectorlogo, Website, Wikimedia).`
      : `Eigenes Bild hier zuschneiden, genau in den ${kind}-Platzhalter.`;
    return normalizeMemo({
      title: previewMemoTitle(state.answers, company),
      standfirst: "Der Markt hat sich bewegt. Wer denselben Hebel schon gezogen hat, setzt die neue Messlatte. Dieser Check macht den Moment für den Adressaten konkret.",
      market_title: "Der Markt belohnt, wer die Marke führt",
      market_p1: "Anbieter, die Sortiment, Kanal und Auftritt als eine Handschrift führen, gewinnen Sichtbarkeit und Tempo.",
      market_p2: "Wer den Hebel liegen lässt, bleibt in der Fläche vergleichbar und im Dialog austauschbar.",
      kpis: [
        { value: "3", label: "Hebel im Check" },
        { value: "1", label: "strategischer Moment" },
        { value: "4", label: "Wochen bis zum Gespräch" },
      ],
      benchmark_title: "Benchmarks ziehen denselben Hebel",
      benchmark_lead: "Drei Marken haben vorgemacht, was übertragbar ist.",
      benchmarks: [
        { name: "Benchmark A", text: "Hat die Eigenmarke zur Leitmarke gemacht und den Auftritt vereinheitlicht.", tag: "Marke vor Fläche", image_hint: hint("Benchmark") },
        { name: "Benchmark B", text: "Hat Kanal und Fläche unter eine Handschrift gestellt.", tag: "Eine Linie, zwei Kanäle", image_hint: hint("Benchmark") },
        { name: "Benchmark C", text: "Hat Kampagnen durch eine haltbare Linie ersetzt.", tag: "Linie vor Saison", image_hint: hint("Benchmark") },
      ],
      potentials_title: "Drei Hebel für den Adressaten",
      potentials_lead: "Der Check zeigt drei Ansatzpunkte, die sich aus dem Signal ergeben.",
      potentials: [
        { title: "Vom Sortiment zur Marke", finding: "Die Eigenmarken stehen unverbunden nebeneinander.", potential: "ROOTS bündelt sie unter einer Führung.", image_hint: hint("Potenzial") },
        { title: "Vom Kanal zum System", finding: "Online und Fläche sprechen unterschiedlich.", potential: "Eine Handschrift über beide Kanäle.", image_hint: hint("Potenzial") },
        { title: "Von der Kampagne zur Linie", finding: "Jede Saison wird der Auftritt neu erfunden.", potential: "Eine Linie, die über die Saison hält.", image_hint: hint("Potenzial") },
      ],
      cta: "Sollen wir den Check gemeinsam durchgehen?",
      about_fit: "ROOTS setzt hier mit Markenstrategie und Marketing Operations an.",
      sources: [],
    });
  }

  /** Aussagekräftige Marketingbeispiele statt Blindtext. Jede Vorschau zeigt
   *  genau den Anwendungsfall, für den die jeweilige Vorlage gedacht ist. */
  function demoSlide(variant) {
    const beispiele = {
      U1: { title: "Warum starke Marken weniger Kampagnen brauchen", subtitle: "Vier Entscheidungen für mehr Klarheit, Tempo und Wirkung." },
      U2: { title: "Warum starke Marken weniger Kampagnen brauchen", subtitle: "Vier Entscheidungen für mehr Klarheit, Tempo und Wirkung." },
      U3: { title: "Wo verliert Ihre Marke heute am meisten Wirkung?", subtitle: "Ein kurzer Check zeigt, welcher Hebel zuerst zählt.", takeaway: "Marken-Check starten →" },
      U4: { title: "Wo verliert Ihre Marke heute am meisten Wirkung?", subtitle: "Ein kurzer Check zeigt, welcher Hebel zuerst zählt.", takeaway: "Marken-Check starten →" },
      U5: { title: "Marken wachsen an Entscheidungen, nicht an Budget", subtitle: "Vier Weichenstellungen, die Wirkung planbar machen." },
      U6: { title: "Marken wachsen an Entscheidungen, nicht an Budget", subtitle: "Vier Weichenstellungen, die Wirkung planbar machen." },
      U7: { title: "Welcher Hebel bringt Ihrer Marke zuerst Wirkung?", subtitle: "Wir gehen Positionierung, Kanäle und Auftritt in einer Sitzung durch.", takeaway: "Termin vereinbaren" },
      U8: { title: "Welcher Hebel bringt Ihrer Marke zuerst Wirkung?", subtitle: "Wir gehen Positionierung, Kanäle und Auftritt in einer Sitzung durch.", takeaway: "Termin vereinbaren" },
      A: { quote: "Eine Marke wird nicht relevant, weil sie lauter spricht – sondern weil sie klarer entscheidet.", attribution: "Leitung Marketing · Beispiel" },
      B: { title: "Klarheit schlägt Kampagnendruck.", subtitle: "Wenn Positionierung und Aktivierung dieselbe Entscheidung tragen, wird Marketing schneller und wiedererkennbarer." },
      C: { title: "Aus Kontakt wird Erinnerung.", subtitle: "Ein starkes Motiv wirkt, wenn es dieselbe Botschaft wie die Marke trägt." },
      D: { title: "Wiedererkennung beginnt vor dem Logo.", subtitle: "Farbe, Haltung und Bildwelt machen Marken im ersten Moment eindeutig." },
      E: { stat: { value: "68 %", label: "Beispielwert: gestützte Erinnerung" }, title: "Konsistenz macht Marken leichter erinnerbar", subtitle: "Illustrative Kennzahl für die Wirkung einer durchgängigen Botschaft." },
      F: { title: "Drei Hebel für mehr Markenwirkung", bullets: ["**Positionierung schärfen** – eine relevante Entscheidung", "**Botschaft fokussieren** – ein Gedanke pro Kontakt", "**Aktivierung verbinden** – dieselbe Handschrift in jedem Kanal"] },
      G: { myth: "Mehr Reichweite gleicht eine unklare Positionierung aus.", fact: "Reichweite verstärkt nur, was vorher bereits klar oder unklar war." },
      H: { stats: [{ value: "24 %", label: "Aufmerksamkeit · Beispiel" }, { value: "38 %", label: "Markenerinnerung · Beispiel" }, { value: "54 %", label: "Präferenz · Beispiel" }] },
      I: { title: "Von der Erkenntnis zur Aktivierung", steps: [{ n: "01", title: "Insight", text: "Relevantes Kundenmuster erkennen." }, { n: "02", title: "Positionierung", text: "Eine klare Entscheidung treffen." }, { n: "03", title: "Leitidee", text: "Botschaft und Erlebnis verbinden." }, { n: "04", title: "Lernen", text: "Wirkung messen und nachschärfen." }] },
      J: { quote: "Gutes Marketing beginnt nicht mit Content, sondern mit einer klaren Entscheidung.", attribution: "Marketing Strategy · Beispiel" },
      K: { title: "Nicht mehr ~~Content~~, sondern mehr Relevanz", takeaway: "**Folge:** Weniger Formate, klarere Markenentscheidung." },
      L: { stat: { value: "42 %", label: "Beispielwert: klare Zuordnung zur Marke" }, title: "Wiedererkennung entsteht durch Konsequenz", bullets: ["**Ein Versprechen** über alle Kanäle", "**Eine Bildwelt** mit eigener Handschrift", "**Ein Lernsystem** für die Aktivierung"], takeaway: "**Lesart:** Konsistenz macht Wirkung kumulativ." },
      M: { title: "Klarheit schlägt Kampagnendruck.", subtitle: "Wenn Positionierung und Aktivierung dieselbe Entscheidung tragen, wird Marketing schneller und wiedererkennbarer." },
      S1: { title: "Wo Markenwirkung entsteht", subtitle: "Drei Fähigkeiten müssen gleichzeitig zusammenkommen.", slot_a: "Kundenrelevanz", slot_b: "Markenklarheit", slot_c: "Aktivierung", slot_center: "Wachstum", takeaway: "**Schnittpunkt:** Relevanz wird zur wiedererkennbaren Handlung." },
      S2: { title: "Vier Stufen wirksamer Markenführung", subtitle: "Von Einzelmaßnahmen zu einer geführten Marke.", steps: [{ n: "04", title: "Leitidee", text: "" }, { n: "03", title: "System", text: "" }, { n: "02", title: "Kanäle", text: "" }, { n: "01", title: "Maßnahmen", text: "" }], takeaway: "**Ziel:** Entscheidungen kommen aus einer gemeinsamen Logik." },
      S3: { title: "Das Haus der Markenaktivierung", subtitle: "Ein Versprechen, drei tragende Fähigkeiten, ein Ziel.", slot_a: "Markenversprechen", slot_b: "führt Entscheidungen", slot_center: "Messbares Wachstumsziel", steps: [{ n: "1", title: "Insight", text: "Kunden verstehen" }, { n: "2", title: "Position", text: "Nutzen zuspitzen" }, { n: "3", title: "Aktivierung", text: "Erlebnis verbinden" }], takeaway: "**Stabilität:** Jede Säule zahlt auf dasselbe Versprechen ein." },
      S4: { title: "Vom Kontakt zur Präferenz", subtitle: "Ein Marketing-Funnel mit einer Aufgabe je Stufe.", steps: [{ n: "1", title: "Reichweite", text: "gesehen" }, { n: "2", title: "Relevanz", text: "verstanden" }, { n: "3", title: "Interesse", text: "erwogen" }, { n: "4", title: "Präferenz", text: "gewählt" }, { n: "5", title: "Handlung", text: "getan" }], takeaway: "**Prinzip:** Die nächste Stufe braucht einen neuen Grund." },
      T1: { title: "Wie Markenstärke Nachfrage aufbaut", subtitle: "Illustrativer Index – keine realen Marktdaten.", stats: [{ value: "100", label: "2024" }, { value: "108", label: "2025" }, { value: "121", label: "2026" }, { value: "137", label: "2027" }, { value: "156", label: "2028" }, { value: "178", label: "2029" }, { value: "203", label: "2030" }], takeaway: "**Lesart:** Konsistente Markenarbeit entfaltet Wirkung über Zeit." },
      T2: { title: "Was Klarheit zur Markenwirkung beiträgt", subtitle: "Illustrativer Wasserfall – keine realen Marktdaten.", stats: [{ value: "100", label: "Basis" }, { value: "+18", label: "Klarheit" }, { value: "118", label: "Wirkung" }], takeaway: "**Lesart:** Die Veränderung erklärt den Weg zum Ergebnis." },
      T3: { title: "Was Markenpräferenz treibt", subtitle: "Illustrative Aufteilung – keine realen Marktdaten.", stats: [{ value: "45 %", label: "Relevanz" }, { value: "35 %", label: "Konsistenz" }, { value: "20 %", label: "Distinktion" }], slot_center: "100 %", takeaway: "**Lesart:** Präferenz entsteht aus drei verbundenen Faktoren." },
      T4: { title: "Wo Aktivierung bereits anschlussfähig ist", subtitle: "Illustrativer Kanalvergleich – keine realen Marktdaten.", stats: [{ value: "82 %", label: "CRM" }, { value: "74 %", label: "Content" }, { value: "63 %", label: "Media" }, { value: "51 %", label: "Sales" }, { value: "46 %", label: "Service" }], takeaway: "**Priorität:** Erst die stärksten Kontaktpunkte verbinden." },
      T5: { title: "Wie Relevanz im Funnel verdichtet", subtitle: "Illustratives Rechenbeispiel – keine realen Marktdaten.", stats: [{ value: "100 Tsd.", label: "Kontakte" }, { value: "62 Tsd.", label: "Relevante" }, { value: "31 Tsd.", label: "Interessierte" }, { value: "14 Tsd.", label: "Präferenz" }, { value: "6 Tsd.", label: "Handlung" }], takeaway: "**Aufgabe:** Jede Stufe braucht eine konkrete Entscheidungshilfe." },
      T6: { title: "Vier Phasen zur klaren Aktivierung", subtitle: "Eine kompakte Roadmap vom Insight bis zum Markt.", steps: [{ n: "Woche 1", title: "Insight", text: "Muster erkennen" }, { n: "Woche 2", title: "Position", text: "Nutzen zuspitzen" }, { n: "Woche 3", title: "Leitidee", text: "System bauen" }, { n: "Woche 4", title: "Aktivierung", text: "Pilot starten" }], takeaway: "**Takt:** Jede Phase endet mit einer belastbaren Entscheidung." },
    };
    const slide = normalizeSlide({
      variant,
      kicker: themeKicker(source),
      footer_left: state.chrome.footer_left || (state.chrome.custom ? "" : "ROOTS Consultants"),
      ...(beispiele[variant] || beispiele.B),
    });
    // Ein abstraktes, lokales Motiv macht die Bildvorlagen verständlich, ohne
    // ein fremdes Foto oder einen externen Abruf in die Vorschau zu ziehen.
    if (MIT_BILD.has(variant)) {
      slide.image.src = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDgwIDEzNTAiPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iZyIgeDI9IjEiIHkyPSIxIj48c3RvcCBzdG9wLWNvbG9yPSIjMGIxZjQ1Ii8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMjA2ZWZiIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwODAiIGhlaWdodD0iMTM1MCIgZmlsbD0idXJsKCNnKSIvPjxjaXJjbGUgY3g9IjgyMCIgY3k9IjM2MCIgcj0iMzEwIiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIuMTIiLz48Y2lyY2xlIGN4PSI2OTAiIGN5PSI4MjAiIHI9IjQyMCIgZmlsbD0iIzllYzBmZiIgb3BhY2l0eT0iLjIiLz48cGF0aCBkPSJNNTIwIDk4MGMxMzAtMjMwIDI5MC0zNTAgNTAwLTM3MHYzOTBINTIweiIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iLjE1Ii8+PC9zdmc+";
    }
    return slide;
  }

  /** Layouts der gewaehlten Anmutung. "Modell waehlt" bleibt immer dabei. */
  function layoutOptionen() {
    const look = state.answers.look === "dunkel" ? "dunkel" : "hell";
    return [["auto", "Modell wählt"], ...CONTENT_VARIANTS.filter(([key]) => LOOK[key] === look)];
  }

  /**
   * Weisses Dropdown mit einer Miniatur je Zeile. Die Miniatur ist dieselbe
   * Vorlage wie die grosse Vorschau, nur klein - deshalb kann sie nicht etwas
   * anderes zeigen als das Ergebnis.
   */
  function dropdownHtml(q) {
    const optionen = layoutOptionen();
    const gewaehlt = optionen.some(([key]) => key === state.answers[q.key])
      ? state.answers[q.key]
      : "auto";
    if (gewaehlt !== state.answers[q.key]) state.answers[q.key] = gewaehlt;
    const label = (optionen.find(([key]) => key === gewaehlt) || optionen[0])[1];
    const zeilen = optionen.map(([value, text]) => `
      <button type="button" class="as-ddrow${value === gewaehlt ? " is-active" : ""}" data-act="pick-layout" data-value="${attr(value)}">
        <span class="as-ddthumb">${value === "auto" ? '<i class="fa-solid fa-wand-magic-sparkles"></i>' : miniatur(value)}</span>
        <span class="as-ddtext">${esc(text)}</span>
        ${MIT_BILD.has(value) ? '<i class="as-tag">Bild</i>' : LAYOUT_KEYS.includes(value) ? '<i class="as-tag">Diagramm</i>' : ""}
      </button>`).join("");
    return `<div class="as-q">
      <label>${esc(q.label)}</label>
      <div class="as-dd${state.ddOffen ? " is-open" : ""}">
        <button type="button" class="as-ddhead" data-act="toggle-layout" aria-expanded="${state.ddOffen ? "true" : "false"}">
          <span>${esc(label)}</span><i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="as-ddlist">${zeilen}</div>
      </div>
    </div>`;
  }

  /** Eine Reihe Auswahlpillen, gleiche Anmutung wie die Radiopillen der
   *  uebrigen Fragen. Knoepfe statt Radios, weil Zusatzdaten am Element
   *  haengen und Mehrfachauswahl dieselbe Zeile benutzt. */
  function optionPillenHtml(eintraege, extra = "") {
    const pillen = eintraege.map((e) => `
      <button type="button" class="as-opt as-opt--btn${e.aktiv ? " is-active" : ""}"
        data-act="${attr(e.act)}" data-value="${attr(e.value)}"${e.role ? ` data-role="${attr(e.role)}"` : ""}${e.disabled ? " disabled" : ""}
        aria-pressed="${e.aktiv ? "true" : "false"}">
        <span>${esc(e.text)}</span>${e.tag ? `<i class="as-tag">${esc(e.tag)}</i>` : ""}${e.plus ? '<i class="fa-solid fa-plus as-opt-plus"></i>' : ""}
      </button>`).join("");
    return `<div class="as-opts">${pillen}</div>${extra}`;
  }

  /** Gewaehlte Slide-Arten als Liste. Leer heisst: noch nichts ausgewaehlt. */
  function gewaehlteArten() {
    return String(state.answers.slide_pick || "").split(",").map((v) => v.trim()).filter(Boolean);
  }

  function inhaltsArten() {
    return gewaehlteArten().filter((key) => !SLIDE_ROLE[key]);
  }

  function setzeManuelleFolien(cover, inhalte, ende) {
    const folge = [cover, ...(Array.isArray(inhalte) ? inhalte : []), ende].filter(Boolean);
    state.answers.slide_cover = cover || "";
    state.answers.slide_content = (Array.isArray(inhalte) ? inhalte : []).join(",");
    state.answers.slide_end = ende || "";
    state.answers.slide_pick = folge.join(",");
  }

  function variantenName(key) {
    return (VARIANTS_ALL.find(([value]) => value === key) || [key, key])[1];
  }

  function carouselEmpfehlungHtml(anzahl) {
    // Dieselbe Bewertung wie in den Schreibhilfen: eine Zahl ohne Begruendung
    // sagt nicht, warum sie stoert.
    const hinweis = slideEmpfehlung(anzahl);
    if (!hinweis || hinweis.ton === "ok") return "";
    return `<div class="as-guidance${hinweis.ton === "warn" ? " is-warning" : ""}" data-carousel-guidance role="note">
      <i class="fa-solid ${hinweis.ton === "warn" ? "fa-triangle-exclamation" : "fa-circle-info"}"></i><span>${esc(hinweis.text)}</span>
    </div>`;
  }

  /** Titel und Ende sind eigene Pflichtschritte. Jede Option zeigt links genau
   *  dieselbe Vorlage, die nach der Wahl rechts gross erscheint. */
  function frameDropdownHtml(q) {
    const look = state.answers.look === "dunkel" ? "dunkel" : "hell";
    const optionen = q.options.filter(([key]) => SLIDE_ROLE[key] === q.role && LOOK[key] === look);
    const ausgewaehlt = q.role === "cover" ? state.answers.slide_cover : state.answers.slide_end;
    const label = ausgewaehlt ? variantenName(ausgewaehlt) : `${q.label} auswählen`;
    const zeilen = optionen.map(([value, text]) => `
      <button type="button" class="as-ddrow${value === ausgewaehlt ? " is-active" : ""}" data-act="frame-pick" data-role="${attr(q.role)}" data-value="${attr(value)}">
        <span class="as-ddthumb">${miniatur(value)}</span>
        <span class="as-ddtext">${esc(text)}</span>
        ${value === ausgewaehlt ? '<span class="as-ddrow-add"><i class="fa-solid fa-check"></i></span>' : ""}
      </button>`).join("");
    return `<div class="as-q">
      <label>${esc(q.label)}</label>
      <div class="as-dd as-dd--flow${state.ddOffen ? " is-open" : ""}">
        <button type="button" class="as-ddhead" data-act="toggle-frame" aria-expanded="${state.ddOffen ? "true" : "false"}">
          <span>${esc(label)}</span><i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="as-ddlist">${zeilen}</div>
      </div>
    </div>`;
  }

  /** Inhaltsfolien koennen wiederholt und frei sortiert werden. Titel und Ende
   *  stehen nicht mehr in dieser Liste und brauchen deshalb keinen Warnhinweis. */
  function contentMultiHtml(q) {
    const gewaehlt = inhaltsArten();
    const look = state.answers.look === "dunkel" ? "dunkel" : "hell";
    const optionen = q.options.filter(([key]) => !SLIDE_ROLE[key] && LOOK[key] === look);
    const label = gewaehlt.length ? `${gewaehlt.length} Inhaltsfolien ausgewählt` : "Inhaltsfolien auswählen";
    const folge = gewaehlt.map((value, i) => {
      const hoch = i > 0;
      const runter = i < gewaehlt.length - 1;
      return `<div class="as-sequence-row">
        <span class="as-sequence-nr">${i + 2}</span>
        <span class="as-ddthumb">${miniatur(value)}</span>
        <span class="as-sequence-copy"><b>${esc(variantenName(value))}</b><small>Inhaltsfolie</small></span>
        <span class="as-sequence-actions">
          <button type="button" data-act="content-up" data-index="${i}"${hoch ? "" : " disabled"} aria-label="Folie nach oben"><i class="fa-solid fa-arrow-up"></i></button>
          <button type="button" data-act="content-down" data-index="${i}"${runter ? "" : " disabled"} aria-label="Folie nach unten"><i class="fa-solid fa-arrow-down"></i></button>
          <button type="button" data-act="content-remove" data-index="${i}" aria-label="Folie entfernen"><i class="fa-solid fa-xmark"></i></button>
        </span>
      </div>`;
    }).join("");
    const amMaximum = gewaehlt.length >= LINKEDIN_DOCUMENT_PAGE_MAX - 2;
    const zeilen = optionen.map(([value, text]) => `
      <button type="button" class="as-ddrow" data-act="content-add" data-value="${attr(value)}"${amMaximum ? " disabled" : ""}>
        <span class="as-ddthumb">${miniatur(value)}</span>
        <span class="as-ddtext">${esc(text)}</span>
        <span class="as-ddrow-add"><i class="fa-solid fa-plus"></i></span>
      </button>`).join("");
    return `<div class="as-q">
      <label>${esc(q.label)}</label>
      <div class="as-sequence">${folge || '<p class="as-hint">Noch keine Inhaltsfolie ausgewählt.</p>'}</div>
      <div class="as-dd as-dd--flow${state.multiOffen ? " is-open" : ""}">
        <button type="button" class="as-ddhead" data-act="toggle-arten" aria-expanded="${state.multiOffen ? "true" : "false"}">
          <span>${esc(label)}</span><i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="as-ddlist">${zeilen}</div>
      </div>
      <div data-carousel-guidance-host>${carouselEmpfehlungHtml(gewaehlt.length + 2)}</div>
    </div>`;
  }

  /**
   * Kleine, nicht bedienbare Ausgabe einer Vorlage fuer die Dropdown-Zeile.
   * Die Bildbedienung muss raus: sie enthaelt einen Knopf, und ein Knopf im
   * Knopf laesst den Parser die Zeile vorzeitig schliessen - Variante C stand
   * dadurch leer in der Liste.
   */
  function miniatur(variant) {
    const html = slideHtml(demoSlide(variant), false)
      .replace(/<div class="as-img-ui"[\s\S]*?<\/div>/g, "");
    return `<span class="as-mini"><span class="as-mini-in">${html}</span></span>`;
  }

  function benchesHtml() {
    const zeilen = [0, 1, 2].map((i) => `
      <div class="as-bench">
        <b>Benchmark ${i + 1}</b>
        <input data-bench="${i}-name" placeholder="Name der Marke oder Firma" value="${esc(state.answers[`bench_${i}_name`] || "")}" aria-label="Benchmark ${i + 1} Name">
        <textarea data-bench="${i}-text" rows="2" placeholder="Was sie konkret getan haben (eine Handlung, kein Slogan)" aria-label="Benchmark ${i + 1} Handlung">${esc(state.answers[`bench_${i}_text`] || "")}</textarea>
        <input data-bench="${i}-tag" placeholder="Lehre in wenigen Worten, z. B. Marke vor Fläche" value="${esc(state.answers[`bench_${i}_tag`] || "")}" aria-label="Benchmark ${i + 1} Lehre">
      </div>`).join("");
    return `<div class="as-benches">
      ${zeilen}
      <button type="button" class="as-pill" data-act="bench-example">Beispielform einsetzen</button>
    </div>`;
  }

  function slotsHtml() {
    const zeilen = [
      ["benchmarks.0", "Benchmark 1", "46 × 28 mm", false],
      ["benchmarks.1", "Benchmark 2", "46 × 28 mm", false],
      ["benchmarks.2", "Benchmark 3", "46 × 28 mm", false],
      ["potentials.0", "Potenzial 1", "52 × 36 mm", true],
      ["potentials.1", "Potenzial 2", "52 × 36 mm", true],
      ["potentials.2", "Potenzial 3", "52 × 36 mm", true],
    ].map(([key, label, mass, pot]) => {
      const bild = state.formImages[key];
      return `<button type="button" class="as-slot" data-act="form-img-pick" data-imgkey="${attr(key)}">
        <b>${esc(label)}</b>
        <span class="as-slot-frame${pot ? " is-pot" : ""}">${bild?.src ? `<img src="${attr(bild.src)}" alt="">` : `<i class="fa-solid fa-crop"></i>`}</span>
        <small>${bild?.src ? "Ausschnitt ersetzen" : `Zuschneiden auf ${mass}`}</small>
      </button>`;
    }).join("");
    return `<div class="as-slots">${zeilen}</div>`;
  }

  function draftsHtml() {
    const liste = Array.isArray(state.drafts) ? state.drafts : [];
    const zeilen = state.draftsError ? `<p class="as-hint">${esc(state.draftsError)}</p>`
      : !liste.length ? `<p class="as-hint">Noch keine Entwürfe für diesen Artikel.</p>`
      : `<div class="as-draft-list">${liste.map((row) => draftZeileHtml(row)).join("")}</div>`;
    const fehler = state.formError ? `<p class="as-form-error">${esc(state.formError)}</p>` : "";
    return `<div class="as-drafts">
      <div class="as-drafts-head">
        <span>Entwürfe${liste.length ? ` (${liste.length})` : ""}</span>
      </div>
      ${fehler}${zeilen}
    </div>`;
  }

  function draftTitel(row) {
    const memoTitle = String(row.title || "").trim();
    const slideTitle = String(row.slide_title || "").trim();
    if (isMemo && memoTitle) return memoTitle;
    if (!isMemo && slideTitle) return slideTitle;
    if (memoTitle) return memoTitle;
    if (slideTitle) return slideTitle;
    const status = String(row.status || "");
    if (status === "running") return "Entwurf läuft noch";
    if (status === "error") return "Entwurf fehlgeschlagen";
    return isMemo ? "Investment-Memorandum" : "LinkedIn-Asset";
  }

  function draftStatusText(status) {
    if (status === "done") return "Fertig";
    if (status === "running") return "Läuft gerade";
    if (status === "error") return "Nicht fertig";
    return "Nicht fertig";
  }

  function draftZeileHtml(row) {
    const status = String(row.status || "");
    const wann = formatDraftWhen(row.created_at);
    const dauer = formatDraftDauer(row.duration_ms);
    const tokens = Number(row.total_tokens) > 0 ? `${Number(row.total_tokens).toLocaleString("de-DE")} Token` : "";
    const kosten = formatDraftEur(row.cost_eur);
    const meta = [wann, dauer, tokens, kosten].filter(Boolean).join(" · ");
    const klasse = status === "error" ? " is-error" : status === "running" ? " is-run" : "";
    const unter = [draftStatusText(status), draftSettingsText(row)].filter(Boolean).join(" · ");
    return `<button type="button" class="as-draft${klasse}" data-act="open-draft" data-id="${attr(row.id)}">
      <strong>${esc(draftTitel(row))}</strong>
      <span>${esc(unter)}</span>
      <em>${esc(meta || row.model || "")}</em>
    </button>`;
  }

  function formatDraftWhen(value) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function formatDraftDauer(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n) || n < 1000) return "";
    const sek = Math.round(n / 1000);
    if (sek < 60) return `${sek} s`;
    return `${Math.round(sek / 60)} Min`;
  }

  function formatDraftEur(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "";
    return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }

  function draftSettingsText(row) {
    const a = row && typeof row.answers === "object" && row.answers ? row.answers : {};
    const teile = [];
    if (a.company_named === "no") teile.push("ohne Firma");
    else if (row.company || a.company) teile.push(String(row.company || a.company));
    if (a.benchmarks_mode === "custom") teile.push("eigene Benchmarks");
    else if (isMemo) teile.push("Gemini-Benchmarks");
    if (a.images === "upload") teile.push("eigene Bilder");
    else if (isMemo) teile.push("recherchierte Logos");
    if (a.cta) teile.push("eigener CTA");
    if (a.storyline) teile.push("eigener Inhalt");
    if (a.asset_type === "carousel") teile.push(`Karussell ${a.slides || ""}`.trim());
    else if (a.asset_type === "single") teile.push("Einzelbild");
    return teile.filter(Boolean).join(" · ") || (row.prompt_version || "");
  }

  /** Hinterlegter Tonfall des angemeldeten Nutzers. Steuert nur, ob die zweite
   *  Wahl beim Begleittext benutzbar ist; angewendet wird er serverseitig. */
  async function ladeToneOfVoice() {
    if (isMemo) return;
    try {
      const res = await api("get_asset_tone", {});
      state.toneOfVoice = String((res && res.tone_of_voice) || "").trim();
    } catch (_err) {
      state.toneOfVoice = "";
    }
    state.toneGeladen = true;
    if (state.step === "form") zeichneForm();
  }

  /** Design-Vorlagen des Nutzers. Nur fuer das Privatprofil relevant. */
  async function ladeDesignVorlagen() {
    if (isMemo) return;
    try {
      const res = await api("get_asset_design_templates", {});
      const liste = Array.isArray(res?.design_templates) ? res.design_templates : [];
      // Der Server spricht light/dark und footer_left, der Fragebogen hell/dunkel
      // und footer. Ohne diese Uebersetzung stand eine dunkle Vorlage hell da
      // und die Layoutliste zeigte die falschen Kacheln.
      state.designs = liste
        .filter((eintrag) => eintrag && eintrag.id && eintrag.name)
        .map((eintrag) => ({
          id: String(eintrag.id),
          name: String(eintrag.name),
          theme: eintrag.theme === "dark" ? "dunkel" : "hell",
          footer: String(eintrag.footer_left || ""),
          domain: String(eintrag.domain || ""),
          logo: String(eintrag.logo || ""),
        }));
    } catch (_err) {
      state.designs = [];
    }
    state.designsGeladen = true;
    if (state.step === "form") zeichneForm();
  }

  async function ladeDrafts() {
    if (!articleId) return;
    try {
      const res = await api("list_assets", { article_id: articleId, kind: assetKind });
      const liste = res && typeof res === "object" ? (res.assets || res) : [];
      state.drafts = Array.isArray(liste) ? liste : [];
      state.draftsError = "";
    } catch (err) {
      state.draftsError = err && err.message ? String(err.message) : "Entwürfe konnten nicht geladen werden.";
    }
    if (state.step === "form" && state.formTab === "drafts") {
      const box = shell.querySelector(".as-drafts");
      if (box) box.outerHTML = draftsHtml();
    }
    const tab = shell.querySelector("[data-act=\"show-drafts\"]");
    if (tab) tab.outerHTML = draftsTabHtml();
  }

  function draftsTaktStart() {
    draftsTaktStop();
    void ladeDrafts();
    state.draftsUhr = window.setInterval(() => {
      if (state.formTab !== "drafts" || state.step !== "form") { draftsTaktStop(); return; }
      void ladeDrafts();
    }, 4_000);
  }

  function draftsTaktStop() {
    if (state.draftsUhr) window.clearInterval(state.draftsUhr);
    state.draftsUhr = 0;
  }

  function applyFormImages(memo) {
    if (!memo) return memo;
    Object.entries(state.formImages || {}).forEach(([key, image]) => setImageAt(memo, key, image));
    return memo;
  }

  function answersToForm(saved, row = {}) {
    const a = defaultAnswers(questions);
    const src = saved && typeof saved === "object" ? saved : {};
    a.company_named = src.company_named === "no" ? "no" : "yes";
    const firma = String(src.company || row.company || "").trim();
    if (firma && firma !== company) {
      a.company_mode = "custom";
      a.company_text = firma;
    } else {
      a.company_mode = "auto";
    }
    a.images = src.images === "upload" ? "upload" : "auto";
    a.benchmarks = src.benchmarks_mode === "custom" ? "custom" : "auto";
    (Array.isArray(src.benchmarks) ? src.benchmarks : []).forEach((item, i) => {
      a[`bench_${i}_name`] = item?.name || "";
      a[`bench_${i}_text`] = item?.text || "";
      a[`bench_${i}_tag`] = item?.tag || "";
    });
    a.storyline = src.storyline ? "custom" : "auto";
    a.storyline_text = src.storyline || "";
    a.cta = src.cta ? "custom" : "auto";
    a.cta_text = src.cta || "";
    a.memo_track = src.memo_track === "cmo100" ? "cmo100" : "theme";
    a.sources = src.sources ? "custom" : "auto";
    a.sources_text = src.sources || "";
    a.caption = src.caption_mode === "custom" ? "custom" : src.caption_mode === "ai_tone" ? "ai_tone" : "ai";
    a.caption_text = src.caption || "";
    a.profile = src.profile === "private" ? "private" : "roots";
    a.design = src.design || (src.theme === "dark" ? "roots-dunkel" : "roots-hell");
    if (src.asset_type) a.asset_type = src.asset_type;
    if (src.variant) a.variant = src.variant;
    if (src.theme === "dark") a.look = "dunkel";
    if (src.slides) {
      const n = String(src.slides);
      if (["8", "10", "12"].includes(n)) a.slide_count = n;
      else { a.slide_count = "custom"; a.slide_count_text = n; }
    }
    if (Array.isArray(src.slide_types) && src.slide_types.length) {
      a.slide_mix = "custom";
      a.slide_pick = src.slide_types.join(",");
      a.slide_cover = src.slide_types.find((key) => SLIDE_ROLE[key] === "cover") || "";
      a.slide_content = src.slide_types.filter((key) => !SLIDE_ROLE[key]).join(",");
      a.slide_end = src.slide_types.find((key) => SLIDE_ROLE[key] === "end") || "";
    }
    return a;
  }

  async function openDraft(id) {
    draftsTaktStop();
    state.formError = "";
    try {
      const res = await api("get_asset", { asset_id: id });
      const row = res && typeof res === "object" ? (res.asset || res) : {};
      if (!row.id) throw new Error("Entwurf nicht gefunden.");
      state.assetId = row.id;
      state.answers = answersToForm(row.answers, row);
      state.forecastMs = Number(row.forecast_ms) || 0;
      if (row.status === "running") {
        state.step = "draft";
        state.busy = true;
        state.error = "";
        state.cancelRequested = false;
        state.leftRunning = false;
        render();
        if (row.created_at) {
          const t = Date.parse(row.created_at);
          if (Number.isFinite(t)) state.ladeStart = t;
        }
        if (Array.isArray(row.run_log)) state.laufLog = row.run_log;
        ladeTaktStart();
        const fertig = await warteAufAsset(row.id);
        if (state.cancelRequested) return;
        if (fertig.status === "error") throw new Error(fertig.error_message || "Der Entwurf ist fehlgeschlagen.");
        state.assetId = fertig.id || state.assetId;
        adoptPayload(fertig.payload || fertig);
        applyFormImages(state.memo);
        await compactAdoptedImages();
        state.busy = false;
        ladeTaktStop();
        render();
        return;
      }
      if (row.status === "error") {
        state.step = "draft";
        state.busy = false;
        state.error = row.error_message || "Der Entwurf ist fehlgeschlagen.";
        state.payload = null;
        render();
        return;
      }
      adoptPayload(row.payload || row);
      applyFormImages(state.memo);
      await compactAdoptedImages();
      state.step = "draft";
      state.busy = false;
      state.error = "";
      render();
    } catch (err) {
      state.formError = err && err.message ? String(err.message) : "Entwurf konnte nicht geöffnet werden.";
      state.step = "form";
      state.formTab = "drafts";
      state.busy = false;
      render();
      draftsTaktStart();
    }
  }

  /** Sichtbare Fragen in ihrer Reihenfolge. Bedingte Fragen fallen raus, sobald
   *  ihre Bedingung nicht mehr gilt. */
  function aktiveFragen() {
    return questions.filter((q) => !q.when || q.when(state.answers));
  }

  /** Position im Fragebogen. Immer ueber den Schluessel, nie ueber einen Index:
   *  bedingte Fragen aendern die Laenge der Liste mitten im Ausfuellen. */
  function schrittIndex(fragen = aktiveFragen()) {
    if (state.stepKey === ENDE) return fragen.length;
    const i = fragen.findIndex((q) => q.key === state.stepKey);
    return i >= 0 ? i : 0;
  }

  function setzeSchritt(key) {
    state.stepKey = key;
    // Die rechte Vorschau springt beim Rollenwechsel auf die passende Folie.
    // Innerhalb desselben Schritts darf der Nutzer danach frei weiterblaettern.
    if (!isMemo && state.answers.asset_type === "carousel") {
      if (key === "slide_cover") state.prevIndex = 0;
      else if (key === "slide_content") state.prevIndex = 1;
      else if (key === "slide_end") state.prevIndex = Math.max(0, fragebogenCarouselVarianten().length - 1);
    }
    if (key && key !== ENDE && !state.stepSeen.includes(key)) state.stepSeen.push(key);
  }

  /** Der Schluessel der Frage nach der aktuellen, oder das Ende. */
  function naechsterSchritt() {
    const fragen = aktiveFragen();
    const i = schrittIndex(fragen);
    return fragen[i + 1]?.key || ENDE;
  }

  function vorherigerSchritt() {
    const fragen = aktiveFragen();
    const i = schrittIndex(fragen);
    return fragen[Math.max(0, i - 1)]?.key || fragen[0]?.key || "";
  }

  /** Fertig heisst: der Fragebogen ist durchlaufen und jede Frage traegt eine
   *  Antwort. Solange noch eine Karte offen steht, ist er es nicht. */
  function fragebogenFertig() {
    return state.stepKey === ENDE && aktiveFragen().every(frageErledigt);
  }

  /** Was in der zusammengeklappten Zeile als Antwort steht. */
  function antwortLabel(q) {
    if (q.art === "multi-content") {
      const gewaehlt = inhaltsArten();
      return gewaehlt.length === 1 ? "1 Inhaltsfolie" : `${gewaehlt.length} Inhaltsfolien`;
    }
    if (q.art === "frame") {
      const wert = q.role === "cover" ? state.answers.slide_cover : state.answers.slide_end;
      return wert ? variantenName(wert) : "noch nicht gewählt";
    }
    if (q.art === "design") return aktivesDesign().name;
    if (q.art === "dropdown") {
      const treffer = layoutOptionen().find(([key]) => key === state.answers[q.key]);
      return treffer ? treffer[1] : "Modell wählt";
    }
    const wert = state.answers[q.key];
    const treffer = (q.options || []).find(([key]) => key === wert);
    const label = treffer ? treffer[1] : String(wert || "");
    if (q.free && wert === q.free.on) {
      const text = String(state.answers[q.free.key] || "").trim();
      if (text) return text.length > 60 ? `${text.slice(0, 60)}…` : text;
    }
    return label;
  }

  /** Eine Frage gilt als erledigt, sobald sie eine belastbare Antwort traegt. */
  function frageErledigt(q) {
    if (!assetQuestionCanAdvance(q.key, state.answers, {
      designsLoaded: state.designsGeladen,
      designCount: state.designs.length,
      toneLoaded: state.toneGeladen,
      toneOfVoice: state.toneOfVoice,
    })) return false;
    if (q.art === "multi-content") {
      return inhaltsArten().length > 0 && inhaltsArten().every((key) => LOOK[key] === state.answers.look);
    }
    if (q.art === "frame") {
      const wert = q.role === "cover" ? state.answers.slide_cover : state.answers.slide_end;
      return Boolean(wert && SLIDE_ROLE[wert] === q.role && LOOK[wert] === state.answers.look);
    }
    if (q.key === "slide_count") return carouselRequestedSlides(state.answers) > 0;
    if (q.free && state.answers[q.key] === q.free.on) {
      return Boolean(String(state.answers[q.free.key] || "").trim());
    }
    if (q.key === "benchmarks" && state.answers.benchmarks === "custom") {
      return !eigeneBenchmarksPruefen();
    }
    return Boolean(state.answers[q.key]);
  }

  /** Weiterspringen ohne Klick nur dort, wo die Wahl die Frage abschliesst:
   *  reine Auswahl ohne Freitext und ohne Mehrfachauswahl. */
  function springtWeiter(q) {
    if (!q) return false;
    if (!frageErledigt(q)) return false;
    if (q.art === "multi-content") return false;
    // Bei der Formatwahl bleibt die Frage offen, damit Einzelbild und Carousel
    // vor dem Weitergehen sichtbar verglichen werden koennen.
    if (q.key === "asset_type") return false;
    if (q.free && state.answers[q.key] === q.free.on) return false;
    if (q.key === "benchmarks" && state.answers.benchmarks === "custom") return false;
    if (q.key === "images" && state.answers.images === "upload") return false;
    // Fehlt der Tonfall, bleibt die Frage offen: der Hinweis mit dem Weg in die
    // Einstellungen darf nicht unter einer zugeklappten Zeile verschwinden.
    if (q.key === "caption" && state.answers.caption === "ai_tone" && state.toneGeladen && !state.toneOfVoice) return false;
    // Dasselbe fuer ein Privatprofil ohne Vorlage.
    if (q.key === "profile" && state.answers.profile === "private" && state.designsGeladen && !state.designs.length) return false;
    return true;
  }

  /** Die Vorlagen als Karten: Grundton und Akzent sind sofort zu sehen. */
  function designHtml(q) {
    if (state.answers.profile === "private" && !state.designsGeladen) {
      return `<p class="as-hint" aria-live="polite">Design-Vorlagen werden geladen …</p>`;
    }
    if (state.answers.profile === "private" && !state.designs.length) {
      return noticeHtml("fa-swatchbook", DESIGN_FEHLT, "open-designs");
    }
    const liste = designListe();
    const aktiv = aktivesDesign().id;
    const karten = liste.map((design) => `
      <button type="button" class="as-design${design.id === aktiv ? " is-active" : ""}" data-act="pick-design" data-value="${attr(design.id)}" aria-pressed="${design.id === aktiv ? "true" : "false"}">
        <span class="as-design-probe" data-theme="${attr(design.theme)}">
          <span class="as-design-bar"></span>
          <span class="as-design-zeile"></span>
          <span class="as-design-zeile as-design-zeile--kurz"></span>
        </span>
        <span class="as-design-name">${esc(design.name)}</span>
      </button>`).join("");
    const eigene = state.answers.profile === "private"
      ? `<button type="button" class="as-linkbtn" data-act="open-designs"><i class="fa-solid fa-sliders"></i>Vorlagen verwalten</button>`
      : "";
    return `<div class="as-designs">${karten}</div>${eigene}`;
  }

  /** Was LinkedIn vom Text erwartet: Hooklaenge, Limits, was der Beleg hergibt.
   *  Steht unter dem Feld, das es betrifft, und rechnet beim Tippen mit. */
  function schreibhilfeHtml(key) {
    const hinweise = feldHinweise(key, state.answers[key], {
      lane: isMemo ? "sales" : "marketing",
      carousel: !isMemo && state.answers.asset_type === "carousel",
    });
    if (!hinweise.length) return "";
    return `<div data-guide="${attr(key)}">${guideMarkup(hinweise, esc)}</div>`;
  }

  /** Beim Tippen nur die Hilfe erneuern: ein Neuzeichnen wuerde den Fokus und
   *  die Schreibmarke im Feld verlieren. */
  function aktualisiereSchreibhilfe(key) {
    const host = shell.querySelector(`[data-guide="${key}"]`);
    if (host) host.innerHTML = guideMarkup(feldHinweise(key, state.answers[key], {
      lane: isMemo ? "sales" : "marketing",
      carousel: !isMemo && state.answers.asset_type === "carousel",
    }), esc);
  }

  /** Der Kern einer Frage: Optionen, Freitext und Sonderrenderer. */
  function frageKoerper(q) {
    if (q.art === "dropdown") return dropdownHtml(q);
    if (q.art === "frame") return frameDropdownHtml(q);
    if (q.art === "multi-content") return contentMultiHtml(q);
    if (q.art === "design") return designHtml(q);
    const opts = q.options.map(([value, label]) => {
      // Der Look steht am Layout statt in einer eigenen Frage, und die
      // Infografiken tragen den Hinweis, dass ihre Zahlen zu setzen sind.
      const hinweis = q.key !== "variant" ? ""
        : LAYOUT_KEYS.includes(value) ? "Diagramm"
        : LOOK[value] ? LOOK[value] : "";
      return `
      <label class="as-opt">
        <input type="radio" name="as-${attr(q.key)}" value="${attr(value)}"${state.answers[q.key] === value ? " checked" : ""}>
        <span>${esc(label)}</span>${hinweis ? `<i class="as-tag">${esc(hinweis)}</i>` : ""}
      </label>`;
    }).join("");
    const free = q.free && state.answers[q.key] === q.free.on
      ? (Number(q.free.rows) === 1
        ? `<input class="as-free" data-free="${attr(q.free.key)}" aria-label="${attr(q.label)}" placeholder="${attr(q.free.platzhalter || "")}" value="${esc(state.answers[q.free.key] || "")}">`
        : `<textarea class="as-free" rows="${q.free.rows}" data-free="${attr(q.free.key)}" aria-label="${attr(q.label)}" placeholder="${attr(q.free.platzhalter || "")}">${esc(state.answers[q.free.key] || "")}</textarea>`)
        + schreibhilfeHtml(q.free.key)
      : "";
    const warnung = q.key === "caption" && state.answers.caption === "ai_tone" && state.toneGeladen && !state.toneOfVoice
      ? noticeHtml("fa-feather", "Tone of Voice ist noch nicht hinterlegt", "open-tone")
      : q.key === "profile" && state.answers.profile === "private" && state.designsGeladen && !state.designs.length
        ? noticeHtml("fa-swatchbook", "Für das Privatprofil ist noch keine Design-Vorlage hinterlegt", "open-designs")
        : "";
    const benches = q.key === "benchmarks" && state.answers.benchmarks === "custom" ? benchesHtml() : "";
    const slots = q.key === "images" && state.answers.images === "upload" ? slotsHtml() : "";
    const empfehlung = q.key === "slide_count"
      ? `<div data-carousel-guidance-host>${carouselEmpfehlungHtml(carouselRequestedSlides(state.answers))}</div>`
      : "";
    return `<div class="as-opts">${opts}</div>${warnung}${free}${empfehlung}${benches}${slots}`;
  }

  /** Der Weg in die Einstellungen. Das Studio liegt ueber dem Artikel-Popup,
   *  deshalb raeumt die App beide Ebenen weg, bevor sie das Panel oeffnet. */
  function oeffneEinstellungen(panel) {
    if (typeof openSettingsPanel !== "function") {
      notify?.("Die Einstellungen sind von hier nicht erreichbar.", "err");
      return;
    }
    close();
    openSettingsPanel(panel);
  }

  /** Eine fehlende Voraussetzung ist kein roter Zettel, sondern ein Weg:
   *  Aussage plus Knopf, der genau dort landet, wo sie hinterlegt wird. */
  function noticeHtml(icon, text, aktion) {
    return `<div class="as-notice">
      <span class="as-notice-icon"><i class="fa-solid ${attr(icon)}"></i></span>
      <div class="as-notice-text"><b>${esc(text)}</b></div>
      <button type="button" class="as-btn as-btn--primary" data-act="${attr(aktion)}">
        <i class="fa-solid fa-arrow-right"></i>Jetzt konfigurieren
      </button>
    </div>`;
  }

  function formHtml() {
    const fragen = aktiveFragen();
    if (!state.stepKey || (state.stepKey !== ENDE && !fragen.some((q) => q.key === state.stepKey))) {
      setzeSchritt(fragen[0]?.key || ENDE);
    }
    const gesamt = fragen.length;
    const offen = schrittIndex(fragen);
    const fertig = fragebogenFertig();
    const karten = fragen.map((q, i) => {
      if (i > offen) return "";
      if (i < offen) {
        return `<button type="button" class="as-step as-step--done" data-act="step-open" data-key="${attr(q.key)}">
          <span class="as-step-nr"><i class="fa-solid fa-check"></i></span>
          <span class="as-step-label">${esc(q.label)}</span>
          <span class="as-step-wert">${esc(antwortLabel(q))}</span>
          <i class="fa-solid fa-pen as-step-stift"></i>
        </button>`;
      }
      const letzte = i === gesamt - 1;
      const weiter = `<button type="button" class="as-btn as-btn--primary as-step-weiter" data-act="step-next"${frageErledigt(q) ? "" : " disabled"}>
          ${letzte ? '<i class="fa-solid fa-check"></i>Fertig' : 'Weiter<i class="fa-solid fa-arrow-right"></i>'}
        </button>`;
      const zurueck = i > 0
        ? `<button type="button" class="as-btn as-step-zurueck" data-act="step-back"><i class="fa-solid fa-arrow-left"></i>Zurück</button>`
        : "";
      const hinweis = q.hint ? `<p class="as-hint">${esc(q.hint)}</p>` : "";
      const fehler = state.formError && state.formErrorKey === q.key
        ? `<p class="as-form-error">${esc(state.formError)}</p>`
        : "";
      return `<div class="as-step as-step--open" data-stepcard>
        <div class="as-step-kopf">
          <span class="as-step-nr">${i + 1}</span>
          <label>${esc(q.label)}</label>
        </div>
        ${hinweis}
        ${frageKoerper(q)}
        ${fehler}
        <div class="as-step-fuss">${zurueck}${weiter}</div>
      </div>`;
    }).join("");
    const abschlussFehler = state.formError && !state.formErrorKey
      ? `<p class="as-form-error">${esc(state.formError)}</p>`
      : "";
    const abschluss = state.stepKey === ENDE
      ? `<div class="as-step as-step--open as-step--final" data-stepcard>
          <div class="as-step-kopf"><span class="as-step-nr"><i class="fa-solid fa-flag-checkered"></i></span><label>Bereit</label></div>
          ${abschlussFehler}
          <div class="as-step-fuss">
            <button type="button" class="as-btn as-step-zurueck" data-act="step-back"><i class="fa-solid fa-arrow-left"></i>Zurück</button>
            <button type="button" class="as-btn as-btn--primary as-step-weiter" data-act="generate"><i class="fa-solid fa-wand-magic-sparkles"></i>Entwurf erzeugen</button>
          </div>
        </div>`
      : "";
    const wip = isMemo && state.answers.memo_track === "cmo100"
      ? `<div class="as-wip"><strong>100 Tage CMO</strong><p>Diese Unterlage ist ein eigener Sonderfall und noch in Ausarbeitung. Sie ist kein Executive Memo. Für diesen Fall bitte das thematische Executive Memo wählen.</p></div>`
      : "";
    const anteil = Math.round((Math.min(offen, gesamt) / Math.max(1, gesamt)) * 100);
    const kopf = `<div class="as-progress">
      <div class="as-progress-bar"><span style="width:${fertig ? 100 : anteil}%"></span></div>
      <span class="as-progress-text">${fertig ? "Alle Fragen beantwortet" : `Frage ${Math.min(offen + 1, gesamt)} von ${gesamt}`}</span>
    </div>`;
    return `<form class="as-form" data-form>${kopf}${karten}${abschluss}${wip}</form>`;
  }

  /** Formular und Vorschau in einem Zug neu zeichnen. */
  function zeichneForm() {
    readForm();
    if (!isMemo) synchronisiereDesign();
    const form = shell.querySelector(".as-split2-form");
    if (form) form.innerHTML = state.formTab === "drafts" ? draftsHtml() : formHtml();
    zeigeOffeneKarte();
    const prev = shell.querySelector("[data-livepreview]");
    if (prev) prev.innerHTML = livePreviewHtml();
    zeichneCaption();
    fitPreview();
  }

  /** Die offene Frage in die Mitte des Sichtfelds. "nearest" liess sie an der
   *  unteren Kante kleben, und wer unten stand, sah die naechste Frage nicht. */
  function zeigeOffeneKarte() {
    const karte = shell.querySelector("[data-stepcard]");
    const box = karte && karte.closest(".as-content");
    if (!karte || !box || box.scrollHeight <= box.clientHeight) return;
    const kr = karte.getBoundingClientRect();
    const br = box.getBoundingClientRect();
    const ziel = box.scrollTop + (kr.top - br.top) - Math.max(0, (br.height - kr.height) / 2);
    box.scrollTop = Math.max(0, ziel);
  }

  function readForm() {
    const form = shell.querySelector("[data-form]");
    if (!form) return;
    // Waehlt die KI das Layout, darf keine alte eigene Wahl stehen bleiben.
    if (state.answers.variant_mode !== "custom") state.answers.variant = "auto";
    for (const q of questions) {
      const checked = form.querySelector(`input[name="as-${CSS.escape(q.key)}"]:checked`);
      if (checked) state.answers[q.key] = checked.value;
      if (q.free) {
        const box = form.querySelector(`[data-free="${CSS.escape(q.free.key)}"]`);
        if (box) state.answers[q.free.key] = box.value;
      }
    }
    form.querySelectorAll("[data-bench]").forEach((box) => {
      const key = box.getAttribute("data-bench") || "";
      const [i, feld] = key.split("-");
      if (feld) state.answers[`bench_${i}_${feld}`] = box.value;
    });
  }

  function eigeneBenchmarks() {
    return [0, 1, 2].map((i) => ({
      name: String(state.answers[`bench_${i}_name`] || "").trim(),
      text: String(state.answers[`bench_${i}_text`] || "").trim(),
      tag: String(state.answers[`bench_${i}_tag`] || "").trim(),
    }));
  }

  function eigeneBenchmarksPruefen() {
    const liste = eigeneBenchmarks();
    const voll = liste.filter((item) => item.name && item.text && item.tag);
    if (voll.length < 3) {
      return "Bitte drei Benchmarks mit Name, Handlung und Lehre. Beispiel: Decathlon | Hat die Eigenmarken unter eine Führung gestellt | Marke vor Fläche";
    }
    const beispiel = BENCH_EXAMPLE.map((item) => item.name.toLowerCase()).sort().join("|");
    const namen = liste.map((item) => item.name.toLowerCase()).sort().join("|");
    if (namen === beispiel) {
      return "Das Beispiel zeigt nur die Form. Bitte drei Benchmarks einsetzen, die denselben Hebel wie dieses Signal schon gezogen haben.";
    }
    const duenn = liste.find((item) => item.text.length < 24);
    if (duenn) return `„${duenn.name}“ braucht eine konkrete Handlung, nicht nur den Namen.`;
    return "";
  }

  /* ── Schritt 2: Entwurf erzeugen ── */

  /** Fehler stehen an der Frage, die sie ausgeloest hat, und oeffnen sie. */
  function formFehler(key, text) {
    state.formError = text;
    state.formErrorKey = key;
    if (key) setzeSchritt(key);
    zeichneForm();
  }

  async function generate() {
    readForm();
    if (isMemo && state.answers.memo_track === "cmo100") {
      formFehler("memo_track", "Das 100-Tage-CMO-Dokument ist noch in Ausarbeitung. Es ist kein Executive Memo. Bitte das thematische Executive Memo wählen.");
      return;
    }
    if (isMemo && state.answers.benchmarks === "custom") {
      const mangel = eigeneBenchmarksPruefen();
      if (mangel) {
        formFehler("benchmarks", mangel);
        return;
      }
    }
    if (!isMemo && state.answers.profile === "private" && state.designsGeladen && !state.designs.length) {
      formFehler("design", DESIGN_FEHLT);
      return;
    }
    if (!isMemo && state.answers.caption === "ai_tone" && state.toneGeladen && !state.toneOfVoice) {
      formFehler("caption", TONE_FEHLT);
      return;
    }
    if (!isMemo && state.answers.caption === "custom" && !String(state.answers.caption_text || "").trim()) {
      formFehler("caption", "Für eine selbst geschriebene Caption fehlt der Text.");
      return;
    }
    if (!isMemo && state.answers.asset_type === "carousel") {
      const anzahl = carouselRequestedSlides(state.answers);
      if (!anzahl) {
        formFehler(state.answers.slide_mix === "custom" ? "slide_content" : "slide_count", `Bitte eine gültige Anzahl zwischen 2 und ${LINKEDIN_DOCUMENT_PAGE_MAX} angeben.`);
        return;
      }
      if (state.answers.slide_mix === "custom") {
        const probleme = manualCarouselSelectionIssues(gewaehlteArten(), state.answers.look);
        if (probleme.length) {
          const key = !state.answers.slide_cover ? "slide_cover" : !state.answers.slide_end ? "slide_end" : "slide_content";
          formFehler(key, probleme.join(" "));
          return;
        }
      }
    }
    state.formError = "";
    state.formErrorKey = "";
    state.step = "draft";
    state.busy = true;
    state.error = "";
    state.cancelRequested = false;
    state.leftRunning = false;
    draftsTaktStop();
    render();
    ladeTaktStart(true);
    try {
      const gewaehlt = state.answers.variant;
      const anzahl = !isMemo && state.answers.asset_type === "carousel" ? carouselRequestedSlides(state.answers) : 1;
      const antworten = { ...state.answers, layout: gewaehlt, slide_count: String(anzahl), slides: anzahl };
      // Wer erst selbst gewaehlt hat und dann auf "KI soll waehlen" zurueck
      // geht, hat seine Folge widerrufen. Sie mitzuschicken haette den Server
      // weiter manuell pruefen lassen — und an der fehlenden Endfolie scheitern.
      if (isMemo || antworten.asset_type !== "carousel" || antworten.slide_mix !== "custom") {
        antworten.slide_pick = "";
        antworten.slide_cover = "";
        antworten.slide_content = "";
        antworten.slide_end = "";
      }
      const res = await api("generate_asset", {
        kind: assetKind,
        article_id: articleId || null,
        answers: antworten,
        image_uploads: isMemo ? state.formImages : undefined,
      });
      if (state.cancelRequested) return;
      const row = res && typeof res === "object" ? (res.asset || res) : {};
      state.assetId = row.id || null;
      uebernehmeLaufstand(row);
      const fertig = row.status === "running" ? await warteAufAsset(row.id) : row;
      if (state.cancelRequested) return;
      if (fertig.status === "error") throw new Error(fertig.error_message || "Der Entwurf ist fehlgeschlagen.");
      state.assetId = fertig.id || state.assetId;
      adoptPayload(fertig.payload || fertig);
      applyFormImages(state.memo);
      await compactAdoptedImages();
      state.busy = false;
      ladeTaktStop();
      render();
    } catch (err) {
      if (state.cancelRequested) return;
      state.busy = false;
      ladeTaktStop();
      state.error = (err && err.message) ? String(err.message) : String(err || "Unbekannter Fehler");
      state.payload = null;
      render();
    }
  }

  /** Fragt den Auftrag ab, bis er fertig ist. Kein Zeitlimit: solange der
   *  Server running meldet (Puls lebt), wartet das Studio. Abbruch nur durch
   *  den Nutzer oder wenn der Auftrag selbst auf done/error geht. */
  async function warteAufAsset(id) {
    let wartezeit = 800;
    for (;;) {
      if (state.cancelRequested) return state.leftRunning
        ? { id, status: "running" }
        : { id, status: "error", error_message: "Vom Nutzer abgebrochen." };
      await new Promise((r) => setTimeout(r, wartezeit));
      wartezeit = Math.min(wartezeit + 200, 1_200);
      if (state.cancelRequested) return state.leftRunning
        ? { id, status: "running" }
        : { id, status: "error", error_message: "Vom Nutzer abgebrochen." };
      const res = await api("get_asset", { asset_id: id });
      const row = res && typeof res === "object" ? (res.asset || res) : {};
      uebernehmeLaufstand(row);
      if (row.status && row.status !== "running") return row;
    }
  }

  function adoptPayload(raw) {
    const data = raw && typeof raw === "object" ? raw : {};
    state.payload = data;
    // Der Server hat die Vorlage beim Erzeugen festgeschrieben. Ein spaeter
    // geoeffneter Entwurf zeigt deshalb dieselbe Fusszeile wie damals.
    if (data.chrome && typeof data.chrome === "object") {
      state.chrome = {
        footer_left: String(data.chrome.footer_left || ""),
        domain: String(data.chrome.domain || ""),
        logo: String(data.chrome.logo || ""),
        custom: Boolean(data.chrome.custom),
      };
    }
    state.stage.theme = data.theme === "dark" ? "dark" : (state.answers.theme === "dark" ? "dark" : "light");
    if (isMemo) {
      state.memo = normalizeMemo(data);
      state.slides = [];
      state.postText = "";
    } else {
      const list = toArray(data.slides);
      state.slides = (list.length ? list : [{}]).map(normalizeSlide);
      const gewaehltesLayout = state.answers.variant;
      if (gewaehltesLayout && LAYOUT_KEYS.includes(gewaehltesLayout)) {
        state.slides.forEach((slide) => { slide.variant = gewaehltesLayout; });
      }
      state.memo = null;
      state.postText = String(data.post_text || "");
    }
  }

  function normalizeSlide(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const variant = VARIANT_KEYS.includes(src.variant) ? src.variant : "B";
    const stats = toArray(src.stats);
    const steps = toArray(src.steps);
    return {
      uid: uid(),
      variant,
      kicker: String(src.kicker || ""),
      title: String(src.title || ""),
      subtitle: String(src.subtitle || ""),
      quote: String(src.quote || ""),
      attribution: String(src.attribution || ""),
      stat: {
        value: String(src.stat?.value || ""),
        label: String(src.stat?.label || ""),
      },
      stats: stats.map((item) => ({ value: String(item?.value || ""), label: String(item?.label || "") })),
      bullets: toArray(src.bullets).map((line) => String(line || "")),
      steps: steps.map((item, index) => ({
        n: String(item?.n || String(index + 1).padStart(2, "0")),
        title: String(item?.title || ""),
        text: String(item?.text || ""),
      })),
      myth: String(src.myth || ""),
      fact: String(src.fact || ""),
      takeaway: String(src.takeaway || ""),
      footerLeft: String(src.footer_left || state.chrome.footer_left || (state.chrome.custom ? "" : "ROOTS Consultants")),
      imageHint: String(src.image_hint || ""),
      slot_a: String(src.slot_a || ""),
      slot_b: String(src.slot_b || ""),
      slot_c: String(src.slot_c || ""),
      slot_d: String(src.slot_d || ""),
      slot_center: String(src.slot_center || ""),
      counts: {
        stats: Math.max(3, stats.length || 0),
        steps: Math.max(3, steps.length || 0),
      },
      image: { src: "", pos: "50% 50%" },
      html: {},
    };
  }

  function emptyImage() {
    return { src: "", pos: "50% 50%" };
  }

  function imageAt(model, key) {
    if (!model) return emptyImage();
    const treffer = /^(benchmarks|potentials)\.(\d+)$/.exec(String(key || ""));
    if (treffer) {
      const liste = model[treffer[1]];
      const eintrag = Array.isArray(liste) ? liste[Number(treffer[2])] : null;
      return eintrag?.image || emptyImage();
    }
    return model.image || emptyImage();
  }

  function setImageAt(model, key, image) {
    if (!model) return;
    const treffer = /^(benchmarks|potentials)\.(\d+)$/.exec(String(key || ""));
    if (treffer) {
      const liste = model[treffer[1]];
      const eintrag = Array.isArray(liste) ? liste[Number(treffer[2])] : null;
      if (eintrag) eintrag.image = image;
      return;
    }
    if ("image" in model) model.image = image;
  }

  function padItems(list, count) {
    const out = Array.isArray(list) && list.length ? list.slice() : [];
    while (out.length < count) out.push({});
    return out.slice(0, count);
  }

  function normalizeMemo(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const kpis = padItems(toArray(src.kpis), 4);
    const benchmarks = padItems(toArray(src.benchmarks), 3);
    const potentials = padItems(toArray(src.potentials), 3);
    return {
      uid: uid(),
      title: String(src.title || ""),
      standfirst: String(src.standfirst || ""),
      market_title: String(src.market_title || ""),
      market_p1: String(src.market_p1 || ""),
      market_p2: String(src.market_p2 || ""),
      kpis: kpis.map((item) => ({
        value: String(item?.value || ""),
        label: String(item?.label || ""),
      })),
      benchmark_title: String(src.benchmark_title || ""),
      benchmark_lead: String(src.benchmark_lead || ""),
      benchmarks: benchmarks.map((item) => ({
        name: String(item?.name || ""),
        text: String(item?.text || ""),
        tag: String(item?.tag || ""),
        image_hint: String(item?.image_hint || ""),
        image: {
          src: String(item?.image?.src || ""),
          pos: String(item?.image?.pos || "50% 50%"),
        },
      })),
      potentials_title: String(src.potentials_title || ""),
      potentials_lead: String(src.potentials_lead || ""),
      potentials: potentials.map((item) => ({
        title: String(item?.title || ""),
        finding: String(item?.finding || ""),
        potential: String(item?.potential || ""),
        image_hint: String(item?.image_hint || ""),
        image: {
          src: String(item?.image?.src || ""),
          pos: String(item?.image?.pos || "50% 50%"),
        },
      })),
      cta: String(src.cta || ""),
      about_fit: String(src.about_fit || ""),
      sources: toArray(src.sources).map((line) => String(line || "")),
      html: {},
    };
  }

  /* ── Bühne: LinkedIn-Slide aus der echten Vorlage ── */

  /**
   * Rendert einen Slide aus dem Markup des bereits gebauten ROOTS-Assets.
   * Die Vorlagen in asset-templates.js sind unveraendert aus den Einzelposts
   * uebernommen; hier werden nur Platzhalter gefuellt. Vorschau und fertiges
   * Asset benutzen denselben Weg, deshalb kann die Vorschau nicht luegen.
   */
  function slideHtml(slide, editable = true) {
    let html = ASSET_TEMPLATES[slide.variant] || ASSET_LAYOUTS[slide.variant] || ASSET_TEMPLATES.B;
    html = expandRepeats(html, slide);
    html = fillTemplate(html, slide);
    html = ergaenzeZitatQuelle(html, slide);
    html = wrapImageSlots(html, slide);
    if (editable) {
      html = html.replace(/data-field="([a-z0-9_.]+)"/g, 'data-field="$1" contenteditable="true" spellcheck="false"');
    }
    // Kein Eingriff in die Anmutung: jedes gebaute Asset bringt seine mit, und
    // die Textfarben stehen inline im Markup. Ein Umschalten der Klasse hat
    // vorher weisse Schrift auf weissem Grund erzeugt - die Kachel sah leer aus.
    // lang="de" ist die Bedingung für hyphens:auto. Ohne sie trennt der Browser
    // lange Komposita nicht und der Titel läuft aus der Kachel.
    return `<div class="as-stage as-stage--tpl" lang="de" data-stage data-uid="${attr(slide.uid)}" data-variant="${attr(slide.variant)}">${html}</div>`;
  }

  /** Ein Zitat ohne sichtbare Person wirkt wie eine unbelegte Werbeaussage.
   *  Die historischen A/J-Vorlagen hatten das Feld im Modell, aber nicht im
   *  Markup. Wir ergänzen es direkt unter dem Zitat, in beiden Varianten. */
  function ergaenzeZitatQuelle(html, slide) {
    if (!["A", "J"].includes(slide.variant) || !String(slide.attribution || "").trim()) return html;
    const quelle = `<p style="font-size:26px;line-height:1.3;font-weight:600;color:#b9c9e8;margin-top:24px;" data-field="attribution">${markiere(esc(slide.attribution))}</p>`;
    return html.replace(/(<p[^>]*data-field="quote"[^>]*>[\s\S]*?<\/p>)/, `$1${quelle}`);
  }

  /** Wiederholte Bloecke: ein Eintrag je Aufzaehlung, Kennzahl oder Schritt. */
  function expandRepeats(html, slide) {
    return html.replace(/<!--repeat:([a-z]+)-->([\s\S]*?)<!--\/repeat-->/g, (_m, feld, block) => {
      const liste = feld === "bullets" ? (slide.bullets.length ? slide.bullets : ["", "", ""])
        : feld === "stats" ? (slide.stats.length ? slide.stats : [{}, {}, {}])
        : feld === "steps" ? (slide.steps.length ? slide.steps : [{}, {}, {}])
        : [];
      return liste.map((eintrag, i) => {
        const werte = feld === "bullets"
          ? { item: String(eintrag || ""), n: String(i + 1) }
          : feld === "stats"
            ? { value: String(eintrag?.value || ""), label: String(eintrag?.label || ""), n: String(i + 1) }
            : { n: String(eintrag?.n || String(i + 1)), title: String(eintrag?.title || ""), text: String(eintrag?.text || "") };
        // Der Index wandert in data-field, damit die Werkbank den Eintrag
        // wiederfindet: bullets.0 statt nur bullets.
        return block
          .replace(/data-field="([a-z_]+)"/g, (__m, name) => `data-field="${feld}.${i}.${name}"`)
          .replace(/\{\{([a-z_]+)\}\}/g, (__m, name) => markiere(esc(werte[name] ?? "")));
      }).join("");
    });
  }

  function fillTemplate(html, slide) {
    const werte = {
      // Eigene Vorlagen bringen ihr eigenes Zeichen mit; ohne eines bleibt der
      // Platz leer statt das ROOTS-Logo unter fremdem Namen zu zeigen.
      logo: state.chrome.custom ? (state.chrome.logo || LEER_BILD) : (state.logo || LOGO_PATH),
      domain: state.chrome.domain || "",
      kicker: slide.kicker,
      title: slide.title,
      subtitle: slide.subtitle,
      quote: slide.quote,
      attribution: slide.attribution,
      stat_value: slide.stat.value,
      stat_label: slide.stat.label,
      myth: slide.myth,
      fact: slide.fact,
      takeaway: slide.takeaway,
      footer_left: slide.footerLeft,
      slot_a: slide.slot_a || "",
      slot_b: slide.slot_b || "",
      slot_c: slide.slot_c || "",
      slot_d: slide.slot_d || "",
      slot_center: slide.slot_center || "",
      // Nur bei den Datenlayouts: die Zeile ueber dem Titel. Nicht den Kicker
      // wiederholen, der steht schon oben rechts in der Kachel.
      eyebrow: "Abbildung",
      image: slide.image.src || "",
    };
    (slide.stats || []).forEach((eintrag, i) => {
      werte[`stat${i + 1}_value`] = eintrag?.value || "";
      werte[`stat${i + 1}_label`] = eintrag?.label || "";
    });
    (slide.steps || []).forEach((schritt, i) => {
      werte[`step${i + 1}_n`] = schritt?.n || "";
      werte[`step${i + 1}_title`] = schritt?.title || "";
      werte[`step${i + 1}_text`] = schritt?.text || "";
    });
    return html.replace(/\{\{([a-z0-9_]+)\}\}/g, (_m, name) => {
      const wert = werte[name];
      if (name === "logo" || name === "image") return attr(wert || "");
      const bearbeitet = slide.html?.[name];
      if (typeof bearbeitet === "string") return bearbeitet;
      return markiere(esc(wert || ""));
    });
  }

  /**
   * Zwei Auszeichnungen, die im Text stehen muessen, weil nur der Text weiss,
   * wo sie hingehoeren: ~~Wort~~ wird durchgestrichen, **Vorspann** wird fett.
   * Beide steckten in den gebauten Assets als inline-Markup in Ueberschrift,
   * Aufzaehlung und Kernaussage-Band und waren mit dem Platzhalter verloren.
   */
  function markiere(text) {
    return text
      .replace(/~~([^~]{1,60})~~/g,
        '<span style="color:var(--extra-muted);text-decoration:line-through;text-decoration-color:var(--brand);text-decoration-thickness:8px;">$1</span>')
      .replace(/\*\*([^*]{1,120})\*\*/g, "<b>$1</b>");
  }

  /** Fotos bekommen ein Bild-Icon. Der Zuschnitt läuft im Popup, nicht als Leiste auf der Folie. */
  function wrapImageSlots(html, model) {
    const uiFor = (key) => {
      const bild = imageAt(model, key);
      const hat = Boolean(bild.src);
      return `<div class="as-img-ui" data-as-chrome>
      <button type="button" class="as-img-btn" data-act="img-pick" data-imgkey="${attr(key)}" aria-label="${hat ? "Bild ersetzen" : "Bild einfügen"}" title="${hat ? "Bild ersetzen" : "Bild einfügen"}"><i class="fa-regular fa-image"></i></button>
      ${hat ? `<button type="button" class="as-img-btn is-clear" data-act="img-clear" data-imgkey="${attr(key)}" aria-label="Bild entfernen" title="Bild entfernen"><i class="fa-solid fa-xmark"></i></button>` : ""}
    </div>`;
    };
    if (html.includes("data-imgsrc")) {
      return html.replace(/(<img[^>]*data-imgsrc[^>]*>)/g, (imgTag) => {
        const key = /data-imgkey="([^"]+)"/.exec(imgTag)?.[1] || "image";
        return `<span class="as-img as-img--tpl" data-imgslot data-imgkey="${attr(key)}">${imgTag}${uiFor(key)}</span>`;
      });
    }
    // Hintergrundbild (Vollbild und Zitat ueber Bild): Slot als Auflage.
    if (/background-image:url\(/.test(html)) {
      return html.replace(/(<div style="position:absolute;inset:0;background-image:url\([^)]*\)[^"]*"><\/div>)/,
        `$1<span class="as-img as-img--bg" data-imgslot data-imgkey="image">${uiFor("image")}</span>`);
    }
    return html;
  }

  function memoHtml(memo, editable = true) {
    const werte = {
      uid: memo.uid,
      logo: state.logo || LOGO_PATH,
      title: memo.title,
      standfirst: memo.standfirst,
      market_title: memo.market_title,
      market_p1: memo.market_p1,
      market_p2: memo.market_p2,
      benchmark_title: memo.benchmark_title,
      benchmark_lead: memo.benchmark_lead,
      potentials_title: memo.potentials_title,
      potentials_lead: memo.potentials_lead,
      cta: memo.cta,
      about_fit: memo.about_fit,
      sources: memo.sources.filter(Boolean).join(" · "),
    };
    (memo.kpis || []).forEach((kpi, i) => {
      werte[`kpi${i + 1}_value`] = kpi?.value || "";
      werte[`kpi${i + 1}_label`] = kpi?.label || "";
    });
    (memo.benchmarks || []).forEach((eintrag, i) => {
      werte[`bm${i + 1}_name`] = eintrag?.name || "";
      werte[`bm${i + 1}_text`] = eintrag?.text || "";
      werte[`bm${i + 1}_tag`] = eintrag?.tag || "";
      werte[`bm${i + 1}_hint`] = eintrag?.image_hint || "";
      werte[`bm${i + 1}_image`] = eintrag?.image?.src || "";
      werte[`bm${i + 1}_pos`] = eintrag?.image?.pos || "50% 50%";
    });
    (memo.potentials || []).forEach((eintrag, i) => {
      werte[`pot${i + 1}_title`] = eintrag?.title || "";
      werte[`pot${i + 1}_finding`] = eintrag?.finding || "";
      werte[`pot${i + 1}_potential`] = eintrag?.potential || "";
      werte[`pot${i + 1}_hint`] = eintrag?.image_hint || "";
      werte[`pot${i + 1}_image`] = eintrag?.image?.src || "";
      werte[`pot${i + 1}_pos`] = eintrag?.image?.pos || "50% 50%";
    });
    let html = MEMO_TEMPLATE.replace(/\{\{([a-z0-9_]+)\}\}/g, (_m, name) => {
      const wert = werte[name];
      if (name === "logo" || name.endsWith("_image") || name.endsWith("_pos") || name === "uid") {
        return attr(wert || "");
      }
      const pfad = memoFieldPath(name);
      const bearbeitet = pfad ? memo.html?.[pfad] : undefined;
      if (typeof bearbeitet === "string") return bearbeitet;
      return markiere(esc(wert || ""));
    });
    html = wrapImageSlots(html, memo);
    if (editable) {
      html = html.replace(/data-field="((?!benchmarks\.\d+\.image_hint)(?!potentials\.\d+\.image_hint)[a-z0-9_.]+)"/g, 'data-field="$1" contenteditable="true" spellcheck="false"');
    }
    return html;
  }

  /** Platzhaltername der Vorlage auf den data-field-Pfad der Werkbank. */
  function memoFieldPath(name) {
    const einfach = {
      title: "title", standfirst: "standfirst",
      market_title: "market_title", market_p1: "market_p1", market_p2: "market_p2",
      benchmark_title: "benchmark_title", benchmark_lead: "benchmark_lead",
      potentials_title: "potentials_title", potentials_lead: "potentials_lead",
      cta: "cta", about_fit: "about_fit", sources: "sources",
    };
    if (einfach[name]) return einfach[name];
    const kpi = /^kpi(\d+)_(value|label)$/.exec(name);
    if (kpi) return `kpis.${Number(kpi[1]) - 1}.${kpi[2]}`;
    const bm = /^bm(\d+)_(name|text|tag|hint)$/.exec(name);
    if (bm) return `benchmarks.${Number(bm[1]) - 1}.${bm[2] === "hint" ? "image_hint" : bm[2]}`;
    const pot = /^pot(\d+)_(title|finding|potential|hint)$/.exec(name);
    if (pot) return `potentials.${Number(pot[1]) - 1}.${pot[2] === "hint" ? "image_hint" : pot[2]}`;
    return "";
  }

  /* ── Bühnen einhängen und einpassen ── */

  function fsBtnHtml() {
    const open = overlay.classList.contains("as-fs-open");
    return `<button type="button" class="as-fs-btn" data-act="toggle-fs" aria-label="${open ? "Vollbild beenden" : "Vollbild"}"><i class="fa-solid fa-${open ? "compress" : "expand"}"></i></button>`;
  }

  function mountStages(editable) {
    const area = shell.querySelector("[data-stagearea]");
    if (!area) return;
    area.setAttribute("data-readonly", editable ? "false" : "true");
    if (isMemo) {
      if (!state.memo) return;
      if (state.prevIndex >= MEMO_SEITEN) state.prevIndex = 0;
      area.innerHTML = `<div class="as-frame"><div class="as-pagehost"><div class="as-scaler">${markiereMemoSeiten(memoHtml(state.memo, editable))}</div>${fsBtnHtml()}</div></div>${blaetterNavHtml()}`;
    } else {
      if (!state.slides.length) return;
      if (state.prevIndex >= state.slides.length) state.prevIndex = 0;
      area.innerHTML = state.slides.map((slide, index) => `
        <div class="as-frame${index === state.prevIndex ? "" : " is-off"}" data-uid="${attr(slide.uid)}">
          ${editable ? slideTools(slide, index) : ""}
          <div class="as-pagehost"><div class="as-scaler">${slideHtml(slide, editable)}</div>${fsBtnHtml()}</div>
        </div>`).join("")
        + blaetterNavHtml();
    }
    if (editable) {
      area.querySelectorAll("[data-field]").forEach((node) => {
        const pfad = String(node.getAttribute("data-field") || "");
        if (/\.image_hint$/.test(pfad)) return;
        node.setAttribute("contenteditable", "true");
        node.setAttribute("spellcheck", "false");
      });
    } else {
      // In der Vorschau stoeren Bildknoepfe und Eingabefelder. Dort zaehlt nur
      // das Ergebnis; Bearbeiten ist der einzige schreibende Schritt.
      area.querySelectorAll("[data-as-chrome]").forEach((node) => node.remove());
      area.querySelectorAll("[contenteditable]").forEach((node) => {
        node.removeAttribute("contenteditable");
        node.removeAttribute("spellcheck");
      });
    }
    passeSlideTexteAn(area);
    fitStages();
    requestAnimationFrame(meldeUeberlauf);
  }

  function feldZeilenLimit(variant, pfad) {
    if (pfad === "title") return variant === "C" || variant === "D" ? 3 : 2;
    if (pfad === "subtitle") return variant === "B" || variant === "C" ? 3 : 2;
    if (pfad === "quote") return 4;
    if (pfad === "attribution" || pfad.endsWith(".value") || pfad === "stat_value") return 1;
    if (pfad === "myth" || pfad === "fact") return 3;
    if (pfad === "takeaway" || pfad === "stat_label") return 2;
    if (/^bullets\.\d+\./.test(pfad)) return 2;
    if (/^steps\.\d+\.title$/.test(pfad)) return 1;
    if (/^steps\.\d+\.text$/.test(pfad)) return 2;
    if (/^stats\.\d+\.label$/.test(pfad)) return 2;
    return 0;
  }

  /** Maximale Breite in SVG-Koordinaten. SVG-Text bricht nicht von selbst um;
   *  deshalb wird er innerhalb seines echten Kreises, Balkens oder Slots
   *  verkleinert statt benachbarte Beschriftungen zu überlagern. */
  function svgFeldBreite(variant, pfad) {
    if (variant === "S1") return pfad === "slot_center" ? 180 : 250;
    if (variant === "S2") return [150, 245, 355, 485][Number(/steps\.(\d+)/.exec(pfad)?.[1]) || 0];
    if (variant === "S3") {
      if (pfad === "slot_center") return 520;
      if (pfad === "slot_a" || pfad === "slot_b") return 480;
      return 150;
    }
    if (variant === "S4") return 128;
    if (variant === "T1") return pfad.endsWith(".value") ? 70 : 82;
    if (variant === "T2") return pfad.endsWith(".value") ? 130 : 145;
    if (variant === "T3") return pfad === "slot_center" ? 155 : 220;
    if (variant === "T4") return pfad.endsWith(".value") ? 100 : 260;
    if (variant === "T5") return 470;
    if (variant === "T6") {
      if (pfad.endsWith(".n")) return 120;
      if (pfad.endsWith(".title")) return 155;
      return 165;
    }
    return 0;
  }

  /** Ermittelt echte Textzeilen auch innerhalb der skalierten Vorschau.
   *  scrollHeight enthaelt bei grossen Schriften oft einige Pixel
   *  Glyphen-Ueberhang und machte zwei Zeilen dadurch faelschlich zu drei. */
  function textZeilenAnzahl(el) {
    if (!el || !String(el.textContent || "").trim()) return 0;
    const range = document.createRange();
    range.selectNodeContents(el);
    const tops = [];
    Array.from(range.getClientRects()).forEach((rect) => {
      if (!rect.width || !rect.height) return;
      if (!tops.some((top) => Math.abs(top - rect.top) < 1)) tops.push(rect.top);
    });
    return tops.length || 1;
  }

  /** Zahlen aus den sichtbaren SVG-Labels. Deutsche Dezimal- und
   * Tausenderschreibweise sowie Tsd./Mio./Mrd. werden vergleichbar. */
  function diagrammZahl(value) {
    const raw = String(value || "").replace(/\u00a0/g, " ");
    const hit = raw.match(/(?<!\d)[-+]?\s*(?:\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)(?!\d)/);
    if (!hit) return null;
    const number = Number(hit[0].replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", "."));
    if (!Number.isFinite(number)) return null;
    const lower = raw.toLowerCase();
    const factor = /mrd\.?|milliard/.test(lower) ? 1e9 : /mio\.?|million/.test(lower) ? 1e6 : /tsd\.?|tausend/.test(lower) ? 1e3 : 1;
    return number * factor;
  }

  /** Die Diagramm-Geometrie folgt den gelieferten Werten. Die ursprünglichen
   * SVGs waren auf die Beispielzahlen gezeichnet; andere Werte hätten sonst
   * korrekte Labels auf falschen Balken, Säulen oder Donutsegmenten gezeigt. */
  function passeDatenDiagrammeAn(wurzel) {
    const set = (node, attrs) => {
      if (!node) return;
      Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(Math.round(Number(value) * 100) / 100)));
    };
    const valueNodes = (stage) => [...stage.querySelectorAll('svg text[data-field$=".value"]')];
    wurzel?.querySelectorAll?.('.as-stage--tpl[data-variant]').forEach((stage) => {
      const variant = stage.getAttribute('data-variant');
      const svg = stage.querySelector('svg');
      if (!svg || !['T1', 'T2', 'T3', 'T4'].includes(variant)) return;
      const valueTexts = valueNodes(stage);
      const values = valueTexts.map((node) => diagrammZahl(node.textContent));
      if (variant === 'T1') {
        const bars = [...svg.querySelectorAll('rect[fill="#206efb"]')];
        const bubbles = [...svg.querySelectorAll('rect[fill="#ffffff"]')];
        const labels = [...svg.querySelectorAll('text[data-field$=".label"]')];
        const active = values.map((value, index) => ({ value, index })).filter((item) => item.value !== null && item.value >= 0);
        if (active.length < 3) return;
        const max = Math.max(...active.map((item) => item.value), 1);
        const step = 784 / active.length;
        const width = Math.min(72, step * .5);
        active.forEach((item, order) => {
          const center = 92 + step * (order + .5);
          const height = Math.max(18, 394 * item.value / max);
          const y = 446 - height;
          const bar = bars[item.index], bubble = bubbles[item.index], valueText = valueTexts[item.index], label = labels[item.index];
          if (bar) { bar.style.display = ''; set(bar, { x: center - width / 2, y, width, height }); }
          if (bubble) { bubble.style.display = ''; set(bubble, { x: center - 40.3, y: y - 37.2 }); }
          if (valueText) { valueText.style.display = ''; set(valueText, { x: center, y: y - 12 }); }
          if (label) { label.style.display = ''; set(label, { x: center }); }
        });
        values.forEach((value, index) => {
          if (value !== null) return;
          [bars[index], bubbles[index], valueTexts[index], labels[index]].forEach((node) => { if (node) node.style.display = 'none'; });
        });
        const trend = svg.querySelector('line[stroke-dasharray]');
        if (trend) {
          const first = active[0], last = active[active.length - 1];
          set(trend, {
            x1: 92 + step * .5,
            y1: 446 - Math.max(18, 394 * first.value / max),
            x2: 92 + step * (active.length - .5),
            y2: 446 - Math.max(18, 394 * last.value / max),
          });
        }
      }
      if (variant === 'T2' && values.length >= 3 && values.slice(0, 3).every((value) => value !== null)) {
        const [start, _delta, end] = values;
        const bars = [...svg.querySelectorAll('rect')];
        const connectors = [...svg.querySelectorAll('line[stroke-dasharray]')];
        const max = Math.max(Math.abs(start), Math.abs(end), 1);
        const yFor = (value) => 440 - Math.max(0, value) / max * 374;
        const startY = yFor(start), endY = yFor(end);
        set(bars[0], { y: startY, height: 440 - startY });
        set(bars[1], { y: Math.min(startY, endY), height: Math.max(4, Math.abs(endY - startY)) });
        set(bars[2], { y: endY, height: 440 - endY });
        set(connectors[0], { y1: startY, y2: startY }); set(connectors[1], { y1: endY, y2: endY });
        set(valueTexts[0], { y: Math.max(20, startY - 12) });
        set(valueTexts[1], { y: Math.max(20, Math.min(startY, endY) - 12) });
        set(valueTexts[2], { y: Math.max(20, endY - 12) });
      }
      if (variant === 'T3' && values.length >= 3 && values.slice(0, 3).every((value) => value !== null && value >= 0)) {
        const total = values.slice(0, 3).reduce((sum, value) => sum + value, 0);
        if (total <= 0) return;
        const polar = (radius, angle) => ({ x: 300 + radius * Math.cos(angle), y: 260 + radius * Math.sin(angle) });
        let start = -Math.PI / 2;
        [...svg.querySelectorAll('path')].slice(0, 3).forEach((path, index) => {
          const end = start + (values[index] / total) * Math.PI * 2;
          const a = polar(190, start), b = polar(190, end), c = polar(112, end), d = polar(112, start);
          const large = end - start > Math.PI ? 1 : 0;
          path.setAttribute('d', `M${a.x},${a.y} A190,190 0 ${large} 1 ${b.x},${b.y} L${c.x},${c.y} A112,112 0 ${large} 0 ${d.x},${d.y} Z`);
          start = end;
        });
      }
      if (variant === 'T4') {
        const bars = [...svg.querySelectorAll('rect')];
        const labels = [...svg.querySelectorAll('text[data-field$=".label"]')];
        const active = values.map((value, index) => ({ value, index })).filter((item) => item.value !== null && item.value >= 0);
        if (active.length < 4) return;
        const max = Math.max(...active.map((item) => item.value), 1);
        const row = 462 / active.length;
        active.forEach((item, order) => {
          const y = 14 + row * order + (row - 42) / 2;
          const width = Math.max(8, 500 * item.value / max);
          const bar = bars[item.index], valueText = valueTexts[item.index], label = labels[item.index];
          if (bar) { bar.style.display = ''; set(bar, { y, width }); }
          if (valueText) { valueText.style.display = ''; set(valueText, { x: 330 + width + 14, y: y + 30 }); }
          if (label) { label.style.display = ''; set(label, { y: y + 30 }); }
        });
        values.forEach((value, index) => {
          if (value !== null) return;
          [bars[index], valueTexts[index], labels[index]].forEach((node) => { if (node) node.style.display = 'none'; });
        });
      }
    });
  }

  /** Hält normale Textfelder in ihrer vorgesehenen Zeilenzahl und passt
   *  Beschriftungen innerhalb der festen SVG-Slots an. */
  function passeSlideTexteAn(wurzel) {
    if (isMemo || !wurzel) return;
    passeDatenDiagrammeAn(wurzel);
    wurzel.querySelectorAll(".as-stage--tpl").forEach((stage) => {
      const kachel = stage.querySelector(".li");
      const variant = stage.getAttribute("data-variant") || "B";
      if (!kachel) return;
      kachel.querySelectorAll("[data-field]").forEach((el) => {
        if (el.closest("svg")) return;
        if (!String(el.textContent || "").trim()) return;
        const limit = feldZeilenLimit(variant, String(el.getAttribute("data-field") || ""));
        if (!limit) return;
        if (!el.dataset.asFont) {
          const gemessen = parseFloat(getComputedStyle(el).fontSize) || 0;
          if (!gemessen) return;
          el.dataset.asFont = String(gemessen);
        }
        const start = Number(el.dataset.asFont) || 0;
        if (!start) return;
        el.style.fontSize = `${start}px`;
        el.style.overflowWrap = "normal";
        let px = start;
        let schritte = 0;
        const passtNicht = () => {
          const zeilen = textZeilenAnzahl(el);
          return el.scrollWidth > el.clientWidth + 1 || (limit && zeilen > limit) || kachel.scrollHeight > 1352;
        };
        while (passtNicht() && px > start * 0.7 && schritte < 30) {
          px -= start * 0.02;
          el.style.fontSize = `${px}px`;
          schritte += 1;
        }
        el.style.overflowWrap = "";
      });
      kachel.querySelectorAll("svg text[data-field]").forEach((el) => {
        const pfad = String(el.getAttribute("data-field") || "");
        const breite = svgFeldBreite(variant, pfad);
        if (!breite || !String(el.textContent || "").trim() || typeof el.getComputedTextLength !== "function") return;
        if (!el.dataset.asFont) el.dataset.asFont = String(parseFloat(getComputedStyle(el).fontSize) || 0);
        const start = Number(el.dataset.asFont) || 0;
        if (!start) return;
        el.style.fontSize = `${start}px`;
        let px = start;
        let schritte = 0;
        while (el.getComputedTextLength() > breite && px > start * .55 && schritte < 36) {
          px -= start * .025;
          el.style.fontSize = `${px}px`;
          schritte += 1;
        }
      });
    });
  }

  /**
   * KPI-Wert in der Bubble halten: Schrift so weit runter, bis „328,8 Mio. €“
   * in einer Zeile bleibt. Läuft auf einer Messkopie in echter A4-Größe, nicht
   * auf der skalierten Vorschau.
   */
  function passeMemoKpisAn(wurzel) {
    wurzel.querySelectorAll(".em-kpi .n").forEach((el) => {
      if (!String(el.textContent || "").trim()) return;
      el.style.fontSize = "";
      let px = parseFloat(getComputedStyle(el).fontSize) || 21;
      let schritte = 0;
      while (el.scrollWidth > el.clientWidth + 0.5 && px > 10 && schritte < 28) {
        px -= 0.5;
        el.style.fontSize = `${px}px`;
        schritte += 1;
      }
    });
  }

  function memoSeiteHatUeberlauf(seite) {
    if (seite.scrollHeight > seite.clientHeight + 2) return true;
    for (const el of seite.querySelectorAll(".em-kpi .n")) {
      if (String(el.textContent || "").trim() && el.scrollWidth > el.clientWidth + 1) return true;
    }
    const fuss = seite.querySelector(".em-foot-abs");
    if (!fuss) return false;
    const oben = fuss.getBoundingClientRect().top;
    for (const karte of seite.querySelectorAll(".em-pot")) {
      if (karte.getBoundingClientRect().bottom > oben + 2) return true;
    }
    return false;
  }

  function messMemoKopie() {
    const live = shell.querySelector("[data-stagearea] .as-stage--memo");
    if (!live) return null;
    const mess = live.cloneNode(true);
    mess.removeAttribute("data-uid");
    mess.setAttribute("data-memomess", "1");
    mess.querySelectorAll(".em-page.is-off").forEach((seite) => seite.classList.remove("is-off"));
    mess.querySelectorAll("[contenteditable]").forEach((node) => node.removeAttribute("contenteditable"));
    mess.style.cssText = "position:absolute;left:-99999px;top:0;width:210mm;height:auto;background:#fff;pointer-events:none;z-index:-1;";
    mess.querySelectorAll(".em-page").forEach((seite) => {
      seite.style.width = "210mm";
      seite.style.height = "297mm";
      seite.style.overflow = "hidden";
      seite.style.display = "flex";
    });
    document.body.appendChild(mess);
    return { live, mess };
  }

  /** Alle drei Seiten messen, auch die gerade nicht sichtbare. Schrift zurück ins Original. */
  function passeUndPruefeMemo() {
    const paket = messMemoKopie();
    if (!paket) return [];
    const { live, mess } = paket;
    passeMemoKpisAn(mess);
    const liveKpis = live.querySelectorAll(".em-kpi .n");
    mess.querySelectorAll(".em-kpi .n").forEach((el, i) => {
      if (liveKpis[i]) liveKpis[i].style.fontSize = el.style.fontSize;
    });
    const treffer = [];
    mess.querySelectorAll(".em-page").forEach((seite, i) => {
      if (memoSeiteHatUeberlauf(seite)) treffer.push(i + 1);
    });
    mess.remove();
    return treffer;
  }

  /**
   * Die Kachel ist 1080×1350. scrollWidth darüber heisst: Text oder Grafik
   * laufen aus dem Rahmen, wie beim Cucinelli-Titel. Vor dem Speichern ein Gate.
   * Memo: alle A4-Seiten, KPI-Umbruch und Karte auf dem Futter.
   */
  function kachelUeberlauf() {
    if (isMemo) return passeUndPruefeMemo();
    passeSlideTexteAn(shell.querySelector("[data-stagearea]"));
    const treffer = [];
    shell.querySelectorAll("[data-stagearea] .as-stage--tpl").forEach((stage, i) => {
      const kachel = stage.querySelector(".li");
      if (!kachel) return;
      const variant = stage.getAttribute("data-variant") || "B";
      const ausRahmen = kachel.scrollWidth > 1082 || kachel.scrollHeight > 1352;
      let ausFeld = false;
      const kachelBox = kachel.getBoundingClientRect();
      const fussBox = kachel.querySelector(".foot")?.getBoundingClientRect();
      kachel.querySelectorAll("[data-field]").forEach((el) => {
        if (!String(el.textContent || "").trim()) return;
        const pfad = String(el.getAttribute("data-field") || "");
        if (el.closest("svg")) {
          const breite = svgFeldBreite(variant, pfad);
          if (breite && typeof el.getComputedTextLength === "function" && el.getComputedTextLength() > breite + 1) ausFeld = true;
          return;
        }
        const box = el.getBoundingClientRect();
        const ausserhalb = box.left < kachelBox.left - 2 || box.right > kachelBox.right + 2
          || box.top < kachelBox.top - 2 || box.bottom > kachelBox.bottom + 2;
        const limit = feldZeilenLimit(variant, pfad);
        const zeilen = textZeilenAnzahl(el);
        const trifftFuss = Boolean(fussBox && !el.closest(".foot") && box.bottom > fussBox.top + 1 && box.top < fussBox.bottom - 1);
        if (ausserhalb || trifftFuss || el.scrollWidth > el.clientWidth + 4 || (limit && zeilen > limit)) ausFeld = true;
      });
      const logo = kachel.querySelector(".top .logo")?.getBoundingClientRect();
      const kicker = kachel.querySelector(".top .kick")?.getBoundingClientRect();
      const kopfKollidiert = Boolean(logo && kicker && logo.right > kicker.left && logo.bottom > kicker.top && logo.top < kicker.bottom);
      if (ausRahmen || ausFeld || kopfKollidiert) treffer.push(i + 1);
    });
    return treffer;
  }

  function meldeUeberlauf() {
    const treffer = kachelUeberlauf();
    if (!treffer.length) return;
    showSaveHint(isMemo
      ? `Seite ${treffer.join(", ")} läuft über den Rahmen. Text kürzen, bevor du speicherst.`
      : `Folie ${treffer.join(", ")} läuft über den Rahmen (1080 px). Text kürzen, bevor du speicherst.`);
  }

  function slideTools(slide, index) {
    const opts = VARIANTS_ALL.map(([value, label]) => `<option value="${attr(value)}"${slide.variant === value ? " selected" : ""}>${esc(label)}</option>`).join("");
    // Die Variante lässt sich immer wechseln, die Slide-Verwaltung nur im Carousel.
    const manage = isCarousel() ? `
      <button type="button" class="as-btn as-btn--icon" data-act="slide-up" title="Nach oben" aria-label="Nach oben"><i class="fa-solid fa-arrow-up"></i></button>
      <button type="button" class="as-btn as-btn--icon" data-act="slide-down" title="Nach unten" aria-label="Nach unten"><i class="fa-solid fa-arrow-down"></i></button>
      <button type="button" class="as-btn as-btn--icon" data-act="slide-copy" title="Duplizieren" aria-label="Duplizieren"><i class="fa-regular fa-copy"></i></button>
      <button type="button" class="as-btn as-btn--icon" data-act="slide-del" title="Löschen" aria-label="Löschen"><i class="fa-regular fa-trash-can"></i></button>
      <button type="button" class="as-btn as-btn--ghost" data-act="slide-add"><i class="fa-solid fa-plus"></i>Slide hinzufügen</button>` : "";
    return `<div class="as-slidetools" data-uid="${attr(slide.uid)}">
      <span class="as-num">Slide ${index + 1}</span>
      <select data-act="variant" aria-label="Variante">${opts}</select>
      ${manage}
    </div>`;
  }

  function isCarousel() {
    return !isMemo && (state.answers.asset_type === "carousel" || state.slides.length > 1);
  }

  // Die Bühne hat feste Maße; erst der Maßstab bringt sie in die Fläche.
  /** Innenmaß eines Hosts: clientWidth enthält Padding, das darf die Karte nicht füllen. */
  function hostInnenMass(el, minH = 40) {
    if (!el) return { breite: 1, hoehe: minH };
    const s = getComputedStyle(el);
    const padX = (parseFloat(s.paddingLeft) || 0) + (parseFloat(s.paddingRight) || 0);
    const padY = (parseFloat(s.paddingTop) || 0) + (parseFloat(s.paddingBottom) || 0);
    return {
      breite: Math.max(40, (el.clientWidth || 0) - padX),
      hoehe: Math.max(minH, (el.clientHeight || 0) - padY),
    };
  }

  /** Passt die grosse Vorschau in ihre Spalte ein. Gleiche Rechnung wie fitStages. */
  function fitPreview() {
    const box = shell.querySelector("[data-livepreview]");
    const host = box?.closest(".as-prev-host");
    const inner = box?.querySelector(".as-prev-scale");
    const stage = inner?.querySelector(".as-stage");
    if (!box) return;
    const flaeche = host || box;
    const { breite, hoehe } = hostInnenMass(flaeche, 240);
    // Ohne Buehne steht dort der Platzhalter. Er bekommt trotzdem das Mass der
    // Vorlage: sonst schrumpft die LinkedIn-Vorschau auf Inhaltsgroesse,
    // waehrend die Memo-Vorschau die Spalte fuellt.
    if (!inner || !stage) {
      const leerW = isMemo ? MEMO_SEITE_PX.w : 1080;
      const leerH = isMemo ? MEMO_SEITE_PX.h : 1350;
      const leerFaktor = Math.min(breite / leerW, hoehe / leerH);
      box.style.width = `${Math.round(leerW * leerFaktor)}px`;
      box.style.height = `${Math.round(leerH * leerFaktor)}px`;
      return;
    }
    zeigeAktiveMemoSeite(box);
    passeSlideTexteAn(box);
    legeMemoSeiteMass(stage);
    const w = stage.offsetWidth || (isMemo ? MEMO_SEITE_PX.w : 1080);
    const h = stage.offsetHeight || (isMemo ? MEMO_SEITE_PX.h : 1350);
    const faktor = Math.min(breite / w, hoehe / h);
    box.style.width = `${Math.round(w * faktor)}px`;
    box.style.height = `${Math.round(h * faktor)}px`;
    inner.style.transform = `scale(${faktor})`;
    inner.style.width = `${w}px`;
    inner.style.height = `${h}px`;
    // Eine Skalierung veraendert das Bild, nicht den Platz. Ohne diese
    // Ausgleichsraender rechnet die Zentrierung mit 1080px Breite, und die
    // Kachel schiebt sich rechts aus ihrem Kasten.
    inner.style.marginRight = `${-Math.round(w * (1 - faktor))}px`;
    inner.style.marginBottom = `${-Math.round(h * (1 - faktor))}px`;
  }

  function fitStages() {
    const area = shell.querySelector("[data-stagearea]");
    if (!area) return;
    zeigeAktiveFolie();
    const { breite: availW, hoehe: availH } = hostInnenMass(area, 0);
    const safeW = Math.max(240, availW);
    area.querySelectorAll(".as-scaler").forEach((scaler) => {
      const stage = scaler.querySelector(".as-stage");
      if (!stage) return;
      legeMemoSeiteMass(stage);
      const w = stage.offsetWidth || (isMemo ? MEMO_SEITE_PX.w : 1080);
      const h = stage.offsetHeight || (isMemo ? MEMO_SEITE_PX.h : 1350);
      const zoom = Math.max(1, Number(state.viewZoom) || 1);
      const base = availH > 80
        ? Math.min(1, safeW / w, availH / h)
        : Math.min(1, safeW / w);
      const scale = base * zoom;
      scaler.style.width = `${Math.round(w * scale)}px`;
      scaler.style.height = `${Math.round(h * scale)}px`;
      stage.style.transform = `scale(${scale})`;
      stage.style.setProperty("--as-inv", String(1 / scale));
    });
    area.classList.toggle("is-zoom", (Number(state.viewZoom) || 1) > 1.01);
  }

  /* ── Bearbeiteten Zustand aus dem DOM zurücklesen ── */

  function harvest() {
    const area = shell.querySelector("[data-stagearea]");
    if (!area) return;
    area.querySelectorAll("[data-stage]").forEach((stage) => {
      const model = modelByUid(stage.getAttribute("data-uid"));
      if (!model) return;
      stage.querySelectorAll("[data-field]").forEach((node) => {
        model.html[node.getAttribute("data-field")] = sanitizeFragment(node.innerHTML);
      });
      // Nur wenn die Variante gerade einen Bildplatz zeigt, darf das Bild aus
      // dem DOM gelesen werden. Sonst löscht ein Variantenwechsel das Motiv.
      stage.querySelectorAll("[data-imgslot]").forEach((slot) => {
        const key = slot.getAttribute("data-imgkey") || "image";
        const img = slot.querySelector("img");
        setImageAt(model, key, img
          ? { src: img.getAttribute("src") || "", pos: img.style.objectPosition || "50% 50%" }
          : { src: "", pos: imageAt(model, key).pos });
      });
    });
    const post = shell.querySelector("[data-post]");
    if (post) state.postText = post.value;
  }

  function modelByUid(id) {
    if (isMemo) return state.memo && state.memo.uid === id ? state.memo : null;
    return state.slides.find((slide) => slide.uid === id) || null;
  }

  /* ── Inspektor ── */

  function inspectorHtml() {
    const seg = (act, value, label, active) =>
      `<button type="button" class="as-seg" data-act="${attr(act)}" data-value="${attr(value)}" aria-pressed="${active ? "true" : "false"}">${esc(label)}</button>`;
    const post = isMemo ? "" : `
      <div class="as-group">
        <span>Caption</span>
        <textarea class="as-post" data-post aria-label="Caption">${esc(state.postText)}</textarea>
        <button type="button" class="as-btn" data-act="copy-post"><i class="fa-regular fa-copy"></i>Kopieren</button>
      </div>`;
    return `<aside class="as-inspector">
      ${post}
      <div class="as-group">
        <span>Ausgabe</span>
        <button type="button" class="as-btn" data-act="download"><i class="fa-solid fa-download"></i>HTML herunterladen</button>
        <button type="button" class="as-btn" data-act="print"><i class="fa-solid fa-print"></i>Drucken / PDF</button>
        <button type="button" class="as-btn as-btn--primary" data-act="save"><i class="fa-regular fa-floppy-disk"></i>Speichern</button>
        <p class="as-savehint" data-savehint></p>
      </div>
    </aside>`;
  }

  /* ── Formatierungsleiste: Ribbon für Maß, Floating für Zeichen ── */

  let fmtBar = null;
  let lastField = null;
  let lastFmtPos = { left: 0, top: 0 };

  function bindFmtHost(host) {
    host.addEventListener("mousedown", (event) => {
      if (event.target.closest("select")) return;
      event.preventDefault();
    });
    host.addEventListener("click", onFormat);
    host.addEventListener("change", onFormatChange);
  }

  function mountFormatBar() {
    const ribbon = shell.querySelector("[data-ribbon]");
    if (ribbon) {
      ribbon.innerHTML = `
      <select data-fmt="fontsize" aria-label="Schriftgröße">
        <option value="">Größe</option>
        <option value="12">12</option>
        <option value="14">14</option>
        <option value="16">16</option>
        <option value="18">18</option>
        <option value="22">22</option>
        <option value="28">28</option>
        <option value="36">36</option>
      </select>
      <button type="button" data-fmt="smaller" title="Kleiner" aria-label="Kleiner"><i class="fa-solid fa-minus"></i></button>
      <button type="button" data-fmt="larger" title="Größer" aria-label="Größer"><i class="fa-solid fa-plus"></i></button>
      <hr>
      <button type="button" data-fmt="left" title="Linksbündig" aria-label="Linksbündig"><i class="fa-solid fa-align-left"></i></button>
      <button type="button" data-fmt="center" title="Zentriert" aria-label="Zentriert"><i class="fa-solid fa-align-center"></i></button>
      <button type="button" data-fmt="right" title="Rechtsbündig" aria-label="Rechtsbündig"><i class="fa-solid fa-align-right"></i></button>
      <hr>
      <button type="button" data-fmt="color" data-color="#0f172a" title="Ink" aria-label="Ink"><span class="as-swatch" style="background:#0f172a"></span></button>
      <button type="button" data-fmt="color" data-color="#206efb" title="Brand" aria-label="Brand"><span class="as-swatch" style="background:#206efb"></span></button>
      <button type="button" data-fmt="color" data-color="#475569" title="Muted" aria-label="Muted"><span class="as-swatch" style="background:#475569"></span></button>
      <button type="button" data-fmt="color" data-color="#ffffff" title="Weiß" aria-label="Weiß"><span class="as-swatch" style="background:#ffffff"></span></button>
      <hr>
      <button type="button" data-fmt="list" title="Aufzählung" aria-label="Aufzählung"><i class="fa-solid fa-list-ul"></i></button>
      <hr>
      <button type="button" data-fmt="undo" title="Rückgängig" aria-label="Rückgängig"><i class="fa-solid fa-rotate-left"></i></button>
      <button type="button" data-fmt="redo" title="Wiederholen" aria-label="Wiederholen"><i class="fa-solid fa-rotate-right"></i></button>`;
      ribbon.setAttribute("data-open", "1");
      bindFmtHost(ribbon);
    }
    if (!fmtBar) {
      fmtBar = document.createElement("div");
      fmtBar.className = "as-fmt";
      fmtBar.innerHTML = `
      <button type="button" data-fmt="bold" title="Fett" aria-label="Fett"><i class="fa-solid fa-bold"></i></button>
      <button type="button" data-fmt="italic" title="Kursiv" aria-label="Kursiv"><i class="fa-solid fa-italic"></i></button>
      <button type="button" data-fmt="underline" title="Unterstrichen" aria-label="Unterstrichen"><i class="fa-solid fa-underline"></i></button>`;
      overlay.appendChild(fmtBar);
      bindFmtHost(fmtBar);
    }
  }

  function editableOf(node) {
    const el = node && node.nodeType === 1 ? node : node?.parentElement;
    return el ? el.closest("[data-field]") : null;
  }

  function currentField() {
    const sel = document.getSelection();
    if (sel && sel.rangeCount > 0) {
      const field = editableOf(sel.anchorNode);
      if (field) return field;
    }
    return lastField && lastField.isConnected ? lastField : null;
  }

  function updateFormatBar() {
    if (!fmtBar) return;
    if (state.step !== "edit" || !cropOverlay.hidden) {
      fmtBar.setAttribute("data-open", "0");
      return;
    }
    const field = currentField();
    if (!field || field.getAttribute("contenteditable") !== "true") {
      fmtBar.setAttribute("data-open", "0");
      return;
    }
    fmtBar.setAttribute("data-open", "1");
    const box = overlay.getBoundingClientRect();
    const rect = field.getBoundingClientRect();
    const barW = fmtBar.offsetWidth || 120;
    const barH = fmtBar.offsetHeight || 40;
    let left = rect.left - box.left + (rect.width - barW) / 2;
    let top = rect.top - box.top - barH - 8;
    if (top < 8) top = rect.bottom - box.top + 8;
    left = Math.max(8, Math.min(left, box.width - barW - 8));
    if (Math.abs(left - lastFmtPos.left) < 4 && Math.abs(top - lastFmtPos.top) < 4) return;
    lastFmtPos = { left, top };
    fmtBar.style.left = `${Math.round(left)}px`;
    fmtBar.style.top = `${Math.round(top)}px`;
  }

  function onFormat(event) {
    const btn = event.target.closest("[data-fmt]");
    if (!btn || btn.tagName === "SELECT") return;
    event.preventDefault();
    const cmd = btn.getAttribute("data-fmt");
    const target = currentField();
    if (!target) return;
    try { document.execCommand("styleWithCSS", false, true); } catch (_) { /* alte Browser kennen den Schalter nicht */ }
    if (cmd === "bold" || cmd === "italic" || cmd === "underline") document.execCommand(cmd);
    else if (cmd === "list") document.execCommand("insertUnorderedList");
    else if (cmd === "undo" || cmd === "redo") document.execCommand(cmd);
    else if (cmd === "color") document.execCommand("foreColor", false, btn.getAttribute("data-color"));
    else if (cmd === "left" || cmd === "center" || cmd === "right") target.style.textAlign = cmd;
    else if (cmd === "larger" || cmd === "smaller") {
      const size = Number.parseFloat(window.getComputedStyle(target).fontSize) || 16;
      const next = cmd === "larger" ? size * 1.08 : size / 1.08;
      target.style.fontSize = `${Math.round(Math.min(240, Math.max(8, next)) * 10) / 10}px`;
    }
  }

  function onFormatChange(event) {
    const sel = event.target.closest("select[data-fmt='fontsize']");
    if (!sel) return;
    const target = currentField();
    const px = Number(sel.value);
    if (!target || !px) return;
    target.style.fontSize = `${px}px`;
    sel.value = "";
  }

  function toggleFullscreen() {
    overlay.classList.toggle("as-fs-open");
    const open = overlay.classList.contains("as-fs-open");
    overlay.querySelectorAll(".as-fs-btn i").forEach((icon) => {
      icon.className = open ? "fa-solid fa-compress" : "fa-solid fa-expand";
    });
    overlay.querySelectorAll(".as-fs-btn").forEach((btn) => {
      btn.setAttribute("aria-label", open ? "Vollbild beenden" : "Vollbild");
    });
    fitPreview();
    fitStages();
  }

  /* ── Bilder ── */

  const cropState = {
    uid: "", key: "", img: null, panX: 0.5, panY: 0.5, zoom: 1, mode: "center",
    dragging: false, lastX: 0, lastY: 0,
  };

  function cropDropEl() { return cropOverlay.querySelector("[data-crop-drop]"); }
  function cropEditorEl() { return cropOverlay.querySelector("[data-crop-editor]"); }
  function cropOkEl() { return cropOverlay.querySelector("[data-crop-ok]"); }

  function setCropHint(key) {
    const spec = cropSpecFor(key);
    const hint = cropOverlay.querySelector("[data-crop-hint]");
    if (!hint) return spec;
    hint.textContent = spec.mm && spec.mm.w < 200
      ? `${spec.label}: ${spec.mm.w} × ${spec.mm.h} mm. Der Ausschnitt muss genau in diesen Platz.`
      : `${spec.label}: ${spec.w} × ${spec.h} Pixel. Der Ausschnitt muss genau in diesen Platz.`;
    return spec;
  }

  function setCropModeButtons(mode) {
    cropOverlay.querySelectorAll("[data-crop-mode]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.getAttribute("data-crop-mode") === mode);
    });
  }

  function applyCropMode(mode) {
    const name = String(mode || "center");
    cropState.mode = name;
    setCropModeButtons(name);
    if (!cropState.img) return;
    const spec = cropSpecFor(cropState.key);
    if (name === "top") {
      cropState.panX = 0.5;
      cropState.panY = 0;
    } else if (name === "bottom") {
      cropState.panX = 0.5;
      cropState.panY = 1;
    } else if (name === "smart") {
      const pan = smartCropPan(cropState.img, spec.w, spec.h);
      cropState.panX = pan.panX;
      cropState.panY = pan.panY;
    } else {
      cropState.panX = 0.5;
      cropState.panY = 0.5;
    }
    if (name === "fill") cropState.zoom = 1;
    const zoom = cropOverlay.querySelector("[data-crop-zoom]");
    if (zoom && name === "fill") zoom.value = "100";
    layoutCropPreview();
  }

  function showCropEditor(on) {
    const drop = cropDropEl();
    const editor = cropEditorEl();
    const ok = cropOkEl();
    if (drop) drop.hidden = Boolean(on);
    if (editor) editor.hidden = !on;
    if (ok) ok.disabled = !on;
  }

  function openCropSheet(uid, key) {
    cropState.uid = uid;
    cropState.key = key || "image";
    cropState.img = null;
    cropState.panX = 0.5;
    cropState.panY = 0.5;
    cropState.zoom = 1;
    cropState.mode = "center";
    state.pendingImage = `${uid}::${cropState.key}`;
    const spec = setCropHint(cropState.key);
    const frame = cropFrameEl();
    if (frame) frame.style.aspectRatio = `${spec.w} / ${spec.h}`;
    setCropModeButtons("center");
    showCropEditor(false);
    cropOverlay.hidden = false;
    if (fmtBar) fmtBar.setAttribute("data-open", "0");
  }

  function loadHtmlImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Die Bilddatei konnte nicht gelesen werden."));
      img.src = src;
    });
  }

  function isSvgDataUri(src) {
    return /^data:image\/svg\+xml/i.test(String(src || ""));
  }

  function coverCrop(img, outW, outH, panX = 0.5, panY = 0.5, zoom = 1, opts = {}) {
    const target = outW / outH;
    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;
    if (!imgW || !imgH) return "";
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    // JPEG kennt kein Alpha. Ohne weisse Fläche werden transparente SVG/PNG-Logos
    // (Puma, Burberry) zu einem schwarzen Rechteck.
    ctx.fillStyle = opts.fill || "#fff";
    ctx.fillRect(0, 0, outW, outH);
    if (opts.fit === "contain") {
      const scale = Math.min(outW / imgW, outH / imgH);
      const dw = imgW * scale;
      const dh = imgH * scale;
      ctx.drawImage(img, 0, 0, imgW, imgH, (outW - dw) / 2, (outH - dh) / 2, dw, dh);
      try { return canvas.toDataURL("image/png"); } catch (_) { return ""; }
    }
    const z = Math.max(1, Number(zoom) || 1);
    let cropW;
    let cropH;
    if (imgW / imgH > target) {
      cropH = imgH / z;
      cropW = cropH * target;
    } else {
      cropW = imgW / z;
      cropH = cropW / target;
    }
    cropW = Math.min(cropW, imgW);
    cropH = Math.min(cropH, imgH);
    const x = Math.max(0, (imgW - cropW) * panX);
    const y = Math.max(0, (imgH - cropH) * panY);
    ctx.drawImage(img, x, y, cropW, cropH, 0, 0, outW, outH);
    try { return canvas.toDataURL("image/jpeg", 0.62); } catch (_) { return ""; }
  }

  async function fitSlotImage(src, spec, opts = {}) {
    if (!src) return "";
    if (isSvgDataUri(src)) return src;
    try {
      const img = await loadHtmlImage(src);
      return coverCrop(img, spec.w, spec.h, 0.5, 0.5, 1, opts) || src;
    } catch (_) {
      return src;
    }
  }

  async function compactAdoptedImages() {
    if (isMemo && state.memo) {
      // Ein Logo darf nicht angeschnitten werden, also contain auf Weiss. Ein
      // Potenzial-Foto muss die Kachel füllen: contain hat weisse Ränder in das
      // Bild gebrannt, die Rundung der Kachel war damit unsichtbar (16.8.2026).
      for (const [liste, kind] of [[state.memo.benchmarks, "benchmark"], [state.memo.potentials, "potential"]]) {
        const spec = MEMO_SHOT_PIXELS[kind];
        const opts = kind === "benchmark" ? { fit: "contain" } : {};
        for (const eintrag of liste) {
          if (eintrag?.image?.src) {
            eintrag.image.src = await fitSlotImage(eintrag.image.src, spec, opts);
            eintrag.image.pos = "50% 50%";
          }
        }
      }
      return;
    }
    for (const slide of state.slides) {
      if (slide.image?.src) {
        slide.image.src = await fitSlotImage(slide.image.src, LINKEDIN_SHOT_PIXELS);
        slide.image.pos = "50% 50%";
      }
    }
  }

  function cropFrameEl() { return cropOverlay.querySelector("[data-crop-frame]"); }
  function cropImgEl() { return cropOverlay.querySelector("[data-crop-img]"); }

  function layoutCropPreview() {
    const frame = cropFrameEl();
    const el = cropImgEl();
    const img = cropState.img;
    if (!frame || !el || !img) return;
    const fw = frame.clientWidth || 1;
    const fh = frame.clientHeight || 1;
    const cover = Math.max(fw / img.naturalWidth, fh / img.naturalHeight) * cropState.zoom;
    const dw = img.naturalWidth * cover;
    const dh = img.naturalHeight * cover;
    const maxX = Math.max(0, dw - fw);
    const maxY = Math.max(0, dh - fh);
    const x = (0.5 - cropState.panX) * maxX;
    const y = (0.5 - cropState.panY) * maxY;
    el.style.width = `${dw}px`;
    el.style.height = `${dh}px`;
    el.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  }

  function openCropper(file, uid, key) {
    if (uid) cropState.uid = uid;
    if (key) cropState.key = key;
    state.pendingImage = `${cropState.uid}::${cropState.key}`;
    const spec = setCropHint(cropState.key);
    const reader = new FileReader();
    reader.onerror = () => showSaveHint("Die Bilddatei konnte nicht gelesen werden.");
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => showSaveHint("Die Bilddatei konnte nicht gelesen werden.");
      img.onload = () => {
        cropState.img = img;
        cropState.panX = 0.5;
        cropState.panY = 0.5;
        cropState.zoom = 1;
        cropState.mode = "center";
        const frame = cropFrameEl();
        if (frame) frame.style.aspectRatio = `${spec.w} / ${spec.h}`;
        const zoom = cropOverlay.querySelector("[data-crop-zoom]");
        if (zoom) zoom.value = "100";
        const el = cropImgEl();
        if (el) el.src = img.src;
        setCropModeButtons("center");
        showCropEditor(true);
        cropOverlay.hidden = false;
        requestAnimationFrame(layoutCropPreview);
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  }

  function confirmCrop() {
    if (!cropState.img || !cropState.uid) {
      cropOverlay.hidden = true;
      return;
    }
    const spec = cropSpecFor(cropState.key);
    const src = coverCrop(cropState.img, spec.w, spec.h, cropState.panX, cropState.panY, cropState.zoom);
    cropOverlay.hidden = true;
    if (!src) {
      showSaveHint("Der Ausschnitt konnte nicht erzeugt werden.");
      return;
    }
    if (cropState.uid === "form") {
      state.formImages[cropState.key] = { src, pos: "50% 50%" };
      if (state.memo) setImageAt(state.memo, cropState.key, state.formImages[cropState.key]);
      if (state.step === "form") zeichneForm();
      else mountStages(state.step === "edit");
      return;
    }
    harvest();
    const model = modelByUid(cropState.uid);
    setImageAt(model, cropState.key, { src, pos: "50% 50%" });
    mountStages(state.step === "edit");
  }

  async function cancelGenerate() {
    state.cancelRequested = true;
    state.leftRunning = false;
    const id = state.assetId;
    state.busy = false;
    ladeTaktStop();
    state.step = "form";
    state.error = "";
    render();
    if (id) {
      try { await api("cancel_asset", { asset_id: id }); } catch { /* der Auftrag endet serverseitig */ }
    }
    if (state.formTab === "drafts") draftsTaktStart();
  }

  function pickFormImage(key) {
    openCropSheet("form", key || "image");
  }

  function pickImage(stageEl, key) {
    const uid = stageEl?.getAttribute("data-uid") || "";
    if (!uid) return;
    openCropSheet(uid, key || "image");
  }

  function browseCropFile() {
    if (!cropState.uid) return;
    state.pendingImage = `${cropState.uid}::${cropState.key || "image"}`;
    fileInput.value = "";
    fileInput.click();
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    const pending = String(state.pendingImage || `${cropState.uid}::${cropState.key}`);
    const [targetUid, imgKey = "image"] = pending.split("::");
    if (!file || !targetUid) return;
    openCropper(file, targetUid, imgKey);
  });

  cropOverlay.addEventListener("pointerdown", (event) => {
    if (!event.target.closest("[data-crop-frame]")) return;
    cropState.dragging = true;
    cropState.lastX = event.clientX;
    cropState.lastY = event.clientY;
    event.target.setPointerCapture?.(event.pointerId);
  });
  cropOverlay.addEventListener("pointermove", (event) => {
    if (!cropState.dragging || !cropState.img) return;
    const frame = cropFrameEl();
    if (!frame) return;
    const dx = event.clientX - cropState.lastX;
    const dy = event.clientY - cropState.lastY;
    cropState.lastX = event.clientX;
    cropState.lastY = event.clientY;
    const fw = frame.clientWidth || 1;
    const fh = frame.clientHeight || 1;
    const cover = Math.max(fw / cropState.img.naturalWidth, fh / cropState.img.naturalHeight) * cropState.zoom;
    const maxX = Math.max(1, cropState.img.naturalWidth * cover - fw);
    const maxY = Math.max(1, cropState.img.naturalHeight * cover - fh);
    cropState.panX = Math.min(1, Math.max(0, cropState.panX - dx / maxX));
    cropState.panY = Math.min(1, Math.max(0, cropState.panY - dy / maxY));
    layoutCropPreview();
  });
  cropOverlay.addEventListener("pointerup", () => { cropState.dragging = false; });
  cropOverlay.addEventListener("pointercancel", () => { cropState.dragging = false; });
  cropOverlay.addEventListener("input", (event) => {
    if (event.target?.getAttribute("data-crop-zoom") == null) return;
    cropState.zoom = Math.max(1, Number(event.target.value || 100) / 100);
    layoutCropPreview();
  });
  cropOverlay.addEventListener("dragover", (event) => {
    event.preventDefault();
    cropDropEl()?.classList.add("is-over");
  });
  cropOverlay.addEventListener("dragleave", (event) => {
    if (event.target === cropDropEl() || event.target === cropOverlay) {
      cropDropEl()?.classList.remove("is-over");
    }
  });
  cropOverlay.addEventListener("drop", (event) => {
    event.preventDefault();
    cropDropEl()?.classList.remove("is-over");
    const file = [...(event.dataTransfer?.files || [])].find((item) => /^image\//.test(item.type));
    if (!file || !cropState.uid) return;
    openCropper(file, cropState.uid, cropState.key);
  });

  /* ── Ausgabe ── */

  function printCss(memoKind) {
    const page = memoKind ? "size:A4; margin:0;" : "size:1080px 1350px; margin:0;";
    const bruch = memoKind
      ? `#as-overlay .as-stage--memo{height:891mm !important; background:#eef2f7 !important; break-after:auto; page-break-after:auto;}
  #as-overlay .as-stage--memo .em-page{display:flex !important; break-after:page; page-break-after:always;}
  #as-overlay .as-stage--memo .em-page:last-child{break-after:auto; page-break-after:auto;}`
      : `#as-overlay .as-stage{break-after:page; page-break-after:always;}
  #as-overlay .as-stagearea > .as-frame:last-of-type .as-stage{break-after:auto; page-break-after:auto;}`;
    return `
@page{${page}}
@media print{
  body > *:not(#as-overlay){display:none !important;}
  #as-overlay{position:static !important; display:block !important; background:#fff !important; overflow:visible !important;}
  #as-overlay .as-rail, #as-overlay .as-topbar, #as-overlay .as-inspector,
  #as-overlay .as-slidetools, #as-overlay .as-fmt, #as-overlay .as-ribbon, #as-overlay .as-fs-btn, #as-overlay .as-fs-exit, #as-overlay .as-prev-nav, #as-overlay [data-as-chrome]{display:none !important;}
  #as-overlay .as-main, #as-overlay .as-content{overflow:visible !important; padding:0 !important; border:0 !important;}
  #as-overlay .as-work{display:block !important;}
  #as-overlay .as-stagearea{overflow:visible !important; height:auto !important;}
  #as-overlay .as-frame.is-off{display:flex !important;}
  #as-overlay .as-scaler{width:auto !important; height:auto !important; box-shadow:none !important; overflow:visible !important; border-radius:0 !important;}
  #as-overlay .as-scaler > .as-stage{position:static !important; transform:none !important;}
  ${bruch}
}`;
  }

  // Der Download liest den bearbeiteten Zustand aus dem DOM, nicht aus dem Modell.
  function exportStages() {
    const area = shell.querySelector("[data-stagearea]");
    if (!area) return [];
    return [...area.querySelectorAll("[data-stage]")].map((stage) => {
      const clone = stage.cloneNode(true);
      clone.removeAttribute("style");
      clone.removeAttribute("data-stage");
      clone.querySelectorAll("[data-as-chrome]").forEach((node) => node.remove());
      clone.querySelectorAll("[contenteditable]").forEach((node) => {
        node.removeAttribute("contenteditable");
        node.removeAttribute("spellcheck");
      });
      clone.querySelectorAll("[data-ph]").forEach((node) => node.removeAttribute("data-ph"));
      // Die gemessene Ausgangsgröße ist Werkzeug, nicht Inhalt. Die daraus
      // errechnete Schriftgröße bleibt als style am Element.
      clone.querySelectorAll("[data-as-font]").forEach((node) => node.removeAttribute("data-as-font"));
      clone.querySelectorAll(".em-page.is-off").forEach((node) => node.classList.remove("is-off"));
      if (clone.classList.contains("as-stage--memo")) clone.style.height = "891mm";
      return clone.outerHTML;
    });
  }

  function exportDocument() {
    const stages = exportStages().join("\n");
    const title = isMemo ? "Ansprache" : "LinkedIn-Asset";
    const post = !isMemo && state.postText.trim()
      ? `\n<!-- Caption\n${state.postText.replace(/--+>/g, "-->")}\n-->`
      : "";
    const css = isMemo
      ? `${MEMO_TEMPLATE_CSS}\n${STAGE_CSS}`
      : `${ASSET_TEMPLATE_CSS}\n${ASSET_LAYOUT_CSS}\n${STAGE_CSS}`;
    const printBreak = isMemo
      ? `.as-stage--memo{break-after:auto; page-break-after:auto;} .as-stage--memo .em-page{break-after:page; page-break-after:always;} .as-stage--memo .em-page:last-child{break-after:auto; page-break-after:auto;}`
      : `.as-stage{break-after:page; page-break-after:always;} .as-stage:last-of-type{break-after:auto; page-break-after:auto;}`;
    return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<style>
html,body{margin:0;padding:0;}
body{background:#eef2f7; padding:24px;}
#as-overlay{display:flex; flex-direction:column; align-items:center; gap:24px;}
@media print{body{background:#fff; padding:0;} #as-overlay{gap:0;}}
@page{${isMemo ? "size:A4; margin:0;" : "size:1080px 1350px; margin:0;"}}
@media print{${printBreak}}
${css}
</style>
</head>
<body>
<main id="as-overlay">
${stages}${post}
</main>
</body>
</html>`;
  }

  function download() {
    harvest();
    const doc = exportDocument();
    const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `${isMemo ? "executive-memo" : "linkedin-asset"}-${stamp}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function showSaveHint(text) {
    const hint = shell.querySelector("[data-savehint]");
    if (hint) hint.textContent = text;
  }

  async function save() {
    harvest();
    if (!state.assetId) {
      showSaveHint("Kein gespeicherter Entwurf vorhanden. Bitte den Entwurf neu erzeugen.");
      return;
    }
    const ueber = kachelUeberlauf();
    if (ueber.length) {
      showSaveHint(isMemo
        ? `Seite ${ueber.join(", ")} läuft über den Rahmen. Text kürzen, dann speichern.`
        : `Folie ${ueber.join(", ")} läuft über den Rahmen (1080 px). Text kürzen, dann speichern.`);
      return;
    }
    const doc = exportDocument();
    if (doc.length > SAVE_LIMIT) {
      showSaveHint(`Der Entwurf ist mit ${doc.length.toLocaleString("de-DE")} Zeichen zu groß. Grenze: ${SAVE_LIMIT.toLocaleString("de-DE")} Zeichen. Bitte Bilder entfernen oder verkleinern.`);
      return;
    }
    const button = shell.querySelector('[data-act="save"]');
    if (button) button.disabled = true;
    showSaveHint("Wird gespeichert.");
    try {
      await api("save_asset", { asset_id: state.assetId, edited_html: doc });
      showSaveHint(`Gespeichert um ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr.`);
    } catch (err) {
      showSaveHint(err && err.message ? String(err.message) : "Speichern fehlgeschlagen.");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function copyPost() {
    const box = shell.querySelector("[data-post]");
    if (!box) return;
    state.postText = box.value;
    try {
      await navigator.clipboard.writeText(box.value);
    } catch (_) {
      // Ohne Zwischenablage-Recht bleibt der alte Weg über die Auswahl.
      box.focus();
      box.select();
      try { document.execCommand("copy"); } catch (__) { /* dann bleibt nur das Markieren */ }
    }
  }

  /* ── Slides umbauen ── */

  function addSlide(after = state.slides.length - 1) {
    harvest();
    const fresh = normalizeSlide({
      variant: state.stage.theme === "dark" ? "A" : "B",
      footer_left: state.slides[0]?.footerLeft || state.chrome.footer_left || (state.chrome.custom ? "" : "ROOTS Consultants"),
    });
    state.slides.splice(after + 1, 0, fresh);
    state.prevIndex = after + 1;
    mountStages(true);
  }

  function duplicateSlide(id) {
    harvest();
    const index = state.slides.findIndex((slide) => slide.uid === id);
    if (index < 0) return;
    const copy = JSON.parse(JSON.stringify(state.slides[index]));
    copy.uid = uid();
    state.slides.splice(index + 1, 0, copy);
    state.prevIndex = index + 1;
    mountStages(true);
  }

  function removeSlide(id) {
    harvest();
    if (state.slides.length <= 1) return;
    state.slides = state.slides.filter((slide) => slide.uid !== id);
    mountStages(true);
  }

  function moveSlide(id, delta) {
    harvest();
    const index = state.slides.findIndex((slide) => slide.uid === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= state.slides.length) return;
    const [moved] = state.slides.splice(index, 1);
    state.slides.splice(target, 0, moved);
    mountStages(true);
  }

  function setVariant(id, variant) {
    harvest();
    const slide = state.slides.find((item) => item.uid === id);
    if (!slide || !VARIANT_KEYS.includes(variant)) return;
    slide.variant = variant;
    mountStages(true);
  }

  /* ── Ereignisse ── */

  function onClick(event) {
    const stageEl = event.target.closest("[data-stage]");
    const modeBtn = event.target.closest("[data-crop-mode]");
    if (modeBtn) {
      applyCropMode(modeBtn.getAttribute("data-crop-mode"));
      return;
    }
    const hit = event.target.closest("[data-act]");
    if (!hit) return;
    const act = hit.getAttribute("data-act");
    const frame = hit.closest("[data-uid]");
    const id = frame ? frame.getAttribute("data-uid") : null;

    if (act === "close") {
      if (state.busy) { close(); return; }
      if (state.step !== "form") {
        state.step = "form";
        state.formTab = "form";
        state.error = "";
        render();
        return;
      }
      if (state.formTab === "drafts") {
        state.formTab = "form";
        render();
        draftsTaktStop();
        return;
      }
      close();
      return;
    }
    if (act === "generate") { void generate(); return; }
    if (act === "close-popup") {
      close();
      return;
    }
    if (act === "toggle-fs") { toggleFullscreen(); return; }
    if (act === "leave-generate") { close(); return; }
    if (act === "cancel-generate") { void cancelGenerate(); return; }
    if (act === "to-form") {
      if (state.busy) {
        state.leftRunning = true;
        state.cancelRequested = true;
        ladeTaktStop();
      }
      state.busy = false;
      state.step = "form";
      state.formTab = "form";
      state.error = "";
      render();
      draftsTaktStop();
      return;
    }
    if (act === "show-drafts") {
      if (state.busy) {
        state.leftRunning = true;
        state.cancelRequested = true;
        ladeTaktStop();
      }
      state.busy = false;
      state.step = "form";
      state.formTab = "drafts";
      state.error = "";
      render();
      draftsTaktStart();
      return;
    }
    if (act === "open-draft") {
      const id = hit.getAttribute("data-id");
      if (id) void openDraft(id);
      return;
    }
    if (act === "form-img-pick") {
      pickFormImage(hit.getAttribute("data-imgkey") || "image");
      return;
    }
    if (act === "to-draft") { harvest(); state.step = "draft"; render(); return; }
    if (act === "to-edit") { state.step = "edit"; render(); return; }
    if (act === "slide-add") { addSlide(); return; }
    if (act === "slide-copy") { duplicateSlide(id); return; }
    if (act === "slide-del") { removeSlide(id); return; }
    if (act === "slide-up") { moveSlide(id, -1); return; }
    if (act === "slide-down") { moveSlide(id, 1); return; }
    if (act === "step-open") {
      readForm();
      setzeSchritt(hit.getAttribute("data-key") || "");
      zeichneForm();
      return;
    }
    if (act === "step-next") {
      readForm();
      const fragen = aktiveFragen();
      const offen = fragen[schrittIndex(fragen)];
      if (offen && !frageErledigt(offen)) return;
      setzeSchritt(naechsterSchritt());
      zeichneForm();
      return;
    }
    if (act === "step-back") {
      readForm();
      setzeSchritt(vorherigerSchritt());
      zeichneForm();
      return;
    }
    if (act === "pick-design") {
      state.answers.design = hit.getAttribute("data-value") || "";
      synchronisiereDesign();
      zeichneForm();
      return;
    }
    if (act === "open-tone") { oeffneEinstellungen("tone"); return; }
    if (act === "open-designs") { oeffneEinstellungen("design"); return; }
    if (act === "toggle-layout") { state.ddOffen = !state.ddOffen; zeichneForm(); return; }
    if (act === "toggle-frame") { state.ddOffen = !state.ddOffen; zeichneForm(); return; }
    if (act === "toggle-arten") { state.multiOffen = !state.multiOffen; zeichneForm(); return; }
    if (act === "prev-back" || act === "prev-fwd") {
      const anzahl = blaetterAnzahl();
      const richtung = act === "prev-fwd" ? 1 : -1;
      state.prevIndex = (state.prevIndex + richtung + anzahl) % anzahl;
      const box = shell.querySelector("[data-livepreview]");
      if (box) {
        box.innerHTML = livePreviewHtml();
        fitPreview();
        return;
      }
      zeigeAktiveFolie();
      aktualisiereBlaetterLabel();
      fitStages();
      return;
    }
    if (act === "frame-pick") {
      const wert = hit.getAttribute("data-value");
      const rolle = SLIDE_ROLE[wert];
      if (!wert || !rolle || LOOK[wert] !== state.answers.look) return;
      const cover = rolle === "cover" ? wert : state.answers.slide_cover;
      const ende = rolle === "end" ? wert : state.answers.slide_end;
      setzeManuelleFolien(cover, inhaltsArten(), ende);
      state.prevIndex = rolle === "cover" ? 0 : Math.max(0, gewaehlteArten().length - 1);
      state.ddOffen = false;
      const fragen = aktiveFragen();
      const offen = fragen[schrittIndex(fragen)];
      if (offen?.art === "frame" && frageErledigt(offen)) setzeSchritt(naechsterSchritt());
      zeichneForm();
      return;
    }
    if (act === "content-add") {
      const wert = hit.getAttribute("data-value");
      const inhalte = inhaltsArten();
      if (!wert || SLIDE_ROLE[wert] || LOOK[wert] !== state.answers.look || inhalte.length >= LINKEDIN_DOCUMENT_PAGE_MAX - 2) return;
      inhalte.push(wert);
      setzeManuelleFolien(state.answers.slide_cover, inhalte, state.answers.slide_end);
      state.prevIndex = inhalte.length;
      zeichneForm();
      return;
    }
    if (act === "content-remove" || act === "content-up" || act === "content-down") {
      const liste = inhaltsArten();
      const index = Number(hit.getAttribute("data-index"));
      if (!Number.isInteger(index) || index < 0 || index >= liste.length) return;
      if (act === "content-remove") liste.splice(index, 1);
      else {
        const delta = act === "content-up" ? -1 : 1;
        const ziel = index + delta;
        if (ziel < 0 || ziel >= liste.length) return;
        [liste[index], liste[ziel]] = [liste[ziel], liste[index]];
        state.prevIndex = ziel + 1;
      }
      setzeManuelleFolien(state.answers.slide_cover, liste, state.answers.slide_end);
      if (state.prevIndex >= gewaehlteArten().length) state.prevIndex = Math.max(0, gewaehlteArten().length - 1);
      zeichneForm();
      return;
    }
    if (act === "pick-layout") {
      state.answers.variant = hit.getAttribute("data-value");
      state.ddOffen = false;
      // Ein Layout beantwortet die Frage genauso wie eine Auswahl per Klick.
      if (state.stepKey === "variant") setzeSchritt(naechsterSchritt());
      zeichneForm();
      return;
    }
    if (act === "download") { download(); return; }
    if (act === "print") { harvest(); window.print(); return; }
    if (act === "save") { save(); return; }
    if (act === "copy-post") { copyPost(); return; }
    if (act === "crop-cancel") {
      cropOverlay.hidden = true;
      showCropEditor(false);
      return;
    }
    if (act === "crop-ok") { confirmCrop(); return; }
    if (act === "crop-browse") { browseCropFile(); return; }
    if (act === "bench-example") {
      BENCH_EXAMPLE.forEach((item, i) => {
        state.answers[`bench_${i}_name`] = item.name;
        state.answers[`bench_${i}_text`] = item.text;
        state.answers[`bench_${i}_tag`] = item.tag;
      });
      state.answers.benchmarks = "custom";
      state.formError = "Das ist nur die Form. Bitte Name, Handlung und Lehre durch Benchmarks zu diesem Signal ersetzen.";
      zeichneForm();
      return;
    }
    if (act === "img-pick" && stageEl) {
      pickImage(stageEl, hit.getAttribute("data-imgkey") || "image");
      return;
    }
    if (act === "img-clear" && stageEl) {
      harvest();
      const model = modelByUid(stageEl.getAttribute("data-uid"));
      setImageAt(model, hit.getAttribute("data-imgkey") || "image", { src: "", pos: "50% 50%" });
      mountStages(state.step === "edit");
      return;
    }
  }

  function onChange(event) {
    const hit = event.target.closest("[data-act]");
    if (hit && hit.getAttribute("data-act") === "variant") {
      const frame = hit.closest("[data-uid]");
      setVariant(frame ? frame.getAttribute("data-uid") : null, hit.value);
      return;
    }
    // Der Fragebogen blendet Freitextfelder erst bei passender Wahl ein und
    // zeichnet die Vorschau neu, damit die Wahl sofort zu sehen ist.
    if (state.step === "form" && event.target.matches('input[type="radio"]')) {
      readForm();
      const fragen = aktiveFragen();
      const offen = fragen[schrittIndex(fragen)];
      // Profilwechsel zieht die Vorlagenliste nach, sonst bliebe ein
      // ROOTS-Design im Privatprofil stehen.
      if (event.target.name === "as-profile") synchronisiereDesign();
      // Eine reine Auswahl beantwortet die Frage. Steht kein Freitext und keine
      // Mehrfachauswahl aus, ruecken wir von selbst eine Frage weiter.
      if (offen && event.target.name === `as-${offen.key}` && springtWeiter(offen)) {
        setzeSchritt(naechsterSchritt());
      }
      zeichneForm();
    }
  }

  function onInput(event) {
    if (state.step !== "form") return;
    const free = event.target.closest?.("[data-free]");
    if (!free) return;
    // Nur die Vorschau, nicht das Formular: sonst verliert das Feld den Fokus.
    readForm();
    const fragen = aktiveFragen();
    const offen = fragen[schrittIndex(fragen)];
    const weiter = shell.querySelector('[data-act="step-next"]');
    if (weiter && offen) weiter.disabled = !frageErledigt(offen);
    if (free.getAttribute("data-free") === "slide_count_text") {
      const host = shell.querySelector("[data-carousel-guidance-host]");
      if (host) host.innerHTML = carouselEmpfehlungHtml(carouselRequestedSlides(state.answers));
    }
    if (free.getAttribute("data-free") === "company_text") {
      const node = shell.querySelector('[data-livepreview] [data-field="title"]');
      if (node) node.textContent = previewMemoTitle(state.answers, company);
    }
    if (free.getAttribute("data-free") === "caption_text") zeichneCaption();
    aktualisiereSchreibhilfe(free.getAttribute("data-free"));
  }

  function onKeyDown(event) {
    if (event.key !== "Escape") return;
    // Ohne Stopp würde der Backdrop-Zweig der App das Artikel-Popup mitschließen.
    event.stopPropagation();
    event.preventDefault();
    if (!cropOverlay.hidden) {
      cropOverlay.hidden = true;
      return;
    }
    if (overlay.classList.contains("as-fs-open")) {
      toggleFullscreen();
      return;
    }
    close();
  }

  let selectionFrame = 0;
  function onSelectionChange() {
    if (selectionFrame) return;
    selectionFrame = window.requestAnimationFrame(() => {
      selectionFrame = 0;
      updateFormatBar();
    });
  }

  function onDocMouseDown(event) {
    if (!fmtBar) return;
    if (fmtBar.contains(event.target)) return;
    if (event.target.closest?.("[data-ribbon]")) return;
    if (!editableOf(event.target)) fmtBar.setAttribute("data-open", "0");
  }

  function onStageWheel(event) {
    if (state.step !== "edit" && state.step !== "draft") return;
    if (!(event.ctrlKey || event.metaKey)) return;
    if (!event.target.closest?.("[data-stagearea]")) return;
    if (!cropOverlay.hidden) return;
    event.preventDefault();
    const faktor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
    state.viewZoom = Math.round(Math.min(2.8, Math.max(1, (state.viewZoom || 1) * faktor)) * 100) / 100;
    fitStages();
  }

  function on(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  }

  on(overlay, "click", onClick);
  // Nach der eigenen Auswertung darf das Ereignis die App nicht mehr erreichen.
  on(overlay, "click", (event) => event.stopPropagation());
  on(overlay, "change", onChange);
  on(overlay, "input", onInput);
  on(overlay, "focusin", (event) => {
    const field = event.target.closest?.("[data-field]");
    if (field && field.getAttribute("contenteditable") === "true") lastField = field;
  });
  on(document, "keydown", onKeyDown, true);
  on(document, "selectionchange", onSelectionChange);
  on(overlay, "wheel", onStageWheel, { passive: false });
  on(window, "resize", () => { fitStages(); fitPreview(); });
  // Ein Groessenwaechter statt einer einmaligen Messung: die Spalte kennt ihre
  // Breite erst nach dem Umbruch, und Schrift laedt spaeter nach.
  if (typeof ResizeObserver === "function") {
    const wachhund = new ResizeObserver(() => { fitPreview(); fitStages(); });
    wachhund.observe(overlay);
    cleanups.push(() => wachhund.disconnect());
  }
  on(document, "mousedown", onDocMouseDown, true);
  on(window, "resize", fitStages);

  /* ── Logo als Data-URI, damit der Download eigenständig bleibt ── */

  (async () => {
    try {
      const res = await fetch(new URL(LOGO_PATH, document.baseURI).href, { cache: "force-cache" });
      if (!res.ok) return;
      const blob = await res.blob();
      const dataUri = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Logo nicht lesbar"));
        reader.readAsDataURL(blob);
      });
      if (!dataUri) return;
      state.logo = dataUri;
      overlay.querySelectorAll(".as-lockup img").forEach((img) => { img.src = dataUri; });
    } catch (_) {
      // Bleibt der Pfad, funktioniert die Bühne in der App weiterhin.
    }
  })();

  /* ── Abbau ── */

  function close() {
    if (state.busy) {
      state.leftRunning = true;
      if (typeof notify === "function") {
        notify("Der Entwurf läuft weiter. Sie bekommen eine Benachrichtigung, wenn er fertig ist.");
      }
    }
    state.cancelRequested = true;
    while (cleanups.length) {
      const off = cleanups.pop();
      try { off(); } catch (_) { /* ein gescheitertes Abmelden darf den Abbau nicht stoppen */ }
    }
    ladeTaktStop();
    draftsTaktStop();
    if (selectionFrame) window.cancelAnimationFrame(selectionFrame);
    if (fmtBar) fmtBar.remove();
    fmtBar = null;
    overlay.remove();
    if (!inHost) document.body.style.overflow = prevOverflow;
    openInstance = null;
  }

  render();
  void ladeDrafts();
  void ladeToneOfVoice();
  void ladeDesignVorlagen();
  openInstance = { close, lebt: () => overlay.isConnected };
  return openInstance;
}
