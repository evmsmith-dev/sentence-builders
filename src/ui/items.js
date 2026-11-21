// Draws one item and handles taps. Each item type returns the same small controller:
//   prompt          what to do, in a few words
//   usesCheck       true when the player taps Check (mark, build); false when a tap answers (fix, which)
//   canCheck()      whether Check should be enabled
//   check()         true if right (check-button types)
//   retry()         get ready for the second try
//   reveal()        show the right answer after a second miss
//   lock()          no more changes
// Types that answer on a tap call answer(correct) themselves.
import { markupTasks, checkMarkup } from "../lib/markup.js";
import { nounTableQuestions } from "../lib/nountable.js";
import { buildDiagram, explainSlot, guideOrder, layoutDiagram, wrongSlots } from "../lib/diagram.js";
import {
  CHECK_KINDS, spaceAfter, checkBuild, checkLabels, checkMark, checkSort, joinTiles, paletteFor, parseBuild, parseCheck, parseFix, parseFlow,
  parseJoin, parseCombine, checkCombine, checkDictation, dictationPhrases, dictationWords, parseLabels, parseMark, parseProofread, parseSort, parseWhich, mistakeKind,
} from "../lib/parse.js";
import { FLOW_LABELS, LABELS, PATTERNS, SENTENCE_KINDS, trickyAdverb } from "../config.js";
import { REUSABLE_KINDS, WORKSHOP_PATTERNS, checkWorkshop, parseWorkshop, workshopExample, workshopFlowItem, workshopGoal, workshopText } from "../lib/workshop.js";

const LABELS_BUTTON = '<button type="button" class="labels-help" data-labels-help>🏷️ Labels</button>';
// Q&A Flow and Diagramming put their instruction in the card, so the rule and read-aloud buttons sit beside it
// (the top prompt, which repeated it, is hidden for these).
const CARD_TOOLS = '<span class="card-tools"><button type="button" class="say-btn small" data-card-rule aria-label="See the rule for this question">📘</button><button type="button" class="say-btn small" data-card-say aria-label="Read the question aloud">🔊</button></span>';
// "Tap the word, then tap Done…" shows on the first Mark it up step of a session, then only after a mistake.
let markupHowShown = false;
const NOUNS_BUTTON = '<button type="button" class="labels-help" data-nouns-help>🏷️ Nouns</button>';
import { shuffle } from "../lib/select.js";
import { esc } from "./dom.js";
import { canSay, sayParts } from "./feel.js";

const MARK_NAMES = {
  ",": "comma", ".": "period", "?": "question mark", "!": "exclamation point", '"': "quotation mark", ":": "colon", ";": "semicolon",
  "'": "apostrophe", "-": "hyphen", "—": "dash", "…": "ellipsis", "(": "opening parenthesis", ")": "closing parenthesis",
};

/** The right answer with the marks that had to be placed highlighted. */
function markAnswerHtml(parsed) {
  const gaps = parsed.answers[0].gaps;
  const hi = (marks) => (marks ? `<mark>${esc(marks)}</mark>` : "");
  let out = hi(gaps[0].before);
  parsed.words.forEach((word, i) => {
    const gap = gaps[i + 1];
    out += esc(word) + hi(gap.after) + (i < parsed.words.length - 1 ? spaceAfter(gap) : "") + hi(gap.before);
  });
  return out;
}

function renderMark(root, item, { onChange, onTap }, { allowEmpty = false } = {}) {
  const parsed = parseMark(item);
  parsed.palette = paletteFor(item, parsed);
  // One mark to choose from: tapping a word (or a space) adds or removes it, no palette needed.
  const single = parsed.palette.length === 1 ? parsed.palette[0] : null;
  // Each space holds the marks hanging after the word before it, then the marks opening the word after it
  // (said[,"] Come): kept apart so the order is always right, whichever is added first.
  const after = parsed.words.map(() => "").concat("");
  const before = parsed.words.map(() => "").concat("");
  const filled = () => after.map((a, i) => a + before[i]);
  let selected = null; // the space being filled (from a dot)
  let selWord = null; // or the word tapped: its marks go after it, and opening marks before it
  let locked = false;
  // Opening marks go before a word; offered as their own buttons when a word is picked (the grammar teacher).
  const OPENERS = ['"', "("];
  const openers = parsed.palette.filter((m) => OPENERS.includes(m));

  root.innerHTML = `<div class="sentence marks" data-type="mark" data-palette="${esc(parsed.palette.join(""))}"></div>
    <div class="palette" hidden><p class="palette-label"></p><div class="palette-buttons"></div></div>`;
  const sentence = root.querySelector(".sentence");
  const palette = root.querySelector(".palette");

  const gapLabel = (i) => (i === 0 ? `before "${parsed.words[0]}"` : `after "${parsed.words[i - 1]}"`);
  const shown = (m, opening) => (m === '"' ? (opening ? "“" : "”") : m);
  const markBtn = (mark, opening = false) => `<button type="button" class="mark-btn" ${opening ? "data-mark-before" : "data-mark"}="${esc(mark)}"
    aria-label="Add ${opening ? "opening " : ""}${esc(MARK_NAMES[mark] || mark)}${opening ? " before the word" : ""}">${esc(selWord !== null ? shown(mark, opening) : mark)}${mark === "-" || mark === "—" ? `<small class="mark-name" aria-hidden="true">${MARK_NAMES[mark]}</small>` : ""}</button>`;
  function draw() {
    const marks = filled();
    sentence.innerHTML = marks.map((m, i) => {
      // Spaces stay clickable but show nothing until they hold a mark; words are what to tap now.
      const gap = `<button type="button" class="gap${m ? " filled" : ""}${selected === i ? " selected" : ""}" data-gap="${i}"
        aria-label="Space ${esc(gapLabel(i))}${m ? `: ${esc([...m].map((x) => MARK_NAMES[x] || x).join(", "))}` : ""}"
        aria-pressed="${selected === i}" ${locked ? "disabled" : ""}><span>${m ? esc(m) : ""}</span></button>`;
      if (i >= parsed.words.length) return gap;
      const on = selWord === i;
      return `${gap}<button type="button" class="word word-tap${on ? " selected" : ""}" data-word-i="${i}" ${locked ? "disabled" : ""}
        aria-pressed="${on}" aria-label="${single ? `${esc(MARK_NAMES[single] || single)} after` : "Marks around"} “${esc(parsed.words[i])}”">${esc(parsed.words[i])}</button>`;
    }).join("");
    const open = (selected !== null || selWord !== null) && !locked;
    palette.hidden = !open;
    if (!open) return;
    if (selWord !== null) {
      const word = parsed.words[selWord];
      const afterMarks = parsed.palette.filter((m) => m !== "(");
      palette.querySelector(".palette-label").textContent = `Marks for “${word}”`;
      palette.querySelector(".palette-buttons").innerHTML =
        (openers.length ? `<span class="palette-group"><small>Before “${esc(word)}”</small>${openers.map((m) => markBtn(m, true)).join("")}</span>` : "")
        + `<span class="palette-group"><small>After “${esc(word)}”</small>${afterMarks.map((m) => markBtn(m)).join("")}</span>`
        + '<button type="button" class="mark-btn erase" data-erase aria-label="Erase the marks around this word">⌫</button>';
    } else {
      palette.querySelector(".palette-label").textContent = `Space ${gapLabel(selected)}:`;
      palette.querySelector(".palette-buttons").innerHTML = parsed.palette.map((m) => markBtn(m)).join("")
        + '<button type="button" class="mark-btn erase" data-erase aria-label="Erase this space">⌫</button>';
    }
  }
  root.addEventListener("click", (event) => {
    if (locked) return;
    const gap = event.target.closest("[data-gap]");
    const word = event.target.closest("[data-word-i]");
    const mark = event.target.closest("[data-mark]");
    const markBefore = event.target.closest("[data-mark-before]");
    if (word && single) {
      // A comma (or the one mark) goes right after the tapped word (a parent: kids tapped the word before the
      // comma and were told it was wrong); tap again to take it away.
      const i = Number(word.dataset.wordI) + 1;
      after[i] = after[i] ? "" : single;
      onTap();
    } else if (gap && single) {
      const i = Number(gap.dataset.gap);
      after[i] = after[i] || before[i] ? "" : single;
      before[i] = "";
      onTap();
    } else if (word) {
      const w = Number(word.dataset.wordI);
      selWord = selWord === w ? null : w;
      selected = null;
      onTap();
    } else if (gap) {
      const i = Number(gap.dataset.gap);
      selected = selected === i ? null : i;
      selWord = null;
      onTap();
    } else if (markBefore && selWord !== null) {
      if (before[selWord].length < 2) before[selWord] += markBefore.dataset.markBefore;
      onTap();
    } else if (mark && (selected !== null || selWord !== null)) {
      const i = selWord !== null ? selWord + 1 : selected;
      if (after[i].length < 3) after[i] += mark.dataset.mark;
      onTap();
    } else if (event.target.closest("[data-erase]")) {
      if (selWord !== null) {
        after[selWord + 1] = "";
        before[selWord] = "";
      } else if (selected !== null) {
        after[selected] = "";
        before[selected] = "";
      }
    } else {
      return;
    }
    draw();
    onChange();
  });
  draw();
  /** After a miss: which space to look at (the 4th grader: "I couldn't tell which comma was the wrong one"). */
  function missHint() {
    const marks = filled();
    const answer = parsed.answers[0];
    const i = answer.gaps.findIndex((gap, k) => (marks[k] || "") !== gap.marks && !(gap.optional && !marks[k]));
    if (i < 0) return item.hint;
    const where = i === 0 ? `before “${parsed.words[0]}”` : `after “${parsed.words[i - 1]}”`;
    const what = !answer.gaps[i].marks ? `There shouldn't be a mark ${where}.` : marks[i] ? `Look again at the marks ${where}.` : `Something is missing ${where}.`;
    return `${what} ${item.hint}`;
  }
  return {
    prompt: single ? `Tap the word that comes before each ${single === "," ? "comma" : MARK_NAMES[single] || single}.`
      : openers.length ? "Tap a word, then add the marks that go before or after it." : "Tap the word before a mark, then pick the mark.",
    usesCheck: true,
    canCheck: () => allowEmpty || filled().some(Boolean),
    check: () => checkMark(parsed, filled()),
    missHint,
    retry: () => { selected = null; selWord = null; draw(); },
    reveal: () => { locked = true; root.innerHTML = `<p class="sentence answer">${markAnswerHtml(parsed)}</p>`; },
    lock: () => { locked = true; selected = null; selWord = null; draw(); },
  };
}

