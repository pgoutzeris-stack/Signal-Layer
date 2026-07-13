import { SIGNAL_LAYER_API_URL } from "./config.js";

let sb = null;
let sources = [];
let appInitialized = false;

const state = {
  search: "",
  category: "all",
  status: "all", // all | active | inactive
  sort: "company_asc",
};

const els = {};

function toast(msg, kind = "ok") {
  const t = document.createElement("div");
  t.className = `toast ${kind === "err" ? "error" : "success"}`;
  t.innerHTML = `<i class="ri-${kind === "err" ? "error-warning-line" : "checkbox-circle-line"}"></i><span>${escapeHtml(msg)}</span>`;
  els.toastContainer.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 300);
  }, 3200);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function callApi(action, payload = {}) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.access_token) throw new Error("Nicht angemeldet");
  const res = await fetch(SIGNAL_LAYER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Fehler bei ${action}`);
  return json;
}

function cacheEls() {
  els.toastContainer = document.getElementById("toast-container");
  els.btnSettings = document.getElementById("btn-settings");
  els.settingsModal = document.getElementById("settings-modal");
  els.btnSettingsClose = document.getElementById("btn-settings-close");
  els.settingsNav = document.getElementById("settings-nav");
  els.apifyPanel = document.getElementById("settings-panel-apify");
  els.sourceSearch = document.getElementById("source-search");
  els.sourceCategoryFilter = document.getElementById("source-category-filter");
  els.sourceStatusFilter = document.getElementById("source-status-filter");
  els.sourceSort = document.getElementById("source-sort");
  els.sourceTableBody = document.getElementById("source-table-body");
  els.sourceCount = document.getElementById("source-count");
  els.btnAddSource = document.getElementById("btn-add-source");
  els.addSourceModal = document.getElementById("add-source-modal");
  els.addSourceForm = document.getElementById("add-source-form");
  els.btnAddSourceCancel = document.getElementById("btn-add-source-cancel");
  els.fCompany = document.getElementById("f-company");
  els.fUrl = document.getElementById("f-url");
  els.fCategory = document.getElementById("f-category");
  els.fDescription = document.getElementById("f-description");

  els.keywordListMarketing = document.getElementById("keyword-list-marketing");
  els.keywordListSales = document.getElementById("keyword-list-sales");
  els.keywordInputMarketing = document.getElementById("keyword-input-marketing");
  els.keywordInputSales = document.getElementById("keyword-input-sales");
  els.btnAddKeywordMarketing = document.getElementById("btn-add-keyword-marketing");
  els.btnAddKeywordSales = document.getElementById("btn-add-keyword-sales");

  els.btnCrawlTrigger = document.getElementById("btn-crawl-trigger");
  els.crawlDropdown = document.getElementById("crawl-dropdown");
  els.crawlCategoryList = document.getElementById("crawl-category-list");
  els.btnCrawlConfirm = document.getElementById("btn-crawl-confirm");
  els.lastRunText = document.getElementById("last-run-text");

  els.findingsListMarketing = document.getElementById("findings-list-marketing");
  els.findingsListSales = document.getElementById("findings-list-sales");
  els.reviewList = document.getElementById("review-list");
  els.taggingStatsText = document.getElementById("tagging-stats-text");
  els.testResults = document.getElementById("test-results");
  els.testCount = document.getElementById("test-count");
  els.articleDetailModal = document.getElementById("article-detail-modal");
  els.articleDetailContent = document.getElementById("article-detail-content");
}

// Thema (topic) — the 5 canonical dimensions, multi-select per article.
const TOPIC_LABELS = {
  customer_insights: "Customer Insights",
  marketing_insights: "Marketing Insights",
  fmcg_retail_signale: "FMCG-/Retail-Signale",
  sub_branchen_insight: "Sub-Branchen-Insight",
  ki_performance: "KI & Performance",
  kunde: "Kunde erkannt",
  buying_center: "Buying-Center-Kandidat",
};

// Territory — the 5 ROOTS content territories, single pick per article.
const TERRITORY_LABELS = {
  wachstumstreiber: "Wachstumstreiber",
  markenaktivierung: "Markenaktivierung",
  marke_im_wandel: "Marke im Wandel",
  operational_excellence: "Operational Excellence",
  empowered_marketers: "Empowered Marketers",
};

const ARTICLE_TYPE_LABELS = {
  editorial_news: "Redaktionelle Nachricht",
  press_release: "Pressemitteilung",
  interview: "Interview",
  analysis: "Analyse",
  product_news: "Produktmeldung",
  campaign_news: "Kampagnenmeldung",
  financial_news: "Finanzmeldung",
  event_report: "Event-Bericht",
  event_program: "Event-Programm",
  career: "Karriere",
  faq: "FAQ",
  overview: "Übersichtsseite",
  advertisement: "Anzeige",
  other: "Sonstiger Inhalt",
};

function formatConfidence(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number * 100)} %` : null;
}

