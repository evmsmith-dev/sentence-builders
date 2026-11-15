import { expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  CHECK_KINDS, paletteFor, parseBuild, parseCheck, parseFix, parseJoin, parseMark, parseMarkText, parseSort, parseWhich,
} from "../../src/lib/parse.js";

const content = JSON.parse(readFileSync(new URL("../../data/content.json", import.meta.url), "utf8"));
export const itemById = (id) => content.items.find((item) => item.id === id);

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

export function player({ id = "p1", name = "Ava", avatar = "🦊", grade = 4, levels = {}, settings = {} } = {}) {
  return {
    id, name, avatar, grade, created: 0,
    settings: { autoRead: false, pip: true, sound: false, ...settings },
    levels, goldDays: {}, items: {}, secondTryWins: 0, days: [], badges: {},
  };
}

export async function startLevel(page, skill, level, world = "port") {
  await page.locator(`[data-world="${world}"]`).click();
  await page.locator(`.level-btn[data-skill="${skill}"][data-level="${level}"]`).click();
  await expect(page.locator("#tip-overlay")).toBeVisible();
  await page.locator("#tip-start").click();
  await expect(page.locator("#play")).toBeVisible();
}

export const currentItem = async (page) => itemById(await page.locator("#item").getAttribute("data-item-id"));

const exact = (text) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

/** One wrong try at the item on screen. Returns false when no wrong choice is left. */
export async function miss(page) {
  const item = await currentItem(page);
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

/** Answers the item on screen rightly. */
export async function answer(page) {
  const item = await currentItem(page);
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
