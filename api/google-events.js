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
   We do NOT set singleEvents, so recurring events come back as a single item
   with their recurrence RRULE (Dayrant has its own repeat system, so we map the
   rule rather than expanding into many one-off events). Follows pagination. */

/* List all calendars the user has access to (their own + subscribed). */
async function listCalendars(accessToken) {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250",
    { headers: { Authorization: "Bearer " + accessToken } }
  );
  const j = await res.json();
  if (!res.ok) throw new Error((j.error && j.error.message) || "calendar list failed");
  return (j.items || []).map(function (c) {
    return { id: c.id, name: c.summary || c.summaryOverride || "Calendar", primary: !!c.primary };
  });
}

/* Fetch events from ONE calendar within [timeMin, timeMax], with pagination. */
async function fetchOneCalendar(accessToken, calendarId, timeMin, timeMax) {
  const out = [];
  let pageToken = null;
  let guard = 0;
  do {
    const params = new URLSearchParams({
      timeMin: timeMin,
      timeMax: timeMax,
      maxResults: "2500"
      // no singleEvents / orderBy: keep recurring events as one item with RRULE
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/" +
        encodeURIComponent(calendarId) + "/events?" + params.toString(),
      { headers: { Authorization: "Bearer " + accessToken } }
    );
    const j = await res.json();
    if (!res.ok) {
      // Skip a calendar we can't read rather than failing the whole sync.
      break;
    }
    (j.items || []).forEach(function (it) { out.push(it); });
    pageToken = j.nextPageToken || null;
    guard++;
  } while (pageToken && guard < 20);
  return out;
}

/* Fetch events across the chosen calendars (or all, if none specified).
   Returns a flat list where each event carries the name of the calendar it
   came from (for categorizing). */
async function fetchEvents(accessToken, timeMin, timeMax, onlyIds) {
  const calendars = await listCalendars(accessToken);
  const wanted = (onlyIds && onlyIds.length)
    ? calendars.filter(function (c) { return onlyIds.indexOf(c.id) > -1; })
    : calendars;
  const all = [];
  for (const cal of wanted) {
    const items = await fetchOneCalendar(accessToken, cal.id, timeMin, timeMax);
    items.forEach(function (it) { it.__calendarName = cal.name; });
    all.push.apply(all, items);
  }
  return all;
}



/* Convert one Google event to a Dayrant-shaped record. Adds `repeat` (Dayrant
   format) when the Google event recurs, so the front end can expand it as a
   proper series. Skips cancelled events. */
function toDayrant(gEvent) {
  if (gEvent.status === "cancelled") return null;
  const s = gEvent.start || {}, e = gEvent.end || {};
  const allDay = !!s.date && !s.dateTime;

  const notes = [gEvent.description, gEvent.location ? "Location: " + gEvent.location : ""]
    .filter(Boolean).join("\n\n");

  // IMPORTANT: do NOT convert times here. This runs on Vercel in UTC, so using
  // getHours()/getDate() would shift every event by the UTC offset. Instead we
  // pass the raw values through and let the BROWSER (which knows the user's real
  // timezone) format them. For recurrence we still need the start weekday, which
  // we compute from the raw dateTime in the front end too.
  return {
    gcalId: gEvent.id,
    calendarName: gEvent.__calendarName || null,
    title: gEvent.summary || "(untitled)",
    allDay: allDay,
    // All-day: a plain YYYY-MM-DD. Timed: full ISO strings with offset.
    startDate: allDay ? s.date : null,
    startDateTime: allDay ? null : s.dateTime,
    endDateTime: allDay ? null : (e.dateTime || s.dateTime),
    recurrence: gEvent.recurrence || null,   // raw RRULE array; parsed in the browser
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

    // Optional: which calendars to sync (comma-separated ids). None -> all.
    let onlyIds = null;
    const cals = req.query && req.query.cals;
    if (cals && typeof cals === "string") {
      onlyIds = cals.split(",").map(function (s) { return decodeURIComponent(s.trim()); }).filter(Boolean);
    }

    const raw = await fetchEvents(accessToken, timeMin, timeMax, onlyIds);
    const events = raw.map(toDayrant).filter(Boolean);
    res.status(200).json({ events: events, count: events.length });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
