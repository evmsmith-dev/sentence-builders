import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkCombine, parseCombine, tidyTyped, validateItem } from "../../src/lib/parse.js";
import { cleanName, namesFor, personalize, registerNames } from "../../src/lib/names.js";
import { nounInfo } from "../../src/lib/nouns.js";

const content = JSON.parse(readFileSync(new URL("../../data/content.json", import.meta.url), "utf8"));

test("sentence combining: exact answers count, near misses get a pointed hint", () => {
  const parsed = parseCombine({ parts: ["Mia likes cats.", "Her brother likes dogs."], answers: ["Mia likes cats, but her brother likes dogs."], use: "but" });
  const check = (typed) => checkCombine(parsed, typed);
  assert.equal(check("Mia likes cats, but her brother likes dogs.").right, true);
  assert.equal(check("  Mia likes cats ,  but her brother likes dogs. ").right, true);
  assert.match(check("mia likes cats, but her brother likes dogs.").hint, /capital/);
  assert.match(check("Mia likes cats, but Her brother likes dogs.").hint, /Her/);
  assert.match(check("Mia likes cats but her brother likes dogs.").hint, /comma/);
  assert.match(check("Mia likes cats, but her brother likes dogs").hint, /period/);
  assert.match(check("Mia likes cats, and her brother likes dogs.").hint, /but/);
  assert.match(check("Mia likes cats, but her bruther likes dogs.").hint, /bruther/);
  assert.equal(check("Mia likes cats. But her brother likes dogs.").right, false);
  assert.equal(tidyTyped("He didn't go. It's late."), "He did not go. It is late.");
});

test("every combining item accepts each of its answers and not the sentences as given", () => {
  const items = content.items.filter((item) => item.type === "combine");
  assert.ok(items.length >= 48);
  for (const item of items) assert.ok(validateItem(item));
});

test("names in sentences: swapped by he or she, everywhere in the item, never twice", () => {
  assert.equal(cleanName("evan"), "Evan");
  assert.equal(cleanName("Mary Ann"), "");
  assert.equal(cleanName("dog"), "");
  const player = { settings: { names: { on: true, people: [{ name: "Evan", pronoun: "he" }, { name: "Zoe", pronoun: "she" }, { name: "Quinn", pronoun: "" }], pet: "Pickles" } } };
  const names = namesFor(player);
  assert.deepEqual(names, { he: ["Evan"], she: ["Zoe"], pet: ["Pickles"] });
  assert.equal(namesFor({ settings: { names: { ...player.settings.names, on: false } } }), null);
  const always = { rand: () => 0 };
  const item = { id: "x", skill: "pronouns", level: 2, type: "fix", text: "Leo scraped [her|his|its] own knee.", hint: "Leo is a he." };
  const out = personalize(item, names, always);
  assert.equal(out.text, "Evan scraped [her|his|its] own knee.");
  assert.equal(out.hint, "Evan is a he.");
  assert.equal(out.id, "x");
  // Possessives and the other spellings change too.
  assert.equal(personalize({ text: "[Mayas|Maya's|Mayas'] bike" }, names, always).text, "[Zoes|Zoe's|Zoes'] bike");
  assert.equal(personalize({ text: "My brother [omar|Omar|OMAR] plays." }, names, always).text, "My brother [evan|Evan|EVAN] plays.");
  // A pet's name stays a pet's; "a puppy named Max" keeps Max.
  assert.equal(personalize({ text: "We got a puppy named [max|Max|MAX]." }, names, always).text, "We got a puppy named [max|Max|MAX].");
  assert.equal(personalize({ text: "My cat [Biscuit|biscuit] sleeps." }, names, always).text, "My cat [Pickles|pickles] sleeps.");
  // One of the player's names is never used twice, and a name already in the sentence isn't added.
  assert.equal(personalize({ text: "Leo and Ben ran." }, names, always).text, "Evan and Ben ran.");
  assert.equal(personalize({ text: "Evan and Leo ran." }, names, always).text, "Evan and Leo ran.");
  // About half the sentences: none when the dice say no.
  assert.equal(personalize(item, names, { rand: () => 0.99 }), item);
  // The noun table knows a new name is a singular proper noun.
  registerNames(names);
  assert.deepEqual(nounInfo("Evan", 0), { number: "Singular", kind: "Proper" });
});

test("every item still validates with the player's names in it", () => {
  const names = { he: ["Evan"], she: ["Zoe"], pet: ["Pickles"] };
  registerNames(names);
  for (const item of content.items) assert.ok(validateItem(personalize(item, names, { rand: () => 0 })), item.id);
});
