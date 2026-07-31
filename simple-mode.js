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
// nur, was der Server entschieden hat, und startet den Lauf über die letzten
// gespeicherten Artikel (kein Crawl).
// ---------------------------------------------------------------------------

let ctx = null;
let els = {};
let bound = false;
let running = false;
let rulesLoaded = false;
let lastRun = null;
let simpleRules = null;

function el(id) {
  return document.getElementById(id);
}

function cacheEls() {
  els = {
    view: el("view-simple"),
    scopeCount: el("simple-scope-count"),
    runButton: el("btn-simple-run"),
    rulesButton: el("btn-simple-rules"),
    status: el("simple-status"),
    statusLabel: el("simple-status-label"),
    statusCount: el("simple-status-count"),
    progressBar: el("simple-progress-bar"),
    marketingList: el("simple-list-marketing"),
    salesList: el("simple-list-sales"),
    marketingCount: el("simple-marketing-count"),
    salesCount: el("simple-sales-count"),
    rejectedList: el("simple-rejected-list"),
    rejectedCount: el("simple-rejected-count"),
    rules: el("simple-rules"),
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

function renderLane(lane, signals) {
  const list = lane === "sales" ? els.salesList : els.marketingList;
  const count = lane === "sales" ? els.salesCount : els.marketingCount;
  if (!list) return;
  count.textContent = signals.length.toLocaleString("de-DE");
  list.innerHTML = signals.length
    ? signals.map(signalCard).join("")
    : `<div class="track-card-empty">Noch keine Signale in dieser Spur. Lauf starten oder Regeln prüfen.</div>`;
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

function renderRules(rules) {
  if (!els.rules || !rules) return;
  const lane = (entry) => `
    <div class="simple-rules-lane">
      <h4>${esc(entry.label)}</h4>
      <p style="color:var(--muted);font-size:.7rem;margin-bottom:.6rem">${escText(entry.description)}</p>
      <ul>
        ${entry.families.map((family) => `<li><b>${escText(family.label)}</b><span>${escText(family.definition)}${family.domains ? ` (nur ${esc(family.domains.join(", "))})` : ""}</span></li>`).join("")}
      </ul>
    </div>
  `;
  els.rules.innerHTML = `
    <h3>Regeln &amp; Guardrails des einfachen Modus</h3>
    <p>Modell ${esc(rules.model)} · Prompt ${esc(rules.version)} · Mindestsicherheit ${esc(rules.min_confidence)} · Mindestnutzwert ${esc(rules.min_score)} · maximal ${esc(rules.prompt_chars)} Zeichen Artikeltext pro Prüfung.</p>
    <div class="simple-rules-grid">${rules.lanes.map(lane).join("")}</div>
    <div class="simple-guardrails">
      <h4>Nicht abschaltbare Guardrails</h4>
      <ul>${rules.guardrails.map((rule) => `<li><b>${escText(rule.label)}</b><span>${escText(rule.description)}</span></li>`).join("")}</ul>
    </div>
  `;
}

function setStatus(text, detail = "", progress = null, isError = false) {
  if (!els.statusLabel) return;
  els.statusLabel.textContent = text;
  els.statusCount.textContent = detail;
  els.status.classList.toggle("simple-status--error", isError);
  if (els.progressBar) els.progressBar.style.width = progress === null ? "0%" : `${Math.round(progress * 100)}%`;
}

function describeRun(run, totals) {
  if (!run) {
    setStatus("Noch kein Lauf gestartet.", totals ? `${totals.signals} Signale gespeichert` : "");
    return;
  }
  const total = Number(run.total_count || 0);
  const processed = Number(run.processed_count || 0);
  const progress = total > 0 ? Math.min(processed / total, 1) : 0;
  const detail = `${processed.toLocaleString("de-DE")} / ${total.toLocaleString("de-DE")} Artikel · ${Number(run.signal_count || 0)} Signale`;
  if (run.status === "error") {
    setStatus(run.error_message || "Lauf abgebrochen.", detail, progress, true);
    return;
  }
  if (run.status === "running") {
    setStatus("Prüfung läuft…", detail, progress);
    return;
  }
  setStatus(`Letzter Lauf abgeschlossen (${formatDate(run.finished_at || run.started_at)})`, detail, 1);
}

// ---------------------------------------------------------------------------
// Daten laden
// ---------------------------------------------------------------------------
async function loadRules() {
  if (rulesLoaded) return;
  try {
    const { rules } = await ctx.callApi("get_simple_rules");
    rulesLoaded = true;
    simpleRules = rules;
    if (els.scopeCount) els.scopeCount.textContent = String(rules.article_limit);
    if (els.runButton) els.runButton.innerHTML = `<i class="fa-solid fa-play"></i> Letzte ${rules.article_limit} Artikel prüfen`;
    renderRules(rules);
  } catch (error) {
    ctx.toast(error.message || "Regeln konnten nicht geladen werden", "err");
  }
}

async function loadResults() {
  try {
    const [marketing, sales, rejected, status] = await Promise.all([
      ctx.callApi("list_simple_signals", { lane: "marketing", limit: 60 }),
      ctx.callApi("list_simple_signals", { lane: "sales", limit: 60 }),
      ctx.callApi("list_simple_rejected", { limit: 60 }),
      ctx.callApi("get_simple_run_status"),
    ]);
    renderLane("marketing", marketing.signals || []);
    renderLane("sales", sales.signals || []);
    renderRejected(rejected.articles || [], simpleRules?.reject_labels);
    lastRun = status.run || null;
    describeRun(lastRun, status.totals);
  } catch (error) {
    setStatus(error.message || "Ergebnisse konnten nicht geladen werden", "", null, true);
  }
}

// Der Lauf wird in kleinen Paketen abgearbeitet, damit keine Anfrage in das
// Zeitlimit der Edge Function läuft. Der Browser hält die Kette am Laufen.
async function runSimplePipeline() {
  if (running) return;
  running = true;
  els.runButton.disabled = true;
  const originalLabel = els.runButton.innerHTML;
  els.runButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Prüfung läuft…`;
  try {
    const { run } = await ctx.callApi("start_simple_run");
    lastRun = run;
    describeRun(run);
    let guard = 0;
    let done = run?.status !== "running";
    while (!done && guard < 200) {
      guard += 1;
      const step = await ctx.callApi("process_simple_run", { run_id: run.id });
      lastRun = step.run || lastRun;
      describeRun(lastRun);
      done = Boolean(step.done) || lastRun?.status !== "running";
      if (!done) await loadResults();
    }
    await loadResults();
    ctx.toast(`Prüfung abgeschlossen · ${Number(lastRun?.signal_count || 0)} Signale`);
  } catch (error) {
    setStatus(error.message || "Lauf fehlgeschlagen", "", null, true);
    ctx.toast(error.message || "Lauf fehlgeschlagen", "err");
  } finally {
    running = false;
    els.runButton.disabled = false;
    els.runButton.innerHTML = originalLabel;
  }
}

function bindUi() {
  if (bound) return;
  bound = true;
  els.runButton?.addEventListener("click", () => void runSimplePipeline());
  els.rulesButton?.addEventListener("click", () => {
    if (!els.rules) return;
    els.rules.hidden = !els.rules.hidden;
    if (!els.rules.hidden) els.rules.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
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
  void loadRules().then(() => loadResults());
  activated = true;
}
