#!/usr/bin/env node
/**
 * Rendert jede Vorlage aus asset-templates.js als eigene HTML-Seite im echten
 * Kachelmass 1080x1350. Aus den Seiten macht der Aufruf danach JPEG und PDF.
 *
 * Wozu: die Bibliothek einmal ausserhalb der App ansehen — und jede neue
 * Vorlage sofort auf Umbrueche, Ueberlagerungen und Rahmendurchbrueche pruefen,
 * ohne einen bezahlten Modelllauf zu starten.
 *
 * Aufruf: node tools/render-asset-library.mjs <zielordner>
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = resolve(HIER, "..");
const ZIEL = resolve(process.argv[2] || resolve(WURZEL, "asset-bibliothek"));

const tpl = await import(resolve(WURZEL, "asset-templates.js"));
const { ASSET_TEMPLATES, ASSET_LAYOUTS, ASSET_TEMPLATE_CSS, ASSET_LAYOUT_CSS, ASSET_LAYOUT_LABELS } = tpl;

const LOGO = "data:image/png;base64," + readFileSync(resolve(WURZEL, "assets/roots-logo.png")).toString("base64");
const FOOTER = "ROOTS Consultants";
const DOMAIN = "roots-consultants.com";
// Ein neutrales Motiv fuer die Vorlagen mit Bildflaeche: ohne Datei zeigten
// C, D und J eine leere Kachel, die Vorschau sagte damit gar nichts.
const MOTIV = "data:image/svg+xml;base64," + Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1f45"/><stop offset="0.55" stop-color="#165fd9"/><stop offset="1" stop-color="#5a9bff"/>
    </linearGradient></defs>
    <rect width="1080" height="1350" fill="url(#g)"/>
    <g fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="2">
      ${Array.from({ length: 14 }, (_, i) => `<circle cx="${180 + i * 60}" cy="${520 + (i % 5) * 70}" r="${120 + i * 16}"/>`).join("")}
    </g>
    <rect width="1080" height="1350" fill="#0b1f45" fill-opacity="0.18"/>
  </svg>`,
).toString("base64");

/** Beispielinhalte je Vorlage: derselbe Marketingfall wie in der Vorschau. */
const BEISPIEL = {
  U1: { title: "Warum starke Marken weniger Kampagnen brauchen", subtitle: "Vier Entscheidungen für mehr Klarheit, Tempo und Wirkung." },
  U2: { title: "Warum starke Marken weniger Kampagnen brauchen", subtitle: "Vier Entscheidungen für mehr Klarheit, Tempo und Wirkung." },
  U5: { title: "Marken wachsen an Entscheidungen, nicht an Budget", subtitle: "Vier Weichenstellungen, die Wirkung planbar machen." },
  U6: { title: "Marken wachsen an Entscheidungen, nicht an Budget", subtitle: "Vier Weichenstellungen, die Wirkung planbar machen." },
  U3: { title: "Wo verliert Ihre Marke heute am meisten Wirkung?", subtitle: "Ein kurzer Check zeigt, welcher Hebel zuerst zählt.", takeaway: "Marken-Check starten" },
  U4: { title: "Wo verliert Ihre Marke heute am meisten Wirkung?", subtitle: "Ein kurzer Check zeigt, welcher Hebel zuerst zählt.", takeaway: "Marken-Check starten" },
  U7: { title: "Welcher Hebel bringt Ihrer Marke zuerst Wirkung?", subtitle: "Wir gehen Positionierung, Kanäle und Auftritt in einer Sitzung durch.", takeaway: "Termin vereinbaren" },
  U8: { title: "Welcher Hebel bringt Ihrer Marke zuerst Wirkung?", subtitle: "Wir gehen Positionierung, Kanäle und Auftritt in einer Sitzung durch.", takeaway: "Termin vereinbaren" },
  A: { quote: "Eine Marke wird nicht relevant, weil sie lauter spricht, sondern weil sie klarer entscheidet.", attribution: "Anna Beispiel · CMO, Beispiel AG" },
  B: { title: "Klarheit schlägt Kampagnendruck.", subtitle: "Wenn Positionierung und Aktivierung dieselbe Entscheidung tragen, sinkt der Reichweitenbedarf." },
  M: { title: "Klarheit schlägt Kampagnendruck.", subtitle: "Wenn Positionierung und Aktivierung dieselbe Entscheidung tragen, sinkt der Reichweitenbedarf." },
  C: { title: "Aus Kontakt wird Erinnerung.", subtitle: "Ein Motiv wirkt, wenn es dieselbe Botschaft trägt wie die Kampagne." },
  D: { title: "Wiedererkennung beginnt vor dem Logo.", subtitle: "Farbe, Haltung und Bildwelt entscheiden im ersten Moment." },
  J: { quote: "Wer seine Zielgruppe kennt, braucht keine lauten Botschaften.", attribution: "Jan Beispiel · Marketingleiter" },
  E: { title: "Konsistenz macht Marken leicht erinnerbar", subtitle: "Wiederholte Codes senken die Kosten je Kontakt.", stat: { value: "68 %", label: "gestützte Markenerinnerung nach zwölf Monaten" } },
  L: { title: "Ein Hebel trägt den größten Teil der Wirkung", subtitle: "Der Rest folgt der Entscheidung.", stat: { value: "3,2x", label: "höhere Werbeerinnerung bei konsistentem Auftritt" }, bullets: ["Positionierung schärfen", "Codes festlegen", "Kanäle danach planen"], takeaway: "Zuerst entscheiden, dann aktivieren." },
  F: { title: "Drei Hebel für mehr Markenwirkung", bullets: ["Positionierung schärfen: eine relevante Entscheidung statt vieler Botschaften", "Codes festlegen: Farbe, Form und Ton bleiben gleich", "Kanäle danach planen: Budget folgt der Aussage"] },
  G: { myth: "Mehr Reichweite gleicht eine unklare Positionierung aus.", fact: "Reichweite verstärkt nur, was vorher schon klar war.", takeaway: "Erst die Aussage, dann das Budget." },
  H: { title: "Was konsistente Marken messbar besser machen", stats: [{ value: "68 %", label: "gestützte Erinnerung" }, { value: "2,1x", label: "Preisbereitschaft" }, { value: "-24 %", label: "Kosten je Kontakt" }] },
  I: { title: "So entsteht ein tragfähiger Markenauftritt", steps: [{ n: "1", title: "Entscheiden", text: "Eine Position, kein Kompromiss." }, { n: "2", title: "Codieren", text: "Farbe, Form und Ton festlegen." }, { n: "3", title: "Aktivieren", text: "Kanäle folgen der Aussage." }] },
  K: { title: "Marketing ist kein Lautstärkeproblem.", subtitle: "Es ist ein Entscheidungsproblem.", takeaway: "Wer klar entscheidet, braucht weniger Druck." },
  S1: { title: "Wo Marke, Markt und Können sich treffen", subtitle: "Der Sweet Spot ist die Schnittmenge, nicht der größte Kreis.", slot_a: "Markenversprechen", slot_b: "Marktnachfrage", slot_c: "Eigene Stärke", slot_center: "Relevanz", takeaway: "Nur die Schnittmenge trägt Wachstum." },
  S2: { title: "Vier Stufen zur wirksamen Marke", subtitle: "Jede Stufe setzt die darunter voraus.", steps: [{ title: "Haltung" }, { title: "Position" }, { title: "Codes" }, { title: "Aktivierung" }], takeaway: "Reife entsteht von unten nach oben." },
  S3: { title: "Das Markenhaus auf einen Blick", subtitle: "Dach, Säulen und Fundament einer Positionierung.", slot_a: "Markenversprechen", slot_b: "Relevanz", slot_c: "Konsistenz", slot_center: "Beweise", takeaway: "Ohne Fundament trägt kein Dach." },
  S4: { title: "Vom Kontakt zur Entscheidung", subtitle: "Fünf Stufen, ein Weg.", steps: [{ title: "Sichtbar" }, { title: "Verstanden" }, { title: "Relevant" }, { title: "Gewählt" }, { title: "Empfohlen" }], takeaway: "Jede Stufe verliert, wenn die vorherige unklar bleibt." },
  T1: { title: "Markenbekanntheit über vier Quartale", subtitle: "Konsistenter Auftritt, gleiches Budget.", stats: [{ value: "41", label: "Q1" }, { value: "48", label: "Q2" }, { value: "57", label: "Q3" }, { value: "68", label: "Q4" }], takeaway: "Wirkung kumuliert, wenn nichts wechselt." },
  T2: { title: "Woher die zusätzliche Wirkung kommt", subtitle: "Ausgang, Veränderung, Ergebnis.", stats: [{ value: "41", label: "Ausgang" }, { value: "+27", label: "Konsistenz" }, { value: "68", label: "Ergebnis" }], takeaway: "Die Veränderung liegt in der Entscheidung." },
  T3: { title: "Woraus Markenwahrnehmung entsteht", subtitle: "Drei Anteile, ein Bild.", stats: [{ value: "46 %", label: "Auftritt" }, { value: "31 %", label: "Erlebnis" }, { value: "23 %", label: "Kommunikation" }], takeaway: "Der Auftritt trägt den größten Anteil." },
  T4: { title: "Wo Marketingteams Wirkung sehen", subtitle: "Vier Anwendungsfälle im Vergleich.", stats: [{ value: "68 %", label: "Markenauftritt" }, { value: "54 %", label: "Content" }, { value: "47 %", label: "Kampagnen" }, { value: "39 %", label: "Vertriebsunterlagen" }], takeaway: "Der Auftritt zahlt am breitesten ein." },
  T5: { title: "Vom Kontakt zur Empfehlung", subtitle: "Fünf Stufen mit Zahlen.", stats: [{ value: "100 %", label: "Kontakt" }, { value: "72 %", label: "Erinnerung" }, { value: "48 %", label: "Relevanz" }, { value: "26 %", label: "Auswahl" }, { value: "11 %", label: "Empfehlung" }], takeaway: "Jede Stufe kostet, was vorher unklar war." },
  T6: { title: "Der Weg über vier Phasen", subtitle: "Zeit, Titel, Ergebnis.", steps: [{ n: "Q1", title: "Analyse", text: "Bestand klären" }, { n: "Q2", title: "Position", text: "Aussage schärfen" }, { n: "Q3", title: "Codes", text: "Auftritt bauen" }, { n: "Q4", title: "Rollout", text: "Kanäle folgen" }], takeaway: "Ein Jahr, vier Entscheidungen." },
};

