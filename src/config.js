// All game rules and labels in one place: worlds, skills, levels, scoring, avatars and badges.

export const ITEMS_PER_LEVEL = 8;
export const REVIEW_PER_LEVEL = 2;

// Points per item: right on the first try, right on the second try (after a hint), or shown the answer.
export const POINTS = { first: 1, second: 0.5, missed: 0 };
// Stars for a level's points out of 8. Under the first threshold, the level isn't passed yet.
export const STAR_THRESHOLDS = [6, 7, 8];
// Gold on a skill: this many points on its level 3, on this many different days.
export const GOLD_POINTS = 7;
export const GOLD_DAYS = 2;

export const MIN_GRADE = 3;
export const MAX_GRADE = 8;
/** From this grade on, the calmer Studio look is the default. */
export const STUDIO_FROM_GRADE = 6;
/** Shurley's noun table (job, singular or plural, common or proper) on one Q&A Flow sentence a level, from this grade. */
export const NOUN_TABLE_FROM_GRADE = 4;
/** Noun table questions show a one-line reminder until a child has this many right on the first try. */
export const NOUN_REMINDERS_UNTIL = 12;
export const MAX_PLAYERS = 4;

export const WORLDS = [
  { id: "port", tab: "Punctuation", name: "Punctuation Port", emoji: "⚓", ready: true, blurb: "Commas, colons, quotation marks and apostrophes" },
  { id: "works", tab: "Word Works", name: "Word Works", emoji: "⚙️", ready: true, blurb: "Verb tenses, agreement and pronouns" },
  { id: "studio", tab: "Sentences", name: "Sentence Studio", emoji: "🎨", ready: true, blurb: "Fragments, run-ons, compound and complex sentences" },
  { id: "flow", tab: "Q&A Flow", name: "Flow Factory", emoji: "🏭", ready: true, blurb: "Label every word with the Q&A Flow, then mark it up (and diagram it, from grade 5)" },
  {
    id: "desk", tab: "Editing", name: "Editing Desk", emoji: "📝", ready: true, minGrade: 6,
    blurb: "Grades 6–8: pronouns, punctuation, sentence types, modifiers and proofreading",
  },
];

