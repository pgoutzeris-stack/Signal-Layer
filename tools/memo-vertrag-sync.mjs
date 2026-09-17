// Schreibt die Kopien des Feldvertrags im Edge-Function-Modul neu. Der Vertrag
// steht in memo-guides.mjs; Deno kann ihn nicht importieren, also liegt er dort
// als erzeugte Konstante. Der Test in tests/asset-studio.test.mjs haelt beide gleich.
import { readFileSync, writeFileSync } from "node:fs";
import {
  MEMO_FIELDS, MEMO_SECTIONS, memoLaengenVertrag, memoAufbauVertrag, memoBeispieleVertrag, memoSchemaTexte,
} from "../memo-guides.mjs";

const pfad = new URL("../supabase/functions/signal-layer/asset-studio.ts", import.meta.url);
let quelle = readFileSync(pfad, "utf8");
const lit = (text) => text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

function setzeTemplate(name, inhalt) {
  const anker = `export const ${name} = \``;
  const i = quelle.indexOf(anker);
  if (i < 0) throw new Error(`${name} nicht gefunden`);
  const j = quelle.indexOf("`;", i) + 2;
  quelle = quelle.slice(0, i) + anker + lit(inhalt.trimEnd()) + "`;" + quelle.slice(j);
}

function setzeBlock(kopf, ende, inhalt) {
  const i = quelle.indexOf(kopf);
  if (i < 0) throw new Error(`${kopf} nicht gefunden`);
  const j = quelle.indexOf(ende, i) + ende.length;
  quelle = quelle.slice(0, i) + kopf + inhalt + ende + quelle.slice(j);
}

setzeTemplate("MEMO_LAENGEN", memoLaengenVertrag());
setzeTemplate("MEMO_AUFBAU", memoAufbauVertrag());
setzeTemplate("MEMO_BEISPIELE", memoBeispieleVertrag());

const t = memoSchemaTexte();
const q = (x) => JSON.stringify(x);
const gruppe = (name, obj) => `  ${name}: {\n${Object.entries(obj).map(([k, v]) => `    ${k}: ${q(v)},`).join("\n")}\n  },`;
setzeBlock(
  "export const MEMO_SCHEMA_TEXTE = {\n",
  "\n} as const;",
  [gruppe("felder", t.felder), gruppe("kpi", t.kpi), gruppe("benchmark", t.benchmark), gruppe("potential", t.potential)].join("\n"),
);

setzeBlock(
  "export const MEMO_VERTRAG: MemoVertragFeld[] = [\n",
  "\n];",
  MEMO_FIELDS.map((f) => `  { key: ${q(f.key)}, label: ${q(f.label)}, art: ${q(f.art)}, min: ${f.min}, max: ${f.max}, zeichen: ${f.zeichen}, saetze: ${f.saetze ? `[${f.saetze.join(", ")}]` : "null"}, punkt: ${Boolean(f.punkt)} },`).join("\n"),
);

setzeBlock(
  "export const MEMO_ABSCHNITTE: MemoAbschnitt[] = [\n",
  "\n];",
  MEMO_SECTIONS.map((s) => `  { id: ${q(s.id)}, label: ${q(s.label)}, seite: ${s.seite}, keys: [${s.fields.map((f) => q(f.key)).join(", ")}] },`).join("\n"),
);

setzeBlock(
  "export const MEMO_BEISPIEL: Record<string, string> = {\n",
  "\n};",
  MEMO_FIELDS.map((f) => `  ${q(f.key)}: ${q(f.beispiel)},`).join("\n"),
);

writeFileSync(pfad, quelle);
console.log(`Vertrag übertragen: ${MEMO_FIELDS.length} Felder`);
