// ---------------------------------------------------------------------------
// Signal Layer — Frontend des einfachen Modus ("Simple")
//
// Diese Datei ist der komplette einfache Modus im Browser. Wer die einfache
// Oberfläche ändern will, ändert nur diese Datei; app.js bleibt der Advanced-
// Modus. Verbindung nach app.js ausschliesslich über init(context) — dadurch
// gibt es keine gegenseitigen Importe.
//
// Die Regeln selbst stehen serverseitig in
// supabase/functions/signal-layer/pipeline-simple.ts. Diese Oberfläche zeigt
// nur, was der Server entschieden hat. Gestartet wird der Lauf ausschliesslich
// im Backend (siehe process_simple_run / Watchdog) - diese Oberfläche hat kein
// Bedienelement dafür und zeigt den laufenden Fortschritt nur an.
// ---------------------------------------------------------------------------

let ctx = null;
let els = {};
let bound = false;
let running = false;
let rulesLoaded = false;
let lastRun = null;
let pollTimer = null;
let simpleRules = null;
const signalsByLane = { marketing: [], sales: [] };
let rejectedRows = [];

function el(id) {
  return document.getElementById(id);
}

function cacheEls() {
  els = {
    view: el("view-simple"),
    articleTypeFilter: el("simple-article-type-filter"),
    sourceFilter: el("simple-source-filter"),
    sort: el("simple-sort"),
    marketingList: el("simple-list-marketing"),
    salesList: el("simple-list-sales"),
    marketingCount: el("simple-marketing-count"),
    salesCount: el("simple-sales-count"),
    rejectedList: el("simple-rejected-list"),
    rejectedCount: el("simple-rejected-count"),
  };
}

const LOADER = '<div class="roots-loader" role="status" aria-label="Wird geladen"></div>';

function esc(value) {
  return ctx.escapeHtml(String(value ?? ""));
}

function escText(value) {
  return ctx.escapeText(String(value ?? ""));
}

function formatDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function sourceOf(article) {
  const source = Array.isArray(article?.source) ? article.source[0] : article?.source;
  return source || null;
}

// ---------------------------------------------------------------------------
// Rendern
// ---------------------------------------------------------------------------
function signalCard(signal) {
  const article = signal.article || {};
  const source = sourceOf(article);
  const title = signal.headline_de || article.title_de || article.title || article.url || "Ohne Titel";
  return `
    <article class="finding-item" data-simple-url="${esc(article.url || "")}" tabindex="0" role="button">
      <div class="finding-item-top">
        <span class="finding-dimension">${esc(signal.signal_label || signal.signal_id || "Signal")}</span>
        <div class="finding-top-tags">
          <span class="quality-tag quality-tag--reliable"><i class="fa-solid fa-chart-line"></i> Nutzwert · ${esc(signal.score ?? 0)}</span>
          ${article.published_at ? `<span class="finding-date-tag">${esc(formatDate(article.published_at))}</span>` : ""}
        </div>
      </div>
      <span class="finding-title">${escText(title)}</span>
      ${signal.why_de ? `<p class="simple-signal-why">${escText(signal.why_de)}</p>` : ""}
      ${signal.evidence ? `<q class="simple-signal-evidence">${escText(signal.evidence)}</q>` : ""}
      <div class="finding-meta">
        ${signal.company ? `<span class="tag tag--kunde"><i class="fa-solid fa-building"></i> ${esc(signal.company)}</span>` : ""}
        ${source?.company ? `<span class="tag tag--source"><i class="fa-solid fa-newspaper"></i> ${esc(source.company)}</span>` : ""}
      </div>
    </article>
  `;
}

function signalSourceName(signal) {
  return sourceOf(signal.article)?.company || "";
}

function signalDate(signal) {
  return new Date(signal.article?.published_at || signal.updated_at || 0).getTime() || 0;
}

// Gleiche Filter- und Sortierlogik wie im Advanced-Modus, nur auf den Feldern
// des einfachen Modus (Nutzwert statt Relevanzscore).
function visibleSignals(lane) {
  const state = ctx.viewState;
  const filtered = signalsByLane[lane].filter((signal) => {
    const typeOk = state.articleTypes.length === 0 || state.articleTypes.includes(signal.article?.article_type);
    const sourceOk = state.sources.length === 0 || state.sources.includes(signalSourceName(signal));
    return typeOk && sourceOk;
  });
  return [...filtered].sort((a, b) => {
    if (state.sort === "newest") return signalDate(b) - signalDate(a) || Number(b.score || 0) - Number(a.score || 0);
    if (state.sort === "confidence") return Number(b.confidence || 0) - Number(a.confidence || 0) || Number(b.score || 0) - Number(a.score || 0);
    return Number(b.score || 0) - Number(a.score || 0) || signalDate(b) - signalDate(a);
  });
}