// grades: the grade each of the skill's 3 levels belongs to (2020 Minnesota ELA benchmarks).
export const SKILLS = [
  {
    id: "commas", world: "port", name: "Commas and colons", short: "Commas", color: "#2f6fd6",
    grades: [3, 4, 5], benchmarks: "MN 3.2.1.1, 4.2.1.1, 5.2.1.1",
    badge: { id: "comma-captain", name: "Comma Captain", emoji: "🧭" },
  },
  {
    id: "dialogue", world: "port", name: "Dialogue", short: "Dialogue", color: "#8a4fd0",
    grades: [4, 4, 5], benchmarks: "MN 4.2.1.1",
    badge: { id: "quote-keeper", name: "Quote Keeper", emoji: "💬" },
  },
  {
    id: "apostrophes", world: "port", name: "Apostrophes", short: "Apostrophes", color: "#d9822b",
    grades: [3, 4, 5], benchmarks: "MN 3.2.1.1",
    badge: { id: "apostrophe-ace", name: "Apostrophe Ace", emoji: "🎯" },
  },
  {
    id: "verbs", world: "works", name: "Verb tenses", short: "Verbs", color: "#2e8b57",
    grades: [3, 4, 5], benchmarks: "MN 3.2.1.3; grammar in 4.2.1.1, 5.2.1.1",
    badge: { id: "time-traveler", name: "Time Traveler", emoji: "⏳" },
  },
  {
    id: "agreement", world: "works", name: "Agreement", short: "Agreement", color: "#c2185b",
    grades: [4, 4, 5], benchmarks: "MN 4.2.1.3",
    badge: { id: "perfect-match", name: "Perfect Match", emoji: "🧩" },
  },
  {
    id: "pronouns", world: "works", name: "Pronouns", short: "Pronouns", color: "#00897b",
    grades: [3, 4, 5], benchmarks: "MN 3.2.1.3, 4.2.1.3, 5.2.1.3",
    badge: { id: "pronoun-pro", name: "Pronoun Pro", emoji: "🪞" },
  },
  {
    id: "fragments", world: "studio", name: "Fragments and run-ons", short: "Fragments", color: "#e2681f",
    grades: [3, 4, 5], benchmarks: "MN grammar in 3.2.1.1, 4.2.1.1, 5.2.1.1; 5.2.3.2",
    badge: { id: "sentence-doctor", name: "Sentence Doctor", emoji: "🩺" },
  },
  {
    id: "compound", world: "studio", name: "Compound sentences", short: "Compound", color: "#3f51b5",
    grades: [3, 4, 5], benchmarks: "MN 3.2.1.3, 4.2.1.3, 5.2.1.1",
    badge: { id: "bridge-builder", name: "Bridge Builder", emoji: "🌉" },
  },
  {
    id: "complex", world: "studio", name: "Complex sentences", short: "Complex", color: "#795548",
    grades: [4, 4, 5], benchmarks: "MN 4.2.1.1, 4.2.1.3",
    badge: { id: "master-architect", name: "Master Architect", emoji: "📐" },
  },
  {
    id: "flow", world: "flow", name: "Q&A Flow", short: "Q&A Flow", color: "#6d4c9f",
    grades: [3, 4, 5], benchmarks: "Shurley English Levels 3–5; MN 3.2.1.3, 4.2.1.3, 5.2.1.3",
    badge: { id: "flow-master", name: "Flow Master", emoji: "🔤" },
    // Flows are long, so a level is 3 Q&A Flows, then 2 Build-from-labels items (needed right for Gold), no review.
    levelPlan: [{ type: "flow", count: 3 }, { type: "labels", count: 2 }],
    goldNeedsAllRight: "labels",
  },
  {
    id: "flow2", world: "flow", name: "Advanced Q&A Flow", short: "Adv. Flow", color: "#4527a0", minGrade: 6,
    grades: [6, 7, 8], benchmarks: "Shurley English Levels 6–8: questions, commands, patterns 6 and 7",
    badge: { id: "pattern-pro", name: "Pattern Pro", emoji: "🧠" },
    levelPlan: [{ type: "flow", count: 3 }, { type: "labels", count: 2 }],
    goldNeedsAllRight: "labels",
  },
  {
    id: "diagram", world: "flow", name: "Sentence Diagramming", short: "Diagrams", color: "#00695c", minGrade: 5,
    grades: [5, 6, 7], benchmarks: "Shurley English Skill Check and sentence diagramming, grades 5–7",
    badge: { id: "diagram-pro", name: "Diagram Pro", emoji: "📐" },
    levelPlan: [{ type: "diagram", count: 5 }],
  },
  {
    id: "case", world: "desk", name: "Pronoun case and clarity", short: "Pronoun case", color: "#00695c",
    grades: [6, 7, 8], benchmarks: "MN 6.2.1.1, 7.2.1.1, 8.2.1.1",
    badge: { id: "case-closed", name: "Case Closed", emoji: "🕵️" },
  },
  {
    id: "proofread", world: "desk", name: "Proofreading", short: "Proofread", color: "#ad1457",
    grades: [6, 7, 8], benchmarks: "MN 6.2.1.1, 7.2.1.1, 8.2.1.1 (edit for punctuation, capitalization and grammar)",
    badge: { id: "eagle-eye", name: "Eagle Eye", emoji: "🦅" },
    // Paragraphs take longer, so a level is 5 of them, no review.
    levelPlan: [{ type: "proofread", count: 5 }],
  },
  {
    id: "aside", world: "desk", name: "Dashes, hyphens and extra information", short: "Extra info", color: "#5d4037",
    grades: [6, 7, 8], benchmarks: "MN 6.2.1.1 (dashes, hyphens, ellipses), 7.2.1.1, 8.2.1.1",
    badge: { id: "dash-master", name: "Dash Master", emoji: "➖" },
  },
  {
    id: "types", world: "desk", name: "Sentence types", short: "Sentence types", color: "#1565c0",
    grades: [6, 7, 8], benchmarks: "MN 6.2.1.1, 7.2.1.1, 8.2.1.1",
    badge: { id: "sentence-architect", name: "Sentence Architect", emoji: "🏛️" },
  },
  {
    id: "modifiers", world: "desk", name: "Modifiers and voice", short: "Modifiers", color: "#6a1b9a",
    grades: [6, 7, 8], benchmarks: "MN 6.2.1.1, 7.2.1.1, 8.2.1.1",
    badge: { id: "word-wrangler", name: "Word Wrangler", emoji: "🪄" },
  },
];

