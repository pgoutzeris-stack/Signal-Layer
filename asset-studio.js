// Asset Studio: Fragebogen, Entwurf und Werkbank für LinkedIn-Assets und
// Ansprachen. Das Modul baut sein Overlay selbst und bringt die Stile
// der Bühne mit, weil die heruntergeladene HTML-Datei ohne die App auskommen
// muss und das App-Thema die Markenfarben sonst umfärben würde.

/* ─────────────────────────  Konstanten und Vorgaben  ───────────────────────── */

const LOGO_PATH = "assets/roots-logo.png";
const LOGO_SUBTITLE = "BRAND STRATEGY CONSULTANTS";
const FOOTER_DOMAIN = "roots-consultants.com";
const SAVE_LIMIT = 400000;

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
/** Was das Backend kennt. Layouts werden darauf abgebildet. */
const MODEL_VARIANTS = VARIANTS.map(([key]) => key);

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

const FORM_MEMO = [
  {
    key: "audience",
    label: "Adressat",
    options: [["geschaeftsfuehrung", "Geschäftsführung"], ["marketingleitung", "Marketingleitung"], ["vertrieb", "Vertrieb"], ["beirat", "Beirat"]],
  },
  {
    key: "focus",
    label: "Schwerpunkt",
    options: [["lage", "Lage und Anlass"], ["optionen", "Handlungsoptionen"], ["schritt", "Nächster Schritt"]],
  },
  { key: "scope", label: "Umfang", options: [["1", "Eine Seite"], ["2", "Zwei Seiten"]] },
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
    free: { key: "cta_text", on: "custom", rows: 2, platzhalter: "z. B. Termin abstimmen" },
  },
  { key: "note", label: "Vermerk", options: [["keiner", "ohne"], ["intern", "Vertraulich · nur intern"]] },
];

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
.as-stage--a4 .as-kpis{display:grid; grid-template-columns:repeat(3,1fr); gap:10px;}
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
/* Der Kasten traegt sein Seitenverhaeltnis selbst: so haengt die Vorschau nicht
   davon ab, ob die Hoehe von oben durchgereicht wird. */
