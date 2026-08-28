const WIDGET_DEFINITIONS = [
  { id: "performance_pulse", title: "Übersicht", icon: "fa-solid fa-bolt", defaultSize: "wide" },
  { id: "marketing_performance", title: "Marketing Performance", icon: "fa-solid fa-bullhorn", defaultSize: "compact" },
  { id: "marketing_funnel", title: "Marketing Funnel", icon: "fa-solid fa-filter", defaultSize: "compact" },
  { id: "sales_pipeline", title: "Sales Pipeline", icon: "fa-solid fa-chart-line", defaultSize: "compact" },
  { id: "sales_funnel", title: "Sales Funnel", icon: "fa-solid fa-arrow-down-wide-short", defaultSize: "compact" },
  { id: "performance_trend", title: "Performance-Trend", icon: "fa-solid fa-chart-column", defaultSize: "wide" },
  { id: "top_assets", title: "Top-Assets", icon: "fa-solid fa-trophy", defaultSize: "wide" },
  { id: "smart_insights", title: "Insight Radar", icon: "fa-solid fa-wand-magic-sparkles", defaultSize: "wide" },
  { id: "data_quality", title: "Bestand", icon: "fa-solid fa-chart-pie", defaultSize: "compact" },
  { id: "recent_activity", title: "Letzte Updates", icon: "fa-solid fa-clock-rotate-left", defaultSize: "compact" },
];

export const DASHBOARD_WIDGETS = Object.freeze(WIDGET_DEFINITIONS.map((item) => Object.freeze({ ...item })));

export function defaultDashboardPreferences() {
  return {
    period_days: 30,
    filters: {
      asset_scope: "roots",
      creator_ids: [],
      origin: "all",
      lane: "all",
    },
    widgets: DASHBOARD_WIDGETS.map((item) => ({ id: item.id, visible: true, size: item.defaultSize })),
  };
}

export function normalizeDashboardPreferences(value = {}) {
  const fallback = defaultDashboardPreferences();
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const period = [7, 30, 90, 365].includes(Number(source.period_days)) ? Number(source.period_days) : 30;
  const rawFilters = source.filters && typeof source.filters === "object" && !Array.isArray(source.filters) ? source.filters : {};
  const assetScope = rawFilters.asset_scope === "roots_private" ? "roots_private" : "roots";
  const origin = ["automatic", "manual"].includes(rawFilters.origin) ? rawFilters.origin : "all";
  // LinkedIn-Assets sind die Marketing-Bahn, Executive Memos die Sales-Bahn.
  const lane = ["marketing", "sales"].includes(rawFilters.lane) ? rawFilters.lane : "all";
  const creatorIds = Array.isArray(rawFilters.creator_ids)
    ? [...new Set(rawFilters.creator_ids.map(String).filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)))].slice(0, 50)
    : [];
  return {
    period_days: period,
    filters: { asset_scope: assetScope, creator_ids: creatorIds, origin, lane },
    widgets: fallback.widgets,
  };
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
  const allAssets = Array.isArray(payload.assets) ? payload.assets : [];
  const selectedCreators = new Set(preferences.filters.creator_ids);
  const assets = allAssets.filter((asset) => {
    const visibilityMatches = preferences.filters.asset_scope === "roots_private" || asset.visibility !== "private";
    const creatorMatches = selectedCreators.size === 0 || selectedCreators.has(String(asset.creator_id || ""));
    const originMatches = preferences.filters.origin === "all" || asset.origin === preferences.filters.origin;
    const laneMatches = preferences.filters.lane === "all" || !preferences.filters.lane
      || (preferences.filters.lane === "marketing" ? asset.kind === "linkedin" : asset.kind === "memo");
    return visibilityMatches && creatorMatches && originMatches && laneMatches;
  });
  const assetIds = new Set(assets.map((asset) => asset.id));
  const performance = (Array.isArray(payload.performance) ? payload.performance : [])
    .filter((row) => assetIds.has(row.asset_id));
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
    allAssets,
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
    // Die Zahlen der Signalansicht: sie standen als eigene Kacheln unter dem
    // Dashboard und gehoeren in dieselbe Uebersicht wie die Wirkung.
    signalCounts: payload.signalCounts || { marketing: 0, sales: 0, rejected: 0 },
    trend: trendBuckets(current, preferences.period_days, nowMs),
    recent: [...performance].sort((a, b) => performanceDate(b) - performanceDate(a)).slice(0, 5)
      .map((row) => ({ ...row, asset: assetById.get(row.asset_id) || {}, title: assetTitle(assetById.get(row.asset_id)) })),
  };
}

