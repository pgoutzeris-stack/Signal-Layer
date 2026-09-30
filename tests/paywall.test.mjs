import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const paywall = await import("../supabase/functions/signal-layer/paywall.ts");
const migration = readFileSync(new URL("../supabase/migrations/20260930150000_paywall_erkennung.sql", import.meta.url), "utf8");

// Schnipsel aus gespeicherten Artikeln der Pruefung vom 30.09.2026.
const HORIZONT = "Die Agentur gewinnt den Etat. - Vollzugriff auf HORIZONT Online mit allen Artikeln\n- E-Paper der Zeitung und Magazine\n\nHORIZONT Digital-Mehrplatzlizenz für Ihr Team";
const FAZ_KOPF = "Der Konzern plant den Umbau. FAZ+ Zugang zu allen FAZ+ Beiträgen (Originalpreis: 13,80 € ) jetzt nur 0,99 € Mit einem Klick online kündbar WEITER Login Das Beste von FAZ+";
const NEW_BUSINESS = "Die Kampagne startet im Herbst. Jetzt Angebot wählen und weiterlesen! ## 2 Monate Zugriff auf alle Beitr�ge new-business Digital-Mehrplatzlizenz f�r Ihr Team";

test("Angebotskästen der Verlage gelten als Paywall", () => {
  assert.equal(paywall.paywallMerkmal(HORIZONT), "Vollzugriff-Angebot");
  assert.equal(paywall.paywallMerkmal(FAZ_KOPF), "FAZ+-Preis");
  assert.equal(paywall.paywallMerkmal(NEW_BUSINESS), "Angebot wählen und weiterlesen");
  assert.equal(paywall.paywallMerkmal("Geldanlage: KI- und Software-Aktien: Wer killt hier wen? | Capital+"), "Capital+");
  assert.equal(paywall.paywallMerkmal("Trotzdem geht der Kanzler lächelnd in den Urlaub.\n\nLesen Sie mit BILDPlus, warum Merz so gut gelaunt ist"), "BILDplus");
  assert.equal(paywall.paywallMerkmal("Testangebot Direkt weiterlesen\n2 Monate kostenlos testen Sie sind bereits Abonnent? Hier anmelden"), "Probeabo-Angebot");
});

test("ein Merkmal nach einem langen Artikel ist Seitenrahmen, keine Paywall", () => {
  const artikel = "Der Händler meldet ein Umsatzplus. ".repeat(100);
  assert.ok(artikel.length > paywall.PAYWALL_ANREISSER_MAX);
  assert.equal(paywall.paywallMerkmal(artikel + FAZ_KOPF), null);
  // Die FAZ-Box nach 400 Zeichen Anreisser zaehlt, auch wenn danach Tausende
  // Zeichen Empfehlungen folgen.
  assert.equal(paywall.paywallMerkmal("Kurzer Anreißer. ".repeat(25) + FAZ_KOPF + " Empfehlung. ".repeat(400)), "FAZ+-Preis");
});

test("Navigation und Werbung für Abos lösen nichts aus", () => {
  assert.equal(paywall.paywallMerkmal("Startseite Exklusiv für Abonnenten Newsletter Podcasts ePaper. Der Artikel beginnt hier."), null);
  assert.equal(paywall.paywallMerkmal("Netflix hat bereits 300 Millionen Abonnenten weltweit."), null);
  assert.equal(paywall.paywallMerkmal("*Continue reading this article on digiday.com. Sign up for Digiday newsletters.*"), null);
  assert.equal(paywall.paywallMerkmal("The post Wenn Heidi Klum auf den Gabelstapler steigt appeared first on rundschau.de ."), null);
});

test("isAccessibleForFree aus JSON-LD, auch als String und im @graph", () => {
  const ld = (obj) => `<html><head><script type="application/ld+json">${JSON.stringify(obj)}</script></head><body></body></html>`;
  assert.equal(paywall.paywallAusHtml(ld({ "@type": "NewsArticle", isAccessibleForFree: "False" })), true);
  assert.equal(paywall.paywallAusHtml(ld({ "@type": "NewsArticle", isAccessibleForFree: false })), true);
  assert.equal(paywall.paywallAusHtml(ld({ "@type": "NewsArticle", isAccessibleForFree: true })), false);
  assert.equal(paywall.paywallAusHtml(ld({ "@graph": [{ "@type": "WebSite" }, { "@type": ["NewsArticle"], isAccessibleForFree: "false" }] })), true);
  assert.equal(paywall.paywallAusHtml(ld({
    "@type": "NewsArticle", isAccessibleForFree: true,
    hasPart: { "@type": "WebPageElement", isAccessibleForFree: false, cssSelector: ".paywall" },
  })), true);
  assert.equal(paywall.paywallAusHtml(ld({ "@type": "NewsArticle", headline: "Ohne Angabe" })), null);
  assert.equal(paywall.paywallAusHtml("<html><body><p>Kein JSON-LD</p></body></html>"), null);
});

