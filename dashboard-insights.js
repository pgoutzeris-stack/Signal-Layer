const WIDGET_DEFINITIONS = [
  { id: "performance_pulse", title: "Performance Pulse", icon: "fa-solid fa-bolt", defaultSize: "wide" },
  { id: "marketing_performance", title: "Marketing Performance", icon: "fa-solid fa-bullhorn", defaultSize: "compact" },
  { id: "marketing_funnel", title: "Marketing Funnel", icon: "fa-solid fa-filter", defaultSize: "compact" },
  { id: "sales_pipeline", title: "Sales Pipeline", icon: "fa-solid fa-chart-line", defaultSize: "compact" },
  { id: "sales_funnel", title: "Sales Funnel", icon: "fa-solid fa-arrow-down-wide-short", defaultSize: "compact" },
  { id: "performance_trend", title: "Performance-Trend", icon: "fa-solid fa-chart-column", defaultSize: "wide" },
  { id: "top_assets", title: "Top-Assets", icon: "fa-solid fa-trophy", defaultSize: "wide" },
  { id: "smart_insights", title: "Insight Radar", icon: "fa-solid fa-wand-magic-sparkles", defaultSize: "wide" },
  { id: "data_quality", title: "KPI-Abdeckung", icon: "fa-solid fa-gauge-high", defaultSize: "compact" },
  { id: "recent_activity", title: "Letzte Updates", icon: "fa-solid fa-clock-rotate-left", defaultSize: "compact" },
];

export const DASHBOARD_WIDGETS = Object.freeze(WIDGET_DEFINITIONS.map((item) => Object.freeze({ ...item })));

export function defaultDashboardPreferences() {
  return {
    period_days: 30,
    widgets: DASHBOARD_WIDGETS.map((item) => ({ id: item.id, visible: true, size: item.defaultSize })),
  };
}

export function normalizeDashboardPreferences(value = {}) {
  const fallback = defaultDashboardPreferences();
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const period = [7, 30, 90, 365].includes(Number(source.period_days)) ? Number(source.period_days) : 30;
  const available = new Map(DASHBOARD_WIDGETS.map((item) => [item.id, item]));
  const widgets = [];
  const seen = new Set();
  for (const candidate of Array.isArray(source.widgets) ? source.widgets : []) {
    const definition = available.get(String(candidate?.id || ""));
    if (!definition || seen.has(definition.id)) continue;
    seen.add(definition.id);
    widgets.push({
      id: definition.id,
      visible: candidate.visible !== false,
      size: candidate.size === "compact" ? "compact" : "wide",
    });
  }
  for (const candidate of fallback.widgets) {
    if (!seen.has(candidate.id)) widgets.push(candidate);
  }
  if (!widgets.some((item) => item.visible)) widgets[0].visible = true;
  return { period_days: period, widgets };
}

const numberValue = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const sum = (rows, key) => rows.reduce((total, row) => total + numberValue(row?.[key]), 0);
const ratio = (numerator, denominator) => denominator > 0 ? numerator / denominator : 0;
const marketingEngagements = (row) => ["reactions", "comments", "reposts", "saves"].reduce((total, key) => total + numberValue(row?.[key]), 0);

function performanceDate(row) {
  const timestamp = Date.parse(row?.published_at || row?.updated_at || row?.created_at || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function percentDelta(current, previous) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function trendBuckets(rows, periodDays, nowMs) {
  const bucketCount = periodDays <= 7 ? 7 : periodDays <= 30 ? 6 : periodDays <= 90 ? 6 : 12;
  const bucketMs = (periodDays * 86_400_000) / bucketCount;
  const start = nowMs - periodDays * 86_400_000;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    start: start + index * bucketMs,
    marketing: 0,
    sales: 0,
  }));
  for (const row of rows) {
    const timestamp = performanceDate(row);
    const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((timestamp - start) / bucketMs)));
    if (row.lane === "marketing") buckets[index].marketing += numberValue(row.impressions);
    if (row.lane === "sales") buckets[index].sales += numberValue(row.influenced_pipeline_eur);
  }
  return buckets.map((bucket) => ({
    ...bucket,
    label: new Intl.DateTimeFormat("de-DE", periodDays <= 30
      ? { day: "2-digit", month: "2-digit" }
      : { month: "short" }).format(new Date(bucket.start)),
  }));
}

function assetTitle(asset) {
  return String(asset?.title || asset?.slide_title || asset?.company || (asset?.kind === "memo" ? "Executive Memo" : "LinkedIn-Asset"));
}

