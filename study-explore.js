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
,
    {
      type: "worldmap",
      name: "Find the Country",
      category: "Geography",
      description: "Locate each country on the world map.",
      countries: [
        ["France", "France"],
        ["Germany", "Germany"],
        ["Spain", "Spain"],
        ["Italy", "Italy"],
        ["Portugal", "Portugal"],
        ["Japan", "Japan"],
        ["Brazil", "Brazil"],
        ["Canada", "Canada"],
        ["Australia", "Australia"],
        ["Egypt", "Egypt"],
        ["India", "India"],
        ["China", "China"],
        ["Mexico", "Mexico"],
        ["Argentina", "Argentina"],
        ["Norway", "Norway"],
        ["Sweden", "Sweden"],
        ["Greece", "Greece"],
        ["Turkey", "Turkey"],
        ["Kenya", "Kenya"],
        ["Thailand", "Thailand"]
      ]
    },
    {
      type: "worldmap",
      name: "Click the Country by Capital",
      category: "Geography",
      description: "Given a capital city, click the right country.",
      countries: [
        ["France", "Paris"],
        ["Germany", "Berlin"],
        ["Spain", "Madrid"],
        ["Italy", "Rome"],
        ["Portugal", "Lisbon"],
        ["Japan", "Tokyo"],
        ["Brazil", "Brasília"],
        ["Canada", "Ottawa"],
        ["Australia", "Canberra"],
        ["Egypt", "Cairo"],
        ["India", "New Delhi"],
        ["China", "Beijing"],
        ["Mexico", "Mexico City"],
        ["Argentina", "Buenos Aires"],
        ["Norway", "Oslo"],
        ["Sweden", "Stockholm"],
        ["Greece", "Athens"],
        ["Turkey", "Ankara"],
        ["Kenya", "Nairobi"],
        ["Thailand", "Bangkok"]
      ]
    },
    {
      type: "imagedot",
      name: "Label the Plant Cell",
      category: "Biology",
      description: "Fill in each labeled part of the plant cell.",
  image: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAFeAQ4DASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD6qooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoorgPi38WPDfw4+xW2pW99qWqX2Wt9PsEDTFAcGRiSAqA8ZJ5IIA4JAB39FeB/8NO6P/wBE88X/AJwf/F0f8NO6P/0Tzxf+cH/xdAHvlFeB/wDDTuj/APRPPF/5wf8AxdJ/w0/of/Qg+LP++7f/AOLoA99orwL/AIaf0P8A6EHxZ/33b/8AxdH/AA0/of8A0IPiz/vu3/8Ai6APfaK8C/4af0P/AKEHxZ/33b//ABdH/DT+h/8AQg+LP++7f/4ugD32ivAv+Gn9D/6EHxZ/33b/APxdH/DT+h/9CD4s/wC+7f8A+LoA99orwL/hp/Q/+hB8Wf8Afdv/APF0f8NP6H/0IPiz/vu3/wDi6APfaK8C/wCGn9D/AOhB8Wf992//AMXR/wANP6H/ANCD4s/77t//AIugD32ivAv+Gn9D/wChB8Wf992//wAXR/w0/of/AEIPiz/vu3/+LoA99orwJf2n9EJwPAHi0/Rrcn/0OvTvhV8Q/D3xF0GXVNDNxDJbSeTeWV0gS4tZMZAcAkEEAkEEggHoQQADr6K8y+Kvxq8MeAdcg0Cew1PWtXliE8lppyITBEc4d2YgAnHA6kEHgEZ5D/hp3R/+ieeL/wA4P/i6APfKK8D/AOGndH/6J54v/OD/AOLoP7T2ijr8PvFoHubcf+z0Ae+UV4F/w0/of/Qg+LP++7f/AOLo/wCGn9D/AOhB8Wf992//AMXQB77RXgX/AA0/of8A0IPiz/vu3/8Ai6P+Gn9D/wChB8Wf992//wAXQB77RXknw5+PfhXxf4qg8MS6TrGg6jdrmxXUEQpdEAkoroSA2BkA9c4HOAfW6ACiiigAooooAK+Sf2oQD+0GpwMjwxbY4/6eJa+tq8X/AGgPg9qvjTXLLxX4T1GxttbgthZXEGoFxb3MAcsvzKCUdSxPAwRjOCOQDxHRLXw/cWBGo3rWt0HkIYklSgCBRgA4bJcgk4IUg84zLJZ+GYXcS3V1KfLZ1WC5jYBgiEIX2ENlmcZAAGzoa3B8BvjH/wA9PA//AIHXP/xuj/hQ3xj/AOengb/wOuf/AI3QBwvxastH0zwnfDSNb+3yhNrSxgKhUuASM4IyCRgjkHOQOK+ubb9nv4MG3iP/AAgOln5ByWlJPA77ufrXz7P8Afi9PC0M/wDwgksTjDI97ckMPQjy+lZY/Zj+JgGAPCIAHAGtX4AHoBtoA+m/+Gevgz/0T/Sv/In/AMVR/wAM9fBn/on+lf8AkT/4qvmT/hmP4nf9Sl/4O7//AOJo/wCGY/id/wBSl/4O7/8A+JoA+m/+Gevgz/0T/Sv/ACJ/8VR/wz18Gf8Aon+lf+RP/iq+ZP8AhmP4nf8AUpf+Du//APiaP+GY/id/1KX/AIO7/wD+JoA+m/8Ahnr4M/8ARP8ASv8AyJ/8VR/wz18Gf+if6V/5E/8Aiq+ZP+GY/id/1KX/AIO7/wD+Jo/4Zj+J3/Upf+Du/wD/AImgD6b/AOGevgz/ANE/0r/yJ/8AFUf8M9fBn/on+lf+RP8A4qvmT/hmP4nf9Sl/4O7/AP8AiaP+GY/id/1KX/g7v/8A4mgD6b/4Z6+DP/RP9K/8if8AxVH/AAz18Gf+if6V/wCRP/iq+ZP+GY/id/1KX/g7v/8A4mj/AIZj+J3/AFKX/g7v/wD4mgD6b/4Z6+DP/RP9K/8AIn/xVH/DPXwZ/wCif6V/5E/+Kr5k/wCGY/id/wBSl/4O7/8A+Jo/4Zj+J3/Upf8Ag7v/AP4mgD0H9qf4U/DzwT8OrPXPCvhi00fU11m0hW4t3dW2OzB15bBBGcj0qj+xoAPG/wAQ8AD9xpp4HXiauQg/Zn+J0NxFOqeCpHibcnnareSAHBGQGUjIycHHHUV7t+z58Lbj4eadql7rOoQ32v6y8bXrW2RbxJGCEijyASBuJLEAknpgZIB8+fFz5vj34+dyWYXltGCSThRbJgD0AycD3qnYRWLWEjS+SZxIARJOUKpgYKAfeJOQQc4ABwM5r2T42/BHX/EHjibxh4HvtJiudRjjj1K01JnSN3RSqzI6AkEgKCCOcE55wOH/AOFDfGP/AJ6eBv8AwOuf/jdAGeNI8IG5lVtbdIskxus0ZBUNgEgjIODwnJ4ySM1b+FXgrwV4q+PtvoGswx63o6aFcXUEE8wKmbzY1yQmMkKWOBkDg54NS/8ACh/jH/z18D/+B1z/APG6pal+zl8VdRaNrweCGaLPluuo3aMuRggFUBwe4oA+kf8Ahnr4M/8ARP8ASv8AyJ/8VR/wz18Gf+if6V/5E/8Aiq+ZP+GY/id/1KX/AIO7/wD+Jo/4Zj+J3/Upf+Du/wD/AImgD6b/AOGevgz/ANE/0r/yJ/8AFUf8M9/Bn/on+lf+RP8A4qvmT/hmP4nf9Sl/4O7/AP8AiaP+GY/id6+Ev/B3f/8AxNAHD+DYktPFXhGO1LIlt40ghgKyElEF2VABznGAB16V+gjcMR7mvmj4Rfs8eItJ8XaRqnjG50CLS9DmW7s7DS2ll8+cZ2tIzqMBThsDJJ7jrX0v+OfegAooooAKKKKACiiigAooooAKKK8/+NXjrUPA2l6bdadZWl1JeXDxMLkthQqA5G0g5JPc0AegUV83n9oPxNkA6HoYJ6AmXn/x+u8+FvxitPFmrR6HqmnLpuoTAi3aKQvDMwGSoyMqxAJAOQcYznqAeqUV89eN/jT4v0bxfrOlWVvpP2ayu5IYvMtmZiqkgZO8ZJx6DrX0DbO00EUhX5njViBzyQDgfnQBJRQAewzQAScKCT6AZoAKKUo2QCjAnoCDzSds9vWgAoryf46/ETxB4K1bS7PR4bEpdWzzSG5hLnIfAAwwwMfXrXY/CnXtQ8UeAtP13UYoVuZzKH8mMqnyyMoIBJxwBnnrQB09FFeVfFb4w23hPU5dD0mwTUNTiA895XKwwEjIU45ZsEEgEAZGTnigD1Wivmez+P3i9LgNcWOi3EYPzRCF0P5hyR+Ve1/DHxzp/jnRXvLWJrW7t2CXdqx3GInJBBwMqQDg4HQgjI5AOtoo527sHGcZ7UEEdQRxnkUAFFfPfjv40eL9F8YazpVlBpJtrK7khi8y2ZmKqcDJ3jJOPQVu/GL4peJPCniCwsNJh00xT6dFdOZ4S53uWBAIYYAwKAPZ6K5j4Wa/e+J/Amna3qKQLdXAkEghUqmVkZQQCTjIA7109ABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABXif7Wf/IA8P8A/X7N/wCixXtleM/tVWl3daBoX2W1nn2Xku7yomfGYxjOAcZwevpQB5B4H8W2vh3Rdd0+48P2urNqcIjjecjEBAcZwVJP3geCDkDmpfgto1/rHxF0cWSSMlncpc3MqgkRIhySSOmSAAO5P1ruv2cvCGk6smu/8JN4diujEYBB9tt2G3IfdtyB1wM49q960rS9M0m0+yaXp9rYwZz5dvCEBOMZIAGTjucmgD49+Kn/ACUbxP8A9hKf/wBCNe8/G2PXJtB02K18XaV4c0v7OpuDcXLxTTvgYUFASVA7DqTznArxH4oaXqknxE8SmPTL5w+ozlSts5DAsSCCBgg5GMV037Ruj66ni2DVLqC5l017GCO2mEZKQkIA8ZI6HdknOM7h6UAcRqQi0O6tLjQ/Fb312AxmltFmhEDhuArvguCMHIA7gjpn1bxL4t1XXv2coNVuL6ZdRj1OO0uJ4WMbSbWOCSMckFSccE15drNveahpmmXFj4ObTrRIjCJ7aCV/tcgwXdnOcnpwOBkge3cQadqI/Zpng/s+7806+JBH5D79vAzjGcZ4zjFAHLeDYvHPiS11bS9D1O7aCOAXV6JL1lBRMgDcSTyScKMAkc9BWr+z/wCKNU0r4gaXpsd3PJp2pTCCe2ZyUJYHDgE4BBA5HJGQc10P7NtjfQXHiwT2V1EX0nagkhZNxy3AyBk+wri/hDpuoxfEnwzJLp17GiX0RZntnUKADkkkYH40AR/FXw54i8PeIAviG6Fw940s9uwumm/d+Yeufu8kcV2XwM8GeL59R0DxTBdoNCS6LvF9uYEqpZW/ddDz279a6r9pXwdrOuRaXrejWc18bKN4biGEbnCEhg4UcnnIIGSMg461xPwm8V+PdL1fQ/C8MNwmkm+WOSKXTSSEd8v85XIHJOc8UAfTYHGDXxh8UC3/AAsLxMSxJGpXHJOTw5x/IflX2hXzF8dPh9reneLdQ1yysLi90vUJWuPMgjMhhduXRwASOSSD0IOOCMUAesal8OvCOv8AgTRbW8hi0pbe2gkS6thHE4LRjcGZhhgScnOTnnr1paJ4b8N/Czw/4i8TaNqc2qSJYjdHNPGy5DZQfIARliBk9s4rwXVfEni7xPpVh4dvbi61C2s8C3t0t8sSBtBO0ZcgcAnOPrzXq/wp+FWpR+BPEa6zELC61yyFvbwOpDwhSXV5AOhLhSB1ABz1xQB5W+sah4y8Rl/FXitrGJw7mebe0MRAJVEjU8Ak4GBwCSc9+n+BPjvWNH8WWOh3d5Lc6XqMy27xTSFxC54R0JJI5wCBwQegIBHJpp134S8QmLxV4Va6EaujWlyXSN2KnawdOoBweDyMjjPHoPwdsZNf8V2F3D8ONGsrC1lE0uoAXQEZAyNheQhnJxgYIHU9KAPP/ix/yUfxP/2EZ/5mut/aT/5HHSf+wJbfzeue+Kul6pJ8RfEjR6ZfOr6hKVK2zkMCeCCBgg57V1X7R2nahL4v0l4bC7lUaNApZIHYAgvkZAPIyMigD1r9n3/kkui/9t//AEc9d7XDfAaCe3+FWjRXEMkMgEpKSIVYAyuQSCAeRzXc0AFFFFABRRRQAUUUUAFFFFABRRRQAUUUAZIA5J4AFABQGZc4YjPocVSttW0u4W1MGo2rm7he4t1EgDSxJje6g8kLkAnHBIBxVefxFoUFn9sl1azW38tJC5lAAVyoQkE5Gd64yBnPsaANVmJ6sx+pJoqGG7tJbmS1iu7eSeMBpIlmUugPQkA5AORgng5FZlh4r8N39/BY2etWM1zPCZoUWUZlQOYyVJ4JDgggZI44wRkA2g7gYDsB6Amk7EdQeo7GoIryzm8/yry2k+zkrNsmU+UQCSHwflOATg46H0qE6tpK2X246rp4tMlftBukEeR1G/OM+2aALoYr91mHGOCRxS7mzu3Nn1yc/nWfLrOjQvIk2r6bG8X+sV7uNSnIHIJ45IHPqPWrK3Vo119kW6tzceX5nkiVS+z+9tznHI5xjkc0ATlmPVmOPUk0F3wQXYg9QSeazNT13RtOhuJbzU7WP7OyLKgkDyKznCLsBLZY8AYyT0zVx7q1S5jtXuoUuJQWjhaQCRwMkkKTk4wc4HGDnoaAJqUu5GC7EehJxVEatpJhll/tXT/LhcRyv9qTbG56KxzgE9gcE0zQtb0jXLZ7jSNQt71EkeOQxOCUZXZCGHUEMjDkDOMjIoA0KASDlSQfUHBqkNX0gwS3A1bTzDAwSWQXceyMnoGOcAnB4JB4pkmt6NHeW1m2rWIuLohYIhcIWkJUsMAHPIGR68YzkZAL4G05Xg+oGDS1S1DVtK09J2vtSs7f7PCbiYSTKGSMdXIJzjpzjHIHeqOp+KvD2mWYu9R1SG0jNmb7EwKOIAQC5QjcACwzxkc9gcAG0eQFPIHQHkClycAZOAMAelVTqOnCCKdtQsxFM/lxSG4TZI2cYU5wTkYwCTS3N/Y29wtvcX1rFOyllheZRIwAJJCE5PAPQHoaALQZwAA7ADoATQGYDCswHsSKoRavpMgYrqlj8kIndTcIGSMgEOwJyoII5IHUDvRBrGlT3sdjb6laS3EsBuI445lYvEGKlxgnIBBHHofQ0AXiSTkkk+pOaKpy6npkYuDJqVjGLYgXG65QeUTkAPk/KTg4zjODTrTULK7urm1t51kmtiomUA/LnJHOMHIB5BNAFqiiigAooooAKKKKACiiigAooooAKP8AOaKKAOR1DwBpF61+8l1eRvd3ImRomCm2QljLBGccRymSbeOp804xhcW7zwhYSi8NvL9kkuZJpSyQIQryGAg4PBCi3QAHqOOMCujooA5/RvC8On+JZ9da8kuZXeaSJJEP7gzMGkCncRtJXgYGAQCTgGqcPgayW4uJpr6SYyWBsEBt0HlR/aWnBBHVgWAzxkKCRkZrrKKAORsfAtlbaTrOnNqFxMNTsH0/z3XMsUDCQAZJIcjzCQcAcdOTmW98F2sif6JfNav9nW2Y/ZY5FZBAYGBQgDJXac54KgYIJB6migDmtH8G6Xpzq+77QV1K41AebCh+eaLyyOnQDoevY8VS8I+ALLw7c6fLHqV1epYRKsC3CZKuIFhLgg4AKqcqB1Y84wB2VFAHMxeEIRqKXU2oyypBIXtozbxhowblJ2VnAy43IAM4wCScnmn6j4Stb/xMusT3UzR5id7VgSheNXCOpDDacNzwckDBGTno6KAORtfBbW4hlj1om5thHHDI+nQlfLSJ4grpwHJR/vZHI4ABIOh4S8L2Ph2OxW3maVrRLld5iRDIJrgTtnaAOCMADjBz1reooA8/8IfDy40jRNJiutZhbUdOtY7ZJINPj8kIolDKVIzJkSsNxIIwCACW3buk+ErTS47QWVwVkguluHkNuhM2LZbcqQMY+RFwRyCAACBiujooA5nVvCEWo3txLPqMot5ZJZhD9njLJLJAYWIkIzt2knZ6nkkACpfGnhaDxNazWs17JaxXFnLZzBIUcsjuj5BPQgoPUEEgjoR0NFAHK+IfBFjq97PcG7lt0uJJTcW6xgxSpIsQdCoI5/cggnP3jkHjEGteDJdW8YXuqTahFBp9zY2VsYUtleYtbzTSgiRvuDMiAEZJwehwa7GigDirv4fWt1pdxpU+qStaSQvDGv2SLegeaKZ8vjLgvCMAjgOQScA1v2WiR2fiKbWba42GdpWlgMKlSXKEEEYIwUJPXO456A1rUUAcjP4K8yyjtE1qaKO2mMtoUtUVkBMuUkZSplBEp6lTkAnJJJ0PDPhq18PyyfYLhhBJHHGYTGMARqQoU5yByT39OK3qKACiiigAooooAKKKKACiiigAooooAK5f4oeL4/BPhCXXP7Om1S5M8NpZWMLhXubiZwkcYJyBknJODgA4BOBXUV5n+0V/yLPhkdz4x0b/ANKDQBImufHExgn4UeHlbuD4oGQfQ4jI4+tO/tv44/8ARKvDn/hUf/a69mGMGl4oA8Y/tv44/wDRKvDn/hUf/a6P7b+OP/RKvDn/AIVH/wBrr2fijigDxO08e+NtL8WaDonjzwBbaNb69cmzsr2w1cXapOFLhJFKggEA4IzjBzXpQORmuG+Pn/I6fCg4/wCZtXnH/TtNXcL90fSgB1cv8UvF6eBvBF94lbTZtTeB4oYbWOQRmWWWQRoC54UbmGTg4GeDXUV5h+1F/wAkeu8f9BTTP/S2KgCdNc+OLAE/Cjw8p6kHxQMj2OIz0p39t/HH/olXhz/wqP8A7XXsq9/qf507igDxj+2/jj/0Srw5/wCFR/8Aa6P7b+OP/RKvDn/hUf8A2uvZ+KOKAPErTx7440vxfoGheOfh/a6Pb69cvaWd7YawLtUnCFwkiFAQCAcEHjBJ6V6WDkZrhfjz/wAjz8KOP+ZpP/pLLXcr90fSgBwBJAAyTwB61yFz8UfhpbXMttc/EDwvFNC5jkjfVIgyMpIIIzwQcj8K6PXGK6HqLKxVhZzkEHBBEbEEHsa4b9m7wd4Ru/gV4Ourrwtoc80ulxvJLJp8Tu7EkkklSSSeSc0AaX/C2fhd/wBFF8Kf+DWL/Gj/AIWz8Lv+ii+FP/BrF/jXZf8ACCeCf+hQ8P8A/gsg/wDiaP8AhBPBP/QoeH//AAWQf/E0Acb/AMLZ+F3/AEUXwp/4NYv8adF8VfhlLKkUfxC8LO7kKqjVYskk4AHPc12H/CCeCf8AoUPD/wD4LIP/AImuI+PPgrwdB8FfGtxB4V0OGaHQruWOSPT4kZHWJmVgQoIIIBBB60Adx0orD+HzM/gHw5JIzMzaRZksxJJJgQkknqa3KACiiigAooooAKKKKACiiigAooooAKw/HXhXSPGfhm48Pa4k5tJ2SQNBKY5YnRgyOjjkMCAQfqCCCRW5RQB5gfg4pJP/AAtX4r5P/U0P/wDEUf8ACnF/6Kr8V/8AwqH/APiK9PooA+f/AAv4C1Cb4j+KPB2t/FP4nLJZJBqGkvF4kdDPYzAqdwIOXSVWQkYByDgV2P8Awpxf+iqfFf8A8Kh//iKd8ZGXwz4k8JfEtRth0y8/srV29bC7IQseekcojcfU/Q+mkEEqcZBwcUAedaB8ItI07xLpuv6h4p8aeI7jTJGmsY9b1p7qGCUjb5oQqPmAJAJOOehwMeiClooAKw/HXhbSfGfha88N64kzWN3sLGGUxyIyMHR0YZwQwBBwRxyCK3KKAPMP+FOKP+aqfFf/AMKl/wD4ioL/AOE9nYWFzf3vxb+KkFrbRPNNK/ilwERQWZiSnAABP4V6tXmnxvM3iGbQvhhZs6v4kuDLqciMR5Om25V7gkg5y5KRAd9x9DQByHwl+HGs+J/A1l4l1z4mfE+0fVWe7tLaLxNIDDaOxMCuSpy5TBJGAS3AGK6v/hTi/wDRVPiv/wCFQ/8A8RXpsaRxxrHFGscaAKiKMBABgADsAAAPpTqAPOtA+Eekab4l07xBqHinxp4judMdpbKPW9ae6hglK7TKqED5gCQCSRz0OBj0QUtFAEN9ALuxuLVnKCeF4iwGSAylc474znFeRfDvV/jF8P8Awfp/gsfCW08QRaPELWDUrXxLb26XMa52v5cgLKSOoPfsK9jooA88/wCFlfGH/ogzf+FdZ/8AxNY+mfG/4i6n4j1Xw7YfBN7jUtIERv0TxTbFIDICUQybNu8gZ2gkgA5AxXRfFvxfqOg2dloHha3jvfGGuyG30i3c/JEB/rLqXuIohkk4OSAOmcavw38IWHgrwvFo1nLJdTNI9zfXsufNvblzmSdySTlj2ycAAdqAMD/hZXxh/wCiDN/4V1n/APE1ieO/Efxk8Z+DtX8Ip8HbTRxrNpLYyX934ot5Y7dJFKM5WNdxIByAM844PQ+vUUAUPD2njSPD+m6SJTMLGzhthIRjf5capnHbO3OO2av0UUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAGX4s0Kz8T+F9U8Oaj/x6alaSWsp/uhwQGHuDgj3Arm/gbr17rnw6s01eQNrWkSSaRqoJywubdvLJOecuoR/ffmu4/WvNLJh4V+P17ZsxTTvG9iLyDLnaNRtF2zAA8AvAUbjqYzxxQB6XRRRQAUUUUAISACxZVAGSzHAA7knsB1rzL4NhfFPiHxH8Up0ZotVm/s7QTIBlNMtyQHUYBAllDufUBTVz47arex+GLXwlotwYdb8WXa6TaMgy0UTDNzOBkYCQ7znsSK7bQ9NstF0Wx0fTYvKsrG3jtrdP7saKFUH3wBn3oAuUUmQO4oyPWgVxaKKKBhWN428TaV4Q8MXviHWpGW0tUBKoMySuThIkHUu7EAAdznoCRsOyojO7KqqCxZjgAAEkknoABkntXlPhZH+KPjSLxpfRk+DtCuGXwzA4+W/uRlX1B1zgqp3JECOhLcHqAavwn8LarHe3/j7xnDGPFmuIqmAHcNKtBzHZISBgjq5H3nHOcZPoVFFAEGoXdrp9hcX9/cxWtpbRNNNNKwVI0UEsxJ6AAEk15unx7+GkiCSG/wBbmiblJItBu2Rx2KkR4IPUHuKu/tJ/8kF8a/8AYJf/ANDWvUfDSKnh7TlRQqraRAKvAACDgAdBQB5F/wAL4+HP/Pz4g/8ACevP/jdH/C+Phz/z8+IP/CevP/jde3YHv+ZowPf8zQB4j/wvj4c/8/PiD/wnrz/43VnR/jX8OdU1qy0eLV721u7+XybUX+l3Fsksh6IHkUDcSQACRknHUjPsuB7/AJmvIv2tlU/ByZioJXV9NIJ5IP2yIZHocEjPoTQB3tFOn/18v++f5mm0AFFFFABRRXC/GDxR4i8PW3h3T/Cdrpc2sa/rCaZbyakX+zwZR3LuEIY8JgAHvnnpQB3VFebjS/2kOMX3wpx/17X/AP8AFUf2V+0h/wA/3wo/8Br/AP8AiqAPSKK83/sr9pD/AJ/vhR/4DX//AMVR/ZX7SH/P98KP/Aa//wDiqAPSKK828L+I/iJpvxMtfBPxBg8LTvqWmT39ldaH56hDC6h0kWUnOQ+QR0IxjuPSaAAc1578f7K6/wCEEXxRpnGqeFbuPW7PLbRJ5OfOiyQc74TIMdzirnxp8av4G8FyanawrPqFzMLWyRwSnmEE7mHcKATjucDua8F0bwZ4i8c2Z8T+LPEZ+yyyMEmvS85kIJBEcIIULkEA5GcHAxzXnYvMYYd8u7OPEYxUXy2uz6Nh8deDZNPtL9vE+jQQ3kCXEImvo0Yo6hhkE5zgjI9ayL74v/DW0U7vFlncNgkLaxyTE46j5VIz6Anmvnb4efD3QRea54cvdVv1udHvdsDQadGRNayjfDKd3IJ+dSMnBXrXYr8NdADD/ie64VB5UWEQJ9gc8fXBrz6+cThJxil5M5amPqRbSR22o/H7whFldO0vXtSPRStqsKnjIOXYHGeOnHvXNal+0LqeGWw8J2Ntk/K19qJY4x3VFHOfQ0WPgPwjbnc2matqTDkfbb0InXusYGai8eXkfhfwpNJ4f0PRrLU7t0sNMS3skMjXExKp87Ang5cn/ZrkWbYitJQi0rmCxlebSukee2/xE+Inir4gnxdZtFHcafBJpVgLLSjPHhiGmZAwf5iQFznOBjgZz18fjX44zuVgfViw6g+HUH80Fdd4R0h/Dnhex8P2mo3It7OERkRuVV3yS78dSzlmJPJJrSYykbXvLwjgAmc4JPbr1rnrZjVlN8knboZzxFRydpaHn0uufHeaXzGn8TpkAbYdLijT642GkXWfjxHKsgufFb4P3X02J1P1GzpXRSX9zc+J49P067ma3twXvGMuQRggDOeOcD657A1Jfa9o9i5jkupZZTjCxSlsnuAcgce2a7lg8ylKMYKTbV7Lp69u/oZ+1qfzMzrDxz8dLFC114ek1FEBLfaNFKHGc9YmHQZHAPXoauj4/arp8gi1/wACtbyAHftvGhOewCyoOxGck9afp2vWlzPIqyT2WxRsmlucBiegAzk8HOenbOarePPFOt6ZbW+iaNP/AGhrWqyeRp9tdoJI0A5e4fdkCOMYOe5wOecVN5jhKns6yafmb08RWbspfec78RvjbZ+N4oPB1vomt2WjyureJHt5omma3xkW0TAgAyEDcxIIUEAHJrvLP47eELDT4LLT/C2vw29vEsMNvHbxIkaKMKigvgAAAAegrF8N+ENC0Hw5Do9zpOh6iAxeW6vbcebcStktIzEg5J5xnAGAOBWhJ4f8M+SRdeDdE8gEE/Z0aNwM9QQQf1rKrnNVP3Nu9ty5Y+onaL0JLv8AaF0qIq0PhHWZIRzIz3EKOvPOFBOePcf1r1jwpruneJfD9lrulStJaXce9C64YckFWGTggggj1Hcc18nfEfSrDw/4t1OwsGYWMWySNWcuY1aMOVJJJOMnr2IHavo74GaLNoPwr0KxuUaOd4TcyoeqNKxfHtgMBj1zXdleNrYicoz1SOjBYmrVnKMtka3xI8Njxf4C13wsbn7L/alk9ss+3cI2PKkjuAQMjrjOOa5HT5f2jbSwt7VZ/hS6wRJGGaLUMkAAZOCBk+wFd94i1zRvDuky6tr2qWemafEQJLm6lEaAnoAT1J7AZJ7A158PF/jjx2pX4c6TFouiScDxLrsLAygj71raHDv1GHk2qfQ17Z6Zm+NPHfxr8HaWupeJdZ+EGnwOwSFWi1FpJ3OcJHGCWdjjooPvik8FeLv2lfE2lvqUnh/wDoUJkxbx6rbXsU06Y/1nlhyUB4wHwfbHJ6/wZ8NPDvh7VP7fuWvNf8SsMSa3q8xuLrPORHn5Yl5IAQDAOMmu1oA85+3ftH/89fhN/wB+9Q/xrG8WeGfjV47srTw/4w1PwBZ6F9vtrq9fSIbs3TpDIJAieblQSVHJxj6ZB9fooAVyWdmIwWJOB7nNJRRQAUUUUAFeafGjjxb8KuR/yOEX/pPLXpdYPjjwf4b8a6KNH8T6Yl/aLMs8YMjRvFIucOjoQyHBIyCMgkHg0Ad6h+UcHoO1Oz7GvDP+GfvhT/0BNS/8Ht5/8do/4Z++FX/QD1L/AMHl7/8AHaAPc8+xoz7GvDP+GfvhV/0A9S/8Hl7/APHa5rx9+zX4YvrGGfwbc3mkahbMXEF3qF1PaXnTCSnzPMQcEbkIIzyDxgA7fxrj/hp7wcM/8y1qfHf78VegeteJfBK2+H/hnxZNpFx4Sm8G+Op4TAYNRvpboXkQIYmzuJHIkjJAJUYYEcg4zXtvrQB47+1jDI3gjRp1QmKDWYzK2fugo4BP1PFVvC+X8G+FoiBsj0pGIGMbySCeO+Rz716P8TfDw8VeA9Y0LH724tibc45EyfPGf++gB9Ca8Z+DWqHUvBEcEhxPptwYip6iOXLAH6OHH4ivls7pNTUujPFx8GqnN0Zg/F7VZfCPizR/EunSWy3OoW0ulXCS5wF3B4pT2IR8jnj5sdAaz/BHiPxDfeMrC2XUNQuxK5N6k8yPGYgMsyqBhMHGCDg5HqRUPxX3X/jyS2fay29tAsQYEkE/PlB0LZJIBIzjjkCuo+C1nC+kXusMh+0T3LQAtk7Io8YUZOQCSSR6n2qZctLBqUkm2rJn6CsFh8q4deIqQU51VZO2qb/yWvqdlr11NY6HfXluu+aC3eSMEZBYA4yPQHn8K8ts7TV774hy3MFze6x/wjAT/RpmaUXN9Kv7wLg7UZIjwcYDEDrXrk8STwSQSLujlQow9QQQR+RrD8H5t7KbQEi+zT2jlZrfToQkt3kDFxI5GAHHU56givm8Rip4aDqQV3a3pff8PzPzKFuZ336Gql9aS6UNQSVRbPHvDMdoA75PYjkEdcjFcn4h8SXUsbW1jvtskfMTiQAngsf4BjJAGScdua0fDkVuX1zRNsJs4rsBI0cyoiSAEpu4zgk5I4GTzxXK30gtdUl+z26W8cEjCFHBJ4zlyTyeOcnnJGOQMfe8E4fDYpynKnzzSTV9v+HIT0GedIllJY2qyRLw5VSC0h6EkdSehy3AzwAao2101rHMwlSISxmNmaTBIyDkHOSeOvA6joTT4A17crHb26odxCbM7iQeckk8jux6dBkgV1Wj+EkZBLOAcjkjKr+Hc/Un8K/Q6mIpqHsowV+vr663Z6uDyqriVzbR7swNZ8SeF9H0Oe7udPk8mEfMTPKxdjwFUdDknAGSOR6Gt34Z6PcmW58W64iLrepxIvkKdw0+2BJjtkOOwwXPduT05san8PtD1HUdOvboFjYM0kMAUCEyEAB3X+IqM4JOBk8U+40O501vtOmXDwEdgxaM+xByR9ea+UzfK6uMp2pS1822397Z6EsjlGDVOV2djod/oOny6j/btkZZZQFt3eAyKY8fdXAODnJPc5FZlpGx04xmN4w7ERxsMlFLnap+gI/l2qv4f1cahFLFKohu4OJkzgDHce3f8fSsG98d/a9T/srwRpj+JNSiuER5kYJYWz7lx5s/QkZGVXJ6jg18FVpVeZ0pRs1ZO+yt+R4k41LeylFLlOX8SRadrPxsls7+e1tdPm1cJdyzTBIxDCAZCWJAAIiI5I64r2GX4kaz4tknsfhNoMeqwo5ik8Q6ixg0qBhkHy8DfckEDhAB05Irwv4ZeFo9d+O9tbeN1tNa3XeoSS2XlEWSyoHOVjPLDcCRv7YyK+wYo44okiijSONFCoiKFVAOgAHAA9BxX0WUUYU6T5Xdt6s9DAU1GDad3c4Lw98L7CPV4PEfjPVrzxp4hh5iudRUC1tCQM/Z7Ufu4hxwSGYdcg16Ackkkkk9ycmiivVO8KKKKACiiigAooooAKKKKACiiigAooooAKKKKAMXxj4V8PeL9GbSPEuk2+pWZJZUlBDRPgjfGwwyOAeGUg1wnn+OfhiMXh1Hxz4NTAFwq+Zq+loByZAMfaoxjO4YcDOQQK9VoGR0JB65FAGT4R8S6F4r0SDXPDWqW+pWEvKTQnOD12sDgqw7qQCO4rwHw/bNofxx8WeGlUJDdvO0KA8cgXMWPyYfie1eqeLPhxv1qXxZ4E1QeFfFEmPPmji32eogHOy6gHD55G8YcZzk4Arw7xb4k1mx+P2h3fjHQU8N6vKLVJQk4mtLvbKUMkEgwWUoQCrHcDwc4ry82oupRuldo4cfTcoJpbG78R/B9xrM/wDa+n6ha2fmW6xXi3KFkdASVYYB+YZIHHpgjvoeE1Xw74di0+CzurlIMvJKSqu5JyWCE5AyeAcdq1NZRn1WXT8hVs5GX5jgB8nBJ6cDGO2T2qnc3McFrLMxxEiEZJ4PHOOnbr6kr6itMsyaNfCKWJenRdj2aEq+Ly+FDEzvCOy7HQafd6fcPaXc8dzdaY4LSC3yHPHy8Ag4BzkDnOO2aytS0OLVYlkkmvLKdGcQyxy4lWIsSqOeQ2ABkHPIqp4bvGt9Kt9Os7aS7usF5ApwqFiTgn2zjj3rZ+zeIAFaeXTLbewVVcMck8AAgjJNeNTybF4uLjSp3gno3p37nxdapTTdNapPcg0TSbTQdPeK1ZmXcZppZjl5Dg5JPAHQewFedzTSXKyM23z5ZN6OrH5ckhieTnHUenPJzx6jcRXUMEiajbJ5TqUaSFiyYIIOR1HXryPevM9VsWstaliiRzBGTHEW5BUIxBz35I59TX1HDOEngFXp148s7Xi/S/UdDlnJRT6o6jwNpcK2guGjABUEA9cc7QfYDn6k1teI9Yi0exEzJ5s0jCOGLdje2CeT2AAJJ9B6kUnhgKNMVVAAAXAHYbRiuZ+KpaCXS7tywgSR439AWBAJ/EY/E19NSinJRP0WMVBcqWiRm3mveILlyw1aW2OchLaNAg9sEEkfU81R0r4qXUWoXHhuTTpPEOujC20ViFXzCR0mY/JGAOpPIGeKp6rZw6hp0trPLPFDIBveGUxtgEEgMOQDjBx1BIrH8NWllb+J9MtPD9pHbQQSqf3QwCASWYk5J44yck/lXXXo3VopJLr1IlzXSWhvaz4U1q9v4dT8b3Vu9mzqH0fTXdLcIScCSTIeXBwCDhfqK9P0+2s9NtbOHTrOC1tYXjKQWyBY1G4EAAAY7c4z61n+NyP7IfcVDeWSM+uRj9cViadqpg1ecXV7MIDbIiISSquCAMD1yHyfbNfFZ3lNXEtzpN+6rtd9Uv1Pnc9pckoyT33DwdCYP2pTGYhHi51BgB0wYiQfxBB/GvpCvnSwc2n7Vdm4k8wXUjDpjaJLMED8MfrX0UOledk/8BrzOfLv4b9RaKKK9Y9AKKFBZgo6kgDPua8q0bx58SfFTX994N+Hek3ei29/PYxXF/rvkTStC5R2KKhCgsDgZJwKAPVaK85/tb45/wDRMvC3/hSt/wDG6P7W+Of/AETLwt/4Urf/ABugD0aivOf7W+Of/RMvC3/hSt/8bqtqviX42aZpl3qV18MPDbQWkDzyrH4lYuUQFiBmPGcA4zxmgD0+isjwZrtv4o8I6R4ltYJYLfVLOK7jilILoHUEAkcEjOMitegAooooAKKKKACiiigAooooAK+fP2t9Ns7zWPCL39lHPayi4glDfxDdGwGRyMAsQQQQTxX0HXif7UarJd+CIWIAfUpVI9iIxn9a4swusO2nZo5cZdUW0cT4g0TxX4G1S+k0Y3vizQY5GDWs0hbULVQBgIxI89AOMHDjHBPOZ/CJb4g3MI067hms1I3xwgjyiDkrICAVYHPBA5yTmvQfFNwbafV50IDJMwUn1wAP1rD8O/Da3u9Bn8aaLqt34c8TLuMeoWoBWdcYKXERwsqHjIOCCMg5FY5HjK+LvSn8Mfx8jznj6s6f1dytfqjZ+36T4f1iPRYgqRCB5ZpyOMgZBJPqAf0qppEl94h1uLVmUw6ZaMfJRl++3IJwRyc9T0GMAZJI8z0LxBJqHjE2nj8W+i3EswgjvYt32G8cZ+SORhhGOCQshBGeOcV7vDHHDEkMSLGiKFVVGAoHQAV9rhZOqrvZbI48RTjQtGK1fUeQCpBAIIwQe9ch4h0mF3ktZIQ4KO9oxzlGwcqPb2PH6V19Udbt2nsi8XEsREkZ9x1FVj8J9aoSprR9PU4oycJKS6HHeC7sfZVgcgEDyyPQrwPzGK1te0u21fTpLK6UMjjHPHP17djntiua1Mf2bqA1GNStldnMmP8Alk4JyT9Dn8PpXRWWqRNGBO2DgYccgjseK5MFifb0lJfEtGuzR+lYLERxVFVIv1PO5vhrf+cYo9QcwA8Bo8kD8CAe/PFdh4S8IafoQMwUyTkDc7nJIHP0A74H45rea+tFG4zofYcn9Kxtd1qOO2ZjuWMnAUcvIewA/wA+/Fdsqs3H3nojpslrsZ/im6W8uY7YNhGO5/aJOST9SP0rmIpY59Sae7J8ouC+AWwifMeBycttA+tW726MNtNcShpLiUhXCKSFA5EYx1xgE49AOpOOZ0zU9cvj9i0vwNrU7yKQftEsNqNicE5diRklhyP4iRnAwUJRp0KuIre6pKy/w9/n0+R8dmWJ+tVnyfCtDv53QftC+CNRlkj8u7toHQgYJYwyoCfckAD8K+hwRgc18k+LJ/Hq+N/Ampf2F4e0edZ4rexL3cl2jES7VMgRV4BkJIByR+vug8JfE69m3ar8W/skWRmHRfD1vBnAII3zGQ9eenboO3wuVRUabSfUvAR5YNNnoaKz8IrMf9kE/wAqo6trGj6RE0ur6vp2nRqoJa7u44QATgElyMAnjPrXEL8ItHuTnX/FnjvxBkJuS+8QzJGxXPVIdg5PPr0wfW7onwh+F+jsj2PgTQzKhBWW5thcyAgkg75S5znvnPrXqHeQ3Xxo+F1rdrBH4ysNQnDDEOmJLeufnAwBCjZJJAAzznik/ZKnS6+F11cxiQJNr+pugkjKNg3TkZVsEH1BAI6HpXc2Fra6fCsNha29nGowEt4ViUc54CgDrz9a84uPgvoQ1C9udJ8WePNAgvLl7p7LSfEMlvbLK5y7IgBxk8nk8njjAAB7dxRxXh//AApq1/6Kb8Vf/Crl/wDiaP8AhTVr/wBFN+Kv/hVy/wDxNAHuHFYXxB/5EPxAMf8AMMuf/RT15Z/wpq1/6Kb8Vf8Awq5f/iajufgnp9zby2118RvijcQSoY5YpfFMjI6EEFSCmCCCQQeoJoA3PgH/AMkQ8Ef9gO1/9AFdvVLQ9LsNE0az0bS7dbaxsoEt7aFSSERRgDJJJwB1Jyau0AFFFFABRRRQAUUUUAFFFFABXhn7SVs1748+H9oHwZJpQOehMsGD/Ovc68I+PXmS/Gr4fW6k4BVwP+3lc/otcGZf7vI5Mb/CZpeMgXtNWKZOblzx3G+un8FPNf8Aw1u9PsFSS8+zssSyNgEkAAk54GfcfWsO7ijmS7imx5byShiTjALHnNZXg3WLrw9qZtS6kA5TBBWRDnofzP4kdq4uFa0PazoSdubZ9LrofOSn7Oan0L/h3w1anwg+j65YQ3cd2ztd29xGGV8nAyDnngEHOQTwc80vgrwtN4We5s7TXb270PaostPvAJGsiCSQkxO9kIwAjZxjqa7N2tNWha/0w5brNCfvA9yB3HqKo1+i0oQSStZoJ1ZtvW6YUUUV0mBzOrWccE8kE0YayuT0PRT657dvpwfWuem0DVLJ2GmXCSwZJEUo6fTpj8Dj2r0K7t4rm3aGZQysPy9xWJNY3toGTy/tdv2wcOB6e/8Anmvmc1y3FRq/W8DK0n8Ue/mdeCx1XCN8jdjh7651e2ZI7iC3t2kBZCMuSAQCQMgADI5J71kvKZZWYztcTbTuKyDIHoW+6g9xk/Su/uY9Nvdsd9FC5QkgTxAEE5Bxnjpj8qrS+HNMmeZ1ib5xx83yAkY3IBwCOCDyAewxXHh8+hhmlmFKXMvu+7T9fQ762a18THllLQ4W1hE6xXAaSQOfLW2iXkkE4RDnocA56gck5rvvDelGxtmkuBE1zOAZSoOAP4UGewHHTk5Pel0TQbTTGSRQ084UqJpSAUU/wgDgD6dcc1yXjTxtrOk+LJrCxtrZ7WzhSWZXjLPNkZIDA/JxwDgjIyeK87POIKmbf7Nhvg313f8AwF0RtleVYjM6ro4fWSTZP8a8W/hzw3q4yGsNWdCQ+HxuSQBR/wAAPPb8a+kywclwMBiSB7HmvnX4keTr/wAHtTu7Ms8Qltr2IgAHY4KHOfTdzjnIr274f6gNV8C6BqQIP2nTYHJAIGdgBwDzjIPWuHI5WUovcvAKUJyhJWa3Xmjcooor3z0gooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACvCfjnIIPjn8PpmHy4C59zcAf1Fe7V4X+0dJHafEXwDqDLu8uRyV9QJ4iP1NefmX+7yOTG/wAFm7FLaQazDcahaPd2UdzKZY1TfhskISvcA545wSDj0zfEKaJe3l9fGJNLsGKCFpMQ4cA5cA4wCccd8Z961rpQuoXiL/DcyAD8TXNxadF4guLrU72xurm1gleCyMWyRECHEkhjPJJbIz1wAB7/ABNfH/VqV3fTa3rf7/M8Rzbg6dkx2k6nf6NqUaSTiRHwYLhSNsg7ZIODn19fXOT332uDULZbuMBZScOAAAx9cdj6j6EV5l4e0y3l0nVdHgZ2gtL51tS8ewxZVWKYycAEkYz0OfStzwZqTH9xOSG3eXID2YdD+PQ+9fpXCucvMafsqr9+Kun3XmefJOm/I66iis291q1tpZIgryshw2GAAPcZJHI7+nSvr0nJ2QOSS1NKioLG6ju4DJGGUg4ZWxlT6HBP196npNO9mNO6uVporO98xD5crIdjlSMocZwSOQcEcH1rH1nS5dJnSSCRvImUNG4HBHcMOhIORVjzo7PxMVVsxXoEcnos6jK/iU4/Afj0eqWv23we7EZa3lJQ+gOD/M1zuUKloVUpRbs0yp0dG1o7XOStJxOhzgSJgOo7Z6Eex7fj6V4z8WZ4p/G96I5FUwWsUcmSASQC5HPsyjAwa9VgkEWo2x5AlzERjg8Fhn6EH86zNV8C6VqWvy6rc3F0UnZWuLUEeXKQABk4yAQBkA4OK/N80wlLJ8ynBfDa6+Z9ZwbnOHy7EPE17v3Wlbq9Clplq3/Ckr60nhcv/YizBAcHKyhxn8CCR6ZFekfs3Xhu/hDpSFwxtJJ7XIJJASUkA574I9ulc9r8qWvhjxJMUzHFo8qkKOmeAMfj+lbP7MFuIfhFZSBXHn3dzKdwxn96VBHsQormyWTlWk+5x0a7r4udVq3M2/xPTqKKK+nPTCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAK8B/atlktvEvgy6RdxjFywB6Eh4iB+le/V4N+13GfJ8LTpxIJbtVPofKUj9QK4MyV8NI5Mb/AAZHU6nkaxf4GG84sOPUAiuO8GXek2/hKG7uzb74VczGG7aGfcHZmBDcFuB0IzxjmutuJGe8dnO52hgYsO5MSkn881gyeFPDzakdRk0+PziwYguQhfOdxTOM5xzivz7GYZV1yt2SdzwkpKV4q/Qf4Pgnj0g3V0ZjcXsz3UnnHLjecqGPchQo/Cq2qL/Z+tpdqdsN38rkdA46H+R/E10NZfiafSo7Awanf2tn5pxC08oXLD0yeevPsa9TLcZLA4iFaH2X+BnVpqUGmdXYTi4to5h1Iw3sR1Fc0US0uWivPOjlWYyB4sLvGeBk8kHk55xkjGeareEtYaEtbXLEsmA4znIHRx68dcdeD3rs0ZWQOrBgeQQeD7iv2zDYqnXpKtS1jJHAveVnujL8OW0kFvK8isnmMCqsMEAA/kOeAccD3rVooqpNybbNYpJWOaurYXer65ZQFo7kxW9zETnBkAIDA+21VP1rtdMuo7rwCt9jaLo7ypPKnOCp+hUisvRrC7u/GBV1iWxexDbzw5YSAED1GCPoal8ZXVjY2z6bpkaRLJK8rqhJBdj8xA7fhxknFcMU6tdQh3uzrk1Ck5S7aHC3J/0myUNgm6TAzjI54pnivxGnhvTbbVtQtr06fcCRlmg02eeKNUbb+8lQERseSAQQQCSRSqftGu2sC4IgBmk9jjC/zz+IrX+zfuzbi5uhaltxthMRETnPI9M84zg+lfFcWYuhPM2pa8qS/wA/zM8v5FBuadmcZ4t8Z+GNR+GniKbR9fsL6S48i3VLe5HmhS4Jyn3gCAQQQM8817H8GrA6b8KvDNowIYadHIwznmTLnn0+evBP2gdC0S78MaNu0axk1S/vpmFwsKrOyjCAbgASCWHU9QK9dg+F2taFaRweCvib4o0YQqqpaagU1S0AAxgRygMg46K/A6Vx5NCnrKF/me3gIxbbjc9Morzg6p8Y9DkA1Dwt4b8X2oODNo181hc7cnnybjKE4wcBwODz0oT4y+FLOcWvi2z17wZcsQNuu6a8MRJ7CZN8ZHvuHTtyB7p6h6PRVLQ9V0vXLJb7RNTsdUtXGRNZ3CTIR9UJ/Wrgx2OaAFooooAKKKKACiiigAqvqF7ZadZyXuo3ltZWsePMmuJljjTJwMsxAGSQBk8k1Yry34+2FlqusfDTSdTtYrywu/FsSXFtOoeOZRBKQHU8MMgHBBFAHZ/8Jt4K/wChy8N/+DaD/wCLoHjbwVnA8Y+G/wDwbQf/ABdTr8IPhSVB/wCFbeEeR/0B4P8A4ml/4VB8Kf8Aom3hH/wTwf8AxNAGHJ8V/hfHI0b/ABE8LKykhgdTi4IOCOvtT7T4p/DO7uEt7f4g+F5ZXOFUapECT+JArZ/4VD8Kv+ib+Ev/AAUQf/E0f8Kh+FRGD8N/CRH/AGCIP/iaAKzeN/BKjLeM/DSg8AnV7cA/+P03/hO/Av8A0O/hf/wcW3/xdee694C8D6T+0h4YsdL8H6DZ2l34c1B7i3i0+IRSMkkWximNpIycHGeetej/APCGeDs/8ij4c/8ABTb/APxFACJ418GOyrH4w8OOzEBQuqwEkk4AHz85rx79rTULGWPwvBFe2sjCW7chJ0bA8tRzgnHJr0+X4W/DOWVpJPh54UaRiWZjpEGSSckn5fU14V+0p4O8H6X4n8P6doPhLRdOaSznklFrZRxiQl1RMhRkkEHH14rizFxWHlzbHLjGlRlc6vUr6Obw3ZPHfWe46fZGctMpI/dLkgZOSDjIIPGaz7zVY3YQy3U09sQm8K+GQrgEg4wQSM7hyCSCMdL978OvBK3RSDwvo1pLbyRgTW9lGrB4wASDjIJIJz1zznIrJu4ZkmNncIVVH2RyEYdCc4J7EHgZGM5wRk8fA4vkUrwbs+6/4J7XDKw9eDpPWS/J/qbek6xPJdxwTyJNHLK6hwuCDk4AxwAAOAeSO/HLDpttqHjK++22092yWkCwRRxA4Ri+7LNkKCw54549KwtKuZbC6U28iLKZAFgbHz54IBJGMHqc9ADjuOi8SobWa11qSKaWC3Ux30EMhUvEeQc45CMM9OhOK5KqnUoyjF6nncU4Glhq8JU42i+nn5mIdHk0rXBptrPBG0kRnsoUnMhiCkBoiT14IIHQDI4AFbuieIJIXMEuIZAcNFJkKT3xnofb+dUdV1Wwu9W0Oz0y5tZXW981I7KIGPZsYOTITubgjnAHNdA2gf8ACR6h/Z1vHCtwIjI88hICJnAGByxJzx2r6XhbP8XgocrV49U/z8j5GeGVWdqe5uWPiHTdoF7YEHuVYg/of6VpxeIvDUXzLZyM4GRuBIz+NeaXuja7o2rXGlRzxXDQIsmFPyspJAIB6HI6A1Eb7U4iVn0t92ONqtyfyPH41+hU+Ispqr97KUH21t+Bi/rFJuLWp3Gs+JIrnU01Czs/JuYrd7ZJSxBEbMCRgHHJA5xnj61ymr6l5IMkh824fhVzyfTOOg//AFCodLtvEetanFp1naJbySKWLyAgKoxkknJ78YFaFp4efRtVlt9UTzL5AHV87kZSSAyk8k54OeRWGP4pwuFouOAjeTW/Zd7bsSw9esued+VP5GSst/pcSi1svtusX5LlGyEhjH8TkAkDJAAHJJAHQ1f8L6zcagLy11G3it7+yYCZYmJR1YEq655AOCMHoQaNGSe68Ta5cx2t7N5JitA9rciNkATeQR3BL5z6iltHMvjHUwW1BmisYEkF4AGVizsAMdRgg5PqfSvyKWPqV8ZKMtet/M64w5Yprbscz8T0+1eKfh7pcjCWF5oWeMdf3l0uefcL+lfS7nLseuST+tfNHi+SOD4u+ApZPuqtgCPrcSgfqRX0sRgkHqOK+4yNfupHsZb8MgpGAeJomAaNhgowyp+oPBpaK9s9M4TXPhB8OtUvDfjw3DpV/kt9t0eR7C4BOcndCVBJyc5BrmtQtta8LXTWuifHnTmkt+H03xhJbXJBwMAyo0cy9uoJwfXr7FF/rUzyNw6/WvG/2dvh74F8R+DNU1XxB4O0DVtQl8RaoJLq90+OeV8XLgAu4JIAHTP8zQBGvxl1XRdy+JdD8O6tCi5N54W8TWtyD1z/AKPO6SDp0BP1z16DwX8b/hd4r3Jp/i2ytbhAS9vqWbSRQCAf9ZhT1HRj39Djr/8AhUHwp/6Jt4R/8E8H/wATR/wqH4U4x/wrfwl9P7Hg/wDiaAK//CbeCv8AocvDf/g2g/8Ai6B428FkgDxj4cJPAA1aD/4urH/CoPhT/wBE28I/+CeD/wCJrF8c/Cb4YW/grXZ7f4d+FYZY9OuHSSPSYVdCI2IIIUEEEAgg5FAHYDkZHSlrivgM7yfBTwTI7l2Oh2pLMSSTsHUmu1oAK86+N2meIrg+Dtc8O6FLrs3h/wAQR6hcWMM6RyyxeU6HYXIBILA4z0/HHotIRkYPIoA4QfFPx0AAPgd4v4/6e7T/AOLo/wCFqeO/+iG+L/8AwMtP/i67raP7o/KjaP7o/KgDhf8Ahanjv/ohvi//AMDLT/4uj/hanjv/AKIb4v8A/Ay0/wDi67raP7o/KjaP7o/KgDy/RW8XeLfjTpni7VvA+o+FtO0jRbqzzqFzE73EszoQEEZOAAhJJPt6Z9SpAAOgA+lLQAV8y/E/VLbVP2hUW4dBa6dc2NgzPjaMOHfPTjc+Mk8Yr6a7Gvjf4v2k+hfFHxJFq8Bghv717q2ldSI5Y5OQQTweuD6EEGvJzjm9grK+up52ZOXstEe46j5lpfXEd5HJGTK7hiCQwJJBz+NZl7b6dfF2LOszx+WHjBLKAcggYIyCOCR615L4f8b+MEiFjoWuazeqoASGCM3e0AHAGVYjgHv29q3r+8+M5tWv7uLX9OtYcb7i7mgsIQD3ZnKgjHftXy0cJUqbRbR5uHqVqcueldNdjubbw/HJFPFDbalNHKBtCQkFMHJwQO5JJz6kVsxWOobBHHpd1tUBQGABwBjGCcnivnSHV/GniPVm07RItb8VzxPgtpt7LdQxkk5zMCIx+eORXU2Hwa+LeoNFeXWh6BYo4JeK51XfcDrwSoKg9CRk/WuiGUV2m1Gx1VpYzEq9W7t3PWLHw59hneey8NC3lcYZ40QEjOcZz0zVh9P1yK4F5ZQX1lchCnmRlGypOcFSeeeRXlr/AAR+JP8ADYaB+Opf/Y1YtfgR8QJOZW8NwMORm7kcj8QhqqeX4mDuos5Y4esrOMWmejRWWpRyTXV3Z6nPPKQZZ5YSSccAADgAdgPWh5TEcSRXEXGfmiYcflXExfBX4lwuskXiHR42Q5UrqF2Cv0wOKnHw8+OVkzJZ+JIJUcgsw1uXn/vsEj8KcsuxEndxY3h6zd3FnUi4C3MV3ZX5tbuIEI4Gcg9QQeCDgfSnxtPcXcl7fXxvLmRQhcAKqgc4UA8c8nqelcF4q8NfHa70y50+/gvbq3lAQvp13bGQBSGBVgA45A5BBOSMc1x6+JPiV4OzFrWnPqEIxiPxBpkkEigY6XEWM8ED5s8n1p/U66hyy06ar9RqnU5eV3Xl0PSr4appGtX1xZ+HodWtr9lkDLkSRSBQpBIIIHGc+5rS8O2c2n2dzd6gI47y8lM8yI5ZUOAAikkkgAAdTzmvL7H476KHEWu+D5tNctzJb6oXix2AbYQD65Iro4fiv4ca3Fxp/huW8bOUe41RGj+p2A557YrzpZdKjNza1fUwlSlDV7dB3xQ8my8ZeBb25BDIbZ5CDyEW7BUY7cMa+mnBDsD1BI/U18W+IPEF74m8W2l/qEkUl3PeWsUUEAO2NBKNqIMk45JyeSST7V9py8zSHr8x/ma+oyP4JLzPUyx3Uu1xtFFFe4eoKhAdWPIBBwPY1438OdV8f/DjTdT8NP8ACvW9eT+17y8gv9OvbbyZo5pTIpAdgQQDggjIIr2OkIXuAfwoA4T/AIWp47/6Ib4v/wDAy0/+Lo/4Wp47/wCiG+L/APwMtP8A4uu62j+6Pyo2j+6PyoA4X/hanjv/AKIb4v8A/Ay0/wDi6zfFHxC+Ier+HNS0qz+CXiaO4vbSW2ie4v7VI1Z1KAuQ5wBnJ+n416ZtH90flS7QP4R+VAHOfC7RLzw38N/Dfh7UTGbzTdLgtpzGcrvVAGAPcA5Ge+M10lFFABRRRQAUUoUscKGY+gBJpfKl/wCeMv8A3wf8KAG0U7ypf+eMv/fB/wAK5DxT8SfAvhq5Flq3iWzW+JIFja7rm5JGcgQxBnByCOQMHrQB1tJnnHf0rzgeN/H+vMY/Bnwt1KGFs7NR8TzDT4R7+QoeZgeCBgEjPTHKyeBfiBroJ8Y/Eq/sYGx/oHhe0Gnx47gzvvmYEZHBGOooA67xX4q8NeFLQ3fibX9O0eLBx9ruFjZ8dlQncx9gCa4m7+JSeJI/J8F/DrXfGcSnKXd1aJY2APIyJbkAn3KoTjP0O/4U+GHgLwzdi+0nwxYjUNxY390purpiepMspZsn1BFdixZjlmLHpknJpNX3A8ytfD/xX1eEQ3/ifQPBGnknNn4ZsfOuApJ+U3EwCKeeqJ16eptaX8HPAsN2moa3ZXfizVFxm+8RXT38mc5yEf8AdqM9ggHT0r0KihKwJWGQxRQwLBDGkUSABY41CooHQADAH4Cn0UUwCiiigAooooATFKSSpUnKnqp5B/CiigDD1Xwf4T1UONS8M6LdFwVJksY8kE5IyAD1561xHij9n/4Xa1Efs+gnQbkKVS50eY27D6ryjfip+tep0VHJHXTcnkjroeF+Hvhb4n+G99HqPhvSvC/jeOBi8Yv4vsOqR5GBsny0LEepVSc9Rya662+MPhq0vYtO8aWWr+Br6Vtkaa9bGO3kIGTsuUJiYe5YV6NVbVVsH0y5XVFtX08Rs1wt0qtCEAJYuGBGAASSegFOMIwVoqwQioqyViW1nt7u1jurWeK4t5ADHNFIHRx6hgSD+BqSvny8k+AFvcvqHgz4n2XgXUGYMZdB1MxwyEA4D2zAxMPUbRnHWo3+OV34Yid7vxn4A8fWMYH7yyvP7M1AjPJMT5hc45wCufSqKPoeivKvCP7Qnwl8Q6X9t/4Su20hwQr22qDyJVOM8AEhh7gkVs/8Lm+E3/RRfDn/AIFf/WoA7yiuM0n4rfDTVdTt9M03x1oF1eXMgiggjuhukc8BRkAEk8AZ5JA6muzoAKKKKACiiigAooooA8q+N1kPEXjn4beCb28vodG1rUrx9QjtLl4GnEFqZEQuhB27uSB7EEEAjZ/4Z0+F2P8AkHa1/wCD+9/+O1k/Gm4m0Px38N/Gk2m6jeaRomo3o1BrG2e4kgWe2MSOUQEld3BIHHA6kA6//DQfgX/nx8W/+E5d/wDxFAAP2dPhfnjTta/8KC9/+O1Vs/2ZfhBZ3TXVpoOoW87Z3SR61doxycnJEgJz9atf8NB+Bf8Anx8W/wDhOXf/AMRR/wANB+Bf+fHxb/4Tl3/8RQAf8M6/C/k/2drXPX/ioL3/AOO1zmh+FtP+Hf7QOm+HvDFzqUOkaz4durm7s7m+luU86GVAkimQkqcMQcHBHGK6P/hoPwL/AM+Pi3/wnLv/AOIrndF8SReP/wBoDS/EWg6TrcekaR4eu7a6u7/T5LVPOmlQpGokALNhSTjtz2NAHrtFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABXA/tFkj4E+NiCc/2RL3x1IBrvq574leHX8W/D/X/AAxHcrayapYyWyTMCQjEZUkDkjIGcc4JxzQBueFvDugf8I1pmND0wAWcOALSPj5B7VpHw5oB66Jph/7dI/8ACvJ9J8W/G/TtLtNPl+FOgXcltEkLXEXiuONJSoA3qhjJUHGQCSRnmrX/AAnXxs/6I/on/hXxf/G6APTh4c0AdND0wf8AbpH/AIUf8I7oH/QE03/wEj/wrzH/AITr42f9Ef0T/wAK+L/43R/wnXxs/wCiP6J/4V8X/wAboAq/tXaLo9r8Hbm6ttKsYJ4dU0145Y4ER0JvIhkEAEHBI+hNemy/66T/AHz/ADNePeN4viz8StJg8J614I0XwxpU19bXF7qC68t7IkcMqylY41QEuSgAJOBznGcj2Bzl2YjBJJx6ZJoASiiigAooooAKKKKAAEqQwYgjuDg07zZf+e0v/fZ/xptFADvNl/57S/8AfZ/xo82X/ntL/wB9n/Gm0UAO82X/AJ7S/wDfZ/xpGZmILMzEdMknH50lFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQB/9k=",
      dots: [
        ["Cell wall", 22, 40],
        ["Nucleus", 62, 45],
        ["Nucleolus", 63, 47],
        ["Vacuole", 42, 60],
        ["Cytoplasm", 50, 68],
        ["Mitochondrion", 30, 42],
        ["Chloroplast", 48, 40],
        ["Endoplasmic reticulum", 70, 40],
        ["Golgi apparatus", 33, 82],
        ["Ribosomes", 72, 66]
      ]
    }
  ];

  global.PUBLIC_DECKS = PUBLIC_DECKS;
})(typeof window !== "undefined" ? window : globalThis);
