import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  answerText, paletteFor, checkBuild, checkMark, joinTiles, parseBuild, parseFix, parseMark, parseMarkText, parseWhich, spokenText,
} from "../../src/lib/parse.js";
import { pickLevelItems, rankItems } from "../../src/lib/select.js";
import {
  currentBadges, isUnlocked, newPlayer, recordLevel, skillTier, starsFor,
} from "../../src/lib/progress.js";

const content = JSON.parse(readFileSync(new URL("../../data/content.json", import.meta.url), "utf8"));
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

test("mark: brackets become gaps, with marks kept apart from words", () => {
  const parsed = parseMarkText('Jada said[,] ["]We can go now.["]');
  assert.deepEqual(parsed.words, ["Jada", "said", "We", "can", "go", "now."]);
  assert.deepEqual(parsed.gaps.map((gap) => gap.marks), ["", "", ',"', "", "", "", '"']);
});

test("mark: optional serial comma is right either way, missing commas are wrong", () => {
  const parsed = parseMark({ id: "t", text: "We packed apples[,] grapes[,?] and crackers." });
  // 6 words, so 7 gaps: before "We", after "We", after "packed", after "apples", ...
  assert.equal(checkMark(parsed, ["", "", "", ",", ",", "", ""]), true);
  assert.equal(checkMark(parsed, ["", "", "", ",", "", "", ""]), true);
  assert.equal(checkMark(parsed, ["", "", "", "", ",", "", ""]), false);
  assert.equal(checkMark(parsed, ["", "", ",", ",", ",", "", ""]), false, "an extra comma is wrong");
});

test("mark: order of marks in a gap matters (comma inside the quotation marks)", () => {
  const parsed = parseMark({ id: "t", text: '["]I am hungry[,"] said Max.' });
  assert.equal(checkMark(parsed, ['"', "", "", ',"', "", ""]), true);
  assert.equal(checkMark(parsed, ['"', "", "", '",', "", ""]), false);
});

test("mark: alternative answers are accepted", () => {
  const item = content.items.find((i) => i.id === "dialogue-3-03");
  const parsed = parseMark(item);
  const blank = parsed.words.map(() => "").concat("");
  const withBang = [...blank]; withBang[0] = '"'; withBang[3] = '!"';
  const withComma = [...blank]; withComma[0] = '"'; withComma[3] = ',"';
  assert.equal(checkMark(parsed, withBang), true);
  assert.equal(checkMark(parsed, withComma), true);
});

test("answer text is spaced naturally", () => {
  assert.equal(answerText({ type: "mark", id: "t", text: 'Jada said[,] ["]We can go now.["]' }), 'Jada said, "We can go now."');
  assert.equal(answerText({ type: "mark", id: "t", text: '["]If it rains[,"] said Ava[,] ["]we will stay inside.["]' }), '"If it rains," said Ava, "we will stay inside."');
  assert.equal(answerText({ type: "mark", id: "t", text: "Bring three things[:] a coat[,] boots[,?] and a snack." }), "Bring three things: a coat, boots, and a snack.");
});

test("fix: shown word, right word and choices", () => {
  const parsed = parseFix({ id: "t", text: "[Mayas|Maya's|Mayas'] bike has a flat tire." });
  assert.equal(parsed.target, 0);
  assert.deepEqual(parsed.words, ["Mayas", "bike", "has", "a", "flat", "tire."]);
  assert.deepEqual(parsed.choices, ["Maya's", "Mayas'"]);
  assert.equal(parsed.fixed, "Maya's bike has a flat tire.");
});

test("which: blank and whole-sentence forms", () => {
  const blank = parseWhich({ id: "t", text: "The team lost [its|it's] first game." });
  assert.equal(blank.answerText, "The team lost its first game.");
  assert.equal(spokenText({ type: "which", id: "t", text: "The team lost [its|it's] first game." }), "The team lost blank first game.");
  const sentences = parseWhich({ id: "t", options: ["A.", "B."] });
  assert.equal(sentences.correct, "A.");
});

test("build: tiles, punctuation joins the word before it", () => {
  const parsed = parseBuild({ id: "t", tiles: 'My sister said|,|"I|love|this|song."' });
  assert.equal(parsed.answerText, 'My sister said, "I love this song."');
  assert.equal(checkBuild(parsed, parsed.tiles), true);
  assert.equal(checkBuild(parsed, [...parsed.tiles].reverse()), false);
  assert.equal(joinTiles(["a", ",", "b", "."]), "a, b.");
});

test("every item in the bank shows and checks its own answer", () => {
  for (const item of content.items) assert.ok(answerText(item).length > 3, item.id);
});

