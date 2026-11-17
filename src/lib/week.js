// Sentence of the Week: one original sentence for the week, a short task each weekday, like a classroom's daily
// grammar warm-up. Analysis comes before editing: Monday parts of speech, Tuesday the Q&A Flow, Wednesday the
// mark-up, Thursday fixing its capitals and punctuation, Friday a typed revision that joins it to another sentence.
// Optional, like Pip's homework: it earns bricks and a banner in the Town Square, not levels or badges.

import { localDate } from "./progress.js";
import { parseProofread, parseTags } from "./parse.js";
import { isPronoun } from "./nouns.js";

export const WEEK_DAYS = [
  { name: "Monday", short: "M", task: "Parts of speech" },
  { name: "Tuesday", short: "T", task: "Q&A Flow" },
  { name: "Wednesday", short: "W", task: "Mark it up" },
  { name: "Thursday", short: "T", task: "Fix it" },
  { name: "Friday", short: "F", task: "Join and write it" },
];
/** Bricks for finishing all five days, on top of the bricks for each answer. */
export const WEEK_BONUS = 15;

export const bandFor = (grade) => (grade >= 6 ? "6-8" : grade === 5 ? "5" : "3-4");
/** The Q&A Flow skill and level whose labels each band's sentences use. */
const FLOW_FOR = { "3-4": ["flow", 2], 5: ["flow", 3], "6-8": ["flow2", 3] };
const SPEECH_FOR = { "3-4": ["noun", "verb", "adjective", "adverb", "preposition"], 5: ["noun", "verb", "adjective", "adverb", "preposition", "pronoun"],
  "6-8": ["noun", "verb", "adjective", "adverb", "preposition", "pronoun", "conjunction", "interjection"] };

const PART = {
  SN: "noun", OP: "noun", DO: "noun", IO: "noun", PrN: "noun", OCN: "noun", CSN: "noun", COP: "noun", CDO: "noun", CIO: "noun", CPrN: "noun",
  V: "verb", HV: "verb", "V-t": "verb", LV: "verb", CV: "verb", "CV-t": "verb", CLV: "verb",
  Adj: "adjective", PA: "adjective", OCA: "adjective", CAdj: "adjective", CPA: "adjective",
  Adv: "adverb", CAdv: "adverb", P: "preposition", C: "conjunction", I: "interjection", SP: "pronoun", CSP: "pronoun", PrP: "pronoun",
};
export const partOfSpeech = (word, label) => (PART[label] === "noun" && isPronoun(word) ? "pronoun" : PART[label] || null);

/** The Monday of the week holding `now`, as a local date: the week's key. */
export function weekKey(now) {
  const d = new Date(now);
  const back = (d.getDay() + 6) % 7; // Monday = 0
  return localDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back, 12).getTime());
}
/** 0–4 for Monday–Friday; 5 on the weekend, when every day of the week is open. */
export const todayIndex = (now) => Math.min((new Date(now).getDay() + 6) % 7, 5);

/** This week's sentence for a grade: the weeks take turns, the same for everyone in a band. */
export function weekFor(weeks, grade, now) {
  const band = bandFor(grade);
  const list = weeks.filter((w) => w.band === band);
  if (!list.length) return null;
  const [y, m, d] = weekKey(now).split("-").map(Number);
  const n = Math.round(Date.UTC(y, m - 1, d) / (7 * 864e5));
  return list[((n % list.length) + list.length) % list.length];
}

export const weekSentence = (week) => parseTags(week.tags).map((t) => t.word).filter((w) => w !== "(You)").join(" ");

/** The items for one day of a week (0 = Monday). They use the regular item types, so they play like any level. */
export function weekDayItems(week, day) {
  const [skill, level] = FLOW_FOR[week.band];
  const sentence = weekSentence(week);
  const base = { level, week: true };
  const id = (k) => `${week.id}-d${day + 1}${k === undefined ? "" : `-${k}`}`;
  const flow = { ...base, skill, type: "flow", tags: week.tags, steps: week.steps, kind: week.kind, pattern: week.pattern };
  if (day === 0) {
    const words = parseTags(week.tags);
    const options = SPEECH_FOR[week.band];
    return week.speech.map((i, k) => {
      const word = words[i].word.replace(/[.?!,]+$/, "");
      const right = partOfSpeech(word, words[i].label);
      const others = options.filter((o) => o !== right);
      // Three wrong choices, rotated so they aren't always the same three.
      const pick = [0, 1, 2].map((n) => others[(i + n * 2) % others.length]).filter((o, n, a) => a.indexOf(o) === n);
      while (pick.length < 3) pick.push(others.find((o) => !pick.includes(o)));
      return {
        ...base, id: id(k + 1), skill: "speech", type: "which", prompt: `In “${sentence}” what part of speech is “${word}”?`,
        options: [right, ...pick], hint: "Look at the word's job in this sentence: naming (noun), doing or being (verb), describing a noun (adjective), telling how, when or where (adverb), or starting a phrase (preposition).",
      };
    });
  }
  if (day === 1) return [{ ...flow, id: id(), noMarkup: true, hint: "Find the subject and verb first, then ask the questions for the rest of the words." }];
  if (day === 2) return [{ ...flow, id: id(), markupOnly: true, hint: "Underline the subject part once and the verb part twice, put parentheses around each prepositional phrase, and circle the nouns." }];
  if (day === 3) return [{ ...base, id: id(), skill: "proofread", type: "proofread", text: week.proof, hint: "Check the first word, names, the verb, the end mark and any word that doesn't sound right." }];
  return [{
    ...base, id: id(), skill: "combining", type: "combine", parts: [sentence, week.part], use: week.use, answers: week.answers,
    hint: week.use === "and" || week.use === "but" || week.use === "or" || week.use === "so"
      ? `Keep both sentences whole: a comma, then ${week.use}. The second part starts with a small letter unless it begins with a name or I.`
      : `Put ${week.use} in front of the second idea. If that part comes first, put a comma after it.`,
  }];
}

/** The player's progress on this week: { key, id, done: [day indexes] } (a new week starts empty). */
export function weekProgress(player, week, now) {
  const key = weekKey(now);
  const saved = player.week;
  return saved && saved.key === key && saved.id === week.id ? saved : { key, id: week.id, done: [] };
}

/** Which days can be played now: today and the days before it this week (all five on the weekend). */
export function openDays(now) {
  return [0, 1, 2, 3, 4].filter((d) => d <= todayIndex(now));
}

/** The next day to play: the earliest open day not done yet, or null. */
export function nextDay(progress, now) {
  return openDays(now).find((d) => !progress.done.includes(d)) ?? null;
}

/** Problems with a week's content (for the content checker). */
export function weekProblems(week) {
  const out = [];
  const sentence = weekSentence(week);
  const proof = parseProofread({ text: week.proof });
  if (proof.answerText !== sentence) out.push(`${week.id}: Thursday's fixed text "${proof.answerText}" isn't the sentence "${sentence}"`);
  const words = parseTags(week.tags);
  for (const i of week.speech) if (!words[i] || !partOfSpeech(words[i].word, words[i].label)) out.push(`${week.id}: word ${i} has no part of speech to ask`);
  if (!week.answers.every((a) => a.toLowerCase().includes(week.use))) out.push(`${week.id}: an answer doesn't use ${week.use}`);
  return out;
}
