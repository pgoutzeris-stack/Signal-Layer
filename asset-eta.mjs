// Restzeit für die Ladeanzeige: laufendes Tempo (Zeichen je Zeit) plus
// gelernte Denk-/Schreibgrößen. Zwischen Impulsen zählt die Uhr weiter.

export const ASSET_ETA_STAGES = ["lesen", "recherchieren", "modell", "pruefen", "bilder", "fuellen"];

const PACE_FALLBACK = {
  memo: {
    think: { ms: 115_000, p75_ms: 145_000, chars: 32_000, p75_chars: 40_000 },
    write: { ms: 22_000, p75_ms: 35_000, chars: 5_400, p75_chars: 6_200 },
  },
  linkedin: {
    think: { ms: 55_000, p75_ms: 80_000, chars: 12_000, p75_chars: 20_000 },
    write: { ms: 18_000, p75_ms: 28_000, chars: 2_800, p75_chars: 4_000 },
  },
};

export function assetEtaFallbackStages(kind, answers = {}) {
  const memo = kind === "memo";
  const carousel = answers.asset_type === "carousel";
  const slides = Number(answers.slides || 4);
  const modell = memo ? 170_000 : carousel ? (slides >= 6 ? 115_000 : 95_000) : 70_000;
  const stages = { lesen: 2_000, modell, pruefen: 2_500, fuellen: 2_500 };
  if (memo) {
    const eigen = String(answers.benchmarks_mode || answers.benchmarks || "") === "custom";
    stages.recherchieren = eigen ? 4_000 : 8_000;
  }
  if (memo && answers.images !== "upload") stages.bilder = 45_000;
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

function nimm(raw, key, fallback) {
  const n = Number(raw?.[key]);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

export function assetEtaPaceFromLog(log, kind = "linkedin") {
  const start = Array.isArray(log) ? log.find((row) => row?.event === "start") : null;
  const fb = kind === "memo" ? PACE_FALLBACK.memo : PACE_FALLBACK.linkedin;
  const thinkRaw = start && start.think && typeof start.think === "object" ? start.think : {};
  const writeRaw = start && start.write && typeof start.write === "object" ? start.write : {};
  const thinkChars = nimm(thinkRaw, "chars", fb.think.chars);
  const writeChars = nimm(writeRaw, "chars", fb.write.chars);
  return {
    think: {
      ms: nimm(thinkRaw, "ms", fb.think.ms),
      p75_ms: Math.max(nimm(thinkRaw, "p75_ms", fb.think.p75_ms), nimm(thinkRaw, "ms", fb.think.ms)),
      chars: thinkChars,
      p75_chars: Math.max(nimm(thinkRaw, "p75_chars", fb.think.p75_chars), thinkChars),
    },
    write: {
      ms: nimm(writeRaw, "ms", fb.write.ms),
      p75_ms: Math.max(nimm(writeRaw, "p75_ms", fb.write.p75_ms), nimm(writeRaw, "ms", fb.write.ms)),
      chars: writeChars,
      p75_chars: Math.max(nimm(writeRaw, "p75_chars", fb.write.p75_chars), writeChars),
    },
  };
}

function restNachImpuls(restAmImpuls, impulsT, elapsedMs) {
  return Math.max(0, restAmImpuls - Math.max(0, elapsedMs - impulsT));
}

function zielZeichen(current, typical, p75) {
  if (current < typical) return typical;
  return Math.max(typical, p75);
}

function modellRest({ runLog, elapsed, typicalModell, later, pace }) {
  const pulse = letzte(
    runLog,
    (row) => row?.event === "pulse" && (row.phase === "thinking" || row.phase === "writing"),
  );
  const start = stufeStartMs(runLog, "modell", elapsed);
  const spent = Math.max(0, elapsed - start);
  const { think, write } = pace;

  if (pulse && pulse.phase === "writing" && Number(pulse.chars || 0) > 0) {
    const chars = Number(pulse.chars || 0);
    const pulseT = Number(pulse.t || elapsed);
    const since = Number(pulse.since ?? pulse.t ?? start);
    const phaseSpent = Math.max(1, pulseT - since);
    const liveRate = phaseSpent >= 800 ? chars / phaseSpent : 0;
    const typicalRate = write.chars / Math.max(1, write.ms);
    const rate = liveRate > 0 ? liveRate : typicalRate;
    const target = zielZeichen(chars, write.chars, write.p75_chars);
    const remChars = Math.max(0, target - chars);
    const remAmImpuls = rate > 0 ? remChars / rate : Math.max(0, write.ms - phaseSpent);
    return restNachImpuls(remAmImpuls, pulseT, elapsed) + later;
  }

  if (pulse && pulse.phase === "thinking") {
    const chars = Number(pulse.thinking_chars || 0);
    const pulseT = Number(pulse.t || elapsed);
    const since = Number(pulse.since ?? start);
    const phaseSpent = Math.max(1, pulseT - since);
    const hasRate = chars >= 80 && phaseSpent >= 800;
    let remAmImpuls = 0;
    if (hasRate) {
      const rate = chars / phaseSpent;
      const target = zielZeichen(chars, think.chars, think.p75_chars);
      const remChars = Math.max(0, target - chars);
      remAmImpuls = remChars > 0 ? remChars / rate : Math.max(0, think.p75_ms - phaseSpent);
    } else {
      const targetMs = phaseSpent < think.ms ? think.ms : think.p75_ms;
      remAmImpuls = Math.max(0, targetMs - phaseSpent);
    }
    return restNachImpuls(remAmImpuls, pulseT, elapsed) + write.ms + later;
  }

  return Math.max(0, typicalModell - spent) + later;
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
  const pace = assetEtaPaceFromLog(runLog, kind);
  const pulse = letzte(
    runLog,
    (row) => row?.event === "pulse" && (row.phase === "thinking" || row.phase === "writing"),
  );

  let rest = 0;
  for (let i = idx; i < order.length; i += 1) {
    const name = order[i];
    const typ = Math.max(1_000, Number(typical[name] || 0));
    if (i !== idx) {
      rest += typ;
      continue;
    }
    if (name === "modell") {
      const later = order.slice(i + 1).reduce((sum, key) => sum + Math.max(0, Number(typical[key] || 0)), 0);
      rest += modellRest({ runLog, elapsed, typicalModell: typ, later, pace });
      break;
    }
    const spent = Math.max(0, elapsed - stufeStartMs(runLog, name, elapsed));
    rest += Math.max(0, typ - spent);
  }

  const totalTyp = order.reduce((sum, name) => sum + Math.max(0, Number(typical[name] || 0)), 0);
  const ziel = Number(forecastMs) > 8_000 ? Number(forecastMs) : totalTyp;
  if (!pulse && ziel > elapsed) rest = Math.max(rest, ziel - elapsed);
  return Math.max(0, Math.round(rest));
}

export function assetEtaLabel(ms) {
  const sek = Math.max(0, Number(ms) || 0) / 1000;
  if (sek < 45) return "Verbleibend unter 1 Minute";
  const min = Math.max(1, Math.round(sek / 60));
  if (min === 1) return "Verbleibend 1 Minute";
  return `Verbleibend ${min} Minuten`;
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
