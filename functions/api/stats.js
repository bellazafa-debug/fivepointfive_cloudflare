// Cloudflare Pages Function — POST /api/stats  { password, days }  (admin analytics)
const SUPABASE_URL_DEFAULT = "https://mugbbbfqzxsnaxcmfsnb.supabase.co";
const ANON_DEFAULT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11Z2JiYmZxenhzbmF4Y21mc25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNzI4OTMsImV4cCI6MjA5NTg0ODg5M30.OqHOvDcoQH9PSn5-c4w7jxO9Z4JfExkEZOCn8m75xUs";
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });

export async function onRequestPost({ request, env }) {
  const url = env.SUPABASE_URL || SUPABASE_URL_DEFAULT;
  const anon = env.SUPABASE_ANON_KEY || ANON_DEFAULT;
  let b; try { b = await request.json(); } catch { b = {}; }
  if (!b.password) return json({ error: "unauthorized" }, 401);
  try {
    const r = await fetch(`${url}/rest/v1/rpc/site_stats`, {
      method: "POST",
      headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_password: b.password, p_days: b.days || 30 }),
    });
    const data = await r.json();
    if (data && data.error) return json({ error: data.error }, 401);
    return json(data || {});
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
