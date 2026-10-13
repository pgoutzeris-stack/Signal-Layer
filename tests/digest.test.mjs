import test from "node:test";
import assert from "node:assert/strict";

const { baueDigest } = await import("../supabase/functions/signal-layer/digest.ts");

test("Wochenmail: Betreff, Abschnitte, Escaping", () => {
  const signal = (lane, score, headline) => ({
    lane, score, headline_de: headline, signal_label: "Markenstrategie", why_de: "Weil.", company: "Galeria",
    roots_offering: "Markenstrategie", tier1_companies: [], tier2_companies: ["Galeria"], article_id: "a", quelle: "LZ", datum: "2026-10-12T08:00:00Z",
  });
  const { betreff, html } = baueDigest([signal("sales", 80, "A <b>"), signal("marketing", 70, "B")], "12.10.2026 bis 13.10.2026", true);
  assert.equal(betreff, "[Test] Signal Layer: 2 neue Signale (12.10.2026 bis 13.10.2026)");
  assert.match(html, /Sales · 1/);
  assert.match(html, /Marketing · 1/);
  assert.match(html, /A &lt;b&gt;/);
  assert.doesNotMatch(html, /border-left/);
});
