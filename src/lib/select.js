// Chooses the 8 items for a level. Pure: the random source is passed in, so tests can fix it.
import { ITEMS_PER_LEVEL, REVIEW_PER_LEVEL } from "../config.js";

export function shuffle(list, random = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Most useful first: items never seen, then items missed more often, then the ones seen longest ago.
 * `stats` maps item id → { seen, misses, last }.
 */
export function rankItems(items, stats = {}, random = Math.random) {
  return shuffle(items, random)
    .map((item, order) => ({ item, order, s: stats[item.id] || { seen: 0, misses: 0, last: 0 } }))
    .sort((a, b) => (a.s.seen > 0) - (b.s.seen > 0) || b.s.misses - a.s.misses || a.s.last - b.s.last || a.order - b.order)
    .map((entry) => entry.item);
}

/**
 * The items for one play of a level: mostly this skill and level, plus review items from
 * levels the player has already passed (so old skills keep coming back).
 * passedKeys: ["commas-1", ...] the levels already passed, other than this one.
 */
export function pickLevelItems({ items, skill, level, stats = {}, passedKeys = [], random = Math.random, plan = null }) {
  const key = `${skill}-${level}`;
  if (plan) {
    // A fixed mix of item types in a fixed order (Flow Factory: 3 flows, then 2 Build from labels), no review.
    return plan.flatMap(({ type, count }) => rankItems(
      items.filter((item) => item.skill === skill && item.level === level && item.type === type), stats, random,
    ).slice(0, count));
  }
  const own = rankItems(items.filter((item) => item.skill === skill && item.level === level), stats, random);
  const reviewPool = rankItems(
    items.filter((item) => passedKeys.includes(`${item.skill}-${item.level}`) && `${item.skill}-${item.level}` !== key),
    stats,
    random,
  );
  const review = reviewPool.slice(0, REVIEW_PER_LEVEL);
  const main = own.slice(0, ITEMS_PER_LEVEL - review.length);
  // Too few review items yet: fill up with more of this level.
  const extra = own.slice(main.length, main.length + (ITEMS_PER_LEVEL - main.length - review.length));
  const chosen = [...main, ...extra];
  // Review items go in the 3rd and 6th places, so a level starts with the new skill.
  [2, 5].slice(0, review.length).forEach((at, i) => chosen.splice(Math.min(at, chosen.length), 0, { ...review[i], review: true }));
  return chosen.slice(0, ITEMS_PER_LEVEL);
}

/** Most useful first: questions missed before (most misses first), then ones never seen, then the longest ago. */
function practiceOrder(stats, random) {
  return (item) => {
    const s = stats[item.id];
    const tier = s?.misses ? 0 : !s ? 1 : 2;
    return [tier, tier === 0 ? -s.misses : 0, s?.last ?? 0, random()];
  };
}
const byKey = (key) => (a, b) => {
  const [x, y] = [key(a), key(b)];
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

/**
 * Summit Review: questions from levels the player has passed, mixed across skills (one skill at a time,
 * in turn) so each question asks "which rule is this?". Long Q&A Flow, labels and diagram items stay in
 * their own levels.
 */
export function pickSummitItems({ items, passedKeys, stats = {}, count = 8, random = Math.random }) {
  const order = practiceOrder(stats, random);
  const pool = items.filter((i) => passedKeys.includes(`${i.skill}-${i.level}`) && !["flow", "labels", "diagram"].includes(i.type));
  const groups = new Map();
  for (const item of pool) groups.set(item.skill, [...(groups.get(item.skill) || []), item]);
  const queues = [...groups.values()].map((g) => [...g].sort(byKey(order))).sort((a, b) => byKey(order)(a[0], b[0]));
  const out = [];
  while (out.length < count && queues.some((q) => q.length)) {
    for (const q of queues) if (q.length && out.length < count) out.push(q.shift());
  }
  return out;
}

/** Spelling Lake: questions for the player's grade band, the most useful first, in a mixed order. */
export function pickSpellingItems({ items, grade, stats = {}, count = 8, random = Math.random }) {
  const level = grade >= 6 ? 2 : 1;
  const picked = items.filter((i) => i.level === level).sort(byKey(practiceOrder(stats, random))).slice(0, count);
  return picked.map((item) => ({ item, r: random() })).sort((a, b) => a.r - b.r).map(({ item }) => item);
}

/** Item types quick enough for the Daily 5 (no paragraphs, typing or many-step labeling). */
const DAILY_TYPES = new Set(["which", "mark", "fix", "sort", "check", "join", "build"]);

/**
 * The Daily 5: quick questions from the levels at the player's grade and the grade before (open ones only),
 * least recently seen first, spread across skills. levelKeys: ["case-2", ...] the caller found open.
 */
export function pickDailyItems({ items, levelKeys, stats = {}, count = 5, random = Math.random }) {
  const quick = items.filter((i) => DAILY_TYPES.has(i.type));
  return pickSummitItems({ items: quick, passedKeys: levelKeys, stats, count, random })
    .map((item) => ({ item, r: random() })).sort((a, b) => a.r - b.r).map(({ item }) => item);
}

/** A small seeded random number generator, so a Speed Proofread code gives everyone the same questions. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Speed Proofread: `count` quick questions from the given levels, chosen only by the seed (not by anyone's
 * history), so a share code plays the same set on any device with the same content.
 */
export function pickSpeedItems({ items, levelKeys, seed, count = 12 }) {
  const keys = new Set(levelKeys);
  const pool = items.filter((i) => DAILY_TYPES.has(i.type) && keys.has(`${i.skill}-${i.level}`)).sort((a, b) => (a.id < b.id ? -1 : 1));
  const random = seeded(seed);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/** "G7-4821" → { grade: 7, seed: 4821 }; null if it isn't a code. */
export function parseSpeedCode(text) {
  const m = String(text || "").trim().match(/^G?\s*([3-8])\s*-\s*(\d{4})$/i);
  return m ? { grade: Number(m[1]), seed: Number(m[2]) } : null;
}
export const speedCode = (grade, seed) => `G${grade}-${seed}`;
