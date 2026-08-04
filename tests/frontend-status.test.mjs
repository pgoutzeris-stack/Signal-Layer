import test from "node:test";
import assert from "node:assert/strict";
import { deriveSimpleHeaderState, simpleProgressCounts } from "../status-state.mjs";

test("no Simple run stays idle without a fake trigger run", () => {
  const state = deriveSimpleHeaderState(null, null);
  assert.equal(state.progressRun, null);
  assert.equal(state.progressIsTrigger, false);
  assert.equal(state.tone, "idle");
  assert.equal(state.label, "Kein Lauf aktiv");
  assert.deepEqual(simpleProgressCounts(state.progressRun, state.progressIsTrigger), { total: 0, processed: 0 });
});

test("completed runs do not expose completed progress as active", () => {
  const run = { status: "done", total_count: 1000, processed_count: 1000, finished_at: "2026-08-04T14:00:00Z" };
  const backfill = { status: "done", total_count: 2, completed_count: 2, finished_at: "2026-08-04T15:00:00Z" };
  const state = deriveSimpleHeaderState(run, backfill);
  assert.equal(state.visibleRun, backfill);
  assert.equal(state.progressRun, null);
  assert.equal(state.progressIsTrigger, false);
  assert.equal(state.tone, "idle");
});

test("running trigger backfill reports its own progress", () => {
  const backfill = { status: "running", total_count: 4, completed_count: 2, missing_count: 1, error_count: 0 };
  const state = deriveSimpleHeaderState(null, backfill);
  assert.equal(state.progressRun, backfill);
  assert.equal(state.progressIsTrigger, true);
  assert.equal(state.tone, "working");
  assert.deepEqual(simpleProgressCounts(state.progressRun, state.progressIsTrigger), { total: 4, processed: 3 });
});

test("running main analysis reports processed articles", () => {
  const run = { status: "running", total_count: 1000, processed_count: 72 };
  const state = deriveSimpleHeaderState(run, null);
  assert.equal(state.progressRun, run);
  assert.equal(state.progressIsTrigger, false);
  assert.deepEqual(simpleProgressCounts(state.progressRun, state.progressIsTrigger), { total: 1000, processed: 72 });
});
