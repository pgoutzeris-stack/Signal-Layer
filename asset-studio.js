// Asset Studio: Fragebogen, Entwurf und Werkbank für LinkedIn-Assets und
// Ansprachen. Das Modul baut sein Overlay selbst und bringt die Stile
// der Bühne mit, weil die heruntergeladene HTML-Datei ohne die App auskommen
// muss und das App-Thema die Markenfarben sonst umfärben würde.

/* ─────────────────────────  Konstanten und Vorgaben  ───────────────────────── */

const LOGO_PATH = "assets/roots-logo.png";
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
  ["C", "Titel mit Bild"],
  ["D", "Vollbild mit Overlay"],
  ["J", "Zitat über Bild"],
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
const VARIANTS_ALL = [...VARIANTS, ...LAYOUT_KEYS.map((k) => [k, LAYOUT_NAMEN[k] || ASSET_LAYOUT_LABELS[k] || k])];
const VARIANT_KEYS = VARIANTS_ALL.map(([key]) => key);

// Anmutung je Layout, abgelesen am Markup der gebauten Assets: dunkel heisst
// li-dark oder ein dunkles Overlay ueber dem Bild. Die Wahl filtert die Liste,
// sie faerbt nichts um - Umfaerben hatte weisse Schrift auf Weiss erzeugt.
const LOOK = {
  A: "dunkel", B: "hell", C: "hell", D: "dunkel", E: "hell", F: "hell",
  G: "hell", H: "dunkel", I: "hell", J: "dunkel", K: "hell", L: "hell",
  S1: "hell", S2: "dunkel", S3: "hell", S4: "dunkel",
  T1: "hell", T2: "hell", T3: "hell", T4: "hell", T5: "hell", T6: "hell",
};
const MIT_BILD = new Set(["C", "D", "J"]);

