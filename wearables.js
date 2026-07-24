/* ============================================================
   wearables.js — Sleep & Workouts hub

   Gathers data from device exports and feeds it into the rest of the app:
     - Oura export  -> daily sleep metrics, stored per day as `wearable-YYYY-MM-DD`
     - Strava export -> workouts added to the schedule as Exercise events

   There's no live device sync in this offline build (browsers block the
   needed API calls from a double-clicked file), so everything comes in
   through each app's export file.

   Uses app.js: Store, dateKey, appKeys, uid.
   Uses calendar.js: getEvents, saveEvents, minutesToTime, renderCalendar.
   ============================================================ */

const WEARABLE_FIELDS = [
  { id: "wSleep", key: "sleepScore", label: "Sleep" },
  { id: "wReadiness", key: "readiness", label: "Readiness" },
  { id: "wHrv", key: "hrv", label: "HRV" },
  { id: "wRestingHr", key: "restingHr", label: "Resting HR" },
  { id: "wSteps", key: "steps", label: "Steps" }
];

function wearableKey(d) { return "wearable-" + d; }

function getWearable(d) {
  const raw = Store.get(wearableKey(d));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

/* The page is import-only now (no manual entry form). Imports write
   `wearable-YYYY-MM-DD` records directly; this just shows what's stored. */
function renderWearables() {
  renderWearableHistory();
}

function renderWearableHistory() {
  const box = document.getElementById("wearableHistory");

  const days = appKeys()
    .filter(function (k) { return k.indexOf("wearable-") === 0; })
    .map(function (k) { return k.slice("wearable-".length); })
    .sort()
    .reverse();

  if (!days.length) {
    box.innerHTML = '<p class="placeholder">No sleep data yet \u2014 import an Oura export above.</p>';
    return;
  }

  box.innerHTML = "";
  days.forEach(function (d) {
    const e = getWearable(d);
    if (!e) return;
    const parts = WEARABLE_FIELDS
      .filter(function (f) { return e[f.key] != null; })
      .map(function (f) { return f.label + " " + e[f.key]; });

    const row = document.createElement("div");
    row.className = "wearable-row";
    row.innerHTML =
      '<span class="wearable-date">' + wearableDateLabel(d) + "</span>" +
      '<span class="wearable-vals">' + (parts.join(" \u00b7 ") || "\u2014") + "</span>";
    box.appendChild(row);
  });
}

function wearableDateLabel(k) {
  return new Date(k + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", year: "numeric"
  });
}

/* ---- wire up ---- */
onAppReady(renderWearables); // draw once data has loaded

/* ============================================================
   Oura export import (CSV preferred, JSON also handled)
   ============================================================ */

/* Normalize various date strings to YYYY-MM-DD (local). */
function normDate(s) {
  if (!s) return null;
  s = String(s).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + "-" + m[2] + "-" + m[3];
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : dateKey(d);
}

/* Pull a number out of a cell, ignoring stray units/symbols. */
function numOrNull(v) {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

/* Merge parsed values into a day's record (only non-empty fields). */
function mergeWearableDay(date, vals) {
  const entry = getWearable(date) || {};
  let any = false;
  Object.keys(vals).forEach(function (k) {
    if (vals[k] != null) { entry[k] = vals[k]; any = true; }
  });
  if (!any) return false;
  entry.updated = Date.now();
  Store.set(wearableKey(date), JSON.stringify(entry));
  return true;
}

/* ---- CSV ---- */
function parseCsvLine(line) {
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') { q = true; }
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/* First header index containing all given keywords (case-insensitive). */
function findCol(headers, keywords) {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    if (keywords.every(function (k) { return h.indexOf(k) >= 0; })) return i;
  }
  return -1;
}
function pickCol(headers, sets) {
  for (let s = 0; s < sets.length; s++) {
    const i = findCol(headers, sets[s]);
    if (i >= 0) return i;
  }
  return -1;
}

function importOuraCsv(text) {
  const lines = text.split(/\r?\n/).filter(function (l) { return l.trim() !== ""; });
  if (lines.length < 2) return 0;
  const headers = parseCsvLine(lines[0]);

  const dateIdx = pickCol(headers, [["date"], ["day"]]);
  if (dateIdx < 0) return 0;
  const idx = {
    sleepScore: pickCol(headers, [["sleep", "score"], ["sleep"]]),
    readiness: pickCol(headers, [["readiness", "score"], ["readiness"]]),
    hrv: pickCol(headers, [["hrv"]]),
    restingHr: pickCol(headers, [["resting"]]),
    steps: pickCol(headers, [["steps"]])
  };

  let count = 0;
  for (let r = 1; r < lines.length; r++) {
    const cells = parseCsvLine(lines[r]);
    const date = normDate(cells[dateIdx]);
    if (!date) continue;
    const vals = {};
    Object.keys(idx).forEach(function (key) {
      if (idx[key] >= 0) vals[key] = numOrNull(cells[idx[key]]);
    });
    if (mergeWearableDay(date, vals)) count++;
  }
  return count;
}

/* ---- JSON (array, or { data: [...] }) ---- */
function importOuraJson(obj) {
  const arr = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.data) ? obj.data : null);
  if (!arr) return 0;
  let count = 0;
  arr.forEach(function (it) {
    if (!it || typeof it !== "object") return;
    const date = normDate(it.day || it.date || it.summary_date);
    if (!date) return;
    const vals = {
      sleepScore: numOrNull(it.sleep_score != null ? it.sleep_score : (it.sleep && it.sleep.score)),
      readiness: numOrNull(it.readiness_score != null ? it.readiness_score : (it.readiness && it.readiness.score)),
      hrv: numOrNull(it.average_hrv != null ? it.average_hrv : it.hrv),
      restingHr: numOrNull(it.resting_heart_rate != null ? it.resting_heart_rate : it.lowest_heart_rate),
      steps: numOrNull(it.steps)
    };
    if (mergeWearableDay(date, vals)) count++;
  });
  return count;
}

