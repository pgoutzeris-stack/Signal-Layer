// Restzeit für die Ladeanzeige: je Assetart und aktuellem Schritt,
// aus gemessenen Stufen plus dem laufenden Protokoll.

export const ASSET_ETA_STAGES = ["lesen", "recherchieren", "modell", "pruefen", "bilder", "fuellen"];

export function assetEtaFallbackStages(kind, answers = {}) {
  const memo = kind === "memo";
  const carousel = answers.asset_type === "carousel";
  const slides = Number(answers.slides || 4);
  const modell = memo ? 110_000 : carousel ? (slides >= 6 ? 115_000 : 95_000) : 70_000;
  const stages = { lesen: 2_000, modell, pruefen: 2_500, fuellen: 2_500 };
  if (memo) {
    const eigen = String(answers.benchmarks_mode || answers.benchmarks || "") === "custom";
    stages.recherchieren = eigen ? 4_000 : 8_000;
  }
  if (memo && answers.images !== "upload") stages.bilder = 12_000;
  return stages;
}

export function assetEtaStageApplies(kind, answers, stage) {
  if (stage === "recherchieren") return kind === "memo";
  if (stage === "bilder") return kind === "memo" && answers.images !== "upload";
  return ASSET_ETA_STAGES.includes(stage);
}

function letzte(log, test) {
  const rows = Array.isArray(log) ? log : [];
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (test(rows[i])) return rows[i];
  }
  return null;
}

function stufeStartMs(log, name, elapsedMs) {
  const rows = Array.isArray(log) ? log : [];
  const retry = letzte(rows, (row) => row?.event === "retry_model");
  const ok = letzte(rows, (row) => row?.event === "model_ok");
  if (name === "modell" && retry && (!ok || Number(retry.t || 0) >= Number(ok.t || 0))) {
    return Number(retry.t || 0);
  }
  const stage = letzte(rows, (row) => row?.event === "stage" && row?.stage === name);
  if (stage) return Number(stage.t || 0);
  if (name === "modell") {
    const start = letzte(rows, (row) => row?.event === "model_start");
    if (start) return Number(start.t || 0);
  }
  return Math.max(0, Number(elapsedMs || 0));
}

function schreibtSchon(log) {
  return Boolean(letzte(log, (row) => row?.event === "pulse" && row?.phase === "writing" && Number(row?.chars || 0) > 0));
}

export function assetEtaRemainingMs({
  kind = "linkedin",
  answers = {},
  stage = "lesen",
  runLog = [],
  elapsedMs = 0,
  stages = {},
  forecastMs = 0,
} = {}) {
  const typical = { ...assetEtaFallbackStages(kind, answers), ...(stages && typeof stages === "object" ? stages : {}) };
  const order = ASSET_ETA_STAGES.filter((name) => assetEtaStageApplies(kind, answers, name));
  const current = order.includes(stage) ? stage : order[0] || "lesen";
  const idx = Math.max(0, order.indexOf(current));
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  let rest = 0;
  for (let i = idx; i < order.length; i += 1) {
    const name = order[i];
    const typ = Math.max(1_000, Number(typical[name] || 0));
    if (i === idx) {
      const spent = Math.max(0, elapsed - stufeStartMs(runLog, name, elapsed));
      let left = typ - spent;
      if (name === "modell" && schreibtSchon(runLog)) left = Math.min(Math.max(left, 0), 20_000);
      if (spent > typ * 1.8) left = Math.min(Math.max(left, 0), 25_000);
      rest += Math.max(8_000, left);
    } else {
      rest += typ;
    }
  }
  const totalTyp = order.reduce((sum, name) => sum + Math.max(0, Number(typical[name] || 0)), 0);
  const ziel = Number(forecastMs) > 8_000 ? Number(forecastMs) : totalTyp;
  if (idx <= 1 && elapsed < 8_000 && ziel > elapsed) {
    rest = Math.max(rest, ziel - elapsed);
  }
  return Math.max(5_000, Math.round(rest));
}

export function assetEtaLabel(ms) {
  const sek = Math.max(0, Number(ms) || 0) / 1000;
  if (sek < 45) return "Verbleibt unter 1 Minute";
  const min = Math.max(1, Math.round(sek / 60));
  if (min === 1) return "Verbleibt 1 Minute";
  return `Verbleiben ${min} Minuten`;
}

export function assetEtaProgressPct(elapsedMs, restMs) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const rest = Math.max(0, Number(restMs) || 0);
  const total = elapsed + rest;
  if (total <= 0) return 4;
  return Math.round(Math.min(99, Math.max(4, (elapsed / total) * 100)));
}

export function assetEtaStagesFromLog(log) {
  const start = Array.isArray(log) ? log.find((row) => row?.event === "start") : null;
  const stages = start && start.stages && typeof start.stages === "object" ? start.stages : {};
  const out = {};
  for (const [key, value] of Object.entries(stages)) {
    const ms = Number(value);
    if (Number.isFinite(ms) && ms >= 500) out[key] = Math.round(ms);
  }
  return out;
}
