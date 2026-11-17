// Startup and screens: players, the town, worlds, levels, results, badges and settings.
import {
  AVATARS, AVATAR_GROUPS, HABIT_BADGES, ITEMS_PER_LEVEL, MAX_GRADE, MAX_PLAYERS, MIN_GRADE, PIP, PIP_INTRO, DECOR, decorFor, HOMEWORK_PER_ROUND, PRACTICE_PER_ROUND, PRACTICE_GOAL, clampSpot, SKILLS, SPELLING_RULES, STUDIO_FROM_GRADE, NOUN_TABLE_FROM_GRADE, NOUN_KINDS, NOUN_REMINDERS_UNTIL, TIER_NAMES, WORLDS, WORLD_BADGES,
  GOLD_DAYS, LABELS, LABEL_LISTS, PATTERNS, FLOW_LABELS, FLOW_PATTERNS, WORD_LISTS, WORD_PARTS, skillById, skillOpenFor, skillsInWorld, skillsInWorldFor, worldOpenFor,
} from "./config.js";
import { answerText, spokenText } from "./lib/parse.js";
import { pickLevelItems, pickSpellingItems, pickSummitItems } from "./lib/select.js";
import { recordHomework, recordPractice, buyDecor, moveDecor, removeDecor,
  currentBadges, habitValue, isPassed, isUnlocked, levelStars, localDate, mostMissed, newPlayer, normalizePlayer,
  passedKeys, recordLevel, skillTier, weekSummary, recordWeekDay } from "./lib/progress.js";
import { loadCurrentId, loadPlayers, saveCurrentId, savePlayers } from "./storage.js";
import { districtSkills, mapDistricts, mapLayout, parkSvg, pipSays, pipSvg, townSvg } from "./ui/art.js";
import { createTownMap } from "./ui/townmap.js";
import { $, closeOverlay, esc, initBackButton, openOverlay, pick, showScreen, topOverlay } from "./ui/dom.js";
import { renderItem } from "./ui/items.js";
import { reportText, teacherReport } from "./lib/report.js";
import { WEEK_BONUS, WEEK_DAYS, nextDay, openDays, todayIndex, weekDayItems, weekFor, weekProgress, weekSentence } from "./lib/week.js";
import { MAX_PEOPLE, cleanName, namesFor, personalize, registerNames } from "./lib/names.js";
import { buzz, canSay, celebrate, say, sound, stopSaying } from "./ui/feel.js";
import { registerServiceWorker } from "./ui/update.js";

const state = {
  content: { tips: {}, items: [] },
  players: [],
  player: null,
  newAvatar: AVATARS[0],
  play: null, // the level being played
  sessionStart: null, // when this stretch of play began, for the break reminder
  map: null, // the town map's pan and zoom
  mapArea: null, // the district the map is zoomed in to (null: the whole island)
  buildArea: "square", // the district the Build screen decorates
};

const settings = () => state.player?.settings || { sound: true, pip: true, autoRead: false };
const points = (n) => (Number.isInteger(n) ? String(n) : `${Math.floor(n)}½`);
const gradeLabel = (grade) => `Grade ${grade}`;

function savePlayer(player) {
  state.player = player;
  state.players = state.players.map((p) => (p.id === player.id ? player : p));
  savePlayers(state.players);
  applyTheme();
}

/** Grades 6+ get the calmer Studio look automatically; anyone can pick either look in Settings. */
function themeFor(player) {
  const choice = player?.settings?.theme || "auto";
  if (choice === "studio" || choice === "bright") return choice;
  return player && player.grade >= STUDIO_FROM_GRADE ? "studio" : "bright";
}
function applyTheme() {
  const studio = themeFor(state.player) === "studio";
  document.body.classList.toggle("theme-studio", studio);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", studio ? "#27324a" : "#1f5fbf");
  // Reading support: a clearer font, bigger text and more space, for whoever is playing.
  const s = state.player?.settings || {};
  const setData = (el, key, value) => { if (value) el.dataset[key] = value; else delete el.dataset[key]; };
  setData(document.body, "font", s.font && s.font !== "game" ? s.font : "");
  setData(document.documentElement, "textSize", s.textSize && s.textSize !== "normal" ? s.textSize : "");
  document.body.classList.toggle("spacing", Boolean(s.spacing));
  document.body.classList.toggle("calm", Boolean(s.calm));
}

/* ==================== Players ==================== */

