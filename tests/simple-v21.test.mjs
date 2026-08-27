import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const pipeline = await import("../supabase/functions/signal-layer/pipeline-simple.ts");

test("the canonical ROOTS match runs as a separate v2.7 ruleset", () => {
  assert.equal(pipeline.SIMPLE_VERSION, "2.7");
  assert.equal(pipeline.SIMPLE_PIPELINE_VERSION, "roots-simple-v2.7");
});

test("canonicalizes safe model variants to exact ROOTS database labels", () => {
  const portfolio = [
    "- presence_customer_insights | [presence] Customer Insights: ROOTS verdichtet Kundenerkenntnisse.",
    "- purpose_handelsmarkenstrategie | [purpose] Handelsmarkenstrategie: ROOTS schärft Eigenmarken.",
  ].join("\n");
  assert.equal(pipeline.validatedRootsOffering("Customer Insights", portfolio), "Customer Insights");
  assert.equal(pipeline.validatedRootsOffering("[presence] Customer Insights", portfolio), "Customer Insights");
  assert.equal(pipeline.validatedRootsOffering("presence: Customer Insights", portfolio), "Customer Insights");
  assert.equal(pipeline.validatedRootsOffering("presence_customer_insights", portfolio), "Customer Insights");
  assert.equal(
    pipeline.validatedRootsOffering("[presence] Customer Insights + purpose: Handelsmarkenstrategie", portfolio),
    "Customer Insights + Handelsmarkenstrategie",
  );
  assert.equal(pipeline.validatedRootsOffering("Erfundene Leistung", portfolio), "");
});

