import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  DEEPSEEK_PEAK_WINDOWS_UTC, SIMPLE_MODEL_CATALOG, deepseekTarifLage, isDeepseekPeak, simpleModelRates,
} from "../supabase/functions/signal-layer/pipeline-simple.ts";

const edge = readFileSync(new URL("../supabase/functions/signal-layer/index.ts", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const simpleMode = readFileSync(new URL("../simple-mode.js", import.meta.url), "utf8");

const utc = (iso) => new Date(iso);

test("die Tarifzeiten stimmen mit der Anbieterpreisliste überein", () => {
  // Geprüft am 23.08.2026: Spitzenzeit 01:00–04:00 und 06:00–10:00 UTC,
  // Spitzentarif genau doppelt. V4 Pro: 0,66/1,98 USD gegen 1,32/3,96 USD.
  assert.deepEqual(DEEPSEEK_PEAK_WINDOWS_UTC, [[1, 4], [6, 10]]);
  const pro = SIMPLE_MODEL_CATALOG.find((m) => m.id === "deepseek-v4-pro");
  assert.equal(pro.off_peak.input_usd, 0.66);
  assert.equal(pro.off_peak.output_usd, 1.98);
  assert.equal(pro.peak.input_usd, 1.32);
  assert.equal(pro.peak.output_usd, 3.96);
  assert.equal(pro.peak.output_usd / pro.off_peak.output_usd, 2);

  assert.equal(isDeepseekPeak(utc("2026-08-24T02:10:00Z")), true);
  assert.equal(isDeepseekPeak(utc("2026-08-24T09:59:00Z")), true);
  assert.equal(isDeepseekPeak(utc("2026-08-24T10:00:00Z")), false);
  assert.equal(isDeepseekPeak(utc("2026-08-23T18:40:00Z")), false);
  assert.equal(simpleModelRates("deepseek-v4-pro", utc("2026-08-24T02:00:00Z")).output_usd, 3.96);
  assert.equal(simpleModelRates("deepseek-v4-pro", utc("2026-08-24T12:00:00Z")).output_usd, 1.98);
  // Gemini kennt keine Tageszeit.
  assert.equal(simpleModelRates("gemini-2.5-flash", utc("2026-08-24T02:00:00Z")).output_usd, 2.5);
});

test("die Tariflage nennt den nächsten Wechsel", () => {
  const imPeak = deepseekTarifLage("deepseek-v4-pro", utc("2026-08-24T09:45:00Z"));
  assert.equal(imPeak.variabel, true);
  assert.equal(imPeak.peak, true);
  assert.equal(imPeak.faktor, 2);
  assert.equal(imPeak.wechsel_iso, "2026-08-24T10:00:00.000Z");

  const daneben = deepseekTarifLage("deepseek-v4-pro", utc("2026-08-23T18:40:00Z"));
  assert.equal(daneben.peak, false);
  assert.equal(daneben.wechsel_iso, "2026-08-24T01:00:00.000Z");

  // Ein Modell ohne Tageszeittarif darf keine Tarifmeldung auslösen.
  const gemini = deepseekTarifLage("gemini-2.5-flash", utc("2026-08-24T02:00:00Z"));
  assert.equal(gemini.variabel, false);
});

test("Status liefert Tarif und Planung, der Wächter startet den fälligen Lauf", () => {
  assert.match(edge, /pricing: deepseekTarifLage\(/);
  assert.match(edge, /schedule: geplanterLauf \|\| null/);
  assert.match(edge, /case "schedule_simple_run": \{/);
  assert.match(edge, /case "cancel_simple_run_schedule": \{/);
  // Planen braucht dieselbe Freigabe wie ein Lauf.
  assert.match(edge, /"schedule_simple_run",\n  "cancel_simple_run_schedule",/);
  // Planen und Absagen gehen auch vom Betrieb aus, wie das Starten selbst.
  assert.match(edge, /\["start_simple_run", "process_simple_run", "schedule_simple_run", "cancel_simple_run_schedule"\]/);
  // Der Wächter startet nur, wenn nichts läuft: zwei Läufe zahlen doppelt.
  const waechter = edge.slice(edge.indexOf('case "resume_stalled_crawls"'), edge.indexOf('case "get_simple_article_detail"'));
  assert.match(waechter, /from\("simple_run_schedule"\)[\s\S]*eq\("status", "queued"\)/);
  assert.match(waechter, /if \(!laufend\) \{/);
  assert.match(waechter, /status: "started"/);
  // Ohne feste Liste wird erst beim Start ausgewählt.
  assert.match(waechter, /if \(!geplant\.length\) \{/);
  assert.match(waechter, /neq\("article_type", "manual"\)/);
});

test("die Meldung nennt Tarif, Faktor und den Startknopf", () => {
  assert.match(appJs, /function renderSimplePricingNote\(\)/);
  assert.match(appJs, /Spitzentarif aktiv · \$\{preis\.faktor\}-facher Preis je Token/);
  assert.match(appJs, /Lauf um \$\{wechsel\} Uhr starten/);
  assert.match(appJs, /Nebentarif aktiv/);
  assert.match(appJs, /Lauf geplant für \$\{berlinZeit\(simpleSchedule\.planned_for\)\} Uhr/);
  // Während ein Lauf läuft, gibt es keinen Planungsknopf.
  assert.match(appJs, /laeuft \|\| !wechsel \? "" :/);
  assert.match(appJs, /callApi\("schedule_simple_run", \{ planned_for: wechsel/);
  assert.match(appJs, /callApi\("cancel_simple_run_schedule"\)/);
  // Der Status reicht Tarif und Planung an die Anzeige weiter.
  assert.match(simpleMode, /pricing: status\.pricing \|\| null, schedule: status\.schedule \|\| null/);
});
