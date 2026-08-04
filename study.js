/* ============================================================
   study.js — a lightweight Quizlet/Anki-style study tool.

   A "deck" is { id, name, description, cards: [{ id, term, def }] }.
   All decks live in one Store key ("study-decks") as a JSON array, so they
   persist and sync like the rest of the app's data.

   Four surfaces:
     1. Deck list      (inside the normal page: #view-study)
     2. Editor         (full-screen overlay: create / edit a deck)
     3. Flashcards     (full-screen overlay: Anki-style reveal + rate)
     4. Exam           (full-screen overlay: type answers, then review)

   Dependencies from app.js: Store, uid, escapeHtml.
   ============================================================ */

/* ---------- data layer ---------- */

const STUDY_KEY = "study-decks";

function loadDecks() {
  const raw = Store.get(STUDY_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (e) { return []; }
}
function saveDecks(decks) {
  Store.set(STUDY_KEY, JSON.stringify(decks));
}
function getDeck(id) {
  return loadDecks().find(function (d) { return d.id === id; }) || null;
}
function upsertDeck(deck) {
  const decks = loadDecks();
  const i = decks.findIndex(function (d) { return d.id === deck.id; });
  if (i === -1) decks.push(deck); else decks[i] = deck;
  saveDecks(decks);
}
function deleteDeck(id) {
  saveDecks(loadDecks().filter(function (d) { return d.id !== id; }));
}

/* A deck's category shown as text. Decks store a category id from the shared
   system; resolve it to the category name (plus subcategory). For older/demo
   decks whose category is a plain string (not an id), show it as-is. */
function deckCategoryLabel(d) {
  if (!d.category) return "";
  const cats = (typeof getCategories === "function") ? getCategories() : [];
  const cat = cats.find(function (c) { return c.id === d.category; });
  if (!cat) return d.category;   // free-text / legacy value
  let label = cat.name;
  if (d.subcategory && typeof subcategoryName === "function") {
    const sn = subcategoryName(d.category, d.subcategory);
    if (sn) label += " \u203a " + sn;   // "Category › Subcategory"
  }
  return label;
}

/* Small helpers */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
/* Which side to show given a mode ("term" | "def" | "random"). */
function sideFor(mode) {
  if (mode === "term") return "term";
  if (mode === "def") return "def";
  return Math.random() < 0.5 ? "term" : "def";
}
/* Loose answer match: trim, lowercase, collapse inner whitespace. */
function answersMatch(a, b) {
  function norm(s) { return (s || "").trim().toLowerCase().replace(/\s+/g, " "); }
  return norm(a) === norm(b);
}

/* ============================================================
   1 · DECK LIST
   ============================================================ */

function renderStudy() {
  const list = document.getElementById("studyList");
  if (!list) return;
  const decks = loadDecks();
  list.innerHTML = "";

  if (!decks.length) {
    const empty = document.createElement("p");
    empty.className = "study-empty";
    empty.textContent = "No decks yet. Create your first study set to get started.";
    list.appendChild(empty);
    return;
  }

  decks.forEach(function (d) {
    const count = (d.cards || []).length;
    const catName = deckCategoryLabel(d);
    const row = document.createElement("div");
    row.className = "study-deck-row";
    row.innerHTML =
      '<div class="study-deck-main">' +
        '<div class="study-deck-name">' + escapeHtml(d.name || "Untitled deck") +
          (catName ? ' <span class="study-deck-cat">' + escapeHtml(catName) + "</span>" : "") +
        "</div>" +
        '<div class="study-deck-meta">' + count + " term" + (count === 1 ? "" : "s") +
          (d.description ? " &middot; " + escapeHtml(d.description) : "") +
        "</div>" +
      "</div>" +
      '<div class="study-deck-actions">' +
        '<button class="btn btn-sm" data-act="edit">Edit</button>' +
        '<button class="btn btn-sm" data-act="cards">Flashcards</button>' +
        '<button class="btn btn-sm" data-act="exam">Exam</button>' +
      "</div>";

    row.querySelector('[data-act="edit"]').addEventListener("click", function (e) {
      e.stopPropagation(); openEditor(d.id);
    });
    row.querySelector('[data-act="cards"]').addEventListener("click", function (e) {
      e.stopPropagation();
      if (!count) { alert("This deck has no cards yet. Add some in Edit first."); return; }
      openFlashcards(d.id);
    });
    row.querySelector('[data-act="exam"]').addEventListener("click", function (e) {
      e.stopPropagation();
      if (!count) { alert("This deck has no cards yet. Add some in Edit first."); return; }
      openExam(d.id);
    });
    // Clicking the row itself (anywhere but the action buttons, which stop
    // propagation) opens the editor.
    row.addEventListener("click", function () { openEditor(d.id); });
    row.style.cursor = "pointer";
    list.appendChild(row);
  });
}

/* Wire the "New deck" button once. */
function initStudy() {
  const newBtn = document.getElementById("studyNewBtn");
  if (newBtn) newBtn.addEventListener("click", function () { openEditor(null); });
}

/* ============================================================
   2 · EDITOR (create / edit)
   ============================================================ */

let editorState = null;   // { id, name, description, cards, dirty }

function openEditor(deckId) {
  const existing = deckId ? getDeck(deckId) : null;
  editorState = existing
    ? { id: existing.id, name: existing.name || "", description: existing.description || "",
        category: existing.category || "", subcategory: existing.subcategory || "",
        cards: (existing.cards || []).map(function (c) { return { id: c.id, term: c.term, def: c.def }; }),
        dirty: false, isNew: false }
    : { id: uid("deck"), name: "", description: "", category: "", subcategory: "", cards: [], dirty: false, isNew: true };

  // Always start with at least a couple of blank rows for a new deck.
  if (editorState.isNew && editorState.cards.length === 0) {
    editorState.cards.push({ id: uid("card"), term: "", def: "" });
    editorState.cards.push({ id: uid("card"), term: "", def: "" });
  }

  document.getElementById("studyEditorTitle").textContent = existing ? "Edit deck" : "New deck";
  document.getElementById("editDeckName").value = editorState.name;
  document.getElementById("editDeckDesc").value = editorState.description;
  populateDeckCategory();
  renderEditorCards();
  showOverlay("studyEditor");
}

/* Fill the category dropdown from the app's shared categories, then the
   subcategory dropdown from the chosen category (hidden if it has none).
   Decks reuse the same category system as events. */
function populateDeckCategory() {
  const catSel = document.getElementById("editDeckCat");
  const cats = getCategories();
  catSel.innerHTML = '<option value="">None</option>' +
    cats.map(function (c) {
      return '<option value="' + c.id + '">' + escapeHtml(c.name) + "</option>";
    }).join("");
  // If the saved category no longer exists, fall back to None.
  catSel.value = cats.some(function (c) { return c.id === editorState.category; })
    ? editorState.category : "";
  editorState.category = catSel.value;
  populateDeckSub();
}

function populateDeckSub() {
  const field = document.getElementById("editDeckSubField");
  const subSel = document.getElementById("editDeckSub");
  const subs = getSubcategories(editorState.category);
  if (!editorState.category || !subs.length) {
    field.hidden = true;
    subSel.innerHTML = "";
    editorState.subcategory = "";
    return;
  }
  field.hidden = false;
  subSel.innerHTML = '<option value="">None</option>' +
    subs.map(function (s) {
      return '<option value="' + s.id + '">' + escapeHtml(s.name) + "</option>";
    }).join("");
  subSel.value = subs.some(function (s) { return s.id === editorState.subcategory; })
    ? editorState.subcategory : "";
  editorState.subcategory = subSel.value;
}

function renderEditorCards() {
  const wrap = document.getElementById("editCards");
  wrap.innerHTML = "";
  editorState.cards.forEach(function (card, i) {
    const row = document.createElement("div");
    row.className = "edit-card-row";
    row.innerHTML =
      '<span class="edit-card-num">' + (i + 1) + "</span>" +
      '<input class="edit-card-term" placeholder="Term" data-i="' + i + '">' +
      '<input class="edit-card-def" placeholder="Definition" data-i="' + i + '">' +
      '<button class="edit-card-del" data-i="' + i + '" title="Remove" aria-label="Remove term">&times;</button>';
    row.querySelector(".edit-card-term").value = card.term || "";
    row.querySelector(".edit-card-def").value = card.def || "";
    wrap.appendChild(row);
  });

  wrap.querySelectorAll(".edit-card-term").forEach(function (inp) {
    inp.addEventListener("input", function () {
      editorState.cards[Number(inp.dataset.i)].term = inp.value;
      editorState.dirty = true;
      markDuplicates();
    });
  });
  wrap.querySelectorAll(".edit-card-def").forEach(function (inp) {
    inp.addEventListener("input", function () {
      editorState.cards[Number(inp.dataset.i)].def = inp.value;
      editorState.dirty = true;
      markDuplicates();
    });
  });
  wrap.querySelectorAll(".edit-card-del").forEach(function (b) {
    b.addEventListener("click", function () {
      editorState.cards.splice(Number(b.dataset.i), 1);
      editorState.dirty = true;
      renderEditorCards();
    });
  });
  markDuplicates();
}

/* Highlight any term or definition that exactly matches another row's (case-
   and whitespace-insensitive). Blank cells are never flagged. */
function markDuplicates() {
  const wrap = document.getElementById("editCards");
  const terms = wrap.querySelectorAll(".edit-card-term");
  const defs = wrap.querySelectorAll(".edit-card-def");
  function norm(s) { return (s || "").trim().toLowerCase().replace(/\s+/g, " "); }

  function flag(inputs) {
    const counts = {};
    inputs.forEach(function (inp) {
      const v = norm(inp.value);
      if (v) counts[v] = (counts[v] || 0) + 1;
    });
    inputs.forEach(function (inp) {
      const v = norm(inp.value);
      inp.classList.toggle("dup", !!v && counts[v] > 1);
    });
  }
  flag(Array.from(terms));
  flag(Array.from(defs));
}

function initEditor() {
  document.getElementById("editDeckName").addEventListener("input", function () {
    editorState.name = this.value; editorState.dirty = true;
  });
  document.getElementById("editDeckDesc").addEventListener("input", function () {
    editorState.description = this.value; editorState.dirty = true;
  });
  document.getElementById("editDeckCat").addEventListener("change", function () {
    editorState.category = this.value;
    editorState.subcategory = "";          // reset sub when the category changes
    editorState.dirty = true;
    populateDeckSub();
  });
  document.getElementById("editDeckSub").addEventListener("change", function () {
    editorState.subcategory = this.value; editorState.dirty = true;
  });
  document.getElementById("editAddCard").addEventListener("click", function () {
    editorState.cards.push({ id: uid("card"), term: "", def: "" });
    editorState.dirty = true;
    renderEditorCards();
    // Focus the new row's term field.
    const rows = document.querySelectorAll("#editCards .edit-card-term");
    if (rows.length) rows[rows.length - 1].focus();
  });
  document.getElementById("editSave").addEventListener("click", saveEditor);
  document.getElementById("studyEditorExit").addEventListener("click", tryExitEditor);
  document.getElementById("editDelete").addEventListener("click", deleteFromEditor);
  document.getElementById("editExport").addEventListener("click", exportDeck);
  document.getElementById("editImport").addEventListener("click", function () {
    document.getElementById("editImportFile").click();
  });
  document.getElementById("editImportFile").addEventListener("change", importDeckFile);
}

/* Delete the deck being edited (only if it already exists / has content). */
function deleteFromEditor() {
  const label = editorState.name.trim() || "this deck";
  if (!confirm('Delete "' + label + '"? This cannot be undone.')) return;
  if (!editorState.isNew) deleteDeck(editorState.id);
  editorState.dirty = false;
  hideOverlay("studyEditor");
  renderStudy();
}

/* Export the current (in-progress) deck as a .txt file: one "term<TAB>def"
   per line, with the name/description as leading comment lines. Simple, and
   re-importable by this same tool. */
function exportDeck() {
  const lines = [];
  lines.push("# name: " + (editorState.name || "Untitled deck"));
  if (editorState.description) lines.push("# description: " + editorState.description);
  if (editorState.category) {
    lines.push("# category: " + deckCategoryLabel({ category: editorState.category, subcategory: editorState.subcategory }));
  }
  editorState.cards.forEach(function (c) {
    const term = (c.term || "").replace(/\t/g, " ");
    const def = (c.def || "").replace(/\t/g, " ");
    if (term || def) lines.push(term + "\t" + def);
  });
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (editorState.name.trim() || "deck").replace(/[^\w\-]+/g, "_") + ".txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* Import terms from a file and ADD them to the current list (never overwrite).
   Accepts: our own tab-separated .txt export, plain CSV/TSV (term,def per
   line), or a JSON array of {term, def}. Blank lines and "# ..." lines skip. */
function importDeckFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function () {
    const text = String(reader.result || "");
    let added = 0;
    try {
      const parsed = parseImport(text);
      parsed.forEach(function (row) {
        editorState.cards.push({ id: uid("card"), term: row.term, def: row.def });
        added++;
      });
      editorState.dirty = true;
      renderEditorCards();
      alert("Imported " + added + " term" + (added === 1 ? "" : "s") + ".");
    } catch (err) {
      alert("Couldn't read that file. Expected term/definition pairs (CSV, TSV, or the exported .txt).");
    }
  };
  reader.readAsText(file);
  e.target.value = "";   // let the same file be re-picked later
}

/* Turn imported text into [{term, def}]. Tries JSON first, then line-based. */
function parseImport(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) {
    const arr = JSON.parse(trimmed);
    return arr.map(function (o) {
      return { term: String(o.term || o[0] || "").trim(), def: String(o.def || o.definition || o[1] || "").trim() };
    }).filter(function (r) { return r.term || r.def; });
  }
  const out = [];
  trimmed.split(/\r?\n/).forEach(function (line) {
    if (!line.trim() || line.trim().startsWith("#")) return;   // skip blanks + comments
    // Split on tab if present, else the first comma.
    let term, def;
    if (line.indexOf("\t") !== -1) {
      const parts = line.split("\t");
      term = parts[0]; def = parts.slice(1).join(" ");
    } else {
      const ci = line.indexOf(",");
      if (ci === -1) { term = line; def = ""; }
      else { term = line.slice(0, ci); def = line.slice(ci + 1); }
    }
    term = term.trim(); def = def.trim();
    if (term || def) out.push({ term: term, def: def });
  });
  return out;
}

