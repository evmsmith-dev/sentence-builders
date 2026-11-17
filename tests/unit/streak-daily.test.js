import { test } from "node:test";
import assert from "node:assert/strict";
import { localDate, streakDays } from "../../src/lib/progress.js";
import { pickDailyItems } from "../../src/lib/select.js";

const now = new Date(2026, 10, 17, 18).getTime(); // a Tuesday evening
const ago = (n) => localDate(new Date(2026, 10, 17 - n, 12).getTime());

test("streak: days in a row, counted from today or from yesterday", () => {
  assert.equal(streakDays([], now), 0);
  assert.equal(streakDays([ago(0)], now), 1);
  assert.equal(streakDays([ago(0), ago(1), ago(2)], now), 3);
  assert.equal(streakDays([ago(1), ago(2)], now), 2, "not played yet today: yesterday's streak still stands");
});

test("streak: one missed day a week is forgiven; two in a row end it", () => {
  assert.equal(streakDays([ago(0), ago(2), ago(3)], now), 3, "one gap is skipped");
  assert.equal(streakDays([ago(0), ago(3), ago(4)], now), 1, "two missed days in a row end it");
  assert.equal(streakDays([ago(0), ago(2), ago(4), ago(5)], now), 2, "a second gap within a week ends it");
  assert.equal(streakDays([ago(0), ago(2), ago(3), ago(4), ago(5), ago(6), ago(7), ago(8), ago(10), ago(11)], now), 10, "a gap a week later is forgiven again");
});

test("Daily 5: five quick questions from the given levels, no paragraphs or labeling", () => {
  const items = [
    ...Array.from({ length: 6 }, (_, i) => ({ id: `a-${i}`, skill: "case", level: 2, type: "which" })),
    ...Array.from({ length: 6 }, (_, i) => ({ id: `b-${i}`, skill: "aside", level: 2, type: "mark" })),
    { id: "p", skill: "proofread", level: 2, type: "proofread" },
    { id: "f", skill: "flow2", level: 2, type: "flow" },
    { id: "z", skill: "types", level: 1, type: "which" },
  ];
  const picked = pickDailyItems({ items, levelKeys: ["case-2", "aside-2", "proofread-2", "flow2-2"], count: 5, random: () => 0.5 });
  assert.equal(picked.length, 5);
  assert.ok(picked.every((i) => ["case", "aside"].includes(i.skill)));
  assert.ok(new Set(picked.map((i) => i.skill)).size === 2, "spread across skills");
});
