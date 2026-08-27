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
  assert.match(backend, /ignoreDuplicates: !force/);
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

test("eine Sammelaktualisierung erreicht alle Tier-1-Unternehmen", () => {
  const forceMigration = readFileSync(
    new URL("../supabase/migrations/20260828120000_company_profile_force_refresh.sql", import.meta.url),
    "utf8",
  );
  assert.match(forceMigration, /add column if not exists force boolean not null default false/);
  // Ohne force bleibt es bei einer Recherche pro Unternehmen; mit force wird
  // ein vorhandener Stand ueberschrieben.
  assert.match(backend, /case "refresh_company_profiles"/);
  assert.match(backend, /ADMIN_ACTIONS = new Set\(\[\s*\n\s*"refresh_company_profiles"/);
  assert.match(backend, /ensureCompanyProfile\(job\.company, job\.force === true/);
  assert.match(backend, /\{ force: true \}/);
  // Der alte Stand bleibt als Version erhalten.
  assert.match(backend, /from\("company_profile_history"\)\.insert\(/);
});

test("der Waechter holt liegengebliebene Steckbrief-Jobs nach", () => {
  // Der Worker stoesst sich selbst an. Faellt ein Aufruf aus, bliebe der Rest
  // einer Sammelaktualisierung ohne diesen Weg dauerhaft liegen.
  const wachePos = backend.indexOf('case "resume_stalled_crawls"');
  assert.ok(wachePos > 0);
  const wache = backend.slice(wachePos, wachePos + 3000);
  assert.match(wache, /from\("company_profile_jobs"\)/);
  assert.match(wache, /triggerCompanyProfileWorker\(\)/);
});
