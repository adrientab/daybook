/* ============================================================
   api/google-callback.js — handles Google's OAuth redirect back to us.

   Google sends the user here with a one-time `code`. We exchange that code for
   access + refresh tokens, verify which Dayrant user is connecting (from the
   `state` we set in google-connect), store the tokens server-side in Supabase,
   then send the user back to the app.

   The tokens live ONLY in Supabase (server-side); the browser never sees them.
   ============================================================ */

const { env, supabaseAdmin, appOrigin, redirectUri } = require("./_lib");
const { createClient } = require("@supabase/supabase-js");

async function verifyUser(userId, token) {
  // Confirm the token in `state` really belongs to the claimed user.
  const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data || !data.user || data.user.id !== userId) return null;
  return data.user;
}

module.exports = async function handler(req, res) {
  const origin = appOrigin(req);
  const back = function (status) {
    // Send the user back to the app with a status the UI can read from the URL.
    res.writeHead(302, { Location: origin + "/app.html?gcal=" + status });
    res.end();
  };

  try {
    const url = new URL(req.url, origin);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state") || "";
    const err = url.searchParams.get("error");
    if (err) { back("denied"); return; }              // user clicked "cancel"
    if (!code || !state) { back("error"); return; }

    const sep = state.indexOf("|");
    const userId = sep > -1 ? state.slice(0, sep) : "";
    const userToken = sep > -1 ? state.slice(sep + 1) : "";
    const user = await verifyUser(userId, userToken);
    if (!user) { back("error"); return; }

    // Exchange the code for tokens.
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code,
        client_id: env("GOOGLE_CLIENT_ID"),
        client_secret: env("GOOGLE_CLIENT_SECRET"),
        redirect_uri: redirectUri(req),
        grant_type: "authorization_code"
      }).toString()
    });
    const tok = await tokenRes.json();
    if (!tokenRes.ok || !tok.access_token) { back("error"); return; }

    // Figure out which Google account this is (nice to show in the UI).
    let email = null;
    try {
      const who = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: "Bearer " + tok.access_token }
      });
      if (who.ok) { const info = await who.json(); email = info.email || null; }
    } catch (_) {}

    // Store tokens server-side, one row per user (upsert).
    const expiresAt = new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString();
    const admin = supabaseAdmin();
    const row = {
      user_id: user.id,
      access_token: tok.access_token,
      // Google only returns a refresh_token on the first consent; keep the old
      // one if this time it's absent.
      refresh_token: tok.refresh_token || null,
      expires_at: expiresAt,
      google_email: email,
      updated_at: new Date().toISOString()
    };
    // If no new refresh_token came back, don't overwrite the stored one with null.
    if (!row.refresh_token) {
      const existing = await admin.from("google_tokens").select("refresh_token").eq("user_id", user.id).maybeSingle();
      if (existing.data && existing.data.refresh_token) row.refresh_token = existing.data.refresh_token;
    }
    const { error } = await admin.from("google_tokens").upsert(row, { onConflict: "user_id" });
    if (error) { back("error"); return; }

    back("connected");
  } catch (e) {
    back("error");
  }
};
