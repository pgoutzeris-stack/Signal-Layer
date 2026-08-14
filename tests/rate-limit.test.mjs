import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const edge = readFileSync(new URL("../supabase/functions/signal-layer/index.ts", import.meta.url), "utf8");

test("gebremst wird nur, wer am Auth-Gate scheitert", () => {
  // Gezaehlt wird ausschliesslich ueber unauthorizedResponse. Taucht im
  // Auth-Gate wieder ein direktes errorResponse(..., 401) auf, faellt dieser
  // Weg still aus der Zaehlung heraus.
  const gateStart = edge.indexOf("let auth: { userId: string } | null = null;");
  const gateEnd = edge.indexOf("try {\n    switch (action) {", gateStart);
  assert.ok(gateStart > 0 && gateEnd > gateStart, "Auth-Gate nicht gefunden");
  const gate = edge.slice(gateStart, gateEnd);
  assert.ok(!gate.includes('errorResponse(origin, "Unauthorized", 401)'), "401 im Gate ohne Zaehlung");
  assert.ok(gate.includes("unauthorizedResponse(req, origin)"), "Gate zaehlt keine Abweisung");
});

test("die Sperre wird vor jeder Auth- und Datenbankabfrage geprueft", () => {
  // Der Sinn der Bremse ist, genau diese Abfragen einzusparen. Steht die
  // Pruefung zu spaet, kostet jede Anfrage weiter volle Arbeit.
  const check = edge.indexOf("if (isRejectBlocked(req)) return rejectBlockedResponse(origin);");
  const parse = edge.indexOf("body = await req.json();");
  assert.ok(check > 0, "Sperrpruefung fehlt");
  assert.ok(check < parse, "Sperrpruefung steht hinter dem Auswerten des Rumpfs");
});

test("Preflight bleibt von der Sperre unberuehrt", () => {
  const options = edge.indexOf('if (req.method === "OPTIONS")');
  const check = edge.indexOf("if (isRejectBlocked(req)) return rejectBlockedResponse(origin);");
  assert.ok(options > 0 && options < check, "CORS-Preflight laeuft durch die Sperre");
});

test("ohne Absenderkennung wird nicht gebremst", () => {
  // Fail-open ist Absicht: lieber eine fremde Anfrage zu viel durchlassen als
  // eine echte abweisen.
  assert.match(edge, /function rejectKey\(req: Request\): string \| null \{[\s\S]*?return ip \|\| null;/);
  assert.match(edge, /const key = rejectKey\(req\);\n  if \(!key\) return false;/);
  assert.match(edge, /const key = rejectKey\(req\);\n  if \(!key\) return;/);
});

test("der Zaehler bleibt im Speicher und ist gedeckelt", () => {
  // Ein Schreibvorgang pro abgewiesener Anfrage waere genau die Last, die die
  // Bremse verhindern soll - der Zaehler darf deshalb nie in die Datenbank.
  const start = edge.indexOf("const REJECT_WINDOW_MS");
  const end = edge.indexOf("function unauthorizedResponse");
  const block = edge.slice(start, end);
  assert.ok(start > 0 && end > start, "Bremsen-Block nicht gefunden");
  assert.ok(!/getAdminClient|\.from\(|\.rpc\(/.test(block), "Bremse greift auf die Datenbank zu");
  assert.match(block, /rejectCounters\.size >= REJECT_MAX_TRACKED/);
});

test("die Sperre laeuft von selbst ab und meldet das dem Aufrufer", () => {
  assert.match(edge, /entry\.blockedUntil = now \+ REJECT_BLOCK_MS;/);
  assert.match(edge, /"Retry-After": String\(Math\.ceil\(REJECT_BLOCK_MS \/ 1000\)\)/);
  assert.match(edge, /status: 429/);
});