function saveEditor() {
  // Drop fully-blank rows; keep partial ones so nothing is silently lost.
  const cards = editorState.cards.filter(function (c) {
    return (c.term || "").trim() !== "" || (c.def || "").trim() !== "";
  });
  const deck = {
    id: editorState.id,
    name: editorState.name.trim() || "Untitled deck",
    description: editorState.description.trim(),
    category: editorState.category || "",
    subcategory: editorState.subcategory || "",
    cards: cards
  };
  upsertDeck(deck);
  editorState.dirty = false;
  hideOverlay("studyEditor");
  renderStudy();
}

function tryExitEditor() {
  if (editorState && editorState.dirty) {
    const ok = confirm("You have unsaved changes. Exit without saving?");
    if (!ok) return;
  }
  hideOverlay("studyEditor");
}

/* ============================================================
   3 · FLASHCARDS  (Anki-style: reveal, then rate comfort)
   ------------------------------------------------------------
   Spaced repetition, WITHIN a session (prototype scope):
   each card gets a queue position. Rating a card reinserts it:
     - "Again"  -> comes back very soon (a few cards later)
     - "Hard"   -> comes back soon
     - "Good"   -> comes back later
     - "Easy"   -> pushed far back / effectively done for the session
   This mirrors the FEEL of Anki's SM-2 (struggling cards resurface,
   mastered ones stop nagging) without needing multi-day saved state.
   A true cross-day SM-2 with per-card intervals is a future upgrade.
   ============================================================ */

