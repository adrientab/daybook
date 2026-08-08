/* ============================================================
   app.js — shared helpers + sidebar nav + journal
   Loaded BEFORE calendar.js, so the helpers below are available
   to the calendar code too.
   ============================================================ */

/* ---- Storage layer ----
   All app data lives in an in-memory cache for the whole session:

     Store.load()    async, once at boot — pulls everything into the cache
     Store.get(k)    synchronous, reads the cache
     Store.set(k,v)  synchronous, updates the cache, queues a background save

   Reads stay synchronous on purpose. The app reads data in ~90 places; making
   those await would mean rewriting nearly every function. Instead only the
   boot sequence is async, and the data (one person's schedule and journal) is
   small enough to hold in memory comfortably.

   Everything that touches persistence lives in the backend object below, so
   moving from localStorage to a server means swapping that one object. */

/* Device preferences, not user data: these should differ per device (dark mode
   on your phone, light on your laptop), so they always stay in this browser
   and never sync. */
const LOCAL_ONLY_KEYS = ["theme", "sidebarCollapsed", "weekStart", "dayStartHour", "use24Hour"];

/* Backend: reads/writes the browser's localStorage. If it's blocked (private
   window, sandboxed preview), the cache still works for the session. */
const LocalBackend = {
  name: "local",
  loadAll: function () {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) out[k] = localStorage.getItem(k);
      }
    } catch (e) { /* blocked -> start empty and run from memory */ }
    return Promise.resolve(out);
  },
  /* changes: [{ key, value }], where value === null means "delete this key". */
  saveMany: function (changes) {
    try {
      changes.forEach(function (c) {
        if (c.value === null) localStorage.removeItem(c.key);
        else localStorage.setItem(c.key, c.value);
      });
    } catch (e) { /* quota or blocked: the cache still has it this session */ }
    return Promise.resolve();
  }
};

const Store = {
  _mem: {},
  _dirty: {},          // keys changed since the last flush
  _timer: null,
  _backend: LocalBackend,
  ready: false,

  load: function () {
    const self = this;
    return this._backend.loadAll().then(function (data) {
      self._mem = data || {};
      // Device prefs always come from this browser, whatever the backend is.
      LOCAL_ONLY_KEYS.forEach(function (k) {
        try {
          const v = localStorage.getItem(k);
          if (v !== null) self._mem[k] = v;
        } catch (e) { /* ignore */ }
      });
      self.ready = true;
    });
  },

  get: function (key) {
    return (key in this._mem) ? this._mem[key] : null;
  },

  set: function (key, value) {
    this._mem[key] = String(value);
    this._touch(key);
  },

  remove: function (key) {
    delete this._mem[key];
    this._touch(key);
  },

  /* Every key currently held. Replaces walking localStorage directly. */
  keys: function () {
    return Object.keys(this._mem);
  },

  /* Mark a key as needing saving and schedule a flush. Writes are debounced so
     a burst of edits becomes one save instead of twenty. */
  _touch: function (key) {
    if (LOCAL_ONLY_KEYS.indexOf(key) >= 0) {
      try {
        if (key in this._mem) localStorage.setItem(key, this._mem[key]);
        else localStorage.removeItem(key);
      } catch (e) { /* ignore */ }
      return;
    }
    this._dirty[key] = true;
    clearTimeout(this._timer);
    const self = this;
    this._timer = setTimeout(function () { self.flush(); }, 400);
  },

  flush: function () {
    clearTimeout(this._timer);
    const keys = Object.keys(this._dirty);
    if (!keys.length) return Promise.resolve();

    const self = this;
    const changes = keys.map(function (k) {
      return { key: k, value: (k in self._mem) ? self._mem[k] : null };
    });
    this._dirty = {};

    return this._backend.saveMany(changes).catch(function (e) {
      // Put them back so the next flush retries rather than losing the edit.
      changes.forEach(function (c) { self._dirty[c.key] = true; });
      console.error("Save failed, will retry:", e);
    });
  }
};

