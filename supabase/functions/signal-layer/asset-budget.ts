export type BudgetProvider = "deepseek" | "perplexity" | "gemini";
export function billingProvider(model: string): BudgetProvider {
  return (model.includes("/") || model.startsWith("sonar")) ? "perplexity" : model.startsWith("deepseek") ? "deepseek" : "gemini";
}
export function balanceVerdict(data: any, estimateUsd: number | null, cnyToUsd: number) {
  if (data?.is_available === false) return { status: "blocked", message: "DeepSeek meldet kein verfügbares Guthaben." };
  if (data?.is_available !== true || !Array.isArray(data.balance_infos)) return { status: "unknown", message: "Das DeepSeek-Guthaben konnte nicht verlässlich gelesen werden." };
  const balances = data.balance_infos.filter((b: any) => ["USD", "CNY"].includes(b.currency) && b.total_balance != null && String(b.total_balance).trim() !== "" && Number.isFinite(Number(b.total_balance)) && Number(b.total_balance) >= 0);
  if (!balances.length) return { status: "unknown", message: "DeepSeek hat keinen auswertbaren Guthabenbetrag geliefert." };
  // These are separate currency wallets. Do not add them into one imaginary wallet.
  const available = Math.max(...balances.map((b: any) => Number(b.total_balance) * (b.currency === "CNY" ? cnyToUsd : 1)));
  if (!Number.isFinite(available)) return { status: "unknown", message: "Der Wechselkurs für das DeepSeek-Guthaben ist nicht verfügbar." };
  const amount = `${available.toFixed(2)} US$`;
  if (available === 0) return { status: "blocked", available_usd: available, message: "Das DeepSeek-Guthaben ist aufgebraucht." };
  if (estimateUsd != null && available < estimateUsd) return { status: "warning", available_usd: available, message: `Verfügbar: ${amount}. Der geschätzte Bedarf inklusive Reserve liegt bei ${estimateUsd.toFixed(2)} US$. Das Guthaben könnte nicht reichen.` };
  return { status: "ok", available_usd: available, message: `DeepSeek-Guthaben: ${amount}. Eine Kostenschätzung ist keine Preisgarantie.` };
}
export function recentBudgetFailure(events: any[], provider: BudgetProvider, now = Date.now()) {
  const matching = events.filter(e => billingProvider(String(e.model || "")) === provider).sort((a,b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const failure = matching.find(e => e.status === "error" && now - Date.parse(e.created_at) < 6 * 3600000 && /insufficient_balance|spending_cap|http_402|payment_required|insufficient.*(credit|fund)|credit.*(exhaust|deplet)|billing.*limit|balance.*insufficient/i.test(`${e.error_code || ""} ${e.error_message || ""}`));
  if (!failure) return false;
  return !matching.some(e => e.status === "success" && Number(e.total_tokens) > 0 && Date.parse(e.created_at) > Date.parse(failure.created_at));
}
export function conservativeForecast(values: number[], fallback: number | null) {
  const valid = values.filter(v => Number.isFinite(v) && v > 0).sort((a,b) => a-b);
  const history = valid.length ? valid[Math.min(valid.length-1, Math.ceil(valid.length*.9)-1)] * 1.5 : null;
  return history == null ? fallback : fallback == null ? history : Math.max(history, fallback);
}
