import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { answer, currentItem, diagramIt, markUp, miss, openApp, player, startLevel } from "./helpers.js";
import { parseFlow } from "../../src/lib/parse.js";
import { markupTasks } from "../../src/lib/markup.js";
import { buildDiagram } from "../../src/lib/diagram.js";
import { weekFor, weekKey } from "../../src/lib/week.js";

const content = JSON.parse(readFileSync(new URL("../../data/content.json", import.meta.url), "utf8"));

test("first visit: make a player and land in the town", { tag: "@layout" }, async ({ page }) => {
  await openApp(page);
  await expect(page.locator("#add-player")).toBeVisible();
  await page.locator("#player-name").fill("Ava");
  await page.locator('[data-avatar="🐼"]').click();
  await page.locator("#player-grade").selectOption("4");
  await page.locator('#player-form button[type="submit"]').click();
  await expect(page.locator("#home")).toBeVisible();
  // Pip introduces himself once: four short bubbles, then never again.
  await expect(page.locator("#pip-intro-overlay")).toBeVisible();
  await expect(page.locator("#pip-intro-text")).toContainText("Hi, Ava! I'm Pip");
  for (let n = 0; n < 3; n++) await page.locator("#pip-intro-next").click();
  await expect(page.locator("#pip-intro-next")).toHaveText("Let's build!");
  await page.locator("#pip-intro-next").click();
  await expect(page.locator("#pip-intro-overlay")).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("sentenceBuilders_players"))[0].introSeen)).toBe(true);
  await expect(page.locator("#who-btn")).toContainText("Ava");
  await expect(page.locator("#pip-home")).toContainText("Next up: Commas and colons, level 1");
  await expect(page.locator(".town")).toBeVisible();
  await expect(page.locator('[data-world="works"]')).toBeEnabled();
  await expect(page.locator('[data-world="studio"]')).toBeEnabled();
  await expect(page.locator('[data-world="flow"]')).toBeEnabled();
});

test("a 4th grader starts with grade 4 levels open; a 7th grader can review everything", async ({ page }) => {
  await openApp(page, { players: [player(), player({ id: "p2", name: "Max", avatar: "🐯", grade: 7 })], current: "p1" });
  await page.locator('[data-world="port"]').click();
  await expect(page.locator('.level-btn[data-skill="commas"][data-level="2"]')).toBeEnabled();
  await expect(page.locator('.level-btn[data-skill="commas"][data-level="3"]')).toBeDisabled();
  await page.locator("#world .back").click();
  await page.locator("#who-btn").click();
  await page.locator('[data-player="p2"]').click();
  await page.locator('[data-world="port"]').click();
  await expect(page.locator('.level-btn[data-skill="apostrophes"][data-level="3"]')).toBeEnabled();
});

test("play a whole level right: 3 stars, a building and badges", async ({ page }) => {
  await openApp(page, { players: [player()], current: "p1" });
  await startLevel(page, "commas", 1);
  for (let n = 0; n < 8; n++) {
    await expect(page.locator("#progress-text")).toHaveText(`${n + 1} of 8`);
    await answer(page);
    await expect(page.locator("#feedback.good")).toBeVisible();
    await page.locator("#next-btn").click();
  }
  await expect(page.locator("#result-overlay")).toBeVisible();
  await expect(page.locator("#result-title")).toHaveText("Perfect build!");
  await expect(page.locator("#result-score")).toContainText("8 of 8 points");
  await expect(page.locator("#result-badges")).toContainText("First Brick");
  await expect(page.locator("#result-badges")).toContainText("Comma Captain");
  await page.locator("#result-town").click();
  await expect(page.locator(".town")).toHaveAttribute("aria-label", /1 of 57 buildings/);
  await expect(page.locator("#pip-home")).toContainText("Next up: Commas and colons, level 2");

  // Saved on the device: still there after a reload.
  await page.reload();
  await expect(page.locator(".town")).toHaveAttribute("aria-label", /1 of 57 buildings/);
});

test("a miss gives a hint and a second try; a second miss shows the answer", async ({ page }) => {
  await openApp(page, { players: [player()], current: "p1" });
  await startLevel(page, "commas", 2);
  const first = await currentItem(page);
  await miss(page);
  await expect(page.locator("#feedback.hint")).toContainText(first.hint);
  await answer(page);
  await expect(page.locator("#feedback.good")).toContainText("✓");
  await page.locator("#next-btn").click();

  // Find an item that allows two misses (a two-choice item can't be missed twice).
  for (let n = 1; n < 8; n++) {
    await miss(page);
    await expect(page.locator("#feedback.hint")).toBeVisible();
    if (await miss(page)) {
      await expect(page.locator("#feedback.shown")).toBeVisible();
      await expect(page.locator("#feedback .answer-line")).not.toBeEmpty();
      return;
    }
    await answer(page);
    await page.locator("#next-btn").click();
  }
  throw new Error("no item could be missed twice");
});

test("a level under 6 points isn't passed and says to try again", async ({ page }) => {
  await openApp(page, { players: [player()], current: "p1" });
  await startLevel(page, "dialogue", 1);
  for (let n = 0; n < 8; n++) {
    await miss(page);
    if (!(await miss(page))) await answer(page);
    await page.locator("#next-btn").click();
  }
  await expect(page.locator("#result-title")).toHaveText("Almost there");
  await expect(page.locator("#result-next")).toHaveText("Try again");
});

test("no sideways scrolling on any screen", { tag: "@layout" }, async ({ page }) => {
  await openApp(page, { players: [player({ grade: 5 })], current: "p1" });
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(await fits()).toBe(true);
  await startLevel(page, "dialogue", 3);
  for (let n = 0; n < 8; n++) {
    expect(await fits()).toBe(true);
    await answer(page);
    await page.locator("#next-btn").click();
  }
});

test("works offline after the first visit", async ({ page, context }) => {
  await openApp(page, { players: [player()], current: "p1" });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.locator("body.is-ready")).toBeAttached();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("body.is-ready")).toBeAttached();
  await startLevel(page, "commas", 1);
  await expect(page.locator("#item button").first()).toBeVisible();
  await answer(page);
  await expect(page.locator("#feedback.good")).toBeVisible();
});

test("Word Works: play a level with every item type it uses, including Sort it", async ({ page }) => {
  await openApp(page, { players: [player()], current: "p1" });
  for (const [skill, level] of [["verbs", 1], ["agreement", 1], ["pronouns", 1]]) {
    await startLevel(page, skill, level, "works");
    for (let n = 0; n < 8; n++) {
      await answer(page);
      await expect(page.locator("#feedback.good")).toBeVisible();
      await page.locator("#next-btn").click();
    }
    await expect(page.locator("#result-title")).toHaveText("Perfect build!");
    await page.locator("#result-town").click();
  }
  await expect(page.locator(".town")).toHaveAttribute("aria-label", /3 of 57 buildings/);
});

test("Sort it: a wrong sort gives a hint, then the answer", async ({ page }) => {
  // Mark the level's other items as already seen, so the unseen sort items come first.
  const { items } = JSON.parse(readFileSync("data/content.json", "utf8"));
  const seen = Object.fromEntries(items.filter((i) => i.skill === "verbs" && i.level === 1 && i.type !== "sort").map((i) => [i.id, { seen: 1, misses: 0, last: 1 }]));
  await openApp(page, { players: [player({ items: seen })], current: "p1" });
  await startLevel(page, "verbs", 1, "works");
  for (let n = 0; n < 8; n++) {
    const item = await currentItem(page);
    if (item.type === "sort") {
      await miss(page);
      await expect(page.locator("#feedback.hint")).toBeVisible();
      await miss(page);
      await expect(page.locator("#feedback.shown")).toContainText("Past:");
      return;
    }
    await answer(page);
    await page.locator("#next-btn").click();
  }
  throw new Error("no sort item in the level");
});

test("Progress: open to everyone from the home screen; break reminder and backup are in Settings", { tag: "@layout" }, async ({ page }) => {
  const ava = player({ levels: { "commas-1": { best: 7, stars: 2, plays: 1 } } });
  ava.items = { "commas-1-01": { seen: 2, misses: 2, last: 5 } };
  ava.days = ["2026-11-14"];
  await openApp(page, { players: [ava, player({ id: "p2", name: "Max", avatar: "🐯", grade: 7 })], current: "p2" });
  await page.locator("#settings-btn").click();
  await expect(page.locator("#settings-overlay [data-progress]")).toHaveCount(0);
  await page.locator("#settings-overlay [data-close]").click();
  await page.locator("#home [data-progress]").click();
  await expect(page.locator("#parent .screen-title")).toHaveText("📊 Progress");
  // Me: only the current player's full details.
  await expect(page.locator("[data-parent-player]")).toHaveCount(1);
  await expect(page.locator('[data-parent-player="p2"]')).toContainText("Max");
  // Everyone: a short summary for each player, the current one first and marked; no one else's details.
  await page.locator('[data-progress-tab="everyone"]').click();
  await expect(page.locator("[data-parent-player]")).toHaveCount(0);
  await expect(page.locator("[data-summary-player]").first()).toContainText("Max (you)");
  await expect(page.locator('[data-summary-player="p1"]')).toContainText("1 of 57 buildings");
  await expect(page.locator(".missed-list")).toHaveCount(0);
  await page.locator('[data-progress-tab="me"]').click();
  await expect(page.locator('[data-parent-player="p2"] .progress-table').first()).toBeVisible();

  await expect(page.locator("#parent [data-break], #parent #backup-save")).toHaveCount(0);

  // The break reminder and backup live in Settings (break reminder is per player).
  await page.locator("#parent-back").click();
  await page.locator("#settings-btn").click();
  await page.locator("#set-break").selectOption("20");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("sentenceBuilders_players")));
  expect(saved.find((p) => p.id === "p2").settings.breakMinutes).toBe(20);
  await expect(page.locator("#settings-overlay")).not.toContainText("Switch player");
  await expect(page.locator("#settings-overlay")).toContainText("Comments and greeting");

  const download = page.waitForEvent("download");
  await page.locator("#backup-save").click();
  const file = await (await download).path();
  const backup = JSON.parse((await import("node:fs")).readFileSync(file, "utf8"));
  expect(backup.app).toBe("sentence-builders");
  expect(backup.players).toHaveLength(2);

  // Restore just Max (who is playing) from an edited backup.
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#backup-file").setInputFiles({ name: "b.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ ...backup, players: [backup.players[1]] })) });
  await expect(page.locator("#backup-status")).toContainText("Restored Max");
  await expect(page.locator("#set-break")).toHaveValue("20");
  await page.locator("#backup-file").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from("{}") });
  await expect(page.locator("#backup-status")).toContainText("isn't a Sentence Builders backup");
});

