// Startup and screens: players, the town, worlds, levels, results, badges and settings.
import {
  AVATARS, HABIT_BADGES, ITEMS_PER_LEVEL, MAX_GRADE, MAX_PLAYERS, MIN_GRADE, PIP, SKILLS, TIER_NAMES, WORLDS, WORLD_BADGES,
  GOLD_DAYS, LABELS, LABEL_LISTS, PATTERNS, FLOW_LABELS, FLOW_PATTERNS, WORD_LISTS, skillById, skillOpenFor, skillsInWorld, skillsInWorldFor, worldOpenFor,
} from "./config.js";
import { answerText, spokenText } from "./lib/parse.js";
import { numberWords } from "./lib/words.js";
import { pickLevelItems } from "./lib/select.js";
import {
  currentBadges, habitValue, isPassed, isUnlocked, levelStars, localDate, mostMissed, newPlayer, normalizePlayer,
  passedKeys, recordLevel, skillTier, weekSummary,
} from "./lib/progress.js";
import { loadCurrentId, loadPlayers, saveCurrentId, savePlayers } from "./storage.js";
import { pipSays, townSvg } from "./ui/art.js";
import { $, closeOverlay, esc, initBackButton, openOverlay, pick, showScreen, topOverlay } from "./ui/dom.js";
import { renderItem } from "./ui/items.js";
import { buzz, canSay, celebrate, say, sound, stopSaying } from "./ui/feel.js";
import { registerServiceWorker } from "./ui/update.js";

const state = {
  content: { tips: {}, items: [] },
  players: [],
  player: null,
  newAvatar: AVATARS[0],
  play: null, // the level being played
  sessionStart: null, // when this stretch of play began, for the break reminder
};

const settings = () => state.player?.settings || { sound: true, pip: true, autoRead: false };
const points = (n) => (Number.isInteger(n) ? String(n) : `${Math.floor(n)}½`);
const gradeLabel = (grade) => `Grade ${grade}`;

function savePlayer(player) {
  state.player = player;
  state.players = state.players.map((p) => (p.id === player.id ? player : p));
  savePlayers(state.players);
}

/* ==================== Players ==================== */

function renderPlayers() {
  const cards = state.players.map((p) => `<button type="button" class="player-card" data-player="${esc(p.id)}">
      <span class="avatar" aria-hidden="true">${p.avatar}</span><span class="player-name">${esc(p.name)}</span>
      <span class="player-grade">${gradeLabel(p.grade)}</span></button>`).join("");
  const add = state.players.length < MAX_PLAYERS
    ? '<button type="button" class="player-card add" data-add-player><span class="avatar" aria-hidden="true">＋</span><span class="player-name">Add a player</span></button>' : "";
  $("player-list").innerHTML = cards + add;
  showScreen("players");
}

function openAddPlayer() {
  $("player-form").reset();
  const taken = new Set(state.players.map((p) => p.avatar));
  state.newAvatar = AVATARS.find((a) => !taken.has(a)) || AVATARS[0];
  drawAvatars();
  $("player-grade").value = "4";
  document.querySelector('#add-player .back').hidden = state.players.length === 0;
  showScreen("add-player");
  $("player-name").focus();
}

function drawAvatars() {
  $("avatar-grid").innerHTML = AVATARS.map((a) => `<button type="button" class="avatar-btn${a === state.newAvatar ? " selected" : ""}" data-avatar="${a}" aria-pressed="${a === state.newAvatar}" aria-label="Avatar ${a}">${a}</button>`).join("");
}

function choosePlayer(id) {
  state.player = state.players.find((p) => p.id === id) || null;
  saveCurrentId(state.player?.id || null);
  if (state.player) renderHome();
  else renderPlayers();
}

/* ==================== Home ==================== */

/** Skills this player can play: in an open world and not waiting for a higher grade. */
const visibleSkills = (player) => SKILLS.filter((sk) => worldOpenFor(WORLDS.find((w) => w.id === sk.world), player) && skillOpenFor(sk, player));

function nextUp(player) {
  for (const skill of visibleSkills(player)) {
    for (const level of [1, 2, 3]) {
      if (isUnlocked(player, skill.id, level) && !isPassed(player, skill.id, level)) return { skill, level };
    }
  }
  return null;
}

