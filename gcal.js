/* ============================================================
   gcal.js — front-end for Google Calendar connection (Phase 1).

   Drives the Connect / Disconnect buttons in Settings. It calls our own
   serverless endpoints under /api/, authenticating with the user's Supabase
   access token. The browser never handles Google tokens — those live only on
   the server. Phase 2 will add the actual event pull.
   ============================================================ */
(function () {
  "use strict";

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  // Format a Date in the browser's LOCAL timezone (this is the whole point of
  // doing it here rather than on the UTC server).
  function fmtLocalDate(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function fmtLocalTime(d) { return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }

  // Map a Google RRULE array to Dayrant's repeat shape, using the LOCAL start
  // weekday so a weekly event lands on the right day for the user's timezone.
  var DOW_MAP = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  function parseRecurrenceLocal(recurrence, startDate) {
    if (!Array.isArray(recurrence)) return null;
    var rruleStr = null;
    for (var i = 0; i < recurrence.length; i++) {
      if (recurrence[i].indexOf("RRULE:") === 0) { rruleStr = recurrence[i]; break; }
    }
    if (!rruleStr) return null;
    var rule = {};
    rruleStr.slice(6).split(";").forEach(function (part) {
      var eq = part.indexOf("=");
      if (eq > -1) rule[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
    });
    var freq = rule.FREQ, interval = Math.max(1, parseInt(rule.INTERVAL || "1", 10));
    if (freq === "WEEKLY") {
      var byday = (rule.BYDAY || "").split(",")
        .map(function (c) { return DOW_MAP[c.trim().toUpperCase()]; })
        .filter(function (x) { return x != null; });
      var days = byday.length ? byday : (startDate ? [startDate.getDay()] : []);
      if (interval > 1) return { mode: "everyN", step: 7 * interval };
      return { mode: "weekdays", days: days };
    }
    if (freq === "DAILY") return { mode: "everyN", step: interval };
    return null;   // monthly/yearly/unsupported -> single event
  }

  // Get the current Supabase access token to authenticate API calls.
  async function accessToken() {
    try {
      if (typeof Auth !== "undefined" && Auth.client) {
        const { data } = await Auth.client.auth.getSession();
        return data && data.session ? data.session.access_token : null;
      }
    } catch (_) {}
    return null;
  }

  async function apiFetch(path, opts) {
    const token = await accessToken();
    if (!token) throw new Error("not-signed-in");
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers, { Authorization: "Bearer " + token });
    return fetch(path, opts);
  }

  const connectBtn = document.getElementById("gcalConnectBtn");
  const disconnectBtn = document.getElementById("gcalDisconnectBtn");
  const syncBtn = document.getElementById("gcalSyncBtn");
  const desc = document.getElementById("gcalSyncDesc");
  const pickerRow = document.getElementById("gcalPickerRow");
  const picker = document.getElementById("gcalPicker");

  var SEL_KEY = "gcalSelectedCalendars";   // remembered locally (device preference)
  function savedSelection() {
    try { return JSON.parse(localStorage.getItem(SEL_KEY) || "null"); } catch (_) { return null; }
  }
  function saveSelection(ids) {
    try { localStorage.setItem(SEL_KEY, JSON.stringify(ids)); } catch (_) {}
  }

  // Load the user's calendars and render checkboxes.
  async function loadPicker() {
    if (!picker) return;
    try {
      const res = await apiFetch("/api/google-calendars", { method: "GET" });
      const j = await res.json();
      if (!res.ok) return;
      const cals = j.calendars || [];
      const saved = savedSelection();
      picker.innerHTML = "";
      cals.forEach(function (c) {
        // Default: everything checked the first time (no saved selection yet).
        const checked = saved ? (saved.indexOf(c.id) > -1) : true;
        const label = document.createElement("label");
        label.className = "gcal-cal";
        label.innerHTML =
          '<input type="checkbox" value="' + escapeAttr(c.id) + '"' + (checked ? " checked" : "") + ">" +
          "<span>" + escapeHtml(c.name) + (c.primary ? " (main)" : "") + "</span>";
        label.querySelector("input").addEventListener("change", persistFromUI);
        picker.appendChild(label);
      });
      if (pickerRow) pickerRow.hidden = cals.length === 0;
      persistFromUI();
    } catch (_) { /* leave hidden */ }
  }
  function persistFromUI() {
    if (!picker) return;
    const ids = Array.prototype.slice.call(picker.querySelectorAll("input:checked"))
      .map(function (i) { return i.value; });
    saveSelection(ids);
  }
  function selectedIds() {
    const s = savedSelection();
    return s && s.length ? s : null;   // null -> all
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function escapeAttr(s) { return escapeHtml(s).replace(/'/g, "&#39;"); }

  function setConnectedUI(connected, email) {
    if (connectBtn) connectBtn.hidden = connected;
    if (disconnectBtn) disconnectBtn.hidden = !connected;
    if (syncBtn) syncBtn.hidden = !connected;
    if (pickerRow && !connected) pickerRow.hidden = true;
    if (connected && desc) {
      desc.textContent = "Connected" + (email ? " as " + email : "") +
        ". Choose which calendars to sync, then click Sync now.";
    }
    if (connected) loadPicker();
  }

  /* Pull events from Google (via our serverless function) and merge them into
     Dayrant. Previously-synced Google events are matched by their Google id and
     REPLACED, so re-syncing updates rather than duplicates. */
  async function syncNow() {
    if (!syncBtn) return;
    const original = syncBtn.textContent;
    syncBtn.disabled = true; syncBtn.textContent = "Syncing…";
    try {
      var q = "/api/google-events?days=400&back=120";
      var ids = selectedIds();
      if (ids && ids.length) q += "&cals=" + ids.map(encodeURIComponent).join(",");
      const res = await apiFetch(q, { method: "GET" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "sync-failed");

      const incoming = j.events || [];

      const existing = (typeof getEvents === "function") ? getEvents() : [];
      // Drop all previously-synced Google events; we re-add the current set.
      const kept = existing.filter(function (e) { return !e.gcalId; });

      // Cache a category id per calendar name so each Google calendar maps to
      // its own Dayrant category (e.g. "Classes", "Exams"), like the .ics import.
      const catCache = {};
      function catFor(name) {
        const key = name || "Google Calendar";
        if (!(key in catCache)) {
          catCache[key] = (typeof ensureCategory === "function") ? ensureCategory(key) : undefined;
        }
        return catCache[key];
      }

      incoming.forEach(function (g) {
        const catId = catFor(g.calendarName);

        // Format the raw Google timestamp in the BROWSER's local timezone, so
        // times line up with what the user sees in Google Calendar.
        var date, start, end, startObj;
        if (g.allDay) {
          date = g.startDate;                 // already YYYY-MM-DD
          start = "00:00"; end = "23:59";
          startObj = new Date(g.startDate + "T00:00:00");
        } else {
          var sd = new Date(g.startDateTime);      // local interpretation
          var ed = new Date(g.endDateTime || g.startDateTime);
          startObj = sd;
          date = fmtLocalDate(sd);
          start = fmtLocalTime(sd);
          end = fmtLocalTime(ed);
          if (fmtLocalDate(ed) !== date) end = "23:59";
        }

        const base = {
          title: g.title,
          date: date, start: start, end: end,
          category: catId,
          subcategory: "",
          notes: g.notes || "",
          feel: null,
          imported: true,
          gcalId: g.gcalId
        };

        const repeat = parseRecurrenceLocal(g.recurrence, startObj);
        if (repeat && typeof expandSeries === "function") {
          const series = expandSeries(base, repeat);
          series.forEach(function (inst) { inst.gcalId = g.gcalId; kept.push(inst); });
        } else {
          kept.push(Object.assign({
            id: (typeof uid === "function") ? uid("evt") : ("evt-" + g.gcalId)
          }, base));
        }
      });
      if (typeof saveEvents === "function") saveEvents(kept);
      if (typeof renderCalendar === "function") renderCalendar();

      if (desc) desc.textContent = "Synced " + incoming.length + " event" +
        (incoming.length === 1 ? "" : "s") + " from Google Calendar just now.";
    } catch (e) {
      var msg = (e && e.message) || "";
      if (msg === "not-connected") {
        alert("Couldn't sync: your Google account isn't connected (or the connection expired). Please reconnect.");
      } else {
        // Show the real reason so problems are diagnosable instead of generic.
        alert("Couldn't sync from Google.\n\n" + (msg || "Unknown error") +
          "\n\nIf this persists, check the Vercel function logs for /api/google-events.");
      }
    } finally {
      syncBtn.disabled = false; syncBtn.textContent = original;
    }
  }
  if (syncBtn) syncBtn.addEventListener("click", syncNow);

  // Check current status on load.
  async function refreshStatus() {
    try {
      const res = await apiFetch("/api/google-status", { method: "GET" });
      if (!res.ok) return;
      const j = await res.json();
      setConnectedUI(!!j.connected, j.email);
    } catch (_) { /* not signed in yet, or backend not deployed — leave default */ }
  }

  if (connectBtn) {
    connectBtn.addEventListener("click", async function () {
      const token = await accessToken();
      if (!token) { alert("Please sign in first."); return; }
      // Navigate to the connect endpoint; it redirects to Google. We pass the
      // token via a short-lived query so the top-level navigation is authed
      // (a plain link can't send an Authorization header).
      window.location.href = "/api/google-connect?token=" + encodeURIComponent(token);
    });
  }
  if (disconnectBtn) {
    disconnectBtn.addEventListener("click", async function () {
      if (!confirm("Disconnect Google Calendar? Your synced events stay, but will no longer update.")) return;
      try {
        await apiFetch("/api/google-status", { method: "DELETE" });
      } catch (_) {}
      setConnectedUI(false);
      if (syncBtn) syncBtn.hidden = true;
      if (pickerRow) pickerRow.hidden = true;
      if (desc) desc.textContent = "Connect your Google account to sync your calendar with Dayrant. Your events become readable to enable syncing; your journal stays end-to-end encrypted.";
    });
  }

  // If we just came back from Google, show a message based on ?gcal=...
  function handleReturn() {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("gcal");
    if (!status) return;
    if (status === "connected") { /* refreshStatus will show it */ }
    else if (status === "denied") alert("Google connection was cancelled.");
    else if (status === "error") alert("Something went wrong connecting to Google. Please try again.");
    // Clean the URL so the message doesn't reappear on refresh.
    const clean = window.location.pathname;
    window.history.replaceState({}, "", clean);
  }

  // Run once the app is ready (Auth available).
  function init() {
    handleReturn();
    refreshStatus();
  }
  if (typeof onAppReady === "function") onAppReady(init);
  else if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
