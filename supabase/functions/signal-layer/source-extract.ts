/**
 * Text aus einer öffentlichen Adresse holen. Eine Adresse genügt: bei einem
 * Video das Transkript, bei einer Seite den Artikeltext, bei einer Seite mit
 * eingebettetem Video beides.
 *
 * Portiert aus dem LinkedIn-Auto-Werkzeug, dort läuft die Extraktion lokal mit
 * yt-dlp und Whisper. Eine Edge Function hat keine lokale Laufzeit, deshalb
 * nur, was ein Server über HTTP erreicht, und deshalb eine Kette statt eines
 * Weges. Geprüft am 23.8.2026 an mehreren Videos:
 *
 *   1. Innertube-Player als ANDROID_VR: nennt Untertitelspuren und liefert
 *      ihren Text. Funktioniert bei manchen Videos, bei anderen antwortet
 *      YouTube mit LOGIN_REQUIRED ("damit wir sehen, dass du kein Bot bist").
 *   2. Wiedergabeseite: nennt die Spuren, ihr Text kommt bei einem Serverabruf
 *      aber meist mit 200 und null Bytes zurück.
 *   3. Piped-Spiegel: eine öffentliche API, mal erreichbar, mal nicht.
 *   4. Apify-Actor: läuft auf fremder Infrastruktur mit eigenen Adressen und
 *      kommt durch. Kostet je Video wenige Cent, deshalb der letzte Schritt.
 *   5. Videobeschreibung: kein Transkript, aber besser als nichts.
 *
 * Welcher Weg getragen hat, steht im Befund. Ohne Text wird nichts geraten.
 */

export type QuellenArt = "transcript" | "article" | "description" | "mixed";

export type QuellenText = {
  ok: boolean;
  art: QuellenArt | null;
  plattform: string;
  titel: string;
  text: string;
  zeichen: number;
  sprache: string | null;
  grund: string;
  /** Welcher Weg den Text gebracht hat, für den Befund im Fragebogen. */
  weg?: string;
  /** Was im Text steckt, wenn mehrere Quellen zusammengelegt wurden. */
  teile?: string[];
};

const MAX_ZEICHEN = 40_000;

/** Nur öffentliche Adressen. Ein Server, der interne Netze abruft, ist ein Loch. */
export function pruefeOeffentlicheUrl(rohwert: string): { ok: boolean; url: string; grund: string } {
  const wert = String(rohwert || "").trim();
  if (!wert) return { ok: false, url: "", grund: "Keine Adresse angegeben." };
  let url: URL;
  try {
    // Nur ein fehlendes Schema wird ergaenzt. "file:" oder "javascript:" bleiben
    // erhalten und fallen unten durch die Schemapruefung.
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(wert) ? wert : `https://${wert}`);
  } catch {
    return { ok: false, url: "", grund: "Das ist keine gültige Adresse." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, url: "", grund: "Nur http und https sind erlaubt." };
  }
  const host = url.hostname.toLowerCase();
  const verboten = host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")
    || /^(?:127|10)\./.test(host) || /^192\.168\./.test(host)
    || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)
    || /^169\.254\./.test(host) || host === "0.0.0.0" || host === "[::1]"
    || host.endsWith(".supabase.co");
  if (verboten) return { ok: false, url: "", grund: "Interne Adressen sind nicht erlaubt." };
  return { ok: true, url: url.toString(), grund: "" };
}

export function erkennePlattform(url: string): string {
  const host = (() => {
    try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
  })();
  if (/youtube\.com$|youtu\.be$/.test(host)) return "youtube";
  if (/linkedin\.com$/.test(host)) return "linkedin";
  if (/vimeo\.com$/.test(host)) return "vimeo";
  if (/spotify\.com$/.test(host)) return "spotify";
  if (/tiktok\.com$/.test(host)) return "tiktok";
  return host || "web";
}

export function youtubeId(url: string): string {
  try {
    const adresse = new URL(url);
    if (adresse.hostname.endsWith("youtu.be")) return adresse.pathname.slice(1, 20);
    return adresse.searchParams.get("v") || (adresse.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{6,20})/) || [])[1] || "";
  } catch {
    return "";
  }
}

/** Sichtbarer Text einer Seite. Skripte, Stile und Navigationsrümpfe raus. */
export function seitenText(html: string): { titel: string; text: string } {
  const roh = String(html || "");
  const titel = (roh.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)
    || roh.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i) || ["", ""])[1] || "";
  const kern = (roh.match(/<article[\s\S]*?<\/article>/i) || roh.match(/<main[\s\S]*?<\/main>/i) || [roh])[0];
  const text = kern
    .replace(/<(script|style|nav|footer|form|aside|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_treffer, ziffern) => String.fromCharCode(Number(ziffern)))
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { titel: entschaerfe(titel), text: text.slice(0, MAX_ZEICHEN) };
}