function renderFix(root, item, { answer, onTap }) {
  const parsed = parseFix(item);
  const choices = shuffle(parsed.choices);
  let locked = false;
  root.innerHTML = `<div class="sentence words" data-type="fix">${parsed.words.map((word, i) =>
    `<button type="button" class="word-btn" data-word="${i}">${esc(word)}</button>`).join(" ")}</div>
    <div class="choices" hidden><p class="palette-label">Change it to:</p><div class="choice-row">${choices.map((choice) =>
      `<button type="button" class="choice" data-choice="${esc(choice)}">${esc(parsed.prefix + choice + parsed.suffix)}</button>`).join("")}</div></div>`;
  const choiceBox = root.querySelector(".choices");
  root.addEventListener("click", (event) => {
    if (locked) return;
    const word = event.target.closest("[data-word]");
    const choice = event.target.closest("[data-choice]");
    if (word) {
      onTap();
      root.querySelectorAll(".word-btn").forEach((btn) => btn.classList.toggle("selected", btn === word));
      if (Number(word.dataset.word) === parsed.target) {
        choiceBox.hidden = false;
      } else {
        choiceBox.hidden = true;
        word.classList.add("wrong");
        answer(false);
      }
    } else if (choice) {
      const right = choice.dataset.choice === parsed.correct;
      if (!right) choice.disabled = true;
      answer(right);
    }
  });
  const lock = () => {
    locked = true;
    root.querySelectorAll("button").forEach((btn) => { btn.disabled = true; });
  };
  return {
    prompt: "Find the word that's wrong. Tap it to fix it.",
    usesCheck: false,
    retry: () => {
      choiceBox.hidden = true;
      root.querySelectorAll(".word-btn").forEach((btn) => btn.classList.remove("selected", "wrong"));
    },
    reveal: () => {
      locked = true;
      root.innerHTML = `<p class="sentence answer">${parsed.words.map((word, i) =>
        (i === parsed.target ? `<mark>${esc(parsed.prefix + parsed.correct + parsed.suffix)}</mark>` : esc(word))).join(" ")}</p>`;
    },
    lock,
    showRight: () => {
      lock();
      root.querySelector(".sentence").innerHTML = parsed.words.map((word, i) =>
        (i === parsed.target ? `<mark>${esc(parsed.prefix + parsed.correct + parsed.suffix)}</mark>` : esc(word))).join(" ");
      choiceBox.hidden = true;
    },
  };
}

function renderWhich(root, item, { answer, onTap }) {
  const parsed = parseWhich(item);
  const choices = shuffle(parsed.choices);
  let locked = false;
  let picked = null; // the last wrong choice, for "You chose" in the feedback and the results
  const blank = parsed.kind === "blank"
    ? `<p class="sentence">${esc(parsed.before)}<span class="blank" aria-label="blank">&nbsp;</span>${esc(parsed.after)}</p>` : "";
  root.innerHTML = `${blank}<div class="choices-list ${parsed.kind}" data-type="which">${choices.map((choice) =>
    `<button type="button" class="choice${parsed.kind === "sentences" ? " sentence-choice" : ""}" data-choice="${esc(choice)}">${esc(choice)}</button>`).join("")}</div>`;
  root.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-choice]");
    if (!choice || locked) return;
    onTap();
    const right = choice.dataset.choice === parsed.correct;
    if (!right) {
      choice.disabled = true;
      choice.classList.add("wrong");
      picked = choice.dataset.choice;
    }
    answer(right);
  });
  const markRight = () => {
    locked = true;
    root.querySelectorAll("[data-choice]").forEach((btn) => {
      btn.disabled = true;
      if (btn.dataset.choice === parsed.correct) btn.classList.add("right");
    });
    const gap = root.querySelector(".blank");
    if (gap) {
      gap.textContent = parsed.correct;
      gap.classList.add("filled");
    }
  };
  return {
    prompt: item.prompt || (parsed.kind === "blank" ? "Which one fits in the blank?" : "Which sentence is written correctly?"),
    usesCheck: false,
    choicesText: choices,
    // With only two choices, a miss leaves just the answer, so there's no second try: it's shown and counts as missed.
    oneShot: choices.length <= 2,
    chosen: () => picked,
    retry: () => {},
    reveal: markRight,
    lock: markRight,
    showRight: markRight,
  };
}

function renderBuild(root, item, { onChange, onTap }) {
  const parsed = parseBuild(item);
  // Shuffle until the order differs from the answer, so there's always something to do.
  let bank = parsed.tiles.map((text, id) => ({ id, text }));
  for (let tries = 0; tries < 10; tries++) {
    bank = shuffle(bank);
    if (bank.some((tile, i) => tile.text !== parsed.tiles[i])) break;
  }
  const placed = [];
  let locked = false;
  root.innerHTML = `<div class="build-slots" data-type="build" aria-label="Your sentence"></div><div class="build-bank" aria-label="Pieces"></div>`;
  const slots = root.querySelector(".build-slots");
  const bankEl = root.querySelector(".build-bank");
  const tile = (t, where) => `<button type="button" class="tile" data-tile="${t.id}" data-where="${where}" ${locked ? "disabled" : ""}>${esc(t.text)}</button>`;
  function draw() {
    slots.innerHTML = placed.length ? placed.map((t) => tile(t, "slot")).join("") : '<span class="slots-empty">Tap the pieces below</span>';
    bankEl.innerHTML = bank.map((t) => tile(t, "bank")).join("");
  }
  root.addEventListener("click", (event) => {
    const el = event.target.closest("[data-tile]");
    if (!el || locked) return;
    const id = Number(el.dataset.tile);
    const [from, to] = el.dataset.where === "bank" ? [bank, placed] : [placed, bank];
    to.push(from.splice(from.findIndex((t) => t.id === id), 1)[0]);
    onTap();
    draw();
    onChange();
  });
  draw();
  return {
    prompt: "Tap the pieces in order to build the sentence.",
    usesCheck: true,
    canCheck: () => bank.length === 0,
    check: () => checkBuild(parsed, placed.map((t) => t.text)),
    retry: () => {},
    reveal: () => { locked = true; root.innerHTML = `<p class="sentence answer"><mark>${esc(parsed.answerText)}</mark></p>`; },
    lock: () => { locked = true; draw(); },
    built: () => joinTiles(placed.map((t) => t.text)),
  };
}

function renderSort(root, item, { onChange, onTap }) {
  const parsed = parseSort(item);
  const tiles = shuffle(parsed.tiles.map((tile, id) => ({ ...tile, id })));
  const placed = {}; // tile id → bin index
  let selected = null;
  let locked = false;
  root.innerHTML = `<div class="sort-bank" data-type="sort" aria-label="Words to sort"></div>
    <div class="sort-bins" style="--bins:${parsed.bins.length}">${parsed.bins.map((bin, i) =>
      `<div class="sort-bin" data-bin="${i}"><button type="button" class="bin-head" data-bin-target="${i}">${esc(bin.name)}</button><div class="bin-tiles"></div></div>`).join("")}</div>`;
  const bankEl = root.querySelector(".sort-bank");
  const tile = (t) => `<button type="button" class="tile${selected === t.id ? " selected" : ""}" data-sort-tile="${t.id}" aria-pressed="${selected === t.id}" ${locked ? "disabled" : ""}>${esc(t.text)}</button>`;
  function draw() {
    const inBank = tiles.filter((t) => placed[t.id] === undefined);
    bankEl.innerHTML = inBank.length ? inBank.map(tile).join("")
      : '<span class="slots-empty">All sorted. Tap one to move it.</span>';
    parsed.bins.forEach((bin, i) => {
      const box = root.querySelector(`.sort-bin[data-bin="${i}"]`);
      box.classList.toggle("ready", selected !== null && !locked);
      box.querySelector(".bin-tiles").innerHTML = tiles.filter((t) => placed[t.id] === i).map(tile).join("");
    });
  }
  root.addEventListener("click", (event) => {
    if (locked) return;
    const tileEl = event.target.closest("[data-sort-tile]");
    const binEl = event.target.closest("[data-bin]");
    if (tileEl) {
      const id = Number(tileEl.dataset.sortTile);
      selected = selected === id ? null : id;
      onTap();
    } else if (binEl && selected !== null) {
      placed[selected] = Number(binEl.dataset.bin);
      selected = null;
      onTap();
    } else if (event.target.closest(".sort-bank") && selected !== null) {
      delete placed[selected];
      selected = null;
    } else {
      return;
    }
    draw();
    onChange();
  });
  draw();
  const byText = () => Object.fromEntries(tiles.filter((t) => placed[t.id] !== undefined).map((t) => [t.text, parsed.bins[placed[t.id]].name]));
  return {
    prompt: item.prompt || "Tap a word, then tap the box it belongs in.",
    usesCheck: true,
    canCheck: () => tiles.every((t) => placed[t.id] !== undefined),
    check: () => checkSort(parsed, byText()),
    retry: () => { selected = null; draw(); },
    reveal: () => {
      locked = true;
      for (const t of tiles) placed[t.id] = parsed.bins.findIndex((bin) => bin.name === t.bin);
      selected = null;
      draw();
      root.querySelectorAll(".sort-bin").forEach((box) => box.classList.add("answer"));
    },
    lock: () => { locked = true; selected = null; draw(); },
  };
}