// The marks offered on "Mark it" items, per skill and level; the right marks are always added.
// Only real decisions: every sentence already ends with its period, so a period is offered only
// in Dialogue levels 2-3, where a period instead of the comma inside the quotation marks
// ("I am hungry." said Max) is the mistake those levels teach. With a single mark, tapping a
// space adds or removes it directly.
export const PALETTES = {
  commas: [[","], [","], [",", ":"]],
  dialogue: [[",", '"'], [",", '"', ".", "?", "!"], [",", '"', ".", "?", "!"]],
  apostrophes: [["'"], ["'"], ["'"]],
  compound: [[","], [","], [",", ";"]],
  complex: [[","], [","], [","]],
  aside: [["-", "—", ","], [","], [",", "—", "…", "(", ")"]],
  types: [[","], [",", ";"], [",", ";"]],
  modifiers: [[","], [","], [","]],
};
// Quick-reference word lists for the Rule Book and the Labels reminder.
export const WORD_LISTS = [
  { id: "articles", title: "Articles (A)", note: "Use a before a consonant sound (a dog, a unicorn) and an before a vowel sound (an apple, an hour). The points to a certain one.", words: ["a", "an", "the"] },
  {
    id: "prepositions", title: "Common prepositions (P)", note: "A preposition starts a phrase that ends with a noun or pronoun: to the door, under the bed, with Sam.",
    words: ["about", "above", "across", "after", "against", "along", "among", "around", "at", "before", "behind", "below", "beneath", "beside", "between", "beyond", "by", "down", "during", "except", "for", "from", "in", "inside", "into", "like", "near", "of", "off", "on", "onto", "out", "outside", "over", "past", "since", "through", "throughout", "to", "toward", "under", "underneath", "until", "up", "upon", "with", "within", "without"],
  },
  { id: "helping", title: "Helping verbs (HV)", note: "They come before the main verb: is running, can swim, has eaten.", words: ["am", "is", "are", "was", "were", "be", "being", "been", "has", "have", "had", "do", "does", "did", "can", "could", "may", "might", "must", "shall", "should", "will", "would"] },
  { id: "linking", title: "Linking verbs (LV)", note: "They link the subject to a word that renames or describes it: The soup is hot. The others link only when they mean is: The soup smells good.", words: ["am", "is", "are", "was", "were", "be", "being", "been", "become", "seem", "appear", "look", "feel", "taste", "smell", "sound", "grow"] },
  { id: "subject-pronouns", title: "Subject pronouns (SP)", note: "They do the action: She laughed.", words: ["I", "you", "he", "she", "it", "we", "they"] },
  { id: "object-pronouns", title: "Object pronouns", note: "They get the action or come after a preposition: Mom called me. Sit with us.", words: ["me", "you", "him", "her", "it", "us", "them"] },
  { id: "possessive", title: "Possessive pronouns (PPA)", note: "They show who owns something, with no apostrophe: my bike, its tail.", words: ["my", "your", "his", "her", "its", "our", "their"] },
  { id: "reflexive", title: "Reflexive pronouns", note: "For when the one doing the action also gets it: I made it myself.", words: ["myself", "yourself", "himself", "herself", "itself", "ourselves", "yourselves", "themselves"] },
  { id: "joining", title: "Joining words for compound sentences", note: "With a comma, they join two complete sentences.", words: ["for", "and", "nor", "but", "or", "yet", "so"] },
  { id: "starting", title: "Joining words for complex sentences", note: "They start a part that can't stand alone: because it rained.", words: ["after", "although", "as", "because", "before", "even though", "if", "since", "though", "unless", "until", "when", "whenever", "where", "while"] },
  { id: "relative", title: "Relative pronouns", note: "They start a part that tells more about a noun: the girl who won.", words: ["who", "whom", "whose", "which", "that"] },
];
// Which word list goes with which label in the Labels reminder.
export const LABEL_LISTS = { A: "articles", P: "prepositions", HV: "helping", LV: "linking", SP: "subject-pronouns", CSP: "subject-pronouns", PPA: "possessive", C: "joining" };

