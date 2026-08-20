import test from "node:test";
import assert from "node:assert/strict";
import { deriveSimpleHeaderState, simpleProgressCounts, simpleRunErrorPresentation } from "../status-state.mjs";

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

test("provider balance errors identify model, cause and zero-cost effect", () => {
  const error = simpleRunErrorPresentation({
    code: "insufficient_balance",
    model_label: "DeepSeek V4 Pro",
    short_label: "Guthaben aufgebraucht",
    summary: "DeepSeek hat die Analyse abgelehnt.",
    provider_label: "DeepSeek API",
    provider_message: "Insufficient Balance",
    affected_calls: 5,
    tokens: 0,
    cost_eur: 0,
    billable: false,
    internal_cost_warning: false,
  });
  assert.equal(error.pillLabel, "DeepSeek V4 Pro · Guthaben aufgebraucht");
  assert.equal(error.providerMessage, "Insufficient Balance");
  assert.equal(error.affectedCalls, 5);
  assert.equal(error.billable, false);
  assert.equal(error.internalCostWarning, false);
});

test("old generic database hints are never shown as the user explanation", () => {
  const error = simpleRunErrorPresentation(null, "KI-Prüfung nicht möglich (siehe ai_usage_events).");
  assert.doesNotMatch(error.summary, /ai_usage_events/);
  assert.match(error.summary, /Analysemodell/);
});

test("ein behobenes Anbieterproblem steht nicht mehr als aktueller Zustand im Kopf", () => {
  // Der Server liefert keine Diagnose mehr, sobald das Modell wieder antwortet.
  const erholt = simpleRunErrorPresentation(null, "DeepSeek V4 Pro hat die Artikelanalyse abgelehnt, weil das Guthaben des Anbieter-Kontos aufgebraucht ist.");
  assert.equal(erholt.resolved, true);
  assert.equal(erholt.pillLabel, "Lauf abgebrochen");
  assert.doesNotMatch(erholt.summary, /Guthaben/);
  assert.equal(erholt.occurredAt, null);

  // Ein Fehler mit Diagnose bleibt ein Fehler.
  const echt = simpleRunErrorPresentation({ code: "insufficient_balance", model_label: "DeepSeek V4 Pro", occurred_at: "2026-08-16T17:40:49Z" }, "");
  assert.equal(echt.resolved, false);
  assert.match(echt.pillLabel, /Guthaben aufgebraucht/);
});

test("ein aelterer Fehlerlauf verschwindet, sobald ein neuerer Lauf existiert", () => {
  const alterFehler = { id: "alt", status: "error", finished_at: "2026-08-16T17:40:49Z" };
  const neuerLauf = { id: "neu", status: "done", finished_at: "2026-08-20T21:00:00Z" };
  assert.equal(deriveSimpleHeaderState(neuerLauf, alterFehler).failed, false);
  assert.equal(deriveSimpleHeaderState(alterFehler, null).failed, true);
  // Waehrend ein Lauf laeuft, zeigt der Kopf den Lauf, nicht den alten Fehler.
  assert.equal(deriveSimpleHeaderState({ id: "neu", status: "running" }, alterFehler).failed, false);
});
