/* ============================================================
   api/google-status.js — is this user's Google Calendar connected?

   GET  -> { connected: bool, email: string|null }
   DELETE -> disconnects (removes stored tokens). We also best-effort tell
             Google to revoke the token so access is fully withdrawn.
   ============================================================ */

const { supabaseAdmin, getUser } = require("./_lib");

module.exports = async function handler(req, res) {
  try {
    const user = await getUser(req);
    if (!user) { res.status(401).json({ error: "Not signed in." }); return; }
    const admin = supabaseAdmin();

    if (req.method === "DELETE") {
      // Best-effort revoke at Google, then delete our copy.
      const { data } = await admin.from("google_tokens").select("access_token").eq("user_id", user.id).maybeSingle();
      if (data && data.access_token) {
        try {
          await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(data.access_token), { method: "POST" });
        } catch (_) {}
      }
      await admin.from("google_tokens").delete().eq("user_id", user.id);
      res.status(200).json({ connected: false });
      return;
    }

    // GET: report status.
    const { data } = await admin.from("google_tokens").select("google_email").eq("user_id", user.id).maybeSingle();
    res.status(200).json({ connected: !!data, email: (data && data.google_email) || null });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