export function deriveDashboardInsights(summary) {
  const insights = [];
  if (!summary.performance.length) {
    return [
      { tone: "info", title: "Asset-Basis steht", text: `${summary.assets.length} fertige Entwürfe sind mit den aktuellen Filtern ausgewählt.` },
      { tone: "attention", title: "KPIs ergänzen", text: "Sobald reale Posting- oder Sales-Werte hinterlegt sind, werden Trends und Erfolgshebel automatisch berechnet." },
    ];
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

/**
 * Was aus den bewerteten Artikeln geworden ist, als Ring.
 *
 * Die Segmente sind Kreisboegen ueber stroke-dasharray: sie lassen sich
 * animieren, einzeln anfassen und behalten bei jeder Groesse ihre Schaerfe.
 * Die Mitte traegt die Summe, beim Zeigen auf ein Segment dessen Wert.
 * Der Bahnfilter oben hebt hervor, statt zu verbergen - eine Verteilung mit
 * nur einem Teil waere keine Verteilung mehr.
 */
const BESTAND_SEGMENTE = [
  { key: "marketing", label: "Marketing-Signale", lane: "marketing", color: "var(--brand)" },
  { key: "sales", label: "Sales-Signale", lane: "sales", color: "#0ea5e9" },
  { key: "review", label: "Manuelle Prüfung", lane: null, color: "#f59e0b" },
  { key: "rejected", label: "Aussortiert", lane: null, color: "#cbd5e1" },
];

export function bestandRingHtml(summary, escapeHtml = (value) => String(value ?? "")) {
  const zahlen = summary.signalCounts || {};
  const teile = BESTAND_SEGMENTE.map((segment) => ({ ...segment, wert: numberValue(zahlen[segment.key]) }));
  const summe = teile.reduce((sum, teil) => sum + teil.wert, 0);
  const gecrawlt = numberValue(zahlen.crawled);
  if (!summe) {
    return `<div class="pi-inline-empty">Noch keine bewerteten Artikel</div>`;
  }
  const lane = summary.preferences?.filters?.lane || "all";
  const umfang = 100;
  let offset = 0;
  const boegen = teile.map((teil) => {
    const anteil = teil.wert / summe * umfang;
    const gedimmt = lane !== "all" && teil.lane !== lane;
    const bogen = `<circle class="pi-slice${gedimmt ? " is-dimmed" : ""}" data-slice="${escapeHtml(teil.key)}"
      data-label="${escapeHtml(teil.label)}" data-value="${teil.wert}" data-share="${Math.round(teil.wert / summe * 100)}"
      cx="21" cy="21" r="15.9155" fill="none" stroke="${teil.color}" stroke-width="5"
      stroke-dasharray="${anteil.toFixed(2)} ${(umfang - anteil).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"
      style="--pi-arc:${anteil.toFixed(2)}"><title>${escapeHtml(teil.label)}: ${formatNumber(teil.wert)}</title></circle>`;
    offset += anteil;
    return bogen;
  }).join("");
  const legende = teile.map((teil) => `<button type="button" class="pi-legend-row${lane !== "all" && teil.lane !== lane ? " is-dimmed" : ""}" data-slice-key="${escapeHtml(teil.key)}">
    <i style="background:${teil.color}"></i><span>${escapeHtml(teil.label)}</span><b>${formatNumber(teil.wert)}</b>
  </button>`).join("");
  return `<div class="pi-donut" data-donut>
    <div class="pi-donut-chart">
      <svg viewBox="0 0 42 42" role="img" aria-label="Verteilung der bewerteten Artikel">
        <circle class="pi-slice-track" cx="21" cy="21" r="15.9155" fill="none" stroke-width="5"></circle>
        ${boegen}
      </svg>
      <div class="pi-donut-mitte" data-donut-center>
        <b>${formatNumber(summe)}</b><span>bewertet</span>
      </div>
    </div>
    <div class="pi-legend">${legende}${
      gecrawlt ? `<small class="pi-legend-foot">${formatNumber(gecrawlt)} Artikel im Bestand</small>` : ""
    }</div>
  </div>`;
}

/**
 * Zeigt man auf ein Segment, traegt die Mitte dessen Wert und Anteil. Der Ring
 * bliebe sonst stumm: eine Zahl in der Mitte, die sich nie aendert, waere nur
 * Dekoration.
 */
export function bindBestandRing(root, escapeHtml = (value) => String(value ?? "")) {
  const donut = root?.querySelector?.("[data-donut]");
  if (!donut || donut.dataset.gebunden === "1") return;
  donut.dataset.gebunden = "1";
  const mitte = donut.querySelector("[data-donut-center]");
  const grund = mitte ? mitte.innerHTML : "";
  const setzen = (key) => {
    const bogen = key ? donut.querySelector(`[data-slice="${key}"]`) : null;
    donut.querySelectorAll("[data-slice]").forEach((teil) => teil.classList.toggle("is-on", teil === bogen));
    donut.querySelectorAll("[data-slice-key]").forEach((zeile) => zeile.classList.toggle("is-on", Boolean(key) && zeile.dataset.sliceKey === key));
    if (!mitte) return;
    mitte.innerHTML = bogen
      ? `<b>${formatNumber(bogen.dataset.value)}</b><span>${escapeHtml(bogen.dataset.label)} · ${bogen.dataset.share}%</span>`
      : grund;
  };
  donut.addEventListener("mouseover", (event) => {
    const treffer = event.target.closest("[data-slice], [data-slice-key]");
    if (treffer) setzen(treffer.dataset.slice || treffer.dataset.sliceKey);
  });
  donut.addEventListener("mouseleave", () => setzen(""));
  donut.addEventListener("focusin", (event) => {
    const treffer = event.target.closest("[data-slice-key]");
    if (treffer) setzen(treffer.dataset.sliceKey);
  });
}

function renderWidget(definition, preference, summary, escapeHtml) {
  const marketing = summary.marketingTotals;
  const sales = summary.salesTotals;
  if (definition.id === "performance_pulse") {
    // Bestand und Wirkung in einer Karte. Die drei Signalzahlen standen als
    // eigene Kacheln unter dem Dashboard und wiederholten dessen Kopf.
    const zaehler = summary.signalCounts || {};
    return widgetShell(definition, preference, `<div class="pi-pulse-kpis">
      ${stat("Marketing-Signale", formatNumber(zaehler.marketing), "", "marketing")}
      ${stat("Sales-Signale", formatNumber(zaehler.sales), "", "sales")}
      ${stat("Aussortierte Artikel", formatNumber(zaehler.rejected))}
      ${stat("Marketing Views", formatNumber(marketing.impressions), summary.performance.length ? deltaHtml(summary.deltas.impressions) : "", "marketing")}
      ${stat("Sales Pipeline", formatMoney(sales.influenced_pipeline_eur), summary.performance.length ? deltaHtml(summary.deltas.pipeline) : "", "sales")}
    </div>`);
  }
  if (definition.id === "marketing_performance") {
    const body = `<div class="pi-stat-grid">${stat("Views", formatNumber(marketing.impressions))}${stat("Engagement", formatPercent(marketing.engagement_rate))}${stat("Kommentare", formatNumber(marketing.comments))}${stat("Link-Klicks", formatNumber(marketing.link_clicks))}</div>`;
    return widgetShell(definition, preference, body);
  }
  if (definition.id === "marketing_funnel") {
    const body = funnelHtml([
      { label: "Views", value: marketing.impressions },
      { label: "Engagiert", value: marketing.engagements },
      { label: "Klicks", value: marketing.link_clicks },
    ], "var(--brand)");
    return widgetShell(definition, preference, body);
  }
  if (definition.id === "sales_pipeline") {
    const body = `<div class="pi-stat-grid">${stat("Pipeline", formatMoney(sales.influenced_pipeline_eur))}${stat("Umsatz", formatMoney(sales.revenue_eur))}${stat("Termine", formatNumber(sales.meetings))}${stat("Win-Rate", formatPercent(sales.win_rate))}</div>`;
    return widgetShell(definition, preference, body);
  }
  if (definition.id === "sales_funnel") {
    const body = funnelHtml([
      { label: "Versendet", value: sales.sends },
      { label: "Geöffnet", value: sales.opens },
      { label: "Antworten", value: sales.replies },
      { label: "Termine", value: sales.meetings },
      { label: "Opportunities", value: sales.opportunities },
      { label: "Wins", value: sales.wins },
    ], "#16a34a");
    return widgetShell(definition, preference, body);
  }
  if (definition.id === "performance_trend") {
    return widgetShell(definition, preference, trendHtml(summary));
  }
  if (definition.id === "top_assets") {
    const rows = summary.ranked.slice(0, 6);
    const pending = summary.assets.slice(0, 6);
    const body = `<div class="pi-leaderboard">${(rows.length ? rows : pending).map((row, index) => {
      const asset = rows.length ? row.asset : row;
      const lane = rows.length ? row.lane : (asset.kind === "memo" ? "sales" : "marketing");
      return `<div><span class="pi-rank">${index + 1}</span><span class="pi-asset-icon is-${lane}"><i class="fa-solid ${lane === "marketing" ? "fa-bullhorn" : "fa-file-lines"}"></i></span><span><b>${escapeHtml(rows.length ? row.title : assetTitle(asset))}</b><small>${escapeHtml(asset.creator_short_name || asset.company || (asset.visibility === "private" ? "Privat" : "ROOTS"))}</small></span><em>${rows.length ? (lane === "marketing" ? `${formatNumber(row.impressions)} Views` : formatMoney(row.influenced_pipeline_eur)) : "KPI offen"}</em></div>`;
    }).join("") || `<div class="pi-inline-empty">Keine Assets im aktuellen Filter</div>`}</div>`;
    return widgetShell(definition, preference, body);
  }
  if (definition.id === "smart_insights") {
    const body = `<div class="pi-insight-list">${deriveDashboardInsights(summary).map((item) => `<div class="is-${item.tone}"><i class="fa-solid ${item.tone === "positive" ? "fa-arrow-trend-up" : item.tone === "attention" ? "fa-lightbulb" : "fa-circle-info"}"></i><span><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.text)}</p></span></div>`).join("")}</div>`;
    return widgetShell(definition, preference, body);
  }
  if (definition.id === "data_quality") {
    return widgetShell(definition, preference, bestandRingHtml(summary, escapeHtml));
  }
  const pending = summary.assets.slice(0, 5);
  const body = `<div class="pi-activity">${(summary.recent.length ? summary.recent : pending).map((row) => {
    const asset = summary.recent.length ? row.asset : row;
    const lane = summary.recent.length ? row.lane : (asset.kind === "memo" ? "sales" : "marketing");
    return `<div><i class="fa-solid ${lane === "marketing" ? "fa-bullhorn" : "fa-file-lines"}"></i><span><b>${escapeHtml(summary.recent.length ? row.title : assetTitle(asset))}</b><small>${summary.recent.length ? `${formatDate(row.updated_at)} · ${lane === "marketing" ? `${formatNumber(row.impressions)} Views` : `${formatNumber(row.meetings)} Termine`}` : `${formatDate(asset.updated_at || asset.created_at)} · KPI offen`}</small></span></div>`;
  }).join("") || `<div class="pi-inline-empty">Keine Assets im aktuellen Filter</div>`}</div>`;
  return widgetShell(definition, preference, body);
}