function renderCheck(root, item, { answer, onChange, onTap }) {
  const parsed = parseCheck(item);
  const fixes = shuffle(parsed.fixes);
  let step = 1;
  let locked = false;
  root.innerHTML = `<p class="sentence check-sentence" data-type="check">${esc(parsed.text)}</p>
    <div class="choices-list kinds">${parsed.kinds.map((kind) =>
      `<button type="button" class="choice kind-choice" data-kind="${kind}">${esc(CHECK_KINDS[kind])}</button>`).join("")}</div>
    <div class="fix-step" hidden><p class="palette-label">Pick the best fix:</p><div class="choices-list sentences">${fixes.map((fix) =>
      `<button type="button" class="choice sentence-choice" data-fix="${esc(fix)}">${esc(fix)}</button>`).join("")}</div></div>`;
  const showKind = () => {
    root.querySelectorAll("[data-kind]").forEach((btn) => {
      btn.disabled = true;
      if (btn.dataset.kind === parsed.kind) btn.classList.add("right");
    });
  };
  root.addEventListener("click", (event) => {
    if (locked) return;
    const kindBtn = event.target.closest("[data-kind]");
    const fixBtn = event.target.closest("[data-fix]");
    if (kindBtn && step === 1) {
      onTap();
      if (kindBtn.dataset.kind !== parsed.kind) {
        kindBtn.disabled = true;
        kindBtn.classList.add("wrong");
        answer(false);
        return;
      }
      showKind();
      if (parsed.kind === "complete") {
        answer(true);
        return;
      }
      step = 2;
      root.querySelector(".fix-step").hidden = false;
      onChange();
    } else if (fixBtn && step === 2) {
      onTap();
      const right = fixBtn.dataset.fix === parsed.fix;
      if (!right) {
        fixBtn.disabled = true;
        fixBtn.classList.add("wrong");
      }
      answer(right);
    }
  });
  const showAnswer = () => {
    locked = true;
    showKind();
    if (parsed.kind !== "complete") {
      root.querySelector(".fix-step").hidden = false;
      root.querySelectorAll("[data-fix]").forEach((btn) => {
        btn.disabled = true;
        if (btn.dataset.fix === parsed.fix) btn.classList.add("right");
      });
    }
  };
  return {
    get prompt() {
      if (step === 2) return "Pick the best way to fix it.";
      return parsed.kinds.length === 3 ? "Is this a complete sentence, a fragment or a run-on?" : "Is this a complete sentence or a fragment?";
    },
    usesCheck: false,
    choicesText: null,
    retry: () => {},
    reveal: showAnswer,
    lock: showAnswer,
    showRight: showAnswer,
  };
}

function renderJoin(root, item, hooks) {
  const { answer, onChange, onTap } = hooks;
  const parsed = parseJoin(item);
  const words = shuffle(parsed.words);
  let step = 1;
  let mark = null;
  let locked = false;
  root.innerHTML = `<div class="join-parts" data-type="join"><p class="sentence">${esc(parsed.first)}</p><p class="sentence">${esc(parsed.second)}</p></div>
    <div class="word-step"><p class="palette-label">Join them with:</p><div class="choices-list">${words.map((word) =>
      `<button type="button" class="choice" data-join-word="${esc(word)}">${esc(word)}</button>`).join("")}</div></div>
    <div class="comma-step" hidden><p class="palette-label">Your sentence. Tap the space where a comma goes, if one does:</p><div class="comma-sentence"></div></div>`;
  const answerHtml = () => {
    const gaps = parsed.result.gaps;
    const hi = (m) => (m ? `<mark>${esc(m)}</mark>` : "");
    return parsed.result.words.map((word, i) => esc(word) + hi(gaps[i + 1].after)).join(" ");
  };
  root.addEventListener("click", (event) => {
    const wordBtn = event.target.closest("[data-join-word]");
    if (!wordBtn || step !== 1 || locked) return;
    onTap();
    if (wordBtn.dataset.joinWord !== parsed.word) {
      wordBtn.disabled = true;
      wordBtn.classList.add("wrong");
      answer(false);
      return;
    }
    step = 2;
    root.querySelectorAll("[data-join-word]").forEach((btn) => {
      btn.disabled = true;
      if (btn === wordBtn) btn.classList.add("right");
    });
    root.querySelector(".comma-step").hidden = false;
    mark = renderMark(root.querySelector(".comma-sentence"),
      { id: item.id, skill: item.skill, level: item.level, type: "mark", text: item.result, marks: [","] }, hooks, { allowEmpty: true });
    onChange();
  });
  const showAnswer = () => {
    locked = true;
    root.querySelectorAll("[data-join-word]").forEach((btn) => {
      btn.disabled = true;
      if (btn.dataset.joinWord === parsed.word) btn.classList.add("right");
    });
    root.querySelector(".comma-step").hidden = false;
    root.querySelector(".comma-step .palette-label").textContent = "The joined sentence:";
    root.querySelector(".comma-sentence").innerHTML = `<p class="sentence answer">${answerHtml()}</p>`;
  };
  return {
    get prompt() {
      return step === 1 ? "Pick the best word to join these two sentences." : "Does it need a comma? Tap the space, or tap Check if it doesn't.";
    },
    get usesCheck() { return step === 2 && !locked; },
    canCheck: () => step === 2,
    check: () => mark.check(),
    retry: () => mark?.retry(),
    reveal: showAnswer,
    lock: () => { locked = true; mark?.lock(); },
  };
}

const KIND_HINT = "Look at the end mark: a period makes a statement, a question mark a question, and an exclamation point shows strong feeling.";
const PATTERN_HINT = "Look at the labels after the verb: nothing more is P1, a DO is P2, an IO and a DO is P3, a PrN is P4, a PA is P5, a DO and OCN is P6, a DO and OCA is P7.";

/**
 * Q&A Flow: one question at a time. For a question, tap the word that answers it, then pick its label;
 * for a word already pointed out, just pick its label. Then the kind of sentence (and, in level 3, the pattern).
 * A miss gives a hint for that step; a second miss on the same step shows it and moves on.
 */
