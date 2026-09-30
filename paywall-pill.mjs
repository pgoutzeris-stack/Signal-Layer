// Rote Pill an Signalen, Archivzeilen und in der Detailansicht, wenn der
// gespeicherte Artikeltext wegen einer Paywall nur ein Anreisser ist. Der
// Befund kommt vom Server (articles.paywall_detected, per Trigger berechnet).

export function paywallPillHtml(article, escapeHtml) {
  if (!article || article.paywall_detected !== true) return "";
  const beleg = String(article.paywall_evidence || "").trim();
  const info = beleg ? ` data-pill-info="Beleg: ${escapeHtml(beleg)}" tabindex="0"` : "";
  return `<span class="tag tag--paywall"${info}><i class="fa-solid fa-lock"></i> Paywall erkannt</span>`;
}
