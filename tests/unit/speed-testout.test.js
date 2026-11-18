import { test } from "node:test";
import assert from "node:assert/strict";
import { mistakeKind } from "../../src/lib/parse.js";
import { parseSpeedCode, pickSpeedItems, seeded, speedCode } from "../../src/lib/select.js";
import { isBetterSpeed } from "../../src/lib/progress.js";

test("mistakeKind names the slip", () => {
  assert.match(mistakeKind("duluth,", "Duluth,"), /^Capital/);
  assert.match(mistakeKind("beagle", "beagle,"), /^Punctuation/);
  assert.match(mistakeKind("Their", "They're"), /^Sound-alike/);
  assert.match(mistakeKind("brothers", "brother's"), /^Apostrophes/);
  assert.match(mistakeKind("I", "me"), /^Pronouns/);
  assert.match(mistakeKind("take", "takes"), /^Verbs/);
  assert.match(mistakeKind("allready", "already"), /^Word form/);
});

test("Speed codes: the same code gives the same questions", () => {
  assert.deepEqual(parseSpeedCode("g7-4821"), { grade: 7, seed: 4821 });
  assert.deepEqual(parseSpeedCode(" G8 - 1000 "), { grade: 8, seed: 1000 });
  assert.equal(parseSpeedCode("hello"), null);
  assert.equal(speedCode(7, 4821), "G7-4821");
  const items = Array.from({ length: 40 }, (_, i) => ({ id: `x-${String(i).padStart(2, "0")}`, skill: "case", level: 2, type: i % 5 ? "which" : "flow" }));
  const a = pickSpeedItems({ items, levelKeys: ["case-2"], seed: 4821, count: 12 }).map((i) => i.id);
  const b = pickSpeedItems({ items: [...items].reverse(), levelKeys: ["case-2"], seed: 4821, count: 12 }).map((i) => i.id);
  assert.deepEqual(a, b, "order of the content list doesn't matter");
  assert.equal(a.length, 12);
  assert.ok(a.every((id) => Number(id.slice(2)) % 5), "no labeling items");
  assert.notDeepEqual(a, pickSpeedItems({ items, levelKeys: ["case-2"], seed: 4822, count: 12 }).map((i) => i.id));
  const r = seeded(1);
  assert.ok(r() >= 0 && r() < 1);
});

test("Speed personal best: more right wins, then less time", () => {
  assert.equal(isBetterSpeed(null, { right: 3, ms: 90000 }), true);
  assert.equal(isBetterSpeed({ right: 8, ms: 80000 }, { right: 9, ms: 90000 }), true);
  assert.equal(isBetterSpeed({ right: 8, ms: 80000 }, { right: 8, ms: 70000 }), true);
  assert.equal(isBetterSpeed({ right: 8, ms: 80000 }, { right: 8, ms: 85000 }), false);
  assert.equal(isBetterSpeed({ right: 8, ms: 80000 }, { right: 7, ms: 10000 }), false);
});

test("Mystery prize: once a day, a free everyday decoration that refunds nothing", async () => {
  const { mysteryPrize, newPlayer, removeDecor } = await import("../../src/lib/progress.js");
  const now = new Date(2026, 10, 17, 18).getTime();
  const p = newPlayer({ id: "p1", name: "Ava", avatar: "🦊", grade: 4, now: 0 });
  const out = mysteryPrize(p, now, () => 0);
  assert.ok(out && out.player.decor.length === 1 && out.player.decor[0].free);
  assert.equal(mysteryPrize(out.player, now), null, "only once a day");
  assert.ok(mysteryPrize(out.player, now + 864e5), "again tomorrow");
  assert.equal(removeDecor(out.player, out.player.decor[0].uid).bricks, out.player.bricks, "putting it away gives no bricks");
});