const FORM_LINKEDIN = [
  { key: "asset_type", label: "Format", options: [["single", "Einzelbild"], ["carousel", "Carousel"]] },
  { key: "look", label: "Anmutung", options: [["hell", "Hell"], ["dunkel", "Dunkel"]] },
  // Einzelbild: genau ein Layout. Carousel: entweder das Modell mischt die
  // Slide-Arten, oder der Nutzer waehlt sie selbst.
  {
    key: "variant", label: "Layout", art: "dropdown",
    options: [["auto", "Modell wählt"], ...VARIANTS_ALL],
    when: (answers) => answers.asset_type !== "carousel",
  },
  {
    key: "slide_mix", label: "Slide-Arten",
    options: [["auto", "Modell stellt sie zusammen"], ["custom", "Ich wähle sie selbst"]],
    when: (answers) => answers.asset_type === "carousel",
  },
  {
    key: "slide_pick", label: "Ausgewählte Arten", art: "multi",
    options: VARIANTS_ALL,
    when: (answers) => answers.asset_type === "carousel" && answers.slide_mix === "custom",
  },
  {
    key: "slide_count",
    label: "Slides",
    options: [["4", "4"], ["6", "6"]],
    when: (answers) => answers.asset_type === "carousel",
  },
  {
    key: "storyline",
    label: "Inhalt",
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
];

function memoQuestions(firma) {
  const erkannt = String(firma || "").trim();
  return [
    {
      key: "company_named",
      label: "Unternehmen",
      hint: "Nur Briefing für das Modell. Der Name erscheint nicht auf dem Memo.",
      muted: true,
      options: [
        ["yes", "Ja, das Unternehmen nennen"],
        ["no", "Nein"],
      ],
    },
    {
      key: "company_mode",
      label: "Welches Unternehmen",
      when: (answers) => answers.company_named === "yes",
      options: [
        ["auto", erkannt ? `Erkannt: ${erkannt}` : "Aus dem Signal übernehmen"],
        ["custom", "Anderes Unternehmen"],
      ],
      free: { key: "company_text", on: "custom", rows: 1, platzhalter: "Firmenname" },
    },
    {
      key: "storyline",
      label: "Inhalt",
      options: [["auto", "Modell schreibt aus dem Signal"], ["custom", "Ich gebe den Text vor"]],
      free: { key: "storyline_text", on: "custom", rows: 5, platzhalter: "Kernaussage, Stichpunkte oder fertiger Text" },
    },
    {
      key: "benchmarks",
      label: "Benchmarking",
      options: [
        ["auto", "Gemini recherchiert"],
        ["custom", "Eigene Benchmarks"],
      ],
    },
    {
      key: "images",
      label: "Bilder",
      options: [
        ["auto", "Gemini entscheidet die Motive"],
        ["upload", "Eigene Bilder zuschneiden"],
      ],
    },
    {
      key: "cta",
      label: "CTA",
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

.as-edit:focus{outline:2px solid rgba(32,110,251,.45); outline-offset:4px; border-radius:4px;}
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

#as-overlay .as-main{display:grid; grid-template-rows:auto minmax(0, 1fr); min-width:0; min-height:0; overflow:hidden;}
#as-overlay .as-topbar{
  display:flex; align-items:center; justify-content:space-between; gap:16px;
  padding:16px 24px; border-bottom:1px solid var(--line,#e2e8f0); background:var(--bg,#fff);
}
#as-overlay .as-topbar h2{margin:0; font-size:17px; font-weight:700;}
#as-overlay .as-topactions{display:flex; gap:8px; flex-wrap:wrap;}
#as-overlay .as-content{min-height:0; overflow:auto; padding:24px;}
/* Im Fragebogen scrollt ausschliesslich die Antwortspalte. Ein zweiter
   Scrollbereich in der Mitte war der Grund, dass sich das Studio nicht wie ein
   Fenster, sondern wie eine Webseite im Fenster anfuehlte. */
#as-overlay .as-content:has(.as-split2){overflow:hidden; padding:20px 24px 24px;}
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
/* Fragebogen links, Vorschau rechts. Bei schmalem Popup untereinander. */
#as-overlay .as-split2{display:grid; grid-template-columns:minmax(320px, 460px) minmax(0, 1fr); gap:20px; align-items:stretch; height:100%; min-height:0;}
#as-overlay .as-split2-form{overflow-y:auto; max-height:100%; padding-right:10px; scrollbar-width:thin;}
#as-overlay .as-split2-form::-webkit-scrollbar{width:8px;}
#as-overlay .as-split2-form::-webkit-scrollbar-thumb{background:var(--line,#e2e8f0); border-radius:99px;}
#as-overlay .as-split2-prev{position:sticky; top:0; display:flex; flex-direction:column; gap:8px; height:100%; min-height:0;}
#as-overlay .as-prev-label{font-size:.68rem; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--muted,#475569);}
/* Die Flaeche nimmt den Rest, die Kachel selbst ist genau das Asset. */
#as-overlay .as-prev-host{flex:1 1 auto; min-height:0; width:100%; display:flex; align-items:center; justify-content:center;}
#as-overlay .as-prev-big{max-width:100%; max-height:100%; min-height:0;
  box-sizing:border-box; display:flex; align-items:flex-start; justify-content:flex-start;
  overflow:hidden; padding:0; border:0; border-radius:14px; background:#fff; position:relative;
  box-shadow:0 12px 40px rgba(15,23,42,.14);}
#as-overlay .as-prev-big[data-kind="linkedin"]{aspect-ratio:1080/1350;}
#as-overlay .as-prev-big[data-kind="memo"]{aspect-ratio:210/297;}
#as-overlay .as-prev-big:has(.as-prev-empty){width:auto; height:100%; max-width:100%;}
#as-overlay .as-prev-scale{display:block; transform-origin:top left; flex:0 0 auto;}
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
  gap:8px; width:100%; height:100%; text-align:center; color:var(--muted,#475569);}
#as-overlay .as-prev-empty i{font-size:1.5rem; color:var(--brand,#206efb); opacity:.75;}
#as-overlay .as-prev-empty b{font-size:.92rem; color:var(--ink,#0f172a);}
#as-overlay .as-prev-empty span{font-size:.78rem;}
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
#as-overlay .as-ddrow{width:100%; display:flex; align-items:center; gap:10px; padding:6px 8px; border:0;
  border-radius:10px; background:transparent; text-align:left; font-size:.82rem; font-weight:600; color:var(--ink,#0f172a);}
#as-overlay .as-ddrow:hover{background:var(--surface,#f8fafc);}
#as-overlay .as-ddrow.is-active{background:var(--brand-light,#eff6ff); color:var(--brand-dark,#165fd9);}
#as-overlay .as-ddtext{flex:1; min-width:0;}
#as-overlay .as-ddthumb{flex:0 0 auto; width:40px; height:50px; border-radius:6px; overflow:hidden;
  border:1px solid var(--line,#e2e8f0); background:#fff; display:flex; align-items:center; justify-content:center; color:var(--brand,#206efb);}
#as-overlay .as-mini{display:block; width:40px; height:50px; overflow:hidden;}
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
  align-self:flex-start; border:1px solid var(--line,#e2e8f0); background:#fff;
  border-radius:999px; padding:6px 12px; font-size:12px; font-weight:700;
}
#as-overlay .as-pill:hover{border-color:var(--brand,#206efb); color:var(--brand,#206efb);}
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
#as-overlay .as-drafts{margin-top:18px; padding-top:16px; border-top:1px solid var(--line,#e2e8f0);}
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
#as-overlay .as-load-actions{margin-top:4px;}

/* Ladeanzeige: echte Abschnitte, gerundete Minuten, pulsierender Balken. */
#as-overlay .as-load{display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:14px; min-height:300px; text-align:center; padding:28px 24px; width:min(420px, 100%); margin:0 auto;}
#as-overlay .as-load-icon{color:var(--brand,#206efb); font-size:1.7rem; line-height:1;
  animation:as-pulse 1.4s ease-in-out infinite;}
@keyframes as-pulse{0%,100%{transform:scale(1); opacity:1;} 50%{transform:scale(1.12); opacity:.72;}}
#as-overlay .as-load-text{margin:0; font-size:1.05rem; font-weight:700; color:var(--ink,#0f172a);}
#as-overlay .as-load-eta{margin:0; font-size:.95rem; font-weight:600; color:var(--ink,#0f172a);}
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

#as-overlay .as-content:has(.as-work){overflow:hidden; display:flex; flex-direction:column;}
#as-overlay .as-work{display:grid; grid-template-columns:1fr 296px; gap:20px; align-items:stretch;
  flex:1; min-height:0; height:100%;}
#as-overlay .as-work:not(:has(.as-inspector)){grid-template-columns:1fr;}
#as-overlay .as-stagearea{display:flex; flex-direction:column; align-items:center; justify-content:center;
  min-width:0; min-height:0; height:100%; overflow:hidden; position:relative;}
#as-overlay .as-frame{width:auto; max-width:100%; display:flex; flex-direction:column; gap:8px; align-items:center; position:relative;}
#as-overlay .as-frame.is-off{display:none !important;}
#as-overlay .as-scaler{position:relative; margin:0 auto; overflow:hidden; border-radius:14px;
  box-shadow:var(--shadow-lg,0 12px 40px rgba(15,23,42,.14));}
#as-overlay .as-scaler > .as-stage{position:absolute; top:0; left:0; transform-origin:top left; border-radius:0;}
#as-overlay .as-scaler .li{border-radius:0;}
#as-overlay .as-slidetools{
  width:100%; display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  background:var(--bg,#fff); border:1px solid var(--line,#e2e8f0); border-radius:12px; padding:8px 10px;
}
#as-overlay .as-slidetools .as-num{font-size:12px; font-weight:700; color:var(--muted,#475569); margin-right:4px;}
#as-overlay .as-slidetools select{
  font:inherit; font-size:13px; padding:6px 10px; border-radius:9px;
  border:1px solid var(--line,#e2e8f0); background:var(--bg,#fff); color:inherit;
}
#as-overlay .as-stage--memo{width:210mm !important; height:297mm !important; background:transparent;}
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
  position:fixed; z-index:12100; display:none; gap:2px; align-items:center; flex-wrap:nowrap;
  background:var(--bg,#fff); border:1px solid var(--line,#e2e8f0); border-radius:12px;
  padding:5px; box-shadow:var(--shadow-lg,0 12px 40px rgba(15,23,42,.14));
}
#as-overlay .as-fmt[data-open="1"]{display:flex;}
#as-overlay .as-fmt button{
  border:0; background:transparent; border-radius:8px; width:30px; height:30px;
  display:grid; place-items:center; font-size:13px;
}
#as-overlay .as-fmt button:hover{background:var(--surface,#f8fafc); color:var(--brand,#206efb);}
#as-overlay .as-fmt hr{width:1px; height:20px; border:0; background:var(--line,#e2e8f0); margin:0 3px;}
#as-overlay .as-swatch{width:22px; height:22px; border-radius:999px; border:1px solid rgba(15,23,42,.18);}

#as-overlay .as-img-ui{
  position:absolute; left:50%; bottom:18px; z-index:6;
  display:flex; align-items:center; gap:8px; padding:7px 9px;
  background:rgba(255,255,255,.96); border:1px solid #e2e8f0; border-radius:12px;
  box-shadow:0 8px 24px rgba(15,23,42,.18); white-space:nowrap;
  transform:translateX(-50%) scale(var(--as-inv,1)); transform-origin:bottom center;
}
#as-overlay .as-img-ui button{
  border:1px solid #e2e8f0; background:#fff; color:#0f172a;
  border-radius:8px; padding:5px 10px; font-size:12px; font-weight:600;
}
#as-overlay .as-img-ui button:hover{border-color:#206efb; color:#206efb;}
#as-overlay .as-img-ui input[type="range"]{width:110px; accent-color:#206efb;}