test("Sentence Studio: every level of all three skills, with Sentence check and Join it", async ({ page }) => {
  test.slow(); // plays several whole levels: extra time for slower CI machines
  await openApp(page, { players: [player({ grade: 7 })], current: "p1" });
  for (const skill of ["fragments", "compound", "complex"]) {
    for (const level of [1, 2, 3]) {
      await startLevel(page, skill, level, "studio");
      for (let n = 0; n < 8; n++) {
        await answer(page);
        await expect(page.locator("#feedback.good")).toBeVisible();
        await page.locator("#next-btn").click();
      }
      await expect(page.locator("#result-title")).toHaveText("Perfect build!");
      await page.locator("#result-town").click();
    }
  }
  await expect(page.locator(".town")).toHaveAttribute("aria-label", /9 of 78 buildings/);
});

test("Sentence check and Join it: a miss gives a hint, two show the answer", async ({ page }) => {
  await openApp(page, { players: [player({ grade: 7 })], current: "p1" });
  const seen = new Set();
  for (const [skill, level] of [["fragments", 3], ["compound", 1], ["complex", 1]]) {
    await startLevel(page, skill, level, "studio");
    for (let n = 0; n < 8; n++) {
      const item = await currentItem(page);
      if (["check", "join"].includes(item.type) && !seen.has(item.type)) {
        await miss(page);
        await expect(page.locator("#feedback.hint")).toContainText(item.hint);
        if (await miss(page)) {
          await expect(page.locator("#feedback.shown")).toBeVisible();
          seen.add(item.type);
        } else {
          await answer(page);
        }
      } else {
        await answer(page);
      }
      await page.locator("#next-btn").click();
    }
    await page.locator("#result-town").click().catch(() => {});
    if (await page.locator("#result-overlay").isVisible()) await page.locator("#result-town").click();
  }
  expect([...seen].sort()).toEqual(["check", "join"]);
});

test("Flow Factory: all three levels, 3 Q&A Flows then 2 Build from labels", async ({ page }) => {
  test.slow(); // plays several whole levels: extra time for slower CI machines
  await openApp(page, { players: [player({ grade: 7 })], current: "p1" });
  for (const level of [1, 2, 3]) {
    await startLevel(page, "flow", level, "flow");
    const types = [];
    for (let n = 0; n < 5; n++) {
      await expect(page.locator("#progress-text")).toHaveText(`${n + 1} of 5`);
      types.push((await currentItem(page)).type);
      await answer(page);
      await expect(page.locator("#feedback.good")).toBeVisible();
      await page.locator("#next-btn").click();
    }
    expect(types).toEqual(["flow", "flow", "flow", "labels", "labels"]);
    await expect(page.locator("#result-title")).toHaveText("Perfect build!");
    await expect(page.locator("#result-score")).toContainText("5 of 5 points");
    await page.locator("#result-town").click();
  }
  await expect(page.locator(".town")).toHaveAttribute("aria-label", /3 of 78 buildings/);
});

test("Q&A Flow: a miss gives a step hint; a second miss shows that step and moves on", async ({ page }) => {
  await openApp(page, { players: [player({ grade: 7 })], current: "p1" });
  await startLevel(page, "flow", 2, "flow");
  await expect(page.locator("#item .flow-count")).toHaveText("Question 1 of " + (await currentItem(page)).steps.length);
  await miss(page); // wrong word
  await expect(page.locator("#feedback.hint")).toContainText("Read the question again");
  await miss(page); // wrong word again: the step is shown
  await expect(page.locator("#feedback.hint")).toContainText("Here's that one");
  await expect(page.locator("#item .flow-count")).toContainText("Question 2");
  await answer(page);
  await expect(page.locator("#feedback.shown")).toContainText("will come back later");

  await page.locator("#next-btn").click();
  await miss(page);
  await expect(page.locator("#feedback.hint")).toBeVisible();
  await answer(page);
  await expect(page.locator("#feedback.good")).toContainText("A hint helped");
});

test("Revision Ridge: closed below grade 6, open for a 7th grader with grades 6-7 unlocked", async ({ page }) => {
  await openApp(page, { players: [player({ grade: 4 }), player({ id: "p2", name: "Max", avatar: "🐯", grade: 7 })], current: "p1" });
  await expect(page.locator('[data-world="desk"]')).toBeDisabled();
  await expect(page.locator('[data-world="desk"]')).toContainText("Grade 6+");
  await expect(page.locator(".town")).toHaveAttribute("aria-label", /of 57 buildings/);
  await page.locator("#who-btn").click();
  await page.locator('[data-player="p2"]').click();
  await expect(page.locator(".town")).toHaveAttribute("aria-label", /of 78 buildings/);
  await page.locator('[data-world="desk"]').click();
  await expect(page.locator('.level-btn[data-skill="case"][data-level="2"]')).toBeEnabled();
  await expect(page.locator('.level-btn[data-skill="case"][data-level="3"]')).toBeDisabled();
  for (const skill of ["aside", "types", "modifiers"]) {
    await expect(page.locator(`.level-btn[data-skill="${skill}"][data-level="2"]`)).toBeEnabled();
    await expect(page.locator(`.level-btn[data-skill="${skill}"][data-level="3"]`)).toBeDisabled();
  }
  await expect(page.locator("#skill-list .coming-soon")).toHaveCount(0);
});

test("Revision Ridge: play every skill, including hyphens, dashes, parentheses and ellipses", async ({ page }) => {
  test.slow(); // plays several whole levels: extra time for slower CI machines
  test.setTimeout(120000);
  await openApp(page, { players: [player({ grade: 8 })], current: "p1" });
  const levels = [["case", 1, 8], ["case", 3, 8], ["proofread", 1, 5], ["proofread", 3, 5],
    ["aside", 1, 8], ["aside", 3, 8], ["types", 1, 8], ["types", 3, 8], ["modifiers", 2, 8], ["modifiers", 3, 8]];
  for (const [skill, level, count] of levels) {
    await startLevel(page, skill, level, "desk");
    for (let n = 0; n < count; n++) {
      await expect(page.locator("#progress-text")).toHaveText(`${n + 1} of ${count}`);
      await answer(page);
      await expect(page.locator("#feedback.good")).toBeVisible();
      await page.locator("#next-btn").click();
    }
    await expect(page.locator("#result-title")).toHaveText("Perfect build!");
    await page.locator("#result-town").click();
  }
});

test("Proofread: tapping a fine word hints, a wrong fix twice shows it", async ({ page }) => {
  await openApp(page, { players: [player({ grade: 8 })], current: "p1" });
  await startLevel(page, "proofread", 2, "desk");
  const item = await currentItem(page);
  const errorIndexes = new Set((await import("../../src/lib/parse.js")).parseProofread(item).errors.map((e) => e.index));
  const fine = [0, 1, 2, 3, 4, 5].find((i) => !errorIndexes.has(i));
  await page.locator(`#item [data-pw="${fine}"]`).click();
  await expect(page.locator("#feedback.hint")).toContainText("That word is fine");
  await miss(page);
  await expect(page.locator("#feedback.hint")).toContainText("Not that one");
  await miss(page);
  await expect(page.locator("#feedback.hint")).toContainText("Here's that one");
  await expect(page.locator("#item .proof-count")).toContainText("Mistakes fixed: 1 of 3");
  await answer(page);
  await expect(page.locator("#feedback.shown")).toContainText("come back later");
});

test("Advanced Q&A Flow: hidden below grade 6; questions, commands and patterns 6-7 for older players", async ({ page }) => {
  test.slow(); // plays several whole levels: extra time for slower CI machines
  await openApp(page, { players: [player({ grade: 4 }), player({ id: "p2", name: "Max", avatar: "🐯", grade: 8 })], current: "p1" });
  await page.locator('[data-world="flow"]').click();
  await expect(page.locator('.level-btn[data-skill="flow2"]')).toHaveCount(0);
  await page.locator("#world .back").click();
  await page.locator("#who-btn").click();
  await page.locator('[data-player="p2"]').click();
  for (const level of [1, 2, 3]) {
    await startLevel(page, "flow2", level, "flow");
    const kinds = [];
    for (let n = 0; n < 5; n++) {
      const item = await currentItem(page);
      if (item.type === "flow") kinds.push(item.kind);
      await answer(page);
      await expect(page.locator("#feedback.good")).toBeVisible();
      await page.locator("#next-btn").click();
    }
    await expect(page.locator("#result-title")).toHaveText("Perfect build!");
    await page.locator("#result-town").click();
  }
});