function importOuraFile(file) {
  const msg = document.getElementById("ouraImportMsg");
  const reader = new FileReader();
  reader.onload = function () {
    const text = String(reader.result || "");
    let count = 0;
    const trimmed = text.trim();
    try {
      if (trimmed.charAt(0) === "{" || trimmed.charAt(0) === "[") {
        count = importOuraJson(JSON.parse(trimmed));
      } else {
        count = importOuraCsv(text);
      }
    } catch (e) {
      try { count = importOuraCsv(text); } catch (e2) { count = 0; }
    }
    if (count > 0) {
      msg.textContent = "Imported " + count + " day" + (count === 1 ? "" : "s") + ".";
      renderWearables();
    } else {
      msg.textContent = "Couldn't find matching data in that file \u2014 a CSV with a date column works best.";
    }
  };
  reader.onerror = function () { msg.textContent = "Couldn't read that file."; };
  reader.readAsText(file);
}

document.getElementById("ouraFile").addEventListener("change", function () {
  if (this.files && this.files[0]) importOuraFile(this.files[0]);
  this.value = ""; // let the same file be re-imported if needed
});

/* ============================================================
   Strava export import -> workouts become Exercise events on the schedule
   ============================================================ */

/* Pick the Exercise category if it exists, else fall back gracefully. */
function exerciseCategoryId() {
  const cats = getCategories();
  if (cats.some(function (c) { return c.id === "exercise"; })) return "exercise";
  return cats[0] ? cats[0].id : "";
}

/* Strava dates look like "2024-07-01 06:30:00" or "Jul 1, 2024, 6:30:00 AM".
   Normalize the ISO-with-space form so every browser parses it. */
function parseStravaDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/);
  const d = iso ? new Date(iso[1] + "T" + iso[2]) : new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/* "1:05:30" -> seconds, or a plain seconds number. */
function parseDurationSec(v) {
  if (v == null || String(v).trim() === "") return 0;
  const s = String(v).trim();
  if (s.indexOf(":") >= 0) {
    return s.split(":").reduce(function (acc, p) { return acc * 60 + (Number(p) || 0); }, 0);
  }
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function eventDedupeKey(o) {
  return o.stravaId ? ("sid:" + o.stravaId)
                    : ("k:" + o.date + "|" + o.start + "|" + (o.title || ""));
}

function importStravaCsv(text) {
  const lines = text.split(/\r?\n/).filter(function (l) { return l.trim() !== ""; });
  if (lines.length < 2) return 0;
  const headers = parseCsvLine(lines[0]);

  const dateIdx = pickCol(headers, [["activity date"], ["date"]]);
  if (dateIdx < 0) return 0;
  const nameIdx = pickCol(headers, [["activity name"], ["name"]]);
  const typeIdx = pickCol(headers, [["activity type"], ["type"]]);
  const idIdx = pickCol(headers, [["activity id"], ["id"]]);
  const durIdx = pickCol(headers, [["elapsed time"], ["moving time"]]);

  const catId = exerciseCategoryId();
  const events = getEvents();
  const seen = {};
  events.forEach(function (e) { seen[eventDedupeKey(e)] = true; });

  let count = 0;
  for (let r = 1; r < lines.length; r++) {
    const cells = parseCsvLine(lines[r]);
    const d = parseStravaDate(cells[dateIdx]);
    if (!d) continue;

    const sid = idIdx >= 0 && cells[idIdx] ? String(cells[idIdx]).trim() : "";
    const date = dateKey(d);
    const startMin = d.getHours() * 60 + d.getMinutes();
    const durSec = durIdx >= 0 ? parseDurationSec(cells[durIdx]) : 0;
    const durMin = durSec > 0 ? Math.round(durSec / 60) : 60;
    const endMin = Math.min(24 * 60, startMin + Math.max(15, durMin));

    const name = (nameIdx >= 0 && cells[nameIdx] && cells[nameIdx].trim())
      ? cells[nameIdx].trim()
      : ((typeIdx >= 0 && cells[typeIdx] && cells[typeIdx].trim()) ? cells[typeIdx].trim() : "Workout");

    const ev = {
      id: uid("evt"),
      title: name,
      date: date,
      start: minutesToTime(startMin),
      end: minutesToTime(endMin),
      category: catId,
      feel: null
    };
    if (sid) ev.stravaId = sid;

    const key = eventDedupeKey(ev);
    if (seen[key]) continue; // already imported / already on the schedule
    seen[key] = true;

    events.push(ev);
    count++;
  }

  if (count > 0) {
    saveEvents(events);
    if (typeof renderCalendar === "function") renderCalendar();
  }
  return count;
}

function importStravaFile(file) {
  const msg = document.getElementById("stravaImportMsg");
  const reader = new FileReader();
  reader.onload = function () {
    let count = 0;
    try { count = importStravaCsv(String(reader.result || "")); }
    catch (e) { count = 0; }
    if (count > 0) {
      msg.textContent = "Added " + count + " workout" + (count === 1 ? "" : "s") + " to your schedule.";
    } else {
      msg.textContent = "Couldn't find workouts in that file \u2014 choose the activities.csv from your Strava export.";
    }
  };
  reader.onerror = function () { msg.textContent = "Couldn't read that file."; };
  reader.readAsText(file);
}

document.getElementById("stravaFile").addEventListener("change", function () {
  if (this.files && this.files[0]) importStravaFile(this.files[0]);
  this.value = "";
});