function renderFlow(root, item, { hint, complete, onChange, onTap, showLabels, nounTable, nounReminders, showNouns, onNounTable }) {
  const parsed = parseFlow(item.markupOnly ? { ...item, steps: [] } : item);
  const stages = item.markupOnly ? [] : [...parsed.steps.map((step) => ({ ...step, kind: "step" })), { kind: "kind" }];
  if (parsed.pattern && !item.markupOnly) stages.push({ kind: "pattern" });
  const shown = {}; // word index → label shown above it
  if (item.markupOnly) parsed.words.forEach((w, i) => { shown[i] = w.label; });
  let at = 0;
  let phase = "word"; // "word" (tap a word) or "label" (pick a label) for steps
  let stepMisses = 0;
  let misses = 0;
  let revealed = false;
  let done = false;
  // Mark it up (Shurley Skill Check) runs after the last question.
  // The noun check (circle every noun) only when the player turned on Circle the nouns: the flow just labeled them.
  const tasks = item.noMarkup ? [] : markupTasks(parsed.words.map((w) => w.label), parsed.words.map((w) => w.word))
    .filter((t) => t.id !== "circle" || item.circleNouns);
  root.dataset.circle = item.circleNouns ? "1" : "0";
  let markAt = -1;
  let picked = new Set();
  const marks = {}; // word index → Set of marks drawn
  let taskMisses = 0;

  // Noun table (one sentence a level, grades 4+): after the mark-up, fill in each noun's job, number and kind.
  const table = nounTable && !item.markupOnly
    ? nounTableQuestions(parsed.words.map((w) => w.label), parsed.words.map((w) => w.word), parsed.labels)
    : [];
  let tableAt = -1;
  let tableMisses = 0;
  let tableRight = 0; // right on the first try, so reminders can fade once a child knows them
  const tableAnswers = {}; // question id → answer shown in the table
  const tabling = () => tableAt >= 0 && tableAt < table.length;

  root.innerHTML = `<div class="flow" data-type="flow">
    <div class="flow-sentence">${parsed.words.map((w, i) =>
      `<button type="button" class="flow-word" data-fw="${i}"><span class="fw-label" aria-hidden="true"></span><span class="fw-text">${esc(w.word)}</span></button>`).join("")}</div>
    <div class="noun-table-wrap" hidden></div>
    <div class="flow-ask"><div class="flow-ask-head"><p class="flow-count"></p>${LABELS_BUTTON}${CARD_TOOLS}</div><p class="flow-q" aria-live="polite"></p><div class="flow-choices"></div><div class="flow-why" hidden></div></div>
  </div>`;
  const stage = () => stages[at];
  // Two words answering the same question as parts of one compound (Mia and Leo; he and I; apples and grapes).
  const COMPOUND_GROUP = { CSN: "subject", CSP: "subject", CPrN: "prn", CPrP: "prn" };
  const groupOf = (label) => COMPOUND_GROUP[label] || label;
  const compoundPartner = (a, b) => {
    const [la, lb] = [parsed.words[a].label, parsed.words[b].label];
    if (!/^C./.test(la) || groupOf(la) !== groupOf(lb)) return false;
    const between = [a, b].sort((x, y) => x - y);
    // Joined by a conjunction between them, and the other word still waits for its own step.
    return parsed.words.some((w, i) => w.label === "C" && i > between[0] && i < between[1])
      && stages.some((s, k) => k > at && s.kind === "step" && s.index === a);
  };

  function drawTable() {
    const wrap = root.querySelector(".noun-table-wrap");
    wrap.hidden = false;
    const nouns = [...new Set(table.filter((q) => q.noun !== undefined).map((q) => q.noun))];
    const cell = (id) => esc(tableAnswers[id] ?? "");
    const short = (job) => (job ? job.split(" · ")[0] : "");
    wrap.innerHTML = `<table class="noun-table"><caption>Noun table</caption>
      <thead><tr><th scope="col">Noun</th><th scope="col">Job</th><th scope="col">Singular or plural</th><th scope="col">Common or proper</th></tr></thead>
      <tbody>${nouns.map((i) => `<tr><th scope="row">${esc(parsed.words[i].word.replace(/[.?!,]+$/, ""))}</th>
        <td>${esc(short(tableAnswers[`job-${i}`]))}</td><td>${cell(`number-${i}`)}</td><td>${cell(`kind-${i}`)}</td></tr>`).join("")}</tbody></table>
      <p class="noun-simple"><span>Simple subject: <strong>${cell("simple-subject")}</strong></span><span>Simple predicate: <strong>${cell("simple-predicate")}</strong></span></p>`;
    if (!tabling()) return;
    const q = table[tableAt];
    root.querySelector(".flow-count").textContent = `Noun table · ${tableAt + 1} of ${table.length}`;
    if (!root.querySelector("[data-nouns-help]")) {
      root.querySelector("[data-labels-help]").outerHTML = NOUNS_BUTTON;
    }
    root.querySelector(".flow-q").textContent = q.prompt;
    root.querySelector(".flow-choices").innerHTML = (nounReminders ? `<p class="palette-label nt-reminder">${esc(q.reminder)}</p>` : "")
      + shuffle(q.choices).map((c) => `<button type="button" class="choice" data-nt="${esc(c)}">${esc(c)}</button>`).join("");
    root.querySelectorAll(".flow-word").forEach((btn) => { btn.disabled = true; btn.classList.remove("current", "picked"); });
  }

  function answerTable(choice) {
    const q = table[tableAt];
    if (choice !== q.answer) {
      misses += 1;
      tableMisses += 1;
      if (tableMisses === 1) {
        hint(`Not quite. ${q.hint}`);
        root.querySelector(`[data-nt="${CSS.escape(choice)}"]`)?.setAttribute("disabled", "");
        return;
      }
      revealed = true;
      hint(`It's ${q.answer}. ${q.hint}`);
    } else {
      hint(null);
      if (!tableMisses) tableRight += 1;
    }
    tableAnswers[q.id] = q.answer;
    tableMisses = 0;
    tableAt += 1;
    if (tableAt >= table.length) {
      done = true;
      onNounTable?.(tableRight);
      drawTable();
      draw();
      onChange();
      complete({ tries: misses ? 2 : 1, correct: !revealed });
      return;
    }
    drawTable();
    onChange();
  }
  const labelChips = () => parsed.labels.map((label) =>
    `<button type="button" class="label-chip" data-label="${esc(label)}"><strong>${esc(label)}</strong><small>${esc(LABELS[label].name)}</small></button>`).join("");

  const marking = () => markAt >= 0 && markAt < tasks.length;

  function paintMarks() {
    const task = marking() ? tasks[markAt] : null;
    const has = (i, mark) => marks[i]?.has(mark) || (task?.mark === mark && picked.has(i));
    root.querySelectorAll(".flow-word").forEach((btn) => {
      const i = Number(btn.dataset.fw);
      btn.classList.toggle("mk-circle", has(i, "circle"));
      btn.classList.toggle("mk-u1", has(i, "u1"));
      btn.classList.toggle("mk-u2", has(i, "u2"));
      btn.classList.toggle("mk-slash", has(i, "slash"));
      btn.classList.toggle("mk-po", has(i, "paren") && !has(i - 1, "paren"));
      btn.classList.toggle("mk-pc", has(i, "paren") && !has(i + 1, "paren"));
    });
  }

  function drawMarkup() {
    const task = tasks[markAt];
    root.querySelectorAll(".flow-word").forEach((btn) => {
      btn.disabled = false;
      btn.classList.remove("current");
      btn.classList.toggle("picked", picked.has(Number(btn.dataset.fw)));
    });
    paintMarks();
    root.querySelector(".flow-count").textContent = `Mark it up · ${markAt + 1} of ${tasks.length}`;
    root.querySelector(".flow-q").textContent = task.prompt;
    const how = task.mode === "multi"
      ? "Tap the words, then tap Done. Tap a word again to undo."
      : "Tap the word, then tap Done. Tap another word to move the slash.";
    const showHow = !markupHowShown || taskMisses > 0;
    markupHowShown = true;
    root.querySelector(".flow-choices").innerHTML =
      `${showHow ? `<p class="palette-label">${how}</p>` : ""}<button type="button" class="btn primary markup-done" data-markup-done>Done</button>`;
  }

  function finishTask(showAnswer) {
    const task = tasks[markAt];
    for (const i of task.answer) (marks[i] ||= new Set()).add(task.mark);
    picked = new Set();
    taskMisses = 0;
    markAt += 1;
    if (!showAnswer) hint(null);
    if (markAt >= tasks.length) {
      root.querySelectorAll(".flow-word").forEach((btn) => btn.classList.remove("picked"));
      if (table.length) {
        tableAt = 0;
        paintMarks();
        drawTable();
        onChange();
        return;
      }
      done = true;
      draw();
      onChange();
      complete({ tries: misses ? 2 : 1, correct: !revealed });
      return;
    }
    drawMarkup();
    onChange();
  }

  function tryTask() {
    const task = tasks[markAt];
    if (checkMarkup(task, [...picked])) {
      finishTask(false);
      return;
    }
    misses += 1;
    taskMisses += 1;
    if (taskMisses === 1) {
      hint(`Not quite. ${task.hint}`);
      if (task.mode === "first") picked = new Set();
      drawMarkup();
      return;
    }
    revealed = true;
    const shown = task.answer.map((i) => parsed.words[i].word.replace(/[.!?,]$/, ""));
    hint(task.mode === "first"
      ? `The slash goes right before ${shown[0]}. ${task.hint}`
      : `Here's that one: ${shown.join(", ")}.`);
    finishTask(true);
  }

  function draw() {
    if (marking()) { drawMarkup(); return; }
    const st = stage();
    root.querySelectorAll(".flow-word").forEach((btn) => {
      const i = Number(btn.dataset.fw);
      btn.querySelector(".fw-label").textContent = shown[i] || "";
      btn.classList.toggle("labeled", Boolean(shown[i]));
      btn.classList.toggle("current", !done && st?.kind === "step" && (phase === "label" || st.question === null) && st.index === i);
      btn.disabled = done || st?.kind !== "step" || phase !== "word";
      btn.setAttribute("aria-label", `${parsed.words[i].word}${shown[i] ? `, ${LABELS[shown[i]].name}` : ""}`);
    });
    const count = root.querySelector(".flow-count");
    const q = root.querySelector(".flow-q");
    const choices = root.querySelector(".flow-choices");
    if (done) {
      count.textContent = "";
      q.textContent = ""; // the labels are on the words, and the answer below spells out the pattern
      choices.innerHTML = "";
      return;
    }
    count.textContent = st.kind === "step" ? `Question ${at + 1} of ${parsed.steps.length}` : "Last question";
    if (st.kind === "step") {
      q.textContent = st.question && phase === "word" ? st.question
        : st.question ? `${st.question} ${parsed.words[st.index].word.replace(/[.!?]$/, "")}. Now pick its label.`
          : `Label this word: ${parsed.words[st.index].word.replace(/[.!?]$/, "")}`;
      choices.innerHTML = phase === "label" || st.question === null ? labelChips() : '<p class="palette-label">Tap the word in the sentence that answers it.</p>';
    } else if (st.kind === "kind") {
      q.textContent = "What kind of sentence is it?";
      choices.innerHTML = Object.entries(SENTENCE_KINDS).map(([key, text]) =>
        `<button type="button" class="choice sentence-choice" data-kind-pick="${key}">${esc(text)}</button>`).join("");
    } else {
      q.textContent = "Which pattern is it?";
      choices.innerHTML = parsed.patternChoices.map((key) =>
        `<button type="button" class="choice" data-pattern="${key}">${esc(PATTERNS[key])}</button>`).join("");
    }
  }

  function advance() {
    stepMisses = 0;
    at += 1;
    phase = "word";
    if (stage()?.kind === "step" && stage().question === null) phase = "label";
    if (at >= stages.length) {
      if (tasks.length) {
        markAt = 0;
        drawMarkup();
        onChange();
        return;
      }
      done = true;
      draw();
      complete({ tries: misses ? 2 : 1, correct: !revealed });
      return;
    }
    draw();
    onChange();
  }

  function miss(hintText, showText, apply) {
    misses += 1;
    stepMisses += 1;
    if (stepMisses === 1) {
      hint(hintText);
      return;
    }
    revealed = true;
    apply();
    hint(`Here's that one: ${showText}`);
    advance();
  }

  function offerWhy(word, why) {
    const box = root.querySelector(".flow-why");
    if (!box) return;
    box.hidden = false;
    box.innerHTML = `<button type="button" class="link why-btn" data-why aria-expanded="false">Why is “${esc(word.replace(/[.,!?]$/, ""))}” an adverb?</button><p class="why-text" hidden>${esc(why)}</p>`;
  }

  root.addEventListener("click", (event) => {
    const whyBtn = event.target.closest("[data-why]");
    if (whyBtn) {
      const text = whyBtn.nextElementSibling;
      text.hidden = !text.hidden;
      whyBtn.setAttribute("aria-expanded", String(!text.hidden));
      return;
    }
    // Any other tap moves on, so the Why? goes away with the next step.
    if (!event.target.closest(".flow-why")) {
      const box = root.querySelector(".flow-why");
      if (box && !box.hidden && event.target.closest("button")) { box.hidden = true; box.innerHTML = ""; }
    }
    if (event.target.closest("[data-labels-help]")) {
      showLabels(parsed.labels, parsed.patternChoices);
      return;
    }
    // The Nouns reminder works any time, even after the sentence is finished, like Labels.
    if (event.target.closest("[data-nouns-help]")) {
      showNouns?.();
      return;
    }
    if (done) return;
    if (tabling()) {
      const pick = event.target.closest("[data-nt]");
      if (pick && !pick.disabled) {
        onTap();
        answerTable(pick.dataset.nt);
      }
      return;
    }
    if (marking()) {
      const task = tasks[markAt];
      const tapped = event.target.closest("[data-fw]");
      if (tapped) {
        onTap();
        const i = Number(tapped.dataset.fw);
        if (task.mode === "first") picked = picked.has(i) ? new Set() : new Set([i]); // one slash: tapping moves it
        else if (picked.has(i)) picked.delete(i);
        else picked.add(i);
        drawMarkup();
        onChange();
      } else if (event.target.closest("[data-markup-done]")) {
        onTap();
        tryTask();
      }
      return;
    }
    const st = stage();
    const word = event.target.closest("[data-fw]");
    const chip = event.target.closest("[data-label]");
    const kindPick = event.target.closest("[data-kind-pick]");
    const pattern = event.target.closest("[data-pattern]");
    const showStep = () => { shown[st.index] = st.label; };
    const stepText = () => `${parsed.words[st.index].word.replace(/[.!?]$/, "")} is ${st.label}, the ${LABELS[st.label].name}.`;
    if (word && st.kind === "step" && phase === "word") {
      onTap();
      const tappedAt = Number(word.dataset.fw);
      const partner = tappedAt !== st.index && compoundPartner(tappedAt, st.index);
      if (partner) {
        // The other part of the same compound answers the question too: that word's steps come first now.
        const later = stages.findIndex((s, k) => k > at && s.kind === "step" && s.index === tappedAt);
        [st.index, st.label, stages[later].index, stages[later].label] = [tappedAt, stages[later].label, st.index, st.label];
      }
      if (tappedAt === st.index) {
        phase = "label";
        hint(null);
        draw();
        onChange();
      } else {
        const youTip = parsed.words[st.index].word === "(You)" ? " In a command, the subject is the understood (You): it isn't written, but it's there, at the start." : "";
        miss(`Not that word. The question is "${st.question}"${youTip || (LABELS[st.label]?.find ? ` Tip: ${LABELS[st.label].find}.` : " Which word answers it?")}`, stepText(), showStep);
        draw();
      }
    } else if (chip && st.kind === "step" && phase === "label") {
      onTap();
      // A tricky adverb (not, never, very…) gets its own why, instead of the general adverb hint.
      const word = parsed.words[st.index].word;
      const why = st.label === "Adv" ? trickyAdverb(word) : null;
      if (chip.dataset.label === st.label) {
        showStep();
        hint(null);
        advance();
        if (why) offerWhy(word, why); // a "Why?" to tap, never shown on its own (the 8th grader: don't slow me down)
      } else {
        chip.disabled = true;
        miss(why || LABELS[st.label].hint, why ? `${stepText()} ${why}` : stepText(), showStep);
      }
    } else if (kindPick && st.kind === "kind") {
      onTap();
      if (kindPick.dataset.kindPick === parsed.kind) {
        hint(null);
        advance();
      } else {
        kindPick.disabled = true;
        miss(KIND_HINT, SENTENCE_KINDS[parsed.kind], () => {});
      }
    } else if (pattern && st.kind === "pattern") {
      onTap();
      if (Number(pattern.dataset.pattern) === parsed.pattern) {
        hint(null);
        advance();
      } else {
        pattern.disabled = true;
        miss(PATTERN_HINT, PATTERNS[parsed.pattern], () => {});
      }
    }
  });
  if (stage()?.question === null) phase = "label";
  if (item.markupOnly) markAt = 0;
  draw();
  return {
    get prompt() {
      const st = stage();
      if (marking()) return tasks[markAt].prompt;
      if (tabling()) return table[tableAt].prompt;
      if (done || !st) return table.length ? "Labeled, marked up and in the table!" : tasks.length ? "Labeled and marked up!" : "Labeled!";
      if (st.kind === "kind") return "What kind of sentence is it?";
      if (st.kind === "pattern") return "Which pattern is it?";
      return st.question && phase === "word" ? "Tap the word that answers the question." : "Pick its label.";
    },
    usesCheck: false,
    selfScoring: true,
    retry: () => {},
    reveal: () => {},
    lock: () => { done = true; draw(); },
  };
}

