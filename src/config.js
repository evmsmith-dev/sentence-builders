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
  { id: "works", name: "Word Works", emoji: "⚙️", ready: false, blurb: "Verb tenses, agreement and pronouns" },
  { id: "studio", name: "Sentence Studio", emoji: "🎨", ready: false, blurb: "Fragments, run-ons, compound and complex sentences" },
  { id: "flow", name: "Flow Factory", emoji: "🏭", ready: false, blurb: "Label every word with the Q&A Flow" },
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
];

// The marks offered on "Mark it" items, per skill and level. Items can add their own; the
// right marks are always offered. More choices than needed, so the palette doesn't give the answer away.
const DIALOGUE_MARKS = [",", '"', ".", "?", "!"];
export const PALETTES = {
  commas: [[",", "."], [",", "."], [",", ":", "."]],
  dialogue: [DIALOGUE_MARKS, DIALOGUE_MARKS, DIALOGUE_MARKS],
  apostrophes: [["'", ","], ["'", ","], ["'", ","]],
};
export const MARK_ORDER = [",", ".", "?", "!", '"', "'", ":", ";"];

export const skillById = (id) => SKILLS.find((skill) => skill.id === id);
export const skillsInWorld = (worldId) => SKILLS.filter((skill) => skill.world === worldId);

export const TIER_NAMES = ["Bronze", "Silver", "Gold"];

// World and habit badges. Skill badges come from SKILLS above (Bronze = pass level 1,
// Silver = pass level 2, Gold = mastery of level 3).
export const WORLD_BADGES = [
  { id: "port-champion", world: "port", name: "Port Champion", emoji: "🏆", how: "Get every Punctuation Port skill to Silver." },
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
