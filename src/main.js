// Startup and screens: players, the town, worlds, levels, results, badges and settings.
import {
  AVATARS, AVATAR_GROUPS, HABIT_BADGES, ITEMS_PER_LEVEL, MAX_GRADE, MAX_PLAYERS, MIN_GRADE, PIP, PIP_INTRO, DECOR, decorFor, HOMEWORK_PER_ROUND, PRACTICE_PER_ROUND, PRACTICE_GOAL, clampSpot, SKILLS, SPELLING_RULES, STUDIO_FROM_GRADE, NOUN_TABLE_FROM_GRADE, NOUN_KINDS, NOUN_REMINDERS_UNTIL, TIER_NAMES, WORLDS, WORLD_BADGES,
  GOLD_DAYS, SENTENCE_KINDS, LABELS, LABEL_LISTS, PATTERNS, FLOW_LABELS, FLOW_PATTERNS, WORD_LISTS, WORD_PARTS, skillById, skillOpenFor, skillsInWorld, skillsInWorldFor, worldOpenFor, PIP_GROWN, GROWN_PIP_FROM_GRADE, CHALLENGE_PREREQS, CHALLENGE_UP_TO_GRADE, unlockMode, skillGate, PLAN_STYLES} from "./config.js";
import { answerText, parseFlow, spokenText } from "./lib/parse.js";
import { pickDailyItems, pickLevelItems, pickSpeedItems, pickSpellingItems, pickSummitItems, parseSpeedCode, speedCode } from "./lib/select.js";
import { recordHomework, recordPractice, buyDecor, moveDecor, removeDecor,
  currentBadges, habitValue, isPassed, isUnlocked, levelStars, localDate, mostMissed, newPlayer, normalizePlayer,
  passedKeys, recordLevel, skillTier, weekSummary, recordWeekDay, isChallenge, isMastered, openChallenge, streakDays, isBetterSpeed, TESTOUT_PASS, mysteryPrize} from "./lib/progress.js";
import { loadCurrentId, loadPlayers, saveCurrentId, savePlayers } from "./storage.js";
import { districtSkills, mapDistricts, mapLayout, parkSvg, pipSays, pipSvg, townSvg } from "./ui/art.js";
import { createTownMap } from "./ui/townmap.js";
import { $, closeOverlay, esc, initBackButton, openOverlay, pick, showScreen, topOverlay } from "./ui/dom.js";
import { renderItem } from "./ui/items.js";
import { reportText, teacherReport } from "./lib/report.js";
import { WEEK_BONUS, WEEK_DAYS, nextDay, openDays, todayIndex, weekDayItems, bandFor, weekFor, weekKey, weekProgress, weekSentence } from "./lib/week.js";
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

/** Grades 6–8 see their own work first: Revision Ridge and Flow Factory lead the list, Advanced Q&A Flow first in it. */
const OLDER_FROM_GRADE = 6;
const LEAD_WORLDS = ["desk", "flow"];
const LEAD_SKILLS = ["flow2"];
const worldsFor = (player) => (player.grade < OLDER_FROM_GRADE ? WORLDS
  : [...LEAD_WORLDS.map((id) => WORLDS.find((w) => w.id === id)), ...WORLDS.filter((w) => !LEAD_WORLDS.includes(w.id))]);
const skillsInWorldOrdered = (worldId, player) => {
  const list = skillsInWorldFor(worldId, player);
  return player.grade < OLDER_FROM_GRADE ? list : [...list.filter((s) => LEAD_SKILLS.includes(s.id)), ...list.filter((s) => !LEAD_SKILLS.includes(s.id))];
};

/**
 * The next level to play. Grades 3–5: the first one not passed, in list order. Grades 6–8 (following the UI expert,
 * the product owner and an 8th-grade playtester): middle-school levels up to their grade first (in each skill's
 * order, so level 1 still comes before level 2), then a grade ahead, and only then the grade 3–5 levels, as review.
 */
/** A grade 3–5 level a grade 6–8 player tested out of (its world's test-out was passed). */
const isReviewed = (player, skill, level) => player.grade >= OLDER_FROM_GRADE && skill.grades[level - 1] <= 5 && Boolean(player.reviewed?.[skill.world]);

function nextUp(player) {
  if (player.grade >= OLDER_FROM_GRADE) {
    const g = player.grade;
    const rank = (lg) => (lg >= OLDER_FROM_GRADE && lg <= g ? 0 : lg > g ? 1 : 2 + (g - lg));
    const order = worldsFor(player).flatMap((w) => skillsInWorldOrdered(w.id, player)).filter((sk) => visibleSkills(player).includes(sk));
    const open = order.flatMap((skill) => [1, 2, 3].map((level) => ({ skill, level, r: rank(skill.grades[level - 1]) })))
      .filter(({ skill, level }) => isUnlocked(player, skill.id, level) && !isPassed(player, skill.id, level) && !isReviewed(player, skill, level));
    const best = open.reduce((a, b) => (b.r < a.r ? b : a), open[0]);
    return best ? { skill: best.skill, level: best.level } : null;
  }
  for (const skill of visibleSkills(player)) {
    for (const level of [1, 2, 3]) {
      if (isUnlocked(player, skill.id, level) && !isPassed(player, skill.id, level)) return { skill, level };
    }
  }
  return null;
}

