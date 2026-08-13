import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../.github/workflows/guard-login.yml", import.meta.url), "utf8");
const edge = readFileSync(new URL("../supabase/functions/signal-layer/index.ts", import.meta.url), "utf8");

test("der Waechter fasst nach, bevor er pausiert", () => {
  assert.match(workflow, /zweimal\(\) \{/);
  // Alle drei Pruefungen gehen durch das Nachfassen, nicht nur die Anmeldung.
  for (const dienst of ["login", "recruiting", "profiles"]) {
    assert.match(workflow, new RegExp(`${dienst}=\\$\\(zweimal ${dienst}`), `${dienst} ohne Nachfassen`);
  }
  // Die Pause vor dem zweiten Versuch wurde nach echten Messwerten von 3 auf
  // 20 Sekunden erhoeht: nach mehr als zwei Stunden ohne Lauf war die Datenbank
  // nach 3 s noch nicht warm. Der Test prueft deshalb nur, dass eine Pause von
  // mindestens einigen Sekunden steht, nicht den exakten Wert.
  const pause = Number(workflow.match(/^\s*sleep (\d+)\s*$/m)?.[1] || 0);
  assert.ok(pause >= 5, `Pause vor dem zweiten Versuch zu kurz: ${pause}s`);
});

test("die Messwerte beider Versuche gehen an die Edge Function", () => {
  assert.match(workflow, /retried=\$nachgefasst/);
  assert.match(workflow, /_first_ms=/);
  assert.match(workflow, /PROBE: \$\{\{ toJSON\(steps\.probe\.outputs\) \}\}/);
});

test("die Edge Function schreibt Messwerte und Vorfaelle getrennt", () => {
  assert.match(edge, /shared"\)\.from\("ops_probes"\)/);
  assert.match(edge, /shared"\)\.from\("ops_incidents"\)/);
  assert.match(edge, /login_first_ms: probeZahl/);
  // Ein Vorfall entsteht nur beim Wechsel, sonst waechst die Tabelle ohne
  // Verfallsdatum im Fuenfminutentakt.
  assert.match(edge, /if \(!input\.enabled && input\.warVorherFrei\)/);
  // Das Protokoll darf den Waechter nie blockieren.
  assert.match(edge, /catch \(error\) \{\s*console\.warn\(`ops_guard: Protokoll fehlgeschlagen/);
});
