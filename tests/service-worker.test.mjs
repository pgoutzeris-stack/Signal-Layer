import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const HERKUNFT = "https://pgoutzeris-stack.github.io";
const SCOPE = `${HERKUNFT}/Signal-Layer/`;

/** Speicher wie CacheStorage, nur so weit wie sw.js ihn braucht. */
function neuerSpeicher() {
  const eintraege = new Map();
  const speicher = {
    async put(anfrage, antwort) { eintraege.set(anfrage.url, await antwort.clone().text()); },
    async match(anfrage, optionen = {}) {
      const url = new URL(anfrage.url);
      for (const [schluessel, text] of eintraege) {
        const k = new URL(schluessel);
        if (schluessel === anfrage.url || (optionen.ignoreSearch && k.origin + k.pathname === url.origin + url.pathname)) return new Response(text, { status: 200 });
      }
      return undefined;
    },
    async keys() { return [...eintraege.keys()].map((url) => new Request(url)); },
    async delete(anfrage) { return eintraege.delete(anfrage.url); },
    async add(url) { eintraege.set(new URL(url, SCOPE).href, "<h1>Signal Layer ist gerade nicht erreichbar</h1>"); },
  };
  return { eintraege, caches: { open: async () => speicher, keys: async () => ["signal-layer-rueckfall-v1"], delete: async () => true } };
}

async function ladeWorker(netz) {
  const quelle = await readFile(new URL("../sw.js", import.meta.url), "utf8");
  const zuhoerer = {};
  const { eintraege, caches } = neuerSpeicher();
  const self = {
    location: { origin: HERKUNFT },
    registration: { scope: SCOPE, unregister: async () => true },
    clients: { claim: async () => {} },
    skipWaiting: () => {},
    addEventListener: (typ, fn) => { zuhoerer[typ] = fn; },
  };
  vm.runInNewContext(quelle, { self, caches, fetch: netz, Request, Response, URL, Promise, console });
  const warte = [];
  zuhoerer.install({ waitUntil: (p) => warte.push(p) });
  await Promise.all(warte);
  const abruf = async (url, { method = "GET", mode = "cors" } = {}) => {
    let antwort = null;
    zuhoerer.fetch({ request: { url, method, mode }, respondWith: (p) => { antwort = p; } });
    return antwort ? await antwort : null;
  };
  return { abruf, eintraege };
}

test("gute Antwort geht durch und wird abgelegt", async () => {
  const { abruf, eintraege } = await ladeWorker(async () => new Response("app v1", { status: 200 }));
  const antwort = await abruf(`${SCOPE}app.js?v=1`);
  assert.equal(await antwort.text(), "app v1");
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(eintraege.has(`${SCOPE}app.js?v=1`));
});

test("bei Pages-Fehler kommt die abgelegte Fassung", async () => {
  let kaputt = false;
  const { abruf } = await ladeWorker(async () => kaputt ? new Response("We're having a really bad day.", { status: 503 }) : new Response("<main>Tool</main>", { status: 200 }));
  await abruf(`${SCOPE}?v=1&cb=a`, { mode: "navigate" });
  await new Promise((r) => setTimeout(r, 10));
  kaputt = true;
  const antwort = await abruf(`${SCOPE}?v=1&cb=b`, { mode: "navigate" });
  assert.equal(await antwort.text(), "<main>Tool</main>");
});

test("ohne abgelegte Fassung kommt die eigene Stoerungsseite statt des Einhorns", async () => {
  const { abruf } = await ladeWorker(async () => new Response("We're having a really bad day.", { status: 503 }));
  const antwort = await abruf(`${SCOPE}?v=1`, { mode: "navigate" });
  assert.match(await antwort.text(), /Signal Layer ist gerade nicht erreichbar/);
});

test("Netz ganz weg: ebenfalls Rueckfall", async () => {
  const { abruf } = await ladeWorker(async () => { throw new TypeError("Failed to fetch"); });
  const antwort = await abruf(`${SCOPE}`, { mode: "navigate" });
  assert.match(await antwort.text(), /nicht erreichbar/);
});

test("Supabase, CDNs und POST laufen am Worker vorbei", async () => {
  const { abruf } = await ladeWorker(async () => new Response("x"));
  assert.equal(await abruf("https://csmguwcvzreefluhahyu.supabase.co/functions/v1/signal-layer"), null);
  assert.equal(await abruf("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"), null);
  assert.equal(await abruf(`${SCOPE}index.html`, { method: "POST" }), null);
  assert.equal(await abruf(`${SCOPE}index.html?probe=1`), null);
});

test("je Pfad bleibt nur die neueste Fassung", async () => {
  const { abruf, eintraege } = await ladeWorker(async (anfrage) => new Response(anfrage.url, { status: 200 }));
  await abruf(`${SCOPE}app.js?v=1`);
  await new Promise((r) => setTimeout(r, 10));
  await abruf(`${SCOPE}app.js?v=2`);
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(!eintraege.has(`${SCOPE}app.js?v=1`));
  assert.ok(eintraege.has(`${SCOPE}app.js?v=2`));
});

test("das Tool meldet den Worker an", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /navigator\.serviceWorker\.register\("\.\/sw\.js", \{ scope: "\.\/" \}\)/);
  const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(sw, /const NOTAUS = false;/);
});
