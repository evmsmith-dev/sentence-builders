// A player's progress: what's unlocked, recording a finished level, stars, mastery and badges.
// Pure functions on plain data, so they're easy to test and save.
import {
  BRICKS, DECOR, GOLD_DAYS, GOLD_POINTS, PRACTICE_GOAL, clampSpot, defaultSpot, HABIT_BADGES, POINTS, SKILLS, STAR_THRESHOLDS, WORLD_BADGES, skillById, skillOpenFor, skillsInWorld,
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
    levels: {}, // "commas-1": { best, stars, plays, passedOn }
    goldDays: {}, // "commas": ["2026-11-15", ...] days with GOLD_POINTS+ on level 3
    items: {}, // item id: { seen, misses, last }
    secondTryWins: 0,
    days: [], // dates played
    time: {}, // date: milliseconds spent in levels that day
    badges: {}, // badge id: highest tier earned (kept even if data is later trimmed)
    bricks: 0, // spent on town decorations
    introSeen: false, // Pip's welcome has been shown (or skipped)
    summits: 0, // Summit Reviews with PRACTICE_GOAL+ right on the first try: flags on Grammar Peaks
    lakeWins: 0, // Spelling Lake rounds with PRACTICE_GOAL+ right: boats on the lake
    decor: [], // decorations placed in the town: { uid, id, area, x, y } in SCENE units (area: a district id)
    week: null, // Sentence of the Week this week: { key (its Monday), id, done: [day indexes 0-4] }
    banners: [], // finished weeks, hung in the Town Square: { key, text }
    homeworkOn: null, // the last day Pip's homework was checked (the Notice Board's flyer waits until then)
  };
}