function entschaerfe(wert: string): string {
  return String(wert || "").replace(/\s+/g, " ").trim().slice(0, 300);
}

/** Untertitelspuren aus der Wiedergabeseite. Deutsch zuerst, dann Englisch. */
export function untertitelSpur(html: string): { url: string; sprache: string; automatisch: boolean } | null {
  const treffer = String(html || "").match(/"captionTracks":(\[[\s\S]*?\])/);
  if (!treffer) return null;
  let spuren: Array<Record<string, unknown>> = [];
  try {
    spuren = JSON.parse(treffer[1].replace(/\\u0026/g, "&"));
  } catch {
    return null;
  }
  const punkte = (spur: Record<string, unknown>) => {
    const code = String((spur.languageCode as string) || "").toLowerCase();
    const automatisch = String((spur.kind as string) || "") === "asr";
    return (code.startsWith("de") ? 4 : code.startsWith("en") ? 2 : 0) + (automatisch ? 0 : 1);
  };
  const beste = spuren.filter((spur) => spur.baseUrl).sort((links, rechts) => punkte(rechts) - punkte(links))[0];
  if (!beste) return null;
  return {
    url: String(beste.baseUrl).replace(/\\u0026/g, "&") + "&fmt=json3",
    sprache: String((beste.languageCode as string) || ""),
    automatisch: String((beste.kind as string) || "") === "asr",
  };
}

/** json3 der Untertitel in fortlaufenden Text. */
export function untertitelText(json3: unknown): string {
  const ereignisse = (json3 as { events?: Array<{ segs?: Array<{ utf8?: string }> }> })?.events || [];
  const zeilen = ereignisse
    .map((ereignis) => (ereignis.segs || []).map((teil) => String(teil.utf8 || "")).join(""))
    .map((zeile) => zeile.replace(/\s+/g, " ").trim())
    .filter((zeile) => zeile && zeile !== "\n");
  const text: string[] = [];
  for (const zeile of zeilen) {
    if (text[text.length - 1] === zeile) continue;
    text.push(zeile);
  }
  return text.join(" ").replace(/\s+/g, " ").trim().slice(0, MAX_ZEICHEN);
}

export type Netz = {
  /** GET. `json` ist gesetzt, wenn die Antwort JSON war. */
  holen: (url: string, headers?: Record<string, string>) => Promise<{ ok: boolean; text: string; json?: unknown }>;
  /** POST mit JSON-Rumpf. Fehlt er, entfällt der Innertube-Weg. */
  posten?: (url: string, body: unknown, headers?: Record<string, string>) => Promise<{ ok: boolean; text: string; json?: unknown }>;
  /**
   * Artikelleser des Crawlers. Ohne ihn liest `seitenText`, und der verliert
   * auf Redaktionsseiten gegen den ersten Teaserblock.
   */
  artikel?: (url: string) => Promise<{ titel: string; text: string } | null>;
  /** Apify-Actor mit Eingabe starten und die Ergebniszeilen zurückgeben. Kostet Geld. */
  apify?: (actor: string, eingabe: unknown) => Promise<unknown[] | null>;
};

/** Eine gefundene Untertitelspur, noch ohne Text. */
type Spur = { url: string; sprache: string; automatisch: boolean };

const YOUTUBE_TRANSCRIPT_ACTOR = "starvibe~youtube-video-transcript";

/** Deutsch vor Englisch, von Hand vor automatisch. */
function spurPunkte(sprache: string, automatisch: boolean): number {
  const code = String(sprache || "").toLowerCase();
  return (code.startsWith("de") ? 4 : code.startsWith("en") ? 2 : 0) + (automatisch ? 0 : 1);
}

/** Untertitelspuren aus einer Innertube-Antwort. */
function spurenAusPlayer(antwort: unknown): Spur[] {
  const wurzel = antwort as {
    captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: Array<Record<string, unknown>> } };
  };
  const spuren = wurzel?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  return spuren
    .filter((spur) => spur && spur.baseUrl)
    .map((spur) => ({
      url: String(spur.baseUrl),
      sprache: String((spur.languageCode as string) || ""),
      automatisch: String((spur.kind as string) || "") === "asr",
    }))
    .sort((links, rechts) => spurPunkte(rechts.sprache, rechts.automatisch) - spurPunkte(links.sprache, links.automatisch));
}

/**
 * Innertube-Player als ANDROID_VR. Dieser Client braucht kein Herkunftstoken,
 * deshalb kommt er bei manchen Videos durch, wo die Wiedergabeseite nur eine
 * Spurenliste ohne Text hergibt.
 */