/** The ▶ Play button for the next level (kept in Pip's bubble whatever he's saying, so it never disappears). */
function playButton(player) {
  const next = nextUp(player);
  return next ? `<button type="button" class="primary next-play" data-next-up="${next.skill.id}-${next.level}">▶ Play</button>` : "";
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

/* ==================== The blueprint (grades 6–8) ==================== */
// Following the teaching and UI experts: older players see the same island as an architect's plan, with each
// skill's levels and first-try rate, and no decorations or brick shop (Settings can bring the colors back).

const BLUEPRINT_FROM_GRADE = 6;
const blueprintOn = (player) => player.grade >= BLUEPRINT_FROM_GRADE && !player.settings?.showIsland;

/** First-try rate (0–100) per skill, from every answer so far; skills not practiced yet are left out. */
function skillRates(player) {
  const byId = new Map(state.content.items.map((item) => [item.id, item.skill]));
  const sums = {};
  for (const [id, st] of Object.entries(player.items || {})) {
    const skill = byId.get(id);
    if (!skill) continue;
    const row = (sums[skill] ||= { seen: 0, misses: 0 });
    row.seen += st.seen;
    row.misses += st.misses;
  }
  return Object.fromEntries(Object.entries(sums).filter(([, r]) => r.seen).map(([k, r]) => [k, Math.round(((r.seen - r.misses) / r.seen) * 100)]));
}

/** Points toward blueprint styles: final drafts beaten plus skills at Gold. */
const planPoints = (player) => Object.keys(player.bosses || {}).length + SKILLS.filter((s) => skillTier(player, s.id) === 3).length;
function planStyle(player) {
  const want = PLAN_STYLES.find((st) => st.id === player.settings?.planStyle);
  return want && planPoints(player) >= want.points ? want.id : "classic";
}
function planStyleOptions(player) {
  const pts = planPoints(player);
  const now = planStyle(player);
  return PLAN_STYLES.map((st) => `<option value="${st.id}" ${st.id === now ? "selected" : ""} ${pts >= st.points ? "" : "disabled"}>${esc(st.name)}${pts >= st.points ? "" : ` (🔒 ${st.points - pts} more)`}</option>`).join("");
}

function blueprintSummary(player, rates) {
  const skills = visibleSkills(player);
  const built = skills.reduce((n, s) => n + [1, 2, 3].filter((l) => isPassed(player, s.id, l)).length, 0);
  const weak = skills.filter((s) => rates[s.id] != null && rates[s.id] < 75).length;
  const missed = Object.values(player.items || {}).filter((st) => st.misses > 0).length;
  return [`${built} of ${skills.length * 3} levels built`, weak ? `${weak} skill${weak === 1 ? "" : "s"} under 75%` : "", missed ? `${missed} to review` : ""].filter(Boolean).join(" · ");
}

function islandBarHtml(player) {
  const info = weekMapInfo(player);
  const streak = streakDays(player.days, Date.now());
  const dailyDone = player.dailyOn === localDate(Date.now());
  $("island-daily").innerHTML = `<span aria-hidden="true">${streak ? "🔥" : "⚡"}</span> ${streak ? `${streak} · ` : ""}Daily 5${dailyDone ? " ✓" : ""}`;
  $("island-daily").setAttribute("aria-label", `${streak ? `${streak}-day streak. ` : ""}Daily 5${dailyDone ? ", done today" : ""}`);
  $("island-board").innerHTML = `<span aria-hidden="true">📌</span> Board${info?.waiting ? ' <span class="island-dot" aria-label="something is waiting">!</span>' : ""}`;
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
  const blueprint = blueprintOn(player);
  // The blueprint is a plan, not an island: grades 6–8 go "Back to home".
  $("result-town").textContent = blueprint ? "Back to home" : "Back to the island";
  document.querySelectorAll('.back[data-go="home"]').forEach((b) => b.setAttribute("aria-label", blueprint ? "Back to home" : "Back to the island"));
  const rates = blueprint ? skillRates(player) : null;
  document.body.classList.toggle("blueprint-home", blueprint);
  $("build-btn").hidden = blueprint;
  $("bp-head").hidden = !blueprint;
  const preview = blueprint && !state.mapOpen;
  $("town").closest(".town-card").classList.toggle("bp-preview", preview);
  $("map-expand").hidden = !preview;
  if (blueprint) {
    $("town-title").textContent = "📐 Island plan";
    $("bp-summary").textContent = blueprintSummary(player, rates);
    $("bp-toggle").textContent = state.mapOpen ? "Smaller" : "Open the plan";
    $("bp-style").innerHTML = planStyleOptions(player);
  } else $("town-title").textContent = "🏝️ Grammar Island";
  $("who-btn").innerHTML = `<span class="avatar" aria-hidden="true">${player.avatar}</span> ${esc(player.name)}`;
  // Grades 3–5: a Challenge Trail that's ready opens (one a day), and Pip says why.
  const challenge = openChallenge(player, Date.now());
  if (challenge.opened) {
    savePlayer(challenge.player);
    state.newChallenge = challenge.opened;
    return renderHome();
  }
  const next = nextUp(player);
  const due = island ? reviewDue(player) : 0;
  let greeting = next
    ? `Hi ${player.name}! Next up: ${next.skill.name}, level ${next.level}.`
    : `Every building is up, ${player.name}. Go for Gold: score 7 or more on a level 3, on two different days.`;
  // The next level is one tap away: a Play button in Pip's bubble (or on its own when Pip is off).
  let play = playButton(player);
  if (due) {
    // Island Home: review that's due comes before new levels, at Pip's Review Dock (Summit Review).
    greeting = `Review first, ${player.name}! ${due} sentences you missed are waiting at the Review Dock.`;
    play = `<button type="button" class="primary next-play" data-practice="summit">🔁 Review</button>${next ? `<button type="button" class="link" data-next-up="${next.skill.id}-${next.level}">or a new lesson</button>` : ""}`;
  }
  if (state.newChallenge) {
    const [id, lv] = [state.newChallenge.replace(/-\d$/, ""), Number(state.newChallenge.slice(-1))];
    const skill = skillById(id);
    const why = lv === 1
      ? `You mastered ${CHALLENGE_PREREQS[id].map((p) => skillById(p).name).join(" and ")}`
      : `You got ${skill.name} level ${lv - 1} right on two different days`;
    greeting = `${why}, so you opened a Challenge Trail: ${skill.name}, level ${lv}! ⭐`;
    play = `<button type="button" class="primary next-play" data-next-up="${id}-${lv}">▶ Try it</button>`;
    state.newChallenge = null;
  }
  if (island) {
    islandBarHtml(player);
    // Open on the next lesson's part of the island (or the peaks, when review comes first).
    if (!state.mapArea && !state.rising) state.mapArea = due ? "peaks" : next?.skill.world || null;
  }
  // Island Home: Pip's message can be tucked away so it doesn't cover the map; the Play (or Review) button stays.
  const mainPlay = play.match(/^<button[^>]*>.*?<\/button>/)?.[0] || "";
  if (island && state.pipMin) {
    $("pip-home").innerHTML = `<button type="button" class="pip-mini" data-pip-expand aria-label="Show Pip's message">${settings().pip ? pipSvg(44) : "💬"}</button>${mainPlay}`;
  } else {
    const tuck = island ? '<button type="button" class="pip-min" data-pip-min aria-label="Make Pip\'s message smaller">–</button>' : "";
    // From grade 6 there's no greeting: just what's next and the Play button.
    $("pip-home").innerHTML = settings().pip && !grownPip()
      ? pipSays(greeting, true, play + tuck)
      : next || due ? `<p class="next-line">${due ? esc(greeting) : `Next up: ${esc(next.skill.name)}, level ${next.level}.`} ${play}${tuck}</p>` : "";
  }
  $("pip-home").classList.toggle("mini", Boolean(island && state.pipMin));
  // A building that just went up: the map opens on its district so the rise is seen.
  const risingSkill = state.rising && skillById(state.rising.replace(/-\d$/, ""));
  if (risingSkill) state.mapArea = risingSkill.world;
  const open = state.mapArea === "peaks" || mapDistricts(player).some((d) => d.id === state.mapArea);
  state.map.show(townSvg(player, { rising: state.rising, week: weekMapInfo(player), review: due > 0, blueprint: blueprint ? { rates, style: planStyle(player) } : null }), mapLayout(player), open ? state.mapArea : null);
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
  $("daily-btn").innerHTML = dailyCardHtml(player);
  $("daily-btn").classList.toggle("done", player.dailyOn === localDate(Date.now()));
  $("today-title").textContent = grownPip() ? "Today" : "Today with Pip";
  // A player who hasn't met Pip yet gets his welcome once (unless Pip is turned off).
  if (!player.introSeen && settings().pip && !topOverlay()) setTimeout(() => !$("home").hidden && !topOverlay() && openPipIntro(), 250);
  // Island Home: the Notice Board opens by itself once a day, when something is waiting, before free roaming.
  else if (island && player.boardSeenOn !== localDate(Date.now()) && weekMapInfo(player)?.waiting && !topOverlay()) {
    savePlayer({ ...player, boardSeenOn: localDate(Date.now()) });
    setTimeout(() => !$("home").hidden && !topOverlay() && openWeek(), 300);
  }
  const worldCards = worldsFor(player).map((world) => {
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
  const firstLocked = worldsFor(player).findIndex((w) => !worldOpenFor(w, player));
  worldCards.splice(firstLocked < 0 ? worldCards.length : firstLocked, 0, peaksCard, speedCardHtml(player));
  $("world-list").innerHTML = worldCards.join("");
  showScreen("home");
}

/* ==================== World ==================== */

function renderWorld(worldId) {
  state.worldId = worldId;
  const world = WORLDS.find((w) => w.id === worldId);
  const player = state.player;
  $("world-title").textContent = `${world.emoji} ${world.name}`;
  $("skill-list").innerHTML = bossCardHtml(worldId, player) + testoutCardHtml(worldId, player) + skillsInWorldOrdered(worldId, player).map((skill) => skillCardHtml(skill)).join("")
    + (world.comingSoon ? `<p class="note coming-soon">${esc(world.comingSoon)}</p>` : "");
  showScreen("world");
}

/* ==================== Pip's final draft (grades 6–8) ==================== */
// The 8th-grade playtester's boss round: one long paragraph of Pip's per world, packed with mistakes from that
// world's skills. Catch every one on the first try to beat it. It opens once two levels in the world are passed.

const BOSS_AFTER_LEVELS = 2;
const bossFor = (worldId) => (state.content.boss || []).find((b) => b.world === worldId);
const levelsPassedIn = (worldId, player) => skillsInWorldFor(worldId, player).reduce((n, s) => n + [1, 2, 3].filter((l) => isPassed(player, s.id, l)).length, 0);

function bossCardHtml(worldId, player) {
  const boss = bossFor(worldId);
  if (!boss || player.grade < OLDER_FROM_GRADE) return "";
  const passed = levelsPassedIn(worldId, player);
  const open = passed >= BOSS_AFTER_LEVELS;
  const beaten = Boolean(player.bosses?.[worldId]);
  const line = !open ? `Pass ${BOSS_AFTER_LEVELS - passed} more level${BOSS_AFTER_LEVELS - passed === 1 ? "" : "s"} here to unlock it.`
    : beaten ? "Beaten. Pip has been quiet about it." : "Pip hid six or seven mistakes in it. Catch every one on the first try to beat it.";
  return `<section class="boss-card${beaten ? " beaten" : ""}">
    <div><h2>📝 Pip's final draft${beaten ? ' <span class="boss-done">✓ Beaten</span>' : ""}</h2>
    <p class="boss-title">${esc(boss.title)}</p><p class="note">${esc(line)}</p></div>
    <button type="button" class="${beaten ? "secondary" : "primary"}" data-boss="${worldId}" ${open ? "" : "disabled"}>${beaten ? "Rematch" : open ? "Take it on" : "🔒 Locked"}</button>
  </section>`;
}

function startBoss(worldId) {
  const boss = bossFor(worldId);
  if (!boss) return;
  closeOverlay("result-overlay");
  state.play = { mode: "boss", world: worldId, skillId: "proofread", level: 1, items: withNames([{ ...boss, skill: "proofread", level: 1, type: "proofread" }]),
    index: 0, tries: 0, results: [], ctrl: null, done: false, startedAt: Date.now() };
  if (!state.sessionStart) state.sessionStart = Date.now();
  showScreen("play");
  showItem();
}

const BOSS_WON = ["Every single one? I hid those well. I thought I did.", "Fine. You found all of them. I'm rewriting it from scratch.", "Beaten. I'd like it noted that I was very close."];
const BOSS_LOST = ["Pip wins this round. A mistake or two got past you. Rematch?", "Ha. One of mine survived. Want a rematch?"];

function finishBoss() {
  const play = state.play;
  const now = Date.now();
  const beaten = play.results.every((r) => r.correct && r.tries === 1);
  const before = state.player;
  const rec = recordHomework(before, { results: play.results, now, durationMs: now - play.startedAt }).player;
  rec.homeworkOn = before.homeworkOn; // the final draft isn't the day's homework
  if (beaten) rec.bosses = { ...(rec.bosses || {}), [play.world]: localDate(now) };
  savePlayer(rec);
  $("progress-fill").style.width = "100%";
  $("result-stars").innerHTML = "";
  $("result-title").textContent = beaten ? "You beat Pip's final draft" : "Pip wins this round";
  $("result-score").textContent = `${bossFor(play.world).title} · ${WORLDS.find((w) => w.id === play.world).name}`;
  showResultBricks({ bricks: 0, player: rec }, "");
  $("result-pip").innerHTML = pipRemark(pick(beaten ? BOSS_WON : BOSS_LOST));
  $("result-badges").innerHTML = "";
  $("result-review").innerHTML = reviewHtml(play);
  state.resultNext = beaten ? { world: play.world } : { boss: play.world };
  $("result-next").textContent = beaten ? `Back to ${WORLDS.find((w) => w.id === play.world).name}` : "Rematch";
  $("result-again").hidden = true;
  $("result-rule").hidden = true;
  openOverlay("result-overlay");
  if (beaten) {
    sound("done", settings().sound);
    cheer(3);
  }
  state.play = null;
}

/* ==================== Test out (grades 6–8) ==================== */
// The playtester's "start me at my grade": in each world, 8 quick questions from its grade 3–5 levels. 7 right on
// the first try marks those levels Reviewed: out of Next up and the Daily 5, shown as reviewed in Progress.
// Retake any time. Reviewed levels still count as not passed for badges and buildings.

const TESTOUT_COUNT = 8;
function testoutKeys(worldId, player) {
  return skillsInWorldFor(worldId, player).flatMap((skill) => [1, 2, 3].filter((l) => skill.grades[l - 1] <= 5).map((l) => `${skill.id}-${l}`));
}
const testoutItems = (worldId, player) => pickDailyItems({ items: state.content.items, levelKeys: testoutKeys(worldId, player), stats: player.items, count: TESTOUT_COUNT });

function testoutCardHtml(worldId, player) {
  if (player.grade < OLDER_FROM_GRADE || testoutItems(worldId, player).length < TESTOUT_COUNT) return "";
  const on = player.reviewed?.[worldId];
  return `<section class="testout-card${on ? " done" : ""}"><div><h2>${on ? "✓ Grade 3–5 levels reviewed" : "Already know the grade 3–5 skills here?"}</h2>
    <p class="note">${on ? "They're out of Next up and the Daily 5. Retake it any time." : `Test out: ${TESTOUT_COUNT} quick questions. ${TESTOUT_PASS} right on the first try marks them Reviewed.`}</p></div>
    <button type="button" class="secondary" data-testout="${worldId}">${on ? "Retake" : "Test out"}</button></section>`;
}

function startTestout(worldId) {
  const items = testoutItems(worldId, state.player);
  if (!items.length) return;
  closeOverlay("result-overlay");
  state.play = { mode: "testout", world: worldId, skillId: items[0].skill, level: 1, items: withNames(items), index: 0, tries: 0, results: [], ctrl: null, done: false, startedAt: Date.now() };
  showScreen("play");
  showItem();
}

function finishTestout() {
  const play = state.play;
  const now = Date.now();
  const out = recordPractice(state.player, { kind: "testout", results: play.results, now, durationMs: now - play.startedAt });
  const passed = out.right >= TESTOUT_PASS;
  if (passed) out.player.reviewed = { ...(out.player.reviewed || {}), [play.world]: localDate(now) };
  savePlayer(out.player);
  const world = WORLDS.find((w) => w.id === play.world);
  $("progress-fill").style.width = "100%";
  $("result-stars").innerHTML = "";
  $("result-title").textContent = passed ? "Tested out" : "Not yet";
  $("result-score").textContent = `${out.right} of ${play.results.length} right on the first try · ${world.name}`;
  showResultBricks({ bricks: 0, player: out.player }, "");
  $("result-pip").innerHTML = pipRemark(passed ? `The grade 3–5 levels in ${world.name} are marked Reviewed. Next up skips them now.`
    : `${TESTOUT_PASS} of ${play.results.length} needed. Look at the ones below; you can retake it any time.`);
  $("result-badges").innerHTML = "";
  $("result-review").innerHTML = reviewHtml(play);
  state.resultNext = passed ? { home: true } : { testout: play.world };
  $("result-next").textContent = passed ? "Back to home" : "Retake";
  $("result-again").hidden = true;
  $("result-rule").hidden = true;
  openOverlay("result-overlay");
  if (passed) sound("done", settings().sound);
  state.play = null;
}

/* ==================== Speed Proofread ==================== */
// The playtester's pick: a 90-second round of quick questions near the player's grade. One try each; more right
// wins, and with the same number right, less time. A personal best is kept. Every round has a code ("G7-4821"):
// anyone who enters it gets the same questions, so a sibling or friend can race the same set, with no accounts.

const SPEED_MS = 90 * 1000;
const SPEED_COUNT = 12;
const clock = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
const speedKeys = (grade) => SKILLS.filter((s) => skillGate(s) <= grade)
  .flatMap((skill) => [1, 2, 3].filter((l) => skill.grades[l - 1] <= grade && skill.grades[l - 1] >= Math.max(3, grade - 2)).map((l) => `${skill.id}-${l}`));

function speedCardHtml(player) {
  const best = player.speedBest;
  return `<button type="button" class="world-card speed-card" data-speed>
    <span class="world-emoji" aria-hidden="true">⏱️</span>
    <span class="world-text"><span class="world-name">Speed Round</span><span class="world-blurb">90 seconds of quick questions, one try each. Beat your best, or race a friend with a code.</span></span>
    <span class="world-meta">${best ? `Best ${best.right} · ${clock(best.ms)}` : "No best yet"}</span></button>`;
}

function openSpeed() {
  const best = state.player.speedBest;
  $("speed-best").textContent = best ? `Your best: ${best.right} right in ${clock(best.ms)}.` : "No personal best yet.";
  $("speed-code").value = "";
  $("speed-code-msg").textContent = "";
  openOverlay("speed-overlay");
}

function startSpeed(grade, seed) {
  const items = pickSpeedItems({ items: state.content.items, levelKeys: speedKeys(grade), seed, count: SPEED_COUNT });
  if (!items.length) return;
  closeOverlay("speed-overlay");
  closeOverlay("result-overlay");
  const now = Date.now();
  state.play = { mode: "speed", grade, seed, deadline: now + SPEED_MS, skillId: items[0].skill, level: 1, items: withNames(items), index: 0, tries: 0, results: [], ctrl: null, done: false, startedAt: now };
  showScreen("play");
  showItem();
  clearInterval(state.speedTimer);
  state.speedTimer = setInterval(speedTick, 250);
}

function speedTick() {
  const play = state.play;
  if (!play || play.mode !== "speed") return clearInterval(state.speedTimer);
  const left = Math.max(0, play.deadline - Date.now());
  $("progress-text").textContent = `⏱ ${clock(left)}`;
  $("progress-text").classList.toggle("speed-low", left < 15000);
  if (left <= 0) finishLevel();
}

/** Everyone on this device who has played a code, best first: the 4th-grade playtester's sibling scoreboard. */
function speedBoardHtml(code) {
  const rows = state.players.map((p) => ({ p, run: p.speedRuns?.[code] })).filter((r) => r.run)
    .sort((a, b) => b.run.right - a.run.right || a.run.ms - b.run.ms);
  if (!rows.length) return "";
  return `<div class="speed-board"><h3 class="review-title">Scoreboard for ${code}</h3><ol>${rows.map(({ p, run }) =>
    `<li${p.id === state.player.id ? ' class="me"' : ""}><span>${p.avatar} ${esc(p.name)}</span><span>${run.right} right · ${clock(run.ms)}</span></li>`).join("")}</ol>
    ${rows.length === 1 ? '<p class="note">Hand the device to someone else, and they can enter this code from ⏱️ Speed Round.</p>' : ""}</div>`;
}

function finishSpeed() {
  clearInterval(state.speedTimer);
  const play = state.play;
  const now = Date.now();
  const ms = Math.min(now - play.startedAt, SPEED_MS);
  const prev = state.player.speedBest;
  const out = recordPractice(state.player, { kind: "speed", results: play.results, now, durationMs: ms });
  const run = { right: out.right, ms, on: localDate(now) };
  const best = isBetterSpeed(out.player.speedBest, run);
  if (best) out.player.speedBest = run;
  const code = speedCode(play.grade, play.seed);
  if (isBetterSpeed(out.player.speedRuns?.[code], run)) out.player.speedRuns = { ...(out.player.speedRuns || {}), [code]: { right: run.right, ms } };
  savePlayer(out.player);
  $("progress-fill").style.width = "100%";
  $("progress-text").classList.remove("speed-low");
  $("result-stars").innerHTML = "";
  $("result-title").textContent = best ? "New personal best!" : `${out.right} right`;
  $("result-score").textContent = `${out.right} right of ${play.results.length} answered · ${clock(ms)}${play.results.length === play.items.length ? " (all done)" : ""}`;
  showResultBricks(out, `+${out.bricks} 🧱 bricks`);
  $("result-pip").innerHTML = pipRemark(best ? (prev ? `Old best: ${prev.right} in ${clock(prev.ms)}. Not anymore.` : "First run on the board. Now beat it.")
    : `Your best is still ${out.player.speedBest.right} in ${clock(out.player.speedBest.ms)}.`);
  $("result-badges").innerHTML = `<p class="speed-share">Race a friend on these exact questions: code <strong class="speed-code-text">${code}</strong></p>${speedBoardHtml(code)}`;
  $("result-review").innerHTML = reviewHtml(play);
  state.resultNext = { speed: true };
  $("result-next").textContent = "New round";
  $("result-again").hidden = true;
  $("result-rule").hidden = true;
  openOverlay("result-overlay");
  if (best) {
    sound("done", settings().sound);
    cheer(3);
  }
  state.play = null;
}

/* ==================== Daily 5 and the streak ==================== */
// The playtester's "one quick 2-minute thing" and a streak, front and center: five quick questions from the
// player's grade (and the grade before), once a day, on the Today card. One missed day a week is forgiven.

const DAILY_COUNT = 5;
function dailyItems(player) {
  const g = player.grade;
  const levelKeys = visibleSkills(player).flatMap((skill) => [1, 2, 3]
    .filter((l) => skill.grades[l - 1] <= g && skill.grades[l - 1] >= g - 1 && isUnlocked(player, skill.id, l) && !isReviewed(player, skill, l)).map((l) => `${skill.id}-${l}`));
  return pickDailyItems({ items: state.content.items, levelKeys, stats: player.items, count: DAILY_COUNT });
}

function dailyCardHtml(player) {
  const streak = streakDays(player.days, Date.now());
  const done = player.dailyOn === localDate(Date.now());
  const streakText = streak ? `${streak}-day streak` : "Start a streak";
  const line = done ? "Daily 5 done. Back tomorrow." : "Daily 5 · 2 minutes";
  return `<span class="homework-emoji" aria-hidden="true">${streak ? "🔥" : "⚡"}</span>
    <span><strong>${esc(streakText)}</strong><span>${esc(line)}</span></span>
    <span class="today-chev" aria-hidden="true">${done ? "✓" : "›"}</span>`;
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
      // Above the player's grade (grades 3–5): a Challenge Trail, with no grade number shown to the player.
      const challenge = isChallenge(player, skill.id, level);
      const tag = challenge ? "⭐ Challenge" : !stars && isReviewed(player, skill, level) ? "✓ Reviewed" : `Grade ${skill.grades[level - 1]}`;
      return `<button type="button" class="level-btn${challenge ? " challenge" : ""}" data-skill="${skill.id}" data-level="${level}" ${open ? "" : "disabled"}
          aria-label="${esc(skill.name)} level ${level}, ${challenge ? "challenge" : `grade ${skill.grades[level - 1]}`}${open ? `, ${stars} stars` : ", locked"}">
        <span class="level-num">Level ${level}</span><span class="level-grade">${tag}</span>
        <span class="level-stars" aria-hidden="true">${open ? starText : "🔒"}</span></button>`;
    }).join("");
    // How the next Challenge Trail opens (grades 3–5, mastery): the level before it, 7 of 8 on two different days.
    const nextLocked = [2, 3].find((l) => !isUnlocked(player, skill.id, l));
    const trail = unlockMode(player) === "mastery" && nextLocked && isUnlocked(player, skill.id, nextLocked - 1)
      ? (isMastered(player, skill.id, nextLocked - 1)
        ? "A Challenge Trail is ready here. One opens each day, so it may open tomorrow."
        : `To open level ${nextLocked}: get 7 or more right on level ${nextLocked - 1}, on two different days.`) : "";
    const gold = tier === 3 ? "Gold! A gold flag flies on its top building." : isPassed(player, skill.id, 3) ? `Gold: 7+ on level 3 on ${GOLD_DAYS} days (${goldDays}/${GOLD_DAYS})` : "";
    return `<section class="skill-card" style="--skill:${skill.color}">
      <div class="skill-head"><h2>${esc(skill.name)}</h2>
        <span class="tier${tier ? "" : " none"}">${skill.badge.emoji} ${tier ? TIER_NAMES[tier - 1] : "No badge yet"}</span></div>
      
      <div class="levels">${levels}</div>
      ${trail ? `<p class="trail-note">${esc(trail)}</p>` : ""}
      ${gold ? `<p class="gold-note">${esc(gold)}</p>` : ""}
    </section>`;
}

/* ==================== Tip Card ==================== */

/** The Tip Card before a level, or (review) to look at the rule again from the results. */
function openTip(skillId, level, { review = false } = {}) {
  // Review first: with missed sentences waiting, Challenge Trails wait until today's Summit Review.
  if (!review && isChallenge(state.player, skillId, level) && reviewDue(state.player)) {
    $("gate-body").innerHTML = pipSays(`Review first! ${reviewDue(state.player)} sentences you missed are waiting at Grammar Peaks. After a Summit Review, Challenge Trails are open again today.`, true);
    openOverlay("gate-overlay");
    return;
  }
  const skill = skillById(skillId);
  const tip = state.content.tips[`${skillId}-${level}`];
  state.tip = { skillId, level, tip, review };
  $("tip-start").textContent = review ? "Back to my results" : grownPip() ? "Start" : "Let's build";
  $("tip-close").hidden = review;
  $("tip-level").textContent = `${skill.name} · Level ${level} · Grade ${skill.grades[level - 1]}`;
  $("tip-pip").innerHTML = settings().pip ? pipArt(48) : "";
  $("tip-title").textContent = tip.title;
  // Grades 3–5 (the 4th-grade playtester): the first two sentences, then the rest under "More about this rule".
  const sentences = tip.rule.split(/(?<=[.!?])\s+(?=[A-Z(“"])/);
  if (!grownPip() && !review && sentences.length > 2) {
    $("tip-rule").innerHTML = `${esc(sentences.slice(0, 2).join(" "))}<details class="tip-more"><summary>More about this rule</summary>${esc(sentences.slice(2).join(" "))}</details>`;
  } else $("tip-rule").textContent = tip.rule;
  $("tip-example").textContent = tip.example;
  $("tip-say").hidden = !canSay();
  openOverlay("tip-overlay");
  if (settings().autoRead) say(`${tip.title}. ${tip.rule} For example: ${tip.example}`);
}

/* ==================== Playing a level ==================== */

/** Pip's homework: three paragraphs with mistakes to find, unseen ones first. Doesn't count toward levels or badges. */
function startHomework() {
  closeOverlay("week-overlay");
  const band = state.player.grade <= 4 ? "3-4" : state.player.grade === 5 ? "5" : "6-8"; // three sets, by grade
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
/* Grades 3–5: the intro ends by letting the player pick a home screen (the same choice as Settings → Island Home). */
const CHOOSE_HOME = "choose-home";
const introSteps = (player) => [...PIP_INTRO, ...(player.grade <= ISLAND_HOME_MAX_GRADE ? [CHOOSE_HOME] : [])];

/** Small pictures of the two home screens, for the choice. */
const HOME_PICTURES = {
  island: `<svg viewBox="0 0 90 150" aria-hidden="true"><rect width="90" height="150" rx="8" fill="#6fb6e8"/>
    <path d="M14 30q30-14 62 0q14 40 2 92q-30 12-62 0q-12-50-2-92z" fill="#a9d68f" stroke="#f3e2b0" stroke-width="3"/>
    <path d="M30 60l10-16l10 16zM46 64l10-18l10 18z" fill="#7d8f7a"/><ellipse cx="46" cy="88" rx="12" ry="5" fill="#4f9fdc"/>
    <rect x="22" y="96" width="14" height="10" rx="2" fill="#fff"/><rect x="50" y="100" width="14" height="10" rx="2" fill="#fff"/>
    <rect x="6" y="6" width="26" height="10" rx="5" fill="#fff"/><rect x="74" y="6" width="10" height="10" rx="3" fill="#fff"/>
    <rect x="6" y="118" width="78" height="12" rx="6" fill="#fff"/><rect x="6" y="134" width="37" height="10" rx="4" fill="#fff"/><rect x="47" y="134" width="37" height="10" rx="4" fill="#fff"/></svg>`,
  classic: `<svg viewBox="0 0 90 150" aria-hidden="true"><rect width="90" height="150" rx="8" fill="#eef4fc"/>
    <rect x="6" y="6" width="26" height="10" rx="5" fill="#fff" stroke="#cfdbef"/><rect x="74" y="6" width="10" height="10" rx="3" fill="#fff" stroke="#cfdbef"/>
    <rect x="6" y="22" width="78" height="18" rx="5" fill="#fff" stroke="#cfdbef"/><rect x="36" y="31" width="18" height="6" rx="3" fill="#3949ab"/>
    <rect x="6" y="45" width="24" height="12" rx="3" fill="#fff" stroke="#cfdbef"/><rect x="33" y="45" width="24" height="12" rx="3" fill="#fff" stroke="#cfdbef"/><rect x="60" y="45" width="24" height="12" rx="3" fill="#fff" stroke="#cfdbef"/>
    <rect x="6" y="62" width="78" height="20" rx="5" fill="#fff" stroke="#cfdbef"/>
    <rect x="6" y="87" width="78" height="40" rx="5" fill="#fff" stroke="#cfdbef"/><rect x="10" y="91" width="70" height="32" rx="3" fill="#a9d68f"/>
    <rect x="6" y="132" width="78" height="6" rx="3" fill="#dfe7f5"/><rect x="6" y="141" width="78" height="6" rx="3" fill="#dfe7f5"/></svg>`,
};

function homeChoiceHtml() {
  const island = Boolean(settings().islandHome);
  const option = (value, on, title, line) => `<button type="button" class="home-option${on ? " on" : ""}" role="radio" aria-checked="${on}" data-home-choice="${value}">
      ${HOME_PICTURES[value]}<span class="home-option-words"><strong>${title}</strong><span>${line}</span></span></button>`;
  // The picture, then the words (a column on a phone held upright, a row when it's sideways).
  return option("island", island, "🏝️ Island Home", "The island fills the whole screen.")
    + option("classic", !island, "📄 Classic", "A page with me, your jobs and the island map.");
}

function chooseHome(value) {
  // The same as checking or unchecking Settings → Island Home.
  savePlayer({ ...state.player, settings: { ...settings(), islandHome: value === "island" } });
  $("pip-intro-choice").innerHTML = homeChoiceHtml();
}

function openPipIntro() {
  state.pipIntro = 0;
  $("pip-intro-face").innerHTML = grownPip() ? pipSvg(72, { line: true }) : pipSvg(96);
  drawPipIntro();
  openOverlay("pip-intro-overlay");
}

function drawPipIntro() {
  const step = state.pipIntro;
  const steps = introSteps(state.player);
  const older = state.player.grade >= STUDIO_FROM_GRADE;
  const choosing = steps[step] === CHOOSE_HOME;
  // On the grades 6–8 blueprint there's nothing to build with bricks, so the last step is about the plan instead.
  const text = choosing
    ? "Last thing, {name}: pick how your home screen looks. You can change it later in ⚙️ Settings."
    : older && blueprintOn(state.player) && step === PIP_INTRO.length - 1
      ? "Your island plan shows every skill: levels built, and how often you're right the first time."
      : PIP_INTRO[step][older ? 1 : 0];
  $("pip-intro-text").textContent = text.replace("{name}", state.player.name);
  $("pip-intro-choice").hidden = !choosing;
  if (choosing) $("pip-intro-choice").innerHTML = homeChoiceHtml();
  $("pip-intro-dots").innerHTML = steps.map((_, k) => `<span class="${k === step ? "on" : ""}"></span>`).join("");
  const last = step === steps.length - 1;
  $("pip-intro-next").textContent = last ? "Let's build!" : "Next";
  $("pip-intro-skip").hidden = last;
  if (settings().autoRead) say($("pip-intro-text").textContent);
}

function closePipIntro() {
  closeOverlay("pip-intro-overlay");
  stopSaying();
  if (!state.player.introSeen) savePlayer({ ...state.player, introSeen: true });
  if (!$("home").hidden) renderHome(); // a new home screen choice shows right away
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
  closeOverlay("gate-overlay");
  const player = state.player;
  const items = kind === "summit" ? summitItems(player) : kind === "daily" ? dailyItems(player)
    : pickSpellingItems({ items: state.content.spelling || [], grade: player.grade, stats: player.items, count: PRACTICE_PER_ROUND })
      .map((item) => ({ ...item, prompt: "Which spelling is right?" }));
  if (!items.length) return;
  closeOverlay("result-overlay");
  state.play = { mode: kind, skillId: items[0].skill, level: 1, items: withNames(items), index: 0, tries: 0, results: [], ctrl: null, done: false, startedAt: Date.now() };
  if (!state.sessionStart) state.sessionStart = Date.now();
  showScreen("play");
  showItem();
}

function finishDaily() {
  const play = state.play;
  const now = Date.now();
  const before = streakDays(state.player.days, now);
  const out = recordPractice(state.player, { kind: "daily", results: play.results, now, durationMs: now - play.startedAt });
  // A mystery prize once a day: a surprise decoration in the Town Square (not on the grades 6–8 blueprint).
  const prize = blueprintOn(out.player) ? null : mysteryPrize(out.player, now);
  savePlayer(prize ? prize.player : out.player);
  const streak = streakDays(out.player.days, now);
  $("progress-fill").style.width = "100%";
  $("result-stars").innerHTML = "";
  $("result-title").textContent = `🔥 ${streak}-day streak`;
  $("result-score").textContent = `Daily 5: ${out.right} of ${play.results.length} right on the first try`;
  showResultBricks(out, `+${out.bricks} 🧱 bricks <span class="note">· ${out.player.bricks} to build with</span>`);
  const line = streak > before ? (streak === 1 ? "Day one. Come back tomorrow and it's a streak." : `That's ${streak} days. See you tomorrow.`)
    : "Done for today. The streak already counts today.";
  $("result-pip").innerHTML = pipRemark(line);
  $("result-badges").innerHTML = prize ? `<p class="mystery-prize"><span class="prize-emoji" aria-hidden="true">🎁</span> Mystery prize: <strong>${prize.item.emoji} ${esc(prize.item.name)}</strong>! It's in the Town Square. Drag it anywhere in Build.</p>` : "";
  $("result-review").innerHTML = reviewHtml(play);
  state.resultNext = { home: true };
  $("result-next").textContent = blueprintOn(out.player) ? "Back to home" : "Back to the island";
  $("result-again").hidden = true;
  $("result-rule").hidden = true;
  openOverlay("result-overlay");
  if (out.right === play.results.length) {
    sound("done", settings().sound);
    cheer(3);
  }
  state.play = null;
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
  showResultBricks(out, `+${out.bricks} 🧱 bricks <span class="note">· ${out.player.bricks} to build with</span>`);
  const goal = `Get ${PRACTICE_GOAL} right on the first try to ${summit ? "plant a flag at the top" : "float a boat on the lake"}.`;
  const line = out.reached
    ? (summit ? `Flag number ${out.player.summits} is flying on Grammar Peaks. You remembered your rules!` : `Boat number ${out.player.lakeWins} is out on the lake. Great spelling!`)
    : `${goal} Look at the ones below, then try again.`;
  $("result-pip").innerHTML = pipRemark(line);
  $("result-badges").innerHTML = newBadges.map((b) => `<p class="new-badge"><span aria-hidden="true">${b.emoji}</span> New badge: <strong>${esc(badgeName(b))}</strong></p>`).join("");
  $("result-review").innerHTML = reviewHtml(play);
  state.resultNext = { practice: play.mode };
  $("result-next").textContent = summit ? "Climb again" : "Another round";
  $("result-again").hidden = true;
  $("result-rule").hidden = true;
  state.mapArea = "peaks"; // back on the island, the map shows the new flag or boat
  openOverlay("result-overlay");
  if (out.reached) {
    sound("done", settings().sound);
    cheer(out.right === play.results.length ? 3 : 2);
  }
  state.play = null;
}

/** Pip's homework from grade 6: a slightly overconfident coworker who takes the grade. */
// Following the 8th-grade playtester: he argues back a little, then takes the grade.
const GROWN_HOMEWORK = {
  "A+": ["A+. Fine. I'll admit those were mistakes.", "Not one got past you? I'm telling everyone I did that on purpose."],
  A: ["An A? I was going for subtle. You were not fooled.", "A. I'll fix those, but for the record, some of them were traps."],
  B: ["A B? That one was a style choice. ...Fine, I'll fix it.", "B. Respectable. For both of us."],
  C: ["A C. In my defense, some of those were sneaky.", "C? I'd like a regrade. ...Request denied, I see."],
  "Try again": ["My mistakes win this round. Want another of my paragraphs?", "Ha. Even the grader missed some. Try another one?"],
};

function finishHomework() {
  const play = state.play;
  const now = Date.now();
  const out = recordHomework(state.player, { results: play.results, now, durationMs: now - play.startedAt });
  savePlayer(out.player);
  $("progress-fill").style.width = "100%";
  $("result-stars").innerHTML = "";
  $("result-title").textContent = `Pip's grade: ${out.grade}`;
  $("result-score").textContent = `${out.right} of ${play.results.length} paragraphs right on the first try`;
  showResultBricks(out, `+${out.bricks} 🧱 bricks <span class="note">· ${out.player.bricks} to build with</span>`);
  const lines = { "A+": "An A+! Thank you, teacher. I'll fix those mistakes for good.", A: "An A! Thanks for checking my work so carefully.",
    B: "A B. Not bad! Thanks for catching my mistakes.", C: "A C. Hmm, some of those mistakes were sneaky.", "Try again": "Those were tricky. Want to check another one?" };
  $("result-pip").innerHTML = pipRemark(grownPip() ? pick(GROWN_HOMEWORK[out.grade]) : lines[out.grade]);
  $("result-badges").innerHTML = "";
  $("result-review").innerHTML = reviewHtml(play);
  state.resultNext = { homework: true };
  $("result-next").textContent = "Check more homework";
  $("result-again").hidden = true;
  $("result-rule").hidden = true;
  openOverlay("result-overlay");
  if (out.grade === "A+" || out.grade === "A") {
    sound("done", settings().sound);
    cheer(out.grade === "A+" ? 3 : 2);
  }
  state.play = null;
}

/* ==================== Sentence of the Week ==================== */

// A week already started keeps its sentence, even if new weeks were added to the list partway through it.
const currentWeek = (player) => {
  const weeks = state.content?.weeks || [];
  const now = Date.now();
  const saved = player.week;
  const kept = saved && saved.key === weekKey(now) && weeks.find((w) => w.id === saved.id && w.band === bandFor(player.grade));
  return kept || weekFor(weeks, player.grade, now);
};
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
      <p>${tutor ? (grownPip() ? `I wrote ${HOMEWORK_PER_ROUND} paragraphs and I'm fairly sure they're fine. Check them, and grade me honestly.`
          : `Pip has ${HOMEWORK_PER_ROUND} paragraphs of homework. Can you find his mistakes? You'll earn bricks, and Pip gets a grade.`)
        : grownPip() ? "Thanks for the corrections. I have more paragraphs if you want them." : "Thanks for checking Pip's homework today! He always has more, if you'd like to keep tutoring."}</p>
      <button type="button" id="homework-btn" class="${tutor ? "primary" : "secondary"}">${tutor ? "Help Pip" : "Check more homework"}</button>
    </section>
    <section class="board-notice" aria-labelledby="sow-title">
      <h3 id="sow-title">📌 Sentence of the Week</h3>
      <p class="week-board" aria-label="This week's sentence">${esc(boardText(week))}</p>
      <p class="note">One sentence all week, a short job each day. Missed a day? Catch up any time before Monday. Finish all five for ${blueprintOn(player) ? "a banner on your island plan" : `${WEEK_BONUS} bonus bricks and a banner in the Town Square`}.</p>
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
  showResultBricks(out, `+${out.bricks} 🧱 bricks${out.weekDone ? ` (${WEEK_BONUS} for the week)` : ""} <span class="note">· ${out.player.bricks} to build with</span>`);
  $("result-pip").innerHTML = pipRemark(out.weekDone
    ? (blueprintOn(out.player) ? "Five days, one sentence. Week complete, and it's on your plan." : "Five days, one sentence, and you know it inside out. Your banner is flying in the Town Square!")
    : next !== null ? `Nice work. ${WEEK_DAYS[next].name}'s job is waiting too, if you want to catch up.` : "See you tomorrow for the next job on this sentence.");
  $("result-badges").innerHTML = "";
  $("result-review").innerHTML = reviewHtml(play);
  state.resultNext = next !== null ? { weekDay: next } : { home: true };
  $("result-next").textContent = next !== null ? `Next: ${WEEK_DAYS[next].name}` : blueprintOn(state.player) ? "Back to home" : "Back to the island";
  $("result-again").hidden = true;
  $("result-rule").hidden = true;
  state.mapArea = "square"; // back on the island, the map shows the Notice Board (and a new banner)
  openOverlay("result-overlay");
  if (out.weekDone) {
    sound("done", settings().sound);
    cheer(3);
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
  if (play.mode === "speed") speedTick();
  $("play-skill").textContent = play.mode === "homework" ? `📝 Pip's homework: ${item.title}`
    : play.mode === "summit" ? `⛰️ Summit Review · ${skill.name}`
    : play.mode === "lake" ? "💧 Spelling Lake"
    : play.mode === "daily" ? `⚡ Daily 5 · ${skill.name}`
    : play.mode === "speed" ? `⏱️ Speed Round · ${play.index + 1} of ${play.items.length}`
    : play.mode === "testout" ? `Test out · ${skill.name}`
    : play.mode === "boss" ? `📝 Pip's final draft: ${item.title}`
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

/** Bricks on a results screen; none on the grades 6–8 blueprint, where there's nothing to build with them. */
function showResultBricks(out, html) {
  $("result-bricks").hidden = !out.bricks || blueprintOn(out.player);
  $("result-bricks").innerHTML = html;
}

/** Confetti: every pass for grades 3–5; only a perfect score from grade 6, so it still means something. */
const cheer = (stars) => (grownPip() && stars < 3 ? null : celebrate(stars));

/** Grades 6–8 get Pip as a coworker: a small line drawing, drier words, no home-page greeting. */
const grownPip = () => (state.player?.grade || 0) >= GROWN_PIP_FROM_GRADE;
const pipWords = () => (grownPip() ? PIP_GROWN : PIP);
const pipArt = (size) => (grownPip() ? pipSvg(Math.min(size, 34), { line: true }) : pipSvg(size));
/** Pip's remark (results, the week): hidden when Comments and greeting is off, small and plain from grade 6. */
const pipRemark = (text, action = "") => pipSays(text, settings().pip, action, { grown: grownPip() });

/** Pip's small face beside a hint (nothing when Pip is turned off). */
const pipFace = () => (settings().pip ? `<span class="feedback-pip" aria-hidden="true">${pipArt(36)}</span>` : "");

/**
 * An answer to show. A Q&A Flow answer is each word with its label under it, then the pattern in words and the
 * sentence kind, instead of a string of codes like "A SN V-t DO OCN P6" (the 8th-grade playtester's alphabet soup).
 */
function answerHtml(item) {
  if (item.type !== "flow") return esc(answerText(item));
  const p = parseFlow(item);
  const words = p.words.map((w) => `<span class="lw"><span class="lw-word">${esc(w.word)}</span><span class="lw-label" title="${esc(LABELS[w.label]?.name || w.label)}">${esc(w.label)}</span></span>`).join("");
  const core = item.pattern ? PATTERNS[item.pattern].split(" ").filter((l) => !/^P\d$/.test(l)).map((l) => LABELS[l]?.name || l).join(", ") : "";
  const kind = SENTENCE_KINDS[item.kind].split(":")[0];
  return `<span class="label-words">${words}</span><span class="flow-sum">${item.pattern ? `Pattern ${item.pattern}: ${esc(core)} · ` : ""}${esc(kind)}</span>`;
}

/** "You chose: …" when we know the wrong choice (Which is right?). */
const chosenLine = (chosen) => (chosen ? `<p class="chosen-line"><span class="answer-tag">You chose:</span> ${esc(chosen)}</p>` : "");
/** Grades 6–8: one line on why, after a right answer too, for items whose hint states the rule. */
const WHY_TYPES = new Set(["which", "mark", "fix", "sort", "check", "join", "build"]);
const whyLine = (item) => (grownPip() && state.play?.mode !== "speed" && WHY_TYPES.has(item.type) && item.hint ? `<p class="why-line"><span class="answer-tag">Why:</span> ${esc(item.hint)}</p>` : "");

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
    const line = play.tries === 1 ? pick(pipWords().right) : pick(pipWords().secondTry);
    $("feedback").className = "feedback good";
    $("feedback").innerHTML = `<p><strong>✓ ${esc(line)}</strong></p>${whyLine(item)}`;
  } else if (play.tries === 1 && !play.ctrl.oneShot && play.mode !== "speed") {
    play.tries = 2;
    sound("wrong", s.sound);
    play.ctrl.retry();
    $("feedback").className = "feedback hint";
    // Typed answers can say exactly what slipped (a capital, a comma); otherwise the item's own hint.
    const hintText = play.ctrl.missHint?.() || item.hint;
    $("feedback").innerHTML = `${pipFace()}<div><p><strong>${esc(pipWords().hint)}</strong> ${esc(hintText)}</p><p class="try-again">Try again.</p></div>`;
    updateCheck();
  } else {
    const chosen = play.ctrl.chosen?.() || null;
    play.results.push({ id: item.id, type: item.type, tries: play.tries, correct: false, chosen });
    finishItem();
    play.ctrl.reveal();
    if (play.tries === 1) sound("wrong", s.sound); // a two-choice miss: the answer is shown right away
    $("feedback").className = "feedback shown";
    $("feedback").innerHTML = `${pipFace()}<div><p><strong>${esc(play.tries === 1 ? pipWords().oneShot : pipWords().shown)}</strong></p>${chosenLine(chosen)}`
      + `<p class="answer-line">${chosen ? '<span class="answer-tag">Correct:</span> ' : ""}${answerHtml(item)}</p><p class="hint-line">${esc(item.hint)}</p></div>`;
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
  play.results.push({ id: item.id, type: item.type, tries, correct, chosen: play.ctrl.chosen?.() || null });
  finishItem();
  play.ctrl.lock();
  const s = settings();
  if (correct) {
    sound("right", s.sound);
    buzz(10);
    $("feedback").className = "feedback good";
    $("feedback").innerHTML = `<p><strong>✓ ${esc(tries === 1 ? pick(pipWords().right) : "Done! A hint helped on the way.")}</strong></p>`;
  } else {
    $("feedback").className = "feedback shown";
    $("feedback").innerHTML = `${pipFace()}<div><p><strong>Done. Some answers were shown, so this one will come back later.</strong></p><p class="answer-line">${answerHtml(item)}</p></div>`;
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
  $("next-btn").hidden = true; // it peeked out from behind the results sheet
  if (play.mode === "homework") return finishHomework();
  if (play.mode === "summit" || play.mode === "lake") return finishPractice();
  if (play.mode === "daily") return finishDaily();
  if (play.mode === "speed") return finishSpeed();
  if (play.mode === "testout") return finishTestout();
  if (play.mode === "boss") return finishBoss();
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
  $("result-title").textContent = (grownPip() ? ["Not passed yet", "Passed", "Passed: 2 stars", "Perfect score"] : ["Almost there", "Built it!", "Great build!", "Perfect build!"])[out.stars];
  $("result-score").textContent = `${points(out.points)} of ${play.results.length} points · ${skill.name} level ${play.level}`;
  showResultBricks(out, `+${out.bricks} 🧱 bricks <span class="note">· ${out.player.bricks} to build with</span>`);
  let pipLine = out.passed ? pick(out.stars === 3 && pipWords().perfect ? pipWords().perfect : pipWords().passed) : pipWords().notYet;
  if (out.passed && play.level === 3 && skillTier(out.player, skill.id) < 3) {
    const goldAt = (7 / 8) * play.results.length;
    const left = GOLD_DAYS - (out.goldProgress || 0);
    pipLine += out.points >= goldAt && out.goldProgress ? (grownPip()
      ? ` ${left > 0 ? `${left} more day${left === 1 ? "" : "s"} like this and it goes Gold.` : "That's Gold."}`
      : ` Gold progress: ${out.goldProgress} of ${GOLD_DAYS} days.`)
      : ` Score ${points(Math.ceil(goldAt * 2) / 2)} or more here on two days for Gold${skill.goldNeedsAllRight ? ", with the label sentences right" : ""}.`;
  }
  const breakMinutes = out.player.settings.breakMinutes;
  if (breakMinutes && now - state.sessionStart >= breakMinutes * 60000) {
    pipLine += ` You've been building for ${Math.round((now - state.sessionStart) / 60000)} minutes. Time for a stretch break!`;
    state.sessionStart = null;
  }
  $("result-pip").innerHTML = pipRemark(pipLine);
  $("result-badges").innerHTML = out.newBadges.map(({ id, tier }) => {
    const badge = SKILLS.find((sk) => sk.badge.id === id)?.badge || [...WORLD_BADGES, ...HABIT_BADGES].find((b) => b.id === id);
    const tierName = SKILLS.some((sk) => sk.badge.id === id) ? ` · ${TIER_NAMES[tier - 1]}` : "";
    return `<p class="new-badge"><span aria-hidden="true">${badge.emoji}</span> New badge: <strong>${esc(badgeName(badge))}</strong>${tierName}</p>`;
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
    cheer(out.stars);
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
      ${r.chosen ? `<span class="review-chosen">You chose: ${esc(r.chosen)}</span>` : ""}
      <span class="review-answer">${r.chosen ? "Correct: " : ""}${answerHtml(item)}</span><span class="review-rule">${esc(item.hint)}</span></li>`;
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
  // Island Home hides this panel, except at Grammar Peaks: it has no lots to tap, so its rounds start from here.
  document.body.classList.toggle("peaks-open", state.mapArea === "peaks");
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
  const decorate = blueprintOn(player) ? "" : `<button type="button" class="secondary" data-decorate="${here.id}">🧱 Decorate here</button>`;
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

/** Grades 6–8: plain badge names (the skill or world), not "Comma Captain" or "Works Wizard". */
function badgeName(badge) {
  if ((state.player?.grade || 0) < OLDER_FROM_GRADE) return badge.name;
  const skill = SKILLS.find((sk) => sk.badge.id === badge.id);
  if (skill) return skill.name;
  const world = badge.world && WORLDS.find((w) => w.id === badge.world);
  return world ? `${world.name}: all Silver` : badge.name;
}

function renderBadges() {
  const player = state.player;
  const earned = currentBadges(player);
  const skillRows = visibleSkills(player).map((skill) => {
    const tier = earned[skill.badge.id];
    return `<li class="badge${tier ? " earned" : ""}"><span class="badge-emoji" aria-hidden="true">${skill.badge.emoji}</span>
      <span><strong>${esc(badgeName(skill.badge))}</strong> ${tier ? `<span class="tier-tag t${tier}">${TIER_NAMES[tier - 1]}</span>` : ""}
      <span class="badge-how">${esc(skill.name)}: Bronze = pass level 1, Silver = pass level 2, Gold = 7+ on level 3 on two days.</span></span></li>`;
  }).join("");
  const other = [...WORLD_BADGES.filter((b) => worldOpenFor(WORLDS.find((w) => w.id === b.world), player)), ...HABIT_BADGES].map((badge) => {
    const got = earned[badge.id];
    const progress = badge.measure ? ` (${Math.min(habitValue(player, badge.measure), badge.goal)}/${badge.goal})` : "";
    return `<li class="badge${got ? " earned" : ""}"><span class="badge-emoji" aria-hidden="true">${badge.emoji}</span>
      <span><strong>${esc(badgeName(badge))}</strong><span class="badge-how">${esc(badge.how)}${got ? "" : progress}</span></span></li>`;
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
  const worlds = worldsFor(p).filter((w) => worldOpenFor(w, p)).map((world) => {
    const rows = skillsInWorldFor(world.id, p).map((skill) => {
      const tier = skillTier(p, skill.id);
      const cells = [1, 2, 3].map((level) => {
        const stars = levelStars(p, skill.id, level);
        const open = isUnlocked(p, skill.id, level);
        return `<td>${stars ? `<span class="stars-mini" aria-label="${stars} stars">${"★".repeat(stars)}</span>` : isReviewed(p, skill, level) ? '<span class="reviewed-mini">✓ reviewed</span>' : open ? '<span class="muted">open</span>' : '<span class="muted" aria-label="locked">🔒</span>'}</td>`;
      }).join("");
      return `<tr><th scope="row">${esc(skill.name)}</th>${cells}<td>${tier ? TIER_NAMES[tier - 1] : "—"}</td></tr>`;
    }).join("");
    return `<h4>${world.emoji} ${esc(world.name)}</h4><table class="progress-table"><thead><tr><th scope="col">Skill</th><th scope="col">Level 1</th><th scope="col">Level 2</th><th scope="col">Level 3</th><th scope="col">Badge</th></tr></thead><tbody>${rows}</tbody></table>`;
  }).join("");
  const missed = mostMissed(p).map(({ id, misses, chosen }) => {
    const item = itemById(id);
    if (!item) return "";
    return `<li><span class="missed-skill">${esc(skillById(item.skill)?.name || item.skill)}, level ${item.level} · missed ${misses}×</span>${chosen ? `<span class="review-chosen">Last pick: ${esc(chosen)}</span>` : ""}${answerHtml(item)}</li>`;
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
    + (l.grade ? `<small>gr ${l.grade}${l.grade > r.grade ? " · Challenge" : ""}</small>` : "");
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
  $("set-showisland").checked = Boolean(s.showIsland);
  $("unlock-setting").hidden = state.player.grade > CHALLENGE_UP_TO_GRADE;
  $("set-unlock").value = s.unlock || "mastery";
  $("set-unlock").hidden = true;
  $("unlock-hold").hidden = false;
  $("unlock-hold").textContent = `🔒 ${$("set-unlock").selectedOptions[0].textContent}`;
  $("showisland-toggle").hidden = state.player.grade < BLUEPRINT_FROM_GRADE;
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
      showWords: $("set-showwords").checked, islandHome: $("set-island").checked, calm: $("set-calm").checked, showIsland: $("set-showisland").checked, unlock: $("set-unlock").value },
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
    if (target.closest("#daily-btn, #island-daily")) return startPractice("daily");
    if (target.closest("[data-speed]")) return openSpeed();
    if (target.closest("#speed-new")) return startSpeed(state.player.grade, 1000 + Math.floor(Math.random() * 9000));
    if (target.closest("#speed-play-code")) {
      const code = parseSpeedCode($("speed-code").value);
      if (!code) return void ($("speed-code-msg").textContent = "Codes look like G7-4821.");
      return startSpeed(code.grade, code.seed);
    }
    const testoutBtn = target.closest("[data-testout]");
    if (testoutBtn) return startTestout(testoutBtn.dataset.testout);
    const bossBtn = target.closest("[data-boss]");
    if (bossBtn) return startBoss(bossBtn.dataset.boss);
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
    // Redrawing the home screen shouldn't jump the page back to the top.
    const stay = (change) => { const y = window.scrollY; change(); renderHome(); window.scrollTo(0, y); };
    if (target.closest("#map-expand, #bp-toggle")) return stay(() => { state.mapOpen = !state.mapOpen; });
    if (target.closest("[data-pip-min]")) return stay(() => { state.pipMin = true; });
    if (target.closest("[data-pip-expand]")) return stay(() => { state.pipMin = false; });
    if (target.closest("#island-build")) {
      if (!playedToday(state.player)) {
        $("pip-home").innerHTML = pipSays("Build opens after your first lesson today. Do one, then spend your bricks!", true, playButton(state.player));
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
    if (state.pipIntro + 1 < introSteps(state.player).length) {
      state.pipIntro += 1;
      drawPipIntro();
    } else closePipIntro();
  });
  // Skip goes straight to the home screen choice (grades 3–5), or closes.
  $("pip-intro-skip").addEventListener("click", () => {
    const steps = introSteps(state.player);
    if (steps.at(-1) === CHOOSE_HOME && state.pipIntro < steps.length - 1) {
      state.pipIntro = steps.length - 1;
      drawPipIntro();
    } else closePipIntro();
  });
  // Parents' setting: press and hold for a moment to show the choices (so it isn't changed by a quick tap).
  let holdTimer = null;
  const endHold = () => { clearTimeout(holdTimer); $("unlock-hold").classList.remove("holding"); };
  $("unlock-hold").addEventListener("pointerdown", () => {
    $("unlock-hold").classList.add("holding");
    holdTimer = setTimeout(() => {
      endHold();
      $("unlock-hold").hidden = true;
      $("set-unlock").hidden = false;
      $("set-unlock").focus();
    }, 1500);
  });
  for (const type of ["pointerup", "pointerleave", "pointercancel"]) $("unlock-hold").addEventListener(type, endHold);
  $("unlock-hold").addEventListener("contextmenu", (event) => event.preventDefault());
  $("pip-intro-choice").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-home-choice]");
    if (btn) chooseHome(btn.dataset.homeChoice);
  });
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
    onPeak: (kind) => {
      if (kind === "summit" && !summitItems(state.player).length) {
        $("pip-home").innerHTML = pipSays("Pass a level anywhere on the island first, then climb up here to review it.", settings().pip, playButton(state.player));
        return;
      }
      startPractice(kind);
    },
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
  // Blueprint style (earned with final drafts and Gold skills).
  $("bp-style").addEventListener("change", (event) => {
    if (!state.player) return;
    savePlayer({ ...state.player, settings: { ...state.player.settings, planStyle: event.target.value } });
    renderHome();
  });
  $("quit-yes").addEventListener("click", () => {
    closeOverlay("quit-overlay");
    stopSaying();
    // A finished level has no play left (state.play is cleared at the results), so go home then too.
    const skill = state.play ? skillById(state.play.skillId) : null;
    const mode = state.play?.mode;
    state.play = null;
    if (mode || !skill) renderHome(); // homework and Grammar Peaks rounds start from the island
    else renderWorld(skill.world);
  });
  // "Not now" on the next level's Tip Card, right after a level's results: back to that place's level list,
  // not to the finished level's last question.
  $("tip-close").addEventListener("click", () => {
    if (!state.play && !$("play").hidden && state.tip) {
      closeOverlay("tip-overlay");
      renderWorld(skillById(state.tip.skillId).world);
    }
  });
  // One way home on the results: when the main button already goes home, the "Back to…" link isn't shown too.
  new MutationObserver(() => {
    if (!$("result-overlay").hidden) $("result-town").hidden = Boolean(state.resultNext?.home);
  }).observe($("result-overlay"), { attributes: true, attributeFilter: ["hidden"] });
  $("result-next").addEventListener("click", () => {
    closeOverlay("result-overlay");
    const next = state.resultNext;
    if (next.weekDay !== undefined) startWeekDay(next.weekDay);
    else if (next.home) renderHome();
    else if (next.homework) startHomework();
    else if (next.practice) startPractice(next.practice);
    else if (next.boss) startBoss(next.boss);
    else if (next.speed) startSpeed(state.player.grade, 1000 + Math.floor(Math.random() * 9000));
    else if (next.testout) startTestout(next.testout);
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
  for (const id of ["set-autoread", "set-pip", "set-sound", "set-theme", "set-break", "set-font", "set-size", "set-spacing", "set-showwords", "set-island", "set-calm", "set-showisland", "set-unlock", "set-names-on", "set-pet",
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