#as-overlay .as-hint{font-size:12px; line-height:1.5; color:var(--muted,#475569); margin:0;}
#as-overlay .as-q > .as-hint{margin-top:-2px;}
#as-overlay .as-file{display:none;}

#as-overlay .as-crop{
  position:absolute; inset:0; z-index:80;
  background:rgba(15,23,42,.46); display:grid; place-items:center; padding:24px;
}
#as-overlay .as-crop[hidden]{display:none;}
#as-overlay .as-crop-card{
  width:min(560px,100%); background:#fff; border-radius:18px; padding:22px 22px 18px;
  box-shadow:0 24px 60px rgba(15,23,42,.28); display:flex; flex-direction:column; gap:14px;
}
#as-overlay .as-crop-card h3{margin:0; font-size:18px;}
#as-overlay .as-crop-frame{
  width:100%; overflow:hidden; border-radius:12px; border:1px solid #e2e8f0;
  background:#f8fafc; position:relative; cursor:grab; touch-action:none;
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
  #as-overlay .as-rail{flex-direction:row; align-items:center; border-right:0; border-bottom:1px solid var(--line,#e2e8f0); overflow-x:auto;}
  #as-overlay .as-rail .as-railtitle{display:none;}
  #as-overlay .as-steps{flex-direction:row;}
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