/** Build from labels: put the word tiles in the spaces so each word matches the label over its space. */
function renderLabels(root, item, { onChange, onTap, showLabels }) {
  const parsed = parseLabels(item);
  let bank = parsed.tiles.map((t, id) => ({ ...t, id }));
  for (let tries = 0; tries < 10; tries++) {
    bank = shuffle(bank);
    if (bank.some((t, i) => t.word !== parsed.tiles[i].word)) break;
  }
  const slots = parsed.line.map(() => null);
  let locked = false;
  root.innerHTML = `<div class="labels-head">${LABELS_BUTTON}</div><div class="label-slots" data-type="labels"></div><div class="build-bank"></div>`;
  root.querySelector("[data-labels-help]").addEventListener("click", () => showLabels((FLOW_LABELS[item.skill] || FLOW_LABELS.flow)[item.level - 1], []));
  const tile = (t, where) => `<button type="button" class="tile" data-ltile="${t.id}" data-where="${where}" ${locked ? "disabled" : ""}>${esc(t.word)}</button>`;
  function draw() {
    root.querySelector(".label-slots").innerHTML = parsed.line.map((label, i) =>
      `<div class="label-slot"><span class="slot-label" title="${esc(LABELS[label].name)}">${esc(label)}</span>${slots[i] ? tile(slots[i], "slot") : '<span class="slot-empty" aria-label="empty"></span>'}</div>`).join("")
      + (parsed.end ? `<span class="label-end" aria-label="end mark ${esc(parsed.end)}">${esc(parsed.end)}</span>` : "");
    root.querySelector(".build-bank").innerHTML = bank.map((t) => tile(t, "bank")).join("");
  }
  root.addEventListener("click", (event) => {
    const el = event.target.closest("[data-ltile]");
    if (!el || locked) return;
    const id = Number(el.dataset.ltile);
    if (el.dataset.where === "bank") {
      const free = slots.indexOf(null);
      if (free < 0) return;
      slots[free] = bank.splice(bank.findIndex((t) => t.id === id), 1)[0];
    } else {
      const i = slots.findIndex((t) => t?.id === id);
      bank.push(slots[i]);
      slots[i] = null;
    }
    onTap();
    draw();
    onChange();
  });
  draw();
  return {
    prompt: "Build a sentence that matches the labels.",
    usesCheck: true,
    canCheck: () => slots.every(Boolean),
    check: () => checkLabels(parsed, slots.map((t) => t.word)),
    retry: () => {},
    reveal: () => {
      locked = true;
      root.innerHTML = `<p class="label-line">${esc(parsed.line.join(" "))}</p><p class="sentence answer"><mark>${esc(parsed.answerText)}</mark></p>`;
    },
    lock: () => { locked = true; draw(); },
  };
}

/**
 * Proofread: tap each mistake in the paragraph and pick the fix. A wrong fix gives a hint; a second wrong fix
 * on the same mistake shows it. Tapping words that are fine gives a hint, and after 3 such taps the next
 * mistake is pointed out.
 */
