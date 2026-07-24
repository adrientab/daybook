/* ============================================================
   calendar.js — the week-view calendar
   Uses Store, dateKey, addDays, startOfWeek from app.js.
   ============================================================ */

const HOUR_HEIGHT = 48; // must match --hour-height in styles.css
const RECUR_HORIZON_DAYS = 365; // how far ahead recurring events are created

/* State: which week is shown, which event we're editing, and (for a recurring
   delete) which event is waiting on a "this one / all future" choice. */
let currentWeekStart = startOfWeek(new Date());
let editingId = null;
let pendingDelete = null;
let addEventBtnEl = null; // moved into the calendar's corner each render

/* Category filter for the schedule. Holds the ids of categories that are
   hidden. In-memory only (not saved), so every reload starts with all
   categories shown. */
let hiddenCategories = new Set();

/* Set briefly after an event resize so the click that follows the drag
   doesn't also open the event modal. */
let suppressEventClick = false;

/* A to-do's effective category. todo.js owns the rule (a "do on" item follows
   the deadline it's part of), but it loads after this file and renderCalendar()
   runs on load — hence the guard. */
function todoCat(t) {
  return (typeof todoCategoryOf === "function") ? todoCategoryOf(t) : t.category;
}

/* Same guard: todo.js defines the kinds, but this file renders first. */
function todoIsDeadline(t) {
  return (typeof todoKind === "function") ? todoKind(t) === "deadline" : t.kind !== "do";
}

/* ---- Reading and writing the events list ----
   All events live in one array under the "events" key, each tagged
   with its own date. Rendering a week is just filtering that list. */
function getEvents() {
  const raw = Store.get("events");
  return raw ? JSON.parse(raw) : [];
}
function saveEvents(events) {
  Store.set("events", JSON.stringify(events));
}

