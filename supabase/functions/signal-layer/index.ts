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

  const auth = await requireAuth(req);
  if (!auth) return errorResponse(origin, "Unauthorized", 401);

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

      default:
        return errorResponse(origin, `Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return errorResponse(origin, `Internal error: ${err instanceof Error ? err.message : String(err)}`, 500);
  }
});