function renderProofread(root, item, { hint, complete, onChange, onTap }) {
  const parsed = parseProofread(item);
  // Label mode (Flow Factory's final draft): each word is "word^LABEL", and a mistake is a wrong label,
  // "word^[SHOWN|RIGHT|OTHER]". The words show as tiles with Pip's label above; the fixes are labels.
  const labelMode = item.type === "labelfix";
  const wordOf = (t) => (labelMode ? t.split("^")[0] : t);
  const labelOf = (t) => (labelMode ? t.split("^")[1] || "" : "");
  const tile = (t) => (labelMode ? `<span class="lf-label">${esc(labelOf(t))}</span><span class="lf-word">${esc(wordOf(t))}</span>` : esc(t));
  const why = (e) => (labelMode ? `${e.correct} = ${LABELS[e.correct]?.name || e.correct}. ${LABELS[e.correct]?.hint || ""}`.trim() : mistakeKind(e.shown, e.correct));
  const fixed = {}; // word index → "right" or "shown"
  const fixMisses = {};
  let open = null; // index of the mistake being fixed
  let misses = 0;
  let wrongTaps = 0;
  let revealed = false;
  let done = false;
  let pointed = null;
  const picks = []; // wrong fixes picked, for "You chose" in the results
  const errorAt = (i) => parsed.errors.find((e) => e.index === i);
  const choicesFor = {};
  for (const e of parsed.errors) choicesFor[e.index] = shuffle(e.choices);

  // The fixes sit in a bar pinned to the bottom of the screen, so a long paragraph never pushes them (or the tapped
  // word) out of view on a phone (expert panel, after a Galaxy S26 report).
  root.innerHTML = `<div class="proofread" data-type="proofread"><p class="proof-count"></p><p class="proof-text"></p>
    <div class="choices fix-bar" role="group" hidden><div class="fix-bar-head"><p class="palette-label"></p>
    <button type="button" class="fix-bar-close" data-pclose aria-label="Close the fixes">✕</button></div><div class="choice-row"></div></div></div>`;
  const left = () => parsed.errors.filter((e) => !fixed[e.index]).length;

  function draw() {
    root.querySelector(".proof-count").textContent = done ? (labelMode ? "All labels fixed" : "All mistakes fixed")
      : `${labelMode ? "Wrong labels fixed" : "Mistakes fixed"}: ${parsed.errors.length - left()} of ${parsed.errors.length}`;
    root.querySelector(".proof-text").innerHTML = parsed.words.map((word, i) => {
      const e = errorAt(i);
      if (e && fixed[i]) return `<span class="proof-word ${fixed[i]}">${tile(e.fixed)}</span>`;
      return `<button type="button" class="proof-word${open === i ? " selected" : ""}${pointed === i ? " pointed" : ""}" data-pw="${i}" ${done ? "disabled" : ""}
        ${labelMode ? `aria-label="${esc(wordOf(word))}, labeled ${esc(labelOf(word))}"` : ""}>${tile(word)}</button>`;
    }).join(" ");
    root.querySelector(".proof-text").classList.toggle("label-mode", labelMode);
    const box = root.querySelector(".choices");
    box.hidden = open === null || done;
    if (open !== null) {
      const e = errorAt(open);
      const w = parsed.words[open];
      box.querySelector(".palette-label").textContent = labelMode ? `Relabel "${wordOf(w).replace(/[.,!?;:]+$/, "")}" (Pip says ${labelOf(w)}):` : `Change "${w}" to:`;
      box.setAttribute("aria-label", `${labelMode ? `Relabel ${wordOf(w)}` : `Change ${w} to`}: ${choicesFor[open].length} options`);
      box.querySelector(".choice-row").innerHTML = choicesFor[open].map((c) => labelMode
        ? `<button type="button" class="choice label-choice" data-pfix="${esc(c)}"><strong>${esc(c)}</strong> <small>${esc(LABELS[c]?.name || "")}</small></button>`
        : `<button type="button" class="choice" data-pfix="${esc(c)}">${esc(e.prefix + c + e.suffix)}</button>`).join("");
    }
    if (box.hidden) { const play = document.getElementById("play"); if (play) play.style.paddingBottom = ""; }
    placeHint();
  }
  // Pip's hint sits just above the bar instead of on top of it, wherever the bar is (pinned to the bottom of the
  // screen, or resting under a short paragraph).
  function placeHint() {
    if (!root.isConnected) return;
    const box = root.querySelector(".choices");
    // The bar is pinned to the bottom of the screen, as wide as the question card.
    if (box && !box.hidden) {
      const card = root.getBoundingClientRect();
      box.style.left = `${Math.round(card.left)}px`;
      box.style.width = `${Math.round(card.width)}px`;
    }
    const top = box && !box.hidden ? box.getBoundingClientRect().top : innerHeight;
    document.documentElement.style.setProperty("--fix-bar-h", `${Math.max(0, Math.round(innerHeight - top))}px`);
  }
  const onScroll = () => {
    if (!root.isConnected) { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); return; }
    placeHint();
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  /** Keeps the tapped word in view, just above the bar (or below the top of the screen). */
  function showWord(i) {
    const w = root.querySelector(`[data-pw="${i}"]`);
    const box = root.querySelector(".choices");
    if (!w || box.hidden) return;
    // Room to scroll, even under a short paragraph, so the word can always move above the bar and the hint.
    const play = document.getElementById("play");
    if (play) play.style.paddingBottom = `${Math.round(innerHeight * 0.6)}px`;
    placeHint();
    const r = w.getBoundingClientRect();
    // Above the bar, and above Pip's hint when it's showing too.
    const fb = document.getElementById("feedback");
    const fbTop = fb && fb.childElementCount ? fb.getBoundingClientRect().top : innerHeight;
    const barTop = Math.min(box.getBoundingClientRect().top, fbTop);
    if (r.bottom > barTop - 12) window.scrollBy({ top: r.bottom - barTop + 48 });
    else if (r.top < 70) window.scrollBy({ top: r.top - 90 });
    box.querySelector(".choice")?.focus({ preventScroll: true });
  }
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || open === null) return;
    const at = open;
    open = null;
    draw();
    root.querySelector(`[data-pw="${at}"]`)?.focus();
  });
  function finishIfDone() {
    if (left()) return;
    done = true;
    open = null;
    draw();
    complete({ tries: misses ? 2 : 1, correct: !revealed });
  }
  root.addEventListener("click", (event) => {
    if (done) return;
    const word = event.target.closest("[data-pw]");
    const fix = event.target.closest("[data-pfix]");
    if (event.target.closest("[data-pclose]")) {
      open = null;
      draw();
      return;
    }
    if (word) {
      onTap();
      const i = Number(word.dataset.pw);
      if (open === i) {
        open = null; // the same word again closes the bar
      } else if (errorAt(i)) {
        open = i;
        hint(null);
      } else {
        open = null;
        misses += 1;
        wrongTaps += 1;
        if (wrongTaps >= 3) {
          pointed = parsed.errors.find((e) => !fixed[e.index]).index;
          hint("Look at the highlighted word.");
        } else {
          hint(`${labelMode ? "That label is right." : "That word is fine."} ${left()} ${left() === 1 ? "mistake" : "mistakes"} left. ${item.hint}`);
        }
      }
      draw();
      if (open !== null) showWord(open);
    } else if (fix && open !== null) {
      onTap();
      const e = errorAt(open);
      if (fix.dataset.pfix === e.correct) {
        fixed[open] = "right";
        if (pointed === open) pointed = null;
        open = null;
        hint(null);
        draw();
        finishIfDone();
      } else {
        misses += 1;
        fixMisses[open] = (fixMisses[open] || 0) + 1;
        picks.push(labelMode ? `${fix.dataset.pfix} instead of ${e.correct} for "${wordOf(e.fixed)}"` : `"${e.prefix + fix.dataset.pfix + e.suffix}" instead of "${e.fixed}"`);
        if (fixMisses[open] >= 2) {
          revealed = true;
          fixed[open] = "shown";
          hint(labelMode ? `Here's that one: "${wordOf(e.fixed)}" is ${why(e)}` : `Here's that one: "${e.fixed}". ${mistakeKind(e.shown, e.correct)}`);
          open = null;
          draw();
          finishIfDone();
        } else {
          fix.disabled = true;
          hint(`Not that one. ${labelMode ? `Ask the question for "${wordOf(e.fixed)}" again. ${LABELS[fix.dataset.pfix]?.name ? `It isn't the ${LABELS[fix.dataset.pfix].name}.` : ""}` : mistakeKind(e.shown, e.correct)}`);
          const at = open;
          requestAnimationFrame(() => showWord(at)); // keep the word in view above the hint
        }
      }
    }
    onChange();
  });
  draw();
  return {
    get prompt() {
      return done ? "All fixed!" : labelMode ? "Pip labeled his sentences. Find each wrong label, tap the word, then pick the right label." : "Find each mistake. Tap it, then pick the fix.";
    },
    usesCheck: false,
    chosen: () => (picks.length ? [...new Set(picks)].join("; ") : null),
    retry: () => {},
    reveal: () => {},
    lock: () => { done = true; draw(); },
  };
}