function formatFindingDate(iso) {
  if (!iso) return `<span class="finding-date-tag finding-date-tag--missing">Ohne Datum</span>`;
  const dateStr = new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
  return `<span class="finding-date-tag">${dateStr}</span>`;
}

async function loadFindings(track) {
  const listEl = track === "marketing" ? els.findingsListMarketing : els.findingsListSales;
  try {
    const { findings } = await callApi("list_findings", { track, limit: 30 });
    if (!findings || findings.length === 0) {
      listEl.innerHTML = `<div class="track-card-empty">Noch keine Ergebnisse für diesen Track.</div>`;
      return;
    }
    listEl.innerHTML = findings.map((f) => {
      const article = f.article || {};
      const dimLabel = TOPIC_LABELS[f.dimension] || f.dimension || "";
      const territoryLabel = article.territory ? TERRITORY_LABELS[article.territory] || article.territory : null;
      const companies = article.matched_companies || [];
      const personCandidate = article.buying_center_candidate;
      const source = article.source || null;
      const confidence = formatConfidence(f.confidence ?? article.relevance_confidence);
      const evidence = (f.evidence || [])[0] || null;
      const isLegacy = article.classification_status === "legacy";
      return `
        <article class="finding-item ${isLegacy ? "finding-item--legacy" : ""}" data-article-id="${escapeHtml(article.id)}">
          <div class="finding-item-top">
            <span class="finding-dimension">${escapeHtml(dimLabel)}</span>
            <div class="finding-top-tags">
              ${isLegacy ? `<span class="quality-tag quality-tag--legacy"><i class="ri-history-line"></i> Altbestand ungeprüft</span>` : `<span class="quality-tag quality-tag--reliable"><i class="ri-shield-check-line"></i> Zuverlässig${confidence ? ` · ${confidence}` : ""}</span>`}
              ${formatFindingDate(article.published_at)}
            </div>
          </div>
          <a href="${escapeHtml(article.url || "#")}" target="_blank" rel="noopener" class="finding-title">${escapeHtml(article.title || article.url || "Ohne Titel")}</a>
          ${article.ai_summary ? `<p class="finding-summary">${escapeHtml(article.ai_summary)}</p>` : ""}
          ${article.ai_rationale ? `<p class="finding-rationale"><i class="ri-focus-3-line"></i><span>${escapeHtml(article.ai_rationale)}</span></p>` : ""}
          <div class="finding-meta">
            ${territoryLabel ? `<span class="tag">${escapeHtml(territoryLabel)}</span>` : ""}
            ${companies.map((c) => `<span class="tag tag--kunde"><i class="ri-building-line"></i> ${escapeHtml(c)}</span>`).join("")}
            ${source?.company ? `<a class="tag tag--source" href="${escapeHtml(source.url || article.url || "#")}" target="_blank" rel="noopener" title="Quelle: ${escapeHtml(source.company)}"><i class="ri-newspaper-line"></i> ${escapeHtml(source.company)}</a>` : ""}
            ${personCandidate ? `<span class="tag tag--person"><i class="ri-user-line"></i> Buying-Center-Kandidat</span>` : ""}
            ${article.article_type ? `<span class="tag"><i class="ri-file-text-line"></i> ${escapeHtml(ARTICLE_TYPE_LABELS[article.article_type] || article.article_type)}</span>` : ""}
            ${article.language ? `<span class="tag tag--language">${escapeHtml(article.language.toUpperCase())}</span>` : ""}
            ${(f.matched_keywords || []).map((k) => `<span class="meta-chip">${escapeHtml(k)}</span>`).join("")}
          </div>
          ${evidence ? `<blockquote class="finding-evidence"><i class="ri-double-quotes-l"></i><span>${escapeHtml(evidence)}</span></blockquote>` : ""}
        </article>
      `;
    }).join("");
  } catch (err) {
    listEl.innerHTML = `<div class="track-card-empty">Fehler beim Laden: ${escapeHtml(err.message)}</div>`;
  }
}

async function loadTaggingStats() {
  try {
    const stats = await callApi("get_tagging_stats");
    if (!els.taggingStatsText) return;
    if (!stats.total) {
      els.taggingStatsText.textContent = "Noch keine Artikel gecrawlt.";
      return;
    }
    els.taggingStatsText.innerHTML = `
      <span class="stats-part stats-part--reliable"><i class="ri-shield-check-line"></i> ${stats.reliable || 0} zuverlässig</span>
      <span class="stats-part stats-part--uncertain"><i class="ri-error-warning-line"></i> ${stats.uncertain || 0} prüfen</span>
      <span class="stats-part"><i class="ri-filter-off-line"></i> ${stats.rejected || 0} aussortiert</span>
      ${stats.error ? `<span class="stats-part stats-part--error"><i class="ri-alert-line"></i> ${stats.error} Fehler</span>` : ""}
      ${stats.legacy ? `<span class="stats-part"><i class="ri-history-line"></i> ${stats.legacy} Altbestand</span>` : ""}
    `;
  } catch { /* non-critical stat, fail quietly */ }
}

async function loadReviewArticles() {
  if (!els.reviewList) return;
  try {
    const { articles } = await callApi("list_review_articles", { limit: 20 });
    if (!articles?.length) {
      els.reviewList.innerHTML = `<div class="track-card-empty">Keine offenen oder fehlerhaften Klassifikationen.</div>`;
      return;
    }
    els.reviewList.innerHTML = articles.map((article) => {
      const source = article.source || null;
      const status = article.classification_status;
      const reasons = article.rejection_reasons || [];
      return `
        <article class="review-item" data-article-id="${escapeHtml(article.id)}">
          <div class="review-item-main">
            <span class="quality-tag quality-tag--${escapeHtml(status)}"><i class="ri-${status === "error" ? "alert-line" : status === "pending" ? "time-line" : "error-warning-line"}"></i> ${status === "uncertain" ? "Manuelle Prüfung" : status === "pending" ? "Ausstehend" : "Klassifikationsfehler"}</span>
            <a href="${escapeHtml(article.url || "#")}" target="_blank" rel="noopener" class="finding-title">${escapeHtml(article.title || "Ohne Titel")}</a>
            ${article.ai_summary ? `<p class="finding-summary">${escapeHtml(article.ai_summary)}</p>` : ""}
            ${article.ai_rationale ? `<p class="finding-rationale"><i class="ri-focus-3-line"></i><span>${escapeHtml(article.ai_rationale)}</span></p>` : ""}
            ${reasons.length ? `<div class="review-reasons">${reasons.map((reason) => `<span>${escapeHtml(reason)}</span>`).join("")}</div>` : ""}
          </div>
          <div class="finding-meta">
            ${article.primary_company ? `<span class="tag tag--kunde"><i class="ri-building-line"></i> ${escapeHtml(article.primary_company)}</span>` : ""}
            ${source?.company ? `<span class="tag tag--source"><i class="ri-newspaper-line"></i> ${escapeHtml(source.company)}</span>` : ""}
            ${formatConfidence(article.relevance_confidence) ? `<span class="tag"><i class="ri-percent-line"></i> ${formatConfidence(article.relevance_confidence)}</span>` : ""}
          </div>
        </article>`;
    }).join("");
  } catch (err) {
    els.reviewList.innerHTML = `<div class="track-card-empty">Prüfliste konnte nicht geladen werden: ${escapeHtml(err.message)}</div>`;
  }
}

const STATUS_LABELS = {
  reliable: "Zuverlässig ausgewählt",
  uncertain: "Manuelle Prüfung",
  rejected: "Aussortiert",
  error: "Klassifikationsfehler",
  pending: "Ausstehend",
  legacy: "Altbestand",
};

function renderDetailTags(article) {
  const topics = article.topics || [];
  const companies = article.matched_companies || [];
  const people = article.matched_persons || [];
  return [
    ...topics.map((topic) => `<span class="tag">${escapeHtml(TOPIC_LABELS[topic] || topic)}</span>`),
    article.territory ? `<span class="tag">${escapeHtml(TERRITORY_LABELS[article.territory] || article.territory)}</span>` : "",
    ...companies.map((company) => `<span class="tag tag--kunde"><i class="ri-building-line"></i> ${escapeHtml(company)}</span>`),
    ...people.map((person) => `<span class="tag tag--person"><i class="ri-user-line"></i> ${escapeHtml(person)}</span>`),
  ].join("");
}

async function openArticleDetail(articleId) {
  if (!articleId) return;
  els.articleDetailModal.classList.add("show");
  document.body.style.overflow = "hidden";
  els.articleDetailContent.innerHTML = `<div class="detail-loading">Artikel wird geladen…</div>`;
  try {
    const { article } = await callApi("get_article_detail", { article_id: articleId });
    const source = Array.isArray(article.source) ? article.source[0] : article.source;
    const status = article.classification_status || "legacy";
    const reasons = article.rejection_reasons || [];
    const evidence = Object.entries(article.tag_evidence || {});
    const confidence = formatConfidence(article.relevance_confidence);
    const fulltext = article.cleaned_content || article.content || article.excerpt || "Kein Artikeltext gespeichert.";
    els.articleDetailContent.innerHTML = `
      <button type="button" class="article-detail-close" aria-label="Schließen"><i class="ri-close-line"></i></button>
      <main class="article-detail-main">
        <span class="article-detail-kicker">${escapeHtml(source?.company || "Signal Layer")}</span>
        <h2 class="article-detail-title" id="article-detail-title">${escapeHtml(article.title || "Ohne Titel")}</h2>
        <div class="article-detail-meta">
          ${article.published_at ? `<span class="tag"><i class="ri-calendar-line"></i> ${escapeHtml(new Date(article.published_at).toLocaleDateString("de-DE"))}</span>` : ""}
          ${article.article_type ? `<span class="tag"><i class="ri-file-text-line"></i> ${escapeHtml(ARTICLE_TYPE_LABELS[article.article_type] || article.article_type)}</span>` : ""}
          ${article.language ? `<span class="tag tag--language">${escapeHtml(article.language.toUpperCase())}</span>` : ""}
          ${article.url ? `<a class="tag tag--source" href="${escapeHtml(article.url)}" target="_blank" rel="noopener"><i class="ri-external-link-line"></i> Originalquelle</a>` : ""}
        </div>
        ${article.ai_summary ? `<p class="article-detail-summary">${escapeHtml(article.ai_summary)}</p>` : ""}
        <div class="article-fulltext">${escapeHtml(fulltext)}</div>
      </main>
      <aside class="article-detail-aside">
        <h3>Warum diese Entscheidung?</h3>
        <p class="decision-lead">Die rechte Prüfleiste zeigt Modellentscheidung, bestandene Regeln und die wörtlichen Belege.</p>
        <div class="decision-block">
          <span class="decision-label">Ergebnis</span>
          <span class="quality-tag quality-tag--${escapeHtml(status)}"><i class="ri-${status === "reliable" ? "shield-check-line" : status === "rejected" ? "filter-off-line" : "error-warning-line"}"></i> ${escapeHtml(STATUS_LABELS[status] || status)}${confidence ? ` · ${confidence}` : ""}</span>
        </div>
        <div class="decision-block">
          <span class="decision-label">Begründung</span>
          <p class="decision-rationale">${escapeHtml(article.ai_rationale || reasons[0] || "Für den Altbestand liegt noch keine neue Prüfbegründung vor.")}</p>
        </div>
        ${reasons.length ? `<div class="decision-block"><span class="decision-label">Ausschlussregeln</span><div class="review-reasons">${reasons.map((reason) => `<span>${escapeHtml(reason)}</span>`).join("")}</div></div>` : ""}
        <div class="decision-block">
          <span class="decision-label">Tags & Routing</span>
          <div class="decision-tags">${renderDetailTags(article) || `<span class="decision-lead">Keine Tags vergeben</span>`}</div>
        </div>
        ${evidence.length ? `<div class="decision-block"><span class="decision-label">Bestandene Evidenzregeln</span><div class="evidence-list">${evidence.map(([key, quote]) => `<blockquote class="evidence-item"><strong>${escapeHtml(key)}</strong>${escapeHtml(quote)}</blockquote>`).join("")}</div></div>` : ""}
        <div class="decision-block">
          <span class="decision-label">Technische Prüfung</span>
          <p class="decision-rationale">${escapeHtml(article.ai_model || "Regelbasiert")} ${article.reviewer_model ? `+ Review durch ${escapeHtml(article.reviewer_model)}` : ""}<br>Prompt: ${escapeHtml(article.prompt_version || "Legacy")}</p>
        </div>
      </aside>`;
  } catch (err) {
    els.articleDetailContent.innerHTML = `<button type="button" class="article-detail-close" aria-label="Schließen"><i class="ri-close-line"></i></button><div class="detail-loading">Detail konnte nicht geladen werden: ${escapeHtml(err.message)}</div>`;
  }
}

function closeArticleDetail() {
  els.articleDetailModal.classList.remove("show");
  document.body.style.overflow = "";
}

async function loadClassificationTests() {
  if (!els.testResults) return;
  try {
    const { articles } = await callApi("list_classification_tests", { limit: 10 });
    els.testCount.textContent = `${articles.length} von 10 geprüft`;
    if (!articles.length) {
      els.testResults.innerHTML = `<div class="track-card-empty">Der Praxistest wurde noch nicht gestartet.</div>`;
      return;
    }
    els.testResults.innerHTML = articles.map((article, index) => {
      const status = article.classification_status;
      const confidence = formatConfidence(article.relevance_confidence);
      const reason = article.ai_rationale || (article.rejection_reasons || [])[0] || "Entscheidung gespeichert";
      return `<article class="test-result" data-article-id="${escapeHtml(article.id)}" tabindex="0">
        <div class="test-result-top"><span class="finding-dimension">Test ${index + 1}</span><span class="quality-tag quality-tag--${escapeHtml(status)}">${escapeHtml(STATUS_LABELS[status] || status)}${confidence ? ` · ${confidence}` : ""}</span></div>
        <span class="test-result-title">${escapeHtml(article.title || "Ohne Titel")}</span>
        <p class="test-result-reason">${escapeHtml(reason)}</p>
      </article>`;
    }).join("");
  } catch (err) {
    els.testResults.innerHTML = `<div class="track-card-empty">Testergebnisse konnten nicht geladen werden: ${escapeHtml(err.message)}</div>`;
  }
}

function formatUrlDisplay(urlStr) {
  try {
    const u = new URL(urlStr);
    const path = u.pathname.replace(/\/$/, "");
    if (path) return path + u.search;
    return u.hostname.replace(/^www\./, "");
  } catch {
    return urlStr;
  }
}

function openSettings() {
  els.settingsModal.classList.add("show");
  if (sources.length === 0) void loadSources();
}
function closeSettings() {
  els.settingsModal.classList.remove("show");
}

function openAddSource() {
  els.addSourceForm.reset();
  els.addSourceModal.classList.add("show");
  els.fCompany.focus();
}
function closeAddSource() {
  els.addSourceModal.classList.remove("show");
}

async function loadSources() {
  els.sourceTableBody.innerHTML = `<tr><td colspan="5" class="source-empty"><i class="ri-loader-4-line ri-spin"></i> Lädt…</td></tr>`;
  try {
    const { sources: data } = await callApi("list_sources");
    sources = data || [];
    populateCategoryFilter();
    renderSources();
  } catch (err) {
    els.sourceTableBody.innerHTML = `<tr><td colspan="5" class="source-empty">Fehler beim Laden: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function populateCategoryFilter() {
  const categories = [...new Set(sources.map((s) => s.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "de")
  );
  const current = els.sourceCategoryFilter.value || "all";
  els.sourceCategoryFilter.innerHTML =
    `<option value="all">Alle Kategorien</option>` +
    categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  if (categories.includes(current)) els.sourceCategoryFilter.value = current;
}

function getFilteredSorted() {
  const q = state.search.trim().toLowerCase();
  let list = sources.filter((s) => {
    if (state.category !== "all" && s.category !== state.category) return false;
    if (state.status === "active" && !s.active) return false;
    if (state.status === "inactive" && s.active) return false;
    if (q) {
      const hay = `${s.company} ${s.url} ${s.category || ""} ${s.description || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const [field, dir] = state.sort.split("_");
  list = list.slice().sort((a, b) => {
    let av, bv;
    if (field === "company") { av = a.company || ""; bv = b.company || ""; }
    else if (field === "category") { av = a.category || ""; bv = b.category || ""; }
    else if (field === "created") { av = a.created_at || ""; bv = b.created_at || ""; }
    else { av = ""; bv = ""; }
    const cmp = String(av).localeCompare(String(bv), "de");
    return dir === "desc" ? -cmp : cmp;
  });
  return list;
}

function renderSources() {
  const list = getFilteredSorted();
  els.sourceCount.textContent = `${list.length} von ${sources.length}`;

  if (list.length === 0) {
    els.sourceTableBody.innerHTML = `<tr><td colspan="5" class="source-empty">Keine URLs gefunden.</td></tr>`;
    return;
  }

  els.sourceTableBody.innerHTML = list.map((s) => `
    <tr data-id="${s.id}" class="${s.active ? "" : "source-row--inactive"}">
      <td>
        <div class="source-company">${escapeHtml(s.company)}</div>
        ${s.description ? `<div class="source-desc">${escapeHtml(s.description)}</div>` : ""}
      </td>
      <td><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener" class="source-url"><i class="ri-external-link-line"></i> ${escapeHtml(formatUrlDisplay(s.url))}</a></td>
      <td>${s.category ? `<span class="tag">${escapeHtml(s.category)}</span>` : ""}</td>
      <td>
        <label class="source-toggle">
          <input type="checkbox" class="source-active-toggle" data-id="${s.id}" ${s.active ? "checked" : ""}>
          <span class="source-toggle-slider"></span>
        </label>
      </td>
      <td>
        <button type="button" class="icon-btn source-delete-btn" data-id="${s.id}" title="Löschen">
          <i class="ri-delete-bin-line"></i>
        </button>
      </td>
    </tr>
  `).join("");
}

async function toggleSourceActive(id, active) {
  const row = sources.find((s) => s.id === id);
  if (row) row.active = active; // optimistic
  renderSources();
  try {
    await callApi("update_source", { id, active });
  } catch (err) {
    if (row) row.active = !active;
    renderSources();
    toast(err.message, "err");
  }
}

async function deleteSource(id) {
  const row = sources.find((s) => s.id === id);
  if (!row) return;
  if (!confirm(`"${row.company}" wirklich löschen?`)) return;
  try {
    await callApi("delete_source", { id });
    sources = sources.filter((s) => s.id !== id);
    populateCategoryFilter();
    renderSources();
    toast("URL gelöscht");
  } catch (err) {
    toast(err.message, "err");
  }
}

async function submitAddSource(e) {
  e.preventDefault();
  const company = els.fCompany.value.trim();
  const url = els.fUrl.value.trim();
  const category = els.fCategory.value.trim();
  const description = els.fDescription.value.trim();
  if (!company || !url) return;
  try {
    const { source } = await callApi("add_source", { company, url, category, description });
    sources.push(source);
    populateCategoryFilter();
    renderSources();
    closeAddSource();
    toast("URL hinzugefügt");
  } catch (err) {
    toast(err.message, "err");
  }
}

// ---------------------------------------------------------------------------
// Keywords (per track: marketing / sales)
// ---------------------------------------------------------------------------
const keywordsByTrack = { marketing: null, sales: null };

function keywordListEl(track) {
  return track === "marketing" ? els.keywordListMarketing : els.keywordListSales;
}
function keywordInputEl(track) {
  return track === "marketing" ? els.keywordInputMarketing : els.keywordInputSales;
}

async function loadKeywords(track) {
  const listEl = keywordListEl(track);
  listEl.innerHTML = `<div class="keyword-empty"><i class="ri-loader-4-line ri-spin"></i> Lädt…</div>`;
  try {
    const { keywords } = await callApi("list_keywords", { track });
    keywordsByTrack[track] = keywords || [];
    renderKeywords(track);
  } catch (err) {
    listEl.innerHTML = `<div class="keyword-empty">Fehler: ${escapeHtml(err.message)}</div>`;
  }
}

function renderKeywords(track) {
  const listEl = keywordListEl(track);
  const list = keywordsByTrack[track] || [];
  if (list.length === 0) {
    listEl.innerHTML = `<div class="keyword-empty">Noch keine Keywords für diesen Track.</div>`;
    return;
  }
  listEl.innerHTML = list.map((k) => `
    <div class="keyword-row ${k.active ? "" : "keyword-row--inactive"}" data-id="${k.id}">
      <span class="keyword-row-text">${escapeHtml(k.keyword)}</span>
      <label class="source-toggle">
        <input type="checkbox" class="keyword-active-toggle" data-track="${track}" data-id="${k.id}" ${k.active ? "checked" : ""}>
        <span class="source-toggle-slider"></span>
      </label>
      <button type="button" class="icon-btn keyword-delete-btn" data-track="${track}" data-id="${k.id}" title="Löschen">
        <i class="ri-delete-bin-line"></i>
      </button>
    </div>
  `).join("");
}

async function addKeyword(track) {
  const input = keywordInputEl(track);
  const keyword = input.value.trim();
  if (!keyword) return;
  try {
    const { keyword: created } = await callApi("add_keyword", { track, keyword });
    keywordsByTrack[track] = [...(keywordsByTrack[track] || []), created];
    renderKeywords(track);
    input.value = "";
  } catch (err) {
    toast(err.message, "err");
  }
}

async function toggleKeywordActive(track, id, active) {
  const row = (keywordsByTrack[track] || []).find((k) => k.id === id);
  if (row) row.active = active;
  renderKeywords(track);
  try {
    await callApi("update_keyword", { id, active });
  } catch (err) {
    if (row) row.active = !active;
    renderKeywords(track);
    toast(err.message, "err");
  }
}

async function deleteKeyword(track, id) {
  try {
    await callApi("delete_keyword", { id });
    keywordsByTrack[track] = (keywordsByTrack[track] || []).filter((k) => k.id !== id);
    renderKeywords(track);
    toast("Keyword gelöscht");
  } catch (err) {
    toast(err.message, "err");
  }
}

// ---------------------------------------------------------------------------
// Crawl trigger
// ---------------------------------------------------------------------------
function renderCrawlCategoryOptions() {
  const categories = [...new Set(sources.map((s) => s.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "de")
  );
  els.crawlCategoryList.innerHTML = categories.map((c) => `
    <label class="crawl-category-option">
      <input type="checkbox" value="${escapeHtml(c)}"> ${escapeHtml(c)}
    </label>
  `).join("");
}

async function openCrawlDropdown() {
  if (sources.length === 0) {
    try { const { sources: data } = await callApi("list_sources"); sources = data || []; } catch { /* ignore */ }
  }
  renderCrawlCategoryOptions();
  els.crawlDropdown.classList.add("show");
}
function closeCrawlDropdown() {
  els.crawlDropdown.classList.remove("show");
}

async function confirmCrawl() {
  const scopeType = document.querySelector('input[name="crawl-scope"]:checked').value;
  let scope = {};
  if (scopeType === "selected") {
    const categories = [...els.crawlCategoryList.querySelectorAll("input:checked")].map((i) => i.value);
    if (categories.length === 0) {
      toast("Bitte mindestens eine Kategorie auswählen", "err");
      return;
    }
    scope = { categories };
  }
  try {
    await callApi("run_crawl", { scope });
    toast("Crawl gestartet");
    closeCrawlDropdown();
    await loadLastRun();
  } catch (err) {
    toast(err.message, "err");
  }
}

function formatRelativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  return `vor ${Math.round(hours / 24)} Tag(en)`;
}

const STATUS_LABEL = { queued: "eingereiht", running: "läuft", done: "abgeschlossen", error: "fehlgeschlagen" };

async function loadLastRun() {
  try {
    const { crawl_runs } = await callApi("list_crawl_runs");
    const last = (crawl_runs || [])[0];
    if (!last) { els.lastRunText.textContent = "Noch kein Crawl-Lauf."; return; }
    const trigger = last.trigger_type === "scheduled" ? "automatisch (6 Uhr)" : "manuell";
    els.lastRunText.textContent =
      `Letzter Crawl: ${formatRelativeTime(last.started_at)} · ${trigger} · Status: ${STATUS_LABEL[last.status] || last.status}`;
  } catch {
    els.lastRunText.textContent = "Noch kein Crawl-Lauf.";
  }
}

function bindUi() {
  const openCardDetail = (event) => {
    if (event.target.closest("a")) return;
    const card = event.target.closest("[data-article-id]");
    if (card) void openArticleDetail(card.dataset.articleId);
  };
  [els.findingsListMarketing, els.findingsListSales, els.reviewList, els.testResults].forEach((container) => {
    container?.addEventListener("click", openCardDetail);
    container?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") openCardDetail(event);
    });
  });
  els.articleDetailModal.addEventListener("click", (event) => {
    if (event.target === els.articleDetailModal || event.target.closest(".article-detail-close")) closeArticleDetail();
  });

  els.btnSettings.addEventListener("click", openSettings);
  els.btnSettingsClose.addEventListener("click", closeSettings);
  els.settingsModal.addEventListener("click", (e) => {
    if (e.target === els.settingsModal) closeSettings();
  });

  els.settingsNav.querySelectorAll(".settings-nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      els.settingsNav.querySelectorAll(".settings-nav-item").forEach((i) => i.classList.remove("active"));
      item.classList.add("active");
      const panel = item.dataset.panel;
      document.querySelectorAll(".settings-panel").forEach((p) => p.classList.remove("show"));
      document.getElementById(`settings-panel-${panel}`)?.classList.add("show");
      if (panel === "keywords-marketing" && !keywordsByTrack.marketing) void loadKeywords("marketing");
      if (panel === "keywords-sales" && !keywordsByTrack.sales) void loadKeywords("sales");
    });
  });

  els.btnAddKeywordMarketing.addEventListener("click", () => void addKeyword("marketing"));
  els.btnAddKeywordSales.addEventListener("click", () => void addKeyword("sales"));
  els.keywordInputMarketing.addEventListener("keydown", (e) => { if (e.key === "Enter") void addKeyword("marketing"); });
  els.keywordInputSales.addEventListener("keydown", (e) => { if (e.key === "Enter") void addKeyword("sales"); });

  els.keywordListMarketing.addEventListener("change", (e) => {
    const t = e.target.closest(".keyword-active-toggle");
    if (t) void toggleKeywordActive("marketing", t.dataset.id, t.checked);
  });
  els.keywordListSales.addEventListener("change", (e) => {
    const t = e.target.closest(".keyword-active-toggle");
    if (t) void toggleKeywordActive("sales", t.dataset.id, t.checked);
  });
  els.keywordListMarketing.addEventListener("click", (e) => {
    const b = e.target.closest(".keyword-delete-btn");
    if (b) void deleteKeyword("marketing", b.dataset.id);
  });
  els.keywordListSales.addEventListener("click", (e) => {
    const b = e.target.closest(".keyword-delete-btn");
    if (b) void deleteKeyword("sales", b.dataset.id);
  });

  els.btnCrawlTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (els.crawlDropdown.classList.contains("show")) closeCrawlDropdown();
    else void openCrawlDropdown();
  });
  els.crawlDropdown.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => closeCrawlDropdown());
  document.querySelectorAll('input[name="crawl-scope"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      els.crawlCategoryList.classList.toggle("show", radio.value === "selected" && radio.checked);
    });
  });
  els.btnCrawlConfirm.addEventListener("click", () => void confirmCrawl());

  let searchTimer = null;
  els.sourceSearch.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = els.sourceSearch.value;
      renderSources();
    }, 100);
  });
  els.sourceCategoryFilter.addEventListener("change", () => {
    state.category = els.sourceCategoryFilter.value;
    renderSources();
  });
  els.sourceStatusFilter.addEventListener("change", () => {
    state.status = els.sourceStatusFilter.value;
    renderSources();
  });
  els.sourceSort.addEventListener("change", () => {
    state.sort = els.sourceSort.value;
    renderSources();
  });

  els.sourceTableBody.addEventListener("change", (e) => {
    const toggle = e.target.closest(".source-active-toggle");
    if (toggle) void toggleSourceActive(toggle.dataset.id, toggle.checked);
  });
  els.sourceTableBody.addEventListener("click", (e) => {
    const btn = e.target.closest(".source-delete-btn");
    if (btn) void deleteSource(btn.dataset.id);
  });

  els.btnAddSource.addEventListener("click", openAddSource);
  els.btnAddSourceCancel.addEventListener("click", closeAddSource);
  els.addSourceModal.addEventListener("click", (e) => {
    if (e.target === els.addSourceModal) closeAddSource();
  });
  els.addSourceForm.addEventListener("submit", submitAddSource);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (els.articleDetailModal.classList.contains("show")) closeArticleDetail();
    else if (els.addSourceModal.classList.contains("show")) closeAddSource();
    else if (els.settingsModal.classList.contains("show")) closeSettings();
  });
}

export function initApp(client) {
  sb = client;
  if (!appInitialized) {
    appInitialized = true;
    cacheEls();
    bindUi();
  }
  void loadLastRun();
  void loadFindings("marketing");
  void loadFindings("sales");
  void loadTaggingStats();
  void loadReviewArticles();
  void loadClassificationTests();
}