test("Advanced Q&A Flow: pattern choices go up to 7 and the understood (You) is labeled", async ({ page }) => {
  await openApp(page, { players: [player({ grade: 8 })], current: "p1" });
  await startLevel(page, "flow2", 2, "flow");
  const item = await currentItem(page);
  // Answer every step, then check the pattern choices offered.
  const { parseFlow } = await import("../../src/lib/parse.js");
  const parsed = parseFlow(item);
  for (const step of parsed.steps) {
    const word = page.locator(`#item [data-fw="${step.index}"]`);
    if (await word.isEnabled()) await word.click();
    await page.locator(`#item [data-label="${step.label}"]`).click();
  }
  await page.locator(`#item [data-kind-pick="${parsed.kind}"]`).click();
  await expect(page.locator("#item [data-pattern]")).toHaveCount(7);
  await expect(page.locator('#item [data-pattern="6"]')).toHaveText("SN V-t DO OCN P6");
});

test("after a round: mistakes listed correctly, Review the rule opens the Tip Card and comes back", async ({ page }) => {
  await openApp(page, { players: [player()], current: "p1" });
  await startLevel(page, "commas", 2);
  let missed = null;
  for (let n = 0; n < 8; n++) {
    if (!missed) {
      const item = await currentItem(page);
      await miss(page);
      if (await miss(page)) missed = item;
      else await answer(page);
    } else {
      await answer(page);
    }
    await page.locator("#next-btn").click();
  }
  await expect(page.locator("#result-review .review-title")).toContainText("Look again");
  const { answerText } = await import("../../src/lib/parse.js");
  await expect(page.locator("#result-review")).toContainText(answerText(missed));
  await expect(page.locator("#result-review")).toContainText(missed.hint);

  await page.locator("#result-rule").click();
  await expect(page.locator("#tip-overlay")).toBeVisible();
  await expect(page.locator("#tip-title")).toHaveText("Commas with clauses");
  await expect(page.locator("#tip-close")).toBeHidden();
  await page.locator("#tip-start").click();
  await expect(page.locator("#result-overlay")).toBeVisible();
  await expect(page.locator("#play")).toBeVisible(); // still on the results, nothing new started

  await page.locator("#result-rule").click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#result-overlay")).toBeVisible();
});

test("a perfect round says there were no mistakes", async ({ page }) => {
  await openApp(page, { players: [player()], current: "p1" });
  await startLevel(page, "verbs", 1, "works");
  for (let n = 0; n < 8; n++) {
    await answer(page);
    await page.locator("#next-btn").click();
  }
  await expect(page.locator("#result-review")).toContainText("No mistakes this round");
});

