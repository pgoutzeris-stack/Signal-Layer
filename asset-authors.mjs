// Wer hat zu einem Artikel schon einen Entwurf gemacht.
//
// Die Information steht am Asset (created_by, created_at), nicht am Artikel.
// Ohne sie beginnt jemand einen Entwurf, den eine Kollegin vor zwei Stunden
// schon gebaut hat. Die Karte zeigt deshalb unten rechts die Gesichter der
// Personen; ein Klick fuehrt in genau deren Entwurf. Der Zeitpunkt steht im
// Titel des Gesichts, nicht als Zeile daneben - auf der Kachel zaehlt das
// Signal, nicht die Bearbeitungshistorie.

/** "vor 3 Std", "vor 2 Tagen" - grob genug, um ohne Uhrzeit zu tragen. */
export function relativeWhen(value, now = Date.now()) {
  const zeit = new Date(value || "").getTime();
  if (!Number.isFinite(zeit)) return "";
  const minuten = Math.max(0, Math.round((now - zeit) / 60000));
  if (minuten < 1) return "gerade eben";
  if (minuten < 60) return `vor ${minuten} Min`;
  const stunden = Math.round(minuten / 60);
  if (stunden < 24) return `vor ${stunden} Std`;
  const tage = Math.round(stunden / 24);
  if (tage < 31) return `vor ${tage} ${tage === 1 ? "Tag" : "Tagen"}`;
  const monate = Math.round(tage / 30);
  return `vor ${monate} ${monate === 1 ? "Monat" : "Monaten"}`;
}

export function initialsOf(name) {
  return String(name || "ROOTS Team")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((teil) => teil[0])
    .join("")
    .toLocaleUpperCase("de") || "R";
}

/**
 * Ein Gesicht je Person, die neueste zuerst. Mehr als drei Bilder werden zu
 * einer Zahl - eine Reihe aus acht Kreisen ist kein Hinweis mehr.
 */
export function assetAuthorsBadgeHtml(list, escapeHtml, now = Date.now()) {
  const esc = typeof escapeHtml === "function" ? escapeHtml : (value) => String(value ?? "");
  const eintraege = Array.isArray(list) ? list.filter(Boolean) : [];
  if (!eintraege.length) return "";
  const sortiert = [...eintraege].sort((a, b) =>
    new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime());
  const proPerson = new Map();
  for (const eintrag of sortiert) {
    const schluessel = String(eintrag.user_id || eintrag.name || "");
    if (!proPerson.has(schluessel)) proPerson.set(schluessel, eintrag);
  }
  const personen = [...proPerson.values()];
  const sichtbar = personen.slice(0, 3);
  const rest = personen.length - sichtbar.length;
  const bilder = sichtbar.map((person) => {
    const name = String(person.name || person.short_name || "ROOTS Team");
    const titel = `${name} · ${person.kind === "memo" ? "Executive Memo" : "LinkedIn-Asset"} · ${relativeWhen(person.created_at, now)}`;
    const url = String(person.avatar_url || "");
    return `<button type="button" class="asset-author" data-asset-author="${esc(person.asset_id || "")}" data-asset-kind="${esc(person.kind || "linkedin")}" title="${esc(titel)}" aria-label="${esc(titel)}">${
      url
        ? `<img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
        : `<span class="asset-author-initials">${esc(initialsOf(name))}</span>`
    }</button>`;
  }).join("");
  return `<span class="asset-authors" aria-label="Entwürfe zu diesem Artikel">${bilder}${
    rest > 0 ? `<span class="asset-author asset-author--rest">+${rest}</span>` : ""
  }</span>`;
}

/**
 * Holt die Autoren fuer alle sichtbaren Karten in einem Aufruf und haengt die
 * Gesichter an. Ein Abruf je Karte waere bei 50 Karten 50 Anfragen.
 */
export async function paintAssetAuthors(root, callApi, escapeHtml) {
  if (!root || typeof callApi !== "function") return;
  const karten = [...root.querySelectorAll("[data-article-id]")]
    .filter((karte) => !karte.querySelector(".asset-authors"));
  const ids = [...new Set(karten.map((karte) => karte.getAttribute("data-article-id")).filter(Boolean))];
  if (!ids.length) return;
  let authors = {};
  try {
    const antwort = await callApi("list_asset_authors", { article_ids: ids });
    authors = (antwort && antwort.authors) || {};
  } catch (_) {
    // Ein fehlender Hinweis ist kein Grund, die Liste rot zu faerben.
    return;
  }
  const jetzt = Date.now();
  for (const karte of karten) {
    const liste = authors[karte.getAttribute("data-article-id")];
    if (!Array.isArray(liste) || !liste.length) continue;
    const html = assetAuthorsBadgeHtml(liste, escapeHtml, jetzt);
    if (!html) continue;
    karte.insertAdjacentHTML("beforeend", html);
  }
}
