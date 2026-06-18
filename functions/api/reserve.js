// Cloudflare Pages Function — POST /api/reserve
// Emails a reservation request to the team via Resend.
// Env vars (Cloudflare Pages → Settings → Environment variables):
//   RESEND_API_KEY (required), RESERVE_TO (optional), RESERVE_FROM (optional)

const esc = (s) =>
  String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { body = {}; }
  body = body || {};
  if (body.company) return json({ ok: true }); // honeypot

  const { name, phone, email, date, time, party, areas, occasion, notes } = body;
  if (!name || !phone || !email || !date || !time) return json({ error: "Missing required fields" }, 400);

  const TO = env.RESERVE_TO || "michelle@fivepointfivebrewing.com";
  const FROM = env.RESERVE_FROM || "Five Point Five <onboarding@resend.dev>";
  const KEY = env.RESEND_API_KEY;
  if (!KEY) return json({ error: "Email not configured" }, 500);

  const row = (k, v) =>
    `<tr><td style="padding:8px 14px;color:#8a7b64;font:600 13px Arial;border-bottom:1px solid #eee">${k}</td>
         <td style="padding:8px 14px;color:#3a2f24;font:14px Arial;border-bottom:1px solid #eee">${esc(v) || "—"}</td></tr>`;
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
    <h2 style="color:#c2744f;margin:0 0 4px">New reservation request</h2>
    <p style="color:#8a7b64;margin:0 0 16px">Five Point Five Brewing Co · website</p>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eee;border-radius:8px;overflow:hidden">
      ${row("Name", name)}${row("Phone", phone)}${row("Email", email)}
      ${row("Date", date)}${row("Time", time)}${row("Guests", party)}
      ${row("Brewery area", areas || "No preference")}${row("Occasion", occasion)}${row("Notes", notes)}
    </table>
    <p style="color:#8a7b64;font-size:12px;margin-top:16px">Reply to this email to reach ${esc(name)} directly.</p>
  </div>`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject: `Reservation request — ${name} · ${date} ${time} · party of ${party || "?"}`,
        html,
      }),
    });
    if (!r.ok) return json({ error: "Email send failed", detail: await r.text() }, 502);
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