// Shurley-style labels for the Q&A Flow. Each level adds labels; earlier ones stay.
export const LABELS = {
  SN: { name: "subject noun", hint: "The subject noun tells who or what the sentence is about." , find: 'Ask who or what: "What ran?" → dogs' },
  SP: { name: "subject pronoun", hint: "A subject pronoun (I, you, he, she, it, we, they) takes the place of a noun as the subject." , find: 'Ask who: "Who sang?" → she' },
  V: { name: "verb", hint: "The verb tells what is being said about the subject." , find: 'Ask what is being said about the subject: "dogs ran" → ran' },
  A: { name: "article adjective", hint: "A, an and the are article adjectives." , find: 'Always a, an or the' },
  Adj: { name: "adjective", hint: "An adjective tells what kind, which one or how many about a noun." , find: 'Ask what kind, which one or how many: "What kind of dog?" → small' },
  Adv: { name: "adverb", hint: "An adverb tells how, when, where or how much." , find: 'Ask how, when or where: "Ran how?" → quickly' },
  P: { name: "preposition", hint: "A preposition like to, in, on or under starts a prepositional phrase." , find: 'Starts a phrase: to, in, on, under, for' },
  OP: { name: "object of the preposition", hint: "The object of the preposition is the noun after the preposition that answers what? or whom?" , find: 'Say the preposition + what: "To what?" → door' },
  PPA: { name: "possessive pronoun adjective", hint: "My, your, his, her, its, our and their show who owns something: possessive pronoun adjectives." , find: 'Ask whose: "Whose dog?" → my' },
  PNA: { name: "possessive noun adjective", hint: "A noun with 's that shows who owns something, like Sam's, is a possessive noun adjective." , find: 'Ask whose: "Whose dog?" → Sam\'s' },
  HV: { name: "helping verb", hint: "A helping verb like is, are, was or were comes before the main verb." , find: 'Comes right before the main verb: "is running" → is' },
  "V-t": { name: "transitive verb", hint: "A verb that has a direct object is a transitive verb." , find: 'The verb when the sentence has a direct object: "kicked the ball" → kicked' },
  DO: { name: "direct object", hint: "The direct object answers what? or whom? after the verb and doesn't mean the same thing as the subject." , find: 'Ask verb + what or whom: "Sam kicked what?" → ball' },
  IO: { name: "indirect object", hint: "The indirect object tells to whom or for whom. It comes between the verb and the direct object." , find: 'Ask to whom or for whom: "Mom gave the gift to whom?" → Dad' },
  LV: { name: "linking verb", hint: "A linking verb like is or was links the subject to a word that renames or describes it." , find: 'A verb like is, am, are, was or were with a PrN or PA after it' },
  PrN: { name: "predicate noun", hint: "A predicate noun comes after a linking verb and means the same thing as the subject." , find: 'Ask subject + verb + who or what; it means the same as the subject: "Dad is who?" → teacher' },
  PA: { name: "predicate adjective", hint: "A predicate adjective comes after a linking verb and describes the subject." , find: 'Ask subject + verb + what; it describes the subject: "Soup is what?" → hot' },
  OCN: { name: "object complement noun", hint: "An object complement noun comes after the direct object and renames it: verb + DO + what?" , find: 'Ask verb + DO + what; it renames the DO: "named hamster what?" → Peanut' },
  OCA: { name: "object complement adjective", hint: "An object complement adjective comes after the direct object and describes it: verb + DO + what?" , find: 'Ask verb + DO + what; it describes the DO: "made trail what?" → muddy' },
  CSN: { name: "compound subject noun", hint: "Two subject nouns joined by and, or or but share the same verb. Each one is a compound subject noun." , find: 'Ask who or what; two answers: "Who sang?" → Mia and Leo' },
  CSP: { name: "compound subject pronoun", hint: "Two subject pronouns (or a noun and a pronoun) joined by and or or. Each pronoun is a compound subject pronoun." , find: 'Ask who; two answers: "Who left?" → he and I' },
  CV: { name: "compound verb", hint: "Two verbs joined by and, or or but that tell about the same subject. Each one is a compound verb." , find: 'Ask what is being said about the subject; two answers: "swam and fished"' },
  C: { name: "conjunction", hint: "A conjunction (and, or, but) joins the two parts of a compound." , find: 'The joining word between compound parts: and, or, but' },
};
export const LEVEL_LABELS = [
  ["SN", "SP", "V", "A", "Adj", "Adv"],
  ["SN", "SP", "V", "HV", "A", "Adj", "Adv", "P", "OP", "PPA", "PNA"],
  ["SN", "SP", "V", "V-t", "LV", "HV", "A", "Adj", "Adv", "P", "OP", "PPA", "PNA", "DO", "IO", "PrN", "PA"],
];
const ALL_GRADE5 = LEVEL_LABELS[2];
const WITH_COMPLEMENTS = [...ALL_GRADE5, "OCN", "OCA"];
const WITH_COMPOUNDS = [...WITH_COMPLEMENTS, "C", "CSN", "CSP", "CV"];
// Labels and pattern choices per Q&A Flow skill and level.
export const FLOW_LABELS = {
  flow: LEVEL_LABELS, flow2: [ALL_GRADE5, WITH_COMPLEMENTS, WITH_COMPOUNDS], diagram: [LEVEL_LABELS[1], ALL_GRADE5, WITH_COMPOUNDS],
};
export const FLOW_PATTERNS = {
  flow: [[1, 2], [1, 2], [1, 2, 3, 4, 5]], // levels 1–2: is it Pattern 1 (no direct object) or Pattern 2?
  flow2: [[1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 6, 7]],
  diagram: [[1], [1, 2, 4, 5], [1, 2, 3, 4, 5, 6, 7]],
};

