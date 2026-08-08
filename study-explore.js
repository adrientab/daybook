/* ============================================================
   study-explore.js — a curated catalog of public study sets.

   These ship with the app (like the demo decks). The Explore screen lists
   them; picking one copies it into the user's own library via the editor, so
   they can edit it freely. Categories here are plain display strings (shown as
   the tag on the explore row); when copied, the deck starts with no category so
   the user can file it under their own system.
   ============================================================ */
(function (global) {
  "use strict";

  const PUBLIC_DECKS = [
    {
      name: "Spanish 101 — Common Verbs",
      category: "Spanish",
      description: "50 everyday Spanish verbs and their meanings.",
      cards: [
        ["ser", "to be (permanent)"], ["estar", "to be (temporary)"], ["tener", "to have"],
        ["hacer", "to do / to make"], ["ir", "to go"], ["poder", "to be able to / can"],
        ["decir", "to say / to tell"], ["ver", "to see"], ["dar", "to give"], ["saber", "to know (facts)"],
        ["querer", "to want / to love"], ["llegar", "to arrive"], ["pasar", "to pass / to happen"],
        ["deber", "to owe / must"], ["poner", "to put / to place"], ["parecer", "to seem"],
        ["quedar", "to stay / to remain"], ["creer", "to believe"], ["hablar", "to speak / to talk"],
        ["llevar", "to carry / to wear"], ["dejar", "to leave / to let"], ["seguir", "to follow / to continue"],
        ["encontrar", "to find"], ["llamar", "to call"], ["venir", "to come"], ["pensar", "to think"],
        ["salir", "to leave / to go out"], ["volver", "to return"], ["conocer", "to know (people/places)"],
        ["vivir", "to live"], ["sentir", "to feel"], ["mirar", "to look at / to watch"],
        ["contar", "to count / to tell"], ["empezar", "to begin"], ["esperar", "to wait / to hope"],
        ["buscar", "to look for"], ["existir", "to exist"], ["entrar", "to enter"],
        ["trabajar", "to work"], ["escribir", "to write"], ["perder", "to lose"], ["producir", "to produce"],
        ["ocurrir", "to occur"], ["entender", "to understand"], ["pedir", "to ask for / to order"],
        ["recibir", "to receive"], ["recordar", "to remember"], ["terminar", "to finish"],
        ["permitir", "to allow"], ["comer", "to eat"]
      ]
    },
    {
      name: "Biology — Cell Structures",
      category: "Biology",
      description: "Organelles and cell parts with their functions.",
      cards: [
        ["Nucleus", "Holds the cell's DNA and controls its activities."],
        ["Mitochondria", "Produces energy (ATP) through cellular respiration."],
        ["Ribosome", "Site of protein synthesis."],
        ["Endoplasmic reticulum", "Transports materials; rough ER makes proteins, smooth ER makes lipids."],
        ["Golgi apparatus", "Modifies, packages, and ships proteins."],
        ["Lysosome", "Contains enzymes that break down waste and debris."],
        ["Cell membrane", "Controls what enters and leaves the cell."],
        ["Cell wall", "Rigid outer layer in plant cells for support (not in animal cells)."],
        ["Chloroplast", "Carries out photosynthesis in plant cells."],
        ["Vacuole", "Stores water, nutrients, and waste; large in plant cells."],
        ["Cytoplasm", "Gel-like fluid where organelles are suspended."],
        ["Nucleolus", "Region inside the nucleus that makes ribosomes."],
        ["Cytoskeleton", "Network of fibers that gives the cell shape and support."],
        ["Centriole", "Helps organize cell division in animal cells."]
      ]
    },
    {
      name: "World Capitals — Europe",
      category: "Geography",
      description: "Capital cities of European countries.",
      cards: [
        ["France", "Paris"], ["Germany", "Berlin"], ["Spain", "Madrid"], ["Italy", "Rome"],
        ["Portugal", "Lisbon"], ["Netherlands", "Amsterdam"], ["Belgium", "Brussels"],
        ["Switzerland", "Bern"], ["Austria", "Vienna"], ["Poland", "Warsaw"], ["Greece", "Athens"],
        ["Sweden", "Stockholm"], ["Norway", "Oslo"], ["Denmark", "Copenhagen"], ["Finland", "Helsinki"],
        ["Ireland", "Dublin"], ["Czech Republic", "Prague"], ["Hungary", "Budapest"],
        ["Romania", "Bucharest"], ["Croatia", "Zagreb"], ["Iceland", "Reykjavik"],
        ["Ukraine", "Kyiv"], ["Serbia", "Belgrade"], ["Bulgaria", "Sofia"]
      ]
    },
    {
      name: "SAT — High-Frequency Vocabulary",
      category: "Vocabulary",
      description: "Common SAT words with concise definitions.",
      cards: [
        ["Ephemeral", "Lasting a very short time."], ["Ubiquitous", "Present everywhere."],
        ["Pragmatic", "Practical rather than idealistic."], ["Ambivalent", "Having mixed feelings."],
        ["Candor", "Honesty and frankness."], ["Benevolent", "Kind and well-meaning."],
        ["Cacophony", "A harsh mix of sounds."], ["Diligent", "Hardworking and careful."],
        ["Eloquent", "Fluent and persuasive in speech."], ["Frugal", "Sparing with money."],
        ["Gregarious", "Sociable and fond of company."], ["Impartial", "Treating all fairly; unbiased."],
        ["Meticulous", "Very careful about details."], ["Novel", "New and original."],
        ["Obsolete", "No longer in use; outdated."], ["Placid", "Calm and peaceful."],
        ["Prudent", "Acting with care and good judgment."], ["Resilient", "Able to recover quickly."],
        ["Superfluous", "More than is needed; unnecessary."], ["Tenacious", "Persistent and determined."]
      ]
    },
    {
      name: "Chemistry — Element Symbols",
      category: "Chemistry",
      description: "Common elements and their chemical symbols.",
      cards: [
        ["Hydrogen", "H"], ["Helium", "He"], ["Lithium", "Li"], ["Carbon", "C"], ["Nitrogen", "N"],
        ["Oxygen", "O"], ["Fluorine", "F"], ["Sodium", "Na"], ["Magnesium", "Mg"], ["Aluminum", "Al"],
        ["Silicon", "Si"], ["Phosphorus", "P"], ["Sulfur", "S"], ["Chlorine", "Cl"], ["Potassium", "K"],
        ["Calcium", "Ca"], ["Iron", "Fe"], ["Copper", "Cu"], ["Zinc", "Zn"], ["Silver", "Ag"],
        ["Gold", "Au"], ["Mercury", "Hg"], ["Lead", "Pb"], ["Tin", "Sn"], ["Neon", "Ne"]
      ]
    },
    {
      name: "US History — Key Amendments",
      category: "History",
      description: "Constitutional amendments and what they did.",
      cards: [
        ["1st Amendment", "Freedom of speech, religion, press, assembly, and petition."],
        ["2nd Amendment", "The right to keep and bear arms."],
        ["4th Amendment", "Protection from unreasonable search and seizure."],
        ["5th Amendment", "Right to due process; protection from self-incrimination."],
        ["6th Amendment", "Right to a speedy, public trial by jury."],
        ["8th Amendment", "No cruel and unusual punishment."],
        ["13th Amendment", "Abolished slavery."],
        ["14th Amendment", "Guarantees equal protection and citizenship."],
        ["15th Amendment", "Voting rights regardless of race."],
        ["19th Amendment", "Gave women the right to vote."],
        ["22nd Amendment", "Limits the president to two terms."],
        ["26th Amendment", "Set the voting age at 18."]
      ]
    }
  ];

  global.PUBLIC_DECKS = PUBLIC_DECKS;
})(typeof window !== "undefined" ? window : globalThis);
