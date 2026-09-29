// Fehlertexte fuer die Oberflaeche. Eine Quelle fuer App, Studio und
// manuelles Signal: das Studio rief die Funktion auf, ohne sie zu kennen, und
// jede Fehleransicht brach ab. Stehen blieb der letzte Ladebalken (29.9.2026).

// Deutsche Servertexte sind schon Klartext. Englische kommen aus Postgres,
// Deno oder einem Anbieter und sagen dem Nutzer weder, was los ist, noch was
// er tun soll. Sie werden hier übersetzt, das Original bleibt als Detail.
export function fehlerKlartext(roh) {
  // Nach "---" haengt der Server die Modellantwort an. Sie gehoert ins
  // Protokoll, nicht in die Meldung.
  const text = String(roh || "").split(/\n-{3}\n/)[0].replace(/^Error:\s*/, "").trim();
  if (!text) return "Unbekannter Fehler. Bitte erneut versuchen.";
  const deutsch = /[äöüß]|\b(die|der|das|nicht|kein|keine|und|ist|wurde|bitte)\b/i;
  const [kopf, ...rest] = text.split("\n\n");
  if (deutsch.test(kopf)) return text;
  const detail = kopf.slice(0, 240);
  let satz;
  if (/check constraint|violates|duplicate key|foreign key|relation .* does not exist|column .* does not exist/i.test(kopf)) {
    satz = "Interner Fehler in der Datenbank des Signal Layer. Das liegt nicht an deinen Eingaben. Bitte erneut versuchen. Kommt der Fehler wieder, Pano Bescheid geben.";
  } else if (/\b(429|rate limit|quota|resource_exhausted)\b/i.test(kopf)) {
    satz = "Der KI-Anbieter drosselt gerade die Anfragen. Eine Minute warten und erneut versuchen.";
  } else if (/\b(5\d\d|unavailable|overloaded|bad gateway|gateway timeout)\b/i.test(kopf)) {
    satz = "Der KI-Anbieter ist gerade nicht erreichbar. Das liegt beim Anbieter. In ein paar Minuten erneut versuchen.";
  } else if (/timeout|timed out|aborted/i.test(kopf)) {
    satz = "Die Anfrage hat zu lange gedauert und wurde abgebrochen. Bitte erneut versuchen.";
  } else if (/jwt|unauthori[sz]ed|not authenticated|permission denied|forbidden/i.test(kopf)) {
    satz = "Die Anmeldung ist abgelaufen oder die Berechtigung fehlt. Seite neu laden und erneut anmelden.";
  } else {
    satz = "Technischer Fehler im Signal Layer. Bitte erneut versuchen. Kommt der Fehler wieder, Pano Bescheid geben.";
  }
  return [`${satz}\n\nTechnisches Detail: ${detail}`, ...rest].join("\n\n");
}