function renderHome() {
  const player = state.player;
  $("who-btn").innerHTML = `<span class="avatar" aria-hidden="true">${player.avatar}</span> ${esc(player.name)}`;
  const next = nextUp(player);
  const greeting = next
    ? `Hi ${player.name}! Next up: ${next.skill.name}, level ${next.level}.`
    : `Every building is up, ${player.name}. Go for Gold: score 7 or more on a level 3, on two different days.`;
  $("pip-home").innerHTML = pipSays(greeting, settings().pip);
  $("town").innerHTML = townSvg(player);
  const earned = Object.entries(currentBadges(player)).filter(([id, tier]) => tier && visibleBadgeIds(player).has(id)).length;
  const shown = visibleBadgeIds(player);
  const total = shown.size;
  $("badges-btn").textContent = `🏅 Badges ${earned}/${total}`;
  $("world-list").innerHTML = WORLDS.map((world) => {
    const skills = skillsInWorldFor(world.id, player);
    const built = skills.reduce((n, s) => n + [1, 2, 3].filter((l) => isPassed(player, s.id, l)).length, 0);
    const open = worldOpenFor(world, player);
    const meta = open ? `${built}/${skills.length * 3} built` : world.ready ? `Grade ${world.minGrade}+` : "Coming soon";
    return `<button type="button" class="world-card${open ? "" : " soon"}" data-world="${world.id}" ${open ? "" : "disabled"}>
      <span class="world-emoji" aria-hidden="true">${world.emoji}</span>
      <span class="world-text"><span class="world-name">${esc(world.name)}</span><span class="world-blurb">${esc(world.blurb)}</span></span>
      <span class="world-meta">${meta}</span></button>`;
  }).join("");
  showScreen("home");
}

/* ==================== World ==================== */

function renderWorld(worldId) {
  state.worldId = worldId;
  const world = WORLDS.find((w) => w.id === worldId);
  const player = state.player;
  $("world-title").textContent = `${world.emoji} ${world.name}`;
  $("skill-list").innerHTML = skillsInWorldFor(worldId, player).map((skill) => {
    const tier = skillTier(player, skill.id);
    const goldDays = (player.goldDays[skill.id] || []).length;
    const levels = [1, 2, 3].map((level) => {
      const open = isUnlocked(player, skill.id, level);
      const stars = levelStars(player, skill.id, level);
      const starText = [1, 2, 3].map((n) => `<span class="${n <= stars ? "on" : ""}">★</span>`).join("");
      return `<button type="button" class="level-btn" data-skill="${skill.id}" data-level="${level}" ${open ? "" : "disabled"}
          aria-label="${esc(skill.name)} level ${level}, grade ${skill.grades[level - 1]}${open ? `, ${stars} stars` : ", locked"}">
        <span class="level-num">Level ${level}</span><span class="level-grade">Grade ${skill.grades[level - 1]}</span>
        <span class="level-stars" aria-hidden="true">${open ? starText : "🔒"}</span></button>`;
    }).join("");
    const gold = tier === 3 ? "Gold! Lighthouse built." : isPassed(player, skill.id, 3) ? `Gold: 7+ on level 3 on ${GOLD_DAYS} days (${goldDays}/${GOLD_DAYS})` : "";
    return `<section class="skill-card" style="--skill:${skill.color}">
      <div class="skill-head"><h2>${esc(skill.name)}</h2>
        <span class="tier${tier ? "" : " none"}">${skill.badge.emoji} ${tier ? TIER_NAMES[tier - 1] : "No badge yet"}</span></div>
      <p class="skill-sub">${esc(skill.benchmarks)}</p>
      <div class="levels">${levels}</div>
      ${gold ? `<p class="gold-note">${esc(gold)}</p>` : ""}
    </section>`;
  }).join("") + (world.comingSoon ? `<p class="note coming-soon">${esc(world.comingSoon)}</p>` : "");
  showScreen("world");
}

/* ==================== Tip Card ==================== */

/** The Tip Card before a level, or (review) to look at the rule again from the results. */
function openTip(skillId, level, { review = false } = {}) {
  const skill = skillById(skillId);
  const tip = state.content.tips[`${skillId}-${level}`];
  state.tip = { skillId, level, tip, review };
  $("tip-start").textContent = review ? "Back to my results" : "Let's build";
  $("tip-close").hidden = review;
  $("tip-level").textContent = `${skill.name} · Level ${level} · Grade ${skill.grades[level - 1]}`;
  $("tip-title").textContent = tip.title;
  $("tip-rule").textContent = tip.rule;
  $("tip-example").textContent = tip.example;
  $("tip-say").hidden = !canSay();
  openOverlay("tip-overlay");
  if (settings().autoRead) say(`${tip.title}. ${tip.rule} For example: ${tip.example}`);
}

/* ==================== Playing a level ==================== */

function startLevel(skillId, level) {
  closeOverlay("tip-overlay");
  const items = pickLevelItems({
    items: state.content.items, skill: skillId, level, stats: state.player.items, passedKeys: passedKeys(state.player),
    plan: skillById(skillId).levelPlan || null,
  });
  state.play = { skillId, level, items, index: 0, tries: 0, results: [], ctrl: null, done: false, startedAt: Date.now() };
  if (!state.sessionStart) state.sessionStart = Date.now();
  showScreen("play");
  showItem();
}