export const SENTENCE_KINDS = {
  D: "Declarative: a statement.",
  Int: "Interrogative: a question.",
  E: "Exclamatory: strong feeling.",
  Imp: "Imperative: a command.",
};
export const PATTERNS = {
  1: "SN V P1", 2: "SN V-t DO P2", 3: "SN V-t IO DO P3", 4: "SN LV PrN P4", 5: "SN LV PA P5",
  6: "SN V-t DO OCN P6", 7: "SN V-t DO OCA P7",
};

export const MARK_ORDER = [",", ".", "?", "!", '"', "'", ":", ";", "-", "—", "…", "(", ")"];

/** Skills a player can see: some (like Advanced Q&A Flow) wait until grade 6. */
export const skillOpenFor = (skill, player) => !skill.minGrade || (player?.grade || 0) >= skill.minGrade;

/** Worlds a player can open: the Editing Desk waits until grade 6. */
export const worldOpenFor = (world, player) => world.ready && (!world.minGrade || (player?.grade || 0) >= world.minGrade);

export const skillById = (id) => SKILLS.find((skill) => skill.id === id);
export const skillsInWorld = (worldId) => SKILLS.filter((skill) => skill.world === worldId);
export const skillsInWorldFor = (worldId, player) => skillsInWorld(worldId).filter((skill) => skillOpenFor(skill, player));