function labelForAsset(asset) {
  const type = asset.kind === "memo" ? "Sales · Executive Memo" : "Marketing · LinkedIn";
  const scope = asset.visibility === "private" ? "Privat" : "ROOTS";
  const origin = asset.origin === "manual" ? "Manuell" : "Automatisch";
  return `${scope} · ${asset.creator_short_name || "ROOTS"} · ${origin} · ${type} · ${assetTitle(asset)}`;
}

function inputField(name, label, value, { step = "1", suffix = "", min = "0" } = {}) {
  return `<label class="pi-kpi-field"><span>${label}${suffix ? ` <small>${suffix}</small>` : ""}</span><input class="modern-input" type="number" min="${min}" step="${step}" name="${name}" value="${numberValue(value)}"></label>`;
}

export function initPerformanceDashboard({ client, callApi, toast, openSettingsPanel, escapeHtml: escape = null }) {
  const escapeHtml = escape || ((value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])));
  const state = {
    payload: { preferences: defaultDashboardPreferences(), assets: [], creators: [], performance: [] },
    savedPreferences: defaultDashboardPreferences(),
    summary: null,
    loading: false,
    loaded: false,
    realtimeStatus: "connecting",
    kpiLane: "marketing",
    kpiSearch: "",
    kpiAssetFilter: "all",
    selectedAssetId: "",
    reloadTimer: null,
    preferenceSaveTimer: null,
    channel: null,
  };
  const hosts = [...document.querySelectorAll("[data-performance-dashboard]")];
  const kpiSelect = document.getElementById("kpi-asset-select");
  const kpiSearch = document.getElementById("kpi-asset-search");
  const kpiAssetFilter = document.getElementById("kpi-asset-filter");
  const kpiContext = document.getElementById("kpi-asset-context");
  const kpiForm = document.getElementById("kpi-performance-form");
  const kpiFields = document.getElementById("kpi-performance-fields");
  const kpiEmpty = document.getElementById("kpi-performance-empty");
  const kpiDelete = document.getElementById("btn-kpi-delete");

  const updateLiveLabels = () => {
    document.querySelectorAll("[data-dashboard-live-label]").forEach((label) => {
      label.textContent = state.realtimeStatus === "live" ? "Live" : state.realtimeStatus === "refreshing" ? "Aktualisiert" : "Verbinde…";
      label.classList.toggle("is-live", state.realtimeStatus === "live");
    });
  };

  /**
   * Dasselbe Profilbild wie im Intranet. Fehlt es, stehen die Initialen da -
   * ein leerer Kreis waere kein Hinweis, sondern ein Loch.
   */
  const avatarHtml = (person, extraClass = "") => {
    const name = String(person?.name || person?.short_name || "ROOTS Team");
    const url = String(person?.avatar_url || "");
    const initialen = name.split(/\s+/).filter(Boolean).slice(0, 2).map((teil) => teil[0]).join("").toLocaleUpperCase("de");
    const klasse = `pi-avatar${extraClass ? ` ${extraClass}` : ""}`;
    return url
      ? `<img class="${klasse}" src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
      : `<span class="${klasse} pi-avatar--initials" aria-hidden="true">${escapeHtml(initialen || "R")}</span>`;
  };

  /**
   * Auswahl mit zwei oder drei Moeglichkeiten gehoert nicht in ein Dropdown:
   * ein natives <select> bringt Pfeil, Schriftgroesse und Menue des Browsers
   * mit und steht damit als Fremdkoerper in der Leiste. Dieselben Segmente wie
   * beim Zeitraum zeigen die Wahl, ohne dass man sie aufklappen muss.
   */
  const segmentHtml = (feld, aktuell, optionen, beschriftung) => `<div class="pi-seg" role="group" aria-label="${escapeHtml(beschriftung)}">${
    optionen.map(([wert, text]) => `<button type="button" data-dashboard-${escapeHtml(feld)}="${escapeHtml(wert)}" class="${wert === aktuell ? "is-active" : ""}" aria-pressed="${wert === aktuell}">${escapeHtml(text)}</button>`).join("")
  }</div>`;

  /** Zahlen aus der Signalansicht. Der einfache Modus laedt sie ohnehin. */
  const setSignalCounts = (counts) => {
    state.payload = {
      ...state.payload,
      signalCounts: {
        marketing: numberValue(counts?.marketing),
        sales: numberValue(counts?.sales),
        rejected: numberValue(counts?.rejected),
      },
    };
    if (state.payload.assets) renderDashboards();
  };

  const renderDashboards = () => {
    state.summary = summarizeDashboardData(state.payload);
    for (const host of hosts) {
      const preferences = state.summary.preferences;
      const selectedCreators = new Set(preferences.filters.creator_ids);
      const creatorButtons = state.payload.creators.map((creator) => `<button type="button" class="pi-creator${selectedCreators.has(creator.id) ? " is-active" : ""}" data-dashboard-creator="${escapeHtml(creator.id)}" aria-pressed="${selectedCreators.has(creator.id)}" title="${escapeHtml(creator.name)} · ${numberValue(creator.asset_count)} Assets">${avatarHtml(creator)}</button>`).join("");
      // Eine Leiste statt Kopfzeile plus Filterkasten: Titel links, Filter
      // rechts, alles in einer Hoehe. Zahlen und Namen stehen im Titel des
      // jeweiligen Knopfs, nicht als zweite Zeile daneben.
      host.innerHTML = `<div class="pi-bar">
          <h2><i class="fa-solid fa-chart-line"></i>Performance</h2>
          <div class="pi-bar-filters">
            <div class="pi-seg" role="group" aria-label="Zeitraum">${[7, 30, 90, 365].map((days) => `<button type="button" data-dashboard-period="${days}" class="${days === preferences.period_days ? "is-active" : ""}" aria-pressed="${days === preferences.period_days}">${days === 365 ? "12 M" : `${days} T`}</button>`).join("")}</div>
            ${segmentHtml("lane", preferences.filters.lane || "all", [["all", "Alle"], ["marketing", "Marketing"], ["sales", "Sales"]], "Bahn")}
            ${segmentHtml("scope", preferences.filters.asset_scope, [["roots", "ROOTS"], ["roots_private", "Privat"]], "Asset-Basis")}
            ${segmentHtml("origin", preferences.filters.origin, [["all", "Alle"], ["automatic", "KI"], ["manual", "Manuell"]], "Quelle")}
            <div class="pi-creators" role="group" aria-label="Erstellt von">
              <button type="button" class="pi-creator pi-creator--all${selectedCreators.size === 0 ? " is-active" : ""}" data-dashboard-creator="all" aria-pressed="${selectedCreators.size === 0}" title="Alle Erstellenden">Alle</button>${creatorButtons}
            </div>
          </div>
        </div>
        <div class="pi-grid">${preferences.widgets.map((preference) => renderWidget(DASHBOARD_WIDGETS.find((item) => item.id === preference.id), preference, state.summary, escapeHtml)).join("")}</div>`;
      bindBestandRing(host, escapeHtml);
    }
    updateLiveLabels();
  };

  const assetsForLane = () => state.payload.assets.filter((asset) => {
    const laneMatches = state.kpiLane === "marketing" ? asset.kind === "linkedin" : asset.kind === "memo";
    const filterMatches = state.kpiAssetFilter === "all"
      || asset.visibility === state.kpiAssetFilter
      || asset.origin === state.kpiAssetFilter;
    const haystack = `${labelForAsset(asset)} ${asset.company || ""}`.toLocaleLowerCase("de");
    return laneMatches && filterMatches && (!state.kpiSearch || haystack.includes(state.kpiSearch));
  });
  const selectedPerformance = () => state.payload.performance.find((row) => row.asset_id === state.selectedAssetId) || {};

  const renderKpiFields = () => {
    const assets = assetsForLane();
    if (!state.selectedAssetId || !assets.some((asset) => asset.id === state.selectedAssetId)) state.selectedAssetId = assets[0]?.id || "";
    if (kpiSelect) {
      kpiSelect.innerHTML = assets.length ? assets.map((asset) => `<option value="${escapeHtml(asset.id)}" ${asset.id === state.selectedAssetId ? "selected" : ""}>${escapeHtml(labelForAsset(asset))}</option>`).join("") : '<option value="">Keine fertigen Assets vorhanden</option>';
      kpiSelect.disabled = !assets.length;
    }
    const performance = selectedPerformance();
    const selectedAsset = state.payload.assets.find((asset) => asset.id === state.selectedAssetId);
    if (kpiEmpty) kpiEmpty.hidden = Boolean(state.selectedAssetId);
    if (kpiForm) kpiForm.hidden = !state.selectedAssetId;
    if (kpiContext) {
      kpiContext.hidden = !selectedAsset;
      if (selectedAsset) kpiContext.innerHTML = selectedAsset.visibility === "private"
        ? `<i class="fa-solid fa-lock"></i><span><b>Privates Asset</b> Nur Sie sehen und pflegen diese KPI-Werte.</span>`
        : `<i class="fa-solid fa-people-group"></i><span><b>ROOTS-Asset</b> KPI-Werte sind im Team-Dashboard sichtbar und gemeinsam pflegbar · erstellt von ${escapeHtml(selectedAsset.creator_name || "ROOTS Team")}.</span>`;
    }
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
    document.querySelectorAll("[data-kpi-lane]").forEach((button) => {
      const active = button.dataset.kpiLane === state.kpiLane;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    renderKpiFields();
    const coverage = summarizeDashboardData({
      ...state.payload,
      preferences: {
        ...state.payload.preferences,
        filters: { asset_scope: "roots_private", creator_ids: [], origin: "all" },
      },
    }).coverage;
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
        creators: Array.isArray(payload.creators) ? payload.creators : [],
        performance: Array.isArray(payload.performance) ? payload.performance : [],
      };
      state.savedPreferences = state.payload.preferences;
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
    state.payload.preferences = normalizeDashboardPreferences(preferences);
    renderDashboards();
    try {
      const result = await callApi("save_dashboard_preferences", { preferences: normalizeDashboardPreferences(preferences) });
      state.payload.preferences = normalizeDashboardPreferences(result.preferences);
      state.savedPreferences = state.payload.preferences;
      renderDashboards();
    } catch (error) {
      state.payload.preferences = state.savedPreferences;
      renderDashboards();
      toast(error.message, "err");
    }
  };

  const queuePreferenceSave = (preferences) => {
    clearTimeout(state.preferenceSaveTimer);
    state.payload.preferences = normalizeDashboardPreferences(preferences);
    renderDashboards();
    state.preferenceSaveTimer = setTimeout(() => void savePreferences(state.payload.preferences), 220);
  };

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
    const periodButton = event.target.closest("[data-dashboard-period]");
    if (periodButton) {
      queuePreferenceSave({ ...state.payload.preferences, period_days: Number(periodButton.dataset.dashboardPeriod) });
      return;
    }
    const laneButtonBar = event.target.closest("[data-dashboard-lane]");
    if (laneButtonBar) {
      queuePreferenceSave({ ...state.payload.preferences, filters: { ...state.payload.preferences.filters, lane: laneButtonBar.dataset.dashboardLane } });
      return;
    }
    const scopeButton = event.target.closest("[data-dashboard-scope]");
    if (scopeButton) {
      queuePreferenceSave({ ...state.payload.preferences, filters: { ...state.payload.preferences.filters, asset_scope: scopeButton.dataset.dashboardScope } });
      return;
    }
    const originButton = event.target.closest("[data-dashboard-origin]");
    if (originButton) {
      queuePreferenceSave({ ...state.payload.preferences, filters: { ...state.payload.preferences.filters, origin: originButton.dataset.dashboardOrigin } });
      return;
    }
    const creatorButton = event.target.closest("[data-dashboard-creator]");
    if (creatorButton) {
      const id = creatorButton.dataset.dashboardCreator;
      const selected = new Set(state.payload.preferences.filters.creator_ids);
      if (id === "all") selected.clear();
      else if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      queuePreferenceSave({ ...state.payload.preferences, filters: { ...state.payload.preferences.filters, creator_ids: [...selected] } });
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target === kpiSelect) {
      state.selectedAssetId = kpiSelect.value;
      renderKpiFields();
    }
    if (event.target === kpiAssetFilter) {
      state.kpiAssetFilter = kpiAssetFilter.value;
      state.selectedAssetId = "";
      renderKpiFields();
    }
  });

  kpiSearch?.addEventListener("input", () => {
    state.kpiSearch = kpiSearch.value.trim().toLocaleLowerCase("de");
    state.selectedAssetId = "";
    renderKpiFields();
  });

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
        .on("postgres_changes", { event: "*", schema: "signal_layer", table: "asset_performance" }, scheduleReload)
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
  return { reload: load, state, setSignalCounts };
}
