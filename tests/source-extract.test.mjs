import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  MANUAL_DRAFT_FIELDS, eingebetteteVideos, erkennePlattform, manualCheckPrompt, manualDraftPrompt,
  normalizeManualCheck, normalizeManualDraft, pruefeOeffentlicheUrl, seitenText, transkriptQuelle,
  untertitelSpur, untertitelText, videoTranskript, vttText, youtubeId, zeitTextAusXml, ziehteQuelle,
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
  assert.match(edge, /await ziehteQuelle\(quelleUrl, quellenNetz\(\)\)/);
  assert.match(edge, /schema: MANUAL_DRAFT_SCHEMA/);
  assert.match(edge, /operation: "manual_signal_draft"/);
  // Ein Entwurf ist ein bezahlter Aufruf: im Spitzentarif nur mit Zustimmung.
  assert.match(edge, /blocked: "peak_tariff", pricing: tarif/);
  assert.match(edge, /"draft_manual_signal_from_url",/);

  // Das Netz der Extraktion: lesen, posten, Artikel lesen, Apify.
  assert.match(edge, /function quellenNetz\(\): Netz \{/);
  assert.match(edge, /Cookie: "CONSENT=YES\+cb; SOCS=CAI"/);
  assert.match(edge, /const gelesen = await fetchArticleContent\(ziel\);/);
  assert.match(edge, /run-sync-get-dataset-items\?token=\$\{key\}/);

  // Fragebogen: zwei Wege, und im Quellenweg genau ein Feld.
  assert.match(frontend, /\["felder", "Manuell erstellen"\], \["quelle", "Durch Transkript erzeugen"\]/);
  assert.match(frontend, /key: "quelle", label: "Quelle", frage: "Welche Adresse soll ausgelesen werden\?", art: "quelle"/);
  assert.match(frontend, /data-feld="quelle_url"/);
  assert.doesNotMatch(frontend, /quelle_text/);
  assert.match(frontend, /async function zieheQuelle\(\)/);
  assert.match(frontend, /api\("draft_manual_signal_from_url", \{ url: adresse, lane: state\.answers\.lane \}\)/);
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
  assert.match(edge, /pruefQuelle = await ziehteQuelle\(pruefUrl, quellenNetz\(\)\);/);
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

/** Ein Netz aus Zetteln: jede Adresse bekommt eine Antwort, alles andere scheitert. */
function netzAus({ seiten = {}, player = null, apify = null, artikel = null } = {}) {
  const gerufen = [];
  return {
    gerufen,
    netz: {
      holen: async (url) => {
        gerufen.push(`GET ${url}`);
        const treffer = Object.keys(seiten).find((teil) => url.includes(teil));
        return treffer ? { ok: true, text: seiten[treffer] } : { ok: false, text: "" };
      },
      posten: async (url, body) => {
        gerufen.push(`POST ${url}`);
        if (!player) return { ok: false, text: "" };
        return { ok: true, text: JSON.stringify(typeof player === "function" ? player(body) : player) };
      },
      artikel: artikel ? async (url) => { gerufen.push(`ARTIKEL ${url}`); return artikel; } : undefined,
      apify: apify ? async (actor, eingabe) => { gerufen.push(`APIFY ${actor} ${JSON.stringify(eingabe)}`); return apify; } : undefined,
    },
  };
}

const langerText = (satz, mal) => Array.from({ length: mal }, () => satz).join(" ");

test("zeitmarkierte Formate werden zu fortlaufendem Text, ohne Doppelungen", () => {
  const timedtext = `<?xml version="1.0"?><timedtext format="3"><body>
    <p t="0" d="3000">Der Anteil liegt</p>
    <p t="3000" d="3000">Der Anteil liegt bei 41 Prozent.</p>
    <p t="6000" d="2000">2024 waren es 34.</p></body></timedtext>`;
  // Rollende Untertitel wiederholen den Vorgänger: die längere Zeile gewinnt.
  assert.equal(zeitTextAusXml(timedtext), "Der Anteil liegt bei 41 Prozent. 2024 waren es 34.");
  assert.equal(zeitTextAusXml("kein xml"), "");

  const vtt = `WEBVTT\nKind: captions\nLanguage: de\n\n1\n00:00:00.000 --> 00:00:03.000\nDer Anteil liegt bei 41 Prozent.\n\n2\n00:00:03.000 --> 00:00:05.000\n2024 waren es 34.`;
  assert.equal(vttText(vtt), "Der Anteil liegt bei 41 Prozent. 2024 waren es 34.");
  assert.equal(vttText("ohne zeitmarken"), "");
});

test("eingebettete Videos werden in jeder üblichen Schreibweise gefunden", () => {
  const html = `<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0"></iframe>
    <a href="https://youtu.be/aaaaaaaaaaa">Video</a>
    <div data-video-id="bbbbbbbbbbb"></div>
    <a href="https://www.youtube.com/watch?feature=share&v=ccccccccccc">noch eins</a>
    <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>`;
  assert.deepEqual(eingebetteteVideos(html), ["dQw4w9WgXcQ", "aaaaaaaaaaa", "ccccccccccc", "bbbbbbbbbbb"]);
  assert.deepEqual(eingebetteteVideos("<p>ohne Video</p>"), []);
});

test("die Kette nimmt den Player zuerst und nennt den Weg", async () => {
  const transkript = { events: [{ segs: [{ utf8: langerText("Eigenmarken wachsen um 41 Prozent.", 12) }] }] };
  const { netz, gerufen } = netzAus({
    player: { captions: { playerCaptionsTracklistRenderer: { captionTracks: [
      { baseUrl: "https://y/t?en", languageCode: "en", kind: "asr" },
      { baseUrl: "https://y/t?de", languageCode: "de" },
    ] } } },
    seiten: { "y/t?de": JSON.stringify(transkript) },
  });
  const quelle = await ziehteQuelle("https://www.youtube.com/watch?v=dQw4w9WgXcQ", netz);
  assert.equal(quelle.ok, true);
  assert.equal(quelle.art, "transcript");
  assert.equal(quelle.weg, "Untertitel über den Player");
  assert.equal(quelle.sprache, "de");
  assert.match(quelle.text, /41 Prozent/);
  // Deutsch vor Englisch: die englische Spur wird nicht einmal geholt.
  assert.ok(!gerufen.some((ruf) => ruf.includes("y/t?en")));
});

test("wenn der Player nichts hergibt, geht es die Kette hinunter bis Apify", async () => {
  const seite = `<title>Video</title>"captionTracks":[{"baseUrl":"https://y/t?de","languageCode":"de"}],
    "shortDescription":"Kurz.",`;
  // Player leer, Seitenspur antwortet leer (so verhält sich YouTube 2026),
  // Piped nicht erreichbar, also Apify.
  const { netz, gerufen } = netzAus({
    seiten: { "youtube.com/watch": seite, "y/t?de": "" },
    apify: [{ transcript: [{ text: langerText("Der Eigenmarkenanteil liegt bei 41 Prozent.", 12) }],
      selected_language: "German (auto-generated)", is_auto_generated: true, title: "Handel im Wandel" }],
  });
  const quelle = await ziehteQuelle("https://www.youtube.com/watch?v=dQw4w9WgXcQ", netz);
  assert.equal(quelle.ok, true);
  assert.equal(quelle.art, "transcript");
  assert.equal(quelle.weg, "Transkript über Apify");
  assert.match(quelle.grund, /Über Apify gelesen, das kostet wenige Cent je Video\./);
  assert.match(quelle.grund, /Automatisch erzeugte Untertitel/);
  assert.equal(quelle.titel, "Handel im Wandel");
  // Apify kostet Geld und kommt deshalb nach den freien Wegen.
  const reihenfolge = gerufen.map((ruf) => ruf.split(" ")[0]);
  assert.equal(reihenfolge[0], "POST");
  assert.equal(reihenfolge[reihenfolge.length - 1], "APIFY");
  assert.ok(gerufen.some((ruf) => ruf.includes("pipedapi") || ruf.includes("piped")));
});

test("Piped kommt vor Apify, und ohne Apify bleibt die Beschreibung", async () => {
  const vtt = `WEBVTT\n\n00:00:00.000 --> 00:00:03.000\n${langerText("41 Prozent Eigenmarken.", 12)}`;
  const { netz } = netzAus({
    seiten: {
      "api.piped.private.coffee/streams": JSON.stringify({ subtitles: [{ code: "de", url: "https://piped/sub.vtt", autoGenerated: false }] }),
      "piped/sub.vtt": vtt,
    },
  });
  const ueberPiped = await ziehteQuelle("https://youtu.be/dQw4w9WgXcQ", netz);
  assert.equal(ueberPiped.weg, "Untertitel über einen Piped-Spiegel");
  assert.match(ueberPiped.text, /41 Prozent/);

  const nurBeschreibung = await ziehteQuelle("https://www.youtube.com/watch?v=dQw4w9WgXcQ", netzAus({
    seiten: { "youtube.com/watch": `"shortDescription":"${langerText("Eigenmarken wachsen.", 12)}","` },
  }).netz);
  assert.equal(nurBeschreibung.art, "description");
  assert.equal(nurBeschreibung.weg, "nur die Videobeschreibung");
  assert.match(nurBeschreibung.grund, /Kein Transkript erreichbar/);

  const garnichts = await ziehteQuelle("https://www.youtube.com/watch?v=dQw4w9WgXcQ", netzAus({}).netz);
  assert.equal(garnichts.ok, false);
  assert.match(garnichts.grund, /Kein Weg hat ein Transkript hergegeben/);
});

test("eine Seite mit Text und Video liefert beides", async () => {
  const artikelText = langerText("Der Eigenmarkenanteil liegt bei 41 Prozent.", 12);
  const gesagt = langerText("Im Gespräch nennt der Einkauf 68 Prozent.", 12);
  const { netz } = netzAus({
    seiten: {
      "beispiel.de/artikel": `<html><body><article><p>${artikelText}</p></article>
        <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></body></html>`,
      "y/t?de": JSON.stringify({ events: [{ segs: [{ utf8: gesagt }] }] }),
    },
    player: { captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ baseUrl: "https://y/t?de", languageCode: "de" }] } } },
    artikel: { titel: "Eigenmarken wachsen", text: artikelText },
  });
  const quelle = await ziehteQuelle("https://beispiel.de/artikel", netz);
  assert.equal(quelle.ok, true);
  assert.equal(quelle.art, "mixed");
  assert.equal(quelle.titel, "Eigenmarken wachsen");
  assert.match(quelle.text, /41 Prozent/);
  assert.match(quelle.text, /68 Prozent/);
  assert.match(quelle.text, /Transkript des eingebetteten Videos/);
  assert.equal(quelle.teile.length, 2);

  // Ohne Video bleibt es ein Artikel, und der Leser des Crawlers gewinnt gegen
  // den ersten Teaserblock.
  const nurText = await ziehteQuelle("https://beispiel.de/artikel", netzAus({
    seiten: { "beispiel.de/artikel": "<html><body><article><p>Teaser.</p></article></body></html>" },
    artikel: { titel: "Eigenmarken wachsen", text: artikelText },
  }).netz);
  assert.equal(nurText.art, "article");
  assert.equal(nurText.weg, "Seitentext");
  assert.deepEqual(nurText.teile, [`Artikeltext (${artikelText.length.toLocaleString("de-DE")} Zeichen)`]);

  const duenn = await ziehteQuelle("https://beispiel.de/artikel", netzAus({
    seiten: { "beispiel.de/artikel": "<html><body><p>Kurz.</p></body></html>" },
  }).netz);
  assert.equal(duenn.ok, false);
  assert.match(duenn.grund, /zu wenig Text/);

  const totesNetz = await ziehteQuelle("https://beispiel.de/artikel", netzAus({}).netz);
  assert.equal(totesNetz.ok, false);
  assert.match(totesNetz.grund, /nicht abrufbar/);
});

test("ein eingefügtes Transkript bleibt als Weg über die Schnittstelle möglich", () => {
  // Die Oberfläche fragt nur nach einer Adresse. Der Server nimmt weiter Text
  // an: bricht die Kette weg, ist das der Notweg, ohne neues Deployment.
  assert.equal(transkriptQuelle("Zu wenig.").ok, false);
  const lang = transkriptQuelle(langerText("Der Eigenmarkenanteil liegt bei 41 Prozent.", 12), "Podcast 212");
  assert.equal(lang.ok, true);
  assert.equal(lang.plattform, "eingefügt");
  assert.equal(lang.titel, "Podcast 212");
  assert.match(edge, /: transkriptQuelle\(quelleText, String\(body\.title \|\| ""\)\)/);
});

test("videoTranskript gibt null zurück, wenn wirklich nichts kommt", async () => {
  assert.equal(await videoTranskript("dQw4w9WgXcQ", netzAus({}).netz), null);
  // Ohne posten entfällt der Player-Weg, ohne apify der bezahlte.
  const nurLesen = { holen: async () => ({ ok: false, text: "" }) };
  assert.equal(await videoTranskript("dQw4w9WgXcQ", nurLesen), null);
});
