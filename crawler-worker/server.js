import http from "node:http";
import dns from "node:dns/promises";
import net from "node:net";
import { chromium } from "playwright";

const port = Number(process.env.PORT || 8080);
const workerSecret = process.env.CRAWLER_WORKER_SECRET || "";
const maxConcurrent = Math.max(1, Math.min(3, Number(process.env.MAX_CONCURRENT_PAGES || 2)));
const maxBodyBytes = 64 * 1024;
let browserPromise;
let activePages = 0;
const waiters = [];

function send(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(payload));
}

function isPrivateAddress(address) {
  if (net.isIP(address) === 4) {
    const parts = address.split(".").map(Number);
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0
      || (parts[0] === 169 && parts[1] === 254)
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168);
  }
  return address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:");
}

async function assertPublicUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("unsupported_url");
  const resolved = await dns.lookup(parsed.hostname, { all: true });
  if (!resolved.length || resolved.some((entry) => isPrivateAddress(entry.address))) throw new Error("private_address_blocked");
  return parsed;
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error("payload_too_large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function acquireSlot() {
  if (activePages < maxConcurrent) { activePages += 1; return; }
  await new Promise((resolve) => waiters.push(resolve));
  activePages += 1;
}

function releaseSlot() {
  activePages = Math.max(0, activePages - 1);
  waiters.shift()?.();
}

async function getBrowser() {
  browserPromise ||= chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
  return browserPromise;
}

export async function closeBrowser() {
  if (!browserPromise) return;
  await (await browserPromise).close().catch(() => {});
  browserPromise = undefined;
}

function parseCookieHeader(cookieHeader, domain) {
  return String(cookieHeader || "").split(";").map((part) => part.trim()).filter(Boolean).flatMap((part) => {
    const separator = part.indexOf("=");
    if (separator < 1) return [];
    return [{ name: part.slice(0, separator), value: part.slice(separator + 1), domain, path: "/", secure: true }];
  });
}

export async function extractArticle({ url, cookie }) {
  const parsed = await assertPublicUrl(url);
  await acquireSlot();
  let context;
  try {
    const browser = await getBrowser();
    context = await browser.newContext({
      locale: "de-DE",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      viewport: { width: 1365, height: 900 },
    });
    const cookies = parseCookieHeader(cookie, parsed.hostname);
    if (cookies.length) await context.addCookies(cookies);
    const page = await context.newPage();
    const response = await page.goto(parsed.toString(), { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(1200);
    const result = await page.evaluate(() => {
      const remove = "script,style,nav,header,footer,form,aside,noscript,svg,[aria-hidden='true'],.advertisement,.ad,.cookie,.consent";
      const title = document.querySelector("meta[property='og:title']")?.content
        || document.querySelector("h1")?.textContent || document.title || "";
      const excerpt = document.querySelector("meta[property='og:description']")?.content
        || document.querySelector("meta[name='description']")?.content || "";
      const publishedAt = document.querySelector("meta[property='article:published_time']")?.content
        || document.querySelector("time[datetime]")?.getAttribute("datetime") || null;
      const selectors = [
        "article [itemprop='articleBody']", "[itemprop='articleBody']", "article",
        "main .article-content", "main .article__content", "main .entry-content",
        "main .post-content", "main .content-body", "main",
      ];
      const candidates = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector))).map((node) => {
        const clone = node.cloneNode(true);
        clone.querySelectorAll(remove).forEach((element) => element.remove());
        return (clone.innerText || clone.textContent || "").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+/g, " ").trim();
      }).filter(Boolean).sort((a, b) => b.length - a.length);
      return { title: title.trim(), excerpt: excerpt.trim(), publishedAt, content: (candidates[0] || "").slice(0, 20_000) };
    });
    const normalized = `${result.title} ${result.content}`.toLowerCase();
    const explicitPaywall = /jetzt angebot w[aä]hlen und weiterlesen|subscribe to (?:continue|read)|sign in to continue|noch kein .*abonnement|only available to subscribers|subscriber-only/.test(normalized);
    const pairedPaywall = result.content.length < 1400
      && /\b(abonnent|abonnement|subscription|subscribe|subscriber|premium|membership)\b/.test(normalized)
      && /\b(weiterlesen|vollst[aä]ndigen artikel|continue reading|read more|sign in|log in|login|anmelden|register)\b/.test(normalized);
    const paywall = explicitPaywall || pairedPaywall;
    return { ...result, httpStatus: response?.status() || null, paywall, finalUrl: page.url() };
  } finally {
    await context?.close().catch(() => {});
    releaseSlot();
  }
}

export async function discoverArticles({ url }) {
  const parsed = await assertPublicUrl(url);
  await acquireSlot();
  let context;
  try {
    const browser = await getBrowser();
    context = await browser.newContext({
      locale: "de-DE",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      viewport: { width: 1365, height: 900 },
    });
    const page = await context.newPage();
    const response = await page.goto(parsed.toString(), { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(2500);
    const links = await page.evaluate(() => Array.from(document.querySelectorAll("a[href]")).map((anchor) => ({
      url: anchor.href, title: (anchor.textContent || "").replace(/\s+/g, " ").trim(),
    })));
    const seen = new Set();
    const candidates = links.filter((item) => {
      try {
        const candidate = new URL(item.url);
        if (candidate.hostname !== location.hostname || seen.has(candidate.href)) return false;
        seen.add(candidate.href);
        const path = candidate.pathname.toLowerCase();
        if (/\.(pdf|jpg|jpeg|png|svg|zip)$/i.test(path) || /\/(jobs?|career|karriere|kontakt|contact|privacy|datenschutz|impressum)(\/|$)/i.test(path)) return false;
        const parts = path.split("/").filter(Boolean);
        const last = parts.at(-1) || "";
        return /\/20\d{2}\//.test(path) || /\/(news|press|presse|story|stories|article|articles|meldung|meldungen)\//i.test(path)
          || (parts.length >= 2 && last.length >= 22 && last.includes("-"));
      } catch { return false; }
    }).slice(0, 60);
    return { httpStatus: response?.status() || null, finalUrl: page.url(), candidates };
  } finally {
    await context?.close().catch(() => {});
    releaseSlot();
  }
}

if (process.env.BATCH_MODE !== "1") {
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true, activePages });
    if (req.method !== "POST" || req.url !== "/extract") return send(res, 404, { error: "not_found" });
    if (!workerSecret || req.headers.authorization !== `Bearer ${workerSecret}`) return send(res, 401, { error: "unauthorized" });
    try {
      const body = await readJson(req);
      if (!body.url) return send(res, 400, { error: "url_required" });
      const article = await extractArticle({ url: body.url, cookie: body.cookie });
      return send(res, 200, { article });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return send(res, /unsupported|private|payload/.test(message) ? 400 : 502, { error: message.slice(0, 300) });
    }
  });

  server.listen(port, "0.0.0.0", () => console.log(`ROOTS browser worker listening on ${port}`));

  for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, async () => {
    server.close();
    await closeBrowser();
    process.exit(0);
  });
}
