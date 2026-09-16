/**
 * Der Feldvertrag des ROOTS Executive Memos, Stand der Vorlage v19.
 *
 * Die Vorlage hat vier feste Seiten und rund fünfzig Felder. Jedes Feld hat
 * eine eigene Aufgabe, eine eigene Textart und eine Länge, bei der die Seite
 * aufgeht. Zu kurze Texte hinterlassen eine weisse Wanne über dem Fussband, zu
 * lange schieben die Seite über 297 mm.
 *
 * Alle Zahlen unten sind am Referenzmemo gemessen, nicht geschätzt: Wortzahl je
 * Feld im vierseitigen Deichmann-Memo v19. Der Zielbereich liegt um den
 * gemessenen Wert herum.
 *
 * Fragebogen, Prompt und Prüfung lesen dieselbe Liste. Läuft eine der drei
 * Stellen mit einer eigenen Zahl, entsteht genau der Widerspruch, den der
 * Nutzer dann im fertigen Dokument sieht.
 */

/** Wörter eines Feldes, HTML-Reste zählen nicht mit. */
export function memoWorte(wert) {
  return String(wert || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function memoSaetze(wert) {
  return String(wert || "")
    .replace(/<[^>]+>/g, " ")
    .split(/[.!?]+(?:\s|$)/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

/**
 * Die Abschnitte in der Reihenfolge des Dokuments.
 *
 *   seite   Seite der Vorlage, dorthin blättert die Vorschau
 *   ziel    Ausschnitt der Seite, in den die Vorschau hineinzoomt
 *   zweck   Was dieser Abschnitt im Dokument leistet
 *   erwartet Was hineingehört, als kurze Liste
 *   bilder  Welche Motive dieser Abschnitt trägt, leer wenn keine
 *
 * Feldarten:
 *   these      Überschrift mit Aussage, kein Schlusspunkt
 *   schluessel Cover-Schlüssel, eine Zeile, kein Schlusspunkt
 *   satz       ein bis zwei Sätze
 *   absatz     Fliesstext, trägt die Seitenhöhe
 *   zahl       Kennzahl im Kasten, muss eine Ziffer enthalten
 *   quelle     Herausgeber und Jahr unter der Kennzahl
 *   name       Marke oder Firma
 *   liste      Quellenzeile, mehrere Belege
 */
export const MEMO_SECTIONS = [
  {
    id: "memo_cover",
    seite: 1,
    ziel: ".em-cover-mid",
    label: "Cover",
    zweck: "Die Titelseite entscheidet in zehn Sekunden, ob weitergelesen wird. Sie nennt die Aufgabe, nicht die Nachricht.",
    hinweis: "Die These des Memos und die drei Schlüssel darunter.",
    erwartet: [
      "Ein Titel, der die offene Aufgabe benennt, kurz und mit Verb.",
      "Ein Satz darunter, warum die Aufgabe jetzt anliegt.",
      "Drei Schlüssel in fester Reihenfolge: Lage, Best Practice, Empfehlung. Sie nehmen die drei Innenseiten vorweg.",
    ],
    bilder: "Ein Motiv des Adressaten über der oberen Seitenhälfte, Laden, Produkt oder Fläche. Kein Logo, kein Porträt.",
    fields: [
      {
        key: "title", label: "Titel", art: "these", rows: 2, min: 4, max: 12, pflicht: true,
        hilfe: "Die offene Aufgabe als These. Nicht die Meldung, nicht der Name der ROOTS-Leistung. Der Titel steht in 44 px, mehr als zwei Zeilen passen nicht.",
        beispiel: "Vom Preisargument zur eigenständigen Marke",
      },
      {
        key: "standfirst", label: "Standfirst", art: "satz", rows: 2, min: 5, max: 18,
        hilfe: "Ein Satz, der den Titel auflöst: was sich dadurch ändert.",
        beispiel: "Wie Deichmanns Eigenmarken ihr volles Wachstumspotenzial entfalten.",
      },
      {
        key: "summary_0", label: "Schlüssel 1 · Reality Check", art: "schluessel", rows: 2, min: 5, max: 14,
        hilfe: "Die heutige Lage des Adressaten. Nimmt Seite 2 vorweg.",
        beispiel: "Wachsende Eigenmarkenanteile treffen in der Footwear-Kategorie auf höhere Kundenansprüche",
      },
      {
        key: "summary_1", label: "Schlüssel 2 · Best Practice", art: "schluessel", rows: 2, min: 5, max: 14,
        hilfe: "Was die Benchmarks gemeinsam richtig machen. Nimmt Seite 3 vorweg.",
        beispiel: "Erfolgreiche Eigenmarken werden konsequent wie eigenständige Marken geführt",
      },
      {
        key: "summary_2", label: "Schlüssel 3 · ROOTS Empfehlung", art: "schluessel", rows: 2, min: 5, max: 14,
        hilfe: "Der Hebel, an dem ROOTS ansetzt. Nimmt Seite 4 vorweg.",
        beispiel: "Eigenmarken mit klarem Profil und eigenen Markenwelten weiterentwickeln und erlebbar machen",
      },
    ],
  },
  {
    id: "memo_markt",
    seite: 2,
    ziel: ".em-sec",
    label: "01 Reality Check",
    zweck: "Seite 2 belegt, dass der Markt sich bewegt, und übersetzt das auf die Lage des Adressaten.",
    hinweis: "Zwei Absätze über der Kennzahlenleiste, dann die Aussage neben dem Bild.",
    erwartet: [
      "Eine Seitenüberschrift über die Kategorie, nicht über das Unternehmen.",
      "Zwei Absätze: erst die Marktbewegung, dann die offene Lücke beim Adressaten.",
      "Unten eine Aussage neben dem Bild und ein Absatz, der sie belegt.",
    ],
    bilder: "Ein Motiv in der unteren Seitenhälfte, das die Aussage daneben zeigt. Szene aus dem Alltag des Adressaten, kein Logo.",
    fields: [
      {
        key: "market_title", label: "Seitenüberschrift", art: "these", rows: 2, min: 5, max: 14,
        hilfe: "Die Kategorie oder der Markt, nicht das Unternehmen.",
        beispiel: "Eigenmarken stehen vor der nächsten Entwicklungsstufe",
      },
      {
        key: "market_p1", label: "Absatz 1 · Marktbewegung", art: "absatz", rows: 5, min: 22, max: 48,
        hilfe: "Was sich im Markt verschoben hat und was das für den Adressaten bedeutet.",
        beispiel: "Mit steigenden Kundenerwartungen wachsen die Anforderungen an Qualität, Innovation und Markenführung. Was früher der günstige Kompromiss war, ist heute eine bewusste Kaufentscheidung. Für Deichmann trifft diese Entwicklung auf eine außergewöhnlich starke Ausgangslage im Sortiment.",
      },
      {
        key: "market_lead2", label: "Absatz 2 · die offene Lücke", art: "absatz", rows: 4, min: 12, max: 34,
        hilfe: "Was dem Adressaten trotz guter Ausgangslage fehlt. Der Übergang zur Empfehlung.",
        beispiel: "Was bislang fehlt, ist eine Eigenmarkenarchitektur, in der einzelne Marken Kategorien sichtbar besetzen und über den Preis hinaus ein eigenständiges Profil entwickeln.",
      },
      {
        key: "insight_title", label: "Aussage neben dem Bild", art: "these", rows: 3, min: 5, max: 16,
        hilfe: "Der Befund zum Adressaten in einem Satz. Nicht die Seitenüberschrift wiederholen.",
        beispiel: "Eigenmarken funktionieren bei Deichmann aktuell überwiegend über funktionale Preiskommunikation.",
      },
      {
        key: "market_p2", label: "Absatz unter der Aussage", art: "absatz", rows: 7, min: 42, max: 80,
        hilfe: "Der Beleg für die Aussage, konkret an Sortiment, Fläche und POS. Trägt die untere Seitenhälfte.",
        beispiel: "Ein Blick in den Store zeigt die heutige Logik: Das Sortiment ist mit Marken wie Graceland oder 5th Avenue klar nach Zielgruppen strukturiert. Am POS stehen diese jedoch im direkten Wettbewerbsumfeld etablierter Herstellermarken und werden vor allem über Sortiment, Preis und Produktleistung differenziert.",
      },
    ],
  },
  {
    id: "memo_kpis",
    seite: 2,
    ziel: ".em-kpis",
    label: "Kennzahlen",
    zweck: "Vier Kästen in einer Leiste. Sie tragen den Beleg für Seite 2 und sind die einzige Stelle im Memo, an der Zahlen stehen.",
    hinweis: "Jede Zahl trägt ihren Bezug und ihre Quelle, sonst steht sie ohne Deckung.",
    erwartet: [
      "Drei Marktzahlen und eine Zahl zum Adressaten selbst, in dieser Reihenfolge.",
      "Prozentwerte, Punktveränderungen oder Beträge, deutsch gesetzt: 40 %, + 1,6 PP, 8,9 Mrd. €.",
      "Je Zahl ein halber Satz Bezug und eine Quelle im Format „Herausgeber, Jahr“.",
      "Keine Zahl ohne Quelle. Ein Kasten ohne Quelle fällt aus dem Memo.",
    ],
    bilder: "",
    fields: [0, 1, 2, 3].flatMap((i) => [
      {
        key: `kpi${i + 1}_value`, label: `Kennzahl ${i + 1}`, art: "zahl", rows: 1, min: 1, max: 4,
        hilfe: "Eine Zeile, deutsch gesetzt. Über zwölf Zeichen schrumpft die Zahl im Kasten.",
        beispiel: ["+ 1,6 PP", "40 %", "27 %", "> 70 %"][i],
        gruppe: i,
      },
      {
        key: `kpi${i + 1}_label`, label: "Bezug", art: "satz", rows: 2, min: 5, max: 18,
        hilfe: "Worauf sich die Zahl bezieht, ein halber Satz ohne Schlusspunkt.",
        beispiel: [
          "Wachstum des Eigenmarkenanteils bei Apparel & Footwear in Deutschland",
          "der Deutschen halten die Qualität von Eigenmarken mittlerweile für besser als die etablierter Marken",
          "kaufen Eigenmarken aufgrund ihres Vertrauens in die Händlermarke",
          "der bei Deichmann verkauften Schuhe sind Eigenmarken, bei 8,9 Mrd. € Umsatz 2025",
        ][i],
        gruppe: i,
      },
      {
        key: `kpi${i + 1}_source`, label: "Quelle", art: "quelle", rows: 1, min: 1, max: 6,
        hilfe: "Format „Herausgeber, Jahr“. Mehrere Herausgeber mit Schrägstrich, Zeiträume mit Schrägstrich.",
        beispiel: ["BCG / Inverto, 2026", "NIQ, 2025", "BCG / Inverto, 2026", "Deichmann, 2023/2025"][i],
        gruppe: i,
      },
    ]),
  },
  {
    id: "memo_benchmarks",
    seite: 3,
    ziel: ".em-cases",
    label: "02 Best Practice",
    zweck: "Seite 3 zeigt drei Marken, die den Hebel schon gezogen haben. Sie macht die Empfehlung glaubwürdig, bevor sie ausgesprochen wird.",
    hinweis: "Drei Fälle, die gewirkt haben. Keine gescheiterten Versuche.",
    erwartet: [
      "Eine Seitenüberschrift, die die drei Marken nennt und ihren gemeinsamen Hebel.",
      "Je Fall: Marke, eine Kartenüberschrift, der Beleg und die übertragbare Lehre.",
      "Am Seitenfuss die Quellenzeile für alle drei Fälle.",
      "Darunter ein Zitat, das die Lehre als ROOTS-Haltung zusammenfasst.",
    ],
    bilder: "Je Fall ein Motiv der Marke: Kampagnenmotiv, Kanal oder Auftritt. Ein Logo allein trägt die Karte nicht.",
    fields: [
      {
        key: "benchmark_title", label: "Seitenüberschrift", art: "these", rows: 3, min: 8, max: 22,
        hilfe: "Nennt die drei Marken und was sie gemeinsam richtig machen.",
        beispiel: "Parkside, Balea und Van Rysel schaffen einen Markenauftritt mit eigenem Design, Botschaftern und eigenen Kanälen",
      },
      ...[0, 1, 2].flatMap((i) => [
        {
          key: `bm${i + 1}_name`, label: `Benchmark ${i + 1}`, art: "name", rows: 1, min: 1, max: 5,
          hilfe: "Bei Handelsmarken „Händler · Marke“.",
          beispiel: ["Lidl · Parkside", "dm · Balea", "Decathlon · Van Rysel"][i],
          gruppe: i,
        },
        {
          key: `bm${i + 1}_title`, label: "Überschrift der Karte", art: "these", rows: 2, min: 3, max: 9,
          hilfe: "Was diese Marke getan hat, ohne Schlusspunkt.",
          beispiel: ["Eigener Auftritt und großer Botschafter", "Markenaufbau über eigene Kanäle und Creator", "Eigenes Profiteam und eigene Brand-Stores"][i],
          gruppe: i,
        },
        {
          key: `bm${i + 1}_text`, label: "Beleg", art: "absatz", rows: 4, min: 20, max: 44,
          hilfe: "Die Handlung und warum sie gewirkt hat. Unter zwanzig Wörtern reisst die Karte auseinander.",
          beispiel: [
            "Lidl ordnet Non-Food in sechs Themenwelten mit je einer Ankermarke. Parkside tritt im eigenen Farbcode ohne Lidl-Logo auf, führt einen eigenen Claim und hat seit 2023 einen Markenbotschafter.",
            "Balea baut die Marke selbst auf: eigener Instagram-Kanal mit eigener Community und Creator-Kooperationen. Dazu das Tempo: die Marke lebt sehr stark von Innovationen.",
            "Aus über 70 Eigenmarken wurden neun Kategoriemarken und vier Expertenmarken. Van Rysel bekommt eigene Brand-Stores und rüstet ein WorldTour-Team aus, also Sponsoring im Format großer Herstellermarken.",
          ][i],
          gruppe: i,
        },
        {
          key: `bm${i + 1}_tag`, label: "Lehre", art: "satz", rows: 2, min: 5, max: 16,
          hilfe: "Was davon auf den Adressaten übertragbar ist, ein Satz.",
          beispiel: [
            "Einheitliches Markenbild plus Botschafter geben der Eigenmarke einen Charakter.",
            "Eigene Kanäle und Creator erzeugen Bindung, die kein Regalplatz ersetzt.",
            "Teamsponsoring macht aus dem Sortimentslabel eine sichtbare Marke.",
          ][i],
          gruppe: i,
        },
      ]),
      {
        key: "sources", label: "Quellenzeile", art: "liste", rows: 3, min: 5, max: 45,
        hilfe: "Belege für die drei Fälle, mit Semikolon getrennt. Format „Herausgeber, Art (Zeitraum)“.",
        beispiel: "Lidl Österreich und Lidl Deutschland, Presseinformationen (2022 bis 2026); Lebensmittelzeitung, Interview Kerstin Erbe; Decathlon, Presseinformationen (2024/2025)",
      },
      {
        key: "quote_text", label: "Zitat im blauen Band", art: "satz", rows: 3, min: 14, max: 34,
        hilfe: "Die Lehre der drei Fälle als ROOTS-Haltung. Kein Zitat aus dem Artikel, keine fremde Person. Die Zuschreibung darunter ist fest.",
        beispiel: "Der Ausbau von Eigenmarken zu eigenständigen Marken schafft ein klares Markenprofil, das wirksam differenziert, neue Zielgruppen erschließt und bestehende enger an die Marke bindet.",
      },
    ],
  },
  {
    id: "memo_empfehlung",
    seite: 4,
    ziel: ".em-pots",
    label: "03 ROOTS Empfehlung",
    zweck: "Seite 4 übersetzt den Hebel auf den Adressaten: drei Karten, dann die Gesprächsfrage.",
    hinweis: "Drei Hebel für dieses Unternehmen, keine allgemeine Beratungsliste.",
    erwartet: [
      "Eine Seitenüberschrift und zwei Absätze: was die Analyse zeigt, dann die drei Hebel benannt.",
      "Je Hebel eine Überschrift mit Verb und ein Absatz, was ROOTS daraus macht.",
      "Eine Frage im blauen Band, kein Werbesatz.",
      "Zwei Sätze, die die ROOTS-Leistung an diesen Fall binden.",
    ],
    bilder: "Je Hebel ein Konzeptbild: wie es aussähe, wenn der Hebel gezogen ist. Fläche, Kanal oder Produkt, kein Logo und kein Porträt.",
    fields: [
      {
        key: "potentials_title", label: "Seitenüberschrift", art: "these", rows: 2, min: 5, max: 16,
        hilfe: "Der Check für dieses Unternehmen.",
        beispiel: "Drei strategische Hebel zur Optimierung von Deichmanns starken Eigenmarken",
      },
      {
        key: "potentials_lead", label: "Absatz 1 · was die Analyse zeigt", art: "absatz", rows: 5, min: 22, max: 50,
        hilfe: "Die Ausgangslage des Adressaten und wo das zusätzliche Potenzial liegt.",
        beispiel: "Die Analyse zeigt: Deichmann verfügt mit seinem hohen Eigenmarkenanteil und etablierten Submarken über eine starke Ausgangsbasis. Das zusätzliche Potenzial liegt darin, ausgewählte Eigenmarken über ihre heutige funktionale Rolle hinaus zu eigenständigen Marken zu entwickeln.",
      },
      {
        key: "potentials_lead2", label: "Absatz 2 · die drei Hebel", art: "satz", rows: 2, min: 6, max: 20,
        hilfe: "Ein Satz, der die drei Hebel benennt. Er steht direkt über den Karten.",
        beispiel: "Drei strategische Hebel setzen hier an: Positionierung, Reichweite und Markenerlebnis.",
      },
      ...[0, 1, 2].flatMap((i) => [
        {
          key: `pot${i + 1}_title`, label: `Hebel ${i + 1}`, art: "these", rows: 2, min: 3, max: 9,
          hilfe: "Verb voran, kein Schlusspunkt.",
          beispiel: ["Positionierung und Markenarchitektur schärfen", "Kanäle und Touchpoints gezielt aufbauen", "Marke am POS und im Produkt erlebbar machen"][i],
          gruppe: i,
        },
        {
          key: `pot${i + 1}_potential`, label: "Was ROOTS daraus macht", art: "absatz", rows: 6, min: 22, max: 48,
          hilfe: "Der Hebel in der Sprache des Falls, ohne erfundene Zahl. Die drei Karten sollten ähnlich lang sein, sonst steht eine kurz.",
          beispiel: [
            "Zielgruppen und Preissegmente entlang relevanter Kundenbedürfnisse klar voneinander abgrenzen, um Überschneidungen zwischen den Eigenmarken zu reduzieren. Für ausgewählte Kernmarken eigenständige Leistungsversprechen definieren, die über den Preis hinaus Orientierung schaffen.",
            "Für ausgewählte Kernmarken eigene Markenwelten über skalierbare digitale Kanäle, zielgruppenrelevanten Content und strategische Kooperationen aufbauen. So lassen sich zusätzliche Kontaktpunkte effizient schaffen und Markenbindung über den POS hinaus stärken.",
            "Eigenmarken auf der Ladenfläche visuell klar differenzieren und ihre Markenwerte konsequent bis ins Produkt übersetzen. Vom Schuhkarton mit Markenstory bis zum Unboxing-Erlebnis machen konsistente Designcodes die Marke an jedem Touchpoint erlebbar.",
          ][i],
          gruppe: i,
        },
      ]),
      {
        key: "cta", label: "Frage im blauen Band", art: "these", rows: 2, min: 5, max: 16,
        hilfe: "Eine Frage an den Adressaten, ohne Werbeton. Der Knopftext daneben ist fest.",
        beispiel: "Wollen Sie die Wachstumspotenziale Ihrer Eigenmarken heben?",
      },
      {
        key: "about_fit", label: "Was ROOTS tut", art: "absatz", rows: 4, min: 12, max: 38,
        hilfe: "Ein Satz über die ROOTS-Leistung allgemein.",
        beispiel: "ROOTS entwickelt KI-optimierte Markenstrategien und Marketing Operations für mehr Wirksamkeit, Effizienz und Speed im Marketing, mit Managementerfahrung bis CMO-Ebene im Handel.",
      },
      {
        key: "about_fit2", label: "Bezug zu diesem Fall", art: "absatz", rows: 4, min: 10, max: 34,
        hilfe: "Ein Satz, der die Leistung an diesen Fall bindet. Erst hier darf sie beim Namen genannt werden.",
        beispiel: "Eigenmarkenstrategie als Teil der Markenpositionierung gehört zu unseren Kernkompetenzen: Wir haben zahlreiche führende Handels-Eigenmarken im Food und Non-Food mitgeprägt.",
      },
    ],
  },
];

/** Alle Felder flach, in Dokumentreihenfolge. */
export const MEMO_FIELDS = MEMO_SECTIONS.flatMap((s) => s.fields.map((f) => ({ ...f, section: s.id, seite: s.seite })));

const NACH_KEY = new Map(MEMO_FIELDS.map((f) => [f.key, f]));

export function memoFeld(key) {
  return NACH_KEY.get(String(key || "")) || null;
}

export function memoAbschnitt(id) {
  return MEMO_SECTIONS.find((s) => s.id === String(id || "")) || null;
}

const JAHR = /(19|20)\d{2}/;
const ZIFFER = /\d/;

/**
 * Der harte Befund zu einem Feld: leerer String heisst in Ordnung. Nur was hier
 * einen Text zurückgibt, blockiert den Schritt. Ein leeres Feld ist kein
 * Fehler, ausser es ist als Pflicht markiert: was leer bleibt, schreibt das
 * Modell.
 */
export function memoFeldFehler(key, wert) {
  const feld = memoFeld(key);
  if (!feld) return "";
  const text = String(wert || "").trim();
  if (!text) return feld.pflicht ? `${feld.label} fehlt.` : "";
  const worte = memoWorte(text);
  if (worte < feld.min) return `${feld.label}: ${worte} statt mindestens ${feld.min} Wörter.`;
  if (worte > feld.max) return `${feld.label}: ${worte} statt höchstens ${feld.max} Wörter.`;
  if (feld.art === "zahl" && !ZIFFER.test(text)) return `${feld.label} braucht eine Ziffer.`;
  if (feld.art === "quelle" && !JAHR.test(text)) return `${feld.label} braucht ein Jahr.`;
  return "";
}

/**
 * Alle Befunde eines Abschnitts, in Feldreihenfolge, dazu die Regeln, die erst
 * zwischen zwei Feldern gelten.
 */
export function memoAbschnittFehler(sectionId, werte) {
  const section = memoAbschnitt(sectionId);
  if (!section) return [];
  const fehler = section.fields.map((f) => memoFeldFehler(f.key, werte?.[f.key])).filter(Boolean);
  if (section.id === "memo_kpis") {
    // Eine Zahl ohne Bezug oder ohne Quelle faellt spaeter aus dem Memo. Das
    // waere stiller Verlust dessen, was hier gerade getippt wurde.
    for (const i of [1, 2, 3, 4]) {
      const teile = ["value", "label", "source"].map((teil) => String(werte?.[`kpi${i}_${teil}`] || "").trim());
      if (teile.some(Boolean) && !teile.every(Boolean)) {
        fehler.push(`Kennzahl ${i} braucht Zahl, Bezug und Quelle. Ohne alle drei fällt der Kasten weg.`);
      }
    }
  }
  return fehler;
}

/**
 * Die Zeilen unter dem Feld: Wortstand gegen Zielbereich, dazu die Regel der
 * Textart. Dasselbe Format wie die LinkedIn-Schreibhilfe, damit beide
 * Fragebogen gleich aussehen.
 */
export function memoFeldHinweise(key, wert) {
  const feld = memoFeld(key);
  if (!feld) return [];
  const text = String(wert || "").trim();
  const worte = memoWorte(text);
  const zeilen = [];
  const ton = !text ? "info" : worte < feld.min || worte > feld.max ? "warn" : "ok";
  zeilen.push({
    ton,
    text: !text
      ? `Leer lassen heisst: das Modell schreibt dieses Feld. Zielbereich ${feld.min} bis ${feld.max} Wörter.`
      : `${worte} ${worte === 1 ? "Wort" : "Wörter"} · Zielbereich ${feld.min} bis ${feld.max}`,
  });
  if (!text) return zeilen;

  if (feld.art === "these" || feld.art === "schluessel") {
    if (/[.]$/.test(text)) zeilen.push({ ton: "warn", text: "Überschriften im Memo enden ohne Punkt." });
  }
  if (feld.art === "schluessel" && memoSaetze(text) > 1) {
    zeilen.push({ ton: "warn", text: "Der Schlüssel ist eine Zeile, kein zweiter Satz." });
  }
  if (feld.art === "satz" && memoSaetze(text) > 2) {
    zeilen.push({ ton: "warn", text: `${memoSaetze(text)} Sätze. Hier tragen ein bis zwei.` });
  }
  if (feld.art === "zahl") {
    if (!ZIFFER.test(text)) zeilen.push({ ton: "warn", text: "Ohne Ziffer bleibt der Kasten leer." });
    else if (text.length > 12) zeilen.push({ ton: "warn", text: "Über zwölf Zeichen schrumpft die Zahl im Kasten." });
  }
  if (feld.art === "quelle") {
    if (!JAHR.test(text)) zeilen.push({ ton: "warn", text: "Ohne Jahr ist die Zahl nicht nachprüfbar." });
    else if (!/,/.test(text)) zeilen.push({ ton: "info", text: "Format im Referenzmemo: „Herausgeber, Jahr“." });
  }
  if (feld.art === "absatz" && worte >= feld.min && /^[^.!?]+$/.test(text)) {
    zeilen.push({ ton: "info", text: "Ein einziger Satz über diese Länge liest sich schwer." });
  }
  return zeilen;
}

/**
 * Derselbe Vertrag als Textblock für den Prompt. Wird aus der Liste oben
 * erzeugt, damit Prompt und Fragebogen nicht auseinanderlaufen.
 */
export function memoLaengenVertrag() {
  return MEMO_SECTIONS.map((s) => {
    // Wiederholte Bloecke stehen einmal als Muster da: drei gleiche Zeilen fuer
    // bm1, bm2, bm3 haetten den Prompt nur verlaengert.
    const zeilen = s.fields
      .filter((f) => f.gruppe === undefined)
      .map((f) => `${f.key}: ${f.min} bis ${f.max} Wörter`);
    const gruppen = s.fields.filter((f) => f.gruppe === 0).map((f) => `${f.key.replace(/^(kpi|bm|pot)\d/, "$1N")}: ${f.min} bis ${f.max} Wörter`);
    return `${s.label}: ${[...zeilen, ...gruppen].join("; ")}.`;
  }).join("\n");
}
