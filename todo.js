/* ============================================================
   todo.js — a week-at-a-time to-do board
   Each task has a due date and a category (shared with the schedule).
   Uses app.js (Store, dateKey, addDays, startOfWeek, getTodos,
   saveTodos, getCategories, categoryColor, uid, escapeHtml).
   The schedule shows a thin coloured line per task on its due day.
   ============================================================ */

const todoOverlay = document.getElementById("todoModalOverlay");
let todoWeekStart = startOfWeek(new Date()); // Sunday, to match the schedule
let editingTodoId = null;
/* Board filters. Each is "show this kind of card", all on by default, so the
   three buttons read the same way instead of mixing "only X" with "hide Y".
   Not persisted — a reload always shows everything. */
let todoShowDeadlines = true;
let todoShowDoOn = true;
let todoShowDone = true;
let todoKindValue = "deadline"; // which segmented button is active in the editor
let todoLinkId = null;         // the deadline the editor's "Part of" points at

/* ---- Render the 7-day board ---- */
function renderTodos() {
  const board = document.getElementById("todoBoard");
  if (!board) return;

  const days = [];
  for (let i = 0; i < 7; i++) days.push(addDays(todoWeekStart, i));

  const mid = addDays(todoWeekStart, 3); // midpoint -> the week's dominant month
  document.getElementById("tdWeekLabel").textContent =
    mid.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  board.innerHTML = "";
  const todos = getTodos();
  const todayKey = dateKey(new Date());

  days.forEach(function (d) {
    const ds = dateKey(d);
    const col = document.createElement("div");
    col.className = "todo-col" + (ds === todayKey ? " today" : "");
    col.innerHTML =
      '<div class="todo-col-head">' +
        '<span class="todo-dow">' + d.toLocaleDateString(undefined, { weekday: "short" }) + "</span> " +
        '<span class="todo-dom">' + d.getDate() + "</span>" +
      "</div>";

    const body = document.createElement("div");
    body.className = "todo-col-body";

    // Unchecked first, then done; within each, earlier due time first.
    const dayTodos = todos
      .filter(function (t) {
        if (t.due !== ds) return false;
        if (t.done && !todoShowDone) return false;
        return todoKind(t) === "deadline" ? todoShowDeadlines : todoShowDoOn;
      })
      .sort(function (a, b) {
        if ((a.done ? 1 : 0) !== (b.done ? 1 : 0)) return (a.done ? 1 : 0) - (b.done ? 1 : 0);
        return (a.dueTime || "99:99").localeCompare(b.dueTime || "99:99");
      });

    dayTodos.forEach(function (t) { body.appendChild(buildTodoCard(t)); });

    col.appendChild(body);

    // Click anywhere in the day that isn't a task -> new to-do prefilled to this day.
    col.addEventListener("click", function (e) {
      if (e.target.closest(".todo-card")) return; // let task clicks open that task
      openTodo(null, ds);
    });

    board.appendChild(col);
  });

  if (typeof refreshSuggest === "function") refreshSuggest();
}

function buildTodoCard(t) {
  const card = document.createElement("div");
  card.className = "todo-card todo-card--" + todoKind(t) + (t.done ? " done" : "");
  card.style.borderLeftColor = categoryColor(todoCategoryOf(t));

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = !!t.done;
  cb.addEventListener("click", function (e) { e.stopPropagation(); }); // don't open editor
  cb.addEventListener("change", function () { toggleTodo(t.id, cb.checked); });

  const title = document.createElement("span");
  title.className = "todo-title";
  title.textContent = t.title;

  const main = document.createElement("div");
  main.className = "todo-main";
  main.appendChild(title);

  const metaBits = [];
  if (t.dueTime) metaBits.push(formatTime12(t.dueTime));
  if (t.estHours != null && t.estHours !== "") metaBits.push("~" + t.estHours + "h");
  if (metaBits.length) {
    const meta = document.createElement("div");
    meta.className = "todo-meta";
    meta.textContent = metaBits.join(" \u00b7 ");
    main.appendChild(meta);
  }

  // A "do on" item that supports a deadline shows what it's working toward.
  // If the deadline was deleted the chip just doesn't render (no orphan text).
  if (todoKind(t) === "do" && t.linkedTo) {
    const parent = getTodos().find(function (x) { return x.id === t.linkedTo; });
    if (parent) {
      const chip = document.createElement("div");
      chip.className = "todo-link-chip";
      chip.title = "Part of: " + parent.title;

      // The arrow hangs in the left indent so the name and the due date below
      // it both start at the same column.
      const arrow = document.createElement("span");
      arrow.className = "todo-link-arrow";
      arrow.textContent = "\u2192";
      chip.appendChild(arrow);

      const name = document.createElement("div");
      name.className = "todo-link-name";
      name.textContent = parent.title;
      chip.appendChild(name);

      if (parent.due) {
        const when = document.createElement("div");
        when.className = "todo-link-due";
        when.textContent = "due " + shortDate(parent.due);
        chip.appendChild(when);
      }
      main.appendChild(chip);
    }
  }

  card.appendChild(cb);
  card.appendChild(main);
  card.addEventListener("click", function () { openTodo(t.id); });
  return card;
}

