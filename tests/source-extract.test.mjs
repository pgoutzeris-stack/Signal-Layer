import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  MANUAL_DRAFT_FIELDS, erkennePlattform, manualCheckPrompt, manualDraftPrompt, normalizeManualCheck,
  normalizeManualDraft, pruefeOeffentlicheUrl, seitenText, transkriptQuelle, untertitelSpur,
  untertitelText, youtubeId, ziehteQuelle,
} from "../supabase/functions/signal-layer/source-extract.ts";

const frontend = readFileSync(new URL("../manual-signal.js", import.meta.url), "utf8");
const edge = readFileSync(new URL("../supabase/functions/signal-layer/index.ts", import.meta.url), "utf8");

test("nur öffentliche Adressen, keine internen Netze", () => {
  assert.equal(pruefeOeffentlicheUrl("https://www.youtube.com/watch?v=abc").ok, true);
  assert.equal(pruefeOeffentlicheUrl("packaging-journal.de/artikel").ok, true, "ohne Schema ergänzt https");
  for (const boese of [
    "http://localhost:3000", "http://127.0.0.1/x", "http://10.0.0.5", "http://192.168.1.1",
    "http://172.16.0.9", "http://169.254.169.254/latest/meta-data", "file:///etc/passwd",
    "https://csmguwcvzreefluhahyu.supabase.co/rest/v1/x", "kein link",
  ]) {
    assert.equal(pruefeOeffentlicheUrl(boese).ok, false, `${boese} muss abgewiesen werden`);
  }
});