const KICKER = "MARKENFÜHRUNG";
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function expandRepeats(html, slide) {
  return html.replace(/<!--repeat:([a-z]+)-->([\s\S]*?)<!--\/repeat-->/g, (_m, feld, block) => {
    const liste = feld === "bullets" ? (slide.bullets || [])
      : feld === "stats" ? (slide.stats || [])
        : feld === "steps" ? (slide.steps || []) : [];
    const gefuellt = liste.length ? liste : [{}, {}, {}];
    return gefuellt.map((eintrag, i) => {
      const werte = feld === "bullets"
        ? { item: String(eintrag || ""), n: String(i + 1) }
        : feld === "stats"
          ? { value: String(eintrag?.value || ""), label: String(eintrag?.label || ""), n: String(i + 1) }
          : { n: String(eintrag?.n || String(i + 1)), title: String(eintrag?.title || ""), text: String(eintrag?.text || "") };
      return block.replace(/\{\{([a-z_]+)\}\}/g, (__m, name) => esc(werte[name] ?? ""));
    }).join("");
  });
}

function fill(html, slide) {
  const werte = {
    logo: LOGO, domain: DOMAIN, footer_left: FOOTER, kicker: KICKER, eyebrow: "Abbildung",
    title: slide.title || "", subtitle: slide.subtitle || "", quote: slide.quote || "",
    attribution: slide.attribution || "", myth: slide.myth || "", fact: slide.fact || "",
    takeaway: slide.takeaway || "", image: MOTIV,
    stat_value: slide.stat?.value || "", stat_label: slide.stat?.label || "",
    slot_a: slide.slot_a || "", slot_b: slide.slot_b || "", slot_c: slide.slot_c || "",
    slot_d: slide.slot_d || "", slot_center: slide.slot_center || "",
  };
  for (let i = 0; i < 7; i += 1) {
    werte[`stat${i + 1}_value`] = slide.stats?.[i]?.value || "";
    werte[`stat${i + 1}_label`] = slide.stats?.[i]?.label || "";
    werte[`stat${i + 1}_unit`] = "";
    werte[`step${i + 1}_n`] = slide.steps?.[i]?.n || String(i + 1);
    werte[`step${i + 1}_title`] = slide.steps?.[i]?.title || "";
    werte[`step${i + 1}_text`] = slide.steps?.[i]?.text || "";
  }
  return html.replace(/\{\{([a-z0-9_]+)\}\}/gi, (_m, name) => {
    const wert = werte[name] ?? "";
    return name === "logo" || name === "image" ? wert : esc(wert);
  });
}

