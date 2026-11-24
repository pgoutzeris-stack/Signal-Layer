// Suche und Entwurf-Filter in der Signal-Leiste, dazu die Ansicht "Content":
// alle fertigen Entwuerfe als Liste mit Filtern.
// Die Signal-Filter arbeiten auf den gerenderten Karten, damit sie in beiden
// Modi (einfach und erweitert) ohne Eingriff in deren Render-Logik greifen.

const CACHE_MS = 60_000;
const CONTENT_CACHE_KEY = "sl-content-v1";

function inhalteAusSpeicher() {
  try {
    const liste = JSON.parse(localStorage.getItem(CONTENT_CACHE_KEY) || "null");
    return Array.isArray(liste) ? liste : null;
  } catch { return null; }
}
let callApi = null;
let escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let oeffneEntwurf = null;
let cache = { zeit: 0, daten: null, laeuft: null };
const signalFilter = { text: "", nurEntwurf: false };
const contentFilter = { text: "", lane: "all", kind: "all", status: "all", person: "all" };

export async function ladeInhalte(neu = false) {
  if (!neu && cache.daten && Date.now() - cache.zeit < CACHE_MS) return cache.daten;
  if (cache.laeuft) return cache.laeuft;
  cache.laeuft = (async () => {
    try {
      const res = await callApi("list_contents", {});
      cache.daten = Array.isArray(res?.contents) ? res.contents : [];
      cache.zeit = Date.now();
      try {
        const text = JSON.stringify(cache.daten);
        if (text.length < 2_000_000) localStorage.setItem(CONTENT_CACHE_KEY, text);
      } catch { /* Speicher voll oder gesperrt */ }
      return cache.daten;
    } finally {
      cache.laeuft = null;
    }
  })();
  return cache.laeuft;
}

