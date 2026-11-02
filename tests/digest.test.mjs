import test from "node:test";
import assert from "node:assert/strict";

import { readFile } from "node:fs/promises";
const { baueDigest } = await import("../supabase/functions/signal-layer/digest.ts");

test("Wochenmail: Betreff, Abschnitte, Escaping", () => {
  const signal = (lane, score, headline) => ({
    lane, score, headline_de: headline, signal_label: "Markenstrategie", why_de: "Weil.", company: "Galeria",
    roots_offering: "Markenstrategie", tier1_companies: [], tier2_companies: ["Galeria"], article_id: "a", quelle: "LZ", datum: "2026-10-12T08:00:00Z",
  });
  const { betreff, html } = baueDigest([signal("sales", 80, "A <b>"), signal("marketing", 70, "B")], "12.10.2026 bis 13.10.2026", true);
  assert.equal(betreff, "[Test] 2 Signale · ROOTS Signal Layer");
  assert.doesNotMatch(betreff, /neue Signale verfügbar/);
  assert.match(html, />Sales<\/td>/);
  assert.match(html, />Marketing<\/td>/);
  assert.ok(html.indexOf(">Marketing<") < html.indexOf(">Sales<"));
  assert.match(html, />2 NEU</);
  assert.match(html, /Galeria · Markenstrategie · LZ/);
  assert.doesNotMatch(html, /Weil\./);
  assert.match(html, /A &lt;b&gt;/);
  assert.doesNotMatch(html, /border-left/);
});

test("Mail verlinkt ins Signal-Popup, App oeffnet ?signal=", async () => {
  const { readFileSync } = await import("node:fs");
  const id = "11111111-2222-3333-4444-555555555555";
  const { html } = baueDigest([{ lane: "sales", score: 1, headline_de: "X", signal_label: "", why_de: "", company: "", roots_offering: "", tier1_companies: [], tier2_companies: [], article_id: id, quelle: "", datum: null, url: "https://extern.example/artikel" }], "z", false);
  assert.match(html, new RegExp(`Signal-Layer/\\?signal=${id}`));
  assert.doesNotMatch(html, /extern\.example/);
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /oeffneSignalAusLink\(\);/);
});

test("Briefing-Mail hat nur noch einen Knopf", async () => {
  const quelle = await readFile(new URL("../supabase/functions/signal-layer/digest.ts", import.meta.url), "utf8");
  assert.ok(!quelle.includes("weitere`"), "der Knopf mit der Restzahl ist weg");
  assert.match(quelle, /knopf\("Signal Layer öffnen"/);
});

test("Briefing nur Montag und Mittwoch, seit dem letzten Briefing", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261102100000_briefing_mo_mi.sql", import.meta.url), "utf8");
  assert.match(sql, /isodow from ortszeit\) not in \(1, 3\)/);
  assert.match(sql, /'\*\/10 2-9 \* \* 1,3'/);
  assert.match(sql, /'\*\/20 8-10 \* \* 1,3'/);
  assert.match(sql, /'seit', to_char\(letztes_briefing/);
  const edge = await readFile(new URL("../supabase/functions/signal-layer/index.ts", import.meta.url), "utf8");
  assert.match(edge, /Date\.parse\(String\(body\.seit \|\| ""\)\)/);
});