function renderPlayers() {
  applyTheme();
  const cards = state.players.map((p) => `<div class="player-tile">
      <button type="button" class="player-card" data-player="${esc(p.id)}">
      <span class="avatar" aria-hidden="true">${p.avatar}</span><span class="player-name">${esc(p.name)}</span>
      <span class="player-grade">${gradeLabel(p.grade)}</span></button>
      <button type="button" class="player-edit" data-edit-player="${esc(p.id)}" aria-label="Edit ${esc(p.name)}" title="Edit">✏️</button>
    </div>`).join("");
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

/** Avatar buttons in groups; older players see Sports, music and more first. */
function avatarGridHtml(selected, attr, olderFirst) {
  const groups = olderFirst ? [...AVATAR_GROUPS].reverse() : AVATAR_GROUPS;
  return groups.map((g) => `<p class="avatar-group">${esc(g.name)}</p><div class="avatar-grid">${g.avatars.map((a) =>
    `<button type="button" class="avatar-btn${a === selected ? " selected" : ""}" ${attr}="${a}" aria-pressed="${a === selected}" aria-label="Avatar ${a}">${a}</button>`).join("")}</div>`).join("");
}

function drawAvatars() {
  $("avatar-grid").innerHTML = avatarGridHtml(state.newAvatar, "data-avatar", Number($("player-grade").value) >= STUDIO_FROM_GRADE);
}

function choosePlayer(id) {
  state.mapArea = null; // each player's map starts on the whole island
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

/* ==================== Island Home (Settings, grades 3–5) ==================== */
// Following the teaching expert: an option, off by default; Pip always points to the next lesson (or to review
// that's due first); the Notice Board opens once a day before free roaming; building waits for today's lesson.

const ISLAND_HOME_MAX_GRADE = 5;
const islandOn = (player) => Boolean(player?.settings?.islandHome) && player.grade <= ISLAND_HOME_MAX_GRADE;
const playedToday = (player) => (player.days || []).includes(localDate(Date.now()));
/** Sentences missed and not yet fixed up today: Summit Review brings them back first. */
function reviewDue(player) {
  if (player.summitOn === localDate(Date.now()) || !passedKeys(player).length) return 0;
  const missed = Object.values(player.items || {}).filter((s) => s.misses > 0).length;
  return missed >= 4 ? missed : 0;
}

function islandBarHtml(player) {
  const info = weekMapInfo(player);
  $("island-board").innerHTML = `<span aria-hidden="true">📌</span> Notice Board${info?.waiting ? ' <span class="island-dot" aria-label="something is waiting">!</span>' : ""}`;
  const bricks = player.bricks || 0;
  $("island-build").innerHTML = playedToday(player) ? `<span aria-hidden="true">🧱</span> Build · ${bricks}` : `<span aria-hidden="true">🔒</span> Build`;
  $("island-build").classList.toggle("locked", !playedToday(player));
  $("island-build").setAttribute("aria-label", playedToday(player) ? `Build on the island, ${bricks} bricks` : "Build: opens after today's first lesson");
}

function renderHome() {
  const player = state.player;
  applyTheme();
  const island = islandOn(player);
  document.body.classList.toggle("island-home", island);
  $("island-bar").hidden = !island;
  $("who-btn").innerHTML = `<span class="avatar" aria-hidden="true">${player.avatar}</span> ${esc(player.name)}`;
  const next = nextUp(player);
  const due = island ? reviewDue(player) : 0;
  let greeting = next
    ? `Hi ${player.name}! Next up: ${next.skill.name}, level ${next.level}.`
    : `Every building is up, ${player.name}. Go for Gold: score 7 or more on a level 3, on two different days.`;
  // The next level is one tap away: a Play button in Pip's bubble (or on its own when Pip is off).
  let play = next ? `<button type="button" class="primary next-play" data-next-up="${next.skill.id}-${next.level}">▶ Play</button>` : "";
  if (due) {
    // Island Home: review that's due comes before new levels, at Pip's Review Dock (Summit Review).
    greeting = `Review first, ${player.name}! ${due} sentences you missed are waiting at the Review Dock.`;
    play = `<button type="button" class="primary next-play" data-practice="summit">🔁 Review</button>${next ? `<button type="button" class="link" data-next-up="${next.skill.id}-${next.level}">or a new lesson</button>` : ""}`;
  }
  if (island) {
    islandBarHtml(player);
    // Open on the next lesson's part of the island (or the peaks, when review comes first).
    if (!state.mapArea && !state.rising) state.mapArea = due ? "peaks" : next?.skill.world || null;
  }
  $("pip-home").innerHTML = settings().pip
    ? pipSays(greeting, true, play)
    : next ? `<p class="next-line">Next up: ${esc(next.skill.name)}, level ${next.level}. ${play}</p>` : "";
  // A building that just went up: the map opens on its district so the rise is seen.
  const risingSkill = state.rising && skillById(state.rising.replace(/-\d$/, ""));
  if (risingSkill) state.mapArea = risingSkill.world;
  const open = state.mapArea === "peaks" || mapDistricts(player).some((d) => d.id === state.mapArea);
  state.map.show(townSvg(player, { rising: state.rising, week: weekMapInfo(player), review: due > 0 }), mapLayout(player), open ? state.mapArea : null);
  if (state.rising) {
    const card = $("town").closest(".town-card");
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) setTimeout(() => card.scrollIntoView({ block: "center", behavior: "smooth" }), 150);
    state.rising = null;
  }
  const earned = Object.entries(currentBadges(player)).filter(([id, tier]) => tier && visibleBadgeIds(player).has(id)).length;
  const shown = visibleBadgeIds(player);
  const total = shown.size;
  $("badges-btn").innerHTML = `<span class="tool-emoji" aria-hidden="true">🏅</span><span>Badges ${earned}/${total}</span>`;
  $("build-btn").innerHTML = buildCardHtml(player);
  $("week-btn").innerHTML = weekCardHtml(player);
  // A player who hasn't met Pip yet gets his welcome once (unless Pip is turned off).
  if (!player.introSeen && settings().pip && !topOverlay()) setTimeout(() => !$("home").hidden && !topOverlay() && openPipIntro(), 250);
  // Island Home: the Notice Board opens by itself once a day, when something is waiting, before free roaming.
  else if (island && player.boardSeenOn !== localDate(Date.now()) && weekMapInfo(player)?.waiting && !topOverlay()) {
    savePlayer({ ...player, boardSeenOn: localDate(Date.now()) });
    setTimeout(() => !$("home").hidden && !topOverlay() && openWeek(), 300);
  }
  const worldCards = WORLDS.map((world) => {
    const skills = skillsInWorldFor(world.id, player);
    const built = skills.reduce((n, s) => n + [1, 2, 3].filter((l) => isPassed(player, s.id, l)).length, 0);
    const open = worldOpenFor(world, player);
    const meta = open ? `${built}/${skills.length * 3} built` : world.ready ? `Grade ${world.minGrade}+` : "Coming soon";
    return `<button type="button" class="world-card${open ? "" : " soon"}" data-world="${world.id}" ${open ? "" : "disabled"}>
      <span class="world-emoji" aria-hidden="true">${world.emoji}</span>
      <span class="world-text"><span class="world-name">${esc(world.name)}</span><span class="world-blurb">${esc(world.blurb)}</span></span>
      <span class="world-meta">${meta}</span></button>`;
  });
  // Grammar Peaks isn't a world of skills, but it's a place on the island too: Summit Review and Spelling Lake.
  // It comes after the open places and before any that open in a later grade.
  const peaksCard = `<button type="button" class="world-card" data-peaks>
      <span class="world-emoji" aria-hidden="true">⛰️</span>
      <span class="world-text"><span class="world-name">Grammar Peaks</span><span class="world-blurb">Summit Review of the skills you've passed, and Spelling Lake</span></span>
      <span class="world-meta">🚩 ${player.summits || 0} · ⛵ ${player.lakeWins || 0}</span></button>`;
  const firstLocked = WORLDS.findIndex((w) => !worldOpenFor(w, player));
  worldCards.splice(firstLocked < 0 ? worldCards.length : firstLocked, 0, peaksCard);
  $("world-list").innerHTML = worldCards.join("");
  showScreen("home");
}

/* ==================== World ==================== */

function renderWorld(worldId) {
  state.worldId = worldId;
  const world = WORLDS.find((w) => w.id === worldId);
  const player = state.player;
  $("world-title").textContent = `${world.emoji} ${world.name}`;
  $("skill-list").innerHTML = skillsInWorldFor(worldId, player).map((skill) => skillCardHtml(skill)).join("")
    + (world.comingSoon ? `<p class="note coming-soon">${esc(world.comingSoon)}</p>` : "");
  showScreen("world");
}

/** One skill's card: badge, benchmarks and its three level buttons (on the world screen and from the town map). */
function skillCardHtml(skill) {
  const player = state.player;
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
    const gold = tier === 3 ? "Gold! A gold flag flies on its top building." : isPassed(player, skill.id, 3) ? `Gold: 7+ on level 3 on ${GOLD_DAYS} days (${goldDays}/${GOLD_DAYS})` : "";
    return `<section class="skill-card" style="--skill:${skill.color}">
      <div class="skill-head"><h2>${esc(skill.name)}</h2>
        <span class="tier${tier ? "" : " none"}">${skill.badge.emoji} ${tier ? TIER_NAMES[tier - 1] : "No badge yet"}</span></div>
      <p class="skill-sub">${esc(skill.benchmarks)}</p>
      <div class="levels">${levels}</div>
      ${gold ? `<p class="gold-note">${esc(gold)}</p>` : ""}
    </section>`;
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
  $("tip-pip").innerHTML = settings().pip ? pipSvg(48) : "";
  $("tip-title").textContent = tip.title;
  $("tip-rule").textContent = tip.rule;
  $("tip-example").textContent = tip.example;
  $("tip-say").hidden = !canSay();
  openOverlay("tip-overlay");
  if (settings().autoRead) say(`${tip.title}. ${tip.rule} For example: ${tip.example}`);
}

/* ==================== Playing a level ==================== */

/** Pip's homework: three paragraphs with mistakes to find, unseen ones first. Doesn't count toward levels or badges. */
function startHomework() {
  closeOverlay("week-overlay");
  const band = state.player.grade <= 5 ? "3-5" : "6-8";
  const stats = state.player.items;
  const pool = (state.content.homework || []).filter((h) => h.band === band)
    .map((h) => ({ h, last: stats[h.id]?.last ?? -1, r: Math.random() }))
    .sort((a, b) => a.last - b.last || a.r - b.r);
  const items = pool.slice(0, HOMEWORK_PER_ROUND).map(({ h }) => ({ ...h, skill: "proofread", level: 1 }));
  state.play = { mode: "homework", skillId: "proofread", level: 1, items: withNames(items), index: 0, tries: 0, results: [], ctrl: null, done: false, startedAt: Date.now() };
  if (!state.sessionStart) state.sessionStart = Date.now();
  showScreen("play");
  showItem();
}

/* ==================== Meet Pip ==================== */

/** Pip's welcome: a few short bubbles, shown once per player (and again from About). */
function openPipIntro() {
  state.pipIntro = 0;
  $("pip-intro-face").innerHTML = pipSvg(96);
  drawPipIntro();
  openOverlay("pip-intro-overlay");
}

function drawPipIntro() {
  const step = state.pipIntro;
  const older = state.player.grade >= STUDIO_FROM_GRADE;
  $("pip-intro-text").textContent = PIP_INTRO[step][older ? 1 : 0].replace("{name}", state.player.name);
  $("pip-intro-dots").innerHTML = PIP_INTRO.map((_, k) => `<span class="${k === step ? "on" : ""}"></span>`).join("");
  const last = step === PIP_INTRO.length - 1;
  $("pip-intro-next").textContent = last ? "Let's build!" : "Next";
  $("pip-intro-skip").hidden = last;
  if (settings().autoRead) say($("pip-intro-text").textContent);
}

function closePipIntro() {
  closeOverlay("pip-intro-overlay");
  stopSaying();
  if (!state.player.introSeen) savePlayer({ ...state.player, introSeen: true });
}

/* ==================== Grammar Peaks: Summit Review and Spelling Lake ==================== */

/** Questions for a Summit Review: from every level this player has passed, mixed across skills. */
function summitItems(player) {
  const shown = new Set(visibleSkills(player).map((s) => s.id));
  return pickSummitItems({
    items: state.content.items, passedKeys: passedKeys(player).filter((k) => shown.has(k.replace(/-\d$/, ""))),
    stats: player.items, count: PRACTICE_PER_ROUND,
  });
}

/** kind: "summit" (mixed review of passed skills) or "lake" (spelling). Neither counts toward levels or badges. */
function startPractice(kind) {
  const player = state.player;
  const items = kind === "summit" ? summitItems(player)
    : pickSpellingItems({ items: state.content.spelling || [], grade: player.grade, stats: player.items, count: PRACTICE_PER_ROUND })
      .map((item) => ({ ...item, prompt: "Which spelling is right?" }));
  if (!items.length) return;
  closeOverlay("result-overlay");
  state.play = { mode: kind, skillId: items[0].skill, level: 1, items: withNames(items), index: 0, tries: 0, results: [], ctrl: null, done: false, startedAt: Date.now() };
  if (!state.sessionStart) state.sessionStart = Date.now();
  showScreen("play");
  showItem();
}

function finishPractice() {
  const play = state.play;
  const now = Date.now();
  const summit = play.mode === "summit";
  const badgesBefore = currentBadges(state.player);
  const out = recordPractice(state.player, { kind: play.mode, results: play.results, now, durationMs: now - play.startedAt });
  savePlayer(out.player);
  const newBadges = HABIT_BADGES.filter((b) => currentBadges(out.player)[b.id] && !badgesBefore[b.id]);
  $("progress-fill").style.width = "100%";
  $("result-stars").innerHTML = "";
  $("result-title").textContent = summit ? (out.reached ? "You reached the summit!" : "Almost to the top") : (out.reached ? "A new boat on the lake!" : "Nice paddling");
  $("result-score").textContent = `${out.right} of ${play.results.length} right on the first try`;
  $("result-bricks").hidden = !out.bricks;
  $("result-bricks").innerHTML = `+${out.bricks} 🧱 bricks <span class="note">· ${out.player.bricks} to build with</span>`;
  const goal = `Get ${PRACTICE_GOAL} right on the first try to ${summit ? "plant a flag at the top" : "float a boat on the lake"}.`;
  const line = out.reached
    ? (summit ? `Flag number ${out.player.summits} is flying on Grammar Peaks. You remembered your rules!` : `Boat number ${out.player.lakeWins} is out on the lake. Great spelling!`)
    : `${goal} Look at the ones below, then try again.`;
  $("result-pip").innerHTML = pipSays(line, true);
  $("result-badges").innerHTML = newBadges.map((b) => `<p class="new-badge"><span aria-hidden="true">${b.emoji}</span> New badge: <strong>${esc(b.name)}</strong></p>`).join("");
  $("result-review").innerHTML = reviewHtml(play);
  state.resultNext = { practice: play.mode };
  $("result-next").textContent = summit ? "Climb again" : "Another round";
  $("result-again").hidden = true;
  $("result-rule").hidden = true;
  state.mapArea = "peaks"; // back on the island, the map shows the new flag or boat
  openOverlay("result-overlay");
  if (out.reached) {
    sound("done", settings().sound);
    celebrate(out.right === play.results.length ? 3 : 2);
  }
  state.play = null;
}

function finishHomework() {
  const play = state.play;
  const now = Date.now();
  const out = recordHomework(state.player, { results: play.results, now, durationMs: now - play.startedAt });
  savePlayer(out.player);
  $("progress-fill").style.width = "100%";
  $("result-stars").innerHTML = "";
  $("result-title").textContent = `Pip's grade: ${out.grade}`;
  $("result-score").textContent = `${out.right} of ${play.results.length} paragraphs right on the first try`;
  $("result-bricks").hidden = !out.bricks;
  $("result-bricks").innerHTML = `+${out.bricks} 🧱 bricks <span class="note">· ${out.player.bricks} to build with</span>`;
  const lines = { "A+": "An A+! Thank you, teacher. I'll fix those mistakes for good.", A: "An A! Thanks for checking my work so carefully.",
    B: "A B. Not bad! Thanks for catching my mistakes.", C: "A C. Hmm, some of those mistakes were sneaky.", "Try again": "Those were tricky. Want to check another one?" };
  $("result-pip").innerHTML = pipSays(lines[out.grade], true);
  $("result-badges").innerHTML = "";
  $("result-review").innerHTML = reviewHtml(play);
  state.resultNext = { homework: true };
  $("result-next").textContent = "Check more homework";
  $("result-again").hidden = true;
  $("result-rule").hidden = true;
  openOverlay("result-overlay");
  if (out.grade === "A+" || out.grade === "A") {
    sound("done", settings().sound);
    celebrate(out.grade === "A+" ? 3 : 2);
  }
  state.play = null;
}

/* ==================== Sentence of the Week ==================== */

const currentWeek = (player) => weekFor(state.content?.weeks || [], player.grade, Date.now());
const weekProgressFor = (player) => weekProgress(player, currentWeek(player), Date.now());
/** The sentence without capitals or marks, as it's posted on the Notice Board (Thursday puts them in). */
const boardText = (week) => weekSentence(week).toLowerCase().replace(/[.?!,]/g, "");

function weekDotsHtml(progress, now) {
  const today = todayIndex(now);
  return `<span class="week-dots" aria-hidden="true">${WEEK_DAYS.map((d, i) =>
    `<span class="${progress.done.includes(i) ? "done" : i === today ? "today" : i > today ? "later" : ""}">${progress.done.includes(i) ? "✓" : d.short}</span>`).join("")}</span>`;
}

const homeworkWaiting = (player) => player.homeworkOn !== localDate(Date.now());

/** Today with Pip's first row: the Notice Board, with this week's job and Pip's "Tutor needed" flyer. */
function weekCardHtml(player) {
  const week = currentWeek(player);
  const now = Date.now();
  const progress = week ? weekProgressFor(player) : { done: [] };
  const next = week ? nextDay(progress, now) : null;
  const weekLine = !week ? "" : progress.done.length === 5 ? "Week done!"
    : next !== null ? `${WEEK_DAYS[next].name}: ${WEEK_DAYS[next].task}` : `Done today. ${WEEK_DAYS[Math.min(todayIndex(now) + 1, 4)].name} is next.`;
  const line = [weekLine, homeworkWaiting(player) ? "Pip needs a tutor" : ""].filter(Boolean).join(" · ") || "All done for today";
  return `<span class="homework-emoji" aria-hidden="true">📌</span>
    <span><strong>Notice Board</strong><span>${esc(line)}</span></span>
    ${week ? weekDotsHtml(progress, now) : ""}<span class="today-chev" aria-hidden="true">›</span>`;
}

/** What the Notice Board on the map shows: the days done, and whether one is waiting today. */
function weekMapInfo(player) {
  const week = currentWeek(player);
  if (!week) return null;
  const progress = weekProgressFor(player);
  return { done: progress.done, waiting: nextDay(progress, Date.now()) !== null || homeworkWaiting(player), tutor: homeworkWaiting(player), today: todayIndex(Date.now()) };
}

function openWeek() {
  const player = state.player;
  const week = currentWeek(player);
  if (!week) return;
  const now = Date.now();
  const progress = weekProgressFor(player);
  const open = openDays(now);
  const rows = WEEK_DAYS.map((d, i) => {
    const done = progress.done.includes(i);
    const can = open.includes(i);
    const action = done ? '<span class="week-done">✓ Done</span>'
      : can ? `<button type="button" class="primary" data-week-day="${i}">Start</button>` : `<span class="muted">Opens ${d.name}</span>`;
    return `<li class="week-day${done ? " done" : ""}"><span><strong>${d.name}</strong><span>${d.task}</span></span>${action}</li>`;
  }).join("");
  const banners = (player.banners || []).length;
  const tutor = homeworkWaiting(player);
  $("week-body").innerHTML = `<section class="board-notice tutor-notice${tutor ? "" : " answered"}" aria-labelledby="tutor-title">
      <h3 id="tutor-title">📝 Tutor needed</h3>
      <p>${tutor ? `Pip has ${HOMEWORK_PER_ROUND} paragraphs of homework. Can you find his mistakes? You'll earn bricks, and Pip gets a grade.`
        : "Thanks for checking Pip's homework today! He always has more, if you'd like to keep tutoring."}</p>
      <button type="button" id="homework-btn" class="${tutor ? "primary" : "secondary"}">${tutor ? "Help Pip" : "Check more homework"}</button>
    </section>
    <section class="board-notice" aria-labelledby="sow-title">
      <h3 id="sow-title">📌 Sentence of the Week</h3>
      <p class="week-board" aria-label="This week's sentence">${esc(boardText(week))}</p>
      <p class="note">One sentence all week, a short job each day. Missed a day? Catch up any time before Monday. Finish all five for ${WEEK_BONUS} bonus bricks and a banner in the Town Square.</p>
      <ol class="week-days">${rows}</ol>
      ${banners ? `<p class="note">🎏 ${banners} banner${banners === 1 ? "" : "s"} flying in the Town Square.</p>` : ""}
    </section>`;
  openOverlay("week-overlay");
}

function startWeekDay(day) {
  const player = state.player;
  const week = currentWeek(player);
  if (!week || !openDays(Date.now()).includes(day)) return;
  closeOverlay("week-overlay");
  closeOverlay("result-overlay");
  // The same sentence every day, so it isn't changed to the player's names.
  const items = weekDayItems(week, day);
  state.play = { mode: "week", day, weekId: week.id, skillId: items[0].skill, level: items[0].level, items, index: 0, tries: 0, results: [], ctrl: null, done: false, startedAt: Date.now() };
  if (!state.sessionStart) state.sessionStart = Date.now();
  showScreen("play");
  showItem();
}

function finishWeekDay() {
  const play = state.play;
  const now = Date.now();
  const week = (state.content.weeks || []).find((w) => w.id === play.weekId);
  const progress = weekProgress(state.player, week, now);
  const out = recordWeekDay(state.player, { progress, day: play.day, sentence: weekSentence(week), results: play.results, now, durationMs: now - play.startedAt, bonus: WEEK_BONUS });
  savePlayer(out.player);
  const after = weekProgress(out.player, week, now);
  const next = nextDay(after, now);
  $("progress-fill").style.width = "100%";
  $("result-stars").innerHTML = "";
  $("result-title").textContent = out.weekDone ? "Week complete! 🎏" : `${WEEK_DAYS[play.day].name} done!`;
  $("result-score").textContent = `${out.right} of ${play.results.length} right on the first try · ${after.done.length} of 5 days`;
  $("result-bricks").hidden = !out.bricks;
  $("result-bricks").innerHTML = `+${out.bricks} 🧱 bricks${out.weekDone ? ` (${WEEK_BONUS} for the week)` : ""} <span class="note">· ${out.player.bricks} to build with</span>`;
  $("result-pip").innerHTML = pipSays(out.weekDone
    ? "Five days, one sentence, and you know it inside out. Your banner is flying in the Town Square!"
    : next !== null ? `Nice work. ${WEEK_DAYS[next].name}'s job is waiting too, if you want to catch up.` : "See you tomorrow for the next job on this sentence.", true);
  $("result-badges").innerHTML = "";
  $("result-review").innerHTML = reviewHtml(play);
  state.resultNext = next !== null ? { weekDay: next } : { home: true };
  $("result-next").textContent = next !== null ? `Next: ${WEEK_DAYS[next].name}` : "Back to the island";
  $("result-again").hidden = true;
  $("result-rule").hidden = true;
  state.mapArea = "square"; // back on the island, the map shows the Notice Board (and a new banner)
  openOverlay("result-overlay");
  if (out.weekDone) {
    sound("done", settings().sound);
    celebrate(3);
  }
  state.play = null;
}