export const TIER_NAMES = ["Bronze", "Silver", "Gold"];

// World and habit badges. Skill badges come from SKILLS above (Bronze = pass level 1,
// Silver = pass level 2, Gold = mastery of level 3).
export const WORLD_BADGES = [
  { id: "port-champion", world: "port", name: "Port Champion", emoji: "🏆", how: "Get every Punctuation Port skill to Silver." },
  { id: "works-wizard", world: "works", name: "Works Wizard", emoji: "🧙", how: "Get every Word Works skill to Silver." },
  { id: "studio-star", world: "studio", name: "Studio Star", emoji: "⭐", how: "Get every Sentence Studio skill to Silver." },
  { id: "chief-editor", world: "desk", name: "Chief Editor", emoji: "🖋️", how: "Get every Editing Desk skill to Silver." },
];
export const HABIT_BADGES = [
  { id: "first-brick", name: "First Brick", emoji: "🧱", how: "Finish your first level.", goal: 1, measure: "levelsPassed" },
  { id: "builders-week", name: "Builder's Week", emoji: "📅", how: "Play on 5 different days.", goal: 5, measure: "daysPlayed" },
  { id: "fix-it-pro", name: "Fix-It Pro", emoji: "🔧", how: "Get 25 items right on your second try.", goal: 25, measure: "secondTryWins" },
];

// Avatars in two groups; players in grade 6+ see the second group first.
export const AVATAR_GROUPS = [
  { name: "Animals and fun", avatars: ["🦊", "🐼", "🐯", "🦉", "🐙", "🦖", "🐢", "🦄", "🐸", "🐧", "🐝", "🐨", "🐰", "🦋", "🌵", "🍕", "🚀", "🌈"] },
  { name: "Sports, music and more", avatars: ["😎", "🎧", "🎮", "⚽", "🏀", "🏈", "⚾", "🏒", "🛹", "🏂", "🎸", "🥁", "🎤", "🎨", "📷", "♟️", "🧩", "📚", "🔬", "🧠", "⚡", "🔥", "🌙", "⭐", "🏔️", "🌊", "🐺", "🦅", "🦈", "🐉", "🤖", "👾"] },
];
export const AVATARS = AVATAR_GROUPS.flatMap((g) => g.avatars);

// What Pip says. Short, plain and never babyish.
export const PIP = {
  right: ["Nice work.", "That's it.", "Solid.", "Right on.", "You got it.", "Exactly."],
  secondTry: ["Fixed it. Good recovery.", "That's it this time.", "Good fix."],
  hint: "Not quite. Here's a tip:",
  shown: "Here's how it goes. This one will come back later.",
  passed: ["New building unlocked!", "The town just grew.", "Another one built."],
  notYet: "Let's build that one again. Nothing is lost.",
};

/** Kinds of nouns, for the noun table: shown in the Rule Book (Flow Factory and Word lists) and from 📘 Nouns. */
export const NOUN_KINDS = [
  {
    id: "common-proper", title: "Common and proper nouns", head: ["Common", "Proper"],
    rule: "A proper noun names one particular person, pet, place or thing, and it starts with a capital letter. A common noun is the general word, with no capital (unless it starts the sentence).",
    pairs: [["city", "Duluth"], ["dog", "Biscuit"], ["lake", "Lake Superior"], ["my grandma", "Grandma (used as a name)"]],
  },
  {
    id: "singular-plural", title: "Singular and plural nouns", head: ["Singular", "Plural"],
    rule: "A singular noun names one. A plural noun names more than one. Most plurals add -s or -es; some change their spelling. A few, like homework, music and snow, stay singular.",
    pairs: [["puppy", "puppies"], ["box", "boxes"], ["goose", "geese"], ["child", "children"], ["mouse", "mice"]],
  },
];

