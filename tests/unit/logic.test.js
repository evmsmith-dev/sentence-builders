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
  assert.deepEqual([5.5, 6, 7, 7.5, 8].map(starsFor), [0, 1, 2, 2, 3]);
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
