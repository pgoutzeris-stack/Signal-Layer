import { closeBrowser, extractArticle } from "./server.js";

const endpoint = String(process.env.SIGNAL_LAYER_ENDPOINT || "").replace(/\/$/, "");
const secret = String(process.env.CRAWLER_WORKER_SECRET || "");
const batchSize = Math.max(1, Math.min(25, Number(process.env.BROWSER_BATCH_SIZE || 12)));
const maxBatches = Math.max(1, Math.min(20, Number(process.env.BROWSER_MAX_BATCHES || 8)));

if (!endpoint || !secret) throw new Error("SIGNAL_LAYER_ENDPOINT and CRAWLER_WORKER_SECRET are required");

async function edgeCall(payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`edge_${response.status}:${(await response.text()).slice(0, 180)}`);
  return response.json();
}

async function processJob(job) {
  try {
    const article = await extractArticle({ url: job.url, cookie: job.cookie });
    await edgeCall({ action: "browser_submit_job", job_id: job.id, success: true, article });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await edgeCall({ action: "browser_submit_job", job_id: job.id, success: false, error: message.slice(0, 500) });
    return { ok: false };
  }
}

let processed = 0;
let recovered = 0;
for (let batch = 0; batch < maxBatches; batch += 1) {
  const claimed = await edgeCall({ action: "browser_claim_jobs", limit: batchSize });
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
