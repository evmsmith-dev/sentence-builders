// Checks data/content.json before tests and deploys: every item can be shown and answered,
// ids are unique, every skill and level has enough items and a Tip Card.
import { readFile } from "node:fs/promises";
import { ITEMS_PER_LEVEL, SKILLS } from "../src/config.js";
import { validateItem } from "../src/lib/parse.js";

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
console.log(`data/content.json OK: ${content.items.length} items, ${Object.keys(content.tips).length} Tip Cards`);