async function playerAntwort(id: string, netz: Netz): Promise<Record<string, unknown> | null> {
  if (!netz.posten) return null;
  const antwort = await netz.posten(
    "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
    {
      videoId: id, contentCheckOk: true, racyCheckOk: true,
      context: {
        client: {
          clientName: "ANDROID_VR", clientVersion: "1.60.19", deviceMake: "Oculus", deviceModel: "Quest 3",
          osName: "Android", osVersion: "12", androidSdkVersion: 32, hl: "de", gl: "DE",
        },
      },
    },
    {
      "User-Agent": "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12; GB) gzip",
      "X-Youtube-Client-Name": "28", "X-Youtube-Client-Version": "1.60.19",
    },
  ).catch(() => null);
  if (!antwort || !antwort.ok) return null;
  const daten = (antwort.json ?? safeJson(antwort.text)) as Record<string, unknown> | null;
  return daten && typeof daten === "object" ? daten : null;
}

/** Text einer Spur holen. YouTube antwortet je nach Weg mit json3 oder XML. */
async function spurText(spur: Spur, netz: Netz): Promise<string> {
  for (const ziel of [`${spur.url}&fmt=json3`, spur.url]) {
    const antwort = await netz.holen(ziel).catch(() => null);
    if (!antwort || !antwort.ok || !antwort.text) continue;
    const text = untertitelText(antwort.json ?? safeJson(antwort.text)) || zeitTextAusXml(antwort.text);
    if (text.length > 200) return text;
  }
  return "";
}

/** Piped-Spiegel: eine öffentliche API auf YouTube, mal erreichbar, mal nicht. */
const PIPED_HOSTS = ["api.piped.private.coffee", "pipedapi.kavin.rocks", "pipedapi.adminforge.de", "pipedapi.orangenet.cc"];

async function pipedTranskript(id: string, netz: Netz): Promise<{ text: string; sprache: string; automatisch: boolean } | null> {
  for (const host of PIPED_HOSTS) {
    const antwort = await netz.holen(`https://${host}/streams/${id}`).catch(() => null);
    if (!antwort || !antwort.ok) continue;
    const daten = (antwort.json ?? safeJson(antwort.text)) as { subtitles?: Array<Record<string, unknown>> } | null;
    const spuren = Array.isArray(daten?.subtitles) ? daten!.subtitles! : [];
    const sortiert = spuren
      .filter((spur) => spur && spur.url)
      .sort((links, rechts) => spurPunkte(String(rechts.code || ""), Boolean(rechts.autoGenerated))
        - spurPunkte(String(links.code || ""), Boolean(links.autoGenerated)));
    for (const spur of sortiert.slice(0, 2)) {
      const datei = await netz.holen(String(spur.url)).catch(() => null);
      if (!datei || !datei.ok || !datei.text) continue;
      const text = zeitTextAusXml(datei.text) || vttText(datei.text);
      if (text.length > 200) {
        return { text, sprache: String(spur.code || ""), automatisch: Boolean(spur.autoGenerated) };
      }
    }
  }
  return null;
}

/**
 * Apify-Actor. Läuft auf fremder Infrastruktur mit eigenen Adressen und kommt
 * dort durch, wo YouTube einen Server abweist. Kostet je Video wenige Cent,
 * deshalb erst, wenn die freien Wege nichts gebracht haben.
 */
async function apifyTranskript(url: string, netz: Netz): Promise<{ text: string; sprache: string; automatisch: boolean; titel: string; beschreibung: string } | null> {
  if (!netz.apify) return null;
  const zeilen = await netz.apify(YOUTUBE_TRANSCRIPT_ACTOR, { youtube_url: url, language: "de" }).catch(() => null);
  const zeile = (zeilen || [])[0] as Record<string, unknown> | undefined;
  if (!zeile) return null;
  const stuecke = Array.isArray(zeile.transcript) ? zeile.transcript as Array<Record<string, unknown>> : [];
  const text = stuecke.map((stueck) => String(stueck.text ?? "")).join(" ").replace(/\s+/g, " ").trim().slice(0, MAX_ZEICHEN);
  if (text.length <= 200) return null;
  return {
    text,
    sprache: String(zeile.selected_language ?? zeile.language ?? ""),
    automatisch: zeile.is_auto_generated === true || /auto/i.test(String(zeile.selected_language ?? "")),
    titel: String(zeile.title ?? ""),
    beschreibung: String(zeile.description ?? ""),
  };
}

