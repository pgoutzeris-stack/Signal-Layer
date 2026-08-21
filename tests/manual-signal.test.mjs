import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const frontend = readFileSync(new URL("../manual-signal.js", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const edge = readFileSync(new URL("../supabase/functions/signal-layer/index.ts", import.meta.url), "utf8");
const backend = await import("../supabase/functions/signal-layer/manual-signal.ts");

function vollesSignal(extra = {}) {
  return {
    lane: "marketing",
    mode: "ai",
    headline: "Handel baut Eigenmarken schneller aus als geplant",
    core: "Der Anteil der Eigenmarken steigt deutlich, weil Kunden bei Marken sparen.",
    evidence: "Der Eigenmarkenanteil liegt bei 41 Prozent, 2024 waren es 34 Prozent.",
    ...extra,
  };
}

test("ein Signal ohne Beleg wird abgewiesen, kein Asset ohne Quelle", () => {
  const ok = backend.normalizeManualSignal(vollesSignal());
  assert.equal(backend.manualSignalIssue(ok), "");

  assert.match(backend.manualSignalIssue(backend.normalizeManualSignal(
    vollesSignal({ evidence: "" }),
  )), /Beleg fehlt/);
  assert.match(backend.manualSignalIssue(backend.normalizeManualSignal(
    vollesSignal({ headline: "kurz" }),
  )), /Überschrift/);
  assert.match(backend.manualSignalIssue(backend.normalizeManualSignal(
    vollesSignal({ core: "zu kurz" }),
  )), /Kern des Signals/);
});

test("Spur und Modus fallen auf sichere Werte zurück", () => {
  const leer = backend.normalizeManualSignal(null);
  assert.equal(leer.lane, "marketing");
  assert.equal(leer.mode, "ai");
  assert.equal(backend.normalizeManualSignal({ lane: "sales" }).lane, "sales");
  assert.equal(backend.normalizeManualSignal({ lane: "Ansprache" }).lane, "sales");
  assert.equal(backend.normalizeManualSignal({ mode: "manual" }).mode, "manual");
  assert.equal(backend.normalizeManualSignal({ mode: "hybrid" }).mode, "hybrid");
  assert.equal(backend.normalizeManualSignal({ mode: "erfunden" }).mode, "ai");
  // Grenzen greifen, sonst landet ein ganzer Artikel in der Überschrift.
  const lang = backend.normalizeManualSignal({ headline: "x".repeat(500) });
  assert.equal(lang.headline.length, 200);
});

test("der Belegkorpus trägt Zahlen und Kontext, den das Modell zitieren darf", () => {
  const signal = backend.normalizeManualSignal(vollesSignal({
    source: "Handelsblatt, 2026", company: "Beispiel AG", audience: "Category Management",
    territory: "DACH", occasion: "Quartalszahlen", competitor: "Wettbewerber X", offering: "Markenstrategie",
  }));
  const korpus = backend.manualSignalCorpus(signal);
  assert.match(korpus, /^Handel baut Eigenmarken/);
  assert.match(korpus, /41 Prozent/);
  assert.match(korpus, /Belege und Zahlen:/);
  assert.match(korpus, /Quelle: Handelsblatt, 2026/);
  assert.match(korpus, /Zielgruppe: Category Management/);
  assert.match(korpus, /ROOTS-Anschluss: Markenstrategie/);
  // Leere Zusatzfelder dürfen keine leeren Zeilen erzeugen.
  const schmal = backend.manualSignalCorpus(backend.normalizeManualSignal(vollesSignal()));
  assert.doesNotMatch(schmal, /Kontext:/);
  assert.doesNotMatch(schmal, /(Quelle|Unternehmen|Zielgruppe|Markt|Anlass|Wettbewerb|ROOTS-Anschluss): *$/m);
});

test("die beiden Zeilen bleiben aus der Pipeline-Auswertung heraus", () => {
  const signal = backend.normalizeManualSignal(vollesSignal({ lane: "sales", company: "Beispiel AG" }));
  const { article, signal: zeile } = backend.manualSignalRows(signal, "11111111-1111-1111-1111-111111111111", "2026-08-19T10:00:00.000Z");
  assert.equal(article.article_type, "manual");
  assert.equal(article.classification_status, "manual");
  assert.equal(article.url, "manual://signal/11111111-1111-1111-1111-111111111111");
  assert.equal(article.title_de, signal.headline);
  assert.match(String(article.content), /41 Prozent/);
  assert.equal(article.content, article.cleaned_content);
  assert.equal(zeile.status, "signal");
  assert.equal(zeile.lane, "sales");
  assert.equal(zeile.article_type, "manual");
  assert.equal(zeile.headline_de, signal.headline);
  // summary_de ist die Signalzusammenfassung im Asset-Prompt: dort steht der
  // Kern. why_de ist die Begruendung und nimmt die Relevanz, wenn es eine gibt.
  assert.equal(zeile.summary_de, signal.core);
  assert.equal(zeile.why_de, signal.core, "ohne Relevanz traegt why_de den Kern");
  const mitRelevanz = backend.manualSignalRows(
    backend.normalizeManualSignal(vollesSignal({ relevance: "Handelsmarken drücken die Verhandlungsmacht der Marken." })),
    "22222222-2222-2222-2222-222222222222", "2026-08-19T10:00:00.000Z",
  );
  assert.match(String(mitRelevanz.signal.why_de), /Verhandlungsmacht/);
  assert.equal(mitRelevanz.signal.summary_de, signal.core);
  assert.match(String(mitRelevanz.article.content), /Warum es zählt:/);
  assert.equal(zeile.company, "Beispiel AG");
  // article_type ist bei gecrawlten Zeilen oft NULL. Ein blankes <> 'manual'
  // wäre dort NULL und würde echte Signale stumm wegwerfen.
  assert.equal(backend.MANUAL_SIGNAL_EXCLUDE, "article_type.is.null,article_type.neq.manual");
});

test("der Server legt beide Zeilen an und räumt die Waise weg", () => {
  assert.match(edge, /case "create_manual_signal": \{/);
  assert.match(edge, /"create_manual_signal",\n\]\)/);
  assert.match(edge, /manualSignalIssue\(manual\)/);
  assert.match(edge, /from\("articles"\)\.insert\(manualArticle\)/);
  // Ohne Signalzeile ist die Artikelzeile unbenutzbar: sie muss weg.
  assert.match(edge, /if \(manualSignalError\) \{[\s\S]*from\("articles"\)\.delete\(\)\.eq\("id", manualId\)/);
  // Zähler und Listen filtern manuelle Signale.
  assert.ok(edge.split("MANUAL_SIGNAL_EXCLUDE").length - 1 >= 6, "jede Liste und jeder Zähler braucht den Filter");
});

test("die Pille steht neben Simple und Advanced und öffnet den eigenen Fragebogen", () => {
  assert.match(indexHtml, /id="manual-signal-btn"/);
  assert.match(indexHtml, /Manuelles Signal/);
  // Kein Pipeline-Modus: sonst würde die Ansicht umschalten statt zu öffnen.
  const bar = indexHtml.slice(indexHtml.indexOf('class="mode-switch-bar"'), indexHtml.indexOf('class="dashboard-wrap"'));
  assert.doesNotMatch(bar.slice(bar.indexOf("manual-signal-btn")), /data-pipeline-mode/);
  assert.match(appJs, /import \{ openManualSignal \} from "\.\/manual-signal\.js\?v=/);
  assert.match(appJs, /getElementById\("manual-signal-btn"\)\?\.addEventListener/);
  assert.match(appJs, /openManualSignal\(\{ callApi, escapeHtml, notify: toast, openSettingsPanel \}\)/);
});

test("der Fragebogen sieht aus wie der Asset-Fragebogen und fragt das Signal ab", () => {
  // Dieselbe Oberfläche: das CSS kommt aus dem Studio, nur die Kennung wechselt.
  assert.match(frontend, /import \{ ASSET_CHROME_CSS, openAssetStudio, closeAssetStudio \}/);
  assert.match(frontend, /ASSET_CHROME_CSS\.replace\(\/#as-overlay\/g, `#\$\{OVERLAY_ID\}`\)/);
  assert.match(frontend, /class="as-step as-step--open"/);
  assert.match(frontend, /class="as-opt as-opt--btn/);
  assert.match(frontend, /as-progress-text/);

  const reihenfolge = ["lane", "profile", "headline", "core", "evidence", "source"];
  let letzte = -1;
  for (const key of reihenfolge) {
    const pos = frontend.indexOf(`key: "${key}"`);
    assert.ok(pos > letzte, `${key} steht an der falschen Stelle`);
    letzte = pos;
  }
  // Pflichtfelder und Kür klar getrennt: optionale Fragen tragen Überspringen.
  assert.match(frontend, /key: "evidence"[\s\S]*pflicht: true/);
  assert.match(frontend, /data-act="skip"/);
  // Relevanz, Adressat und Tonalität sind aus dem Fragebogen heraus: der Weg
  // zum Asset war zu lang, und keine der drei war Pflicht.
  assert.doesNotMatch(frontend, /key: "relevance"/);
  assert.doesNotMatch(frontend, /key: "audience"/);
  assert.doesNotMatch(frontend, /key: "tone"/);
  assert.match(frontend, /key: "competitor", label: "Benchmark"/);
  assert.match(frontend, /"Welche Wettbewerber des Kunden machen es schon vor\?"/);
  // Konkrete Namen, keine Kategorien: das Asset zitiert sie.
  assert.match(frontend, /platzhalter: "Firmennamen, z\. B\. [^"]+"/);
  // Der Beleg-Hinweis erklaerte eine Regel, die die Fehlermeldung ohnehin nennt.
  assert.doesNotMatch(frontend, /darf im Asset als Zahl oder Zitat erscheinen/);
  // Beim Sprung zieht die Ansicht mit, sonst steht die naechste Frage unter der Kante.
  assert.match(frontend, /box\.scrollTop = Math\.max\(0, ziel\);/);
  // Die Karte stellt eine Frage, die Antwortzeile traegt den kurzen Namen:
  // "Wofür" als Frage war keine Frage.
  assert.match(frontend, /frage: "Was soll aus dem Signal entstehen\?"/);
  // Wer die Texte schreibt, entscheidet erst der Asset-Fragebogen: ein manuell
  // getipptes Signal kann die Frage gar nicht beantworten.
  assert.doesNotMatch(frontend, /key: "mode"/);
  assert.doesNotMatch(frontend, /Wer schreibt die Texte/);
  assert.doesNotMatch(frontend, /key: "storyline_text"/);
  assert.doesNotMatch(frontend, /key: "caption_text"/);
  assert.match(frontend, /frage: "Was belegt diese Beobachtung\?"/);
  // Der Kern ist der Inhalt des Signals, die Relevanz eine eigene Frage.
  assert.match(frontend, /key: "core", label: "Kern", frage: "Was besagt das Signal im Kern\?"/);
  // Relevanz, Adressat, Unternehmen und Leistung lauten je Spur anders:
  // im Feed geht es um Leser, in der Ansprache um das Unternehmen.
  assert.match(frontend, /"Welches Unternehmen willst du ansprechen\?"/);
  assert.match(frontend, /"Welche ROOTS-Leistung willst du anbieten\?"/);
  assert.doesNotMatch(frontend, /für die Zielgruppe relevant/);
  assert.match(frontend, /function textVon\(feld\)/);
  assert.match(frontend, /<label>\$\{esc\(textVon\(offen\.frage\) \|\| offen\.label\)\}<\/label>/);
  for (const eintrag of frontend.slice(frontend.indexOf("const FRAGEN = ["), frontend.indexOf("const STANDARD")).split(/\n  \{/).slice(1)) {
    // Feste Frage oder eine je Spur - in beiden Faellen eine echte Frage.
    const feste = eintrag.match(/frage: "([^"]*)"/);
    // Der Vergleich a.lane === "sales" ist keine Frage, nur die beiden Zweige.
    const jeSpur = (eintrag.match(/frage:\s*\(a\) => \(([\s\S]*?)\),\n/) || [])[1]?.replace(/a\.lane === "\w+"/, "");
    const fragen = feste
      ? [feste[1]]
      : [...(jeSpur ? jeSpur.matchAll(/"([^"]*)"/g) : [])].map((treffer) => treffer[1]);
    assert.ok(fragen.length, `ohne Frage: ${eintrag.slice(0, 60)}`);
    for (const frage of fragen) {
      assert.match(frage, /\?$/, `jede Frage endet mit einem Fragezeichen: ${frage}`);
    }
  }
  // Links und rechts beginnen und enden auf derselben Linie.
  assert.match(frontend, /grid-template-rows:auto 1fr/);
  assert.match(frontend, /class="ms-kopf"/);
  assert.match(frontend, /\.ms-karte\{\n  flex:1; align-self:stretch;/);
  // Die Quelle bittet um eine URL und sagt, was ohne sie passiert.
  assert.match(frontend, /key: "source"[\s\S]*platzhalter: "https:\/\/…/);
  assert.match(frontend, /hinweis: "Am besten die URL einsetzen\./);
  // Die Leistung kommt aus dem ROOTS-Katalog, Freitext bleibt möglich.
  assert.match(frontend, /key: "offering", label: "Leistung", art: "auswahl"/);
  assert.match(frontend, /await api\("list_offerings"\)/);
  assert.match(frontend, /data-auswahl="\$\{esc\(q\.key\)\}"/);
  assert.match(frontend, /Andere Leistung eintragen/);
});

test("die Pflichtmeldung trägt die Warnfarbe der Marke, kein nackter Absatz", () => {
  const studio = readFileSync(new URL("../asset-studio.js", import.meta.url), "utf8");
  assert.match(studio, /#as-overlay \.as-form-error\{/);
  assert.match(studio, /color:var\(--danger,#dc2626\)/);
  assert.match(frontend, /class="as-form-error"/);
  // Die Meldung sagt, was fehlt, nicht nur dass etwas fehlt.
  assert.match(frontend, /Noch \$\{\(offen\.min \|\| 1\) - laenge\} Zeichen zu kurz\./);
});

test("jedes Feld ist für die Testphase vorbelegt", () => {
  assert.match(frontend, /const BEISPIEL = \{/);
  // Vorbelegt beim Oeffnen, nicht hinter einem Knopf.
  assert.match(frontend, /answers: \{ \.\.\.STANDARD, \.\.\.BEISPIEL\.marketing \}/);
  assert.doesNotMatch(frontend, /data-act="beispiel"/);
  // Spurwechsel tauscht das Beispiel, selbst getippte Felder bleiben stehen.
  assert.match(frontend, /function uebernimmBeispiel\(lane\)/);
  assert.match(frontend, /if \(!state\.beruehrt\.has\(key\)\) state\.answers\[key\] = wert;/);
  assert.match(frontend, /if \(key === "lane"\) uebernimmBeispiel\(state\.answers\.lane\)/);
  assert.match(frontend, /state\.beruehrt\.add\(key\)/);
  // Beide Spuren tragen ein vollständiges Beispiel, sonst bleibt ein Pflichtfeld leer.
  const block = frontend.slice(frontend.indexOf("const BEISPIEL = {"), frontend.indexOf("const EIGENES_CSS"));
  for (const spur of ["marketing", "sales"]) {
    const teil = block.slice(block.indexOf(`${spur}: {`));
    for (const feld of ["headline", "core", "evidence", "source", "company"]) {
      assert.match(teil, new RegExp(`${feld}: "[^"]{10,}"`), `${spur} ohne ${feld}`);
    }
  }
});

test("der Asset-Fragebogen öffnet bei der ersten offenen Frage", () => {
  const studio = readFileSync(new URL("../asset-studio.js", import.meta.url), "utf8");
  assert.match(studio, /stepKey: erstesOffenesSchritt\(questions, prefill\)/);
  assert.match(studio, /function erstesOffenesSchritt\(list, prefill\)/);
  // Bedingte Fragen gegen die vorbelegten Antworten prüfen, sonst landet der
  // Einstieg auf einer Frage, die gar nicht gestellt wird - und der Fragebogen
  // springt zurück auf Frage 1.
  assert.match(studio, /const antworten = \{ \.\.\.defaultAnswers\(list\), \.\.\.vorbelegt \}/);
  assert.match(studio, /\.filter\(\(q\) => !q\.when \|\| q\.when\(antworten\)\)/);
  // Ohne manuelles Signal bleibt der Einstieg wie bisher bei Frage 1.
  assert.match(studio, /if \(!schluessel\.size\) return "";/);
});

test("die Übergabe belegt den Asset-Fragebogen mit den eigenen Texten vor", () => {
  const block = frontend.slice(frontend.indexOf("function assetVorbelegung"), frontend.indexOf("async function uebernehmen"));
  assert.match(block, /storyline: "auto"/);
  assert.match(block, /cta: "auto"/);
  assert.match(block, /sources: a\.source \? "custom" : "auto"/);
  // Sales kennt kein Profil, dafür den Firmennamen im Cover-Titel.
  assert.match(block, /out\.company_named = "yes"/);
  assert.match(frontend, /kind: a\.lane === "sales" \? "memo" : "linkedin"/);
  assert.match(frontend, /prefill: assetVorbelegung\(\)/);

  // Das Studio nimmt nur Schlüssel an, die sein Fragebogen kennt.
  const studio = readFileSync(new URL("../asset-studio.js", import.meta.url), "utf8");
  assert.match(studio, /export const ASSET_CHROME_CSS = CHROME_CSS;/);
  assert.match(studio, /openSettingsPanel, prefill \} = \{\}\)/);
  assert.match(studio, /function vorbelegung\(list, prefill\)/);
  assert.match(studio, /if \(erlaubt\.has\(key\) && wert !== undefined && wert !== null\) out\[key\] = wert;/);
});
