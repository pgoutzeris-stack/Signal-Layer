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

/** Inhalt des Info-Symbols im Versionsmenue: wann gelaufen, womit, wie viele Signale. */
export function simpleVersionInfo(entry) {
  if (!entry) return "";
  const zeilen = [];
  const erster = datumDe(entry.first_seen_at);
  const letzter = datumDe(entry.last_run_at || entry.last_seen_at);
  if (erster) zeilen.push(`Erster Lauf ${erster}`);
  if (letzter && letzter !== erster) zeilen.push(`Letzter Lauf ${letzter}`);
  if (entry.model) zeilen.push(`Modell ${entry.model}`);
  const signale = Number(entry.signals || 0);
  zeilen.push(signale > 0 ? signalCountText(signale) : "Noch keine Signale");
  const archiviert = Number(entry.archived_signals || 0);
  if (archiviert > 0) zeilen.push(`${archiviert.toLocaleString("de-DE")} archivierte Signale`);
  return zeilen.join("\n");
}
