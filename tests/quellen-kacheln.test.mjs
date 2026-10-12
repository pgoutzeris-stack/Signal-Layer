import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const extract = await import("../supabase/functions/signal-layer/source-extract.ts");
const frontend = readFileSync(new URL("../manual-signal.js", import.meta.url), "utf8");

test("YouTube-Kachel nimmt nur einzelne Videos", () => {
  for (const ok of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "https://youtube.com/shorts/dQw4w9WgXcQ", "https://m.youtube.com/watch?t=3&v=dQw4w9WgXcQ"]) {
    assert.equal(extract.pruefeQuellenTyp(ok, "youtube"), "", ok);
  }
  for (const nein of ["https://www.youtube.com/@roots", "https://www.youtube.com/playlist?list=PL123", "https://example.com/video"]) {
    assert.notEqual(extract.pruefeQuellenTyp(nein, "youtube"), "", nein);
  }
});

test("LinkedIn-Kachel nimmt nur Beitraege", () => {
  for (const ok of [
    "https://www.linkedin.com/posts/pano-goutzeris_marke-activity-7123456789012345678-AbCd",
    "https://www.linkedin.com/feed/update/urn:li:activity:7123456789012345678/",
    "https://de.linkedin.com/posts/roots-consultants_eigenmarken-activity-1",
  ]) assert.equal(extract.pruefeQuellenTyp(ok, "linkedin"), "", ok);
  for (const nein of ["https://www.linkedin.com/in/pano", "https://www.linkedin.com/company/roots", "https://www.linkedin.com/feed/"]) {
    assert.notEqual(extract.pruefeQuellenTyp(nein, "linkedin"), "", nein);
  }
  assert.equal(extract.pruefeQuellenTyp("https://irgendwas.de/x", "web"), "");
});

test("LinkedIn-Beitrag wird aus JSON-LD gelesen", () => {
  const html = `<meta property="og:title" content="Beitrag"><script type="application/ld+json">${JSON.stringify({ "@type": "SocialMediaPosting", articleBody: "Eigenmarken wachsen. ".repeat(10), author: { name: "Erika Muster" } })}</script>`;
  const beitrag = extract.linkedinBeitrag(html);
  assert.equal(beitrag.autor, "Erika Muster");
  assert.ok(beitrag.text.startsWith("Eigenmarken wachsen."));
});

test("Quellen-Popup mit drei Kacheln und gleicher Pruefung im Browser", () => {
  for (const typ of ['typ: "web"', 'typ: "youtube"', 'typ: "linkedin"']) assert.ok(frontend.includes(typ), typ);
  assert.match(frontend, /Füge die URL als Grundlage deines Signals ein/);
  assert.match(frontend, /if \(key === "quelle" && !state\.quelleBefund\?\.gefuellt\) state\.quellenDialog = true;/);
  // Dieselben Muster wie im Server, sonst lehnt einer ab, was der andere annimmt.
  const server = readFileSync(new URL("../supabase/functions/signal-layer/source-extract.ts", import.meta.url), "utf8");
  for (const name of ["YOUTUBE_VIDEO_MUSTER", "LINKEDIN_BEITRAG_MUSTER"]) {
    const muster = (quelle) => quelle.match(new RegExp(`${name} = (/.+/i);`))[1];
    assert.equal(muster(frontend), muster(server), name);
  }
});
