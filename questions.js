/* ============================================================
   questions.js  —  *** EDIT YOUR JOURNAL QUESTIONS HERE ***
   ============================================================

   This is the one file to change when you want to add, remove,
   reword, or re-type a journal question. The forms build themselves
   from these lists, so you never have to touch the HTML or the other
   JS files to change a question.

   Each question is one line: { id, type, label, ...options }

     id        A short unique key (letters/numbers, no spaces).
               This is how the answer is SAVED, so once you've recorded
               data under an id, don't rename it or that data won't load.
     type      "scale" = a 1-10 slider.   "text" = a multi-line text box.
     label     The question text you see.
     hint      (optional) small grey helper text under the field.
     placeholder (optional, text only) faint example text in the box.
     rows      (optional, text only) height of the box (default 2).

   To add a question: copy a line, give it a new id, done.
   To remove one: delete its line.
   To reorder: move the lines around.
   ============================================================ */

const JOURNAL_QUESTIONS = {

  // ---- Morning check-in (keep it short) ----
  morning: [
    { id: "sleep",  type: "scale", label: "How did you sleep?" },
    { id: "rested", type: "scale", label: "How rested do you feel?" },
    { id: "getUp",  type: "scale", label: "How long did it take you to get out of bed and be productive?" }
  ],

  // ---- Evening / nightly journal ----
  // (The per-activity "how did it feel" sliders are added automatically
  //  from that day's calendar events — you don't list those here.)
  evening: [
    { id: "happy",      type: "scale", label: "How happy did you feel today?" },
    { id: "productive", type: "scale", label: "How productive did you feel today?" },
    { id: "social",     type: "scale", label: "How social did you feel today?" },
    { id: "wentWell",   type: "text",  label: "What went well today?", rows: 2, placeholder: "However small" },
    { id: "remember",   type: "text",  label: "Anything you want to remember about today?", rows: 2 }
  ],

  // ---- Weekly review (the goal hours above it are added automatically) ----
  weekly: [
    { id: "progress", type: "text", label: "Which goals did you move forward this week?", rows: 2 },
    { id: "actions",  type: "text", label: "What did you actually do toward them?", rows: 2 },
    { id: "blockers", type: "text", label: "What got in the way?", rows: 2 },
    { id: "change",   type: "text", label: "One change for next week?", rows: 2 }
  ]
};

/* ---- Rants: a free-write stream, not a question list.
        Edit the placeholder prompts here. ---- */
const RANT_CONFIG = {
  textPlaceholder: "What's on your mind?",
  tagsPlaceholder: "optional tags, comma-separated (e.g. school, stress)"
};


/* ============================================================
   Below is the machinery that turns the lists above into forms.
   You shouldn't need to edit anything past this line.
   ============================================================ */

/* Build form fields for a question set into `container`, filling in any
   previously saved answers. Untouched scales show "–" and save as null. */
function renderQuestions(container, questions, saved) {
  container.innerHTML = "";
  saved = saved || {};

  questions.forEach(function (q) {
    if (q.type === "scale") {
      const val = saved[q.id];
      const wrap = document.createElement("div");
      wrap.className = "scale-field";
      wrap.innerHTML =
        scaleLabelRow(escapeHtml(q.label)) +
        '<input type="range" min="1" max="10" class="scale-slider" data-qid="' + q.id + '" data-type="scale">' +
        (q.hint ? '<div class="slider-hint">' + escapeHtml(q.hint) + "</div>" : "");
      container.appendChild(wrap);
      setupScaleField(wrap, val);

    } else { // "text"
      const label = document.createElement("label");
      label.className = "field";
      label.innerHTML =
        "<span>" + escapeHtml(q.label) + "</span>" +
        '<textarea data-qid="' + q.id + '" data-type="text" rows="' + (q.rows || 2) + '"' +
          (q.placeholder ? ' placeholder="' + escapeHtml(q.placeholder) + '"' : "") + "></textarea>" +
        (q.hint ? '<div class="slider-hint">' + escapeHtml(q.hint) + "</div>" : "");
      container.appendChild(label);
      label.querySelector("textarea").value = saved[q.id] || "";
    }
  });
}

/* ---- Shared 1-10 scale field behavior (used by journal questions and
        the per-activity sliders) ----
   Makes "not answered" visually distinct from a real value, lets you set
   an answer by touching the slider, and clear it again with the × button. */

/* The label row markup: a label, a value readout, and a clear button.
   `leadHtml` lets the activity sliders prepend a colour dot + time. */
function scaleLabelRow(labelHtml, leadHtml) {
  return '<div class="scale-label">' +
      "<span>" + (leadHtml || "") + labelHtml + "</span>" +
      '<span class="scale-controls">' +
        '<output class="scale-out"></output>' +
        '<button type="button" class="scale-clear" title="Clear answer">\u00d7</button>' +
      "</span>" +
    "</div>";
}

/* Wire a .scale-field that contains a range input, a .scale-out, and a
   .scale-clear. `value` is the saved number (or null/undefined = unanswered). */
function setupScaleField(wrap, value) {
  const slider = wrap.querySelector('input[type="range"]');
  const out = wrap.querySelector(".scale-out");
  const clear = wrap.querySelector(".scale-clear");

  function answered(v) {
    slider.value = v;
    slider.dataset.touched = "1";
    out.textContent = v;
    wrap.classList.remove("unanswered");
  }
  function unanswered() {
    slider.value = 5;            // rests in the middle, but clearly greyed
    slider.dataset.touched = "";
    out.textContent = "Not answered";
    wrap.classList.add("unanswered");
  }

  if (value != null) answered(value); else unanswered();

  slider.addEventListener("input", function () { answered(slider.value); });
  // A click that doesn't move the thumb still counts as answering.
  slider.addEventListener("pointerdown", function () {
    if (!slider.dataset.touched) answered(slider.value);
  });
  clear.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    unanswered();
  });
}

/* Read every answer in `container` into an object keyed by question id.
   Scales -> number or null (if untouched). Text -> trimmed string. */
function readQuestions(container) {
  const answers = {};
  container.querySelectorAll("[data-qid]").forEach(function (el) {
    if (el.dataset.type === "scale") {
      answers[el.dataset.qid] = el.dataset.touched ? Number(el.value) : null;
    } else {
      answers[el.dataset.qid] = el.value.trim();
    }
  });
  return answers;
}

/* True if a saved object has any real answer for the given question set. */
function hasAnswers(saved, questions) {
  if (!saved) return false;
  return questions.some(function (q) {
    const v = saved[q.id];
    if (q.type === "scale") return v != null;
    return v && String(v).trim();
  });
}
