import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = [
  "https://pgoutzeris-stack.github.io",
  "http://localhost",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1",
];

function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const origin =
    requestOrigin && ALLOWED_ORIGINS.some((o) => requestOrigin.startsWith(o))
      ? requestOrigin
      : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  };
}

function corsResponse(requestOrigin: string | null, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(requestOrigin), "Content-Type": "application/json" },
  });
}

function errorResponse(requestOrigin: string | null, message: string, status = 400): Response {
  return corsResponse(requestOrigin, { error: message }, status);
}

// ---------------------------------------------------------------------------
// Env / Admin client
// ---------------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function getUserClient(authHeader: string) {
  return createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
}

async function requireAuth(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const client = getUserClient(authHeader);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  return { userId: user.id };
}

// ---------------------------------------------------------------------------
// Scheduled-trigger auth — pg_cron calls this function with a shared secret
// header instead of a user JWT (there's no logged-in user for a 6am cron run).
// ---------------------------------------------------------------------------
async function isScheduledTrigger(req: Request): Promise<boolean> {
  const provided = req.headers.get("x-cron-secret");
  if (!provided) return false;
  const { data } = await getAdminClient()
    .schema("shared").rpc("get_api_key", { p_key_name: "signal_layer_cron_secret" });
  return !!data && data === provided;
}

// ---------------------------------------------------------------------------
// Internal-call auth — run_crawl fires a fire-and-forget request to itself
// (action: process_crawl) using the service-role key as bearer, the same
// pattern ROOTS_WissensHub uses for its async embed trigger.
// ---------------------------------------------------------------------------
function isInternalCall(req: Request): boolean {
  const authHeader = req.headers.get("authorization") || "";
  return authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
}

// ---------------------------------------------------------------------------
// API key resolver — reads from the shared, Vault-backed key store.
// Keys never reach the frontend; only this Edge Function calls Apify.
// ---------------------------------------------------------------------------
const _keyCache: { value: string; at: number } = { value: "", at: 0 };
const KEY_CACHE_TTL = 5 * 60 * 1000; // 5 min

async function getApifyKey(): Promise<string> {
  const now = Date.now();
  if (_keyCache.value && now - _keyCache.at < KEY_CACHE_TTL) {
    return _keyCache.value;
  }
  const { data } = await getAdminClient()
    .schema("shared").rpc("get_api_key", { p_key_name: "signal_layer_apify_api_key" });
  _keyCache.value = (data as string | null) || "";
  _keyCache.at = now;
  return _keyCache.value;
}

// ===========================================================================
// Crawl pipeline — RSS/sitemap first (cheap, reliable), Apify as fallback.
// ===========================================================================

interface CrawlCandidate {
  url: string;
  title?: string;
  publishedAt?: string | null;
}

const FETCH_TIMEOUT_MS = 15_000;

// These are navigation/support sections, not editorial marketing or sales
// content. Keep this list intentionally conservative: press and news paths
// remain eligible because they can contain real business triggers.
const NON_EDITORIAL_URL_PARTS = [
  "/jobs", "/jobboerse", "/job-board", "/careers", "/career", "/karriere",
  "/stellenangebote", "/stellenboerse", "/bewerbung", "/bewerben", "/ausbildung",
  "/duales-studium", "/trainee", "/praktikum", "/werkstudent", "/internship",
  "/apprenticeship", "/vacancies", "/apply", "/human-resources", "/hr",
  "/faq", "/frequently-asked-questions", "/fragen-und-antworten", "/hilfe",
  "/help", "/support", "/kontakt", "/contact", "/service", "/impressum",
  "/datenschutz", "/privacy", "/cookies", "/terms", "/agb", "/sitemap",
  "/search", "/suche", "/tag/", "/category/", "/kategorie/", "/author/",
];

const CAREER_CONTENT_TERMS = [
  "bewerbung", "bewerben", "stellenbörse", "stellenboerse", "freie stellen",
  "ausbildung", "praktikum", "traineeprogramm", "bewerbungsfrist", "lebenslauf",
  "anschreiben", "bewerbungsunterlagen", "job suchen", "jobs & karriere",
  "application process", "apply now", "open positions", "vacancies", "internship",
  "apprenticeship", "graduate program", "resume", "cover letter", "job board",
];

function isLikelyNonEditorialUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const value = `${url.pathname}${url.search}`.toLowerCase().replace(/\\+/g, "/");
    return NON_EDITORIAL_URL_PARTS.some((part) => value.includes(part));
  } catch {
    return true;
  }
}

function countTermMatches(text: string, terms: string[]): number {
  return terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
}

