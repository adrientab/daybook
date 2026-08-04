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
    { id: "class",    name: "Class",    color: "#3b82f6", subs: [
      { id: "sub-ochem",  name: "Organic Chemistry" },
      { id: "sub-linalg", name: "Linear Algebra" },
      { id: "sub-psych",  name: "Intro to Psychology" }
    ] },
    { id: "work",     name: "Work",     color: "#8b5cf6", subs: [
      { id: "sub-lab",      name: "Research lab" },
      { id: "sub-jobhunt",  name: "Job hunt" }
    ] },
    { id: "exercise", name: "Exercise", color: "#22c55e", subs: [
      { id: "sub-rugby", name: "Rugby" },
      { id: "sub-gym",   name: "Gym" }
    ] },
    { id: "social",   name: "Social",   color: "#f59e0b", subs: [
      { id: "sub-friends", name: "Friends" },
      { id: "sub-family",  name: "Family" }
    ] },
    { id: "rest",     name: "Rest",     color: "#6b7280", subs: [] }
  ],

  /* ---- Schedule ----
     Built around a college student's week. Sunday through Thursday are filled
     in; Friday and Saturday are left mostly open on purpose, so a visitor has
     room to try creating events and dragging tasks onto the grid. */
  events: [
    /* Sunday — a reset / prep day before the week */
    { day: "Sun", start: "11:00", end: "12:00", title: "Piano practice",     category: "rest",     feel: 8 },
    { day: "Sun", start: "14:00", end: "17:00", title: "Reading + week prep", category: "class",    feel: 6 },
    { day: "Sun", start: "18:00", end: "19:00", title: "Call mom",           category: "social",   feel: 9 },

    /* Monday */
    { day: "Mon", start: "09:30", end: "10:45", title: "Organic Chemistry",   category: "class", subcategory: "sub-ochem",    feel: 5 },
    { day: "Mon", start: "11:00", end: "12:15", title: "Linear Algebra",      category: "class", subcategory: "sub-linalg",    feel: 7 },
    { day: "Mon", start: "13:00", end: "15:00", title: "Library block",       category: "class",    feel: 6 },
    { day: "Mon", start: "18:00", end: "19:30", title: "Rugby club practice", category: "exercise", subcategory: "sub-rugby", feel: 9 },

    /* Tuesday */
    { day: "Tue", start: "10:00", end: "11:30", title: "Intro to Psychology", category: "class", subcategory: "sub-psych",    feel: 6 },
    { day: "Tue", start: "13:00", end: "17:00", title: "Research lab shift",  category: "work", subcategory: "sub-lab",     feel: 7 },
    { day: "Tue", start: "19:00", end: "21:00", title: "Dinner with Maya",    category: "social", subcategory: "sub-friends",   feel: 9 },

    /* Wednesday */
    { day: "Wed", start: "09:30", end: "10:45", title: "Organic Chemistry",   category: "class", subcategory: "sub-ochem",    feel: 4 },
    { day: "Wed", start: "11:00", end: "12:15", title: "Linear Algebra",      category: "class", subcategory: "sub-linalg",    feel: 7 },
    { day: "Wed", start: "15:00", end: "17:00", title: "Draft the essay",     category: "class",    feel: 5 },
    { day: "Wed", start: "20:00", end: "20:40", title: "Piano practice",      category: "rest",     feel: 8 },

    /* Thursday — essay is due tonight */
    { day: "Thu", start: "10:00", end: "11:30", title: "Intro to Psychology", category: "class", subcategory: "sub-psych",    feel: 6 },
    { day: "Thu", start: "12:00", end: "13:00", title: "Gym",                 category: "exercise", subcategory: "sub-gym", feel: 8 },
    { day: "Thu", start: "14:00", end: "17:00", title: "Rugby club practice", category: "exercise", subcategory: "sub-rugby", feel: 8 },
    { day: "Thu", start: "19:30", end: "22:30", title: "Finish the essay",    category: "class",    feel: 4 }

    /* Friday & Saturday intentionally left open for the visitor to fill. */
  ],

  /* ---- To-do ----
     kind "deadline" = must be done by then (gets a time).
     kind "plan"     = the day you intend to work on it.
     `partOf` points a plan at a deadline by its exact title.

     The essay is the anchor: it's due Thursday night, with a chain of plan
     tasks leading up to it. A few loose tasks are scattered across the week —
     including Friday and Saturday — as easy things to drag onto the schedule. */
  todos: [
    /* Deadlines */
    { kind: "deadline", day: "Thu", time: "23:00", title: "Psych essay: identity & memory", category: "class", est: 6, done: false },
    { kind: "deadline", day: "Wed", time: "23:00", title: "Calc problem set",            category: "class", est: 3, done: false },
    { kind: "deadline", day: "Fri", time: "17:00", title: "Apply for summer internship",     category: "work",  est: 2, done: false },
    { kind: "deadline", day: "Mon", time: "15:30", title: "Register for spring courses",     category: "class", est: 1, done: false },

    /* Plan tasks that build toward the essay. The Wed "Draft" and Thu "Finish"
       tasks also appear as blocks on the schedule — i.e. dragged onto the grid. */
    { kind: "plan", day: "Sun", title: "Pick psych essay topic",               category: "class", est: 1, partOf: "Psych essay: identity & memory" },
    { kind: "plan", day: "Mon", title: "Outline the essay",                    category: "class", est: 1, partOf: "Psych essay: identity & memory" },
    { kind: "plan", day: "Wed", title: "Draft the essay",                      category: "class", est: 3, partOf: "Psych essay: identity & memory" },
    { kind: "plan", day: "Thu", title: "Finish the essay",                     category: "class", est: 2, partOf: "Psych essay: identity & memory" },

    { kind: "plan", day: "Tue", title: "Work on Calc pset",                     category: "class", est: 2, partOf: "Calc problem set" },

    /* Loose tasks scattered around — good candidates to drag onto the grid */
    { kind: "plan", day: "Sun", title: "Clean my room",              category: "rest",   est: 1 },
    { kind: "plan", day: "Mon", title: "Email Professor P",            category: "class",  est: 0.5 },
    { kind: "plan", day: "Tue", title: "Buy a desk lamp at Target",  category: "rest",   est: 1 },
    { kind: "plan", day: "Wed", title: "Call mom",                   category: "social", est: 0.5 },
    { kind: "plan", day: "Fri", title: "Do laundry",                 category: "rest",   est: 1 },
    { kind: "plan", day: "Fri", title: "Meal prep for next week",    category: "rest",   est: 1 },
    { kind: "plan", day: "Sat", title: "Grocery run",               category: "rest",    est: 1 },
    { kind: "plan", day: "Sat", title: "Coffee with a Jim",       category: "social", est: 1 }
  ],

  /* ---- Goals ----
     target types: "everyNDays" | "timesPerWeek" | "hours" (per week).
     A goal counts sessions by matching schedule events with the same title. */
  goals: [
    {
      title: "Read more",
      target: { type: "hours", value: 3 },
      category: "rest",
      notes: "Trying to read for me again, not just for class. A few pages before bed counts.",
      milestones: [
        { text: "Finish Educated \u2014 Tara Westover", done: true },
        { text: "Read Circe \u2014 Madeline Miller", done: false },
        { text: "Read The Midnight Library", done: false }
      ]
    },
    {
      title: "Go running",
      target: { type: "timesPerWeek", value: 3 },
      category: "exercise",
      notes: "Preparing for the spring 5k..",
      milestones: [
        { text: "Sub-25:00 5k", done: true },
        { text: "Sub-23:00 5k", done: false },
        { text: "Sub-21:00 5k", done: false }
      ]
    },
    {
      title: "Learn to play the piano",
      target: { type: "everyNDays", value: 2 },
      category: "rest",
      notes: "Total beginner. Just want to sit down and play something I like by the end of the year.",
      milestones: []
    }
  ],

  /* ---- Journal ----
     morning: sleep / rested / getUp  (1-10)
     evening: happy / productive / social (1-10) + wentWell / remember (text)
     Sunday through Thursday only — the visitor can add Fri/Sat themselves. */
  journal: {
    Sun: {
      morning: { sleep: 8, rested: 8, getUp: 6 },
      evening: { happy: 7, productive: 6, social: 6,
                 wentWell: "Actually prepped for the week instead of pretending Sunday didn't exist.",
                 remember: "I always feel better on Mondays when I do the boring reset stuff." }
    },
    Mon: {
      morning: { sleep: 6, rested: 5, getUp: 4 },
      evening: { happy: 6, productive: 8, social: 4,
                 wentWell: "Outlined the psych essay before rugby. Past me would've pushed it to Wednesday.",
                 remember: "Ochem is heavier this term. Need to stop starting the p-sets the night before." }
    },
    Tue: {
      morning: { sleep: 8, rested: 8, getUp: 7 },
      evening: { happy: 9, productive: 7, social: 9,
                 wentWell: "Dinner with Maya. Laughed for two hours and forgot about the essay entirely.",
                 remember: "Days with people in them are just better. Schedule more of them." }
    },
    Wed: {
      morning: { sleep: 5, rested: 4, getUp: 3 },
      evening: { happy: 4, productive: 6, social: 3,
                 wentWell: "Got a full draft of the essay done even though I felt like garbage.",
                 remember: "Five hours of sleep and it showed in every single rating today." }
    },
    Thu: {
      morning: { sleep: 7, rested: 6, getUp: 5 },
      evening: { happy: 8, productive: 9, social: 6,
                 wentWell: "Turned the essay in with an hour to spare. Rugby beforehand actually helped me focus.",
                 remember: "Finishing early feels so much better than the all-nighter high. Do it this way again." }
    }
  },

  /* ---- Rants: free writing, tagged ---- */
  rants: [
    { title: "midterm season", tags: ["school", "stress"], daysAgo: 2,
      text: "Essay, ochem set, and internship app all in the same week again. I keep planning the work and then not protecting the time for it. The plan isn't the problem, the calendar is." },
    { title: "on sleep", tags: ["health"], daysAgo: 4,
      text: "Every single low day this month started with a bad night. Wednesday I got five hours and it showed in literally every rating. I want to see whether that holds up over a whole semester or whether I'm just noticing the days that fit the story." },
    { title: "post-essay", tags: ["school", "wins"], daysAgo: 0,
      text: "Turned the essay in early for once and it felt so much better than the usual 2am panic. Writing this down so I actually believe it next time: starting early is not that hard and it fixes everything." }
  ],

  /* ---- Sleep & workouts (what an Oura import looks like) ---- */
  sleep: [
    { day: "Sun", sleepScore: 82, readiness: 79, hrv: 50, restingHr: 54, steps: 6800 },
    { day: "Mon", sleepScore: 71, readiness: 68, hrv: 41, restingHr: 58, steps: 9400 },
    { day: "Tue", sleepScore: 88, readiness: 85, hrv: 55, restingHr: 52, steps: 9100 },
    { day: "Wed", sleepScore: 54, readiness: 49, hrv: 33, restingHr: 63, steps: 5200 },
    { day: "Thu", sleepScore: 80, readiness: 77, hrv: 49, restingHr: 55, steps: 12600 }
  ],

  /* ---- Study decks (term / definition pairs) ---- */
  studyDecks: [
    {
      name: "US State Capitals",
      category: "Geography",
      description: "The capital city of each state.",
      cards: [
        ["Alabama", "Montgomery"], ["Alaska", "Juneau"], ["Arizona", "Phoenix"],
        ["Arkansas", "Little Rock"], ["California", "Sacramento"], ["Colorado", "Denver"],
        ["Connecticut", "Hartford"], ["Delaware", "Dover"], ["Florida", "Tallahassee"],
        ["Georgia", "Atlanta"], ["Hawaii", "Honolulu"], ["Idaho", "Boise"],
        ["Illinois", "Springfield"], ["Indiana", "Indianapolis"], ["Iowa", "Des Moines"],
        ["Kansas", "Topeka"], ["Kentucky", "Frankfort"], ["Louisiana", "Baton Rouge"],
        ["Maine", "Augusta"], ["Maryland", "Annapolis"], ["Massachusetts", "Boston"],
        ["Michigan", "Lansing"], ["Minnesota", "Saint Paul"], ["Mississippi", "Jackson"],
        ["Missouri", "Jefferson City"], ["Montana", "Helena"], ["Nebraska", "Lincoln"],
        ["Nevada", "Carson City"], ["New Hampshire", "Concord"], ["New Jersey", "Trenton"],
        ["New Mexico", "Santa Fe"], ["New York", "Albany"], ["North Carolina", "Raleigh"],
        ["North Dakota", "Bismarck"], ["Ohio", "Columbus"], ["Oklahoma", "Oklahoma City"],
        ["Oregon", "Salem"], ["Pennsylvania", "Harrisburg"], ["Rhode Island", "Providence"],
        ["South Carolina", "Columbia"], ["South Dakota", "Pierre"], ["Tennessee", "Nashville"],
        ["Texas", "Austin"], ["Utah", "Salt Lake City"], ["Vermont", "Montpelier"],
        ["Virginia", "Richmond"], ["Washington", "Olympia"], ["West Virginia", "Charleston"],
        ["Wisconsin", "Madison"], ["Wyoming", "Cheyenne"]
      ]
    },
    {
      name: "Intro to Chemistry",
      category: "Chemistry",
      description: "Core terms from the first few weeks.",
      cards: [
        ["Atom", "The smallest unit of an element that retains its chemical properties."],
        ["Proton", "A positively charged particle in the nucleus of an atom."],
        ["Neutron", "A neutral (no charge) particle in the nucleus of an atom."],
        ["Electron", "A negatively charged particle that orbits the nucleus."],
        ["Element", "A pure substance made of only one kind of atom."],
        ["Compound", "A substance made of two or more elements chemically bonded."],
        ["Molecule", "Two or more atoms held together by covalent bonds."],
        ["Ion", "An atom or molecule with a net electric charge from losing or gaining electrons."],
        ["Isotope", "Atoms of the same element with different numbers of neutrons."],
        ["Atomic number", "The number of protons in an atom's nucleus."],
        ["Mass number", "The total number of protons and neutrons in a nucleus."],
        ["Covalent bond", "A bond formed by sharing electrons between atoms."],
        ["Ionic bond", "A bond formed by the attraction between oppositely charged ions."],
        ["Mole", "The amount of a substance containing 6.022 x 10^23 particles."],
        ["Avogadro's number", "6.022 x 10^23, the number of particles in one mole."],
        ["Periodic table", "The arrangement of elements by increasing atomic number."],
        ["Catalyst", "A substance that speeds up a reaction without being consumed."],
        ["pH", "A scale from 0 to 14 measuring how acidic or basic a solution is."],
        ["Acid", "A substance that donates protons (H+) or lowers pH below 7."],
        ["Base", "A substance that accepts protons or raises pH above 7."]
      ]
    }
  ]
};