test("level picks: 8 items, 6 from the level + 2 review once other levels are passed", () => {
  const items = content.items;
  const first = pickLevelItems({ items, skill: "commas", level: 1, random: seeded(3) });
  assert.equal(first.length, 8);
  assert.ok(first.every((item) => item.skill === "commas" && item.level === 1));
  assert.equal(new Set(first.map((item) => item.id)).size, 8);

  const later = pickLevelItems({ items, skill: "dialogue", level: 1, passedKeys: ["commas-1", "apostrophes-1"], random: seeded(5) });
  assert.equal(later.length, 8);
  assert.equal(later.filter((item) => item.review).length, 2);
  assert.ok(later[2].review && later[5].review);
  assert.equal(later.filter((item) => item.skill === "dialogue" && !item.review).length, 6);
});

test("ranking puts unseen first, then the most missed", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const ranked = rankItems(items, { a: { seen: 2, misses: 0, last: 5 }, b: { seen: 1, misses: 1, last: 9 } }, seeded(2));
  assert.deepEqual(ranked.map((item) => item.id), ["c", "b", "a"]);
});

test("stars: 6, 7 and 8 points", () => {
  assert.deepEqual([5.5, 6, 7, 7.5, 8].map((p) => starsFor(p)), [0, 1, 2, 2, 3]);
  assert.deepEqual([3.5, 4, 4.5, 5].map((p) => starsFor(p, 5)), [0, 1, 2, 3], "a 5-item Flow Factory level");
});

test("unlocking follows passes and the player's grade", () => {
  const grade4 = newPlayer({ id: "p", name: "A", avatar: "🦊", grade: 4, now: 0 });
  assert.equal(isUnlocked(grade4, "commas", 2), true, "grade 4 content opens for a 4th grader");
  assert.equal(isUnlocked(grade4, "commas", 3), false);
  assert.equal(isUnlocked(grade4, "dialogue", 3), false);
  const grade7 = newPlayer({ id: "q", name: "B", avatar: "🐼", grade: 7, now: 0 });
  assert.equal(isUnlocked(grade7, "apostrophes", 3), true, "a 7th grader can review anything");
});

test("recording a level: stars, item stats, second-try wins, gold over two days, badges", () => {
  const day1 = new Date("2026-11-15T10:00:00").getTime();
  const day2 = new Date("2026-11-16T10:00:00").getTime();
  let player = newPlayer({ id: "p", name: "A", avatar: "🦊", grade: 7, now: day1 });
  const results = (n) => Array.from({ length: 8 }, (_, i) => ({ id: `x${i}`, tries: i < n ? 1 : 2, correct: true }));

  let out = recordLevel(player, { skill: "commas", level: 1, results: results(6), now: day1 }); // 6 + 1 = 7 points
  assert.equal(out.points, 7);
  assert.equal(out.stars, 2);
  assert.equal(out.firstPass, true);
  assert.equal(out.player.secondTryWins, 2);
  assert.ok(out.newBadges.some((badge) => badge.id === "first-brick"));
  assert.ok(out.newBadges.some((badge) => badge.id === "comma-captain" && badge.tier === 1));
  player = out.player;

  out = recordLevel(player, { skill: "commas", level: 3, results: results(8), now: day1 });
  assert.equal(skillTier(out.player, "commas"), 1, "one gold day isn't mastery yet");
  out = recordLevel(out.player, { skill: "commas", level: 3, results: results(8), now: day1 });
  assert.equal(skillTier(out.player, "commas"), 1, "same day twice doesn't count");
  out = recordLevel(out.player, { skill: "commas", level: 3, results: results(8), now: day2 });
  assert.equal(skillTier(out.player, "commas"), 3);
  assert.ok(out.newBadges.some((badge) => badge.id === "comma-captain" && badge.tier === 3));
  assert.equal(currentBadges(out.player)["builders-week"], 0);
  assert.deepEqual(out.player.days, ["2026-11-15", "2026-11-16"]);
});

test("a failed level isn't passed and nothing is lost", () => {
  const player = newPlayer({ id: "p", name: "A", avatar: "🦊", grade: 3, now: 0 });
  const results = Array.from({ length: 8 }, (_, i) => ({ id: `x${i}`, tries: 2, correct: i < 4 }));
  const out = recordLevel(player, { skill: "commas", level: 1, results, now: 0 });
  assert.equal(out.stars, 0);
  assert.equal(out.passed, false);
  assert.equal(out.player.levels["commas-1"].plays, 1);
});