export function summarizeDashboardData(payload = {}, nowMs = Date.now()) {
  const preferences = normalizeDashboardPreferences(payload.preferences);
  const assets = Array.isArray(payload.assets) ? payload.assets : [];
  const performance = Array.isArray(payload.performance) ? payload.performance : [];
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const periodMs = preferences.period_days * 86_400_000;
  const currentStart = nowMs - periodMs;
  const previousStart = currentStart - periodMs;
  const current = performance.filter((row) => performanceDate(row) >= currentStart && performanceDate(row) <= nowMs);
  const previous = performance.filter((row) => performanceDate(row) >= previousStart && performanceDate(row) < currentStart);
  const marketing = current.filter((row) => row.lane === "marketing");
  const sales = current.filter((row) => row.lane === "sales");
  const previousMarketing = previous.filter((row) => row.lane === "marketing");
  const previousSales = previous.filter((row) => row.lane === "sales");

  const marketingTotals = {
    impressions: sum(marketing, "impressions"),
    reactions: sum(marketing, "reactions"),
    comments: sum(marketing, "comments"),
    reposts: sum(marketing, "reposts"),
    saves: sum(marketing, "saves"),
    link_clicks: sum(marketing, "link_clicks"),
  };
  marketingTotals.engagements = marketing.reduce((total, row) => total + marketingEngagements(row), 0);
  marketingTotals.engagement_rate = ratio(marketingTotals.engagements, marketingTotals.impressions);
  marketingTotals.click_rate = ratio(marketingTotals.link_clicks, marketingTotals.impressions);

  const salesTotals = {
    sends: sum(sales, "sends"),
    opens: sum(sales, "opens"),
    replies: sum(sales, "replies"),
    meetings: sum(sales, "meetings"),
    opportunities: sum(sales, "opportunities"),
    wins: sum(sales, "wins"),
    influenced_pipeline_eur: sum(sales, "influenced_pipeline_eur"),
    revenue_eur: sum(sales, "revenue_eur"),
  };
  salesTotals.open_rate = ratio(salesTotals.opens, salesTotals.sends);
  salesTotals.response_rate = ratio(salesTotals.replies, salesTotals.sends);
  salesTotals.meeting_rate = ratio(salesTotals.meetings, salesTotals.replies || salesTotals.sends);
  salesTotals.win_rate = ratio(salesTotals.wins, salesTotals.opportunities);

  const previousImpressions = sum(previousMarketing, "impressions");
  const previousPipeline = sum(previousSales, "influenced_pipeline_eur");
  const ranked = current.map((row) => {
    const asset = assetById.get(row.asset_id) || {};
    const score = row.lane === "marketing"
      ? numberValue(row.impressions) + marketingEngagements(row) * 12 + numberValue(row.link_clicks) * 8
      : numberValue(row.influenced_pipeline_eur) + numberValue(row.revenue_eur) * 1.5 + numberValue(row.meetings) * 2500 + numberValue(row.opportunities) * 5000;
    return { ...row, asset, title: assetTitle(asset), score };
  }).sort((a, b) => b.score - a.score);

  const coveredAssetIds = new Set(performance.map((row) => row.asset_id));
  const marketingAssets = assets.filter((asset) => asset.kind === "linkedin");
  const salesAssets = assets.filter((asset) => asset.kind === "memo");
  const coverage = {
    total: assets.length,
    covered: assets.filter((asset) => coveredAssetIds.has(asset.id)).length,
    marketing_total: marketingAssets.length,
    marketing_covered: marketingAssets.filter((asset) => coveredAssetIds.has(asset.id)).length,
    sales_total: salesAssets.length,
    sales_covered: salesAssets.filter((asset) => coveredAssetIds.has(asset.id)).length,
  };
  coverage.rate = ratio(coverage.covered, coverage.total);

  return {
    preferences,
    assets,
    performance,
    current,
    marketing,
    sales,
    marketingTotals,
    salesTotals,
    deltas: {
      impressions: percentDelta(marketingTotals.impressions, previousImpressions),
      pipeline: percentDelta(salesTotals.influenced_pipeline_eur, previousPipeline),
    },
    ranked,
    coverage,
    trend: trendBuckets(current, preferences.period_days, nowMs),
    recent: [...performance].sort((a, b) => performanceDate(b) - performanceDate(a)).slice(0, 5)
      .map((row) => ({ ...row, asset: assetById.get(row.asset_id) || {}, title: assetTitle(assetById.get(row.asset_id)) })),
  };
}