function startLevel(skillId, level) {
  closeOverlay("tip-overlay");
  const items = pickLevelItems({
    items: state.content.items, skill: skillId, level, stats: state.player.items, passedKeys: passedKeys(state.player),
    plan: skillById(skillId).levelPlan || null,
  });
  state.play = { skillId, level, items: withNames(items), index: 0, tries: 0, results: [], ctrl: null, done: false, startedAt: Date.now() };
  if (!state.sessionStart) state.sessionStart = Date.now();
  showScreen("play");
  showItem();
}

/** Some sentences use the player's own names (Settings → Names in sentences). */
function withNames(items) {
  const names = namesFor(state.player);
  if (!names) return items;
  registerNames(names);
  return items.map((item) => personalize(item, names));
}

function showItem() {
  const play = state.play;
  const item = play.items[play.index];
  const skill = skillById(item.skill);
  play.tries = 1;
  play.done = false;
  $("progress-fill").style.width = `${(play.index / play.items.length) * 100}%`;
  $("progress-text").textContent = `${play.index + 1} of ${play.items.length}`;
  $("play-skill").textContent = play.mode === "homework" ? `📝 Pip's homework: ${item.title}`
    : play.mode === "summit" ? `⛰️ Summit Review · ${skill.name}`
    : play.mode === "lake" ? "💧 Spelling Lake"
    : play.mode === "week" ? `📌 Sentence of the Week · ${WEEK_DAYS[play.day].name}`
    : item.review ? `Review: ${skill.name}` : `${skill.name} · Level ${item.level}`;
  $("play-skill").classList.toggle("review", Boolean(item.review));
  $("feedback").innerHTML = "";
  $("feedback").className = "feedback";
  $("next-btn").hidden = true;
  $("item").dataset.itemId = item.id;
  play.ctrl = renderItem($("item"), item, {
    answer: (right) => handleAnswer(right),
    hint: (text) => showStepHint(text),
    showLabels: (labels, patterns) => openLabelHelp(labels, patterns),
    showNouns: () => {
      $("nouns-body").innerHTML = nounKindsHtml(true);
      openOverlay("nouns-overlay");
      $("nouns-overlay").querySelector(".sheet").scrollTop = 0;
    },
    // Reminders under each noun table question until a child has answered NOUN_REMINDERS_UNTIL right on the first try.
    nounReminders: (state.player.nounTableRight || 0) < NOUN_REMINDERS_UNTIL,
    onNounTable: (right) => savePlayer({ ...state.player, nounTableRight: (state.player.nounTableRight || 0) + right }),
    complete: (result) => completeItem(result),
    onChange: updateCheck,
    onTap: () => sound("tap", settings().sound),
    showWords: Boolean(settings().showWords), // Listen and Write: read the words instead of hearing them
    guided: item.type === "diagram" && play.index === 0, // the first diagram of a level is walked through
    // Shurley's noun table: on the first Q&A Flow sentence of a level, for grade 4 and up.
    nounTable: play.mode !== "week" && item.type === "flow" && state.player.grade >= NOUN_TABLE_FROM_GRADE && play.items.findIndex((i) => i.type === "flow") === play.index,
  });
  $("prompt").textContent = play.ctrl.prompt;
  $("check-btn").hidden = !play.ctrl.usesCheck;
  $("say-btn").hidden = !canSay();
  updateCheck();
  if (settings().autoRead && item.type !== "dictate") readItem(); // a dictation plays its own sentence
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

/** Pip's small face beside a hint (nothing when Pip is turned off). */
const pipFace = () => (settings().pip ? `<span class="feedback-pip" aria-hidden="true">${pipSvg(36)}</span>` : "");

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
    // Typed answers can say exactly what slipped (a capital, a comma); otherwise the item's own hint.
    const hintText = play.ctrl.missHint?.() || item.hint;
    $("feedback").innerHTML = `${pipFace()}<div><p><strong>${esc(PIP.hint)}</strong> ${esc(hintText)}</p><p class="try-again">Try again.</p></div>`;
    updateCheck();
  } else {
    play.results.push({ id: item.id, type: item.type, tries: 2, correct: false });
    finishItem();
    play.ctrl.reveal();
    $("feedback").className = "feedback shown";
    $("feedback").innerHTML = `${pipFace()}<div><p><strong>${esc(PIP.shown)}</strong></p><p class="answer-line">${esc(answerText(item))}</p><p class="hint-line">${esc(item.hint)}</p></div>`;
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
  $("feedback").innerHTML = `${pipFace()}<div><p>${esc(text)}</p></div>`;
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
    $("feedback").innerHTML = `${pipFace()}<div><p><strong>Done. Some answers were shown, so this one will come back later.</strong></p><p class="answer-line">${esc(answerText(item))}</p></div>`;
  }
}

