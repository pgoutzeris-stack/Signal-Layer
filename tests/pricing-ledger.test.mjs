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
  assert.match(backend, /"deepseek-v4-pro":\s*\{ currency: "USD", standard:\s*\{ input: 0\.435, cachedInput: 0\.003625, output: 0\.87 \}/);
  assert.match(backend, /"deepseek-v4-flash":\s*\{ currency: "USD", standard:\s*\{ input: 0\.14, cachedInput: 0\.0028, output: 0\.28 \}/);
  assert.match(backend, /if \(!verified\) throw new Error\(/);
  assert.match(backend, /function zeroCostFields\(model: string\)/);
  assert.doesNotMatch(backend, /fallbackRate|defaultRate|estimatedModelRate/i);
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
