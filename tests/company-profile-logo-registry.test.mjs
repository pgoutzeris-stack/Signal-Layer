import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const frontend = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const backend = readFileSync(
  new URL("../supabase/functions/signal-layer/index.ts", import.meta.url),
  "utf8",
);
const profileModule = readFileSync(
  new URL("../supabase/functions/signal-layer/company-profile.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL("../supabase/migrations/20260804213451_add_tier1_logo_registry.sql", import.meta.url),
  "utf8",
);

test("all active Tier-1 companies receive a durable verified logo", () => {
  const registryRows = migration.match(/^  \('/gm) || [];
  assert.equal(registryRows.length, 69);
  assert.match(migration, /add column if not exists logo_verified_at/);
  assert.match(backend, /async function getTier1CompanyLogo/);
  assert.match(backend, /if \(registeredLogo\)/);
  assert.match(backend, /logo_url: registeredLogo\.logo_url/);
});

test("logo attribution remains stored but is not printed below the logo", () => {
  assert.match(migration, /logo_source_url/);
  assert.doesNotMatch(frontend, /cp-logo-source/);
  assert.doesNotMatch(frontend, /Wikimedia Commons/);
});

test("profile research cannot create a second non-article trigger", () => {
  assert.match(frontend, /!\/\^trigger\\s\*&\?\\s\*aufhänger\/i/);
  assert.doesNotMatch(profileModule, /for \(const \[title, items\] of byTitle\)/);
  assert.match(migration, /simple_signals\/history/);
  assert.match(migration, /like_regex "\^Trigger"/);
});
