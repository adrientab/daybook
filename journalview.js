/* ============================================================
   journalview.js — the Journal tab
   Top: a Monday-Sunday week with a goal-oriented weekly review.
   Bottom: a rant stream (timeline by default, filterable by tag).
   Uses app.js (Store, dateKey, addDays, startOfWeekMonday, getGoals),
   journal.js (hasMorning, hasDaily, openDailyJournal),
   calendar.js (uid, escapeHtml).
   ============================================================ */

let jWeekStart = startOfWeekMonday(new Date()); // Monday of the shown week
let rantFilter = null;                           // active tag filter, or null
const weeklyOverlay = document.getElementById("weeklyModalOverlay");

function weeklyKey(monday) { return "weekly-" + dateKey(monday); }
function getWeekly(monday) {
  const raw = Store.get(weeklyKey(monday));
  return raw ? JSON.parse(raw) : null;
}
function weekDatesFrom(monday) {
  const out = [];
  for (let i = 0; i < 7; i++) out.push(addDays(monday, i));
  return out;
}

/* Top-level render: called at load, on week navigation, and when the tab opens. */
function renderJournalView() {
  if (!document.getElementById("jWeekLabel")) return;
  renderWeekStrip();
  renderRants();
  regrowRant(); // width may have changed while away; refit the composer
}

/* The rant box auto-grows to a fixed pixel height for the current width.
   When that width changes (window resize, sidebar open/close), the height
   is stale, so recompute it — but only while it's actually on screen. */
function regrowRant() {
  const el = document.getElementById("rantText");
  if (el && el.offsetParent !== null && typeof autoGrow === "function") autoGrow(el);
}

/* True if this week has a saved weekly review with any content. */
function hasWeekly(monday) {
  const w = getWeekly(monday);
  if (!w) return false;
  if (hasAnswers(w, JOURNAL_QUESTIONS.weekly)) return true;
  return !!(w.goalHours && Object.keys(w.goalHours).length > 0);
}

/* ---- Week strip (7 days, click a day to open its evening journal) ---- */
function renderWeekStrip() {
  const days = weekDatesFrom(jWeekStart);
  const mid = addDays(jWeekStart, 3); // midpoint -> the week's dominant month
  document.getElementById("jWeekLabel").textContent =
    mid.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const strip = document.getElementById("weekDays");
  strip.innerHTML = "";
  const todayKey = dateKey(new Date());

  days.forEach(function (d) {
    const ds = dateKey(d);
    const cell = document.createElement("button");
    cell.className = "week-day" + (ds === todayKey ? " today" : "");
    cell.innerHTML =
      '<span class="wd-dow">' + d.toLocaleDateString(undefined, { weekday: "short" }) + "</span>" +
      '<span class="wd-num">' + d.getDate() + "</span>" +
      '<span class="wd-dots">' +
        '<span class="wd-dot' + (hasMorning(ds) ? " on" : "") + '" title="Morning"></span>' +
        '<span class="wd-dot' + (hasDaily(ds) ? " on" : "") + '" title="Evening"></span>' +
      "</span>";
    cell.addEventListener("click", function () { openDay(ds); });
    strip.appendChild(cell);
  });

  // 8th box: the weekly journal for the shown week.
  const wk = document.createElement("button");
  wk.className = "week-day weekly" + (hasWeekly(jWeekStart) ? " has-entry" : "");
  wk.innerHTML =
    '<span class="wd-weekly-label">Weekly<br>journal</span>' +
    (hasWeekly(jWeekStart) ? '<span class="wd-dot on"></span>' : "");
  wk.addEventListener("click", openWeekly);
  strip.appendChild(wk);
}

/* ---- Weekly review (goal hours + reflection prompts) ---- */
/* ---- Weekly journal modal ---- */
function openWeekly() {
  const saved = getWeekly(jWeekStart) || {};
  const opts = { month: "short", day: "numeric" };
  const days = weekDatesFrom(jWeekStart);
  document.getElementById("weeklyModalTitle").textContent =
    "Weekly journal \u2014 " + days[0].toLocaleDateString(undefined, opts) +
    " \u2013 " + days[6].toLocaleDateString(undefined, opts);

  renderWeeklyGoals(saved.goalHours || {});
  renderQuestions(document.getElementById("weeklyQuestions"), JOURNAL_QUESTIONS.weekly, saved);
  weeklyOverlay.classList.add("open");
}

