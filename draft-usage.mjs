const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const draftTokens = value => Math.max(0, Math.round(Number(value) || 0)).toLocaleString('de-DE', { maximumFractionDigits: 0 });
export const draftCost = value => Math.max(0, Number(value) || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const steps = { asset_generation: 'Entwurf', memo_image_check: 'Bildprüfung', memo_benchmark_research: 'Benchmark-Recherche', memo_market_research: 'Marktrecherche', memo_photo_research: 'Fotosuche', memo_scene_image: 'Bilderzeugung', entwurf: 'Entwurf', kritik: 'Qualitätsprüfung', reparatur: 'Reparatur', benchmark_recherche: 'Benchmark-Recherche', benchmark_pruefung: 'Benchmark-Prüfung', marktrecherche: 'Marktrecherche', bildsuche: 'Bildsuche', fotosuche: 'Fotosuche', logosuche: 'Logosuche', logopruefung: 'Logo-Prüfung', bildpruefung: 'Bildprüfung', szenenbild: 'Bilderzeugung', feld_schaerfen: 'Feld optimieren', abschnitt_entwurf: 'Abschnitt entwerfen' };
function details(row, metric, modelName) {
  const usage = row.usage_summary;
  if (!usage?.steps?.length) return `<span class="as-usage-note">Für diesen Entwurf liegt keine Aufschlüsselung vor. Angezeigt wird der gespeicherte Entwurfsverbrauch.</span>`;
  const list = usage.steps.map(step => `<span class="as-usage-row" role="row"><span role="cell"><b>${esc(steps[step.step] || step.step)}</b><small>${esc(modelName(step.model))} · ${draftTokens(step.calls)} Aufruf${step.calls === 1 ? '' : 'e'}${step.calls_error ? ` · ${draftTokens(step.calls_error)} fehlgeschlagen` : ''}</small>${metric === 'tokens' ? `<small>Eingabe ${draftTokens(step.input_tokens)} · davon Cache ${draftTokens(step.cached_input_tokens)}<br>Ausgabe ${draftTokens(step.output_tokens)} · Denken ${draftTokens(step.thinking_tokens)}</small>` : ''}</span><span role="cell">${metric === 'tokens' ? draftTokens(step.total_tokens) : draftCost(step.cost_eur)}</span></span>`).join('');
  return `${usage.source === 'legacy_ledger' ? '<span class="as-usage-note">Historischer Entwurfsverbrauch. Frühere Recherche- und Bildaufrufe sind diesem Entwurf nicht eindeutig zugeordnet.</span>' : ''}<span class="as-usage-table" role="table" aria-label="Verbrauch nach Schritt und Modell">${list}</span><span class="as-usage-total">Gesamt <b>${metric === 'tokens' ? draftTokens(usage.total_tokens) + ' Token' : draftCost(usage.cost_eur)}</b></span><span class="as-usage-note">${metric === 'tokens' ? 'Cache-Tokens sind Teil der Eingabe. Fehlversuche sind enthalten, wenn Verbrauch gemeldet wurde.' : 'Anbieterpreis' + (usage.steps.every(step => step.cost_reported_by_provider) ? 'e, vom Anbieter gemeldet.' : 'e und anhand der Tarife berechnete Kosten.') + ' EUR mit dem gespeicherten Wechselkurs. Einzelbeträge sind gerundet; die Summe wird vor dem Runden berechnet.'}</span>`;
}
export function draftMetadataHtml(row, { when = '', duration = '', modelName = value => String(value || '').replace(/^[^/]+\//, '') } = {}) {
  const plain = (icon, text) => text ? `<span class="as-meta-pill"><i class="fa-solid ${icon}" aria-hidden="true"></i>${esc(text)}</span>` : '';
  const usage = row.usage_summary;
  const value = metric => usage?.source === 'ledger' ? usage[metric === 'tokens' ? 'total_tokens' : 'cost_eur'] : row[metric === 'tokens' ? 'total_tokens' : 'cost_eur'];
  const detail = (metric, icon) => {
    const id = `as-usage-${String(row.id || '').replace(/[^a-z0-9-]/gi, '')}-${metric}`;
    return `<span class="as-usage-wrap" data-usage-wrap><button type="button" class="as-meta-pill as-meta-pill--detail" data-usage-pill aria-describedby="${id}" aria-expanded="false"><i class="fa-solid ${icon}" aria-hidden="true"></i>${metric === 'tokens' ? draftTokens(value(metric)) + ' Token' : draftCost(value(metric))}<i class="fa-solid fa-chevron-down as-meta-chevron" aria-hidden="true"></i></button><span id="${id}" class="as-usage-popover" popover="manual" role="tooltip"><span class="as-usage-heading">${metric === 'tokens' ? 'Tokenverbrauch' : 'Kostenaufschlüsselung'}</span>${details(row, metric, modelName)}</span></span>`;
  };
  return `<div class="as-draft-meta">${plain('fa-user', row.creator_short_name || row.creator_name || 'ROOTS')}${plain('fa-calendar-days', when)}${plain('fa-stopwatch', duration)}${detail('tokens', 'fa-microchip')}${detail('cost', 'fa-coins')}</div>`;
}
/** Native top-layer popover avoids clipping in the scrolling draft pane. */
export function bindDraftUsagePopovers(root) {
  let current, leaveTimer;
  const hide = () => { clearTimeout(leaveTimer); if (current) { const popup = current.querySelector('[popover]'); if (popup?.matches(':popover-open')) popup.hidePopover(); current.querySelector('[data-usage-pill]')?.setAttribute('aria-expanded', 'false'); current = null; } };
  const show = wrap => {
    clearTimeout(leaveTimer);
    if (current === wrap) return;
    hide(); current = wrap;
    const popup = wrap.querySelector('[popover]'), button = wrap.querySelector('[data-usage-pill]');
    popup.showPopover(); button.setAttribute('aria-expanded', 'true');
    const bar = wrap.closest(".as-draft-meta").getBoundingClientRect(), box = popup.getBoundingClientRect();
    popup.style.left = `${Math.max(12, Math.min(bar.left, window.innerWidth - box.width - 12))}px`;
    popup.style.top = `${bar.bottom + box.height + 12 <= window.innerHeight ? bar.bottom + 8 : Math.max(12, bar.top - box.height - 8)}px`;
  };
  for (const event of ['pointerover', 'focusin']) root.addEventListener(event, e => { const wrap = e.target.closest('[data-usage-wrap]'); if (wrap) show(wrap); });
  for (const event of ['pointerout', 'focusout']) root.addEventListener(event, e => { const wrap = e.target.closest('[data-usage-wrap]'); if (wrap && !wrap.contains(e.relatedTarget)) { clearTimeout(leaveTimer); leaveTimer = setTimeout(hide, 150); } });
  root.addEventListener('click', e => { if (e.target.closest('[data-usage-wrap]')) e.stopPropagation(); });
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && current) { e.stopPropagation(); hide(); } });
  root.addEventListener('scroll', e => { if (!e.target.closest?.('[popover]')) hide(); }, true);
  return { closeOpenPopover: () => { if (!current) return false; hide(); return true; } };
}