#as-overlay .as-prev-big{width:100%; aspect-ratio:1080/1350; max-height:100%; min-height:240px;
  display:flex; align-items:flex-start; justify-content:center; overflow:hidden;
  border:1px solid var(--line,#e2e8f0); border-radius:14px; background:var(--surface,#f8fafc); padding:12px;}
#as-overlay .as-prev-big[data-kind="memo"]{aspect-ratio:794/1123;}
#as-overlay .as-prev-scale{display:block; transform-origin:top left; flex:0 0 auto;}
#as-overlay .as-prev-scale .as-stage{box-shadow:0 10px 30px rgba(15,23,42,.12);}
@container (max-width: 860px){
  #as-overlay .as-split2{grid-template-columns:1fr; grid-template-rows:auto minmax(220px, 40vh);}
  #as-overlay .as-split2-prev{position:static;}
}
/* Die Buehne aus der Vorlage traegt ihre Masse selbst, damit das Einpassen
   nicht auf einen zusammengefallenen Rahmen rechnet. */
#as-overlay .as-stage--tpl{width:1080px; height:1350px; flex:0 0 auto; overflow:hidden; border-radius:inherit;}

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
  display:flex; align-items:center; gap:4px; padding:3px 5px; background:#fff;
  border:1px solid var(--line,#e2e8f0); border-radius:99px; box-shadow:0 6px 18px rgba(15,23,42,.12);}
#as-overlay .as-prev-nav span{font-size:.7rem; font-weight:700; color:var(--muted,#475569); padding:0 4px;}
#as-overlay .as-prev-nav button{width:26px; height:26px; display:flex; align-items:center; justify-content:center;
  border:0; border-radius:50%; background:transparent; color:var(--brand,#206efb); font-size:.72rem;}
#as-overlay .as-prev-nav button:hover{background:var(--brand-light,#eff6ff);}
#as-overlay .as-prev-note{position:absolute; bottom:10px; right:14px; font-size:.7rem; font-weight:600;
  color:var(--muted,#475569); background:#fff; border:1px solid var(--line,#e2e8f0); border-radius:99px; padding:2px 8px;}
#as-overlay .as-prev-big{position:relative;}

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

/* Ladeanzeige: das Icon pulsiert leicht, sonst nichts. Die Schrittpunkte zeigen,
   wo der Auftrag steht - der Abschnitt kommt vom Auftrag selbst. */
#as-overlay .as-load{display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:14px; min-height:300px; text-align:center; padding:24px;}
#as-overlay .as-load-icon{color:var(--brand,#206efb); font-size:1.9rem; line-height:1;
  animation:as-atem 2s ease-in-out infinite;}
@keyframes as-atem{0%,100%{opacity:.55;} 50%{opacity:1;}}
#as-overlay .as-load-text{margin:0; font-size:1rem; font-weight:700; color:var(--ink,#0f172a);
  animation:as-auf .45s ease-out;}
@keyframes as-auf{from{opacity:0; transform:translateY(6px);} to{opacity:1; transform:none;}}
#as-overlay .as-load-steps{display:flex; align-items:center; gap:6px;}
#as-overlay .as-load-step{width:26px; height:4px; border-radius:99px; background:var(--line,#e2e8f0); transition:background .3s;}
#as-overlay .as-load-step.is-done{background:var(--brand,#206efb);}
#as-overlay .as-load-step.is-now{background:var(--brand,#206efb); animation:as-atem 1.4s ease-in-out infinite;}
#as-overlay .as-load-meta{margin:0; font-size:.76rem; color:var(--muted,#475569); font-variant-numeric:tabular-nums;}
@media (prefers-reduced-motion: reduce){
  #as-overlay .as-load-icon, #as-overlay .as-load-step.is-now, #as-overlay .as-load-text{animation:none; opacity:1;}
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

#as-overlay .as-work{display:grid; grid-template-columns:1fr 296px; gap:20px; align-items:start; min-height:100%;}
#as-overlay .as-stagearea{display:flex; flex-direction:column; gap:22px; align-items:center; min-width:0;}
#as-overlay .as-frame{width:100%; display:flex; flex-direction:column; gap:8px; align-items:center;}
#as-overlay .as-slidetools{
  width:100%; display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  background:var(--bg,#fff); border:1px solid var(--line,#e2e8f0); border-radius:12px; padding:8px 10px;
}
#as-overlay .as-slidetools .as-num{font-size:12px; font-weight:700; color:var(--muted,#475569); margin-right:4px;}
#as-overlay .as-slidetools select{
  font:inherit; font-size:13px; padding:6px 10px; border-radius:9px;
  border:1px solid var(--line,#e2e8f0); background:var(--bg,#fff); color:inherit;
}
#as-overlay .as-scaler{position:relative; margin:0 auto; box-shadow:var(--shadow-lg,0 12px 40px rgba(15,23,42,.14));}
#as-overlay .as-scaler > .as-stage{position:absolute; top:0; left:0; transform-origin:top left;}

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
#as-overlay .as-file{display:none;}

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

import { ASSET_TEMPLATE_CSS, ASSET_TEMPLATES, ASSET_LAYOUTS, ASSET_LAYOUT_LABELS } from "./asset-templates.js?v=20260815-1620";

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
  const questions = isMemo ? FORM_MEMO : FORM_LINKEDIN;
  const source = signal && typeof signal === "object" ? signal : {};
  const company = String(source.company || (toArray(source.tier1_companies)[0] || "")).trim();

  const state = {
    step: "form",
    answers: defaultAnswers(questions),
    payload: null,
    assetId: null,
    error: "",
    busy: false,
    logo: LOGO_PATH,
    stage: { theme: "light", accent: "brand", band: true, corners: "round" },
    slides: [],
    memo: null,
    postText: "",
    pendingImage: null,
    ddOffen: false,
    multiOffen: false,
    prevIndex: 0,
    ladeAbschnitt: "lesen",
    ladeStart: 0,
    ladeUhr: 0,
  };

  const cleanups = [];
  const overlay = document.createElement("div");
  overlay.id = "as-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", isMemo ? "Ansprache" : "LinkedIn-Asset");

  const styleIsland = document.createElement("style");
  styleIsland.textContent = `${CHROME_CSS}\n${ASSET_TEMPLATE_CSS}\n${STAGE_CSS}\n${printCss(isMemo)}`;
  overlay.appendChild(styleIsland);

  const shell = document.createElement("div");
  shell.style.display = "contents";
  overlay.appendChild(shell);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.className = "as-file";
  overlay.appendChild(fileInput);

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
      const back = `<button type="button" class="as-btn" data-act="to-form"><i class="fa-solid fa-sliders"></i>Fragebogen</button>`;
      if (state.busy || !state.payload) return back;
      return `${back}<button type="button" class="as-btn as-btn--primary" data-act="to-edit"><i class="fa-solid fa-pen-to-square"></i>Bearbeiten</button>`;
    }
    return `<button type="button" class="as-btn" data-act="to-draft"><i class="fa-solid fa-arrow-rotate-left"></i>Entwurf</button>`;
  }

  function stepContent() {
    if (state.step === "form") {
      // Links entscheiden, rechts sofort sehen. Die Vorschau ist dieselbe
      // Vorlage wie das spaetere Asset, nur mit Platzhaltertext.
      return `<div class="as-split2">
        <div class="as-split2-form">${formHtml()}</div>
        <div class="as-split2-prev">
          <span class="as-prev-label">Vorschau</span>
          <div class="as-prev-big" data-kind="${isMemo ? "memo" : "linkedin"}" data-livepreview>${livePreviewHtml()}</div>
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
      return `<div class="as-stagearea" data-stagearea></div>`;
    }
    return `<div class="as-work">
      <div class="as-stagearea" data-stagearea></div>
      ${inspectorHtml()}
    </div>`;
  }

  /* ── Schritt 1: Fragebogen ── */

  /** Grosse Vorschau rechts. Dieselbe Vorlage wie das Ergebnis, kein Modellaufruf. */
  function livePreviewHtml() {
    if (isMemo) return `<span class="as-prev-scale">${memoHtml(demoMemo(), false)}</span>`;
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
    const blaettern = carousel && arten.length > 1
      ? `<div class="as-prev-nav">
          <button type="button" data-act="prev-back" aria-label="Vorherige Slide"><i class="fa-solid fa-chevron-left"></i></button>
          <span>Slide ${state.prevIndex + 1} von ${arten.length}</span>
          <button type="button" data-act="prev-fwd" aria-label="Nächste Slide"><i class="fa-solid fa-chevron-right"></i></button>
        </div>`
      : "";
    return `<span class="as-prev-scale">${slideHtml(demoSlide(variante), false)}</span>${blaettern}`;
  }

  /**
   * Die Abschnitte kommen vom Auftrag selbst: er schreibt seinen Stand auf die
   * Zeile, das Studio liest ihn beim Abfragen. Ein Durchblaettern nach der Uhr
   * behauptet einen Fortschritt, den niemand kennt.
   */
  const ABSCHNITTE = [
    ["lesen", "fa-file-lines", "Signal und Artikel werden gelesen"],
    ["modell", "fa-brain", isMemo ? "Das Modell entwickelt die Ansprache" : "Das Modell schreibt Titel und Kernaussage"],
    ["pruefen", "fa-list-check", "Belege und Längen werden geprüft"],
    ["fuellen", "fa-wand-magic-sparkles", "Die Vorlage wird gefüllt"],
  ];

  function ladeanzeigeHtml() {
    const i = Math.max(0, ABSCHNITTE.findIndex(([key]) => key === state.ladeAbschnitt));
    const [, icon, text] = ABSCHNITTE[i];
    const sekunden = state.ladeStart ? Math.round((Date.now() - state.ladeStart) / 1000) : 0;
    const punkte = ABSCHNITTE.map((_, n) =>
      `<span class="as-load-step${n < i ? " is-done" : n === i ? " is-now" : ""}"></span>`).join("");
    return `<div class="as-load" role="status" aria-live="polite">
      <div class="as-load-icon"><i class="fa-solid ${icon}"></i></div>
      <p class="as-load-text">${esc(text)}</p>
      <div class="as-load-steps" aria-label="Schritt ${i + 1} von ${ABSCHNITTE.length}">${punkte}</div>
      <p class="as-load-meta">${sekunden} s</p>
    </div>`;
  }

  /** Nur die Sekunden laufen von selbst. Den Abschnitt meldet der Auftrag. */
  function ladeTaktStart() {
    ladeTaktStop();
    state.ladeStart = Date.now();
    state.ladeAbschnitt = "lesen";
    state.ladeUhr = window.setInterval(() => {
      if (!state.busy) { ladeTaktStop(); return; }
      const meta = shell.querySelector(".as-load-meta");
      if (meta && state.ladeStart) meta.textContent = `${Math.round((Date.now() - state.ladeStart) / 1000)} s`;
    }, 1_000);
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

  /** Ruhiger Platzhalter statt einer geratenen Kachel. */
  function platzhalterHtml() {
    return `<div class="as-prev-empty">
      <i class="fa-solid fa-wand-magic-sparkles"></i>
      <b>Das Modell wählt das Layout</b>
      <span>Vorschau erscheint nach „Entwurf erzeugen"</span>
    </div>`;
  }

  function demoMemo() {
    return normalizeMemo({
      title: "Der Anlass verlangt eine Entscheidung im Quartal",
      standfirst: "Ein Satz zur Lage, gefolgt von dem Beleg, der ihn traegt.",
      kpis: [{ value: "14 %", label: "Bezug, Jahr" }, { value: "6", label: "Wochen" }, { value: "3", label: "Rollen" }],
      situation: [{ lead: "Anlass", text: "Was gerade passiert ist." }, { lead: "Engstelle", text: "Woran es haengt." }],
      options: [{ name: "Weg A", pro: "Wirkt breit", contra: "Bindet Kapazitaet" }, { name: "Weg B", pro: "Schnell sichtbar", contra: "Engstelle bleibt" }],
      recommendation: "Die Empfehlung in einem Satz.",
      next_step: "Der naechste Schritt mit Verantwortlichkeit.",
      cta: "Termin abstimmen",
    });
  }

  /** Platzhalterinhalt, mit dem jedes Layout etwas zu zeigen hat. */
  function demoSlide(variant) {
    return normalizeSlide({
      variant,
      kicker: company ? company.toUpperCase().slice(0, 26) : "KICKER",
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
      takeaway: "**Der Kontrast:** Struktur ist Standard, entscheidend ist die Handschrift.",
      footer_left: company || "ROOTS Brand Strategy Consultants",
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
        ? `<textarea class="as-free" rows="${q.free.rows}" data-free="${attr(q.free.key)}" aria-label="${attr(q.label)}" placeholder="${attr(q.free.platzhalter || "")}">${esc(state.answers[q.free.key] || "")}</textarea>`
        : "";
      return `<div class="as-q"><label>${esc(q.label)}</label><div class="as-opts">${opts}</div>${free}</div>`;
    }).join("");
    return `<form class="as-form" data-form>${rows}</form>`;
  }

  /** Formular und Vorschau in einem Zug neu zeichnen. */
  function zeichneForm() {
    readForm();
    const form = shell.querySelector(".as-split2-form");
    if (form) form.innerHTML = formHtml();
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
  }

  /* ── Schritt 2: Entwurf erzeugen ── */

  async function generate() {
    readForm();
    state.step = "draft";
    state.busy = true;
    state.error = "";
    render();
    ladeTaktStart();
    try {
      const gewaehlt = state.answers.variant;
      const antworten = { ...state.answers, layout: gewaehlt };
      if (gewaehlt && !MODEL_VARIANTS.includes(gewaehlt) && gewaehlt !== "auto") antworten.variant = "B";
      const res = await api("generate_asset", {
        kind: assetKind,
        article_id: articleId || null,
        answers: antworten,
      });
      const row = res && typeof res === "object" ? (res.asset || res) : {};
      state.assetId = row.id || null;
      // Der Auftrag laeuft im Hintergrund weiter: ein Modellaufruf dauert laenger
      // als der Browser eine Anfrage offen haelt. Also fragen statt warten.
      const fertig = row.status === "running" ? await warteAufAsset(row.id) : row;
      if (fertig.status === "error") throw new Error(fertig.error_message || "Der Entwurf ist fehlgeschlagen.");
      state.assetId = fertig.id || state.assetId;
      adoptPayload(fertig.payload || fertig);
      state.busy = false;
      ladeTaktStop();
      render();
    } catch (err) {
      // Der Servertext ist die einzige belastbare Auskunft, deshalb wörtlich zeigen.
      state.busy = false;
      ladeTaktStop();
      state.error = (err && err.message) ? String(err.message) : String(err || "Unbekannter Fehler");
      state.payload = null;
      render();
    }
  }

  /** Fragt den Auftrag ab, bis er fertig ist. Bis zu sechs Minuten. */
  async function warteAufAsset(id) {
    // Muss ueber dem Zeitfenster des Modells liegen (bis 280 s beim
    // 6-Slide-Karussell), sonst gibt die Anzeige auf, waehrend der Auftrag
    // noch laeuft, und das fertige Ergebnis sieht niemand.
    const bis = Date.now() + 360_000;
    let wartezeit = 2_500;
    while (Date.now() < bis) {
      await new Promise((r) => setTimeout(r, wartezeit));
      wartezeit = Math.min(wartezeit + 500, 6_000);
      const res = await api("get_asset", { asset_id: id });
      const row = res && typeof res === "object" ? (res.asset || res) : {};
      ladeAbschnittSetzen(row.stage);
      if (row.status && row.status !== "running") return row;
    }
    throw new Error("Der Entwurf ist nach sechs Minuten nicht fertig geworden. Der Auftrag läuft weiter, versuche es in einer Minute erneut.");
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
      footerLeft: String(src.footer_left || company || "ROOTS Brand Strategy Consultants"),
      imageHint: String(src.image_hint || ""),
      counts: {
        stats: Math.max(3, stats.length || 0),
        steps: Math.max(3, steps.length || 0),
      },
      image: { src: "", pos: "50% 50%" },
      html: {},
    };
  }

  function normalizeMemo(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const kpis = toArray(src.kpis);
    const situation = toArray(src.situation);
    const options = toArray(src.options);
    return {
      uid: uid(),
      kicker: String(src.kicker || `Ansprache${company ? ` · ${company}` : ""}`),
      title: String(src.title || ""),
      standfirst: String(src.standfirst || ""),
      kpis: (kpis.length ? kpis : [{}, {}, {}]).slice(0, 3).map((item) => ({
        value: String(item?.value || ""),
        label: String(item?.label || ""),
      })),
      situation: (situation.length ? situation : [{}, {}, {}]).map((item) => ({
        lead: String(item?.lead || ""),
        text: String(item?.text || ""),
      })),
      options: (options.length ? options : [{}, {}]).map((item) => ({
        name: String(item?.name || ""),
        pro: String(item?.pro || ""),
        contra: String(item?.contra || ""),
      })),
      recommendation: String(src.recommendation || ""),
      nextStep: String(src.next_step || ""),
      cta: String(src.cta || ""),
      sources: toArray(src.sources).map((line) => String(line || "")),
      confidential: String(src.confidential || (state.answers.note === "intern" ? "Vertraulich · nur intern" : "")),
      html: {},
    };
  }

  /* ── Felder: Modellwert oder bereits bearbeitetes HTML ── */

  function fieldHtml(model, path, fallback = "") {
    const edited = model.html?.[path];
    if (typeof edited === "string") return edited;
    return esc(fallback);
  }

  function field(tag, cls, model, path, value, placeholder, extra = "") {
    return `<${tag} class="${cls} as-edit" data-field="${attr(path)}" data-ph="${attr(placeholder)}"${extra}>${fieldHtml(model, path, value)}</${tag}>`;
  }

  function lockup() {
    return `<span class="as-lockup"><img src="${attr(state.logo)}" alt="ROOTS"><span>${esc(LOGO_SUBTITLE)}</span></span>`;
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
      html = html.replace(/data-field="([a-z_]+)"/g, 'data-field="$1" contenteditable="true" spellcheck="false"');
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
      // Nur bei den Datenlayouts: die Zeile ueber dem Titel. Nicht den Kicker
      // wiederholen, der steht schon oben rechts in der Kachel.
      eyebrow: company ? `Abbildung · ${company}` : "Abbildung",
      image: slide.image.src || "",
    };
    return html.replace(/\{\{([a-z_]+)\}\}/g, (_m, name) => {
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
  function wrapImageSlots(html, slide) {
    const hat = Boolean(slide.image.src);
    const ui = `<div class="as-img-ui" data-as-chrome>
      <button type="button" data-act="img-pick">${hat ? "Bild ersetzen" : "Bild wählen"}</button>
      ${hat ? `<input type="range" min="0" max="100" step="1" value="${Number.parseFloat(String(slide.image.pos).split(" ")[1]) || 50}" data-act="img-pos" aria-label="Ausschnitt">` : ""}
      ${hat ? `<button type="button" data-act="img-clear">Entfernen</button>` : ""}
    </div>`;
    if (html.includes("data-imgsrc")) {
      return html.replace(/(<img[^>]*data-imgsrc[^>]*>)/, `<span class="as-img as-img--tpl" data-imgslot>$1${ui}</span>`);
    }
    // Hintergrundbild (Vollbild und Zitat ueber Bild): Slot als Auflage.
    if (/background-image:url\(/.test(html)) {
      return html.replace(/(<div style="position:absolute;inset:0;background-image:url\([^)]*\)[^"]*"><\/div>)/,
        `$1<span class="as-img as-img--bg" data-imgslot>${ui}</span>`);
    }
    return html;
  }

  function memoHtml(memo, editable = true) {
    const kpis = memo.kpis.map((item, i) => `<div class="as-kpi">
      ${field("p", "as-kpival", memo, `kpis.${i}.value`, item.value, "Zahl")}
      ${field("p", "as-kpilabel", memo, `kpis.${i}.label`, item.label, "Bezug")}
    </div>`).join("");
    const situation = memo.situation.map((item, i) => `<div class="as-point">
      ${field("p", "as-pointlead", memo, `situation.${i}.lead`, item.lead, "Punkt")}
      ${field("p", "as-pointtext", memo, `situation.${i}.text`, item.text, "Text")}
    </div>`).join("");
    const options = memo.options.map((item, i) => `<div class="as-option">
      ${field("p", "as-optname", memo, `options.${i}.name`, item.name, "Option")}
      <div class="as-optline"><i>Pro</i>${field("span", "as-optval", memo, `options.${i}.pro`, item.pro, "Argument")}</div>
      <div class="as-optline"><i>Contra</i>${field("span", "as-optval", memo, `options.${i}.contra`, item.contra, "Einwand")}</div>
    </div>`).join("");
    const sources = memo.sources.length || typeof memo.html["sources"] === "string"
      ? `<div class="as-sources"><b>Quellen</b>${field("div", "as-sourcelist", memo, "sources", memo.sources.join(" · "), "Quelle · Herausgeber · Jahr")}</div>`
      : "";
    const html = `<div class="as-stage as-stage--a4" data-stage data-uid="${attr(memo.uid)}" data-theme="${attr(state.stage.theme)}" data-accent="${attr(state.stage.accent)}" data-corners="${attr(state.stage.corners)}">
      <header class="as-head">
        ${lockup()}
        <div>
          ${field("p", "as-kicker", memo, "kicker", memo.kicker, "Ansprache")}
          ${memo.confidential ? field("span", "as-conf", memo, "confidential", memo.confidential, "Vermerk") : ""}
        </div>
      </header>
      ${field("h1", "as-title", memo, "title", memo.title, "Action Title")}
      ${field("p", "as-standfirst", memo, "standfirst", memo.standfirst, "Governing Thought")}
      <div class="as-kpis">${kpis}</div>
      <div class="as-cols">
        <section><h2 class="as-colhead">Lage und Anlass</h2>${situation}</section>
        <section><h2 class="as-colhead">Handlungsoptionen</h2>${options}</section>
      </div>
      ${state.stage.band ? `<div class="as-band">
        <div>
          <span class="as-bandhead">Empfehlung</span>
          ${field("p", "as-bandtext", memo, "recommendation", memo.recommendation, "Empfehlung")}
          ${field("p", "as-bandnext", memo, "next_step", memo.nextStep, "Nächster Schritt")}
        </div>
        ${field("span", "as-cta", memo, "cta", memo.cta, "CTA")}
      </div>` : ""}
      ${sources}
      <footer class="as-foot">
        <span>ROOTS Brand Strategy Consultants GmbH · ${esc(FOOTER_DOMAIN)}</span>
        ${field("span", "as-docid", memo, "doc_id", docId(), "Kennung")}
      </footer>
    </div>`;
    return editable ? html : html.replace(/ contenteditable="true"/g, "");
  }

  function docId() {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `Ansprache · ${stamp}`;
  }

  /* ── Bühnen einhängen und einpassen ── */

  function mountStages(editable) {
    const area = shell.querySelector("[data-stagearea]");
    if (!area) return;
    if (isMemo) {
      if (!state.memo) return;
      area.innerHTML = `<div class="as-frame"><div class="as-scaler">${memoHtml(state.memo)}</div></div>`;
    } else {
      if (!state.slides.length) return;
      area.innerHTML = state.slides.map((slide, index) => `
        <div class="as-frame" data-uid="${attr(slide.uid)}">
          ${editable ? slideTools(slide, index) : ""}
          <div class="as-scaler">${slideHtml(slide)}</div>
        </div>`).join("")
        + (editable && isCarousel()
          ? `<button type="button" class="as-btn as-btn--ghost" data-act="slide-add"><i class="fa-solid fa-plus"></i>Slide hinzufügen</button>`
          : "");
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
  }

  function slideTools(slide, index) {
    const opts = VARIANTS.map(([value, label]) => `<option value="${attr(value)}"${slide.variant === value ? " selected" : ""}>${esc(label)}</option>`).join("");
    // Die Variante lässt sich immer wechseln, die Slide-Verwaltung nur im Carousel.
    const manage = isCarousel() ? `
      <button type="button" class="as-btn as-btn--icon" data-act="slide-up" title="Nach oben" aria-label="Nach oben"><i class="fa-solid fa-arrow-up"></i></button>
      <button type="button" class="as-btn as-btn--icon" data-act="slide-down" title="Nach unten" aria-label="Nach unten"><i class="fa-solid fa-arrow-down"></i></button>
      <button type="button" class="as-btn as-btn--icon" data-act="slide-copy" title="Duplizieren" aria-label="Duplizieren"><i class="fa-regular fa-copy"></i></button>
      <button type="button" class="as-btn as-btn--icon" data-act="slide-del" title="Löschen" aria-label="Löschen"><i class="fa-regular fa-trash-can"></i></button>` : "";
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
    const inner = box?.querySelector(".as-prev-scale");
    const stage = inner?.querySelector(".as-stage");
    // Ohne Buehne steht dort der Platzhalter - nichts einzupassen.
    if (!box || !inner || !stage) return;
    const breite = box.clientWidth || 1;
    const hoehe = Math.max(box.clientHeight, 240);
    const w = stage.offsetWidth || (isMemo ? 794 : 1080);
    const h = stage.offsetHeight || (isMemo ? 1123 : 1350);
    const faktor = Math.min(breite / w, hoehe / h);
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
    const avail = Math.max(240, area.clientWidth);
    area.querySelectorAll(".as-scaler").forEach((scaler) => {
      const stage = scaler.querySelector(".as-stage");
      if (!stage) return;
      const w = stage.offsetWidth || 1080;
      const h = stage.offsetHeight || 1350;
      const scale = Math.min(1, avail / w);
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
      const slot = stage.querySelector("[data-imgslot]");
      if (slot && model.image) {
        const img = slot.querySelector("img");
        model.image = img
          ? { src: img.getAttribute("src") || "", pos: img.style.objectPosition || "50% 50%" }
          : { src: "", pos: model.image.pos };
      }
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

  function pickImage(stageEl) {
    state.pendingImage = stageEl.getAttribute("data-uid");
    fileInput.value = "";
    fileInput.click();
  }

  // Rohbilder aus der Kamera sprengen jedes Speicherlimit, deshalb einmal
  // herunterrechnen, bevor sie als Data-URI im Dokument landen.
  function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Die Bilddatei konnte nicht gelesen werden."));
      reader.onload = () => {
        const raw = String(reader.result || "");
        if (raw.length < 220000) { resolve(raw); return; }
        const img = new Image();
        img.onerror = () => resolve(raw);
        img.onload = () => {
          const max = 1400;
          const scale = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round((img.naturalWidth || max) * scale));
          canvas.height = Math.max(1, Math.round((img.naturalHeight || max) * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(raw); return; }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          try { resolve(canvas.toDataURL("image/jpeg", 0.82)); } catch (_) { resolve(raw); }
        };
        img.src = raw;
      };
      reader.readAsDataURL(file);
    });
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    const targetUid = state.pendingImage;
    state.pendingImage = null;
    if (!file || !targetUid) return;
    try {
      const dataUri = await readImage(file);
      harvest();
      const model = modelByUid(targetUid);
      if (model && model.image) model.image = { src: dataUri, pos: "50% 50%" };
      mountStages(state.step === "edit");
    } catch (err) {
      showSaveHint(err && err.message ? err.message : "Das Bild konnte nicht geladen werden.");
    }
  });

  /* ── Ausgabe ── */

  function printCss(memoKind) {
    const page = memoKind ? "size:A4; margin:0;" : "size:1080px 1350px; margin:0;";
    return `
@page{${page}}
@media print{
  body > *:not(#as-overlay){display:none !important;}
  #as-overlay{position:static !important; display:block !important; background:#fff !important; overflow:visible !important;}
  #as-overlay .as-rail, #as-overlay .as-topbar, #as-overlay .as-inspector,
  #as-overlay .as-slidetools, #as-overlay .as-fmt, #as-overlay [data-as-chrome]{display:none !important;}
  #as-overlay .as-main, #as-overlay .as-content{overflow:visible !important; padding:0 !important; border:0 !important;}
  #as-overlay .as-work{display:block !important;}
  #as-overlay .as-scaler{width:auto !important; height:auto !important; box-shadow:none !important;}
  #as-overlay .as-scaler > .as-stage{position:static !important; transform:none !important;}
  #as-overlay .as-stage{break-after:page; page-break-after:always;}
  #as-overlay .as-stagearea > .as-frame:last-of-type .as-stage{break-after:auto; page-break-after:auto;}
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
      return clone.outerHTML;
    });
  }

  function exportDocument() {
    const stages = exportStages().join("\n");
    const title = isMemo ? "Ansprache" : "LinkedIn-Asset";
    const post = !isMemo && state.postText.trim()
      ? `\n<!-- Beitragstext\n${state.postText.replace(/--+>/g, "-->")}\n-->`
      : "";
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
@media print{.as-stage{break-after:page; page-break-after:always;} .as-stage:last-of-type{break-after:auto; page-break-after:auto;}}
${STAGE_CSS}
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
    link.download = `${isMemo ? "entscheidervorlage" : "linkedin-asset"}-${stamp}.html`;
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
    const fresh = normalizeSlide({ variant: "B", footer_left: state.slides[0]?.footerLeft || company });
    state.slides.splice(after + 1, 0, fresh);
    mountStages(true);
  }

  function duplicateSlide(id) {
    harvest();
    const index = state.slides.findIndex((slide) => slide.uid === id);
    if (index < 0) return;
    const copy = JSON.parse(JSON.stringify(state.slides[index]));
    copy.uid = uid();
    state.slides.splice(index + 1, 0, copy);
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

    if (act === "close") { close(); return; }
    if (act === "generate") { generate(); return; }
    if (act === "to-form") { state.step = "form"; state.error = ""; render(); return; }
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
      const anzahl = Math.max(1, gewaehlteArten().length);
      const richtung = act === "prev-fwd" ? 1 : -1;
      state.prevIndex = (state.prevIndex + richtung + anzahl) % anzahl;
      const box = shell.querySelector("[data-livepreview]");
      if (box) box.innerHTML = livePreviewHtml();
      fitPreview();
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
    if (act === "img-pick" && stageEl) { pickImage(stageEl); return; }
    if (act === "img-clear" && stageEl) {
      harvest();
      const model = modelByUid(stageEl.getAttribute("data-uid"));
      if (model && model.image) model.image = { src: "", pos: "50% 50%" };
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
      const img = stageEl ? stageEl.querySelector("[data-imgslot] img") : null;
      if (img) img.style.objectPosition = `50% ${hit.value}%`;
    }
  }

  function onKeyDown(event) {
    if (event.key !== "Escape") return;
    // Ohne Stopp würde der Backdrop-Zweig der App das Artikel-Popup mitschließen.
    event.stopPropagation();
    event.preventDefault();
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
    while (cleanups.length) {
      const off = cleanups.pop();
      try { off(); } catch (_) { /* ein gescheitertes Abmelden darf den Abbau nicht stoppen */ }
    }
    ladeTaktStop();
    if (selectionFrame) window.cancelAnimationFrame(selectionFrame);
    if (fmtBar) fmtBar.remove();
    fmtBar = null;
    overlay.remove();
    if (!inHost) document.body.style.overflow = prevOverflow;
    openInstance = null;
  }

  render();
  openInstance = { close, lebt: () => overlay.isConnected };
  return openInstance;
}