test("Rule Book: tabs for each world, folding skills, locked rules by title, label glossary", { tag: "@layout" }, async ({ page }) => {
  await openApp(page, { players: [player({ grade: 4 })], current: "p1" });
  await page.locator("#rules-btn").click();
  await expect(page.locator("#rules")).toBeVisible();
  await expect(page.locator('[data-rules-tab="port"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-rules-tab="desk"]')).toHaveCount(0); // no Revision Ridge for a 4th grader
  // Skills start folded; tapping one shows its rules.
  await expect(page.locator('[data-rule-skill="commas"] .tip-example').first()).toBeHidden();
  await page.locator('[data-rule-skill="commas"] > summary').click();
  await expect(page.locator('[data-rule-skill="commas"] .tip-example').first()).toHaveText("We saw ducks, geese, and swans.");
  await expect(page.locator('[data-rule-skill="commas"] .rule-card.locked h4')).toContainText("🔒");
  await expect(page.locator("#rules-list")).not.toContainText("Use a colon before a list"); // grade 5 rule stays hidden

  // Tabs wrap and stay pinned: no sideways scrolling, still visible after scrolling down.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  const tabsBox = page.locator("#rules-tabs");
  expect(await tabsBox.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.mouse.wheel(0, 2000);
  await expect(tabsBox).toBeInViewport();

  await page.locator('[data-rules-tab="flow"]').click();
  await page.locator('[data-rule-skill="flow"] > summary').click();
  await page.locator('[data-rule-skill="flow"] .glossary summary').first().click();
  await expect(page.locator('[data-rule-skill="flow"] .glossary dl').first()).toContainText("subject noun");
  await page.locator("#rules-back").click();
  await expect(page.locator("#home")).toBeVisible();

  // From a world: opens on that world's tab; back returns to the world.
  await page.locator('[data-world="studio"]').click();
  await page.locator("#world-rules").click();
  await expect(page.locator('[data-rules-tab="studio"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#rules-studio")).toBeVisible();
  await page.locator("#rules-back").click();
  await expect(page.locator("#world")).toBeVisible();
  await expect(page.locator("#world-title")).toContainText("Sentence Studio");
});

test("Word lists: prepositions and articles in the Rule Book and in the Labels reminder", { tag: "@layout" }, async ({ page }) => {
  await openApp(page, { players: [player({ grade: 5 })], current: "p1" });
  await page.locator("#rules-btn").click();
  await page.locator('[data-rules-tab="lists"]').click();
  await page.locator("#list-prepositions summary").click();
  await expect(page.locator("#list-prepositions .word-chips li")).toHaveCount(48);
  await expect(page.locator("#list-prepositions")).toContainText("underneath");
  await page.locator("#list-articles summary").click();
  await expect(page.locator("#list-articles")).toContainText("an before a vowel sound");
  await page.locator("#rules-back").click();

  await startLevel(page, "flow", 2, "flow");
  await page.locator("#item [data-labels-help]").click();
  const p = page.locator("#labels-list .label-entry").filter({ has: page.locator("dt", { hasText: /^P$/ }) });
  await p.locator(".label-words summary").click();
  await expect(p.locator(".word-chips")).toContainText("between");
  const a = page.locator("#labels-list .label-entry").filter({ has: page.locator("dt", { hasText: /^A$/ }) });
  await expect(a.locator(".word-chips li")).toHaveText(["a", "an", "the"]);
});

test("the phone's Back button closes popups and steps back screens instead of leaving", async ({ page }) => {
  await openApp(page, { players: [player()], current: "p1" });
  const back = () => page.goBack({ waitUntil: "commit" }).catch(() => {});

  // World → Back → home
  await page.locator('[data-world="port"]').click();
  await back();
  await expect(page.locator("#home")).toBeVisible();

  // Tip Card → Back → closed, still on the world screen
  await page.locator('[data-world="port"]').click();
  await page.locator('.level-btn[data-skill="commas"][data-level="1"]').click();
  await expect(page.locator("#tip-overlay")).toBeVisible();
  await back();
  await expect(page.locator("#tip-overlay")).toBeHidden();
  await expect(page.locator("#world")).toBeVisible();

  // Mid-round → Back → asks first; Back again → keep playing
  await page.locator('.level-btn[data-skill="commas"][data-level="1"]').click();
  await page.locator("#tip-start").click();
  await back();
  await expect(page.locator("#quit-overlay")).toBeVisible();
  await back();
  await expect(page.locator("#quit-overlay")).toBeHidden();
  await expect(page.locator("#play")).toBeVisible();

  // Finish the round → results → Back → town
  for (let n = 0; n < 8; n++) {
    await answer(page);
    await page.locator("#next-btn").click();
  }
  await expect(page.locator("#result-overlay")).toBeVisible();
  await back();
  await expect(page.locator("#result-overlay")).toBeHidden();
  await expect(page.locator("#home")).toBeVisible();

  // Settings, Rule Book and Badges close with Back too
  await page.locator("#settings-btn").click();
  await back();
  await expect(page.locator("#settings-overlay")).toBeHidden();
  await page.locator("#rules-btn").click();
  await back();
  await expect(page.locator("#home")).toBeVisible();
  await page.locator("#badges-btn").click();
  await back();
  await expect(page.locator("#home")).toBeVisible();
});

test("Back on a rule card opened from the results returns to the results", async ({ page }) => {
  await openApp(page, { players: [player()], current: "p1" });
  await startLevel(page, "verbs", 1, "works");
  for (let n = 0; n < 8; n++) {
    await answer(page);
    await page.locator("#next-btn").click();
  }
  await page.locator("#result-rule").click();
  await expect(page.locator("#tip-overlay")).toBeVisible();
  await page.goBack({ waitUntil: "commit" }).catch(() => {});
  await expect(page.locator("#tip-overlay")).toBeHidden();
  await expect(page.locator("#result-overlay")).toBeVisible();
});

test("Flow Factory: the 📘 Labels reminder opens mid-question, costs nothing, and closes back to the sentence", async ({ page }) => {
  await openApp(page, { players: [player({ grade: 5 })], current: "p1" });
  await startLevel(page, "flow", 1, "flow");
  const before = await page.locator("#item .flow-q").textContent();
  await page.locator("#item [data-labels-help]").click();
  await expect(page.locator("#labels-overlay")).toBeVisible();
  await expect(page.locator("#labels-list .label-entry")).toHaveCount(6); // level 1: SN, SP, V, A, Adj, Adv
  await expect(page.locator("#labels-list")).toContainText("subject noun");
  await expect(page.locator("#labels-list")).toContainText("Ask how, when or where");
  await expect(page.locator("#labels-list")).not.toContainText("indirect object");
  await page.locator("#labels-overlay [data-close]").click();
  await expect(page.locator("#labels-overlay")).toBeHidden();
  await expect(page.locator("#item .flow-q")).toHaveText(before);

  // Phone Back closes it too, and the round carries on with full marks.
  await page.locator("#item [data-labels-help]").click();
  await page.goBack({ waitUntil: "commit" }).catch(() => {});
  await expect(page.locator("#labels-overlay")).toBeHidden();
  await expect(page.locator("#play")).toBeVisible();
  await answer(page);
  await expect(page.locator("#feedback.good")).not.toContainText("A hint helped");
});

test("Labels reminder shows the level's labels and patterns, and works on Build from labels", async ({ page }) => {
  await openApp(page, { players: [player({ grade: 8 })], current: "p1" });
  await startLevel(page, "flow2", 2, "flow");
  await page.locator("#item [data-labels-help]").click();
  await expect(page.locator("#labels-list")).toContainText("object complement noun");
  await expect(page.locator("#labels-patterns li")).toHaveCount(7);
  await page.keyboard.press("Escape");
  for (let n = 0; n < 3; n++) {
    await answer(page);
    await page.locator("#next-btn").click();
  }
  expect((await currentItem(page)).type).toBe("labels");
  await page.locator("#item [data-labels-help]").click();
  await expect(page.locator("#labels-overlay")).toBeVisible();
  await expect(page.locator("#labels-list")).toContainText("direct object");
});

test("Mark it up: wrong marks give a hint, then the answer; right marks finish the flow", async ({ page }) => {
  const { items } = JSON.parse(readFileSync("data/content.json", "utf8"));
  const seen = Object.fromEntries(items.filter((i) => i.skill === "flow" && i.level === 2 && i.id !== "flow-2-01").map((i) => [i.id, { seen: 1, misses: 0, last: 1 }]));
  await openApp(page, { players: [player({ grade: 5, items: seen })], current: "p1" });
  await startLevel(page, "flow", 2, "flow");
  const item = await currentItem(page);
  const parsed = parseFlow(item);
  for (const step of parsed.steps) {
    const w = page.locator(`#item [data-fw="${step.index}"]`);
    if (await w.isEnabled()) await w.click();
    await page.locator(`#item [data-label="${step.label}"]`).click();
  }
  await page.locator(`#item [data-kind-pick="${parsed.kind}"]`).click();
  await expect(page.locator("#item .flow-q")).toHaveText("Which pattern is it?");
  await page.locator('#item [data-pattern="1"]').click();
  await expect(page.locator("#item .flow-count")).toHaveText("Mark it up · 1 of 5");
  await expect(page.locator("#item .flow-q")).toHaveText("Noun check: circle every noun.");
  // Circle only one of the two nouns: a hint, then a second miss shows the answer and moves on.
  await page.locator('#item [data-fw="3"]').click();
  await page.locator("#item [data-markup-done]").click();
  await expect(page.locator("#feedback")).toContainText("Nouns are the words labeled");
  await page.locator("#item [data-markup-done]").click();
  await expect(page.locator('#item [data-fw="8"]')).toHaveClass(/mk-circle/);
  await expect(page.locator("#item .flow-count")).toHaveText("Mark it up · 2 of 5");
  const tasks = markupTasks(parsed.words.map((w) => w.label), parsed.words.map((w) => w.word));
  await markUp(page, tasks[1]); // parentheses
  // The slash waits for Done like every other mark: tapping another word moves it.
  const slash = tasks[2];
  await page.locator('#item [data-fw="2"]').click();
  await expect(page.locator('#item [data-fw="2"]')).toHaveClass(/mk-slash/);
  await expect(page.locator("#item .flow-count")).toHaveText("Mark it up · 3 of 5");
  await page.locator(`#item [data-fw="${slash.answer[0]}"]`).click();
  await expect(page.locator('#item [data-fw="2"]')).not.toHaveClass(/mk-slash/);
  await page.locator("#item [data-markup-done]").click();
  await expect(page.locator("#item .flow-count")).toHaveText("Mark it up · 4 of 5");
  for (const task of tasks.slice(3)) await markUp(page, task);
  await expect(page.locator('#item [data-fw="6"]')).toHaveClass(/mk-po/);
  await expect(page.locator('#item [data-fw="4"]')).toHaveClass(/mk-slash/);
  for (const i of [0, 1, 2, 3]) await expect(page.locator(`#item [data-fw="${i}"]`)).toHaveClass(/mk-u1/); // complete subject
  for (const i of [4, 5, 6, 7, 8]) await expect(page.locator(`#item [data-fw="${i}"]`)).toHaveClass(/mk-u2/); // complete predicate
  // Grade 5, first flow of the level: Shurley's noun table comes next.
  await expect(page.locator("#item .flow-count")).toHaveText("Noun table · 1 of 8");
  await expect(page.locator("#item .flow-q")).toHaveText("What job does puppies do?");
  await expect(page.locator("#item .nt-reminder")).toHaveText("Its label from the Q&A Flow is its job.");
  // 📘 Nouns explains common/proper and singular/plural without leaving the sentence.
  await page.locator("#item [data-nouns-help]").click();
  await expect(page.locator("#nouns-overlay")).toBeVisible();
  await expect(page.locator("#nouns-overlay")).toContainText("Duluth");
  await expect(page.locator("#nouns-overlay")).toContainText("geese");
  await page.locator("#nouns-overlay [data-close]").click();
  await expect(page.locator("#item [data-nt]")).toHaveCount(2); // level 2 teaches two noun jobs: SN and OP
  await page.locator('#item [data-nt="OP · object of the preposition"]').click();
  await expect(page.locator("#feedback")).toContainText("SN means subject noun");
  await expect(page.locator('#item [data-nt="OP · object of the preposition"]')).toBeDisabled();
  await page.locator('#item [data-nt="SN · subject noun"]').click();
  await expect(page.locator("#item .noun-table tbody tr").first()).toContainText("SN");
  for (const answer of ["Plural", "Common", "OP · object of the preposition", "Singular", "Common", "puppies", "ran"]) {
    await page.locator(`#item [data-nt="${answer}"]`).click();
  }
  await expect(page.locator("#item .noun-table tbody tr").nth(1)).toContainText("door");
  await expect(page.locator("#item .noun-table tbody tr").nth(1)).toContainText("Singular");
  await expect(page.locator("#item .noun-simple")).toContainText("Simple subject: puppies");
  await expect(page.locator("#item .noun-simple")).toContainText("Simple predicate: ran");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("sentenceBuilders_players")));
  expect(saved[0].nounTableRight).toBe(7); // 8 questions, one missed first
  await expect(page.locator("#next-btn")).toBeVisible();
});

test("Sentence Diagramming: opens in grade 5, mark up then diagram, wrong words go back", async ({ page }) => {
  await openApp(page, { players: [player({ grade: 4 }), player({ id: "p2", name: "Max", avatar: "🐯", grade: 5 })], current: "p1" });
  await page.locator('[data-world="flow"]').click();
  await expect(page.locator('.level-btn[data-skill="diagram"]')).toHaveCount(0);
  await page.goBack();
  await page.locator("#who-btn").click();
  await page.locator('[data-player="p2"]').click();
  await startLevel(page, "diagram", 1, "flow");
  // First item: guided, one line at a time with the reason; a wrong pick is refused.
  const first = await currentItem(page);
  await diagramIt(page, first, { markupOnly: true });
  await expect(page.locator("#item .dg-guide")).toContainText("Step 1 of");
  await expect(page.locator("#item .dg-guide")).toContainText("is the simple subject, so it goes on the baseline");
  await expect(page.locator("#item .dg-slot.dg-target")).toHaveCount(1);
  const firstSlots = buildDiagram(first).slots;
  const verbSlot = firstSlots.find((s) => s.role === "verb");
  await page.locator("#item .dg-bank [data-chip]").filter({ hasText: new RegExp(`^${verbSlot.text}$`) }).first().click();
  await page.locator(`#item [data-slot="${verbSlot.id}"]`).click();
  await expect(page.locator("#feedback")).toContainText("Not that one yet");
  await diagramIt(page, first);
  await expect(page.locator("#item .dg-why")).toBeVisible();
  await expect(page.locator("#item .dg-why li").first()).toContainText("simple subject");
  await expect(page.locator("#feedback.good")).toBeVisible();
  await page.locator("#next-btn").click();
  // Second item: swap two words to see the miss, then do it right.
  const item = await currentItem(page);
  await diagramIt(page, item, { markupOnly: true });
  const { slots } = buildDiagram(item);
  const order = [...slots];
  [order[0], order[1]] = [order[1], order[0]]; // subject and verb swapped
  for (let k = 0; k < slots.length; k++) {
    await page.locator("#item .dg-bank [data-chip]").filter({ hasText: new RegExp(`^${order[k].text}$`) }).first().click();
    await page.locator(`#item [data-slot="${slots[k].id}"]`).click();
  }
  await page.locator("#item [data-dg-check]").click();
  await expect(page.locator("#feedback")).toContainText("2 words are in the wrong place");
  await expect(page.locator("#item .dg-bank [data-chip]")).toHaveCount(2);
  for (const slot of slots.slice(0, 2)) {
    await page.locator("#item .dg-bank [data-chip]").filter({ hasText: new RegExp(`^${slot.text}$`) }).first().click();
    await page.locator(`#item [data-slot="${slot.id}"]`).click();
  }
  await page.locator("#item [data-dg-check]").click();
  await expect(page.locator("#next-btn")).toBeVisible();
  await expect(page.locator("#item .dg-why")).toHaveAttribute("open", "");
  await page.locator("#next-btn").click();
  for (let n = 2; n < 5; n++) {
    await answer(page);
    await expect(page.locator("#feedback.good")).toBeVisible();
    await page.locator("#next-btn").click();
  }
  await expect(page.locator("#result-title")).toBeVisible();
});

test("Studio look: automatic for grade 6+, and either look can be picked in Settings", async ({ page }) => {
  await openApp(page, { players: [player({ grade: 4 }), player({ id: "p2", name: "Max", avatar: "🐯", grade: 7 })], current: "p1" });
  await expect(page.locator("body")).not.toHaveClass(/theme-studio/);
  await page.locator("#who-btn").click();
  await page.locator('[data-player="p2"]').click();
  await expect(page.locator("body")).toHaveClass(/theme-studio/);
  await page.locator("#settings-btn").click();
  await page.locator("#set-theme").selectOption("bright");
  await expect(page.locator("body")).not.toHaveClass(/theme-studio/);
  await page.locator("#set-theme").selectOption("auto");
  await expect(page.locator("body")).toHaveClass(/theme-studio/);
});

test("Edit player: ✏️ on a player card changes name, grade and avatar on Save; Cancel keeps them", async ({ page }) => {
  await openApp(page, { players: [player({ grade: 7, name: "Max" }), player({ id: "p2", name: "Ava", avatar: "🐼", grade: 4 })], current: "p1" });
  await page.locator("#who-btn").click();
  await expect(page.locator("#players")).toBeVisible();
  // Cancel throws away changes.
  await page.locator('[data-edit-player="p1"]').click();
  await expect(page.locator("#edit-overlay")).toBeVisible();
  await expect(page.locator("#edit-avatar-grid .avatar-group").first()).toHaveText("Sports, music and more");
  await page.locator('#edit-avatar-grid [data-edit-avatar="🎧"]').click();
  await page.locator("#edit-overlay [data-close]").click();
  await expect(page.locator('[data-player="p1"]')).toContainText("🦊");
  // Save keeps them.
  await page.locator('[data-edit-player="p1"]').click();
  await page.locator("#edit-name").fill("Maxwell");
  await page.locator("#edit-grade").selectOption("8");
  await page.locator('#edit-avatar-grid [data-edit-avatar="🎧"]').click();
  await expect(page.locator('#edit-avatar-grid [data-edit-avatar="🎧"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('#edit-form button[type="submit"]').click();
  await expect(page.locator("#edit-overlay")).toBeHidden();
  await expect(page.locator('[data-player="p1"]')).toContainText("🎧");
  await expect(page.locator('[data-player="p1"]')).toContainText("Maxwell");
  await expect(page.locator('[data-player="p1"]')).toContainText("Grade 8");
  // An empty name isn't saved.
  await page.locator('[data-edit-player="p2"]').click();
  await page.locator("#edit-name").fill("  ");
  await page.locator('#edit-form button[type="submit"]').click();
  await expect(page.locator("#edit-error")).toHaveText("Type a name or nickname.");
  // Delete asks twice.
  await page.locator("#edit-delete").click();
  await expect(page.locator("#edit-delete")).toContainText("Tap again to delete Ava");
  await page.locator("#edit-delete").click();
  await expect(page.locator('[data-player="p2"]')).toHaveCount(0);
  await page.locator('[data-player="p1"]').click();
  await page.reload();
  await expect(page.locator("#who-btn")).toContainText("🎧");
});

test("About: from Settings and Who's playing?, Back returns where you were", async ({ page }) => {
  await openApp(page, { players: [player({ grade: 4 })], current: "p1" });
  await page.locator("#settings-btn").click();
  await page.locator("#settings-overlay [data-about]").click();
  await expect(page.locator("#about")).toBeVisible();
  await expect(page.locator("#about")).toContainText("2020 Minnesota K–12 Academic Standards");
  await expect(page.locator("#about")).toContainText("Shurley English");
  await page.goBack();
  await expect(page.locator("#settings-overlay")).toBeVisible();
  await page.locator("#settings-overlay [data-close]").click();
  await page.locator("#who-btn").click();
  await page.locator("#players [data-about]").click();
  await expect(page.locator("#about")).toBeVisible();
  await page.locator("#about-back").click();
  await expect(page.locator("#players")).toBeVisible();
});

test("noun table: only on the first Q&A Flow sentence of a level, and not for grade 3", async ({ page }) => {
  await openApp(page, { players: [player({ grade: 3 })], current: "p1" });
  await startLevel(page, "flow", 1, "flow");
  await answer(page);
  await expect(page.locator("#item .noun-table")).toHaveCount(0);
  await expect(page.locator("#next-btn")).toBeVisible();
});

test("noun table reminders fade once a child knows them; the Rule Book explains kinds of nouns", { tag: "@layout" }, async ({ page }) => {
  const { items } = JSON.parse(readFileSync("data/content.json", "utf8"));
  const seen = Object.fromEntries(items.filter((i) => i.skill === "flow" && i.level === 2 && i.id !== "flow-2-01").map((i) => [i.id, { seen: 1, misses: 0, last: 1 }]));
  const p = player({ grade: 5, items: seen });
  p.nounTableRight = 12;
  await openApp(page, { players: [p], current: "p1" });
  await page.locator("#rules-btn").click();
  await page.locator('[data-rules-tab="flow"]').click();
  await expect(page.locator("#nouns-common-proper")).toHaveCount(0); // its one home is Reference
  await page.locator('[data-rules-tab="lists"]').click();
  await page.locator("#nouns-common-proper summary").click();
  await expect(page.locator("#nouns-common-proper")).toContainText("Lake Superior");
  await expect(page.locator("#nouns-singular-plural")).toHaveCount(1);
  await page.locator("#rules-back").click();
  await startLevel(page, "flow", 2, "flow");
  const item = await currentItem(page);
  const parsed = parseFlow(item);
  for (const step of parsed.steps) {
    const w = page.locator(`#item [data-fw="${step.index}"]`);
    if (await w.isEnabled()) await w.click();
    await page.locator(`#item [data-label="${step.label}"]`).click();
  }
  await page.locator(`#item [data-kind-pick="${parsed.kind}"]`).click();
  await page.locator(`#item [data-pattern="${parsed.pattern}"]`).click();
  for (const task of markupTasks(parsed.words.map((w) => w.label), parsed.words.map((w) => w.word))) await markUp(page, task);
  await expect(page.locator("#item .flow-count")).toHaveText("Noun table · 1 of 8");
  await expect(page.locator("#item .nt-reminder")).toHaveCount(0);
  // Finish the table; 📘 Nouns still opens the reminder after the sentence is done.
  await answer(page);
  await expect(page.locator("#next-btn")).toBeVisible();
  await page.locator("#item [data-nouns-help]").click();
  await expect(page.locator("#nouns-overlay")).toBeVisible();
});

test("bricks: a level pays bricks, the new building rises, and the Build screen spends them", { tag: "@layout" }, async ({ page }) => {
  await openApp(page, { players: [player({ grade: 4 })], current: "p1" });
  await startLevel(page, "commas", 1);
  for (let n = 0; n < 8; n++) {
    await answer(page);
    await page.locator("#next-btn").click();
  }
  await expect(page.locator("#result-bricks")).toContainText("+35 🧱 bricks");
  await page.locator("#result-town").click();
  await expect(page.locator("#town .rise")).toHaveCount(1);
  await expect(page.locator("#build-btn")).toContainText("Build on the island · 35 🧱");
  await expect(page.locator("#build-btn")).toContainText("ready");
  await page.locator("#build-btn").click();
  await expect(page.locator("#build")).toBeVisible();
  await expect(page.locator('[data-buy="ferris"]')).toBeDisabled();
  await expect(page.locator('[data-buy="ferris"]')).toContainText("125 more");
  await page.locator('[data-buy="oak"]').click();
  await expect(page.locator("#build-bricks")).toContainText("23");
  await expect(page.locator(".build-selected")).toContainText("Oak tree: drag it anywhere.");
  await expect(page.locator('[data-buy="oak"]')).toHaveText("Build another");
  await page.locator('[data-buy="oak"]').click(); // a second oak
  await expect(page.locator("#build-town .decor")).toHaveCount(2);
  await expect(page.locator("#build-bricks")).toContainText("11");
  // Drag the first oak up into the sky.
  const oak = page.locator("#build-town .decor").first();
  const box = await oak.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const scene = await page.locator("#build-town svg").boundingBox();
  await page.mouse.move(scene.x + scene.width * 0.4, scene.y + scene.height * 0.25, { steps: 8 });
  await page.mouse.up();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem("sentenceBuilders_players")));
  expect(saved[0].decor[0].y).toBeLessThan(64); // in the sky now
  // Tap the other to select it, then put it away for a full refund.
  await page.locator("#build-town .decor").nth(1).click();
  await page.locator("[data-put-away]").click();
  await expect(page.locator("#build-bricks")).toContainText("23");
  await expect(page.locator("#build-town .decor")).toHaveCount(1);
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem("sentenceBuilders_players")));
  expect(saved[0].decor).toHaveLength(1);
  await page.goBack();
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#town .decor title")).toHaveText("Oak tree");
  await expect(page.locator("#town .rise")).toHaveCount(0); // only rises once
});

