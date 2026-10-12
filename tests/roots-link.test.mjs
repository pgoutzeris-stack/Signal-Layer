import test from "node:test";
import assert from "node:assert/strict";

const simple = await import("../supabase/functions/signal-layer/pipeline-simple.ts");

test("Andocktext: gute Texte bleiben, Floskeln fliegen raus", () => {
  // Frueher verworfen: ein Satz, kein Firmenname. Jetzt behalten.
  assert.ok(simple.isUsableRootsLink("Die Studie zeigt, wie stark Influencer die Kaufentscheidung junger Zielgruppen praegen."));
  assert.ok(!simple.isUsableRootsLink("ROOTS kann mit Markenstrategie andocken und den Kunden begleiten."));
  assert.ok(!simple.isUsableRootsLink("zu kurz"));
  const prompt = simple.rootsLinkPrompt({ lane: "sales", company: "Mondelez", headline: "h", summary: "s", evidence: "e", why: "w", offering: "Die ersten 100 Tage als CMO" });
  assert.match(prompt, /Mondelez/);
  assert.match(prompt, /Die ersten 100 Tage als CMO/);
});