function renderWeeklyGoals(hours) {
  const wg = document.getElementById("weeklyGoals");
  wg.innerHTML = "";
  const goals = getGoals();
  if (goals.length === 0) {
    wg.innerHTML = '<p class="hint">No goals yet \u2014 add some in the Goals tab and they\'ll show up here to log against.</p>';
    return;
  }
  goals.forEach(function (g) {
    const t = goalTarget(g);
    const targetText = goalTargetText(g) || "no target";
    const unit = (t && t.type === "hours") ? "h" : "\u00d7"; // hours, else a count
    const row = document.createElement("div");
    row.className = "wk-goal";
    row.innerHTML =
      '<span class="wk-goal-title">' + escapeHtml(g.title) +
        ' <span class="wk-goal-target">(' + targetText + ")</span></span>" +
      '<span><input type="number" min="0" step="0.5" class="wk-hours-input" data-gid="' + g.id +
        '" value="' + (hours[g.id] != null ? hours[g.id] : "") + '"> ' + unit + " this week</span>";
    wg.appendChild(row);
  });
}

function closeWeekly() {
  weeklyOverlay.classList.remove("open");
}

function saveWeekly() {
  const goalHours = {};
  document.querySelectorAll(".wk-hours-input").forEach(function (inp) {
    if (inp.value !== "") goalHours[inp.dataset.gid] = Number(inp.value);
  });

  const entry = readQuestions(document.getElementById("weeklyQuestions"));
  entry.goalHours = goalHours;
  entry.updated = Date.now();

  Store.set(weeklyKey(jWeekStart), JSON.stringify(entry));
  closeWeekly();
  renderWeekStrip(); // update the weekly box's checkmark
}

/* ============================================================
   Rants — a timeline you can optionally filter by tag (hybrid)
   ============================================================ */
function getRants() {
  const raw = Store.get("rants");
  return raw ? JSON.parse(raw) : [];
}
function saveRants(list) {
  Store.set("rants", JSON.stringify(list));
}

function parseTags(str) {
  return str.split(",").map(function (t) { return t.trim().toLowerCase(); }).filter(Boolean);
}

/* Make a title unique by appending " 2", " 3", … (case-insensitive match).
   "class" three times -> "class", "class 2", "class 3". */
function uniqueRantTitle(base, rants) {
  const taken = {};
  rants.forEach(function (r) { taken[(r.title || "").toLowerCase()] = true; });
  if (!taken[base.toLowerCase()]) return base;
  let n = 2;
  while (taken[(base + " " + n).toLowerCase()]) n++;
  return base + " " + n;
}

function addRant() {
  const titleRaw = document.getElementById("rantTitle").value.trim();
  const text = document.getElementById("rantText").value.trim();
  if (!titleRaw) { document.getElementById("rantTitle").focus(); return; }

  const tags = parseTags(document.getElementById("rantTags").value);
  const rants = getRants();
  const title = uniqueRantTitle(titleRaw, rants);
  rants.push({ id: uid("rant"), title: title, text: text, tags: tags, created: Date.now() });
  saveRants(rants);

  document.getElementById("rantTitle").value = "";
  document.getElementById("rantText").value = "";
  document.getElementById("rantTags").value = "";
  if (typeof autoGrow === "function") autoGrow(document.getElementById("rantText"));
  renderRants();
}

function deleteRant(id) {
  saveRants(getRants().filter(function (r) { return r.id !== id; }));
  renderRants();
}

/* ---- Evening-journal "anything else on your mind" <-> a tagged rant ----
   The evening journal has a free-text box that lives in the rant stream,
   auto-tagged "journal". We key it to the journal's date so re-saving the
   same day updates that one rant instead of piling up duplicates. */

