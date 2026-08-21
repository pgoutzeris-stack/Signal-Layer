import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  LINKEDIN_LIMITS, belegProfil, ersteZeile, feldHinweise, guideMarkup, slideEmpfehlung,
} from "../linkedin-guides.mjs";

const studio = readFileSync(new URL("../asset-studio.js", import.meta.url), "utf8");
const manuell = readFileSync(new URL("../manual-signal.js", import.meta.url), "utf8");
const guides = readFileSync(new URL("../linkedin-guides.mjs", import.meta.url), "utf8");

const ton = (hinweise, i = 0) => hinweise[i]?.ton;
const text = (hinweise, i = 0) => hinweise[i]?.text || "";

test("die Grenzen sind die von LinkedIn, nicht geraten", () => {
  assert.equal(LINKEDIN_LIMITS.hookMobil, 140);
  assert.equal(LINKEDIN_LIMITS.captionHart, 3_000);
  assert.equal(LINKEDIN_LIMITS.captionStarkVon, 1_300);
  assert.equal(LINKEDIN_LIMITS.captionStarkBis, 2_500);
  assert.equal(LINKEDIN_LIMITS.slidesVon, 6);
  assert.equal(LINKEDIN_LIMITS.slidesBis, 12);
  // Die Quellen stehen im Kopf der Datei, damit niemand die Zahlen still ändert.
  assert.match(guides, /Quellen: authoredup\.com/);
  assert.match(guides, /oktopost\.com/);
});

test("der Hook wird an der Feed-Kante gemessen, nicht am ganzen Text", () => {
  assert.equal(ersteZeile("Kurzer Hook.\n\nDann der Rest."), "Kurzer Hook.");
  assert.equal(ersteZeile("Ohne Umbruch"), "Ohne Umbruch");

  const kurz = feldHinweise("caption_text", "41 Prozent Eigenmarken.\n\nDer Rest folgt. Und wie geht ihr damit um?");
  assert.equal(ton(kurz), "ok");
  assert.match(text(kurz), /23 von 140 Zeichen/);

  const lang = feldHinweise("caption_text", "x".repeat(200));
  assert.equal(ton(lang), "warn");
  assert.match(text(lang), /abgeschnitten/);
  // Ohne Umbruch nach dem Hook zeigt der Feed die erste Zeile mitten im Satz.
  assert.ok(lang.some((h) => /Zeilenumbruch/.test(h.text)));
});

test("beim Dokumentbeitrag gilt eine andere Textlänge als beim Einzelbild", () => {
  const carousel = feldHinweise("caption_text", "Hook.\n\n" + "y".repeat(1_000), { carousel: true });
  assert.ok(carousel.some((h) => /von 900 Zeichen/.test(h.text) && h.ton === "warn"));
  const einzel = feldHinweise("caption_text", "Hook.\n\n" + "y".repeat(1_500), { carousel: false });
  assert.ok(einzel.some((h) => /stärkster Bereich 1\.300–2\.500/.test(h.text) && h.ton === "ok"));
});

test("der Aufruf kennt die Endfolie und die Spur", () => {
  const passt = feldHinweise("cta_text", "Sortimentscheck vereinbaren");
  assert.equal(ton(passt), "ok");
  assert.match(text(passt), /von 42 Zeichen/);
  const zuLang = feldHinweise("cta_text", "Vereinbare jetzt einen ausführlichen Sortimentscheck mit uns");
  assert.equal(ton(zuLang), "warn");
  // In der Ansprache ist die Frage die bessere Form.
  const sales = feldHinweise("cta_text", "Sollen wir das gemeinsam durchgehen?", { lane: "sales" });
  assert.ok(sales.some((h) => h.ton === "ok" && /Frage/.test(h.text)));
});

test("der Beleg sagt, welche Folienarten dadurch möglich werden", () => {
  const profil = belegProfil('41 Prozent, 2024 waren es 34 Prozent, 68 Prozent nennen den Preis. „Wir haben die Lücke selbst gefüllt", sagt der Einkauf.');
  assert.ok(profil.zahlen >= 3);
  assert.ok(profil.prozente >= 3);
  assert.equal(profil.zitate, 1);
  assert.deepEqual(profil.moeglich, ["Große Kennzahl", "Mehrere Kennzahlen", "Diagramme", "Zitat"]);

  const ohne = feldHinweise("evidence", "Der Handel baut Eigenmarken aus.");
  assert.equal(ton(ohne), "warn");
  assert.match(text(ohne), /Keine Zahl erkannt/);
});

test("Titelsatz und Kernaussage werden an der Folie gemessen", () => {
  const einSatz = feldHinweise("headline", "Handel baut Eigenmarken schneller aus als geplant");
  assert.equal(ton(einSatz), "ok");
  assert.ok(einSatz.some((h) => /Ein Satz/.test(h.text)));
  const zwei = feldHinweise("headline", "Der Handel baut aus. Die Marken verlieren.");
  assert.ok(zwei.some((h) => h.ton === "warn"));

  const aussage = feldHinweise("storyline_text", "Eigenmarken wachsen, weil Marken die Lücke offen lassen.", { carousel: true });
  assert.equal(ton(aussage), "ok");
  assert.ok(aussage.some((h) => /6–12 Folien/.test(h.text)));
});

test("die Folienzahl wird begründet, nicht nur gezählt", () => {
  assert.equal(slideEmpfehlung(9).ton, "ok");
  assert.equal(slideEmpfehlung(4).ton, "info");
  assert.equal(slideEmpfehlung(16).ton, "warn");
  assert.match(slideEmpfehlung(16).text, /6–12/);
  assert.equal(slideEmpfehlung(0), null);
});

test("beide Fragebogen zeigen die Hilfe unter dem Feld und rechnen beim Tippen mit", () => {
  // Asset-Studio
  assert.match(studio, /import \{ feldHinweise, guideMarkup, slideEmpfehlung \}/);
  assert.match(studio, /function schreibhilfeHtml\(key\)/);
  assert.match(studio, /function aktualisiereSchreibhilfe\(key\)/);
  assert.match(studio, /\+ schreibhilfeHtml\(q\.free\.key\)/);
  assert.match(studio, /aktualisiereSchreibhilfe\(free\.getAttribute\("data-free"\)\)/);
  // Manuelles Signal
  assert.match(manuell, /import \{ feldHinweise, guideMarkup \}/);
  assert.match(manuell, /function schreibhilfe\(key\)/);
  assert.match(manuell, /data-guide="\$\{esc\(q\.key\)\}"/);
  assert.match(manuell, /hilfe\.innerHTML = schreibhilfe\(key\)/);
  // Das CSS liegt im geteilten Stil, damit beide gleich aussehen.
  assert.match(studio, /#as-overlay \.lg-guide\{/);
  assert.match(studio, /\.lg-guide-row--warn\{color:var\(--danger/);
});

test("die Auszeichnung trägt Ton und Zeichen, ohne HTML durchzulassen", () => {
  const markup = guideMarkup([{ ton: "warn", text: "<script>böse</script>" }], (v) => String(v).replace(/</g, "&lt;"));
  assert.match(markup, /lg-guide-row--warn/);
  assert.match(markup, /fa-triangle-exclamation/);
  assert.doesNotMatch(markup, /<script>/);
  assert.equal(guideMarkup([]), "");
});
