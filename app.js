import { SIGNAL_LAYER_API_URL } from "./config.js";

let sb = null;
let sources = [];
let appInitialized = false;
let pipelineSettings = null;

const state = {
  search: "",
  category: "all",
  status: "all", // all | active | inactive
  sort: "company_asc",
};

const signalViewState = { status: "all", company: "all", source: "all", sort: "recommended" };
const findingsByTrack = { marketing: [], sales: [] };

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

function decodeHtmlEntities(value) {
  let decoded = String(value ?? "");
  // Some feeds encode entities twice, e.g. &amp;#039; instead of an apostrophe.
  for (let i = 0; i < 2; i += 1) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = decoded;
    if (textarea.value === decoded) break;
    decoded = textarea.value;
  }
  return decoded;
}

function escapeText(value) {
  return escapeHtml(decodeHtmlEntities(value));
}

function normalizeTextWithMap(value) {
  const text = decodeHtmlEntities(value);
  let normalized = "";
  const positions = [];
  let pendingSpace = false;
  let pendingPosition = 0;

  for (let index = 0; index < text.length; index += 1) {
    const folded = text[index].toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss");
    for (const character of folded) {
      if (/[a-z0-9]/.test(character)) {
        if (pendingSpace && normalized) {
          normalized += " ";
          positions.push(pendingPosition);
        }
        normalized += character;
        positions.push(index);
        pendingSpace = false;
      } else if (normalized) {
        pendingSpace = true;
        pendingPosition = index;
      }
    }
  }
  return { text, normalized, positions };
}

function findEvidenceRanges(value, evidence) {
  const haystack = normalizeTextWithMap(value);
  const ranges = [];
  evidence.forEach(([, quote], evidenceIndex) => {
    const needle = normalizeTextWithMap(String(quote || "")).normalized;
    if (needle.length < 4) return;
    let from = 0;
    while (from < haystack.normalized.length) {
      const match = haystack.normalized.indexOf(needle, from);
      if (match < 0) break;
      const start = haystack.positions[match];
      const end = haystack.positions[match + needle.length - 1] + 1;
      if (Number.isInteger(start) && Number.isInteger(end)) ranges.push({ start, end, evidenceIndex });
      from = match + needle.length;
    }
  });
  return { text: haystack.text, ranges };
}

function renderEvidenceLinkedText(value, evidence) {
  const { text, ranges } = findEvidenceRanges(value, evidence);
  if (!ranges.length) return escapeHtml(text);
  const boundaries = [...new Set([0, text.length, ...ranges.flatMap(({ start, end }) => [start, end])])].sort((a, b) => a - b);
  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1];
    const evidenceIndexes = ranges
      .filter((range) => range.start <= start && range.end >= end)
      .map((range) => range.evidenceIndex);
    const content = escapeHtml(text.slice(start, end));
    return evidenceIndexes.length
      ? `<mark class="evidence-passage" data-evidence-indexes="${evidenceIndexes.join(",")}">${content}</mark>`
      : content;
  }).join("");
}