test("empfohlene Artikel im JSON-LD machen einen freien Artikel nicht kostenpflichtig", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    "@type": "ItemList",
    itemListElement: [{ "@type": "NewsArticle", isAccessibleForFree: false }],
  })}</script>`;
  assert.equal(paywall.paywallAusHtml(html), null);
});

test("kaputtes JSON-LD: die Angabe wird trotzdem gelesen", () => {
  const html = `<script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":"False","headline":"Ab"c"}</script>`;
  assert.equal(paywall.paywallAusHtml(html), true);
});

test("Befund: Markierung zählt nur bei kurzem Text", () => {
  assert.deepEqual(paywall.paywallBefund({ title: "SZ", content: "Kurzer Anreißer.", cleaned: "Kurzer Anreißer.", markiert: true }),
    { erkannt: true, beleg: "Seite als kostenpflichtig markiert" });
  const voll = "Der vollständige Artikel steht im HTML. ".repeat(80);
  assert.deepEqual(paywall.paywallBefund({ title: "FAZ", content: voll, cleaned: voll, markiert: true }), { erkannt: false, beleg: null });
  assert.deepEqual(paywall.paywallBefund({ title: "Nur Titel", content: "Nur Titel", cleaned: "", markiert: true }),
    { erkannt: true, beleg: "Seite als kostenpflichtig markiert" });
  assert.deepEqual(paywall.paywallBefund({ title: "Frei", content: "Kurz.", cleaned: "Kurz.", markiert: false }), { erkannt: false, beleg: null });
  assert.deepEqual(paywall.paywallBefund({ title: "X", content: HORIZONT, cleaned: "", markiert: null }), { erkannt: true, beleg: "Vollzugriff-Angebot" });
});

test("die Datenbank nutzt dieselben Muster und Grenzen wie paywall.ts", () => {
  const block = migration.match(/function signal_layer\.paywall_merkmal[\s\S]*?limit 1/)?.[0] || "";
  const sql = [...block.matchAll(/\('((?:[^']|'')*)', '((?:[^']|'')*)'\)/g)].map((m) => [m[1].replace(/''/g, "'"), m[2].replace(/''/g, "'")]);
  assert.deepEqual(sql, paywall.PAYWALL_MERKMALE.map(([beleg, muster]) => [beleg, muster]));
  assert.match(block, new RegExp(`between 1 and ${paywall.PAYWALL_ANREISSER_MAX}`));
  const befund = migration.match(/function signal_layer\.paywall_befund[\s\S]*?\$\$;/)?.[0] || "";
  assert.equal((befund.match(new RegExp(`laenge < ${paywall.PAYWALL_MARKIERT_MAX}`, "g")) || []).length, 2);
});

test("die Pill erscheint nur bei erkannter Paywall und trägt den Beleg", async () => {
  const { paywallPillHtml } = await import("../paywall-pill.mjs");
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  assert.equal(paywallPillHtml({ paywall_detected: false }, esc), "");
  assert.equal(paywallPillHtml(null, esc), "");
  const html = paywallPillHtml({ paywall_detected: true, paywall_evidence: "FAZ+-Preis" }, esc);
  assert.match(html, /class="tag tag--paywall"/);
  assert.match(html, /Paywall erkannt/);
  assert.match(html, /data-pill-info="Beleg: FAZ\+-Preis"/);
});

const seite = (ld, body = "") => `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body>${body}</body></html>`;
const worte = (n) => Array.from({ length: n }, (_, i) => `Wort${i}`).join(" ");

test("Wortzahl der Seite entscheidet: Anreißer gegen vollständigen Text", () => {
  // SZ: 469 Wörter laut Seite, bei uns 68.
  const sz = seite({ "@type": "NewsArticle", isAccessibleForFree: false, wordCount: 469 });
  assert.equal(paywall.paywallAusHtml(sz, worte(68)), true);
  // FAZ: 206 Wörter laut Seite, bei uns 222 (mit Seitenresten).
  const faz = seite({ "@type": "NewsArticle", isAccessibleForFree: "False", wordCount: "206" });
  assert.equal(paywall.paywallAusHtml(faz, worte(222)), false);
});

test("liefert die Seite den gesperrten Teil im HTML, ist es keine Paywall-Lücke", () => {
  // FashionUnited: .member-content enthält den ganzen Artikel, das Login-Fenster kommt erst im Browser.
  const voll = `<div class="member-content css-x"><p>${"Der Absatz trägt echten Text. ".repeat(40)}</p><div><p>Weiter.</p></div></div><form>E-Mail-Adresse</form>`;
  const fu = seite({ "@type": "NewsArticle", isAccessibleForFree: false,
    hasPart: { "@type": "WebPageElement", isAccessibleForFree: false, cssSelector: ".member-content" } }, voll);
  assert.ok(paywall.seitenZugang(fu).gesperrt >= paywall.PAYWALL_GELIEFERT_MIN);
  assert.equal(paywall.paywallAusHtml(fu, "Der Absatz trägt echten Text. ".repeat(40)), false);
  // WiWo: im gesperrten Bereich steht nur der Werbekasten.
  const werbung = `<div class="hmg-paywalled">${"Jetzt WiWo+ testen. ".repeat(20)}</div>`;
  const wiwo = seite({ "@type": "NewsArticle", isAccessibleForFree: false,
    hasPart: { "@type": "WebPageElement", isAccessibleForFree: false, cssSelector: ".hmg-paywalled" } }, werbung);
  assert.equal(paywall.paywallAusHtml(wiwo, worte(80)), true);
});

test("ein langer articleBody bei kurzem Text ist ein Extraktionsfehler, keine Paywall", () => {
  const adweek = seite({ "@type": "NewsArticle", isAccessibleForFree: false, articleBody: "Voller Artikeltext. ".repeat(250) });
  assert.equal(paywall.paywallAusHtml(adweek, "Nur der Titel"), false);
  // Handelsblatt: articleBody ist selbst nur der Anreißer.
  const hb = seite({ "@type": "NewsArticle", isAccessibleForFree: false, articleBody: "Anreißer. ".repeat(120) });
  assert.equal(paywall.paywallAusHtml(hb, "Anreißer. ".repeat(120)), true);
});