function findJournalRant(dateStr) {
  return getRants().find(function (r) {
    return r.source === "journal" && r.date === dateStr;
  });
}

/* Text to prefill the evening journal box when it's reopened. */
function defaultJournalTitle(dateStr) {
  return "Journal \u2014 " + prettyDate(dateStr);
}

/* Clean field values to prefill the evening journal's "anything else" box.
   Title comes back blank if it's just the auto default, and the implicit
   "journal" tag is hidden so the box only shows tags the user added. */
function journalRantFields(dateStr) {
  const r = findJournalRant(dateStr);
  if (!r) return { text: "", title: "", tags: "" };
  const def = defaultJournalTitle(dateStr);
  return {
    text: r.text || "",
    title: (r.title && r.title !== def) ? r.title : "",
    tags: (r.tags || []).filter(function (t) { return t !== "journal"; }).join(", ")
  };
}

/* Called from journal.js on save. Creates, updates, or clears the day's
   "journal" rant. `title` and `tagsStr` are optional; "journal" is always
   added as a tag, and an empty title falls back to the dated default. */
function syncJournalRant(dateStr, text, title, tagsStr) {
  text = (text || "").trim();
  const rants = getRants();
  const idx = rants.findIndex(function (r) {
    return r.source === "journal" && r.date === dateStr;
  });

  if (!text) {
    // Emptied out -> remove the auto rant for that day if there was one.
    if (idx >= 0) {
      rants.splice(idx, 1);
      saveRants(rants);
      if (typeof renderRants === "function") renderRants();
    }
    return;
  }

  // Always tag "journal", then add the user's tags (de-duped, journal first).
  const tags = [];
  ["journal"].concat(parseTags(tagsStr || "")).forEach(function (t) {
    if (t && tags.indexOf(t) === -1) tags.push(t);
  });

  const finalTitle = (title || "").trim() || defaultJournalTitle(dateStr);

  if (idx >= 0) {
    rants[idx].text = text;          // keep original created + id
    rants[idx].title = finalTitle;
    rants[idx].tags = tags;
  } else {
    rants.push({
      id: uid("rant"),
      title: finalTitle,
      text: text,
      tags: tags,
      created: Date.now(),
      source: "journal",
      date: dateStr
    });
  }
  saveRants(rants);
  if (typeof renderRants === "function") renderRants();
}

function renderRants() {
  const rants = getRants().slice().sort(function (a, b) { return b.created - a.created; });

  // Build the tag-filter chips from every tag in use.
  const tagSet = {};
  rants.forEach(function (r) { (r.tags || []).forEach(function (t) { tagSet[t] = true; }); });

  const filterBox = document.getElementById("rantTagFilter");
  filterBox.innerHTML = "";
  Object.keys(tagSet).sort().forEach(function (t) {
    const chip = document.createElement("button");
    chip.className = "tag-chip" + (rantFilter === t ? " active" : "");
    chip.textContent = "#" + t;
    chip.addEventListener("click", function () {
      rantFilter = (rantFilter === t) ? null : t; // click again to clear
      renderRants();
    });
    filterBox.appendChild(chip);
  });
  if (rantFilter) {
    const clear = document.createElement("button");
    clear.className = "tag-chip clear";
    clear.textContent = "clear filter";
    clear.addEventListener("click", function () { rantFilter = null; renderRants(); });
    filterBox.appendChild(clear);
  }

  // The stream: titles + tags only. Click one to read the full notes.
  const list = document.getElementById("rantList");
  list.innerHTML = "";
  const shown = rantFilter
    ? rants.filter(function (r) { return (r.tags || []).indexOf(rantFilter) >= 0; })
    : rants;

  if (shown.length === 0) {
    list.innerHTML = '<p class="placeholder">' +
      (rantFilter ? "No rants with that tag." : "Nothing here yet. Vent above.") + "</p>";
    return;
  }

  shown.forEach(function (r) {
    let tagsHtml = "";
    (r.tags || []).forEach(function (t) { tagsHtml += '<span class="rant-tag">#' + escapeHtml(t) + "</span>"; });

    const d = new Date(r.created);
    const when = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
      " \u00b7 " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

    const item = document.createElement("div");
    item.className = "rant-item";
    item.innerHTML =
      '<div class="rant-title">' + escapeHtml(r.title || "(untitled)") + "</div>" +
      '<div class="rant-when">' + when + "</div>" +
      (tagsHtml ? '<div class="rant-tags">' + tagsHtml + "</div>" : "");
    item.addEventListener("click", function () { openRant(r.id); });
    list.appendChild(item);
  });
}

