import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("naechster Termin aus dem taeglichen Cron-Ausdruck", () => {
  const quelle = app.slice(app.indexOf("export function naechsterCronTermin"), app.indexOf("function kurzDatum"));
  const naechsterCronTermin = new Function(`${quelle.replace("export ", "")}; return naechsterCronTermin;`)();
  const vorher = naechsterCronTermin("0 4 * * *", new Date("2026-10-13T03:00:00Z"));
  assert.equal(vorher.toISOString(), "2026-10-13T04:00:00.000Z");
  const nachher = naechsterCronTermin("0 4 * * *", new Date("2026-10-13T18:00:00Z"));
  assert.equal(nachher.toISOString(), "2026-10-14T04:00:00.000Z");
  assert.equal(naechsterCronTermin("*/5 * * * *"), null);
  assert.equal(naechsterCronTermin("0 10,15 * * *", new Date("2026-10-13T12:00:00Z")).toISOString(), "2026-10-13T15:00:00.000Z");
  assert.equal(naechsterCronTermin("0 10,15 * * *", new Date("2026-10-13T16:00:00Z")).toISOString(), "2026-10-14T10:00:00.000Z");
});

test("Status-Popup traegt die Kurzfassung", () => {
  assert.match(html, /id="simple-lauf-kurz"/);
  assert.match(app, /renderSimpleLaufKurz\(run\);/);
  assert.match(app, /Signale`/);
});