test("Pip's homework: grade three paragraphs, earn bricks, and it doesn't count as a level", async ({ page }) => {
  await openApp(page, { players: [player({ grade: 7 })], current: "p1" });
  await page.locator("#week-btn").click(); // the Notice Board: Pip's "Tutor needed" flyer
  await page.locator("#homework-btn").click();
  await expect(page.locator("#play-skill")).toContainText("📝 Pip's homework:");
  await expect(page.locator("#progress-text")).toHaveText("1 of 3");
  const first = await currentItem(page);
  expect(first.id).toMatch(/^hw-6-8-/);
  for (let n = 0; n < 3; n++) {
    await answer(page);
    await page.locator("#next-btn").click();
  }
  await expect(page.locator("#result-title")).toHaveText("Pip's grade: A+");
  await expect(page.locator("#result-bricks")).toContainText("+18 🧱 bricks");
  await expect(page.locator("#result-rule")).toBeHidden();
  await page.locator("#result-next").click();
  await expect(page.locator("#play-skill")).toContainText("📝 Pip's homework:");
  const second = await currentItem(page);
  expect(second.id).not.toBe(first.id); // unseen paragraphs come first
  await page.locator("#quit-btn").click();
  await page.locator("#quit-yes").click();
  await expect(page.locator("#home")).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("sentenceBuilders_players")));
  expect(Object.keys(saved[0].levels)).toHaveLength(0);
  // Today's homework is checked, so the board's flyer says thanks (and more is still there).
  await expect(page.locator("#week-btn")).not.toContainText("Pip needs a tutor");
  await page.locator("#week-btn").click();
  await expect(page.locator("#homework-btn")).toHaveText("Check more homework");
});