export function deriveDashboardInsights(summary) {
  const insights = [];
  if (!summary.performance.length) {
    return [{ tone: "info", title: "Noch keine KPI-Basis", text: "Sobald Sie beim ersten veröffentlichten Asset Werte hinterlegen, entstehen hier persönliche Performance-Hinweise." }];
  }
  const topMarketing = summary.ranked.find((row) => row.lane === "marketing");
  if (topMarketing) {
    const rate = ratio(marketingEngagements(topMarketing), numberValue(topMarketing.impressions));
    insights.push({
      tone: "positive",
      title: "Stärkstes Marketing-Asset",
      text: `${topMarketing.title} führt mit ${(rate * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} % Engagement-Rate.`,
    });
  }
  if (summary.salesTotals.sends > 0) {
    const stages = [
      ["Öffnung", ratio(summary.salesTotals.opens, summary.salesTotals.sends)],
      ["Antwort", ratio(summary.salesTotals.replies, summary.salesTotals.opens || summary.salesTotals.sends)],
      ["Termin", ratio(summary.salesTotals.meetings, summary.salesTotals.replies || summary.salesTotals.sends)],
      ["Opportunity", ratio(summary.salesTotals.opportunities, summary.salesTotals.meetings || summary.salesTotals.replies || summary.salesTotals.sends)],
      ["Win", ratio(summary.salesTotals.wins, summary.salesTotals.opportunities)],
    ].filter(([, value]) => Number.isFinite(value));
    const bottleneck = stages.sort((a, b) => a[1] - b[1])[0];
    if (bottleneck) insights.push({
      tone: bottleneck[1] < 0.2 ? "attention" : "info",
      title: "Sales-Funnel",
      text: `Der größte Hebel liegt aktuell bei ${bottleneck[0]} (${(bottleneck[1] * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} % Übergang).`,
    });
  }
  if (summary.coverage.rate < 0.75) {
    insights.push({
      tone: "attention",
      title: "Datenbasis ausbauen",
      text: `${summary.coverage.covered} von ${summary.coverage.total} fertigen Assets haben KPIs. Mehr Abdeckung macht Vergleiche belastbarer.`,
    });
  } else {
    insights.push({
      tone: "positive",
      title: "Gute KPI-Abdeckung",
      text: `${(summary.coverage.rate * 100).toLocaleString("de-DE", { maximumFractionDigits: 0 })} % Ihrer fertigen Assets sind mit Performance-Daten verknüpft.`,
    });
  }
  return insights.slice(0, 4);
}

