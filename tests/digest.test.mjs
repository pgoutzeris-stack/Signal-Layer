import test from "node:test";
import assert from "node:assert/strict";

const { baueDigest } = await import("../supabase/functions/signal-layer/digest.ts");

test("Wochenmail: Betreff, Abschnitte, Escaping", () => {
  const signal = (lane, score, headline) => ({
    lane, score, headline_de: headline, signal_label: "Markenstrategie", why_de: "Weil.", company: "Galeria",
    roots_offering: "Markenstrategie", tier1_companies: [], tier2_companies: ["Galeria"], article_id: "a", quelle: "LZ", datum: "2026-10-12T08:00:00Z",
  });
  const { betreff, html } = baueDigest([signal("sales", 80, "A <b>"), signal("marketing", 70, "B")], "12.10.2026 bis 13.10.2026", true);
  assert.equal(betreff, "[Test] 2 neue Signale verfügbar · ROOTS Signal Layer");
  assert.match(html, /Sales · LZ/);
  assert.match(html, />Markenstrategie<\/span>/);
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