/* Don't lose the last few hundred ms of edits when the tab closes or is
   backgrounded. localStorage writes finish synchronously inside flush(), so
   this is enough today; a network backend will need more care here. */
window.addEventListener("pagehide", function () { Store.flush(); });
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden") Store.flush();
});

/* ---- Boot ----
   Files loaded after this one register their first render here instead of
   running it immediately, so nothing tries to draw before the data has
   arrived. boot.js (loaded last) awaits Store.load() and then runs them. */
const _readyQueue = [];

function onAppReady(fn) {
  if (Store.ready) fn();
  else _readyQueue.push(fn);
}

function runAppReady() {
  while (_readyQueue.length) {
    const fn = _readyQueue.shift();
    // One broken view shouldn't stop the rest of the app from starting.
    try { fn(); } catch (e) { console.error("Init step failed:", e); }
  }
}

/* ---- Date helpers ----
   We build date keys from LOCAL date parts (not UTC) so an entry
   written at 11pm is filed under today, not tomorrow. */
function pad(n) { return String(n).padStart(2, "0"); }

function dateKey(d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

/* ---- Custom day-start hour --------------------------------------------
   By default a day runs midnight->midnight (start hour 0). The user can set a
   later boundary (e.g. 5 = 5am), so late-night hours belong to the previous
   day: with a 5am start, 2am Saturday is really "Friday night" and shows at the
   bottom of Friday. Stored locally (a device preference), 0-23, default 0. */
const DAY_START_KEY = "dayStartHour";
function getDayStartHour() {
  const v = parseInt(Store.get(DAY_START_KEY), 10);
  return (isNaN(v) || v < 0 || v > 23) ? 0 : v;
}
function setDayStartHour(h) {
  Store.set(DAY_START_KEY, String(h));
}

/* ---- 12h / 24h clock preference -----------------------------------------
   Default is 12-hour (AM/PM). When on, all displayed times use 24-hour
   ("military") format. Stored locally (a device preference). */
const TIME24_KEY = "use24Hour";
function use24Hour() {
  return Store.get(TIME24_KEY) === "1";
}
function setUse24Hour(on) {
  Store.set(TIME24_KEY, on ? "1" : "0");
}
/* Format a stored "HH:MM" (24h) for display, honoring the clock preference. */
function fmtTime(hhmm) {
  if (!hhmm) return "";
  const parts = String(hhmm).split(":");
  let h = Number(parts[0]);
  const m = parts[1];
  if (use24Hour()) return pad(h) + ":" + m;
  const ampm = h < 12 ? "AM" : "PM";
  h = h % 12; if (h === 0) h = 12;
  return h + ":" + m + " " + ampm;
}
/* Format a whole-hour number (0-23) for the schedule gutter, per preference. */
function fmtHour(h) {
  if (use24Hour()) return pad(h) + ":00";
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? h + " AM" : (h - 12) + " PM";
}
/* The logical day-key a moment belongs to, honoring the day-start hour.
   Anything before the start hour rolls into the previous calendar day. */
function logicalDayKey(d) {
  const shifted = new Date(d.getTime() - getDayStartHour() * 3600000);
  return dateKey(shifted);
}
/* For an event stored as (dateKey, clockMinutes): which logical day-key it
   belongs to. Early-morning times (before the start hour) belong to the
   previous day. */
function logicalDayKeyFor(dateStr, clockMinutes) {
  const startMin = getDayStartHour() * 60;
  if (clockMinutes >= startMin) return dateStr;          // same day
  // Before the start boundary -> previous calendar day.
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return dateKey(d);
}
/* An event's vertical offset (in minutes from the top of the grid) given the
   day-start hour. The grid runs [startHour, startHour+24). */
function gridMinutes(clockMinutes) {
  const startMin = getDayStartHour() * 60;
  return (clockMinutes - startMin + 1440) % 1440;
}
/* Inverse of gridMinutes: a grid offset (0 = top of the column) back to real
   clock minutes (0-1439). */
function gridToClock(gridMin) {
  const startMin = getDayStartHour() * 60;
  return (gridMin + startMin) % 1440;
}
/* Given the column's logical day-key and a grid offset, the real calendar date
   the resulting time falls on. If the grid offset pushes past midnight (because
   the day starts before midnight-relative), it's the next calendar day. */
function gridDateFor(dayKeyStr, gridMin) {
  const startMin = getDayStartHour() * 60;
  const total = gridMin + startMin;            // minutes past midnight of dayKeyStr
  const d = new Date(dayKeyStr + "T00:00:00");
  if (total >= 1440) d.setDate(d.getDate() + 1); // rolled into the next calendar day
  return dateKey(d);
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}



/* The week-start preference. "sunday"/"monday" are fixed weekdays; the
   relative options anchor the week to today and shift it, so the days you
   care about stay in view. Stored locally (a device preference). */
const WEEK_START_KEY = "weekStart";
function getWeekStart() {
  const v = Store.get(WEEK_START_KEY);
  return v || "sunday";
}

/* Returns the date that begins the week containing d, per the preference. */
function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const pref = getWeekStart();

  if (pref === "monday") {
    const day = x.getDay();
    x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
    return x;
  }
  if (pref === "today") return x;
  if (pref === "yesterday") { x.setDate(x.getDate() - 1); return x; }
  if (pref === "tomorrow")  { x.setDate(x.getDate() + 1); return x; }

  // default: Sunday
  x.setDate(x.getDate() - x.getDay());
  return x;
}

