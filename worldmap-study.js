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
        togglePick(country);
      }
    });
    wmEditorMap.load().then(function () {
      reflectPicks();
    });
    renderPickedList();
  }

  function togglePick(country) {
    const i = wmEditorState.picks.findIndex(function (p) { return p.country === country; });
    if (i > -1) wmEditorState.picks.splice(i, 1);
    else wmEditorState.picks.push({ country: country, def: country }); // answer defaults to the name
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

  /* ---------------- quiz ---------------- */
  let wmQuiz = null;   // { deckId, queue, idx, dir, correct, total, map, answered }

  function openWorldMapQuiz(deckId) {
    const deck = getDeck(deckId);
    if (!deck || !deck.cards || !deck.cards.length) return;

    wmQuiz = {
      deckId: deckId,
      queue: shuffle(deck.cards.slice()),
      idx: 0,
      dir: "name",            // "name": shade->recall text | "find": text->click country
      correct: 0,
      total: deck.cards.length,
      answered: false,
      map: null
    };
    document.getElementById("wmQuizTitle").textContent = deck.name || "World map";
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
    if (btn) btn.textContent = wmQuiz.dir === "name" ? "Find on map" : "Name the country";
  }

  function currentCard() { return wmQuiz.queue[wmQuiz.idx]; }

  function renderQuizCard() {
    const card = currentCard();
    const prompt = document.getElementById("wmPrompt");
    const controls = document.getElementById("wmQuizControls");
    wmQuiz.answered = false;
    wmQuiz.map.clearHighlight();

    if (!card) {   // finished
      prompt.innerHTML = "";
      document.getElementById("wmQuizMap").style.visibility = "hidden";
      controls.innerHTML =
        '<div class="wm-done">' +
          "<h3>Done!</h3>" +
          "<p>You got " + wmQuiz.correct + " of " + wmQuiz.total + " right.</p>" +
          '<button class="btn btn-primary" id="wmRestart">Study again</button>' +
        "</div>";
      document.getElementById("wmRestart").addEventListener("click", function () {
        wmQuiz.queue = shuffle(wmQuiz.queue); wmQuiz.idx = 0; wmQuiz.correct = 0;
        document.getElementById("wmQuizMap").style.visibility = "";
        renderQuizCard();
      });
      updateProgress();
      return;
    }

    if (wmQuiz.dir === "name") {
      // Shade the country, ask for the answer text.
      prompt.textContent = "What is this?";
      wmQuiz.map.highlight(card.country);
      wmQuiz.map.zoomToCountry(card.country);
      controls.innerHTML =
        '<button class="btn" id="wmReveal">Reveal answer</button>' +
        '<div class="wm-answer" id="wmAnswer" hidden></div>';
      document.getElementById("wmReveal").addEventListener("click", revealName);
    } else {
      // Show the answer text, ask them to click the country.
      prompt.textContent = "Find: " + card.def;
      wmQuiz.map.reset();
      controls.innerHTML = '<div class="wm-hint-line">Click the country on the map.</div>';
    }
    updateProgress();
  }

  function revealName() {
    if (wmQuiz.answered) return;
    wmQuiz.answered = true;
    const card = currentCard();
    const box = document.getElementById("wmAnswer");
    box.hidden = false;
    box.innerHTML =
      "<strong>" + escapeHtml(card.def) + "</strong>" +
      (card.def !== card.country ? ' <span class="wm-country-note">(' + escapeHtml(card.country) + ")</span>" : "") +
      '<div class="wm-selfgrade">' +
        '<button class="btn" data-ok="0">Got it wrong</button>' +
        '<button class="btn btn-primary" data-ok="1">Got it right</button>' +
      "</div>";
    box.querySelectorAll("[data-ok]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.dataset.ok === "1") wmQuiz.correct++;
        advance();
      });
    });
  }

  function onQuizMapPick(country) {
    if (wmQuiz.dir !== "find" || wmQuiz.answered || !country) return;
    const card = currentCard();
    wmQuiz.answered = true;
    const right = (country === card.country);
    if (right) wmQuiz.correct++;
    // Show the correct country and the pick.
    wmQuiz.map.highlight(card.country);
    wmQuiz.map.zoomToCountry(card.country);
    const controls = document.getElementById("wmQuizControls");
    controls.innerHTML =
      '<div class="wm-result ' + (right ? "wm-right" : "wm-wrong") + '">' +
        (right ? "Correct!" : "You picked " + escapeHtml(country) + ". This is " + escapeHtml(card.country) + ".") +
      "</div>" +
      '<button class="btn btn-primary" id="wmNext">Next</button>';
    document.getElementById("wmNext").addEventListener("click", advance);
  }

  function advance() {
    wmQuiz.idx++;
    renderQuizCard();
  }

  function updateProgress() {
    const fill = document.getElementById("wmProgressFill");
    const label = document.getElementById("wmProgressLabel");
    const done = Math.min(wmQuiz.idx, wmQuiz.total);
    if (fill) fill.style.width = (wmQuiz.total ? (done / wmQuiz.total * 100) : 0) + "%";
    if (label) label.textContent = done + " / " + wmQuiz.total;
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
      wmQuiz.dir = wmQuiz.dir === "name" ? "find" : "name";
      updateDirButton();
      renderQuizCard();
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
