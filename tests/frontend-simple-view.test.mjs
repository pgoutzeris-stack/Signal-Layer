import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { simpleCurrentVersionLabel, simpleLaneCountLabel } from "../simple-view-state.mjs";

const simpleFrontend = readFileSync(new URL("../simple-mode.js", import.meta.url), "utf8");

test("Simple shows the complete lane count without filters", () => {
  assert.equal(simpleLaneCountLabel(56, 56, false), "56");
});

test("Simple makes a filtered subset explicit", () => {
  assert.equal(simpleLaneCountLabel(4, 56, true), "4 von 56");
});

test("current version label uses the live-table count", () => {
  const versions = [{ version: "1.9", signals: 70, archived_signals: 70 }];
  assert.equal(simpleCurrentVersionLabel(versions, "1.9"), "Aktueller Stand · 70 Signale");
});

test("a valid ROOTS offering remains visible without a rejected explanation", () => {
  assert.match(simpleFrontend, /signal\.roots_offering \? `<div class="finding-offering">/);
  assert.match(simpleFrontend, /signal\.roots_link_de \? `<div class="finding-offering-dock">/);
});
