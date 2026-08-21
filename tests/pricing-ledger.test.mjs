import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const backend = readFileSync(
  new URL("../supabase/functions/signal-layer/index.ts", import.meta.url),
  "utf8",
);
const simple = readFileSync(
  new URL("../supabase/functions/signal-layer/pipeline-simple.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260804185614_snapshot_ai_costs_in_eur.sql",
    import.meta.url,
  ),
  "utf8",
);
const coverageMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260805083719_fix_ai_cost_coverage.sql",
    import.meta.url,
  ),
  "utf8",
);
const profileResearch = readFileSync(
  new URL("../supabase/functions/signal-layer/company-profile.ts", import.meta.url),
  "utf8",
);

test("uses verified standard and batch model prices without a guessed fallback", () => {
  assert.match(backend, /"gemini-2\.5-flash-lite":\s*\{[^\n]*standard:\s*\{ input: 0\.1, cachedInput: 0\.025, output: 0\.4 \}, batch:\s*\{ input: 0\.05, cachedInput: 0\.025, output: 0\.2 \}/);
  assert.match(backend, /"gemini-2\.5-flash":\s*\{[^\n]*standard:\s*\{ input: 0\.3, cachedInput: 0\.075, output: 2\.5 \}, batch:\s*\{ input: 0\.15, cachedInput: 0\.075, output: 1\.25 \}/);
  assert.match(backend, /"gemini-3\.5-flash":\s*\{[^\n]*standard:\s*\{ input: 1\.5, cachedInput: 0\.15, output: 9 \}, batch:\s*\{ input: 0\.75, cachedInput: 0\.075, output: 4\.5 \}/);
  // DeepSeek staffelt seit 16.08.2026 nach Tageszeit: Nebentarif als standard,
  // Spitzentarif (doppelt) als peak.
  assert.match(backend, /"deepseek-v4-pro":\s*\{ currency: "USD", standard:\s*\{ input: 0\.66, cachedInput: 0\.022, output: 1\.98 \}, peak:\s*\{ input: 1\.32, cachedInput: 0\.044, output: 3\.96 \}/);
  assert.match(backend, /"deepseek-v4-flash":\s*\{ currency: "USD", standard:\s*\{ input: 0\.22, cachedInput: 0\.007, output: 0\.66 \}, peak:\s*\{ input: 0\.44, cachedInput: 0\.014, output: 1\.32 \}/);
  assert.match(backend, /if \(price\.peak && isDeepseekPeak\(at\)\)/);
  assert.match(backend, /if \(!verified\) throw new Error\(/);
  assert.match(backend, /function zeroCostFields\(model: string\)/);
  assert.doesNotMatch(backend, /fallbackRate|defaultRate|estimatedModelRate/i);
});

test("DeepSeek wird nach Tageszeit abgerechnet, Spitze doppelt so teuer", async () => {
  const pipeline = await import("../supabase/functions/signal-layer/pipeline-simple.ts");
  // Spitzenzeit laut api-docs.deepseek.com/quick_start/pricing:
  // 01:00-04:00 und 06:00-10:00 UTC, alles andere Nebenzeit.
  assert.equal(pipeline.isDeepseekPeak(new Date("2026-08-21T01:00:00Z")), true);
  assert.equal(pipeline.isDeepseekPeak(new Date("2026-08-21T03:59:00Z")), true);
  assert.equal(pipeline.isDeepseekPeak(new Date("2026-08-21T04:00:00Z")), false);
  assert.equal(pipeline.isDeepseekPeak(new Date("2026-08-21T06:30:00Z")), true);
  assert.equal(pipeline.isDeepseekPeak(new Date("2026-08-21T10:00:00Z")), false);
  assert.equal(pipeline.isDeepseekPeak(new Date("2026-08-21T23:00:00Z")), false);

  const neben = pipeline.simpleModelRates("deepseek-v4-pro", new Date("2026-08-21T12:00:00Z"));
  const spitze = pipeline.simpleModelRates("deepseek-v4-pro", new Date("2026-08-21T02:00:00Z"));
  assert.deepEqual(neben, { input_usd: 0.66, cached_input_usd: 0.022, output_usd: 1.98 });
  assert.deepEqual(spitze, { input_usd: 1.32, cached_input_usd: 0.044, output_usd: 3.96 });
  // Gemini kennt keine Tageszeit: derselbe Satz rund um die Uhr.
  assert.deepEqual(
    pipeline.simpleModelRates("gemini-2.5-flash", new Date("2026-08-21T02:00:00Z")),
    pipeline.simpleModelRates("gemini-2.5-flash", new Date("2026-08-21T12:00:00Z")),
  );

  const usage = { input: 1_000_000, cachedInput: 0, output: 1_000_000, thinking: 0, total: 2_000_000 };
  const kostenNeben = pipeline.simpleUsageCostUsd("deepseek-v4-pro", usage, new Date("2026-08-21T12:00:00Z"));
  const kostenSpitze = pipeline.simpleUsageCostUsd("deepseek-v4-pro", usage, new Date("2026-08-21T02:00:00Z"));
  assert.equal(Number(kostenNeben.toFixed(4)), 2.64);
  assert.equal(Number(kostenSpitze.toFixed(4)), 5.28);
});

test("separates cached input and search usage and freezes EUR per event", () => {
  assert.match(simple, /cachedContentTokenCount/);
  assert.match(backend, /search_query_count/);
  assert.match(backend, /estimated_cost_eur/);
  assert.match(backend, /pricing_version: AI_PRICING_VERSION/);
  assert.match(migration, /legacy-reconstructed-2026-08-04/);
  assert.match(migration, /estimated_cost_eur/);
  assert.match(migration, /search_query_count/);
});

test("includes Simple research operations in the immutable cost ledger", () => {
  assert.match(coverageMigration, /'company_profile', 'company_logo'/);
  assert.match(coverageMigration, /ai_usage_events_paid_tokens_have_cost/);
  assert.match(backend, /operation: "company_profile"[\s\S]*prompt_version: SIMPLE_PIPELINE_VERSION/);
  assert.match(backend, /operation: "company_logo"[\s\S]*prompt_version: SIMPLE_PIPELINE_VERSION/);
  assert.match(profileResearch, /cachedContentTokenCount/);
  assert.match(profileResearch, /thoughtsTokenCount/);
});

test("books a DeepSeek JSON repair as a separate paid attempt", () => {
  assert.match(simple, /options\.repairAttempt \? 2 : 1/);
  assert.match(simple, /repairAttempt:\s*true/);
  assert.match(simple, /option\.provider === "deepseek" && !options\.repairAttempt/);
});

test("never marks a Simple run complete with technical model errors", () => {
  assert.match(backend, /const completedWithErrors = done && Number\(finalTechnicalErrors \|\| 0\) > 0/);
  assert.match(backend, /status: completedWithErrors \? "error" : done \? "done" : "running"/);
});

test("Simple run status explains the actual provider error from the immutable ledger", () => {
  assert.match(backend, /function simpleAiErrorCopy\(/);
  assert.match(backend, /buildSimpleRunAiErrorDetail\(/);
  assert.match(backend, /insufficient_balance:[\s\S]*API-Guthaben aufgebraucht/);
  assert.match(backend, /internal_cost_warning: false/);
  assert.doesNotMatch(backend, /KI-Prüfung nicht möglich \(siehe ai_usage_events\)/);
});

test("starts no second slow DeepSeek article near the request timeout", () => {
  assert.match(backend, /simpleModelOption\(simpleModel\)\.provider === "deepseek"\s*\? 45_000\s*:\s*85_000/);
});