function showItem() {
  const play = state.play;
  const item = play.items[play.index];
  const skill = skillById(item.skill);
  play.tries = 1;
  play.done = false;
  $("progress-fill").style.width = `${(play.index / play.items.length) * 100}%`;
  $("progress-text").textContent = `${play.index + 1} of ${play.items.length}`;
  $("play-skill").textContent = item.review ? `Review: ${skill.name}` : `${skill.name} · Level ${item.level}`;
  $("play-skill").classList.toggle("review", Boolean(item.review));
  $("feedback").innerHTML = "";
  $("feedback").className = "feedback";
  $("next-btn").hidden = true;
  $("item").dataset.itemId = item.id;
  play.ctrl = renderItem($("item"), item, {
    answer: (right) => handleAnswer(right),
    hint: (text) => showStepHint(text),
    showLabels: (labels, patterns) => openLabelHelp(labels, patterns),
    complete: (result) => completeItem(result),
    onChange: updateCheck,
    onTap: () => sound("tap", settings().sound),
  });
  $("prompt").textContent = play.ctrl.prompt;
  $("check-btn").hidden = !play.ctrl.usesCheck;
  $("say-btn").hidden = !canSay();
  updateCheck();
  if (settings().autoRead) readItem();
}

function readItem() {
  const play = state.play;
  if (!play) return;
  const item = play.items[play.index];
  const sentence = spokenText(item);
  const choices = play.ctrl.choicesText && !sentence ? play.ctrl.choicesText.join(". Or: ") : "";
  say([play.ctrl.prompt, sentence, choices].filter(Boolean).join(" "));
}

function updateCheck() {
  const ctrl = state.play?.ctrl;
  if (!ctrl) return;
  // Some items change as they go (pick a word, then place a comma), so the prompt and Check button follow along.
  $("prompt").textContent = ctrl.prompt;
  $("check-btn").hidden = !ctrl.usesCheck || state.play.done;
  if (ctrl.usesCheck) $("check-btn").disabled = state.play.done || !ctrl.canCheck();
}

function handleAnswer(right) {
  const play = state.play;
  if (!play || play.done) return;
  const item = play.items[play.index];
  const s = settings();
  if (right) {
    play.results.push({ id: item.id, type: item.type, tries: play.tries, correct: true });
    finishItem();
    (play.ctrl.showRight || play.ctrl.lock)();
    sound("right", s.sound);
    buzz(10);
    const line = play.tries === 1 ? pick(PIP.right) : pick(PIP.secondTry);
    $("feedback").className = "feedback good";
    $("feedback").innerHTML = `<p><strong>✓ ${esc(line)}</strong></p>`;
  } else if (play.tries === 1) {
    play.tries = 2;
    sound("wrong", s.sound);
    play.ctrl.retry();
    $("feedback").className = "feedback hint";
    $("feedback").innerHTML = `<p><strong>${esc(PIP.hint)}</strong> ${esc(item.hint)}</p><p class="try-again">Try again.</p>`;
    updateCheck();
  } else {
    play.results.push({ id: item.id, type: item.type, tries: 2, correct: false });
    finishItem();
    play.ctrl.reveal();
    $("feedback").className = "feedback shown";
    $("feedback").innerHTML = `<p><strong>${esc(PIP.shown)}</strong></p><p class="answer-line">${esc(answerText(item))}</p><p class="hint-line">${esc(item.hint)}</p>`;
  }
}

function labelListHtml(label) {
  const list = WORD_LISTS.find((w) => w.id === LABEL_LISTS[label]);
  if (!list) return "";
  return list.words.length > 12
    ? `<details class="label-words"><summary>See all ${list.words.length} ${esc(list.title.replace(/^Common |\s*\(.*\)$/g, "").toLowerCase())}</summary>${wordChips(list.words)}</details>`
    : wordChips(list.words);
}

/** Mid-round reminder: the level's labels with what each means and how to find it. Costs nothing. */
function openLabelHelp(labels, patterns = []) {
  $("labels-list").innerHTML = labels.map((l) => `<div class="label-entry"><dt>${esc(l)}</dt>
    <dd><strong>${esc(LABELS[l].name)}</strong><span>${esc(LABELS[l].hint)}</span><span class="label-find">${esc(LABELS[l].find)}</span>${labelListHtml(l)}</dd></div>`).join("");
  $("labels-patterns").innerHTML = patterns.length > 1
    ? `<h3 class="review-title">Patterns</h3><ul class="pattern-list">${patterns.map((n) => `<li>${esc(PATTERNS[n])}</li>`).join("")}</ul>` : "";
  openOverlay("labels-overlay");
  $("labels-overlay").querySelector(".sheet").scrollTop = 0;
}

/** A hint for one step of a many-step item (Q&A Flow); null clears it. */
function showStepHint(text) {
  if (!text) {
    $("feedback").innerHTML = "";
    $("feedback").className = "feedback";
    return;
  }
  sound("wrong", settings().sound);
  $("feedback").className = "feedback hint";
  $("feedback").innerHTML = `<p>${esc(text)}</p>`;
}

/** A many-step item reports its own result when it's finished. */
function completeItem({ tries, correct }) {
  const play = state.play;
  if (!play || play.done) return;
  const item = play.items[play.index];
  play.results.push({ id: item.id, type: item.type, tries, correct });
  finishItem();
  play.ctrl.lock();
  const s = settings();
  if (correct) {
    sound("right", s.sound);
    buzz(10);
    $("feedback").className = "feedback good";
    $("feedback").innerHTML = `<p><strong>✓ ${esc(tries === 1 ? pick(PIP.right) : "Done! A hint helped on the way.")}</strong></p>`;
  } else {
    $("feedback").className = "feedback shown";
    $("feedback").innerHTML = `<p><strong>Done. Some answers were shown, so this one will come back later.</strong></p><p class="answer-line">${esc(answerText(item))}</p>`;
  }
}

