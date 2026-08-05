const ACTIVE_STATES = new Set(["queued", "running"]);

function runTime(run) {
  if (!run) return 0;
  return new Date(run.finished_at || run.last_progress_at || run.started_at || 0).getTime() || 0;
}

// Pure state derivation for the optional Simple status widget. Keeping this
// outside app.js makes the no-run state independently testable and ensures
// that null never becomes a fake trigger run through `null === null`.
export function deriveSimpleHeaderState(run = null, triggerBackfill = null) {
  const activeTriggerRun = ACTIVE_STATES.has(triggerBackfill?.status) ? triggerBackfill : null;
  const activeRun = activeTriggerRun || (ACTIVE_STATES.has(run?.status) ? run : null);
  const visibleRun = activeRun || [triggerBackfill, run].filter(Boolean).sort((left, right) => runTime(right) - runTime(left))[0] || null;
  const failedRun = !activeRun && visibleRun?.status === "error" ? visibleRun : null;
  const progressRun = activeRun || failedRun;
  const progressIsTrigger = Boolean(progressRun && triggerBackfill && progressRun === triggerBackfill);
  const running = Boolean(activeRun);
  const failed = Boolean(failedRun);

  return {
    activeTriggerRun,
    activeRun,
    visibleRun,
    failedRun,
    progressRun,
    progressIsTrigger,
    running,
    failed,
    tone: running ? "working" : failed ? "error" : "idle",
    label: running ? "Analyse läuft" : failed ? "Prüfung nötig" : "Kein Lauf aktiv",
  };
}

export function simpleProgressCounts(progressRun, progressIsTrigger) {
  if (!progressRun) return { total: 0, processed: 0 };
  const total = Number(progressRun.total_count || 0);
  const processed = progressIsTrigger
    ? Number(progressRun.completed_count || 0) + Number(progressRun.missing_count || 0) + Number(progressRun.error_count || 0)
    : Number(progressRun.processed_count || 0);
  return { total, processed };
}

const SIMPLE_AI_ERROR_LABELS = {
  insufficient_balance: "Guthaben aufgebraucht",
  spending_cap: "Ausgabenlimit erreicht",
  rate_limit: "Anfragelimit erreicht",
  invalid_key: "API-Schlüssel abgelehnt",
  model_busy: "Modell ausgelastet",
  timeout: "Zeitüberschreitung",
  invalid_response: "Antwort nicht lesbar",
};

// A pure compatibility layer for old and new status payloads. The backend now
// sends the precise provider diagnosis; older deployments still get a useful
// label instead of exposing an internal database-table hint to users.
export function simpleRunErrorPresentation(detail = null, fallbackMessage = "") {
  const code = String(detail?.code || detail?.error_code || "unknown");
  const model = String(detail?.model_label || detail?.model || "KI-Modell");
  const shortLabel = String(detail?.short_label || SIMPLE_AI_ERROR_LABELS[code] || "Technischer KI-Fehler");
  const rawFallback = String(fallbackMessage || "");
  const genericFallback = /siehe ai_usage_events|KI-Prüfung nicht möglich/i.test(rawFallback);
  return {
    code,
    model,
    shortLabel,
    pillLabel: `${model} · ${shortLabel}`,
    title: String(detail?.title || `${model}: ${shortLabel}`),
    summary: String(detail?.summary || (genericFallback
      ? "Das Analysemodell konnte keine Bewertung liefern. Der Lauf wurde zum Schutz der Artikel gestoppt."
      : rawFallback || "Der letzte Simple-Lauf wurde mit einem technischen Fehler beendet.")),
    action: String(detail?.action || "Fehlerursache beheben und den Lauf anschließend neu starten."),
    provider: String(detail?.provider_label || detail?.provider || "Nicht ermittelt"),
    providerMessage: String(detail?.provider_message || "Keine Anbieter-Antwort gespeichert"),
    affectedCalls: Number(detail?.affected_calls || 0),
    tokens: Number(detail?.tokens || 0),
    costEur: Number(detail?.cost_eur || 0),
    billable: Boolean(detail?.billable),
    internalCostWarning: Boolean(detail?.internal_cost_warning),
    occurredAt: detail?.occurred_at || null,
  };
}