test("Plattform und Video-Kennung werden erkannt", () => {
  assert.equal(erkennePlattform("https://youtu.be/dQw4w9WgXcQ"), "youtube");
  assert.equal(erkennePlattform("https://www.linkedin.com/posts/x"), "linkedin");
  assert.equal(erkennePlattform("https://packaging-journal.de/x"), "packaging-journal.de");
  assert.equal(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://www.youtube.com/shorts/abc123XYZ"), "abc123XYZ");
});

test("Seitentext lässt Skripte und Navigation weg", () => {
  const { titel, text } = seitenText(`<html><head><title>Eigenmarken wachsen</title></head>
    <body><nav>Menü Start Kontakt</nav><script>var x = "böse";</script>
    <article><p>Der Anteil liegt bei 41 Prozent.</p><p>2024 waren es 34 Prozent.</p></article>
    <footer>Impressum</footer></body></html>`);
  assert.equal(titel, "Eigenmarken wachsen");
  assert.match(text, /41 Prozent/);
  assert.match(text, /34 Prozent/);
  assert.doesNotMatch(text, /böse|Menü|Impressum/);
});

test("Untertitel: deutsche und manuelle Spur zuerst, Text ohne Wiederholung", () => {
  const html = `x"captionTracks":[
    {"baseUrl":"https://y/api/timedtext?a=1\\u0026lang=en","languageCode":"en","kind":"asr"},
    {"baseUrl":"https://y/api/timedtext?a=2\\u0026lang=de","languageCode":"de"}
  ],y`;
  const spur = untertitelSpur(html);
  assert.equal(spur.sprache, "de");
  assert.equal(spur.automatisch, false);
  assert.match(spur.url, /lang=de&fmt=json3/);

  const text = untertitelText({ events: [
    { segs: [{ utf8: "Der Anteil liegt" }, { utf8: " bei 41 Prozent." }] },
    { segs: [{ utf8: "Der Anteil liegt bei 41 Prozent." }] },
    { segs: [{ utf8: "2024 waren es 34." }] },
  ] });
  assert.equal(text, "Der Anteil liegt bei 41 Prozent. 2024 waren es 34.");
  assert.equal(untertitelSpur("ohne spuren"), null);
});

test("Transkript vor Beschreibung, und ohne Untertitel eine klare Ansage", async () => {
  const html = `<title>Video</title>"captionTracks":[{"baseUrl":"https://y/t?x=1","languageCode":"de"}],`;
  const mitSpur = await ziehteQuelle("https://www.youtube.com/watch?v=abc", async (ziel) => (
    ziel.includes("/t?x=1")
      ? { ok: true, text: "", json: { events: [{ segs: [{ utf8: "Eigenmarken wachsen um 41 Prozent. " }] }, { segs: [{ utf8: "x".repeat(300) }] }] } }
      : { ok: true, text: html }
  ));
  assert.equal(mitSpur.ok, true);
  assert.equal(mitSpur.art, "transcript");
  assert.match(mitSpur.text, /41 Prozent/);

  const ohneSpur = await ziehteQuelle("https://www.youtube.com/watch?v=abc", async () => ({ ok: true, text: "<title>Video</title>" }));
  assert.equal(ohneSpur.ok, false);
  assert.match(ohneSpur.grund, /keine öffentlichen Untertitel/);
  assert.match(ohneSpur.grund, /Transkript einfügen/);

  const nurBeschreibung = await ziehteQuelle("https://www.youtube.com/watch?v=abc", async () => ({
    ok: true, text: `<title>V</title>"shortDescription":"${"Eigenmarken wachsen. ".repeat(12)}","`,
  }));
  assert.equal(nurBeschreibung.art, "description");
  assert.match(nurBeschreibung.grund, /Kein Transkript/);
});

test("dünne Seiten werden abgewiesen statt geraten", async () => {
  const duenn = await ziehteQuelle("https://beispiel.de/x", async () => ({ ok: true, text: "<html><body><p>Kurz.</p></body></html>" }));
  assert.equal(duenn.ok, false);
  assert.match(duenn.grund, /zu wenig Text/);

  const nichtErreichbar = await ziehteQuelle("https://beispiel.de/x", async () => ({ ok: false, text: "" }));
  assert.equal(nichtErreichbar.ok, false);
  assert.match(nichtErreichbar.grund, /nicht abrufbar/);

  const artikel = await ziehteQuelle("https://beispiel.de/x", async () => ({
    ok: true, text: `<article><p>${"Der Eigenmarkenanteil liegt bei 41 Prozent. ".repeat(20)}</p></article>`,
  }));
  assert.equal(artikel.ok, true);
  assert.equal(artikel.art, "article");
});

test("der Auftrag verbietet Erfindungen, die Antwort meldet Lücken", () => {
  const prompt = manualDraftPrompt({
    ok: true, art: "transcript", plattform: "youtube", titel: "Test", text: "41 Prozent",
    zeichen: 10, sprache: "de", grund: "",
  }, "sales");
  assert.match(prompt, /Nur was in der Quelle steht/);
  assert.match(prompt, /wortgleiche Ausschnitte/);
  assert.match(prompt, /Ein leeres Feld ist richtig, eine erfundene Angabe ist ein Fehler/);
  assert.match(prompt, /Spur Sales/);

  const entwurf = normalizeManualDraft({
    headline: "Handel baut Eigenmarken aus", core: "Zwei Sätze dazu.", evidence: "41 Prozent",
    company: "", missing: ["company", "erfunden"], verdict: "Tragfaehig", verdict_reason: "Zahl belegt.",
  });
  assert.equal(entwurf.verdict, "tragfaehig");
  assert.equal(entwurf.verdictReason, "Zahl belegt.");
  // Leere Felder gelten als fehlend, auch wenn das Modell sie nicht nennt.
  assert.ok(entwurf.missing.includes("company"));
  assert.ok(entwurf.missing.includes("source"));
  // Erfundene Feldnamen fliegen raus.
  assert.ok(!entwurf.missing.includes("erfunden"));
  assert.deepEqual(Object.keys(entwurf.felder).sort(), [...MANUAL_DRAFT_FIELDS].sort());

  // Ohne Urteil gilt der vorsichtige Fall.
  assert.equal(normalizeManualDraft({}).verdict, "duenn");
});

test("Server und Fragebogen sind verdrahtet", () => {
  assert.match(edge, /case "draft_manual_signal_from_url": \{/);
  assert.match(edge, /pruefeOeffentlicheUrl\(quelleUrl\)/);
  assert.match(edge, /await ziehteQuelle\(quelleUrl, quellenHoler\(\), artikelLeser\)/);
  assert.match(edge, /schema: MANUAL_DRAFT_SCHEMA/);
  assert.match(edge, /operation: "manual_signal_draft"/);
  // Ein Entwurf ist ein bezahlter Aufruf: im Spitzentarif nur mit Zustimmung.
  assert.match(edge, /blocked: "peak_tariff", pricing: tarif/);
  assert.match(edge, /"draft_manual_signal_from_url",/);

  assert.match(frontend, /key: "weg", label: "Weg"/);
  assert.match(frontend, /\["quelle", "Aus einer Adresse ziehen"\]/);
  assert.match(frontend, /key: "quelle_url", label: "Adresse"[\s\S]{0,120}?art: "quelle"/);
  assert.match(frontend, /async function zieheQuelle\(\)/);
  assert.match(frontend, /api\("draft_manual_signal_from_url"/);
  // Selbst getippte Felder überschreibt die Quelle nicht.
  assert.match(frontend, /if \(state\.beruehrt\.has\(key\)\) continue;/);
  // Lücken werden benannt, nicht verschwiegen.
  assert.match(frontend, /Bitte selbst ergänzen: \$\{befund\.missing\.map\(feldName\)\.join\(", "\)\}/);
  assert.match(frontend, /Signalqualität: \$\{befund\.verdict\}/);
  assert.match(frontend, /ms-tag-quelle/);
});

const quellenText = (text) => ({
  ok: true, art: "transcript", plattform: "youtube", titel: "Video", text,
  zeichen: text.length, sprache: "de", grund: "",
});

test("die Prüfung misst zwei Sorten Felder mit zwei Maßstäben", () => {
  const felder = { headline: "Handel baut aus", core: "Zwei Sätze.", evidence: "41 Prozent", company: "" };
  const mitQuelle = manualCheckPrompt(felder, quellenText("Der Anteil liegt bei 41 Prozent."), "sales", ["headline", "evidence"]);
  assert.match(mitQuelle, /headline \(aus der Quelle gezogen\)/);
  assert.match(mitQuelle, /core \(selbst geschrieben\)/);
  assert.match(mitQuelle, /muss in der Quelle stehen. Findest du eine Angabe dort nicht, ist das ein blocker/);
  assert.match(mitQuelle, /Platzhalter wie "diverse"/);
  assert.match(mitQuelle, /Spur Sales: ohne company/);
  assert.match(mitQuelle, /Der Anteil liegt bei 41 Prozent\./);
  assert.match(mitQuelle, /company \(selbst geschrieben\): \(leer\)/);
  // Ohne Quelle wird nicht behauptet, es sei gegen eine geprüft worden.
  const ohneQuelle = manualCheckPrompt(felder, null, "marketing", []);
  assert.match(ohneQuelle, /Keine Quelle vorhanden/);
  assert.match(ohneQuelle, /Spur Marketing: eine belegte Zahl/);
  assert.doesNotMatch(ohneQuelle, /41 Prozent\./);
});

test("ein Fund ohne Deckung sperrt, egal wie das Modell ihn nennt", () => {
  const streng = normalizeManualCheck({
    verdict: "tragfaehig", verdict_reason: "Sieht gut aus.",
    // Das Modell nennt es nur eine Warnung, die Angabe steht aber nicht in der Quelle.
    findings: [{ field: "evidence", severity: "warn", note: "Die 41 Prozent stehen nicht in der Quelle." }],
    unsupported: ["evidence", "erfunden"],
    missing: ["company"],
  });
  assert.equal(streng.blocker, true);
  assert.equal(streng.verdict, "untauglich");
  assert.equal(streng.ready, false);
  assert.deepEqual(streng.unsupported, ["evidence"]);
  assert.deepEqual(streng.missing, ["company"]);

  const sauber = normalizeManualCheck({
    verdict: "Tragfaehig", verdict_reason: "Zahl und Zitat belegt.",
    findings: [
      { field: "occasion", severity: "info", note: "Anlass fehlt, das Signal trägt auch ohne." },
      { field: "territory", severity: "warn", note: "" },
    ],
  });
  assert.equal(sauber.verdict, "tragfaehig");
  assert.equal(sauber.ready, true);
  // Ein Fund ohne Text ist kein Fund.
  assert.equal(sauber.findings.length, 1);
  assert.equal(sauber.findings[0].severity, "info");
  // Erfundene Feldnamen werden zu einem Fund über das ganze Signal, nicht zu einem Feld.
  const fremd = normalizeManualCheck({ findings: [{ field: "gibtsnicht", severity: "blocker", note: "x" }] });
  assert.equal(fremd.findings[0].field, "");
  assert.equal(fremd.blocker, true);
  assert.equal(normalizeManualCheck({}).verdict, "duenn");
});

test("die Prüfung hängt zwischen Fragebogen und Anlegen", () => {
  assert.match(edge, /case "check_manual_signal": \{/);
  assert.match(edge, /"check_manual_signal",/);
  // Mindestangaben kosten kein Modell.
  assert.match(edge, /const pruefIssue = manualSignalIssue\(pruefSignal\);/);
  // Geprüft wird gegen die Quelle, die der Server selbst holt.
  assert.match(edge, /pruefQuelle = await ziehteQuelle\(pruefUrl, quellenHoler\(\), artikelLeser\);/);
  assert.match(edge, /manualCheckPrompt\(pruefFelder, pruefQuelle, pruefLane, ausQuelle\)/);
  assert.match(edge, /schema: MANUAL_CHECK_SCHEMA/);
  assert.match(edge, /operation: "manual_signal_check"/);
  assert.match(edge, /source_checked: Boolean\(pruefQuelle\)/);

  // Fragebogen: Prüfung läuft am Ende von selbst an.
  assert.match(frontend, /if \(key === ENDE && !state\.pruefungFrisch && !state\.pruefungLaeuft\) void pruefeSignal\(\);/);
  assert.match(frontend, /api\("check_manual_signal", \{/);
  assert.match(frontend, /from_source: \[\.\.\.state\.ausQuelle\]/);
  // Jede Änderung an einer Antwort macht den Befund ungültig.
  assert.match(frontend, /function verwerfePruefung\(\)/);
  assert.ok(frontend.split("verwerfePruefung();").length - 1 >= 5, "jede Eingabeart verwirft den Befund");
  // Ein Fund sperrt die Übernahme, bis er behoben oder ausdrücklich freigegeben ist.
  assert.match(frontend, /if \(blockiertJetzt\(\) && !state\.freigabe\) \{/);
  assert.match(frontend, /data-act="freigeben"/);
  assert.match(frontend, /Auf eigene Verantwortung übernehmen/);
});

test("YouTube nennt seine Untertitel, gibt ihren Text aber nicht heraus", async () => {
  // Geprüft am 23.08.2026 an drei Videos: die Wiedergabeseite listet die Spuren,
  // der Abruf des Textes kommt mit 200 und null Bytes zurück. Das gehört so
  // gemeldet und nicht als Fehler des Werkzeugs.
  const html = `<title>Video</title>"captionTracks":[{"baseUrl":"https://y/t?x=1","languageCode":"de"}],`;
  const gesperrt = await ziehteQuelle("https://www.youtube.com/watch?v=abc", async (ziel) => (
    ziel.includes("/t?x=1") ? { ok: true, text: "" } : { ok: true, text: html }
  ));
  assert.equal(gesperrt.ok, false);
  assert.match(gesperrt.grund, /Dieses Video hat Untertitel \(de\)/);
  assert.match(gesperrt.grund, /nicht an Server heraus/);

  // Mit Beschreibung wird daraus ein dünner Entwurf, mit demselben Hinweis.
  const mitBeschreibung = await ziehteQuelle("https://www.youtube.com/watch?v=abc", async (ziel) => (
    ziel.includes("/t?x=1")
      ? { ok: true, text: "" }
      : { ok: true, text: `${html}"shortDescription":"${"Eigenmarken wachsen. ".repeat(12)}","` }
  ));
  assert.equal(mitBeschreibung.art, "description");
  assert.match(mitBeschreibung.grund, /nicht an Server heraus/);
});

test("ein eingefügtes Transkript ist eine Quelle, ein Absatz ist keine", () => {
  const kurz = transkriptQuelle("Zu wenig.");
  assert.equal(kurz.ok, false);
  assert.match(kurz.grund, /9 von 400 Zeichen/);

  const lang = transkriptQuelle(`  ${"Der Eigenmarkenanteil liegt bei 41 Prozent. ".repeat(12)}  `, "Podcast Folge 212");
  assert.equal(lang.ok, true);
  assert.equal(lang.art, "transcript");
  assert.equal(lang.plattform, "eingefügt");
  assert.equal(lang.titel, "Podcast Folge 212");
  assert.ok(lang.zeichen >= 400);
  assert.doesNotMatch(lang.text, /^\s|\s$/);
});

test("beide Wege gehen durch denselben Entwurf und dieselbe Prüfung", () => {
  // Server: Adresse oder Text, und beim Text ist er selbst die Quelle.
  assert.match(edge, /const quelle = quelleUrl\n\s*\? await ziehteQuelle\(quelleUrl, quellenHoler\(\), artikelLeser\)\n\s*: transkriptQuelle\(quelleText, String\(body\.title \|\| ""\)\);/);
  // Die Adresse aus dem Fragebogen wird mit derselben Kette gelesen wie ein gecrawlter Artikel.
  assert.match(edge, /const gelesen = await fetchArticleContent\(url\);/);
  assert.match(edge, /if \(!quelleUrl && !quelleText\.trim\(\)\) return errorResponse\(origin, "Weder Adresse noch Text angegeben\."\);/);
  assert.match(edge, /const eingefuegt = transkriptQuelle\(pruefText\);/);

  // Fragebogen: dritter Weg, eigenes Feld, Mindestlänge, und die Prüfung
  // bekommt den eingefügten Text mitgeschickt.
  assert.match(frontend, /\["transkript", "Transkript einfügen"\]/);
  assert.match(frontend, /key: "quelle_text", label: "Transkript"[\s\S]{0,140}?art: "transkript"/);
  assert.match(frontend, /source_text: state\.answers\.weg === "transkript"/);
  assert.match(frontend, /ausText \? text\.length < 400 : !adresse/);
  assert.match(frontend, /\{ text, lane: state\.answers\.lane \}/);
});

test("auf Artikelseiten liest die Kette des Crawlers, nicht der erste Teaserblock", async () => {
  // packaging-journal.de: die erste <article> ist eine Teaserkarte mit 109
  // Zeichen. Ohne den besseren Leser hiess das "zu wenig Text" (geprüft am
  // 23.08.2026 an einer echten Seite).
  const teaser = `<html><body><article><h2>Teaser</h2><p>Kurzer Anriss.</p></article>
    <article class="content"><p>${"Der Eigenmarkenanteil liegt bei 41 Prozent. ".repeat(20)}</p></article></body></html>`;
  const ohneLeser = await ziehteQuelle("https://beispiel.de/x", async () => ({ ok: true, text: teaser }));
  assert.equal(ohneLeser.ok, false, "der einfache Leser nimmt den ersten Block");

  const mitLeser = await ziehteQuelle("https://beispiel.de/x", async () => ({ ok: true, text: teaser }), async () => ({
    titel: "Eigenmarken wachsen", text: "Der Eigenmarkenanteil liegt bei 41 Prozent. ".repeat(20),
  }));
  assert.equal(mitLeser.ok, true);
  assert.equal(mitLeser.art, "article");
  assert.equal(mitLeser.titel, "Eigenmarken wachsen");
  assert.match(mitLeser.text, /41 Prozent/);

  // Ein Leser, der nichts findet oder wirft, ändert nichts am Urteil.
  const leerLeser = await ziehteQuelle("https://beispiel.de/x", async () => ({ ok: true, text: teaser }), async () => null);
  assert.equal(leerLeser.ok, false);
  const wirft = await ziehteQuelle("https://beispiel.de/x", async () => ({ ok: true, text: teaser }), async () => { throw new Error("kaputt"); });
  assert.equal(wirft.ok, false);
  assert.match(wirft.grund, /zu wenig Text/);
});