/** Fills in fields added after a player was first saved, so older saves keep working. */
export function normalizePlayer(player) {
  const base = newPlayer({ id: player.id, name: player.name || "Player", avatar: player.avatar, grade: player.grade || 4, now: player.created || 0 });
  const out = { ...base, ...player, settings: { ...base.settings, ...(player.settings || {}) } };
  // Saves from before placing and moving: decor was a list of ids, each at its fixed spot.
  if (out.decor.some((d) => typeof d === "string")) {
    out.decor = out.decor.map((d, k) => {
      if (typeof d !== "string") return d;
      const item = DECOR.find((x) => x.id === d);
      return item ? { uid: `d${k + 1}`, id: d, ...defaultSpot(item) } : null;
    }).filter(Boolean);
  }
  // Saves from before the town map: everything was in what is now the Town Square.
  if (out.decor.some((d) => !d.area)) out.decor = out.decor.map((d) => (d.area ? d : { ...d, area: "square" }));
  return out;
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

/** Stars for points out of `total` items (thresholds are set for 8 items and scale to other lengths). */
export function starsFor(points, total = 8) {
  return STAR_THRESHOLDS.filter((threshold) => points >= (threshold / 8) * total).length;
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
  if (measure === "summits") return player.summits || 0;
  if (measure === "lakeWins") return player.lakeWins || 0;
  return 0;
}

/** Every badge with the tier earned now: 0 = not yet. Single-goal badges use tier 1. */
export function currentBadges(player) {
  const out = {};
  for (const skill of SKILLS) out[skill.badge.id] = skillTier(player, skill.id);
  for (const badge of WORLD_BADGES) {
    // Only the skills open at this player's grade (no diagramming needed for a 4th grader's Factory Foreman).
    const skills = skillsInWorld(badge.world).filter((skill) => skillOpenFor(skill, player));
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
  const total = results.length;
  const stars = starsFor(points, total);
  const key = levelKey(skill, level);
  const before = next.levels[key] || { best: 0, stars: 0, plays: 0 };
  next.levels[key] = { best: Math.max(before.best, points), stars: Math.max(before.stars, stars), plays: before.plays + 1 };
  // The day it was first passed, for the teacher report's date ranges.
  const passedOn = before.passedOn || (stars > 0 ? date : null);
  if (passedOn) next.levels[key].passedOn = passedOn;

  for (const result of results) {
    const s = next.items[result.id] || { seen: 0, misses: 0, last: 0 };
    next.items[result.id] = { seen: s.seen + 1, misses: s.misses + (result.tries > 1 || !result.correct ? 1 : 0), last: now };
    if (result.correct && result.tries === 2) next.secondTryWins += 1;
  }
  if (!next.days.includes(date)) next.days.push(date);
  next.time[date] = (next.time[date] || 0) + Math.min(Math.max(durationMs, 0), MAX_LEVEL_MS);
  // Keep about two months of daily times.
  for (const day of Object.keys(next.time).sort().slice(0, -60)) delete next.time[day];
  const needsRight = skillById(skill)?.goldNeedsAllRight;
  const goldOk = !needsRight || results.filter((r) => r.type === needsRight).every((r) => r.correct);
  if (level === 3 && points >= (GOLD_POINTS / 8) * total && goldOk) {
    const days = next.goldDays[skill] || [];
    if (!days.includes(date)) next.goldDays[skill] = [...days, date];
  }

  const firstPass = stars > 0 && before.stars === 0;
  const bricks = bricksFor(results, stars, firstPass);
  next.bricks += bricks;

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
    firstPass, bricks,
    newBest: points > before.best,
    newBadges,
    goldProgress: level === 3 ? (next.goldDays[skill] || []).length : null,
  };
}

/**
 * Bricks for a finished level: 2 for each sentence right on the first try, 1 on the second try, 3 per star, and 10
 * the first time a level is passed. Bricks only buy decorations, never answers.
 */
export function bricksFor(results, stars, firstPass) {
  const perSentence = results.reduce((sum, r) => sum + (!r.correct ? 0 : r.tries === 1 ? BRICKS.first : BRICKS.second), 0);
  return perSentence + stars * BRICKS.star + (firstPass ? BRICKS.firstPass : 0);
}

/**
 * Builds another decoration if the player has the bricks; returns { player, uid } or null. It appears at its
 * zone's spot, nudged over a little for each copy already there so copies don't stack exactly.
 */
export function buyDecor(player, id, area = "square") {
  const item = DECOR.find((d) => d.id === id);
  const next = normalizePlayer(player);
  if (!item || next.bricks < item.cost || (item.area && item.area !== area)) return null;
  const copies = next.decor.filter((d) => d.id === id && d.area === area).length;
  const spot = defaultSpot(item);
  const uid = `d${Math.max(0, ...next.decor.map((d) => Number(String(d.uid).slice(1)) || 0)) + 1}`;
  const placed = { uid, id, area, ...clampSpot(spot.x + ((copies * 26) % 120) * (spot.x > 180 ? -1 : 1), spot.y) };
  return { player: { ...next, bricks: next.bricks - item.cost, decor: [...next.decor, placed] }, uid };
}

/** Moves a placed decoration (kept inside the scene). */
export function moveDecor(player, uid, x, y) {
  const next = normalizePlayer(player);
  return { ...next, decor: next.decor.map((d) => (d.uid === uid ? { ...d, ...clampSpot(x, y) } : d)) };
}

/** Puts a decoration away and gives all its bricks back, so rearranging the town never costs anything. */
export function removeDecor(player, uid) {
  const next = normalizePlayer(player);
  const placed = next.decor.find((d) => d.uid === uid);
  if (!placed) return next;
  const cost = DECOR.find((d) => d.id === placed.id)?.cost || 0;
  return { ...next, bricks: next.bricks + cost, decor: next.decor.filter((d) => d.uid !== uid) };
}

/** Pip's grade for a homework round: A+ when every paragraph was right on the first try. */
export function homeworkGrade(results) {
  const share = results.reduce((sum, r) => sum + pointsFor(r), 0) / Math.max(results.length, 1);
  return share === 1 ? "A+" : share >= 0.8 ? "A" : share >= 0.6 ? "B" : share >= 0.4 ? "C" : "Try again";
}

/**
 * Records a round of Pip's homework: item stats (so unseen paragraphs come first next time), the day and time
 * played, and bricks (BRICKS.homeworkFix × 2 for a paragraph right on the first try, × 1 on the second). It doesn't
 * touch levels or badges.
 */
/**
 * A Summit Review or Spelling Lake round: keeps each question's history (so the next round can bring back
 * the missed ones), the day and time, and bricks. PRACTICE_GOAL or more right on the first try plants a flag
 * on the summit (summit) or floats a boat on the lake (lake). Doesn't touch levels or badges.
 */
export function recordPractice(player, { kind, results, now, durationMs = 0 }) {
  const next = normalizePlayer(JSON.parse(JSON.stringify(player)));
  const date = localDate(now);
  for (const result of results) {
    const s = next.items[result.id] || { seen: 0, misses: 0, last: 0 };
    next.items[result.id] = { seen: s.seen + 1, misses: s.misses + (result.tries > 1 || !result.correct ? 1 : 0), last: now };
  }
  if (!next.days.includes(date)) next.days.push(date);
  next.time[date] = (next.time[date] || 0) + Math.min(Math.max(durationMs, 0), MAX_LEVEL_MS);
  const bricks = results.reduce((sum, r) => sum + (!r.correct ? 0 : r.tries === 1 ? BRICKS.first : BRICKS.second), 0);
  next.bricks += bricks;
  const right = results.filter((r) => r.correct && r.tries === 1).length;
  const reached = right >= PRACTICE_GOAL;
  if (reached) {
    if (kind === "summit") next.summits += 1;
    else next.lakeWins += 1;
  }
  // Keep badges earned here (Summit Climber, Spelling Sailor), as a level does.
  for (const [id, tier] of Object.entries(currentBadges(next))) if (tier > (next.badges[id] || 0)) next.badges[id] = tier;
  return { player: next, bricks, right, reached };
}

export function recordHomework(player, { results, now, durationMs = 0 }) {
  const next = normalizePlayer(JSON.parse(JSON.stringify(player)));
  const date = localDate(now);
  for (const result of results) {
    const s = next.items[result.id] || { seen: 0, misses: 0, last: 0 };
    next.items[result.id] = { seen: s.seen + 1, misses: s.misses + (result.tries > 1 || !result.correct ? 1 : 0), last: now };
  }
  if (!next.days.includes(date)) next.days.push(date);
  next.time[date] = (next.time[date] || 0) + Math.min(Math.max(durationMs, 0), MAX_LEVEL_MS);
  const bricks = results.reduce((sum, r) => sum + (!r.correct ? 0 : r.tries === 1 ? 2 : 1) * BRICKS.homeworkFix, 0);
  next.bricks += bricks;
  next.homeworkOn = date; // the Notice Board's "Tutor needed" flyer is answered for today
  return { player: next, bricks, grade: homeworkGrade(results), right: results.filter((r) => r.correct && r.tries === 1).length };
}

/**
 * Records one day of the Sentence of the Week. Bricks for each answer, plus a bonus and a Town Square banner
 * when all five days are done. `progress` is the week's { key, id, done } before this day.
 */
export function recordWeekDay(player, { progress, day, sentence, results, now, durationMs = 0, bonus = 0 }) {
  const next = normalizePlayer(JSON.parse(JSON.stringify(player)));
  const date = localDate(now);
  for (const result of results) {
    const s = next.items[result.id] || { seen: 0, misses: 0, last: 0 };
    next.items[result.id] = { seen: s.seen + 1, misses: s.misses + (result.tries > 1 || !result.correct ? 1 : 0), last: now };
  }
  if (!next.days.includes(date)) next.days.push(date);
  next.time[date] = (next.time[date] || 0) + Math.min(Math.max(durationMs, 0), MAX_LEVEL_MS);
  let bricks = results.reduce((sum, r) => sum + (!r.correct ? 0 : r.tries === 1 ? BRICKS.first : BRICKS.second), 0);
  const done = [...new Set([...progress.done, day])].sort();
  const weekDone = done.length === 5 && progress.done.length < 5;
  if (weekDone) {
    bricks += bonus;
    next.banners = [...(next.banners || []).filter((b) => b.key !== progress.key), { key: progress.key, text: sentence }];
  }
  next.bricks += bricks;
  next.week = { key: progress.key, id: progress.id, done };
  return { player: next, bricks, right: results.filter((r) => r.correct && r.tries === 1).length, weekDone };
}