/* ---- Categories (shared data) ----
   Stored as a list of { id, name, color }. Events save the id, so names
   and colours can be edited freely without breaking existing events. */
const DEFAULT_CATEGORIES = [
  { id: "class",    name: "Class",    color: "#3b82f6", subs: [] },
  { id: "work",     name: "Work",     color: "#8b5cf6", subs: [] },
  { id: "exercise", name: "Exercise", color: "#22c55e", subs: [] },
  { id: "social",   name: "Social",   color: "#f59e0b", subs: [] },
  { id: "rest",     name: "Rest",     color: "#6b7280", subs: [] }
];

function getCategories() {
  const raw = Store.get("categories");
  if (!raw) {
    Store.set("categories", JSON.stringify(DEFAULT_CATEGORIES));
    return DEFAULT_CATEGORIES.slice();
  }
  const list = JSON.parse(raw);
  // Backfill subs on any category saved before subcategories existed.
  list.forEach(function (c) { if (!Array.isArray(c.subs)) c.subs = []; });
  return list;
}
function saveCategories(list) {
  Store.set("categories", JSON.stringify(list));
}
function categoryColor(id) {
  const c = getCategories().find(function (x) { return x.id === id; });
  return c ? c.color : "#9ca3af"; // grey fallback if a category was deleted
}
/* The subcategories of a category id (or [] if none / unknown). */
function getSubcategories(catId) {
  const c = getCategories().find(function (x) { return x.id === catId; });
  return (c && Array.isArray(c.subs)) ? c.subs : [];
}
/* Look up a subcategory's display name by parent id + sub id. */
function subcategoryName(catId, subId) {
  const s = getSubcategories(catId).find(function (x) { return x.id === subId; });
  return s ? s.name : "";
}

/* Colour-code by the chosen category: keep a small sliver on the select,
   and frame the whole modal it lives in with the category's colour. */
function paintCategorySelect(sel) {
  const color = categoryColor(sel.value);
  sel.style.border = "";                          // back to the stylesheet's 1px sides
  sel.style.borderLeft = "6px solid " + color;    // the sliver

  const modal = sel.closest(".modal");
  if (modal) modal.style.border = "4px solid " + color;
}

/* ---- Small shared helpers used across files ---- */

