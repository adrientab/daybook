/* ============================================================
   demo.js — turns demo-data.js into something the app can read.

   The demo isn't a mock-up: it's the real app running against an
   in-memory backend. Everything works, nothing is saved, and reloading
   starts it over. To change what's shown, edit demo-data.js — not this.

   Dates in demo-data.js are day names, and they're resolved against the
   week the visitor is actually in, so the demo never looks stale.
   ============================================================ */

const DAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/* Is this page being viewed as the demo? (app.html?demo=1 or #demo) */
function isDemoMode() {
  return /[?&]demo=1\b/.test(location.search) || /(^|#)demo$/.test(location.hash);
}

/* "Wed" -> the date key for that day of the current week.
   Anchored to a true SUNDAY (independent of the week-start preference) so the
   demo's Sun..Sat data always lands on the right weekdays. The demo also sets
   the display to Sunday-first on boot; the visitor can change that in Settings. */
function demoDate(dayName) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());            // back up to Sunday
  const offset = DAY_INDEX[dayName];
  return dateKey(addDays(d, offset == null ? 0 : offset));
}

/* Build the whole dataset in the app's own storage shape. */
function buildDemoData() {
  const out = {};
  const L = DEMO_LIFE;

  out["categories"] = JSON.stringify(L.categories);

  /* Schedule */
  out["events"] = JSON.stringify((L.events || []).map(function (e, i) {
    return {
      id: "demo-evt-" + i,
      title: e.title,
      date: demoDate(e.day),
      start: e.start,
      end: e.end,
      category: e.category,
      subcategory: e.subcategory || "",
      feel: (e.feel == null ? null : e.feel),
      notes: e.notes || ""
    };
  }));

  /* To-dos. Deadlines are built first so plans can point at them by title. */
  const todos = [];
  const idByTitle = {};

  (L.todos || []).forEach(function (t, i) {
    const isPlan = t.kind === "plan";
    const todo = {
      id: "demo-todo-" + i,
      title: t.title,
      kind: isPlan ? "do" : "deadline",
      due: demoDate(t.day),
      dueTime: isPlan ? "" : (t.time || ""),
      linkedTo: null,                       // filled in below
      notes: t.notes || "",
      estHours: (t.est == null ? null : t.est),
      category: t.category,
      done: !!t.done,
      created: Date.now()
    };
    if (!isPlan) idByTitle[t.title] = todo.id;
    todos.push(todo);
  });

  // Second pass: a plan can reference a deadline listed after it.
  (L.todos || []).forEach(function (t, i) {
    if (t.kind === "plan" && t.partOf && idByTitle[t.partOf]) {
      todos[i].linkedTo = idByTitle[t.partOf];
    }
  });
  out["todos"] = JSON.stringify(todos);

  /* Goals */
  out["goals"] = JSON.stringify((L.goals || []).map(function (g, i) {
    return {
      id: "demo-goal-" + i,
      title: g.title,
      target: g.target || null,
      category: g.category || null,
      notes: g.notes || "",
      milestones: (g.milestones || []).map(function (m, j) {
        return { id: "demo-ms-" + i + "-" + j, text: m.text, date: m.date || "", done: !!m.done };
      }),
      created: Date.now()
    };
  }));

  /* Journal: one key per day, split into morning and evening. */
  Object.keys(L.journal || {}).forEach(function (day) {
    const entry = L.journal[day];
    const date = demoDate(day);
    if (entry.morning) {
      out["morning-" + date] = JSON.stringify(
        Object.assign({}, entry.morning, { updated: Date.now() }));
    }
    if (entry.evening) {
      out["daily-" + date] = JSON.stringify(
        Object.assign({}, entry.evening, { updated: Date.now() }));
    }
  });

  /* Rants, dated backwards from today. */
  const dayMs = 24 * 60 * 60 * 1000;
  out["rants"] = JSON.stringify((L.rants || []).map(function (r, i) {
    return {
      id: "demo-rant-" + i,
      title: r.title,
      text: r.text,
      tags: r.tags || [],
      created: Date.now() - (r.daysAgo || 0) * dayMs
    };
  }));

  /* Sleep metrics: one key per day, same as an Oura import produces. */
  (L.sleep || []).forEach(function (s) {
    out["wearable-" + demoDate(s.day)] = JSON.stringify({
      sleepScore: s.sleepScore == null ? null : s.sleepScore,
      readiness:  s.readiness  == null ? null : s.readiness,
      hrv:        s.hrv        == null ? null : s.hrv,
      restingHr:  s.restingHr  == null ? null : s.restingHr,
      steps:      s.steps      == null ? null : s.steps,
      updated: Date.now()
    });
  });

  // Study decks: turn the compact [term, def] pairs into full card objects.
  out["study-decks"] = JSON.stringify((L.studyDecks || []).map(function (deck, di) {
    return {
      id: "demo-deck-" + di,
      name: deck.name,
      description: deck.description || "",
      category: deck.category || "",
      cards: (deck.cards || []).map(function (pair, ci) {
        return { id: "demo-card-" + di + "-" + ci, term: pair[0], def: pair[1] };
      })
    };
  }));

  return out;
}

/* ============================================================
   DemoBackend — same two methods as LocalBackend and SupabaseBackend.
   Reads come from the generated data; writes are accepted and dropped,
   so the app feels fully editable without anything persisting.
   ============================================================ */
const DemoBackend = {
  name: "demo",
  loadAll: function () {
    try {
      return Promise.resolve(buildDemoData());
    } catch (e) {
      console.error("Demo data couldn't be built:", e);
      return Promise.resolve({});
    }
  },
  saveMany: function () {
    return Promise.resolve();   // deliberately goes nowhere
  }
};