/** Zeitmarkiertes XML (timedtext format=3 und TTML) in fortlaufenden Text. */
export function zeitTextAusXml(xml: string): string {
  const roh = String(xml || "");
  if (!/<(?:p|text)\b/i.test(roh)) return "";
  const zeilen = (roh.match(/<(?:p|text)\b[^>]*>([\s\S]*?)<\/(?:p|text)>/gi) || [])
    .map((block) => block
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;#39;|&#39;/g, "'").replace(/&amp;quot;|&quot;/g, '"')
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return ohneWiederholung(zeilen).slice(0, MAX_ZEICHEN);
}

/** WebVTT in fortlaufenden Text. */
export function vttText(vtt: string): string {
  const roh = String(vtt || "");
  if (!/-->/.test(roh)) return "";
  const zeilen = roh.split(/\r?\n/)
    .filter((zeile) => !/-->/.test(zeile) && !/^WEBVTT|^NOTE|^\d+$|^Kind:|^Language:/.test(zeile.trim()))
    .map((zeile) => zeile.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return ohneWiederholung(zeilen).slice(0, MAX_ZEICHEN);
}

/** Aufeinanderfolgende Wiederholungen weg: Untertitel rollen zeilenweise mit. */
function ohneWiederholung(zeilen: string[]): string {
  const raus: string[] = [];
  for (const zeile of zeilen) {
    if (raus[raus.length - 1] === zeile) continue;
    // Rollende Untertitel wiederholen den Vorgaenger als Anfang der naechsten Zeile.
    const vorher = raus[raus.length - 1];
    if (vorher && zeile.startsWith(vorher)) {
      raus[raus.length - 1] = zeile;
      continue;
    }
    raus.push(zeile);
  }
  return raus.join(" ").replace(/\s+/g, " ").trim();
}

/** Eingebettete YouTube-Videos einer Seite, in der Reihenfolge des Vorkommens. */
export function eingebetteteVideos(html: string): string[] {
  const roh = String(html || "");
  const treffer = [
    ...roh.matchAll(/(?:youtube(?:-nocookie)?\.com\/(?:embed|v|shorts|live)\/|youtu\.be\/)([\w-]{11})/g),
    ...roh.matchAll(/youtube(?:-nocookie)?\.com\/watch\?(?:[^"'\s]*&)?v=([\w-]{11})/g),
    ...roh.matchAll(/data-(?:video|youtube)-?id=["']([\w-]{11})["']/gi),
  ].map((fund) => fund[1]);
  return [...new Set(treffer)];
}

/**
 * Transkript eines Videos über die Kette. Gibt zurück, welcher Weg getragen
 * hat, damit der Befund im Fragebogen nicht raten muss.
 */
export async function videoTranskript(id: string, netz: Netz, adresse?: string): Promise<
  { text: string; sprache: string; automatisch: boolean; weg: string; titel?: string; beschreibung?: string } | null
> {
  const url = adresse || `https://www.youtube.com/watch?v=${id}`;

  // 1. Innertube als ANDROID_VR.
  const player = await playerAntwort(id, netz);
  const playerTitel = String((player?.videoDetails as Record<string, unknown> | undefined)?.title || "");
  const playerSpuren = player ? spurenAusPlayer(player) : [];
  for (const spur of playerSpuren.slice(0, 2)) {
    const text = await spurText(spur, netz);
    if (text) {
      return { text, sprache: spur.sprache, automatisch: spur.automatisch, titel: playerTitel, weg: "Untertitel über den Player" };
    }
  }

  // 2. Wiedergabeseite: nennt die Spuren meist auch dann, wenn ihr Text leer bleibt.
  const seite = await netz.holen(url).catch(() => null);
  const seitenTitel = seite?.ok ? seitenText(seite.text).titel : "";
  const seitenSpur = seite?.ok ? untertitelSpur(seite.text) : null;
  if (seitenSpur) {
    const text = await spurText(seitenSpur, netz);
    if (text) {
      return {
        text, sprache: seitenSpur.sprache, automatisch: seitenSpur.automatisch,
        titel: playerTitel || seitenTitel, weg: "Untertitel der Wiedergabeseite",
      };
    }
  }

  // 3. Piped-Spiegel.
  const piped = await pipedTranskript(id, netz);
  if (piped) return { ...piped, titel: playerTitel || seitenTitel, weg: "Untertitel über einen Piped-Spiegel" };

  // 4. Apify. Kostet Geld, deshalb zuletzt.
  const apify = await apifyTranskript(url, netz);
  if (apify) return { ...apify, titel: apify.titel || playerTitel || seitenTitel, weg: "Transkript über Apify" };

  // 5. Nichts davon: die Beschreibung ist kein Transkript, wird aber gemeldet.
  const beschreibungPlayer = String((player?.videoDetails as Record<string, unknown> | undefined)?.shortDescription || "");
  const beschreibungSeite = (String(seite?.text || "").match(/"shortDescription":"([\s\S]{0,4000}?)","/) || ["", ""])[1]
    .replace(/\\n/g, " ").replace(/\\"/g, '"');
  const beschreibung = (beschreibungPlayer || beschreibungSeite).replace(/\s+/g, " ").trim();
  if (beschreibung.length > 120) {
    return {
      text: beschreibung, sprache: "", automatisch: false, weg: "nur die Videobeschreibung",
      titel: playerTitel || seitenTitel,
    };
  }
  return null;
}

/**
 * Der eigentliche Abruf. Eine Adresse, drei Fälle: Video, Seite, Seite mit
 * eingebettetem Video. Alles Netz kommt über `netz` herein, damit die Logik
 * ohne Netz geprüft werden kann.
 */
export async function ziehteQuelle(rohwert: string, netz: Netz): Promise<QuellenText> {
  const gepruef = pruefeOeffentlicheUrl(rohwert);
  if (!gepruef.ok) {
    return { ok: false, art: null, plattform: "", titel: "", text: "", zeichen: 0, sprache: null, grund: gepruef.grund };
  }
  const url = gepruef.url;
  const plattform = erkennePlattform(url);

  // --- Fall 1: die Adresse ist selbst ein Video ---------------------------
  if (plattform === "youtube") {
    const id = youtubeId(url);
    if (!id) {
      return {
        ok: false, art: null, plattform, titel: "", text: "", zeichen: 0, sprache: null,
        grund: "In dieser YouTube-Adresse steckt keine Videokennung.",
      };
    }
    const gefunden = await videoTranskript(id, netz, url);
    if (!gefunden) {
      return {
        ok: false, art: null, plattform, titel: "", text: "", zeichen: 0, sprache: null,
        grund: "Kein Weg hat ein Transkript hergegeben: kein Untertitel über den Player, keinen über die Seite, kein Spiegel erreichbar, kein Ergebnis über Apify.",
      };
    }
    const nurBeschreibung = gefunden.weg === "nur die Videobeschreibung";
    return {
      ok: true,
      art: nurBeschreibung ? "description" : "transcript",
      plattform, titel: entschaerfe(gefunden.titel || ""),
      text: gefunden.text.slice(0, MAX_ZEICHEN), zeichen: Math.min(gefunden.text.length, MAX_ZEICHEN),
      sprache: gefunden.sprache || null,
      weg: gefunden.weg,
      grund: [
        nurBeschreibung ? "Kein Transkript erreichbar, nur die Videobeschreibung. Belege daraus sind meist zu dünn." : "",
        // Der bezahlte Weg wird benannt, nicht stillschweigend genommen.
        gefunden.weg === "Transkript über Apify" ? "Über Apify gelesen, das kostet wenige Cent je Video." : "",
        !nurBeschreibung && gefunden.automatisch ? "Automatisch erzeugte Untertitel: Zahlen und Namen gegenprüfen." : "",
      ].filter(Boolean).join(" "),
    };
  }

  // --- Fall 2 und 3: eine Seite, vielleicht mit Video ---------------------
  const seite = await netz.holen(url).catch(() => null);
  if (!seite || !seite.ok) {
    return {
      ok: false, art: null, plattform, titel: "", text: "", zeichen: 0, sprache: null,
      grund: "Die Seite war nicht abrufbar. Öffentlich erreichbare Adresse prüfen.",
    };
  }
  const { titel, text } = seitenText(seite.text);
  let artikelTitel = titel;
  let artikelText = text;
  if (netz.artikel) {
    // Der eigene Leser nimmt den ersten <article>-Block, und der ist auf
    // Redaktionsseiten oft eine Teaserkarte. Die Kette des Crawlers wählt den
    // Block nach Absatzdichte und findet den Artikel auch dann.
    const gelesen = await netz.artikel(url).catch(() => null);
    if (gelesen) {
      // Gleich lang heisst: derselbe Text, dann ist der Titel des Crawlers der
      // bessere. Kuerzer heisst: der eigene Leser hatte mehr, das bleibt.
      if (gelesen.text.trim().length >= artikelText.length) {
        artikelText = gelesen.text.replace(/\s+/g, " ").trim().slice(0, MAX_ZEICHEN);
      }
      artikelTitel = entschaerfe(gelesen.titel) || artikelTitel;
    }
  }

  // Eingebettete Videos gehören zum Inhalt der Seite: ein Beitrag mit Video
  // trägt seine Zahlen oft im Gesagten, nicht im Text daneben.
  const teile: string[] = [];
  const abschnitte: string[] = [];
  if (artikelText.length >= 200) {
    teile.push(`Artikeltext (${artikelText.length.toLocaleString("de-DE")} Zeichen)`);
    abschnitte.push(artikelText);
  }
  let videoSprache: string | null = null;
  let videoWeg = "";
  for (const id of eingebetteteVideos(seite.text).slice(0, 2)) {
    const gefunden = await videoTranskript(id, netz);
    if (!gefunden || gefunden.weg === "nur die Videobeschreibung") continue;
    videoSprache = videoSprache || gefunden.sprache || null;
    videoWeg = videoWeg || gefunden.weg;
    teile.push(`Transkript des eingebetteten Videos (${gefunden.text.length.toLocaleString("de-DE")} Zeichen)`);
    abschnitte.push(`Transkript des eingebetteten Videos${gefunden.titel ? ` "${entschaerfe(gefunden.titel)}"` : ""}:\n${gefunden.text}`);
  }

  const gesamt = abschnitte.join("\n\n").slice(0, MAX_ZEICHEN);
  if (gesamt.length < 400) {
    return {
      ok: false, art: null, plattform, titel: artikelTitel, text: gesamt, zeichen: gesamt.length, sprache: null,
      grund: "Die Seite gibt zu wenig Text her, oft wegen Paywall oder JavaScript.",
    };
  }
  const mitVideo = teile.length > 1 || (teile.length === 1 && teile[0].startsWith("Transkript"));
  return {
    ok: true,
    art: teile.length > 1 ? "mixed" : mitVideo ? "transcript" : "article",
    plattform, titel: artikelTitel, text: gesamt, zeichen: gesamt.length, sprache: videoSprache,
    weg: mitVideo ? (videoWeg || "Seitentext und Video") : "Seitentext",
    teile, grund: "",
  };
}

/**
 * Ein eingefuegtes Transkript als Quelle. Der Weg fuer Videos: YouTube gibt
 * den Untertiteltext keinem Server heraus, das lokale Werkzeug erzeugt ihn mit
 * Whisper. Wer ihn einfuegt, ist selbst die Quelle, und derselbe Entwurf und
 * dieselbe Pruefung laufen darauf.
 */
export function transkriptQuelle(rohtext: string, titel = ""): QuellenText {
  const text = String(rohtext || "").replace(/\s+/g, " ").trim().slice(0, MAX_ZEICHEN);
  if (text.length < 400) {
    return {
      ok: false, art: null, plattform: "eingefügt", titel: entschaerfe(titel), text,
      zeichen: text.length, sprache: null,
      grund: `Der Text ist zu kurz für einen Entwurf: ${text.length} von 400 Zeichen.`,
    };
  }
  return {
    ok: true, art: "transcript", plattform: "eingefügt", titel: entschaerfe(titel), text,
    zeichen: text.length, sprache: null, grund: "",
  };
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

/** Die Felder, die ein manuelles Signal braucht, in der Reihenfolge des Fragebogens. */
export const MANUAL_DRAFT_FIELDS = ["headline", "core", "evidence", "source", "company", "offering", "territory", "occasion", "competitor"] as const;

export const MANUAL_DRAFT_SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING", description: "Das Signal in einem Satz, höchstens 56 Zeichen wenn möglich." },
    core: { type: "STRING", description: "Zwei bis drei Sätze: was passiert, bei wem, seit wann." },
    evidence: { type: "STRING", description: "Zahlen, Zitate und Namen wortgleich aus der Quelle. Nichts hinzufügen." },
    source: { type: "STRING", description: "Herausgeber, Titel und Jahr der Quelle." },
    company: { type: "STRING", description: "Das Unternehmen, um das es geht. Leer, wenn keines genannt ist." },
    offering: { type: "STRING", description: "Passende ROOTS-Leistung oder leer." },
    territory: { type: "STRING", description: "Markt oder Branche oder leer." },
    occasion: { type: "STRING", description: "Konkreter Anlass oder leer." },
    competitor: { type: "STRING", description: "Genannte Wettbewerber als Firmennamen oder leer." },
    missing: { type: "ARRAY", items: { type: "STRING" }, description: "Feldnamen, die die Quelle nicht belegt." },
    verdict: { type: "STRING", description: "tragfaehig, duenn oder untauglich" },
    verdict_reason: { type: "STRING", description: "Ein Satz, warum." },
  },
  required: ["headline", "core", "evidence", "missing", "verdict", "verdict_reason"],
} as const;

/** Der Auftrag an das Modell. Erfundene Zahlen sind schlimmer als leere Felder. */
export function manualDraftPrompt(quelle: QuellenText, lane: "marketing" | "sales"): string {
  return `Du liest eine Quelle und füllst daraus ein Signal für ROOTS Brand Strategy Consultants.

<regeln>
Nur was in der Quelle steht. Keine Zahl, kein Name, kein Zitat, das dort nicht vorkommt.
evidence enthält ausschliesslich wortgleiche Ausschnitte aus der Quelle, mit ihren Zahlen.
Was die Quelle nicht hergibt, bleibt leer und wird in missing genannt. Ein leeres Feld ist richtig, eine erfundene Angabe ist ein Fehler.
verdict ist "tragfaehig", wenn Überschrift, Kern und mindestens ein belegter Ausschnitt aus der Quelle stammen; "duenn", wenn der Kern steht, aber Zahlen oder Zitate fehlen; "untauglich", wenn die Quelle kein Signal hergibt.
${lane === "sales"
    ? "Spur Sales: das Signal soll den Anlass für die Ansprache eines Unternehmens tragen. company ist wichtig."
    : "Spur Marketing: das Signal soll einen LinkedIn-Beitrag tragen. Eine belegte Zahl ist wichtiger als ein Firmenname."}
</regeln>

<quelle art="${quelle.art || "unbekannt"}" plattform="${quelle.plattform}" titel="${quelle.titel.replace(/"/g, "'")}">
${quelle.text.slice(0, 24_000)}
</quelle>`;
}

/** Antwort des Modells auf die Felder des Fragebogens abbilden. */
export function normalizeManualDraft(raw: unknown): {
  felder: Record<string, string>;
  missing: string[];
  verdict: "tragfaehig" | "duenn" | "untauglich";
  verdictReason: string;
} {
  const quelle = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const felder: Record<string, string> = {};
  for (const key of MANUAL_DRAFT_FIELDS) {
    felder[key] = String(quelle[key] ?? "").replace(/\s+/g, " ").trim().slice(0, 2_000);
  }
  const gemeldet = Array.isArray(quelle.missing) ? quelle.missing.map((wert) => String(wert)) : [];
  const leer = MANUAL_DRAFT_FIELDS.filter((key) => !felder[key]);
  const missing = [...new Set([...gemeldet.filter((key) => (MANUAL_DRAFT_FIELDS as readonly string[]).includes(key)), ...leer])];
  const rohVerdict = String(quelle.verdict ?? "").toLowerCase();
  const verdict = rohVerdict.startsWith("trag") ? "tragfaehig" : rohVerdict.startsWith("unt") ? "untauglich" : "duenn";
  return {
    felder,
    missing,
    verdict,
    verdictReason: String(quelle.verdict_reason ?? "").replace(/\s+/g, " ").trim().slice(0, 400),
  };
}

/* ------------------------------------------------------------------------- *
 * Zweite Stufe: die Prüfung des fertigen Signals.
 *
 * Der Entwurf oben füllt nur, was in der Quelle steht. Was fehlt, trägt der
 * Nutzer selbst nach, und genau dort entsteht das Risiko: eine Zahl, die die
 * Quelle nicht deckt, wird im Asset zu einer belegten Aussage. Deshalb liest
 * das Modell am Ende die fertigen Felder noch einmal gegen die Quelle und sagt,
 * was trägt, was dünn ist und was widerlegt wird.
 * ------------------------------------------------------------------------- */

export type PruefBefund = {
  field: string;
  severity: "blocker" | "warn" | "info";
  note: string;
};

export type ManualCheck = {
  verdict: "tragfaehig" | "duenn" | "untauglich";
  verdictReason: string;
  findings: PruefBefund[];
  missing: string[];
  unsupported: string[];
  blocker: boolean;
  ready: boolean;
};

export const MANUAL_CHECK_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", description: "tragfaehig, duenn oder untauglich" },
    verdict_reason: { type: "STRING", description: "Ein Satz, warum das Urteil so ausfällt." },
    findings: {
      type: "ARRAY",
      description: "Je Fund ein Eintrag. Nur echte Funde, keine Bestätigungen.",
      items: {
        type: "OBJECT",
        properties: {
          field: { type: "STRING", description: "Feldname aus der Liste, oder leer für das ganze Signal." },
          severity: { type: "STRING", description: "blocker, warn oder info" },
          note: { type: "STRING", description: "Ein Satz: was ist das Problem, was ist zu tun." },
        },
        required: ["field", "severity", "note"],
      },
    },
    missing: { type: "ARRAY", items: { type: "STRING" }, description: "Feldnamen, die für dieses Signal noch gebraucht werden." },
    unsupported: { type: "ARRAY", items: { type: "STRING" }, description: "Feldnamen mit Angaben, die die Quelle nicht deckt." },
  },
  required: ["verdict", "verdict_reason", "findings"],
} as const;

const CHECK_FELDER = ["headline", "core", "evidence", "source", "company", "offering", "territory", "occasion", "competitor"] as const;

/**
 * Der Prüfauftrag. Zwei Sorten Felder, zwei Maßstäbe: was aus der Quelle
 * gezogen wurde, muss dort wortgleich wiederzufinden sein; was der Nutzer
 * selbst geschrieben hat, darf über die Quelle hinausgehen, ihr aber nicht
 * widersprechen.
 */
export function manualCheckPrompt(
  felder: Record<string, string>,
  quelle: QuellenText | null,
  lane: "marketing" | "sales",
  ausQuelle: string[],
): string {
  const liste = CHECK_FELDER
    .map((key) => `${key}${ausQuelle.includes(key) ? " (aus der Quelle gezogen)" : " (selbst geschrieben)"}: ${felder[key] || "(leer)"}`)
    .join("\n");
  const quellenblock = quelle && quelle.ok
    ? `<quelle art="${quelle.art || "unbekannt"}" plattform="${quelle.plattform}">
${quelle.text.slice(0, 20_000)}
</quelle>`
    : `<quelle>Keine Quelle vorhanden. Prüfe nur, ob die Angaben in sich tragen: konkret, widerspruchsfrei, mit einem Beleg, der eine Zahl oder ein Zitat enthält.</quelle>`;

  return `Du prüfst ein Signal für ROOTS Brand Strategy Consultants, bevor daraus ein Asset entsteht.

<maßstab>
Felder mit "(aus der Quelle gezogen)": jede Zahl, jeder Name und jedes Zitat darin muss in der Quelle stehen. Findest du eine Angabe dort nicht, ist das ein blocker.
Felder mit "(selbst geschrieben)": dürfen über die Quelle hinausgehen. Sie dürfen ihr nicht widersprechen, und sie müssen konkret sein. Platzhalter wie "diverse", "verschiedene", "siehe oben", "tbd", "k. A." sind ein blocker.
evidence trägt das ganze Asset. Ohne Zahl und ohne Zitat ist evidence höchstens "duenn".
headline und core müssen dasselbe Signal beschreiben. Ein Widerspruch zwischen beiden ist ein blocker.
${lane === "sales"
    ? "Spur Sales: ohne company gibt es kein Ziel für die Ansprache. Fehlt es, gehört company in missing."
    : "Spur Marketing: eine belegte Zahl trägt den Beitrag. Fehlt jede Zahl, gehört evidence in missing."}
verdict ist "untauglich", sobald ein blocker vorliegt; "duenn", wenn nur Warnungen bleiben; "tragfaehig", wenn nichts Wesentliches fehlt.
Keine Lobzeilen. Steht ein Feld, schreibe dazu nichts.
</maßstab>

<signal spur="${lane}">
${liste}
</signal>

${quellenblock}`;
}

/** Antwort des Modells auf einen verlässlichen Befund abbilden. */
export function normalizeManualCheck(raw: unknown): ManualCheck {
  const quelle = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const erlaubt = CHECK_FELDER as readonly string[];
  const feldname = (wert: unknown) => {
    const key = String(wert ?? "").trim();
    return erlaubt.includes(key) ? key : "";
  };
  const findings: PruefBefund[] = (Array.isArray(quelle.findings) ? quelle.findings : [])
    .map((eintrag) => {
      const fund = (eintrag && typeof eintrag === "object" ? eintrag : {}) as Record<string, unknown>;
      const stufe = String(fund.severity ?? "").toLowerCase();
      return {
        field: feldname(fund.field),
        severity: stufe.startsWith("block") ? "blocker" as const : stufe.startsWith("info") ? "info" as const : "warn" as const,
        note: String(fund.note ?? "").replace(/\s+/g, " ").trim().slice(0, 400),
      };
    })
    .filter((fund) => fund.note);
  const liste = (wert: unknown) => [...new Set(
    (Array.isArray(wert) ? wert : []).map(feldname).filter(Boolean),
  )];
  const unsupported = liste(quelle.unsupported);
  const missing = liste(quelle.missing);
  // Ein Feld, dessen Angabe die Quelle nicht deckt, ist immer ein blocker,
  // auch wenn das Modell dazu nur eine Warnung geschrieben hat.
  const blocker = findings.some((fund) => fund.severity === "blocker") || unsupported.length > 0;
  const rohVerdict = String(quelle.verdict ?? "").toLowerCase();
  const verdict = blocker
    ? "untauglich" as const
    : rohVerdict.startsWith("trag") ? "tragfaehig" as const : rohVerdict.startsWith("unt") ? "untauglich" as const : "duenn" as const;
  return {
    verdict,
    verdictReason: String(quelle.verdict_reason ?? "").replace(/\s+/g, " ").trim().slice(0, 400),
    findings,
    missing,
    unsupported,
    blocker,
    ready: !blocker && verdict !== "untauglich",
  };
}
