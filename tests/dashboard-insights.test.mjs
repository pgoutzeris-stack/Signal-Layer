import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DASHBOARD_WIDGETS,
  deriveDashboardInsights,
  normalizeDashboardPreferences,
  summarizeDashboardData,
} from "../dashboard-insights.js";

test("dashboard preferences keep a fixed widget set and normalize personal filters", () => {
  const preferences = normalizeDashboardPreferences({
    period_days: 90,
    filters: {
      asset_scope: "roots_private",
      creator_ids: ["11111111-1111-4111-8111-111111111111", "11111111-1111-4111-8111-111111111111", "invalid"],
      origin: "manual",
    },
    widgets: [{ id: "sales_funnel", visible: false, size: "wide" }],
  });
  assert.equal(preferences.period_days, 90);
  assert.equal(preferences.filters.asset_scope, "roots_private");
  assert.equal(preferences.filters.origin, "manual");
  assert.deepEqual(preferences.filters.creator_ids, ["11111111-1111-4111-8111-111111111111"]);
  assert.equal(preferences.widgets.length, DASHBOARD_WIDGETS.length);
  assert.equal(new Set(preferences.widgets.map((item) => item.id)).size, DASHBOARD_WIDGETS.length);
  assert.ok(preferences.widgets.every((item) => item.visible));
});

test("dashboard filters ROOTS, own private, creators and manual origin before aggregation", () => {
  const summary = summarizeDashboardData({
    preferences: {
      period_days: 30,
      filters: {
        asset_scope: "roots_private",
        creator_ids: ["11111111-1111-4111-8111-111111111111"],
        origin: "manual",
      },
    },
    assets: [
      { id: "roots-pano-manual", kind: "linkedin", visibility: "roots", origin: "manual", creator_id: "11111111-1111-4111-8111-111111111111" },
      { id: "roots-richard-auto", kind: "memo", visibility: "roots", origin: "automatic", creator_id: "22222222-2222-4222-8222-222222222222" },
      { id: "private-pano-manual", kind: "linkedin", visibility: "private", origin: "manual", creator_id: "11111111-1111-4111-8111-111111111111" },
    ],
    performance: [
      { asset_id: "roots-pano-manual", lane: "marketing", updated_at: new Date().toISOString(), impressions: 100 },
      { asset_id: "roots-richard-auto", lane: "sales", updated_at: new Date().toISOString(), sends: 10 },
      { asset_id: "private-pano-manual", lane: "marketing", updated_at: new Date().toISOString(), impressions: 50 },
    ],
  });
  assert.deepEqual(summary.assets.map((asset) => asset.id), ["roots-pano-manual", "private-pano-manual"]);
  assert.equal(summary.marketingTotals.impressions, 150);
  assert.equal(summary.salesTotals.sends, 0);
});

test("marketing and sales KPIs produce separate rates and personal coverage", () => {
  const now = Date.parse("2026-08-24T12:00:00Z");
  const summary = summarizeDashboardData({
    preferences: { period_days: 30 },
    assets: [
      { id: "marketing-1", kind: "linkedin", slide_title: "CMO Agenda" },
      { id: "sales-1", kind: "memo", title: "Executive Memo" },
      { id: "sales-2", kind: "memo", title: "Noch ohne KPI" },
    ],
    performance: [
      {
        asset_id: "marketing-1", lane: "marketing", published_at: "2026-08-20T10:00:00Z",
        impressions: 1000, reactions: 60, comments: 20, reposts: 10, saves: 10, link_clicks: 50,
      },
      {
        asset_id: "sales-1", lane: "sales", published_at: "2026-08-21T10:00:00Z",
        sends: 20, opens: 16, replies: 8, meetings: 4, opportunities: 2, wins: 1,
        influenced_pipeline_eur: 120000, revenue_eur: 30000,
      },
    ],
  }, now);
  assert.equal(summary.marketingTotals.impressions, 1000);
  assert.equal(summary.marketingTotals.engagement_rate, 0.1);
  assert.equal(summary.marketingTotals.click_rate, 0.05);
  assert.equal(summary.salesTotals.response_rate, 0.4);
  assert.equal(summary.salesTotals.win_rate, 0.5);
  assert.equal(summary.salesTotals.influenced_pipeline_eur, 120000);
  assert.equal(summary.coverage.covered, 2);
  assert.equal(summary.coverage.total, 3);
  assert.equal(summary.coverage.sales_covered, 1);
});

