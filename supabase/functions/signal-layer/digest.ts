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

/** Eine Zeile je Signal: Titel als Link, darunter Thema und Quelle. */
function karte(signal: DigestSignal): string {
  const link = signal.url && /^https?:\/\//.test(signal.url) ? signal.url : DIGEST_APP_URL;
  const meta = [signal.signal_label, signal.quelle].filter(Boolean).join(" · ");
  return `<tr><td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
    <a href="${esc(link)}" style="font:700 15px/1.4 Arial,Helvetica,sans-serif;color:#0f172a;text-decoration:none;">${esc(signal.headline_de)}</a>
    ${meta ? `<div style="margin-top:3px;font:400 12px/1.4 Arial,Helvetica,sans-serif;color:#64748b;">${esc(meta)}</div>` : ""}
  </td></tr>`;
}

function abschnitt(titel: string, signale: DigestSignal[]): string {
  if (!signale.length) return "";
  return `<tr><td style="padding:22px 0 4px;font:700 12px/1.4 Arial,Helvetica,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#206efb;">${esc(titel)} · ${signale.length}</td></tr>
  ${signale.map(karte).join("")}`;
}

/** Betreff und HTML der Mail. zeitraum ist die Beschriftung, z. B. "12.10. bis 13.10.2026". */
export function baueDigest(signale: DigestSignal[], zeitraum: string, test = false): { betreff: string; html: string } {
  const sortiert = [...signale].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const marketing = sortiert.filter((s) => s.lane !== "sales");
  const sales = sortiert.filter((s) => s.lane === "sales");
  const betreff = `${test ? "[Test] " : ""}Signal Layer: ${signale.length} neue Signale (${zeitraum})`;
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(betreff)}</title></head>
<body style="margin:0;padding:0;background:#f4f7fb;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;"><tr><td align="center" style="padding:28px 14px;">
  <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">
    <tr><td style="padding:0 0 18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1d3a;border-radius:14px;">
        <tr><td style="padding:24px 26px;">
          <div style="font:700 13px/1.4 Arial,Helvetica,sans-serif;letter-spacing:.12em;color:#93b8fb;">ROOTS · SIGNAL LAYER</div>
          <div style="margin-top:6px;font:700 24px/1.25 Arial,Helvetica,sans-serif;color:#ffffff;">${signale.length} neue Signale</div>
          <div style="margin-top:4px;font:400 14px/1.4 Arial,Helvetica,sans-serif;color:#cbd5e1;">${esc(zeitraum)}</div>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="background:#ffffff;border-radius:14px;padding:4px 24px 14px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${abschnitt("Sales", sales)}
    ${abschnitt("Marketing", marketing)}
    </table></td></tr>
    <tr><td align="center" style="padding:18px 0 6px;">
      <a href="${DIGEST_APP_URL}" style="display:inline-block;padding:12px 22px;background:#206efb;border-radius:999px;font:700 14px/1 Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;">Alle Signale im Signal Layer</a>
    </td></tr>
    <tr><td align="center" style="padding:14px 0 0;font:400 11px/1.5 Arial,Helvetica,sans-serif;color:#94a3b8;">ROOTS Brand Strategy Consultants GmbH</td></tr>
  </table>
</td></tr></table>
</body></html>`;
  return { betreff, html };
}
