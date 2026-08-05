import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const profileModule = readFileSync(new URL("../supabase/functions/signal-layer/company-profile.ts", import.meta.url), "utf8");
const frontend = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("die Recherche darf schaetzen, muss die Schaetzung aber melden", () => {
  assert.match(profileModule, /"estimated": true/);
  assert.match(profileModule, /begründete Schätzung/);
  // Die Grundlage der Schaetzung ist Pflicht, sonst steht eine graue Zahl ohne
  // Herkunft im Steckbrief.
  assert.match(profileModule, /worauf die Schätzung beruht/);
  // Abschnitte bleiben belegpflichtig - geschaetzt wird nur in den Kacheln.
  assert.match(profileModule, /In "sections" stehen nur belegte Angaben/);
});

test("die Markierung ueberlebt die Normalisierung", () => {
  assert.match(profileModule, /estimated\?: boolean/);
  assert.match(profileModule, /estimated: item\.estimated === true \? true : undefined/);
});

test("die geschaetzte Kachel wird grau und mit Icon gerendert", () => {
  assert.match(frontend, /cp-kpi--estimated/);
  assert.match(frontend, /fa-solid fa-calculator/);
  assert.match(frontend, /title="Geschätzt, nicht belegt"/);
});

test("Kachel und Hinweis nutzen dieselbe graue Auszeichnung, hell und dunkel", () => {
  assert.match(styles, /\.cp-kpi--estimated \{[^}]*border-style: dashed/);
  // Farbvariablen statt fester Werte, damit der dunkle Modus mitgeht.
  assert.match(styles, /\.cp-kpi--estimated b \{ color: var\(--muted\)/);
  assert.match(styles, /\.cp-note \{[^}]*dashed var\(--status-border\)[^}]*var\(--muted\)/);
  assert.doesNotMatch(styles, /\.cp-note \{[^}]*#fffbeb/);
});
