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

export function simpleVersionMenu(versions, currentVersion) {
  const list = Array.isArray(versions) ? versions : [];
  const current = list.find((entry) => entry.version === currentVersion) || {
    version: currentVersion || "",
    signals: 0,
    archived_signals: 0,
    archived_articles: 0,
  };
  return {
    current,
    historical: list.filter((entry) => entry.version !== currentVersion),
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