function companyFrom(source) {
  return String(
    source?.primary_company
    || source?.company
    || (toArray(source?.tier1_companies)[0] || ""),
  ).trim();
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

import { ASSET_TEMPLATE_CSS, ASSET_TEMPLATES, ASSET_LAYOUTS, ASSET_LAYOUT_LABELS } from "./asset-templates.js?v=20260814-1205";
import { MEMO_TEMPLATE, MEMO_TEMPLATE_CSS } from "./memo-template.js?v=20260814-1205";
import { assetEtaLabel, assetEtaProgressPct, assetEtaRemainingMs, assetEtaStagesFromLog } from "./asset-eta.mjs?v=20260814-1205";

/* ─────────────────────────  Einstieg  ───────────────────────── */

let openInstance = null;

/** Schliesst ein offenes Studio. Von aussen aufrufbar, damit das Artikel-Popup
 *  seine Ebene abraeumen kann, bevor es selbst verschwindet. */
export function closeAssetStudio() {
  if (openInstance) openInstance.close();
}

export function openAssetStudio({ kind, articleId, signal, callApi, escapeHtml, host } = {}) {
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
  const questions = isMemo ? memoQuestions(company) : FORM_LINKEDIN;

  const state = {
    step: "form",
    answers: defaultAnswers(questions),
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
    pendingImage: null,
    formImages: {},
    cancelRequested: false,
    drafts: [],
    draftsOpen: false,
    draftsUhr: 0,
    draftsError: "",
    ddOffen: false,
    multiOffen: false,
    prevIndex: 0,
    ladeAbschnitt: "lesen",
    ladeStart: 0,
    ladeUhr: 0,
    forecastMs: 0,
    laufLog: [],
    updatedAt: "",
  };

  const cleanups = [];
  const overlay = document.createElement("div");
  overlay.id = "as-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", isMemo ? "Ansprache" : "LinkedIn-Asset");

  const styleIsland = document.createElement("style");
  styleIsland.textContent = `${CHROME_CSS}\n${ASSET_TEMPLATE_CSS}\n${MEMO_TEMPLATE_CSS}\n${STAGE_CSS}\n${printCss(isMemo)}`;
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
      <p class="as-hint" data-crop-hint>Nur der Ausschnitt im Rahmen landet im Asset.</p>
      <div class="as-crop-frame" data-crop-frame>
        <img class="as-crop-img" data-crop-img alt="">
      </div>
      <label class="as-crop-zoom">Zoom <input type="range" data-crop-zoom min="100" max="280" step="1" value="100"></label>
      <div class="as-crop-actions">
        <button type="button" class="as-btn" data-act="crop-cancel">Abbrechen</button>
        <button type="button" class="as-btn as-btn--primary" data-act="crop-ok">Zuschneiden</button>
      </div>
    </div>`;
  overlay.appendChild(cropOverlay);

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

  function defaultAnswers(list) {
    const out = {};
    // Mehrfachauswahl startet leer: eine vorausgewaehlte Slide-Art waere eine
    // Entscheidung, die niemand getroffen hat.
    for (const q of list) out[q.key] = q.art === "multi" ? "" : q.options[0][0];
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
      </nav>
      <div class="as-main">
        <header class="as-topbar">
          <h2>${esc(headline())}</h2>
          <div class="as-topactions">${topActions()}</div>
        </header>
        <div class="as-content">${stepContent()}</div>
      </div>`;
    // Direkt und noch einmal nach dem Umbruch: in einem verborgenen Tab
    // laeuft requestAnimationFrame nicht, dann traegt der direkte Aufruf.
    if (state.step === "form") { fitPreview(); requestAnimationFrame(fitPreview); }
    if (state.step === "draft" && state.payload) mountStages(false);
    if (state.step === "edit") {
      mountStages(true);
      mountFormatBar();
    }
  }

  function headline() {
    if (state.step === "form") return isMemo ? "Ansprache" : "LinkedIn-Asset";
    if (state.step === "draft") return state.busy ? "Entwurf wird erzeugt" : "Entwurf";
    return "Bearbeiten";
  }

  function stepItem(index, label, key) {
    const order = ["form", "draft", "edit"];
    const current = order.indexOf(state.step);
    const own = order.indexOf(key);
    const stateName = own === current ? "active" : own < current ? "done" : "todo";
    return `<li data-state="${stateName}"><b>${index}</b>${esc(label)}</li>`;
  }

  function topActions() {
    if (state.step === "form") {
      return `<button type="button" class="as-btn as-btn--primary" data-act="generate"><i class="fa-solid fa-wand-magic-sparkles"></i>Entwurf erzeugen</button>`;
    }
    if (state.step === "draft") {
      if (state.busy || !state.payload) {
        return `<button type="button" class="as-btn" data-act="cancel-generate"><i class="fa-solid fa-xmark"></i>Abbrechen</button>`;
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
        <div class="as-split2-form">${formHtml()}${draftsHtml()}</div>
        <div class="as-split2-prev">
          <span class="as-prev-label">Vorschau</span>
          <div class="as-prev-host">
            <div class="as-prev-big" data-kind="${isMemo ? "memo" : "linkedin"}" data-livepreview>${livePreviewHtml()}</div>
          </div>
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
      return `<div class="as-work" data-kind="${isMemo ? "memo" : "linkedin"}">
        <div class="as-stagearea" data-stagearea></div>
      </div>`;
    }
      return `<div class="as-work" data-kind="${isMemo ? "memo" : "linkedin"}">
      <div class="as-stagearea" data-stagearea></div>
      ${inspectorHtml()}
    </div>`;
  }

  /* ── Schritt 1: Fragebogen ── */

  /** Grosse Vorschau rechts. Dieselbe Vorlage wie das Ergebnis, kein Modellaufruf. */
  function livePreviewHtml() {
    if (isMemo) {
      if (state.prevIndex >= MEMO_SEITEN) state.prevIndex = 0;
      const html = markiereMemoSeiten(memoHtml(applyFormImages(demoMemo()), false).replace(/<div class="as-img-ui"[\s\S]*?<\/div>/g, ""));
      return `<span class="as-prev-scale">${html}</span>${blaetterNavHtml()}`;
    }
    // Entscheidet das Modell das Layout, gibt es nichts zu zeigen. Eine
    // beliebige Kachel waere geraten und damit irrefuehrend.
    const arten = gewaehlteArten();
    const carousel = state.answers.asset_type === "carousel";
    // Beim Blaettern nicht ueber das Ende hinaus: die Auswahl kann schrumpfen.
    if (state.prevIndex >= arten.length) state.prevIndex = 0;
    const variante = carousel
      ? (state.answers.slide_mix === "custom" ? arten[state.prevIndex] : "")
      : state.answers.variant;
    if (!variante || variante === "auto" || !VARIANT_KEYS.includes(variante)) return platzhalterHtml();
    return `<span class="as-prev-scale">${slideHtml(demoSlide(variante), false)}</span>${blaetterNavHtml()}`;
  }

  function blaetterAnzahl() {
    if (isMemo) return MEMO_SEITEN;
    if (state.step === "form") return Math.max(1, gewaehlteArten().length);
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
    ["recherchieren", "fa-magnifying-glass", "Gemini recherchiert aktuelle Vorreiter"],
    ["modell", "fa-brain", isMemo ? "Das Modell entwickelt die Ansprache" : "Das Modell schreibt Titel und Kernaussage"],
    ["pruefen", "fa-list-check", "Belege und Längen werden geprüft"],
    ["bilder", "fa-image", "Gemini erzeugt die Motive"],
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
      if (name === "recherchieren") return "Vorreiter-Recherche gestartet";
      if (name === "modell") return "Schreiben gestartet";
      if (name === "pruefen") return "Belege werden geprüft";
      if (name === "bilder") return "Motive werden erzeugt";
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
      return names ? `Vorreiter: ${names}` : "Vorreiter gefunden";
    }
    if (event === "benchmarks_user") return "Eigene Vorreiter übernommen";
    if (event === "image_start") return "Ein Motiv wird erzeugt";
    if (event === "images_done") return "Motive fertig";
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
      <p class="as-load-eta">${esc(ladeEtaText())}</p>
      ${log.length ? `<ul class="as-load-log">${log.map((row) => `<li><b>${row.sek} s</b><span>${esc(row.text)}</span></li>`).join("")}</ul>` : ""}
      <div class="as-load-actions"><button type="button" class="as-btn" data-act="cancel-generate">Abbrechen</button></div>
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
      const eta = shell.querySelector(".as-load-eta");
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
    const eta = shell.querySelector(".as-load-eta");
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
      ? `Gemini füllt dieses ${kind}-Motiv (Platzhalter bleibt).`
      : `Eigenes Bild hier zuschneiden, genau in den ${kind}-Platzhalter.`;
    return normalizeMemo({
      title: "Die Marke muss jetzt als Hebel gezogen werden",
      standfirst: "Der Markt hat sich bewegt. Wer denselben Hebel schon gezogen hat, setzt die neue Messlatte. Dieser Check macht den Moment für den Adressaten konkret.",
      market_title: "Der Markt belohnt, wer die Marke führt",
      market_p1: "Anbieter, die Sortiment, Kanal und Auftritt als eine Handschrift führen, gewinnen Sichtbarkeit und Tempo.",
      market_p2: "Wer den Hebel liegen lässt, bleibt in der Fläche vergleichbar und im Dialog austauschbar.",
      kpis: [
        { value: "3", label: "Hebel im Check" },
        { value: "1", label: "strategischer Moment" },
        { value: "4", label: "Wochen bis zum Gespräch" },
      ],
      benchmark_title: "Vorreiter ziehen denselben Hebel",
      benchmark_lead: "Drei Marken haben vorgemacht, was übertragbar ist.",
      benchmarks: [
        { name: "Vorreiter A", text: "Hat die Eigenmarke zur Leitmarke gemacht und den Auftritt vereinheitlicht.", tag: "Marke vor Fläche", image_hint: hint("Benchmark") },
        { name: "Vorreiter B", text: "Hat Kanal und Fläche unter eine Handschrift gestellt.", tag: "Eine Linie, zwei Kanäle", image_hint: hint("Benchmark") },
        { name: "Vorreiter C", text: "Hat Kampagnen durch eine haltbare Linie ersetzt.", tag: "Linie vor Saison", image_hint: hint("Benchmark") },
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

  /** Platzhalterinhalt, mit dem jedes Layout etwas zu zeigen hat. */
  function demoSlide(variant) {
    return normalizeSlide({
      variant,
      kicker: themeKicker(source),
      title: "Ein Satz, der etwas behauptet",
      subtitle: "Zwei Zeilen Einordnung, die die Behauptung stuetzen.",
      quote: "Ein Zitat mit Haltung, zwei Zeilen lang.",
      attribution: "Name, Rolle",
      stat: { value: "14 %", label: "Bezug, Jahr" },
      stats: [{ value: "14 %", label: "Anteil am Umsatz" }, { value: "6", label: "Wochen je Runde" }, { value: "3", label: "Rollen im Buying Center" }],
      bullets: ["**Erster Hebel** mit Substanz und Begründung", "**Zweiter Hebel** mit Substanz und Begründung", "**Dritter Hebel** mit Substanz und Begründung"],
      steps: [{ n: "1", title: "Standort", text: "Lage in zwei Wochen belegen." }, { n: "2", title: "Priorität", text: "Drei Hebel auswählen." }, { n: "3", title: "Umsetzung", text: "Pilot in einem Segment." }],
      myth: "Die verbreitete Behauptung.",
      fact: "Der Befund, der ihr widerspricht.",
      takeaway: "**Folge:** Struktur ist Standard, entscheidend ist die Handschrift.",
      footer_left: "ROOTS Consultants",
      // Nur dieses Layout lebt von der Streichung, deshalb traegt sein
      // Beispieltext die Markierung.
      ...(variant === "K" ? { title: "Nicht mehr ~~Tools~~, sondern mehr Handschrift" } : {}),
    });
  }

  /** Layouts der gewaehlten Anmutung. "Modell waehlt" bleibt immer dabei. */
  function layoutOptionen() {
    const look = state.answers.look === "dunkel" ? "dunkel" : "hell";
    return [["auto", "Modell wählt"], ...VARIANTS_ALL.filter(([key]) => LOOK[key] === look)];
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

  /** Gewaehlte Slide-Arten als Liste. Leer heisst: noch nichts ausgewaehlt. */
  function gewaehlteArten() {
    return String(state.answers.slide_pick || "").split(",").map((v) => v.trim()).filter(Boolean);
  }

  /**
   * Mehrfachauswahl im selben weissen Dropdown, mit Nummer je gewaehlter Zeile.
   * Die Reihenfolge der Auswahl ist die Reihenfolge der Slides.
   */
  function multiHtml(q) {
    const gewaehlt = gewaehlteArten();
    const look = state.answers.look === "dunkel" ? "dunkel" : "hell";
    const optionen = q.options.filter(([key]) => LOOK[key] === look);
    const label = gewaehlt.length
      ? `${gewaehlt.length} von ${state.answers.slide_count || 4} gewählt`
      : "Arten auswählen";
    const zeilen = optionen.map(([value, text]) => {
      const an = gewaehlt.includes(value);
      return `
      <button type="button" class="as-ddrow${an ? " is-active" : ""}" data-act="pick-art" data-value="${attr(value)}">
        <span class="as-ddthumb">${miniatur(value)}</span>
        <span class="as-ddtext">${esc(text)}</span>
        ${an ? `<i class="as-tag">Slide ${gewaehlt.indexOf(value) + 1}</i>` : ""}
      </button>`;
    }).join("");
    return `<div class="as-q">
      <label>${esc(q.label)}</label>
      <div class="as-dd${state.multiOffen ? " is-open" : ""}">
        <button type="button" class="as-ddhead" data-act="toggle-arten" aria-expanded="${state.multiOffen ? "true" : "false"}">
          <span>${esc(label)}</span><i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="as-ddlist">${zeilen}</div>
      </div>
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
    const offen = state.draftsOpen;
    const liste = Array.isArray(state.drafts) ? state.drafts : [];
    const zeilen = !offen ? ""
      : state.draftsError ? `<p class="as-hint">${esc(state.draftsError)}</p>`
      : !liste.length ? `<p class="as-hint">Noch keine Entwürfe für diesen Artikel.</p>`
      : `<div class="as-draft-list">${liste.map((row) => draftZeileHtml(row)).join("")}</div>`;
    return `<div class="as-drafts">
      <button type="button" class="as-drafts-head" data-act="toggle-drafts" aria-expanded="${offen ? "true" : "false"}">
        <span>Entwürfe anzeigen${liste.length ? ` (${liste.length})` : ""}</span>
        <i class="fa-solid fa-chevron-${offen ? "up" : "down"}"></i>
      </button>
      ${zeilen}
    </div>`;
  }

  function draftZeileHtml(row) {
    const status = String(row.status || "");
    const titel = status === "done" ? "Fertiger Entwurf"
      : status === "running" ? "Läuft gerade"
      : "Nicht fertig";
    const wann = formatDraftWhen(row.created_at);
    const dauer = formatDraftDauer(row.duration_ms);
    const tokens = Number(row.total_tokens) > 0 ? `${Number(row.total_tokens).toLocaleString("de-DE")} Token` : "";
    const kosten = formatDraftEur(row.cost_eur);
    const meta = [wann, dauer, tokens, kosten].filter(Boolean).join(" · ");
    const klasse = status === "error" ? " is-error" : status === "running" ? " is-run" : "";
    return `<button type="button" class="as-draft${klasse}" data-act="open-draft" data-id="${attr(row.id)}">
      <strong>${esc(titel)}</strong>
      <span>${esc(draftSettingsText(row))}</span>
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
    else if (isMemo) teile.push("Gemini-Motive");
    if (a.cta) teile.push("eigener CTA");
    if (a.storyline) teile.push("eigener Inhalt");
    if (a.asset_type === "carousel") teile.push(`Karussell ${a.slides || ""}`.trim());
    else if (a.asset_type === "single") teile.push("Einzelbild");
    return teile.filter(Boolean).join(" · ") || (row.prompt_version || "");
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
    if (state.step === "form") {
      const box = shell.querySelector(".as-drafts");
      if (box) box.outerHTML = draftsHtml();
    }
  }

  function draftsTaktStart() {
    draftsTaktStop();
    void ladeDrafts();
    state.draftsUhr = window.setInterval(() => {
      if (!state.draftsOpen || state.step !== "form") { draftsTaktStop(); return; }
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
    if (src.asset_type) a.asset_type = src.asset_type;
    if (src.variant) a.variant = src.variant;
    if (src.theme === "dark") a.look = "dunkel";
    if (src.slides) a.slide_count = String(src.slides);
    if (Array.isArray(src.slide_types) && src.slide_types.length) a.slide_pick = src.slide_types.join(",");
    return a;
  }

  async function openDraft(id) {
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
      state.busy = false;
      render();
    }
  }

  function formHtml() {
    const rows = questions.filter((q) => !q.when || q.when(state.answers)).map((q) => {
      if (q.art === "dropdown") return dropdownHtml(q);
      if (q.art === "multi") return multiHtml(q);
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
        : "";
      const hinweis = q.hint ? `<p class="as-hint">${esc(q.hint)}</p>` : "";
      const benches = q.key === "benchmarks" && state.answers.benchmarks === "custom" ? benchesHtml() : "";
      const slots = q.key === "images" && state.answers.images === "upload" ? slotsHtml() : "";
      return `<div class="as-q${q.muted ? " as-q--muted" : ""}"><label>${esc(q.label)}</label>${hinweis}<div class="as-opts">${opts}</div>${free}${benches}${slots}</div>`;
    }).join("");
    const fehler = state.formError ? `<p class="as-form-error">${esc(state.formError)}</p>` : "";
    return `<form class="as-form" data-form>${fehler}${rows}</form>`;
  }

  /** Formular und Vorschau in einem Zug neu zeichnen. */
  function zeichneForm() {
    readForm();
    const form = shell.querySelector(".as-split2-form");
    if (form) form.innerHTML = `${formHtml()}${draftsHtml()}`;
    const prev = shell.querySelector("[data-livepreview]");
    if (prev) prev.innerHTML = livePreviewHtml();
    fitPreview();
  }

  function readForm() {
    const form = shell.querySelector("[data-form]");
    if (!form) return;
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

  function eigeneVorreiter() {
    return [0, 1, 2].map((i) => ({
      name: String(state.answers[`bench_${i}_name`] || "").trim(),
      text: String(state.answers[`bench_${i}_text`] || "").trim(),
      tag: String(state.answers[`bench_${i}_tag`] || "").trim(),
    }));
  }

  function eigeneVorreiterPruefen() {
    const liste = eigeneVorreiter();
    const voll = liste.filter((item) => item.name && item.text && item.tag);
    if (voll.length < 3) {
      return "Bitte drei Vorreiter mit Name, Handlung und Lehre. Beispiel: Decathlon | Hat die Eigenmarken unter eine Führung gestellt | Marke vor Fläche";
    }
    const beispiel = BENCH_EXAMPLE.map((item) => item.name.toLowerCase()).sort().join("|");
    const namen = liste.map((item) => item.name.toLowerCase()).sort().join("|");
    if (namen === beispiel) {
      return "Das Beispiel zeigt nur die Form. Bitte drei Vorreiter einsetzen, die denselben Hebel wie dieses Signal schon gezogen haben.";
    }
    const duenn = liste.find((item) => item.text.length < 24);
    if (duenn) return `„${duenn.name}“ braucht eine konkrete Handlung, nicht nur den Namen.`;
    return "";
  }

  /* ── Schritt 2: Entwurf erzeugen ── */

  async function generate() {
    readForm();
    if (isMemo && state.answers.benchmarks === "custom") {
      const mangel = eigeneVorreiterPruefen();
      if (mangel) {
        state.formError = mangel;
        zeichneForm();
        return;
      }
    }
    state.formError = "";
    state.step = "draft";
    state.busy = true;
    state.error = "";
    state.cancelRequested = false;
    render();
    ladeTaktStart(true);
    try {
      const gewaehlt = state.answers.variant;
      const antworten = { ...state.answers, layout: gewaehlt };
      const res = await api("generate_asset", {
        kind: assetKind,
        article_id: articleId || null,
        answers: antworten,
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

  /** Fragt den Auftrag ab, bis er fertig ist. Bis zu sieben Minuten. */
  async function warteAufAsset(id) {
    // Ueber Watchdog (380 s) und Isolate (~400 s), damit die letzte Abfrage
    // eine stehengebliebene Zeile als Fehler sieht statt einer leeren Uhr.
    const bis = Date.now() + 420_000;
    let wartezeit = 800;
    while (Date.now() < bis) {
      if (state.cancelRequested) return { id, status: "error", error_message: "Vom Nutzer abgebrochen." };
      await new Promise((r) => setTimeout(r, wartezeit));
      wartezeit = Math.min(wartezeit + 200, 1_200);
      if (state.cancelRequested) return { id, status: "error", error_message: "Vom Nutzer abgebrochen." };
      const res = await api("get_asset", { asset_id: id });
      const row = res && typeof res === "object" ? (res.asset || res) : {};
      uebernehmeLaufstand(row);
      if (row.status && row.status !== "running") return row;
    }
    throw new Error("Der Entwurf ist nach sieben Minuten nicht fertig geworden. Bitte denselben Auftrag noch einmal starten.");
  }

  function adoptPayload(raw) {
    const data = raw && typeof raw === "object" ? raw : {};
    state.payload = data;
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
      footerLeft: String(src.footer_left || "ROOTS Consultants"),
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
    html = wrapImageSlots(html, slide);
    if (editable) {
      html = html.replace(/data-field="([a-z0-9_.]+)"/g, 'data-field="$1" contenteditable="true" spellcheck="false"');
    }
    // Kein Eingriff in die Anmutung: jedes gebaute Asset bringt seine mit, und
    // die Textfarben stehen inline im Markup. Ein Umschalten der Klasse hat
    // vorher weisse Schrift auf weissem Grund erzeugt - die Kachel sah leer aus.
    return `<div class="as-stage as-stage--tpl" data-stage data-uid="${attr(slide.uid)}" data-variant="${attr(slide.variant)}">${html}</div>`;
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
      logo: state.logo || LOGO_PATH,
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

  /** Fotos bekommen die Bedienung der Werkbank, das Logo bleibt unberuehrt. */
  function wrapImageSlots(html, model) {
    const uiFor = (key) => {
      const bild = imageAt(model, key);
      const hat = Boolean(bild.src);
      const pos = Number.parseFloat(String(bild.pos || "50% 50%").split(" ")[1]) || 50;
      return `<div class="as-img-ui" data-as-chrome>
      <button type="button" data-act="img-pick" data-imgkey="${attr(key)}">${hat ? "Ausschnitt ersetzen" : "Bild zuschneiden"}</button>
      ${hat ? `<input type="range" min="0" max="100" step="1" value="${pos}" data-act="img-pos" data-imgkey="${attr(key)}" aria-label="Ausschnitt">` : ""}
      ${hat ? `<button type="button" data-act="img-clear" data-imgkey="${attr(key)}">Entfernen</button>` : ""}
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
      html = html.replace(/data-field="([a-z0-9_.]+)"/g, 'data-field="$1" contenteditable="true" spellcheck="false"');
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

  function mountStages(editable) {
    const area = shell.querySelector("[data-stagearea]");
    if (!area) return;
    if (isMemo) {
      if (!state.memo) return;
      if (state.prevIndex >= MEMO_SEITEN) state.prevIndex = 0;
      area.innerHTML = `<div class="as-frame"><div class="as-scaler">${markiereMemoSeiten(memoHtml(state.memo))}</div></div>${blaetterNavHtml()}`;
    } else {
      if (!state.slides.length) return;
      if (state.prevIndex >= state.slides.length) state.prevIndex = 0;
      area.innerHTML = state.slides.map((slide, index) => `
        <div class="as-frame${index === state.prevIndex ? "" : " is-off"}" data-uid="${attr(slide.uid)}">
          ${editable ? slideTools(slide, index) : ""}
          <div class="as-scaler">${slideHtml(slide)}</div>
        </div>`).join("")
        + blaetterNavHtml();
    }
    if (editable) {
      area.querySelectorAll("[data-field]").forEach((node) => {
        node.setAttribute("contenteditable", "true");
        node.setAttribute("spellcheck", "false");
      });
    } else {
      // In der Vorschau stören Bildknöpfe, dort zählt nur das Ergebnis.
      area.querySelectorAll("[data-as-chrome]").forEach((node) => node.remove());
    }
    fitStages();
    requestAnimationFrame(meldeUeberlauf);
  }

  /**
   * Die Kachel ist 1080×1350. scrollWidth darüber heisst: Text oder Grafik
   * laufen aus dem Rahmen, wie beim Cucinelli-Titel. Vor dem Speichern ein Gate.
   */
  function kachelUeberlauf() {
    if (isMemo) return [];
    const treffer = [];
    shell.querySelectorAll("[data-stagearea] .as-stage--tpl .li").forEach((kachel, i) => {
      const ausRahmen = kachel.scrollWidth > 1082 || kachel.scrollHeight > 1352;
      let ausFeld = false;
      kachel.querySelectorAll("h1, [data-field='title'], [data-field='quote'], [data-field='stat_value']").forEach((el) => {
        if (el.scrollWidth > el.clientWidth + 4) ausFeld = true;
      });
      if (ausRahmen || ausFeld) treffer.push(i + 1);
    });
    return treffer;
  }

  function meldeUeberlauf() {
    const treffer = kachelUeberlauf();
    if (!treffer.length) return;
    showSaveHint(`Folie ${treffer.join(", ")} läuft über den Rahmen (1080 px). Text kürzen, bevor du speicherst.`);
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
  /** Passt die grosse Vorschau in ihre Spalte ein. Gleiche Rechnung wie fitStages. */
  function fitPreview() {
    const box = shell.querySelector("[data-livepreview]");
    const host = box?.closest(".as-prev-host");
    const inner = box?.querySelector(".as-prev-scale");
    const stage = inner?.querySelector(".as-stage");
    // Ohne Buehne steht dort der Platzhalter - nichts einzupassen.
    if (!box || !inner || !stage) return;
    zeigeAktiveMemoSeite(box);
    legeMemoSeiteMass(stage);
    const flaeche = host || box;
    const breite = flaeche.clientWidth || 1;
    const hoehe = Math.max(flaeche.clientHeight || 0, 240);
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
    const availW = Math.max(240, area.clientWidth);
    const availH = Math.max(0, area.clientHeight);
    area.querySelectorAll(".as-scaler").forEach((scaler) => {
      const stage = scaler.querySelector(".as-stage");
      if (!stage) return;
      legeMemoSeiteMass(stage);
      const w = stage.offsetWidth || (isMemo ? MEMO_SEITE_PX.w : 1080);
      const h = stage.offsetHeight || (isMemo ? MEMO_SEITE_PX.h : 1350);
      const scale = availH > 80
        ? Math.min(1, availW / w, availH / h)
        : Math.min(1, availW / w);
      scaler.style.width = `${Math.round(w * scale)}px`;
      scaler.style.height = `${Math.round(h * scale)}px`;
      stage.style.transform = `scale(${scale})`;
      // Die Bildbedienung soll trotz Verkleinerung bedienbar bleiben.
      stage.style.setProperty("--as-inv", String(1 / scale));
    });
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
        <span>Beitragstext</span>
        <textarea class="as-post" data-post aria-label="Beitragstext">${esc(state.postText)}</textarea>
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

  /* ── Schwebende Formatierungsleiste ── */

  let fmtBar = null;

  function mountFormatBar() {
    if (fmtBar && fmtBar.isConnected) return;
    fmtBar = document.createElement("div");
    fmtBar.className = "as-fmt";
    fmtBar.setAttribute("role", "toolbar");
    fmtBar.setAttribute("aria-label", "Formatierung");
    fmtBar.innerHTML = `
      <button type="button" data-fmt="bold" title="Fett" aria-label="Fett"><i class="fa-solid fa-bold"></i></button>
      <button type="button" data-fmt="italic" title="Kursiv" aria-label="Kursiv"><i class="fa-solid fa-italic"></i></button>
      <button type="button" data-fmt="underline" title="Unterstrichen" aria-label="Unterstrichen"><i class="fa-solid fa-underline"></i></button>
      <hr>
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
    overlay.appendChild(fmtBar);
    // Ein Mausklick auf die Leiste darf die Textauswahl nicht aufheben.
    fmtBar.addEventListener("mousedown", (event) => event.preventDefault());
    fmtBar.addEventListener("click", onFormat);
  }

  function editableOf(node) {
    const el = node && node.nodeType === 1 ? node : node?.parentElement;
    return el ? el.closest("[data-field]") : null;
  }

  function currentField() {
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    return editableOf(sel.anchorNode);
  }

  function updateFormatBar() {
    if (state.step !== "edit" || !fmtBar) return;
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !currentField()) {
      fmtBar.setAttribute("data-open", "0");
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) {
      fmtBar.setAttribute("data-open", "0");
      return;
    }
    fmtBar.setAttribute("data-open", "1");
    const width = fmtBar.offsetWidth || 420;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
    const top = rect.top - (fmtBar.offsetHeight || 40) - 10;
    fmtBar.style.left = `${Math.round(left)}px`;
    fmtBar.style.top = `${Math.round(top < 8 ? rect.bottom + 10 : top)}px`;
  }

  function onFormat(event) {
    const btn = event.target.closest("[data-fmt]");
    if (!btn) return;
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
    updateFormatBar();
  }

  /* ── Bilder ── */

  const cropState = {
    uid: "", key: "", img: null, panX: 0.5, panY: 0.5, zoom: 1,
    dragging: false, lastX: 0, lastY: 0,
  };

  function loadHtmlImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Die Bilddatei konnte nicht gelesen werden."));
      img.src = src;
    });
  }

  function coverCrop(img, outW, outH, panX = 0.5, panY = 0.5, zoom = 1) {
    const target = outW / outH;
    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;
    if (!imgW || !imgH) return "";
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
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(img, x, y, cropW, cropH, 0, 0, outW, outH);
    try { return canvas.toDataURL("image/jpeg", 0.62); } catch (_) { return ""; }
  }

  async function fitSlotImage(src, spec) {
    if (!src) return "";
    try {
      const img = await loadHtmlImage(src);
      return coverCrop(img, spec.w, spec.h, 0.5, 0.5, 1) || src;
    } catch (_) {
      return src;
    }
  }

  async function compactAdoptedImages() {
    if (isMemo && state.memo) {
      for (const [liste, kind] of [[state.memo.benchmarks, "benchmark"], [state.memo.potentials, "potential"]]) {
        const spec = MEMO_SHOT_PIXELS[kind];
        for (const eintrag of liste) {
          if (eintrag?.image?.src) {
            eintrag.image.src = await fitSlotImage(eintrag.image.src, spec);
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
    const spec = cropSpecFor(key);
    const reader = new FileReader();
    reader.onerror = () => showSaveHint("Die Bilddatei konnte nicht gelesen werden.");
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => showSaveHint("Die Bilddatei konnte nicht gelesen werden.");
      img.onload = () => {
        cropState.uid = uid;
        cropState.key = key;
        cropState.img = img;
        cropState.panX = 0.5;
        cropState.panY = 0.5;
        cropState.zoom = 1;
        const hint = cropOverlay.querySelector("[data-crop-hint]");
        if (hint) {
          hint.textContent = spec.mm && spec.mm.w < 200
            ? `${spec.label}: ${spec.mm.w} × ${spec.mm.h} mm. Nur dieser Ausschnitt landet im Memo.`
            : `${spec.label}: ${spec.w} × ${spec.h} Pixel. Nur dieser Ausschnitt landet auf der Folie.`;
        }
        const frame = cropFrameEl();
        if (frame) frame.style.aspectRatio = `${spec.w} / ${spec.h}`;
        const zoom = cropOverlay.querySelector("[data-crop-zoom]");
        if (zoom) zoom.value = "100";
        const el = cropImgEl();
        if (el) el.src = img.src;
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
    if (!state.busy && state.step !== "draft") return;
    state.cancelRequested = true;
    const id = state.assetId;
    state.busy = false;
    ladeTaktStop();
    state.step = "form";
    state.error = "";
    render();
    if (id) {
      try { await api("cancel_asset", { asset_id: id }); } catch { /* der Auftrag endet serverseitig */ }
    }
    if (state.draftsOpen) draftsTaktStart();
  }

  function pickFormImage(key) {
    state.pendingImage = `form::${key || "image"}`;
    fileInput.value = "";
    fileInput.click();
  }

  function pickImage(stageEl, key) {
    state.pendingImage = `${stageEl.getAttribute("data-uid")}::${key || "image"}`;
    fileInput.value = "";
    fileInput.click();
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    const pending = String(state.pendingImage || "");
    state.pendingImage = null;
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
  #as-overlay .as-slidetools, #as-overlay .as-fmt, #as-overlay .as-prev-nav, #as-overlay [data-as-chrome]{display:none !important;}
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
      clone.querySelectorAll(".em-page.is-off").forEach((node) => node.classList.remove("is-off"));
      if (clone.classList.contains("as-stage--memo")) clone.style.height = "891mm";
      return clone.outerHTML;
    });
  }

  function exportDocument() {
    const stages = exportStages().join("\n");
    const title = isMemo ? "Ansprache" : "LinkedIn-Asset";
    const post = !isMemo && state.postText.trim()
      ? `\n<!-- Beitragstext\n${state.postText.replace(/--+>/g, "-->")}\n-->`
      : "";
    const css = isMemo
      ? `${MEMO_TEMPLATE_CSS}\n${STAGE_CSS}`
      : `${ASSET_TEMPLATE_CSS}\n${STAGE_CSS}`;
    const printBreak = isMemo
      ? `.as-stage--memo{break-after:auto; page-break-after:auto;} .as-stage--memo .em-page{break-after:page; page-break-after:always;} .as-stage--memo .em-page:last-child{break-after:auto; page-break-after:auto;}`
      : `.as-stage{break-after:page; page-break-after:always;} .as-stage:last-of-type{break-after:auto; page-break-after:auto;}`;
    return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
html,body{margin:0;padding:0;}
body{background:#eef2f7; display:flex; flex-direction:column; align-items:center; gap:24px; padding:24px;}
@media print{body{background:#fff; gap:0; padding:0;}}
@page{${isMemo ? "size:A4; margin:0;" : "size:1080px 1350px; margin:0;"}}
@media print{${printBreak}}
${css}
</style>
</head>
<body>
${stages}${post}
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
      showSaveHint(`Folie ${ueber.join(", ")} läuft über den Rahmen (1080 px). Text kürzen, dann speichern.`);
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
    const fresh = normalizeSlide({ variant: "B", footer_left: state.slides[0]?.footerLeft || "ROOTS Consultants" });
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
    const hit = event.target.closest("[data-act]");
    if (!hit) return;
    const act = hit.getAttribute("data-act");
    const frame = hit.closest("[data-uid]");
    const id = frame ? frame.getAttribute("data-uid") : null;

    if (act === "close") {
      if (state.busy) { void cancelGenerate(); return; }
      if (state.step !== "form") {
        state.step = "form";
        state.error = "";
        render();
        if (state.draftsOpen) draftsTaktStart();
        return;
      }
      close();
      return;
    }
    if (act === "generate") { generate(); return; }
    if (act === "cancel-generate") { void cancelGenerate(); return; }
    if (act === "to-form") {
      state.busy = false;
      ladeTaktStop();
      state.step = "form";
      state.error = "";
      render();
      if (state.draftsOpen) draftsTaktStart();
      return;
    }
    if (act === "toggle-drafts") {
      state.draftsOpen = !state.draftsOpen;
      if (state.draftsOpen) draftsTaktStart();
      else draftsTaktStop();
      const box = shell.querySelector(".as-drafts");
      if (box) box.outerHTML = draftsHtml();
      else render();
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
    if (act === "toggle-layout") { state.ddOffen = !state.ddOffen; zeichneForm(); return; }
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
    if (act === "pick-art") {
      const wert = hit.getAttribute("data-value");
      const liste = gewaehlteArten();
      const i = liste.indexOf(wert);
      // Abwaehlen entfernt, Anwaehlen haengt an: die Reihenfolge der Auswahl ist
      // die Slidefolge, deshalb wird nicht sortiert.
      if (i >= 0) liste.splice(i, 1);
      else if (liste.length < Number(state.answers.slide_count || 4)) liste.push(wert);
      state.answers.slide_pick = liste.join(",");
      zeichneForm();
      return;
    }
    if (act === "pick-layout") {
      state.answers.variant = hit.getAttribute("data-value");
      state.ddOffen = false;
      zeichneForm();
      return;
    }
    if (act === "download") { download(); return; }
    if (act === "print") { harvest(); window.print(); return; }
    if (act === "save") { save(); return; }
    if (act === "copy-post") { copyPost(); return; }
    if (act === "crop-cancel") { cropOverlay.hidden = true; return; }
    if (act === "crop-ok") { confirmCrop(); return; }
    if (act === "bench-example") {
      BENCH_EXAMPLE.forEach((item, i) => {
        state.answers[`bench_${i}_name`] = item.name;
        state.answers[`bench_${i}_text`] = item.text;
        state.answers[`bench_${i}_tag`] = item.tag;
      });
      state.answers.benchmarks = "custom";
      state.formError = "Das ist nur die Form. Bitte Name, Handlung und Lehre durch Vorreiter zu diesem Signal ersetzen.";
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
      zeichneForm();
    }
  }

  function onInput(event) {
    const hit = event.target.closest("[data-act]");
    if (hit && hit.getAttribute("data-act") === "img-pos") {
      const stageEl = hit.closest("[data-stage]");
      const key = hit.getAttribute("data-imgkey") || "image";
      const slot = stageEl?.querySelector(`[data-imgslot][data-imgkey="${CSS.escape(key)}"]`);
      const img = slot?.querySelector("img") || stageEl?.querySelector("[data-imgslot] img");
      if (img) img.style.objectPosition = `50% ${hit.value}%`;
    }
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
    if (!editableOf(event.target)) fmtBar.setAttribute("data-open", "0");
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
  on(document, "keydown", onKeyDown, true);
  on(document, "selectionchange", onSelectionChange);
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
  openInstance = { close, lebt: () => overlay.isConnected };
  return openInstance;
}