let flashState = null;  // { deckId, queue:[{card,side}], idx, revealed, settings, doneCount, total }
const FLASH_SETTINGS_KEY = "study-flash-settings";

function flashSettings() {
  const raw = Store.get(FLASH_SETTINGS_KEY);
  const def = { mode: "term" };   // show term first by default
  if (!raw) return def;
  try { return Object.assign(def, JSON.parse(raw)); } catch (e) { return def; }
}
function saveFlashSettings(s) { Store.set(FLASH_SETTINGS_KEY, JSON.stringify(s)); }

function openFlashcards(deckId) {
  const deck = getDeck(deckId);
  if (!deck || !deck.cards.length) return;
  const s = flashSettings();
  const queue = shuffle(deck.cards).map(function (card) {
    return { card: card, side: sideFor(s.mode) };
  });
  flashState = {
    deckId: deckId,
    queue: queue,
    idx: 0,
    revealed: false,
    everRevealed: false,   // has the current card been flipped at least once?
    settings: s,
    total: deck.cards.length,
    doneCount: 0,
    seen: {},         // card id -> true once rated Easy
    history: []       // snapshots for the Back button
  };
  document.getElementById("flashDeckName").textContent = deck.name || "Flashcards";
  showOverlay("studyFlash");
  renderFlash();
}

