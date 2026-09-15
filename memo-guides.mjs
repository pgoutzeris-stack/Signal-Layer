/**
 * Der Feldvertrag des ROOTS Executive Memos.
 *
 * Die Vorlage hat vier feste Seiten und rund fünfzig Felder. Jedes Feld hat
 * eine eigene Aufgabe, eine eigene Textart und eine Länge, bei der die Seite
 * aufgeht. Zu kurze Texte hinterlassen eine weisse Wanne über dem Fussband, zu
 * lange schieben die Seite über 297 mm.
 *
 * Die Längen sind am Referenzmemo gemessen, nicht geschätzt: alle Zahlen unten
 * stammen aus dem vierseitigen Deichmann-Memo (Wortzahl je Feld). Der
 * Zielbereich liegt um den gemessenen Wert herum.
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
 * Die Abschnitte in der Reihenfolge des Dokuments. `seite` ist die Seite der
 * Vorlage, damit die Vorschau beim Wechsel des Abschnitts mitblättert.
 *
 * Feldarten:
 *   these      Überschrift mit Aussage, kein Schlusspunkt
 *   schluessel Cover-Schlüssel, höchstens acht Wörter, kein Schlusspunkt
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
    label: "Cover",
    hinweis: "Die These des Memos und die drei Schlüssel darunter.",
    fields: [
      {
        key: "title", label: "Titel", art: "these", rows: 2, min: 6, max: 15, pflicht: true,
        hilfe: "Die offene Aufgabe als These mit Verb. Nicht die Meldung, nicht der Name der ROOTS-Leistung.",
        beispiel: "Deichmanns Eigenmarken haben Potenzial für mehr als Preisführerschaft",
      },
      {
        key: "standfirst", label: "Standfirst", art: "satz", rows: 3, min: 12, max: 30,
        hilfe: "Ein bis zwei Sätze, warum die Aufgabe jetzt anliegt. Der Beleg aus dem Artikel als Zeitpunkt, keine zweite These.",
        beispiel: "Wie Deichmann seine Eigenmarken weiterentwickelt: durch klare Positionierung, gezielte Aktivierung und eine moderne Markenarchitektur.",
      },
      {
        key: "summary_0", label: "Status quo", art: "schluessel", rows: 1, min: 3, max: 8,
        hilfe: "Die heutige Lage des Adressaten in einer Zeile.",
        beispiel: "Deichmann mit starker Eigenmarkenquote",
      },
      {
        key: "summary_1", label: "Markt-Insight", art: "schluessel", rows: 1, min: 3, max: 8,
        hilfe: "Der Marktbefund, wenn möglich mit einer belegten Zahl.",
        beispiel: "81 % der Kunden bleiben Eigenmarken treu",
      },
      {
        key: "summary_2", label: "Das Potenzial", art: "schluessel", rows: 1, min: 3, max: 8,
        hilfe: "Der Hebel, an dem ROOTS ansetzt.",
        beispiel: "Eigen- und Ankermarken neu positionieren",
      },
    ],
  },
  {
    id: "memo_markt",
    seite: 2,
    label: "01 Marktdynamik",
    hinweis: "Der Markt bewegt sich. Vier belegte Kennzahlen und zwei Absätze tragen diese Seite.",
    fields: [
      {
        key: "market_title", label: "Seitenüberschrift", art: "these", rows: 2, min: 8, max: 18,
        hilfe: "Die Kategorie oder der Markt, nicht das Unternehmen.",
        beispiel: "Vier von fünf Verbrauchern bleiben bei Eigenmarken, auch wenn Markenprodukte günstiger werden",
      },
      {
        key: "market_p1", label: "Absatz über der Kennzahlenleiste", art: "absatz", rows: 6, min: 45, max: 85,
        hilfe: "Die Lage des Marktes. Dieser Absatz trägt das obere Drittel der Seite; unter 45 Wörtern bleibt die Seite leer.",
        beispiel: "Im Handel hat sich die Rolle der Eigenmarke grundlegend verschoben. Was früher der günstige Kompromiss war, ist heute eine bewusste Kaufentscheidung. Für Deichmann trifft diese Entwicklung auf eine außergewöhnlich starke Ausgangslage im Sortiment.",
      },
      {
        key: "insight_title", label: "Aussage neben dem Bild", art: "these", rows: 3, min: 6, max: 16,
        hilfe: "Der Befund zum Adressaten. Nicht die Seitenüberschrift wiederholen.",
        beispiel: "Eigenmarken funktionieren bei Deichmann aktuell überwiegend über funktionale Preiskommunikation.",
      },
      {
        key: "market_p2", label: "Absatz unter der Aussage", art: "absatz", rows: 6, min: 45, max: 85,
        hilfe: "Warum der Moment jetzt ist. Trägt die untere Seitenhälfte neben dem Bild.",
        beispiel: "Ein Blick in den Store zeigt die heutige Logik: Das Sortiment ist klar nach Zielgruppen strukturiert. Am POS stehen die Marken jedoch im direkten Wettbewerbsumfeld etablierter Herstellermarken und werden vor allem über Preis und Produktleistung differenziert.",
      },
    ],
  },
  {
    id: "memo_kpis",
    seite: 2,
    label: "Kennzahlen",
    hinweis: "Vier Kästen. Jede Zahl trägt ihren Bezug und ihre Quelle, sonst steht sie ohne Deckung.",
    fields: [0, 1, 2, 3].flatMap((i) => [
      {
        key: `kpi${i + 1}_value`, label: `Kennzahl ${i + 1}`, art: "zahl", rows: 1, min: 1, max: 4,
        hilfe: "Eine Zeile, deutsch formatiert, z. B. 42 % oder 8,9 Mrd. €.",
        beispiel: ["42 %", "81 %", "76 %", "> 70 %"][i],
        gruppe: i,
      },
      {
        key: `kpi${i + 1}_label`, label: "Bezug", art: "satz", rows: 2, min: 4, max: 16,
        hilfe: "Worauf sich die Zahl bezieht, ein halber Satz.",
        beispiel: ["der Verbraucher greifen überwiegend zu Eigenmarken", "bleiben Eigenmarken treu, auch bei sinkenden Markenpreisen", "halten Eigenmarken für eine gute Alternative", "der verkauften Schuhe sind Eigenmarken"][i],
        gruppe: i,
      },
      {
        key: `kpi${i + 1}_source`, label: "Quelle", art: "quelle", rows: 1, min: 1, max: 6,
        hilfe: "Herausgeber und Jahr.",
        beispiel: ["Simon-Kucher, 2026", "Simon-Kucher, 2026", "NielsenIQ / PLMA, 2025", "Deichmann, 2023/2025"][i],
        gruppe: i,
      },
    ]),
  },
  {
    id: "memo_benchmarks",
    seite: 3,
    label: "02 Benchmarks",
    hinweis: "Drei Marken, die denselben Hebel schon gezogen haben. Nur Fälle, die gewirkt haben.",
    fields: [
      {
        key: "benchmark_title", label: "Seitenüberschrift", art: "these", rows: 2, min: 8, max: 20,
        hilfe: "Was die drei Marken gemeinsam richtig machen.",
        beispiel: "Parkside, Balea und Van Rysel schaffen einen Markenauftritt mit eigenem Design, Botschaftern und eigenen Kanälen",
      },
      {
        key: "benchmark_lead", label: "Vorspann", art: "satz", rows: 2, min: 6, max: 24,
        hilfe: "Ein Satz, worin der Hebel liegt. Nicht die Nachricht.",
        beispiel: "Der Hebel liegt im eigenen Auftritt, nicht im Preis.",
      },
      ...[0, 1, 2].flatMap((i) => [
        {
          key: `bm${i + 1}_name`, label: `Benchmark ${i + 1}`, art: "name", rows: 1, min: 1, max: 5,
          hilfe: "Marke, bei Handelsmarken „Händler · Marke“.",
          beispiel: ["Lidl · Parkside", "dm · Balea", "Decathlon · Van Rysel"][i],
          gruppe: i,
        },
        {
          key: `bm${i + 1}_title`, label: "Überschrift der Karte", art: "these", rows: 1, min: 3, max: 9,
          hilfe: "Was diese Marke getan hat, ohne Schlusspunkt.",
          beispiel: ["Eigener Auftritt und großer Botschafter", "Markenaufbau über eigene Kanäle und Creator", "Eigenes Profiteam und eigene Brand-Stores"][i],
          gruppe: i,
        },
        {
          key: `bm${i + 1}_text`, label: "Beleg", art: "absatz", rows: 4, min: 22, max: 48,
          hilfe: "Die Handlung und warum sie gewirkt hat. Unter 22 Wörtern reisst die Karte auseinander.",
          beispiel: ["Lidl ordnet Non-Food in sechs Themenwelten mit je einer Ankermarke. Parkside tritt im eigenen Farbcode ohne Lidl-Logo auf, führt einen eigenen Claim und hat seit 2023 einen Markenbotschafter.", "Balea baut die Marke selbst auf: eigener Instagram-Kanal mit eigener Community und Creator-Kooperationen.", "Aus über 70 Eigenmarken wurden neun Kategoriemarken und vier Expertenmarken. Van Rysel rüstet ein WorldTour-Team aus."][i],
          gruppe: i,
        },
        {
          key: `bm${i + 1}_tag`, label: "Lehre", art: "satz", rows: 2, min: 5, max: 16,
          hilfe: "Was davon auf den Adressaten übertragbar ist.",
          beispiel: ["Einheitliches Markenbild plus Botschafter geben der Eigenmarke einen Charakter.", "Eigene Kanäle und Creator erzeugen Bindung, die kein Regalplatz ersetzt.", "Teamsponsoring macht aus dem Sortimentslabel eine sichtbare Marke."][i],
          gruppe: i,
        },
      ]),
      {
        key: "quote_text", label: "Zitat im blauen Band", art: "satz", rows: 3, min: 14, max: 34,
        hilfe: "Die Lehre der drei Fälle als ROOTS-Haltung. Kein Zitat aus dem Artikel, keine fremde Person.",
        beispiel: "Die Neupositionierung von Eigenmarken schafft eine eigenständige Markenarchitektur, die wirksam differenziert und neue Zielgruppen erschließt.",
      },
      {
        key: "sources", label: "Quellenzeile", art: "liste", rows: 3, min: 3, max: 45,
        hilfe: "Belege als „Titel · Herausgeber · Jahr“, mit Semikolon getrennt.",
        beispiel: "Presseinformationen Lidl (2022 bis 2026); Lebensmittelzeitung; YouGov BrandIndex (Mai 2026)",
      },
    ],
  },
  {
    id: "memo_empfehlung",
    seite: 4,
    label: "03 ROOTS Empfehlung",
    hinweis: "Drei Hebel für diesen Adressaten, dann die Gesprächsfrage.",
    fields: [
      {
        key: "potentials_title", label: "Seitenüberschrift", art: "these", rows: 2, min: 6, max: 16,
        hilfe: "Der Check für dieses Unternehmen.",
        beispiel: "Drei strategische Hebel zur Optimierung von Deichmanns starken Eigenmarken",
      },
      {
        key: "potentials_lead", label: "Vorspann", art: "absatz", rows: 5, min: 28, max: 65,
        hilfe: "Was der Check zeigt. Dieser Absatz hält die Karten auf der Seite unten.",
        beispiel: "Die Analyse zeigt: Deichmann verfügt mit seinem hohen Eigenmarkenanteil über eine starke Ausgangsbasis. Das zusätzliche Potenzial liegt darin, ausgewählte Eigenmarken über ihre funktionale Rolle hinaus zu eigenständigen Marken zu entwickeln.",
      },
      ...[0, 1, 2].flatMap((i) => [
        {
          key: `pot${i + 1}_title`, label: `Hebel ${i + 1} (${["Strategie", "Wachstum", "Aktivierung"][i]})`, art: "these", rows: 2, min: 3, max: 9,
          hilfe: "Verb oder Gegensatz, kein Schlusspunkt.",
          beispiel: ["Positionierung und Markenarchitektur schärfen", "Kanäle und Touchpoints gezielt aufbauen", "Marke am POS und im Produkt erlebbar machen"][i],
          gruppe: i,
        },
        {
          key: `pot${i + 1}_finding`, label: "Befund", art: "satz", rows: 3, min: 8, max: 28,
          hilfe: "Der belegte Zustand heute.",
          beispiel: ["Die Eigenmarken überschneiden sich in Zielgruppe und Preislage.", "Online und Fläche sprechen unterschiedlich.", "Am POS bleibt die Eigenmarke vom Herstellerregal kaum unterscheidbar."][i],
          gruppe: i,
        },
        {
          key: `pot${i + 1}_potential`, label: "Was ROOTS daraus macht", art: "absatz", rows: 5, min: 18, max: 45,
          hilfe: "Der Hebel in der Sprache des Falls, ohne erfundene Zahl.",
          beispiel: ["Zielgruppen und Preissegmente klar abgrenzen und für Kernmarken eigenständige Leistungsversprechen definieren, die über den Preis hinaus Orientierung schaffen.", "Für ausgewählte Kernmarken eigene Markenwelten über digitale Kanäle und Kooperationen aufbauen.", "Eigenmarken auf der Fläche visuell klarer differenzieren und die Markenwerte bis ins Produkt übersetzen."][i],
          gruppe: i,
        },
      ]),
      {
        key: "cta", label: "Frage im blauen Band", art: "these", rows: 2, min: 5, max: 16,
        hilfe: "Eine Frage an den Adressaten, ohne Werbeton.",
        beispiel: "Wollen Sie die Wachstumspotenziale Ihrer Eigenmarken heben?",
      },
      {
        key: "about_fit", label: "Anschluss an ROOTS", art: "absatz", rows: 4, min: 15, max: 50,
        hilfe: "Ein bis zwei Sätze, die die ROOTS-Leistung an diesen Fall binden. Erst hier darf die Leistung beim Namen genannt werden.",
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
  const section = MEMO_SECTIONS.find((s) => s.id === sectionId);
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
  if (feld.art === "quelle" && !JAHR.test(text)) {
    zeilen.push({ ton: "warn", text: "Ohne Jahr ist die Zahl nicht nachprüfbar." });
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
