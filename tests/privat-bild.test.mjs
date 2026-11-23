import test from "node:test";
import assert from "node:assert/strict";

const pb = await import("../supabase/functions/signal-layer/privat-bild.ts");

const QUELLE = `// Kopf
window.ROOTS_MASTER_STYLES = [
 {
  "id": "master-li-roots", "name": "LinkedIn Visual", "aspect": "1:1",
  "seriesRefs": ["assets/master-styles/li-roots-1.jpg"],
  "previewImages": ["assets/master-styles/li-roots-preview-1.jpg?v=20261113b"],
  "prompt": "ROOTS", "ciCheck": true, "rootsLogo": true, "group": "ROOTS"
 },
 {
  "id": "master-li-privat", "name": "LinkedIn Beitrag Privat", "aspect": "1:1",
  "seriesRefs": ["assets/master-styles/li-privat-1.jpg", "assets/master-styles/li-privat-2.jpg"],
  "prompt": "PRIVAT", "ciCheck": true, "group": "ROOTS"
 },
 {
  "id": "master-memo-titel", "name": "Executive Memo Titelbild", "aspect": "5:4",
  "seriesRefs": [], "prompt": "MEMO", "ciCheck": true
 }
];
window.ROOTS_LOGO_WHITE_PNG = "data:image/png;base64,iVBORw0KGgo=";
`;

test("Bildstile kommen aus master-styles.js, nur LinkedIn", () => {
  const stile = pb.linkedinBildStile(pb.parseMasterStile(QUELLE));
  assert.deepEqual(stile.map((s) => s.id), ["master-li-roots", "master-li-privat"]);
  assert.equal(stile[0].rootsLogo, true);
  assert.equal(stile[1].rootsLogo, false);
  assert.equal(pb.parseMasterLogo(QUELLE), "data:image/png;base64,iVBORw0KGgo=");
});

test("Standard ist LinkedIn Beitrag Privat, unbekannte Wahl faellt darauf zurueck", () => {
  const stile = pb.linkedinBildStile(pb.parseMasterStile(QUELLE));
  assert.equal(pb.BILDSTIL_STANDARD, "master-li-privat");
  assert.equal(pb.waehleBildStil(stile, "gibt-es-nicht").id, "master-li-privat");
  assert.equal(pb.waehleBildStil(stile, "master-li-roots").id, "master-li-roots");
});

test("Vorschau nutzt previewImages, sonst Serienreferenzen; Pfade nur aus assets/", () => {
  const [roots, privat] = pb.linkedinBildStile(pb.parseMasterStile(QUELLE));
  assert.deepEqual(pb.bildVorschauUrls(roots), [pb.BILDTOOL_BASIS + "assets/master-styles/li-roots-preview-1.jpg?v=20261113b"]);
  assert.equal(pb.bildVorschauUrls(privat).length, 2);
  assert.equal(pb.serienRefPfad("assets/master-styles/li-privat-1.jpg?v=1"), "assets/master-styles/li-privat-1.jpg");
  assert.equal(pb.serienRefPfad("../geheim.jpg"), "");
});

test("Systemanweisung wie im Bildtool, Auftrag ist der Beitrag", () => {
  const text = pb.bildstilSystemInstruction("PRIVAT", 3);
  assert.match(text, /^Du bist ein professioneller Art Director/);
  assert.match(text, /VERBINDLICHE STILVORGABE:\nPRIVAT\n/);
  assert.match(text, /SERIENREFERENZEN: Die 3 als Serienreferenz/);
  assert.match(text, /RANGFOLGE: Der BILDAUFTRAG bestimmt Thema/);
  const auftrag = pb.privatBildAuftrag({ postText: "Lindt senkt Preise.", titel: "<b>Premium</b> hat Grenzen" });
  assert.equal(auftrag, "LinkedIn-Beitrag:\nLindt senkt Preise.\n\nZentrale These: Premium hat Grenzen");
});

test("Bildfolie traegt Marke und Format", () => {
  const html = pb.privatBildLayout("data:image/jpeg;base64,AAAA", "4:5", "LinkedIn Beitrag Privat");
  assert.match(html, /data-ki-bild="1"/);
  assert.match(html, /height:1350px/);
  assert.equal(pb.istPrivatBild("data:image/jpeg;base64,AAAA"), true);
  assert.equal(pb.istPrivatBild("https://example.com/a.jpg"), false);
});