function renderFlash() {
  const stage = document.getElementById("flashStage");
  const q = flashState.queue[flashState.idx];

  // Finished?
  if (!q) {
    stage.innerHTML =
      '<div class="flash-done">' +
        "<h2>Nice work!</h2>" +
        "<p>You went through every card in this deck.</p>" +
        '<div class="flash-done-actions">' +
          '<button class="btn btn-primary" id="flashRestart">Study again</button>' +
        "</div>" +
      "</div>";
    document.getElementById("flashRestart").addEventListener("click", function () {
      openFlashcards(flashState.deckId);
    });
    updateFlashProgress();
    return;
  }

  const front = q.side === "term" ? q.card.term : q.card.def;
  const back = q.side === "term" ? q.card.def : q.card.term;
  const frontLabel = q.side === "term" ? "Term" : "Definition";
  const backLabel = q.side === "term" ? "Definition" : "Term";

  // Rating buttons show once the card has been revealed at least once — and
  // stay even if you flip it back to the front to re-test yourself.
  const showRating = flashState.everRevealed;
  const canBack = flashState.history.length > 0;

  stage.innerHTML =
    '<div class="flash-card' + (flashState.revealed ? " revealed" : "") + '" id="flashCard">' +
      '<div class="flash-face">' +
        '<span class="flash-side-label">' + frontLabel + "</span>" +
        '<div class="flash-text">' + escapeHtml(front) + "</div>" +
        (flashState.revealed
          ? '<div class="flash-divider"></div>' +
            '<span class="flash-side-label">' + backLabel + "</span>" +
            '<div class="flash-text flash-back">' + escapeHtml(back) + "</div>" +
            '<div class="flash-hint">Click to hide again</div>'
          : '<div class="flash-hint">Click to reveal</div>') +
      "</div>" +
    "</div>" +
    // Controls row below the card: back-arrow pinned left, ratings centered on
    // the card. Always present (so the card never shifts); buttons appear
    // inside it once revealed.
    '<div class="flash-controls">' +
      '<button class="flash-back-arrow" id="flashBackArrow" title="Previous card"' +
        (canBack ? "" : " disabled") + " aria-label=\"Previous card\">&larr;</button>" +
      '<div class="flash-rate' + (showRating ? "" : " flash-rate--hidden") + '">' +
        '<button class="flash-rate-btn hard" data-rate="hard">Hard</button>' +
        '<button class="flash-rate-btn neutral" data-rate="neutral">Neutral</button>' +
        '<button class="flash-rate-btn easy" data-rate="easy">Easy</button>' +
      "</div>" +
    "</div>";

  // Clicking the card toggles reveal. The first reveal latches everRevealed so
  // the rating buttons stay available even after flipping back.
  document.getElementById("flashCard").addEventListener("click", function () {
    flashState.revealed = !flashState.revealed;
    if (flashState.revealed) flashState.everRevealed = true;
    renderFlash();
  });
  // Back arrow.
  document.getElementById("flashBackArrow").addEventListener("click", function (e) {
    e.stopPropagation();
    flashBack();
  });
  if (showRating) {
    stage.querySelectorAll(".flash-rate-btn").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        rateFlash(b.dataset.rate);
      });
    });
  }
  updateFlashProgress();
}