function norm(text) {
  return String(text || "").toLocaleLowerCase("de").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/* ---------- Signal-Leiste ---------- */

function css() {
  if (document.getElementById("cl-css")) return;
  const stil = document.createElement("style");
  stil.id = "cl-css";
  stil.textContent = `
.cl-suche{position:relative; height:34px; width:34px; border:1px solid var(--line); border-radius:999px; background:var(--bg); display:flex; align-items:center; overflow:hidden; transition:width .22s ease, box-shadow .16s, border-color .16s; box-shadow:0 2px 7px rgba(15,23,42,.035); flex:0 0 auto;}
.cl-suche i{position:absolute; left:11px; font-size:.78rem; color:var(--muted); pointer-events:none;}
.cl-suche input{border:0; outline:0; background:transparent; font:inherit; font-size:.74rem; color:var(--ink); width:100%; height:100%; padding:0 12px 0 31px; cursor:pointer;}
.cl-suche--offen{width:230px;}
.cl-suche:hover, .cl-suche:focus-within, .cl-suche.is-aktiv{width:230px; border-color:color-mix(in srgb, var(--brand) 48%, var(--line)); box-shadow:var(--shadow-focus);}
.cl-suche:hover input, .cl-suche:focus-within input, .cl-suche.is-aktiv input{cursor:text;}
.cl-pill{height:34px; padding:0 13px; border:1px solid var(--line); border-radius:999px; background:var(--bg); color:var(--status-text, var(--muted)); display:inline-flex; align-items:center; gap:7px; font:inherit; font-size:.72rem; font-weight:650; cursor:pointer; white-space:nowrap; flex:0 0 auto; transition:border-color .16s, color .16s, background .16s;}
.cl-pill:hover{color:var(--ink); border-color:color-mix(in srgb, var(--brand) 48%, var(--line));}
.cl-pill.is-an{color:var(--brand-dark,#165fd9); background:var(--brand-light,#eff6ff); border-color:#bfdbfe;}
.cl-leer{padding:1rem; color:var(--muted); font-size:.85rem;}
.cl-view-head{display:flex; align-items:center; justify-content:space-between; gap:12px; margin:0 0 1rem;}
.cl-view-head h2{margin:0;}
.cl-bar{flex-wrap:wrap;}
.cl-bar select{height:34px; padding:0 12px; border:1px solid var(--line); border-radius:999px; background:var(--bg); color:var(--ink); font:inherit; font-size:.72rem; font-weight:650; cursor:pointer;}
.cl-liste{display:flex; flex-direction:column; background:var(--bg); border:1px solid var(--line); border-radius:14px; overflow:hidden; box-shadow:var(--shadow-dash);}
.cl-zeile{display:grid; font-size:inherit; grid-template-columns:minmax(0,1fr) 120px 150px 150px 96px; gap:14px; align-items:center; padding:12px 16px; border-bottom:1px solid var(--line); cursor:pointer; text-align:left; background:transparent; border-left:0; border-right:0; border-top:0; font:inherit; color:var(--ink); width:100%;}
.cl-zeile:last-child{border-bottom:0;}
.cl-zeile:hover{background:color-mix(in srgb, var(--brand) 4%, var(--bg));}
.cl-kopf{cursor:default; font-size:.7rem; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; background:var(--surface,#f8fafc);}
.cl-kopf:hover{background:var(--surface,#f8fafc);}
.cl-titel{min-width:0;}
.cl-titel b{display:block; font-size:.86rem; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.cl-titel span{display:block; font-size:.74rem; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;}
.cl-tag{display:inline-flex; align-items:center; gap:6px; font-size:.72rem; font-weight:650; padding:3px 9px; border-radius:999px; background:var(--surface,#f1f5f9); color:var(--ink); width:max-content;}
.cl-tag--sales{background:#fef3c7; color:#92400e;}
.cl-tag--marketing{background:#e0ecff; color:#1e4fb8;}
.cl-tag--owned{background:#dcfce7; color:#166534;}
.cl-person{display:flex; align-items:center; gap:8px; font-size:.78rem; min-width:0;}
.cl-person img, .cl-person .cl-ini{width:24px; height:24px; border-radius:50%; object-fit:cover; flex:0 0 auto; background:#e2e8f0; display:grid; place-items:center; font-size:.62rem; font-weight:700; color:#475569;}
.cl-person span{overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.cl-gruppe{border-bottom:1px solid var(--line); background:color-mix(in srgb, var(--brand) 2.5%, var(--bg));}
.cl-gruppe:last-child{border-bottom:0;}
.cl-gruppe-kopf{display:flex; align-items:center; gap:10px; padding:12px 16px 6px; font-size:.76rem; color:var(--muted);}
.cl-gruppe-kopf b{color:var(--ink); font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0;}
.cl-gruppe-kopf span{flex:0 0 auto;}
.cl-zeile--gruppe{position:relative; padding-left:46px; border-bottom:0; background:transparent;}
/* Baumlinie: vom Gruppenkopf nach unten, je Entwurf ein Abzweig mit Pfeilspitze. */
.cl-zeile--gruppe::before{content:""; position:absolute; left:24px; top:0; height:50%; width:12px; border-left:1.5px solid #cbd5e1; border-bottom:1.5px solid #cbd5e1; border-bottom-left-radius:7px;}
.cl-zeile--gruppe:not(:last-child)::after{content:""; position:absolute; left:24px; top:50%; bottom:0; border-left:1.5px solid #cbd5e1;}
.cl-zeile--gruppe .cl-titel::before{content:""; position:absolute; left:35px; top:50%; width:0; height:0; margin-top:-3.5px; border-left:5px solid #cbd5e1; border-top:3.5px solid transparent; border-bottom:3.5px solid transparent;}
.cl-zeile--gruppe:last-child{padding-bottom:12px;}
.cl-datum{font-size:.74rem; color:var(--muted); font-variant-numeric:tabular-nums;}
@media (max-width:900px){.cl-zeile{grid-template-columns:minmax(0,1fr) 110px;} .cl-zeile > :nth-child(n+3){display:none;}}`;
  document.head.appendChild(stil);
}

let entwurfArtikel = null;
const signalHoerer = new Set();

/** Listen der Signale melden sich hier an und zeichnen bei jeder Aenderung neu. */
export function beiSignalFilter(cb) {
  signalHoerer.add(cb);
}

export function signalFilterAktiv() {
  return Boolean(signalFilter.text.trim()) || signalFilter.nurEntwurf;
}

/** Passt ein Signal zu Suche und "Mit Entwurf"? Titel wie auf der Karte. */
export function signalPasst(articleId, titel) {
  const text = norm(signalFilter.text.trim());
  if (text && !norm(titel).includes(text)) return false;
  if (signalFilter.nurEntwurf && entwurfArtikel && !entwurfArtikel.has(String(articleId || ""))) return false;
  return true;
}

async function signaleFiltern() {
  if (signalFilter.nurEntwurf) {
    const inhalte = await ladeInhalte().catch(() => []);
    entwurfArtikel = new Set(inhalte.map((i) => String(i.article_id || "")));
  }
  signalHoerer.forEach((cb) => { try { cb(); } catch (_) { /* eine Liste darf die andere nicht stoppen */ } });
}

function leisteEinbauen(toolbar) {
  if (!toolbar || toolbar.querySelector(".cl-suche")) return;
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex; align-items:center; gap:6px; flex:0 0 auto;";
  wrap.innerHTML = `<label class="cl-suche cl-suche--signal" title="Signale suchen"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" placeholder="Signal suchen" aria-label="Signale nach Titel suchen"></label>
    <button type="button" class="cl-pill" aria-pressed="false"><i class="fa-regular fa-file-lines"></i>Mit Entwurf</button>`;
  const status = toolbar.querySelector(".crawl-trigger-wrap");
  if (status) toolbar.insertBefore(wrap, status);
  else toolbar.appendChild(wrap);
  const suche = wrap.querySelector(".cl-suche");
  const feld = wrap.querySelector("input");
  feld.value = signalFilter.text;
  feld.addEventListener("input", () => {
    signalFilter.text = feld.value;
    document.querySelectorAll(".cl-suche--signal input").forEach((f) => { if (f !== feld) f.value = feld.value; });
    document.querySelectorAll(".cl-suche--signal").forEach((s) => s.classList.toggle("is-aktiv", Boolean(feld.value.trim())));
    void signaleFiltern();
  });
  suche.classList.toggle("is-aktiv", Boolean(signalFilter.text.trim()));
  const pill = wrap.querySelector(".cl-pill");
  pill.addEventListener("click", () => {
    signalFilter.nurEntwurf = !signalFilter.nurEntwurf;
    document.querySelectorAll(".cl-pill[aria-pressed]").forEach((p) => {
      p.classList.toggle("is-an", signalFilter.nurEntwurf);
      p.setAttribute("aria-pressed", String(signalFilter.nurEntwurf));
    });
    void signaleFiltern();
  });
}

/* ---------- Ansicht Content ---------- */

function datum(wert) {
  const d = new Date(wert || 0);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function personHtml(p) {
  if (!p) return '<span class="cl-datum">offen</span>';
  const ini = String(p.short_name || p.name || "?").slice(0, 2).toUpperCase();
  const bild = p.avatar_url ? `<img src="${escapeHtml(p.avatar_url)}" alt="">` : `<span class="cl-ini">${escapeHtml(ini)}</span>`;
  return `<span class="cl-person">${bild}<span>${escapeHtml(p.name || "")}</span></span>`;
}

function artLabel(i) {
  if (i.kind === "memo") return "Executive Memo";
  const typ = i.asset_type === "carousel" ? "Carousel" : "Post";
  return `LinkedIn ${typ}${i.profile === "private" ? " · Privat" : i.profile === "roots" ? " · ROOTS" : ""}`;
}

function contentGefiltert(liste) {
  const text = norm(contentFilter.text.trim());
  return liste.filter((i) => {
    if (contentFilter.lane !== "all" && i.lane !== contentFilter.lane) return false;
    if (contentFilter.kind !== "all" && i.kind !== contentFilter.kind) return false;
    if (contentFilter.status === "owned" && !i.owner) return false;
    if (contentFilter.status === "draft" && i.owner) return false;
    if (contentFilter.person !== "all" && i.author?.user_id !== contentFilter.person && i.owner?.user_id !== contentFilter.person) return false;
    if (text && !norm(`${i.title} ${i.signal_title} ${i.article_title} ${i.company}`).includes(text)) return false;
    return true;
  });
}

function zeichneListe(root, liste) {
  const ziel = root.querySelector(".cl-liste");
  const zahl = root.querySelector(".cl-zahl");
  const sichtbar = contentGefiltert(liste);
  zahl.textContent = sichtbar.length === liste.length ? String(liste.length) : `${sichtbar.length} von ${liste.length}`;
  if (!sichtbar.length) {
    ziel.innerHTML = `<div class="cl-leer">${liste.length ? "Kein Content entspricht den Filtern." : "Noch kein Content."}</div>`;
    return;
  }
  // Entwuerfe zum selben Signal stehen zusammen, die Gruppe mit dem neuesten
  // Entwurf zuerst. Ab zwei Entwuerfen traegt die Gruppe einen Kopf.
  const gruppen = new Map();
  sichtbar.forEach((i) => {
    const schluessel = String(i.article_id || i.id);
    if (!gruppen.has(schluessel)) gruppen.set(schluessel, []);
    gruppen.get(schluessel).push(i);
  });
  const zeile = (i, inGruppe) => {
    const titel = i.title || i.signal_title || i.article_title || "Ohne Titel";
    const unter = inGruppe ? artLabel(i) : [artLabel(i), i.signal_title || i.article_title].filter(Boolean).join(" · ");
    const lane = i.lane === "sales" ? '<span class="cl-tag cl-tag--sales">Sales</span>' : i.lane === "marketing" ? '<span class="cl-tag cl-tag--marketing">Marketing</span>' : '<span class="cl-datum">ohne Signal</span>';
    return `<button type="button" class="cl-zeile${inGruppe ? " cl-zeile--gruppe" : ""}" data-cl-id="${escapeHtml(i.id)}">
      <span class="cl-titel"><b>${escapeHtml(titel)}</b><span>${escapeHtml(unter)}</span></span>
      <span>${lane}</span>
      <span>${personHtml(i.author)}</span>
      <span>${i.owner ? personHtml(i.owner) : '<span class="cl-tag">Entwurf</span>'}</span>
      <span class="cl-datum">${escapeHtml(datum(i.updated_at || i.created_at))}</span>
    </button>`;
  };
  const teile = [...gruppen.values()].map((liste) => {
    if (liste.length === 1) return zeile(liste[0], false);
    const erste = liste[0];
    return `<div class="cl-gruppe"><div class="cl-gruppe-kopf"><b>${escapeHtml(erste.signal_title || erste.article_title || "Signal")}</b></div>${liste.map((i) => zeile(i, true)).join("")}</div>`;
  });
  ziel.innerHTML = `<div class="cl-zeile cl-kopf"><span>Content</span><span>Bereich</span><span>Erstellt von</span><span>Übernommen von</span><span>Stand</span></div>${teile.join("")}`;
}

let contentRoot = null;
let contentDaten = [];

export async function zeigeContent(neu = true) {
  const root = contentRoot;
  if (!root) return;
  const ziel = root.querySelector(".cl-liste");
  // Letzter Stand sofort, frische Daten danach.
  if (!contentDaten.length) {
    const gespeichert = cache.daten || inhalteAusSpeicher();
    if (gespeichert?.length) {
      contentDaten = gespeichert;
      personenFuellen(root);
      zeichneListe(root, contentDaten);
    } else {
      ziel.innerHTML = '<div class="roots-loader" role="status" aria-label="Wird geladen"></div>';
    }
  }
  try {
    contentDaten = await ladeInhalte(neu);
  } catch (err) {
    if (contentDaten.length) return;
    ziel.innerHTML = `<div class="cl-leer">${escapeHtml(err?.message || "Content konnte nicht geladen werden.")}</div>`;
    return;
  }
  personenFuellen(root);
  zeichneListe(root, contentDaten);
}

function personenFuellen(root) {
  const personen = new Map();
  contentDaten.forEach((i) => [i.author, i.owner].forEach((p) => { if (p?.user_id) personen.set(p.user_id, p.name); }));
  const select = root.querySelector('[data-cl="person"]');
  select.innerHTML = `<option value="all">Alle Personen</option>${[...personen].sort((a, b) => String(a[1]).localeCompare(String(b[1]), "de"))
    .map(([id, name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join("")}`;
  if (!personen.has(contentFilter.person)) contentFilter.person = "all";
  select.value = contentFilter.person;
}

function contentAnsichtBauen(root) {
  root.innerHTML = `<nav class="signal-toolbar" aria-label="Content filtern">
      <span class="signal-toolbar-label"><i class="fa-solid fa-pen-nib"></i> Content <span class="track-count cl-zahl">0</span></span>
      <div class="signal-toolbar-controls">
        <select class="signal-toolbar-select" id="cl-lane" data-cl="lane" aria-label="Bereich filtern"><option value="all">Marketing und Sales</option><option value="marketing">Marketing</option><option value="sales">Sales</option></select>
        <select class="signal-toolbar-select" id="cl-kind" data-cl="kind" aria-label="Art filtern"><option value="all">Alle Arten</option><option value="linkedin">LinkedIn</option><option value="memo">Executive Memo</option></select>
        <select class="signal-toolbar-select" id="cl-stand" data-cl="status" aria-label="Stand filtern"><option value="all">Entwurf und übernommen</option><option value="draft">Nur Entwürfe</option><option value="owned">Nur übernommen</option></select>
        <select class="signal-toolbar-select" id="cl-person" data-cl="person" aria-label="Person filtern"><option value="all">Alle Personen</option></select>
      </div>
      <div style="display:flex; align-items:center; gap:6px; flex:0 0 auto;">
        <label class="cl-suche" title="Content suchen"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" data-cl="text" placeholder="Content suchen" aria-label="Content suchen"></label>
      </div>
    </nav>
    <div class="cl-liste"></div>`;
  root.querySelector('[data-cl="text"]').addEventListener("input", (e) => {
    contentFilter.text = e.target.value;
    e.target.closest(".cl-suche").classList.toggle("is-aktiv", Boolean(e.target.value.trim()));
    zeichneListe(root, contentDaten);
  });
  root.querySelectorAll("select[data-cl]").forEach((sel) => {
    sel.value = contentFilter[sel.dataset.cl];
    sel.addEventListener("change", () => { contentFilter[sel.dataset.cl] = sel.value; zeichneListe(root, contentDaten); });
  });
  root.querySelector(".cl-liste").addEventListener("click", (e) => {
    const zeile = e.target.closest("[data-cl-id]");
    if (!zeile) return;
    const eintrag = contentDaten.find((i) => String(i.id) === zeile.dataset.clId);
    if (eintrag && oeffneEntwurf) oeffneEntwurf(eintrag);
  });
}

/**
 * @param {{callApi: Function, escapeHtml?: Function, contentRoot: HTMLElement, openDraft: (eintrag) => void}} optionen
 */
export function initContentListe(optionen) {
  callApi = optionen.callApi;
  if (typeof optionen.escapeHtml === "function") escapeHtml = optionen.escapeHtml;
  oeffneEntwurf = optionen.openDraft;
  contentRoot = optionen.contentRoot || null;
  css();
  document.querySelectorAll("#view-results .signal-toolbar, #view-simple-results .signal-toolbar").forEach(leisteEinbauen);
  if (contentRoot) contentAnsichtBauen(contentRoot);
  // Im Hintergrund vorladen: Content und "Mit Entwurf" sind dann sofort da.
  const spaeter = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
  spaeter(() => { void ladeInhalte().catch(() => {}); });
}
