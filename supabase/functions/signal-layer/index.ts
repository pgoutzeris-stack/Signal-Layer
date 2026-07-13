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
  let auth: { userId: string } | null = null;
  let isScheduled = false;
  if (action === "run_crawl") {
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
        const { track, keyword } = body as { track: string; keyword: string };
        if (!track || !keyword) return errorResponse(origin, "track and keyword are required");
        if (!["marketing", "sales"].includes(track)) return errorResponse(origin, "invalid track");
        const admin = getAdminClient();
        const { data, error } = await admin.schema("signal_layer").from("keywords").insert({
          track, keyword: keyword.trim(), active: true,
          created_by: auth!.userId, updated_by: auth!.userId,
        }).select().single();
        if (error) return errorResponse(origin, error.message, 500);
        return corsResponse(origin, { keyword: data });
      }

      case "update_keyword": {
        const { id, keyword, active } = body as { id: string; keyword?: string; active?: boolean };
        if (!id) return errorResponse(origin, "id is required");
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: auth!.userId };
        if (keyword !== undefined) updates.keyword = keyword.trim();
        if (active !== undefined) updates.active = active;
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
      // Crawl trigger — records the run; actual Apify actor invocation +
      // keyword matching is a separate follow-up build once the actor is chosen.
      // ---------------------------------------------------------------
      case "run_crawl": {
        const { scope } = body as { scope?: Record<string, unknown> };
        const admin = getAdminClient();
        const { data, error } = await admin.schema("signal_layer").from("crawl_runs").insert({
          trigger_type: isScheduled ? "scheduled" : "manual",
          scope: scope || {},
          status: "queued",
          triggered_by: auth?.userId ?? null,
        }).select().single();
        if (error) return errorResponse(origin, error.message, 500);
        return corsResponse(origin, { crawl_run: data });
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
