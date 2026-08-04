export function simpleLaneCountLabel(visibleCount, totalCount, filtersActive) {
  const visible = Math.max(0, Number(visibleCount) || 0);
  const total = Math.max(visible, Number(totalCount) || 0);
  const format = (value) => value.toLocaleString("de-DE");
  return filtersActive && visible !== total
    ? `${format(visible)} von ${format(total)}`
    : format(total);
}

export function simpleCurrentVersionLabel(versions, currentVersion) {
  const current = (versions || []).find((entry) => entry.version === currentVersion);
  const total = Number(current?.signals || 0);
  return total > 0
    ? `Aktueller Stand · ${total.toLocaleString("de-DE")} Signale`
    : "Aktueller Stand";
}
