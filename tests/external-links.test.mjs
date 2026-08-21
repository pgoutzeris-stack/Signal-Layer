import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  ROOTS_PARENT_ORIGINS,
  externalUrlFromValue,
  hasExternalSource,
  parentOriginCandidates,
} from "../external-links.mjs";

const frontend = readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("jede Adresse aus dem Bestand wird zu einer öffenbaren URL oder zu nichts", () => {
  assert.equal(externalUrlFromValue("https://www.lebensmittelzeitung.net/x"), "https://www.lebensmittelzeitung.net/x");
  // Alte Artikel liegen ohne TLS im Bestand: http darf nicht verworfen werden.
  assert.equal(externalUrlFromValue("http://alte-fachseite.de/artikel"), "http://alte-fachseite.de/artikel");
  // Ohne Schema gespeicherte Adressen landeten bisher auf der eigenen 404.
  assert.equal(externalUrlFromValue("www.horizont.net/news/123"), "https://www.horizont.net/news/123");
  assert.equal(externalUrlFromValue("//cdn.example.com/a"), "https://cdn.example.com/a");
  // Manuelle Signale haben keine Originalquelle.
  assert.equal(externalUrlFromValue("manual://signal/11111111-1111-1111-1111-111111111111"), null);
  assert.equal(externalUrlFromValue("#"), null);
  assert.equal(externalUrlFromValue(""), null);
  assert.equal(externalUrlFromValue("/relativ/pfad"), null);
  assert.equal(externalUrlFromValue("mailto:info@roots-consultants.com"), "mailto:info@roots-consultants.com");
});

test("die Pille erscheint nur, wenn es wirklich etwas zu öffnen gibt", () => {
  assert.equal(hasExternalSource({ url: "https://example.com/a" }), true);
  assert.equal(hasExternalSource({ url: "http://example.com/a" }), true);
  assert.equal(hasExternalSource({ url: "manual://signal/abc" }), false);
  assert.equal(hasExternalSource({}), false);
  assert.equal(hasExternalSource(null), false);
  assert.match(frontend, /\$\{hasExternalSource\(article\) \? `<a class="tag tag--source"/);
});

test("das Elternfenster wird auch ohne Referrer erkannt", () => {
  // Der Intranet-iframe trägt referrerpolicy="no-referrer": ohne
  // ancestorOrigins blieb die Erkennung blind, und in der Tauri-App tat der
  // Knopf deshalb nichts.
  assert.deepEqual(
    parentOriginCandidates({ ancestorOrigins: ["https://pgoutzeris-stack.github.io"], referrer: "", ownOrigin: "https://pgoutzeris-stack.github.io" }),
    ["https://pgoutzeris-stack.github.io"],
  );
  // Firefox kennt ancestorOrigins nicht; dann trägt die eigene Herkunft.
  assert.deepEqual(
    parentOriginCandidates({ ownOrigin: "https://pgoutzeris-stack.github.io" }),
    ["https://pgoutzeris-stack.github.io"],
  );
  assert.deepEqual(parentOriginCandidates({ referrer: "https://tauri.localhost/x" }), ["https://tauri.localhost"]);
  // Fremde Fenster bekommen nie einen Link zu öffnen.
  assert.deepEqual(parentOriginCandidates({ ancestorOrigins: ["https://boese.example"], ownOrigin: "https://boese.example" }), []);
  assert.ok(ROOTS_PARENT_ORIGINS.has("tauri://localhost"));
});

test("die Öffnen-Kette hört erst auf, wenn eine Stufe bestätigt", () => {
  // Reihenfolge: Intranet (mit Rückmeldung), Tauri-Brücke, window.open,
  // Ankerklick, zuletzt Zwischenablage samt Meldung.
  assert.match(frontend, /if \(imRahmen && await openViaParent\(url\)\) return true;/);
  assert.match(frontend, /if \(await openViaTauri\(url\)\) return true;/);
  assert.match(frontend, /if \(openViaWindow\(url\)\) return true;/);
  assert.match(frontend, /if \(!imRahmen && openViaAnchor\(url\)\) return true;/);
  assert.match(frontend, /return await copyUrlFallback\(url\);/);
  // Ohne Bestätigung des Intranets gilt der Versuch als gescheitert.
  assert.match(frontend, /const PARENT_OPEN_ACK = "roots-open-url-result";/);
  assert.match(frontend, /setTimeout\(\(\) => schliesse\(false\), PARENT_OPEN_TIMEOUT_MS\)/);
  // Alle bekannten Namen der Tauri-Brücke, nicht nur __TAURI_INTERNALS__.
  assert.match(frontend, /window\.__TAURI__\?\.opener\?\.openUrl/);
  assert.match(frontend, /plugin:opener\|open_url/);
  assert.match(frontend, /plugin:shell\|open/);
  // Der Klick wird auch bei schemalosen Adressen abgefangen.
  assert.doesNotMatch(frontend, /if \(!url \|\| url === "#" \|\| !\/\^https\?:/);
});
