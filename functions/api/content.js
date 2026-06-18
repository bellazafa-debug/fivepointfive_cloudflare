// Cloudflare Pages Function — /api/content
//   GET  → returns the live site content (JSON) from Supabase
//   POST → { password, data }  publishes new content (password checked inside the database)
// No environment variables required to publish (publishable key is public; password lives in the DB).

const SUPABASE_URL_DEFAULT = "https://mugbbbfqzxsnaxcmfsnb.supabase.co";
const ANON_DEFAULT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11Z2JiYmZxenhzbmF4Y21mc25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNzI4OTMsImV4cCI6MjA5NTg0ODg5M30.OqHOvDcoQH9PSn5-c4w7jxO9Z4JfExkEZOCn8m75xUs";

const sb = (env) => {
  const url = env.SUPABASE_URL || SUPABASE_URL_DEFAULT;
  const anon = env.SUPABASE_ANON_KEY || ANON_DEFAULT;
  return { url, headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" } };
};
const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...extra } });

export async function onRequestGet({ env }) {
  const { url, headers } = sb(env);
  try {
    const r = await fetch(`${url}/rest/v1/site_content?id=eq.1&select=data`, { headers });
    const rows = await r.json();
    const data = (Array.isArray(rows) && rows[0] && rows[0].data) || {};
    return json({ data }, 200, { "Cache-Control": "s-maxage=20, stale-while-revalidate=60" });
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
    return ok === true ? json({ ok: true }) : json({ error: "Wrong passcode" }, 401);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