/* Reinsert the current card further down the queue based on the rating.
   Hard   -> comes back soon (resurfaces within a few cards)
   Neutral-> back of the line for another pass
   Easy   -> dropped for the rest of the session */
function rateFlash(rating) {
  const q = flashState.queue[flashState.idx];
  const s = flashState.settings;

  // Snapshot the pre-rating state so Back can return to this exact card.
  flashState.history.push({
    queue: flashState.queue.map(function (x) { return { card: x.card, side: x.side }; }),
    idx: flashState.idx,
    doneCount: flashState.doneCount,
    seen: Object.assign({}, flashState.seen)
  });

  // Reinsertion distance is a fraction of the whole deck (in cards). Nothing
  // ever leaves the queue, so this runs as an endless mode — cards you know
  // best simply come back least often:
  //   Hard    -> reappears 10–20% of the deck later
  //   Neutral -> reappears 25–50% of the deck later
  //   Easy    -> reappears a full deck-length later (100%)
  // Only Easy counts a card as mastered.
  const total = flashState.total || 1;
  function randSpan(lo, hi) {
    const a = Math.round(total * lo);
    const b = Math.round(total * hi);
    const span = Math.max(1, a + Math.floor(Math.random() * (b - a + 1)));
    return span;
  }
  let offset;
  if (rating === "hard") offset = randSpan(0.10, 0.20);
  else if (rating === "neutral") offset = randSpan(0.25, 0.50);
  else offset = Math.max(1, total);                          // easy -> a full deck later

  // Only Easy marks a card as mastered (the first time).
  if (rating === "easy" && !flashState.seen[q.card.id]) {
    flashState.seen[q.card.id] = true;
    flashState.doneCount++;
  }

  flashState.idx++;

  const insertAt = Math.min(flashState.idx + offset, flashState.queue.length);
  flashState.queue.splice(insertAt, 0, { card: q.card, side: sideFor(s.mode) });

  flashState.revealed = false;
  flashState.everRevealed = false;   // the next card starts fresh
  renderFlash();
}

