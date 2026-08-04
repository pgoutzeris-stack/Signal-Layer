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
