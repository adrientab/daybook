/* ============================================================
   journal.js — morning check-in + evening daily journal
   Questions come from questions.js (JOURNAL_QUESTIONS); the forms are
   built by renderQuestions/readQuestions. The slider helpers below are
   kept only for the event form's single "feel" slider in calendar.js.
   ============================================================ */

/* ---- Scale helper kept for the event form's feel slider ---- */

/* Read a slider's value by id, or null if untouched (keeps data honest). */
function readScale(sliderId) {
  const slider = document.getElementById(sliderId);
  return slider.dataset.touched ? Number(slider.value) : null;
}

/* Friendly date for modal titles, e.g. "Wednesday, June 25". */
function prettyDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00"); // local midnight
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

/* ============================================================
   MORNING CHECK-IN
   ============================================================ */
const morningOverlay = document.getElementById("morningModalOverlay");
let morningDate = null;

function morningKey(dateStr) { return "morning-" + dateStr; }
function getMorning(dateStr) {
  const raw = Store.get(morningKey(dateStr));
  return raw ? JSON.parse(raw) : null;
}
function hasMorning(dateStr) {
  return hasAnswers(getMorning(dateStr), JOURNAL_QUESTIONS.morning);
}

function openMorning(dateStr) {
  morningDate = dateStr;
  document.getElementById("morningModalTitle").textContent = "Morning check-in \u2014 " + prettyDate(dateStr);
  renderQuestions(document.getElementById("morningQuestions"), JOURNAL_QUESTIONS.morning, getMorning(dateStr));
  morningOverlay.classList.add("open");
}
function closeMorning() {
  morningOverlay.classList.remove("open");
  morningDate = null;
}
function saveMorning() {
  const entry = readQuestions(document.getElementById("morningQuestions"));
  entry.updated = Date.now();
  Store.set(morningKey(morningDate), JSON.stringify(entry));
  closeMorning();
  if (typeof renderCalendar === "function") renderCalendar();
}

/* ============================================================
   EVENING DAILY JOURNAL
   ============================================================ */
const journalOverlay = document.getElementById("journalModalOverlay");
let journalDate = null;

function dailyKey(dateStr) { return "daily-" + dateStr; }
function getDaily(dateStr) {
  const raw = Store.get(dailyKey(dateStr));
  return raw ? JSON.parse(raw) : null;
}
function hasDaily(dateStr) {
  return hasAnswers(getDaily(dateStr), JOURNAL_QUESTIONS.evening);
}

/* Build one 1-10 slider per event scheduled that day, into `container`. */
function renderActivityRatings(dateStr, container) {
  container.innerHTML = "";

  const events = getEvents()
    .filter(function (ev) { return ev.date === dateStr; })
    .sort(function (a, b) { return a.start.localeCompare(b.start); });

  if (events.length === 0) return; // nothing scheduled -> show nothing at all

  const head = document.createElement("div");
  head.className = "modal-subhead";
  head.textContent = "How did each activity feel?";
  container.appendChild(head);

  events.forEach(function (ev) {
    const color = categoryColor(ev.category);
    const wrap = document.createElement("div");
    wrap.className = "scale-field";
    wrap.innerHTML =
      scaleLabelRow(
        escapeHtml(ev.title || "(untitled)") + ' <span class="act-time">' + ev.start + "</span>",
        '<span class="cat-dot" style="background:' + color + '"></span>'
      ) +
      '<input type="range" min="1" max="10" class="scale-slider" data-evid="' + ev.id + '">';
    container.appendChild(wrap);
    setupScaleField(wrap, ev.feel);
  });
}

/* Write each activity slider's value (within `container`) back onto its event. */
function updateActivityFeels(dateStr, container) {
  const events = getEvents();
  let changed = false;
  container.querySelectorAll("input[data-evid]").forEach(function (slider) {
    if (!slider.dataset.touched) return;
    const ev = events.find(function (e) { return e.id === slider.dataset.evid; });
    if (ev) { ev.feel = Number(slider.value); changed = true; }
  });
  if (changed) saveEvents(events);
}

