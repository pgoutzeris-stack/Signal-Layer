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
  assert.match(backend, /\.select\("id,email,full_name,kuerzel,avatar_url"\)/);
  // Das Debug-Konto ist kein Kollege und erscheint auf keiner Karte.
  assert.match(backend, /claude-debug@/);
  assert.match(backend, /creator_avatar_url/);
  // Ein Abruf fuer alle Karten, nicht einer je Karte.
  assert.match(backend, /article_ids/);
});

test("ein Klick auf das Gesicht oeffnet die Entwuerfe dieses Artikels", () => {
  assert.match(appJs, /data-asset-author/);
  // Die Uebersicht zuerst: dort steht jeder Entwurf mit Person und Zeitpunkt.
  assert.match(appJs, /showDrafts: true/);
  // Im geoeffneten Artikel steht die Kennung nicht an der Karte.
  assert.match(appJs, /detailArticle\?\.id/);
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

test("die Karte zeigt den Verantwortlichen, nicht jeden Ersteller", async () => {
  const modul = readFileSync(new URL("../asset-authors.mjs", import.meta.url), "utf8");
  const studio = readFileSync(new URL("../asset-studio.js", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../supabase/migrations/20260830140000_generated_assets_owner.sql", import.meta.url),
    "utf8",
  );
  // Die Karte liest die Uebernahmen, nicht die Entwuerfe.
  assert.match(modul, /antwort\.owners\) \|\| \{\}/);
  assert.match(modul, /antwort\.owners && antwort\.owners\[articleId\]/);
  assert.match(modul, /Übernommen von/);
  // Server und Datenbank fuehren die Uebernahme.
  assert.match(migration, /add column if not exists owner_id uuid/);
  assert.match(backend, /case "set_asset_owner"/);
  assert.match(backend, /owners: proArtikelOwner/);
  // Freigeben darf nur, wer uebernommen hat.
  assert.match(backend, /Nur wer den Entwurf übernommen hat, kann ihn freigeben/);
  // Im Studio steht der Knopf neben dem Speichern.
  assert.match(studio, /data-act="own"/);
  assert.match(studio, /Als meinen übernehmen/);
  assert.match(studio, /data-act="save"><i class="fa-regular fa-floppy-disk"><\/i>Entwurf speichern/);
});

test("der Entwurf stellt Text und Asset je zur Haelfte", () => {
  const studio = readFileSync(new URL("../asset-studio.js", import.meta.url), "utf8");
  assert.match(studio, /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
  assert.match(studio, /class="as-linkedin-col"/);
  // Die Leiste ueber der Folie ist entfallen.
  assert.ok(!studio.includes("${editable ? slideTools(slide, index) : \"\"}"), "keine Leiste ueber der Folie");
  // Ohne Hoehenmass wurde nur nach Breite skaliert, die Folie lief unten raus.
  assert.match(studio, /const nutzbar = gemessen > 80/);
  assert.match(studio, /Math\.min\(1, safeW \/ w, nutzbar \/ h\)/);
});
