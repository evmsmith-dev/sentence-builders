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
  await expect(page.locator(".town")).toHaveAttribute("aria-label", /1 of 30 buildings/);
  await expect(page.locator("#pip-home")).toContainText("Next up: Commas and colons, level 2");

  // Saved on the device: still there after a reload.
  await page.reload();
  await expect(page.locator(".town")).toHaveAttribute("aria-label", /1 of 30 buildings/);
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
  await expect(page.locator(".town")).toHaveAttribute("aria-label", /3 of 30 buildings/);
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

test("Sentence Studio: every level of all three skills, with Sentence check and Join it", async ({ page }) => {
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
  await expect(page.locator(".town")).toHaveAttribute("aria-label", /9 of 39 buildings/);
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
  await expect(page.locator(".town")).toHaveAttribute("aria-label", /3 of 39 buildings/);
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

test("Editing Desk: closed below grade 6, open for a 7th grader with grades 6-7 unlocked", async ({ page }) => {
  await openApp(page, { players: [player({ grade: 4 }), player({ id: "p2", name: "Max", avatar: "🐯", grade: 7 })], current: "p1" });
  await expect(page.locator('[data-world="desk"]')).toBeDisabled();
  await expect(page.locator('[data-world="desk"]')).toContainText("Grade 6+");
  await expect(page.locator(".town")).toHaveAttribute("aria-label", /of 30 buildings/);
  await page.locator("#who-btn").click();
  await page.locator('[data-player="p2"]').click();
  await expect(page.locator(".town")).toHaveAttribute("aria-label", /of 39 buildings/);
  await page.locator('[data-world="desk"]').click();
  await expect(page.locator('.level-btn[data-skill="case"][data-level="2"]')).toBeEnabled();
  await expect(page.locator('.level-btn[data-skill="case"][data-level="3"]')).toBeDisabled();
  await expect(page.locator("#skill-list .coming-soon")).toContainText("Coming next");
});

test("Editing Desk: play Pronoun case and Proofreading levels", async ({ page }) => {
  await openApp(page, { players: [player({ grade: 8 })], current: "p1" });
  for (const [skill, level, count] of [["case", 1, 8], ["case", 3, 8], ["proofread", 1, 5], ["proofread", 3, 5]]) {
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

test("Rule Book: unlocked rules with examples, locked ones by title, Flow Factory label glossary", async ({ page }) => {
  await openApp(page, { players: [player({ grade: 4 })], current: "p1" });
  await page.locator("#rules-btn").click();
  await expect(page.locator("#rules")).toBeVisible();
  await expect(page.locator("#rules-list")).toContainText("Commas in a list");
  await expect(page.locator("#rules-list")).toContainText("We saw ducks, geese, and swans.");
  const locked = page.locator(".rule-card.locked").filter({ hasText: "Commas and colons" });
  await expect(page.locator(".rule-card.locked h4").first()).toContainText("🔒");
  await expect(page.locator("#rules-list")).not.toContainText("Use a colon before a list"); // grade 5 rule stays hidden
  await expect(page.locator("#rules-desk")).toHaveCount(0); // no Editing Desk for a 4th grader
  await page.locator('#rules-flow .glossary summary').first().click();
  await expect(page.locator("#rules-flow .glossary dl").first()).toContainText("subject noun");
  await page.locator("#rules-back").click();
  await expect(page.locator("#home")).toBeVisible();

  // From a world: opens at that world, back returns to the world.
  await page.locator('[data-world="studio"]').click();
  await page.locator("#world-rules").click();
  await expect(page.locator("#rules-studio")).toBeInViewport();
  await page.locator("#rules-back").click();
  await expect(page.locator("#world")).toBeVisible();
  await expect(page.locator("#world-title")).toContainText("Sentence Studio");
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