function isLikelyNonEditorialPage(article: { title: string; content: string; excerpt: string }): boolean {
  const text = `${article.title} ${article.excerpt} ${article.content}`.toLowerCase();
  const title = article.title.toLowerCase();
  const careerMatches = countTermMatches(text, CAREER_CONTENT_TERMS);
  const questionCount = (text.match(/\?/g) || []).length;
  const faqHeading = /(^|\s)(faq|frequently asked questions|noch fragen|häufige fragen)(\s|$)/i.test(title);

  // A career/FAQ landing page is usually a cluster of application terms or
  // questions. One incidental word is not enough, so ordinary press articles
  // mentioning hiring still remain eligible.
  if (faqHeading) return true;
  if (careerMatches >= 3) return true;
  if (questionCount >= 5 && careerMatches >= 2) return true;
  return false;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, headers: { "User-Agent": "ROOTS-SignalLayer/1.0", ...(init.headers || {}) } });
  } finally {
    clearTimeout(t);
  }
}

function resolveUrl(maybeRelative: string, baseUrl: string): string {
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return maybeRelative;
  }
}

// ---------------------------------------------------------------------------
// Feed discovery — try RSS link tag / common paths, then sitemap, else Apify.
// ---------------------------------------------------------------------------
async function discoverFeed(sourceUrl: string): Promise<{ type: "rss" | "sitemap" | "apify"; url: string | null }> {
  const origin = new URL(sourceUrl).origin;

  try {
    const homeRes = await fetchWithTimeout(sourceUrl);
    if (homeRes.ok) {
      const html = await homeRes.text();
      const linkMatch = html.match(/<link[^>]+type=["']application\/(rss|atom)\+xml["'][^>]*>/i);
      if (linkMatch) {
        const hrefMatch = linkMatch[0].match(/href=["']([^"']+)["']/i);
        if (hrefMatch) return { type: "rss", url: resolveUrl(hrefMatch[1], sourceUrl) };
      }
    }
  } catch { /* homepage fetch failed, keep trying other strategies */ }

  const commonFeedPaths = ["/feed", "/feed/", "/rss", "/rss.xml", "/feed.xml", "/atom.xml"];
  for (const path of commonFeedPaths) {
    try {
      const res = await fetchWithTimeout(`${origin}${path}`);
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") || "";
      const text = await res.text();
      if (ct.includes("xml") || text.trimStart().startsWith("<?xml") || /<rss|<feed/i.test(text.slice(0, 500))) {
        return { type: "rss", url: `${origin}${path}` };
      }
    } catch { /* try next path */ }
  }

  try {
    const res = await fetchWithTimeout(`${origin}/sitemap.xml`);
    if (res.ok) {
      const text = await res.text();
      if (/<urlset|<sitemapindex/i.test(text.slice(0, 500))) {
        return { type: "sitemap", url: `${origin}/sitemap.xml` };
      }
    }
  } catch { /* no sitemap */ }

  return { type: "apify", url: null };
}

// ---------------------------------------------------------------------------
// RSS parsing (lightweight regex-based — RSS/Atom items are simple enough
// that a full XML parser dependency isn't worth the weight here).
// ---------------------------------------------------------------------------
function extractTag(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return null;
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

async function fetchRssArticles(feedUrl: string, sinceDate: Date): Promise<CrawlCandidate[]> {
  const res = await fetchWithTimeout(feedUrl);
  if (!res.ok) return [];
  const xml = await res.text();
  const isAtom = /<feed[\s>]/i.test(xml.slice(0, 300));
  const items: CrawlCandidate[] = [];

  if (isAtom) {
    const entries = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
    for (const entry of entries) {
      const linkMatch = entry.match(/<link[^>]+href=["']([^"']+)["']/i);
      const url = linkMatch?.[1];
      if (!url) continue;
      const title = extractTag(entry, "title") || undefined;
      const published = extractTag(entry, "published") || extractTag(entry, "updated");
      if (published && new Date(published) < sinceDate) continue;
      items.push({ url, title, publishedAt: published });
    }
  } else {
    const entries = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
    for (const entry of entries) {
      const url = extractTag(entry, "link");
      if (!url) continue;
      const title = extractTag(entry, "title") || undefined;
      const pubDate = extractTag(entry, "pubDate") || extractTag(entry, "dc:date");
      if (pubDate && new Date(pubDate) < sinceDate) continue;
      items.push({ url, title, publishedAt: pubDate });
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// Sitemap parsing (handles nested sitemap indexes, capped to avoid runaway).
// ---------------------------------------------------------------------------
async function fetchSitemapArticles(sitemapUrl: string, sinceDate: Date, depth = 0): Promise<CrawlCandidate[]> {
  if (depth > 2) return [];
  const res = await fetchWithTimeout(sitemapUrl);
  if (!res.ok) return [];
  const xml = await res.text();

  if (/<sitemapindex/i.test(xml.slice(0, 300))) {
    const subSitemaps = (xml.match(/<loc>([\s\S]*?)<\/loc>/gi) || [])
      .map((m) => m.replace(/<\/?loc>/gi, "").trim())
      .slice(0, 5); // cap sub-sitemap fan-out
    const results: CrawlCandidate[] = [];
    for (const sub of subSitemaps) {
      results.push(...(await fetchSitemapArticles(sub, sinceDate, depth + 1)));
    }
    return results;
  }

  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/gi) || [];
  const items: CrawlCandidate[] = [];
  for (const block of urlBlocks) {
    const url = extractTag(block, "loc");
    if (!url) continue;
    const lastmod = extractTag(block, "lastmod");
    if (lastmod && new Date(lastmod) < sinceDate) continue;
    // Skip obvious non-article URLs (homepage/root, pure category listings).
    const path = new URL(url).pathname;
    if (path === "/" || path.split("/").filter(Boolean).length < 1) continue;
    items.push({ url, publishedAt: lastmod });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Article content extraction — best-effort, no headless browser available.
// ---------------------------------------------------------------------------
function extractPublishedDate(html: string, url: string): string | null {
  // Try, in order, every place a publish date commonly hides. The deeper/
  // less standard patterns near the end exist specifically for sites whose
  // markup doesn't use the two most common tags — worth the extra regex
  // passes since a wrongly-missing date means a real article gets excluded.
  const patterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /"datePublished"\s*:\s*"([^"]+)"/i,
    /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']publish-date["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']publish_date["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']parsely-pub-date["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']sailthru\.date["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+itemprop=["']datePublished["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
    /<meta[^>]+property=["']article:modified_time["'][^>]+content=["']([^"']+)["']/i,
    /"dateModified"\s*:\s*"([^"]+)"/i,
  ];
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m?.[1]) {
      const d = new Date(m[1]);
      if (!isNaN(d.getTime())) return m[1];
    }
  }
  // Last resort: a /YYYY/MM/DD/ date pattern baked into the URL itself
  // (common WordPress/CMS permalink structure).
  const urlDateMatch = url.match(/\/(20\d{2})\/(\d{2})\/(\d{2})(?:\/|$)/);
  if (urlDateMatch) {
    const iso = `${urlDateMatch[1]}-${urlDateMatch[2]}-${urlDateMatch[3]}`;
    if (!isNaN(new Date(iso).getTime())) return iso;
  }
  return null;
}

async function fetchArticleContent(url: string): Promise<{ title: string; content: string; excerpt: string; publishedAt: string | null } | null> {
  if (isLikelyNonEditorialUrl(url)) return null;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const html = await res.text();

    const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = (titleMatch?.[1] || "").trim();

    const descMatch = html.match(/<meta[^>]+(?:property=["']og:description["']|name=["']description["'])[^>]+content=["']([^"']+)["']/i);
    const excerpt = (descMatch?.[1] || "").trim();

    const publishedAt = extractPublishedDate(html, url);

    const bodyMatch = html.match(/<body[\s\S]*?<\/body>/i);
    let text = bodyMatch ? bodyMatch[0] : html;
    text = text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return { title, content: text.slice(0, 8000), excerpt, publishedAt };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Apify fallback — only used when a source has neither RSS nor sitemap.
// Heuristic pageFunction: JSON-LD/og:type Article detection + light pagination.
// ---------------------------------------------------------------------------
async function runApifySourceCrawl(sourceUrl: string, sinceDate: Date): Promise<CrawlCandidate[]> {
  const apifyKey = await getApifyKey();
  if (!apifyKey) return [];

  const pageFunction = `
    async function pageFunction(context) {
      const { request, $, log } = context;
      const isArticle = !!(
        $('script[type="application/ld+json"]').filter((_, el) => /"@type"\\s*:\\s*"(NewsArticle|Article|BlogPosting)"/i.test($(el).html() || '')).length ||
        $('meta[property="og:type"]').attr('content') === 'article'
      );
      if (request.userData.label === 'ARTICLE' || isArticle) {
        const title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
        const published = $('meta[property="article:published_time"]').attr('content') || null;
        return { url: request.url, title, publishedAt: published, isArticle: true };
      }
      // Listing/homepage: enqueue same-domain links as candidate articles.
      const links = new Set();
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        try {
          const abs = new URL(href, request.url).toString();
          if (new URL(abs).hostname === new URL(request.url).hostname) links.add(abs);
        } catch {}
      });
      await context.enqueueLinks({ urls: [...links].slice(0, 40), userData: { label: 'ARTICLE' } });
      return { url: request.url, isArticle: false };
    }
  `.trim();

  const runRes = await fetchWithTimeout(
    `https://api.apify.com/v2/acts/apify~web-scraper/run-sync-get-dataset-items?token=${apifyKey}&timeout=180`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrls: [{ url: sourceUrl }],
        pageFunction,
        maxCrawlingDepth: 2,
        maxPagesPerCrawl: 40,
        proxyConfiguration: { useApifyProxy: true },
      }),
    }
  );
  if (!runRes.ok) return [];
  const items = await runRes.json().catch(() => []) as Array<{ url: string; title?: string; publishedAt?: string | null; isArticle?: boolean }>;
  return items
    .filter((it) => it.isArticle)
    .filter((it) => !it.publishedAt || new Date(it.publishedAt) >= sinceDate)
    .map((it) => ({ url: it.url, title: it.title, publishedAt: it.publishedAt }));
}

// ---------------------------------------------------------------------------
// Keyword matching — tags a newly stored article with every track/dimension
// whose active keywords appear in its title+content. Matching is deliberately
// deterministic: normalized terms, curated DE/EN synonym families, weighted
// title matches, and trigger gates for personnel-only articles.
// ---------------------------------------------------------------------------
const MATCH_TERM_FAMILIES: Record<string, string[]> = {
  "kaufverhalten": ["kaufverhalten", "consumer buying behavior", "consumer behavior", "purchasing behavior"],
  "konsumverhalten": ["konsumverhalten", "consumer behavior", "consumer trends"],
  "kundenzufriedenheit": ["kundenzufriedenheit", "customer satisfaction", "customer sentiment"],
  "markenstrategie": ["markenstrategie", "brand strategy", "brand positioning"],
  "markenführung": ["markenführung", "brand management", "brand leadership"],
  "markentreue": ["markentreue", "brand loyalty", "customer loyalty"],
  "zielgruppenanalyse": ["zielgruppenanalyse", "target audience analysis", "audience insights", "consumer insights"],
  "customer experience": ["customer experience", "cx", "kundenerlebnis"],
  "einzelhandel": ["einzelhandel", "retail", "retailing"],
  "handelsmarke": ["handelsmarke", "private label", "own label"],
  "sortimentsstrategie": ["sortimentsstrategie", "assortment strategy", "range strategy"],
  "omnichannel": ["omnichannel", "omni-channel"],
  "produkteinführung": ["produkteinführung", "product launch", "product introduction"],
  "markenrelaunch": ["markenrelaunch", "brand relaunch", "brand refresh"],
  "kampagnenstart": ["kampagnenstart", "campaign launch", "campaign rollout"],
  "rebranding": ["rebranding", "brand repositioning", "repositioning"],
  "werbekampagne": ["werbekampagne", "advertising campaign", "marketing campaign"],
  "expansion": ["expansion", "market expansion", "international expansion"],
  "markteintritt": ["markteintritt", "market entry", "entering the market"],
  "übernahme": ["übernahme", "acquisition", "takeover"],
  "fusion": ["fusion", "merger"],
  "investition": ["investition", "investment", "capital investment"],
  "agenturwechsel": ["agenturwechsel", "agency change", "new agency appointment", "appoints agency"],
  "restrukturierung": ["restrukturierung", "restructuring", "transformation program"],
  "strategiewechsel": ["strategiewechsel", "strategy change", "strategic shift"],
  "generative ki": ["generative ki", "generative ai", "genai"],
  "künstliche intelligenz marketing": ["künstliche intelligenz marketing", "ai marketing", "artificial intelligence marketing"],
  "ai-agenten": ["ai-agenten", "ai agents", "autonomous ai agents"],
  "automatisierung marketing": ["automatisierung marketing", "marketing automation", "automated marketing"],
  "ki case study": ["ki case study", "ai case study", "artificial intelligence case study"],
  "ki umsatzsteigerung": ["ki umsatzsteigerung", "ai revenue growth", "ai-driven revenue growth"],
  "ki-gestützte kampagne": ["ki-gestützte kampagne", "ai-powered campaign", "ai-driven campaign"],
  "predictive analytics": ["predictive analytics", "prognoseanalyse", "predictive modelling"],
  "brand manager": ["brand manager", "brand director", "brand lead"],
  "chief marketing officer": ["chief marketing officer", "cmo", "neuer cmo", "new cmo", "marketingdirektor", "marketingleiter"],
  "jahresergebnis": ["jahresergebnis", "annual results", "annual report", "full-year results"],
  "quartalszahlen": ["quartalszahlen", "quarterly results", "quarterly figures", "earnings report"],
  "pressemitteilung": ["pressemitteilung", "press release", "company announcement"],
  "sponsoring": ["sponsoring", "sponsorship"],
  "ausschreibung": ["ausschreibung", "tender", "request for proposal", "rfp"],
  "budgetkürzung": ["budgetkürzung", "budget cut", "budget reduction"],
  "marketingbudget": ["marketingbudget", "marketing budget"],
  "pitch": ["pitch", "agency pitch", "creative pitch"],
  "sparprogramm": ["sparprogramm", "cost-cutting program", "cost reduction program"],
};

const PERSONNEL_ONLY_TERMS = [
  "neuer ceo", "new ceo", "appointed ceo", "appoints a ceo", "chief executive officer",
  "neuer cmo", "new cmo", "new chief marketing officer", "chief marketing officer",
  "personalwechsel", "executive appointment", "leadership appointment", "new hire",
];

const STRATEGIC_TRIGGER_TERMS = [
  "rebranding", "brand strategy", "brand positioning", "brand repositioning", "kampagne",
  "campaign", "launch", "produkteinführung", "product launch", "expansion", "market entry",
  "restructuring", "transformation", "agency", "agentur", "investment", "investition",
  "acquisition", "übernahme", "merger", "fusion", "new market", "neuer markt",
  "target audience", "zielgruppe", "ai", "ki", "automation", "automatisierung",
];

function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsMatchTerm(normalizedText: string, rawTerm: string): boolean {
  const term = normalizeMatchText(rawTerm);
  if (!term) return false;
  return ` ${normalizedText} `.includes(` ${term} `);
}

function variantsForKeyword(keyword: string): string[] {
  const normalized = normalizeMatchText(keyword);
  const family = Object.entries(MATCH_TERM_FAMILIES).find(([, variants]) =>
    variants.some((variant) => normalizeMatchText(variant) === normalized),
  );
  return [...new Set([keyword, ...(family?.[1] || [])])];
}

function hasAnyMatchTerm(normalizedText: string, terms: string[]): boolean {
  return terms.some((term) => containsMatchTerm(normalizedText, term));
}

async function matchAndStoreFindings(
  admin: ReturnType<typeof createClient>,
  articleId: string,
  crawlRunId: string,
  title: string,
  content: string,
  allKeywords: Array<{ track: string; dimension: string | null; keyword: string; active: boolean }>,
): Promise<void> {
  const normalizedTitle = normalizeMatchText(title);
  const normalizedBody = normalizeMatchText(content);
  const normalizedAll = `${normalizedTitle} ${normalizedBody}`.trim();
  const personnelOnly = hasAnyMatchTerm(normalizedAll, PERSONNEL_ONLY_TERMS)
    && !hasAnyMatchTerm(normalizedAll, STRATEGIC_TRIGGER_TERMS);
  if (personnelOnly) return;

  const byTrackDim = new Map<string, { matched: string[]; score: number; hasTrigger: boolean }>();
  for (const kw of allKeywords) {
    if (!kw.active) continue;
    const variants = variantsForKeyword(kw.keyword);
    const inTitle = variants.some((term) => containsMatchTerm(normalizedTitle, term));
    const inBody = variants.some((term) => containsMatchTerm(normalizedBody, term));
    if (!inTitle && !inBody) continue;
    const key = `${kw.track}::${kw.dimension || ""}`;
    const current = byTrackDim.get(key) || { matched: [], score: 0, hasTrigger: false };
    current.matched.push(kw.keyword);
    current.score += inTitle ? 5 : 1;
    if (hasAnyMatchTerm(normalizedAll, STRATEGIC_TRIGGER_TERMS)) current.hasTrigger = true;
    byTrackDim.set(key, current);
  }
  for (const [key, result] of byTrackDim) {
    const [track, dimension] = key.split("::");
    // A single body mention is too weak. A title hit reaches the threshold,
    // while several independent body matches can also qualify.
    if (result.score < 5) continue;
    // Buying-center data is useful only when tied to a concrete business
    // trigger. A standalone CEO/CMO appointment must not become a signal.
    if (dimension === "buying_center" && !result.hasTrigger) continue;
    await admin.schema("signal_layer").from("findings").upsert({
      article_id: articleId,
      crawl_run_id: crawlRunId,
      track,
      dimension: dimension || null,
      matched_keywords: result.matched,
    }, { onConflict: "article_id,track,dimension" });
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return errorResponse(origin, "Method not allowed", 405);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return errorResponse(origin, "Invalid JSON body");
  }
  const action = String(body.action || "");

  // run_crawl can be triggered either by a logged-in user (manual button)
  // or by the daily pg_cron job (shared-secret header, no user session).
  // process_crawl is never called externally — only by run_crawl's own
  // fire-and-forget self-call, authenticated with the service-role key.
  let auth: { userId: string } | null = null;
  let isScheduled = false;
  if (action === "process_crawl") {
    if (!isInternalCall(req)) return errorResponse(origin, "Unauthorized", 401);
  } else if (action === "run_crawl") {
    auth = await requireAuth(req);
    if (!auth) {
      isScheduled = await isScheduledTrigger(req);
      if (!isScheduled) return errorResponse(origin, "Unauthorized", 401);
    }
  } else {
    auth = await requireAuth(req);
    if (!auth) return errorResponse(origin, "Unauthorized", 401);
  }

  try {
    switch (action) {
      // Simple reachability check — confirms the Apify key is set and valid,
      // without exposing it. Replace/extend with real Signal Layer actions
      // once the feature spec is defined.
      case "ping": {
        const apifyKey = await getApifyKey();
        if (!apifyKey) {
          return errorResponse(origin, "Apify API key is not configured", 503);
        }
        const res = await fetch(`https://api.apify.com/v2/users/me?token=${apifyKey}`);
        if (!res.ok) {
          return errorResponse(origin, `Apify error: ${await res.text()}`, 502);
        }
        const json = await res.json();
        return corsResponse(origin, { ok: true, username: json.data?.username ?? null });
      }

      // ---------------------------------------------------------------
      // Source management (Settings → Apify → URL list to crawl)
      // ---------------------------------------------------------------
      case "list_sources": {
        const admin = getAdminClient();
        const { data, error } = await admin.schema("signal_layer").from("sources")
          .select("*").order("category", { ascending: true }).order("company", { ascending: true });
        if (error) return errorResponse(origin, error.message, 500);
        return corsResponse(origin, { sources: data || [] });
      }

      case "add_source": {
        const { company, url, category, description, tags } = body as {
          company: string; url: string; category?: string; description?: string; tags?: string[];
        };
        if (!company || !url) return errorResponse(origin, "company and url are required");
        const admin = getAdminClient();
        const { data, error } = await admin.schema("signal_layer").from("sources").insert({
          company: company.trim(),
          url: url.trim(),
          category: category?.trim() || null,
          description: description?.trim() || null,
          tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
          active: true,
          created_by: auth.userId,
          updated_by: auth.userId,
        }).select().single();
        if (error) return errorResponse(origin, error.message, 500);
        return corsResponse(origin, { source: data });
      }

      case "update_source": {
        const { id, company, url, category, description, tags, active } = body as {
          id: string; company?: string; url?: string; category?: string;
          description?: string; tags?: string[]; active?: boolean;
        };
        if (!id) return errorResponse(origin, "id is required");
        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(), updated_by: auth.userId,
        };
        if (company !== undefined) updates.company = company.trim();
        if (url !== undefined) updates.url = url.trim();
        if (category !== undefined) updates.category = category?.trim() || null;
        if (description !== undefined) updates.description = description?.trim() || null;
        if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags.filter(Boolean) : [];
        if (active !== undefined) updates.active = active;
        const admin = getAdminClient();
        const { data, error } = await admin.schema("signal_layer").from("sources")
          .update(updates).eq("id", id).select().single();
        if (error) return errorResponse(origin, error.message, 500);
        return corsResponse(origin, { source: data });
      }

      case "delete_source": {
        const { id } = body as { id: string };
        if (!id) return errorResponse(origin, "id is required");
        const admin = getAdminClient();
        const { error } = await admin.schema("signal_layer").from("sources").delete().eq("id", id);
        if (error) return errorResponse(origin, error.message, 500);
        return corsResponse(origin, { deleted: id });
      }

      // ---------------------------------------------------------------
      // Keyword management (Settings → Marketing/Sales Keywords)
      // ---------------------------------------------------------------
      case "list_keywords": {
        const { track } = body as { track?: string };
        const admin = getAdminClient();
        let query = admin.schema("signal_layer").from("keywords").select("*").order("keyword", { ascending: true });
        if (track) query = query.eq("track", track);
        const { data, error } = await query;
        if (error) return errorResponse(origin, error.message, 500);
        return corsResponse(origin, { keywords: data || [] });
      }

      case "add_keyword": {
        const { track, keyword, dimension } = body as { track: string; keyword: string; dimension?: string };
        if (!track || !keyword) return errorResponse(origin, "track and keyword are required");
        if (!["marketing", "sales"].includes(track)) return errorResponse(origin, "invalid track");
        const admin = getAdminClient();
        const { data, error } = await admin.schema("signal_layer").from("keywords").insert({
          track, keyword: keyword.trim(), dimension: dimension?.trim() || null, active: true,
          created_by: auth!.userId, updated_by: auth!.userId,
        }).select().single();
        if (error) return errorResponse(origin, error.message, 500);
        return corsResponse(origin, { keyword: data });
      }

      case "update_keyword": {
        const { id, keyword, active, dimension } = body as { id: string; keyword?: string; active?: boolean; dimension?: string };
        if (!id) return errorResponse(origin, "id is required");
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: auth!.userId };
        if (keyword !== undefined) updates.keyword = keyword.trim();
        if (active !== undefined) updates.active = active;
        if (dimension !== undefined) updates.dimension = dimension?.trim() || null;
        const admin = getAdminClient();
        const { data, error } = await admin.schema("signal_layer").from("keywords")
          .update(updates).eq("id", id).select().single();
        if (error) return errorResponse(origin, error.message, 500);
        return corsResponse(origin, { keyword: data });
      }

      case "delete_keyword": {
        const { id } = body as { id: string };
        if (!id) return errorResponse(origin, "id is required");
        const admin = getAdminClient();
        const { error } = await admin.schema("signal_layer").from("keywords").delete().eq("id", id);
        if (error) return errorResponse(origin, error.message, 500);
        return corsResponse(origin, { deleted: id });
      }

      // ---------------------------------------------------------------
      // Crawl trigger — records the run, then fires the actual work off
      // asynchronously (fire-and-forget self-call) so the button/cron
      // caller gets an immediate response instead of waiting minutes.
      // ---------------------------------------------------------------
      case "run_crawl": {
        const { scope } = body as { scope?: { categories?: string[] } };
        const admin = getAdminClient();

        let sourceQuery = admin.schema("signal_layer").from("sources").select("id").eq("active", true);
        if (scope?.categories && scope.categories.length > 0) {
          sourceQuery = sourceQuery.in("category", scope.categories);
        }
        const { data: matchingSources, error: sourcesErr } = await sourceQuery;
        if (sourcesErr) return errorResponse(origin, sourcesErr.message, 500);
        const sourceIds = (matchingSources || []).map((s: { id: string }) => s.id);

        const { data, error } = await admin.schema("signal_layer").from("crawl_runs").insert({
          trigger_type: isScheduled ? "scheduled" : "manual",
          scope: scope || {},
          status: sourceIds.length > 0 ? "queued" : "done",
          triggered_by: auth?.userId ?? null,
          finished_at: sourceIds.length > 0 ? null : new Date().toISOString(),
        }).select().single();
        if (error) return errorResponse(origin, error.message, 500);

        if (sourceIds.length > 0) {
          const selfUrl = `${SUPABASE_URL}/functions/v1/signal-layer`;
          fetch(selfUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
            body: JSON.stringify({ action: "process_crawl", crawl_run_id: data.id, source_ids: sourceIds, index: 0, candidate_offset: 0 }),
          }).catch((e) => console.error("Failed to trigger process_crawl:", e));
        }

        return corsResponse(origin, { crawl_run: data });
      }

      // ---------------------------------------------------------------
      // Actual crawl work — processes at most ARTICLE_BATCH_SIZE articles
      // of ONE source per invocation, then fire-and-forgets itself for
      // the next batch (same source) or the next source. This keeps each
      // Edge Function call short no matter how many sources are in scope
      // OR how many articles a single source has (a source with 300+
      // articles in its 6-month backfill window was what actually caused
      // the platform's execution time limit to kill an earlier version of
      // this function mid-run, leaving crawl_runs stuck at 'running'
      // forever — batching within a source, not just across sources, was
      // needed to fix it).
      // Internal-only, triggered by run_crawl above.
      // ---------------------------------------------------------------
      case "process_crawl": {
        const ARTICLE_BATCH_SIZE = 10;
        const { crawl_run_id, source_ids, index, candidate_offset } = body as {
          crawl_run_id: string; source_ids: string[]; index: number; candidate_offset: number;
        };

        const admin = getAdminClient();
        if (index === 0 && candidate_offset === 0) {
          await admin.schema("signal_layer").from("crawl_runs")
            .update({ status: "running" }).eq("id", crawl_run_id);
        }

        if (index >= source_ids.length) {
          await admin.schema("signal_layer").from("crawl_runs")
            .update({ status: "done", finished_at: new Date().toISOString() }).eq("id", crawl_run_id);
          return corsResponse(origin, { ok: true, done: true });
        }

        const sourceId = source_ids[index];
        let nextIndex = index;
        let nextOffset = candidate_offset;

        try {
          const { data: source, error: sourceErr } = await admin.schema("signal_layer").from("sources")
            .select("*").eq("id", sourceId).single();
          if (sourceErr || !source) throw new Error(sourceErr?.message || "source not found");

          const { data: allKeywords } = await admin.schema("signal_layer").from("keywords")
            .select("track, dimension, keyword, active").eq("active", true);

          // Discover + cache the feed type once per source.
          let feedType = source.feed_type as string | null;
          let feedUrl = source.feed_url as string | null;
          if (!feedType) {
            const discovered = await discoverFeed(source.url);
            feedType = discovered.type;
            feedUrl = discovered.url;
            await admin.schema("signal_layer").from("sources")
              .update({ feed_type: feedType, feed_url: feedUrl }).eq("id", source.id);
          }

          // First-ever crawl for this source → 6-month backfill.
          // Every later crawl → only since the last successful crawl.
          const { count: existingCount } = await admin.schema("signal_layer").from("articles")
            .select("id", { count: "exact", head: true }).eq("source_id", source.id);
          const sinceDate = existingCount && existingCount > 0
            ? new Date(source.last_crawled_at || Date.now() - 24 * 60 * 60 * 1000)
            : new Date(Date.now() - 183 * 24 * 60 * 60 * 1000); // ~6 months

          // Re-deriving the candidate list every batch is cheap (one RSS/
          // sitemap fetch, or a cached Apify-run result) — it's the same
          // deterministic list, we just slice a different window of it.
          let candidates: CrawlCandidate[] = [];
          if (feedType === "rss" && feedUrl) candidates = await fetchRssArticles(feedUrl, sinceDate);
          else if (feedType === "sitemap" && feedUrl) candidates = await fetchSitemapArticles(feedUrl, sinceDate);
          else candidates = await runApifySourceCrawl(source.url, sinceDate);

          const { data: existingArticles } = await admin.schema("signal_layer").from("articles")
            .select("url").eq("source_id", source.id);
          const knownUrls = new Set((existingArticles || []).map((a: { url: string }) => a.url));
          const freshCandidates = candidates
            .filter((c) => !isLikelyNonEditorialUrl(c.url))
            .filter((c) => !knownUrls.has(c.url));

          const batch = freshCandidates.slice(candidate_offset, candidate_offset + ARTICLE_BATCH_SIZE);

          for (const candidate of batch) {
            const fetched = await fetchArticleContent(candidate.url);
            if (!fetched) continue;
            if (isLikelyNonEditorialPage(fetched)) continue;

            // A CONFIRMED date outside the freshness window is discarded —
            // sitemap `lastmod` is a last-MODIFIED date, not a publish date,
            // so evergreen pages can otherwise sneak in as "new". But when no
            // date can be found at all (despite the deep extraction above),
            // we keep the article rather than silently drop it — it's tagged
            // as dateless (published_at stays null) so it's visibly flagged
            // as unverified in the DB/UI instead of pretending it's fresh.
            const resolvedPublishedAt = fetched.publishedAt || candidate.publishedAt || null;
            if (resolvedPublishedAt && new Date(resolvedPublishedAt) < sinceDate) continue;

            const { data: inserted, error: insertErr } = await admin.schema("signal_layer").from("articles")
              .insert({
                source_id: source.id,
                url: candidate.url,
                title: fetched.title || candidate.title || candidate.url,
                content: fetched.content,
                excerpt: fetched.excerpt,
                published_at: resolvedPublishedAt,
              })
              .select().single();
            // onConflict(url) race with a parallel run → just skip, not fatal.
            if (insertErr || !inserted) continue;

            await matchAndStoreFindings(
              admin, inserted.id, crawl_run_id, inserted.title || "", inserted.content || "", allKeywords || [],
            );
          }

          if (candidate_offset + ARTICLE_BATCH_SIZE < freshCandidates.length) {
            // More articles left for this same source — continue the batch.
            nextIndex = index;
            nextOffset = candidate_offset + ARTICLE_BATCH_SIZE;
          } else {
            // This source is fully done — move to the next one.
            await admin.schema("signal_layer").from("sources")
              .update({ last_crawled_at: new Date().toISOString() }).eq("id", source.id);
            nextIndex = index + 1;
            nextOffset = 0;
          }
        } catch (sourceErr) {
          console.error(`Crawl failed for source ${sourceId}:`, sourceErr);
          // One bad source shouldn't abort the whole chain — skip to the next one.
          nextIndex = index + 1;
          nextOffset = 0;
        }

        const selfUrl = `${SUPABASE_URL}/functions/v1/signal-layer`;
        fetch(selfUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ action: "process_crawl", crawl_run_id, source_ids, index: nextIndex, candidate_offset: nextOffset }),
        }).catch((e) => console.error("Failed to trigger next process_crawl step:", e));

        return corsResponse(origin, { ok: true });
      }

      case "list_findings": {
        const { track, limit } = body as { track?: string; limit?: number };
        const admin = getAdminClient();
        let query = admin.schema("signal_layer").from("findings")
          .select("*, article:articles(title, url, excerpt, published_at, source_id)")
          .order("created_at", { ascending: false }).limit(limit || 50);
        if (track) query = query.eq("track", track);
        const { data, error } = await query;
        if (error) return errorResponse(origin, error.message, 500);
        return corsResponse(origin, { findings: data || [] });
      }

      case "list_crawl_runs": {
        const admin = getAdminClient();
        const { data, error } = await admin.schema("signal_layer").from("crawl_runs")
          .select("*").order("started_at", { ascending: false }).limit(20);
        if (error) return errorResponse(origin, error.message, 500);
        return corsResponse(origin, { crawl_runs: data || [] });
      }

      default:
        return errorResponse(origin, `Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return errorResponse(origin, `Internal error: ${err instanceof Error ? err.message : String(err)}`, 500);
  }
});
