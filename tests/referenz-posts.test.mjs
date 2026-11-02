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
