import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const backend = await import("../supabase/functions/signal-layer/asset-studio.ts");

test("die staerksten eigenen Posts schreiben beim Begleittext mit", () => {
  const answers = backend.normalizeAssetAnswers("linkedin", {
    profile: "private", caption: "ai_tone", tone_of_voice: "Sachlich.",
    tone_vorbilder: ["𝗪𝗮𝘀 𝗵𝗮𝗯𝗲𝗻 𝗥𝗲𝗮𝗹 𝗠𝗮𝗱𝗿𝗶𝗱 …", "95 % der GenAI-Investitionen verpuffen.", "Deutschland schlägt die Niederlande.", "vierter fliegt raus"],
  });
  assert.equal(answers.tone_vorbilder.length, 3, "hoechstens drei Vorbilder");
  const prompt = backend.buildAssetPrompt("linkedin", { headline_de: "Signal" }, { title: "Artikel", content: "Text." }, answers);
  assert.match(prompt, /<vorbilder>/);
  assert.match(prompt, /--- Vorbild 1 ---\n𝗪𝗮𝘀 𝗵𝗮𝗯𝗲𝗻 𝗥𝗲𝗮𝗹 𝗠𝗮𝗱𝗿𝗶𝗱/);
  // Inhalte und Zahlen der Vorbilder duerfen nicht in den neuen Post wandern.
  assert.match(prompt, /Thema, Zahlen, Namen und Formulierungen daraus nicht uebernehmen/);
  assert.doesNotMatch(prompt, /vierter fliegt raus/);
});

test("ohne Tone of Voice keine Vorbilder", () => {
  const answers = backend.normalizeAssetAnswers("linkedin", { caption: "ai", tone_vorbilder: ["Post"] });
  const prompt = backend.buildAssetPrompt("linkedin", { headline_de: "Signal" }, { title: "Artikel", content: "Text." }, answers);
  assert.doesNotMatch(prompt, /<vorbilder>/);
});

