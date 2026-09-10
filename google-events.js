/* ============================================================
   api/google-events.js — fetch the signed-in user's Google Calendar events.

   Phase 2 (one-way pull). Steps:
     1. Load the user's stored Google tokens from Supabase.
     2. If the access token is expired, use the refresh token to get a new one
        (Google access tokens last ~1 hour) and save it back.
     3. Call the Google Calendar API for events in a time window.
     4. Return them as clean JSON; the browser maps them into Dayrant's format.

     GET /api/google-events?days=120   -> { events:[...], email }

   The browser never sees the Google tokens — all Google calls happen here.
   ============================================================ */

const { env, supabaseAdmin, getUser } = require("./_lib");

/* Get a valid access token for this user, refreshing if needed. */
async function validAccessToken(admin, userId) {
  const { data, error } = await admin
    .from("google_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;

  const notExpired = data.expires_at && (new Date(data.expires_at).getTime() - Date.now() > 60 * 1000);
  if (notExpired) return data.access_token;

  // Refresh.
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
    access_token: tok.access_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString()
  }).eq("user_id", userId);

  return tok.access_token;
}

/* Pull events from the user's primary calendar within [timeMin, timeMax].
   Follows pagination. Google expands recurring events for us (singleEvents). */
async function fetchEvents(accessToken, timeMin, timeMax) {
  const out = [];
  let pageToken = null;
  let guard = 0;
  do {
    const params = new URLSearchParams({
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: "true",       // expand recurring events into instances
      orderBy: "startTime",
      maxResults: "2500"
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?" + params.toString(),
      { headers: { Authorization: "Bearer " + accessToken } }
    );
    const j = await res.json();
    if (!res.ok) throw new Error((j.error && j.error.message) || "calendar fetch failed");
    (j.items || []).forEach(function (it) { out.push(it); });
    pageToken = j.nextPageToken || null;
    guard++;
  } while (pageToken && guard < 20);
  return out;
}

/* Convert one Google event to Dayrant's shape (local date + HH:MM times).
   Skips cancelled events and all-day events with no time (kept simple for now). */
function toDayrant(gEvent) {
  if (gEvent.status === "cancelled") return null;
  const s = gEvent.start || {}, e = gEvent.end || {};
  // All-day events use `date`; timed events use `dateTime`.
  const allDay = !!s.date && !s.dateTime;
  let date, start, end;
  const pad = function (n) { return n < 10 ? "0" + n : "" + n; };
  const fmtDate = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  const fmtTime = function (d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); };

  if (allDay) {
    date = s.date;             // YYYY-MM-DD already
    start = "00:00"; end = "23:59";
  } else {
    const sd = new Date(s.dateTime);
    const ed = new Date(e.dateTime || s.dateTime);
    date = fmtDate(sd);
    start = fmtTime(sd);
    end = fmtTime(ed);
    // If the event crosses midnight, clamp the end to end-of-day for the grid.
    if (fmtDate(ed) !== date) end = "23:59";
  }

  const notes = [gEvent.description, gEvent.location ? "Location: " + gEvent.location : ""]
    .filter(Boolean).join("\n\n");

  return {
    gcalId: gEvent.id,          // stable Google id -> lets re-sync replace, not duplicate
    title: gEvent.summary || "(untitled)",
    date: date, start: start, end: end,
    notes: notes,
    updated: gEvent.updated || null
  };
}

module.exports = async function handler(req, res) {
  try {
    const user = await getUser(req);
    if (!user) { res.status(401).json({ error: "Not signed in." }); return; }
    const admin = supabaseAdmin();

    const accessToken = await validAccessToken(admin, user.id);
    if (!accessToken) { res.status(400).json({ error: "not-connected" }); return; }

    // Window: default 120 days back to 400 days forward (covers a school year).
    const days = Math.min(800, Math.max(1, parseInt((req.query && req.query.days) || "400", 10)));
    const back = Math.min(365, Math.max(0, parseInt((req.query && req.query.back) || "120", 10)));
    const timeMin = new Date(Date.now() - back * 86400000).toISOString();
    const timeMax = new Date(Date.now() + days * 86400000).toISOString();

    const raw = await fetchEvents(accessToken, timeMin, timeMax);
    const events = raw.map(toDayrant).filter(Boolean);
    res.status(200).json({ events: events, count: events.length });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