function finishItem() {
  state.play.done = true;
  $("check-btn").hidden = true;
  $("next-btn").hidden = false;
  $("next-btn").textContent = state.play.index + 1 < state.play.items.length ? "Next" : "See my building";
  $("next-btn").focus({ preventScroll: true });
}

function nextItem() {
  const play = state.play;
  stopSaying();
  if (play.index + 1 < play.items.length) {
    play.index += 1;
    showItem();
  } else {
    finishLevel();
  }
}

function finishLevel() {
  const play = state.play;
  const now = Date.now();
  const out = recordLevel(state.player, { skill: play.skillId, level: play.level, results: play.results, now, durationMs: now - play.startedAt });
  savePlayer(out.player);
  const s = settings();
  const skill = skillById(play.skillId);
  $("progress-fill").style.width = "100%";
  $("result-stars").innerHTML = [1, 2, 3].map((n) => `<span class="${n <= out.stars ? "on" : ""}">★</span>`).join("");
  $("result-title").textContent = ["Almost there", "Built it!", "Great build!", "Perfect build!"][out.stars];
  $("result-score").textContent = `${points(out.points)} of ${play.results.length} points · ${skill.name} level ${play.level}`;
  let pipLine = out.passed ? pick(PIP.passed) : PIP.notYet;
  if (out.passed && play.level === 3 && skillTier(out.player, skill.id) < 3) {
    const goldAt = (7 / 8) * play.results.length;
    pipLine += out.points >= goldAt && out.goldProgress ? ` Gold progress: ${out.goldProgress} of ${GOLD_DAYS} days.`
      : ` Score ${points(Math.ceil(goldAt * 2) / 2)} or more here on two days for Gold${skill.goldNeedsAllRight ? ", with the label sentences right" : ""}.`;
  }
  const breakMinutes = out.player.settings.breakMinutes;
  if (breakMinutes && now - state.sessionStart >= breakMinutes * 60000) {
    pipLine += ` You've been building for ${Math.round((now - state.sessionStart) / 60000)} minutes. Time for a stretch break!`;
    state.sessionStart = null;
  }
  $("result-pip").innerHTML = pipSays(pipLine, true);
  $("result-badges").innerHTML = out.newBadges.map(({ id, tier }) => {
    const badge = SKILLS.find((sk) => sk.badge.id === id)?.badge || [...WORLD_BADGES, ...HABIT_BADGES].find((b) => b.id === id);
    const tierName = SKILLS.some((sk) => sk.badge.id === id) ? ` · ${TIER_NAMES[tier - 1]}` : "";
    return `<p class="new-badge"><span aria-hidden="true">${badge.emoji}</span> New badge: <strong>${esc(badge.name)}</strong>${tierName}</p>`;
  }).join("");
  state.lastPlayed = { skillId: play.skillId, level: play.level };
  $("result-review").innerHTML = reviewHtml(play);
  const nextLevel = out.passed && play.level < 3 ? play.level + 1 : null;
  state.resultNext = out.passed ? (nextLevel ? { skillId: play.skillId, level: nextLevel } : { world: skill.world }) : { skillId: play.skillId, level: play.level };
  $("result-next").textContent = !out.passed ? "Try again" : nextLevel ? `Next: level ${nextLevel}` : `Back to ${WORLDS.find((w) => w.id === skill.world).name}`;
  $("result-again").hidden = !out.passed;
  openOverlay("result-overlay");
  if (out.passed) {
    sound("done", s.sound);
    celebrate();
  }
  state.play = null;
}

/* ==================== Looking back: mistakes and the Rule Book ==================== */

/** The round's missed items, written correctly with their rule. */
function reviewHtml(play) {
  const rows = play.results.filter((r) => !r.correct || r.tries > 1).map((r) => {
    const item = play.items.find((i) => i.id === r.id);
    const status = r.correct ? "Fixed on the second try" : "Answer shown";
    return `<li class="review-row ${r.correct ? "second" : "missed"}"><span class="review-status">${status}</span>
      <span class="review-answer">${esc(answerText(item))}</span><span class="review-rule">${esc(item.hint)}</span></li>`;
  });
  if (!rows.length) return '<p class="review-none">No mistakes this round. ✓</p>';
  return `<h3 class="review-title">Look again (${rows.length})</h3><ol class="review-list">${rows.join("")}</ol>`;
}

