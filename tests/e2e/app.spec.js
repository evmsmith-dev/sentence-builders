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
  await expect(page.locator('[data-world="works"]')).toBeEnabled();
  await expect(page.locator('[data-world="studio"]')).toBeDisabled();
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
  await expect(page.locator(".town")).toHaveAttribute("aria-label", /1 of 18 buildings/);
  await expect(page.locator("#pip-home")).toContainText("Next up: Commas and colons, level 2");

  // Saved on the device: still there after a reload.
  await page.reload();
  await expect(page.locator(".town")).toHaveAttribute("aria-label", /1 of 18 buildings/);
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
  await expect(page.locator(".town")).toHaveAttribute("aria-label", /3 of 18 buildings/);
});

test("Sort it: a wrong sort gives a hint, then the answer", async ({ page }) => {
  await openApp(page, { players: [player()], current: "p1" });
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

test("grown-up view: adult check, progress, break reminder, backup and restore", async ({ page }) => {
  const ava = player({ levels: { "commas-1": { best: 7, stars: 2, plays: 1 } } });
  ava.items = { "commas-1-01": { seen: 2, misses: 2, last: 5 } };
  ava.days = ["2026-11-14"];
  await openApp(page, { players: [ava, player({ id: "p2", name: "Max", avatar: "🐯", grade: 7 })], current: "p1" });
  await page.locator("#settings-btn").click();
  await page.locator("#settings-overlay [data-grownup]").click();
  await expect(page.locator("#adult-overlay")).toBeVisible();
  await page.locator("#adult-answer").fill("1");
  await page.locator('#adult-form button[type="submit"]').click();
  await expect(page.locator("#adult-wrong")).toBeVisible();
  const number = await page.evaluate(() => {
    const words = document.getElementById("adult-question").textContent.replace("Type the number ", "").replace(":", "");
    const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
    const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
    const [h, , ...rest] = words.split(" ");
    let n = ones.indexOf(h) * 100;
    const r = rest.join(" ");
    if (r) {
      const [t, o] = r.split("-");
      n += ones.includes(t) && ones.indexOf(t) > 0 ? ones.indexOf(t) : tens.indexOf(t) * 10 + (o ? ones.indexOf(o) : 0);
    }
    return n;
  });
  await page.locator("#adult-answer").fill(String(number));
  await page.locator('#adult-form button[type="submit"]').click();
  await expect(page.locator("#parent")).toBeVisible();
  const avaCard = page.locator('[data-parent-player="p1"]');
  await expect(avaCard).toContainText("Ava");
  await expect(avaCard.locator(".missed-list")).toContainText("We packed apples, grapes, and crackers.");
  await expect(page.locator('[data-parent-player="p2"]')).toContainText("Max");

  await avaCard.locator("[data-break]").selectOption("20");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("sentenceBuilders_players")));
  expect(saved.find((p) => p.id === "p1").settings.breakMinutes).toBe(20);

  const download = page.waitForEvent("download");
  await page.locator("#backup-save").click();
  const file = await (await download).path();
  const backup = JSON.parse((await import("node:fs")).readFileSync(file, "utf8"));
  expect(backup.app).toBe("sentence-builders");
  expect(backup.players).toHaveLength(2);

  // Restore just Ava from an edited backup.
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#backup-file").setInputFiles({ name: "b.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ ...backup, players: [backup.players[0]] })) });
  await expect(page.locator("#backup-status")).toContainText("Restored Ava");
  await expect(page.locator('[data-parent-player="p2"]')).toHaveCount(0);
  await page.locator("#backup-file").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from("{}") });
  await expect(page.locator("#backup-status")).toContainText("isn't a Sentence Builders backup");
});
