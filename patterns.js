/* ============================================================
   patterns.js — the Patterns tab.

   For now this is just the GATE. Finding real links between activities and
   mood needs a decent stretch of data or it invents patterns from noise, so
   the tab stays locked until enough days have been journalled. The analysis
   itself comes later; this file is where it'll live.
   ============================================================ */

/* How many journalled days before Patterns unlocks. This is a floor, not a
   promise the results will be strong — it's the point below which they'd be
   meaningless. */
const PATTERNS_MIN_DAYS = 30;

/* A day "counts" if it has a morning OR evening entry with at least one real
   answer. We look at the stored keys (morning-YYYY-MM-DD / daily-YYYY-MM-DD)
   and dedupe by date, so a day with both entries still counts once. */
function journalledDayCount() {
  const days = {};

  Store.keys().forEach(function (k) {
    let date = null;
    if (k.indexOf("morning-") === 0) date = k.slice("morning-".length);
    else if (k.indexOf("daily-") === 0) date = k.slice("daily-".length);
    if (!date) return;

    let entry;
    try { entry = JSON.parse(Store.get(k)); } catch (e) { return; }
    if (entry && hasRealAnswer(entry)) days[date] = true;
  });

  return Object.keys(days).length;
}

/* True if the entry holds any actual answer, not just an empty shell. Ignores
   bookkeeping fields and blank/null values. */
function hasRealAnswer(entry) {
  return Object.keys(entry).some(function (key) {
    if (key === "updated") return false;
    const v = entry[key];
    if (v === null || v === undefined || v === "") return false;
    return true;
  });
}

function renderPatterns() {
  const locked = document.getElementById("patternsLocked");
  const ready = document.getElementById("patternsReady");
  if (!locked || !ready) return;

  const count = journalledDayCount();
  const unlocked = count >= PATTERNS_MIN_DAYS;

  locked.hidden = unlocked;
  ready.hidden = !unlocked;

  if (!unlocked) {
    const pct = Math.min(100, Math.round((count / PATTERNS_MIN_DAYS) * 100));
    const fill = document.getElementById("patternBarFill");
    if (fill) fill.style.width = pct + "%";
    const text = document.getElementById("patternProgressText");
    if (text) {
      text.textContent = count + " of " + PATTERNS_MIN_DAYS +
        " journalled days \u2014 " + (PATTERNS_MIN_DAYS - count) + " to go.";
    }
  }
}

onAppReady(renderPatterns);