test("Rule Book: word endings (-ed, plurals, will, -s/-ing, irregular verbs) in one place, Reference", { tag: "@layout" }, async ({ page }) => {
  await openApp(page, { players: [player({ grade: 4 })], current: "p1" });
  await page.locator("#rules-btn").click();
  await page.locator('[data-rules-tab="works"]').click();
  await expect(page.locator("#rules-list [id^=spell-]")).toHaveCount(0); // not repeated in Word Works
  await page.locator(".rules-ref-link [data-rules-link=lists]").click(); // its link goes to Reference
  await expect(page.locator('[data-rules-tab="lists"]')).toHaveAttribute("aria-selected", "true");
  await page.locator("#spell-past-ed summary").click();
  await expect(page.locator("#spell-past-ed")).toContainText("carry → carried");
  await page.locator("#spell-irregular summary").click();
  await expect(page.locator("#spell-irregular .spell-pairs li")).toContainText(["go → went"]);
  await page.locator("#spell-plurals summary").click();
  await expect(page.locator("#spell-plurals")).toContainText("leaf → leaves");
  await page.locator("#spell-future summary").click();
  await expect(page.locator("#spell-future")).toContainText("will + the plain verb");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("Capital letters: a Punctuation Port skill, with its own spot on the port's path", { tag: "@layout" }, async ({ page }) => {
  await openApp(page, { players: [player({ grade: 5 })], current: "p1" });
  await expect(page.locator('.town g[data-skill="capitals"]')).toHaveCount(1);
  await startLevel(page, "capitals", 3);
  for (let n = 0; n < 8; n++) {
    await answer(page);
    await page.locator("#next-btn").click();
  }
  await expect(page.locator("#result-title")).toHaveText("Perfect build!");
  await page.locator("#result-town").click();
  // Every building lot fits on screen: nothing runs off the right edge of the town.
  const overflow = await page.evaluate(() => {
    // Each district's town plot is 360 wide; its lots are drawn in the plot's own units.
    return [...document.querySelectorAll(".town g.district [data-skill] rect")].some((r) => r.getBBox().x + r.getBBox().width > 360.5);
  });
  expect(overflow).toBe(false);
});

test("town map: tap a region to zoom in, tap a lot for its levels, and decorate that district", { tag: "@layout" }, async ({ page }) => {
  const ava = player({ levels: { "commas-1": { best: 8, stars: 3, plays: 1 } } });
  await openApp(page, { players: [{ ...ava, bricks: 30 }], current: "p1" });
  await expect(page.locator("#map-panel")).toContainText("Tap a place on the island");
  await expect(page.locator(".map-chip")).toHaveCount(0); // the Worlds list names the places; no second list
  // Pip's Play button goes straight to the next level's Tip Card.
  await page.locator("[data-next-up]").click();
  await expect(page.locator("#tip-level")).toContainText("Commas and colons · Level 2");
  await page.locator("#tip-close").click();
  // Tap Punctuation Port's region: the map zooms in and the panel shows its skills.
  await page.locator("#town").scrollIntoViewIfNeeded();
  const port = await page.locator('g.district[data-area="port"]').boundingBox();
  await page.mouse.click(port.x + port.width / 2, port.y + 20);
  await expect(page.locator(".town-map")).toHaveClass(/zoomed/);
  await expect(page.locator("#map-panel")).toContainText("Punctuation Port");
  await expect(page.locator("#map-panel")).toContainText("1/15 built");
  // Tap the empty lot for commas level 2: its level card opens; a level opens the Tip Card.
  const lot = await page.locator('.lot-hit[data-skill="commas"][data-level="2"]').boundingBox();
  await page.mouse.click(lot.x + lot.width / 2, lot.y + lot.height - 12);
  await expect(page.locator("#skill-overlay")).toBeVisible();
  await page.locator('#skill-overlay .level-btn[data-level="2"]').click();
  await expect(page.locator("#skill-overlay")).toBeHidden();
  await expect(page.locator("#tip-overlay")).toBeVisible();
  await page.locator("#tip-close").click();
  // Decorate here: the Build screen opens on the port, with its own decorations.
  await page.locator("[data-decorate=port]").click();
  await expect(page.locator('[data-build-area="port"]')).toHaveAttribute("aria-selected", "true");
  await page.locator('[data-buy="anchor"]').click();
  await expect(page.locator('[data-buy="anchor"]')).toHaveText("Build another");
  await page.locator('[data-build-area="square"]').click();
  await expect(page.locator('[data-buy="anchor"]')).toHaveCount(0); // anchors belong to the port
  await page.locator("#build-back").click();
  await expect(page.locator('g.district[data-area="port"] .decor title')).toHaveText("Anchor");
  await page.locator("#map-fit").click();
  await expect(page.locator(".town-map")).not.toHaveClass(/zoomed/);
  // Grammar Peaks can be visited too.
  const peaks = await page.locator('.region[data-area="peaks"]').boundingBox();
  await page.mouse.click(peaks.x + peaks.width / 2, peaks.y + peaks.height * 0.4);
  await expect(page.locator(".town-map")).toHaveClass(/zoomed/);
  await expect(page.locator("#map-panel")).toContainText("Grammar Peaks");
  await page.locator("[data-map-fit]").click();
  await expect(page.locator("#map-panel")).toContainText("Tap a place on the island");
});

test("Grammar Peaks: a Summit Review mixes passed skills and plants a flag; Spelling Lake floats a boat", { tag: "@layout" }, async ({ page }) => {
  const levels = { "commas-1": { best: 8, stars: 3, plays: 1 }, "verbs-1": { best: 8, stars: 3, plays: 1 }, "fragments-1": { best: 8, stars: 3, plays: 1 } };
  await openApp(page, { players: [player({ levels })], current: "p1" });
  await page.locator("#town").scrollIntoViewIfNeeded();
  const peaks = await page.locator('.region[data-area="peaks"]').boundingBox();
  await page.mouse.click(peaks.x + peaks.width / 2, peaks.y + peaks.height * 0.4);
  await expect(page.locator("#map-panel")).toContainText("Summit Review");
  await page.locator('[data-practice="summit"]').click();
  const seen = [];
  for (let n = 0; n < 8; n++) {
    await expect(page.locator("#play-skill")).toContainText("Summit Review");
    seen.push((await currentItem(page)).skill);
    await answer(page);
    await page.locator("#next-btn").click();
  }
  expect(new Set(seen)).toEqual(new Set(["commas", "verbs", "fragments"])); // all three passed skills, mixed
  for (let n = 1; n < seen.length; n++) expect(seen[n]).not.toBe(seen[n - 1]); // never the same skill twice in a row
  await expect(page.locator("#result-title")).toHaveText("You reached the summit!");
  await page.locator("#result-town").click();
  await expect(page.locator(".summit-flag")).toHaveCount(1);
  await expect(page.locator("#map-panel")).toContainText("1 flag planted");
  // Spelling Lake: grade 4 gets the grades 3-5 questions.
  await page.locator('[data-practice="lake"]').click();
  for (let n = 0; n < 8; n++) {
    await expect(page.locator("#play-skill")).toHaveText("💧 Spelling Lake");
    await expect(page.locator("#prompt")).toHaveText("Which spelling is right?");
    expect((await currentItem(page)).level).toBe(1);
    await answer(page);
    await page.locator("#next-btn").click();
  }
  await expect(page.locator("#result-title")).toHaveText("A new boat on the lake!");
  await page.locator("#result-town").click();
  await expect(page.locator(".boat")).toHaveCount(1);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("sentenceBuilders_players"))[0]);
  expect(saved.summits).toBe(1);
  expect(saved.lakeWins).toBe(1);
  expect(saved.levels).toEqual(levels); // practice never changes levels
});

