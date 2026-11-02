/*
 * Rueckfall fuer Stoerungen bei GitHub Pages.
 *
 * Das Frontend liegt auf GitHub Pages, die Daten in Supabase. Faellt Pages
 * aus, liefert GitHub eine eigene Fehlerseite ("Unicorns have taken over")
 * und das Tool startet gar nicht, obwohl Supabase normal antwortet.
 *
 * Deshalb: Dateien dieses Tools immer zuerst frisch vom Netz holen und jede
 * gute Antwort zusaetzlich ablegen. Antwortet Pages mit einem Fehler oder gar
 * nicht, kommt die zuletzt abgelegte Fassung. Gibt es noch keine, zeigt eine
 * eigene Seite die Stoerung und versucht es selbst erneut.
 *
 * Supabase, CDNs und alles ausser GET laufen unveraendert durch.
 *
 * Notschalter: die Zeile mit NOTAUS auf true setzen und deployen. Der Worker
 * meldet sich dann ab und loescht seinen Speicher.
 */
const NOTAUS = false;
const SPEICHER = "signal-layer-rueckfall-v1";
const STOERUNGSSEITE = "./stoerung.html";
// Alles unter pgoutzeris-stack.github.io: das Tool selbst und die Bausteine
// aus dem Intranet (Anmeldebruecke, Favicon).
const EIGENE_HERKUNFT = self.location.origin;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  if (NOTAUS) return;
  event.waitUntil(caches.open(SPEICHER).then((speicher) => speicher.add(STOERUNGSSEITE)).catch(() => null));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const namen = await caches.keys();
    await Promise.all(namen.filter((name) => NOTAUS || (name.startsWith("signal-layer-rueckfall-") && name !== SPEICHER)).map((name) => caches.delete(name)));
    if (NOTAUS) {
      await self.registration.unregister();
      return;
    }
    await self.clients.claim();
  })());
});

/** Gleicher Pfad, anderer ?v= oder cb=: nur die neueste Fassung behalten. */
async function ablegen(anfrage, antwort) {
  const speicher = await caches.open(SPEICHER);
  const url = new URL(anfrage.url);
  const alte = await speicher.keys();
  await Promise.all(alte
    .filter((eintrag) => {
      const alt = new URL(eintrag.url);
      return alt.origin === url.origin && alt.pathname === url.pathname && alt.search !== url.search;
    })
    .map((eintrag) => speicher.delete(eintrag)));
  await speicher.put(anfrage, antwort);
}

async function ausSpeicher(anfrage) {
  const speicher = await caches.open(SPEICHER);
  return (await speicher.match(anfrage)) || (await speicher.match(anfrage, { ignoreSearch: true })) || null;
}

async function beantworte(anfrage, istSeite) {
  let antwort = null;
  try {
    antwort = await fetch(anfrage);
  } catch (_) {
    antwort = null;
  }
  // Weiterleitungen (etwa /Signal-Layer ohne Schraegstrich) gehen unveraendert
  // an den Browser; bei Seitenaufrufen kommen sie als "opaqueredirect".
  if (antwort && (antwort.type === "opaqueredirect" || (antwort.status >= 300 && antwort.status < 400))) return antwort;
  if (antwort && antwort.ok) {
    // Ablegen darf die Antwort nicht verzoegern.
    ablegen(anfrage, antwort.clone()).catch(() => null);
    return antwort;
  }
  const gespeichert = await ausSpeicher(anfrage);
  if (gespeichert) return gespeichert;
  if (istSeite) {
    const seite = await ausSpeicher(new Request(new URL(STOERUNGSSEITE, self.registration.scope).href));
    if (seite) return seite;
  }
  return antwort || Response.error();
}

self.addEventListener("fetch", (event) => {
  if (NOTAUS) return;
  const anfrage = event.request;
  if (anfrage.method !== "GET") return;
  const url = new URL(anfrage.url);
  if (url.origin !== EIGENE_HERKUNFT) return;
  // Die Stoerungsseite fragt mit ?probe= nach, ob Pages wieder antwortet;
  // diese Anfrage muss wirklich ans Netz und darf nicht aus dem Speicher kommen.
  if (url.searchParams.has("probe")) return;
  event.respondWith(beantworte(anfrage, anfrage.mode === "navigate"));
});
