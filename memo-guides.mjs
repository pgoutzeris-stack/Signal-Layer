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
 *
 * Zusatzschluessel je Feld:
 *   saetze     [min, max] Saetze, wo das Referenzmemo die Satzzahl vorgibt
 *   punkt      true, wenn diese Ueberschrift ausnahmsweise auf einen Punkt endet
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
        key: "title", label: "Titel (H1)", art: "these", rows: 2, min: 4, max: 12, pflicht: true,
        hilfe: "Die offene Aufgabe als These. Nicht die Meldung, nicht der Name der ROOTS-Leistung. Der Titel steht in 44 px, mehr als zwei Zeilen passen nicht.",
        beispiel: "Vom Preisargument zur eigenständigen Marke",
      },
      {
        key: "standfirst", label: "Subtitel (H2)", art: "satz", rows: 2, min: 5, max: 18, saetze: [1, 2],
        hilfe: "Ein Satz, der den Titel auflöst: was sich dadurch ändert.",
        beispiel: "Wie Deichmanns Eigenmarken ihr volles Wachstumspotenzial entfalten.",
      },
      {
        key: "summary_0", label: "Feature 1", art: "schluessel", rows: 2, min: 5, max: 14,
        hilfe: "Die heutige Lage des Adressaten. Nimmt Seite 2 vorweg.",
        beispiel: "Wachsende Eigenmarkenanteile treffen in der Footwear-Kategorie auf höhere Kundenansprüche",
      },
      {
        key: "summary_1", label: "Feature 2", art: "schluessel", rows: 2, min: 5, max: 14,
        hilfe: "Was die Benchmarks gemeinsam richtig machen. Nimmt Seite 3 vorweg.",
        beispiel: "Erfolgreiche Eigenmarken werden konsequent wie eigenständige Marken geführt",
      },
      {
        key: "summary_2", label: "Feature 3", art: "schluessel", rows: 2, min: 5, max: 14,
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
        key: "market_title", label: "Titel (H2)", art: "these", rows: 2, min: 5, max: 14,
        hilfe: "Die Kategorie oder der Markt, nicht das Unternehmen.",
        beispiel: "Eigenmarken stehen vor der nächsten Entwicklungsstufe",
      },
      {
        key: "market_p1", label: "Absatz 1", art: "absatz", rows: 5, min: 22, max: 48,
        hilfe: "Was sich im Markt verschoben hat und was das für den Adressaten bedeutet.",
        beispiel: "Mit steigenden Kundenerwartungen wachsen die Anforderungen an Qualität, Innovation und Markenführung. Was früher der günstige Kompromiss war, ist heute eine bewusste Kaufentscheidung. Für Deichmann trifft diese Entwicklung auf eine außergewöhnlich starke Ausgangslage im Sortiment.",
      },
      {
        key: "market_lead2", label: "Absatz 2", art: "absatz", rows: 4, min: 12, max: 34,
        hilfe: "Was dem Adressaten trotz guter Ausgangslage fehlt. Der Übergang zur Empfehlung.",
        beispiel: "Was bislang fehlt, ist eine Eigenmarkenarchitektur, in der einzelne Marken Kategorien sichtbar besetzen und über den Preis hinaus ein eigenständiges Profil entwickeln.",
      },
      {
        key: "insight_title", label: "Bildaussage", art: "these", rows: 3, min: 5, max: 16, saetze: [1, 1], punkt: true,
        hilfe: "Der Befund zum Adressaten in einem Satz. Nicht die Seitenüberschrift wiederholen.",
        beispiel: "Eigenmarken funktionieren bei Deichmann aktuell überwiegend über funktionale Preiskommunikation.",
      },
      {
        key: "market_p2", label: "Absatz 3", art: "absatz", rows: 7, min: 42, max: 80,
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
        key: `kpi${i + 1}_label`, label: "Beschreibung", art: "satz", rows: 2, min: 5, max: 18,
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
    bildgruppe: "benchmarks",
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
        key: "benchmark_title", label: "Titel (H2)", art: "these", rows: 3, min: 8, max: 22,
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
          key: `bm${i + 1}_title`, label: "Titel", art: "these", rows: 2, min: 3, max: 9,
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
          key: `bm${i + 1}_tag`, label: "Lehre", art: "satz", rows: 2, min: 5, max: 16, saetze: [1, 1],
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
        key: "sources", label: "Quellen", art: "liste", rows: 3, min: 5, max: 45,
        hilfe: "Belege für die drei Fälle, mit Semikolon getrennt. Format „Herausgeber, Art (Zeitraum)“.",
        beispiel: "Lidl Österreich und Lidl Deutschland, Presseinformationen (2022 bis 2026); Lebensmittelzeitung, Interview Kerstin Erbe; Decathlon, Presseinformationen (2024/2025)",
      },
      {
        key: "quote_text", label: "Zitat", art: "satz", rows: 3, min: 14, max: 34, saetze: [1, 2],
        hilfe: "Die Lehre der drei Fälle als ROOTS-Haltung. Kein Zitat aus dem Artikel, keine fremde Person. Die Zuschreibung darunter ist fest.",
        beispiel: "Der Ausbau von Eigenmarken zu eigenständigen Marken schafft ein klares Markenprofil, das wirksam differenziert, neue Zielgruppen erschließt und bestehende enger an die Marke bindet.",
      },
    ],
  },
  {
    id: "memo_empfehlung",
    seite: 4,
    ziel: ".em-pots",
    bildgruppe: "potentials",
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
        key: "potentials_title", label: "Titel (H2)", art: "these", rows: 2, min: 5, max: 16,
        hilfe: "Der Check für dieses Unternehmen.",
        beispiel: "Drei strategische Hebel zur Optimierung von Deichmanns starken Eigenmarken",
      },
      {
        key: "potentials_lead", label: "Absatz 1", art: "absatz", rows: 5, min: 22, max: 50,
        hilfe: "Die Ausgangslage des Adressaten und wo das zusätzliche Potenzial liegt.",
        beispiel: "Die Analyse zeigt: Deichmann verfügt mit seinem hohen Eigenmarkenanteil und etablierten Submarken über eine starke Ausgangsbasis. Das zusätzliche Potenzial liegt darin, ausgewählte Eigenmarken über ihre heutige funktionale Rolle hinaus zu eigenständigen Marken zu entwickeln.",
      },
      {
        key: "potentials_lead2", label: "Absatz 2", art: "satz", rows: 2, min: 6, max: 20, saetze: [1, 1],
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
          key: `pot${i + 1}_potential`, label: "Text", art: "absatz", rows: 6, min: 22, max: 48,
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
        key: "cta", label: "CTA-Frage", art: "these", rows: 2, min: 5, max: 16, saetze: [1, 1],
        hilfe: "Eine Frage an den Adressaten, ohne Werbeton. Der Knopftext daneben ist fest.",
        beispiel: "Wollen Sie die Wachstumspotenziale Ihrer Eigenmarken heben?",
      },
      {
        key: "about_fit", label: "Über ROOTS", art: "absatz", rows: 4, min: 12, max: 38,
        hilfe: "Ein Satz über die ROOTS-Leistung allgemein.",
        beispiel: "ROOTS entwickelt KI-optimierte Markenstrategien und Marketing Operations für mehr Wirksamkeit, Effizienz und Speed im Marketing, mit Managementerfahrung bis CMO-Ebene im Handel.",
      },
      {
        key: "about_fit2", label: "Bezug zum Fall", art: "absatz", rows: 4, min: 10, max: 34,
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
// Deutsche Zahlensetzung, wie im Referenzmemo: Komma als Dezimaltrennzeichen,
// Leerzeichen vor der Einheit. 8.9 und 40% sind die zwei Fehler, die das Modell
// aus englischen Quellen mitbringt.
const PUNKT_DEZIMAL = /\d\.\d/;
const EINHEIT_ENG = /\d[%€]/;
const ZAHL_ZEICHEN = 12;

/**
 * Alle Verstösse eines Feldes, in der Reihenfolge, in der sie auffallen.
 * Fragebogen und Backend hängen an dieser einen Liste, damit ein selbst
 * geschriebenes und ein generiertes Feld am selben Mass gemessen werden.
 *
 * Jeder Eintrag trägt den Befund und den Satz, der unter dem Feld steht.
 */
export function memoFeldPruefung(key, wert) {
  const feld = memoFeld(key);
  if (!feld) return [];
  const text = String(wert || "").trim();
  if (!text) return feld.pflicht ? [{ code: "leer", fehler: `${feld.label} fehlt.`, hinweis: `${feld.label} ist Pflicht.` }] : [];
  const befunde = [];
  const worte = memoWorte(text);
  if (worte < feld.min) {
    befunde.push({
      code: "kurz",
      fehler: `${feld.label}: ${worte} statt mindestens ${feld.min} Wörter.`,
      hinweis: `${worte} Wörter. Unter ${feld.min} bleibt die Seite an dieser Stelle leer.`,
    });
  } else if (worte > feld.max) {
    befunde.push({
      code: "lang",
      fehler: `${feld.label}: ${worte} statt höchstens ${feld.max} Wörter.`,
      hinweis: `${worte} Wörter. Hier passen höchstens ${feld.max}, sonst läuft die Seite über.`,
    });
  }
  if (feld.saetze) {
    const saetze = memoSaetze(text);
    const [smin, smax] = feld.saetze;
    if (saetze < smin) {
      befunde.push({
        code: "saetze_kurz",
        fehler: `${feld.label}: ${saetze} statt mindestens ${smin} Sätze.`,
        hinweis: `${saetze} Sätze. Hier stehen mindestens ${smin}.`,
      });
    } else if (saetze > smax) {
      befunde.push({
        code: "saetze_lang",
        fehler: `${feld.label}: ${saetze} Sätze, hier stehen höchstens ${smax}.`,
        hinweis: `${saetze} Sätze. Hier stehen höchstens ${smax}, sonst bricht die Stelle um.`,
      });
    }
  }
  if (feld.art === "zahl") {
    if (!ZIFFER.test(text)) {
      befunde.push({ code: "ziffer", fehler: `${feld.label} braucht eine Ziffer.`, hinweis: "Ohne Ziffer bleibt der Kasten leer." });
    }
    if (PUNKT_DEZIMAL.test(text)) {
      befunde.push({ code: "dezimal", fehler: `${feld.label}: Dezimaltrennzeichen ist das Komma.`, hinweis: "Deutsch gesetzt: 8,9 Mrd. €, nicht 8.9." });
    }
    if (EINHEIT_ENG.test(text)) {
      befunde.push({ code: "einheit", fehler: `${feld.label}: vor % und € steht ein Leerzeichen.`, hinweis: "Deutsch gesetzt: 40 %, nicht 40%." });
    }
    // Der Kasten schrumpft die Schrift, bis die Zahl passt. Das faellt beim
    // Export niemandem auf, steht aber neben drei Zahlen in voller Groesse.
    if (text.length > ZAHL_ZEICHEN) {
      befunde.push({
        code: "breit",
        fehler: `${feld.label}: ${text.length} Zeichen, mehr als ${ZAHL_ZEICHEN} schrumpfen die Zahl im Kasten.`,
        hinweis: `${text.length} Zeichen. Über ${ZAHL_ZEICHEN} wird die Zahl kleiner gesetzt als die daneben.`,
      });
    }
  }
  if (feld.art === "quelle") {
    if (!JAHR.test(text)) {
      befunde.push({ code: "jahr", fehler: `${feld.label} braucht ein Jahr.`, hinweis: "Ohne Jahr ist die Zahl nicht nachprüfbar." });
    }
    if (!text.includes(",")) {
      befunde.push({ code: "quellform", fehler: `${feld.label}: Format „Herausgeber, Jahr“.`, hinweis: "Format „Herausgeber, Jahr“, mehrere Herausgeber mit Schrägstrich." });
    }
  }
  if (feld.art === "liste") {
    const teile = text.split(";").map((teil) => teil.trim()).filter(Boolean);
    if (teile.some((teil) => !teil.includes(","))) {
      befunde.push({
        code: "listenform",
        fehler: `${feld.label}: jeder Beleg im Format „Herausgeber, Art (Zeitraum)“.`,
        hinweis: "Je Beleg „Herausgeber, Art (Zeitraum)“, mehrere mit Semikolon.",
      });
    }
  }
  if ((feld.art === "these" || feld.art === "schluessel") && !feld.punkt && /\.$/.test(text)) {
    befunde.push({ code: "punkt", fehler: `${feld.label}: Überschriften im Memo enden ohne Punkt.`, hinweis: "Überschriften im Memo enden ohne Punkt." });
  }
  return befunde;
}

/**
 * Der harte Befund zu einem Feld: leerer String heisst in Ordnung. Nur was hier
 * einen Text zurückgibt, blockiert den Schritt. Ein leeres Feld ist kein
 * Fehler, ausser es ist als Pflicht markiert: was leer bleibt, schreibt das
 * Modell.
 */
export function memoFeldFehler(key, wert) {
  return memoFeldPruefung(key, wert)[0]?.fehler || "";
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
  // Ein leeres Feld bleibt leer. Ob die KI es schreibt, ist eine Frage weiter
  // oben schon beantwortet; hier waere der Hinweis nur Rauschen.
  if (!String(wert || "").trim()) return [];
  return memoFeldPruefung(key, wert).map((b) => ({ ton: "warn", text: b.hinweis }));
}

/**
 * Das Referenzmemo Feld für Feld. Der Prompt bekommt damit nicht nur eine
 * Wortzahl, sondern die Tonlage, den Satzbau und die Art des Belegs, die im
 * fertigen Dokument stehen. Ohne diesen Block schreibt das Modell Texte, die
 * die Längen treffen und trotzdem anders klingen.
 */
export function memoBeispieleVertrag() {
  return MEMO_SECTIONS.map((s) => `${s.label}\n${s.fields.map((f) => `${f.key}: ${f.beispiel}`).join("\n")}`).join("\n\n");
}

/**
 * Der Aufbau als Prompt-Block, aus denselben Feldern erzeugt. Von Hand
 * gepflegt stand hier eine zweite Fassung der hilfe-Texte, die beim naechsten
 * Vorlagenwechsel weggelaufen waere.
 */
export function memoAufbauVertrag() {
  return MEMO_SECTIONS.map((s) => {
    const zeilen = s.fields
      .filter((f) => f.gruppe === undefined || f.gruppe === 0)
      .map((f) => `${f.gruppe === 0 ? f.key.replace(/^(kpi|bm|pot)\d/, "$1N") : f.key} (${f.label}): ${f.hilfe}`);
    const bilder = s.bilder ? `\nMotive: ${s.bilder}` : "";
    // erwartet traegt die Regeln zwischen den Feldern: genau vier Kennzahlen,
    // genau drei Faelle, keine Zahl ohne Quelle. Die stehen in keinem hilfe-Text.
    const regeln = s.erwartet.map((zeile) => `- ${zeile}`).join("\n");
    return `Seite ${s.seite}, ${s.label}: ${s.zweck}\n${regeln}\n${zeilen.join("\n")}${bilder}`;
  }).join("\n\n");
}

/**
 * Die Feldbeschreibungen für das JSON-Schema des Modells. Das Schema liest das
 * Modell vor dem Prompt, eine eigene Zahl an dieser Stelle schlaegt den
 * Vertrag. Die wiederholten Bloecke stehen unter kpi, benchmark und potential.
 */
export function memoSchemaTexte() {
  const satz = (f) => `${f.hilfe} ${f.min} bis ${f.max} Wörter.`;
  const out = { felder: {}, kpi: {}, benchmark: {}, potential: {} };
  for (const f of MEMO_FIELDS) {
    if (f.key.startsWith("kpi1_")) out.kpi[f.key.slice(5)] = satz(f);
    else if (f.key.startsWith("bm1_")) out.benchmark[f.key.slice(4)] = satz(f);
    else if (f.key.startsWith("pot1_")) out.potential[f.key.slice(5)] = satz(f);
    else if (f.gruppe === undefined) out.felder[f.key] = satz(f);
  }
  return out;
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