test("palettes: no period where every sentence already ends with one", () => {
  const marks = (id) => paletteFor(content.items.find((item) => item.id === id));
  assert.deepEqual(marks("commas-1-01"), [","]);
  assert.deepEqual(marks("commas-3-02"), [",", ":"]);
  assert.deepEqual(marks("dialogue-1-01"), [",", '"']);
  assert.deepEqual(marks("dialogue-2-01"), [",", ".", "?", "!", '"']);
  for (const item of content.items.filter((i) => i.type === "mark" && i.skill === "commas")) {
    assert.ok(!paletteFor(item).includes("."), item.id);
  }
});

test("sort items: check and answer text", async () => {
  const { parseSort, checkSort } = await import("../../src/lib/parse.js");
  const item = content.items.find((i) => i.id === "verbs-1-04");
  const parsed = parseSort(item);
  const right = Object.fromEntries(parsed.tiles.map((t) => [t.text, t.bin]));
  assert.equal(checkSort(parsed, right), true);
  assert.equal(checkSort(parsed, { ...right, walked: "Present" }), false);
  assert.equal(parsed.answerText, "Past: walked, swam, told. Present: jumps, eats, sings.");
});

test("time played, week summary, most missed, and old saves", async () => {
  const { weekSummary, mostMissed, normalizePlayer, MAX_LEVEL_MS } = await import("../../src/lib/progress.js");
  const now = new Date("2026-11-15T10:00:00").getTime();
  let player = newPlayer({ id: "p", name: "A", avatar: "🦊", grade: 4, now });
  const results = [{ id: "a", tries: 2, correct: true }, { id: "b", tries: 2, correct: false }, { id: "c", tries: 1, correct: true }];
  player = recordLevel(player, { skill: "verbs", level: 1, results, now, durationMs: 4 * 60000 }).player;
  player = recordLevel(player, { skill: "verbs", level: 1, results, now: now + 864e5 * 8, durationMs: 3 * 3600000 }).player;
  assert.equal(player.time["2026-11-15"], 4 * 60000);
  assert.equal(player.time["2026-11-23"], MAX_LEVEL_MS, "a game left open counts at most 15 minutes");
  assert.deepEqual(weekSummary(player, now + 864e5), { minutes: 4, daysPlayed: 1 });
  assert.deepEqual(mostMissed(player).map((m) => m.id).sort(), ["a", "b"]);
  const old = normalizePlayer({ id: "o", name: "Old", avatar: "🐼", grade: 5, levels: {}, goldDays: {}, items: {}, secondTryWins: 0, days: [], badges: {}, settings: { pip: false } });
  assert.equal(old.settings.pip, false);
  assert.equal(old.settings.breakMinutes, 0);
  assert.deepEqual(old.time, {});
});


test("sentence check: levels 1-2 ask complete or fragment, level 3 adds run-on", async () => {
  const { parseCheck } = await import("../../src/lib/parse.js");
  const frag = parseCheck(content.items.find((i) => i.id === "fragments-1-01"));
  assert.deepEqual(frag.kinds, ["complete", "fragment"]);
  assert.equal(frag.fix, "My dog ran to the park.");
  assert.equal(frag.answerText, "Fragment. Fix: My dog ran to the park.");
  const runon = parseCheck(content.items.find((i) => i.id === "fragments-3-01"));
  assert.deepEqual(runon.kinds, ["complete", "fragment", "runon"]);
  const complete = parseCheck(content.items.find((i) => i.id === "fragments-1-02"));
  assert.equal(complete.answerText, "The puppy chewed my shoe. (complete sentence)");
});

test("join: the word comes first, the comma follows the result", async () => {
  const { parseJoin, checkMark, parseMarkText } = await import("../../src/lib/parse.js");
  const withComma = parseJoin(content.items.find((i) => i.id === "compound-1-01"));
  assert.equal(withComma.word, "but");
  assert.equal(withComma.answerText, "I wanted pizza, but my sister wanted tacos.");
  const noComma = content.items.find((i) => i.id === "complex-1-01");
  const parsed = { answers: [parseMarkText(noComma.result)] };
  const blank = parsed.answers[0].gaps.map(() => "");
  assert.equal(checkMark(parsed, blank), true, "no comma needed when because comes in the middle");
  const extra = [...blank]; extra[4] = ",";
  assert.equal(checkMark(parsed, extra), false);
});

