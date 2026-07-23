/* ============================================================
   suggest.js — the slide-in "Suggestions" panel on the schedule.
   Two tabs:
     • To-do  — open tasks ordered by when they're due.
     • Goals  — per goal, how many times its category appeared on the
                schedule this week + how long since the last time, with
                the "last done" line aging from grey to red.
   Any item can be dragged onto the grid to schedule it (see
   enableDropCreate in calendar.js).

   Reads getEvents / getTodos / getGoals / getCategories, plus
   dateKey / addDays / startOfWeek / goalTarget / escapeHtml and the
   calendar's currentWeekStart — all defined in earlier scripts.
   ============================================================ */

const suggestPanel = document.getElementById("suggestPanel");
const suggestBody = document.getElementById("suggestBody");
const suggestBtn = document.getElementById("suggestBtn");
let suggestMode = "todo";

/* ---- open / close + tab switching ---- */
function toggleSuggest() {
  suggestPanel.hidden = !suggestPanel.hidden;
  const open = !suggestPanel.hidden;
  suggestBtn.classList.toggle("active", open);
  const view = document.getElementById("view-schedule");
  if (view) view.classList.toggle("suggest-open", open); // compresses the schedule
  if (open) renderSuggestPanel();
}

function setSuggestMode(mode) {
  suggestMode = mode;
  document.getElementById("suggestTodoTab").classList.toggle("active", mode === "todo");
  document.getElementById("suggestGoalsTab").classList.toggle("active", mode === "goals");
  renderSuggestPanel();
}

function renderSuggestPanel() {
  if (suggestPanel.hidden) return;
  if (suggestMode === "goals") renderGoalsSuggest(suggestBody);
  else renderTodosSuggest(suggestBody);
}

/* Called by renderCalendar / renderTodos / renderGoals when data changes. */
function refreshSuggest() {
  if (suggestPanel && !suggestPanel.hidden) renderSuggestPanel();
}

/* ---- shared helpers ---- */

