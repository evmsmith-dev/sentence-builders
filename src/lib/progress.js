// A player's progress: what's unlocked, recording a finished level, stars, mastery and badges.
// Pure functions on plain data, so they're easy to test and save.
import {
  GOLD_DAYS, GOLD_POINTS, HABIT_BADGES, POINTS, SKILLS, STAR_THRESHOLDS, WORLD_BADGES, skillById, skillsInWorld,
} from "../config.js";

export const levelKey = (skill, level) => `${skill}-${level}`;

export function localDate(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function newPlayer({ id, name, avatar, grade, now }) {
  return {
    id, name: name.trim(), avatar, grade: Number(grade), created: now,
    settings: { autoRead: false, pip: true, sound: true, breakMinutes: 0 },
    levels: {}, // "commas-1": { best, stars, plays }
    goldDays: {}, // "commas": ["2026-11-15", ...] days with GOLD_POINTS+ on level 3
    items: {}, // item id: { seen, misses, last }
    secondTryWins: 0,
    days: [], // dates played
    time: {}, // date: milliseconds spent in levels that day
    badges: {}, // badge id: highest tier earned (kept even if data is later trimmed)
  };
}

/** Fills in fields added after a player was first saved, so older saves keep working. */
export function normalizePlayer(player) {
  const base = newPlayer({ id: player.id, name: player.name || "Player", avatar: player.avatar, grade: player.grade || 4, now: player.created || 0 });
  return { ...base, ...player, settings: { ...base.settings, ...(player.settings || {}) } };
}

// A level's time counts at most this much, so a game left open doesn't count as practice.
export const MAX_LEVEL_MS = 15 * 60 * 1000;

/** Minutes played in the 7 days ending on `now` (today included), and on how many of those days. */
export function weekSummary(player, now) {
  const days = Array.from({ length: 7 }, (_, i) => localDate(now - i * 864e5));
  const ms = days.reduce((sum, day) => sum + (player.time?.[day] || 0), 0);
  return { minutes: Math.round(ms / 60000), daysPlayed: days.filter((day) => player.days.includes(day)).length };
}

/** The items missed most, most first. */
export function mostMissed(player, limit = 5) {
  return Object.entries(player.items)
    .filter(([, s]) => s.misses > 0)
    .sort((a, b) => b[1].misses - a[1].misses || b[1].last - a[1].last)
    .slice(0, limit)
    .map(([id, s]) => ({ id, misses: s.misses, seen: s.seen }));
}

export function starsFor(points) {
  return STAR_THRESHOLDS.filter((threshold) => points >= threshold).length;
}

export function pointsFor(result) {
  if (!result.correct) return POINTS.missed;
  return result.tries === 1 ? POINTS.first : POINTS.second;
}

export const levelStars = (player, skill, level) => player.levels[levelKey(skill, level)]?.stars || 0;
export const isPassed = (player, skill, level) => levelStars(player, skill, level) > 0;

/** Level 1 is always open. A later level opens when the one before is passed, or right away if it's at or below the player's grade. */
export function isUnlocked(player, skillId, level) {
  if (level === 1) return true;
  if (isPassed(player, skillId, level - 1)) return true;
  const skill = skillById(skillId);
  return Boolean(skill && skill.grades[level - 1] <= player.grade);
}

export function passedKeys(player) {
  return Object.entries(player.levels).filter(([, record]) => record.stars > 0).map(([key]) => key);
}

/** 0 = none, 1 Bronze, 2 Silver, 3 Gold. */
export function skillTier(player, skillId) {
  if ((player.goldDays[skillId] || []).length >= GOLD_DAYS) return 3;
  if (isPassed(player, skillId, 2)) return 2;
  if (isPassed(player, skillId, 1)) return 1;
  return 0;
}

export function habitValue(player, measure) {
  if (measure === "levelsPassed") return passedKeys(player).length;
  if (measure === "daysPlayed") return player.days.length;
  if (measure === "secondTryWins") return player.secondTryWins;
  return 0;
}

/** Every badge with the tier earned now: 0 = not yet. Single-goal badges use tier 1. */
export function currentBadges(player) {
  const out = {};
  for (const skill of SKILLS) out[skill.badge.id] = skillTier(player, skill.id);
  for (const badge of WORLD_BADGES) {
    const skills = skillsInWorld(badge.world);
    out[badge.id] = skills.length && skills.every((skill) => skillTier(player, skill.id) >= 2) ? 1 : 0;
  }
  for (const badge of HABIT_BADGES) out[badge.id] = habitValue(player, badge.measure) >= badge.goal ? 1 : 0;
  return out;
}

/**
 * Records a finished level. results: [{ id, tries, correct }] in play order.
 * Returns the updated player plus what to celebrate. The input player isn't changed.
 */
export function recordLevel(player, { skill, level, results, now, durationMs = 0 }) {
  const next = normalizePlayer(JSON.parse(JSON.stringify(player)));
  const date = localDate(now);
  const points = results.reduce((sum, result) => sum + pointsFor(result), 0);
  const stars = starsFor(points);
  const key = levelKey(skill, level);
  const before = next.levels[key] || { best: 0, stars: 0, plays: 0 };
  next.levels[key] = { best: Math.max(before.best, points), stars: Math.max(before.stars, stars), plays: before.plays + 1 };

  for (const result of results) {
    const s = next.items[result.id] || { seen: 0, misses: 0, last: 0 };
    next.items[result.id] = { seen: s.seen + 1, misses: s.misses + (result.tries > 1 || !result.correct ? 1 : 0), last: now };
    if (result.correct && result.tries === 2) next.secondTryWins += 1;
  }
  if (!next.days.includes(date)) next.days.push(date);
  next.time[date] = (next.time[date] || 0) + Math.min(Math.max(durationMs, 0), MAX_LEVEL_MS);
  // Keep about two months of daily times.
  for (const day of Object.keys(next.time).sort().slice(0, -60)) delete next.time[day];
  if (level === 3 && points >= GOLD_POINTS) {
    const days = next.goldDays[skill] || [];
    if (!days.includes(date)) next.goldDays[skill] = [...days, date];
  }

  const earned = currentBadges(next);
  const newBadges = [];
  for (const [id, tier] of Object.entries(earned)) {
    if (tier > (next.badges[id] || 0)) {
      newBadges.push({ id, tier });
      next.badges[id] = tier;
    }
  }
  return {
    player: next, points, stars,
    passed: stars > 0,
    firstPass: stars > 0 && before.stars === 0,
    newBest: points > before.best,
    newBadges,
    goldProgress: level === 3 ? (next.goldDays[skill] || []).length : null,
  };
}