test("Server, Einstellungen und Fragebogen tragen die eigenen Posts", async () => {
  const [edge, app, studio, sql] = await Promise.all([
    readFile(new URL("../supabase/functions/signal-layer/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../asset-studio.js", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20261102210000_referenz_posts.sql", import.meta.url), "utf8"),
  ]);
  for (const aktion of ["list_referenz_posts", "save_referenz_post", "delete_referenz_post"]) {
    assert.match(edge, new RegExp(`case "${aktion}"`));
  }
  // Nur die eigenen Zeilen: jede Aenderung filtert auf auth.userId.
  assert.match(edge, /\.eq\("id", postId\)\.eq\("user_id", auth\.userId\)/);
  assert.match(edge, /linkedinAnswers\.tone_vorbilder = linkedinAnswers\.caption_mode === "ai_tone"/);
  assert.match(edge, /vorlage_empfehlung: vorlagenEmpfehlung\(posts, vorlagen\)/);
  assert.match(sql, /using \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.match(app, /callApi\("list_referenz_posts"\)/);
  assert.match(studio, /state\.vorlageEmpfehlung = res\?\.vorlage_empfehlung/);
  assert.match(studio, /liste\.find\(\(d\) => d\.id === state\.vorlageEmpfehlung\?\.id\)/);
});

test("KI-Visual: Bereinigung laesst nur Folien-HTML durch", () => {
  const roh = '```html\n<div class="li" style="width:1080px;background:url(https://evil.example/x.png);color:#fff" onclick="alert(1)"><script>alert(1)</script><h1 data-field="title" style="font-size:90px">{{title}}</h1><a href="https://x.example">Link</a><img src="https://x.example/a.png"><img src="{{portraet}}"><!--repeat:bullets--><div data-field="item">{{item}}</div><!--/repeat--><!-- geheim --><svg viewBox="0 0 10 10"><path d="M0 0L10 10" stroke="#fff"/></svg><iframe src="x"></iframe></div>\n```';
  const html = backend.bereinigeKiLayout(roh);
  assert.ok(!/script|onclick|iframe|evil\.example|x\.example|geheim|<a\b/i.test(html), html);
  assert.match(html, /^<div class="li li-ki" style="width:1080px;color:#fff">/);
  assert.match(html, /<h1 data-field="title" style="font-size:90px">\{\{title\}\}<\/h1>/);
  assert.match(html, /<img src="\{\{portraet\}\}">/);
  assert.match(html, /<!--repeat:bullets-->.*<!--\/repeat-->/);
  // SVG-Formen mit Selbstschluss, sonst verschachtelt der Browser sie.
  assert.match(html, /<svg viewBox="0 0 10 10"><path d="M0 0L10 10" stroke="#fff" \/><\/svg>/);
  assert.match(backend.bereinigeKiLayout('<div class="li"><svg><circle r="4"></circle><rect width="2"></rect></svg></div>'), /<circle r="4" \/><rect width="2" \/>/);
  // Ohne Wurzel .li wird eingefasst, damit Groesse und Export greifen.
  assert.match(backend.bereinigeKiLayout("<p>{{title}}</p>"), /^<div class="li li-ki"/);
});

test("KI-Visual: Prompt mit mehreren Vorbildern, Begleittext und Titelfolie", () => {
  const prompt = backend.buildKiVisualPrompt({
    slide: { title: "Spontankäufe sind nie spontan", subtitle: "43 Kontakte bei Spontankäufen, 19 bei Bedarfskäufen.", bullets: ["Eins", "Zwei"] },
    rolle: "content", nummer: 2, gesamt: 8, mitPortraet: true, mitLogo: false,
    titelLayout: '<div class="li">TITEL</div>', vorbildImpressions: [229881, 1237, 1064], postText: "Begleittext mit 43.",
    typ: "zahlenvergleich", typTreffer: true,
  });
  assert.match(prompt, /Bild 1: 229\.881 Impressions, Bild 2: 1\.237 Impressions, Bild 3: 1\.064 Impressions/);
  assert.match(prompt, /Inhaltstyp dieser Folie: Zahlenvergleich/);
  assert.match(prompt, /Bild 1 ist deine Vorlage/);
  assert.match(prompt, /keine leeren Ersatzformen/);
  assert.match(prompt, /Begleittext des Posts/);
  assert.match(prompt, /\{\{portraet\}\}/);
  assert.match(prompt, /<div class="li">TITEL<\/div>/);
});

test("KI-Visual: Zahlen im Visual muessen im Inhalt stehen", () => {
  const beleg = backend.kiBelegText({ subtitle: "43 Kontakte bei Spontankäufen, 19 bei Bedarfskäufen, 22,5 % mehr." }, "Begleittext.");
  assert.deepEqual(backend.kiFremdeZahlen('<div class="li"><b data-field="wert_links">43</b><b>19</b><span>22,5 %</span><p style="font-size:90px">{{title}}</p></div>', beleg), []);
  assert.deepEqual(backend.kiFremdeZahlen('<div class="li"><b>43</b><b>87</b></div>', beleg), ["87"]);
});

test("Privatprofil: keine Vorlage, Visual Folie fuer Folie", async () => {
  const [edge, studio] = await Promise.all([
    readFile(new URL("../supabase/functions/signal-layer/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../asset-studio.js", import.meta.url), "utf8"),
  ]);
  assert.match(edge, /case "ki_visual_slide"/);
  assert.match(edge, /!isScheduled && kiAsset\.created_by !== auth\?\.userId/);
  assert.match(edge, /id: "mein-stil", name: "Mein Stil", theme: "light"/);
  assert.match(studio, /when: \(answers\) => answers\.profile !== "private" \}/);
  assert.match(studio, /api\("ki_visual_slide", \{ asset_id: state\.assetId, index: i \}\)/);
  assert.match(studio, /slide\.variant === "KI" && slide\.ki_layout/);
});

test("Privatprofil: keine Tool-Layouts, Vorschau zeigt das Vorbild", async () => {
  const [studio, edge, html] = await Promise.all([
    readFile(new URL("../asset-studio.js", import.meta.url), "utf8"),
    readFile(new URL("../supabase/functions/signal-layer/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
  ]);
  assert.match(studio, /const PRIVAT_OHNE = new Set\(\["design", "variant_mode", "variant", "slide_mix", "slide_cover", "slide_content", "slide_end", "caption"\]\)/);
  assert.match(studio, /state\.answers\.profile === "private" \|\| \(!state\.rootsAssets && !state\.assetId\)\) \? kiWarteHtml\(\)/);
  assert.ok(!/key: "stil"/.test(studio), "keine Stil-Frage mehr");
  assert.match(edge, /vorbild_visual: posts\.length \? await gespeichertesVorbild\(auth\.userId\) : ""/);
  // Scrollbalken: Chrome soll die feste, filigrane Leiste nehmen.
  assert.match(html, /@supports not selector\(::-webkit-scrollbar\) \{\s*\.track-findings-list/);
});

test("KI-Visual: nur Zahlenvergleich oder Duell-Buehne", () => {
  const typ = backend.kiInhaltsTyp;
  assert.equal(typ({ title: "Spontankäufe sind nie spontan", subtitle: "43 Kontakte bei Spontankäufen, bei Bedarfskäufen nur 19." }), "zahlenvergleich");
  assert.equal(typ({ title: "Deutschland schlägt die Niederlande" }), "duell");
  assert.equal(typ({ title: "Drei Gründe", bullets: ["a", "b", "c"] }), "duell");
  assert.equal(typ({ title: "Spontankäufe haben eine lange Vorgeschichte", stat: { value: "43" } }), "duell");
  assert.equal(backend.kiInhaltsTypFein({ title: "Drei Gründe", bullets: ["a", "b", "c"] }), "infografik");
});

test("KI-Visual: dicke Deko-Linien werden halbtransparent", () => {
  const html = backend.bereinigeKiLayout('<div class="li"><svg><circle r="400" stroke="#fff" stroke-width="150" fill="none"></circle><path d="M0 0" stroke-width="3"></path></svg></div>');
  assert.match(html, /<circle r="400" stroke="#fff" stroke-width="150" fill="none" stroke-opacity="0\.14" \/>/);
  assert.match(html, /<path d="M0 0" stroke-width="3" \/>/);
});

test("KI-Visual: Hauptstil und ausgeschlossene Posts", async () => {
  const edge = await readFile(new URL("../supabase/functions/signal-layer/index.ts", import.meta.url), "utf8");
  assert.match(edge, /\.eq\("kein_vorbild", false\)/);
  assert.match(edge, /\(p\.stil_typ === typ \? 2 : 0\) \+ \(p\.hauptstil \? 1 : 0\)/);
});

test("Feste Vorlagen: Vergleich und Buehne, Texte maskiert", () => {
  const v = backend.fuelleKiVorlage("zahlenvergleich", { kicker: "Customer Insights", links_kopf: "Spontankauf", links_wert: "43", links_einheit: "Kontakte", rechts_kopf: "Bedarfskauf", rechts_wert: "19", rechts_einheit: "Kontakte" });
  assert.match(v, /li-ki-vergleich/);
  assert.match(v, /data-field="links_wert"[^>]*color:#1e8a3c">43</);
  assert.match(v, /data-field="rechts_wert"[^>]*color:#d6202a">19</);
  const b = backend.fuelleKiVorlage("duell", { kicker: "Marke", zwei_seiten: false, links_wort: "<b>Vertrauen</b>", links_label: "Spontankauf", links_akzent: "Winner" });
  assert.match(b, /li-ki-buehne/);
  assert.match(b, /&lt;b&gt;Vertrauen&lt;\/b&gt;/);
  assert.ok(!/data-field="rechts_wort"/.test(b), "eine Seite ohne zweites Emblem");
  assert.match(backend.fuelleKiVorlage("duell", { zwei_seiten: true, links_wort: "A", rechts_wort: "B" }), /data-field="rechts_wort"/);
  assert.match(backend.kiVorlagenPrompt("duell", { title: "X" }, ""), /"zwei_seiten":false/);
});
