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
const LOCAL_ONLY_KEYS = ["theme", "sidebarCollapsed", "weekStart"];

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

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/* Keep a date input's year inside 2000-2099. The native year segment can't be
   reprogrammed key-by-key, but this snaps anything out of range back into the
   20## window (year 5 -> 2005, year 3025 -> 2025) so you can't save a wild
   year. Call attachYearClamp(input) once per date field. */
function clampYear(value) {
  // value is "YYYY-MM-DD" (or "" while incomplete).
  const m = /^(\d+)-(\d{2})-(\d{2})$/.exec(value || "");
  if (!m) return value;
  let y = parseInt(m[1], 10);
  if (y >= 2000 && y <= 2099) return value;      // already a valid 20xx year

  // The native field gives a finished 4-digit year, but browsers build it
  // differently as you type: Chrome pads on the RIGHT ("25" -> 0025), Safari
  // pads on the LEFT ("25" -> 2500). Pull the two typed digits out of either
  // shape and rebuild as 20xx.
  let yy;
  if (y > 2099) {
    // Left-padded: the typed digits are the most significant ones. 2500 -> 25.
    yy = Math.floor(y / 100) % 100;
    if (yy === 0) yy = y % 100;                  // fallback for odd shapes
  } else {
    // y < 2000, right-padded or a bare small number. 0025 -> 25, 5 -> 5.
    yy = ((y % 100) + 100) % 100;
  }
  return "20" + pad(yy) + "-" + m[2] + "-" + m[3];
}
function attachYearClamp(input) {
  if (!input) return;
  // Clamp on BLUR, not on every change: a change fires as each year digit is
  // typed, so clamping there would reset the field after the first digit (you
  // could never get past 200x). Waiting for blur lets you type the full year,
  // then snaps it only if it ended up out of the 2000-2099 range.
  input.addEventListener("blur", function () {
    const fixed = clampYear(input.value);
    if (fixed !== input.value) input.value = fixed;
  });
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
  { id: "class",    name: "Class",    color: "#3b82f6" },
  { id: "work",     name: "Work",     color: "#8b5cf6" },
  { id: "exercise", name: "Exercise", color: "#22c55e" },
  { id: "social",   name: "Social",   color: "#f59e0b" },
  { id: "rest",     name: "Rest",     color: "#6b7280" }
];

function getCategories() {
  const raw = Store.get("categories");
  if (!raw) {
    Store.set("categories", JSON.stringify(DEFAULT_CATEGORIES));
    return DEFAULT_CATEGORIES.slice();
  }
  return JSON.parse(raw);
}
function saveCategories(list) {
  Store.set("categories", JSON.stringify(list));
}
function categoryColor(id) {
  const c = getCategories().find(function (x) { return x.id === id; });
  return c ? c.color : "#9ca3af"; // grey fallback if a category was deleted
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