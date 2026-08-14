#!/usr/bin/env node
/**
 * Live-Matrix, die am 13.8.2026 bei 120 s in sechs von acht Laeufen starb.
 * Braucht ein Editor-JWT aus einer Intranet-Sitzung:
 *
 *   SIGNAL_LAYER_USER_JWT=... ARTICLE_ID=<uuid> node tools/live-asset-run.mjs
 *
 * Ohne Token: Exit 2 und Hinweis, kein stilles Gruen.
 */
const URL = "https://csmguwcvzreefluhahyu.supabase.co/functions/v1/signal-layer";
const jwt = process.env.SIGNAL_LAYER_USER_JWT || "";
const articleId = process.env.ARTICLE_ID || "";

if (!jwt || !articleId) {
  console.error("Live-Asset-Lauf braucht SIGNAL_LAYER_USER_JWT und ARTICLE_ID (Editor-Sitzung, bestätigtes Signal).");
  process.exit(2);
}

const faelle = [
  { name: "Einzelbild", kind: "linkedin", answers: { asset_type: "single", variant: "auto", theme: "light" } },
  { name: "Ansprache", kind: "memo", answers: { audience: "geschaeftsfuehrung", scope: "one_page" } },
  { name: "Karussell 4", kind: "linkedin", answers: { asset_type: "carousel", slides: 4, variant: "auto" } },
  { name: "Karussell 6", kind: "linkedin", answers: { asset_type: "carousel", slides: 6, variant: "auto" } },
];

async function api(action, payload) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

async function warte(id) {
  const gesehen = [];
  const bis = Date.now() + 420_000;
  let wartezeit = 800;
  while (Date.now() < bis) {
    await new Promise((r) => setTimeout(r, wartezeit));
    wartezeit = Math.min(wartezeit + 200, 1_200);
    const { asset } = await api("get_asset", { asset_id: id });
    const stage = asset.stage || "";
    if (gesehen[gesehen.length - 1] !== stage) gesehen.push(stage);
    if (asset.status && asset.status !== "running") return { asset, gesehen };
  }
  throw new Error("nach sieben Minuten nicht fertig");
}

const zeilen = [];
for (const fall of faelle) {
  const t0 = Date.now();
  try {
    const start = await api("generate_asset", { kind: fall.kind, article_id: articleId, answers: fall.answers });
    const row = start.asset || start;
    const { asset, gesehen } = row.status === "running" ? await warte(row.id) : { asset: row, gesehen: [row.stage] };
    const sek = Math.round((Date.now() - t0) / 1000);
    const ok = asset.status === "done";
    zeilen.push({
      name: fall.name, ok, sekunden: sek, status: asset.status,
      stages: gesehen.join(" → "),
      tokens: asset.total_tokens, eur: asset.cost_eur, fehler: asset.error_message || "",
    });
    console.log(`${ok ? "OK" : "FAIL"} ${fall.name}: ${sek}s, ${gesehen.join(" → ")}, ${asset.total_tokens || 0} tok, ${asset.cost_eur ?? "–"} € ${asset.error_message || ""}`);
  } catch (err) {
    zeilen.push({ name: fall.name, ok: false, sekunden: Math.round((Date.now() - t0) / 1000), status: "error", stages: "", tokens: null, eur: null, fehler: String(err.message || err) });
    console.log(`FAIL ${fall.name}: ${err.message || err}`);
  }
}

const failed = zeilen.filter((z) => !z.ok);
console.log(JSON.stringify(zeilen, null, 2));
process.exit(failed.length ? 1 : 0);