/* Two kinds of to-do:
     "deadline" — `due` (+ optional `dueTime`) is a hard deadline: be done BY then.
     "do"       — `due` is the day you plan to work on it; no time, and it can
                  point at a deadline via `linkedTo` (e.g. Outline -> Essay).
   In both cases `due` is simply the day the card sits on, which is why the
   board and the schedule's to-do lines needed no changes. To-dos saved before
   these types existed have no `kind`; they were all due-by items, so they read
   as deadlines and keep behaving exactly as they did. */
function todoKind(t) { return t.kind === "do" ? "do" : "deadline"; }

/* The category a to-do actually shows as. A "do on" item that's part of a
   deadline always follows that deadline's category, so the two can never drift
   apart — even if the deadline's category is changed later. */
function todoCategoryOf(t) {
  if (t && t.kind === "do" && t.linkedTo) {
    const parent = getTodos().find(function (x) { return x.id === t.linkedTo; });
    if (parent) return parent.category;
  }
  return t ? t.category : "";
}

/* "2026-09-05" -> "Sep 5" */
function shortDate(ds) {
  return new Date(ds + "T00:00:00")
    .toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* "14:30" -> "2:30 PM" */
function formatTime12(hhmm) {
  const parts = hhmm.split(":");
  let h = Number(parts[0]);
  const m = parts[1];
  const ampm = h < 12 ? "AM" : "PM";
  h = h % 12; if (h === 0) h = 12;
  return h + ":" + m + " " + ampm;
}

function toggleTodo(id, done) {
  const todos = getTodos();
  const t = todos.find(function (x) { return x.id === id; });
  if (!t) return;
  t.done = done;
  saveTodos(todos);
  renderTodos();
  if (typeof renderCalendar === "function") renderCalendar(); // update the line's "done" look
}

/* ---- Create / edit modal ---- */
function populateTodoCategories(selectedId) {
  const sel = document.getElementById("todoCategory");
  sel.innerHTML = "";
  const cats = getCategories();
  cats.forEach(function (c) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    if (c.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  });
  if (!cats.some(function (c) { return c.id === selectedId; }) && cats[0]) {
    sel.value = cats[0].id;
  }
  paintCategorySelect(sel);
  sel.onchange = function () { paintCategorySelect(sel); };
}

/* ---- "Part of" typeahead ----
   Type a few letters and matching deadlines appear; pick one to link it. The
   link is stored by id (not by name), so renaming a deadline keeps the link
   intact. */
/* Matching deadlines. An empty query lists them all, so clicking into the box
   shows what's available to browse; typing narrows it. */
function deadlineMatches(query) {
  const q = query.trim().toLowerCase();
  return getTodos()
    .filter(function (t) {
      return todoKind(t) === "deadline" &&
             t.id !== editingTodoId &&           // can't be part of itself
             (!q || t.title.toLowerCase().indexOf(q) !== -1);
    })
    .sort(function (a, b) { return (a.due || "").localeCompare(b.due || ""); })
    .slice(0, 8);
}

function renderLinkResults() {
  const box = document.getElementById("todoLinkResults");
  const list = deadlineMatches(document.getElementById("todoLink").value);
  box.innerHTML = "";

  if (!list.length) {
    box.innerHTML = '<div class="typeahead-empty">' +
      (getTodos().some(function (t) { return todoKind(t) === "deadline"; })
        ? "No matching deadline."
        : "No deadlines yet \u2014 create one first.") + "</div>";
    box.hidden = false;
    return;
  }
  list.forEach(function (t) {
    const item = document.createElement("div");
    item.className = "typeahead-item";
    item.textContent = t.title + (t.due ? " \u2014 due " + shortDate(t.due) : "");
    // mousedown fires before the input's blur, so the pick isn't lost.
    item.addEventListener("mousedown", function (e) {
      e.preventDefault();
      selectLink(t.id);
    });
    box.appendChild(item);
  });
  box.hidden = false;
}

function selectLink(id) {
  const t = getTodos().find(function (x) { return x.id === id; });
  todoLinkId = t ? id : null;
  document.getElementById("todoLink").value = t ? t.title : "";
  document.getElementById("todoLinkResults").hidden = true;
  applyLinkLock();
}

/* A linked item inherits its deadline's category, so show that category and
   lock the picker rather than letting the two drift apart. */
function applyLinkLock() {
  const sel = document.getElementById("todoCategory");
  const note = document.getElementById("todoCatNote");
  const parent = todoLinkId
    ? getTodos().find(function (x) { return x.id === todoLinkId; })
    : null;
  const locked = !!parent && todoKindValue === "do";

  if (locked) sel.value = parent.category;
  sel.disabled = locked;
  note.hidden = !locked;
  paintCategorySelect(sel);
}

/* Show only the fields that make sense for the chosen type. */
function setTodoKind(kind) {
  todoKindValue = (kind === "do") ? "do" : "deadline";
  const isDo = todoKindValue === "do";

  document.querySelectorAll("#todoKindSeg .seg-btn").forEach(function (b) {
    b.classList.toggle("active", b.dataset.kind === todoKindValue);
  });
  document.getElementById("todoDueLabel").textContent = isDo ? "Plan for" : "Due date";
  document.getElementById("todoTimeField").style.display = isDo ? "none" : "block";
  document.getElementById("todoLinkField").style.display = isDo ? "block" : "none";
  applyLinkLock(); // a deadline is never locked; a linked "do on" is
}

function openTodo(id, presetDate) {
  editingTodoId = id || null;
  const t = id ? getTodos().find(function (x) { return x.id === id; }) : null;

  document.getElementById("todoModalTitle").textContent = t ? "Edit to-do" : "New to-do";
  document.getElementById("todoTitle").value = t ? t.title : "";
  document.getElementById("todoDue").value = t ? t.due : (presetDate || dateKey(new Date()));
  document.getElementById("todoTime").value = t ? (t.dueTime || "") : "";
  document.getElementById("todoNotes").value = t ? (t.notes || "") : "";
  document.getElementById("todoEst").value = (t && t.estHours != null) ? t.estHours : "";
  populateTodoCategories(t ? t.category : (getCategories()[0] && getCategories()[0].id));

  // Restore the link (blank if its deadline was deleted), then the type —
  // setTodoKind applies the category lock once both are known.
  const parent = (t && t.linkedTo)
    ? getTodos().find(function (x) { return x.id === t.linkedTo; })
    : null;
  todoLinkId = parent ? parent.id : null;
  document.getElementById("todoLink").value = parent ? parent.title : "";
  document.getElementById("todoLinkResults").hidden = true;
  setTodoKind(t ? todoKind(t) : "deadline");
  document.getElementById("deleteTodo").style.display = t ? "inline-block" : "none";

  // "Mark as complete" only makes sense when editing an existing task.
  document.getElementById("todoDone").checked = t ? !!t.done : false;
  document.getElementById("todoDoneField").style.display = t ? "flex" : "none";

  todoOverlay.classList.add("open");
  document.getElementById("todoTitle").focus();
}

function closeTodo() {
  todoOverlay.classList.remove("open");
  editingTodoId = null;
}

function saveTodo() {
  const kind = todoKindValue;
  const isDo = kind === "do";
  const title = document.getElementById("todoTitle").value.trim();
  const due = document.getElementById("todoDue").value;
  // A "do on" item is a plan for a day, so it carries no time and can point at
  // a deadline instead. A deadline carries a time and points at nothing.
  const dueTime = isDo ? "" : document.getElementById("todoTime").value;

  // Only a real, still-existing deadline counts as a link. If they typed a name
  // but never picked from the list, fall back to an exact name match.
  let linkedTo = null;
  if (isDo) {
    const typed = document.getElementById("todoLink").value.trim().toLowerCase();
    const byId = todoLinkId
      ? getTodos().find(function (x) { return x.id === todoLinkId; })
      : null;
    const parent = byId || (typed
      ? getTodos().find(function (x) {
          return todoKind(x) === "deadline" && x.title.toLowerCase() === typed;
        })
      : null);
    if (parent && typed) linkedTo = parent.id; // cleared box = cleared link
  }

  const notes = document.getElementById("todoNotes").value.trim(); // stored, not shown yet
  const estRaw = document.getElementById("todoEst").value;
  const estHours = estRaw === "" ? null : Number(estRaw);

  // A linked item takes its deadline's category; the locked picker is only a
  // display of that, so read it from the deadline itself to be sure.
  const parentCat = linkedTo
    ? (getTodos().find(function (x) { return x.id === linkedTo; }) || {}).category
    : null;
  const category = parentCat || document.getElementById("todoCategory").value;

  if (!title) { alert("Give your to-do a title."); return; }
  if (!due) { alert(isDo ? "Pick a day to plan it for." : "Pick a due date."); return; }

  let todos = getTodos();
  if (editingTodoId) {
    const done = document.getElementById("todoDone").checked;
    todos = todos.map(function (t) {
      return t.id === editingTodoId
        ? Object.assign({}, t, {
            title: title, kind: kind, due: due, dueTime: dueTime, linkedTo: linkedTo,
            notes: notes, estHours: estHours, category: category, done: done
          })
        : t;
    });
  } else {
    todos.push({
      id: uid("todo"), title: title, kind: kind, due: due, dueTime: dueTime,
      linkedTo: linkedTo, notes: notes, estHours: estHours, category: category,
      done: false, created: Date.now()
    });
  }
  saveTodos(todos);
  closeTodo();
  renderTodos();
  if (typeof renderCalendar === "function") renderCalendar(); // update the schedule's lines
}

function deleteTodo() {
  if (!editingTodoId) return;
  const id = editingTodoId;
  saveTodos(getTodos().filter(function (t) { return t.id !== id; }));
  closeTodo();
  renderTodos();
  if (typeof renderCalendar === "function") renderCalendar();
}

/* ---- Wire up buttons ---- */
document.getElementById("addTodoBtn").addEventListener("click", function () { openTodo(null); });

/* Each filter button toggles its own "show this" flag and its lit state. */
[
  ["todoShowDeadlinesBtn", function (v) { todoShowDeadlines = v; return todoShowDeadlines; }],
  ["todoShowDoOnBtn",      function (v) { todoShowDoOn = v; return todoShowDoOn; }],
  ["todoShowDoneBtn",      function (v) { todoShowDone = v; return todoShowDone; }]
].forEach(function (pair) {
  const btn = document.getElementById(pair[0]);
  btn.addEventListener("click", function () {
    const on = !btn.classList.contains("active");
    pair[1](on);
    btn.classList.toggle("active", on);
    renderTodos();
  });
});
document.querySelectorAll("#todoKindSeg .seg-btn").forEach(function (b) {
  b.addEventListener("click", function () { setTodoKind(b.dataset.kind); });
});

// Typing re-filters the list; it also drops any previous pick, since the text
// no longer necessarily names it.
document.getElementById("todoLink").addEventListener("input", function () {
  todoLinkId = null;
  applyLinkLock();     // unlocks the category while nothing is linked
  renderLinkResults();
});
document.getElementById("todoLink").addEventListener("focus", renderLinkResults);
document.getElementById("todoLink").addEventListener("blur", function () {
  setTimeout(function () { document.getElementById("todoLinkResults").hidden = true; }, 120);
});
document.getElementById("todoLink").addEventListener("keydown", function (e) {
  if (e.key === "Escape") { document.getElementById("todoLinkResults").hidden = true; return; }
  if (e.key === "Enter") { // Enter takes the top match, so you needn't reach for the mouse
    const first = deadlineMatches(this.value)[0];
    if (first) { e.preventDefault(); selectLink(first.id); }
  }
});

document.getElementById("saveTodo").addEventListener("click", saveTodo);
document.getElementById("deleteTodo").addEventListener("click", deleteTodo);
document.getElementById("cancelTodo").addEventListener("click", closeTodo);
todoOverlay.addEventListener("click", function (e) { if (e.target === todoOverlay) closeTodo(); });

document.getElementById("tdPrevWeek").addEventListener("click", function () {
  todoWeekStart = addDays(todoWeekStart, -7); renderTodos();
});
document.getElementById("tdNextWeek").addEventListener("click", function () {
  todoWeekStart = addDays(todoWeekStart, 7); renderTodos();
});
document.getElementById("tdThisWeek").addEventListener("click", function () {
  todoWeekStart = startOfWeek(new Date()); renderTodos();
});

onAppReady(renderTodos);
