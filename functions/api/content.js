// Cloudflare Pages Function — /api/content
//   GET  → returns the live site content (JSON) from Supabase
//   POST → { password, data }  publishes new content (password checked inside the database)
// No environment variables required to publish (publishable key is public; password lives in the DB).
//
// ── WHY THE CACHE HEADER MATTERS ─────────────────────────────────────────────
// This endpoint returns the ENTIRE site content blob on every page load. The
// previous header was `s-maxage=20`, which let Cloudflare's edge cache hold the
// response for only 20 seconds. Real visitors arrive minutes apart, so almost
// every request missed the cache and pulled the full payload from Supabase —
// which is what blew through the Supabase egress quota.
//
// Content only changes when someone publishes from /admin, so it is safe to
// cache at the edge for a long time. `stale-while-revalidate` means visitors
// keep getting an instant response while Cloudflare refreshes in the background.
//
// Tuning: set CONTENT_CACHE_SECONDS in the Cloudflare Pages environment
// variables to change this without editing code.
//   3600  (1 hour)  → good while you're actively editing the site
//   86400 (1 day)   → maximum savings once content is settled
// After publishing, changes appear once the edge copy expires (or immediately
// if you purge the Cloudflare cache).
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL_DEFAULT = "https://mugbbbfqzxsnaxcmfsnb.supabase.co";
const ANON_DEFAULT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11Z2JiYmZxenhzbmF4Y21mc25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNzI4OTMsImV4cCI6MjA5NTg0ODg5M30.OqHOvDcoQH9PSn5-c4w7jxO9Z4JfExkEZOCn8m75xUs";

// How long Cloudflare's edge may serve the cached content (seconds).
const CACHE_SECONDS_DEFAULT = 3600;        // 1 hour
const STALE_SECONDS = 604800;              // serve stale up to 7 days while revalidating

const sb = (env) => {
  const url = env.SUPABASE_URL || SUPABASE_URL_DEFAULT;
  const anon = env.SUPABASE_ANON_KEY || ANON_DEFAULT;
  return { url, headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" } };
};
const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...extra } });

export async function onRequestGet({ env }) {
  const { url, headers } = sb(env);
  const cacheSeconds = Number(env.CONTENT_CACHE_SECONDS) || CACHE_SECONDS_DEFAULT;
  try {
    const r = await fetch(`${url}/rest/v1/site_content?id=eq.1&select=data`, { headers });
    const rows = await r.json();
    const data = (Array.isArray(rows) && rows[0] && rows[0].data) || {};
    return json({ data }, 200, {
      // max-age=0     → the browser always revalidates, so edits are never stuck in a visitor's browser
      // s-maxage=N    → Cloudflare's edge serves this copy for N seconds (this is the big saving)
      // stale-while-revalidate → keep serving instantly while refreshing in the background
      "Cache-Control": `public, max-age=0, s-maxage=${cacheSeconds}, stale-while-revalidate=${STALE_SECONDS}`,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const { url, headers } = sb(env);
  let body;
  try { body = await request.json(); } catch { body = {}; }
  if (!body || !body.password) return json({ error: "Wrong passcode" }, 401);
  if (!body.data || typeof body.data !== "object") return json({ error: "No data" }, 400);
  try {
    const r = await fetch(`${url}/rest/v1/rpc/publish_content`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_password: body.password, p_data: body.data }),
    });
    if (!r.ok) return json({ error: "Publish failed", detail: await r.text() }, 502);
    const ok = await r.json();
    if (ok !== true) return json({ error: "Wrong passcode" }, 401);

    // Best-effort: purge the cached copy so a publish shows up immediately.
    // Requires CF_ZONE_ID + CF_API_TOKEN (token needs "Cache Purge" permission).
    // Entirely optional — without it, edits appear when the edge cache expires.
    if (env.CF_ZONE_ID && env.CF_API_TOKEN) {
      const origin = new URL(request.url).origin;
      try {
        await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/purge_cache`, {
          method: "POST",
          headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ files: [`${origin}/api/content`] }),
        });
      } catch { /* purge is best-effort; publishing already succeeded */ }
    }

    return json({ ok: true }, 200, { "Cache-Control": "no-store" });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