test("Grammar Peaks: no Summit Review until a level is passed", { tag: "@layout" }, async ({ page }) => {
  await openApp(page, { players: [player()], current: "p1" });
  await page.locator("#town").scrollIntoViewIfNeeded();
  const peaks = await page.locator('.region[data-area="peaks"]').boundingBox();
  await page.mouse.click(peaks.x + peaks.width / 2, peaks.y + peaks.height * 0.4);
  await expect(page.locator('[data-practice="summit"]')).toBeDisabled();
  await expect(page.locator('[data-practice="summit"]')).toContainText("Pass a level anywhere on the island");
  await expect(page.locator('[data-practice="lake"]')).toBeEnabled();
});

test("Compound Q&A Flow: grades 3-5 label compound parts and interjections, all three levels", async ({ page }) => {
  test.slow(); // plays several whole levels: extra time for slower CI machines
  await openApp(page, { players: [player({ grade: 5 })], current: "p1" });
  for (const level of [1, 2, 3]) {
    await startLevel(page, "cflow", level, "flow");
    for (let n = 0; n < 5; n++) {
      const item = await currentItem(page);
      expect(item.skill).toBe("cflow");
      await answer(page);
      await expect(page.locator("#feedback.good")).toBeVisible();
      await page.locator("#next-btn").click();
    }
    await expect(page.locator("#result-title")).toHaveText("Perfect build!");
    await page.locator("#result-town").click();
  }
  await expect(page.locator('.town g[data-skill="cflow"]')).toHaveCount(1);
});

test("compounds: either part first is right, in a Q&A Flow and in Build from labels", async ({ page }) => {
  test.slow(); // plays several whole levels: extra time for slower CI machines
  await openApp(page, { players: [player({ grade: 5 })], current: "p1" });
  for (const level of [1, 2, 3]) {
    await startLevel(page, "cflow", level, "flow");
    for (let n = 0; n < 5; n++) {
      await answer(page, { swapCompounds: true });
      await expect(page.locator("#feedback.good")).toContainText("✓");
      await page.locator("#next-btn").click();
    }
    await expect(page.locator("#result-title")).toHaveText("Perfect build!");
    await page.locator("#result-town").click();
  }
});

test("Rule Book: tabs use the places' names, skills come before reference, and search finds rules and labels", { tag: "@layout" }, async ({ page }) => {
  await openApp(page, { players: [player({ grade: 5 })], current: "p1" });
  await page.locator("#rules-btn").click();
  await expect(page.locator('[data-rules-tab="port"]')).toContainText("Punctuation Port");
  await page.locator('[data-rules-tab="works"]').click();
  await expect(page.locator(".rules-group").first()).toHaveText("Skills");
  await expect(page.locator(".rules-group")).toHaveCount(1);
  await expect(page.locator(".rules-ref-link")).toContainText("spelling patterns are in");
  await page.locator('[data-rules-tab="lists"]').click();
  await expect(page.locator(".rules-group")).toHaveText(["Word lists", "Kinds of nouns", "Word parts", "Spelling patterns"]);
  await page.locator('[data-rules-tab="works"]').click();
  await page.locator("#rules-search").fill("semicolon");
  await expect(page.locator(".search-hit").first()).toContainText("Semicolons");
  await page.locator("#rules-search").fill("CDO");
  await expect(page.locator(".search-hit").first()).toContainText("compound direct object");
  await page.locator("#rules-search").fill("zzzz");
  await expect(page.locator("#rules-list")).toContainText("Nothing matches");
  await page.locator("#rules-search").fill("");
  await expect(page.locator('[data-rules-tab="works"]')).toHaveAttribute("aria-selected", "true");
});

test("Word Parts, Word Choice and Figurative Language: play a level of each, and the Rule Book has word parts", async ({ page }) => {
  test.slow(); // plays several whole levels: extra time for slower CI machines
  await openApp(page, { players: [player({ grade: 6 })], current: "p1" });
  for (const [skill, level, world] of [["wordparts", 3, "works"], ["wordchoice", 2, "works"], ["figurative", 3, "studio"]]) {
    await startLevel(page, skill, level, world);
    for (let n = 0; n < 8; n++) {
      await answer(page);
      await page.locator("#next-btn").click();
    }
    await expect(page.locator("#result-title")).toHaveText("Perfect build!");
    await page.locator("#result-town").click();
  }
  await page.locator("#rules-btn").click();
  await page.locator("#rules-search").fill("telescope");
  await expect(page.locator(".search-hit").first()).toContainText("Greek");
});

test("Grammar Peaks has a card in the Worlds list that opens it on the map", { tag: "@layout" }, async ({ page }) => {
  await openApp(page, { players: [{ ...player(), summits: 2, lakeWins: 1 }], current: "p1" });
  const card = page.locator("#world-list [data-peaks]");
  await expect(card).toContainText("Grammar Peaks");
  await expect(card).toContainText("🚩 2 · ⛵ 1");
  await card.click();
  await expect(page.locator(".town-map")).toHaveClass(/zoomed/);
  await expect(page.locator('[data-practice="lake"]')).toBeVisible();
});

test("Parts of Speech and Revising Sentences: play a level of each", async ({ page }) => {
  test.slow(); // plays several whole levels: extra time for slower CI machines
  await openApp(page, { players: [player({ grade: 5 })], current: "p1" });
  for (const [skill, level, world] of [["speech", 3, "flow"], ["revising", 3, "studio"]]) {
    await startLevel(page, skill, level, world);
    for (let n = 0; n < 8; n++) {
      await answer(page);
      await page.locator("#next-btn").click();
    }
    await expect(page.locator("#result-title")).toHaveText("Perfect build!");
    await page.locator("#result-town").click();
  }
});

test("Sentence Combining: type the joined sentence; a slip gets a pointed hint", async ({ page }) => {
  test.slow(); // plays a whole level: extra time for slower CI machines
  await openApp(page, { players: [player({ grade: 5 })], current: "p1" });
  await startLevel(page, "combining", 2, "studio");
  const first = await currentItem(page);
  await expect(page.locator("#item .combine-parts .sentence")).toHaveCount(first.parts.length);
  // Leave out the comma: the hint says so, and the typed words stay to fix.
  await page.locator("#item .combine-input").fill(first.answers[0].replace(",", ""));
  await page.locator("#item .combine-input").press("Enter");
  await expect(page.locator("#feedback")).toContainText("comma");
  await expect(page.locator("#item .combine-input")).toHaveValue(first.answers[0].replace(",", ""));
  await answer(page);
  await expect(page.locator("#feedback.good")).toBeVisible();
  await page.locator("#next-btn").click();
  for (let n = 1; n < 8; n++) {
    await answer(page, { swapCompounds: n % 2 === 1 });
    await page.locator("#next-btn").click();
  }
  await expect(page.locator("#result-title")).toBeVisible();
});

test("Settings: names in sentences and reading support @layout", async ({ page }) => {
  await openApp(page, { players: [player({ grade: 5 })], current: "p1" });
  await page.locator("#settings-btn").click();
  await expect(page.locator("#names-fields")).toBeHidden();
  await page.locator("#set-names-on").check();
  await expect(page.locator("#set-name-0")).toHaveValue("Ava");
  await page.locator("#set-name-0").fill("Evan");
  await page.locator("#set-name-0").dispatchEvent("change");
  await expect(page.locator("#names-status")).toContainText("pick he or she");
  await page.locator("#set-pron-0").selectOption("he");
  await page.locator("#set-name-1").fill("Mary Ann");
  await page.locator("#set-name-1").dispatchEvent("change");
  await expect(page.locator("#names-status")).toContainText("Mary Ann");
  await page.locator("#set-font").selectOption("dyslexic");
  await page.locator("#set-size").selectOption("larger");
  await page.locator("#set-spacing").check();
  await expect(page.locator("body")).toHaveAttribute("data-font", "dyslexic");
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "larger");
  await expect(page.locator("body")).toHaveClass(/spacing/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("sentenceBuilders_players"))[0].settings);
  expect(saved.names.on).toBe(true);
  expect(saved.names.people[0]).toEqual({ name: "Evan", pronoun: "he" });
  expect(saved.font).toBe("dyslexic");
  const bigger = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  expect(bigger).toBe(20);
  await page.locator("#settings-overlay [data-close]").click();
  // With the dice always saying yes, every sentence with a he-name in it says Evan instead.
  await page.evaluate(() => { Math.random = () => 0.01; });
  await startLevel(page, "combining", 1, "studio");
  let saw = false;
  for (let n = 0; n < 8 && !saw; n++) {
    const text = await page.locator("#item").textContent();
    saw = text.includes("Evan");
    expect(text).not.toMatch(/\b(Leo|Ben|Omar|Kai)\b/);
    await miss(page);
    await miss(page);
    await page.locator("#next-btn").click();
  }
  expect(saw).toBe(true);
});

