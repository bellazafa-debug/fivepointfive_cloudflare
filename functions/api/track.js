// Cloudflare Pages Function — POST /api/track  (records one page view)
const SUPABASE_URL_DEFAULT = "https://mugbbbfqzxsnaxcmfsnb.supabase.co";
const ANON_DEFAULT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11Z2JiYmZxenhzbmF4Y21mc25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNzI4OTMsImV4cCI6MjA5NTg0ODg5M30.OqHOvDcoQH9PSn5-c4w7jxO9Z4JfExkEZOCn8m75xUs";

export async function onRequestPost({ request, env }) {
  const url = env.SUPABASE_URL || SUPABASE_URL_DEFAULT;
  const anon = env.SUPABASE_ANON_KEY || ANON_DEFAULT;
  let b; try { b = await request.json(); } catch { b = {}; }
  try {
    await fetch(`${url}/rest/v1/rpc/track_view`, {
      method: "POST",
      headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_path: b.path || "/", p_visitor: b.visitor || "", p_device: b.device || "Unknown", p_referrer: b.referrer || "" }),
    });
  } catch (e) { /* never block the page on analytics */ }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
}
