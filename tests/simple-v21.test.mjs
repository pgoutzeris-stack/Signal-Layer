import assert from "node:assert/strict";
import test from "node:test";

const pipeline = await import("../supabase/functions/signal-layer/pipeline-simple.ts");

test("v2.1 keeps a complete CMO-change article and removes a known paywall tail", () => {
  const core = [
    "Christian Wiegand wird Marketing-Chef von Xpeng.",
    "Der frühere Audi- und Nio-Marketingchef soll die Automarke in Deutschland bekannt machen und ihre Produkte positionieren.",
    "Wiegand übernimmt die Marketingleitung und verantwortet Partnerschaften, Events und Kommunikation.",
    "Damit beginnt für Xpeng eine neue Phase der Markenführung und Marktbearbeitung in Deutschland.",
  ].join("\n\n");
  const body = `${core}\n\n## Du willst weiterlesen?\n${"Abo-Vorteile und weitere Empfehlungen. ".repeat(8)}`;
  const editorial = pipeline.deterministicEditorialCore(body);
  assert.equal(editorial.trimmed, true);
  assert.equal(editorial.text, core);
  const result = pipeline.prefilterSimpleArticle({ id: "x", title: "Christian Wiegand wird Marketing-Chef von Xpeng", cleaned_content: editorial.text });
  assert.ok(result.families.some((family) => family.id === "cmo_wechsel"));
});

test("transformation leadership needs a strategic ROOTS-relevant mandate", () => {
  const relevant = `${"Galeria ernennt einen Chief Transformation Officer. ".repeat(5)}Das Warenhaus richtet sein Omnichannel-, Kunden- und Handelsmodell neu aus und bündelt dafür die Transformation.`;
  const accepted = pipeline.prefilterSimpleArticle({ id: "g", title: "Galeria ernennt Chief Transformation Officer", cleaned_content: relevant });
  assert.ok(accepted.families.some((family) => family.id === "strategiewechsel"));

  const unrelated = `${"Ein Softwareanbieter ernennt einen Chief Transformation Officer. ".repeat(7)}Die Personalie tritt im September an.`;
  const rejected = pipeline.prefilterSimpleArticle({ id: "s", title: "Softwareanbieter ernennt Chief Transformation Officer", cleaned_content: unrelated });
  assert.ok(!rejected.families.some((family) => family.id === "strategiewechsel"));
});

test("the prompt receives descriptions only for family-relevant ROOTS services", () => {
  const cmo = pipeline.SIMPLE_FAMILIES.filter((family) => family.id === "cmo_wechsel");
  const portfolio = [
    "- people_erste_100_tage_cmo | [people] Die ersten 100 Tage als CMO: ROOTS priorisiert die Agenda.",
    "- planning_marketing_audit | [planning] Marketing Audit: ROOTS analysiert Strategie und Wirkung.",
    "- productivity_design_to_print_artwork | [productivity] D2P & Artwork Management: ROOTS optimiert die Packaging Graphic Chain.",
  ].join("\n");
  const selected = pipeline.selectRootsPortfolio(portfolio, cmo);
  assert.match(selected, /Die ersten 100 Tage als CMO: ROOTS priorisiert/);
  assert.match(selected, /Marketing Audit: ROOTS analysiert/);
  assert.doesNotMatch(selected, /D2P & Artwork Management/);
});