/* ---------- Bricks and town decorations ---------- */
/** Paragraphs in one round of Pip's homework. */
export const HOMEWORK_PER_ROUND = 3;
export const BRICKS = { first: 2, second: 1, star: 3, firstPass: 10, homeworkFix: 3 };

/**
 * Decorations, cheapest first. zone: "square" (the park by the water, in a back or front row), "sky" or
 * "water"; x is where it sits (0–360), so nothing overlaps. walk: it strolls along the front row (only when
 * motion is allowed).
 */
export const DECOR = [
  { id: "tulips", name: "Tulips", emoji: "🌷", cost: 8, zone: "square", row: "front", x: 22 },
  { id: "mailbox", name: "Mailbox", emoji: "📮", cost: 10, zone: "square", row: "front", x: 72 },
  { id: "oak", name: "Oak tree", emoji: "🌳", cost: 12, zone: "square", row: "back", x: 28 },
  { id: "balloons", name: "Balloons", emoji: "🎈", cost: 15, zone: "sky", x: 30 },
  { id: "sunflowers", name: "Sunflowers", emoji: "🌻", cost: 15, zone: "square", row: "front", x: 338 },
  { id: "pine", name: "Pine tree", emoji: "🌲", cost: 18, zone: "square", row: "back", x: 338 },
  { id: "ducks", name: "Ducks", emoji: "🦆", cost: 20, zone: "water", x: 60 },
  { id: "kite", name: "Kite", emoji: "🪁", cost: 25, zone: "sky", x: 96 },
  { id: "icecream", name: "Ice cream cart", emoji: "🍦", cost: 30, zone: "square", row: "front", x: 292 },
  { id: "tent", name: "Camping tent", emoji: "⛺", cost: 35, zone: "square", row: "back", x: 298 },
  { id: "sailboat", name: "Sailboat", emoji: "⛵", cost: 40, zone: "water", x: 170 },
  { id: "fountain", name: "Fountain", emoji: "⛲", cost: 45, zone: "square", row: "back", x: 120 },
  { id: "dog", name: "Dog", emoji: "🐕", cost: 50, zone: "square", row: "front", x: 130, walk: true },
  { id: "cat", name: "Cat", emoji: "🐈", cost: 50, zone: "square", row: "front", x: 230, walk: true },
  { id: "slide", name: "Playground slide", emoji: "🛝", cost: 60, zone: "square", row: "back", x: 74 },
  { id: "foodtruck", name: "Food truck", emoji: "🚚", cost: 75, zone: "square", row: "back", x: 256 },
  { id: "carousel", name: "Carousel", emoji: "🎠", cost: 90, zone: "square", row: "back", x: 210 },
  { id: "rainbow", name: "Rainbow", emoji: "🌈", cost: 110, zone: "sky", x: 196 },
  { id: "whale", name: "Whale", emoji: "🐳", cost: 130, zone: "water", x: 110 },
  { id: "ferris", name: "Ferris wheel", emoji: "🎡", cost: 160, zone: "square", row: "back", x: 165 },
  { id: "ufo", name: "Friendly UFO", emoji: "🛸", cost: 200, zone: "sky", x: 250 },
];

/**
 * How words change their endings: shown in the Rule Book (Word Works and Word lists). rows: [when, do this, examples].
 * list: word pairs (irregular verbs).
 */