/* Escape user-typed text so a value like "<b>" can't break the page. */
function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s == null ? "" : s;
  return div.innerHTML;
}

/* A short unique id, e.g. "evt-1719...-428137". */
function uid(prefix) {
  return prefix + "-" + Date.now() + "-" + Math.floor(Math.random() * 1000000);
}

/* ============================================================
   Sidebar navigation: show one view at a time
   ============================================================ */
const navItems = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".view");

// Which view names are real (derived from the nav, so it can't drift).
const VALID_VIEWS = Array.from(navItems).map(function (b) { return b.dataset.view; });

// Show one view, highlight its nav item, and refresh its data.
function switchView(target) {
  if (VALID_VIEWS.indexOf(target) === -1) target = "schedule";

  navItems.forEach(function (b) {
    b.classList.toggle("active", b.dataset.view === target);
  });
  views.forEach(v => v.classList.remove("active"));
  const el = document.getElementById("view-" + target);
  if (el) el.classList.add("active");

  // Refresh data-driven views when opened so they reflect the latest data.
  if (target === "goals" && typeof renderGoals === "function") renderGoals();
  if (target === "journal" && typeof renderJournalView === "function") renderJournalView();
  if (target === "todo" && typeof renderTodos === "function") renderTodos();
  if (target === "wearables" && typeof renderWearables === "function") renderWearables();
  if (target === "patterns" && typeof renderPatterns === "function") renderPatterns();
  if (target === "study" && typeof renderStudy === "function") renderStudy();
}

