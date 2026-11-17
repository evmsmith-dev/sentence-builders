// The teacher report: one player's practice and progress, for a parent to print, save as a PDF or share.
// Pure: built from the player's saved data and the content, nothing leaves the device unless a person sends it.

import { SKILLS, WORLDS, skillOpenFor, worldOpenFor } from "../config.js";
import { answerText } from "./parse.js";
import { isPassed, levelStars, localDate, skillTier } from "./progress.js";

export const REPORT_RANGES = { week: { days: 7, label: "the last 7 days" }, month: { days: 30, label: "the last 30 days" }, all: { days: null, label: "all time" } };
const TIERS = ["Bronze", "Silver", "Gold"];
/** A skill needs practice below this first-try rate (with enough answers to tell). */
const NEEDS_PRACTICE_BELOW = 0.75;
const MIN_ANSWERS = 6;

const pct = (n) => `${Math.round(n * 100)}%`;

/**
 * { name, grade, made, rangeLabel, habits: { minutes, days, passed }, worlds: [{ name, skills: [...] }],
 *   shurley: [...], needs: [{ skill, rate, examples: [...] }] }
 * Minutes and days come from the range; levels passed in the range use each level's first-pass date (older
 * saves didn't keep one, so those only count in All time). Skill rows are the player's standing to date.
 */
export function teacherReport(player, content, { now = Date.now(), range = "week" } = {}) {
  const span = REPORT_RANGES[range] || REPORT_RANGES.week;
  const from = span.days ? localDate(now - (span.days - 1) * 864e5) : "";
  const inRange = (day) => !span.days || (day && day >= from);
  const itemsById = new Map(content.items.map((item) => [item.id, item]));
  const bySkill = {};
  for (const [id, s] of Object.entries(player.items || {})) {
    const item = itemsById.get(id);
    if (!item) continue;
    const row = (bySkill[item.skill] ||= { seen: 0, misses: 0, missed: [] });
    row.seen += s.seen;
    row.misses += s.misses;
    if (s.misses && inRange(localDate(s.last))) row.missed.push({ item, misses: s.misses, last: s.last });
  }
  const minutes = Math.round(Object.entries(player.time || {}).filter(([day]) => inRange(day)).reduce((sum, [, ms]) => sum + ms, 0) / 60000);
  const days = (player.days || []).filter(inRange).length;
  const passed = Object.entries(player.levels || {}).filter(([, l]) => l.stars > 0 && (span.days ? inRange(l.passedOn) : true)).length;

  const skillRow = (skill) => {
    const stats = bySkill[skill.id];
    const levels = [1, 2, 3].map((level) => ({ level, grade: skill.grades?.[level - 1], passed: isPassed(player, skill.id, level), stars: levelStars(player, skill.id, level) }));
    const tier = skillTier(player, skill.id);
    return {
      id: skill.id, name: skill.name, benchmarks: skill.benchmarks || "",
      levels, badge: tier ? TIERS[tier - 1] : "",
      answers: stats?.seen || 0,
      firstTry: stats?.seen ? (stats.seen - stats.misses) / stats.seen : null,
      firstTryText: stats?.seen ? pct((stats.seen - stats.misses) / stats.seen) : "—",
    };
  };
  const worlds = WORLDS.filter((world) => world.ready && worldOpenFor(world, player)).map((world) => ({
    id: world.id, name: world.name, emoji: world.emoji,
    skills: SKILLS.filter((skill) => skill.world === world.id && skillOpenFor(skill, player)).map(skillRow),
  }));
  // Shurley-style work (Flow Factory) gets its own summary: which label sets are done.
  const shurley = (worlds.find((w) => w.id === "flow")?.skills || []).map((row) => ({
    name: row.name, passed: row.levels.filter((l) => l.passed).length, badge: row.badge,
  }));
  const needs = worlds.flatMap((w) => w.skills)
    .filter((row) => row.answers >= MIN_ANSWERS && row.firstTry < NEEDS_PRACTICE_BELOW)
    .sort((a, b) => a.firstTry - b.firstTry)
    .slice(0, 5)
    .map((row) => ({
      name: row.name, firstTryText: row.firstTryText,
      examples: (bySkill[row.id]?.missed || []).sort((a, b) => b.misses - a.misses || b.last - a.last).slice(0, 2).map(({ item }) => answerText(item)),
    }));
  return {
    name: player.name, grade: player.grade, made: localDate(now), range, rangeLabel: span.label,
    habits: { minutes, days, passed }, worlds, shurley, needs,
  };
}

/** The report as plain text, for an email or message. */
export function reportText(report, note = "") {
  const lines = [
    `Sentence Builders progress report: ${report.name}, grade ${report.grade}`,
    `Made ${report.made}, covering ${report.rangeLabel}.`,
    "",
    `Practice: ${report.habits.minutes} minutes on ${report.habits.days} day${report.habits.days === 1 ? "" : "s"}; ${report.habits.passed} level${report.habits.passed === 1 ? "" : "s"} passed.`,
  ];
  if (note.trim()) lines.push("", `Note: ${note.trim()}`);
  for (const world of report.worlds) {
    const started = world.skills.filter((s) => s.answers || s.levels.some((l) => l.passed));
    if (!started.length) continue;
    lines.push("", `${world.name}:`);
    for (const s of started) {
      lines.push(`- ${s.name}: ${s.levels.filter((l) => l.passed).length} of 3 levels${s.badge ? ` (${s.badge})` : ""}, ${s.firstTryText} right on the first try`);
    }
  }
  if (report.needs.length) {
    lines.push("", "Needs practice:");
    for (const n of report.needs) lines.push(`- ${n.name} (${n.firstTryText} first try)${n.examples.length ? `. Missed: ${n.examples.join(" / ")}` : ""}`);
  }
  lines.push("", "Sentence Builders is a free grammar practice game with original content, built on the Minnesota ELA standards and Shurley-style Q&A Flow.");
  return lines.join("\n");
}
