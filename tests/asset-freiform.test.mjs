import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const frei = await import("../asset-freiform.js");
const modul = readFileSync(new URL("../asset-freiform.js", import.meta.url), "utf8");
const studio = readFileSync(new URL("../asset-studio.js", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/asset-studio-check.yml", import.meta.url), "utf8");

/** Ein Knoten ohne Browser: Kinder, Eltern, Attribute, Klasse. */
function knoten(tag, klasse = "", attrs = {}, kinder = []) {
  const k = {
    tagName: tag.toUpperCase(),
    attrs: { ...attrs, ...(klasse ? { class: klasse } : {}) },
    children: [],
    parentElement: null,
    hasAttribute(name) { return Object.hasOwn(this.attrs, name); },
    getAttribute(name) { return this.attrs[name] ?? null; },
  };
  for (const kind of kinder) {
    kind.parentElement = k;
    k.children.push(kind);
  }
  return k;
}

test("Pfade zaehlen Werkzeugknoten nicht mit", () => {
  const ziel = knoten("svg", "em-roots-logo");
  const lock = knoten("div", "em-lock", { "data-ci": "locked" }, [ziel]);
  const stift = knoten("div", "as-img-ui", { "data-as-chrome": "" });
  const seite = knoten("div", "em-page", {}, [stift, knoten("span", "em-rh"), lock]);
  const buehne = knoten("div", "as-stage as-stage--memo", {}, [seite]);
  assert.equal(frei.pfadVon(ziel, buehne), "0.1.0");
  assert.equal(frei.elementAmPfad(buehne, "0.1.0"), ziel);
  assert.equal(frei.elementAmPfad(buehne, "0.9"), null);
  assert.equal(frei.elementAmPfad(buehne, "../0"), null);
  assert.equal(frei.pfadVon(buehne, buehne), "");
  // Die Marke nimmt die Vorlagenklasse, nicht Zustandsklassen des Studios.
  assert.equal(frei.elementMarke(knoten("div", "is-off em-page")), "div.em-page");
  assert.equal(frei.elementMarke(ziel), "svg.em-roots-logo");
});

test("Hilfslinien rasten an Kanten und Mitten ein", () => {
  const seite = { x: 0, y: 0, w: 800, h: 1000 };
  const nachbar = { x: 100, y: 300, w: 200, h: 50 };
  // Linke Kante 3 Punkte neben der des Nachbarn: rastet ein.
  const r = frei.rasteEin({ x: 103, y: 500, w: 120, h: 40 }, [seite, nachbar], 6);
  assert.equal(r.dx, -3);
  assert.equal(r.dy, 0);
  assert.ok(r.linien.some((l) => l.achse === "x" && l.pos === 100));
  // Mitte der Seite.
  const mitte = frei.rasteEin({ x: 338, y: 700, w: 120, h: 40 }, [seite], 6);
  assert.equal(mitte.dx, 2);
  // Zu weit weg: nichts.
  const weit = frei.rasteEin({ x: 130, y: 700, w: 50, h: 40 }, [nachbar], 6);
  assert.equal(weit.dx, 0);
  assert.equal(weit.dy, 0);
  // Beim Skalieren nur die bewegte Kante.
  const kante = frei.rasteEin({ x: 50, y: 50, w: 247, h: 20 }, [nachbar], 6, { x: [2], y: [] });
  assert.equal(kante.dx, 3);
  assert.equal(kante.dy, 0);
});

test("Ausrichten und Verteilen wie in PowerPoint", () => {
  const bezug = { x: 0, y: 0, w: 600, h: 800 };
  const r = [{ x: 50, y: 60, w: 100, h: 40 }];
  assert.deepEqual(frei.ausrichtung(r, "links", bezug), [{ dx: -50, dy: 0 }]);
  assert.deepEqual(frei.ausrichtung(r, "mitte-h", bezug), [{ dx: 200, dy: 0 }]);
  assert.deepEqual(frei.ausrichtung(r, "rechts", bezug), [{ dx: 450, dy: 0 }]);
  assert.deepEqual(frei.ausrichtung(r, "oben", bezug), [{ dx: 0, dy: -60 }]);
  assert.deepEqual(frei.ausrichtung(r, "mitte-v", bezug), [{ dx: 0, dy: 320 }]);
  assert.deepEqual(frei.ausrichtung(r, "unten", bezug), [{ dx: 0, dy: 700 }]);
  // Drei Elemente: die aeusseren bleiben, das mittlere rueckt auf gleiche Luecken.
  const drei = [{ x: 0, y: 0, w: 100, h: 10 }, { x: 400, y: 0, w: 100, h: 10 }, { x: 150, y: 0, w: 100, h: 10 }];
  const d = frei.verteilung(drei, "x");
  assert.deepEqual(d[0], { dx: 0, dy: 0 });
  assert.deepEqual(d[1], { dx: 0, dy: 0 });
  assert.deepEqual(d[2], { dx: 50, dy: 0 });
  assert.deepEqual(frei.verteilung(drei.slice(0, 2), "x"), [{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }]);
});

test("Skalieren haelt die Gegenkante und auf Wunsch das Seitenverhaeltnis", () => {
  const start = { x: 10, y: 20, w: 100, h: 50 };
  assert.deepEqual(frei.skaliere(start, "e", 40, 99), { x: 10, y: 20, w: 140, h: 50 });
  assert.deepEqual(frei.skaliere(start, "w", 20, 0), { x: 30, y: 20, w: 80, h: 50 });
  assert.deepEqual(frei.skaliere(start, "se", 100, 0, { seitenTreu: true }), { x: 10, y: 20, w: 200, h: 100 });
  assert.deepEqual(frei.skaliere(start, "nw", -50, 0, { seitenTreu: true }), { x: -40, y: -5, w: 150, h: 75 });
  // Nie kleiner als das Minimum.
  assert.equal(frei.skaliere(start, "e", -500, 0).w, 8);
});

test("Gespeicherte Aenderungen werden geprueft, bevor sie wirken", () => {
  const liste = frei.bereinigeAenderungen({
    "0.1.0": { t: "svg.em-roots-logo", dx: 12.345, dy: -4, sx: 1.5, sy: 1.5, flaeche: "#206efb", z: 12 },
    "0.2": { farbe: "red; background:url(x)", dx: 99999, bild: "javascript:alert(1)" },
    "0.3": { bild: "data:image/png;base64,iVBORw0KGgo=", aus: true },
    "0.4": { bild: true },
    "../x": { dx: 5 },
    "0.5": { t: "div" },
    "0.6": "Unsinn",
  });
  assert.deepEqual(Object.keys(liste), ["0.1.0", "0.2", "0.3", "0.4"]);
  assert.equal(liste["0.1.0"].dx, 12.3);
  assert.equal(liste["0.1.0"].flaeche, "#206efb");
  assert.equal(liste["0.2"].farbe, undefined);
  assert.equal(liste["0.2"].bild, undefined);
  assert.equal(liste["0.2"].dx, 6000);
  assert.equal(liste["0.3"].aus, true);
  // Beim Speichern steht das Bild schon im Dokument; die Liste merkt sich nur, wo.
  const gespeichert = frei.serialisiereAenderungen(liste);
  assert.equal(gespeichert["0.3"].bild, true);
  assert.equal(liste["0.3"].bild.startsWith("data:image/png"), true);
  assert.equal(frei.zaehleAenderungen([liste, { "0.1": { dx: 1 } }, null]), 5);
});

test("Kontextmenue, Auswahl und Schutz der Masken im Modul", () => {
  assert.match(modul, /export function createKontextmenue\(host\)/);
  assert.match(modul, /event\.key === "ArrowRight" && doc\.activeElement\?\.getAttribute\("aria-haspopup"\)/);
  assert.match(modul, /closest\("mask, clipPath, defs, pattern, linearGradient, radialGradient, filter"\)/);
  assert.match(modul, /const GRIFFE = \["nw", "n", "ne", "e", "se", "s", "sw", "w"\];/);
  // Alt schaltet das Einrasten ab, Shift das Seitenverhaeltnis um.
  assert.match(modul, /const einrasten = !event\.altKey;/);
  assert.match(modul, /const seitenTreu = zug\.text \? event\.shiftKey : !event\.shiftKey;/);
  // Text bleibt Text: ein Klick setzt den Cursor, verschoben wird ueber den Griff.
  assert.match(modul, /if \(el\.hasAttribute\("data-field"\) \|\| el\.isContentEditable\) \{/);
  assert.doesNotMatch(modul, /[—–]/);
});

test("Studio: CI-Sperre, Badge, Bestaetigung vor Download und Druck", () => {
  assert.match(studio, /from "\.\/asset-freiform\.js\?v=/);
  // Hinweis beim Anfassen eines CI-Elements, Freigabe nur mit Haken.
  assert.match(studio, /<h3 id="as-ci-titel">CI-Element bearbeiten\?<\/h3>/);
  assert.match(studio, /data-ci-check><span>Ich weiche bewusst von der CI ab<\/span>/);
  assert.match(studio, /data-act="ci-freigeben" data-ci-ok disabled/);
  assert.match(studio, /if \(!istCiElement\(el\)\) return;\n    event\.preventDefault\(\);/);
  // Badge neben der Seite, als Werkzeug markiert: nie im Export, nie im Druck.
  assert.match(studio, /badge\.setAttribute\("data-as-chrome", ""\);/);
  assert.match(studio, /Nicht CI-konform/);
  // Vor Datei und Druck noch einmal ausdruecklich bestaetigen.
  assert.match(studio, /mitCiBestaetigung\("download", \(\) => download\(true\)\)/);
  assert.match(studio, /mitCiBestaetigung\("print", /);
  assert.match(studio, /data-cidl-check><span>Abweichungen geprüft<\/span>/);
  // Die Datei fuer den Kunden bekommt keine Liste, der gespeicherte Stand schon.
  assert.match(studio, /const doc = exportDocument\(\{ fuerDatei: true \}\);/);
  assert.match(studio, /if \(!opts\.fuerDatei && \(state\.ciFrei \|\| Object\.keys\(liste\)\.length\)\) \{/);
  assert.match(studio, /saved\.querySelector\("\.as-stage--memo\[data-as-frei\]"\)/);
  assert.match(studio, /const liste = bereinigeAenderungen\(daten\?\.el\);/);
  // Ein neuer Entwurf beginnt CI-konform.
  assert.match(studio, /state\.ciFrei = false;\n    state\.pruefZu = false;\n    freiVerlauf\.length = 0;/);
  // Rechtsklick in beiden Modi, Rueckgaengig fuer freie Aenderungen.
  assert.match(studio, /on\(overlay, "contextmenu", \(event\) => \{/);
  assert.match(studio, /label: "CI wiederherstellen"/);
  assert.match(studio, /if \(wieder \? freiWiederholen\(\) : freiRueckgaengig\(\)\) \{/);
  // Ausrichten im Ribbon, mit eigenen Zeichen.
  assert.match(studio, /knopf\("richte-mitte-h", "Horizontal zentrieren"/);
  assert.match(studio, /knopf\("verteile-x", "Horizontal verteilen", AUSRICHT_SVG\["verteilen-x"\], n < 3\)/);
  // Freie Aenderungen wirken vor jeder Messung auf Ueberlauf.
  assert.match(studio, /wendeFreiAenderungenAn\(area\);\n    if \(isMemo\) \{/);
});

test("Studio-CSS fuer die freie Bearbeitung ohne Zierrahmen", () => {
  const css = studio.slice(studio.indexOf("const FREI_CSS = `"), studio.indexOf("const CHROME_CSS = `"));
  assert.ok(css.length > 2000);
  assert.doesNotMatch(css, /border-(left|top|right|bottom)\s*:\s*[2-9]px/);
  assert.doesNotMatch(css, /border\s*:\s*[2-9]px/);
  assert.doesNotMatch(css, /dashed/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(studio, /\$\{STAGE_CSS\}\\n\$\{FREI_CSS\}\\n\$\{printCss\(isMemo\)\}/);
  // Der Export traegt kein Studio-CSS.
  assert.doesNotMatch(studio.slice(studio.indexOf("  function exportDocument("), studio.indexOf("  function memoOutputReady(")), /FREI_CSS/);
});

test("CI-Lauf prueft das Modul mit", () => {
  assert.match(workflow, /- "asset-freiform\.js"/);
  assert.match(workflow, /node --check asset-freiform\.js/);
  assert.match(workflow, /tests\/asset-freiform\.test\.mjs/);
});