/* Go back to the previous card, restoring the queue exactly as it was before
   the last rating (so a card that got reinserted isn't left duplicated). */
function flashBack() {
  if (!flashState.history.length) return;
  const prev = flashState.history.pop();
  flashState.queue = prev.queue;
  flashState.idx = prev.idx;
  flashState.doneCount = prev.doneCount;
  flashState.seen = prev.seen;
  flashState.revealed = false;
  flashState.everRevealed = true;    // you already saw this card, so keep ratings available
  renderFlash();
}

function updateFlashProgress() {
  const bar = document.getElementById("flashProgressBar");
  const label = document.getElementById("flashProgressLabel");
  const pct = flashState.total ? Math.round((flashState.doneCount / flashState.total) * 100) : 0;
  if (bar) bar.style.width = pct + "%";
  if (label) label.textContent = flashState.doneCount + " / " + flashState.total + " mastered";
}

function initFlash() {
  document.getElementById("studyFlashExit").addEventListener("click", function () {
    hideOverlay("studyFlash");
  });
  // Settings popover
  document.getElementById("flashSettingsBtn").addEventListener("click", function () {
    document.getElementById("flashSettingsPop").hidden = !document.getElementById("flashSettingsPop").hidden;
  });
  document.querySelectorAll('input[name="flashMode"]').forEach(function (r) {
    r.addEventListener("change", function () {
      const s = flashSettings();
      s.mode = this.value;
      saveFlashSettings(s);
      // Apply immediately: re-pick sides for the remaining queue.
      if (flashState) {
        flashState.settings = s;
        for (let i = flashState.idx; i < flashState.queue.length; i++) {
          flashState.queue[i].side = sideFor(s.mode);
        }
        flashState.revealed = false;
        renderFlash();
      }
    });
  });
  // Keyboard: space/enter toggles reveal, 1-3 rate, left-arrow goes back.
  document.addEventListener("keydown", function (e) {
    if (document.getElementById("studyFlash").hidden) return;
    if (!flashState) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); flashBack(); return; }
    const q = flashState.queue[flashState.idx];
    if (!q) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      flashState.revealed = !flashState.revealed;
      renderFlash();
    } else if (flashState.revealed) {
      const map = { "1": "hard", "2": "neutral", "3": "easy" };
      if (map[e.key]) { e.preventDefault(); rateFlash(map[e.key]); }
    }
  });
}