/** Sentence diagram: mark up the labeled sentence (Shurley Skill Check), then put each word on the diagram. */
function renderDiagram(root, item, hooks) {
  const { hint, complete, onChange, onTap } = hooks;
  const diagram = buildDiagram(item);
  const layout = layoutDiagram(diagram);
  const filled = {}; // slot id → chip id
  let chips = shuffle(diagram.slots.map((slot) => ({ id: slot.id, text: slot.text })));
  let selected = null;
  let stage = "markup";
  let markupMissed = false;
  let markupRevealed = false;
  let misses = 0;
  let revealed = false;
  // Guided: the game shows one line at a time and says why that word goes there.
  const order = guideOrder(diagram);
  let guided = false;
  let guideAt = 0;
  let usedWalkthrough = false;
  const why = (slot) => `<strong>${esc(slot.text)}</strong>${esc(explainSlot(diagram, slot).slice(slot.text.length))}`;

  root.innerHTML = `<div class="diagram-item" data-type="diagram">
    <div class="dg-markup"></div>
    <div class="dg-stage" hidden>
      <div class="flow-ask-head"><p class="flow-count">Diagram it</p>${CARD_TOOLS}</div>
      <p class="flow-q dg-q">${guided ? "Let's diagram it together, one word at a time." : "Put each word on its line in the diagram."}</p>
      <div class="dg-wrap"><svg class="dg-svg" viewBox="0 0 ${layout.width} ${layout.height}" style="max-width:${Math.round(layout.width * 1.25)}px" role="group" aria-label="Sentence diagram"></svg></div>
      <div class="dg-guide" aria-live="polite" hidden></div>
      <p class="palette-label dg-help">Tap a word, then tap its line on the diagram.</p>
      <div class="build-bank dg-bank"></div>
      <div class="dg-actions">
        <button type="button" class="btn primary dg-check" data-dg-check disabled>Check</button>
        <button type="button" class="link dg-walk" data-dg-walk>Walk me through it</button>
      </div>
      <details class="dg-why" hidden><summary>Why each word goes there</summary><ol></ol></details>
    </div>
  </div>`;
  const markupRoot = root.querySelector(".dg-markup");
  const flow = renderFlow(markupRoot, { ...item, markupOnly: true }, {
    ...hooks,
    complete: ({ tries, correct }) => {
      markupMissed = tries > 1;
      markupRevealed = !correct;
      stage = "diagram";
      markupRoot.querySelector(".flow-ask").hidden = true;
      root.querySelector(".dg-stage").hidden = false;
      hint(null);
      if (hooks.guided) startGuide(false);
      draw();
      onChange();
    },
  });

  const chipText = (id) => chips.find((c) => c.id === id)?.text ?? diagram.slots[id].text;
  function draw() {
    const svg = root.querySelector(".dg-svg");
    const lines = layout.lines.map(([x1, y1, x2, y2]) =>
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" />`).join("");
    const slots = layout.boxes.map((box) => {
      const has = filled[box.id] !== undefined;
      const text = has ? chipText(filled[box.id]) : "";
      const flat = box.angle === 0;
      const rx = flat ? -box.w / 2 : 12;
      const rw = flat ? box.w : box.w - 14;
      const label = has ? `${text}, placed` : "empty line";
      const target = guided && order[guideAt]?.id === box.id;
      return `<g class="dg-slot${has ? " filled" : ""}${target ? " dg-target" : ""}" data-slot="${box.id}" role="button" tabindex="0" aria-label="${esc(label)}"
        transform="translate(${box.x.toFixed(1)} ${box.y.toFixed(1)}) rotate(${box.angle})">
        <rect x="${rx.toFixed(1)}" y="-24" width="${rw.toFixed(1)}" height="22" rx="6" />
        <text x="${flat ? 0 : 15}" y="-7" text-anchor="${flat ? "middle" : "start"}">${esc(text)}</text></g>`;
    }).join("");
    const dashes = layout.dashes.map(([x1, y1, x2, y2]) =>
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" />`).join("");
    svg.innerHTML = `<g class="dg-lines">${lines}</g><g class="dg-dashes">${dashes}</g>${slots}`;
    const placed = new Set(Object.values(filled));
    const want = guided ? order[guideAt] : null;
    root.querySelector(".dg-bank").innerHTML = chips.filter((c) => !placed.has(c.id)).map((c) =>
      `<button type="button" class="tile${selected === c.id ? " selected" : ""}${want && c.text === want.text ? " dg-glow" : ""}" data-chip="${c.id}">${esc(c.text)}</button>`).join("");
    root.querySelector(".dg-check").disabled = stage !== "diagram" || Object.keys(filled).length < diagram.slots.length;
    root.querySelector(".dg-check").hidden = guided || stage === "done";
    root.querySelector(".dg-walk").hidden = guided || stage !== "diagram";
    const guide = root.querySelector(".dg-guide");
    guide.hidden = !guided || !want;
    if (want) {
      guide.innerHTML = `<p class="flow-count">Step ${guideAt + 1} of ${order.length}</p><p>${why(want)}</p>`
        + `<p class="palette-label">Tap <strong>${esc(want.text)}</strong>, then tap the highlighted line.</p>`;
    }
    root.querySelector(".dg-help").hidden = guided;
  }

  function startGuide(asked) {
    guided = true;
    guideAt = 0;
    usedWalkthrough = asked;
    Object.keys(filled).forEach((k) => delete filled[k]);
    selected = null;
    hint(null);
  }

  function finish() {
    stage = "done";
    guided = false;
    draw();
    root.querySelector(".dg-help").hidden = true;
    const list = root.querySelector(".dg-why");
    list.querySelector("ol").innerHTML = order.map((slot) => `<li>${why(slot)}</li>`).join("");
    list.hidden = false;
    list.open = misses > 0 || revealed || usedWalkthrough;
    onChange();
    complete({ tries: markupMissed || misses || usedWalkthrough ? 2 : 1, correct: !markupRevealed && !revealed });
  }

  function check() {
    const placedText = Object.fromEntries(Object.entries(filled).map(([slot, chip]) => [slot, chipText(chip)]));
    const wrong = wrongSlots(diagram, placedText);
    if (!wrong.length) { hint(null); finish(); return; }
    misses += 1;
    if (misses === 1) {
      wrong.forEach((id) => { delete filled[id]; });
      hint(`${wrong.length === 1 ? "One word is" : `${wrong.length} words are`} in the wrong place, so ${wrong.length === 1 ? "it's" : "they're"} back in the word bank. ${DIAGRAM_HINT}`);
      draw();
      onChange();
      return;
    }
    revealed = true;
    // Show the answer: each slot gets a chip with its own words.
    diagram.slots.forEach((slot) => { filled[slot.id] = slot.id; }); // chip ids match the slot they belong in
    hint("Here's the diagram.");
    finish();
  }

  root.addEventListener("click", (event) => {
    if (stage !== "diagram") return;
    const chip = event.target.closest("[data-chip]");
    const slot = event.target.closest("[data-slot]");
    if (chip) {
      onTap();
      const id = Number(chip.dataset.chip);
      selected = selected === id ? null : id;
      draw();
    } else if (slot && guided) {
      onTap();
      const want = order[guideAt];
      const id = Number(slot.dataset.slot);
      if (selected === null) return;
      if (id !== want.id || chipText(selected) !== want.text) {
        hint(`Not that one yet. Put ${want.text} on the highlighted line.`);
        selected = null;
        draw();
        return;
      }
      hint(null);
      filled[id] = selected;
      selected = null;
      guideAt += 1;
      if (guideAt >= order.length) finish();
      else { draw(); onChange(); }
    } else if (event.target.closest("[data-dg-walk]")) {
      onTap();
      startGuide(true);
      draw();
      onChange();
    } else if (slot) {
      onTap();
      const id = Number(slot.dataset.slot);
      if (selected !== null) {
        filled[id] = selected; // a word already there goes back to the bank
        selected = null;
      } else if (filled[id] !== undefined) {
        delete filled[id];
      }
      draw();
      onChange();
    } else if (event.target.closest("[data-dg-check]")) {
      onTap();
      check();
    }
  });
  root.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.closest("[data-slot]")) {
      event.preventDefault();
      event.target.closest("[data-slot]").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  });
  draw();
  return {
    get prompt() {
      if (stage === "markup") return flow.prompt;
      if (stage === "done") return "Diagrammed!";
      return guided ? "Let's diagram it together, one word at a time." : "Put each word on its line in the diagram.";
    },
    usesCheck: false,
    selfScoring: true,
    retry: () => {},
    reveal: () => {},
    lock: () => { stage = "done"; flow.lock(); draw(); },
  };
}

/** Sentence combining: the short sentences, then a box to type one sentence that joins them. */
function renderCombine(root, item, { onChange }) {
  const parsed = parseCombine(item);
  let locked = false;
  let lastHint = null;
  root.innerHTML = `<div class="combine-parts" data-type="combine">${parsed.parts.map((part) => `<p class="sentence">${esc(part)}</p>`).join("")}</div>
    ${parsed.use ? `<p class="combine-use">Use the word: <strong>${esc(parsed.use)}</strong></p>` : ""}
    <label class="palette-label" for="combine-input">Your sentence:</label>
    <textarea id="combine-input" class="combine-input" rows="3" maxlength="240" autocomplete="off" autocapitalize="off"
      autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="Type one sentence"></textarea>`;
  const box = root.querySelector(".combine-input");
  box.addEventListener("input", () => onChange());
  box.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      document.getElementById("check-btn")?.click();
    }
  });
  const show = (cls) => {
    locked = true;
    box.readOnly = true;
    box.classList.add(cls);
  };
  return {
    get prompt() { return parsed.parts.length > 2 ? "Combine these sentences into one. Type it." : "Combine these two sentences into one. Type it."; },
    get usesCheck() { return !locked; },
    canCheck: () => !locked && box.value.trim().length > 0,
    check: () => {
      const result = checkCombine(parsed, box.value);
      lastHint = result.hint;
      return result.right;
    },
    missHint: () => lastHint,
    retry: () => { box.focus(); },
    reveal: () => show("shown"),
    lock: () => show("locked"),
    showRight: () => show("right"),
  };
}

/**
 * Listen and Write: Pip reads a sentence; the child types it with its capitals and punctuation. Play, phrase by
 * phrase or slowly, as often as they like. "Show the words" (or no voice on the device) shows the words in
 * small letters without marks instead, so the skill is still the capitals and punctuation.
 */