function finishItem() {
  state.play.done = true;
  $("check-btn").hidden = true;
  $("next-btn").hidden = false;
  const last = state.play.index + 1 >= state.play.items.length;
  $("next-btn").textContent = !last ? "Next" : state.play.mode ? "See how I did" : "See my building";
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
  if (play.mode === "homework") return finishHomework();
  if (play.mode === "summit" || play.mode === "lake") return finishPractice();
  if (play.mode === "week") return finishWeekDay();
  $("result-rule").hidden = false;
  const starsBefore = state.player.levels[`${play.skillId}-${play.level}`]?.stars ?? 0;
  const now = Date.now();
  const out = recordLevel(state.player, { skill: play.skillId, level: play.level, results: play.results, now, durationMs: now - play.startedAt });
  savePlayer(out.player);
  const s = settings();
  const skill = skillById(play.skillId);
  $("progress-fill").style.width = "100%";
  $("result-stars").innerHTML = [1, 2, 3].map((n) => `<span class="${n <= out.stars ? "on" : ""}">★</span>`).join("");
  $("result-title").textContent = ["Almost there", "Built it!", "Great build!", "Perfect build!"][out.stars];
  $("result-score").textContent = `${points(out.points)} of ${play.results.length} points · ${skill.name} level ${play.level}`;
  $("result-bricks").hidden = !out.bricks;
  $("result-bricks").innerHTML = `+${out.bricks} 🧱 bricks <span class="note">· ${out.player.bricks} to build with</span>`;
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
    celebrate(out.stars);
    buzz(out.stars === 3 ? [30, 60, 30, 60, 60] : [30, 60, 30]);
    // A new building (or a better one) rises when the town is next shown.
    if (out.stars > starsBefore) state.rising = `${play.skillId}-${play.level}`;
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

/** Common/proper and singular/plural nouns: folding cards in the Rule Book, or open in the 📘 Nouns sheet. */
function nounKindsHtml(open = false) {
  return NOUN_KINDS.map((k) => {
    const body = `<p class="tip-rule">${esc(k.rule)}</p><table class="noun-kinds"><thead><tr><th scope="col">${esc(k.head[0])}</th><th scope="col">${esc(k.head[1])}</th></tr></thead>
      <tbody>${k.pairs.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</tbody></table>`;
    return open
      ? `<section class="noun-kind" id="nouns-${k.id}"><h3>${esc(k.title)}</h3>${body}</section>`
      : `<details class="rule-skill noun-kind" id="nouns-${k.id}"><summary><span class="skill-name">${esc(k.title)}</span></summary><div class="rule-card">${body}</div></details>`;
  }).join("");
}

/** Word endings (-ed, plurals, will, -s and -ing, irregular verbs): folding cards in the Rule Book. */
function spellingHtml() {
  // Keep an ending like "-es" on one line: a non-breaking hyphen, and a non-breaking space before it.
  const keep = (text) => esc(text).replace(/(^|\s)-(\w)/g, (_, space, letter) => `${space ? "\u00a0" : ""}\u2011${letter}`);
  return SPELLING_RULES.map((r) => {
    const body = r.rows
      ? `<ul class="spell-rules">${r.rows.map(([when, how, ex]) => `<li><strong>${keep(when)}:</strong> ${keep(how)}<span class="spell-ex">${keep(ex)}</span></li>`).join("")}</ul>`
      : `<ul class="word-chips spell-pairs">${r.list.map(([a, b]) => `<li>${esc(a)} → ${esc(b)}</li>`).join("")}</ul>`;
    return `<details class="rule-skill spell-card" id="spell-${r.id}"><summary><span class="skill-name">${esc(r.title)}</span></summary>
      <div class="rule-card"><p class="note">${keep(r.note)}</p>${body}</div></details>`;
  }).join("");
}

const wordChips = (words) => `<ul class="word-chips">${words.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>`;

// Reference cards have one home, the Reference tab; a place's tab links there for the ones its skills use.
const REFERENCE_FOR = { works: "Word parts (prefixes, suffixes, roots) and spelling patterns", flow: "Kinds of nouns and the word lists for each label" };

/** Prefixes, suffixes and roots, each with what it means and an example. */
function wordPartsHtml() {
  return WORD_PARTS.map((list) => `<details class="rule-skill word-list" id="parts-${list.id}">
    <summary><span class="skill-name">${esc(list.title)}</span><span class="skill-count">${list.words.length}</span></summary>
    <p class="note">${esc(list.note)}</p>${wordChips(list.words)}</details>`).join("");
}

const groupHead = (title) => `<h3 class="rules-group">${esc(title)}</h3>`;

/** Every reference card, in groups: word lists, kinds of nouns, and spelling patterns. */
function wordListsHtml() {
  return `<p class="note rules-intro">Everything to look things up, in one place. Tap one to open it.</p>
    ${groupHead("Word lists")}<div class="rules-grid">${WORD_LISTS.map((list) => `<details class="rule-skill word-list" id="list-${list.id}">
      <summary><span class="skill-name">${esc(list.title)}</span><span class="skill-count">${list.words.length} words</span></summary>
      <p class="note">${esc(list.note)}</p>${wordChips(list.words)}</details>`).join("")}</div>
    ${groupHead("Kinds of nouns")}<div class="rules-grid">${nounKindsHtml()}</div>
    ${groupHead("Word parts")}<div class="rules-grid">${wordPartsHtml()}</div>
    ${groupHead("Spelling patterns")}<div class="rules-grid">${spellingHtml()}</div>`;
}

/* ---------- Rule Book search ---------- */

/** Everything the Rule Book can find: unlocked rules, word lists, noun and spelling cards, and Q&A Flow labels. */
function ruleEntries(player) {
  const out = [];
  for (const world of WORLDS.filter((w) => worldOpenFor(w, player))) {
    for (const skill of skillsInWorldFor(world.id, player)) {
      [1, 2, 3].forEach((level) => {
        const tip = state.content.tips[`${skill.id}-${level}`];
        if (!tip || !isUnlocked(player, skill.id, level)) return;
        out.push({ where: `${world.emoji} ${world.name} · ${skill.name} · Level ${level}`, title: tip.title,
          text: `${tip.rule} ${tip.example}`, body: `<p class="tip-rule">${esc(tip.rule)}</p><p class="tip-example">${esc(tip.example)}</p>` });
      });
    }
  }
  for (const list of WORD_LISTS) out.push({ where: "📚 Reference · Word lists", title: list.title, text: `${list.note} ${list.words.join(" ")}`, body: `<p class="note">${esc(list.note)}</p>${wordChips(list.words)}` });
  for (const list of WORD_PARTS) out.push({ where: "📚 Reference · Word parts", title: list.title, text: `${list.note} ${list.words.join(" ")}`, body: `<p class="note">${esc(list.note)}</p>${wordChips(list.words)}` });
  for (const k of NOUN_KINDS) out.push({ where: "📚 Reference · Kinds of nouns", title: k.title, text: `${k.rule} ${k.pairs.flat().join(" ")}`, body: `<p class="tip-rule">${esc(k.rule)}</p>` });
  for (const r of SPELLING_RULES) {
    const rows = r.rows ? r.rows.map((row) => row.join(": ")).join(" · ") : r.list.map((pair) => pair.join(" → ")).join(", ");
    out.push({ where: "📚 Reference · Spelling patterns", title: r.title, text: `${r.note} ${rows}`, body: `<p class="note">${esc(r.note)}</p><p class="tip-example">${esc(rows)}</p>` });
  }
  for (const [code, label] of Object.entries(LABELS)) {
    out.push({ where: "🏭 Q&A Flow labels", title: `${code} · ${label.name}`, text: `${code} ${label.name} ${label.hint} ${label.find}`, body: `<p class="tip-rule">${esc(label.hint)}</p><p class="tip-example">${esc(label.find)}</p>` });
  }
  return out;
}

/** Search results: every entry whose title or text has all the words typed, titles first. */
function renderRuleSearch(query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (s) => words.every((w) => s.toLowerCase().includes(w));
  const found = ruleEntries(state.player).filter((e) => hit(`${e.title} ${e.text}`))
    .sort((a, b) => hit(b.title) - hit(a.title)).slice(0, 25);
  $("rules-tabs").querySelectorAll(".rules-tab").forEach((t) => t.classList.remove("active"));
  $("rules-list").innerHTML = found.length
    ? `<p class="note rules-intro">${found.length === 25 ? "The first 25 matches" : `${found.length} match${found.length === 1 ? "" : "es"}`} for “${esc(query)}”.</p>
      <div class="rules-grid">${found.map((e) => `<article class="rule-card search-hit"><p class="eyebrow">${esc(e.where)}</p><h4>${esc(e.title)}</h4>${e.body}</article>`).join("")}</div>`
    : `<p class="note rules-intro">Nothing matches “${esc(query)}”. Try one word, like comma, plural or verb.</p>`;
}

/**
 * The Rule Book: one tab per open world plus Reference, pinned at the top and wrapping (no sideways
 * scrolling). A tab shows one world; each skill folds to a one-line header until it's tapped.
 * Unlocked rules show their rule, example and read-aloud; locked ones show only their title.
 */
function renderRules(focusWorld, back) {
  const player = state.player;
  if (back) state.rulesBack = back;
  const worlds = WORLDS.filter((w) => worldOpenFor(w, player));
  // Tabs use the places' names, as on the island map.
  const tabs = [...worlds.map((w) => ({ id: w.id, label: w.name, emoji: w.emoji })), { id: "lists", label: "Reference", emoji: "📚" }];
  $("rules-search").value = "";
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
      ${groupHead("Skills")}<div class="rules-grid">${skills.map((skill) => {
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
      }).join("")}</div>
      ${REFERENCE_FOR[world.id] ? `<p class="note rules-ref-link">${esc(REFERENCE_FOR[world.id])} are in
        <button type="button" class="link" data-rules-link="lists">📚 Reference</button>.</p>` : ""}</section>`;
  }
  showScreen("rules");
}

/* ==================== The town map ==================== */

/** Under the map: the districts to jump to, or (zoomed in) that district's skills and its decorating. */
function drawMapPanel() {
  const player = state.player;
  if (!player) return;
  const districts = mapDistricts(player);
  const here = districts.find((d) => d.id === state.mapArea);
  if (state.mapArea === "peaks") {
    const canClimb = summitItems(player).length > 0;
    const flags = player.summits || 0;
    const boats = player.lakeWins || 0;
    $("map-panel").innerHTML = `<h3 class="map-title"><span aria-hidden="true">⛰️</span> Grammar Peaks</h3>
      <div class="peak-activities">
        <button type="button" class="peak-card" data-practice="summit" ${canClimb ? "" : "disabled"}>
          <span class="peak-emoji" aria-hidden="true">🚩</span>
          <span><strong>Summit Review</strong><span>${canClimb
            ? `${PRACTICE_PER_ROUND} questions mixing the skills you've passed. ${PRACTICE_GOAL}+ right plants a flag at the top.`
            : "Pass a level anywhere on the island, then climb up here to review it."}</span>
          ${flags ? `<small>${flags} flag${flags === 1 ? "" : "s"} planted</small>` : ""}</span></button>
        <button type="button" class="peak-card" data-practice="lake">
          <span class="peak-emoji" aria-hidden="true">💧</span>
          <span><strong>Spelling Lake</strong><span>${PRACTICE_PER_ROUND} spelling questions: -ed, -ing, plurals and more. ${PRACTICE_GOAL}+ right floats a boat.</span>
          ${boats ? `<small>${boats} boat${boats === 1 ? "" : "s"} on the lake</small>` : ""}</span></button>
      </div>
      <div class="map-actions"><button type="button" class="link" data-map-fit>See the whole island</button></div>`;
    return;
  }
  if (!here) {
    // The Worlds list below already names every place, so the whole-island view just says how to explore.
    $("map-panel").innerHTML = '<p class="map-hint">Tap a place on the island to zoom in. Drag to look around.</p>';
    return;
  }
  const decorate = `<button type="button" class="secondary" data-decorate="${here.id}">🧱 Decorate here</button>`;
  const whole = '<button type="button" class="link" data-map-fit>See the whole island</button>';
  if (here.locked) {
    const world = WORLDS.find((w) => w.id === here.world);
    $("map-panel").innerHTML = `<h3 class="map-title">🔒 ${esc(here.name)}</h3>
      <p class="map-hint">This part of the island opens in grade ${world.minGrade}. ${esc(world.blurb)}.</p><div class="map-actions">${whole}</div>`;
    return;
  }
  const skills = districtSkills(here, player);
  const built = skills.reduce((n, s) => n + [1, 2, 3].filter((l) => isPassed(player, s.id, l)).length, 0);
  $("map-panel").innerHTML = `<h3 class="map-title"><span aria-hidden="true">${here.emoji}</span> ${esc(here.name)}${skills.length ? ` <small>${built}/${skills.length * 3} built</small>` : ""}</h3>
    ${skills.length
      ? `<p class="map-hint">Tap a building or an empty lot to pick a level.</p>
        <div class="map-chips">${skills.map((s) => `<button type="button" class="map-chip" data-skill-sheet="${s.id}" style="--skill:${s.color}">${esc(s.name)}</button>`).join("")}</div>`
      : `<p class="map-hint">The middle of the island: decorate it with your bricks. The Notice Board has the Sentence of the Week and Pip's homework.</p>
        <div class="map-chips"><button type="button" class="map-chip" data-week>📌 Notice Board</button></div>`}
    <div class="map-actions">${decorate}${here.world ? `<button type="button" class="link" data-open-world="${here.world}">All levels here</button>` : ""}${whole}</div>`;
}

/** A skill's level card, from tapping its buildings on the map. */
function openSkillSheet(skillId) {
  $("skill-sheet").innerHTML = skillCardHtml(skillById(skillId));
  openOverlay("skill-overlay");
}

/* ==================== Build: town decorations ==================== */

/** The home screen's Build card: bricks, and what they can build now or next. */
function buildCardHtml(player) {
  const bricks = player.bricks || 0;
  const left = decorFor(buildAreaFor(player, state.mapArea)); // anything can be built again
  const canBuild = left.filter((d) => d.cost <= bricks);
  const next = left.find((d) => d.cost > bricks);
  let line;
  let bar = "";
  if (!left.length) line = "Everything is built. What an island!";
  else if (canBuild.length) {
    const best = canBuild[canBuild.length - 1];
    line = canBuild.length === 1 ? `Ready: the ${best.emoji} ${best.name.toLowerCase()}` : `${canBuild.length} ready, like the ${best.emoji} ${best.name.toLowerCase()}`;
  } else {
    line = `${next.cost - bricks} more for the ${next.emoji} ${next.name.toLowerCase()}`;
    bar = `<span class="build-bar" aria-hidden="true"><span style="width:${Math.round((bricks / next.cost) * 100)}%"></span></span>`;
  }
  return `<span class="homework-emoji" aria-hidden="true">🧱</span>
    <span><strong>Build on the island · ${bricks} 🧱</strong><span>${esc(line)}</span>${bar}</span>
    ${canBuild.length ? '<span class="build-ready">Build</span>' : '<span class="today-chev" aria-hidden="true">›</span>'}`;
}

/** A district that can be decorated now: the one asked for if it's open, else the Town Square. */
function buildAreaFor(player, area) {
  return mapDistricts(player).some((d) => d.id === area && !d.locked) ? area : "square";
}

function renderBuild(fresh = null) {
  const player = state.player;
  const bricks = player.bricks || 0;
  const area = (state.buildArea = buildAreaFor(player, state.buildArea));
  if (!player.decor.some((p) => p.uid === state.buildSelected && p.area === area)) state.buildSelected = null;
  $("build-areas").innerHTML = mapDistricts(player).filter((d) => !d.locked).map((d) => `<button type="button" role="tab" class="build-area"
    aria-selected="${d.id === area}" data-build-area="${d.id}"><span class="build-area-emoji" aria-hidden="true">${d.emoji}</span><span>${esc(d.name)}</span></button>`).join("");
  $("build-bricks").innerHTML = `You have <strong>🧱 ${bricks}</strong> brick${bricks === 1 ? "" : "s"}.`;
  drawBuildScene(fresh);
  // This district's own decorations first, then the everyday ones that go anywhere.
  const catalog = decorFor(area).sort((a, b) => Boolean(b.area) - Boolean(a.area));
  $("build-list").innerHTML = catalog.map((d) => {
    const count = player.decor.filter((p) => p.id === d.id && p.area === area).length;
    const short = d.cost - bricks;
    return `<li class="build-item"><span class="build-emoji" aria-hidden="true">${d.emoji}</span>
      <span class="build-name">${esc(d.name)}<small>🧱 ${d.cost}${count ? ` · you have ${count}` : ""}</small></span>
      <button type="button" class="${short > 0 ? "secondary" : "primary"}" data-buy="${d.id}" ${short > 0 ? "disabled" : ""}>
        ${short > 0 ? `${short} more` : count ? "Build another" : "Build"}</button></li>`;
  }).join("");
  showScreen("build");
}

/** The close-up scene and, under it, what's selected (or how to move things). */
function drawBuildScene(fresh = null) {
  const player = state.player;
  const selected = player.decor.find((p) => p.uid === state.buildSelected);
  const item = selected && DECOR.find((d) => d.id === selected.id);
  $("build-town").innerHTML = parkSvg(player, { area: state.buildArea, fresh, selected: state.buildSelected })
    + (item
      ? `<div class="build-selected"><span><span aria-hidden="true">${item.emoji}</span> ${esc(item.name)}: drag it anywhere.</span>
          <span class="build-selected-actions"><button type="button" class="secondary" data-put-away="${selected.uid}">Put away (+${item.cost} 🧱)</button>
          <button type="button" class="link" data-deselect>Done</button></span></div>`
      : `<p class="build-hint">${player.decor.some((p) => p.area === state.buildArea) ? "Drag anything to move it. Tap one to put it away." : "Build something, then drag it where you want it."}</p>`);
}

function buyDecoration(id) {
  const out = buyDecor(state.player, id, state.buildArea);
  if (!out) return;
  savePlayer(out.player);
  sound("done", settings().sound);
  buzz([20, 40, 20]);
  state.buildSelected = out.uid; // the new one is selected, ready to drag into place
  renderBuild(out.uid);
  $("build-town").scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

/**
 * Dragging decorations in the Build close-up (mouse, finger or pen). A press that barely moves is a tap: it
 * selects the decoration. Arrow keys move a focused decoration; Enter selects it.
 */
function initBuildDragging() {
  const box = $("build-town");
  let drag = null;
  const toScene = (svg, event) => {
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  box.addEventListener("pointerdown", (event) => {
    const el = event.target.closest(".decor.drag");
    if (!el) return;
    event.preventDefault();
    const svg = el.ownerSVGElement;
    const start = toScene(svg, event);
    drag = { el, svg, uid: el.dataset.uid, start, x0: Number(el.getAttribute("x")), y0: Number(el.getAttribute("y")), moved: false };
    el.setPointerCapture(event.pointerId);
    el.classList.add("dragging");
  });
  box.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const at = toScene(drag.svg, event);
    const dx = at.x - drag.start.x;
    const dy = at.y - drag.start.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    const spot = clampSpot(drag.x0 + dx, drag.y0 + dy);
    drag.el.setAttribute("x", spot.x);
    drag.el.setAttribute("y", spot.y);
    const shadow = drag.svg.querySelector(`[data-shadow="${drag.uid}"]`);
    shadow?.setAttribute("cx", spot.x + 3);
    shadow?.setAttribute("cy", spot.y - 1);
  });
  const finish = () => {
    if (!drag) return;
    const { el, uid, moved } = drag;
    drag = null;
    el.classList.remove("dragging");
    if (moved) {
      savePlayer(moveDecor(state.player, uid, Number(el.getAttribute("x")), Number(el.getAttribute("y"))));
      state.buildSelected = uid;
    } else {
      state.buildSelected = state.buildSelected === uid ? null : uid;
    }
    drawBuildScene();
    box.querySelector(`[data-uid="${uid}"]`)?.focus({ preventScroll: true });
  };
  box.addEventListener("pointerup", finish);
  box.addEventListener("pointercancel", finish);
  box.addEventListener("keydown", (event) => {
    const el = event.target.closest(".decor.drag");
    if (!el) return;
    const step = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }[event.key];
    const uid = el.dataset.uid;
    if (step) {
      event.preventDefault();
      const p = state.player.decor.find((d) => d.uid === uid);
      savePlayer(moveDecor(state.player, uid, p.x + step[0], p.y + step[1]));
      state.buildSelected = uid;
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      state.buildSelected = state.buildSelected === uid ? null : uid;
    } else return;
    drawBuildScene();
    box.querySelector(`[data-uid="${uid}"]`)?.focus({ preventScroll: true });
  });
  box.addEventListener("click", (event) => {
    const away = event.target.closest("[data-put-away]");
    if (away) {
      savePlayer(removeDecor(state.player, away.dataset.putAway));
      state.buildSelected = null;
      renderBuild();
    } else if (event.target.closest("[data-deselect]")) {
      state.buildSelected = null;
      drawBuildScene();
    }
  });
}

/* ==================== Badges ==================== */

/** Badge ids this player can work toward (no Revision Ridge badges for a 4th grader). */
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

/* ==================== Progress (open to everyone) ==================== */

/** A player's full progress: this week, every skill's levels and badge, and the sentences missed most. */
function playerDetailHtml(p, now) {
  const itemById = (id) => state.content.items.find((item) => item.id === id);
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
    <div class="sheet-actions start"><button type="button" class="secondary" data-teacher-report="${esc(p.id)}">📄 Teacher report</button></div>
  </section>`;
}

/* ==================== Teacher report ==================== */

function currentReport() {
  const p = state.players.find((x) => x.id === state.reportPlayer);
  return p ? teacherReport(p, state.content, { now: Date.now(), range: $("report-range").value }) : null;
}

function reportHtml(r, note) {
  const levelCell = (l) => (l.passed ? `<span class="rep-pass">✓ ${"★".repeat(l.stars)}</span>` : '<span class="muted">—</span>')
    + (l.grade ? `<small>gr ${l.grade}</small>` : "");
  // Skills not started yet are listed by name only, so the printout stays short.
  const started = (s) => s.answers > 0 || s.levels.some((l) => l.passed);
  const worlds = r.worlds.filter((w) => w.skills.some(started)).map((w) => ({ ...w, waiting: w.skills.filter((s) => !started(s)), skills: w.skills.filter(started) })).map((w) => `<section class="rep-world"><h3>${w.emoji} ${esc(w.name)}</h3>
    <table class="rep-table"><thead><tr><th scope="col">Skill</th><th scope="col">Level 1</th><th scope="col">Level 2</th><th scope="col">Level 3</th><th scope="col">Badge</th><th scope="col">First try</th></tr></thead>
    <tbody>${w.skills.map((s) => `<tr><th scope="row">${esc(s.name)}<small>${esc(s.benchmarks)}</small></th>${s.levels.map((l) => `<td>${levelCell(l)}</td>`).join("")}
      <td>${s.badge || "—"}</td><td>${s.firstTryText}${s.answers ? `<small>${s.answers} answers</small>` : ""}</td></tr>`).join("")}</tbody></table>
    ${w.waiting.length ? `<p class="rep-waiting">Not started yet: ${w.waiting.map((s) => esc(s.name)).join(", ")}</p>` : ""}</section>`).join("")
    || '<p class="note">No skills started yet.</p>';
  const untouched = r.worlds.filter((w) => !w.skills.some(started)).map((w) => esc(w.name));
  const shurley = r.shurley.length ? `<section><h3>Shurley-style Q&amp;A Flow</h3><ul class="rep-list">${r.shurley.map((s) =>
    `<li><strong>${esc(s.name)}:</strong> ${s.passed} of 3 levels passed${s.badge ? ` (${s.badge})` : ""}</li>`).join("")}</ul></section>` : "";
  const needs = r.needs.length
    ? `<ul class="rep-list">${r.needs.map((n) => `<li><strong>${esc(n.name)}</strong> (${n.firstTryText} right on the first try)${n.examples.length
      ? `<ul>${n.examples.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}</li>`).join("")}</ul>`
    : '<p class="note">Nothing stands out: no skill with enough answers is under 75% right on the first try.</p>';
  return `<header class="rep-head"><img src="icons/icon-96.png" alt="" width="48" height="48">
      <div><h2>${esc(r.name)} · Grade ${r.grade}</h2><p>Sentence Builders progress report · made ${r.made} · covering ${r.rangeLabel}</p></div></header>
    <div class="rep-stats"><div><strong>${r.habits.minutes}</strong><span>minutes practiced</span></div>
      <div><strong>${r.habits.days}</strong><span>days played</span></div><div><strong>${r.habits.passed}</strong><span>levels passed</span></div></div>
    ${note.trim() ? `<p class="rep-note"><strong>Note from home:</strong> ${esc(note.trim())}</p>` : ""}
    <section><h3>Needs practice</h3>${needs}</section>
    ${shurley}
    <h3 class="rep-skills-title">Skills to date</h3>
    <p class="note">A level is passed with 6 of 8 right. First try: the share of answers right without a hint, over all practice.</p>
    ${worlds}
    ${untouched.length ? `<p class="rep-waiting">Not started yet: ${untouched.join(", ")}.</p>` : ""}
    <footer class="rep-foot">Sentence Builders is a free grammar practice game for grades 3–8 with original sentences, built on the 2020 Minnesota ELA standards and Shurley-style Q&amp;A Flow. It practices skills taught in class; it isn't a test.</footer>`;
}

