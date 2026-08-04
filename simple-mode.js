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
let selectedVersion = "";
let versionList = [];

function el(id) {
  return document.getElementById(id);
}

function cacheEls() {
  els = {
    view: el("view-simple-results"),
    articleTypeFilter: el("simple-article-type-filter"),
    sourceFilter: el("simple-source-filter"),
    companyFilter: el("simple-company-filter"),
    companyToggle: el("simple-company-toggle"),
    companyPanel: el("simple-company-panel"),
    companyLabel: el("simple-company-label"),
    sort: el("simple-sort"),
    version: el("simple-version"),
    marketingList: el("simple-list-marketing"),
    salesList: el("simple-list-sales"),
    marketingCount: el("simple-marketing-count"),
    salesCount: el("simple-sales-count"),
    rejectedList: el("simple-rejected-list"),
    rejectedCount: el("simple-rejected-count"),
    dashMarketing: el("simple-dash-marketing"),
    dashSales: el("simple-dash-sales"),
    dashRejected: el("simple-dash-rejected"),
    dashRun: el("simple-dash-run"),
    archiveList: el("simple-archive-list"),
    archiveReason: el("simple-archive-reason-filter"),
    archiveSource: el("simple-archive-source-filter"),
    archiveSort: el("simple-archive-sort"),
    archiveCount: el("simple-archive-count"),
    archiveMore: el("simple-archive-load-more"),
    settingsContent: el("simple-settings-content"),
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

function isToday(iso) {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function findingDateTag(iso) {
  if (!iso) return `<span class="finding-date-tag finding-date-tag--missing">Ohne Datum</span>`;
  return `<span class="finding-date-tag">${esc(formatDate(iso))}</span>`;
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
    <article class="finding-item" data-article-id="${esc(article.id || signal.article_id || "")}" tabindex="0" role="button">
      <div class="finding-item-top">
        <span class="finding-dimension">${esc(signal.signal_label || signal.signal_id || "Signal")}</span>
        <div class="finding-top-tags">
          ${isToday(signal.updated_at || signal.classified_at) ? `<span class="finding-new-badge">NEU</span>` : ""}
          <span class="quality-tag quality-tag--reliable"><i class="fa-solid fa-chart-line"></i> ${esc(signal.lane === "sales" ? "Sales-Relevanz" : "Marketing-Relevanz")} · ${esc(signal.score ?? 0)} %</span>
          ${findingDateTag(article.published_at)}
        </div>
      </div>
      <span class="finding-title">${escText(title)}</span>
      ${signal.why_de ? `<p class="simple-signal-why">${escText(signal.why_de)}</p>` : ""}
      ${signal.evidence ? `<q class="simple-signal-evidence">${escText(signal.evidence)}</q>` : ""}
      ${signal.roots_link_de ? `<div class="finding-offering">
        <div class="finding-offering-head"><span><i class="fa-solid fa-puzzle-piece"></i> Passende ROOTS-Leistung</span></div>
        <strong>${escText(signal.roots_offering || "")}</strong>
        <div class="finding-offering-dock"><span>So kann ROOTS andocken</span><p>${escText(signal.roots_link_de)}</p></div>
      </div>` : ""}
      <div class="finding-meta">
        ${(signal.tier1_companies || []).map((name) => `<span class="tag tag--kunde" data-company-profile="${esc(name)}" data-company-trigger="${esc(signal.trigger_de || signal.why_de || "")}" data-pill-info="Tier 1 Company" tabindex="0" role="button"><i class="fa-solid fa-building"></i> ${esc(name)}</span>`).join("")}
        ${signal.company && !(signal.tier1_companies || []).includes(signal.company) ? `<span class="tag tag--company" data-pill-info="Company" tabindex="0"><i class="fa-solid fa-building"></i> ${esc(signal.company)}</span>` : ""}
        ${signal.person_name ? `<span class="tag tag--person" data-pill-info="Einstufung: Person${signal.person_role ? " · " + esc(signal.person_role) : ""}" tabindex="0"><i class="fa-solid fa-user"></i> ${esc(signal.person_name)}</span>` : ""}
        ${source?.company ? `<span class="tag tag--source"><i class="fa-solid fa-newspaper"></i> ${esc(source.company)}</span>` : ""}
        ${ctx.technicalAuditPill(article.id || signal.article_id)}
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
// Ein Signal passt, wenn seine Einstufung gewaehlt ist und mindestens ein
// erkanntes Unternehmen in der Mehrfachauswahl steht.
function companyMatches(signal) {
  if (companyState.klasse === "all") return true;
  const tier1 = (signal.tier1_companies || []).filter(Boolean);
  if (companyState.klasse === "tier1") {
    return tier1.some((name) => companyState.selected.includes(name));
  }
  const plain = signal.company && !tier1.includes(signal.company) ? signal.company : null;
  return Boolean(plain) && companyState.selected.includes(plain);
}

function visibleSignals(lane) {
  const state = ctx.viewState;
  const filtered = signalsByLane[lane].filter((signal) => {
    const typeOk = state.articleTypes.length === 0 || state.articleTypes.includes(signal.article?.article_type);
    const sourceOk = state.sources.length === 0 || state.sources.includes(signalSourceName(signal));
    const companyOk = companyMatches(signal);
    return typeOk && sourceOk && companyOk;
  });
  return [...filtered].sort((a, b) => {
    if (state.sort === "newest") return signalDate(b) - signalDate(a) || Number(b.score || 0) - Number(a.score || 0);
    if (state.sort === "confidence") return Number(b.confidence || 0) - Number(a.confidence || 0) || Number(b.score || 0) - Number(a.score || 0);
    const today = new Date();
    const isToday = (signal) => {
      const date = new Date(signal.article?.published_at || 0);
      return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
    };
    const todayDiff = (isToday(b) ? 1 : 0) - (isToday(a) ? 1 : 0);
    if (todayDiff !== 0) return todayDiff;
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
  if (els.companyPanel) {
    companyIndex.tier1 = [...new Set(all.flatMap((signal) => signal.tier1_companies || []).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "de"));
    companyIndex.company = [...new Set(all.map((signal) => signal.company).filter(Boolean)
      .filter((name) => !companyIndex.tier1.includes(name)))].sort((a, b) => a.localeCompare(b, "de"));
    // Auswahl auf noch vorhandene Namen begrenzen, ohne sie zu leeren.
    const allowed = companyIndex[companyState.klasse] || [];
    if (companyState.klasse !== "all") {
      companyState.selected = companyState.selected.filter((name) => allowed.includes(name));
      if (!companyState.selected.length) companyState.selected = [...allowed];
    }
    renderCompanyFilter();
  }
}

// Zweistufiger Unternehmensfilter: erst die Einstufung, dann die erkannten
// Unternehmen dieser Einstufung als Mehrfachauswahl - beim Wechsel sind alle
// angewählt, damit die Auswahl nichts versteckt, was man nicht abgewählt hat.
const companyIndex = { tier1: [], company: [] };
const companyState = { klasse: "all", selected: [] };

function companyFilterLabel() {
  if (companyState.klasse === "all") return "Alle Unternehmen";
  const alle = companyIndex[companyState.klasse] || [];
  const name = companyState.klasse === "tier1" ? "Tier 1 Company" : "Company";
  if (companyState.selected.length === alle.length) return `${name} · alle`;
  if (companyState.selected.length === 1) return `${name} · ${companyState.selected[0]}`;
  return `${name} · ${companyState.selected.length} von ${alle.length}`;
}

function renderCompanyFilter() {
  if (!els.companyPanel) return;
  if (els.companyLabel) els.companyLabel.textContent = companyFilterLabel();
  const klasse = (key, label) => {
    const alle = companyIndex[key] || [];
    const aktiv = companyState.klasse === key;
    return `<button type="button" class="cfilter-class" data-cfilter-class="${key}" aria-selected="${aktiv}">
        <i class="fa-solid ${aktiv ? "fa-circle-dot" : "fa-circle"}"></i> ${label}
        <span class="cfilter-count">${alle.length}</span>
      </button>
      ${aktiv && alle.length ? `<div class="cfilter-actions">
        <button type="button" data-cfilter-all="1">alle</button>
        <button type="button" data-cfilter-none="1">keine</button>
      </div>
      <div class="cfilter-sub">${alle.map((name) => `<label class="cfilter-item">
        <input type="checkbox" data-cfilter-name="${esc(name)}"${companyState.selected.includes(name) ? " checked" : ""}>
        <span>${esc(name)}</span></label>`).join("")}</div>` : ""}`;
  };
  els.companyPanel.innerHTML = `
    <button type="button" class="cfilter-class" data-cfilter-class="all" aria-selected="${companyState.klasse === "all"}">
      <i class="fa-solid ${companyState.klasse === "all" ? "fa-circle-dot" : "fa-circle"}"></i> Alle Unternehmen
    </button>
    ${klasse("tier1", "Tier 1 Company")}
    ${klasse("company", "Company")}`;
}

function bindCompanyFilter(rerender) {
  if (!els.companyToggle || !els.companyPanel) return;
  const close = () => {
    els.companyPanel.hidden = true;
    els.companyToggle.setAttribute("aria-expanded", "false");
  };
  els.companyToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = els.companyPanel.hidden;
    els.companyPanel.hidden = !open;
    els.companyToggle.setAttribute("aria-expanded", String(open));
    if (open) renderCompanyFilter();
  });
  document.addEventListener("click", (event) => {
    if (!els.companyFilter?.contains(event.target)) close();
  });
  els.companyPanel.addEventListener("click", (event) => {
    const klasse = event.target.closest("[data-cfilter-class]");
    if (klasse) {
      companyState.klasse = klasse.getAttribute("data-cfilter-class");
      companyState.selected = companyState.klasse === "all" ? [] : [...(companyIndex[companyState.klasse] || [])];
      renderCompanyFilter();
      rerender();
      return;
    }
    if (event.target.closest("[data-cfilter-all]")) {
      companyState.selected = [...(companyIndex[companyState.klasse] || [])];
      renderCompanyFilter(); rerender(); return;
    }
    if (event.target.closest("[data-cfilter-none]")) {
      companyState.selected = [];
      renderCompanyFilter(); rerender(); return;
    }
  });
  els.companyPanel.addEventListener("change", (event) => {
    const box = event.target.closest("[data-cfilter-name]");
    if (!box) return;
    const name = box.getAttribute("data-cfilter-name");
    companyState.selected = box.checked
      ? [...new Set([...companyState.selected, name])]
      : companyState.selected.filter((entry) => entry !== name);
    if (els.companyLabel) els.companyLabel.textContent = companyFilterLabel();
    rerender();
  });
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
      const typeLabel = ctx.articleTypeLabels?.[row.article_type] || row.article_type || "Sonstiger Inhalt";
      return `
        <article class="finding-item" data-article-id="${esc(article.id || row.article_id || "")}" tabindex="0" role="button">
          <div class="finding-item-top">
            <span class="finding-dimension">${esc(typeLabel)}</span>
            <div class="finding-top-tags">
              ${isToday(row.updated_at || row.classified_at) ? `<span class="finding-new-badge">NEU</span>` : ""}
              <span class="quality-tag quality-tag--uncertain"><i class="fa-solid fa-scale-balanced"></i> Manuelle Prüfung</span>
              ${findingDateTag(article.published_at)}
            </div>
          </div>
          <span class="finding-title">${escText(article.title_de || article.title || article.url || "Ohne Titel")}</span>
          ${row.summary_de ? `<p class="finding-summary">${escText(row.summary_de)}</p>` : ""}
          <p class="finding-rationale"><i class="fa-solid fa-scale-balanced"></i><span>${escText(reason)}</span></p>
          <div class="finding-meta">
            ${source?.company ? `<span class="tag tag--source"><i class="fa-solid fa-newspaper"></i> ${esc(source.company)}</span>` : ""}
            ${ctx.technicalAuditPill(article.id || row.article_id)}
          </div>
        </article>
      `;
    }).join("")
    : `<div class="track-card-empty">Keine fachlichen Grenzfälle für eine menschliche Abwägung.</div>`;
}

// ---------------------------------------------------------------------------
// Daten laden
// ---------------------------------------------------------------------------
// Nur die Beschriftungen der Ablehnungsgründe werden gebraucht; die Regeln
// selbst leben in pipeline-simple.ts.
async function loadRules() {
  if (rulesLoaded) return;
  try {
    const { rules } = await ctx.callApi("get_simple_rules", selectedVersion ? { pipeline_version: selectedVersion } : {});
    rulesLoaded = true;
    simpleRules = rules;
  } catch (_error) {
    /* Ergebnisse werden auch ohne die Beschriftungen angezeigt */
  }
}

// Versionen des Regelwerks: die Auswahl lädt genau die Artikel, die damals mit
// diesem Regelstand klassifiziert wurden.
async function loadVersions() {
  try {
    const { versions } = await ctx.callApi("list_simple_versions");
    versionList = versions || [];
    if (!els.version) return;
    const date = (iso) => iso ? new Date(iso).toLocaleDateString("de-DE") : "";
    els.version.innerHTML = `<option value="current">Aktueller Stand (alle Versionen)</option>${versionList
      .map((entry) => `<option value="${esc(entry.version)}" ${entry.version === selectedVersion ? "selected" : ""}>Version ${esc(entry.version)} · ${entry.archived_signals ?? entry.signals} Signale · ${esc(date(entry.first_seen_at))}</option>`)
      .join("")}`;
  } catch (_error) { /* Auswahl bleibt bei der aktuellen Pipeline */ }
}

async function loadResults({ keepStatus = false } = {}) {
  const versionFilter = selectedVersion ? { pipeline_version: selectedVersion } : {};
  try {
    const [marketing, sales, rejected, status] = await Promise.all([
      ctx.callApi("list_simple_signals", { lane: "marketing", limit: 60, ...versionFilter }),
      ctx.callApi("list_simple_signals", { lane: "sales", limit: 60, ...versionFilter }),
      ctx.callApi("list_simple_rejected", { limit: 60, reasons: ["zu_unsicher", "evidenz_fehlt", "familie_nicht_erlaubt"], ...versionFilter }),
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
const POLL_ACTIVE_MS = 6_000;
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
  bindCompanyFilter(rerender);
  els.version?.addEventListener("change", () => {
    selectedVersion = els.version.value === "current" ? "" : els.version.value;
    rulesLoaded = false;
    simpleRules = null;
    // Sichtbarer Wechsel: erst leeren und laden zeigen, dann den neuen Stand.
    [els.marketingList, els.salesList, els.rejectedList, els.archiveList].forEach((list) => {
      if (list) list.innerHTML = LOADER;
    });
    if (els.marketingCount) els.marketingCount.textContent = "…";
    if (els.salesCount) els.salesCount.textContent = "…";
    if (els.rejectedCount) els.rejectedCount.textContent = "…";
    void loadRules().then(() => loadResults()).then(() => {
      if (document.getElementById("view-simple-archive")?.classList.contains("show")) void loadArchive();
    });
  });
  // Klick auf eine Karte öffnet dieselbe Detailansicht wie im Advanced-Modus.
  const openDetail = (event) => {
    if (event.target.closest("[data-audit-article-id]")) return;
    const card = event.target.closest("[data-article-id]");
    if (card?.dataset.articleId) ctx.openArticleDetail(card.dataset.articleId);
  };
  [els.view, el("view-simple-archive")].forEach((root) => {
    root?.addEventListener("click", openDetail);
    root?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const card = event.target.closest("[data-article-id]");
      if (card?.dataset.articleId) {
        event.preventDefault();
        ctx.openArticleDetail(card.dataset.articleId);
      }
    });
  });
  els.archiveMore?.addEventListener("click", () => void loadArchive(true));
  [els.archiveReason, els.archiveSource, els.archiveSort].forEach((control) => control?.addEventListener("change", renderArchive));
  // Stationen des einfachen Modus öffnen und durchblättern.
  document.addEventListener("click", (event) => {
    const open = event.target.closest("[data-simple-stage]");
    if (open) { openSimpleStage = open.dataset.simpleStage; renderSimpleStagePopup(); return; }
    if (event.target.closest("[data-simple-stage-close]")) { openSimpleStage = null; renderSimpleStagePopup(); return; }
    const stages = simpleRules?.stages || [];
    const index = stages.findIndex((stage) => stage.id === openSimpleStage);
    if (event.target.closest("[data-simple-stage-prev]") && stages[index - 1]) { openSimpleStage = stages[index - 1].id; renderSimpleStagePopup(); }
    if (event.target.closest("[data-simple-stage-next]") && stages[index + 1]) { openSimpleStage = stages[index + 1].id; renderSimpleStagePopup(); }
  });

}

// ---------------------------------------------------------------------------
// Dashboard, Archiv, Einstellungen
// ---------------------------------------------------------------------------
async function loadDashboard() {
  try {
    const { counts, run, forecast } = await ctx.callApi("get_simple_dashboard");
    if (els.dashMarketing) els.dashMarketing.textContent = Number(counts?.marketing || 0).toLocaleString("de-DE");
    if (els.dashSales) els.dashSales.textContent = Number(counts?.sales || 0).toLocaleString("de-DE");
    if (els.dashRejected) els.dashRejected.textContent = Number(counts?.rejected || 0).toLocaleString("de-DE");
    lastRun = run || null;
    running = lastRun?.status === "running";
    ctx.setSimpleRunStatus(lastRun, forecast || null);
    if (els.dashRun) {
      const eur = (value) => value === null || value === undefined
        ? "–"
        : Number(value).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
      els.dashRun.innerHTML = lastRun
        ? `Letzter Lauf: <b>${escText(lastRun.status === "running" ? "läuft" : lastRun.status === "error" ? "mit Fehler beendet" : "abgeschlossen")}</b> ·
           <b>${Number(lastRun.processed_count || 0).toLocaleString("de-DE")} / ${Number(lastRun.total_count || 0).toLocaleString("de-DE")}</b> Artikel geprüft ·
           Modell <b>${escText(lastRun.model || "–")}</b>${forecast ? ` · Kosten bisher <b>${eur(forecast.spent_eur)}</b>` : ""}
           ${lastRun.error_message ? `<br><span style="color:var(--danger)">${escText(lastRun.error_message)}</span>` : ""}`
        : "Noch kein Lauf gestartet. Der einfache Modus prüft gespeicherte Artikel; gestartet wird er im Backend.";
    }
  } catch (error) {
    if (els.dashRun) els.dashRun.textContent = error.message || "Dashboard konnte nicht geladen werden.";
  }
}

let archiveOffset = 0;
let archiveTotal = 0;

let archiveRows = [];

function renderArchive() {
  if (!els.archiveList) return;
  const labels = simpleRules?.reject_labels || {};
  const reasonFilter = els.archiveReason?.value || "all";
  const sourceFilter = els.archiveSource?.value || "all";
  const sortMode = els.archiveSort?.value || "newest";
  const sourceName = (row) => sourceOf(row.article)?.company || "";
  const rows = archiveRows
    .filter((row) => reasonFilter === "all" || row.reject_reason === reasonFilter)
    .filter((row) => sourceFilter === "all" || sourceName(row) === sourceFilter)
    .sort((a, b) => sortMode === "reason"
      ? String(labels[a.reject_reason] || a.reject_reason || "").localeCompare(String(labels[b.reject_reason] || b.reject_reason || ""), "de")
      : new Date(b.article?.published_at || b.updated_at || 0) - new Date(a.article?.published_at || a.updated_at || 0));
  els.archiveList.innerHTML = rows.length
    ? rows.map((row) => {
      const article = row.article || {};
      const source = sourceOf(article);
      return `
        <article class="archive-item" data-article-id="${esc(article.id || row.article_id || "")}" tabindex="0" role="button">
          <div class="finding-item-top">
            <span class="finding-dimension">${esc(ctx.articleTypeLabels?.[row.article_type] || row.article_type || "Sonstiger Inhalt")}</span>
            <div class="finding-top-tags">${isToday(row.updated_at || row.classified_at) ? `<span class="finding-new-badge">NEU</span>` : ""}${findingDateTag(article.published_at)}</div>
          </div>
          <span class="finding-title">${escText(article.title_de || article.title || article.url || "Ohne Titel")}</span>
          <p class="archive-reason"><i class="fa-solid fa-circle-info"></i><span>${escText(labels[row.reject_reason] || row.reject_reason || "Ohne Begründung")}</span></p>
          ${row.summary_de ? `<small class="archive-summary">${escText(row.summary_de)}</small>` : ""}
          <div class="finding-meta">
            ${source?.company ? `<span class="tag tag--source"><i class="fa-solid fa-newspaper"></i> ${esc(source.company)}</span>` : ""}
            <span class="tag"><i class="fa-solid fa-circle-info"></i> Nicht relevant</span>
            ${ctx.technicalAuditPill(article.id || row.article_id)}
          </div>
        </article>`;
    }).join("")
    : `<div class="track-card-empty">Keine Artikel entsprechen den gewählten Filtern.</div>`;
  if (els.archiveCount) els.archiveCount.textContent = archiveTotal.toLocaleString("de-DE");
  if (els.archiveMore) els.archiveMore.hidden = archiveOffset >= archiveTotal;
}

function refreshArchiveFilters() {
  const labels = simpleRules?.reject_labels || {};
  if (els.archiveReason) {
    const reasons = [...new Set(archiveRows.map((row) => row.reject_reason).filter(Boolean))]
      .sort((a, b) => String(labels[a] || a).localeCompare(String(labels[b] || b), "de"));
    els.archiveReason.innerHTML = `<option value="all">Alle Gründe</option>${reasons
      .map((reason) => `<option value="${esc(reason)}">${escText(labels[reason] || reason)}</option>`).join("")}`;
  }
  if (els.archiveSource) {
    const sources = [...new Set(archiveRows.map((row) => sourceOf(row.article)?.company).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "de"));
    els.archiveSource.innerHTML = `<option value="all">Alle Quellen</option>${sources
      .map((source) => `<option value="${esc(source)}">${esc(source)}</option>`).join("")}`;
  }
}

async function loadArchive(append = false) {
  if (!els.archiveList) return;
  if (!append) {
    archiveOffset = 0;
    archiveRows = [];
    els.archiveList.innerHTML = LOADER;
  }
  try {
    const { articles, total } = await ctx.callApi("list_simple_rejected", {
      limit: 60, offset: archiveOffset,
      exclude_reasons: ["zu_unsicher", "evidenz_fehlt", "familie_nicht_erlaubt"],
      ...(selectedVersion ? { pipeline_version: selectedVersion } : {}),
    });
    archiveTotal = Number(total || 0);
    const rows = articles || [];
    archiveOffset += rows.length;
    archiveRows = append ? [...archiveRows, ...rows] : rows;
    refreshArchiveFilters();
    renderArchive();
    ctx.enhanceHeaderSelects();
  } catch (error) {
    els.archiveList.innerHTML = `<div class="track-card-empty">${escText(error.message || "Archiv konnte nicht geladen werden.")}</div>`;
  }
}

// Einstellungen: was einstellbar ist, kommt aus der Konfiguration; die Regeln
// selbst sind Servercode und werden nur gezeigt.
let openSimpleStage = null;

// Der einfache Modus zeigt denselben Ablauf wie Advanced: Kacheln im Flow, und
// je Station ein Popup mit genau vier Blöcken - Ein/Aus, geprüfte Filter,
// Schwellen, feste Schutzregeln.
export function renderSimpleSettings() {
  if (!els.settingsContent) return;
  if (!simpleRules) {
    void loadRules().then(() => renderSimpleSettings());
    return;
  }
  const stages = simpleRules.stages || [];
  const icon = { bestand: "fa-solid fa-layer-group", bereinigung: "fa-solid fa-eraser", vorfilter: "fa-solid fa-filter", ki: "fa-solid fa-wand-magic-sparkles", validierung: "fa-solid fa-shield-halved" };
  const card = (stage, index) => `
    <button type="button" class="pipeline-overview-card" data-simple-stage="${esc(stage.id)}">
      <span class="pipeline-overview-card-head"><span class="pipeline-overview-card-icon"><i class="${icon[stage.id] || "fa-solid fa-gear"}"></i></span><span class="pipeline-overview-card-number">0${index + 1}</span></span>
      <h4>${escText(stage.title.replace(/^\d+\s*·\s*/, ""))}</h4>
      <p>${escText(String(stage.copy).split(". ")[0])}.</p>
      <span class="pipeline-overview-stat"><small>${escText(stage.system === "gemini" ? "KI-Prüfung" : stage.system === "server" ? "Serverseitig" : "Deterministisch")}</small><b>${escText(stage.families ? `${stage.families.length} Signalfamilien` : `${(stage.details || []).length} Regeln`)}</b></span>
      <span class="pipeline-overview-card-action">Station ansehen <i class="fa-solid fa-arrow-right"></i></span>
    </button>`;
  els.settingsContent.innerHTML = `
    <div class="pipeline-flow">${stages.map(card).join("")}</div>
    <p class="pipeline-version-line"><i class="fa-solid fa-circle-check"></i>Pipeline <b>Version ${escText(simpleRules.version_label || "1.0")}</b> · zuletzt geändert ${escText(new Date(simpleRules.updated_at || Date.now()).toLocaleDateString("de-DE"))}</p>
    <section class="pipeline-drilldown" id="simple-drilldown" hidden></section>`;
  renderSimpleStagePopup();
}

function renderSimpleStagePopup() {
  const target = el("simple-drilldown");
  if (!target) return;
  const stages = simpleRules?.stages || [];
  const index = stages.findIndex((stage) => stage.id === openSimpleStage);
  if (index < 0) { target.hidden = true; target.innerHTML = ""; return; }
  const stage = stages[index];
  const chips = (terms) => (terms || []).map((term) => `<code class="pipeline-term">${escText(term)}</code>`).join("");
  const familyBlock = (family) => `
    <details class="pipeline-detail">
      <summary><b>${escText(family.label)}</b><span>${escText(family.lane === "sales" ? "Sales" : "Marketing")}</span></summary>
      <p>${escText(family.definition)}</p>
      <div class="pipeline-detail-row"><span>Kombination</span><p>${escText(family.kombination)}</p></div>
      ${family.domains ? `<div class="pipeline-detail-row"><span>Nur Quelle</span><p>${escText(family.domains.join(", "))}</p></div>` : ""}
      <div class="pipeline-detail-row"><span>Auslöser (${(family.trigger_terms || []).length})</span><div class="pipeline-terms">${chips(family.trigger_terms)}</div></div>
      ${(family.context_terms || []).length ? `<div class="pipeline-detail-row"><span>Kontextpflicht (${family.context_terms.length})</span><div class="pipeline-terms">${chips(family.context_terms)}</div></div>` : ""}
      ${(family.exclude_title_terms || []).length ? `<div class="pipeline-detail-row"><span>Ausschluss im Titel (${family.exclude_title_terms.length})</span><div class="pipeline-terms">${chips(family.exclude_title_terms)}</div></div>` : ""}
    </details>`;
  const guardrails = (simpleRules.guardrails || []).filter((rule) => {
    if (stage.id === "vorfilter") return ["keyword_never_decides", "sensitive_topics", "news_domain_lock", "tier1", "min_text"].includes(rule.id);
    if (stage.id === "ki") return ["candidate_lock", "no_crawl"].includes(rule.id);
    if (stage.id === "validierung") return ["verbatim_evidence", "min_confidence"].includes(rule.id);
    return false;
  });
  const previous = stages[index - 1];
  const next = stages[index + 1];
  target.hidden = false;
  target.innerHTML = `<div class="pipeline-drilldown-card pipeline-drilldown-card--single" role="dialog" aria-modal="true">
    <header class="pipeline-drilldown-head">
      <div><div class="pipeline-breadcrumb"><button type="button" data-simple-stage-close>Pipeline</button><i class="fa-solid fa-chevron-right"></i><b>${escText(stage.title)}</b></div>
      <div class="pipeline-drilldown-title"><span><i class="fa-solid fa-diagram-project"></i></span><div><h4>${escText(stage.title)}</h4><p>${escText(stage.copy)}</p></div></div></div>
      <div class="pipeline-drilldown-head-actions">
        <button type="button" class="pipeline-icon-btn" data-simple-stage-prev ${previous ? "" : "disabled"} title="Vorherige Station"><i class="fa-solid fa-arrow-left"></i></button>
        <button type="button" class="pipeline-icon-btn" data-simple-stage-next ${next ? "" : "disabled"} title="Nächste Station"><i class="fa-solid fa-arrow-right"></i></button>
        <button type="button" class="pipeline-icon-btn" data-simple-stage-close title="Schließen"><i class="fa-solid fa-xmark"></i></button>
      </div>
    </header>
    <main class="stage-page-scroll"><div class="stage-page">
      ${(stage.steps || []).length ? `<section class="pipeline-stage-card">
        <header><div><b>Schritt für Schritt</b><small>In dieser Reihenfolge läuft die Station ab</small></div></header>
        <ol class="pipeline-steps">${stage.steps.map((step) => `<li><div class="pipeline-step-head"><b>${escText(step.title)}</b><span class="pipeline-step-kind">${escText(step.kind)}</span></div><p>${escText(step.copy)}</p></li>`).join("")}</ol>
      </section>` : ""}
      <section class="pipeline-stage-card">
        <header><div><b>Werte dieser Station</b><small>${escText(stage.system === "gemini" ? "KI-Prüfung" : stage.system === "server" ? "Serverseitige Validierung" : "Deterministischer Code")}</small></div></header>
        ${(stage.details || []).map((detail) => `<div class="pipeline-detail-row"><span>${escText(detail.label)}</span><p>${escText(detail.value)}</p></div>`).join("")}
      </section>
      ${(stage.families || []).length ? `<section class="pipeline-stage-card"><header><div><b>Geprüfte Signalfamilien</b><small>${stage.families.length} Familien · Treffer erlaubt nur die KI-Prüfung</small></div></header><div class="pipeline-family-list">${stage.families.map(familyBlock).join("")}</div></section>` : ""}
      ${`<p class="pipeline-version-line"><i class="fa-solid fa-circle-check"></i>Pipeline <b>Version ${escText(simpleRules.version_label || "1.0")}</b> · ${simpleRules.snapshot ? `gespeicherter Regelstand vom ${escText(new Date(simpleRules.snapshot_taken_at || Date.now()).toLocaleDateString("de-DE"))}` : `zuletzt geändert ${escText(new Date(simpleRules.updated_at || Date.now()).toLocaleDateString("de-DE"))}`}</p>`}
      ${guardrails.length ? `<section class="pipeline-stage-card"><header><div><b>Nicht abschaltbare Schutzregeln</b><small>Servercode</small></div></header><div class="pipeline-family-list">${guardrails.map((rule) => `<details class="pipeline-detail"><summary><b>${escText(rule.label)}</b><span>fest</span></summary><p>${escText(rule.description)}</p></details>`).join("")}</div></section>` : ""}
    </div></main>
    <footer class="pipeline-drilldown-footer">
      <button type="button" class="btn-secondary" data-simple-stage-close><i class="fa-solid fa-arrow-left"></i>Zur Pipeline</button>
      <span class="pipeline-depth-progress">Station ${index + 1} von ${stages.length}</span>
      ${next ? `<button type="button" class="btn-primary" data-simple-stage-next>Nächste Station<i class="fa-solid fa-arrow-right"></i></button>` : `<button type="button" class="btn-primary" data-simple-stage-close>Schließen<i class="fa-solid fa-xmark"></i></button>`}
    </footer>
  </div>`;
}

export function showSimpleView(view) {
  if (!ctx) return;
  if (view === "dashboard") void loadDashboard();
  else if (view === "archive") void loadArchive();
  else void loadResults();
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
  const current = document.querySelector("#app-nav .sidebar-icon-btn.active")?.dataset.appView || "dashboard";
  void loadVersions().then(() => loadRules()).then(() => showSimpleView(current)).then(scheduleStatusPoll);
}

export function deactivateSimpleMode() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
}
