import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { assetAuthorsBadgeHtml, initialsOf, relativeWhen } from "../asset-authors.mjs";

const backend = readFileSync(new URL("../supabase/functions/signal-layer/index.ts", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const jetzt = Date.parse("2026-08-28T12:00:00Z");
const vor = (minuten) => new Date(jetzt - minuten * 60000).toISOString();

test("der Zeitabstand steht in der Einheit, die er verdient", () => {
  assert.equal(relativeWhen(vor(0), jetzt), "gerade eben");
  assert.equal(relativeWhen(vor(42), jetzt), "vor 42 Min");
  assert.equal(relativeWhen(vor(180), jetzt), "vor 3 Std");
  assert.equal(relativeWhen(vor(60 * 24 * 2), jetzt), "vor 2 Tagen");
  assert.equal(relativeWhen("", jetzt), "");
});

test("je Person ein Gesicht, der juengste Entwurf gibt den Zeitpunkt", () => {
  const html = assetAuthorsBadgeHtml([
    { user_id: "a", name: "Pano Goutzeris", avatar_url: "https://x/a.png", asset_id: "1", kind: "linkedin", created_at: vor(300) },
    { user_id: "a", name: "Pano Goutzeris", avatar_url: "https://x/a.png", asset_id: "2", kind: "memo", created_at: vor(90) },
    { user_id: "b", name: "Maria Schmidt", avatar_url: "", asset_id: "3", kind: "linkedin", created_at: vor(600) },
  ], (v) => String(v ?? ""), jetzt);
  // Zwei Personen, nicht drei Entwuerfe.
  assert.equal((html.match(/data-asset-author=/g) || []).length, 2);
  // Der neueste Entwurf der Person fuehrt den Klick.
  assert.match(html, /data-asset-author="2"/);
  assert.match(html, /vor 2 Std/);
  // Ohne Bild stehen die Initialen da.
  assert.match(html, /MS<\/span>/);
});

test("mehr als drei Personen werden zu einer Zahl", () => {
  const liste = ["a", "b", "c", "d", "e"].map((id, i) => ({
    user_id: id, name: `Person ${id}`, asset_id: id, kind: "linkedin", created_at: vor(i * 10),
  }));
  const html = assetAuthorsBadgeHtml(liste, (v) => String(v ?? ""), jetzt);
  assert.equal((html.match(/data-asset-author=/g) || []).length, 3);
  assert.match(html, /\+2</);
});

test("leere Liste erzeugt keinen leeren Rahmen", () => {
  assert.equal(assetAuthorsBadgeHtml([], (v) => v), "");
  assert.equal(assetAuthorsBadgeHtml(null, (v) => v), "");
});

test("Initialen greifen auf zwei Bestandteile zu", () => {
  assert.equal(initialsOf("Pano Goutzeris"), "PG");
  assert.equal(initialsOf("Pano"), "P");
  assert.equal(initialsOf(""), "RT");
});

test("Server liefert Gesichter zu Artikeln und Entwuerfen", () => {
  assert.match(backend, /case "list_asset_authors"/);
  assert.match(backend, /async function assetAuthorsByIds/);
  // Dasselbe Profilbild wie im Intranet.
  assert.match(backend, /schema\("users"\)\.from\("profiles"\)\s*\n\s*\.select\("id,full_name,kuerzel,avatar_url"\)/);
  assert.match(backend, /creator_avatar_url/);
  // Ein Abruf fuer alle Karten, nicht einer je Karte.
  assert.match(backend, /article_ids/);
});

test("ein Klick auf das Gesicht oeffnet genau diesen Entwurf", () => {
  assert.match(appJs, /data-asset-author/);
  assert.match(appJs, /assetId,/);
  assert.match(styles, /\.asset-author \{/);
});

test("die Gesichter stehen unten rechts und ohne Zeitzeile", () => {
  const modul = readFileSync(new URL("../asset-authors.mjs", import.meta.url), "utf8");
  // Der Zeitpunkt steht im Titel des Gesichts, nicht als sichtbare Zeile.
  assert.ok(!modul.includes("<small>${esc(wann)}</small>"));
  assert.match(modul, /karte\.insertAdjacentHTML\("beforeend", html\)/);
  assert.match(styles, /\.asset-authors \{ position: absolute; right: \.85rem; bottom: \.7rem/);
  // Ohne Platz laege die letzte Textzeile unter den Bildern.
  assert.match(styles, /:has\(\.asset-authors\)[^}]*padding-bottom: 2\.3rem/);
});