const formatNumber = (value) => numberValue(value).toLocaleString("de-DE", { maximumFractionDigits: 0 });
const formatPercent = (value) => `${(numberValue(value) * 100).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
const formatMoney = (value) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(numberValue(value));
const formatDate = (value) => {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(timestamp)) : "Noch nicht datiert";
};

function deltaHtml(value) {
  const rounded = Math.round(numberValue(Math.abs(value)));
  const positive = value >= 0;
  return `<span class="pi-delta ${positive ? "is-positive" : "is-negative"}"><i class="fa-solid fa-arrow-${positive ? "trend-up" : "trend-down"}"></i>${rounded} %</span>`;
}

function emptyWidget(copy, settingsPanel = "dashboard-kpis") {
  return `<div class="pi-empty"><i class="fa-regular fa-chart-bar"></i><p>${copy}</p><button type="button" class="btn-secondary" data-open-dashboard-settings="${settingsPanel}"><i class="fa-solid fa-plus"></i> KPIs hinterlegen</button></div>`;
}

function widgetShell(definition, preference, body) {
  return `<article class="pi-widget pi-widget--${preference.size}" data-widget-id="${definition.id}">
    <header class="pi-widget-head"><span><i class="${definition.icon}"></i>${definition.title}</span><em data-dashboard-live-label>Live</em></header>
    ${body}
  </article>`;
}

function stat(label, value, detail = "", accent = "") {
  return `<div class="pi-stat ${accent ? `pi-stat--${accent}` : ""}"><span>${label}</span><b>${value}</b>${detail ? `<small>${detail}</small>` : ""}</div>`;
}

function funnelHtml(stages, color) {
  const max = Math.max(1, ...stages.map((stage) => numberValue(stage.value)));
  return `<div class="pi-funnel">${stages.map((stage, index) => {
    const width = Math.max(10, (numberValue(stage.value) / max) * 100);
    const previous = index ? numberValue(stages[index - 1].value) : 0;
    const conversion = index && previous ? formatPercent(numberValue(stage.value) / previous) : "Basis";
    return `<div class="pi-funnel-row"><span>${stage.label}</span><div><i style="--funnel-width:${width}%;--funnel-color:${color}"></i></div><b>${stage.formatter ? stage.formatter(stage.value) : formatNumber(stage.value)}</b><small>${conversion}</small></div>`;
  }).join("")}</div>`;
}

function trendHtml(summary) {
  const maxMarketing = Math.max(1, ...summary.trend.map((item) => item.marketing));
  const maxSales = Math.max(1, ...summary.trend.map((item) => item.sales));
  return `<div class="pi-trend-legend"><span><i class="is-marketing"></i>Marketing Views</span><span><i class="is-sales"></i>Sales Pipeline</span></div>
    <div class="pi-trend-chart">${summary.trend.map((item) => `<div class="pi-trend-column" title="${formatNumber(item.marketing)} Views · ${formatMoney(item.sales)} Pipeline">
      <div class="pi-trend-bars"><i class="is-marketing" style="--bar-height:${Math.max(3, item.marketing / maxMarketing * 100)}%"></i><i class="is-sales" style="--bar-height:${Math.max(3, item.sales / maxSales * 100)}%"></i></div><span>${item.label}</span>
    </div>`).join("")}</div>`;
}

function renderWidget(definition, preference, summary, escapeHtml) {
  const marketing = summary.marketingTotals;
  const sales = summary.salesTotals;
  if (definition.id === "performance_pulse") {
    return widgetShell(definition, preference, `<div class="pi-pulse">
      <div><span class="pi-eyebrow">Persönlicher Zeitraum · ${summary.preferences.period_days} Tage</span><h3>${summary.performance.length ? "Ihre Assets wirken messbar." : "Machen Sie Asset-Wirkung sichtbar."}</h3><p>${summary.performance.length ? `${summary.current.length} KPI-gepflegte Assets liegen im gewählten Zeitraum.` : "Verknüpfen Sie veröffentlichte LinkedIn-Posts und versendete Executive Memos mit ihren Ergebnissen."}</p></div>
      <div class="pi-pulse-kpis">${stat("Marketing Views", formatNumber(marketing.impressions), deltaHtml(summary.deltas.impressions), "marketing")}${stat("Sales Pipeline", formatMoney(sales.influenced_pipeline_eur), deltaHtml(summary.deltas.pipeline), "sales")}</div>
      <button type="button" class="btn-secondary" data-open-dashboard-settings="dashboard-kpis"><i class="fa-solid fa-sliders"></i> Dashboard anpassen</button>
    </div>`);
  }
  if (definition.id === "marketing_performance") {
    const body = summary.marketing.length ? `<div class="pi-stat-grid">${stat("Views", formatNumber(marketing.impressions))}${stat("Engagement", formatPercent(marketing.engagement_rate))}${stat("Kommentare", formatNumber(marketing.comments))}${stat("Link-Klicks", formatNumber(marketing.link_clicks))}</div>` : emptyWidget("Für Marketing-Insights fehlen noch Posting-KPIs.");
    return widgetShell(definition, preference, body);
  }
  if (definition.id === "marketing_funnel") {
    const body = summary.marketing.length ? funnelHtml([
      { label: "Views", value: marketing.impressions },
      { label: "Engagiert", value: marketing.engagements },
      { label: "Klicks", value: marketing.link_clicks },
    ], "var(--brand)") : emptyWidget("Views, Reaktionen und Klicks bilden hier Ihren Marketing-Funnel.");
    return widgetShell(definition, preference, body);
  }
  if (definition.id === "sales_pipeline") {
    const body = summary.sales.length ? `<div class="pi-stat-grid">${stat("Pipeline", formatMoney(sales.influenced_pipeline_eur))}${stat("Umsatz", formatMoney(sales.revenue_eur))}${stat("Termine", formatNumber(sales.meetings))}${stat("Win-Rate", formatPercent(sales.win_rate))}</div>` : emptyWidget("Für Sales-Insights fehlen noch KPI-Werte zu Executive Memos.");
    return widgetShell(definition, preference, body);
  }
  if (definition.id === "sales_funnel") {
    const body = summary.sales.length ? funnelHtml([
      { label: "Versendet", value: sales.sends },
      { label: "Geöffnet", value: sales.opens },
      { label: "Antworten", value: sales.replies },
      { label: "Termine", value: sales.meetings },
      { label: "Opportunities", value: sales.opportunities },
      { label: "Wins", value: sales.wins },
    ], "#16a34a") : emptyWidget("Versand, Antworten, Termine und Opportunities bilden hier Ihren Sales-Funnel.");
    return widgetShell(definition, preference, body);
  }
  if (definition.id === "performance_trend") {
    return widgetShell(definition, preference, summary.current.length ? trendHtml(summary) : emptyWidget("Im gewählten Zeitraum liegen noch keine KPI-Updates."));
  }
  if (definition.id === "top_assets") {
    const rows = summary.ranked.slice(0, 6);
    const body = rows.length ? `<div class="pi-leaderboard">${rows.map((row, index) => `<div><span class="pi-rank">${index + 1}</span><span class="pi-asset-icon is-${row.lane}"><i class="fa-solid ${row.lane === "marketing" ? "fa-bullhorn" : "fa-file-lines"}"></i></span><span><b>${escapeHtml(row.title)}</b><small>${escapeHtml(row.asset.company || (row.lane === "marketing" ? "Marketing" : "Sales"))}</small></span><em>${row.lane === "marketing" ? `${formatNumber(row.impressions)} Views` : formatMoney(row.influenced_pipeline_eur)}</em></div>`).join("")}</div>` : emptyWidget("Top-Assets erscheinen, sobald Performance-Werte vorliegen.");
    return widgetShell(definition, preference, body);
  }
  if (definition.id === "smart_insights") {
    const body = `<div class="pi-insight-list">${deriveDashboardInsights(summary).map((item) => `<div class="is-${item.tone}"><i class="fa-solid ${item.tone === "positive" ? "fa-arrow-trend-up" : item.tone === "attention" ? "fa-lightbulb" : "fa-circle-info"}"></i><span><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.text)}</p></span></div>`).join("")}</div>`;
    return widgetShell(definition, preference, body);
  }
  if (definition.id === "data_quality") {
    const rate = summary.coverage.rate * 100;
    const body = `<div class="pi-coverage"><div class="pi-ring" style="--coverage:${rate}"><b>${Math.round(rate)}%</b></div><div><b>${summary.coverage.covered} von ${summary.coverage.total}</b><span>fertigen Assets mit KPI-Daten</span><small>Marketing ${summary.coverage.marketing_covered}/${summary.coverage.marketing_total} · Sales ${summary.coverage.sales_covered}/${summary.coverage.sales_total}</small></div></div>`;
    return widgetShell(definition, preference, body);
  }
  const body = summary.recent.length ? `<div class="pi-activity">${summary.recent.map((row) => `<div><i class="fa-solid ${row.lane === "marketing" ? "fa-bullhorn" : "fa-file-lines"}"></i><span><b>${escapeHtml(row.title)}</b><small>${formatDate(row.updated_at)} · ${row.lane === "marketing" ? `${formatNumber(row.impressions)} Views` : `${formatNumber(row.meetings)} Termine`}</small></span></div>`).join("")}</div>` : emptyWidget("Ihre letzten KPI-Aktualisierungen erscheinen hier.");
  return widgetShell(definition, preference, body);
}

function labelForAsset(asset) {
  const type = asset.kind === "memo" ? "Sales · Executive Memo" : "Marketing · LinkedIn";
  return `${type} · ${assetTitle(asset)}`;
}

function inputField(name, label, value, { step = "1", suffix = "", min = "0" } = {}) {
  return `<label class="pi-kpi-field"><span>${label}${suffix ? ` <small>${suffix}</small>` : ""}</span><input class="modern-input" type="number" min="${min}" step="${step}" name="${name}" value="${numberValue(value)}"></label>`;
}

export function initPerformanceDashboard({ client, callApi, toast, openSettingsPanel, escapeHtml: escape = null }) {
  const escapeHtml = escape || ((value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])));
  const state = {
    payload: { preferences: defaultDashboardPreferences(), assets: [], performance: [] },
    summary: null,
    loading: false,
    loaded: false,
    realtimeStatus: "connecting",
    kpiLane: "marketing",
    selectedAssetId: "",
    reloadTimer: null,
    channel: null,
  };
  const hosts = [...document.querySelectorAll("[data-performance-dashboard]")];
  const widgetList = document.getElementById("dashboard-widget-list");
  const periodSelect = document.getElementById("dashboard-settings-period");
  const kpiSelect = document.getElementById("kpi-asset-select");
  const kpiForm = document.getElementById("kpi-performance-form");
  const kpiFields = document.getElementById("kpi-performance-fields");
  const kpiEmpty = document.getElementById("kpi-performance-empty");
  const kpiDelete = document.getElementById("btn-kpi-delete");
  const widgetSave = document.getElementById("btn-dashboard-settings-save");
  const widgetStatus = document.getElementById("dashboard-settings-status");

  const updateLiveLabels = () => {
    document.querySelectorAll("[data-dashboard-live-label]").forEach((label) => {
      label.textContent = state.realtimeStatus === "live" ? "Live" : state.realtimeStatus === "refreshing" ? "Aktualisiert" : "Verbinde…";
      label.classList.toggle("is-live", state.realtimeStatus === "live");
    });
  };

  const renderDashboards = () => {
    state.summary = summarizeDashboardData(state.payload);
    for (const host of hosts) {
      const visible = state.summary.preferences.widgets.filter((item) => item.visible);
      host.innerHTML = `<div class="pi-toolbar"><div><span class="pi-eyebrow">My Signal Performance</span><h2>Dashboard Insights</h2><p>Persönlich, gespeichert und in Echtzeit synchronisiert.</p></div><div><label>Zeitraum<select class="signal-toolbar-select" data-dashboard-period>${[7, 30, 90, 365].map((days) => `<option value="${days}" ${days === state.summary.preferences.period_days ? "selected" : ""}>${days === 365 ? "12 Monate" : `${days} Tage`}</option>`).join("")}</select></label><button type="button" class="btn-secondary" data-open-dashboard-settings="dashboard-kpis"><i class="fa-solid fa-sliders"></i> Anpassen</button></div></div>
        <div class="pi-grid">${visible.map((preference) => renderWidget(DASHBOARD_WIDGETS.find((item) => item.id === preference.id), preference, state.summary, escapeHtml)).join("")}</div>`;
    }
    updateLiveLabels();
  };

  const renderWidgetSettings = () => {
    if (!widgetList) return;
    const preferences = normalizeDashboardPreferences(state.payload.preferences);
    if (periodSelect) periodSelect.value = String(preferences.period_days);
    widgetList.innerHTML = preferences.widgets.map((item, index) => {
      const definition = DASHBOARD_WIDGETS.find((candidate) => candidate.id === item.id);
      return `<div class="pi-widget-setting" data-widget-setting="${item.id}"><label><input type="checkbox" data-widget-visible ${item.visible ? "checked" : ""}><span><i class="${definition.icon}"></i><b>${definition.title}</b></span></label><select class="toolbar-select" data-widget-size aria-label="Größe von ${definition.title}"><option value="compact" ${item.size === "compact" ? "selected" : ""}>Kompakt</option><option value="wide" ${item.size === "wide" ? "selected" : ""}>Breit</option></select><span class="pi-order-buttons"><button type="button" data-widget-move="up" ${index === 0 ? "disabled" : ""} title="Nach oben"><i class="fa-solid fa-arrow-up"></i></button><button type="button" data-widget-move="down" ${index === preferences.widgets.length - 1 ? "disabled" : ""} title="Nach unten"><i class="fa-solid fa-arrow-down"></i></button></span></div>`;
    }).join("");
  };

  const assetsForLane = () => state.payload.assets.filter((asset) => state.kpiLane === "marketing" ? asset.kind === "linkedin" : asset.kind === "memo");
  const selectedPerformance = () => state.payload.performance.find((row) => row.asset_id === state.selectedAssetId) || {};

  const renderKpiFields = () => {
    const assets = assetsForLane();
    if (!state.selectedAssetId || !assets.some((asset) => asset.id === state.selectedAssetId)) state.selectedAssetId = assets[0]?.id || "";
    if (kpiSelect) {
      kpiSelect.innerHTML = assets.length ? assets.map((asset) => `<option value="${escapeHtml(asset.id)}" ${asset.id === state.selectedAssetId ? "selected" : ""}>${escapeHtml(labelForAsset(asset))}</option>`).join("") : '<option value="">Keine fertigen Assets vorhanden</option>';
      kpiSelect.disabled = !assets.length;
    }
    const performance = selectedPerformance();
    if (kpiEmpty) kpiEmpty.hidden = Boolean(state.selectedAssetId);
    if (kpiForm) kpiForm.hidden = !state.selectedAssetId;
    if (!state.selectedAssetId || !kpiFields) return;
    const published = performance.published_at ? new Date(performance.published_at).toISOString().slice(0, 16) : "";
    const common = `<div class="pi-kpi-common"><label class="pi-kpi-field"><span>${state.kpiLane === "marketing" ? "Veröffentlicht am" : "Versendet am"}</span><input class="modern-input" type="datetime-local" name="published_at" value="${published}"></label><label class="pi-kpi-field"><span>Kanal</span><input class="modern-input" name="channel" maxlength="40" value="${escapeHtml(performance.channel || (state.kpiLane === "marketing" ? "LinkedIn" : "Direktansprache"))}"></label></div>`;
    const metrics = state.kpiLane === "marketing"
      ? [inputField("impressions", "Views / Impressions", performance.impressions), inputField("reactions", "Reaktionen / Likes", performance.reactions), inputField("comments", "Kommentare", performance.comments), inputField("reposts", "Reposts / Shares", performance.reposts), inputField("saves", "Saves", performance.saves), inputField("link_clicks", "Link-Klicks", performance.link_clicks)].join("")
      : [inputField("sends", "Versendungen", performance.sends), inputField("opens", "Öffnungen / Views", performance.opens), inputField("replies", "Antworten", performance.replies), inputField("meetings", "Gebuchte Termine", performance.meetings), inputField("opportunities", "Qualifizierte Opportunities", performance.opportunities), inputField("wins", "Gewonnene Mandate", performance.wins), inputField("influenced_pipeline_eur", "Beeinflusste Pipeline", performance.influenced_pipeline_eur, { step: "0.01", suffix: "€" }), inputField("revenue_eur", "Zugeordneter Umsatz", performance.revenue_eur, { step: "0.01", suffix: "€" })].join("");
    kpiFields.innerHTML = `${common}<div class="pi-kpi-grid">${metrics}</div><label class="pi-kpi-field pi-kpi-note"><span>Notiz <small>optional</small></span><textarea class="modern-input" name="note" rows="3" maxlength="1000" placeholder="Kontext zur Auswertung">${escapeHtml(performance.note || "")}</textarea></label>`;
    if (kpiDelete) kpiDelete.hidden = !performance.id;
  };

  const renderSettings = () => {
    renderWidgetSettings();
    document.querySelectorAll("[data-kpi-lane]").forEach((button) => {
      const active = button.dataset.kpiLane === state.kpiLane;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    renderKpiFields();
    const coverage = state.summary?.coverage || summarizeDashboardData(state.payload).coverage;
    document.querySelectorAll("[data-kpi-coverage]").forEach((node) => {
      const lane = node.dataset.kpiCoverage;
      node.textContent = lane === "marketing" ? `${coverage.marketing_covered}/${coverage.marketing_total}` : `${coverage.sales_covered}/${coverage.sales_total}`;
    });
  };

  const load = async ({ announce = false } = {}) => {
    if (state.loading) return;
    state.loading = true;
    try {
      const payload = await callApi("get_dashboard_insights");
      state.payload = {
        preferences: normalizeDashboardPreferences(payload.preferences),
        assets: Array.isArray(payload.assets) ? payload.assets : [],
        performance: Array.isArray(payload.performance) ? payload.performance : [],
      };
      state.loaded = true;
      state.realtimeStatus = announce ? "refreshing" : state.realtimeStatus;
      renderDashboards();
      renderSettings();
      if (announce) setTimeout(() => { state.realtimeStatus = "live"; updateLiveLabels(); }, 900);
    } catch (error) {
      for (const host of hosts) host.innerHTML = `<div class="pi-load-error"><i class="fa-solid fa-triangle-exclamation"></i> Dashboard-Insights konnten nicht geladen werden.</div>`;
      if (announce) toast(error.message, "err");
    } finally {
      state.loading = false;
    }
  };

  const savePreferences = async (preferences) => {
    if (widgetSave) widgetSave.disabled = true;
    if (widgetStatus) widgetStatus.textContent = "Wird gespeichert…";
    try {
      const result = await callApi("save_dashboard_preferences", { preferences: normalizeDashboardPreferences(preferences) });
      state.payload.preferences = normalizeDashboardPreferences(result.preferences);
      renderDashboards();
      renderSettings();
      if (widgetStatus) widgetStatus.textContent = "Persönliches Dashboard gespeichert.";
      toast("Dashboard-Einstellungen gespeichert.", "ok");
    } catch (error) {
      if (widgetStatus) widgetStatus.textContent = error.message;
      toast(error.message, "err");
    } finally {
      if (widgetSave) widgetSave.disabled = false;
    }
  };

  const preferencesFromSettings = () => ({
    period_days: Number(periodSelect?.value || state.payload.preferences.period_days),
    widgets: [...widgetList.querySelectorAll("[data-widget-setting]")].map((row) => ({
      id: row.dataset.widgetSetting,
      visible: row.querySelector("[data-widget-visible]").checked,
      size: row.querySelector("[data-widget-size]").value,
    })),
  });

  document.addEventListener("click", (event) => {
    const settingsButton = event.target.closest("[data-open-dashboard-settings]");
    if (settingsButton) {
      openSettingsPanel(settingsButton.dataset.openDashboardSettings || "dashboard-kpis");
      renderSettings();
      return;
    }
    const laneButton = event.target.closest("[data-kpi-lane]");
    if (laneButton) {
      state.kpiLane = laneButton.dataset.kpiLane;
      state.selectedAssetId = "";
      renderSettings();
      return;
    }
    const moveButton = event.target.closest("[data-widget-move]");
    if (moveButton && widgetList) {
      const row = moveButton.closest("[data-widget-setting]");
      const sibling = moveButton.dataset.widgetMove === "up" ? row.previousElementSibling : row.nextElementSibling;
      if (sibling) {
        if (moveButton.dataset.widgetMove === "up") widgetList.insertBefore(row, sibling);
        else widgetList.insertBefore(sibling, row);
        const draft = preferencesFromSettings();
        state.payload.preferences = normalizeDashboardPreferences(draft);
        renderWidgetSettings();
      }
    }
  });

  document.addEventListener("change", (event) => {
    const dashboardPeriod = event.target.closest("[data-dashboard-period]");
    if (dashboardPeriod) void savePreferences({ ...state.payload.preferences, period_days: Number(dashboardPeriod.value) });
    if (event.target === kpiSelect) {
      state.selectedAssetId = kpiSelect.value;
      renderKpiFields();
    }
  });

  widgetSave?.addEventListener("click", () => void savePreferences(preferencesFromSettings()));
  kpiForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.selectedAssetId) return;
    const button = kpiForm.querySelector('button[type="submit"]');
    button.disabled = true;
    const payload = Object.fromEntries(new FormData(kpiForm).entries());
    try {
      await callApi("save_asset_performance", { asset_id: state.selectedAssetId, ...payload });
      toast("KPI-Werte gespeichert. Das Dashboard wurde aktualisiert.", "ok");
      await load({ announce: true });
    } catch (error) {
      toast(error.message, "err");
    } finally {
      button.disabled = false;
    }
  });
  kpiDelete?.addEventListener("click", async () => {
    if (!state.selectedAssetId || !window.confirm("Gespeicherte KPI-Werte für dieses Asset entfernen?")) return;
    kpiDelete.disabled = true;
    try {
      await callApi("delete_asset_performance", { asset_id: state.selectedAssetId });
      toast("KPI-Werte entfernt.", "ok");
      await load({ announce: true });
    } catch (error) {
      toast(error.message, "err");
    } finally {
      kpiDelete.disabled = false;
    }
  });

  const connectRealtime = async () => {
    try {
      const { data: { session } } = await client.auth.getSession();
      if (!session?.user?.id) return;
      const scheduleReload = () => {
        clearTimeout(state.reloadTimer);
        state.reloadTimer = setTimeout(() => void load({ announce: true }), 180);
      };
      state.channel = client.channel(`signal-layer-dashboard-${session.user.id}`)
        .on("postgres_changes", { event: "*", schema: "signal_layer", table: "asset_performance", filter: `user_id=eq.${session.user.id}` }, scheduleReload)
        .on("postgres_changes", { event: "*", schema: "signal_layer", table: "user_dashboard_settings", filter: `user_id=eq.${session.user.id}` }, scheduleReload)
        .subscribe((status) => {
          state.realtimeStatus = status === "SUBSCRIBED" ? "live" : "connecting";
          updateLiveLabels();
        });
    } catch {
      state.realtimeStatus = "connecting";
      updateLiveLabels();
    }
  };

  for (const host of hosts) host.innerHTML = '<div class="pi-dashboard-loader"><span></span><span></span><span></span></div>';
  void load();
  void connectRealtime();
  return { reload: load, state };
}
