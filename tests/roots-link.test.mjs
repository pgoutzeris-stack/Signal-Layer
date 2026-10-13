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

test("Tier 2: Treffer in Unternehmen, Titel und Kern, nur_firma nur im Unternehmen", () => {
  const liste = [
    { name: "Galeria", aliases: [], nur_firma: false },
    { name: "Roller", aliases: [], nur_firma: true },
    { name: "s.Oliver Group", aliases: ["s.Oliver"], nur_firma: false },
  ];
  assert.deepEqual(simple.tier2Treffer("", "Galeria prüft Filialen, der Roller steht", liste), ["Galeria"]);
  assert.deepEqual(simple.tier2Treffer("Roller GmbH", "", liste), ["Roller"]);
  assert.deepEqual(simple.tier2Treffer("", "s.Oliver wächst", liste), ["s.Oliver Group"]);
  assert.deepEqual(simple.tier2Treffer("", "Galerias", liste), []);
});
