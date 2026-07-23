/* ============================================================
   goals.js — goal cards + create/edit modal
   Uses getGoals, saveGoals (app.js) and uid, escapeHtml (calendar.js).
   ============================================================ */

const goalOverlay = document.getElementById("goalModalOverlay");
let editingGoalId = null;
let milestoneDraft = []; // working copy of milestones while the modal is open

/* ---- Render the grid of goal cards ---- */
function renderGoals() {
  const grid = document.getElementById("goalsGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const goals = getGoals();
  if (goals.length === 0) {
    grid.innerHTML = '<p class="placeholder">No goals yet. Click "+ New goal" to add one.</p>';
    return;
  }

  goals.forEach(function (g) {
    const milestones = g.milestones || [];
    const done = milestones.filter(function (m) { return m.done; }).length;

    const card = document.createElement("div");
    card.className = "goal-card";

    let html =
      '<div class="goal-card-head">' +
        '<span class="goal-title">' + escapeHtml(g.title) + "</span>" +
        '<button type="button" class="btn goal-edit" data-id="' + g.id + '">Edit</button>' +
      "</div>";

    const targetText = goalTargetText(g);
    if (targetText) {
      html += '<div class="goal-hours">' + targetText + " target</div>";
    }
    if (g.category) {
      const cat = getCategories().find(function (c) { return c.id === g.category; });
      if (cat) {
        html += '<div class="goal-cat"><span class="cat-dot" style="background:' + cat.color + '"></span>' +
          escapeHtml(cat.name) + "</div>";
      }
    }
    if (milestones.length) {
      html += '<div class="goal-progress">' + done + " / " + milestones.length + " milestones</div>";
      html += '<div class="milestones">';
      milestones.forEach(function (m) {
        html +=
          '<label class="milestone' + (m.done ? " done" : "") + '">' +
            '<input type="checkbox" data-gid="' + g.id + '" data-mid="' + m.id + '"' + (m.done ? " checked" : "") + ">" +
            '<span class="m-text">' + escapeHtml(m.text) + "</span>" +
            (m.date ? '<span class="m-date">' + m.date + "</span>" : "") +
          "</label>";
      });
      html += "</div>";
    }

    // Notes go last so they sit at the bottom of the card.
    if (g.notes) {
      html += '<div class="goal-notes">' + escapeHtml(g.notes) + "</div>";
    }

    card.innerHTML = html;
    grid.appendChild(card);
  });

  // Edit buttons
  grid.querySelectorAll(".goal-edit").forEach(function (b) {
    b.addEventListener("click", function () { openGoal(b.dataset.id); });
  });
  // Milestone checkboxes toggle "done" right on the card
  grid.querySelectorAll('.milestone input[type="checkbox"]').forEach(function (cb) {
    cb.addEventListener("change", function () {
      toggleMilestone(cb.dataset.gid, cb.dataset.mid, cb.checked);
    });
  });

  if (typeof refreshSuggest === "function") refreshSuggest();
}

function toggleMilestone(goalId, mId, done) {
  const goals = getGoals();
  const g = goals.find(function (x) { return x.id === goalId; });
  if (!g) return;
  const m = (g.milestones || []).find(function (x) { return x.id === mId; });
  if (!m) return;
  m.done = done;
  saveGoals(goals);
  renderGoals();
}

/* ---- Create / edit modal ---- */
function openGoal(goalId) {
  editingGoalId = goalId || null;
  const g = goalId ? getGoals().find(function (x) { return x.id === goalId; }) : null;

  document.getElementById("goalModalTitle").textContent = g ? "Edit goal" : "New goal";
  document.getElementById("goalTitle").value = g ? g.title : "";
  document.getElementById("goalNotes").value = g ? (g.notes || "") : "";
  const t = g ? goalTarget(g) : null;
  document.getElementById("goalTargetType").value = t ? t.type : "";
  document.getElementById("goalTargetValue").value = t ? t.value : "";

  populateGoalCategories(g ? g.category : "");

  milestoneDraft = g ? (g.milestones || []).map(function (m) { return Object.assign({}, m); }) : [];
  renderMilestoneList();

  document.getElementById("deleteGoal").style.display = g ? "inline-block" : "none";
  goalOverlay.classList.add("open");
  document.getElementById("goalTitle").focus();
}

function closeGoal() {
  goalOverlay.classList.remove("open");
  editingGoalId = null;
}

/* Category dropdown (with a "None" option) for linking a goal to a category. */
function populateGoalCategories(selectedId) {
  const sel = document.getElementById("goalCategory");
  sel.innerHTML = '<option value="">None</option>';
  getCategories().forEach(function (c) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    if (c.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  });
  paintCategorySelect(sel);
  sel.onchange = function () { paintCategorySelect(sel); };
}

function renderMilestoneList() {
  const list = document.getElementById("milestoneList");
  list.innerHTML = "";
  milestoneDraft.forEach(function (m, i) {
    const row = document.createElement("div");
    row.className = "ms-row";
    row.innerHTML =
      '<input type="text" class="ms-text" data-i="' + i + '" placeholder="Milestone" value="' + escapeHtml(m.text || "") + '">' +
      '<input type="date" class="ms-date" data-i="' + i + '" value="' + (m.date || "") + '">' +
      '<button type="button" class="btn ms-del" data-i="' + i + '">Remove</button>';
    list.appendChild(row);
  });
  list.querySelectorAll(".ms-del").forEach(function (b) {
    b.addEventListener("click", function () {
      readMilestoneInputs();
      milestoneDraft.splice(Number(b.dataset.i), 1);
      renderMilestoneList();
    });
  });
}

function readMilestoneInputs() {
  const list = document.getElementById("milestoneList");
  list.querySelectorAll(".ms-text").forEach(function (inp) {
    milestoneDraft[Number(inp.dataset.i)].text = inp.value.trim();
  });
  list.querySelectorAll(".ms-date").forEach(function (inp) {
    milestoneDraft[Number(inp.dataset.i)].date = inp.value;
  });
}

function addMilestoneRow() {
  readMilestoneInputs();
  milestoneDraft.push({ id: uid("ms"), text: "", date: "", done: false });
  renderMilestoneList();
}

function saveGoal() {
  const title = document.getElementById("goalTitle").value.trim();
  if (!title) { alert("Give your goal a title."); return; }

  readMilestoneInputs();
  const milestones = milestoneDraft.filter(function (m) { return m.text; }); // drop blank rows

  const targetType = document.getElementById("goalTargetType").value;
  const targetValRaw = document.getElementById("goalTargetValue").value;
  const target = (targetType && targetValRaw !== "")
    ? { type: targetType, value: Number(targetValRaw) }
    : null;
  const category = document.getElementById("goalCategory").value || null;
  const notes = document.getElementById("goalNotes").value.trim(); // stored, not shown yet

  let goals = getGoals();
  if (editingGoalId) {
    goals = goals.map(function (g) {
      // Drop the legacy hoursPerWeek field so target is the single source.
      const updated = Object.assign({}, g, { title: title, target: target, category: category, notes: notes, milestones: milestones });
      delete updated.hoursPerWeek;
      return g.id === editingGoalId ? updated : g;
    });
  } else {
    goals.push({ id: uid("goal"), title: title, target: target, category: category, notes: notes, milestones: milestones, created: Date.now() });
  }
  saveGoals(goals);
  closeGoal();
  renderGoals();
}

function deleteGoal() {
  if (!editingGoalId) return;
  const id = editingGoalId;
  saveGoals(getGoals().filter(function (g) { return g.id !== id; }));
  closeGoal();
  renderGoals();
}

/* ---- Wire up buttons ---- */
document.getElementById("addGoalBtn").addEventListener("click", function () { openGoal(null); });
document.getElementById("addMilestone").addEventListener("click", addMilestoneRow);
document.getElementById("saveGoal").addEventListener("click", saveGoal);
document.getElementById("deleteGoal").addEventListener("click", deleteGoal);
document.getElementById("cancelGoal").addEventListener("click", closeGoal);
goalOverlay.addEventListener("click", function (e) { if (e.target === goalOverlay) closeGoal(); });

renderGoals();