import { closeBrowser, discoverArticles, extractArticle } from "./server.js";

const endpoint = String(process.env.SIGNAL_LAYER_ENDPOINT || "").replace(/\/$/, "");
const secret = String(process.env.CRAWLER_WORKER_SECRET || "");
const batchSize = Math.max(1, Math.min(4, Number(process.env.BROWSER_BATCH_SIZE || 4)));
const maxBatches = Math.max(1, Math.min(4, Number(process.env.BROWSER_MAX_BATCHES || 2)));

if (!endpoint || !secret) throw new Error("SIGNAL_LAYER_ENDPOINT and CRAWLER_WORKER_SECRET are required");

async function edgeCall(payload, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(45_000),
      });
      if (response.ok) return response.json();
      const error = new Error(`edge_${response.status}:${(await response.text()).slice(0, 180)}`);
      if (![429, 500, 502, 503, 504, 546].includes(response.status)) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
    }
    if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 5_000 * attempt));
  }
  throw lastError;
}

async function processJob(job) {
  try {
    if (job.kind === "source_discovery") {
      const discovery = await discoverArticles({ url: job.url });
      const submitted = await edgeCall({ action: "browser_submit_source_job", job_id: job.id, success: true, discovery });
      return { ok: Number(submitted.queued_articles || 0) > 0 };
    }
    const article = await extractArticle({ url: job.url, cookie: job.cookie });
    const submitted = await edgeCall({ action: "browser_submit_job", job_id: job.id, success: true, article });
    return { ok: Boolean(submitted.queued_for_analysis) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await edgeCall({
      action: job.kind === "source_discovery" ? "browser_submit_source_job" : "browser_submit_job",
      job_id: job.id, success: false, error: message.slice(0, 500),
    });
    return { ok: false };
  }
}

let processed = 0;
let recovered = 0;
for (let batch = 0; batch < maxBatches; batch += 1) {
  let claimed;
  try {
    claimed = await edgeCall({ action: "browser_claim_jobs", limit: batchSize });
  } catch (error) {
    console.log(JSON.stringify({ processed, recovered, deferred: true, reason: String(error).slice(0, 120) }));
    break;
  }
  const jobs = Array.isArray(claimed.jobs) ? claimed.jobs : [];
  if (!jobs.length) break;
  const results = await Promise.all(jobs.map(processJob));
  processed += results.length;
  recovered += results.filter((result) => result.ok).length;
}

// Deliberately log counts only: source URLs, cookies and article bodies must
// never appear in the public repository's Actions output.
console.log(JSON.stringify({ processed, recovered, failed: processed - recovered }));
await closeBrowser();