// Read the view name out of the URL hash: "#todo" or "#/todo" -> "todo".
function viewFromHash() {
  return (location.hash || "").replace(/^#\/?/, "");
}

// Clicking a nav item just changes the URL; the hashchange handler below
// does the actual switching. That keeps the URL, the highlight, and the
// visible view in sync no matter how the hash changes (click, back/forward,
// or a reload landing on #todo).
navItems.forEach(function (button) {
  button.addEventListener("click", function () {
    location.hash = button.dataset.view;
  });
});

window.addEventListener("hashchange", function () {
  switchView(viewFromHash());
});

// On first load, honor the hash so a reload stays on the same view.
onAppReady(function () { switchView(viewFromHash() || "schedule"); });

/* ---- Collapse / expand the sidebar (remembers your choice) ---- */
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");

function applyCollapsed(collapsed) {
  sidebar.classList.toggle("collapsed", collapsed);
  sidebarToggle.innerHTML = collapsed ? "&rsaquo;" : "&lsaquo;";
  sidebarToggle.title = collapsed ? "Expand" : "Collapse";
}

sidebarToggle.addEventListener("click", function () {
  const collapsed = !sidebar.classList.contains("collapsed");
  applyCollapsed(collapsed);
  Store.set("sidebarCollapsed", collapsed ? "1" : "0");
});

onAppReady(function () { applyCollapsed(Store.get("sidebarCollapsed") === "1"); }); // restore last state

/* ---- Light / dark theme (remembers your choice) ----
   An inline script in <head> already set data-theme="dark" before paint if
   that was the saved choice; this just wires the toggle and keeps the
   button's label in sync with whatever theme is active. */
const themeToggle = document.getElementById("themeToggle");

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/* The theme to show: an explicit choice wins; otherwise follow the OS/browser
   preference (matching the no-flash script in the page head). */
function resolveTheme() {
  const saved = Store.get("theme");
  if (saved === "dark" || saved === "light") return saved;
  try {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  } catch (e) { /* ignore */ }
  return "light";
}

function applyTheme(theme) {
  if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
  if (themeToggle) {
    themeToggle.textContent = (theme === "dark") ? "Switch to light mode" : "Switch to dark mode";
  }
}

if (themeToggle) {
  themeToggle.addEventListener("click", function () {
    const next = (currentTheme() === "dark") ? "light" : "dark";
    applyTheme(next);
    Store.set("theme", next);
  });
}

onAppReady(function () { applyTheme(resolveTheme()); }); // saved choice, else OS preference

/* ---- Week-start preference ---- */
onAppReady(function () {
  // The week views were initialised at load with the default start; now that
  // the saved preference is available, re-anchor them.
  if (typeof currentWeekStart !== "undefined") currentWeekStart = startOfWeek(new Date());
  if (typeof todoWeekStart !== "undefined") todoWeekStart = startOfWeek(new Date());
  if (typeof jWeekStart !== "undefined") jWeekStart = startOfWeek(new Date());

  const sel = document.getElementById("weekStartSelect");
  if (!sel) return;
  sel.value = getWeekStart();
  sel.addEventListener("change", function () {
    Store.set(WEEK_START_KEY, sel.value);
    // Re-anchor every week-based view to the new start and redraw.
    if (typeof currentWeekStart !== "undefined") currentWeekStart = startOfWeek(new Date());
    if (typeof todoWeekStart !== "undefined") todoWeekStart = startOfWeek(new Date());
    if (typeof jWeekStart !== "undefined") jWeekStart = startOfWeek(new Date());
    if (typeof renderCalendar === "function") renderCalendar();
    if (typeof renderTodos === "function") renderTodos();
    if (typeof renderJournalView === "function") renderJournalView();
  });

  // Day-starts-at hour picker (0-23). Midnight is the default "no change".
  const daySel = document.getElementById("dayStartSelect");
  if (daySel) {
    function hourLabel(h) {
      if (h === 0) return "Midnight (12am)";
      if (h === 12) return "Noon (12pm)";
      const ampm = h < 12 ? "am" : "pm";
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return h12 + ampm;
    }
    let opts = "";
    for (let h = 0; h < 24; h++) opts += '<option value="' + h + '">' + hourLabel(h) + "</option>";
    daySel.innerHTML = opts;
    daySel.value = String(getDayStartHour());
    daySel.addEventListener("change", function () {
      setDayStartHour(parseInt(daySel.value, 10) || 0);
      if (typeof renderCalendar === "function") renderCalendar();
      if (typeof renderTodos === "function") renderTodos();
      if (typeof renderJournalView === "function") renderJournalView();
    });
  }

  // 24-hour ("military") time toggle. A button, matching the theme toggle.
  const t24 = document.getElementById("time24Toggle");
  if (t24) {
    function syncT24Label() {
      t24.textContent = use24Hour() ? "Switch to 12-hour" : "Switch to 24-hour";
    }
    syncT24Label();
    t24.addEventListener("click", function () {
      setUse24Hour(!use24Hour());
      syncT24Label();
      if (typeof renderCalendar === "function") renderCalendar();
      if (typeof renderTodos === "function") renderTodos();
      if (typeof renderJournalView === "function") renderJournalView();
    });
  }
});

/* While the user hasn't picked a theme, follow the OS if it changes live. Once
   they choose one (saved), their choice sticks and this stops mattering. */
try {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
    if (!Store.ready) return;
    const saved = Store.get("theme");
    if (saved === "dark" || saved === "light") return; // explicit choice wins
    applyTheme(e.matches ? "dark" : "light");
  });
} catch (e) { /* older browser: no live updates, still fine */ }

/* ---- Enter saves the open modal (but not inside a textarea) ---- */
document.addEventListener("keydown", function (e) {
  if (e.key !== "Enter") return;
  if (e.target && e.target.tagName === "TEXTAREA") return; // let Enter make newlines
  const openOverlay = document.querySelector(".modal-overlay.open");
  if (!openOverlay) return;
  const primary = openOverlay.querySelector(".btn-primary");
  if (primary) { e.preventDefault(); primary.click(); }
});

/* ============================================================
   Settings: backup (export / import) and reset
   ============================================================ */