function labelGlossary(skill, level) {
  const labels = (FLOW_LABELS[skill.id] || [])[level - 1];
  if (!labels) return "";
  const patterns = (FLOW_PATTERNS[skill.id] || [])[level - 1] || [];
  return `<details class="glossary"><summary>Labels${patterns.length > 1 ? " and patterns" : ""} for this level</summary>
    <dl>${labels.map((l) => `<dt>${esc(l)}</dt><dd><strong>${esc(LABELS[l].name)}</strong>: ${esc(LABELS[l].hint)}</dd>`).join("")}</dl>
    ${patterns.length > 1 ? `<ul class="pattern-list">${patterns.map((n) => `<li>${esc(PATTERNS[n])}</li>`).join("")}</ul>` : ""}</details>`;
}

const wordChips = (words) => `<ul class="word-chips">${words.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>`;

function wordListsHtml() {
  return `<p class="note rules-intro">Words to know when you look for each word's job. Tap a list to open it.</p>
    <div class="rules-grid">${WORD_LISTS.map((list) => `<details class="rule-skill word-list" id="list-${list.id}">
      <summary><span class="skill-name">${esc(list.title)}</span><span class="skill-count">${list.words.length} words</span></summary>
      <p class="note">${esc(list.note)}</p>${wordChips(list.words)}</details>`).join("")}</div>`;
}

/**
 * The Rule Book: one tab per open world plus Word lists, pinned at the top and wrapping (no sideways
 * scrolling). A tab shows one world; each skill folds to a one-line header until it's tapped.
 * Unlocked rules show their rule, example and read-aloud; locked ones show only their title.
 */
function renderRules(focusWorld, back) {
  const player = state.player;
  if (back) state.rulesBack = back;
  const worlds = WORLDS.filter((w) => worldOpenFor(w, player));
  const tabs = [...worlds.map((w) => ({ id: w.id, label: w.tab || w.name, emoji: w.emoji })), { id: "lists", label: "Word lists", emoji: "🔤" }];
  const tab = tabs.some((t) => t.id === focusWorld) ? focusWorld : tabs.some((t) => t.id === state.rulesTab) ? state.rulesTab : tabs[0].id;
  state.rulesTab = tab;
  $("rules-tabs").innerHTML = tabs.map((t) => `<button type="button" class="rules-tab${t.id === tab ? " active" : ""}" role="tab"
    aria-selected="${t.id === tab}" data-rules-tab="${t.id}"><span class="tab-emoji" aria-hidden="true">${t.emoji}</span><span>${esc(t.label)}</span></button>`).join("");
  if (tab === "lists") {
    $("rules-list").innerHTML = wordListsHtml();
  } else {
    const world = worlds.find((w) => w.id === tab);
    const skills = skillsInWorldFor(world.id, player);
    $("rules-list").innerHTML = `<section class="rule-world" id="rules-${world.id}">
      <p class="note rules-intro">Tap a skill to see its rules. Tap 🔊 to hear one.</p>
      <div class="rules-grid">${skills.map((skill) => {
        const open = [1, 2, 3].filter((level) => isUnlocked(player, skill.id, level)).length;
        const cards = [1, 2, 3].map((level) => {
          const key = `${skill.id}-${level}`;
          const tip = state.content.tips[key];
          const grade = `Level ${level} · Grade ${skill.grades[level - 1]}`;
          if (!isUnlocked(player, skill.id, level)) {
            return `<div class="rule-card locked"><p class="eyebrow">${grade}</p><h4>🔒 ${esc(tip.title)}</h4><p class="note">Unlocks when you pass level ${level - 1}.</p></div>`;
          }
          return `<div class="rule-card"><div class="rule-head"><div><p class="eyebrow">${grade}</p><h4>${esc(tip.title)}</h4></div>
              ${canSay() ? `<button type="button" class="say-btn small" data-say-rule="${key}" aria-label="Read ${esc(tip.title)} aloud">🔊</button>` : ""}</div>
            <p class="tip-rule">${esc(tip.rule)}</p><p class="tip-example">${esc(tip.example)}</p>${labelGlossary(skill, level)}</div>`;
        }).join("");
        return `<details class="rule-skill" style="--skill:${skill.color}" data-rule-skill="${skill.id}">
          <summary><span class="skill-name">${esc(skill.name)}</span><span class="skill-count">${open} of 3 open</span></summary>${cards}</details>`;
      }).join("")}</div></section>`;
  }
  showScreen("rules");
}

/* ==================== Badges ==================== */

/** Badge ids this player can work toward (no Editing Desk badges for a 4th grader). */
function visibleBadgeIds(player) {
  return new Set([
    ...visibleSkills(player).map((sk) => sk.badge.id),
    ...WORLD_BADGES.filter((b) => worldOpenFor(WORLDS.find((w) => w.id === b.world), player)).map((b) => b.id),
    ...HABIT_BADGES.map((b) => b.id),
  ]);
}