test("out-of-period rows are not mixed into current dashboard insights", () => {
  const now = Date.parse("2026-08-24T12:00:00Z");
  const summary = summarizeDashboardData({
    preferences: { period_days: 7 },
    assets: [{ id: "asset", kind: "linkedin" }],
    performance: [{ asset_id: "asset", lane: "marketing", published_at: "2026-07-01T10:00:00Z", impressions: 5000 }],
  }, now);
  assert.equal(summary.current.length, 0);
  assert.equal(summary.marketingTotals.impressions, 0);
  assert.equal(summary.coverage.covered, 1);
});

test("insight radar names the weakest available sales conversion", () => {
  const summary = summarizeDashboardData({
    preferences: { period_days: 30 },
    assets: [{ id: "memo", kind: "memo", title: "Memo" }],
    performance: [{
      asset_id: "memo", lane: "sales", updated_at: new Date().toISOString(),
      sends: 100, opens: 80, replies: 20, meetings: 2, opportunities: 1, wins: 1,
    }],
  });
  const insights = deriveDashboardInsights(summary);
  assert.ok(insights.some((item) => item.title === "Sales-Funnel" && item.text.includes("Termin")));
});

test("frontend, Edge Function and settings use the same dashboard actions", async () => {
  const [frontend, backend, html] = await Promise.all([
    readFile(new URL("../dashboard-insights.js", import.meta.url), "utf8"),
    readFile(new URL("../supabase/functions/signal-layer/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
  ]);
  for (const action of ["get_dashboard_insights", "save_dashboard_preferences", "save_asset_performance", "delete_asset_performance"]) {
    assert.match(frontend, new RegExp(action));
    assert.match(backend, new RegExp(`case \\\"${action}\\\"`));
  }
  assert.match(html, /data-panel="dashboard-kpis"/);
  assert.match(html, /id="kpi-performance-form"/);
  assert.match(html, /id="kpi-asset-search"/);
  assert.match(html, /data-performance-dashboard="advanced"/);
  assert.match(html, /data-performance-dashboard="simple"/);
  assert.doesNotMatch(frontend, /My Signal Performance|Dashboard Insights|> Anpassen</);
  assert.match(frontend, /data-dashboard-period/);
  assert.match(frontend, /data-dashboard-creator/);
});

test("ROOTS KPI rows are shared while private rows remain owner-scoped", async () => {
  const [migration, backend, frontend] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260824152840_share_roots_asset_performance.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/functions/signal-layer/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../dashboard-insights.js", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /create policy "asset performance visible by asset scope"/);
  assert.match(migration, /visibility = 'private' and \(select auth\.uid\(\)\) = user_id/);
  assert.match(migration, /visibility = 'roots'/);
  assert.match(migration, /asset_performance_asset_id_key unique \(asset_id\)/);
  assert.match(backend, /dashboardAssetVisibility/);
  assert.match(backend, /"rod", "jannik", "richard", "panagiotis", "pano"/);
  assert.match(backend, /startsWith\("claude-debug@"\)/);
  assert.match(backend, /upsert\(row, \{ onConflict: "asset_id" \}\)/);
  assert.match(frontend, /table: "asset_performance"[\s\S]{0,80}scheduleReload/);
  assert.doesNotMatch(frontend, /table: "asset_performance", filter:/);
});

test("die Dashboard-Filter zeigen ihre Auswahl wirklich an", async () => {
  const [js, css, indexHtml] = await Promise.all([
    readFile(new URL("../dashboard-insights.js", import.meta.url), "utf8"),
    readFile(new URL("../dashboard-insights.css", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
  ]);
  // .signal-toolbar-select blendet das echte <select> aus, weil in der
  // Signal-Leiste ein eigenes Menue darueber liegt. Im Dashboard blieb dadurch
  // nur die Beschriftung stehen.
  assert.match(indexHtml, /\.signal-toolbar-select \{[^}]*opacity: 0/);
  assert.ok(!js.includes("signal-toolbar-select"), "Dashboard nutzt die unsichtbare Klasse");
  // Kein natives <select> mehr in der Leiste: es bringt Pfeil, Schriftgroesse
  // und Menue des Browsers mit und stand als Fremdkoerper darin.
  assert.ok(!js.includes("<select data-dashboard-scope"), "Auswahl ist kein Dropdown mehr");
  assert.ok(!js.includes("<select data-dashboard-origin"), "Auswahl ist kein Dropdown mehr");
  assert.match(js, /const segmentHtml = \(feld, aktuell, optionen, beschriftung\)/);
  assert.match(js, /data-dashboard-\$\{escapeHtml\(feld\)\}/);
  // Eine Leiste statt Kopfzeile plus Filterkasten.
  assert.match(js, /class="pi-bar"/);
  assert.ok(!js.includes("pi-filter-panel"), "der zweite Kasten ist entfallen");
  assert.match(css, /\.pi-bar \{[^}]*box-shadow: var\(--shadow-dash\)/);
  // Alle Filter tragen dieselbe Segmentform.
  assert.match(css, /\.pi-seg button\.is-active \{ color: #fff; background: var\(--brand\)/);
  assert.ok(!/\.pi-field select/.test(css), "die Dropdown-Regeln sind entfallen");
  // Kein Erklaersatz unter der Ueberschrift.
  assert.ok(!js.includes("persönlich gefiltert und in Echtzeit synchronisiert"));
});

test("die Leiste filtert auch nach Bahn und bleibt ohne Beiwerk", async () => {
  const [js, css] = await Promise.all([
    readFile(new URL("../dashboard-insights.js", import.meta.url), "utf8"),
    readFile(new URL("../dashboard-insights.css", import.meta.url), "utf8"),
  ]);
  // Marketing sind die LinkedIn-Assets, Sales die Executive Memos.
  assert.match(js, /lane: "all"/);
  assert.match(js, /\[\["all", "Alle"\], \["marketing", "Marketing"\], \["sales", "Sales"\]\]/);
  assert.match(js, /asset\.kind === "linkedin" : asset\.kind === "memo"/);
  // "Automatisch" heisst, was es ist.
  assert.match(js, /\["automatic", "KI"\]/);
  // Zaehler und Verbindungspunkt sind aus der Leiste raus.
  assert.ok(!js.includes('class="pi-count"'), "der Zaehler ist entfallen");
  assert.ok(!js.includes('class="pi-live"'), "der pulsierende Punkt ist entfallen");
  assert.ok(!css.includes(".pi-live"), "die Regeln dazu sind entfallen");
  // "Alle" bei den Gesichtern war oval: Rundung von der Kreisform, Breite vom Text.
  assert.match(css, /\.pi-creator--all \{[^}]*border-radius: 999px/);
});

test("die Bahn wird auch serverseitig als Vorliebe akzeptiert", async () => {
  const backend = await readFile(new URL("../supabase/functions/signal-layer/index.ts", import.meta.url), "utf8");
  assert.match(backend, /lane: "all" \| "marketing" \| "sales";/);
  assert.match(backend, /\["marketing", "sales"\]\.includes\(String\(rawFilters\.lane\)\)/);
  assert.match(backend, /creator_ids: creatorIds, origin, lane/);
});

test("die Uebersicht traegt Bestand und Wirkung, ohne Erklaertext", async () => {
  const [js, indexHtml, simple] = await Promise.all([
    readFile(new URL("../dashboard-insights.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../simple-mode.js", import.meta.url), "utf8"),
  ]);
  assert.match(js, /title: "Übersicht"/);
  assert.ok(!js.includes("Performance Pulse"), "der alte Name ist weg");
  // Die drei Zahlen der Signalansicht stehen jetzt in der Uebersicht.
  assert.match(js, /Marketing-Signale/);
  assert.match(js, /Aussortierte Artikel/);
  assert.ok(!indexHtml.includes('id="simple-dash-marketing"'), "die Kachelreihe unter dem Dashboard ist entfallen");
  assert.match(simple, /ctx\.setDashboardSignalCounts\(/);
  // Kein Satz, der die Ansicht erklaert.
  assert.ok(!js.includes("Die Asset-Basis ist bereit"), "der Erklaertext ist weg");
  assert.ok(!js.includes("ausgewählte Assets"), "die Zeile daruber ist weg");
});

test("die Signalzahlen ueberstehen ein Neuzeichnen", async () => {
  const module = await import("../dashboard-insights.js");
  const summary = module.summarizeDashboardData({
    preferences: module.defaultDashboardPreferences(),
    assets: [], creators: [], performance: [],
    signalCounts: { marketing: 62, sales: 51, rejected: 118 },
  });
  assert.deepEqual(summary.signalCounts, { marketing: 62, sales: 51, rejected: 118 });
  // Ohne Zahlen steht dort eine Null, keine leere Kachel.
  const leer = module.summarizeDashboardData({ preferences: module.defaultDashboardPreferences(), assets: [] });
  assert.deepEqual(leer.signalCounts, { marketing: 0, sales: 0, rejected: 0 });
});

test("der Bestandsring teilt die bewerteten Artikel auf", async () => {
  const module = await import("../dashboard-insights.js");
  const summary = module.summarizeDashboardData({
    preferences: module.defaultDashboardPreferences(),
    assets: [], creators: [], performance: [],
    signalCounts: { marketing: 279, sales: 117, rejected: 5157, review: 100, crawled: 21282 },
  });
  const html = module.bestandRingHtml(summary);
  // Vier Segmente, deren Boegen zusammen den vollen Kreis ergeben.
  const boegen = [...html.matchAll(/stroke-dasharray="([\d.]+) /g)].map((treffer) => Number(treffer[1]));
  assert.equal(boegen.length, 4);
  // Zwischen den Segmenten bleibt eine kleine Luecke, damit die runden Enden
  // nicht ineinanderlaufen - vier Luecken zu 0,9.
  assert.ok(Math.abs(boegen.reduce((a, b) => a + b, 0) - (100 - 4 * 0.9)) < 0.05, `Summe der Boegen: ${boegen}`);
  // Die Mitte traegt die Summe der vier, nicht den Gesamtbestand.
  assert.match(html, /<b>5\.653<\/b><span>Artikel<\/span>/);
  // Der Gesamtbestand steht als Bezugsgroesse darunter.
  // Aussortierte lassen sich ausblenden; dann steht dort, was fehlt.
  const ohne = module.bestandRingHtml(summary, (v) => String(v ?? ""), { hideRejected: true });
  assert.match(ohne, /<b>496<\/b><span>Artikel<\/span>/);
  assert.match(ohne, /5\.157 aussortierte nicht eingerechnet/);
  // Jedes Segment traegt Wert und Anteil fuer die Mitte.
  assert.match(html, /data-label="Manuelle Prüfung" data-value="100"/);
});

test("ohne bewertete Artikel steht dort kein leerer Ring", async () => {
  const module = await import("../dashboard-insights.js");
  const summary = module.summarizeDashboardData({ preferences: module.defaultDashboardPreferences(), assets: [] });
  assert.match(module.bestandRingHtml(summary), /Noch keine analysierten Artikel/);
});

test("der Bahnfilter hebt hervor statt zu verbergen", async () => {
  const module = await import("../dashboard-insights.js");
  const summary = module.summarizeDashboardData({
    preferences: { ...module.defaultDashboardPreferences(), filters: { asset_scope: "roots", creator_ids: [], origin: "all", lane: "sales" } },
    assets: [], signalCounts: { marketing: 279, sales: 117, rejected: 5157, review: 100 },
  });
  const html = module.bestandRingHtml(summary);
  // Eine Verteilung mit nur einem Teil waere keine Verteilung mehr.
  assert.equal([...html.matchAll(/data-slice="/g)].length, 4);
  assert.match(html, /class="pi-slice is-dimmed" data-slice="marketing"/);
  assert.match(html, /class="pi-slice" data-slice="sales"/);
});

test("der Server zaehlt Pruefung und Bestand mit", async () => {
  const backend = await readFile(new URL("../supabase/functions/signal-layer/index.ts", import.meta.url), "utf8");
  assert.match(backend, /\.eq\("classification_status", "uncertain"\)/);
  assert.match(backend, /review: review \|\| 0,\n\s*crawled: crawled \|\| 0,/);
});

test("die Uebersicht nennt die Lage in einem Satz", async () => {
  const module = await import("../dashboard-insights.js");
  const basis = {
    preferences: module.defaultDashboardPreferences(),
    assets: [
      { id: "1", kind: "linkedin", visibility: "roots", origin: "automatic", created_at: new Date().toISOString() },
      { id: "2", kind: "memo", visibility: "roots", origin: "automatic", created_at: new Date().toISOString() },
    ],
    performance: [
      { asset_id: "1", lane: "marketing", impressions: 12400, published_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { asset_id: "2", lane: "sales", sends: 40, replies: 9, published_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ],
    signalCounts: { marketing: 279, sales: 117, rejected: 5157, review: 100, crawled: 21282 },
  };
  const satz = module.uebersichtSatz(module.summarizeDashboardData(basis));
  // Bezugsgroesse ist, was die Pipeline bewertet hat, nicht der gesamte Bestand.
  assert.match(satz, /^Aus 5\.653 analysierten Artikeln: 279 Marketing-Signale mit 12\.400 Views und 117 Sales-Signale mit 22,5 % Antwortquote\.$/);

  // Ohne KPI-Werte bleibt der Satz stehen, nur ohne die Wirkungsangaben.
  const ohneKpi = module.uebersichtSatz(module.summarizeDashboardData({ ...basis, performance: [] }));
  assert.equal(ohneKpi, "Aus 5.653 analysierten Artikeln: 279 Marketing-Signale und 117 Sales-Signale.");

  // Ohne Signale wird nichts behauptet.
  const leer = module.uebersichtSatz(module.summarizeDashboardData({
    ...basis, performance: [], signalCounts: { marketing: 0, sales: 0, rejected: 5157, review: 100, crawled: 21282 },
  }));
  assert.equal(leer, "5.257 Artikel analysiert, noch kein Signal bewertet.");

  // Ganz ohne Zahlen wird gar nichts behauptet.
  const nichts = module.uebersichtSatz(module.summarizeDashboardData({ ...basis, performance: [], signalCounts: {} }));
  assert.equal(nichts, "Noch keine Artikel analysiert.");
});

test("das Dashboard holt die Signalzahlen selbst", async () => {
  const js = await readFile(new URL("../dashboard-insights.js", import.meta.url), "utf8");
  // Frueher reichte sie nur der einfache Modus herein - wer die Ansicht ohne
  // ihn oeffnete, sah Nullen.
  assert.match(js, /callApi\("get_simple_dashboard"\)\.catch\(\(\) => null\)/);
  assert.match(js, /signalCounts: bestand\?\.counts/);
});

test("die Laufmeldung steht nicht mehr unter dem Dashboard", async () => {
  const [indexHtml, simple] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../simple-mode.js", import.meta.url), "utf8"),
  ]);
  assert.ok(!indexHtml.includes('id="simple-dash-run"'), "die Box ist entfernt");
  assert.ok(!simple.includes("dashRun"), "der Code dazu ist entfernt");
  assert.ok(!simple.includes("Letzter Lauf:"), "der Text ist entfernt");
});

test("der Ring laesst sich ohne die Aussortierten lesen", async () => {
  const module = await import("../dashboard-insights.js");
  const summary = module.summarizeDashboardData({
    preferences: module.defaultDashboardPreferences(),
    assets: [], performance: [],
    signalCounts: { marketing: 279, sales: 117, rejected: 5157, review: 100 },
  });
  const mit = module.bestandRingHtml(summary);
  const ohne = module.bestandRingHtml(summary, (v) => String(v ?? ""), { hideRejected: true });
  // Der Umschalter sitzt an der Zeile, die er betrifft.
  assert.match(mit, /data-toggle-rejected aria-pressed="true"/);
  assert.match(ohne, /data-toggle-rejected aria-pressed="false"/);
  // Ausgeblendet zaehlt die Mitte nur noch die uebrigen drei.
  assert.match(ohne, /<b>496<\/b>/);
  // Die Zeile bleibt stehen, damit die Zahl nicht verschwindet.
  assert.match(ohne, /class="pi-legend-row is-hidden" data-slice-key="rejected"/);
  assert.match(ohne, /5\.157/);
  // Verlauf statt flacher Vollfarbe, runde Enden.
  assert.match(mit, /stroke="url\(#piGrad-marketing\)"/);
  assert.match(mit, /<linearGradient id="piGrad-sales"/);
  assert.match(mit, /stroke-linecap="round"/);
  // Die Bindung fuer den Hover muss es geben - ohne sie wirft das Rendern.
  assert.equal(typeof module.bindBestandRing, "function");
});