/* Is this localStorage key one of the app's own? */
function isAppKey(k) {
  if (!k) return false;
  if (["events", "todos", "categories", "goals", "rants", "sidebarCollapsed"].indexOf(k) >= 0) return true;
  return k.indexOf("daily-") === 0 || k.indexOf("morning-") === 0 ||
         k.indexOf("weekly-") === 0 || k.indexOf("entry-") === 0 ||
         k.indexOf("wearable-") === 0;
}

/* List every app key currently stored. */
function appKeys() {
  return Store.keys().filter(isAppKey);
}

function clearAppData() {
  appKeys().forEach(function (k) { Store.remove(k); });
  return Store.flush();   // returns a promise; callers can await persistence
}

/* Gather everything into one downloadable JSON file. */
function exportData() {
  const data = {};
  appKeys().forEach(function (k) {
    const raw = Store.get(k);
    try { data[k] = JSON.parse(raw); } catch (e) { data[k] = raw; }
  });
  const payload = { app: "Daybook", version: 1, exportedAt: new Date().toISOString(), data: data };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "daybook-backup-" + dateKey(new Date()) + ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* Restore from a backup file (replaces current data). */
function importData(file) {
  const reader = new FileReader();
  reader.onload = function () {
    let payload;
    try { payload = JSON.parse(reader.result); }
    catch (e) { alert("That file isn't valid backup JSON."); return; }

    const data = payload && payload.data;
    if (!data || typeof data !== "object") {
      alert("This file doesn't look like a Daybook backup.");
      return;
    }
    if (!confirm("Importing replaces your current data with this backup. Continue?")) return;

    clearAppData();
    Object.keys(data).forEach(function (k) {
      const v = data[k];
      Store.set(k, typeof v === "string" ? v : JSON.stringify(v));
    });
    Promise.resolve(Store.flush()).then(function () { location.reload(); });
  };
  reader.readAsText(file);
}

const exportBtn = document.getElementById("exportData");
if (exportBtn) exportBtn.addEventListener("click", exportData);

const importBtn = document.getElementById("importData");
const importFile = document.getElementById("importFile");
if (importBtn && importFile) {
  importBtn.addEventListener("click", function () { importFile.click(); });
  importFile.addEventListener("change", function () {
    if (importFile.files[0]) importData(importFile.files[0]);
    importFile.value = ""; // allow re-importing the same file later
  });
}

/* ---- Import from Google Calendar (.ics) --------------------------------
   Reads the chosen .ics file(s), parses each with DaybookICS, turns each
   calendar into a category, and adds the events. All client-side. */
const gcalBtn = document.getElementById("gcalImportBtn");
const gcalFile = document.getElementById("gcalImportFile");
if (gcalBtn && gcalFile) {
  gcalBtn.addEventListener("click", function () { gcalFile.click(); });
  gcalFile.addEventListener("change", function () {
    const files = Array.from(gcalFile.files || []);
    gcalFile.value = "";
    if (files.length) importGoogleCalendar(files);
  });
}

function readFileText(file) {
  return new Promise(function (resolve, reject) {
    const r = new FileReader();
    r.onload = function () { resolve(r.result); };
    r.onerror = function () { reject(r.error); };
    r.readAsText(file);
  });
}

/* Find an existing category by name (case-insensitive) or create one.
   Returns the category id. Mutates+saves the categories list as needed. */
function ensureCategory(name) {
  const cats = getCategories();
  const existing = cats.find(function (c) { return c.name.toLowerCase() === name.toLowerCase(); });
  if (existing) return existing.id;
  // Pick a color from a small rotating palette so new calendars look distinct.
  const palette = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#14b8a6", "#ec4899", "#64748b"];
  const color = palette[cats.length % palette.length];
  const id = uid("cat");
  cats.push({ id: id, name: name, color: color, subs: [] });
  saveCategories(cats);
  return id;
}

async function importGoogleCalendar(files) {
  if (!window.DaybookICS) { alert("Import module not loaded. Please refresh and try again."); return; }
  let totalEvents = 0;
  const calendars = [];
  const allWarnings = [];

  try {
    for (const file of files) {
      // .zip isn't supported here — ask the user to unzip first.
      if (/\.zip$/i.test(file.name)) {
        alert("Please unzip the Google Calendar download first, then select the .ics file(s) inside.");
        continue;
      }
      const text = await readFileText(file);
      const res = DaybookICS.parseICS(text, { horizonDays: 365 });
      if (!res.events.length) continue;

      const catName = (res.categoryName || file.name.replace(/\.ics$/i, "")).trim() || "Imported";
      const catId = ensureCategory(catName);

      const events = getEvents();
      res.events.forEach(function (e) {
        events.push({
          id: uid("evt"),
          title: e.title,
          date: e.date,
          start: e.start,
          end: e.end,
          category: catId,
          subcategory: "",
          notes: e.notes || "",
          feel: null,
          imported: true            // tag so a future "remove imported" could find them
        });
      });
      saveEvents(events);

      totalEvents += res.events.length;
      calendars.push(catName + " (" + res.events.length + ")");
      res.warnings.forEach(function (w) { allWarnings.push(w); });
    }
  } catch (err) {
    alert("Sorry, something went wrong reading that file. Make sure it's a .ics exported from Google Calendar.");
    return;
  }

  if (typeof renderCalendar === "function") renderCalendar();

  if (!totalEvents) {
    alert("No events found in that file. Make sure you picked the .ics file(s) from the unzipped Google Calendar export.");
    return;
  }
  let msg = "Imported " + totalEvents + " event" + (totalEvents === 1 ? "" : "s") +
    " into " + calendars.length + " categor" + (calendars.length === 1 ? "y" : "ies") + ":\n\n" +
    calendars.join("\n");
  if (allWarnings.length) {
    msg += "\n\nNotes:\n" + allWarnings.slice(0, 5).join("\n");
    if (allWarnings.length > 5) msg += "\n…and " + (allWarnings.length - 5) + " more.";
  }
  alert(msg);
}

const resetBtn = document.getElementById("resetData");
if (resetBtn) {
  resetBtn.addEventListener("click", function () {
    if (!confirm("This permanently deletes all your data. It cannot be undone. Continue?")) return;
    Promise.resolve(clearAppData()).then(function () { location.reload(); });
  });
}

/* ---- Goals (shared data) ----
   Each goal: { id, title, hoursPerWeek, milestones: [{id,text,date,done}], created }. */
function getGoals() {
  const raw = Store.get("goals");
  return raw ? JSON.parse(raw) : [];
}
function saveGoals(list) {
  Store.set("goals", JSON.stringify(list));
}

/* A goal's target can be hours/week, times/week, or once-every-N-days.
   Returns a normalized { type, value } or null. Old goals that only had
   hoursPerWeek still work. */
function goalTarget(goal) {
  if (goal.target && goal.target.type) return goal.target;
  if (goal.hoursPerWeek != null && goal.hoursPerWeek !== "") {
    return { type: "hours", value: goal.hoursPerWeek };
  }
  return null;
}
function goalTargetText(goal) {
  const t = goalTarget(goal);
  if (!t) return null;
  if (t.type === "hours") return t.value + " hrs/week";
  if (t.type === "timesPerWeek") return t.value + "\u00d7/week";
  if (t.type === "everyNDays") return "once every " + t.value + " days";
  return null;
}

/* ---- To-do items (shared data) ----
   Each: { id, title, category, due (YYYY-MM-DD), done, created }. */
function getTodos() {
  const raw = Store.get("todos");
  return raw ? JSON.parse(raw) : [];
}
function saveTodos(list) {
  Store.set("todos", JSON.stringify(list));
}

/* Returns the Monday that begins the week containing date d.
   (The weekly journal runs Monday-Sunday, as you wanted.) */
function startOfWeekMonday(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();                 // 0=Sun .. 6=Sat
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  return x;
}
