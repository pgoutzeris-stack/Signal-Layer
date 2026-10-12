export function simpleLaneCountLabel(visibleCount, totalCount, filtersActive) {
  const visible = Math.max(0, Number(visibleCount) || 0);
  const total = Math.max(visible, Number(totalCount) || 0);
  const format = (value) => value.toLocaleString("de-DE");
  return filtersActive && visible !== total
    ? `${format(visible)} von ${format(total)}`
    : format(total);
}

function signalCountText(count) {
  return `${Math.max(0, Number(count) || 0).toLocaleString("de-DE")} Signale`;
}

export function simpleVersionDateLabel(entry) {
  const iso = entry?.first_seen_at || entry?.last_run_at || entry?.last_seen_at || "";
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("de-DE");
}

function versionsZeit(entry) {
  const zeit = Date.parse(entry?.last_run_at || entry?.last_seen_at || entry?.first_seen_at || "");
  return Number.isFinite(zeit) ? zeit : 0;
}

/**
 * Aktuell ist der Stand, der Signale hat. Eine neu deployte Version ohne
 * einen einzigen Lauf stand sonst als „aktuell · 0 Signale“ im Menue, und die
 * Version mit allen Signalen darunter wie eine alte (29.9.2026: v2.7 leer,
 * v2.6 mit 392 Signalen).
 */
export function simpleVersionMenu(versions, currentVersion) {
  const list = Array.isArray(versions) ? versions : [];
  const mitSignalen = (entry) => Number(entry?.signals || 0) > 0;
  let current = list.find((entry) => entry.version === currentVersion);
  if (!current || !mitSignalen(current)) {
    const kandidaten = list.filter(mitSignalen).sort((a, b) => versionsZeit(b) - versionsZeit(a)
      || String(b.version).localeCompare(String(a.version), "de", { numeric: true }));
    if (kandidaten.length) current = kandidaten[0];
  }
  current = current || {
    version: currentVersion || "",
    signals: 0,
    archived_signals: 0,
    archived_articles: 0,
  };
  return {
    current,
    historical: list.filter((entry) => entry.version !== current.version
      && !(entry.version === currentVersion && !mitSignalen(entry))),
  };
}

export function simpleCurrentVersionLabel(versions, currentVersion) {
  const { current } = simpleVersionMenu(versions, currentVersion);
  const version = current.version || currentVersion || "";
  const total = Number(current.signals || 0);
  if (!version) {
    return total > 0 ? `Aktueller Stand · ${signalCountText(total)}` : "Aktueller Stand";
  }
  return total > 0
    ? `${version} · aktuell · ${signalCountText(total)}`
    : `${version} · aktuell`;
}

export function simpleHistoricalVersionLabel(entry) {
  const version = String(entry?.version || "");
  const signals = Number(entry?.archived_signals ?? entry?.signals ?? 0);
  return [version, signalCountText(signals)].filter(Boolean).join(" · ");
}

export function advancedVersionLabel(entry, currentVersion) {
  const version = String(entry?.version || "");
  const signals = signalCountText(entry?.article_count ?? entry?.signals ?? 0);
  if (!version) return signals;
  return version === currentVersion
    ? `${version} · aktuell · ${signals}`
    : `${version} · ${signals}`;
}

function datumDe(iso) {
  const date = new Date(iso || "");
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("de-DE");
}

function datumLang(iso) {
  const date = new Date(iso || "");
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Inhalt des Info-Symbols im Versionsmenue: Scraping-Zeitraum und Signale je geprueftem Artikel. Eine Zeile je Pill. */
export function simpleVersionInfo(entry) {
  if (!entry) return "";
  const zeilen = [];
  const von = datumLang(entry.first_seen_at);
  const bis = datumLang(entry.last_run_at || entry.last_seen_at);
  if (von && bis && von !== bis) zeilen.push(`${von} bis ${bis}`);
  else if (von || bis) zeilen.push(von || bis);
  const signale = Number(entry.signals || 0);
  const geprueft = signale + Number(entry.rejected || 0);
  if (signale <= 0) zeilen.push("Noch keine Signale");
  else if (geprueft > signale) zeilen.push(`${signale.toLocaleString("de-DE")} von ${geprueft.toLocaleString("de-DE")}`);
  else zeilen.push(signalCountText(signale));
  return zeilen.join("\n");
}