function renderBadges() {
  const player = state.player;
  const earned = currentBadges(player);
  const skillRows = visibleSkills(player).map((skill) => {
    const tier = earned[skill.badge.id];
    return `<li class="badge${tier ? " earned" : ""}"><span class="badge-emoji" aria-hidden="true">${skill.badge.emoji}</span>
      <span><strong>${esc(skill.badge.name)}</strong> ${tier ? `<span class="tier-tag t${tier}">${TIER_NAMES[tier - 1]}</span>` : ""}
      <span class="badge-how">${esc(skill.name)}: Bronze = pass level 1, Silver = pass level 2, Gold = 7+ on level 3 on two days.</span></span></li>`;
  }).join("");
  const other = [...WORLD_BADGES.filter((b) => worldOpenFor(WORLDS.find((w) => w.id === b.world), player)), ...HABIT_BADGES].map((badge) => {
    const got = earned[badge.id];
    const progress = badge.measure ? ` (${Math.min(habitValue(player, badge.measure), badge.goal)}/${badge.goal})` : "";
    return `<li class="badge${got ? " earned" : ""}"><span class="badge-emoji" aria-hidden="true">${badge.emoji}</span>
      <span><strong>${esc(badge.name)}</strong><span class="badge-how">${esc(badge.how)}${got ? "" : progress}</span></span></li>`;
  }).join("");
  $("badge-list").innerHTML = `<h2 class="section-title">Skills</h2><ul>${skillRows}</ul><h2 class="section-title">More badges</h2><ul>${other}</ul>`;
  showScreen("badges");
}

/* ==================== Grown-up view ==================== */

function openAdultCheck() {
  const number = 200 + Math.floor(Math.random() * 700);
  state.adultNumber = number;
  $("adult-question").textContent = `Type the number ${numberWords(number)}:`;
  $("adult-answer").value = "";
  $("adult-wrong").hidden = true;
  closeOverlay("settings-overlay");
  openOverlay("adult-overlay");
  $("adult-answer").focus();
}

const BREAK_CHOICES = [0, 15, 20, 30, 45];

function renderParent() {
  const now = Date.now();
  const itemById = (id) => state.content.items.find((item) => item.id === id);
  $("parent-players").innerHTML = state.players.length ? state.players.map((p) => {
    const week = weekSummary(p, now);
    const badges = Object.values(currentBadges(p)).filter(Boolean).length;
    const last = p.days.length ? [...p.days].sort().at(-1) : null;
    const worlds = WORLDS.filter((w) => worldOpenFor(w, p)).map((world) => {
      const rows = skillsInWorldFor(world.id, p).map((skill) => {
        const tier = skillTier(p, skill.id);
        const cells = [1, 2, 3].map((level) => {
          const stars = levelStars(p, skill.id, level);
          const open = isUnlocked(p, skill.id, level);
          return `<td>${stars ? `<span class="stars-mini" aria-label="${stars} stars">${"★".repeat(stars)}</span>` : open ? '<span class="muted">open</span>' : '<span class="muted" aria-label="locked">🔒</span>'}</td>`;
        }).join("");
        return `<tr><th scope="row">${esc(skill.name)}</th>${cells}<td>${tier ? TIER_NAMES[tier - 1] : "—"}</td></tr>`;
      }).join("");
      return `<h4>${world.emoji} ${esc(world.name)}</h4><table class="progress-table"><thead><tr><th scope="col">Skill</th><th scope="col">Level 1</th><th scope="col">Level 2</th><th scope="col">Level 3</th><th scope="col">Badge</th></tr></thead><tbody>${rows}</tbody></table>`;
    }).join("");
    const missed = mostMissed(p).map(({ id, misses }) => {
      const item = itemById(id);
      if (!item) return "";
      return `<li><span class="missed-skill">${esc(skillById(item.skill)?.name || item.skill)}, level ${item.level} · missed ${misses}×</span>${esc(answerText(item))}</li>`;
    }).join("");
    const choices = BREAK_CHOICES.map((m) => `<option value="${m}" ${p.settings.breakMinutes === m ? "selected" : ""}>${m ? `After ${m} minutes` : "Off"}</option>`).join("");
    return `<section class="card parent-card" data-parent-player="${esc(p.id)}">
      <h3><span aria-hidden="true">${p.avatar}</span> ${esc(p.name)} <span class="muted">· Grade ${p.grade}</span></h3>
      <div class="parent-stats">
        <div><strong>${week.minutes}</strong><span>minutes this week</span></div>
        <div><strong>${week.daysPlayed}</strong><span>days played this week</span></div>
        <div><strong>${passedKeys(p).length}</strong><span>levels passed</span></div>
        <div><strong>${badges}</strong><span>badges</span></div>
      </div>
      <p class="note">${last ? `Last played ${last === localDate(now) ? "today" : last}.` : "Hasn't played yet."}</p>
      ${worlds}
      <h4>Sentences missed most</h4>
      ${missed ? `<ol class="missed-list">${missed}</ol>` : '<p class="note">None yet.</p>'}
      <label class="break-row">Break reminder <select data-break="${esc(p.id)}">${choices}</select></label>
    </section>`;
  }).join("") : '<p class="note">No players yet.</p>';
  $("backup-status").textContent = "";
  showScreen("parent");
}