/* ============================================================
   4 · EXAM  (type the answer, then review)
   ============================================================ */

let examState = null;  // { deckId, items:[{card,side,answer,correct}], settings, phase }
const EXAM_SETTINGS_KEY = "study-exam-settings";

function examSettings() {
  const raw = Store.get(EXAM_SETTINGS_KEY);
  const def = { mode: "def", count: 0 };  // answer with definition; 0 = whole set
  if (!raw) return def;
  try { return Object.assign(def, JSON.parse(raw)); } catch (e) { return def; }
}
function saveExamSettings(s) { Store.set(EXAM_SETTINGS_KEY, JSON.stringify(s)); }

function openExam(deckId, onlyCards) {
  const deck = getDeck(deckId);
  if (!deck || !deck.cards.length) return;
  const s = examSettings();

  let pool = onlyCards ? onlyCards : deck.cards;
  pool = shuffle(pool);
  if (!onlyCards && s.count && s.count > 0 && s.count < pool.length) {
    pool = pool.slice(0, s.count);
  }

  examState = {
    deckId: deckId,
    settings: s,
    items: pool.map(function (card) {
      const side = sideFor(s.mode);   // which side they must PRODUCE
      return {
        card: card,
        side: side,
        prompt: side === "term" ? card.def : card.term,       // shown
        expected: side === "term" ? card.term : card.def,     // typed answer
        promptLabel: side === "term" ? "Definition" : "Term",
        answer: "",
        correct: null
      };
    }),
    phase: "taking"
  };

  document.getElementById("examDeckName").textContent = deck.name || "Exam";
  // Reflect settings into the controls.
  document.getElementById("examCount").value = s.count || "";
  document.querySelectorAll('input[name="examMode"]').forEach(function (r) {
    r.checked = (r.value === s.mode);
  });
  showOverlay("studyExam");
  renderExamTaking();
}

function renderExamTaking() {
  const stage = document.getElementById("examStage");
  const foot = document.getElementById("examFoot");
  let html = '<div class="exam-list">';
  examState.items.forEach(function (it, i) {
    html +=
      '<div class="exam-q">' +
        '<div class="exam-q-num">' + (i + 1) + " of " + examState.items.length + "</div>" +
        '<div class="exam-q-label">' + it.promptLabel + "</div>" +
        '<div class="exam-q-prompt">' + escapeHtml(it.prompt) + "</div>" +
        '<input class="exam-q-input" data-i="' + i + '" placeholder="Your answer" ' +
          'value="' + escapeHtml(it.answer) + '" autocomplete="off">' +
      "</div>";
  });
  html += "</div>";
  stage.innerHTML = html;

  stage.querySelectorAll(".exam-q-input").forEach(function (inp) {
    inp.addEventListener("input", function () {
      examState.items[Number(inp.dataset.i)].answer = inp.value;
    });
    // Enter jumps to the next field.
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        const next = stage.querySelector('.exam-q-input[data-i="' + (Number(inp.dataset.i) + 1) + '"]');
        if (next) next.focus(); else submitExam();
      }
    });
  });

  foot.innerHTML = '<button class="btn btn-primary" id="examSubmit">Submit exam</button>';
  document.getElementById("examSubmit").addEventListener("click", submitExam);
}

