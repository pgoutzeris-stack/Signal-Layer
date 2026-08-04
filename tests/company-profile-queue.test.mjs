import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const backend = readFileSync(
  new URL("../supabase/functions/signal-layer/index.ts", import.meta.url),
  "utf8",
);
const frontend = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20260804204544_add_company_profile_job_queue.sql", import.meta.url),
  "utf8",
);

test("every detected Tier-1 company enters a durable profile queue", () => {
  assert.match(backend, /async function enqueueCompanyProfiles/);
  assert.match(backend, /ignoreDuplicates: true/);
  assert.match(backend, /case "process_company_profile_jobs"/);
  assert.doesNotMatch(backend, /done >= COMPANY_PROFILE_MAX_PER_BATCH/);
  assert.match(migration, /for update skip locked/);
  assert.match(migration, /left join signal_layer\.company_profiles/);
});

test("the profile panel follows the persisted job instead of loading forever", () => {
  assert.match(frontend, /if \(pending && !profile\)/);
  assert.match(frontend, /profile_error: profileError/);
  assert.match(backend, /profile_job_status/);
  assert.match(backend, /profile_error/);
});
