import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateItem } from "../../src/lib/parse.js";
import { checkWorkshop, parseWorkshop, workshopExample, workshopFlowItem, workshopGoal, workshopText } from "../../src/lib/workshop.js";

const content = JSON.parse(readFileSync(new URL("../../data/content.json", import.meta.url), "utf8"));
const items = content.items.filter((i) => i.type === "workshop");
const byWords = (item, words) => {
  const pool = [...parseWorkshop(item).tiles];
  return words.split(" ").map((w) => pool.splice(pool.findIndex((t) => t.word === w), 1)[0]);
};
const p1 = items.find((i) => i.id === "workshop-1-01");

test("Sentence Workshop: the structure is checked, not the exact words", () => {
  assert.equal(checkWorkshop(p1, byWords(p1, "the sleepy puppy napped outside")).right, true);
  assert.equal(checkWorkshop(p1, byWords(p1, "a brown kitten wiggled happily")).right, true);
  assert.equal(workshopText(byWords(p1, "a brown kitten wiggled happily")), "A brown kitten wiggled happily.");
});

test("Sentence Workshop: the, a, an and my can be used again, so every noun can have its own the", () => {
  const item = items.find((i) => i.id === "workshop-2-15");
  const the = parseWorkshop(item).tiles.find((t) => t.word === "the");
  const placed = byWords(item, "careful baker hummed in kitchen");
  const sentence = [the, ...placed.slice(0, 3), placed[3], the, placed[4]];
  assert.equal(workshopText(sentence), "The careful baker hummed in the kitchen.");
  assert.equal(checkWorkshop(item, sentence).right, true);
  // Every item can be built with "the" before every noun that needs a word there.
  for (const it of items) {
    const words = it.example.split(" ");
    const tiles = parseWorkshop(it).tiles;
    if ((it.need || []).includes("PPA")) continue;
    const thes = words.map((w) => { const t = tiles.find((x) => x.word === w); return t.kind === "A" || t.kind === "PPA" ? "the" : w; });
    const built = thes.map((w) => tiles.find((x) => x.word === w));
    assert.equal(checkWorkshop(it, built).right, true, `${it.id}: ${thes.join(" ")}`);
  }
});

test("Sentence Workshop: a wrong build says what to fix", () => {
  assert.match(checkWorkshop(p1, byWords(p1, "puppy napped outside")).why, /needs a word like the, a or my/);
  assert.match(checkWorkshop(p1, byWords(p1, "napped the puppy")).why, /Start with the subject/);
  assert.match(checkWorkshop(p1, byWords(p1, "the sleepy puppy napped")).why, /also asks for an adverb/);
  assert.match(checkWorkshop(p1, byWords(p1, "the puppy napped outside")).why, /also asks for an adjective/);
  const owl = items.find((i) => i.id === "workshop-1-02");
  assert.match(checkWorkshop(owl, byWords(owl, "an tiny frog hopped away")).why, /Use a before a consonant sound/);
  const p5 = items.find((i) => i.id === "workshop-3-15");
  assert.match(checkWorkshop(p5, byWords(p5, "the tiny puppies was sleepy")).why, /Were goes with more than one/);
  const p2 = items.find((i) => i.id === "workshop-3-01");
  assert.match(checkWorkshop(p2, byWords(p2, "the hungry puppy napped")).why, /does something to someone or something/);
  assert.match(checkWorkshop(p2, byWords(p2, "the hungry puppy chased")).why, /direct object/);
  assert.match(workshopGoal(p2), /^Build a Pattern 2 sentence \(subject noun \+ verb \+ direct object\) with an adjective\.$/);
});

test("Sentence Workshop: the Q&A Flow for a built sentence asks Shurley's questions", () => {
  const item = items.find((i) => i.id === "workshop-3-05");
  const placed = workshopExample(item);
  const flow = workshopFlowItem(item, placed, checkWorkshop(item, placed).roles);
  assert.equal(flow.tags, "The|A kind|Adj neighbor|SN gave|V-t my|PPA dog|IO a|A bone.|DO");
  assert.deepEqual(flow.steps.slice(0, 4), [["Who gave my dog a bone?", 2], ["What is being said about neighbor?", 3, "V"], ["Neighbor gave what?", 7], ["Neighbor gave a bone to what?", 5]]);
});

// Every sentence a child could build (random tile orders, many tries an item) gives a Q&A Flow the checker accepts.
test("Sentence Workshop: any right build makes a valid Q&A Flow", () => {
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let checked = 0;
  for (const item of items) {
    const { tiles } = parseWorkshop(item);
    for (let n = 0; n < 15000; n++) {
      const pool = [...tiles].sort(() => rand() - 0.5).slice(0, 3 + Math.floor(rand() * 6));
      const result = checkWorkshop(item, pool);
      if (!result.right) continue;
      checked += 1;
      assert.doesNotThrow(() => validateItem(workshopFlowItem(item, pool, result.roles)), `${item.id}: ${pool.map((t) => t.word).join(" ")}`);
    }
  }
  assert.ok(checked > 150, `only ${checked} right builds found`);
});
