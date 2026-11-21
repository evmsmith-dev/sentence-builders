import { expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { markupTasks as allMarkupTasks } from "../../src/lib/markup.js";

/** The Mark it up tasks the app is showing: no noun check unless Circle the nouns is on. */
async function shownTasks(page, labels, words) {
  const circle = await page.evaluate(() => document.querySelector("#item[data-circle], #item [data-circle]")?.dataset.circle === "1");
  return allMarkupTasks(labels, words).filter((t) => t.id !== "circle" || circle);
}
import { nounTableQuestions } from "../../src/lib/nountable.js";
import { buildDiagram, guideOrder } from "../../src/lib/diagram.js";
import { weekDayItems } from "../../src/lib/week.js";
import { checkWorkshop, parseWorkshop, workshopExample, workshopFlowItem } from "../../src/lib/workshop.js";
import {
  CHECK_KINDS, compoundPairs, paletteFor, parseBuild, parseCheck, parseFix, parseFlow, parseJoin, parseLabels, parseMark, parseMarkText,
  parseProofread, parseSort, parseWhich,
} from "../../src/lib/parse.js";

/** Which step of a Q&A Flow is on screen: a step index, "kind" or "pattern". */
async function flowStage(page) {
  const count = (await page.locator("#item .flow-count").textContent()) || "";
  const m = count.match(/Question (\d+)/);
  if (m) return Number(m[1]) - 1;
  const mk = count.match(/Mark it up · (\d+)/);
  if (mk) return `markup-${Number(mk[1]) - 1}`;
  const nt = count.match(/Noun table · (\d+)/);
  if (nt) return `table-${Number(nt[1]) - 1}`;
  if (await page.locator("#item [data-kind-pick]").count()) return "kind";
  if (await page.locator("#item [data-pattern]").count()) return "pattern";
  return null;
}

const content = JSON.parse(readFileSync(new URL("../../data/content.json", import.meta.url), "utf8"));
// Sentence of the Week items are made from content.weeks: "<week id>-d<day>[-n]".
const weekItem = (id) => {
  const m = id.match(/^(week-.+)-d(\d)(?:-\d)?$/);
  const week = m && (content.weeks || []).find((w) => w.id === m[1]);
  return week ? weekDayItems(week, Number(m[2]) - 1).find((item) => item.id === id) : undefined;
};
export const itemById = (id) => weekItem(id) ?? content.items.find((item) => item.id === id)
  ?? (content.homework || []).map((h) => ({ ...h, skill: "proofread", level: 1 })).find((item) => item.id === id)
  ?? (content.boss || []).map((b) => ({ ...b, skill: "proofread", level: 1 })).find((item) => item.id === id)
  ?? (content.spelling || []).find((item) => item.id === id);

/** Opens the app with players already saved (or none, for a first visit). */
export async function openApp(page, { players = [], current = null } = {}) {
  await page.addInitScript(({ players, current }) => {
    if (sessionStorage.getItem("seeded")) return; // only before the first load
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("sentenceBuilders_players", JSON.stringify(players));
    if (current) localStorage.setItem("sentenceBuilders_current", JSON.stringify(current));
  }, { players, current });
  await page.goto("index.html");
  await expect(page.locator("body.is-ready")).toBeAttached();
}

export function player({ id = "p1", name = "Ava", avatar = "🦊", grade = 4, levels = {}, settings = {}, items = {} } = {}) {
  return {
    id, name, avatar, grade, created: 0,
    settings: { autoRead: false, pip: true, sound: false, ...settings },
    levels, goldDays: {}, items, secondTryWins: 0, days: [], badges: {}, introSeen: true,
  };
}

/** Opens a world from the home screen ("All worlds" starts closed). */
export async function openWorld(page, world) {
  const fold = page.locator("#all-worlds");
  if (!(await fold.evaluate((d) => d.open))) await fold.locator("summary").click();
  await page.locator(`[data-world="${world}"]`).click();
}

/** Opens "More to do" on the home screen (Grammar Peaks, Speed Round, Build). */
export async function openMore(page) {
  const fold = page.locator("#more-todo");
  if (!(await fold.evaluate((d) => d.open))) await fold.locator("summary").click();
}

export async function startLevel(page, skill, level, world = "port") {
  await openWorld(page, world);
  const btn = page.locator(`.level-btn[data-skill="${skill}"][data-level="${level}"]`);
  // Grades 6–8: grade 3–5 skills wait under "Earlier grades".
  const earlier = page.locator(".earlier-grades");
  if (!(await btn.isVisible()) && (await earlier.count()) && !(await earlier.evaluate((d) => d.open))) await earlier.locator("summary").click();
  await btn.click();
  await expect(page.locator("#tip-overlay")).toBeVisible();
  await page.locator("#tip-start").click();
  await expect(page.locator("#play")).toBeVisible();
}

export const currentItem = async (page) => itemById(await page.locator("#item").getAttribute("data-item-id"));

const exact = (text) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

/** One wrong try at the item on screen. Returns false when no wrong choice is left. */
export async function miss(page) {
  const item = await currentItem(page);
  if (item.type === "workshop") {
    // The verb first: no subject.
    while (await page.locator("#item .ws-slots .tile").count()) await page.locator("#item .ws-slots .tile").first().click();
    const { tiles } = parseWorkshop(item);
    for (const t of [tiles.find((x) => ["V", "Vt", "LV"].includes(x.kind)), tiles.find((x) => x.kind === "N" || x.kind === "Np")]) {
      await page.locator(`#item .ws-bank [data-wt="${t.id}"]`).click();
    }
    await page.locator("#check-btn").click();
    return true;
  }
  if (item.type === "dictate") {
    await page.locator("#item textarea").fill(item.text.toLowerCase().replace(/[^a-z' ]/g, ""));
    await page.locator("#check-btn").click();
    return true;
  }
  if (item.type === "combine") {
    await page.locator("#item .combine-input").fill(item.parts.join(" "));
    await page.locator("#check-btn").click();
    return true;
  }
  if (item.type === "mark") {
    const parsed = parseMark(item);
    const palette = paletteFor(item);
    const i = parsed.answers[0].gaps.findIndex((gap) => !gap.marks && !gap.optional);
    const gap = page.locator(`#item [data-gap="${i}"]`);
    if (palette.length === 1) {
      if (!(await gap.evaluate((el) => el.classList.contains("filled")))) await gap.click();
    } else {
      await gap.click();
      await page.locator("#item [data-erase]").click();
      await page.locator(`#item [data-mark='${palette[0]}']`).click();
    }
    await page.locator("#check-btn").click();
  } else if (item.type === "fix") {
    const parsed = parseFix(item);
    await page.locator(`#item [data-word="${parsed.target === 0 ? 1 : 0}"]`).click();
  } else if (item.type === "which") {
    const parsed = parseWhich(item);
    for (const choice of parsed.choices.filter((c) => c !== parsed.correct)) {
      const button = page.locator("#item [data-choice]").filter({ hasText: exact(choice) }).first();
      if (await button.isEnabled()) {
        await button.click();
        return true;
      }
    }
    return false;
  } else if (item.type === "check") {
    const parsed = parseCheck(item);
    const fixStep = await page.locator("#item .fix-step").isVisible();
    const wrong = fixStep ? parsed.fixes.filter((f) => f !== parsed.fix) : parsed.kinds.filter((k) => k !== parsed.kind).map((k) => CHECK_KINDS[k]);
    const attr = fixStep ? "data-fix" : "data-kind";
    for (const text of wrong) {
      const button = page.locator(`#item [${attr}]`).filter({ hasText: exact(text) }).first();
      if (await button.isEnabled()) {
        await button.click();
        return true;
      }
    }
    return false;
  } else if (item.type === "join") {
    const parsed = parseJoin(item);
    if (await page.locator("#item .comma-sentence [data-gap]").count()) {
      // Put a comma in a space where none goes.
      const i = parsed.result.gaps.findIndex((gap, n) => n > 0 && n < parsed.result.words.length && !gap.marks);
      await page.locator(`#item .comma-sentence [data-gap="${i}"]`).click();
      await page.locator("#check-btn").click();
      return true;
    }
    for (const word of parsed.words.filter((w) => w !== parsed.word)) {
      const button = page.locator("#item [data-join-word]").filter({ hasText: exact(word) }).first();
      if (await button.isEnabled()) {
        await button.click();
        return true;
      }
    }
    return false;
  } else if (item.type === "flow") {
    const parsed = parseFlow(item);
    const at = await flowStage(page);
    if (at === "kind") {
      await page.locator(`#item [data-kind-pick]:not([data-kind-pick="${parsed.kind}"]):not([disabled])`).first().click();
    } else if (at === "pattern") {
      await page.locator(`#item [data-pattern]:not([data-pattern="${parsed.pattern}"]):not([disabled])`).first().click();
    } else {
      const step = parsed.steps[at];
      if (await page.locator(`#item [data-fw="${step.index}"]`).isEnabled()) {
        await page.locator(`#item [data-fw="${step.index === 0 ? 1 : 0}"]`).click();
      } else {
        await page.locator(`#item [data-label]:not([data-label="${step.label}"]):not([disabled])`).first().click();
      }
    }
    return true;
  } else if (item.type === "proofread" || item.type === "labelfix") {
    // Pick a wrong fix for the first mistake still open.
    const parsed = parseProofread(item);
    for (const e of parsed.errors) {
      const word = page.locator(`#item [data-pw="${e.index}"]`);
      if (!(await word.count())) continue;
      // Tapping the word that's already open closes its fixes: close it first, then open it fresh.
      if (await word.evaluate((el) => el.classList.contains("selected"))) await word.click();
      await word.click();
      const wrong = page.locator(`#item [data-pfix]:not([data-pfix="${e.correct}"]):not([disabled])`).first();
      if (!(await wrong.count())) return false;
      await wrong.click();
      return true;
    }
    return false;
  } else if (item.type === "labels") {
    const parsed = parseLabels(item);
    while (await page.locator("#item .label-slots .tile").count()) await page.locator("#item .label-slots .tile").first().click();
    for (const tile of [...parsed.tiles].reverse()) {
      await page.locator("#item .build-bank .tile").filter({ hasText: exact(tile.word) }).first().click();
    }
    await page.locator("#check-btn").click();
    return true;
  } else if (item.type === "sort") {
    // Everything in the first box (some words always belong elsewhere).
    while (await page.locator("#item .sort-bank .tile").count()) {
      await page.locator("#item .sort-bank .tile").first().click();
      await page.locator('#item .sort-bin[data-bin="0"] .bin-head').click();
    }
    await page.locator("#check-btn").click();
  } else if (item.type === "build") {
    const parsed = parseBuild(item);
    if (await page.locator("#item .build-bank .tile").count()) {
      for (const text of [...parsed.tiles].reverse()) {
        await page.locator("#item .build-bank .tile").filter({ hasText: exact(text) }).first().click();
      }
    }
    await page.locator("#check-btn").click();
  }
  return true;
}

/**
 * Answers the item on screen rightly. swapCompounds: answer each compound the other way round (tap Leo for
 * "Who sang?" in "Mia and Leo sang", build "bread and milk"), as a child might.
 */
export async function answer(page, { swapCompounds = false } = {}) {
  const item = await currentItem(page);
  if (item.type === "dictate") {
    await page.locator("#item textarea").fill(item.text);
    await page.locator("#check-btn").click();
    return;
  }
  if (item.type === "combine") {
    await page.locator("#item .combine-input").fill(item.answers.at(swapCompounds ? -1 : 0));
    await page.locator("#check-btn").click();
    return;
  }
  if (item.type === "mark") {
    const parsed = parseMark(item);
    const gaps = parsed.answers[0].gaps;
    const target = gaps.map((gap, i) => ({ i, marks: gap.marks })).filter((g) => g.marks);
    const single = paletteFor(item).length === 1;
    // Clear anything placed on an earlier try.
    for (const filled of await page.locator("#item .gap.filled").all()) {
      await filled.click();
      if (!single) await page.locator("#item [data-erase]").click();
    }
    for (const { i, marks } of target) {
      if (single) {
        await page.locator(`#item [data-gap="${i}"]`).click();
        continue;
      }
      await page.locator(`#item [data-gap="${i}"]`).click();
      await page.locator("#item [data-erase]").click();
      for (const mark of marks) await page.locator(`#item [data-mark='${mark}']`).click();
    }
    await page.locator("#check-btn").click();
  } else if (item.type === "fix") {
    const parsed = parseFix(item);
    await page.locator(`#item [data-word="${parsed.target}"]`).click();
    await page.locator(`#item [data-choice="${parsed.correct}"]`).click();
  } else if (item.type === "which") {
    const parsed = parseWhich(item);
    await page.locator("#item [data-choice]").filter({ hasText: exact(parsed.correct) }).first().click();
  } else if (item.type === "workshop") {
    // Build the item's own example, check it, then label it with its Q&A Flow.
    const placed = workshopExample(item);
    while (await page.locator("#item .ws-slots .tile").count()) await page.locator("#item .ws-slots .tile").first().click();
    for (const t of placed) await page.locator(`#item .ws-bank [data-wt="${t.id}"]`).click();
    await page.locator("#check-btn").click();
    await answerFlow(page, workshopFlowItem(item, placed, checkWorkshop(item, placed).roles));
  } else if (item.type === "flow") {
    await answerFlow(page, item, { swapCompounds });
  } else if (item.type === "diagram") {
    await diagramIt(page, item);
  } else if (item.type === "proofread" || item.type === "labelfix") {
    const parsed = parseProofread(item);
    for (const e of parsed.errors) {
      const word = page.locator(`#item [data-pw="${e.index}"]`);
      if (!(await word.count())) continue; // already fixed or shown
      if (!(await word.evaluate((el) => el.classList.contains("selected")))) await word.click();
      await page.locator(`#item [data-pfix="${e.correct}"]`).click();
    }
  } else if (item.type === "labels") {
    const parsed = parseLabels(item);
    while (await page.locator("#item .label-slots .tile").count()) await page.locator("#item .label-slots .tile").first().click();
    const tiles = [...parsed.tiles];
    if (swapCompounds) {
      for (const [a, b] of compoundPairs(parsed.line, tiles.map((t) => t.word))) {
        if (a === 0 && !/^[A-Z]/.test(tiles[b].word)) continue; // "the" can't start the sentence
        [tiles[a], tiles[b]] = [tiles[b], tiles[a]];
      }
    }
    for (const tile of tiles) {
      await page.locator("#item .build-bank .tile").filter({ hasText: exact(tile.word) }).first().click();
    }
    await page.locator("#check-btn").click();
  } else if (item.type === "check") {
    const parsed = parseCheck(item);
    if (!(await page.locator("#item .fix-step").isVisible())) {
      await page.locator(`#item [data-kind="${parsed.kind}"]`).click();
    }
    if (parsed.kind !== "complete") await page.locator("#item [data-fix]").filter({ hasText: exact(parsed.fix) }).first().click();
  } else if (item.type === "join") {
    const parsed = parseJoin(item);
    if (!(await page.locator("#item .comma-sentence [data-gap]").count())) {
      await page.locator("#item [data-join-word]").filter({ hasText: exact(parsed.word) }).first().click();
    }
    const result = parseMarkText(item.result);
    // Clear any comma from an earlier try, then place the right ones.
    for (const filled of await page.locator("#item .comma-sentence .gap.filled").all()) await filled.click();
    for (const [i, gap] of result.gaps.entries()) {
      if (gap.marks) await page.locator(`#item .comma-sentence [data-gap="${i}"]`).click();
    }
    await page.locator("#check-btn").click();
  } else if (item.type === "sort") {
    const parsed = parseSort(item);
    for (const tile of parsed.tiles) {
      await page.locator("#item [data-sort-tile]").filter({ hasText: exact(tile.text) }).first().click();
      const bin = parsed.bins.findIndex((b) => b.name === tile.bin);
      await page.locator(`#item .sort-bin[data-bin="${bin}"] .bin-head`).click();
    }
    await page.locator("#check-btn").click();
  } else if (item.type === "build") {
    const parsed = parseBuild(item);
    // Send back anything placed on an earlier try, then build it in order.
    while (await page.locator("#item .build-slots .tile").count()) await page.locator("#item .build-slots .tile").first().click();
    for (const text of parsed.tiles) {
      await page.locator("#item .build-bank .tile").filter({ hasText: exact(text) }).first().click();
    }
    await page.locator("#check-btn").click();
  }
}

/** Answers a Q&A Flow on screen, step by step (also the flow for a Sentence Workshop sentence). */
async function answerFlow(page, item, { swapCompounds = false } = {}) {
  const parsed = parseFlow(item);
  const steps = parsed.steps.map((s) => ({ ...s }));
  const pairs = compoundPairs(parsed.words.map((w) => w.label));
  for (let guard = 0; guard < 40 && !(await page.locator("#next-btn").isVisible()); guard++) {
    const at = await flowStage(page);
    if (at === "kind") {
      await page.locator(`#item [data-kind-pick="${parsed.kind}"]`).click();
    } else if (at === "pattern") {
      await page.locator(`#item [data-pattern="${parsed.pattern}"]`).click();
    } else if (typeof at === "string" && at.startsWith("table-")) {
      const q = nounTableQuestions(parsed.words.map((w) => w.label), parsed.words.map((w) => w.word), parsed.labels)[Number(at.slice(6))];
      await page.locator(`#item [data-nt="${q.answer}"]`).click();
    } else if (typeof at === "string" && at.startsWith("markup-")) {
      await markUp(page, (await shownTasks(page, parsed.words.map((w) => w.label), parsed.words.map((w) => w.word)))[Number(at.slice(7))]);
    } else {
      const step = steps[at];
      const pair = swapCompounds && step.question && pairs.find((p) => p.includes(step.index));
      const other = pair && pair.find((i) => i !== step.index);
      const later = pair ? steps.findIndex((s, k) => k > at && s.index === other) : -1;
      if (later >= 0) [step.index, step.label, steps[later].index, steps[later].label] = [other, steps[later].label, step.index, step.label];
      const word = page.locator(`#item [data-fw="${step.index}"]`);
      if (await word.isEnabled()) await word.click();
      await page.locator(`#item [data-label="${step.label}"]`).click();
    }
  }
}

/** Does one Mark it up task: taps exactly the right words (clearing any picked before). */
export async function markUp(page, task) {
  for (const btn of await page.locator("#item .flow-word.picked").all()) await btn.click();
  for (const i of task.answer) await page.locator(`#item [data-fw="${i}"]`).click();
  await page.locator("#item [data-markup-done]").click();
}

/** Mark up a diagram item's sentence, then put every word on its line and check. */
export async function diagramIt(page, item, { markupOnly = false } = {}) {
  const labels = item.tags.trim().split(/ +/).map((t) => t.split("|")[1]);
  // Skip the mark-up if it's already done (the diagram is showing).
  if (!(await page.locator("#item .dg-stage").isVisible())) {
    const words = item.tags.trim().split(/ +/).map((t) => t.split("|")[0]);
    for (const task of await shownTasks(page, labels, words)) await markUp(page, task);
  }
  if (markupOnly) return;
  const diagram = buildDiagram(item);
  const guided = await page.locator("#item .dg-guide").isVisible();
  const done = guided ? Number(((await page.locator("#item .dg-guide .flow-count").textContent()) || "").match(/Step (\d+)/)[1]) - 1 : 0;
  for (const slot of guided ? guideOrder(diagram).slice(done) : diagram.slots) {
    await page.locator("#item .dg-bank [data-chip]").filter({ hasText: exact(slot.text) }).first().click();
    await page.locator(`#item [data-slot="${slot.id}"]`).click();
  }
  if (!guided) await page.locator("#item [data-dg-check]").click();
}

/** Opens the Notice Board: the Start here row once there's a day behind the player, else from "More to do". */
export async function openBoard(page) {
  if (await page.locator("#week-btn").isVisible()) return page.locator("#week-btn").click();
  await openMore(page);
  await page.locator("#extra-list [data-week]").click();
}

/** Opens Settings → "For grown-ups" (folded closed). */
export async function openGrownUps(page) {
  const fold = page.locator("#settings-overlay .settings-grown");
  if (!(await fold.evaluate((d) => d.open))) await fold.locator("summary").click();
}
