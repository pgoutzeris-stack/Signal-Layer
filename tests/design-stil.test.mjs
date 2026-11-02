import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { normalizeDesignTemplates, normalizeDesignStil, ROOTS_DESIGNS, DESIGN_PORTRAET_LIMIT } = await import("../supabase/functions/signal-layer/asset-studio.ts");

const PNG = "data:image/png;base64,iVBORw0KGgo=";

test("Stil: nur Farben, Schalter und eingebettetes Portraet", () => {
  const stil = normalizeDesignStil({
    verlauf_von: "#061A47", verlauf_bis: "#574872", akzent: "red", rahmen: true, zitatzeichen: "ja",
    pinsel: true, portraet: "https://example.com/foto.png",
  });
  assert.deepEqual(stil, { verlauf_von: "#061a47", verlauf_bis: "#574872", akzent: "", rahmen: true, zitatzeichen: false, pinsel: true, portraet: "" });
  assert.equal(normalizeDesignStil({ portraet: PNG }).portraet, PNG);
  assert.equal(normalizeDesignStil({ portraet: "data:image/jpeg;base64,AAAA" }).portraet, "", "ohne Transparenz kein Portraet");
  assert.equal(normalizeDesignStil({ portraet: `data:image/webp;base64,${"A".repeat(DESIGN_PORTRAET_LIMIT)}` }).portraet, "");
});

test("Vorlagen behalten ihren Stil, alte Vorlagen bekommen einen leeren", () => {
  const [mit, ohne] = normalizeDesignTemplates([
    { id: "pano-dunkel", name: "Pano Dunkel", theme: "dark", stil: { verlauf_von: "#061a47", verlauf_bis: "#574872", rahmen: true, portraet: PNG } },
    { id: "alt", name: "Alt", theme: "light" },
  ]);
  assert.equal(mit.stil.rahmen, true);
  assert.equal(mit.stil.portraet, PNG);
  assert.deepEqual(ohne.stil, normalizeDesignStil({}));
  assert.equal(ROOTS_DESIGNS["roots-dunkel"].stil.portraet, "");
});

test("Stil fliesst vom Server bis auf die Folie", async () => {
  const [ts, edge, studio, app] = await Promise.all([
    readFile(new URL("../supabase/functions/signal-layer/asset-studio.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/functions/signal-layer/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../asset-studio.js", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
  ]);
  assert.match(edge, /linkedinAnswers\.design_stil = vorlage\.stil;/);
  assert.match(ts, /stil: answers\.profile === "private" \? answers\.design_stil : LEERER_STIL/);
  assert.match(studio, /stil: data\.chrome\.stil && typeof data\.chrome\.stil === "object"/);
  assert.match(studio, /html = wendeStilAn\(html, slide\);/);
  // Der Stil steht im exportierten Dokument, nicht nur in der Vorschau.
  assert.match(studio, /\$\{ASSET_LAYOUT_CSS\}\\n\$\{STIL_CSS\}\\n\$\{STAGE_CSS\}/);
  assert.match(app, /data-design-portraet=/);
  assert.match(app, /toDataURL\("image\/webp", qualitaet\)/);
});
