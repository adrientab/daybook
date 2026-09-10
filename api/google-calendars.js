/* ============================================================
   api/google-calendars.js — list the user's Google calendars.

   GET -> { calendars: [{ id, name, primary }] }

   Used by the front-end to show a checklist so the user picks which calendars
   to sync. Reuses the same token-refresh logic as google-events.
   ============================================================ */

const { env, supabaseAdmin, getUser } = require("./_lib");

async function validAccessToken(admin, userId) {
  const { data, error } = await admin
    .from("google_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const notExpired = data.expires_at && (new Date(data.expires_at).getTime() - Date.now() > 60 * 1000);
  if (notExpired) return data.access_token;
  if (!data.refresh_token) return null;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      refresh_token: data.refresh_token,
      grant_type: "refresh_token"
    }).toString()
  });
  const tok = await r.json();
  if (!r.ok || !tok.access_token) return null;
  const expiresAt = new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString();
  await admin.from("google_tokens").update({
    access_token: tok.access_token, expires_at: expiresAt, updated_at: new Date().toISOString()
  }).eq("user_id", userId);
  return tok.access_token;
}

module.exports = async function handler(req, res) {
  try {
    const user = await getUser(req);
    if (!user) { res.status(401).json({ error: "Not signed in." }); return; }
    const admin = supabaseAdmin();
    const accessToken = await validAccessToken(admin, user.id);
    if (!accessToken) { res.status(400).json({ error: "not-connected" }); return; }

    const r = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250",
      { headers: { Authorization: "Bearer " + accessToken } }
    );
    const j = await r.json();
    if (!r.ok) { res.status(500).json({ error: (j.error && j.error.message) || "list failed" }); return; }

    const calendars = (j.items || []).map(function (c) {
      return { id: c.id, name: c.summary || c.summaryOverride || "Calendar", primary: !!c.primary };
    });
    res.status(200).json({ calendars: calendars });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
