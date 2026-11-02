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
  assert.match(html, /<svg viewBox="0 0 10 10"><path d="M0 0L10 10" stroke="#fff"><\/svg>/);
  // Ohne Wurzel .li wird eingefasst, damit Groesse und Export greifen.
  assert.match(backend.bereinigeKiLayout("<p>{{title}}</p>"), /^<div class="li li-ki"/);
});

test("KI-Visual: Prompt traegt Inhalt, Platzhalter und Titelfolie fuer Folgefolien", () => {
  const prompt = backend.buildKiVisualPrompt({
    slide: { title: "Marke schlägt Preis", subtitle: "Drei Gründe", bullets: ["Eins", "Zwei"] },
    rolle: "content", nummer: 2, gesamt: 8, mitPortraet: true, mitLogo: false,
    titelLayout: '<div class="li">TITEL</div>', vorbildText: "", vorbildImpressions: 229881,
  });
  assert.match(prompt, /229\.881/);
  assert.match(prompt, /title: Marke schlägt Preis/);
  assert.match(prompt, /bullets \(2\): Eins \| Zwei/);
  assert.match(prompt, /\{\{portraet\}\}/);
  assert.match(prompt, /<div class="li">TITEL<\/div>/);
  assert.match(prompt, /Folie 2 von 8/);
});

test("Privatprofil: keine Vorlage, Visual Folie fuer Folie", async () => {
  const [edge, studio] = await Promise.all([
    readFile(new URL("../supabase/functions/signal-layer/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../asset-studio.js", import.meta.url), "utf8"),
  ]);
  assert.match(edge, /case "ki_visual_slide"/);
  assert.match(edge, /kiAsset\.created_by !== auth\.userId/);
  assert.match(edge, /id: "mein-stil", name: "Mein Stil", theme: "light"/);
  assert.match(studio, /when: \(answers\) => answers\.profile !== "private" \}/);
  assert.match(studio, /api\("ki_visual_slide", \{ asset_id: state\.assetId, index: i \}\)/);
  assert.match(studio, /slide\.variant === "KI" && slide\.ki_layout/);
});

test("Fragebogen: Stil-Wahl im Privatprofil steuert Tonfall und Visual", async () => {
  const studio = await readFile(new URL("../asset-studio.js", import.meta.url), "utf8");
  assert.match(studio, /key: "stil", label: "Stil", options: \[\["mein_stil", "Mein Stil"\], \["ki", "KI"\]\], when: \(answers\) => answers\.profile === "private"/);
  // Mein Stil: Caption-Frage entfaellt, Tonfall ist gesetzt, Visual laeuft danach.
  assert.match(studio, /when: \(answers\) => !\(answers\.profile === "private" && answers\.stil === "mein_stil"\)/);
  assert.match(studio, /answers\.stil === "mein_stil"\) state\.answers\.caption = "ai_tone"/);
  assert.match(studio, /state\.answers\.stil === "mein_stil" && state\.kiVisual\) void baueKiVisuals\(\)/);
  // Privatprofil ohne alte Vorlage wird nicht mehr blockiert.
  assert.ok(!studio.includes('state.answers.profile === "private" && state.designsGeladen && !state.designs.length'));
});