export const SPELLING_RULES = [
  {
    id: "past-ed", title: "Past tense: adding -ed",
    note: "Most verbs show the past by adding -ed. The spelling changes in a few patterns.",
    rows: [
      ["Most verbs", "Add -ed", "walk → walked, jump → jumped"],
      ["Ends in silent e", "Add only -d", "bake → baked, smile → smiled"],
      ["Ends in a consonant + y", "Change y to i, add -ed", "carry → carried, cry → cried"],
      ["Ends in a vowel + y", "Just add -ed", "play → played, stay → stayed"],
      ["Short word ending consonant-vowel-consonant", "Double the last letter, add -ed", "stop → stopped, hug → hugged"],
    ],
  },
  {
    id: "irregular", title: "Irregular past tense verbs",
    note: "These change their spelling instead of adding -ed. With has, have or had, some use a third form (have gone, has eaten).",
    list: [["be", "was / were"], ["begin", "began"], ["bring", "brought"], ["build", "built"], ["buy", "bought"], ["catch", "caught"],
      ["choose", "chose"], ["come", "came"], ["dig", "dug"], ["do", "did"], ["draw", "drew"], ["drink", "drank"], ["drive", "drove"],
      ["eat", "ate"], ["fall", "fell"], ["feel", "felt"], ["find", "found"], ["fly", "flew"], ["freeze", "froze"], ["get", "got"],
      ["give", "gave"], ["go", "went"], ["grow", "grew"], ["have", "had"], ["hide", "hid"], ["keep", "kept"], ["know", "knew"],
      ["leave", "left"], ["make", "made"], ["ride", "rode"], ["run", "ran"], ["say", "said"], ["see", "saw"], ["sing", "sang"],
      ["sit", "sat"], ["sleep", "slept"], ["speak", "spoke"], ["swim", "swam"], ["take", "took"], ["teach", "taught"],
      ["tell", "told"], ["think", "thought"], ["throw", "threw"], ["wake", "woke"], ["wear", "wore"], ["write", "wrote"]],
  },
  {
    id: "plurals", title: "Plural nouns: -s, -es, -ies, -ves",
    note: "Plural means more than one. Most nouns add -s; these patterns change the spelling.",
    rows: [
      ["Most nouns", "Add -s", "dog → dogs, book → books"],
      ["Ends in s, x, z, ch or sh", "Add -es", "bus → buses, box → boxes, lunch → lunches, dish → dishes"],
      ["Ends in a consonant + y", "Change y to i, add -es", "puppy → puppies, city → cities"],
      ["Ends in a vowel + y", "Just add -s", "boy → boys, day → days"],
      ["Ends in f or fe (many words)", "Change to v, add -es", "leaf → leaves, knife → knives (but roof → roofs)"],
      ["Ends in o", "Add -s or -es (check a dictionary)", "piano → pianos, potato → potatoes"],
      ["Changes completely", "Learn these", "child → children, mouse → mice, foot → feet, tooth → teeth, goose → geese, person → people"],
      ["Stays the same", "No change", "sheep, deer, fish, moose"],
    ],
  },
  {
    id: "future", title: "Future tense: will",
    note: "The future doesn't change the verb's ending. Put will (or am, is or are going to) before the plain verb.",
    rows: [
      ["Any verb", "will + the plain verb", "walk → will walk, swim → will swim"],
      ["Also", "am / is / are going to + the plain verb", "I am going to swim. She is going to read."],
      ["Happening for a while", "will be + the -ing verb", "We will be camping all week."],
    ],
  },
  {
    id: "s-ing", title: "Adding -s and -ing to verbs",
    note: "He, she, it or one person in the present gets a verb with -s, spelled like plurals. The -ing ending has its own patterns.",
    rows: [
      ["-s: most verbs", "Add -s", "run → runs, sing → sings"],
      ["-s: ends in s, x, z, ch or sh", "Add -es", "catch → catches, wash → washes"],
      ["-s: ends in a consonant + y", "Change y to i, add -es", "fly → flies, try → tries"],
      ["-ing: ends in silent e", "Drop the e, add -ing", "make → making, ride → riding"],
      ["-ing: short word ending consonant-vowel-consonant", "Double the last letter, add -ing", "run → running, swim → swimming"],
      ["-ing: ends in ie", "Change ie to y, add -ing", "lie → lying, tie → tying"],
    ],
  },
];