test("the one AI prompt separates offering name, pillar and ROOTS method", () => {
  const family = pipeline.SIMPLE_FAMILIES.filter((item) => item.id === "customer_insights");
  const prompt = pipeline.buildSimplePrompt({
    id: "prompt",
    title: "Studie zeigt neue Bedürfnisse im Handel",
    cleaned_content: "Eine umfangreiche Studie untersucht neue Bedürfnisse und Barrieren von Kundinnen und Kunden im Handel. ".repeat(5),
  }, family, "- presence_customer_insights | [presence] Customer Insights: ROOTS verdichtet qualitative und quantitative Kundenerkenntnisse.");
  assert.match(prompt, /NAME="Customer Insights"/);
  assert.match(prompt, /SAEULE="presence"/);
  assert.match(prompt, /ROOTS_VORGEHEN="ROOTS verdichtet qualitative und quantitative Kundenerkenntnisse\./);
  assert.match(prompt, /Kopiere fuer roots_offering ausschliesslich den exakten Text aus NAME/);
});

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

test("an explicit CMO change survives a missing model company field", () => {
  const article = {
    id: "cmo",
    title: "Christian Wiegand wird Marketing-Chef von Xpeng | W&V",
    cleaned_content: [
      "Christian Wiegand wird Marketing-Chef von Xpeng.",
      "Der neue Marketingleiter soll die Marke in Deutschland bekannt machen und die Produkte positionieren.",
      "Er verantwortet Partnerschaften, Events und Kommunikation.",
      "Damit beginnt eine neue Phase der Markenführung.",
      "Der Hersteller baut sein Vertriebsnetz aus und will mit klarerer Markenkommunikation weitere Kundengruppen erreichen.",
    ].join("\n\n"),
  };
  const prefilter = pipeline.prefilterSimpleArticle(article);
  const fallback = pipeline.deterministicLeadershipFallback(article, prefilter.families);
  assert.equal(fallback?.familyId, "cmo_wechsel");
  assert.equal(fallback?.company, "Xpeng");
  assert.match(fallback?.companyEvidence || "", /Marketing-Chef von Xpeng/);
});

test("an explicit CMO change also replaces an invalid model company citation", async () => {
  const article = {
    id: "cmo-invalid-evidence",
    title: "Christian Wiegand wird Marketing-Chef von Xpeng | W&V",
    cleaned_content: [
      "Christian Wiegand wird Marketing-Chef von Xpeng.",
      "Der neue Marketingleiter soll die Marke in Deutschland bekannt machen und die Produkte positionieren.",
      "Er verantwortet Partnerschaften, Events und Kommunikation.",
      "Damit beginnt eine neue Phase der Markenführung.",
      "Der Hersteller baut sein Vertriebsnetz aus und will weitere Kundengruppen erreichen.",
    ].join("\n\n"),
  };
  const modelAnswer = {
    lane: "sales", signal_id: "cmo_wechsel", confidence: 0.92, score: 75,
    evidence: "Christian Wiegand wird Marketing-Chef von Xpeng | W&V",
    headline_de: "Xpeng ernennt neuen Marketing-Chef", why_de: "Der Führungswechsel schafft einen konkreten Timing-Anlass.",
    trigger_de: "Xpeng besetzt seine Marketingleitung neu. Die neue Verantwortung schafft einen konkreten Zeitpunkt für die Priorisierung der Markenagenda.",
    company: "Xpeng", company_evidence: "Dieser erfundene Satz steht nicht im Artikel.", tier1_companies: [],
    has_unrelated_tail: false, editorial_end_quote: "", summary_de: "Xpeng ordnet seine Marketingleitung neu.",
    article_type: "news", language: "de", roots_offering: "[people] Die ersten 100 Tage als CMO",
    roots_link_de: "Xpeng hat seine Marketingverantwortung neu besetzt und muss die Markenagenda priorisieren. ROOTS strukturiert mit Die ersten 100 Tage als CMO Stakeholder, Prioritäten und die Agenda für die Startphase.",
    person_name: "Christian Wiegand", person_role: "Marketing-Chef", buying_center_roles: ["Marketing-Chef"],
    relevance: { a: 70, b: 80, c: 35, d: 90, reason: "Der belegte Führungswechsel ist ein aktueller Gesprächsanlass." },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(modelAnswer) } }],
    usage: { prompt_tokens: 1200, completion_tokens: 400, total_tokens: 1600 },
  }), { status: 200, headers: { "content-type": "application/json" } });
  const fakeAdmin = {
    schema: () => ({
      from: () => ({
        insert: async () => ({ error: null }),
        update: () => ({ eq: async () => ({ error: null }) }),
      }),
    }),
  };
  try {
    const result = await pipeline.classifySimpleArticle({
      admin: fakeAdmin,
      apiKey: "test-key",
      model: "deepseek-v4-pro",
      rootsPortfolio: "- people_erste_100_tage_cmo | [people] Die ersten 100 Tage als CMO: ROOTS strukturiert Standortbestimmung, Stakeholder, Prioritäten und die Agenda für die ersten 100 Tage.",
      tier1Companies: [],
    }, article);
    assert.equal(result.status, "signal");
    assert.equal(result.lane, "sales");
    assert.equal(result.company, "Xpeng");
    assert.equal(result.roots_offering, "Die ersten 100 Tage als CMO");
    assert.match(result.roots_link_de || "", /Xpeng/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a CTO change is rescued only with a concrete marketing or customer mandate", () => {
  const relevant = {
    id: "cto-relevant",
    title: "Galeria holt Chief Transformation Officer – digitale Strategie bleibt offen",
    cleaned_content: [
      "Galeria holt einen Chief Transformation Officer und richtet die Verantwortung neu aus.",
      "Das Unternehmen muss Omnichannel, E-Commerce, Datenstrategie und das Sortiment neu priorisieren.",
      "Die neue Rolle führt das Transformationsprogramm.",
      "Der Warenhauskonzern arbeitet dafür an einem neuen Handelsmodell.",
    ].join("\n\n"),
  };
  const relevantPrefilter = pipeline.prefilterSimpleArticle(relevant);
  const relevantFallback = pipeline.deterministicLeadershipFallback(relevant, relevantPrefilter.families);
  assert.equal(relevantFallback?.familyId, "strategiewechsel");
  assert.equal(relevantFallback?.company, "Galeria");

  const appointmentOnly = {
    id: "cto-only",
    title: "Softwareanbieter ernennt Chief Transformation Officer",
    cleaned_content: `${"Der Softwareanbieter ernennt einen Chief Transformation Officer. ".repeat(6)}Die neue Führungskraft tritt im September an.`,
  };
  const appointmentPrefilter = pipeline.prefilterSimpleArticle(appointmentOnly);
  assert.equal(pipeline.deterministicLeadershipFallback(appointmentOnly, appointmentPrefilter.families), null);
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

test("DeepSeek empty content is truncated reasoning, not a silent model", () => {
  const empty = pipeline.parseDeepseekSimpleCompletion({
    choices: [{ finish_reason: "length", message: { content: "", reasoning_content: "langes Denken" } }],
    usage: { prompt_tokens: 4800, completion_tokens: 4500, total_tokens: 9300, completion_tokens_details: { reasoning_tokens: 4500 } },
  });
  assert.equal(empty.text, "");
  assert.equal(empty.usage.thinking, 4500);
  assert.equal(empty.usage.output, 0);
  assert.match(pipeline.deepseekEmptyAnswerMessage(empty, 4500) || "", /abgeschnitten/);

  const ok = pipeline.parseDeepseekSimpleCompletion({
    choices: [{ finish_reason: "stop", message: { content: "{\"is_signal\":true}" } }],
    usage: { prompt_tokens: 4800, completion_tokens: 4000, total_tokens: 8800, completion_tokens_details: { reasoning_tokens: 3500 } },
  });
  assert.equal(ok.text, "{\"is_signal\":true}");
  assert.equal(pipeline.deepseekEmptyAnswerMessage(ok, 32768), null);
  assert.equal(pipeline.SIMPLE_DEEPSEEK_MAX_TOKENS, 32768);
  assert.equal(pipeline.SIMPLE_DEEPSEEK_REPAIR_MAX_TOKENS, 65536);
  assert.ok(pipeline.SIMPLE_DEEPSEEK_MAX_TOKENS > 7727 * 4);
  const source = readFileSync(new URL("../supabase/functions/signal-layer/pipeline-simple.ts", import.meta.url), "utf8");
  assert.match(source, /reasoning_effort: "low"/);
  assert.match(source, /thinking: \{ type: "enabled" \}/);
  assert.match(source, /max_tokens: maxTokens/);
});

test("a simple retry run accepts only stored article UUIDs", () => {
  const ids = pipeline.requestedSimpleArticleIds([
    "069A2F9E-DB91-4EAC-80A0-7D22E12DE3F9",
    "069a2f9e-db91-4eac-80a0-7d22e12de3f9",
    "not-an-id",
    12,
    null,
  ]);
  assert.deepEqual(ids, ["069a2f9e-db91-4eac-80a0-7d22e12de3f9"]);
  assert.deepEqual(pipeline.requestedSimpleArticleIds(undefined), []);
  assert.equal(pipeline.requestedSimpleArticleIds([
    "069a2f9e-db91-4eac-80a0-7d22e12de3f9",
    "08ca97dc-9c9d-4d96-8be7-00487dd04c07",
  ], 1).length, 1);
});

test("all six-pillar services remain dynamically reachable", () => {
  const marketing = pipeline.SIMPLE_FAMILIES.filter((family) => family.id === "marketing_strategie");
  const portfolio = [
    "- planning_marketingstrategie | [planning] Marketingstrategie: ROOTS übersetzt Ziele in einen Marketingrahmen.",
    "- people_marketing_academy | [people] Marketing Academy Entwicklung: ROOTS entwickelt Curriculum, Kompetenzmodell und Lernpfade.",
    "- performance_kpi_dashboards_reportings | [performance] KPI-Dashboards & Reportings: ROOTS entwickelt Dashboards und Reports.",
  ].join("\n");
  const selected = pipeline.selectRootsPortfolio(
    portfolio,
    marketing,
    "Das Unternehmen baut eine Marketing Academy mit Curriculum, Kompetenzmodell und Lernpfaden auf.",
  );
  assert.match(selected, /Marketing Academy Entwicklung/);
});

function familyIds(article) {
  const padded = {
    ...article,
    cleaned_content: `${article.cleaned_content} Der redaktionelle Kern beschreibt den Anlass ausführlich genug für eine belastbare Prüfung.`,
  };
  return pipeline.prefilterSimpleArticle(padded).families.map((family) => family.id);
}

test("v2.7 prefilter recovers the missed ROOTS occasions", () => {
  assert.ok(familyIds({
    id: "d2p",
    title: "Cloudbasiertes Farbmanagement für den Verpackungsdruck",
    cleaned_content: "Siegwerk und X-Rite führen Colorwerk FastMatch Cloud ein. Die Lösung vereint Farbformulierung, Farbkorrektur und Qualitätskontrolle über mehrere Druckmaschinen, Standorte und den gesamten Artwork-Prozess.",
  }).includes("design_to_print"));

  assert.ok(familyIds({
    id: "paper",
    title: "Material als Markenbotschafter: Papierverpackungen schaffen Vertrauen",
    cleaned_content: "Papierbasierte Verpackungen stehen bei Verbrauchern für Recyclingfähigkeit. Das kann für Marken zum strategischen Vorteil werden, erklärt Alexander Rauer von Koehler Paper.",
  }).includes("marken_strategie"));

  assert.ok(familyIds({
    id: "w2p",
    title: "From prototype to production: how web-to-print solutions are reshaping packaging design",
    cleaned_content: "Web-to-print is a new way to move packaging from an approved idea into production without the manual middle. The workflow standardises artwork across sites.",
  }).includes("design_to_print"));

  assert.ok(familyIds({
    id: "pl",
    title: "Fleischersatz: Livekindly will Private-Label-Produzenten übernehmen",
    cleaned_content: "Livekindly Collective setzt die Einkaufstour fort und will Dalco Food schlucken, einen Fleischersatz-Hersteller aus den Niederlanden, der bislang vorrangig für Handelsmarken und Private Label produziert.",
  }).includes("eigenmarken_launch"));

  assert.ok(familyIds({
    id: "cmo",
    title: "Von Manchester United zur Sporthilfe: Tanja Hettel übernimmt Marketingressort",
    cleaned_content: "Tanja Hettel wird neue Marketingvorständin der Deutschen Sporthilfe. Sie übernimmt das Marketingressort und verantwortet Marke, Vertrieb und Events.",
  }).includes("cmo_wechsel"));

  assert.ok(familyIds({
    id: "galeria",
    title: "Warenhauskonzern: Galeria schafft Transformation Office für Neuausrichtung",
    cleaned_content: "Galeria bündelt die Neuausrichtung in einem Transformation Office. Der Warenhauskonzern soll Sortiment, Fläche und das Handelsmodell neu ordnen.",
  }).includes("strategiewechsel"));

  assert.ok(familyIds({
    id: "penny",
    title: "Filialnetze: Mehr Platz für die Discounter-Sortimente",
    cleaned_content: "Penny räumt das Filialnetz auf. Die Discounter schaffen mehr Fläche für die Sortimente und ziehen schwache Standorte zusammen.",
  }).includes("strategiewechsel"));

  assert.ok(familyIds({
    id: "brand",
    title: "Wie KI die Funktion der Marke verändert",
    cleaned_content: "Marke ist keine reine Positionierungsfrage mehr. Sie wird zur Infrastruktur. Generative KI definiert die wichtigste Disziplin des Marketings neu.",
  }).includes("marken_strategie"));

  assert.ok(familyIds({
    id: "consistency",
    title: "Wissenschaft trifft Praxis: Markenkonsistenz immer gültiges Markengesetz?",
    cleaned_content: "Prof. Baumgarth berichtet über Markenführung und Markenkonsistenz. Die Studie zeigt, wann Konsistenz den Markenwert stärkt.",
  }).includes("marken_strategie"));

  assert.ok(familyIds({
    id: "kiads",
    title: "Kennzeichnungspflicht: So stehen die Deutschen zu KI-generierten Werbebotschaften",
    cleaned_content: "Eine neue Studie zeigt, warum transparente Kennzeichnung entscheidend für die Akzeptanz von KI-Inhalten in der Werbung ist.",
  }).includes("customer_insights"));

  assert.ok(familyIds({
    id: "yougov",
    title: "Yougov Consumer-Index: Der Fußball half, zumindest ein bisschen",
    cleaned_content: "Der deutsche Lebensmittelhandel rettete sich in ein bescheidenes Plus. Monatsgewinner waren die Drogeriemärkte.",
  }).includes("customer_insights"));

  assert.ok(familyIds({
    id: "events",
    title: "3 Praxisbeispiele: Wie Influencer-Events zum Relevanzmodell für Marken werden",
    cleaned_content: "Daniel Ackermann erklärt, warum Followerzahlen im Influencer-Marketing an Grenzen stoßen und Events zum Relevanzmodell für Marken werden.",
  }).includes("marketing_strategie"));
});

test("v2.7 cuts LZ and New Business paywalls before the prefilter", () => {
  const lede = "Livekindly Collective will Dalco Food schlucken, einen Hersteller für Handelsmarken und Private Label.";
  const body = `${lede}\n\nSie haben Fragen oder Anmerkungen zu diesem Artikel?\n${"Kontaktieren Sie die Redaktion wegen Nutzungsrechten. ".repeat(6)}`;
  const editorial = pipeline.deterministicEditorialCore(body);
  assert.equal(editorial.trimmed, true);
  assert.equal(editorial.text, lede);
});

test("an unproven model tail no longer discards the article", () => {
  const core = "Pernod Ricard setzt bei Beefeater auf eine neue globale Leadagentur für die alkoholfreie Kampagne.";
  const resolved = pipeline.resolveEditorialCoreForClassification(
    `${core}\n\nSeit über 50 Jahren liefert new business Nachrichten für Entscheider in Agenturen.`,
    true,
    "dieser satz steht so nicht im artikel und ist auch viel zu frei erfunden",
    pipeline.deterministicEditorialCore(`${core}\n\nSeit über 50 Jahren liefert new business Nachrichten für Entscheider in Agenturen.`),
  );
  assert.equal(resolved.boundaryValid, true);
  assert.match(resolved.text, /Beefeater/);
});

test("the v2.7 prompt names the recovered ROOTS occasions and offerings", () => {
  const source = readFileSync(new URL("../supabase/functions/signal-layer/pipeline-simple.ts", import.meta.url), "utf8");
  assert.match(source, /<recognition_rules>/);
  assert.match(source, /Marketingressort/);
  assert.match(source, /Web-to-Print/);
  assert.match(source, /Handelsmarkenstrategie/);
  assert.match(source, /Customer Insights/);
  assert.match(source, /unbelegter Fremdblock verwirft das Signal nicht mehr|Ein unbelegtes Modell-Endzitat darf den Artikel nicht verwerfen/);
});

test("Design to Print steht genau einmal in den Themen", () => {
  const labels = pipeline.SIMPLE_FAMILIES.map((family) => family.label);
  const doppelt = labels.filter((label, index) => labels.indexOf(label) !== index);
  assert.deepEqual(doppelt, [], `doppelte Themen: ${doppelt.join(", ")}`);
  assert.equal(labels.filter((label) => label === "Design to Print").length, 1);
});

test("die Marketing-Bahn deckt KI und Marketing-Technologie ab", () => {
  const familie = pipeline.SIMPLE_FAMILIES.find((entry) => entry.id === "ki_marketing");
  assert.ok(familie, "ki_marketing fehlt");
  assert.equal(familie.lane, "marketing");
  // Anbieter- und Boersenmeldungen sind kein uebertragbares Prozesswissen.
  assert.ok(familie.excludeTitle.test("borsengang der ki firma"));
  assert.ok(familie.trigger.test("marketing automation"));
  assert.ok(familie.trigger.test("kunstliche intelligenz"));
  // Ohne Marketingbezug und ohne Erkenntnis kein Treffer.
  assert.ok(!familie.context.test("neues rechenzentrum eroffnet"));
  assert.ok(familie.context.test("studie zeigt: marketing teams steigern effizienz um 30 prozent"));
});
