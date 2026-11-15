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
export function pickLevelItems({ items, skill, level, stats = {}, passedKeys = [], random = Math.random }) {
  const key = `${skill}-${level}`;
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
