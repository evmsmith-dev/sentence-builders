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
export const MAX_PLAYERS = 4;

export const WORLDS = [
  { id: "port", name: "Punctuation Port", emoji: "⚓", ready: true, blurb: "Commas, colons, quotation marks and apostrophes" },
  { id: "works", name: "Word Works", emoji: "⚙️", ready: true, blurb: "Verb tenses, agreement and pronouns" },
  { id: "studio", name: "Sentence Studio", emoji: "🎨", ready: true, blurb: "Fragments, run-ons, compound and complex sentences" },
  { id: "flow", name: "Flow Factory", emoji: "🏭", ready: true, blurb: "Label every word with the Q&A Flow" },
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
};
// Shurley-style labels for the Q&A Flow. Each level adds labels; earlier ones stay.
export const LABELS = {
  SN: { name: "subject noun", hint: "The subject noun tells who or what the sentence is about." },
  SP: { name: "subject pronoun", hint: "A subject pronoun (I, you, he, she, it, we, they) takes the place of a noun as the subject." },
  V: { name: "verb", hint: "The verb tells what is being said about the subject." },
  A: { name: "article adjective", hint: "A, an and the are article adjectives." },
  Adj: { name: "adjective", hint: "An adjective tells what kind, which one or how many about a noun." },
  Adv: { name: "adverb", hint: "An adverb tells how, when, where or how much." },
  P: { name: "preposition", hint: "A preposition like to, in, on or under starts a prepositional phrase." },
  OP: { name: "object of the preposition", hint: "The object of the preposition is the noun after the preposition that answers what? or whom?" },
  PPA: { name: "possessive pronoun adjective", hint: "My, your, his, her, its, our and their show who owns something: possessive pronoun adjectives." },
  PNA: { name: "possessive noun adjective", hint: "A noun with 's that shows who owns something, like Sam's, is a possessive noun adjective." },
  HV: { name: "helping verb", hint: "A helping verb like is, are, was or were comes before the main verb." },
  "V-t": { name: "transitive verb", hint: "A verb that has a direct object is a transitive verb." },
  DO: { name: "direct object", hint: "The direct object answers what? or whom? after the verb and doesn't mean the same thing as the subject." },
  IO: { name: "indirect object", hint: "The indirect object tells to whom or for whom. It comes between the verb and the direct object." },
  LV: { name: "linking verb", hint: "A linking verb like is or was links the subject to a word that renames or describes it." },
  PrN: { name: "predicate noun", hint: "A predicate noun comes after a linking verb and means the same thing as the subject." },
  PA: { name: "predicate adjective", hint: "A predicate adjective comes after a linking verb and describes the subject." },
};
export const LEVEL_LABELS = [
  ["SN", "SP", "V", "A", "Adj", "Adv"],
  ["SN", "SP", "V", "HV", "A", "Adj", "Adv", "P", "OP", "PPA", "PNA"],
  ["SN", "SP", "V", "V-t", "LV", "HV", "A", "Adj", "Adv", "P", "OP", "PPA", "PNA", "DO", "IO", "PrN", "PA"],
];
export const SENTENCE_KINDS = {
  D: "Declarative: a statement.",
  Int: "Interrogative: a question.",
  E: "Exclamatory: strong feeling.",
  Imp: "Imperative: a command.",
};
export const PATTERNS = { 1: "SN V P1", 2: "SN V-t DO P2", 3: "SN V-t IO DO P3", 4: "SN LV PrN P4", 5: "SN LV PA P5" };

export const MARK_ORDER = [",", ".", "?", "!", '"', "'", ":", ";"];

export const skillById = (id) => SKILLS.find((skill) => skill.id === id);
export const skillsInWorld = (worldId) => SKILLS.filter((skill) => skill.world === worldId);

export const TIER_NAMES = ["Bronze", "Silver", "Gold"];

// World and habit badges. Skill badges come from SKILLS above (Bronze = pass level 1,
// Silver = pass level 2, Gold = mastery of level 3).
export const WORLD_BADGES = [
  { id: "port-champion", world: "port", name: "Port Champion", emoji: "🏆", how: "Get every Punctuation Port skill to Silver." },
  { id: "works-wizard", world: "works", name: "Works Wizard", emoji: "🧙", how: "Get every Word Works skill to Silver." },
  { id: "studio-star", world: "studio", name: "Studio Star", emoji: "⭐", how: "Get every Sentence Studio skill to Silver." },
];
export const HABIT_BADGES = [
  { id: "first-brick", name: "First Brick", emoji: "🧱", how: "Finish your first level.", goal: 1, measure: "levelsPassed" },
  { id: "builders-week", name: "Builder's Week", emoji: "📅", how: "Play on 5 different days.", goal: 5, measure: "daysPlayed" },
  { id: "fix-it-pro", name: "Fix-It Pro", emoji: "🔧", how: "Get 25 items right on your second try.", goal: 25, measure: "secondTryWins" },
];

export const AVATARS = ["🦊", "🐼", "🐯", "🦉", "🐙", "🦖", "🐢", "🦄", "🐸", "🐧", "🚀", "⚽", "🎸", "🌵", "🍕", "🐝"];

// What Pip says. Short, plain and never babyish.
export const PIP = {
  right: ["Nice work.", "That's it.", "Solid.", "Right on.", "You got it.", "Exactly."],
  secondTry: ["Fixed it. Good recovery.", "That's it this time.", "Good fix."],
  hint: "Not quite. Here's a tip:",
  shown: "Here's how it goes. This one will come back later.",
  passed: ["New building unlocked!", "The town just grew.", "Another one built."],
  notYet: "Let's build that one again. Nothing is lost.",
};
