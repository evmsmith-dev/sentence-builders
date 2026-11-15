// Draws one item and handles taps. Each item type returns the same small controller:
//   prompt          what to do, in a few words
//   usesCheck       true when the player taps Check (mark, build); false when a tap answers (fix, which)
//   canCheck()      whether Check should be enabled
//   check()         true if right (check-button types)
//   retry()         get ready for the second try
//   reveal()        show the right answer after a second miss
//   lock()          no more changes
// Types that answer on a tap call answer(correct) themselves.
import {
  CHECK_KINDS, checkBuild, checkMark, checkSort, joinTiles, paletteFor, parseBuild, parseCheck, parseFix, parseJoin, parseMark,
  parseSort, parseWhich,
} from "../lib/parse.js";
import { shuffle } from "../lib/select.js";
import { esc } from "./dom.js";

const MARK_NAMES = { ",": "comma", ".": "period", "?": "question mark", "!": "exclamation point", '"': "quotation mark", ":": "colon", ";": "semicolon", "'": "apostrophe" };

/** The right answer with the marks that had to be placed highlighted. */
function markAnswerHtml(parsed) {
  const gaps = parsed.answers[0].gaps;
  const hi = (marks) => (marks ? `<mark>${esc(marks)}</mark>` : "");
  let out = hi(gaps[0].before);
  parsed.words.forEach((word, i) => {
    const gap = gaps[i + 1];
    out += esc(word) + hi(gap.after) + (i < parsed.words.length - 1 ? " " : "") + hi(gap.before);
  });
  return out;
}

function renderMark(root, item, { onChange, onTap }, { allowEmpty = false } = {}) {
  const parsed = parseMark(item);
  parsed.palette = paletteFor(item, parsed);
  // One mark to choose from: tapping a space adds or removes it, no palette needed.
  const single = parsed.palette.length === 1 ? parsed.palette[0] : null;
  const filled = parsed.words.map(() => "").concat("");
  let selected = null;
  let locked = false;

  root.innerHTML = `<div class="sentence marks" data-type="mark" data-palette="${esc(parsed.palette.join(""))}"></div>
    <div class="palette" hidden><p class="palette-label"></p><div class="palette-buttons"></div></div>`;
  const sentence = root.querySelector(".sentence");
  const palette = root.querySelector(".palette");

  const gapLabel = (i) => (i === 0 ? `before "${parsed.words[0]}"` : `after "${parsed.words[i - 1]}"`);
  function draw() {
    sentence.innerHTML = filled.map((marks, i) => {
      const gap = `<button type="button" class="gap${marks ? " filled" : ""}${selected === i ? " selected" : ""}" data-gap="${i}"
        aria-label="Space ${esc(gapLabel(i))}${marks ? `: ${esc([...marks].map((m) => MARK_NAMES[m] || m).join(", "))}` : ""}"
        aria-pressed="${selected === i}" ${locked ? "disabled" : ""}><span>${marks ? esc(marks) : "·"}</span></button>`;
      return i < parsed.words.length ? `${gap}<span class="word">${esc(parsed.words[i])}</span>` : gap;
    }).join("");
    palette.hidden = selected === null || locked;
    if (selected !== null) {
      palette.querySelector(".palette-label").textContent = `Space ${gapLabel(selected)}:`;
      palette.querySelector(".palette-buttons").innerHTML = parsed.palette.map((mark) =>
        `<button type="button" class="mark-btn" data-mark="${esc(mark)}" aria-label="Add ${esc(MARK_NAMES[mark] || mark)}">${esc(mark)}</button>`).join("")
        + '<button type="button" class="mark-btn erase" data-erase aria-label="Erase this space">⌫</button>';
    }
  }
  root.addEventListener("click", (event) => {
    if (locked) return;
    const gap = event.target.closest("[data-gap]");
    const mark = event.target.closest("[data-mark]");
    if (gap && single) {
      const i = Number(gap.dataset.gap);
      filled[i] = filled[i] ? "" : single;
      onTap();
    } else if (gap) {
      const i = Number(gap.dataset.gap);
      selected = selected === i ? null : i;
      onTap();
    } else if (mark && selected !== null) {
      if (filled[selected].length < 3) filled[selected] += mark.dataset.mark;
      onTap();
    } else if (event.target.closest("[data-erase]") && selected !== null) {
      filled[selected] = "";
    } else {
      return;
    }
    draw();
    onChange();
  });
  draw();
  return {
    prompt: single ? `Tap each space where ${single === "," ? "a comma" : `a ${MARK_NAMES[single] || single}`} goes.` : "Tap a space, then add the marks that go there.",
    usesCheck: true,
    canCheck: () => allowEmpty || filled.some(Boolean),
    check: () => checkMark(parsed, filled),
    retry: () => { selected = null; draw(); },
    reveal: () => { locked = true; root.innerHTML = `<p class="sentence answer">${markAnswerHtml(parsed)}</p>`; },
    lock: () => { locked = true; selected = null; draw(); },
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
    prompt: parsed.kind === "blank" ? "Which one fits in the blank?" : "Which sentence is written correctly?",
    usesCheck: false,
    choicesText: choices,
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
      : '<span class="slots-empty">All sorted. Tap a word to move it.</span>';
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
    prompt: "Tap a word, then tap the box it belongs in.",
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

export function renderItem(root, item, hooks) {
  const render = {
    mark: renderMark, fix: renderFix, which: renderWhich, build: renderBuild, sort: renderSort, check: renderCheck, join: renderJoin,
  }[item.type];
  if (!render) throw new Error(`Unknown item type: ${item.type}`);
  root.innerHTML = "";
  return render(root, item, hooks);
}
