/* ============================================================
   demo-data.js — the example life shown in the demo.

   THIS IS THE FILE TO EDIT. Everything below is plain data: change the
   titles, times, and numbers and the demo changes. No other file needs
   touching.

   Notes:
   - Days are named "Sun" ... "Sat". They're anchored to whatever week the
     visitor is viewing, so the demo always looks current.
   - Times are 24-hour "HH:MM".
   - `category` must match one of the ids in `categories` below.
   - `feel` (1-10) is how that activity felt; leave it out for no rating.
   - Nothing here is ever saved. Reloading the demo resets it.
   ============================================================ */

const DEMO_LIFE = {

  /* ---- Categories: the colour-coded kinds of activity ---- */
  categories: [
    { id: "class",    name: "Class",    color: "#3b82f6" },
    { id: "work",     name: "Work",     color: "#8b5cf6" },
    { id: "exercise", name: "Exercise", color: "#22c55e" },
    { id: "social",   name: "Social",   color: "#f59e0b" },
    { id: "rest",     name: "Rest",     color: "#6b7280" }
  ],

  /* ---- Schedule ---- */
  events: [
    { day: "Mon", start: "09:00", end: "10:15", title: "Organic Chemistry", category: "class", feel: 5 },
    { day: "Mon", start: "11:00", end: "12:30", title: "Linear Algebra",    category: "class", feel: 7 },
    { day: "Mon", start: "14:00", end: "16:00", title: "Library block",     category: "class", feel: 6 },
    { day: "Mon", start: "18:30", end: "19:30", title: "Run along the river", category: "exercise", feel: 9 },

    { day: "Tue", start: "10:00", end: "11:30", title: "Bio lecture",       category: "class", feel: 6 },
    { day: "Tue", start: "13:00", end: "17:00", title: "Lab shift",         category: "work", feel: 7 },
    { day: "Tue", start: "19:00", end: "21:00", title: "Dinner with Maya",  category: "social", feel: 9 },

    { day: "Wed", start: "09:00", end: "10:15", title: "Organic Chemistry", category: "class", feel: 4 },
    { day: "Wed", start: "11:00", end: "12:30", title: "Linear Algebra",    category: "class", feel: 7 },
    { day: "Wed", start: "15:00", end: "17:30", title: "Essay drafting",    category: "class", feel: 5 },
    { day: "Wed", start: "20:00", end: "21:00", title: "Piano practice",    category: "rest", feel: 8 },

    { day: "Thu", start: "10:00", end: "11:30", title: "Bio lecture",       category: "class", feel: 6 },
    { day: "Thu", start: "12:00", end: "13:00", title: "Lift",              category: "exercise", feel: 8 },
    { day: "Thu", start: "13:00", end: "17:00", title: "Lab shift",         category: "work", feel: 6 },

    { day: "Fri", start: "09:00", end: "10:15", title: "Organic Chemistry", category: "class", feel: 6 },
    { day: "Fri", start: "13:00", end: "15:00", title: "Office hours",      category: "class", feel: 8 },
    { day: "Fri", start: "20:00", end: "23:00", title: "Show at the Sinclair", category: "social", feel: 10 },

    { day: "Sat", start: "11:00", end: "12:30", title: "Long run",          category: "exercise", feel: 9 },
    { day: "Sat", start: "15:00", end: "18:00", title: "Catch up on reading", category: "class", feel: 5 },

    { day: "Sun", start: "12:00", end: "13:00", title: "Piano practice",    category: "rest", feel: 7 },
    { day: "Sun", start: "16:00", end: "19:00", title: "Reset the week",    category: "rest", feel: 8 }
  ],

  /* ---- To-do ----
     kind "deadline" = must be done by then (gets a time).
     kind "plan"     = the day you intend to work on it.
     `partOf` points a plan at a deadline by its exact title. */
  todos: [
    { kind: "deadline", day: "Fri", time: "23:59", title: "Ochem problem set 4", category: "class", est: 3 },
    { kind: "deadline", day: "Thu", time: "17:00", title: "Lab report",          category: "class", est: 4 },
    { kind: "deadline", day: "Sun", time: "23:59", title: "Essay: Frankenstein", category: "class", est: 6, done: false },
    { kind: "deadline", day: "Tue", time: "12:00", title: "Email advisor",       category: "work",  est: 0.5, done: true },

    { kind: "plan", day: "Mon", title: "Outline the essay",   category: "class", est: 1, partOf: "Essay: Frankenstein" },
    { kind: "plan", day: "Wed", title: "Draft essay body",    category: "class", est: 3, partOf: "Essay: Frankenstein" },
    { kind: "plan", day: "Tue", title: "Write up lab results", category: "class", est: 2, partOf: "Lab report" },
    { kind: "plan", day: "Sat", title: "Call home",           category: "social", est: 1 }
  ],

  /* ---- Goals ----
     target types: "everyNDays" | "timesPerWeek" | "hours" (per week).
     A goal counts sessions by matching schedule events with the same title. */
  goals: [
    {
      title: "Piano practice",
      target: { type: "everyNDays", value: 3 },
      category: "rest",
      notes: "Twenty minutes counts. Consistency over length.",
      milestones: [
        { text: "Learn the C major scale", done: true },
        { text: "Play through Gymnopédie No. 1", done: false }
      ]
    },
    {
      title: "Long run",
      target: { type: "timesPerWeek", value: 1 },
      category: "exercise",
      notes: "Building toward a half marathon in the spring.",
      milestones: [
        { text: "Run 10k without stopping", done: true },
        { text: "Run 15k", done: false }
      ]
    },
    {
      title: "Read for fun",
      target: { type: "hours", value: 3 },
      category: "rest",
      notes: "",
      milestones: []
    }
  ],

  /* ---- Journal ----
     morning: sleep / rested / getUp  (1-10)
     evening: happy / productive / social (1-10) + wentWell / remember (text) */
  journal: {
    Mon: {
      morning: { sleep: 6, rested: 5, getUp: 4 },
      evening: { happy: 6, productive: 8, social: 4,
                 wentWell: "Got through the whole problem set before dinner.",
                 remember: "Ochem is heavier this term. Start earlier next week." }
    },
    Tue: {
      morning: { sleep: 8, rested: 8, getUp: 7 },
      evening: { happy: 9, productive: 7, social: 9,
                 wentWell: "Dinner with Maya. Laughed for two hours straight.",
                 remember: "Days with people in them are just better." }
    },
    Wed: {
      morning: { sleep: 5, rested: 4, getUp: 3 },
      evening: { happy: 4, productive: 5, social: 3,
                 wentWell: "Showed up to everything even though I didn't want to.",
                 remember: "Five hours of sleep and it showed in every rating." }
    },
    Thu: {
      morning: { sleep: 7, rested: 7, getUp: 6 },
      evening: { happy: 7, productive: 7, social: 6,
                 wentWell: "Lifted at lunch and it carried the afternoon.",
                 remember: "" }
    },
    Fri: {
      morning: { sleep: 8, rested: 7, getUp: 8 },
      evening: { happy: 10, productive: 6, social: 10,
                 wentWell: "The show was incredible.",
                 remember: "Worth being tired tomorrow." }
    }
  },

  /* ---- Rants: free writing, tagged ---- */
  rants: [
    { title: "midterm season", tags: ["school", "stress"], daysAgo: 2,
      text: "Three things due in the same week again. I keep planning the work and then not protecting the time for it. The plan isn't the problem, the calendar is." },
    { title: "on sleep", tags: ["health"], daysAgo: 5,
      text: "Every single low day this month started with a bad night. I want to see whether that holds up over a whole semester or whether I'm just noticing the ones that fit." }
  ],

  /* ---- Sleep & workouts (what an Oura import looks like) ---- */
  sleep: [
    { day: "Mon", sleepScore: 71, readiness: 68, hrv: 41, restingHr: 58, steps: 7400 },
    { day: "Tue", sleepScore: 88, readiness: 85, hrv: 55, restingHr: 52, steps: 9100 },
    { day: "Wed", sleepScore: 54, readiness: 49, hrv: 33, restingHr: 63, steps: 5200 },
    { day: "Thu", sleepScore: 79, readiness: 76, hrv: 48, restingHr: 55, steps: 11200 },
    { day: "Fri", sleepScore: 84, readiness: 80, hrv: 51, restingHr: 53, steps: 8800 }
  ]
};
