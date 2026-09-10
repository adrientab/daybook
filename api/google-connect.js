/* ============================================================
   api/google-connect.js — starts the Google OAuth flow.

   The browser hits this endpoint (with the user's Supabase token) when they
   click "Connect Google Calendar". We build Google's consent URL and redirect
   the user there. Google then sends them to /api/google-callback.

   We pass the user's Supabase token through Google's `state` parameter so the
   callback knows which Dayrant user is connecting. `state` is also the standard
   CSRF protection for OAuth.
   ============================================================ */

const { env, redirectUri, GOOGLE_SCOPES } = require("./_lib");
const { createClient } = require("@supabase/supabase-js");

/* Verify a Supabase access token and return the user (top-level navigation
   can't send an Authorization header, so google-connect takes the token as a
   query param instead). */
async function userFromToken(token) {
  if (!token) return null;
  const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return data.user;
}

module.exports = async function handler(req, res) {
  try {
    const origin = (process.env.APP_ORIGIN) ||
      (((req.headers["x-forwarded-proto"] || "https").split(",")[0]) + "://" +
       (req.headers["x-forwarded-host"] || req.headers["host"]));
    const url = new URL(req.url, origin);
    const token = url.searchParams.get("token") || "";
    const user = await userFromToken(token);
    if (!user) { res.status(401).send("Not signed in."); return; }

    const params = new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      redirect_uri: redirectUri(req),
      response_type: "code",
      scope: GOOGLE_SCOPES.join(" "),
      access_type: "offline",     // so Google returns a refresh token
      prompt: "consent",          // force consent so we reliably get a refresh token
      include_granted_scopes: "true",
      // Carry the user id + token so the callback can identify and verify them.
      state: user.id + "|" + token
    });

    const gurl = "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString();
    res.writeHead(302, { Location: gurl });
    res.end();
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