test("Build from labels: words match their labels; the capitalized word first; only compound parts swap", async () => {
  const { parseLabels, checkLabels } = await import("../../src/lib/parse.js");
  const horses = parseLabels(content.items.find((i) => i.tiles === "Five|Adj brown|Adj horses|SN galloped|V swiftly.|Adv"));
  assert.equal(checkLabels(horses, ["Five", "brown", "horses", "galloped", "swiftly"]), true);
  assert.equal(checkLabels(horses, ["brown", "Five", "horses", "galloped", "swiftly"]), false, "capitalized word goes first");
  const whale = parseLabels(content.items.find((i) => i.tiles === "The|A whale|SN is|LV a|A mammal.|PrN"));
  assert.equal(checkLabels(whale, ["a", "whale", "is", "The", "mammal"]), false);
  const loud = parseLabels(content.items.find((i) => i.tiles === "We|SP laughed|V very|Adv loudly.|Adv"));
  assert.equal(checkLabels(loud, ["We", "laughed", "loudly", "very"]), false, "very stays before loudly");
  assert.equal(loud.end, ".");
});

test("compounds: either part may come first, in every compound sentence in the content", async () => {
  const { parseLabels, checkLabels, compoundPairs, parseFlow, parseTags } = await import("../../src/lib/parse.js");
  const { buildDiagram, wrongSlots } = await import("../../src/lib/diagram.js");
  let swaps = 0;
  for (const item of content.items) {
    if (item.type === "labels") {
      const parsed = parseLabels(item);
      const words = parsed.tiles.map((t) => t.word);
      for (const [a, b] of compoundPairs(parsed.line, words)) {
        const swapped = [...words];
        [swapped[a], swapped[b]] = [swapped[b], swapped[a]];
        const capitalOk = a > 0 || /^[A-Z]/.test(words[b]);
        if (!capitalOk) continue;
        assert.equal(checkLabels(parsed, swapped), true, `${item.id}: ${swapped.join(" ")}`);
        swaps += 1;
      }
    }
    if (item.type === "flow") {
      // Every compound part has its own step, so tapping either part first can be accepted.
      const parsed = parseFlow(item);
      const labels = parsed.words.map((w) => w.label);
      for (const [a, b] of compoundPairs(labels)) {
        assert.ok(parsed.steps.some((s) => s.index === a) && parsed.steps.some((s) => s.index === b), `${item.id}: both parts need a step`);
        swaps += 1;
      }
    }
    if (item.type === "diagram") {
      const d = buildDiagram(item);
      for (const conj of d.slots.filter((s) => s.joins)) {
        const [a, b] = conj.joins.map((id) => d.slots[id]);
        const filled = Object.fromEntries(d.slots.map((s) => [s.id, s.text]));
        [filled[a.id], filled[b.id]] = [b.text, a.text];
        assert.deepEqual(wrongSlots(d, filled), [], `${item.id}: ${b.text} and ${a.text} on swapped branches`);
        swaps += 1;
      }
    }
  }
  assert.ok(swaps >= 60, `checked ${swaps} compounds`);
  const leo = parseLabels({ tiles: "Leo|CSN and|C I|CSP built|V-t a|A fort.|DO" });
  assert.equal(checkLabels(leo, ["I", "and", "Leo", "built", "a", "fort"]), false, "I goes last by courtesy");
  void parseTags;
});

test("Flow Factory: 5-item levels, and Gold needs the label sentences right", async () => {
  const { SKILLS } = await import("../../src/config.js");
  const flowSkill = SKILLS.find((s) => s.id === "flow");
  const picked = pickLevelItems({ items: content.items, skill: "flow", level: 3, plan: flowSkill.levelPlan, random: seeded(4) });
  assert.deepEqual(picked.map((i) => i.type), ["flow", "flow", "flow", "labels", "labels"]);
  const day = (d) => new Date(`2026-11-${d}T10:00:00`).getTime();
  const results = (labelsRight) => [
    ...[1, 2, 3].map((n) => ({ id: `f${n}`, type: "flow", tries: 1, correct: true })),
    { id: "l1", type: "labels", tries: 1, correct: true },
    { id: "l2", type: "labels", tries: 2, correct: labelsRight },
  ];
  let p = newPlayer({ id: "p", name: "A", avatar: "🦊", grade: 5, now: 0 });
  p = recordLevel(p, { skill: "flow", level: 3, results: results(false), now: day(15) }).player; // 4 points: 1 star, no gold
  assert.equal(p.levels["flow-3"].stars, 1);
  assert.equal((p.goldDays.flow || []).length, 0);
  p = recordLevel(p, { skill: "flow", level: 3, results: results(true), now: day(15) }).player; // 4.5 points, labels right
  p = recordLevel(p, { skill: "flow", level: 3, results: results(true), now: day(16) }).player;
  assert.equal(skillTier(p, "flow"), 3);
});

