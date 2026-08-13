/* ============================================================
   worldmap-study.js — world-map deck editor + quiz.

   A world-map deck is a normal deck with type "worldmap". Its cards are
   { id, country, def } where `country` is the region on the map and `def` is
   the text answer (defaults to the country name; editable, e.g. to a capital).

   Two study directions:
     - "name"  : a country is shaded -> recall/reveal its answer text.
     - "find"  : the answer text is shown -> click the correct country.
   ============================================================ */
(function (global) {
  "use strict";

  /* ---------------- editor ---------------- */
  let wmEditorState = null;   // { id, name, picks:[{country,def}], isNew }
  let wmEditorMap = null;

  function openWorldMapEditor(deckId) {
    const existing = deckId ? getDeck(deckId) : null;
    wmEditorState = existing
      ? { id: existing.id, name: existing.name || "",
          picks: (existing.cards || []).map(function (c) { return { country: c.country, def: c.def }; }),
          isNew: false }
      : { id: uid("deck"), name: "", picks: [], isNew: true };

    document.getElementById("wmDeckName").value = wmEditorState.name;
    document.getElementById("wmEditorTitle").textContent = existing ? "Edit world map deck" : "World map deck";
    showOverlay("wmEditor");

    // Build the interactive map (once), then reflect current picks.
    const host = document.getElementById("wmEditorMap");
    wmEditorMap = WorldMap.create(host, {
      onPick: function (country) {
        if (!country) return;
        addPick(country);
      }
    });
    wmEditorMap.load().then(function () {
      reflectPicks();
    });
    renderPickedList();
  }

  function addPick(country) {
    // Clicking a country only ADDS it. If it's already in the deck, do nothing
    // (removal is via the × in the side list), so a stray second click can't
    // silently drop a country.
    const already = wmEditorState.picks.some(function (p) { return p.country === country; });
    if (already) return;
    wmEditorState.picks.push({ country: country, def: country }); // answer defaults to the name
    reflectPicks();
    renderPickedList();
  }

  // Shade every currently-picked country on the editor map.
  function reflectPicks() {
    if (!wmEditorMap) return;
    // clear all, then add selected class to picks
    wmEditorMap.allCountryNames().forEach(function (n) {
      const picked = wmEditorState.picks.some(function (p) { return p.country === n; });
      const el = document.querySelector('#wmEditorMap [data-name="' + cssEscape(n) + '"]');
      if (el) el.classList.toggle("worldmap-selected", picked);
    });
  }

  function renderPickedList() {
    const box = document.getElementById("wmPicked");
    if (!box) return;
    if (!wmEditorState.picks.length) {
      box.innerHTML = '<p class="wm-empty">No countries yet. Click the map to add some.</p>';
      return;
    }
    box.innerHTML = '<div class="wm-picked-head">' + wmEditorState.picks.length + " countr" +
      (wmEditorState.picks.length === 1 ? "y" : "ies") + "</div>";
    wmEditorState.picks.forEach(function (p, idx) {
      const row = document.createElement("div");
      row.className = "wm-pick-row";
      row.innerHTML =
        '<span class="wm-pick-country">' + escapeHtml(p.country) + "</span>" +
        '<input class="wm-pick-def" type="text" value="' + escapeHtml(p.def) + '" title="Answer shown when studying">' +
        '<button class="wm-pick-del" title="Remove">&times;</button>';
      row.querySelector(".wm-pick-def").addEventListener("input", function () {
        p.def = this.value;
      });
      row.querySelector(".wm-pick-del").addEventListener("click", function () {
        wmEditorState.picks.splice(idx, 1);
        reflectPicks(); renderPickedList();
      });
      box.appendChild(row);
    });
  }

  function saveWorldMapDeck() {
    const name = document.getElementById("wmDeckName").value.trim() || "World map deck";
    if (!wmEditorState.picks.length) {
      alert("Add at least one country by clicking the map.");
      return;
    }
    const deck = {
      id: wmEditorState.id,
      type: "worldmap",
      name: name,
      description: wmEditorState.picks.length + " countries",
      category: "", subcategory: "",
      cards: wmEditorState.picks.map(function (p) {
        return { id: uid("card"), country: p.country, def: (p.def || p.country).trim() };
      })
    };
    upsertDeck(deck);
    hideOverlay("wmEditor");
    renderStudy();
  }

  /* ---------------- quiz ----------------
     mode: "flashcard" (infinite, wrong ones recycle sooner) | "exam" (each card
           once, up to a set count).
     dir:  "find"  -> show the answer text, click the country.
           "type"  -> shade the country, type the answer text (lenient match). */
  let wmQuiz = null;

  const WM_EXAM_COUNT_KEY = "wmExamCount";
  function wmExamCount() {
    const v = parseInt(Store.get(WM_EXAM_COUNT_KEY), 10);
    return (isNaN(v) || v < 1) ? 15 : v;   // default 15
  }

  function openWorldMapQuiz(deckId, mode) {
    const deck = getDeck(deckId);
    if (!deck || !deck.cards || !deck.cards.length) return;

    mode = mode || "flashcard";
    let pool = shuffle(deck.cards.slice());
    let total;
    if (mode === "exam") {
      total = Math.min(wmExamCount(), pool.length);
      pool = pool.slice(0, total);          // each of these once
    } else {
      total = pool.length;                   // one "lap"; flashcard mode loops forever
    }

    wmQuiz = {
      deckId: deckId,
      deckCards: deck.cards.slice(),
      mode: mode,
      dir: "find",
      queue: pool,          // upcoming cards (a live queue in flashcard mode)
      pos: 0,               // index into queue (exam) / running counter (flashcard)
      total: total,         // exam: fixed; flashcard: cards per lap (for the bar)
      seen: 0,              // how many answered
      correct: 0,
      answered: false,
      map: null
    };
    document.getElementById("wmQuizTitle").textContent =
      (deck.name || "World map") + (mode === "exam" ? " — Exam" : " — Flashcards");
    showOverlay("wmQuiz");

    const host = document.getElementById("wmQuizMap");
    wmQuiz.map = WorldMap.create(host, {
      onPick: function (country) { onQuizMapPick(country); }
    });
    wmQuiz.map.load().then(function () { renderQuizCard(); });
    updateDirButton();
  }

  function updateDirButton() {
    const btn = document.getElementById("wmDirBtn");
    if (btn) btn.textContent = wmQuiz.dir === "find" ? "Type the answer" : "Click on map";
  }

  // The current card is always the head of the queue.
  function currentCard() { return wmQuiz.queue[wmQuiz.pos]; }

  function quizFinished() {
    // Exam ends after `total` cards; flashcard mode never finishes.
    return wmQuiz.mode === "exam" && wmQuiz.pos >= wmQuiz.total;
  }

  function renderQuizCard() {
    const prompt = document.getElementById("wmPrompt");
    const controls = document.getElementById("wmQuizControls");
    wmQuiz.answered = false;
    if (wmQuiz.map) wmQuiz.map.clearHighlight();

    if (quizFinished()) {
      prompt.innerHTML = "";
      document.getElementById("wmQuizMap").style.visibility = "hidden";
      controls.innerHTML =
        '<div class="wm-done"><h3>Done!</h3><p>You got ' + wmQuiz.correct + " of " +
        wmQuiz.total + ' right.</p><button class="btn btn-primary" id="wmRestart">Study again</button></div>';
      document.getElementById("wmRestart").addEventListener("click", function () {
        openWorldMapQuiz(wmQuiz.deckId, wmQuiz.mode);
      });
      updateProgress();
      return;
    }

    const card = currentCard();
    document.getElementById("wmQuizMap").style.visibility = "";

    if (wmQuiz.dir === "find") {
      // Show the answer text; the user clicks the country on the map.
      // NOTE: we deliberately do NOT reset the camera here — after a correct
      // answer the view should stay exactly where the user left it. (The very
      // first card starts fully zoomed out from openWorldMapQuiz.)
      prompt.textContent = "Find: " + card.def;
      controls.innerHTML = '<div class="wm-hint-line">Click the country on the map.</div>';
    } else {
      // Shade the country; the user types the answer.
      prompt.textContent = "What's the answer for the highlighted country?";
      wmQuiz.map.highlight(card.country);
      wmQuiz.map.zoomToCountry(card.country);
      controls.innerHTML =
        '<form class="wm-type-form" id="wmTypeForm" autocomplete="off">' +
          '<input type="text" class="wm-type-input" id="wmTypeInput" placeholder="Type your answer&hellip;" autocomplete="off">' +
          '<button type="submit" class="btn btn-primary">Check</button>' +
        "</form>";
      const form = document.getElementById("wmTypeForm");
      form.addEventListener("submit", function (e) { e.preventDefault(); checkTyped(); });
      setTimeout(function () { document.getElementById("wmTypeInput").focus(); }, 30);
    }
    updateProgress();
  }

  /* Lenient answer matching: case/accent-insensitive, ignores punctuation,
     spacing, and a few common filler words. */
  function normalizeAnswer(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // strip accents
      .replace(/\b(the|city|of|st|saint|and)\b/g, " ")   // common fillers
      .replace(/[^a-z0-9]+/g, " ")                         // punctuation -> space
      .replace(/\b([a-z])\s+(?=[a-z]\b)/g, "$1")           // collapse spaced initials: "d c" -> "dc"
      .trim().replace(/\s+/g, " ");
  }
  function answersMatch(a, b) {
    const na = normalizeAnswer(a), nb = normalizeAnswer(b);
    if (!na || !nb) return false;
    return na === nb;
  }

  function checkTyped() {
    if (wmQuiz.answered) return;
    const card = currentCard();
    const val = document.getElementById("wmTypeInput").value;
    const right = answersMatch(val, card.def);
    // The country is already highlighted/zoomed; recolor it green or red.
    wmQuiz.map.clearHighlight();
    wmQuiz.map.highlight(card.country, right ? "right" : "wrong");
    grade(right, right ? "Correct!" :
      'You typed "' + escapeHtml(val) + '". The answer is ' + escapeHtml(card.def) + ".");
  }

  function onQuizMapPick(country) {
    if (wmQuiz.dir !== "find" || wmQuiz.answered || !country) return;
    const card = currentCard();
    const right = (country === card.country);
    if (right) {
      // Correct: shade it green, leave the camera where it is.
      wmQuiz.map.highlight(card.country, "right");
    } else {
      // Wrong: shade their pick red, the correct one green, and pan/zoom to
      // the correct country so they see where it actually is.
      wmQuiz.map.highlight(country, "wrong");
      wmQuiz.map.highlight(card.country, "right");
      wmQuiz.map.zoomToCountry(card.country);
    }
    grade(right, right ? "Correct!" : "You picked " + escapeHtml(country) + ".");
  }

  /* Shared: record the result, show feedback, and offer Next. */
  function grade(right, message) {
    if (wmQuiz.answered) return;
    wmQuiz.answered = true;
    wmQuiz.seen++;
    if (right) wmQuiz.correct++;
    const card = currentCard();

    // Flashcard mode: re-queue the card. Wrong -> comes back soon; right -> later.
    if (wmQuiz.mode === "flashcard") {
      const q = wmQuiz.queue;
      // remove current card from its position first
      q.splice(wmQuiz.pos, 1);
      const soon = 3 + Math.floor(Math.random() * 3);   // 3–5 cards later
      const later = Math.max(8, q.length);              // ~a full lap later
      const offset = right ? later : soon;
      const insertAt = Math.min(q.length, wmQuiz.pos + offset);
      q.splice(insertAt, 0, card);
      // pos stays (next card slid into this index); clamp just in case
      if (wmQuiz.pos >= q.length) wmQuiz.pos = 0;
    }

    const controls = document.getElementById("wmQuizControls");
    controls.innerHTML =
      '<div class="wm-result ' + (right ? "wm-right" : "wm-wrong") + '">' + message + "</div>" +
      '<button class="btn btn-primary" id="wmNext">Next</button>';
    const nextBtn = document.getElementById("wmNext");
    nextBtn.addEventListener("click", advance);
    setTimeout(function () { nextBtn.focus(); }, 20);
  }

  function advance() {
    if (wmQuiz.mode === "exam") wmQuiz.pos++;   // walk straight through the fixed set
    // flashcard mode: pos stays; the queue was already reordered in grade()
    renderQuizCard();
  }

  function updateProgress() {
    const fill = document.getElementById("wmProgressFill");
    const label = document.getElementById("wmProgressLabel");
    if (wmQuiz.mode === "exam") {
      const done = Math.min(wmQuiz.pos, wmQuiz.total);
      if (fill) fill.style.width = (wmQuiz.total ? done / wmQuiz.total * 100 : 0) + "%";
      if (label) label.textContent = done + " / " + wmQuiz.total;
    } else {
      // Infinite mode: show a running tally instead of a finish line.
      if (fill) fill.style.width = "100%";
      if (label) label.textContent = wmQuiz.correct + " correct · " + wmQuiz.seen + " seen";
    }
  }

  /* ---------------- wiring ---------------- */
  function initWorldMap() {
    const newMap = document.getElementById("studyNewMapBtn");
    if (newMap) newMap.addEventListener("click", function () { openWorldMapEditor(null); });
    const eExit = document.getElementById("wmEditorExit");
    if (eExit) eExit.addEventListener("click", function () { hideOverlay("wmEditor"); });
    const save = document.getElementById("wmSaveBtn");
    if (save) save.addEventListener("click", saveWorldMapDeck);

    const qExit = document.getElementById("wmQuizExit");
    if (qExit) qExit.addEventListener("click", function () { hideOverlay("wmQuiz"); });
    const dirBtn = document.getElementById("wmDirBtn");
    if (dirBtn) dirBtn.addEventListener("click", function () {
      if (!wmQuiz) return;
      wmQuiz.dir = wmQuiz.dir === "find" ? "type" : "find";
      updateDirButton();
      renderQuizCard();   // re-render the current card in the new direction
    });
  }

  // Minimal CSS.escape fallback (older browsers) for attribute selectors.
  function cssEscape(s) {
    if (global.CSS && CSS.escape) return CSS.escape(s);
    return String(s).replace(/["\\\]]/g, "\\$&");
  }

  // Expose the hooks study.js needs.
  global.WorldMapStudy = {
    init: initWorldMap,
    openEditor: openWorldMapEditor,
    openQuiz: openWorldMapQuiz,
    isWorldMapDeck: function (deck) { return deck && deck.type === "worldmap"; }
  };
})(typeof window !== "undefined" ? window : globalThis);