function openDailyJournal(dateStr) {
  journalDate = dateStr;
  document.getElementById("journalModalTitle").textContent = "Daily journal \u2014 " + prettyDate(dateStr);

  renderQuestions(document.getElementById("eveningQuestions"), JOURNAL_QUESTIONS.evening, getDaily(dateStr));
  renderActivityRatings(dateStr, document.getElementById("activityRatings"));
  const jf = (typeof journalRantFields === "function") ? journalRantFields(dateStr) : { text: "", title: "", tags: "" };
  document.getElementById("eveningRant").value = jf.text;
  document.getElementById("eveningRantTitle").value = jf.title;
  document.getElementById("eveningRantTags").value = jf.tags;

  journalOverlay.classList.add("open");
}
function closeDailyJournal() {
  journalOverlay.classList.remove("open");
  journalDate = null;
}
function saveDailyJournal() {
  updateActivityFeels(journalDate, document.getElementById("activityRatings"));

  const entry = readQuestions(document.getElementById("eveningQuestions"));
  entry.updated = Date.now();
  Store.set(dailyKey(journalDate), JSON.stringify(entry));
  if (typeof syncJournalRant === "function") {
    syncJournalRant(
      journalDate,
      document.getElementById("eveningRant").value,
      document.getElementById("eveningRantTitle").value,
      document.getElementById("eveningRantTags").value
    );
  }
  closeDailyJournal();
  if (typeof renderCalendar === "function") renderCalendar();
}

/* ============================================================
   COMBINED DAY VIEW (morning + evening together)
   Opened by clicking a day in the Journal tab's week strip.
   ============================================================ */
const dayOverlay = document.getElementById("dayModalOverlay");
let dayDate = null;

function openDay(dateStr) {
  dayDate = dateStr;
  document.getElementById("dayModalTitle").textContent = prettyDate(dateStr);
  renderQuestions(document.getElementById("dayMorningQuestions"), JOURNAL_QUESTIONS.morning, getMorning(dateStr));
  renderQuestions(document.getElementById("dayEveningQuestions"), JOURNAL_QUESTIONS.evening, getDaily(dateStr));
  renderActivityRatings(dateStr, document.getElementById("dayActivityRatings"));
  const djf = (typeof journalRantFields === "function") ? journalRantFields(dateStr) : { text: "", title: "", tags: "" };
  document.getElementById("dayEveningRant").value = djf.text;
  document.getElementById("dayEveningRantTitle").value = djf.title;
  document.getElementById("dayEveningRantTags").value = djf.tags;
  dayOverlay.classList.add("open");
}
function closeDay() {
  dayOverlay.classList.remove("open");
  dayDate = null;
}
function saveDay() {
  const morning = readQuestions(document.getElementById("dayMorningQuestions"));
  morning.updated = Date.now();
  Store.set(morningKey(dayDate), JSON.stringify(morning));

  updateActivityFeels(dayDate, document.getElementById("dayActivityRatings"));
  const evening = readQuestions(document.getElementById("dayEveningQuestions"));
  evening.updated = Date.now();
  Store.set(dailyKey(dayDate), JSON.stringify(evening));
  if (typeof syncJournalRant === "function") {
    syncJournalRant(
      dayDate,
      document.getElementById("dayEveningRant").value,
      document.getElementById("dayEveningRantTitle").value,
      document.getElementById("dayEveningRantTags").value
    );
  }

  closeDay();
  if (typeof renderCalendar === "function") renderCalendar();
  if (typeof renderJournalView === "function") renderJournalView();
}

/* ============================================================
   Wire up buttons
   ============================================================ */
document.getElementById("saveMorning").addEventListener("click", saveMorning);
document.getElementById("cancelMorning").addEventListener("click", closeMorning);
morningOverlay.addEventListener("click", function (e) {
  if (e.target === morningOverlay) closeMorning();
});

document.getElementById("saveJournal").addEventListener("click", saveDailyJournal);
document.getElementById("cancelJournal").addEventListener("click", closeDailyJournal);
journalOverlay.addEventListener("click", function (e) {
  if (e.target === journalOverlay) closeDailyJournal();
});

document.getElementById("saveDay").addEventListener("click", saveDay);
document.getElementById("cancelDay").addEventListener("click", closeDay);
dayOverlay.addEventListener("click", function (e) {
  if (e.target === dayOverlay) closeDay();
});

/* Grow a textarea to fit its text instead of scrolling or needing a drag
   handle. Resetting height to "auto" briefly collapses the box, which makes
   the browser scroll to keep the caret in view and yanks the page; so we
   snapshot the page scroll position and restore it in the same synchronous
   step, leaving the view still. */
function autoGrow(el) {
  if (!el) return;
  const scroller = document.scrollingElement || document.documentElement;
  const top = scroller.scrollTop;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
  scroller.scrollTop = top;
}
