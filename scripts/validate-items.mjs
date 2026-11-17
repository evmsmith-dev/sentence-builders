// Checks data/content.json before tests and deploys: every item can be shown and answered,
// ids are unique, every skill and level has enough items and a Tip Card.
import { readFile } from "node:fs/promises";
import { HOMEWORK_PER_ROUND, ITEMS_PER_LEVEL, PRACTICE_PER_ROUND, SKILLS, SPELLING_RULES } from "../src/config.js";
import { validateItem } from "../src/lib/parse.js";
import { weekDayItems, weekProblems } from "../src/lib/week.js";

const content = JSON.parse(await readFile(new URL("../data/content.json", import.meta.url), "utf8"));
const problems = [];
const ids = new Set();
for (const item of content.items) {
  try {
    validateItem(item);
  } catch (error) {
    problems.push(error.message);
  }
  if (ids.has(item.id)) problems.push(`${item.id}: id used twice`);
  ids.add(item.id);
  if (!SKILLS.some((skill) => skill.id === item.skill)) problems.push(`${item.id}: unknown skill ${item.skill}`);
  if (![1, 2, 3].includes(item.level)) problems.push(`${item.id}: level must be 1, 2 or 3`);
}
// Spelling Lake: "which spelling is right" questions for grades 3–5 (level 1) and 6–8 (level 2), each tied to a Rule Book rule.
for (const item of content.spelling || []) {
  try {
    validateItem(item);
  } catch (error) {
    problems.push(error.message);
  }
  if (item.type !== "which" || item.skill !== "spelling") problems.push(`${item.id}: spelling questions are "which" items with skill "spelling"`);
  if (![1, 2].includes(item.level)) problems.push(`${item.id}: spelling level must be 1 (grades 3-5) or 2 (grades 6-8)`);
  if (!SPELLING_RULES.some((r) => r.id === item.rule)) problems.push(`${item.id}: unknown spelling rule ${item.rule}`);
  if (ids.has(item.id)) problems.push(`${item.id}: id used twice`);
  ids.add(item.id);
}
for (const level of [1, 2]) {
  const n = (content.spelling || []).filter((s) => s.level === level).length;
  if (n < PRACTICE_PER_ROUND * 3) problems.push(`Spelling level ${level}: only ${n} questions (needs ${PRACTICE_PER_ROUND * 3}+)`);
}
// Pip's homework: proofreading paragraphs for grades 3–5 and 6–8.
for (const band of ["3-4", "5", "6-8"]) {
  const set = (content.homework || []).filter((h) => h.band === band);
  if (set.length < HOMEWORK_PER_ROUND * 2) problems.push(`Pip's homework ${band}: only ${set.length} paragraphs (needs ${HOMEWORK_PER_ROUND * 2}+)`);
}
for (const hw of content.homework || []) {
  try {
    validateItem({ ...hw, skill: "proofread", level: 1 });
  } catch (error) {
    problems.push(error.message);
  }
  if (!hw.title) problems.push(`${hw.id}: needs a title`);
  if (ids.has(hw.id)) problems.push(`${hw.id}: id used twice`);
  ids.add(hw.id);
}
// Sentence of the Week: 4+ weeks per grade band; every day's items must play, and the days must agree.
for (const band of ["3-4", "5", "6-8"]) {
  const n = (content.weeks || []).filter((w) => w.band === band).length;
  if (n < 4) problems.push(`Sentence of the Week ${band}: only ${n} weeks (needs 4+)`);
}
for (const week of content.weeks || []) {
  if (ids.has(week.id)) problems.push(`${week.id}: id used twice`);
  ids.add(week.id);
  problems.push(...weekProblems(week));
  for (const day of [0, 1, 2, 3, 4]) {
    for (const item of weekDayItems(week, day)) {
      try {
        validateItem(item);
      } catch (error) {
        problems.push(error.message);
      }
    }
  }
}
for (const skill of SKILLS) {
  for (const level of [1, 2, 3]) {
    const own = content.items.filter((item) => item.skill === skill.id && item.level === level);
    if (skill.levelPlan) {
      for (const { type, count } of skill.levelPlan) {
        const have = own.filter((item) => item.type === type).length;
        if (have < count) problems.push(`${skill.id} level ${level}: only ${have} ${type} items (needs ${count}+)`);
      }
    } else if (own.length < ITEMS_PER_LEVEL) {
      problems.push(`${skill.id} level ${level}: only ${own.length} items (needs ${ITEMS_PER_LEVEL}+)`);
    }
    const tip = content.tips[`${skill.id}-${level}`];
    if (!tip?.title || !tip?.rule || !tip?.example) problems.push(`${skill.id} level ${level}: Tip Card missing`);
  }
}
if (problems.length) {
  console.error(`${problems.length} problem(s) in data/content.json:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`data/content.json OK: ${content.items.length} items, ${(content.homework || []).length} homework paragraphs, ${(content.spelling || []).length} spelling questions, ${Object.keys(content.tips).length} Tip Cards`);
