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
  // Der Titel wird gebaut, weil eine belegte Kachel stattdessen die Quelle nennt.
  assert.match(frontend, /"Geschätzt, nicht belegt"/);
  assert.match(frontend, /titel \? ` title="\$\{escapeHtml\(titel\)\}"` : ""/);
});

test("Kennzahlen trennen Weltweit und Deutschland", () => {
  // Ohne Ebene stehen Konzern- und Landeszahl nebeneinander und der Steckbrief
  // widerspricht jeder Google-Suche.
  assert.match(profileModule, /"scope": "global"/);
  assert.match(profileModule, /"scope": "de"/);
  assert.match(profileModule, /scope\?: CompanyProfileKpiScope/);
  assert.match(frontend, /data-kpi-scope/);
  assert.match(frontend, /CP_KPI_SCOPES/);
  // Ein alter Stand ohne "scope" bleibt sichtbar, sonst wirkt er leer.
  assert.match(frontend, /const ohneEbene = kpis\.filter/);
  assert.match(styles, /\.cp-kpi-lanes\[data-active="de"\] \.cp-kpis\[data-scope="de"\]/);
});

test("jede belegte Kennzahl traegt ihre eigene Quelle", () => {
  assert.match(profileModule, /source_url\?: string/);
  assert.match(profileModule, /KPI_SOURCE_BLOCKLIST/);
  // Foren und Bewertungsportale belegen keine Umsatz- oder Personalzahl.
  assert.match(profileModule, /"kununu\.com"/);
  assert.match(profileModule, /"reddit\.com"/);
  // Google-Weiterleitungen verfallen, deshalb wird das Ziel gespeichert.
  assert.match(profileModule, /function resolveGroundingUri/);
  assert.match(profileModule, /await resolveSourceUris\(extractSources\(candidate\)\)/);
  assert.match(frontend, /cp-kpi--linked/);
  assert.match(styles, /\.cp-kpi--linked \{/);
});

test("Kachel und Hinweis nutzen dieselbe graue Auszeichnung, hell und dunkel", () => {
  assert.match(styles, /\.cp-kpi--estimated \{[^}]*border-style: dashed/);
  // Farbvariablen statt fester Werte, damit der dunkle Modus mitgeht.
  assert.match(styles, /\.cp-kpi--estimated b \{ color: var\(--muted\)/);
  assert.match(styles, /\.cp-note \{[^}]*dashed var\(--status-border\)[^}]*var\(--muted\)/);
  assert.doesNotMatch(styles, /\.cp-note \{[^}]*#fffbeb/);
});

test("offene Punkte stehen an ihrer Karte, nicht als Sammelhinweis", () => {
  // "Nicht belegt: Mediabudget, Agenturbeziehungen, Personalwechsel" unter dem
  // ganzen Steckbrief liess offen, welche Karte gemeint war.
  assert.doesNotMatch(frontend, /profile\.unverified_note/);
  assert.match(frontend, /sec\.open \?/);
  assert.match(frontend, /cp-note cp-note--sec/);
  assert.match(styles, /\.cp-note--sec \{/);
  // Der Nachweis bleibt Pflicht: die Karte nennt, was offen ist, in Stichworten.
  assert.match(profileModule, /Kein Sammelhinweis über das ganze Profil/);
  assert.match(profileModule, /open\?: string/);
  assert.match(profileModule, /open: clean\(item\.open, 120\)/);
});
