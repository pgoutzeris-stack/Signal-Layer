export function simpleLaneCountLabel(visibleCount, totalCount, filtersActive) {
  const visible = Math.max(0, Number(visibleCount) || 0);
  const total = Math.max(visible, Number(totalCount) || 0);
  const format = (value) => value.toLocaleString("de-DE");
  return filtersActive && visible !== total
    ? `${format(visible)} von ${format(total)}`
    : format(total);
}

const INCOMPLETE_RUN_ARTICLES = 100;

function signalCountText(count) {
  return `${Math.max(0, Number(count) || 0).toLocaleString("de-DE")} Signale`;
}

function articleDate(iso) {
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
  const articles = Number(entry?.archived_articles || 0);
  const date = articleDate(entry?.first_seen_at);
  const parts = [version, signalCountText(signals)];
  if (articles > 0 && articles < INCOMPLETE_RUN_ARTICLES) {
    parts.push(`${articles.toLocaleString("de-DE")} Artikel`, "Testlauf");
  } else if (date) {
    parts.push(date);
  }
  return parts.filter(Boolean).join(" · ");
}