function renderDictate(root, item, { onChange, showWords }) {
  const voice = canSay();
  const words = showWords || !voice;
  let locked = false;
  let result = null;
  root.innerHTML = `<div class="dictate" data-type="dictate">
      ${voice ? `<div class="dictate-audio" role="group" aria-label="Listen">
        <button type="button" class="dictate-btn" data-dictate="play">🔊 Listen</button>
        <button type="button" class="dictate-btn" data-dictate="phrases">🧩 Phrase by phrase</button>
        <button type="button" class="dictate-btn" data-dictate="slow">🐢 Slowly</button></div>` : ""}
      ${words ? `<p class="dictate-words"><span class="palette-label">${voice ? "The words:" : "No voice on this device, so here are the words:"}</span> ${esc(dictationWords(item.text))}</p>` : ""}
      <label class="palette-label" for="dictate-input">Type the sentence with its capitals and punctuation:</label>
      <textarea id="dictate-input" class="combine-input" rows="3" maxlength="240" autocomplete="off" autocapitalize="off"
        autocorrect="off" spellcheck="false" enterkeyhint="done"></textarea>
      <div class="dictate-result" aria-live="polite"></div></div>`;
  const box = root.querySelector("textarea");
  const play = (how) => {
    if (how === "phrases") sayParts([item.text, ...dictationPhrases(item.text), item.text], { rate: 0.8 });
    else sayParts([item.text], { rate: how === "slow" ? 0.65 : 0.9 });
  };
  root.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-dictate]");
    if (btn) play(btn.dataset.dictate);
  });
  box.addEventListener("input", () => onChange());
  box.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      document.getElementById("check-btn")?.click();
    }
  });
  if (voice) setTimeout(() => { if (!locked && root.isConnected) play("play"); }, 350);
  const fixes = (list) => list.map((s) => `<span class="spell-fix"><s>${esc(s.typed)}</s> → <strong>${esc(s.word)}</strong></span>`).join(" ");
  const spellingNote = () => {
    if (!result) return "";
    const names = result.spelling.filter((s) => s.name);
    const words = result.spelling.filter((s) => !s.name);
    // A name heard aloud can be spelled many ways (Mia, Maya), so it's only shown, never counted.
    const bang = result.exclaim ? '<p class="dictate-spelling">Your period counts. This sentence shows strong feeling, so the writer ended it with <strong>!</strong></p>' : "";
    return bang + (names.length ? `<p class="dictate-spelling">How the name is spelled here: ${fixes(names)}</p>` : "")
      + (words.length ? `<p class="dictate-spelling">Spelling to practice (it doesn't count here): ${fixes(words)}</p>` : "");
  };
  const finish = (cls) => {
    locked = true;
    box.readOnly = true;
    box.classList.add(cls);
    root.querySelectorAll("[data-dictate]").forEach((b) => { b.disabled = false; });
    root.querySelector(".dictate-result").innerHTML = spellingNote();
  };
  return {
    prompt: words ? "Type the sentence. Add the capitals and punctuation." : "Listen, then type the sentence.",
    get usesCheck() { return !locked; },
    canCheck: () => !locked && box.value.trim().length > 0,
    check: () => {
      result = checkDictation(item.text, box.value);
      return result.right;
    },
    missHint: () => result?.hint,
    retry: () => box.focus(),
    reveal: () => finish("shown"),
    lock: () => finish("locked"),
    showRight: () => finish("right"),
  };
}

/**
 * Sentence Workshop: build your own sentence from the tiles to fit the goal (a pattern, plus an adjective, adverb
 * or prepositional phrase), checked for its structure rather than its words. Then label it with the Q&A Flow,
 * and save it to the notebook. The sentence being built stays pinned at the top while the tiles scroll.
 */
function renderWorkshop(root, item, hooks) {
  const { hint, complete, onChange, onTap } = hooks;
  const { tiles } = parseWorkshop(item);
  let bank = shuffle(tiles);
  let placed = [];
  let phase = "build"; // "build", then "label" (the Q&A Flow), then "done"
  let misses = 0;
  let usedExample = false;
  let flow = null;
  let built = "";
  const goalLine = `${WORKSHOP_PATTERNS[item.pattern].line}${(item.need || []).length ? ` + ${item.need.map((n) => ({ Adj: "Adj", Adv: "Adv", PP: "P OP", PPA: "PPA" })[n]).join(" + ")}` : ""}`;
  // One instruction, in the card (as in Q&A Flow): the goal in words, with 📘 and 🔊 beside it; the short form of
  // the goal stays pinned with the sentence.
  root.innerHTML = `<div class="workshop" data-type="workshop">
    <div class="ws-head"><p class="ws-ask">${esc(workshopGoal(item))}</p>${CARD_TOOLS}</div>
    <div class="ws-top"><p class="ws-goal"><span class="ws-tag">Goal</span> <strong>${esc(goalLine)}</strong></p>
      <div class="build-slots ws-slots" aria-label="Your sentence"></div></div>
    <div class="build-bank ws-bank" aria-label="Word tiles"></div>
    <div class="ws-tools"><button type="button" class="secondary ws-tool" data-ws-clear>↺ Start over</button><button type="button" class="secondary ws-tool" data-ws-example hidden>Use Pip's sentence</button></div>
    <div class="ws-label"></div>
    <div class="ws-save" hidden></div>
  </div>`;
  const slots = root.querySelector(".ws-slots");
  const bankEl = root.querySelector(".ws-bank");
  let copies = 0; // the, a, an, my… can be used again: tapping one in the bank puts a copy in the sentence
  const tile = (t, where) => {
    const again = where === "bank" && REUSABLE_KINDS.has(t.kind);
    return `<button type="button" class="tile${again ? " ws-again" : ""}" data-wt="${t.id}" data-where="${where}" ${again ? `aria-label="${esc(t.word)} (can be used again)"` : ""} ${phase !== "build" ? "disabled" : ""}>${esc(t.word)}</button>`;
  };
  function draw() {
    const shown = placed.map((t, n) => (n === 0 ? { ...t, word: t.word[0].toUpperCase() + t.word.slice(1) } : t));
    slots.innerHTML = placed.length ? shown.map((t) => tile(t, "slot")).join("") + '<span class="ws-end" aria-hidden="true">.</span>'
      : '<span class="slots-empty">Tap tiles to build your sentence. You won\'t need them all, and words marked ↻ can be used again.</span>';
    bankEl.innerHTML = bank.map((t) => tile(t, "bank")).join("");
  }
  function startLabeling() {
    phase = "label";
    const result = checkWorkshop(item, placed);
    built = workshopText(placed);
    root.querySelector(".ws-top").hidden = true;
    root.querySelector(".ws-head").remove(); // the flow card has its own instruction and 📘 🔊
    bankEl.hidden = true;
    root.querySelector(".ws-tools").hidden = true;
    const box = root.querySelector(".ws-label");
    box.innerHTML = `<p class="ws-built-note">${usedExample ? "Now label Pip's sentence." : "✓ Good sentence! Now label it."}</p><div class="ws-flow"></div>`;
    flow = renderFlow(box.querySelector(".ws-flow"), { ...workshopFlowItem(item, placed, result.roles), circleNouns: item.circleNouns }, {
      ...hooks, nounTable: false,
      complete: (r) => {
        phase = "done";
        complete({ tries: Math.max(misses ? 2 : 1, r.tries), correct: r.correct && !usedExample });
        if (!usedExample && hooks.saveSentence) {
          const save = root.querySelector(".ws-save");
          save.hidden = false;
          save.innerHTML = '<button type="button" class="ws-save-btn" data-ws-save>📓 Save to my notebook</button>';
        }
      },
    });
    hooks.cardPrompt?.(true);
    onChange();
  }
  root.addEventListener("click", (event) => {
    if (event.target.closest("[data-ws-save]")) {
      hooks.saveSentence({ text: built, pattern: Number(item.pattern) });
      root.querySelector(".ws-save").innerHTML = '<p class="ws-saved">📓 Saved! Find it in Progress → My notebook.</p>';
      return;
    }
    if (phase !== "build") return;
    if (event.target.closest("[data-ws-clear]")) {
      bank = [...bank, ...placed.filter((t) => !REUSABLE_KINDS.has(t.kind))];
      placed = [];
      onTap(); draw(); onChange();
      return;
    }
    if (event.target.closest("[data-ws-example]")) {
      usedExample = true;
      placed = workshopExample(item);
      hint(null);
      startLabeling();
      return;
    }
    const el = event.target.closest("[data-wt]");
    if (!el) return;
    const id = el.dataset.wt;
    if (el.dataset.where === "bank") {
      const t = bank.find((x) => String(x.id) === id);
      if (REUSABLE_KINDS.has(t.kind)) placed.push({ ...t, id: `${t.id}-${(copies += 1)}` });
      else placed.push(bank.splice(bank.indexOf(t), 1)[0]);
    } else {
      const t = placed.splice(placed.findIndex((x) => String(x.id) === id), 1)[0];
      if (!REUSABLE_KINDS.has(t.kind)) bank.push(t);
    }
    onTap(); draw(); onChange();
  });
  draw();
  return {
    get prompt() { return phase === "build" ? workshopGoal(item) : flow?.prompt || ""; },
    get usesCheck() { return phase === "build"; },
    canCheck: () => placed.length >= 2,
    // The Check button doesn't end the item: a right build goes on to labeling; a wrong one says what to fix.
    onCheck: () => {
      const result = checkWorkshop(item, placed);
      if (result.right) { hint(null); startLabeling(); return; }
      misses += 1;
      hint(`${result.why}${misses >= 2 ? " Or use Pip's sentence to go on." : ""}`);
      if (misses >= 2) root.querySelector("[data-ws-example]").hidden = false;
    },
    check: () => false,
    retry: () => {},
    reveal: () => {},
    lock: () => { flow?.lock(); },
    built: () => built,
  };
}

const DIAGRAM_HINT = "The subject and verb go on the long line. Words that describe go on slanted lines under the word they describe.";

export function renderItem(root, item, hooks) {
  const render = {
    mark: renderMark, fix: renderFix, which: renderWhich, build: renderBuild, sort: renderSort, check: renderCheck, join: renderJoin,
    flow: renderFlow, labels: renderLabels, proofread: renderProofread, labelfix: renderProofread, diagram: renderDiagram, combine: renderCombine, dictate: renderDictate, workshop: renderWorkshop,
  }[item.type];
  if (!render) throw new Error(`Unknown item type: ${item.type}`);
  // A fresh box for each question: the last question's click and key listeners go with the old one (otherwise
  // Listen in Listen and Write also played the earlier sentences).
  const fresh = root.cloneNode(false);
  root.replaceWith(fresh);
  return render(fresh, item, hooks);
}