function drawReport() {
  const r = currentReport();
  if (r) $("report-sheet").innerHTML = reportHtml(r, $("report-note").value);
}

function openReport(playerId) {
  state.reportPlayer = playerId;
  $("report-note").value = "";
  $("report-status").textContent = "";
  drawReport();
  showScreen("report");
  window.scrollTo(0, 0);
}

async function shareReport() {
  const r = currentReport();
  if (!r) return;
  const text = reportText(r, $("report-note").value);
  const title = `Sentence Builders report: ${r.name}`;
  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      return;
    }
    await navigator.clipboard.writeText(text);
    $("report-status").textContent = "Copied. Paste it into an email or message.";
  } catch (error) {
    if (error?.name === "AbortError") return; // closed the share sheet
    window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text.slice(0, 1800))}`;
  }
}

/** Everyone on this device at a glance: buildings built, levels, badges and this week. No details. */
function playerSummaryHtml(p, now, isMe) {
  const skills = visibleSkills(p);
  const total = skills.length * 3;
  const built = skills.reduce((n, s) => n + [1, 2, 3].filter((l) => isPassed(p, s.id, l)).length, 0);
  const week = weekSummary(p, now);
  const badges = Object.values(currentBadges(p)).filter(Boolean).length;
  const last = p.days.length ? [...p.days].sort().at(-1) : null;
  return `<article class="card summary-card${isMe ? " me" : ""}" data-summary-player="${esc(p.id)}">
    <div class="summary-head"><span class="summary-avatar" aria-hidden="true">${p.avatar}</span>
      <span><strong>${esc(p.name)}${isMe ? " (you)" : ""}</strong><span class="muted">Grade ${p.grade} · ${last ? `last played ${last === localDate(now) ? "today" : last}` : "hasn't played yet"}</span></span></div>
    <div class="summary-meter" role="img" aria-label="${built} of ${total} buildings built"><span style="width:${total ? Math.round((built / total) * 100) : 0}%"></span></div>
    <p class="summary-line"><strong>${built}</strong> of ${total} buildings · 🏅 ${badges} badge${badges === 1 ? "" : "s"} · ${week.minutes} min this week</p>
  </article>`;
}

/**
 * Progress, like Bible Trivia and World Geography: "Me" has the current player's full details; "Everyone"
 * (2+ players) has a short summary card each. From Who's playing (no one picked) it shows Everyone.
 */
function renderParent(tab = state.progressTab || "me") {
  const now = Date.now();
  const me = document.body.dataset.screen === "players" || !state.player ? null
    : state.players.find((p) => p.id === state.player.id) || null;
  if (document.body.dataset.screen !== "parent") state.progressMe = me;
  const current = document.body.dataset.screen === "parent" ? state.progressMe : me;
  const many = state.players.length > 1;
  const view = !current ? "everyone" : many ? tab : "me";
  state.progressTab = view;
  const tabs = current && many ? `<div class="progress-tabs" role="tablist" aria-label="Whose progress">
      <button type="button" role="tab" class="progress-tab" data-progress-tab="me" aria-selected="${view === "me"}">Me</button>
      <button type="button" role="tab" class="progress-tab" data-progress-tab="everyone" aria-selected="${view === "everyone"}">Everyone</button></div>` : "";
  const players = [...state.players].sort((a, b) => (b.id === current?.id) - (a.id === current?.id));
  const body = !state.players.length ? '<p class="note">No players yet.</p>'
    : view === "me" ? playerDetailHtml(current, now)
    : `${players.map((p) => playerSummaryHtml(p, now, p.id === current?.id)).join("")}
      <p class="note">${current ? "Each player sees their own details under Me." : "Pick a player on Who's playing to see their full progress."}</p>`;
  $("parent-players").innerHTML = tabs + body;
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
    if (state.player) {
      renderHome();
      fillSettings();
      $("backup-status").textContent = `Restored ${names}.`;
    } else {
      closeOverlay("settings-overlay");
      renderPlayers();
    }
  } catch {
    $("backup-status").textContent = "That file isn't a Sentence Builders backup.";
  }
}

/* ==================== Settings ==================== */

/* ==================== Edit player (✏️ on a player card) ==================== */
// Changes stay in the sheet until Save; Cancel, Escape or the phone's Back close it without saving.

function drawEditAvatars() {
  $("edit-avatar-grid").innerHTML = avatarGridHtml(state.edit.avatar, "data-edit-avatar", Number($("edit-grade").value) >= STUDIO_FROM_GRADE);
}

function openEditPlayer(id) {
  const p = state.players.find((x) => x.id === id);
  if (!p) return;
  state.edit = { id, avatar: p.avatar };
  $("edit-name").value = p.name;
  $("edit-grade").value = String(p.grade);
  $("edit-error").textContent = "";
  $("edit-delete").textContent = "Delete player";
  $("edit-delete").dataset.armed = "";
  drawEditAvatars();
  openOverlay("edit-overlay");
  $("edit-title").focus();
  document.querySelector("#edit-overlay .sheet").scrollTop = 0;
}

function afterPlayersChanged() {
  if (!$("home").hidden && state.player) renderHome();
  else if (!$("players").hidden) renderPlayers();
}

function saveEditPlayer(event) {
  event.preventDefault();
  const name = $("edit-name").value.trim();
  if (!name) {
    $("edit-error").textContent = "Type a name or nickname.";
    $("edit-name").focus();
    return;
  }
  const p = state.players.find((x) => x.id === state.edit.id);
  const updated = { ...p, name, grade: Number($("edit-grade").value), avatar: state.edit.avatar };
  state.players = state.players.map((x) => (x.id === updated.id ? updated : x));
  savePlayers(state.players);
  if (state.player?.id === updated.id) state.player = updated;
  applyTheme();
  state.edit = null;
  closeOverlay("edit-overlay");
  afterPlayersChanged();
}

function deleteEditPlayer() {
  const btn = $("edit-delete");
  const p = state.players.find((x) => x.id === state.edit.id);
  if (!btn.dataset.armed) {
    btn.dataset.armed = "1";
    btn.textContent = `Tap again to delete ${p.name} and all their progress`;
    return;
  }
  state.players = state.players.filter((x) => x.id !== p.id);
  savePlayers(state.players);
  if (state.player?.id === p.id) {
    state.player = null;
    saveCurrentId(null);
  }
  state.edit = null;
  closeOverlay("edit-overlay");
  if (!state.players.length) openAddPlayer();
  else if (state.player && !$("home").hidden) renderHome();
  else renderPlayers();
}

function openSettings() {
  fillSettings();
  $("backup-status").textContent = "";
  openOverlay("settings-overlay");
}

function fillSettings() {
  const s = settings();
  $("set-break").value = String(s.breakMinutes || 0);
  $("set-autoread").checked = s.autoRead;
  $("set-pip").checked = s.pip;
  $("set-sound").checked = s.sound;
  $("set-theme").value = s.theme || "auto";
  $("set-font").value = s.font || "game";
  $("set-size").value = s.textSize || "normal";
  $("set-spacing").checked = Boolean(s.spacing);
  $("set-showwords").checked = Boolean(s.showWords);
  $("set-island").checked = Boolean(s.islandHome);
  $("set-calm").checked = Boolean(s.calm);
  $("island-toggle").hidden = state.player.grade > ISLAND_HOME_MAX_GRADE;
  $("set-autoread").closest("label").hidden = !canSay();
  const names = s.names || {};
  $("set-names-on").checked = Boolean(names.on);
  $("names-fields").hidden = !names.on;
  for (let i = 0; i < MAX_PEOPLE; i++) {
    const person = names.people?.[i] || (i === 0 ? { name: state.player.name.split(" ")[0] } : {});
    $(`set-name-${i}`).value = person.name || "";
    $(`set-pron-${i}`).value = person.pronoun || "";
  }
  $("set-pet").value = names.pet || "";
  $("names-status").textContent = "";
}

/** Names in sentences, from the Settings fields. A name that can't be used is left out, and the note says so. */
function readNames() {
  const people = [];
  const skipped = [];
  for (let i = 0; i < MAX_PEOPLE; i++) {
    const raw = $(`set-name-${i}`).value.trim();
    const name = cleanName(raw);
    if (raw && !name) skipped.push(raw);
    else if (name && !$(`set-pron-${i}`).value) skipped.push(`${name} (pick he or she)`);
    people.push({ name: name || "", pronoun: $(`set-pron-${i}`).value });
  }
  const rawPet = $("set-pet").value.trim();
  const pet = cleanName(rawPet);
  if (rawPet && !pet) skipped.push(rawPet);
  $("names-status").textContent = skipped.length ? `Not used yet: ${skipped.join(", ")}. Use one first name, letters only.` : "";
  return { on: $("set-names-on").checked, people, pet };
}

function changeSetting() {
  const player = {
    ...state.player,
    settings: { ...state.player.settings, autoRead: $("set-autoread").checked, pip: $("set-pip").checked, sound: $("set-sound").checked,
      theme: $("set-theme").value, breakMinutes: Number($("set-break").value),
      font: $("set-font").value, textSize: $("set-size").value, spacing: $("set-spacing").checked, names: readNames(),
      showWords: $("set-showwords").checked, islandHome: $("set-island").checked, calm: $("set-calm").checked },
  };
  $("names-fields").hidden = !player.settings.names.on;
  savePlayer(player);
}

/* ==================== Wiring ==================== */

function gradeOptions() {
  return Array.from({ length: MAX_GRADE - MIN_GRADE + 1 }, (_, i) => MIN_GRADE + i)
    .map((g) => `<option value="${g}">Grade ${g}</option>`).join("");
}

function wire() {
  $("player-grade").innerHTML = gradeOptions();
  $("player-grade").addEventListener("change", drawAvatars);
  $("edit-grade").innerHTML = gradeOptions();
  $("edit-grade").addEventListener("change", drawEditAvatars);
  $("edit-form").addEventListener("submit", saveEditPlayer);
  $("edit-delete").addEventListener("click", deleteEditPlayer);

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
      return;
    }
    if (target.closest("[data-add-player]")) return openAddPlayer();
    const buy = target.closest("[data-buy]");
    if (buy) return buyDecoration(buy.dataset.buy);
    if (target.closest("#homework-btn")) return startHomework();
    if (target.closest("#week-btn, [data-week]")) return openWeek();
    if (target.closest("[data-meet-pip]")) {
      if (!state.player) return;
      renderHome();
      return openPipIntro();
    }
    if (target.closest("[data-peaks]")) {
      // Show Grammar Peaks on the map, with its two rounds just below it.
      state.map.focus("peaks");
      const card = $("town").closest(".town-card");
      card.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      return;
    }
    const practice = target.closest("[data-practice]");
    if (practice) return startPractice(practice.dataset.practice);
    const nextUpBtn = target.closest("[data-next-up]");
    if (nextUpBtn) {
      const [skillId, level] = nextUpBtn.dataset.nextUp.split(/-(?=\d$)/);
      return openTip(skillId, Number(level));
    }
    if (target.closest("#island-build")) {
      if (!playedToday(state.player)) {
        $("pip-home").innerHTML = pipSays("Let's do a lesson first! Then you can build with your bricks.", true, $("pip-home").querySelector(".next-play")?.outerHTML || "");
        return;
      }
      state.buildArea = buildAreaFor(state.player, state.mapArea);
      return renderBuild();
    }
    if (target.closest("#build-btn")) {
      state.buildArea = buildAreaFor(state.player, state.mapArea);
      renderBuild();
      window.scrollTo(0, 0);
      return;
    }
    if (target.closest("[data-about]")) {
      state.aboutFrom = topOverlay()?.id === "settings-overlay" ? "settings" : document.body.dataset.screen;
      closeOverlay("settings-overlay");
      showScreen("about");
      window.scrollTo(0, 0);
      return;
    }
    if (target.closest("[data-progress]")) {
      closeOverlay("settings-overlay");
      state.progressTab = "me";
      return renderParent();
    }
    const progressTab = target.closest("[data-progress-tab]");
    if (progressTab) return renderParent(progressTab.dataset.progressTab);
    const playerBtn = target.closest("[data-player]");
    if (playerBtn) return choosePlayer(playerBtn.dataset.player);
    const editBtn = target.closest("[data-edit-player]");
    if (editBtn) return openEditPlayer(editBtn.dataset.editPlayer);
    const editAvatar = target.closest("[data-edit-avatar]");
    if (editAvatar && state.edit) {
      state.edit.avatar = editAvatar.dataset.editAvatar;
      drawEditAvatars();
      return;
    }
    const avatar = target.closest("[data-avatar]");
    if (avatar) {
      state.newAvatar = avatar.dataset.avatar;
      drawAvatars();
      return;
    }
    const buildArea = target.closest("[data-build-area]");
    if (buildArea) {
      state.buildArea = buildArea.dataset.buildArea;
      state.buildSelected = null;
      return renderBuild();
    }
    const decorate = target.closest("[data-decorate]");
    if (decorate) {
      state.buildArea = decorate.dataset.decorate;
      renderBuild();
      window.scrollTo(0, 0);
      return;
    }
    if (target.closest("[data-map-fit]")) return state.map.fit();
    const sheet = target.closest("[data-skill-sheet]");
    if (sheet) return openSkillSheet(sheet.dataset.skillSheet);
    const world = target.closest("[data-world], [data-open-world]");
    if (world) return renderWorld(world.dataset.world || world.dataset.openWorld);
    const levelBtn = target.closest(".level-btn");
    if (levelBtn) {
      closeOverlay("skill-overlay"); // the level card from the map gives way to the Tip Card
      return openTip(levelBtn.dataset.skill, Number(levelBtn.dataset.level));
    }
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
  $("pip-intro-next").addEventListener("click", () => {
    if (state.pipIntro + 1 < PIP_INTRO.length) {
      state.pipIntro += 1;
      drawPipIntro();
    } else closePipIntro();
  });
  $("pip-intro-skip").addEventListener("click", closePipIntro);
  // About goes back where it came from: Settings (over the town) or Who's playing?
  $("build-back").addEventListener("click", () => renderHome());
  initBuildDragging();
  state.map = createTownMap($("town"), { zIn: $("map-in"), zOut: $("map-out"), zFit: $("map-fit") }, {
    onArea: (area) => {
      state.mapArea = area;
      drawMapPanel();
    },
    onLot: openSkillSheet,
    onBoard: openWeek,
  });
  $("about-back").addEventListener("click", () => {
    if (state.aboutFrom === "settings" && state.player) {
      renderHome();
      openSettings();
    } else if (state.player && state.aboutFrom !== "players") renderHome();
    else renderPlayers();
  });
  $("parent-back").addEventListener("click", () => (state.player ? renderHome() : renderPlayers()));
  $("parent-players").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-teacher-report]");
    if (btn) openReport(btn.dataset.teacherReport);
  });
  $("report-back").addEventListener("click", () => renderParent("me"));
  $("report-range").addEventListener("change", drawReport);
  $("report-note").addEventListener("input", drawReport);
  $("report-print").addEventListener("click", () => window.print());
  $("report-share").addEventListener("click", shareReport);
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
    const toTab = event.target.closest("[data-rules-link]");
    if (toTab) {
      renderRules(toTab.dataset.rulesLink);
      window.scrollTo(0, 0);
      return;
    }
    const btn = event.target.closest("[data-say-rule]");
    if (!btn) return;
    const tip = state.content.tips[btn.dataset.sayRule];
    say(`${tip.title}. ${tip.rule} For example: ${tip.example}`);
  });
  $("rules-search").addEventListener("input", (event) => {
    const q = event.target.value.trim();
    if (q.length >= 2) renderRuleSearch(q);
    else if (!q) renderRules(state.rulesTab);
  });
  $("rules-tabs").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-rules-tab]");
    if (btn) {
      renderRules(btn.dataset.rulesTab);
      window.scrollTo(0, 0);
    }
  });
  $("say-btn").addEventListener("click", readItem);
  $("week-body").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-week-day]");
    if (btn) startWeekDay(Number(btn.dataset.weekDay));
  });
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
    const mode = state.play.mode;
    state.play = null;
    if (mode) renderHome(); // homework and Grammar Peaks rounds start from the island
    else renderWorld(skill.world);
  });
  $("result-next").addEventListener("click", () => {
    closeOverlay("result-overlay");
    const next = state.resultNext;
    if (next.weekDay !== undefined) startWeekDay(next.weekDay);
    else if (next.home) renderHome();
    else if (next.homework) startHomework();
    else if (next.practice) startPractice(next.practice);
    else if (next.world) renderWorld(next.world);
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
  for (const id of ["set-autoread", "set-pip", "set-sound", "set-theme", "set-break", "set-font", "set-size", "set-spacing", "set-showwords", "set-island", "set-calm", "set-names-on", "set-pet",
    ...Array.from({ length: MAX_PEOPLE }, (_, i) => [`set-name-${i}`, `set-pron-${i}`]).flat()]) $(id).addEventListener("change", changeSetting);
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
  else if (screen === "report") $("report-back").click();
  else if (screen === "about") $("about-back").click();
  else if (screen === "build") renderHome();
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
