import { expect, test } from "@playwright/test";
import { answer, currentItem, miss, openApp, player, startLevel } from "./helpers.js";

test("first visit: make a player and land in the town", async ({ page }) => {
  await openApp(page);
  await expect(page.locator("#add-player")).toBeVisible();
  await page.locator("#player-name").fill("Ava");
  await page.locator('[data-avatar="🐼"]').click();
  await page.locator("#player-grade").selectOption("4");
  await page.locator('#player-form button[type="submit"]').click();
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#who-btn")).toContainText("Ava");
  await expect(page.locator("#pip-home")).toContainText("Next up: Commas and colons, level 1");
  await expect(page.locator(".town")).toBeVisible();
  await expect(page.locator('[data-world="works"]')).toBeDisabled();
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
  await expect(page.locator(".town")).toHaveAttribute("aria-label", /1 of 9 buildings/);
  await expect(page.locator("#pip-home")).toContainText("Next up: Commas and colons, level 2");

  // Saved on the device: still there after a reload.
  await page.reload();
  await expect(page.locator(".town")).toHaveAttribute("aria-label", /1 of 9 buildings/);
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

test("no sideways scrolling on any screen", async ({ page }) => {
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
