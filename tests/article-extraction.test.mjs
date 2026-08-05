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
