import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  advancedVersionLabel,
  simpleCurrentVersionLabel,
  simpleHistoricalVersionLabel,
  simpleLaneCountLabel,
  simpleVersionDateLabel,
  simpleVersionMenu,
} from "../simple-view-state.mjs";

const simpleFrontend = readFileSync(new URL("../simple-mode.js", import.meta.url), "utf8");
const appFrontend = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("Simple shows the complete lane count without filters", () => {
  assert.equal(simpleLaneCountLabel(56, 56, false), "56");
});

test("Simple makes a filtered subset explicit", () => {
  assert.equal(simpleLaneCountLabel(4, 56, true), "4 von 56");
});

test("current version label uses the live-table count", () => {
  const versions = [{ version: "2.5", signals: 57, archived_signals: 57, archived_articles: 1000, first_seen_at: "2026-08-05T08:05:23Z" }];
  assert.equal(simpleCurrentVersionLabel(versions, "2.5"), "2.5 · aktuell · 57 Signale");
});

test("the version menu lists the current pipeline only once", () => {
  const versions = [
    { version: "2.5", signals: 57, archived_signals: 57, archived_articles: 1000, first_seen_at: "2026-08-05T08:05:23Z" },
    { version: "2.4", signals: 0, archived_signals: 0, archived_articles: 1, first_seen_at: "2026-08-05T07:59:54Z" },
    { version: "2.2", signals: 0, archived_signals: 49, archived_articles: 1000, first_seen_at: "2026-08-04T21:21:18Z" },
  ];
  const menu = simpleVersionMenu(versions, "2.5");
  assert.equal(menu.current.version, "2.5");
  assert.deepEqual(menu.historical.map((entry) => entry.version), ["2.4", "2.2"]);
  assert.equal(simpleHistoricalVersionLabel(menu.historical[0]), "2.4 · 0 Signale");
  assert.equal(simpleHistoricalVersionLabel(menu.historical[1]), "2.2 · 49 Signale");
  assert.equal(simpleVersionDateLabel(menu.historical[0]), new Date("2026-08-05T07:59:54Z").toLocaleDateString("de-DE"));
  assert.doesNotMatch(simpleHistoricalVersionLabel(menu.historical[0]), /Testlauf|Artikel/);
  assert.match(simpleFrontend, /simpleVersionMenu\(versionList, currentVersionLabel\)/);
  assert.match(simpleFrontend, /data-date=/);
  assert.match(simpleFrontend, /historical\.map/);
});

test("advanced version labels count Signale and keep the date for hover", () => {
  assert.equal(advancedVersionLabel({ version: "v12", article_count: 12 }, "v12"), "v12 · aktuell · 12 Signale");
  assert.equal(advancedVersionLabel({ version: "v11", article_count: 8 }, "v12"), "v11 · 8 Signale");
  assert.match(appFrontend, /advancedVersionLabel/);
  assert.match(appFrontend, /roots-select-info/);
  assert.match(appFrontend, /fa-circle-info/);
  assert.match(html, /roots-select-info-tip/);
  assert.doesNotMatch(appFrontend, /Aktive Version/);
  assert.doesNotMatch(appFrontend, /\$\{[^}]*\} Artikel ·/);
});

test("a valid ROOTS offering remains visible without a rejected explanation", () => {
  assert.match(simpleFrontend, /signal\.roots_offering \? `<div class="finding-offering">/);
  assert.match(simpleFrontend, /signal\.roots_link_de \? `<div class="finding-offering-dock">/);
});