function submitExam() {
  let right = 0;
  examState.items.forEach(function (it) {
    it.correct = answersMatch(it.answer, it.expected);
    if (it.correct) right++;
  });
  examState.phase = "review";
  examState.score = right;
  renderExamReview();
}

function renderExamReview() {
  const stage = document.getElementById("examStage");
  const foot = document.getElementById("examFoot");
  const total = examState.items.length;
  const pct = total ? Math.round((examState.score / total) * 100) : 0;

  let html =
    '<div class="exam-score">' +
      "<h2>" + examState.score + " / " + total + " correct (" + pct + "%)</h2>" +
    "</div>" +
    '<div class="exam-list">';
  examState.items.forEach(function (it, i) {
    html +=
      '<div class="exam-q exam-reviewed ' + (it.correct ? "is-correct" : "is-wrong") + '">' +
        '<div class="exam-q-label">' + it.promptLabel + "</div>" +
        '<div class="exam-q-prompt">' + escapeHtml(it.prompt) + "</div>" +
        '<div class="exam-answer-line">' +
          '<span class="exam-answer-label">Your answer:</span> ' +
          '<span class="exam-your-answer">' + (it.answer ? escapeHtml(it.answer) : "&mdash;") + "</span>" +
        "</div>" +
        (it.correct
          ? ""
          : '<div class="exam-answer-line exam-correct-line">' +
              '<span class="exam-answer-label">Correct answer:</span> ' +
              '<span class="exam-correct-answer">' + escapeHtml(it.expected) + "</span>" +
            "</div>") +
      "</div>";
  });
  html += "</div>";
  stage.innerHTML = html;

  const anyWrong = examState.items.some(function (it) { return !it.correct; });
  foot.innerHTML =
    '<button class="btn" id="examRepeat">Repeat</button>' +
    (anyWrong ? '<button class="btn btn-primary" id="examRepeatWrong">Repeat incorrect only</button>' : "");
  document.getElementById("examRepeat").addEventListener("click", function () {
    openExam(examState.deckId);
  });
  if (anyWrong) {
    document.getElementById("examRepeatWrong").addEventListener("click", function () {
      const wrong = examState.items.filter(function (it) { return !it.correct; })
                                   .map(function (it) { return it.card; });
      openExam(examState.deckId, wrong);
    });
  }
}

function initExam() {
  document.getElementById("studyExamExit").addEventListener("click", function () {
    hideOverlay("studyExam");
  });
  document.getElementById("examSettingsBtn").addEventListener("click", function () {
    const pop = document.getElementById("examSettingsPop");
    pop.hidden = !pop.hidden;
  });
  document.getElementById("examCount").addEventListener("change", function () {
    const s = examSettings();
    const v = parseInt(this.value, 10);
    s.count = (isNaN(v) || v <= 0) ? 0 : v;
    saveExamSettings(s);
  });
  document.querySelectorAll('input[name="examMode"]').forEach(function (r) {
    r.addEventListener("change", function () {
      const s = examSettings();
      s.mode = this.value;
      saveExamSettings(s);
    });
  });
  // Applying new settings restarts the exam with them.
  document.getElementById("examApply").addEventListener("click", function () {
    document.getElementById("examSettingsPop").hidden = true;
    if (examState) openExam(examState.deckId);
  });
}

/* ============================================================
   Full-screen overlay show/hide + init
   ============================================================ */

function showOverlay(id) {
  document.getElementById(id).hidden = false;
  document.body.classList.add("study-overlay-open");
}
function hideOverlay(id) {
  document.getElementById(id).hidden = true;
  document.body.classList.remove("study-overlay-open");
  // Close any open settings popovers.
  const fp = document.getElementById("flashSettingsPop"); if (fp) fp.hidden = true;
  const ep = document.getElementById("examSettingsPop"); if (ep) ep.hidden = true;
}

/* Initialise all the static handlers once the DOM is ready. */
function initStudyModule() {
  initStudy();
  initEditor();
  initFlash();
  initExam();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initStudyModule);
} else {
  initStudyModule();
}