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

test("uses verified standard and batch model prices without a guessed fallback", () => {
  assert.match(backend, /"gemini-2\.5-flash-lite":\s*\{[^\n]*standard:\s*\{ input: 0\.1, cachedInput: 0\.01, output: 0\.4 \}, batch:\s*\{ input: 0\.05, cachedInput: 0\.01, output: 0\.2 \}/);
  assert.match(backend, /"gemini-3\.5-flash":\s*\{[^\n]*standard:\s*\{ input: 1\.5, cachedInput: 0\.15, output: 9 \}, batch:\s*\{ input: 0\.75, cachedInput: 0\.075, output: 4\.5 \}/);
  assert.match(backend, /"deepseek-v4-pro":\s*\{ currency: "CNY", standard:\s*\{ input: 3, cachedInput: 0\.025, output: 6 \}/);
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

test("books a DeepSeek JSON repair as a separate paid attempt", () => {
  assert.match(simple, /options\.repairAttempt \? 2 : 1/);
  assert.match(simple, /repairAttempt:\s*true/);
  assert.match(simple, /option\.provider === "deepseek" && !options\.repairAttempt/);
});

test("never marks a Simple run complete with technical model errors", () => {
  assert.match(backend, /const completedWithErrors = done && Number\(finalTechnicalErrors \|\| 0\) > 0/);
  assert.match(backend, /status: completedWithErrors \? "error" : done \? "done" : "running"/);
});
