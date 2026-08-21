/**
 * Externe Links: welche Adresse ist öffenbar, und wer ist das Elternfenster.
 *
 * Eigene Datei, weil beide Fragen ohne Browser prüfbar sein müssen. Der Rest
 * des Öffnens (Tauri-Brücke, postMessage, Zwischenablage) bleibt in app.js,
 * weil er ohne Fenster keinen Sinn ergibt.
 */

/** Fenster, denen der Signal Layer einen Link zum Öffnen geben darf. */
export const ROOTS_PARENT_ORIGINS = new Set([
  "https://pgoutzeris-stack.github.io",
  "https://tauri.localhost",
  "tauri://localhost",
]);

/**
 * Adresse aus dem Bestand in eine öffenbare URL übersetzen.
 * - manuelle Signale tragen manual://signal/<id> und haben keine Quelle
 * - alte Zeilen stehen ohne Schema in der Datenbank ("www.lebensmittelzeitung.net/…")
 * - http bleibt http: viele Fachseiten im Bestand haben kein TLS
 */
export function externalUrlFromValue(value) {
  const roh = String(value || "").trim();
  if (!roh || roh === "#") return null;
  if (/^manual:\/\//i.test(roh)) return null;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(roh)) return roh;
  if (/^\/\//.test(roh)) return `https:${roh}`;
  // Nur echte Domains ergänzen, keine relativen Pfade der eigenen Seite.
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(roh)) return `https://${roh}`;
  return null;
}

/** Hat dieser Artikel eine anklickbare Originalquelle? */
export function hasExternalSource(article) {
  return Boolean(externalUrlFromValue(article?.url));
}

/**
 * Mögliche Elternfenster in der Reihenfolge, in der ihnen zu trauen ist.
 *
 * Der Signal Layer hängt im Intranet-iframe mit referrerpolicy="no-referrer":
 * document.referrer ist dort leer, weshalb die Elternerkennung allein über den
 * Referrer in der Tauri-App immer blind blieb und der Link im Nichts endete.
 * ancestorOrigins kennt die Kette trotzdem (WebKit und Chromium), und im
 * Zweifel liegt das Intranet auf derselben Herkunft wie das Tool selbst.
 */
export function parentOriginCandidates({ ancestorOrigins = [], referrer = "", ownOrigin = "" } = {}) {
  const kandidaten = [];
  for (const origin of Array.from(ancestorOrigins || [])) {
    if (origin) kandidaten.push(String(origin));
  }
  if (referrer) {
    try { kandidaten.push(new URL(referrer).origin); } catch (_) { /* kaputter Referrer */ }
  }
  if (ownOrigin) kandidaten.push(String(ownOrigin));
  return [...new Set(kandidaten)].filter((origin) => ROOTS_PARENT_ORIGINS.has(origin));
}