/* ---- Small time helpers ---- */
function timeToMinutes(t) {            // "09:30" -> 570
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(mins) {         // 570 -> "09:30"
  return pad(Math.floor(mins / 60)) + ":" + pad(mins % 60);
}
function formatHour(h) {               // 0 -> "12 AM", 13 -> "1 PM"
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? h + " AM" : (h - 12) + " PM";
}

/* ============================================================
   Render the calendar for the current week
   ============================================================ */
function renderCalendar() {
  const header = document.getElementById("calHeader");
  const grid = document.getElementById("calGrid");
  header.innerHTML = "";
  grid.innerHTML = "";

  // The 7 dates of this week (Sun..Sat).
  const weekDates = [];
  for (let i = 0; i < 7; i++) weekDates.push(addDays(currentWeekStart, i));

  // Title like "June 2026" — use the week's midpoint so the dominant month shows.
  const mid = addDays(currentWeekStart, 3);
  document.getElementById("weekLabel").textContent =
    mid.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const todayKey = dateKey(new Date());

  // --- Header: corner holds the + Event button, then 7 weekday cells ---
  if (!addEventBtnEl) addEventBtnEl = document.getElementById("addEventBtn");
  const corner = document.createElement("div");
  corner.className = "cal-corner";
  if (addEventBtnEl) corner.appendChild(addEventBtnEl); // re-mounts it each render (ref survives the clear)
  header.appendChild(corner);

  const todos = getTodos();

  weekDates.forEach(function (d) {
    const ds = dateKey(d);
    const cell = document.createElement("div");
    cell.className = "cal-day-name" + (ds === todayKey ? " today" : "");
    cell.innerHTML =
      '<span class="dow">' + d.toLocaleDateString(undefined, { weekday: "short" }) + "</span>" +
      '<span class="dom">' + d.getDate() + "</span>";

    // Deadlines with NO time show as thin clickable lines under the date.
    // "Plan" items are intentions, not commitments, so they stay off the grid.
    const untimed = todos.filter(function (t) {
      return t.due === ds && !t.dueTime && todoIsDeadline(t);
    });
    if (untimed.length) {
      const lines = document.createElement("div");
      lines.className = "cal-todos";
      untimed.slice(0, 5).forEach(function (t) {
        const line = document.createElement("div");
        line.className = "cal-todo-line" + (t.done ? " done" : "");
        line.style.background = categoryColor(todoCat(t));
        line.title = t.title + " (no time set)";
        line.addEventListener("click", function () {
          if (typeof openTodo === "function") openTodo(t.id);
        });
        lines.appendChild(line);
      });
      cell.appendChild(lines);
    }

    header.appendChild(cell);
  });

  // --- Body: time gutter, then 7 day columns ---
  const gutter = document.createElement("div");
  gutter.className = "cal-gutter";
  for (let h = 0; h < 24; h++) {
    const label = document.createElement("div");
    label.className = "cal-hour-label";
    label.style.height = HOUR_HEIGHT + "px";
    label.textContent = formatHour(h);
    gutter.appendChild(label);
  }
  grid.appendChild(gutter);

  const events = getEvents();

  weekDates.forEach(function (d) {
    const ds = dateKey(d);
    const col = document.createElement("div");
    col.className = "cal-col" + (ds === todayKey ? " today" : "");
    col.dataset.date = ds; // lets a dragged event find which day it's over
    col.style.height = (24 * HOUR_HEIGHT) + "px";

    // Drag (or click) on empty space to create an event, in 15-min steps.
    enableDragCreate(col, ds);
    // Accept items dragged in from the Suggestions panel.
    enableDropCreate(col, ds);

    // Events, laid out side-by-side when they overlap (respecting the filter).
    const dayEvents = events.filter(function (ev) {
      return ev.date === ds && !hiddenCategories.has(ev.category);
    });
    layoutDayEvents(dayEvents).forEach(function (it) {
      col.appendChild(buildEventBlock(it.ev, it.left, it.width));
    });

    // Timed to-dos: cluster ones within ~10 min so their dots sit together.
    const timed = todos
      .filter(function (t) { return t.due === ds && t.dueTime; })
      .sort(function (a, b) { return timeToMinutes(a.dueTime) - timeToMinutes(b.dueTime); });
    clusterTodos(timed, 10).forEach(function (group) {
      col.appendChild(buildTodoMarker(group));
    });

    // Solid bar marking the current time, on today's column only.
    if (ds === todayKey) {
      const nowLine = document.createElement("div");
      nowLine.className = "cal-now";
      nowLine.dataset.day = ds; // so the ticker can spot a rollover past midnight
      nowLine.style.top = nowTopPx() + "px";
      col.appendChild(nowLine);
    }

    grid.appendChild(col);
  });

  // --- Morning buttons at the top of each day, evening at the bottom ---
  buildDayBar(document.getElementById("calTop"), weekDates, "morning");
  buildDayBar(document.getElementById("calFooter"), weekDates, "evening");

  if (typeof refreshSuggest === "function") refreshSuggest();
}

/* Where the current time sits, in pixels from the top of a day column. */
function nowTopPx() {
  const now = new Date();
  return (now.getHours() * 60 + now.getMinutes()) / 60 * HOUR_HEIGHT;
}

/* Nudge the current-time bar every minute. Moving the existing element is
   cheaper than re-rendering the grid (and won't disturb an in-progress drag);
   a full render only happens when the date itself rolls over past midnight. */
setInterval(function () {
  const line = document.querySelector(".cal-now");
  if (!line) return;
  if (line.dataset.day !== dateKey(new Date())) renderCalendar();
  else line.style.top = nowTopPx() + "px";
}, 60000);

/* Build a row of per-day journal buttons (used for both the top and bottom bar). */
function buildDayBar(container, weekDates, kind) {
  container.innerHTML = "";
  const corner = document.createElement("div");
  corner.className = "cal-corner";
  container.appendChild(corner);

  weekDates.forEach(function (d) {
    const ds = dateKey(d);
    const cell = document.createElement("div");
    cell.className = "cal-bar-cell";

    const btn = document.createElement("button");
    const has = (kind === "morning") ? hasMorning(ds) : hasDaily(ds);
    btn.className = "journal-day-btn" + (has ? " has-entry" : "");
    btn.textContent = (has ? "\u2713 " : "") + (kind === "morning" ? "Morning" : "Evening");
    btn.addEventListener("click", function () {
      if (kind === "morning") openMorning(ds);
      else openDailyJournal(ds);
    });

    cell.appendChild(btn);
    container.appendChild(cell);
  });
}

/* Build a marker for a cluster of timed to-dos: their dots together,
   then a line. Clicking a dot opens that to-do; the line opens the first. */
function buildTodoMarker(group) {
  // The marker sits at the EARLIEST due time among the clustered items.
  const first = group.reduce(function (a, b) {
    return timeToMinutes(a.dueTime) <= timeToMinutes(b.dueTime) ? a : b;
  });
  const top = timeToMinutes(first.dueTime) / 60 * HOUR_HEIGHT;

  const marker = document.createElement("div");
  marker.className = "cal-todo-marker";
  marker.style.top = top + "px";
  marker.title = group.map(function (t) { return t.dueTime + "  " + t.title; }).join("\n");

  const dots = document.createElement("span");
  dots.className = "cal-todo-dots";
  group.forEach(function (t) {
    const dot = document.createElement("span");
    dot.className = "cal-todo-dot" + (t.done ? " done" : "");
    dot.style.background = categoryColor(todoCat(t));
    dot.title = t.dueTime + " \u2014 " + t.title;
    dot.addEventListener("click", function (e) {
      e.stopPropagation();
      if (typeof openTodo === "function") openTodo(t.id);
    });
    dots.appendChild(dot);
  });
  marker.appendChild(dots);

  const rule = document.createElement("span");
  rule.className = "cal-todo-rule";
  // Rightmost dot = the latest item; match the line to it.
  const last = group.reduce(function (a, b) {
    return timeToMinutes(a.dueTime) >= timeToMinutes(b.dueTime) ? a : b;
  });
  rule.style.background = categoryColor(todoCat(last));
  rule.addEventListener("click", function (e) {
    e.stopPropagation();
    if (typeof openTodo === "function") openTodo(last.id);
  });
  marker.appendChild(rule);

  marker.addEventListener("pointerdown", function (e) { e.stopPropagation(); }); // don't drag-create
  return marker;
}

/* Build one positioned event block, sized to its share of the column width. */
function buildEventBlock(ev, left, width) {
  const startMin = timeToMinutes(ev.start);
  const endMin = Math.max(startMin + 15, timeToMinutes(ev.end)); // keep it visible

  const heightPx = (endMin - startMin) / 60 * HOUR_HEIGHT;
  const short = heightPx < 32; // not enough room for both lines -> title wins
  const narrow = width < 0.99; // sharing the column with an overlapping event

  const block = document.createElement("div");
  block.className = "cal-event" +
    (short ? " cal-event--short" : "") +
    (narrow ? " cal-event--narrow" : "");
  block.style.top = (startMin / 60 * HOUR_HEIGHT) + "px";
  block.style.height = ((endMin - startMin) / 60 * HOUR_HEIGHT) + "px";
  block.style.left = "calc(" + (left * 100) + "% + 1px)";
  block.style.width = "calc(" + (width * 100) + "% - 2px)";
  block.style.background = categoryColor(ev.category);

  // Figure out how many title lines fit, so the title can clamp with an
  // ellipsis ("Wake up…") instead of clipping a line through its middle.
  // The title is sized against the FULL height and rounded to the nearest
  // line, so a long title takes priority — it claims the available lines and
  // pushes the time out. The time only shows when the title is short enough
  // to leave room beneath it.
  const titleLinePx = (narrow ? 0.68 : 0.75) * 16 * (narrow ? 1.15 : 1.2);
  const padY = short ? 2 : 6; // matches the top+bottom padding for each case
  const titleLines = Math.max(1, Math.round((heightPx - padY) / titleLinePx));
  block.style.setProperty("--clamp", titleLines);

  block.innerHTML =
    '<span class="cal-event-title">' + escapeHtml(ev.title || "(untitled)") + "</span>" +
    (short ? "" : '<span class="cal-event-time">' + ev.start + "\u2013" + ev.end + "</span>") +
    (!short && ev.notes ? '<span class="cal-event-notes">' + escapeHtml(ev.notes) + "</span>" : "");

  block.addEventListener("pointerdown", function (e) { e.stopPropagation(); }); // not a drag-create
  block.addEventListener("click", function (e) {
    e.stopPropagation();
    if (suppressEventClick) { suppressEventClick = false; return; } // just finished a resize
    openModal(ev);
  });

  // Press and hold the title to move the event to a different time.
  addTitleDrag(block, ev);

  // Drag a corner to change the time frame — top corners move the start,
  // bottom corners move the end. Using corners (not the whole edge) keeps the
  // middle of the block clickable, so opening the event still works even when
  // it's small; hence no minimum-size limit is needed.
  ["top", "bottom"].forEach(function (edge) {
    ["left", "right"].forEach(function (side) {
      addResizeHandle(block, ev, edge, side);
    });
  });
  return block;
}

/* Press and hold an event's title, then drag to move it. The hold delay is what
   keeps a plain click free to open the event. Dragging up/down changes the
   start time (the duration comes along unchanged); dragging sideways moves it
   to another day. */
const HOLD_MS = 200;

/* The day column under a given screen x, if any. */
function columnAtX(x) {
  const cols = document.querySelectorAll("#calGrid .cal-col");
  for (let i = 0; i < cols.length; i++) {
    const r = cols[i].getBoundingClientRect();
    if (x >= r.left && x <= r.right) return cols[i];
  }
  return null;
}

function addTitleDrag(block, ev) {
  const title = block.querySelector(".cal-event-title");
  if (!title) return;
  title.classList.add("cal-event-grab");

  title.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    if (e.pointerType === "touch") return; // touch needs this gesture for scrolling
    if (!block.parentNode) return;

    const startMin0 = timeToMinutes(ev.start);
    const dur = Math.max(15, timeToMinutes(ev.end) - startMin0);
    const y0 = e.clientY;
    let start = startMin0;
    let date = ev.date;
    let dragging = false;

    const holdTimer = setTimeout(function () {
      dragging = true;
      block.classList.add("cal-event-moving");
    }, HOLD_MS);

    function onMove(me) {
      if (!dragging) return; // still inside the hold delay

      // Sideways: hop into whichever day is under the cursor. Moving the block
      // into that column is also the preview — it takes the full width there,
      // since any overlap is only recalculated on the re-render at drop.
      const col = columnAtX(me.clientX);
      if (col && col !== block.parentNode) {
        col.appendChild(block);
        date = col.dataset.date;
        block.style.left = "1px";
        block.style.width = "calc(100% - 2px)";
      }

      // Up/down: shift the start, carrying the duration with it.
      const snapped = Math.round((startMin0 + (me.clientY - y0)) / 15) * 15;
      const ns = Math.max(0, Math.min(24 * 60 - dur, snapped)); // can't run off the day
      if (ns === start) return;
      start = ns;
      block.style.top = (start / 60 * HOUR_HEIGHT) + "px";
      const t = block.querySelector(".cal-event-time");
      if (t) t.textContent = minutesToTime(start) + "\u2013" + minutesToTime(start + dur);
    }

    function onUp() {
      clearTimeout(holdTimer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      block.classList.remove("cal-event-moving");

      // Released during the hold, or held still without moving: that's a click,
      // so leave it alone and let the block's click handler open the event.
      if (!dragging || (start === startMin0 && date === ev.date)) return;

      const all = getEvents();
      const target = all.find(function (x) { return x.id === ev.id; });
      if (target) {
        target.start = minutesToTime(start);
        target.end = minutesToTime(start + dur);
        target.date = date;
        saveEvents(all);
      }
      suppressEventClick = true; // the drag shouldn't also open the modal
      setTimeout(function () { suppressEventClick = false; }, 0);
      renderCalendar();
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

/* A small grab square in one corner of an event; dragging it moves that edge
   (the start for a top corner, the end for a bottom corner) in 15-min steps. */
function addResizeHandle(block, ev, edge, side) {
  const handle = document.createElement("div");
  handle.className = "cal-resize cal-resize-" + edge + " cal-resize-" + side;

  handle.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    if (e.pointerType === "touch") return; // corners are too small to grab on touch
    e.stopPropagation();   // don't trigger drag-create or the block's click
    e.preventDefault();
    const col = block.parentNode;
    if (!col) return;
    const rect = col.getBoundingClientRect();

    let start = timeToMinutes(ev.start);
    let end = Math.max(start + 15, timeToMinutes(ev.end));
    let moved = false;

    function apply() {
      block.style.top = (start / 60 * HOUR_HEIGHT) + "px";
      block.style.height = ((end - start) / 60 * HOUR_HEIGHT) + "px";
      const t = block.querySelector(".cal-event-time");
      if (t) t.textContent = minutesToTime(start) + "\u2013" + minutesToTime(end);
    }
    function onMove(me) {
      const m = snap15(me.clientY - rect.top, "round");
      if (edge === "top") {
        const ns = Math.max(0, Math.min(end - 15, m));      // keep >=15 min tall
        if (ns !== start) { start = ns; moved = true; apply(); }
      } else {
        const ne = Math.min(24 * 60, Math.max(start + 15, m));
        if (ne !== end) { end = ne; moved = true; apply(); }
      }
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (moved) {
        const all = getEvents();
        const target = all.find(function (x) { return x.id === ev.id; });
        if (target) {
          target.start = minutesToTime(start);
          target.end = minutesToTime(end);
          saveEvents(all);
        }
        suppressEventClick = true;
        setTimeout(function () { suppressEventClick = false; }, 0);
        renderCalendar();
      } else {
        openModal(ev); // a click on the edge (no drag) just opens the event
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });

  block.appendChild(handle);
}

/* Lay out a day's events into side-by-side columns, each expanded to take as
   much width as it can. Returns [{ ev, left, width }] with 0-1 fractions. */
function layoutDayEvents(events) {
  const items = events.map(function (ev) {
    return {
      ev: ev,
      start: timeToMinutes(ev.start),
      end: Math.max(timeToMinutes(ev.start) + 15, timeToMinutes(ev.end))
    };
  }).sort(function (a, b) { return a.start - b.start || a.end - b.end; });

  const out = [];
  let group = [];
  let groupEnd = -1;

  function flush() {
    const cols = [];
    group.forEach(function (it) {
      let placed = false;
      for (let c = 0; c < cols.length; c++) {
        const col = cols[c];
        if (col[col.length - 1].end <= it.start) { col.push(it); it.col = c; placed = true; break; }
      }
      if (!placed) { it.col = cols.length; cols.push([it]); }
    });
    const n = cols.length;
    group.forEach(function (it) {
      let span = 1;
      for (let c = it.col + 1; c < n; c++) {
        const clash = cols[c].some(function (o) { return o.start < it.end && it.start < o.end; });
        if (clash) break;
        span++;
      }
      out.push({ ev: it.ev, left: it.col / n, width: span / n });
    });
    group = [];
    groupEnd = -1;
  }

  items.forEach(function (it) {
    if (group.length && it.start >= groupEnd) flush();
    group.push(it);
    groupEnd = Math.max(groupEnd, it.end);
  });
  if (group.length) flush();
  return out;
}

/* Group timed to-dos whose due times are within `gapMin` of the previous. */
function clusterTodos(list, gapMin) {
  const clusters = [];
  let cur = [];
  list.forEach(function (t) {
    if (cur.length === 0) { cur = [t]; return; }
    const prev = cur[cur.length - 1];
    if (timeToMinutes(t.dueTime) - timeToMinutes(prev.dueTime) <= gapMin) cur.push(t);
    else { clusters.push(cur); cur = [t]; }
  });
  if (cur.length) clusters.push(cur);
  return clusters;
}

/* Press-drag-release on a column to sketch a new event in 15-min steps. */
function enableDragCreate(col, ds) {
  col.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return; // primary button only
    // On touch, a drag across the grid is how you scroll the page, so creating
    // by dragging would fight scrolling. Use the "+" button there instead.
    if (e.pointerType === "touch") return;
    const rect = col.getBoundingClientRect();
    const startMin = clampMin(snap15(e.clientY - rect.top, "floor"));
    let endMin = Math.min(24 * 60, startMin + 15);
    let moved = false;

    const prov = document.createElement("div");
    prov.className = "cal-event provisional";
    col.appendChild(prov);
    paint();

    function paint() {
      prov.style.top = (startMin / 60 * HOUR_HEIGHT) + "px";
      prov.style.height = ((endMin - startMin) / 60 * HOUR_HEIGHT) + "px";
      prov.textContent = minutesToTime(startMin) + " \u2013 " + minutesToTime(endMin);
    }
    function onMove(ev) {
      const cur = clampMin(snap15(ev.clientY - rect.top, "round"));
      const ne = Math.max(startMin + 15, cur);
      if (ne !== endMin) { endMin = ne; moved = true; paint(); }
    }
    function onUp() {
      col.removeEventListener("pointermove", onMove);
      col.removeEventListener("pointerup", onUp);
      try { col.releasePointerCapture(e.pointerId); } catch (_) {}
      if (prov.parentNode) prov.parentNode.removeChild(prov);
      const finalEnd = moved ? endMin : Math.min(24 * 60, startMin + 60); // a click = 1 hour
      openModal({ date: ds, start: minutesToTime(startMin), end: minutesToTime(finalEnd) });
    }

    try { col.setPointerCapture(e.pointerId); } catch (_) {}
    col.addEventListener("pointermove", onMove);
    col.addEventListener("pointerup", onUp);
  });
}

function snap15(y, mode) {
  const m = y / HOUR_HEIGHT * 60;
  const r = (mode === "floor") ? Math.floor(m / 15) : Math.round(m / 15);
  return r * 15;
}
function clampMin(m) { return Math.max(0, Math.min(24 * 60 - 15, m)); }

/* Accept a to-do or goal dragged from the Suggestions panel. While dragging,
   show a 1-hour preview sliver that tracks the cursor; drop opens a new
   1-hour event pre-filled with that item's title. */
function enableDropCreate(col, ds) {
  let preview = null;

  function showPreview(y) {
    const startMin = clampMin(snap15(y, "round"));
    if (!preview) {
      preview = document.createElement("div");
      preview.className = "cal-event drop-preview";
      col.appendChild(preview);
    }
    const endMin = Math.min(24 * 60, startMin + 60);
    preview.style.top = (startMin / 60 * HOUR_HEIGHT) + "px";
    preview.style.height = ((endMin - startMin) / 60 * HOUR_HEIGHT) + "px";
    preview.textContent = minutesToTime(startMin) + " \u2013 " + minutesToTime(endMin);
  }
  function clearPreview() {
    if (preview && preview.parentNode) preview.parentNode.removeChild(preview);
    preview = null;
  }

  col.addEventListener("dragover", function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    showPreview(e.clientY - col.getBoundingClientRect().top);
  });
  col.addEventListener("dragleave", function (e) {
    // Ignore leaves that are really just moving onto a child of this column.
    if (e.relatedTarget && col.contains(e.relatedTarget)) return;
    clearPreview();
  });
  col.addEventListener("drop", function (e) {
    e.preventDefault();
    const startMin = clampMin(snap15(e.clientY - col.getBoundingClientRect().top, "round"));
    clearPreview();
    let data;
    try { data = JSON.parse(e.dataTransfer.getData("text/plain")); } catch (_) { return; }
    if (!data) return;
    const endMin = Math.min(24 * 60, startMin + 60); // default one hour
    openModal({
      date: ds,
      start: minutesToTime(startMin),
      end: minutesToTime(endMin),
      title: data.title || "",
      category: data.category || undefined
    });
  });
}

/* ============================================================
   The add / edit modal
   ============================================================ */
const overlay = document.getElementById("modalOverlay");

/* Fill the event form's category dropdown from the (editable) category list. */
function populateCategorySelect(selectedId) {
  const sel = document.getElementById("evtCategory");
  sel.innerHTML = "";
  const cats = getCategories();
  cats.forEach(function (c) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    if (c.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  });
  // If the saved category was deleted (or none was given), fall back to the first.
  if (!cats.some(function (c) { return c.id === selectedId; }) && cats[0]) {
    sel.value = cats[0].id;
  }
  paintCategorySelect(sel);
  sel.onchange = function () { paintCategorySelect(sel); };
}

function openModal(data) {
  editingId = data.id || null;
  document.getElementById("modalTitle").textContent = editingId ? "Edit event" : "New event";
  document.getElementById("evtTitle").value = data.title || "";
  document.getElementById("evtDate").value = data.date || dateKey(new Date());
  document.getElementById("evtNotes").value = data.notes || "";
  document.getElementById("evtStart").value = data.start || "09:00";
  document.getElementById("evtEnd").value = data.end || "10:00";
  populateCategorySelect(data.category);

  // Repeat is only offered when creating a brand-new event; editing always
  // affects just this one occurrence.
  document.getElementById("repeatField").style.display = editingId ? "none" : "";
  if (!editingId) document.getElementById("evtRepeat").value = "0";

  setupScaleField(document.getElementById("feelField"), data.feel);
  document.getElementById("deleteEvent").style.display = editingId ? "inline-block" : "none";
  overlay.classList.add("open");
  document.getElementById("evtTitle").focus();
}

function closeModal() {
  overlay.classList.remove("open");
  editingId = null;
}

function handleSave() {
  const fields = {
    title: document.getElementById("evtTitle").value.trim(),
    date: document.getElementById("evtDate").value,
    notes: document.getElementById("evtNotes").value.trim(), // stored, not shown yet
    start: document.getElementById("evtStart").value,
    end: document.getElementById("evtEnd").value,
    category: document.getElementById("evtCategory").value,
    feel: readScale("scaleFeel")
  };

  if (!fields.date || !fields.start || !fields.end) {
    alert("Please set a date, start time, and end time.");
    return;
  }
  if (timeToMinutes(fields.end) <= timeToMinutes(fields.start)) {
    alert("End time must be after start time.");
    return;
  }

  let events = getEvents();

  if (editingId) {
    // Editing only ever changes this single occurrence.
    events = events.map(function (e) {
      return e.id === editingId ? Object.assign({}, e, fields) : e;
    });
  } else {
    const repeatN = parseInt(document.getElementById("evtRepeat").value, 10) || 0;
    if (repeatN >= 1) {
      events = events.concat(expandSeries(fields, repeatN));
    } else {
      events.push(Object.assign({ id: uid("evt") }, fields));
    }
  }

  saveEvents(events);
  closeModal();
  renderCalendar();
}

/* Create one event per occurrence from the start date up to the horizon,
   all sharing a seriesId so "delete all future" can find them later.
   `step` is the gap in days between occurrences.
   feel is reset to null per occurrence — you can't have felt a future repeat. */
function expandSeries(fields, step) {
  const seriesId = uid("ser");
  const out = [];
  let d = new Date(fields.date + "T00:00:00");
  const end = addDays(d, RECUR_HORIZON_DAYS);
  while (d <= end) {
    out.push(Object.assign({}, fields, {
      id: uid("evt") + "-" + out.length,
      date: dateKey(d),
      feel: null,
      seriesId: seriesId,
      repeat: step
    }));
    d = addDays(d, step);
  }
  return out;
}

function handleDelete() {
  if (!editingId) return;
  const ev = getEvents().find(function (e) { return e.id === editingId; });
  if (!ev) { closeModal(); return; }

  if (ev.seriesId) {
    // Recurring -> ask whether to remove one or all future occurrences.
    pendingDelete = ev;
    overlay.classList.remove("open");
    document.getElementById("recurDeleteOverlay").classList.add("open");
  } else {
    saveEvents(getEvents().filter(function (e) { return e.id !== editingId; }));
    closeModal();
    renderCalendar();
  }
}

function deleteThisOnly() {
  if (!pendingDelete) return;
  const id = pendingDelete.id;
  saveEvents(getEvents().filter(function (e) { return e.id !== id; }));
  finishRecurDelete();
}
function deleteThisAndFuture() {
  if (!pendingDelete) return;
  const sid = pendingDelete.seriesId;
  const from = pendingDelete.date; // YYYY-MM-DD sorts chronologically as text
  saveEvents(getEvents().filter(function (e) {
    return !(e.seriesId === sid && e.date >= from);
  }));
  finishRecurDelete();
}
function finishRecurDelete() {
  pendingDelete = null;
  document.getElementById("recurDeleteOverlay").classList.remove("open");
  closeModal();
  renderCalendar();
}

/* ============================================================
   Wire up the buttons
   ============================================================ */
document.getElementById("saveEvent").addEventListener("click", handleSave);
document.getElementById("deleteEvent").addEventListener("click", handleDelete);
document.getElementById("cancelEvent").addEventListener("click", closeModal);
overlay.addEventListener("click", function (e) {
  if (e.target === overlay) closeModal(); // click the dim background to close
});

document.getElementById("addEventBtn").addEventListener("click", function () {
  openModal({ date: dateKey(new Date()) });
});
document.getElementById("prevWeek").addEventListener("click", function () {
  currentWeekStart = addDays(currentWeekStart, -7);
  renderCalendar();
});
document.getElementById("nextWeek").addEventListener("click", function () {
  currentWeekStart = addDays(currentWeekStart, 7);
  renderCalendar();
});
document.getElementById("todayBtn").addEventListener("click", function () {
  currentWeekStart = startOfWeek(new Date());
  renderCalendar();
});

/* ============================================================
   Categories editor
   ============================================================ */
const catOverlay = document.getElementById("catModalOverlay");
let catDraft = []; // working copy, only saved on "Done"

function openCategories() {
  catDraft = getCategories().map(function (c) { return Object.assign({}, c); });
  renderCatList();
  catOverlay.classList.add("open");
}
function renderCatList() {
  const list = document.getElementById("catList");
  list.innerHTML = "";
  catDraft.forEach(function (c, i) {
    const row = document.createElement("div");
    row.className = "cat-row";
    row.innerHTML =
      '<input type="color" class="cat-color" data-i="' + i + '" value="' + c.color + '">' +
      '<input type="text" class="cat-name" data-i="' + i + '" value="' + escapeHtml(c.name) + '">' +
      '<button type="button" class="btn cat-del" data-i="' + i + '">Remove</button>';
    list.appendChild(row);
  });
  list.querySelectorAll(".cat-del").forEach(function (b) {
    b.addEventListener("click", function () {
      readCatInputs();                       // keep edits in other rows
      catDraft.splice(Number(b.dataset.i), 1);
      renderCatList();
    });
  });
}
function readCatInputs() {
  const list = document.getElementById("catList");
  list.querySelectorAll(".cat-color").forEach(function (inp) {
    catDraft[Number(inp.dataset.i)].color = inp.value;
  });
  list.querySelectorAll(".cat-name").forEach(function (inp) {
    catDraft[Number(inp.dataset.i)].name = inp.value.trim() || "Untitled";
  });
}
function addCategoryRow() {
  readCatInputs();
  catDraft.push({ id: uid("cat"), name: "New category", color: "#64748b" });
  renderCatList();
}
function closeCategories() {
  readCatInputs();
  if (catDraft.length === 0) catDraft.push({ id: uid("cat"), name: "General", color: "#3b82f6" });
  saveCategories(catDraft);
  catOverlay.classList.remove("open");
  renderCalendar(); // event colours may have changed
}

document.getElementById("catBtn").addEventListener("click", openCategories);
document.getElementById("addCategory").addEventListener("click", addCategoryRow);
document.getElementById("closeCategories").addEventListener("click", closeCategories);
catOverlay.addEventListener("click", function (e) { if (e.target === catOverlay) closeCategories(); });

/* ============================================================
   Category filter (schedule) — a small popup of checkboxes; all on
   by default, and never persisted (reload = everything shown again).
   ============================================================ */
function renderFilterList() {
  const box = document.getElementById("filterList");
  if (!box) return;
  box.innerHTML = "";
  getCategories().forEach(function (cat) {
    const row = document.createElement("div");
    row.className = "filter-row";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !hiddenCategories.has(cat.id);
    cb.title = "Show/hide this category";
    cb.addEventListener("change", function () {
      if (cb.checked) hiddenCategories.delete(cat.id);
      else hiddenCategories.add(cat.id);
      renderCalendar();
    });

    // Clicking the swatch/name "solos" this category (and toggles back to all).
    const solo = document.createElement("span");
    solo.className = "filter-solo";
    solo.title = "Show only this category";
    solo.addEventListener("click", function () { soloCategory(cat.id); });

    const sw = document.createElement("span");
    sw.className = "filter-swatch";
    sw.style.background = cat.color;

    const name = document.createElement("span");
    name.className = "filter-name";
    name.textContent = cat.name;

    solo.appendChild(sw);
    solo.appendChild(name);
    row.appendChild(cb);
    row.appendChild(solo);
    box.appendChild(row);
  });
}

/* Show only this category. If it's already the only one shown, restore all —
   so the same click toggles cleanly between "just this" and "everything". */
function soloCategory(catId) {
  const cats = getCategories();
  const shown = cats.filter(function (c) { return !hiddenCategories.has(c.id); });
  const isSolo = shown.length === 1 && shown[0].id === catId;

  if (isSolo) {
    hiddenCategories.clear();
  } else {
    hiddenCategories = new Set(
      cats.filter(function (c) { return c.id !== catId; }).map(function (c) { return c.id; })
    );
  }
  renderFilterList();
  renderCalendar();
}

function openFilterPanel() {
  renderFilterList();
  const p = document.getElementById("filterPanel");
  if (p) p.hidden = false;
  document.getElementById("filterBtn").classList.add("active");
}
function closeFilterPanel() {
  const p = document.getElementById("filterPanel");
  if (p) p.hidden = true;
  const b = document.getElementById("filterBtn");
  if (b) b.classList.remove("active");
}

document.getElementById("filterBtn").addEventListener("click", function (e) {
  e.stopPropagation();
  const p = document.getElementById("filterPanel");
  if (p && p.hidden) openFilterPanel(); else closeFilterPanel();
});
document.getElementById("filterAll").addEventListener("click", function () {
  hiddenCategories.clear();
  renderFilterList();
  renderCalendar();
});
// The panel stays put while you use the rest of the page — notably the
// Suggestions panel — so you can filter and browse at the same time. It closes
// on the Filter button again, or on a click in the schedule grid itself.
document.addEventListener("click", function (e) {
  const panel = document.getElementById("filterPanel");
  if (!panel || panel.hidden) return;
  if (panel.contains(e.target) || e.target.closest("#filterBtn")) return;
  if (e.target.closest("#calGrid")) closeFilterPanel();
});

/* Recurring-delete prompt */
document.getElementById("delThisOnly").addEventListener("click", deleteThisOnly);
document.getElementById("delThisFuture").addEventListener("click", deleteThisAndFuture);
document.getElementById("delCancel").addEventListener("click", function () {
  document.getElementById("recurDeleteOverlay").classList.remove("open");
  pendingDelete = null;
  overlay.classList.add("open"); // back to the event modal
});

/* ============================================================
   First render, then scroll the grid down to ~7 AM
   ============================================================ */
onAppReady(function () {
  renderCalendar();
  // Scroll to ~7 AM. This has to happen after the grid is drawn, otherwise
  // there's nothing tall enough to scroll yet.
  const scroller = document.querySelector(".cal-scroll");
  if (scroller) scroller.scrollTop = 7 * HOUR_HEIGHT;
});
