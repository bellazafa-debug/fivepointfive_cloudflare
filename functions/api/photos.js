// Cloudflare Pages Function — GET /api/photos
// Reads a public iCloud Shared Album ("Public Website" link) and returns its photos.
// Album link comes from ?album=... (set in the admin) or the ICLOUD_ALBUM env var.

const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const base62ToInt = (s) => { let n = 0; for (const c of s) n = 62 * n + B62.indexOf(c); return n; };

function extractToken(raw) {
  let s = (raw || "").trim();
  if (s.includes("/photos/")) s = s.split("/photos/").pop();
  else if (s.includes("#")) s = s.split("#").pop();
  s = s.replace(/[/?#].*$/, "");
  return s;
}
function hostForToken(token) {
  let p = base62ToInt(token.substring(0, 1));
  if (token[0] === "A") p = 1;
  const pp = p < 10 ? "0" + p : "" + p;
  return `p${pp}-sharedstreams.icloud.com`;
}
const postJSON = (host, token, endpoint, body) =>
  fetch(`https://${host}/${token}/sharedstreams/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8", Origin: "https://www.icloud.com" },
    body: JSON.stringify(body),
  });
const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...extra } });

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const token = extractToken(u.searchParams.get("album") || env.ICLOUD_ALBUM);
  if (!token) return json({ configured: false, photos: [] });
  try {
    let host = hostForToken(token);
    let r = await postJSON(host, token, "webstream", { streamCtag: null });
    if (r.status === 330) {
      const j = await r.json();
      host = j["X-Apple-MMe-Host"] || host;
      r = await postJSON(host, token, "webstream", { streamCtag: null });
    }
    const data = await r.json();
    const photos = data.photos || [];
    const picks = photos.map((p) => {
      const derivs = Object.values(p.derivatives || {}).filter((d) => d && d.checksum);
      derivs.sort((a, b) => (+a.width || 0) - (+b.width || 0));
      const best = derivs.filter((d) => (+d.width || 0) <= 2000).pop() || derivs[derivs.length - 1];
      return best ? { guid: p.photoGuid, checksum: best.checksum, cap: p.caption || "", date: p.dateCreated || "" } : null;
    }).filter(Boolean);
    const r2 = await postJSON(host, token, "webasseturls", { photoGuids: picks.map((p) => p.guid) });
    const items = (await r2.json()).items || {};
    const urlFor = (cs) => { const it = items[cs]; return it ? `https://${it.url_location}${it.url_path}` : null; };
    const out = picks
      .map((p) => ({ img: urlFor(p.checksum), cap: p.cap, date: p.date }))
      .filter((p) => p.img)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return json({ configured: true, count: out.length, photos: out }, 200, {
      "Cache-Control": "s-maxage=1800, stale-while-revalidate=600",
    });
  } catch (e) {
    return json({ configured: true, error: String(e), photos: [] });
  }
}
