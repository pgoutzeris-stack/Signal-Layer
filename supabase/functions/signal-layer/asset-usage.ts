/** Ledger is authoritative for linked drafts; legacy draft-only counters stay available. */
export function assetUsageSummary(events: Array<Record<string, unknown>>) {
  const groups = new Map<string, Record<string, any>>();
  const number = (value: unknown) => Math.max(0, Number(value) || 0);
  for (const event of events) {
    const step = String(event.step || event.operation || 'unbekannt');
    const model = String(event.model || 'unbekannt');
    const key = JSON.stringify([step, model]);
    const group = groups.get(key) || { step, model, calls: 0, calls_error: 0, input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, thinking_tokens: 0, total_tokens: 0, cost_eur: 0, cost_usd: 0, search_queries: 0, cost_reported_by_provider: true };
    group.calls++;
    if (event.status === 'error') group.calls_error++;
    for (const field of ['input_tokens', 'cached_input_tokens', 'output_tokens', 'thinking_tokens', 'total_tokens']) group[field] += number(event[field]);
    group.cost_eur += number(event.estimated_cost_eur);
    group.cost_usd += number(event.estimated_cost_usd);
    group.search_queries += number(event.search_query_count);
    if (number(event.estimated_cost_eur) > 0 && event.pricing_version !== 'provider-reported') group.cost_reported_by_provider = false;
    groups.set(key, group);
  }
  const order = ["marktrecherche", "benchmark_recherche", "benchmark_pruefung", "entwurf", "kritik", "reparatur", "bildsuche", "fotosuche", "logosuche", "logopruefung", "bildpruefung", "szenenbild", "feld_schaerfen", "abschnitt_entwurf"];
  const rank = (step: string) => order.includes(step) ? order.indexOf(step) : order.length;
  const steps = [...groups.values()].sort((a, b) => rank(a.step) - rank(b.step) || a.model.localeCompare(b.model) || a.step.localeCompare(b.step));
  return { source: 'ledger', calls: events.length, total_tokens: steps.reduce((sum, row) => sum + row.total_tokens, 0), cost_eur: steps.reduce((sum, row) => sum + row.cost_eur, 0), cost_usd: steps.reduce((sum, row) => sum + row.cost_usd, 0), steps };
}
