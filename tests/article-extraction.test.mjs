import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const helpers = await import("../supabase/functions/signal-layer/extraction-helpers.ts");
const indexSource = readFileSync(new URL("../supabase/functions/signal-layer/index.ts", import.meta.url), "utf8");

test("das Datum kommt aus einem als Datum ausgewiesenen Element im Artikelkopf", () => {
  // beiersdorf.de: <div class="cw-date">03.08.2026</div> direkt vor der Ueberschrift.
  const html = `<section class="cw-news-date"><div class="cw-container"><div class="cw-date">03.08.2026</div></div></section>
    <h1>Halbjahresergebnisse 2026</h1><p>Text.</p>`;
  assert.equal(helpers.extractDateFromDateElement(html)?.slice(0, 10), "2026-08-03");
});

test("auch ein ausgeschriebenes und ein ISO-Datum werden erkannt", () => {
  assert.equal(
    helpers.extractDateFromDateElement('<span class="publish-date">3. August 2026</span><h1>Titel</h1>')?.slice(0, 10),
    "2026-08-03",
  );
  assert.equal(
    helpers.extractDateFromDateElement('<time class="timestamp">2026-04-23</time><h1>Titel</h1>')?.slice(0, 10),
    "2026-04-23",
  );
});

test("unplausible Daten werden verworfen", () => {
  assert.equal(helpers.extractDateFromDateElement('<h1>T</h1><div class="date">32.13.2026</div>'), null);
  assert.equal(helpers.extractDateFromDateElement('<h1>T</h1><div class="date">01.01.1889</div>'), null);
  const spaeter = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  assert.equal(helpers.extractDateFromDateElement(`<h1>T</h1><div class="date">${spaeter}</div>`), null);
  assert.equal(helpers.extractDateFromDateElement('<h1>T</h1><div class="untertitel">03.08.2026</div>'), null);
});

test("das Datum einer Teaser-Leiste zaehlt nicht als Artikeldatum", () => {
  // horizont.net listet unter dem Artikel fremde Beitraege, jeder mit Datum.
  const teaser = (tag) => `<div class="StageFewOneRowFeed_entry-date">${tag}</div>`;
  const nurTeaser = `<h1>Kreation des Monats</h1><p>${"Artikeltext. ".repeat(10)}</p>${teaser("05.08.2026")}${teaser("31.07.2026")}`;
  assert.equal(helpers.extractDateFromDateElement(nurTeaser), null);

  // Auch dicht hinter der Ueberschrift greift die Teaser-Markierung nicht durch.
  const dichtDran = `<h1>Titel</h1><div class="teaser-card__date">05.08.2026</div><div class="article-date">31.07.2026</div>`;
  assert.equal(helpers.extractDateFromDateElement(dichtDran)?.slice(0, 10), "2026-07-31");
});

test("weit unterhalb der Ueberschrift wird nicht mehr gesucht", () => {
  const html = `<h1>Titel</h1><p>${"Fuelltext. ".repeat(600)}</p><div class="date">05.08.2026</div>`;
  assert.equal(helpers.extractDateFromDateElement(html), null);
});