test("proofread: mistakes, choices and the fixed paragraph", async () => {
  const { parseProofread } = await import("../../src/lib/parse.js");
  const parsed = parseProofread(content.items.find((i) => i.id === "proofread-1-05"));
  assert.equal(parsed.errors.length, 2);
  assert.equal(parsed.errors[0].shown, "fossils");
  assert.equal(parsed.errors[0].correct, "fossils,");
  assert.equal(parsed.answerText, "At the museum we saw fossils, rocks, and gems. The guide answered all of our questions.");
});

test("Revision Ridge opens at grade 6", async () => {
  const { WORLDS, worldOpenFor } = await import("../../src/config.js");
  const desk = WORLDS.find((w) => w.id === "desk");
  assert.equal(worldOpenFor(desk, { grade: 5 }), false);
  assert.equal(worldOpenFor(desk, { grade: 6 }), true);
});

test("Advanced Q&A Flow: grade gate, labels and patterns per level", async () => {
  const { SKILLS, skillOpenFor } = await import("../../src/config.js");
  const { parseFlow } = await import("../../src/lib/parse.js");
  const flow2 = SKILLS.find((s) => s.id === "flow2");
  assert.equal(skillOpenFor(flow2, { grade: 5 }), false);
  assert.equal(skillOpenFor(flow2, { grade: 6 }), true);
  const command = parseFlow(content.items.find((i) => i.id === "flow2-1-01"));
  assert.equal(command.words[0].word, "(You)");
  assert.equal(command.kind, "Imp");
  assert.deepEqual(command.patternChoices, [1, 2, 3, 4, 5]);
  const p6 = parseFlow(content.items.find((i) => i.id === "flow2-2-01"));
  assert.ok(p6.labels.includes("OCN"));
  assert.deepEqual(p6.patternChoices, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(parseFlow(content.items.find((i) => i.id === "flow-3-01")).patternChoices.length, 5, "grade 5 flows still offer patterns 1-5");
});

test("hyphens and dashes join words without spaces; parentheses and ellipses space normally", () => {
  assert.equal(answerText({ type: "mark", id: "t", text: "My sister is twenty[-]one years old." }), "My sister is twenty-one years old.");
  assert.equal(answerText({ type: "mark", id: "t", text: "I opened the box and[—]surprise[—]it was empty!" }), "I opened the box and—surprise—it was empty!");
  assert.equal(answerText({ type: "mark", id: "t", text: "Our coach [(]Mr. Diaz[)] drove the bus." }), "Our coach (Mr. Diaz) drove the bus.");
  assert.equal(answerText({ type: "mark", id: "t", text: "Well[…] I guess we can go." }), "Well… I guess we can go.");
  const parsed = parseMark({ id: "t", text: "a well[-]known author" });
  assert.equal(checkMark(parsed, ["", "", "-", "", ""]), true);
});

test("Mark it up: Shurley Skill Check tasks come from the labels", async () => {
  const { markupTasks, checkMarkup, slashIndex, frontPredicate } = await import("../../src/lib/markup.js");
  // The two small puppies / ran quickly (to the door).
  const labels = ["A", "Adj", "Adj", "SN", "V", "Adv", "P", "A", "OP"];
  const tasks = markupTasks(labels);
  assert.deepEqual(tasks.map((t) => t.id), ["circle", "parens", "slash", "subject", "verb"]);
  assert.deepEqual(tasks[0].answer, [3, 8]);
  assert.deepEqual(tasks[1].answer, [6, 7, 8]);
  assert.deepEqual(tasks[2].answer, [4]); // slash right before the verb
  assert.deepEqual(tasks[3].answer, [0, 1, 2, 3]); // complete subject once
  assert.deepEqual(tasks[4].answer, [4, 5, 6, 7, 8]); // complete predicate twice
  assert.equal(checkMarkup(tasks[0], [8, 3]), true);
  assert.equal(checkMarkup(tasks[0], [3]), false);
  // The children / are swimming: the slash goes before the helping verb.
  assert.equal(slashIndex(["A", "SN", "HV", "V", "P", "A", "OP"]), 2);
  // Predicate words in the complete subject are underlined twice: Yesterday the puppies / played.
  assert.deepEqual(frontPredicate(["Adv", "A", "SN", "V"]), [0]);
  // (During the day) the kitten / slept.
  assert.deepEqual(frontPredicate(["P", "A", "OP", "A", "SN", "V"]), [0, 1, 2]);
  // Questions get the slash too: Can your sister / swim? Is the pool / open?
  const q = markupTasks(["HV", "PPA", "SN", "V"]);
  assert.deepEqual(q.find((t) => t.id === "slash").answer, [3]);
  assert.deepEqual(q.find((t) => t.id === "verb").answer, [0, 3]);
  assert.match(q.find((t) => t.id === "verb").prompt, /predicate words in the complete subject/);
  const lv = markupTasks(["LV", "A", "SN", "PA"], ["Are", "the", "cookies", "warm?"]).find((t) => t.id === "slash");
  assert.deepEqual(lv.answer, [3]);
  assert.equal(lv.prompt, "Divide the complete subject from the complete predicate with a slash.");
  assert.equal(lv.hint, "This question starts with its verb, Are, so the slash goes right after the complete subject, the cookies.");
  // (You) / Shut the gate: (You) isn't a noun.
  const cmd = markupTasks(["SP", "V-t", "A", "DO"]);
  assert.deepEqual(cmd[0].answer, [3]);
  assert.deepEqual(cmd.find((t) => t.id === "slash").answer, [1]);
});

test("diagrams: compound parts fork, very hangs from the word it describes, adverb pairs tell about the verb", async () => {
  const { buildDiagram, layoutDiagram, explainSlot } = await import("../../src/lib/diagram.js");
  const parentOf = (d, text) => d.slots[d.slots.find((s) => s.text === text).parent]?.text;
  const very = buildDiagram({ tags: "The|A huge|Adj dog|SN barked|V very|Adv loudly!|Adv" });
  assert.equal(parentOf(very, "very"), "loudly");
  assert.equal(parentOf(very, "loudly"), "barked");
  assert.match(explainSlot(very, very.slots.find((s) => s.text === "very")), /joined to loudly's line/);
  const pair = buildDiagram({ tags: "He|SP smiled|V proudly|Adv today.|Adv" });
  assert.equal(parentOf(pair, "today"), "smiled");
  const fork = buildDiagram({ tags: "Mia|CSN and|C Leo|CSN sang|V loudly.|Adv" });
  assert.equal(fork.tree.subject.fork, true);
  assert.deepEqual(fork.slots.filter((s) => s.baseline).map((s) => s.text), ["Mia", "Leo", "and", "sang"]);
  const layout = layoutDiagram(fork);
  assert.equal(layout.dashes.length, 1);
  const verbs = buildDiagram({ tags: "We|SP swam|CV and|C fished.|CV" });
  assert.equal(verbs.tree.verb.fork, true);
  // Not diagrammed: three compound parts.
  assert.equal(buildDiagram({ tags: "Mia|CSN Leo|CSN and|C Kai|CSN sang.|V" }), null);
  // Compound verbs share one direct object; compound objects and predicate words fork after the verb.
  const shared = buildDiagram({ tags: "We|SP washed|CV-t and|C dried|CV-t the|A dishes.|DO" });
  assert.equal(shared.tree.verb.fork, true);
  assert.equal(shared.tree.complement.kind, "DO");
  const cdo = buildDiagram({ tags: "Mia|SN packed|V-t apples|CDO and|C grapes.|CDO" });
  assert.equal(cdo.tree.complement.node.fork, true);
  assert.deepEqual(cdo.slots.filter((s) => s.baseline).map((s) => s.text), ["Mia", "packed", "apples", "grapes", "and"]);
  assert.match(explainSlot(cdo, cdo.slots.find((s) => s.text === "grapes")), /compound direct object.*packed what/);
  assert.equal(buildDiagram({ tags: "The|A soup|SN is|LV hot|CPA and|C salty.|CPA" }).tree.complement.kind, "PA");
  // Compound objects that hang below fork where they hang: off the preposition, or under the verb.
  const cop = buildDiagram({ tags: "I|SP walked|V with|P Leo|COP and|C Ana.|COP" });
  assert.equal(parentOf(cop, "Leo"), "with");
  assert.equal(parentOf(cop, "Ana"), "with");
  assert.equal(cop.slots.find((s) => s.text === "and").baseline, false);
  const cio = buildDiagram({ tags: "Dad|SN gave|V-t Mom|CIO and|C me|CIO a|A hug.|DO" });
  assert.equal(parentOf(cio, "Mom"), "gave");
  assert.equal(layoutDiagram(cio).dashes.length, 1);
});

test("noun table: job, singular or plural, common or proper, then the simple subject and predicate", async () => {
  const { nounTableQuestions } = await import("../../src/lib/nountable.js");
  const { markupTasks } = await import("../../src/lib/markup.js");
  const { nounInfo } = await import("../../src/lib/nouns.js");
  const split = (tags) => tags.split(" ").map((t) => t.split("|"));
  const t = split("Grandma|SN told|V-t us|IO a|A story.|DO");
  const qs = nounTableQuestions(t.map((x) => x[1]), t.map((x) => x[0]), ["SN", "V-t", "IO", "DO", "A"]);
  // us is a pronoun: not in the table, and not circled in the noun check.
  assert.deepEqual(qs.map((q) => q.id), ["job-0", "number-0", "kind-0", "job-4", "number-4", "kind-4", "simple-subject", "simple-predicate"]);
  assert.deepEqual(qs.filter((q) => q.id !== "job-0" && q.id !== "job-4").map((q) => q.answer), ["Singular", "Proper", "Singular", "Common", "Grandma", "told"]);
  assert.equal(qs[0].answer, "SN · subject noun");
  assert.deepEqual(markupTasks(t.map((x) => x[1]), t.map((x) => x[0]))[0].answer, [0, 4]);
  // The first word is capitalized anyway: only names (and family words used as names) are proper there.
  assert.equal(nounInfo("Puppies", 0).kind, "Common");
  assert.equal(nounInfo("Mia", 0).kind, "Proper");
  assert.equal(nounInfo("geese.").number, "Plural");
  const hv = split("The|A tiny|Adj mouse|SN was|HV hiding|V behind|P the|A couch!|OP");
  assert.equal(nounTableQuestions(hv.map((x) => x[1]), hv.map((x) => x[0])).at(-1).answer, "was hiding");
});

test("bricks: earned per sentence, star and first pass; decorations cost bricks and are built once", async () => {
  const { bricksFor, buyDecor, moveDecor, removeDecor, normalizePlayer, recordLevel, newPlayer, homeworkGrade, recordHomework } = await import("../../src/lib/progress.js");
  const results = [{ correct: true, tries: 1 }, { correct: true, tries: 2 }, { correct: false, tries: 2 }];
  assert.equal(bricksFor(results, 2, true), 2 + 1 + 0 + 6 + 10);
  assert.equal(bricksFor(results, 0, false), 3);
  let p = newPlayer({ id: "p", name: "Ava", avatar: "🦊", grade: 4, now: 0 });
  const eight = Array.from({ length: 8 }, (_, i) => ({ id: `commas-1-0${i + 1}`, correct: true, tries: 1 }));
  const out = recordLevel(p, { skill: "commas", level: 1, results: eight, now: Date.UTC(2026, 10, 16) });
  assert.equal(out.bricks, 16 + 9 + 10);
  assert.equal(out.player.bricks, 35);
  assert.equal(recordLevel(out.player, { skill: "commas", level: 1, results: eight, now: Date.UTC(2026, 10, 17) }).bricks, 25); // no first-pass bonus twice
  p = out.player;
  assert.equal(buyDecor(p, "ferris"), null); // 160 is too many
  const one = buyDecor(p, "oak");
  assert.equal(one.player.bricks, 35 - 12);
  assert.equal(one.player.decor.length, 1);
  assert.equal(one.player.decor[0].id, "oak");
  const two = buyDecor(one.player, "oak"); // more than one of anything
  assert.equal(two.player.decor.length, 2);
  assert.notEqual(two.uid, one.uid);
  assert.notEqual(two.player.decor[1].x, two.player.decor[0].x); // copies don't stack exactly
  const moved = moveDecor(two.player, one.uid, 999, -50); // kept inside the scene
  assert.deepEqual([moved.decor[0].x, moved.decor[0].y], [348, 28]);
  const away = removeDecor(moved, one.uid); // full refund
  assert.equal(away.bricks, 35 - 24 + 12);
  assert.deepEqual(away.decor.map((d) => d.uid), [two.uid]);
  // Older saves listed ids; they keep their old spots.
  const old = normalizePlayer({ ...p, decor: ["oak", "ducks"] });
  assert.deepEqual(old.decor.map((d) => [d.id, d.x, d.y]), [["oak", 28, 100], ["ducks", 60, 166]]);
  // Pip's homework: graded A+ … Try again; 6 bricks a paragraph right first, 3 on the second try.
  assert.equal(homeworkGrade([{ correct: true, tries: 1 }, { correct: true, tries: 1 }]), "A+");
  assert.equal(homeworkGrade([{ correct: true, tries: 1 }, { correct: true, tries: 2 }]), "B");
  const hw = recordHomework(p, { results: [{ id: "hw-3-5-01", correct: true, tries: 1 }, { id: "hw-3-5-02", correct: true, tries: 2 }, { id: "hw-3-5-03", correct: false, tries: 2 }], now: 1 });
  assert.equal(hw.bricks, 9);
  assert.equal(hw.right, 1);
  assert.deepEqual(hw.player.levels, p.levels); // doesn't count toward levels
});

test("town districts: themed decorations stay in their district; old saves move to the Town Square", async () => {
  const { buyDecor, normalizePlayer } = await import("../../src/lib/progress.js");
  const { DECOR, decorFor } = await import("../../src/config.js");
  const p = { ...newPlayer({ id: "p", name: "A", avatar: "🦊", grade: 4, now: 0 }), bricks: 200 };
  assert.equal(buyDecor(p, "anchor", "works"), null); // the anchor belongs to Punctuation Port
  const port = buyDecor(p, "anchor", "port");
  assert.equal(port.player.decor[0].area, "port");
  assert.equal(buyDecor(p, "oak", "desk").player.decor[0].area, "desk"); // everyday decorations go anywhere
  assert.equal(buyDecor(p, "oak").player.decor[0].area, "square");
  assert.ok(decorFor("port").some((d) => d.id === "anchor") && !decorFor("works").some((d) => d.id === "anchor"));
  for (const area of ["port", "works", "studio", "flow", "desk"]) assert.ok(DECOR.filter((d) => d.area === area).length >= 6, area);
  const old = normalizePlayer({ ...p, decor: [{ uid: "d1", id: "oak", x: 30, y: 100 }] });
  assert.equal(old.decor[0].area, "square");
  assert.equal(old.decor[0].x, 30); // exactly where it was
});

test("practice: Summit Review mixes passed skills, missed questions first; spelling by grade band", async () => {
  const { pickSummitItems, pickSpellingItems } = await import("../../src/lib/select.js");
  const { recordPractice } = await import("../../src/lib/progress.js");
  const content = JSON.parse(readFileSync(new URL("../../data/content.json", import.meta.url), "utf8"));
  const missed = content.items.find((i) => i.skill === "verbs" && i.level === 1 && i.type !== "flow");
  const picked = pickSummitItems({ items: content.items, passedKeys: ["commas-1", "verbs-1"], stats: { [missed.id]: { seen: 1, misses: 2, last: 5 } }, count: 8 });
  assert.equal(picked.length, 8);
  assert.ok(picked.every((i) => ["commas-1", "verbs-1"].includes(`${i.skill}-${i.level}`)));
  assert.equal(picked[0].id, missed.id); // the missed one leads
  for (let n = 1; n < picked.length; n++) assert.notEqual(picked[n].skill, picked[n - 1].skill);
  assert.deepEqual(pickSummitItems({ items: content.items, passedKeys: [], count: 8 }), []);
  assert.ok(pickSpellingItems({ items: content.spelling, grade: 4, count: 8 }).every((i) => i.level === 1));
  assert.ok(pickSpellingItems({ items: content.spelling, grade: 7, count: 8 }).every((i) => i.level === 2));
  const p = newPlayer({ id: "p", name: "A", avatar: "🦊", grade: 4, now: 0 });
  const results = Array.from({ length: 8 }, (_, k) => ({ id: `x${k}`, correct: k < 7, tries: k < 6 ? 1 : 2 }));
  const out = recordPractice(p, { kind: "summit", results, now: 1000 });
  assert.equal(out.right, 6);
  assert.ok(out.reached);
  assert.equal(out.player.summits, 1);
  assert.equal(out.bricks, 6 * 2 + 1); // 2 each on the first try, 1 on the second
  assert.equal(out.player.items.x6.misses, 1);
  assert.equal(recordPractice(p, { kind: "lake", results: results.map((r) => ({ ...r, tries: 2 })), now: 1 }).player.lakeWins, 0);
});

test("compounds: mark-up circles compound nouns, a phrase runs to its last object, an interjection isn't underlined", async () => {
  const { markupTasks } = await import("../../src/lib/markup.js");
  const split = (tags) => tags.split(" ").map((t) => t.split("|"));
  const s = split("My|PPA sister|SN played|V with|P blocks|COP and|C trucks.|COP");
  const tasks = Object.fromEntries(markupTasks(s.map((x) => x[1]), s.map((x) => x[0])).map((t) => [t.id, t]));
  assert.deepEqual(tasks.circle.answer, [1, 4, 6]);
  assert.deepEqual(tasks.parens.answer, [3, 4, 5, 6]); // with blocks and trucks
  const w = split("Wow,|I the|A ducks|SN swam|V away!|Adv");
  const wt = Object.fromEntries(markupTasks(w.map((x) => x[1]), w.map((x) => x[0])).map((t) => [t.id, t]));
  assert.deepEqual(wt.subject.answer, [1, 2]); // not Wow
  assert.deepEqual(wt.verb.answer, [3, 4]);
  const v = split("We|SP washed|CV-t and|C dried|CV-t the|A dishes.|DO");
  const vt = Object.fromEntries(markupTasks(v.map((x) => x[1]), v.map((x) => x[0])).map((t) => [t.id, t]));
  assert.deepEqual(vt.slash.answer, [1]);
});
