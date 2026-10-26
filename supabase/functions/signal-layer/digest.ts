/**
 * Wochenmail: die neuen Signale als HTML im ROOTS-Stil. Reine Funktionen,
 * damit sie ohne Deno-Laufzeit getestet werden koennen. Versand ueber Resend
 * passiert in index.ts (Aktion send_signal_digest).
 */

export type DigestSignal = {
  lane: string;
  signal_label: string | null;
  headline_de: string | null;
  why_de: string | null;
  company: string | null;
  roots_offering: string | null;
  score: number | null;
  tier1_companies: string[] | null;
  tier2_companies: string[] | null;
  article_id: string;
  quelle: string | null;
  datum: string | null;
  url?: string | null;
};

export const DIGEST_APP_URL = "https://pgoutzeris-stack.github.io/Signal-Layer/";

function esc(wert: unknown): string {
  return String(wert ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function datumDe(iso: string | null): string {
  const datum = new Date(iso || "");
  return Number.isNaN(datum.getTime())
    ? ""
    : datum.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
}

const LOGO_URL = "https://pgoutzeris-stack.github.io/Signal-Layer/assets/roots-logo-mail-schwarz.png";
const SCHRIFT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const TINTE = "#1f2937";
const GRAU = "#6b7280";
const HELLGRAU = "#9ca3af";
const LINIE = "#eef1f5";
const HELLBLAU = "#5b9bff";

/** Link ins Signal-Popup des Tools, nicht zum Originalartikel. */
function linkVon(signal: DigestSignal): string {
  return /^[0-9a-f-]{36}$/i.test(signal.article_id) ? `${DIGEST_APP_URL}?signal=${signal.article_id}` : DIGEST_APP_URL;
}

function metaVon(signal: DigestSignal): string {
  return [firmaVon(signal), signal.signal_label, signal.quelle].filter(Boolean).join(" · ");
}

function firmaVon(signal: DigestSignal): string {
  return signal.company || (signal.tier1_companies || [])[0] || (signal.tier2_companies || [])[0] || "";
}

/** Eine Zeile: Titel, darunter Unternehmen, Thema und Quelle. */
function zeile(signal: DigestSignal): string {
  return `<tr><td style="padding:14px 0;border-bottom:1px solid ${LINIE};">
    <a href="${esc(linkVon(signal))}" style="font:500 15px/1.45 ${SCHRIFT};color:${TINTE};text-decoration:none;">${esc(signal.headline_de)}</a>
    <div style="margin-top:3px;font:400 12px/1.5 ${SCHRIFT};color:${HELLGRAU};">${esc(metaVon(signal))}</div>
  </td></tr>`;
}

/** Abschnitt je Bereich: Ueberschrift mit Anzahl, darunter die besten Signale. */
function abschnitt(titel: string, signale: DigestSignal[], gezeigt: DigestSignal[]): string {
  if (!gezeigt.length) return "";
  return `<tr><td style="padding:32px 0 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font:600 12px/1.4 ${SCHRIFT};letter-spacing:.06em;text-transform:uppercase;color:${TINTE};">${titel}</td>
        <td align="right" style="font:400 12px/1.4 ${SCHRIFT};color:${HELLGRAU};">${signale.length}</td>
      </tr></table>
    </td></tr>
    <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${gezeigt.map(zeile).join("")}</table></td></tr>`;
}

/** Kleiner Knopf. */
function knopf(text: string, href: string, voll: boolean): string {
  const farbe = voll ? "background:#206efb;color:#ffffff;" : `background:#f3f6fb;color:${GRAU};`;
  return `<a href="${esc(href)}" style="display:inline-block;margin:0 4px 8px;padding:9px 18px;border-radius:999px;${farbe}font:600 12px/1 ${SCHRIFT};text-decoration:none;">${text}</a>`;
}

const JE_BEREICH = 5;

/** Betreff und HTML der Mail: je Bereich die fuenf Signale mit dem hoechsten Score. */
export function baueDigest(signale: DigestSignal[], _zeitraum: string, test = false): { betreff: string; html: string } {
  // Gleicher Score: neueres Signal zuerst, damit die Reihenfolge fest ist.
  const sortiert = [...signale].sort((a, b) => Number(b.score || 0) - Number(a.score || 0)
    || String(b.datum || "").localeCompare(String(a.datum || "")));
  const sales = sortiert.filter((signal) => signal.lane === "sales");
  const marketing = sortiert.filter((signal) => signal.lane !== "sales");
  const gezeigtMarketing = marketing.slice(0, JE_BEREICH);
  const gezeigtSales = sales.slice(0, JE_BEREICH);
  const rest = Math.max(0, sortiert.length - gezeigtMarketing.length - gezeigtSales.length);
  const betreff = `${test ? "[Test] " : ""}${signale.length} neue Signale verfügbar · ROOTS Signal Layer`;
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(betreff)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:32px 18px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
    <tr><td style="padding-bottom:16px;border-bottom:1px solid ${LINIE};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;"><img src="${LOGO_URL}" width="84" height="20" alt="ROOTS Brand Strategy Consultants" style="display:block;border:0;width:84px;height:auto;"></td>
        <td align="right" style="vertical-align:middle;"><span style="display:inline-block;padding:3px 9px;border-radius:999px;background:#f3f6fb;color:#5b8def;font:600 10px/1.4 ${SCHRIFT};letter-spacing:.04em;white-space:nowrap;">${signale.length} NEU</span></td>
      </tr></table>
    </td></tr>
    ${abschnitt("Marketing", marketing, gezeigtMarketing)}
    ${abschnitt("Sales", sales, gezeigtSales)}
    <tr><td align="center" style="padding:32px 0 6px;">
      ${knopf("Signal Layer öffnen", DIGEST_APP_URL, true)}${rest ? knopf(`${rest} weitere`, DIGEST_APP_URL, false) : ""}
    </td></tr>
    <tr><td align="center" style="padding:18px 0 0;">
      <img src="${LOGO_URL}" width="84" height="13" alt="ROOTS" style="display:inline-block;border:0;width:84px;height:auto;">
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
  return { betreff, html };
}

/** Debug-Mail nur an den Betreiber: warum heute keine Tagesmail ans Team ging. */
export function baueDebugMail(befunde: string[], kennzahlen: Record<string, string>): { betreff: string; html: string } {
  const betreff = "Signal Layer: keine Tagesmail verschickt";
  const zeilen = befunde.map((befund) => `<tr><td style="padding:8px 0;border-bottom:1px solid ${LINIE};font:500 14px/1.45 ${SCHRIFT};color:${TINTE};">${esc(befund)}</td></tr>`).join("");
  const zahlen = Object.entries(kennzahlen).map(([name, wert]) => `<tr><td style="padding:4px 0;font:400 12px/1.4 ${SCHRIFT};color:${GRAU};">${esc(name)}</td><td align="right" style="padding:4px 0;font:500 12px/1.4 ${SCHRIFT};color:${TINTE};">${esc(wert)}</td></tr>`).join("");
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(betreff)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 18px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
    <tr><td style="padding-bottom:18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;border:1px solid #e8edf3;border-radius:14px;"><tr>
        <td style="padding:12px 16px;"><img src="${LOGO_URL}" width="92" height="22" alt="ROOTS" style="display:block;border:0;width:92px;height:auto;"></td>
        <td align="right" style="padding:12px 16px;"><span style="display:inline-block;padding:5px 11px;border-radius:999px;background:#fdecec;color:#b91c1c;font:600 11px/1.3 ${SCHRIFT};">Nur an dich</span></td>
      </tr></table>
    </td></tr>
    <tr><td style="padding-bottom:6px;font:600 20px/1.3 ${SCHRIFT};color:${TINTE};">Heute keine Tagesmail ans Team</td></tr>
    <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${zeilen}</table></td></tr>
    <tr><td style="padding-top:18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${zahlen}</table></td></tr>
  </table>
</td></tr></table></body></html>`;
  return { betreff, html };
}