/* Make an item draggable onto the grid; payload travels as JSON. */
function makeDraggable(el, payload) {
  el.draggable = true;
  el.addEventListener("dragstart", function (e) {
    e.dataTransfer.setData("text/plain", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
    // The drop preview grows downward from the cursor, so draw the drag ghost
    // fully above it: putting the cursor point below the image's bottom edge
    // lifts the ghost clear of the shaded area. The 14px gap covers the
    // preview snapping up to ~6px above the cursor.
    if (e.dataTransfer.setDragImage) {
      const r = el.getBoundingClientRect();
      e.dataTransfer.setDragImage(el, r.width / 2, r.height + 14);
    }
    el.classList.add("dragging");
  });
  el.addEventListener("dragend", function () { el.classList.remove("dragging"); });
}

function catDot(catId) {
  const cat = catId ? getCategories().find(function (c) { return c.id === catId; }) : null;
  return cat ? '<span class="cat-dot" style="background:' + cat.color + '"></span>' : "";
}

/* "Today" / "Tomorrow" / "Mon, Jul 3" for a YYYY-MM-DD key. */
function relDate(k) {
  if (!k) return "No date";
  const todayK = dateKey(new Date());
  const tomK = dateKey(addDays(new Date(), 1));
  if (k === todayK) return "Today";
  if (k === tomK) return "Tomorrow";
  return new Date(k + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/* ---- To-do tab ---- */
function renderTodosSuggest(body) {
  const todos = getTodos()
    .filter(function (t) { return !t.done; })
    .sort(function (a, b) {
      const ad = a.due || "9999-99-99", bd = b.due || "9999-99-99";
      if (ad !== bd) return ad < bd ? -1 : 1;
      const at = a.dueTime || "99:99", bt = b.dueTime || "99:99";
      return at < bt ? -1 : (at > bt ? 1 : 0);
    });

  if (!todos.length) {
    body.innerHTML = '<p class="suggest-empty">Nothing left to do — nice.</p>';
    return;
  }

  body.innerHTML = "";
  todos.forEach(function (t) {
    const item = document.createElement("div");
    item.className = "suggest-item";
    const due = relDate(t.due) + (t.dueTime ? " " + t.dueTime : "");
    item.innerHTML =
      '<div class="suggest-title">' + catDot(todoCat(t)) + escapeHtml(t.title) + "</div>" +
      '<div class="suggest-meta"><span>' + due + "</span>" +
      (t.estHours ? "<span>~" + t.estHours + "h</span>" : "") + "</div>";
    makeDraggable(item, { type: "todo", title: t.title, category: todoCat(t) || "" });
    body.appendChild(item);
  });
}

/* ---- Goals tab ---- */

/* Expected days between sessions, derived from the goal's target. */
function expectedGap(goal) {
  const t = goalTarget(goal); // {type, value} | null
  if (!t || !t.value) return null;
  if (t.type === "everyNDays") return t.value;
  if (t.type === "timesPerWeek") return 7 / t.value;
  if (t.type === "hours") return 7; // weekly rhythm as a fallback
  return null;
}

/* This week's sessions of a goal, plus when it was last done. A "session" is a
   schedule event whose title matches the goal's name, so a "Learn piano" event
   counts toward the "Learn piano" goal no matter which category it's in.
   Matching ignores case and surrounding spaces, but is otherwise exact. */
function goalActivity(goal) {
  const name = (goal.title || "").trim().toLowerCase();
  const todayK = dateKey(new Date());
  const weekStart = (typeof currentWeekStart !== "undefined") ? currentWeekStart : startOfWeek(new Date());
  const weekStartK = dateKey(weekStart);
  const weekEndK = dateKey(addDays(weekStart, 6));

  let count = 0;
  let lastK = null;
  if (name) {
    getEvents().forEach(function (ev) {
      if ((ev.title || "").trim().toLowerCase() !== name) return;
      if (ev.date >= weekStartK && ev.date <= weekEndK) count++;
      if (ev.date <= todayK && (!lastK || ev.date > lastK)) lastK = ev.date;
    });
  }
  let daysSince = null;
  if (lastK) {
    daysSince = Math.round(
      (new Date(todayK + "T00:00:00") - new Date(lastK + "T00:00:00")) / 86400000
    );
  }
  return { count: count, lastK: lastK, daysSince: daysSince };
}

/* Grey when fresh, sliding to red as days-since reaches the expected gap. */
function ageColor(daysSince, gap) {
  const grey = [156, 163, 175]; // #9ca3af
  const red = [220, 38, 38];    // #dc2626
  let r = 0;
  if (gap) r = Math.max(0, Math.min(1, daysSince / gap));
  const c = grey.map(function (g, i) { return Math.round(g + (red[i] - g) * r); });
  return "rgb(" + c.join(",") + ")";
}

function lastDoneText(act) {
  if (!act.lastK) return "No sessions yet";
  if (act.daysSince <= 0) return "Last done today";
  if (act.daysSince === 1) return "Last done yesterday";
  return "Last done " + act.daysSince + " days ago";
}

/* "once every 3 days" -> "Once every 3 days" (it leads the meta line). */
function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function renderGoalsSuggest(body) {
  const goals = getGoals();
  if (!goals.length) {
    body.innerHTML = '<p class="suggest-empty">No goals yet. Add some on the Goals tab.</p>';
    return;
  }

  body.innerHTML = "";
  goals.forEach(function (g) {
    const act = goalActivity(g);
    const gap = expectedGap(g);

    // Colour for the "last done" line. Sessions are matched by name now, so a
    // linked category is no longer what makes a goal trackable — the target is.
    let color;
    if (!gap) color = "var(--muted)";              // no target -> nothing to judge against
    else if (!act.lastK) color = "rgb(220,38,38)"; // has a target but never done -> red
    else color = ageColor(act.daysSince, gap);

    const item = document.createElement("div");
    item.className = "suggest-item goal";

    // Show the target you actually set for the goal ("once every 3 days"),
    // not a count derived from what you've done.
    const targetText = goalTargetText(g);
    let meta = '<span>' +
      escapeHtml(targetText ? capitalize(targetText) : "No target set") + "</span>";
    meta += '<span class="last-done" style="color:' + color + '">' + lastDoneText(act) + "</span>";

    item.innerHTML =
      '<div class="suggest-title">' + catDot(g.category) + escapeHtml(g.title) + "</div>" +
      '<div class="suggest-meta">' + meta + "</div>";

    makeDraggable(item, { type: "goal", title: g.title, category: g.category || "" });
    body.appendChild(item);
  });
}

/* ---- wire up ---- */
if (suggestBtn) {
  suggestBtn.addEventListener("click", toggleSuggest);
  document.getElementById("suggestTodoTab").addEventListener("click", function () { setSuggestMode("todo"); });
  document.getElementById("suggestGoalsTab").addEventListener("click", function () { setSuggestMode("goals"); });
}