function saveBackup() {
  const data = JSON.stringify({ app: "sentence-builders", version: 1, saved: new Date().toISOString(), players: state.players }, null, 1);
  const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `sentence-builders-backup-${localDate(Date.now())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $("backup-status").textContent = "Backup file saved to your downloads.";
}

async function restoreBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    const ok = data?.app === "sentence-builders" && Array.isArray(data.players)
      && data.players.every((p) => p && typeof p.id === "string" && typeof p.name === "string" && p.levels && typeof p.levels === "object");
    if (!ok) throw new Error("not a backup");
    const names = data.players.map((p) => p.name).join(", ");
    if (!window.confirm(`Replace the players on this device with the backup (${names})?`)) return;
    state.players = data.players.slice(0, MAX_PLAYERS).map(normalizePlayer);
    savePlayers(state.players);
    state.player = state.players.find((p) => p.id === state.player?.id) || null;
    saveCurrentId(state.player?.id || null);
    renderParent();
    $("backup-status").textContent = `Restored ${names}.`;
  } catch {
    $("backup-status").textContent = "That file isn't a Sentence Builders backup.";
  }
}

/* ==================== Settings ==================== */

function openSettings() {
  const s = settings();
  $("set-autoread").checked = s.autoRead;
  $("set-pip").checked = s.pip;
  $("set-sound").checked = s.sound;
  $("set-grade").value = String(state.player.grade);
  $("delete-player").textContent = "Delete this player";
  $("delete-player").dataset.armed = "";
  $("set-autoread").closest("label").hidden = !canSay();
  openOverlay("settings-overlay");
}

function changeSetting() {
  const player = {
    ...state.player,
    grade: Number($("set-grade").value),
    settings: { ...state.player.settings, autoRead: $("set-autoread").checked, pip: $("set-pip").checked, sound: $("set-sound").checked },
  };
  savePlayer(player);
}

/* ==================== Wiring ==================== */

function gradeOptions() {
  return Array.from({ length: MAX_GRADE - MIN_GRADE + 1 }, (_, i) => MIN_GRADE + i)
    .map((g) => `<option value="${g}">Grade ${g}</option>`).join("");
}

function wire() {
  $("player-grade").innerHTML = gradeOptions();
  $("set-grade").innerHTML = gradeOptions();

  document.addEventListener("click", (event) => {
    const target = event.target;
    const go = target.closest("[data-go]");
    if (go) {
      stopSaying();
      if (go.dataset.go === "players") renderPlayers();
      else if (go.dataset.go === "home") renderHome();
      return;
    }
    const close = target.closest("[data-close]");
    if (close) {
      closeOverlay(close.closest(".overlay").id);
      if (close.closest("#settings-overlay") && state.player) renderHome();
      if (close.closest("#adult-overlay") && state.player && document.body.dataset.screen === "home") renderHome();
      return;
    }
    if (target.closest("[data-add-player]")) return openAddPlayer();
    if (target.closest("[data-grownup]")) return openAdultCheck();
    const playerBtn = target.closest("[data-player]");
    if (playerBtn) return choosePlayer(playerBtn.dataset.player);
    const avatar = target.closest("[data-avatar]");
    if (avatar) {
      state.newAvatar = avatar.dataset.avatar;
      drawAvatars();
      return;
    }
    const world = target.closest("[data-world]");
    if (world) return renderWorld(world.dataset.world);
    const levelBtn = target.closest(".level-btn");
    if (levelBtn) return openTip(levelBtn.dataset.skill, Number(levelBtn.dataset.level));
  });

  $("player-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("player-name").value.trim();
    if (!name) return;
    const now = Date.now();
    const player = newPlayer({ id: `p${now.toString(36)}`, name, avatar: state.newAvatar, grade: $("player-grade").value, now });
    state.players = [...state.players, player];
    savePlayers(state.players);
    choosePlayer(player.id);
  });

  $("who-btn").addEventListener("click", renderPlayers);
  $("adult-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (Number($("adult-answer").value.trim()) === state.adultNumber) {
      closeOverlay("adult-overlay");
      renderParent();
    } else {
      $("adult-wrong").hidden = false;
      $("adult-answer").select();
    }
  });
  $("parent-back").addEventListener("click", () => (state.player ? renderHome() : renderPlayers()));
  $("parent-players").addEventListener("change", (event) => {
    const select = event.target.closest("[data-break]");
    if (!select) return;
    const p = state.players.find((x) => x.id === select.dataset.break);
    const updated = { ...p, settings: { ...p.settings, breakMinutes: Number(select.value) } };
    state.players = state.players.map((x) => (x.id === p.id ? updated : x));
    if (state.player?.id === p.id) state.player = updated;
    savePlayers(state.players);
  });
  $("backup-save").addEventListener("click", saveBackup);
  $("backup-file").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) restoreBackup(file);
    event.target.value = "";
  });
  $("settings-btn").addEventListener("click", openSettings);
  $("badges-btn").addEventListener("click", renderBadges);
  $("tip-say").addEventListener("click", () => {
    const { tip } = state.tip;
    say(`${tip.title}. ${tip.rule} For example: ${tip.example}`);
  });
  $("tip-start").addEventListener("click", () => {
    if (state.tip.review) {
      closeOverlay("tip-overlay");
      openOverlay("result-overlay");
    } else {
      startLevel(state.tip.skillId, state.tip.level);
    }
  });
  $("result-rule").addEventListener("click", () => {
    closeOverlay("result-overlay");
    openTip(state.lastPlayed.skillId, state.lastPlayed.level, { review: true });
  });
  $("rules-btn").addEventListener("click", () => renderRules(null, "home"));
  $("world-rules").addEventListener("click", () => renderRules(state.worldId, "world"));
  $("rules-back").addEventListener("click", () => {
    stopSaying();
    if (state.rulesBack === "world" && state.worldId) renderWorld(state.worldId);
    else renderHome();
  });
  $("rules-list").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-say-rule]");
    if (!btn) return;
    const tip = state.content.tips[btn.dataset.sayRule];
    say(`${tip.title}. ${tip.rule} For example: ${tip.example}`);
  });
  $("rules-tabs").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-rules-tab]");
    if (btn) {
      renderRules(btn.dataset.rulesTab);
      window.scrollTo(0, 0);
    }
  });
  $("say-btn").addEventListener("click", readItem);
  $("check-btn").addEventListener("click", () => {
    const ctrl = state.play?.ctrl;
    if (ctrl?.usesCheck && ctrl.canCheck() && !state.play.done) handleAnswer(ctrl.check());
  });
  $("next-btn").addEventListener("click", nextItem);
  $("quit-btn").addEventListener("click", () => openOverlay("quit-overlay"));
  $("quit-yes").addEventListener("click", () => {
    closeOverlay("quit-overlay");
    stopSaying();
    const skill = skillById(state.play.skillId);
    state.play = null;
    renderWorld(skill.world);
  });
  $("result-next").addEventListener("click", () => {
    closeOverlay("result-overlay");
    const next = state.resultNext;
    if (next.world) renderWorld(next.world);
    else openTip(next.skillId, next.level);
  });
  $("result-again").addEventListener("click", () => {
    closeOverlay("result-overlay");
    openTip(state.lastPlayed.skillId, state.lastPlayed.level);
  });
  $("result-town").addEventListener("click", () => {
    closeOverlay("result-overlay");
    renderHome();
  });
  for (const id of ["set-autoread", "set-pip", "set-sound", "set-grade"]) $(id).addEventListener("change", changeSetting);
  $("switch-player").addEventListener("click", () => {
    closeOverlay("settings-overlay");
    renderPlayers();
  });
  $("delete-player").addEventListener("click", () => {
    const btn = $("delete-player");
    if (!btn.dataset.armed) {
      btn.dataset.armed = "1";
      btn.textContent = `Tap again to delete ${state.player.name} and all their progress`;
      return;
    }
    state.players = state.players.filter((p) => p.id !== state.player.id);
    savePlayers(state.players);
    state.player = null;
    saveCurrentId(null);
    closeOverlay("settings-overlay");
    if (state.players.length) renderPlayers();
    else openAddPlayer();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const open = [...document.querySelectorAll(".overlay")].find((o) => !o.hidden);
      if (open && open.id !== "result-overlay") {
        closeOverlay(open.id);
        if (open.id === "settings-overlay") renderHome();
        if (open.id === "tip-overlay" && state.tip?.review) openOverlay("result-overlay");
      }
    }
  });
}

/* ==================== The phone's Back button ==================== */

function atHome() {
  if (topOverlay()) return false;
  const screen = document.body.dataset.screen;
  return screen === "home" || (screen === "players" && !state.player) || (screen === "add-player" && !state.players.length);
}

/** Back closes the popup on top, or steps back one screen. Mid-round it asks before leaving. */
function handleBack() {
  stopSaying();
  const open = topOverlay();
  if (open) {
    closeOverlay(open.id);
    if (open.id === "result-overlay") renderHome();
    else if (open.id === "settings-overlay" && state.player) renderHome();
    else if (open.id === "tip-overlay" && state.tip?.review) openOverlay("result-overlay");
    return;
  }
  const screen = document.body.dataset.screen;
  if (screen === "play" && state.play) openOverlay("quit-overlay");
  else if (screen === "world" || screen === "badges") renderHome();
  else if (screen === "rules") $("rules-back").click();
  else if (screen === "parent") $("parent-back").click();
  else if (screen === "add-player" && state.players.length) renderPlayers();
  else if (screen === "players" && state.player) renderHome();
}

async function loadContent() {
  const response = await fetch("data/content.json");
  if (!response.ok) throw new Error(`content: ${response.status}`);
  return response.json();
}

async function start() {
  wire();
  initBackButton({ handleBack, atHome });
  try {
    state.content = await loadContent();
  } catch {
    document.body.innerHTML = '<p class="load-error">The sentences didn\'t load. Check the internet connection once, then the game works offline.</p>';
    return;
  }
  state.players = loadPlayers().map(normalizePlayer);
  const currentId = loadCurrentId();
  if (!state.players.length) openAddPlayer();
  else if (state.players.some((p) => p.id === currentId)) choosePlayer(currentId);
  else renderPlayers();
  document.body.classList.add("is-ready");
  registerServiceWorker();
}

start();
