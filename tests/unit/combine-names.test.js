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

test("teacher report: habits by range, first-try rates and what needs practice", async () => {
  const { teacherReport, reportText } = await import("../../src/lib/report.js");
  const { localDate } = await import("../../src/lib/progress.js");
  const now = Date.UTC(2026, 10, 16, 18);
  const today = localDate(now);
  const old = localDate(now - 20 * 864e5);
  const p = {
    name: "Evan", grade: 4, levels: { "commas-1": { best: 7, stars: 2, plays: 1, passedOn: today }, "verbs-1": { best: 6, stars: 1, plays: 1, passedOn: old } },
    items: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`commas-2-0${i + 1}`, { seen: 1, misses: i < 4 ? 1 : 0, last: now }])),
    days: [today, old], time: { [today]: 600000, [old]: 300000 }, goldDays: {}, badges: {},
  };
  const week = teacherReport(p, content, { now, range: "week" });
  assert.deepEqual(week.habits, { minutes: 10, days: 1, passed: 1 });
  assert.deepEqual(teacherReport(p, content, { now, range: "month" }).habits, { minutes: 15, days: 2, passed: 2 });
  const commas = week.worlds[0].skills.find((s) => s.id === "commas");
  assert.equal(commas.firstTryText, "50%");
  assert.equal(week.needs[0].name, "Commas and colons");
  assert.equal(week.needs[0].examples.length, 2);
  assert.ok(!week.worlds.some((w) => w.id === "desk"), "grade 4 doesn't see Revision Ridge");
  const text = reportText(week, "Hi!");
  assert.match(text, /Practice: 10 minutes on 1 day; 1 level passed\./);
  assert.match(text, /Note: Hi!/);
});

test("Listen and Write: capitals, marks and apostrophes count; spelling doesn't", async () => {
  const { checkDictation, dictationPhrases } = await import("../../src/lib/parse.js");
  const t = 'Mom said, "We can\'t go to Duluth on Monday."';
  const c = (typed) => checkDictation(t, typed);
  assert.equal(c(t).right, true);
  assert.match(c(t.replace("Mom", "mom")).hint, /capital/);
  assert.match(c(t.replace("said,", "said")).hint, /comma after "said"/);
  assert.match(c(t.replace("can't", "cant")).hint, /apostrophe/);
  assert.match(c(t.replace("Duluth", "duluth")).hint, /Duluth needs a capital/);
  const typo = c(t.replace("Monday", "Mnoday").replace(" to ", " too "));
  assert.equal(typo.right, true);
  assert.deepEqual(typo.spelling.map((s) => s.word), ["to", "Monday"]);
  assert.match(c(t.replace(" on Monday", "")).hint, /missing/);
  assert.equal(checkDictation("Watch out!", "Watch out.").right, true, "a voice can't show !");
  assert.deepEqual(dictationPhrases(t), ["Mom said,", '"We can\'t go to Duluth', 'on Monday."']);
});

test("Sentence of the Week: bands, week turns, open days and the week's record", async () => {
  const { bandFor, openDays, todayIndex, weekDayItems, weekFor, weekKey, nextDay } = await import("../../src/lib/week.js");
  const { recordWeekDay } = await import("../../src/lib/progress.js");
  assert.deepEqual([3, 4, 5, 6, 8].map(bandFor), ["3-4", "3-4", "5", "6-8", "6-8"]);
  const wed = new Date(2026, 10, 18, 10).getTime();
  const sun = new Date(2026, 10, 22, 10).getTime();
  assert.equal(weekKey(wed), "2026-11-16");
  assert.equal(weekKey(sun), "2026-11-16");
  assert.deepEqual(openDays(wed), [0, 1, 2]);
  assert.equal(todayIndex(sun), 5);
  assert.deepEqual(openDays(sun), [0, 1, 2, 3, 4]);
  const a = weekFor(content.weeks, 4, wed);
  assert.equal(weekFor(content.weeks, 4, sun).id, a.id, "the same all week");
  assert.notEqual(weekFor(content.weeks, 4, wed + 7 * 864e5).id, a.id, "a new one next week");
  assert.deepEqual([0, 1, 2, 3, 4].map((d) => weekDayItems(a, d).map((i) => i.type).join()), ["which,which", "flow", "flow", "proofread", "combine"]);
  assert.equal(nextDay({ done: [0] }, wed), 1);
  let p = { name: "A", grade: 4, items: {}, days: [], time: {}, bricks: 0, levels: {}, badges: {}, goldDays: {} };
  const progress = { key: weekKey(wed), id: a.id, done: [0, 1, 2, 3] };
  const out = recordWeekDay(p, { progress, day: 4, sentence: "S.", results: [{ id: "x", tries: 1, correct: true }], now: wed, bonus: 15 });
  assert.equal(out.weekDone, true);
  assert.equal(out.bricks, 17);
  assert.deepEqual(out.player.banners, [{ key: "2026-11-16", text: "S." }]);
  // Doing a day again doesn't hang a second banner.
  const again = recordWeekDay(out.player, { progress: out.player.week, day: 4, sentence: "S.", results: [], now: wed, bonus: 15 });
  assert.equal(again.weekDone, false);
  assert.equal(again.player.banners.length, 1);
});