function refreshFilterOptions() {
  const all = [...signalsByLane.marketing, ...signalsByLane.sales];
  const types = [...new Set(all.map((signal) => signal.article?.article_type).filter(Boolean))]
    .sort((a, b) => (ctx.articleTypeLabels[a] || a).localeCompare(ctx.articleTypeLabels[b] || b, "de"));
  const sources = [...new Set(all.map(signalSourceName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));
  if (els.articleTypeFilter) {
    els.articleTypeFilter.innerHTML = `<option value="all">Alle Artikeltypen</option>${types
      .map((type) => `<option value="${esc(type)}">${esc(ctx.articleTypeLabels[type] || type)}</option>`).join("")}`;
    ctx.pruneSelection(ctx.viewState.articleTypes, types);
  }
  if (els.sourceFilter) {
    els.sourceFilter.innerHTML = `<option value="all">Alle Quellen</option>${sources
      .map((source) => `<option value="${esc(source)}">${esc(source)}</option>`).join("")}`;
    ctx.pruneSelection(ctx.viewState.sources, sources);
  }
}

function renderLane(lane) {
  const list = lane === "sales" ? els.salesList : els.marketingList;
  const count = lane === "sales" ? els.salesCount : els.marketingCount;
  if (!list) return;
  const signals = visibleSignals(lane);
  count.textContent = signals.length.toLocaleString("de-DE");
  list.innerHTML = signals.length
    ? signals.map(signalCard).join("")
    : `<div class="track-card-empty">Keine Signale entsprechen den gewählten Filtern.</div>`;
}

function renderRejected(articles, rejectLabels) {
  if (!els.rejectedList) return;
  els.rejectedCount.textContent = articles.length.toLocaleString("de-DE");
  els.rejectedList.innerHTML = articles.length
    ? articles.map((row) => {
      const article = row.article || {};
      const source = sourceOf(article);
      const reason = rejectLabels?.[row.reject_reason] || row.reject_reason || "Ohne Begründung";
      return `
        <div class="simple-rejected-item" data-simple-url="${esc(article.url || "")}" tabindex="0" role="button">
          <strong>${escText(article.title_de || article.title || article.url || "Ohne Titel")}</strong>
          <small><i class="fa-solid fa-circle-info"></i> ${escText(reason)}${source?.company ? ` · ${esc(source.company)}` : ""}</small>
        </div>
      `;
    }).join("")
    : `<div class="track-card-empty">Nichts aussortiert.</div>`;
}

// ---------------------------------------------------------------------------
// Daten laden
// ---------------------------------------------------------------------------
// Nur die Beschriftungen der Ablehnungsgründe werden gebraucht; die Regeln
// selbst leben in pipeline-simple.ts.
async function loadRules() {
  if (rulesLoaded) return;
  try {
    const { rules } = await ctx.callApi("get_simple_rules");
    rulesLoaded = true;
    simpleRules = rules;
  } catch (_error) {
    /* Ergebnisse werden auch ohne die Beschriftungen angezeigt */
  }
}

async function loadResults({ keepStatus = false } = {}) {
  try {
    const [marketing, sales, rejected, status] = await Promise.all([
      ctx.callApi("list_simple_signals", { lane: "marketing", limit: 60 }),
      ctx.callApi("list_simple_signals", { lane: "sales", limit: 60 }),
      ctx.callApi("list_simple_rejected", { limit: 60 }),
      ctx.callApi("get_simple_run_status"),
    ]);
    signalsByLane.marketing = marketing.signals || [];
    signalsByLane.sales = sales.signals || [];
    rejectedRows = rejected.articles || [];
    refreshFilterOptions();
    renderLane("marketing");
    renderLane("sales");
    renderRejected(rejectedRows, simpleRules?.reject_labels);
    if (!keepStatus) {
      lastRun = status.run || null;
      running = lastRun?.status === "running";
      ctx.setSimpleRunStatus(lastRun, status.forecast || null);
    }
  } catch (error) {
    ctx.toast(error.message || "Ergebnisse konnten nicht geladen werden", "err");
  }
}

// Der Lauf selbst läuft im Backend. Solange er läuft, wird der Fortschritt
// nachgeladen; danach genügt ein langsamer Takt, um einen im Backend gestarteten
// Lauf zu bemerken.
const POLL_ACTIVE_MS = 12_000;
const POLL_IDLE_MS = 60_000;

function scheduleStatusPoll() {
  if (pollTimer) clearTimeout(pollTimer);
  if (!document.body.classList.contains("mode-simple")) return;
  pollTimer = setTimeout(() => void pollStatus(), running ? POLL_ACTIVE_MS : POLL_IDLE_MS);
}

async function pollStatus() {
  if (!document.body.classList.contains("mode-simple")) return;
  try {
    const status = await ctx.callApi("get_simple_run_status");
    const previous = lastRun;
    lastRun = status.run || null;
    running = lastRun?.status === "running";
    ctx.setSimpleRunStatus(lastRun, status.forecast || null);
    const advanced = Number(lastRun?.processed_count || 0) !== Number(previous?.processed_count || 0);
    const finished = previous?.status === "running" && lastRun?.status !== "running";
    if (advanced || finished || lastRun?.id !== previous?.id) await loadResults({ statusOnly: false, keepStatus: true });
  } catch (_error) {
    /* nächster Takt versucht es erneut */
  }
  scheduleStatusPoll();
}

function bindUi() {
  if (bound) return;
  bound = true;
  const rerender = () => {
    ctx.viewState.sort = els.sort?.value || "recommended";
    renderLane("marketing");
    renderLane("sales");
  };
  [els.articleTypeFilter, els.sourceFilter, els.sort].forEach((control) => control?.addEventListener("change", rerender));
  els.view?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-simple-url]");
    if (card?.dataset.simpleUrl) ctx.openExternalUrl(card.dataset.simpleUrl);
  });
  els.view?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest("[data-simple-url]");
    if (card?.dataset.simpleUrl) {
      event.preventDefault();
      ctx.openExternalUrl(card.dataset.simpleUrl);
    }
  });
}

// ---------------------------------------------------------------------------
// Öffentliche Schnittstelle für app.js
// ---------------------------------------------------------------------------
export function initSimpleMode(context) {
  ctx = context;
  cacheEls();
  bindUi();
}

let activated = false;

export function activateSimpleMode() {
  if (!ctx) return;
  if (els.marketingList && !activated) {
    els.marketingList.innerHTML = LOADER;
    els.salesList.innerHTML = LOADER;
  }
  activated = true;
  void loadRules().then(() => loadResults()).then(scheduleStatusPoll);
}

export function deactivateSimpleMode() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
}
