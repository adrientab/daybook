/* ============================================================
   api/_lib.js — shared helpers for the Google-Calendar serverless functions.

   Runs on Vercel (Node serverless). NEVER imported by the browser. Holds no
   secrets itself — it reads them from environment variables you set in the
   Vercel dashboard (see PHASE1_SETUP.md). The leading underscore tells Vercel
   this file is a helper, not its own HTTP endpoint.
   ============================================================ */

const { createClient } = require("@supabase/supabase-js");

/* Read an environment variable or throw a clear error if it's missing, so a
   misconfigured deploy fails loudly instead of behaving mysteriously. */
function env(name) {
  const v = process.env[name];
  if (!v) throw new Error("Missing environment variable: " + name);
  return v;
}

/* A Supabase client with the SERVICE ROLE key — full server-side access.
   This key must ONLY ever exist on the server (Vercel env var), never in the
   browser. Used to read/write the google_tokens table on the user's behalf. */
function supabaseAdmin() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

/* Verify the caller is a logged-in Dayrant user. The browser sends its Supabase
   access token in the Authorization header; we ask Supabase who it belongs to.
   Returns the user object, or null if the token is missing/invalid. */
async function getUser(req) {
  const auth = req.headers["authorization"] || "";
  const token = auth.indexOf("Bearer ") === 0 ? auth.slice(7) : null;
  if (!token) return null;
  const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return data.user;
}

/* The app's own base URL (e.g. https://dayrant.com), used to build the OAuth
   redirect URI and to send the user back after connecting. */
function appOrigin(req) {
  // Prefer an explicit env var; fall back to the request's host.
  let o = process.env.APP_ORIGIN;
  if (!o) {
    const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
    const host = req.headers["x-forwarded-host"] || req.headers["host"] || "";
    o = proto + "://" + host;
  }
  o = String(o).trim().replace(/\/+$/, "");           // no trailing slash
  if (!/^https?:\/\//i.test(o)) o = "https://" + o;   // ensure a protocol
  return o;
}

/* The Google OAuth redirect URI — where Google sends the user back after they
   approve. Must EXACTLY match one of the "Authorized redirect URIs" you set in
   the Google Cloud console. */
function redirectUri(req) {
  return appOrigin(req) + "/api/google-callback";
}

const GOOGLE_SCOPES = [
  // Read/write calendar events. Phase 2 uses the read side; Phase 3 the write.
  "https://www.googleapis.com/auth/calendar.events",
  // Lets us show which Google account is connected.
  "https://www.googleapis.com/auth/userinfo.email"
];

module.exports = { env, supabaseAdmin, getUser, appOrigin, redirectUri, GOOGLE_SCOPES };