function seite(key, markup) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<title>${esc(key)}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<style>
  html,body{margin:0;padding:0;background:#fff;}
  ${ASSET_TEMPLATE_CSS.replace(/#as-overlay /g, "")}
  ${(ASSET_LAYOUT_CSS || "").replace(/#as-overlay /g, "")}
  .as-stage--tpl{width:1080px;height:1350px;}
</style></head>
<body><div class="as-stage as-stage--tpl" lang="de">${markup}</div></body></html>`;
}

mkdirSync(ZIEL, { recursive: true });
const alle = { ...ASSET_TEMPLATES, ...ASSET_LAYOUTS };
const namen = {
  U1: "Titelfolie-hell-Linie", U2: "Titelfolie-dunkel-Linie",
  U5: "Titelfolie-hell-zentriert", U6: "Titelfolie-dunkel-zentriert",
  U3: "Endfolie-hell-CTA-Pille", U4: "Endfolie-dunkel-CTA-Pille",
  U7: "Endfolie-hell-CTA-Karte", U8: "Endfolie-dunkel-CTA-Karte",
  A: "Zitat", B: "Titel-mit-Einordnung", C: "Titel-mit-Bild", D: "Vollbild-Overlay",
  E: "Grosse-Kennzahl", F: "Aufzaehlung", G: "Mythos-und-Fakt", H: "Mehrere-Kennzahlen",
  I: "Prozess-in-Schritten", J: "Zitat-ueber-Bild", K: "Durchgestrichenes-Wort",
  L: "Kennzahl-mit-Anmerkung", M: "Titel-dunkel",
};
const liste = [];
for (const [key, markup] of Object.entries(alle)) {
  const name = namen[key] || (ASSET_LAYOUT_LABELS?.[key] || key).replace(/[^\wÄÖÜäöüß-]+/g, "-");
  const datei = `${key}_${name}.html`;
  const slide = BEISPIEL[key] || { title: "Beispieltitel", subtitle: "Beispielzeile" };
  writeFileSync(resolve(ZIEL, datei), seite(key, fill(expandRepeats(markup, slide), slide)), "utf8");
  liste.push({ key, name, datei });
}
writeFileSync(resolve(ZIEL, "_liste.json"), JSON.stringify(liste, null, 2), "utf8");
console.log(`${liste.length} Vorlagen nach ${ZIEL}`);