function bindEvidenceHover() {
  const items = els.articleDetailContent.querySelectorAll(".evidence-item[data-evidence-index]");
  const passages = els.articleDetailContent.querySelectorAll(".evidence-passage");
  const setHighlight = (index, active) => {
    passages.forEach((passage) => {
      const indexes = (passage.dataset.evidenceIndexes || "").split(",");
      if (indexes.includes(String(index))) passage.classList.toggle("is-active", active);
    });
    if (active) {
      const firstMatch = [...passages].find((passage) => passage.classList.contains("is-active"));
      firstMatch?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };
  items.forEach((item) => {
    const index = item.dataset.evidenceIndex;
    item.addEventListener("mouseenter", () => setHighlight(index, true));
    item.addEventListener("mouseleave", () => setHighlight(index, false));
    item.addEventListener("focus", () => setHighlight(index, true));
    item.addEventListener("blur", () => setHighlight(index, false));
  });
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

  els.btnCrawlTrigger = document.getElementById("btn-crawl-trigger");
  els.crawlDropdown = document.getElementById("crawl-dropdown");
  els.crawlCategoryList = document.getElementById("crawl-category-list");
  els.btnCrawlConfirm = document.getElementById("btn-crawl-confirm");
  els.lastRunText = document.getElementById("last-run-text");
  els.backfillProgressText = document.getElementById("backfill-progress-text");
  els.backfillProgressBar = document.getElementById("backfill-progress-bar");
  els.backfillProgressDetail = document.getElementById("backfill-progress-detail");
  els.apiErrorList = document.getElementById("api-error-list");
  els.pipelineVersion = document.getElementById("pipeline-version");
  els.btnSavePipeline = document.getElementById("btn-save-pipeline");
  els.btnSavePipelineHeader = document.getElementById("btn-save-pipeline-header");
  els.btnPreviewPipeline = document.getElementById("btn-preview-pipeline");
  els.geminiCostStat = document.getElementById("gemini-cost-stat");
  els.geminiCostMonth = document.getElementById("gemini-cost-month");
  els.geminiCostToday = document.getElementById("gemini-cost-today");
  els.geminiRequestCount = document.getElementById("gemini-request-count");
  els.sourceAttemptCount = document.getElementById("source-attempt-count");
  els.sourceHealthNote = document.getElementById("source-health-note");

  els.findingsListMarketing = document.getElementById("findings-list-marketing");
  els.findingsListSales = document.getElementById("findings-list-sales");
  els.signalStatusFilter = document.getElementById("signal-status-filter");
  els.signalCompanyFilter = document.getElementById("signal-company-filter");
  els.signalSourceFilter = document.getElementById("signal-source-filter");
  els.signalSort = document.getElementById("signal-sort");
  els.marketingCount = document.getElementById("marketing-count");
  els.salesCount = document.getElementById("sales-count");
  els.articleDetailModal = document.getElementById("article-detail-modal");
  els.articleDetailContent = document.getElementById("article-detail-content");
}

const PIPELINE_FIELDS = {
  crawl: [
    ["crawl.freshness_days", "number", "Rückblick in Tagen", "Beim ersten Crawl werden nur Artikel aus diesem Zeitraum berücksichtigt.", 1, 365],
    ["crawl.future_tolerance_hours", "number", "Toleranz für Zukunftsdaten", "Zeitverschiebungen bis zu dieser Stundenzahl werden akzeptiert.", 0, 72],
    ["crawl.default_max_depth", "number", "Normale Crawl-Tiefe", "Maximale Linktiefe für redaktionelle Quellen und Newsrooms.", 1, 4],
    ["crawl.default_max_pages", "number", "Seiten je normaler Quelle", "Begrenzt die pro Lauf geöffneten Seiten.", 1, 250],
    ["crawl.event_max_depth", "number", "Event-Crawl-Tiefe", "Eventseiten bleiben bewusst flacher als Newsrooms.", 0, 3],
    ["crawl.event_max_pages", "number", "Seiten je Eventquelle", "Schützt vor Agenda-, Aussteller- und Navigationsmassen.", 1, 100],
  ],
  filters: [
    ["filters.minimum_text_length", "number", "Mindestlänge Artikeltext", "Kürzere Inhalte werden vor Gemini abgelehnt.", 100, 5000],
    ["filters.require_professional_signal", "boolean", "Fachsignal erforderlich", "Fordert Marketing, Customer, Retail, Innovation oder Strategie auf Deutsch oder Englisch."],
    ["filters.reject_career_pages", "boolean", "Karriereseiten ablehnen", "Filtert Jobs, Ausbildung, Bewerbung und Praktika."],
    ["filters.reject_faq_pages", "boolean", "FAQ- und Hilfeseiten ablehnen", "Entfernt allgemeine Fragen, Support und Serviceinhalte."],
    ["filters.reject_event_programs", "boolean", "Eventprogramme ablehnen", "Agenda, Tickets und reine Speakerlisten werden ausgeschlossen."],
    ["filters.reject_future_dates", "boolean", "Zukunftsdaten ablehnen", "Verhindert falsch interpretierte Event- oder Sitemap-Daten."],
    ["filters.deduplicate", "boolean", "Duplikate erkennen", "Identischer normalisierter Inhalt wird nur einmal ausgewertet."],
  ],
  ai: [
    ["ai.primary_model", "model", "Primary-Modell", "Analysiert alle Kandidaten nach dem deterministischen Vorfilter."],
    ["ai.review_model", "model", "Review-Modell", "Prüft nur die unten definierten Grenzfälle erneut."],
    ["ai.review_enabled", "boolean", "Zweite KI-Prüfung aktiv", "Schaltet die unabhängige Reviewer-Stufe ein oder aus."],
    ["ai.review_confidence_below", "decimal", "Review unter Konfidenz", "Plausible Ergebnisse unter diesem Wert erhalten eine zweite Prüfung.", .5, 1],
    ["ai.review_rejected_articles", "boolean", "Abgelehnte Artikel reviewen", "Normalerweise aus Kostengründen deaktiviert."],
    ["ai.thinking_level", "thinking", "Thinking-Level", "Mehr Thinking kann Qualität und Kosten erhöhen."],
    ["ai.max_output_tokens", "number", "Maximale Output-Tokens", "Obergrenze für Klassifikation, Übersetzung und Begründung.", 512, 8192],
    ["ai.daily_request_limit", "number", "Tägliches KI-Limit", "Technische Sicherheitsgrenze unabhängig vom AI-Studio-Budget.", 1, 10000],
    ["ai.daily_review_limit", "number", "Tägliches Pro-Review-Limit", "Separate Grenze für das teurere Review-Modell.", 0, 5000],
    ["ai.monthly_warning_usd", "number", "Kostenwarnung in USD", "Zeigt eine Warnung, stoppt die Pipeline aber nicht.", 0, 10000],
  ],
  quality: [
    ["quality.topic_confidence", "decimal", "Themen-Konfidenz", "Mindestwert für Marketing-, Customer-, Retail- und KI-Tags.", .5, 1],
    ["quality.territory_confidence", "decimal", "Territory-Konfidenz", "Mindestwert für ROOTS-Territories.", .5, 1],
    ["quality.company_confidence", "decimal", "Unternehmens-Konfidenz", "Mindestwert für belastbare Tier-1-Erkennung.", .5, 1],
    ["quality.person_confidence", "decimal", "Personen-Konfidenz", "Mindestwert für Person und Rolle.", .5, 1],
    ["quality.sales_trigger_confidence", "decimal", "Sales-Trigger-Konfidenz", "Mindestwert für strategische Trigger.", .5, 1],
    ["quality.routing_confidence", "decimal", "Routing-Konfidenz", "Mindestwert für separate Marketing-/Sales-Evidenz.", .5, 1],
    ["quality.reliable_confidence", "decimal", "Zuverlässig ab", "Gesamtschwelle für eine automatische Freigabe.", .5, 1],
  ],
  routing: [
    ["routing.marketing_enabled", "boolean", "Marketing-Routing", "Erzeugt Marketing-Kacheln bei direkter Evidenz."],
    ["routing.sales_enabled", "boolean", "Sales-Routing", "Erzeugt Sales-Kacheln bei erfüllten Bedingungen."],
    ["routing.buying_center_enabled", "boolean", "Buying-Center-Routing", "Markiert geeignete Rollen und Personen."],
    ["routing.sales_requires_tier1", "boolean", "Sales braucht Tier-1", "Verhindert Sales-Routing ohne Zielunternehmen."],
    ["routing.sales_requires_trigger", "boolean", "Sales braucht strategischen Trigger", "Eine Unternehmensnennung allein reicht nicht."],
    ["routing.buying_center_requires_person", "boolean", "Buying Center braucht Person/Rolle", "Verhindert generische Buying-Center-Zuordnung."],
    ["routing.subsector_alone_is_marketing", "boolean", "Sub-Branche allein als Marketing", "Bewusst streng deaktiviert: Marktbeobachtung allein ist kein direktes Marketingsignal."],
  ],
};

function getConfigValue(path) { return path.split(".").reduce((value, key) => value?.[key], pipelineSettings?.config); }
function setConfigValue(path, value) {
  const keys = path.split("."); let target = pipelineSettings.config;
  keys.slice(0, -1).forEach((key) => { target = target[key]; });
  target[keys.at(-1)] = value;
}

function renderPipelineFields(section) {
  const target = document.getElementById(`pipeline-form-${section}`);
  if (!target || !pipelineSettings) return;
  target.innerHTML = PIPELINE_FIELDS[section].map(([path, type, label, description, min, max]) => {
    const value = getConfigValue(path);
    let control = `<input class="pipeline-control" data-pipeline-path="${path}" type="number" value="${value}" min="${min}" max="${max}" step="${type === "decimal" ? ".01" : "1"}">`;
    if (type === "boolean") control = `<label class="source-toggle pipeline-switch"><input data-pipeline-path="${path}" type="checkbox" ${value ? "checked" : ""}><span class="source-toggle-slider"></span></label>`;
    if (type === "model") control = `<select class="pipeline-control" data-pipeline-path="${path}">${["gemini-3.5-flash", "gemini-3.1-pro-preview", "gemini-3.1-flash-lite"].map((model) => `<option ${model === value ? "selected" : ""}>${model}</option>`).join("")}</select>`;
    if (type === "thinking") control = `<select class="pipeline-control" data-pipeline-path="${path}">${["minimal", "low", "medium", "high"].map((level) => `<option ${level === value ? "selected" : ""}>${level}</option>`).join("")}</select>`;
    return `<div class="pipeline-field"><div class="pipeline-field-copy"><label>${escapeHtml(label)}</label><small>${escapeHtml(description)}</small></div>${control}</div>`;
  }).join("");
}

async function loadPipelineSettings() {
  if (pipelineSettings) return;
  const { settings } = await callApi("get_pipeline_settings");
  pipelineSettings = settings;
  ["crawl", "filters", "ai", "quality", "routing"].forEach(renderPipelineFields);
  renderBusinessPipelineStudio();
  els.pipelineVersion.textContent = `Version ${settings.version} · zuletzt ${new Date(settings.updated_at).toLocaleString("de-DE")}`;
}

const RELEVANCE_CARDS = [
  { id: "customer_insights", icon: "ri-user-heart-line", title: "Customer Insights", description: "Kaufverhalten, Bedürfnisse, Zielgruppen, Experience, Loyalität und Shopper-Verhalten.", code: "DE/EN-Signalfamilien erkennen einen plausiblen Customer-Kontext, geben aber nicht frei.", prompt: "Fordert eine echte Kundenerkenntnis und eine wörtliche Belegstelle statt allgemeiner Aussagen.", ai: "Bewertet Bedeutung, Übertragbarkeit und konkreten Nutzen für Marketingentscheidungen.", server: "Prüft Evidenz im Originaltext und erlaubt Customer-Routing nur nach der aktiven Policy." },
  { id: "marketing_insights", icon: "ri-megaphone-line", title: "Marketing & Markenstrategie", description: "Positionierung, Rebranding, Kampagnen, Aktivierung, Kommunikation und Media.", code: "Erkennt fachliche Marken- und Kampagnenmuster; einzelne Wörter reichen nicht.", prompt: "Untersagt Marketing aus bloßen Marken-, Produkt-, Finanz- oder Personalnennungen.", ai: "Unterscheidet echte Strategie von einer allgemeinen Unternehmensmeldung.", server: "Verlangt separate Marketing-Evidenz und ein zulässiges Thema für das Routing." },
  { id: "fmcg_retail_signale", icon: "ri-store-2-line", title: "FMCG & Retail", description: "Sortiment, Handelsmarke, Pricing, Promotion, Category Management, Stores und Retail Media.", code: "Erkennt konkrete Retail-Kontexte und entfernt Navigation, Karriere oder Service.", prompt: "Verlangt eine konkrete Retail-Entscheidung statt reiner Filial-, Logistik- oder Produktmeldung.", ai: "Bewertet strategische Bedeutung für Shopper, Marke oder Handelssteuerung.", server: "Retail darf nur nach aktivierter Policy und belegter Routing-Evidenz zu Marketing werden." },
  { id: "ki_performance", icon: "ri-sparkling-line", title: "KI, Innovation & Wirkung", description: "Konkrete Anwendungen, Automatisierung, Analytics und messbarer geschäftlicher Effekt.", code: "Fordert KI oder Innovation zusammen mit einem fachlichen Anwendungskontext.", prompt: "Fragt nach tatsächlichem Einsatz, Pilotstatus und konkreter oder messbarer Wirkung.", ai: "Trennt allgemeine KI-Meinung von einer relevanten Anwendung.", server: "Bei ‚Wirkung erforderlich‘ bleibt das Tag ohne belegte Umsetzung oder Wirkung gesperrt." },
  { id: "sub_branchen_insight", icon: "ri-line-chart-line", title: "Sub-Branchen-Insights", description: "Übertragbare Nachfrage-, Kategorie- oder Marktveränderungen über einen Einzelfall hinaus.", code: "Lässt plausible Markt- und Wachstumsentwicklungen zur KI-Prüfung zu.", prompt: "Ein Launch, eine Übernahme oder Expansion allein gilt nicht als Markt-Insight.", ai: "Muss erklären, warum die Beobachtung über das einzelne Unternehmen hinaus übertragbar ist.", server: "Prüft das Übertragbarkeitsfeld; allein entsteht standardmäßig keine Marketing-Kachel." },
];

function policyToggle(path, label, description, owner = "Policy + Servercode") {
  const checked = Boolean(getConfigValue(path));
  return `<div class="rule-row"><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small><span class="rule-owner"><i class="ri-settings-3-line"></i>${owner}</span></div><label class="source-toggle"><input data-pipeline-path="${path}" type="checkbox" ${checked ? "checked" : ""}><span class="source-toggle-slider"></span></label></div>`;
}

function renderBusinessPipelineStudio() {
  if (!pipelineSettings) return;
  const relevance = document.getElementById("relevance-profile-grid");
  if (relevance) relevance.innerHTML = RELEVANCE_CARDS.map((card) => `<article class="policy-card"><div class="policy-card-head"><span class="policy-card-icon"><i class="${card.icon}"></i></span><div class="policy-card-title"><h4>${card.title}</h4><p>${card.description}</p></div><select class="pipeline-control policy-mode" data-pipeline-path="relevance.${card.id}"><option value="relevant" ${getConfigValue(`relevance.${card.id}`) === "relevant" ? "selected" : ""}>Relevant</option><option value="impact_required" ${getConfigValue(`relevance.${card.id}`) === "impact_required" ? "selected" : ""}>Nur mit konkreter Wirkung</option><option value="not_relevant" ${getConfigValue(`relevance.${card.id}`) === "not_relevant" ? "selected" : ""}>Nicht relevant</option></select></div><div class="decision-map"><div class="decision-step"><b>Code-Vorfilter</b><span>${card.code}</span></div><div class="decision-step"><b>System-Prompt</b><span>${card.prompt}</span></div><div class="decision-step"><b>Gemini</b><span>${card.ai}</span></div><div class="decision-step"><b>Server & Ergebnis</b><span>${card.server}</span></div></div></article>`).join("");

  const decisions = document.getElementById("decision-rules-content");
  if (decisions) decisions.innerHTML = `
    <section class="rule-group"><div class="rule-group-head"><i class="ri-megaphone-line"></i><h4>Marketing-Routing</h4></div><div class="rule-list">
      ${policyToggle("decisions.customer_signal_qualifies_marketing", "Customer-Signal darf Marketing qualifizieren", "Nur mit wörtlicher Customer-Evidenz und bestandener Qualitätsprüfung.")}
      ${policyToggle("decisions.retail_signal_qualifies_marketing", "Retail-Signal darf Marketing qualifizieren", "Sortiment, Pricing, Promotion oder Store-Strategie können Marketing-Routing auslösen.")}
      ${policyToggle("relevance.allow_campaign_without_results", "Kampagnen vor Ergebnissen berücksichtigen", "Ein konkreter Kampagnenstart kann relevant sein, auch wenn noch keine Wirkung gemessen wurde.")}
      ${policyToggle("relevance.allow_product_launch_without_strategy", "Reine Produktlaunches zulassen", "Standardmäßig aus: Ohne Positionierung, Zielgruppe oder Kampagne bleibt ein Launch irrelevant.")}
      <div class="rule-row"><div><strong>Separate Marketing-Evidenz</strong><small>Gemini muss eine eigene Belegstelle für Marketing liefern; eine Unternehmensnennung reicht nie.</small><span class="rule-owner"><i class="ri-code-line"></i>System-Prompt + Servercode</span></div><span class="guardrail-lock"><i class="ri-lock-line"></i>Immer aktiv</span></div>
    </div></section>
    <section class="rule-group"><div class="rule-group-head"><i class="ri-line-chart-line"></i><h4>Sales-Routing</h4></div><div class="rule-list">
      ${policyToggle("routing.sales_requires_tier1", "Tier-1-Unternehmen erforderlich", "Sales entsteht nur für ein belastbar erkanntes Zielunternehmen.")}
      ${policyToggle("routing.sales_requires_trigger", "Strategischer Trigger erforderlich", "Expansion, Transformation, Investition, Portfolio, Agenturwechsel oder vergleichbarer Trigger.")}
      ${policyToggle("decisions.sales_requires_implementation", "Umsetzung statt Absicht verlangen", "Wenn aktiv, reichen vage Pläne oder unverbindliche Aussagen nicht.")}
      ${policyToggle("decisions.sales_allow_risks", "Strategische Risiken berücksichtigen", "Auch belastbare Risiken können eine relevante Ansprache begründen.")}
      <div class="rule-row"><div><strong>Reine Unternehmensnennung reicht nicht</strong><small>Sales benötigt immer einen eigenen, belegten strategischen Anlass.</small><span class="rule-owner"><i class="ri-code-line"></i>System-Prompt + Servercode</span></div><span class="guardrail-lock"><i class="ri-lock-line"></i>Immer aktiv</span></div>
    </div></section>
    <section class="rule-group"><div class="rule-group-head"><i class="ri-team-line"></i><h4>Buying Center</h4></div><div class="rule-list">
      ${policyToggle("routing.buying_center_enabled", "Buying-Center-Kandidaten anzeigen", "Wird erst nach erfolgreichem Sales-Routing geprüft.")}
      ${policyToggle("decisions.buying_center_allow_role_without_name", "Konkrete Rolle ohne Namen zulassen", "Beispiel: Head of Customer Experience, auch wenn keine Person genannt wird.")}
      <div class="rule-row"><div><strong>Reine CEO-/CMO-Ernennung ablehnen</strong><small>Eine Personalie ohne strategischen Trigger ist kein Buying-Center-Signal.</small><span class="rule-owner"><i class="ri-code-line"></i>Code-Guardrail</span></div><span class="guardrail-lock"><i class="ri-lock-line"></i>Immer aktiv</span></div>
    </div></section>
    <section class="rule-group"><div class="rule-group-head"><i class="ri-shield-check-line"></i><h4>Unveränderliche Schutzfilter</h4></div><div class="rule-list">${["Karriere, Bewerbung und Ausbildung", "FAQ, Hilfe und Support", "Navigation, Datenschutz und Impressum", "Eventagenda, Tickets und reine Speakerlisten", "Duplikate und inhaltsleere Seiten", "Alte oder offensichtlich falsche Zukunftsdaten"].map((label) => `<div class="rule-row"><div><strong>${label}</strong><small>Wird vor der KI regelbasiert entfernt und mit Ablehnungsgrund protokolliert.</small><span class="rule-owner"><i class="ri-code-line"></i>Code-Vorfilter</span></div><span class="guardrail-lock"><i class="ri-lock-line"></i>Immer aktiv</span></div>`).join("")}</div></section>`;

  const operations = document.getElementById("operations-content");
  if (operations) operations.innerHTML = `<div class="quality-choice">${[["strict","Streng","Weniger Artikel, höchste Zuverlässigkeit."],["balanced","Ausgewogen","Mehr Abdeckung bei weiterhin strenger Evidenz."],["discovery","Entdeckend","Mehr Grenzfälle für die manuelle Prüfung."]].map(([value,label,copy]) => `<label class="quality-option"><input type="radio" name="quality-profile" data-pipeline-path="experience.quality_profile" value="${value}" ${getConfigValue("experience.quality_profile") === value ? "checked" : ""}><b>${label}</b><small>${copy}</small></label>`).join("")}</div><div class="pipeline-form-grid">${policyToggle("ai.review_enabled", "Zweite Qualitätsprüfung", "Plausible Grenzfälle werden unabhängig durch das Review-Modell geprüft.", "KI-Orchestrierung")}${policyToggle("ai.review_rejected_articles", "Klare Ablehnungen erneut prüfen", "Normalerweise deaktiviert, um Kosten zu sparen.", "KI-Orchestrierung")}</div><div class="pipeline-savebar"><span>Änderungen gelten nur für zukünftige Analysen.</span><button class="btn-primary" type="button" onclick="document.getElementById('btn-save-pipeline-header').click()"><i class="ri-save-line"></i> Änderungen speichern</button></div>`;

  const diagnostics = document.getElementById("diagnostics-content");
  const q = pipelineSettings.config.quality;
  if (diagnostics) diagnostics.innerHTML = `<div class="diagnostic-grid"><section class="diagnostic-card"><h4>KI-Orchestrierung</h4><div class="diagnostic-row"><span>Primary</span><code>${escapeHtml(getConfigValue("ai.primary_model"))}</code></div><div class="diagnostic-row"><span>Reviewer</span><code>${escapeHtml(getConfigValue("ai.review_model"))}</code></div><div class="diagnostic-row"><span>Prompt-Version</span><code>roots-signal-v1.2.0</code></div><div class="diagnostic-row"><span>Thinking</span><code>${escapeHtml(getConfigValue("ai.thinking_level"))}</code></div></section><section class="diagnostic-card"><h4>Schwellen aus Profil „${escapeHtml(getConfigValue("experience.quality_profile"))}“</h4>${Object.entries(q).map(([key,value]) => `<div class="diagnostic-row"><span>${escapeHtml(key)}</span><code>${Number(value).toFixed(2)}</code></div>`).join("")}</section><section class="diagnostic-card"><h4>Aktive Entscheidungsquellen</h4><div class="diagnostic-row"><span>Vorfilter</span><code>TypeScript-Regeln</code></div><div class="diagnostic-row"><span>Semantik</span><code>System-Prompt + Gemini</code></div><div class="diagnostic-row"><span>Evidenz</span><code>Servervalidierung</code></div><div class="diagnostic-row"><span>Routing</span><code>Servercode</code></div></section><section class="diagnostic-card"><h4>Guardrails</h4><div class="diagnostic-row"><span>Prompt Injection</span><code>Artikel ist untrusted data</code></div><div class="diagnostic-row"><span>Evidenz</span><code>Originaltext-Match</code></div><div class="diagnostic-row"><span>Duplikate</span><code>SHA-256 Content Hash</code></div><div class="diagnostic-row"><span>Keywords</span><code>nicht aktiv</code></div></section></div>`;
}

async function loadPipelineReview() {
  const target = document.getElementById("pipeline-review-list");
  if (!target) return;
  const { articles } = await callApi("list_review_articles", { status: "uncertain", limit: 50 });
  target.innerHTML = (articles || []).map((article) => `<article class="review-item" data-article-id="${article.id}"><div class="review-item-main"><span class="quality-tag quality-tag--uncertain">Manuelle Prüfung</span><strong class="test-result-title">${escapeText(article.title)}</strong><p class="test-result-reason">${escapeText(article.ai_rationale || article.rejection_reasons?.[0] || "Unsichere Evidenz oder Einordnung")}</p></div></article>`).join("") || `<div class="keyword-empty">Aktuell sind keine Artikel in der manuellen Prüfung.</div>`;
}

async function loadPipelineOperations() {
  const target = document.getElementById("operations-content");
  if (!target || !pipelineSettings) return;
  renderBusinessPipelineStudio();
  const { cost_summary: costs, source_health: health } = await callApi("get_dashboard_status");
  target.insertAdjacentHTML("afterbegin", `<div class="telemetry-grid" style="margin-bottom:12px"><div class="telemetry-stat"><span>Gemini heute</span><b>${Number(costs?.today_usd || 0).toFixed(2)} USD</b></div><div class="telemetry-stat ${costs?.warning ? "telemetry-stat--warning" : ""}"><span>Gemini im Monat</span><b>${Number(costs?.month_usd || 0).toFixed(2)} USD</b></div><div class="telemetry-stat"><span>Quellenläufe</span><b>${Number(health?.attempts || 0).toLocaleString("de-DE")}</b></div><div class="telemetry-stat"><span>Crawl-Fehler</span><b>${Number(health?.errors || 0).toLocaleString("de-DE")}</b></div></div>`);
}

async function savePipelineSettings() {
  if (!pipelineSettings) return;
  collectPipelineDraft();
  const { settings } = await callApi("update_pipeline_settings", { config: pipelineSettings.config });
  pipelineSettings = settings;
  renderBusinessPipelineStudio();
  els.pipelineVersion.textContent = `Version ${settings.version} · gerade gespeichert`;
  toast("Pipeline-Konfiguration gespeichert");
}

function collectPipelineDraft() {
  document.querySelectorAll("[data-pipeline-path]").forEach((control) => {
    if (control.type === "radio" && !control.checked) return;
    const value = control.type === "checkbox" ? control.checked : control.type === "number" ? Number(control.value) : control.value;
    setConfigValue(control.dataset.pipelinePath, value);
  });
}

async function previewPipelineImpact() {
  if (!pipelineSettings) await loadPipelineSettings();
  collectPipelineDraft();
  const { impact } = await callApi("preview_pipeline_impact", { config: pipelineSettings.config });
  const target = document.getElementById("pipeline-impact-result");
  target.hidden = false;
  target.innerHTML = `<b>Regelbasierte Vorschau mit ${Number(impact.sample_size).toLocaleString("de-DE")} bestehenden Artikeln:</b> aktuell ${impact.current_visible} sichtbare Signale, mit dem Entwurf ${impact.projected_visible}. Veränderung: ${impact.delta > 0 ? "+" : ""}${impact.delta}. Die Vorschau verwendet vorhandene Klassifikationen und startet keine KI; neue Treffer durch eine spätere Neuanalyse kann sie deshalb nicht vorhersagen.`;
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
  acquisition_news: "M&A-Meldung",
  operations_news: "Operations-/Logistikmeldung",
  personnel_news: "Personalnachricht",
  event_report: "Event-Bericht",
  event_program: "Event-Programm",
  career: "Karriere",
  faq: "FAQ",
  overview: "Übersichtsseite",
  advertisement: "Anzeige",
  other: "Sonstiger Inhalt",
};

const SALES_TRIGGER_LABELS = {
  acquisition: "Übernahme", merger: "Fusion", market_entry: "Markteintritt",
  market_expansion: "Marktexpansion", investment: "Investition", restructuring: "Restrukturierung",
  portfolio_change: "Portfolioveränderung", transformation: "Transformation", rebranding: "Rebranding",
  campaign_launch: "Kampagnenstart", agency_change: "Agenturwechsel", ai_initiative: "KI-Initiative",
  retail_strategy: "Retail-Strategie", new_business_model: "Neues Geschäftsmodell",
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

function articleCompanies(article) {
  const candidates = [...(article.matched_companies || []), article.primary_company].filter(Boolean);
  return candidates.filter((company, index) =>
    candidates.findIndex((candidate) => candidate.toLowerCase() === company.toLowerCase()) === index
  );
}

function findingConfidence(finding) {
  const value = Number(finding.confidence ?? finding.article?.relevance_confidence ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function findingDate(finding) {
  const timestamp = new Date(finding.article?.published_at || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function findingSourceName(finding) {
  const source = finding.article?.source;
  const resolved = Array.isArray(source) ? source[0] : source;
  return String(resolved?.company || "").trim();
}

function refreshSignalSourceOptions() {
  const selected = signalViewState.source;
  const sourceNames = [...new Set([...findingsByTrack.marketing, ...findingsByTrack.sales]
    .map(findingSourceName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));
  els.signalSourceFilter.innerHTML = `<option value="all">Alle Quellen</option>${sourceNames
    .map((source) => `<option value="${escapeHtml(source)}">${escapeHtml(source)}</option>`).join("")}`;
  els.signalSourceFilter.value = sourceNames.includes(selected) ? selected : "all";
  signalViewState.source = els.signalSourceFilter.value;
}

function visibleFindings(track) {
  const filtered = findingsByTrack[track].filter((finding) => {
    const article = finding.article || {};
    const statusMatches = signalViewState.status === "all" || article.classification_status === signalViewState.status;
    const companyMatches = signalViewState.company === "all" || articleCompanies(article).length > 0;
    const sourceMatches = signalViewState.source === "all" || findingSourceName(finding) === signalViewState.source;
    return statusMatches && companyMatches && sourceMatches;
  });
  return [...filtered].sort((a, b) => {
    if (signalViewState.sort === "newest") return findingDate(b) - findingDate(a) || findingConfidence(b) - findingConfidence(a);
    if (signalViewState.sort === "confidence") return findingConfidence(b) - findingConfidence(a) || findingDate(b) - findingDate(a);
    const statusRank = { reliable: 2, uncertain: 1, legacy: 0 };
    const rankA = statusRank[a.article?.classification_status] ?? 0;
    const rankB = statusRank[b.article?.classification_status] ?? 0;
    return rankB - rankA || findingConfidence(b) - findingConfidence(a) || findingDate(b) - findingDate(a);
  });
}

function renderFindings(track) {
  const listEl = track === "marketing" ? els.findingsListMarketing : els.findingsListSales;
  const findings = visibleFindings(track);
  const countEl = track === "marketing" ? els.marketingCount : els.salesCount;
  countEl.textContent = findings.length.toLocaleString("de-DE");
    if (!findings || findings.length === 0) {
      listEl.innerHTML = `<div class="track-card-empty">Keine Signale entsprechen den gewählten Filtern.</div>`;
      return;
    }
    listEl.innerHTML = findings.map((f) => {
      const article = f.article || {};
      const dimLabel = TOPIC_LABELS[f.dimension] || f.dimension || "";
      const companies = articleCompanies(article);
      const source = article.source || null;
      const confidence = formatConfidence(f.confidence ?? article.relevance_confidence);
      const status = article.classification_status || "legacy";
      const isLegacy = status === "legacy";
      return `
        <article class="finding-item ${isLegacy ? "finding-item--legacy" : ""}" data-article-id="${escapeHtml(article.id)}" tabindex="0" role="button">
          <div class="finding-item-top">
            <span class="finding-dimension">${escapeHtml(dimLabel)}</span>
            <div class="finding-top-tags">
              <span class="quality-tag quality-tag--${escapeHtml(status)}"><i class="ri-${status === "reliable" ? "shield-check-line" : status === "legacy" ? "history-line" : "error-warning-line"}"></i> ${escapeHtml(STATUS_LABELS[status] || status)}${confidence && !isLegacy ? ` · ${confidence}` : ""}</span>
              ${formatFindingDate(article.published_at)}
            </div>
          </div>
          <span class="finding-title">${escapeText(article.title_de || article.title || article.url || "Ohne Titel")}</span>
          ${article.ai_summary ? `<p class="finding-summary">${escapeText(article.ai_summary)}</p>` : ""}
          <div class="finding-meta">
            ${companies.map((c) => `<span class="tag tag--kunde"><i class="ri-building-line"></i> ${escapeHtml(c)}</span>`).join("")}
            ${source?.company ? `<span class="tag tag--source" title="Quelle: ${escapeHtml(source.company)}"><i class="ri-newspaper-line"></i> ${escapeHtml(source.company)}</span>` : ""}
          </div>
        </article>
      `;
    }).join("");
}

async function loadFindings(track) {
  const listEl = track === "marketing" ? els.findingsListMarketing : els.findingsListSales;
  try {
    const { findings } = await callApi("list_findings", { track, limit: 50 });
    findingsByTrack[track] = findings || [];
    refreshSignalSourceOptions();
    renderFindings(track === "marketing" ? "sales" : "marketing");
    renderFindings(track);
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
            <a href="${escapeHtml(article.url || "#")}" target="_blank" rel="noopener" class="finding-title">${escapeText(article.title || "Ohne Titel")}</a>
            ${article.ai_summary ? `<p class="finding-summary">${escapeText(article.ai_summary)}</p>` : ""}
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
  const salesTriggers = article.sales_triggers || [];
  return [
    ...topics.map((topic) => `<span class="tag">${escapeHtml(TOPIC_LABELS[topic] || topic)}</span>`),
    article.territory ? `<span class="tag">${escapeHtml(TERRITORY_LABELS[article.territory] || article.territory)}</span>` : "",
    ...companies.map((company) => `<span class="tag tag--kunde"><i class="ri-building-line"></i> ${escapeHtml(company)}</span>`),
    ...people.map((person) => `<span class="tag tag--person"><i class="ri-user-line"></i> ${escapeHtml(person)}</span>`),
    ...salesTriggers.map((trigger) => `<span class="tag"><i class="ri-flashlight-line"></i> ${escapeHtml(SALES_TRIGGER_LABELS[trigger] || trigger)}</span>`),
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
        <h2 class="article-detail-title" id="article-detail-title">${escapeText(article.title_de || article.title || "Ohne Titel")}</h2>
        ${article.title_de && article.title_de !== article.title ? `<p class="article-original-title"><span>Originaltitel</span>${renderEvidenceLinkedText(article.title || "", evidence)}</p>` : ""}
        <div class="article-detail-meta">
          ${article.published_at ? `<span class="tag"><i class="ri-calendar-line"></i> ${escapeHtml(new Date(article.published_at).toLocaleDateString("de-DE"))}</span>` : ""}
          ${article.article_type ? `<span class="tag"><i class="ri-file-text-line"></i> ${escapeHtml(ARTICLE_TYPE_LABELS[article.article_type] || article.article_type)}</span>` : ""}
          ${article.language ? `<span class="tag tag--language">${escapeHtml(article.language.toUpperCase())}</span>` : ""}
          ${article.url ? `<a class="tag tag--source" href="${escapeHtml(article.url)}" target="_blank" rel="noopener"><i class="ri-external-link-line"></i> Originalquelle</a>` : ""}
        </div>
        ${article.ai_summary ? `<p class="article-detail-summary">${escapeText(article.ai_summary)}</p>` : ""}
        <div class="article-fulltext">${renderEvidenceLinkedText(fulltext, evidence)}</div>
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
        ${evidence.length ? `<div class="decision-block"><span class="decision-label">Bestandene Evidenzregeln</span><div class="evidence-list">${evidence.map(([key, quote], index) => `<blockquote class="evidence-item" data-evidence-index="${index}" tabindex="0"><strong>${escapeHtml(key)}</strong>${escapeText(quote)}</blockquote>`).join("")}</div></div>` : ""}
        <div class="decision-block">
          <span class="decision-label">Technische Prüfung</span>
          <p class="decision-rationale">${escapeHtml(article.ai_model || "Regelbasiert")} ${article.reviewer_model ? `+ Review durch ${escapeHtml(article.reviewer_model)}` : ""}<br>Prompt: ${escapeHtml(article.prompt_version || "Legacy")}</p>
        </div>
      </aside>`;
    bindEvidenceHover();
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
        <span class="test-result-title">${escapeText(article.title || "Ohne Titel")}</span>
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
  els.sourceTableBody.innerHTML = `<tr><td colspan="6" class="source-empty"><i class="ri-loader-4-line ri-spin"></i> Lädt…</td></tr>`;
  try {
    const { sources: data } = await callApi("list_sources");
    sources = data || [];
    populateCategoryFilter();
    renderSources();
  } catch (err) {
    els.sourceTableBody.innerHTML = `<tr><td colspan="6" class="source-empty">Fehler beim Laden: ${escapeHtml(err.message)}</td></tr>`;
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
    els.sourceTableBody.innerHTML = `<tr><td colspan="6" class="source-empty">Keine URLs gefunden.</td></tr>`;
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
      <td title="${escapeHtml(s.last_error || "")}">
        <span class="quality-tag ${s.last_error ? "quality-tag--error" : s.last_successful_at ? "quality-tag--reliable" : "quality-tag--pending"}">
          <i class="ri-${s.last_error ? "alert-line" : s.last_successful_at ? "check-line" : "time-line"}"></i>
          ${s.last_error ? "Fehler" : s.last_successful_at ? `${Number(s.last_inserted_count || 0)} neu` : "Offen"}
        </span>
      </td>
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
    const { crawl_run: last, backfill_run: backfill, cost_summary: costs, source_health: health } = await callApi("get_dashboard_status");
    const formatUsd = (value) => `${Number(value || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
    els.geminiCostMonth.textContent = formatUsd(costs?.month_usd);
    els.geminiCostToday.textContent = formatUsd(costs?.today_usd);
    els.geminiRequestCount.textContent = Number(costs?.requests || 0).toLocaleString("de-DE");
    els.sourceAttemptCount.textContent = Number(health?.attempts || 0).toLocaleString("de-DE");
    els.geminiCostStat.classList.toggle("telemetry-stat--warning", Boolean(costs?.warning));
    els.sourceHealthNote.textContent = health
      ? `${Number(health.successful || 0).toLocaleString("de-DE")} erfolgreich · ${Number(health.empty || 0).toLocaleString("de-DE")} leer · ${Number(health.errors || 0).toLocaleString("de-DE")} Fehler · Apify ${Number(health.apify_errors || 0).toLocaleString("de-DE")} Fehler`
      : "Noch keine detaillierte Crawl-Telemetrie vorhanden.";
    if (!last) { els.lastRunText.textContent = "Noch kein Crawl-Lauf."; return; }
    const trigger = last.trigger_type === "scheduled" ? "automatisch (6 Uhr)" : "manuell";
    els.lastRunText.textContent =
      `${formatRelativeTime(last.started_at)} · ${trigger} · ${STATUS_LABEL[last.status] || last.status}`;
    if (backfill) {
      const total = Number(backfill.total_count || 0);
      const processed = Number(backfill.processed_count || 0);
      const percent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 100;
      els.backfillProgressText.textContent = `${processed.toLocaleString("de-DE")} / ${total.toLocaleString("de-DE")}`;
      els.backfillProgressBar.style.width = `${percent}%`;
      const status = backfill.status === "done" ? "Abgeschlossen" : backfill.status === "error" ? "Fehler" : "Läuft";
      const errors = Number(backfill.error_count || 0);
      els.backfillProgressDetail.textContent = errors > 0
        ? `${status} · ${errors.toLocaleString("de-DE")} API-Fehler · letzter Fortschritt ${formatRelativeTime(backfill.last_progress_at)}`
        : `${status} · letzter Fortschritt ${formatRelativeTime(backfill.last_progress_at)}`;
      els.apiErrorList.innerHTML = (backfill.error_breakdown || []).map((error) => `
        <div class="api-error-row">
          <i class="ri-alert-line"></i>
          <div class="api-error-copy"><b>${escapeHtml(error.label)}</b><span>${escapeHtml(error.explanation)}</span></div>
          <span class="api-error-count">${Number(error.count || 0).toLocaleString("de-DE")}</span>
        </div>`).join("");
    } else {
      els.backfillProgressText.textContent = "Kein Lauf";
      els.backfillProgressDetail.textContent = "Aktuell werden keine Altartikel geprüft.";
      els.apiErrorList.innerHTML = "";
    }
  } catch {
    els.lastRunText.textContent = "Noch kein Crawl-Lauf.";
  }
}

function bindUi() {
  const updateSignalView = () => {
    signalViewState.status = els.signalStatusFilter.value;
    signalViewState.company = els.signalCompanyFilter.value;
    signalViewState.source = els.signalSourceFilter.value;
    signalViewState.sort = els.signalSort.value;
    renderFindings("marketing");
    renderFindings("sales");
  };
  [els.signalStatusFilter, els.signalCompanyFilter, els.signalSourceFilter, els.signalSort].forEach((control) =>
    control.addEventListener("change", updateSignalView)
  );
  const openCardDetail = (event) => {
    const card = event.target.closest("[data-article-id]");
    if (card) void openArticleDetail(card.dataset.articleId);
  };
  [els.findingsListMarketing, els.findingsListSales].forEach((container) => {
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
      els.btnSavePipelineHeader.hidden = !["pipeline-overview", "relevance-profile", "decision-rules", "operations"].includes(panel);
      els.btnPreviewPipeline.hidden = !["pipeline-overview", "relevance-profile", "decision-rules", "operations"].includes(panel);
      document.querySelectorAll(".settings-panel").forEach((p) => p.classList.remove("show"));
      document.getElementById(`settings-panel-${panel}`)?.classList.add("show");
      if (panel !== "apify") void loadPipelineSettings().catch((error) => toast(error.message, "err"));
      if (panel === "manual-review") void loadPipelineReview().catch((error) => toast(error.message, "err"));
      if (panel === "operations") void loadPipelineSettings().then(loadPipelineOperations).catch((error) => toast(error.message, "err"));
    });
  });

  els.btnSavePipeline.addEventListener("click", () => void savePipelineSettings().catch((error) => toast(error.message, "err")));
  els.btnSavePipelineHeader.addEventListener("click", () => void savePipelineSettings().catch((error) => toast(error.message, "err")));
  els.btnPreviewPipeline.addEventListener("click", () => void previewPipelineImpact().catch((error) => toast(error.message, "err")));

  document.getElementById("pipeline-review-list")?.addEventListener("click", (event) => {
    const article = event.target.closest("[data-article-id]");
    if (article) void openArticleDetail(article.dataset.articleId);
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
}