test("Island: things that move (the tractor) drive back and forth", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const p = player({ grade: 5 });
  p.decor = [{ uid: "d1", id: "tractor", area: "works", x: 200, y: 400 }];
  p.bricks = 0;
  await openApp(page, { players: [p], current: "p1" });
  await expect(page.locator(".town .move-drive").first()).toBeAttached();
  const anim = await page.locator(".town .move-drive").first().evaluate((el) => getComputedStyle(el).animationName);
  expect(anim).toBe("drive");
});

test("Teacher report: from Progress → Me; ranges, a note, print layout and shared text @layout", async ({ page }) => {
  const now = Date.now();
  const today = new Date(now - new Date(now).getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const evan = player({ name: "Evan", grade: 4, levels: { "commas-1": { best: 7, stars: 2, plays: 1, passedOn: today }, "verbs-1": { best: 8, stars: 3, plays: 2 } } });
  evan.items = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`commas-2-0${i + 1}`, { seen: 1, misses: i < 4 ? 1 : 0, last: now }]));
  evan.days = [today];
  evan.time = { [today]: 12 * 60000 };
  await openApp(page, { players: [evan], current: "p1" });
  await page.locator("#home [data-progress]").click();
  await page.locator("[data-teacher-report]").click();
  await expect(page.locator("#report")).toBeVisible();
  const sheet = page.locator("#report-sheet");
  await expect(sheet).toContainText("Evan · Grade 4");
  await expect(sheet.locator(".rep-stats")).toContainText("12");
  // This week: the comma level passed today counts; the verbs level has no date, so only All time counts it.
  await expect(sheet.locator(".rep-stats div").nth(2)).toContainText("1");
  await page.locator("#report-range").selectOption("all");
  await expect(sheet.locator(".rep-stats div").nth(2)).toContainText("2");
  // Commas: 4 of 8 right on the first try is under 75%, so it needs practice, with a missed sentence.
  await expect(sheet.locator(".rep-list").first()).toContainText("Commas and colons (50% right on the first try)");
  await page.locator("#report-note").fill("Working on commas.");
  await expect(sheet.locator(".rep-note")).toContainText("Working on commas.");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#report .report-controls")).toBeHidden();
  await expect(page.locator("#report-sheet")).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  // Share: no share sheet here, so it copies the text.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  await page.evaluate(() => { delete navigator.share; });
  await page.locator("#report-share").click();
  await expect(page.locator("#report-status")).toContainText("Copied");
  await page.locator("#report-back").click();
  await expect(page.locator("#parent")).toBeVisible();
});

test("Listen and Write: type what Pip reads; capitals and marks count, a misspelling doesn't", async ({ page }) => {
  test.slow(); // plays a whole level: extra time for slower CI machines
  await openApp(page, { players: [player({ grade: 5 })], current: "p1" });
  await startLevel(page, "dictation", 1, "port");
  await expect(page.locator("#item [data-dictate='play']")).toBeVisible();
  const first = await currentItem(page);
  // All small letters: the hint names the first capital.
  await page.locator("#item textarea").fill(first.text.toLowerCase());
  await page.locator("#check-btn").click();
  await expect(page.locator("#feedback")).toContainText("capital");
  // Right capitals and marks with one word misspelled: right, with the spelling shown to practice.
  const words = first.text.split(" ");
  const k = words.findIndex((w) => /^[a-z]{4,}[.,!?]?$/.test(w));
  const typo = k < 0 ? first.text : words.map((w, i) => (i === k ? w.replace(/^([a-z])([a-z])/, "$2$1") : w)).join(" ");
  await page.locator("#item textarea").fill(typo);
  await page.locator("#check-btn").click();
  await expect(page.locator("#feedback.good")).toBeVisible();
  if (k >= 0) await expect(page.locator("#item .dictate-spelling")).toContainText("doesn't count");
  await page.locator("#next-btn").click();
  for (let n = 1; n < 8; n++) {
    await answer(page);
    await page.locator("#next-btn").click();
  }
  await expect(page.locator("#result-title")).toBeVisible();
});

test("Listen and Write: Show the words setting @layout", async ({ page }) => {
  await openApp(page, { players: [player({ grade: 4, settings: { showWords: true } })], current: "p1" });
  await startLevel(page, "dictation", 1, "port");
  const first = await currentItem(page);
  await expect(page.locator("#item .dictate-words")).toContainText(first.text.split(" ")[0].toLowerCase());
});

test("Sentence of the Week: Today with Pip card, the Notice Board, a day's job, and the week's banner @layout", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 18, 10)); // a Wednesday
  await openApp(page, { players: [player({ grade: 4 })], current: "p1" });
  await expect(page.locator("#week-btn")).toContainText("Notice Board");
  await expect(page.locator("#week-btn")).toContainText("Pip needs a tutor");
  await expect(page.locator("#week-btn")).toContainText("Monday: Parts of speech");
  await expect(page.locator(".town .notice-board")).toBeAttached();
  await expect(page.locator(".town .board-alert")).toBeAttached();
  await page.locator("#week-btn").click();
  await expect(page.locator("#week-overlay")).toBeVisible();
  await expect(page.locator("#week-overlay [data-week-day]")).toHaveCount(3); // Monday to Wednesday are open
  await expect(page.locator("#week-overlay")).toContainText("Opens Thursday");
  await page.locator('#week-overlay [data-week-day="0"]').click();
  await expect(page.locator("#play-skill")).toContainText("Sentence of the Week · Monday");
  for (let n = 0; n < 2; n++) {
    await answer(page);
    await page.locator("#next-btn").click();
  }
  await expect(page.locator("#result-title")).toHaveText("Monday done!");
  await expect(page.locator("#result-next")).toHaveText("Next: Tuesday");
  await page.locator("#result-town").click();
  await expect(page.locator("#week-btn .week-dots .done")).toHaveCount(1);
});

test("Sentence of the Week: Friday finishes the week with bonus bricks and a banner", async ({ page }) => {
  const friday = new Date(2026, 10, 20, 10).getTime();
  await page.clock.setFixedTime(friday);
  const week = weekFor(content.weeks, 6, friday);
  const p = player({ grade: 6 });
  p.week = { key: weekKey(friday), id: week.id, done: [0, 1, 2, 3] };
  p.bricks = 0;
  await openApp(page, { players: [p], current: "p1" });
  await expect(page.locator("#week-btn")).toContainText("Friday: Join and write it");
  await page.locator("#week-btn").click();
  await page.locator('#week-overlay [data-week-day="4"]').click();
  await answer(page);
  await page.locator("#next-btn").click();
  await expect(page.locator("#result-title")).toHaveText("Week complete! 🎏");
  await expect(page.locator("#result-bricks")).toContainText("15 for the week");
  await page.locator("#result-town").click();
  await expect(page.locator("#week-btn")).toContainText("Week done!");
  await expect(page.locator(".town .banners path")).toHaveCount(2); // the string and one pennant
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("sentenceBuilders_players"))[0]);
  expect(saved.banners).toHaveLength(1);
  expect(saved.bricks).toBe(17);
});

test("Island Home: the island fills the screen; review first, the Notice Board once a day, build after a lesson @layout", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 17, 10));
  const p = player({ grade: 4, settings: { islandHome: true }, levels: { "commas-1": { best: 7, stars: 2, plays: 1 } } });
  p.items = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`commas-1-0${i + 1}`, { seen: 1, misses: 1, last: 1 }]));
  await openApp(page, { players: [p], current: "p1" });
  await expect(page.locator("body")).toHaveClass(/island-home/);
  // The Notice Board opens by itself the first time today.
  await expect(page.locator("#week-overlay")).toBeVisible();
  await page.locator("#week-overlay [data-close]").click();
  await expect(page.locator("#world-list")).toBeHidden();
  await expect(page.locator("#pip-home")).toContainText("Review first");
  await expect(page.locator(".town")).toContainText("Review Dock");
  // Pip's message tucks away so the map can be tapped, and the Review button stays.
  await page.locator("[data-pip-min]").click();
  await expect(page.locator("#pip-home")).not.toContainText("Review first");
  await expect(page.locator("#pip-home [data-practice='summit']")).toBeVisible();
  await page.locator("[data-pip-expand]").click();
  await expect(page.locator("#pip-home")).toContainText("Review first");
  await expect(page.locator("#island-build")).toHaveClass(/locked/);
  await page.locator("#island-build").click();
  await expect(page.locator("#pip-home")).toContainText("lesson first");
  // Back home again: the board doesn't open twice in a day.
  await page.locator("#settings-btn").click();
  await page.locator("#settings-overlay [data-close]").click();
  await expect(page.locator("#week-overlay")).toBeHidden();
  // Grade 6 and up: the setting isn't offered, and the page stays as it is.
  await page.locator("#settings-btn").click();
  await expect(page.locator("#island-toggle")).toBeVisible();
});

test("Island Home is off by default and not offered from grade 6", async ({ page }) => {
  await openApp(page, { players: [player({ grade: 7, settings: { islandHome: true } })], current: "p1" });
  await expect(page.locator("body")).not.toHaveClass(/island-home/);
  await page.locator("#settings-btn").click();
  await expect(page.locator("#island-toggle")).toBeHidden();
});
