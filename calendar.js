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
let autoCatTitle = null;   // title we last auto-set a category for (create mode)
let pendingDelete = null;
let addEventBtnEl = null; // moved into the calendar's corner each render

/* Category filter for the schedule. Holds the ids of categories that are
   hidden. In-memory only (not saved), so every reload starts with all
   categories shown. */
let hiddenCategories = new Set();
let hiddenSubcategories = new Set();   // subcategory ids that are hidden
let expandedFilterCats = new Set();    // which category rows are expanded in the filter

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
  // Clear any leftover drag-create ghost so it can't linger behind the modal.
  document.querySelectorAll(".cal-event.provisional").forEach(function (p) {
    if (p.parentNode) p.parentNode.removeChild(p);
  });
  header.innerHTML = "";
  grid.innerHTML = "";

  // Narrow screens show a 4-day window; wider screens show the full 7.
  const dayCount = visibleDayCount();
  const weekDates = [];
  for (let i = 0; i < dayCount; i++) weekDates.push(addDays(currentWeekStart, i));
  grid.style.setProperty("--day-count", dayCount);

  // Title like "June 2026" — use the window's midpoint so the dominant month shows.
  const mid = addDays(currentWeekStart, Math.floor(dayCount / 2));
  document.getElementById("weekLabel").textContent =
    mid.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const todayKey = logicalDayKey(new Date());

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
    // "Task" items are intentions, not commitments, so they stay off the grid.
    // Completed deadlines are removed from the calendar entirely (not faded).
    const untimed = todos.filter(function (t) {
      return t.due === ds && !t.dueTime && todoIsDeadline(t) && !t.done;
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
  const startH = getDayStartHour();
  for (let i = 0; i < 24; i++) {
    const label = document.createElement("div");
    label.className = "cal-hour-label";
    label.style.height = HOUR_HEIGHT + "px";
    label.textContent = formatHour((startH + i) % 24);
    gutter.appendChild(label);
  }
  grid.appendChild(gutter);

  let events = getEvents();
  // Fold in the live preview: hide the saved copy of whatever's being edited,
  // then add the in-progress version so the grid reflects the open modal.
  if (previewEvent) {
    events = events.filter(function (e) { return e.id !== previewEvent.id; }).concat(previewEvent);
  }

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
    // Bucket by LOGICAL day: with a non-midnight start hour, an early-morning
    // event belongs to (and renders at the bottom of) the previous day.
    const dayEvents = events.filter(function (ev) {
      if (isFilteredOut(ev.category, ev.subcategory)) return false;
      return logicalDayKeyFor(ev.date, timeToMinutes(ev.start)) === ds;
    });
    layoutDayEvents(dayEvents).forEach(function (it) {
      col.appendChild(buildEventBlock(it.ev, it.left, it.width));
    });

    // Timed to-dos: cluster ones within ~10 min so their dots sit together.
    const timed = todos
      .filter(function (t) { return t.dueTime && !t.done && logicalDayKeyFor(t.due, timeToMinutes(t.dueTime)) === ds; })
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
  return gridMinutes(now.getHours() * 60 + now.getMinutes()) / 60 * HOUR_HEIGHT;
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
  const top = gridMinutes(timeToMinutes(first.dueTime)) / 60 * HOUR_HEIGHT;

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
    (narrow ? " cal-event--narrow" : "") +
    (ev.__preview ? " cal-event--preview" : "");
  block.style.top = (gridMinutes(startMin) / 60 * HOUR_HEIGHT) + "px";
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

  // The live preview is display-only — no click-to-open, drag, or resize.
  if (ev.__preview) {
    block.style.pointerEvents = "none";
    return block;
  }

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
  // The whole block is draggable (not just the title), so grabbing anywhere on
  // the event moves it. The resize handle at the bottom stops propagation, so
  // it still resizes rather than moving.
  block.classList.add("cal-event-grab");

  block.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    if (e.pointerType === "touch") return; // touch needs this gesture for scrolling
    if (!block.parentNode) return;
    if (e.target.closest(".cal-resize")) return; // resizing, not moving

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
    function onUp(upEv) {
      col.removeEventListener("pointermove", onMove);
      col.removeEventListener("pointerup", onUp);
      try { col.releasePointerCapture(e.pointerId); } catch (_) {}
      if (prov.parentNode) prov.parentNode.removeChild(prov);
      const finalEnd = moved ? endMin : Math.min(24 * 60, startMin + 60); // a click = 1 hour
      const colRect = col.getBoundingClientRect();
      // The provisional block's own on-screen rect gives the event's actual
      // vertical position, so the modal can open at the same height. It's about
      // to be removed, so read it before that.
      const slotTop = colRect.top + (startMin / 60 * HOUR_HEIGHT);
      const slotRect = {
        left: colRect.left, right: colRect.right,
        top: slotTop, bottom: slotTop + ((finalEnd - startMin) / 60 * HOUR_HEIGHT)
      };
      // startMin/finalEnd are GRID offsets; translate to real clock time and the
      // real calendar date (which may roll past midnight under a custom start).
      openModal({
        date: gridDateFor(ds, startMin),
        start: minutesToTime(gridToClock(startMin)),
        end: minutesToTime(gridToClock(finalEnd) === 0 ? 1440 : gridToClock(finalEnd)),
        avoidRect: slotRect   // open beside this slot, aligned to its height
      });
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

  function dragDuration() {
    const d = window.__dragDurationMin;
    return (typeof d === "number" && d > 0) ? d : 60;   // fall back to one hour
  }

  function showPreview(y) {
    const startMin = clampMin(snap15(y, "round"));
    if (!preview) {
      preview = document.createElement("div");
      preview.className = "cal-event drop-preview";
      col.appendChild(preview);
    }
    const endMin = Math.min(24 * 60, startMin + dragDuration());
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
    // Default the event length to the task's time estimate (estHours, which may
    // be fractional like 0.5 = 30 min). Fall back to one hour when there's none.
    let durMin = 60;
    if (data.estHours != null && data.estHours !== "" && !isNaN(parseFloat(data.estHours))) {
      durMin = Math.max(15, Math.round(parseFloat(data.estHours) * 60));
    }
    const endMin = Math.min(24 * 60, startMin + durMin);
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
/* The event modal shows categories as colour chips, not a dropdown. The
   picked id is held in a data attribute so the rest of the code can read it
   the same way it read the old <select>.value. Other modals still use the
   shared paintCategorySelect dropdown. */
function populateCategorySelect(selectedId, selectedSub) {
  const wrap = document.getElementById("evtCategory");
  const cats = getCategories();
  let chosen = cats.some(function (c) { return c.id === selectedId; })
    ? selectedId : (cats[0] ? cats[0].id : "");

  wrap.dataset.value = chosen;
  wrap.innerHTML = "";

  cats.forEach(function (c) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "cat-chip" + (c.id === chosen ? " selected" : "");
    chip.dataset.id = c.id;
    chip.style.setProperty("--chip", c.color);
    chip.setAttribute("role", "radio");
    chip.setAttribute("aria-checked", c.id === chosen ? "true" : "false");
    chip.innerHTML = '<span class="cat-dot"></span>' + escapeHtml(c.name);
    chip.onclick = function () {
      wrap.dataset.value = c.id;
      wrap.querySelectorAll(".cat-chip").forEach(function (b) {
        const on = b === chip;
        b.classList.toggle("selected", on);
        b.setAttribute("aria-checked", on ? "true" : "false");
      });
      // Changing the category resets the subcategory to "none".
      renderSubcategoryChips(c.id, "");
      // Keep the live calendar draft in sync with the new category colour.
      if (typeof updateEventPreview === "function") updateEventPreview();
    };
    wrap.appendChild(chip);
  });

  renderSubcategoryChips(chosen, selectedSub || "");
}

/* Show the subcategory chips for a category (hidden if it has none). "" = none. */
function renderSubcategoryChips(catId, selectedSub) {
  const wrap = document.getElementById("evtSubWrap");
  const row = document.getElementById("evtSubcategory");
  const subs = getSubcategories(catId);

  if (!subs.length) {
    wrap.hidden = true;
    row.dataset.value = "";
    row.innerHTML = "";
    return;
  }
  wrap.hidden = false;
  const chosen = subs.some(function (s) { return s.id === selectedSub; }) ? selectedSub : "";
  row.dataset.value = chosen;
  row.innerHTML = "";

  // A "None" chip first, so subcategory stays optional.
  const options = [{ id: "", name: "None" }].concat(subs);
  options.forEach(function (s) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "subchip" + (s.id === chosen ? " selected" : "");
    chip.dataset.id = s.id;
    chip.setAttribute("role", "radio");
    chip.setAttribute("aria-checked", s.id === chosen ? "true" : "false");
    chip.textContent = s.name;
    chip.onclick = function () {
      row.dataset.value = s.id;
      row.querySelectorAll(".subchip").forEach(function (b) {
        const on = b === chip;
        b.classList.toggle("selected", on);
        b.setAttribute("aria-checked", on ? "true" : "false");
      });
      if (typeof updateEventPreview === "function") updateEventPreview();
    };
    row.appendChild(chip);
  });
}

/* Reads the chosen category id — replaces the old select.value. */
function readEventCategory() {
  return document.getElementById("evtCategory").dataset.value || "";
}
/* Reads the chosen subcategory id ("" if none). */
function readEventSubcategory() {
  return document.getElementById("evtSubcategory").dataset.value || "";
}

function openModal(data) {
  editingId = data.id || null;
  document.getElementById("evtTitle").value = data.title || "";
  document.getElementById("evtDate").value = data.date || dateKey(new Date());
  document.getElementById("evtNotes").value = data.notes || "";
  if (typeof autoGrow === "function") autoGrow(document.getElementById("evtNotes"));
  document.getElementById("evtStart").value = data.start || "09:00";
  document.getElementById("evtEnd").value = data.end || "10:00";
  populateCategorySelect(data.category, data.subcategory);

  // Repeat is only offered when creating a brand-new event; editing always
  // affects just this one occurrence. Reset the collapsed/expanded state each
  // open, or the toggle stays hidden after you've opened it once.
  document.getElementById("repeatToggle").style.display = editingId ? "none" : "";
  document.getElementById("repeatToggle").hidden = false;   // show the "+ Repeat" toggle again
  document.getElementById("repeatField").hidden = true;     // collapse the panel
  if (!editingId) resetRepeat();

  // "How did it feel?" starts collapsed, so a quick schedule-ahead never sees
  // it — but it opens automatically when the event already has a rating (i.e.
  // you're editing something you logged).
  setupScaleField(document.getElementById("feelField"), data.feel);
  const hasFeel = data.feel != null;
  document.getElementById("feelField").hidden = !hasFeel;
  document.getElementById("feelToggle").hidden = hasFeel;

  document.getElementById("deleteEvent").style.display = editingId ? "inline-block" : "none";
  resetModalPosition();
  overlay.classList.add("open");
  autoCatTitle = null;      // fresh auto-category tracking per open
  positionBesideSlot(data.avoidRect);   // open beside the clicked slot, if any
  updateEventPreview();     // show it on the grid straight away
  document.getElementById("evtTitle").focus();
}

/* When an event is created by clicking a slot, open the box beside that slot
   (on whichever side has more room) instead of centered over it — so you can
   still see where it's landing. Skipped on narrow screens, where the modal is
   effectively full-width anyway. */
function positionBesideSlot(rect) {
  if (!rect) return;
  if (window.matchMedia("(max-width: 720px)").matches) return;

  const box = eventModal.getBoundingClientRect();
  const margin = 16;
  const spaceRight = window.innerWidth - rect.right;
  const spaceLeft = rect.left;

  let x;
  if (spaceRight >= box.width + margin) {
    x = rect.right + margin;                       // room on the right
  } else if (spaceLeft >= box.width + margin) {
    x = rect.left - box.width - margin;            // room on the left
  } else {
    return;                                        // no room either side: stay centered
  }
  // Line the modal up with the event vertically: centre it on the slot's
  // midpoint, then clamp so it stays fully on screen.
  const slotMid = rect.top + (rect.bottom - rect.top) / 2;
  let y = slotMid - box.height / 2;
  y = Math.max(12, Math.min(window.innerHeight - box.height - 12, y));

  // Switch the overlay to free-positioning (it's normally flex-centered).
  overlay.style.justifyContent = "flex-start";
  overlay.style.alignItems = "flex-start";
  eventModal.style.position = "fixed";
  eventModal.style.left = x + "px";
  eventModal.style.top = y + "px";
}

function closeModal() {
  overlay.classList.remove("open");
  resetModalPosition();     // undock + clear the schedule shift
  editingId = null;
  previewEvent = null;      // drop the live preview
  renderCalendar();
}

/* ---- Live preview ----
   While the modal is open, the event being typed is drawn on the schedule in
   real time. It's held in `previewEvent`, which renderCalendar() folds in
   alongside the saved events; editing an existing event hides the stored copy
   so you don't see it twice. */
let previewEvent = null;

function updateEventPreview() {
  if (!overlay.classList.contains("open")) { previewEvent = null; renderCalendar(); return; }
  const date = document.getElementById("evtDate").value;
  const start = document.getElementById("evtStart").value;
  const end = document.getElementById("evtEnd").value;

  // Only draw once it describes a real slot.
  if (!date || !start || !end || timeToMinutes(end) <= timeToMinutes(start)) {
    previewEvent = null;
    renderCalendar();
    return;
  }
  previewEvent = {
    id: editingId || "__preview",
    title: document.getElementById("evtTitle").value.trim(),
    date: date, start: start, end: end,
    category: readEventCategory(),
    subcategory: (typeof readEventSubcategory === "function" ? readEventSubcategory() : ""),
    notes: "", feel: null,
    __preview: true
  };

  // If the chosen date isn't in the week on screen, follow it there so the
  // preview is actually visible.
  const wkStart = dateKey(currentWeekStart);
  const wkEnd = dateKey(addDays(currentWeekStart, 6));
  if (date < wkStart || date > wkEnd) {
    currentWeekStart = startOfWeek(new Date(date + "T00:00:00"));
  }
  renderCalendar();
}

/* Reveal the feel slider (from the "+ How did it feel?" button). */
function showFeelField() {
  document.getElementById("feelField").hidden = false;
  document.getElementById("feelToggle").hidden = true;
}

/* ---- Repeat control ----
   A collapsible section (like the feel field) with three modes: Once, Every N
   days, or specific weekdays. The toggle label shows the current choice so you
   can tell it's set without opening it. */
let repeatMode = "none";           // "none" | "everyN" | "weekdays"
const repeatWeekdaysSet = new Set();

function resetRepeat() {
  repeatMode = "none";
  repeatWeekdaysSet.clear();
  document.getElementById("evtRepeat").value = "1";
  setRepeatMode("none");
  document.querySelectorAll("#dowPicker .dow-chip").forEach(function (c) {
    c.classList.remove("selected", "locked");
  });
  updateRepeatLabel();
}

function showRepeatField() {
  document.getElementById("repeatField").hidden = false;
  document.getElementById("repeatToggle").hidden = true;
}

function setRepeatMode(mode) {
  repeatMode = mode;
  document.querySelectorAll("#repeatModeSeg .seg-btn").forEach(function (b) {
    b.classList.toggle("active", b.dataset.mode === mode);
  });
  document.getElementById("repeatEveryN").hidden = (mode !== "everyN");
  document.getElementById("repeatWeekdays").hidden = (mode !== "weekdays");
  // "On days" must always include the day the event is on, so lock that chip.
  if (mode === "weekdays") lockEventWeekday();
  updateRepeatLabel();
}

/* The weekday of the event currently being created/edited (from its date). */
function eventWeekday() {
  const v = document.getElementById("evtDate").value;
  if (!v) return null;
  return new Date(v + "T00:00:00").getDay();   // 0=Sun..6=Sat
}

/* Ensure the event's own weekday is selected and shown as locked (can't be
   turned off — a weekday repeat has to include the day it starts on). */
function lockEventWeekday() {
  const wd = eventWeekday();
  document.querySelectorAll("#dowPicker .dow-chip").forEach(function (c) {
    const d = parseInt(c.dataset.dow, 10);
    const isLocked = (d === wd);
    c.classList.toggle("locked", isLocked);
    if (isLocked) { repeatWeekdaysSet.add(d); c.classList.add("selected"); }
  });
}

/* Keep the toggle button readable: "Repeat", "Every 3 days", "Mon, Wed, Fri". */
const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function updateRepeatLabel() {
  const label = document.getElementById("repeatToggleLabel");
  if (!label) return;
  if (repeatMode === "everyN") {
    const n = parseInt(document.getElementById("evtRepeat").value, 10) || 1;
    label.textContent = n === 1 ? "Every day" : "Every " + n + " days";
  } else if (repeatMode === "weekdays" && repeatWeekdaysSet.size) {
    label.textContent = Array.from(repeatWeekdaysSet).sort()
      .map(function (d) { return DOW_SHORT[d]; }).join(", ");
  } else {
    label.textContent = "Repeat";
  }
}

/* What the modal is currently asking for, as a plain object handleSave uses. */
function readRepeat() {
  if (repeatMode === "everyN") {
    return { mode: "everyN", step: Math.max(1, parseInt(document.getElementById("evtRepeat").value, 10) || 1) };
  }
  if (repeatMode === "weekdays" && repeatWeekdaysSet.size) {
    return { mode: "weekdays", days: Array.from(repeatWeekdaysSet).sort() };
  }
  return { mode: "none" };
}

function handleSave() {
  const fields = {
    title: document.getElementById("evtTitle").value.trim(),
    date: document.getElementById("evtDate").value,
    notes: document.getElementById("evtNotes").value.trim(), // stored, not shown yet
    start: document.getElementById("evtStart").value,
    end: document.getElementById("evtEnd").value,
    category: readEventCategory(),
    subcategory: readEventSubcategory(),
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
    const repeat = readRepeat();
    if (repeat.mode !== "none") {
      events = events.concat(expandSeries(fields, repeat));
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
/* Build the occurrences of a repeating event up to the horizon, all sharing a
   seriesId so "delete this and future" can find them. Two shapes of repeat:
     everyN    — every `step` days from the start date
     weekdays  — on the chosen days of the week, each week */
function expandSeries(fields, repeat) {
  const seriesId = uid("ser");
  const out = [];
  const start = new Date(fields.date + "T00:00:00");
  const end = addDays(start, RECUR_HORIZON_DAYS);

  function push(d) {
    out.push(Object.assign({}, fields, {
      id: uid("evt") + "-" + out.length,
      date: dateKey(d),
      feel: null,
      seriesId: seriesId,
      repeat: repeat            // store the rule, for future editing
    }));
  }

  if (repeat.mode === "weekdays") {
    const days = repeat.days || [];
    if (!days.length) { push(start); return out; }   // nothing picked -> just the one
    let d = new Date(start);
    while (d <= end) {
      if (days.indexOf(d.getDay()) !== -1) push(d);
      d = addDays(d, 1);
    }
  } else {
    const step = Math.max(1, repeat.step || 1);
    let d = new Date(start);
    while (d <= end) { push(d); d = addDays(d, step); }
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
document.getElementById("feelToggle").addEventListener("click", showFeelField);

// Notes grows to fit its content instead of scrolling on one line.
document.getElementById("evtNotes").addEventListener("input", function () {
  if (typeof autoGrow === "function") autoGrow(this);
});

/* As you type a title, if it matches an event you've made before, adopt that
   event's category automatically. When the name has been used with several
   categories, the most recent one wins. Only applies while creating (not
   editing) and not once you've manually picked a chip for this title. */
document.getElementById("evtTitle").addEventListener("input", function () {
  if (editingId) return;
  const title = this.value.trim().toLowerCase();
  if (!title) { autoCatTitle = null; return; }

  const matches = getEvents()
    .filter(function (e) { return (e.title || "").trim().toLowerCase() === title && e.category; });
  if (!matches.length) return;

  // Most recent: prefer the latest date, then latest start time.
  matches.sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (a.start || "") < (b.start || "") ? 1 : -1;
  });
  const cat = matches[0].category;
  const sub = matches[0].subcategory || "";

  // Only auto-apply if the user hasn't hand-picked a different chip for this
  // same title (so we don't fight their choice), then remember we set it.
  if (autoCatTitle === title) return;
  populateCategorySelect(cat, sub);
  autoCatTitle = title;
  updateEventPreview();
});

/* Repeat control wiring */
document.getElementById("repeatToggle").addEventListener("click", function () {
  showRepeatField();
  // Default to "Never" — the user picks Every/On-days deliberately.
  if (repeatMode !== "everyN" && repeatMode !== "weekdays") setRepeatMode("none");
});
document.querySelectorAll("#repeatModeSeg .seg-btn").forEach(function (b) {
  b.addEventListener("click", function () { setRepeatMode(b.dataset.mode); });
});
document.querySelectorAll("#dowPicker .dow-chip").forEach(function (chip) {
  chip.addEventListener("click", function () {
    const d = parseInt(chip.dataset.dow, 10);
    // The event's own weekday is locked on — it can't be toggled off.
    if (chip.classList.contains("locked")) return;
    if (repeatWeekdaysSet.has(d)) repeatWeekdaysSet.delete(d);
    else repeatWeekdaysSet.add(d);
    chip.classList.toggle("selected");
    updateRepeatLabel();
  });
});
document.getElementById("evtRepeat").addEventListener("input", updateRepeatLabel);

/* If the date changes while in "On days" mode, the locked weekday moves with
   it. Drop the old lock, then re-lock the new weekday. */
document.getElementById("evtDate").addEventListener("change", function () {
  if (repeatMode !== "weekdays") return;
  document.querySelectorAll("#dowPicker .dow-chip.locked").forEach(function (c) {
    c.classList.remove("locked");   // old locked day becomes a normal (still selected) chip
  });
  lockEventWeekday();
  updateRepeatLabel();
});

/* Live preview: any change to the fields that affect the block redraws it. */
["evtTitle", "evtDate", "evtStart", "evtEnd"].forEach(function (id) {
  const el = document.getElementById(id);
  el.addEventListener("input", updateEventPreview);
  el.addEventListener("change", updateEventPreview);
});
// Category chips redraw too (they're rebuilt each open, so delegate on the row).
document.getElementById("evtCategory").addEventListener("click", function (e) {
  if (e.target.closest(".cat-chip")) updateEventPreview();
});
overlay.addEventListener("click", function (e) {
  // Clicking the dim area (not the box) closes the editor — whether it's
  // centred or docked to the side. But ignore the click synthesized right at
  // the end of a drag-to-dock, which would otherwise close it instantly.
  if (justDraggedModal) { justDraggedModal = false; return; }
  if (e.target === overlay) closeModal();
});

/* ============================================================
   Draggable / dockable event modal.

   Grab the grip and move the box anywhere. Drag it past the right edge and
   it snaps into a side panel (backdrop off, calendar still usable); drag it
   back toward the middle to undock. Position resets each time it opens.
   ============================================================ */
const eventModal = document.getElementById("eventModal");
let dockedSide = null;   // null | "left" | "right"
let justDraggedModal = false;   // set at drag end to swallow the trailing click
// Remember which side panels were open before docking, so we can restore them.
let panelsBeforeDock = null;   // null | { filter:bool, suggest:bool }

/* Detect current open state of the two side panels. */
function filterIsOpen() {
  const p = document.getElementById("filterPanel");
  return !!(p && !p.hidden);
}
function suggestIsOpen() {
  const p = document.getElementById("suggestPanel");
  return !!(p && !p.hidden);
}
/* Close both side panels when the modal docks (they'd overlap the docked
   panel), remembering their state once so we can reopen them afterward. */
function stashAndClosePanels() {
  if (panelsBeforeDock === null) {
    panelsBeforeDock = { filter: filterIsOpen(), suggest: suggestIsOpen() };
  }
  if (typeof closeFilterPanel === "function") closeFilterPanel();
  if (typeof closeSuggest === "function") closeSuggest();
}
/* Reopen whichever panels were open before the modal docked. */
function restorePanels() {
  if (!panelsBeforeDock) return;
  const want = panelsBeforeDock;
  panelsBeforeDock = null;
  if (want.filter && typeof openFilterPanel === "function") openFilterPanel();
  if (want.suggest && typeof toggleSuggest === "function" && !suggestIsOpen()) toggleSuggest();
}

function resetModalPosition() {
  restorePanels();          // bring back any side panels we closed when docking
  dockedSide = null;
  overlay.classList.remove("docked", "docked-left", "docked-right");
  eventModal.classList.remove("docked", "docked-left", "docked-right");
  eventModal.style.left = "";
  eventModal.style.top = "";
  eventModal.style.position = "";
  // Restore the overlay's centered layout (beside-slot opens override it).
  overlay.style.justifyContent = "";
  overlay.style.alignItems = "";
  const sched = document.getElementById("view-schedule");
  if (sched) sched.classList.remove("modal-docked", "modal-docked-left", "modal-docked-right");
  document.body.classList.remove("hide-sidebar");
}

function dockModal(side) {
  dockedSide = side;
  stashAndClosePanels();   // both side panels would collide with the docked one
  // Clear any inline overlay positioning from a beside-slot open — inline styles
  // would otherwise beat the .docked-left/.docked-right rules and force the panel
  // to the wrong (left) side.
  overlay.style.justifyContent = "";
  overlay.style.alignItems = "";
  eventModal.style.position = "";
  overlay.classList.add("docked");
  overlay.classList.toggle("docked-left", side === "left");
  overlay.classList.toggle("docked-right", side === "right");
  eventModal.classList.add("docked");
  eventModal.classList.toggle("docked-left", side === "left");
  eventModal.classList.toggle("docked-right", side === "right");
  eventModal.style.left = "";
  eventModal.style.top = "";
  eventModal.style.position = "";   // let the overlay's flex justify-content place it (left/right)
  // Push the page content the other way so both stay visible. A right dock
  // shifts the schedule left (like Suggestions); a left dock shifts it right
  // AND hides the page's own sidebar, since the panel takes that side.
  const sched = document.getElementById("view-schedule");
  if (sched) {
    sched.classList.add("modal-docked");
    sched.classList.toggle("modal-docked-left", side === "left");
    sched.classList.toggle("modal-docked-right", side === "right");
  }
  document.body.classList.toggle("hide-sidebar", side === "left");
}
function undockModal() {
  restorePanels();          // side is freed up again, reopen what we closed
  dockedSide = null;
  overlay.classList.remove("docked", "docked-left", "docked-right");
  eventModal.classList.remove("docked", "docked-left", "docked-right");
  const sched = document.getElementById("view-schedule");
  if (sched) sched.classList.remove("modal-docked", "modal-docked-left", "modal-docked-right");
  document.body.classList.remove("hide-sidebar");
}

document.getElementById("modalGrip").addEventListener("pointerdown", function (e) {
  if (e.target.closest(".modal-x")) return;   // the close button isn't a drag handle
  e.preventDefault();

  const rect = eventModal.getBoundingClientRect();
  const offX = e.clientX - rect.left;
  const offY = e.clientY - rect.top;
  eventModal.classList.add("dragging");

  function onMove(me) {
    let x = me.clientX - offX;
    let y = me.clientY - offY;

    // Dock when the CURSOR enters an edge zone (a fraction of the screen width),
    // rather than waiting for the box's far edge to touch the screen edge — the
    // latter is nearly unreachable for a wide modal, which is why dragging right
    // used to never dock. Right zone -> right dock; left zone -> left dock.
    const edge = Math.min(140, window.innerWidth * 0.12);
    if (me.clientX >= window.innerWidth - edge) {
      if (dockedSide !== "right") dockModal("right");
      return;
    }
    if (me.clientX <= edge) {
      if (dockedSide !== "left") dockModal("left");
      return;
    }
    if (dockedSide) undockModal();

    // Keep it on screen.
    x = Math.max(6, Math.min(window.innerWidth - rect.width - 6, x));
    y = Math.max(6, Math.min(window.innerHeight - 44, y));
    eventModal.style.position = "fixed";
    eventModal.style.left = x + "px";
    eventModal.style.top = y + "px";
  }
  function onUp() {
    eventModal.classList.remove("dragging");
    if (dockedSide) justDraggedModal = true;   // swallow the click that follows a dock
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
});

document.getElementById("addEventBtn").addEventListener("click", function () {
  openModal({ date: dateKey(new Date()) });
});
/* How many days the schedule shows: 4 on a narrow screen, 7 otherwise. The
   breakpoint matches the CSS mobile breakpoint. */
function visibleDayCount() {
  return window.matchMedia("(max-width: 720px)").matches ? 4 : 7;
}

/* On mobile the 4-day window is anchored to a stable 7-day grid so the
   start-of-week day always shows (front of one window, back of the next), and
   paging alternates +4 then +3 days.

   The grid origin is today's week-start per the setting. For fixed weekdays
   (Sun/Mon) that origin sits on the repeating weekday grid, so alignment is by
   day-of-week. For the relative modes (today/yesterday/tomorrow) startOfWeek
   returns the anchor day itself, so the grid is anchored to today and repeats
   every 7 days from there — which still yields the +4/+3 cycle. */
function gridOrigin() {
  return startOfWeek(new Date());   // stable reference on the 7-day grid
}
function windowOffset(d) {
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day - gridOrigin()) / 86400000);
  return ((diff % 7) + 7) % 7;      // 0..6 position within the 7-day block
}
function alignedWindowStart(d) {
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const mod = windowOffset(day);
  const blockStart = addDays(day, -mod);          // start of this 7-day block
  return addDays(blockStart, mod < 4 ? 0 : 4);    // snap to offset 0 or 4
}
function stepWindow(start, dir) {
  const s = new Date(start); s.setHours(0, 0, 0, 0);
  const mod = windowOffset(s);                    // 0 or 4 for an aligned start
  if (dir > 0) return addDays(s, mod === 0 ? 4 : 3);   // 0->+4, 4->+3
  return addDays(s, mod === 0 ? -3 : -4);              // mirror going back
}

document.getElementById("prevWeek").addEventListener("click", function () {
  currentWeekStart = visibleDayCount() === 4
    ? stepWindow(currentWeekStart, -1)          // mobile: aligned 4-day window
    : addDays(currentWeekStart, -7);            // desktop: whole week
  renderCalendar();
});
document.getElementById("nextWeek").addEventListener("click", function () {
  currentWeekStart = visibleDayCount() === 4
    ? stepWindow(currentWeekStart, 1)
    : addDays(currentWeekStart, 7);
  renderCalendar();
});
document.getElementById("todayBtn").addEventListener("click", function () {
  // On mobile, land on the aligned window that contains today.
  currentWeekStart = visibleDayCount() === 4
    ? alignedWindowStart(new Date())
    : startOfWeek(new Date());
  renderCalendar();
});

/* Re-render when crossing the narrow/wide breakpoint so the day count and the
   window re-anchor cleanly (aligned 4-day window on mobile, full week on wide). */
window.matchMedia("(max-width: 720px)").addEventListener("change", function () {
  currentWeekStart = visibleDayCount() === 4
    ? alignedWindowStart(new Date())
    : startOfWeek(new Date());
  renderCalendar();
});

/* ============================================================
   Categories editor
   ============================================================ */
const catOverlay = document.getElementById("catModalOverlay");
let catDraft = []; // working copy, only saved on "Done"

function openCategories() {
  catDraft = getCategories().map(function (c) {
    return {
      id: c.id, name: c.name, color: c.color,
      subs: (Array.isArray(c.subs) ? c.subs : []).map(function (s) {
        return { id: s.id, name: s.name };
      })
    };
  });
  renderCatList();
  catOverlay.classList.add("open");
}
function renderCatList() {
  const list = document.getElementById("catList");
  list.innerHTML = "";
  catDraft.forEach(function (c, i) {
    if (!Array.isArray(c.subs)) c.subs = [];
    const block = document.createElement("div");
    block.className = "cat-block";

    let subsHtml = '<div class="cat-subs">';
    c.subs.forEach(function (s, si) {
      subsHtml +=
        '<div class="cat-sub-row">' +
          '<span class="cat-sub-bullet" style="background:' + c.color + '"></span>' +
          '<input type="text" class="cat-sub-name" data-i="' + i + '" data-si="' + si + '" value="' + escapeHtml(s.name) + '" placeholder="Subcategory">' +
          '<button type="button" class="cat-sub-del" data-i="' + i + '" data-si="' + si + '" title="Remove" aria-label="Remove subcategory">&times;</button>' +
        "</div>";
    });
    subsHtml += '<button type="button" class="btn btn-sm cat-sub-add" data-i="' + i + '">+ Add subcategory</button>';
    subsHtml += "</div>";

    block.innerHTML =
      '<div class="cat-row">' +
        '<input type="color" class="cat-color" data-i="' + i + '" value="' + c.color + '">' +
        '<input type="text" class="cat-name" data-i="' + i + '" value="' + escapeHtml(c.name) + '">' +
        '<button type="button" class="btn cat-del" data-i="' + i + '">Remove</button>' +
      "</div>" +
      subsHtml;
    list.appendChild(block);
  });

  // Remove a whole category.
  list.querySelectorAll(".cat-del").forEach(function (b) {
    b.addEventListener("click", function () {
      readCatInputs();
      catDraft.splice(Number(b.dataset.i), 1);
      renderCatList();
    });
  });
  // Add a subcategory to a category.
  list.querySelectorAll(".cat-sub-add").forEach(function (b) {
    b.addEventListener("click", function () {
      readCatInputs();
      const cat = catDraft[Number(b.dataset.i)];
      if (!Array.isArray(cat.subs)) cat.subs = [];
      cat.subs.push({ id: uid("sub"), name: "" });
      renderCatList();
      // Focus the new subcategory input.
      const inputs = document.querySelectorAll('.cat-sub-name[data-i="' + b.dataset.i + '"]');
      if (inputs.length) inputs[inputs.length - 1].focus();
    });
  });
  // Remove a subcategory.
  list.querySelectorAll(".cat-sub-del").forEach(function (b) {
    b.addEventListener("click", function () {
      readCatInputs();
      catDraft[Number(b.dataset.i)].subs.splice(Number(b.dataset.si), 1);
      renderCatList();
    });
  });
  // Live-update the subcategory bullet colour if the category colour changes.
  list.querySelectorAll(".cat-color").forEach(function (inp) {
    inp.addEventListener("input", function () {
      const block = inp.closest(".cat-block");
      block.querySelectorAll(".cat-sub-bullet").forEach(function (dot) {
        dot.style.background = inp.value;
      });
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
  list.querySelectorAll(".cat-sub-name").forEach(function (inp) {
    const cat = catDraft[Number(inp.dataset.i)];
    if (cat && cat.subs && cat.subs[Number(inp.dataset.si)]) {
      cat.subs[Number(inp.dataset.si)].name = inp.value.trim();
    }
  });
}
function addCategoryRow() {
  readCatInputs();
  catDraft.push({ id: uid("cat"), name: "New category", color: "#64748b", subs: [] });
  renderCatList();
}
function closeCategories() {
  readCatInputs();
  if (catDraft.length === 0) catDraft.push({ id: uid("cat"), name: "General", color: "#3b82f6", subs: [] });
  // Drop any blank subcategories so empty rows aren't persisted.
  catDraft.forEach(function (c) {
    if (Array.isArray(c.subs)) c.subs = c.subs.filter(function (s) { return (s.name || "").trim() !== ""; });
  });
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
/* An event/item is hidden if its whole category is hidden, or (when it has a
   subcategory) that specific subcategory is hidden. */
function isFilteredOut(catId, subId) {
  if (hiddenCategories.has(catId)) return true;
  if (subId && hiddenSubcategories.has(subId)) return true;
  return false;
}

function renderFilterList() {
  const box = document.getElementById("filterList");
  if (!box) return;
  box.innerHTML = "";
  getCategories().forEach(function (cat) {
    const subs = Array.isArray(cat.subs) ? cat.subs : [];
    const hasSubs = subs.length > 0;
    const expanded = expandedFilterCats.has(cat.id);

    const row = document.createElement("div");
    row.className = "filter-row";

    // Expand triangle (only if there are subcategories). Toggles children;
    // kept separate from the name so it doesn't clash with "solo".
    const tri = document.createElement("button");
    tri.type = "button";
    tri.className = "filter-tri" + (hasSubs ? "" : " filter-tri--empty") + (expanded ? " open" : "");
    tri.setAttribute("aria-label", expanded ? "Collapse" : "Expand");
    tri.textContent = hasSubs ? "\u25B8" : "";      // ▸
    if (hasSubs) {
      tri.addEventListener("click", function () {
        if (expandedFilterCats.has(cat.id)) expandedFilterCats.delete(cat.id);
        else expandedFilterCats.add(cat.id);
        renderFilterList();
      });
    }

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
    row.appendChild(tri);
    row.appendChild(cb);
    row.appendChild(solo);
    box.appendChild(row);

    // Subcategory child rows, when expanded.
    if (hasSubs && expanded) {
      subs.forEach(function (sub) {
        const srow = document.createElement("div");
        srow.className = "filter-row filter-subrow";

        const scb = document.createElement("input");
        scb.type = "checkbox";
        scb.checked = !hiddenSubcategories.has(sub.id) && !hiddenCategories.has(cat.id);
        scb.disabled = hiddenCategories.has(cat.id);   // whole category off = children moot
        scb.title = "Show/hide this subcategory";
        scb.addEventListener("change", function () {
          if (scb.checked) hiddenSubcategories.delete(sub.id);
          else hiddenSubcategories.add(sub.id);
          renderCalendar();
        });

        const ssolo = document.createElement("span");
        ssolo.className = "filter-solo";
        ssolo.title = "Show only this subcategory";
        ssolo.addEventListener("click", function () { soloSubcategory(cat.id, sub.id); });

        const sdot = document.createElement("span");
        sdot.className = "filter-subdot";
        sdot.style.background = cat.color;

        const sname = document.createElement("span");
        sname.className = "filter-name";
        sname.textContent = sub.name;

        ssolo.appendChild(sdot);
        ssolo.appendChild(sname);
        srow.appendChild(scb);
        srow.appendChild(ssolo);
        box.appendChild(srow);
      });
    }
  });
}

/* Show only this category. If it's already the only one shown, restore all. */
function soloCategory(catId) {
  const cats = getCategories();
  const shown = cats.filter(function (c) { return !hiddenCategories.has(c.id); });
  const isSolo = shown.length === 1 && shown[0].id === catId && hiddenSubcategories.size === 0;

  if (isSolo) {
    hiddenCategories.clear();
    hiddenSubcategories.clear();
  } else {
    hiddenCategories = new Set(
      cats.filter(function (c) { return c.id !== catId; }).map(function (c) { return c.id; })
    );
    hiddenSubcategories.clear();   // showing a whole category shows all its subs
  }
  renderFilterList();
  renderCalendar();
}

/* Show only this subcategory: hide every other category, and hide the sibling
   subcategories within this one. Toggles back to all if already soloed. */
function soloSubcategory(catId, subId) {
  const cats = getCategories();
  const parent = cats.find(function (c) { return c.id === catId; });
  const siblings = (parent && parent.subs) ? parent.subs : [];

  const onlyThisCat = cats.every(function (c) { return c.id === catId ? !hiddenCategories.has(c.id) : hiddenCategories.has(c.id); });
  const siblingsHidden = siblings.every(function (s) { return s.id === subId ? !hiddenSubcategories.has(s.id) : hiddenSubcategories.has(s.id); });
  const isSolo = onlyThisCat && siblingsHidden && siblings.length > 1;

  if (isSolo) {
    hiddenCategories.clear();
    hiddenSubcategories.clear();
  } else {
    hiddenCategories = new Set(
      cats.filter(function (c) { return c.id !== catId; }).map(function (c) { return c.id; })
    );
    hiddenSubcategories = new Set(
      siblings.filter(function (s) { return s.id !== subId; }).map(function (s) { return s.id; })
    );
  }
  if (!expandedFilterCats.has(catId)) expandedFilterCats.add(catId);
  renderFilterList();
  renderCalendar();
}

function openFilterPanel() {
  renderFilterList();
  const p = document.getElementById("filterPanel");
  if (p) p.hidden = false;
  document.getElementById("filterBtn").classList.add("active");
  const view = document.getElementById("view-schedule");
  if (view) view.classList.add("filter-open");   // drives the mobile drawer layout
  // On narrow screens there's only room for one drawer, so opening Filter
  // closes Suggestions. On wide screens both can be open at once.
  if (typeof isNarrow === "function" && isNarrow() &&
      typeof closeSuggest === "function") closeSuggest();
}
function closeFilterPanel() {
  const p = document.getElementById("filterPanel");
  if (p) p.hidden = true;
  const b = document.getElementById("filterBtn");
  if (b) b.classList.remove("active");
  const view = document.getElementById("view-schedule");
  if (view) view.classList.remove("filter-open");
}

document.getElementById("filterBtn").addEventListener("click", function (e) {
  e.stopPropagation();
  const p = document.getElementById("filterPanel");
  if (p && p.hidden) openFilterPanel(); else closeFilterPanel();
});
const filterCloseBottom = document.getElementById("filterCloseBottom");
if (filterCloseBottom) filterCloseBottom.addEventListener("click", closeFilterPanel);
document.getElementById("filterAll").addEventListener("click", function () {
  hiddenCategories.clear();
  hiddenSubcategories.clear();
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