/* ---- Rant detail modal (full notes, change tags, delete) ---- */
let editingRantId = null;
const rantModalOverlay = document.getElementById("rantModalOverlay");

function openRant(id) {
  const r = getRants().find(function (x) { return x.id === id; });
  if (!r) return;
  editingRantId = id;

  document.getElementById("rantModalTitle").textContent = r.title || "(untitled)";

  const d = new Date(r.created);
  document.getElementById("rantModalMeta").textContent =
    d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" }) +
    " \u00b7 " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  const body = document.getElementById("rantModalBody");
  body.innerHTML = r.text
    ? escapeHtml(r.text).replace(/\n/g, "<br>")
    : '<span class="placeholder">No notes.</span>';

  document.getElementById("rantModalTags").value = (r.tags || []).join(", ");
  rantModalOverlay.classList.add("open");
}

function closeRant() {
  rantModalOverlay.classList.remove("open");
  editingRantId = null;
}

function saveRantModal() {
  if (!editingRantId) return;
  const tags = parseTags(document.getElementById("rantModalTags").value);
  saveRants(getRants().map(function (r) {
    return r.id === editingRantId ? Object.assign({}, r, { tags: tags }) : r;
  }));
  closeRant();
  renderRants();
}

function deleteRantModal() {
  if (!editingRantId) return;
  const id = editingRantId;
  closeRant();
  deleteRant(id);
}

/* ---- Wire up buttons ---- */
document.getElementById("saveWeekly").addEventListener("click", saveWeekly);
document.getElementById("cancelWeekly").addEventListener("click", closeWeekly);
weeklyOverlay.addEventListener("click", function (e) { if (e.target === weeklyOverlay) closeWeekly(); });
document.getElementById("jPrevWeek").addEventListener("click", function () {
  jWeekStart = addDays(jWeekStart, -7); renderJournalView();
});
document.getElementById("jNextWeek").addEventListener("click", function () {
  jWeekStart = addDays(jWeekStart, 7); renderJournalView();
});
document.getElementById("jThisWeek").addEventListener("click", function () {
  jWeekStart = startOfWeekMonday(new Date()); renderJournalView();
});
document.getElementById("addRant").addEventListener("click", addRant);
document.getElementById("rantModalSave").addEventListener("click", saveRantModal);
document.getElementById("rantModalDelete").addEventListener("click", deleteRantModal);
document.getElementById("rantModalClose").addEventListener("click", closeRant);
rantModalOverlay.addEventListener("click", function (e) { if (e.target === rantModalOverlay) closeRant(); });

// Rant composer placeholders come from RANT_CONFIG in questions.js.
document.getElementById("rantText").placeholder = RANT_CONFIG.textPlaceholder;
document.getElementById("rantTags").placeholder = RANT_CONFIG.tagsPlaceholder;

// Grow the rant box as you type instead of using the drag-to-resize handle.
document.getElementById("rantText").addEventListener("input", function () {
  if (typeof autoGrow === "function") autoGrow(this);
});

// Refit the rant box when its width changes: window resize, and the sidebar
// finishing its open/close animation (which fires a width transitionend).
window.addEventListener("resize", regrowRant);
const sidebarEl = document.getElementById("sidebar");
if (sidebarEl) {
  sidebarEl.addEventListener("transitionend", function (e) {
    if (e.propertyName === "width") regrowRant();
  });
}

onAppReady(renderJournalView);
