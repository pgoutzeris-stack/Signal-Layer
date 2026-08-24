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
  assert.match(backend, /upsert\(row, \{ onConflict: "asset_id" \}\)/);
  assert.match(frontend, /table: "asset_performance"[\s\S]{0,80}scheduleReload/);
  assert.doesNotMatch(frontend, /table: "asset_performance", filter:/);
});