test("die Edge-Funktion nutzt beide neuen Datumsquellen", () => {
  // Packaging Europe fuehrt das Datum nur in <meta name="pubdate">.
  assert.match(indexSource, /name=\["'\]pubdate\["'\]/);
  assert.match(indexSource, /const elementDate = extractDateFromDateElement\(html\)/);
  // Die Element-Suche darf erst laufen, wenn die strukturierten Muster leer bleiben.
  assert.ok(
    indexSource.indexOf('name=["\']pubdate["\']') < indexSource.indexOf("const elementDate = extractDateFromDateElement"),
    "Meta-Muster muessen vor der Element-Suche stehen",
  );
});

const absatz = (n, wort = "Der Händler meldet ein deutliches Umsatzplus im zweiten Quartal") => Array.from({ length: n }, (_, i) => `<p>${wort}, Absatz ${i + 1}.</p>`).join("\n");

test("Zustandsklassen am body-Tag löschen den Artikel nicht mehr", () => {
  // rundschau.de: "ur-settings-sidebar-show", The Grocer: "enhanced-advertising".
  for (const klasse of ["single-post ur-settings-sidebar-show", "M1-master enhanced-advertising enhanced-advertising-rhc-empty"]) {
    const html = `<html><body class="${klasse}"><div class="entry-content">${absatz(8)}</div><div class="sidebar"><p>Meistgelesen heute und gestern im Handel.</p></div></body></html>`;
    const { text } = helpers.artikelAusHtml(html);
    assert.ok(text.includes("Absatz 8"), klasse);
    assert.ok(!text.includes("Meistgelesen"), klasse);
  }
});

test("das Wort captcha in einem Formular macht einen Artikel nicht zur Prüfseite", () => {
  const artikel = `<body><article>${absatz(10)}</article><form><label>Friendly Captcha</label></form></body>`;
  assert.equal(helpers.istPruefseite(artikel, helpers.artikelAusHtml(artikel).text), false);
  assert.equal(helpers.istPruefseite("<html><body>Just a moment...</body></html>", ""), true);
  assert.equal(helpers.istPruefseite("<html><body><p>Enable JavaScript and cookies to continue</p></body></html>", "Enable JavaScript and cookies to continue"), true);
});

test("Feed-Auszüge mit Verweis auf die Seite werden erkannt", () => {
  assert.equal(helpers.istFeedAuszug("Langer Anriss ... *Continue reading this article on digiday.com . Sign up for Digiday newsletters.*"), true);
  assert.equal(helpers.istFeedAuszug("Kurzer Text. The post Wenn Heidi Klum auf den Gabelstapler steigt appeared first on rundschau.de ."), true);
  assert.equal(helpers.istFeedAuszug("Der Beitrag Takko Fashion eröffnet 2.000. Filiale erschien zuerst auf stores+shops ."), true);
  assert.equal(helpers.istFeedAuszug("Die Filiale öffnet im Herbst [...]"), true);
  assert.equal(helpers.istFeedAuszug("Der Konzern bestätigte die Zahlen am Montag."), false);
});

test("eingebettete Daten: der Block, der zu Titel und Anriss passt, nicht der längste", () => {
  // foodbev.com (Wix): Artikel, verwandter Beitrag und Firmenportraet im selben JSON.
  const artikel = "Pack leaks remain one of the leading causes of retailer returns. Seal integrity in modified atmosphere packaging protects brands. ".repeat(6);
  const fremd = "Keurig Dr Pepper is a leading coffee and beverage company in North America with annual revenue in excess of eleven billion dollars. ".repeat(9);
  const daten = { seo: { content: '{"tags":[{"type":"title","children":"{{wix-data-page-item.Blog/Posts.title}}"}]}'.repeat(12) }, post: { plainContent: artikel }, firma: { text: fremd } };
  const html = `<html><head><meta property="og:title" content="Seal the deal for retailers: Guaranteeing seal integrity in modified atmosphere packaging"></head><body><script type="application/json" id="wix-warmup-data">${JSON.stringify(daten)}</script></body></html>`;
  const { text } = helpers.artikelAusHtml(html);
  assert.ok(text.startsWith("Pack leaks remain"), text.slice(0, 80));
  // Ohne passenden Block kein Werbetext, sondern die HTML-Extraktion.
  assert.equal(helpers.extractEmbeddedArticleBody(html, "Völlig anderes Thema über Möbelhandel"), null);
});

test("ein verschachtelter Inhaltsbereich wird ganz gelesen, nicht bis zum ersten schließenden Tag", () => {
  // stores+shops: bis 30.9.2026 gewann ein kurzer verwandter Artikel.
  const html = `<body><div class="post-content entry-content"><div class="bild"><span>Foto</span></div>${absatz(12)}</div>
    <article class="verwandt"><p>Douglas macht Köln zur Beauty-Destination mit neuem Store in bester Lage der Innenstadt.</p><p>Mehr dazu im Beitrag über die Eröffnung und die Pläne.</p><p>Weitere Stores folgen im kommenden Jahr in anderen Städten.</p></article></body>`;
  const { text } = helpers.artikelAusHtml(html);
  assert.ok(text.includes("Absatz 12"), text.slice(0, 120));
  assert.ok(!text.includes("Douglas"));
});
