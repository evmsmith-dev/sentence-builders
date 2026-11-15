// Turns an item from data/content.json into what the screen shows and what counts as right.
// Pure functions, unit-tested. The formats are described in data/README.md.
import { MARK_ORDER, PALETTES } from "../config.js";

const BRACKET_LEAD = /^\[([^\]]*)\]/;
const BRACKET_TRAIL = /\[([^\]]*)\]$/;

/** A gap's spec from one bracket's contents: "," or ",?" (optional) or ',"' (two marks). */
function markSpec(raw) {
  const optional = raw.endsWith("?") && raw.length > 1 && raw !== "?" && !raw.endsWith("??");
  return { marks: optional ? raw.slice(0, -1) : raw, optional };
}

/**
 * Mark it: "Jada said[,] [\"]We can go now.[\"]"
 * → words ["Jada", "said", "We", "can", "go", "now."] and one gap before, between and after them.
 * Each gap keeps the marks that hang on the word before it (`after`) apart from those that
 * lead the next word (`before`), so the right answer can be shown with natural spacing;
 * the player fills a gap with a single string, `marks` = after + before.
 */
export function parseMarkText(text) {
  const tokens = text.trim().split(/ +/);
  const words = [];
  const gaps = [{ after: "", before: "", optional: false }];
  for (const token of tokens) {
    let rest = token;
    let lead = "";
    let leadOptional = false;
    let match;
    while ((match = rest.match(BRACKET_LEAD))) {
      const spec = markSpec(match[1]);
      lead += spec.marks;
      leadOptional = leadOptional || spec.optional;
      rest = rest.slice(match[0].length);
    }
    const trail = [];
    while ((match = rest.match(BRACKET_TRAIL))) {
      trail.unshift(markSpec(match[1]));
      rest = rest.slice(0, -match[0].length);
    }
    if (!rest || rest.includes("[") || rest.includes("]")) throw new Error(`Can't read "${token}" in: ${text}`);
    const gapBefore = gaps[gaps.length - 1];
    gapBefore.before += lead;
    gapBefore.optional = gapBefore.optional || leadOptional;
    words.push(rest);
    gaps.push({
      after: trail.map((spec) => spec.marks).join(""),
      before: "",
      optional: trail.some((spec) => spec.optional),
    });
  }
  return { words, gaps: gaps.map((gap) => ({ ...gap, marks: gap.after + gap.before })) };
}

export function parseMark(item) {
  const main = parseMarkText(item.text);
  const alts = (item.alts || []).map(parseMarkText);
  for (const alt of alts) {
    if (alt.words.join(" ") !== main.words.join(" ")) throw new Error(`${item.id}: an alt has different words`);
  }
  const palette = item.marks || [...new Set([main, ...alts].flatMap((spec) => spec.gaps.flatMap((gap) => [...gap.marks])))];
  return { words: main.words, answers: [main, ...alts], palette };
}

/** The marks offered for an item: the level's palette plus any mark the answer needs, in a fixed order. */
export function paletteFor(item, parsed = parseMark(item)) {
  const base = item.marks || PALETTES[item.skill]?.[item.level - 1] || [];
  return [...new Set([...base, ...parsed.palette])].sort((a, b) => MARK_ORDER.indexOf(a) - MARK_ORDER.indexOf(b));
}

/** Is a filled-in set of gaps right? `filled` has one string per gap. */
export function checkMark(parsed, filled) {
  return parsed.answers.some((answer) =>
    answer.gaps.every((gap, i) => (filled[i] || "") === gap.marks || (gap.optional && !filled[i])));
}

/** The sentence with an answer's marks in place, spaced naturally. */
export function markSentence(words, gaps) {
  let out = gaps[0].before;
  words.forEach((word, i) => {
    const gap = gaps[i + 1];
    out += word + gap.after + (i < words.length - 1 ? " " : "") + gap.before;
  });
  return out;
}

/** Fix it: "[Mayas|Maya's|Mayas'] bike has a flat tire." */
export function parseFix(item) {
  const words = item.text.trim().split(/ +/);
  const targets = words.map((word, i) => (/\[[^\]]+\]/.test(word) ? i : -1)).filter((i) => i >= 0);
  if (targets.length !== 1) throw new Error(`${item.id}: a fix item needs exactly one [shown|right|...] word`);
  const target = targets[0];
  const [, prefix, inner, suffix] = words[target].match(/^(.*)\[([^\]]+)\](.*)$/);
  const parts = inner.split("|");
  if (parts.length < 3) throw new Error(`${item.id}: a fix needs the shown word, the right word and at least one wrong choice`);
  const [shown, correct, ...wrong] = parts;
  const shownWords = words.map((word, i) => (i === target ? prefix + shown + suffix : word));
  const fixedWords = words.map((word, i) => (i === target ? prefix + correct + suffix : word));
  return { words: shownWords, target, prefix, suffix, correct, choices: [correct, ...wrong], fixed: fixedWords.join(" ") };
}

/** Which is right? Either a blank in a sentence or whole-sentence options. The first is right. */
export function parseWhich(item) {
  if (item.options) {
    return { kind: "sentences", choices: [...item.options], correct: item.options[0], answerText: item.options[0] };
  }
  const match = item.text.match(/^(.*?)\[([^\]]+)\](.*)$/);
  if (!match) throw new Error(`${item.id}: a which item needs options or one [right|wrong] blank`);
  const [, before, inner, after] = match;
  const choices = inner.split("|");
  if (choices.length < 2) throw new Error(`${item.id}: a blank needs at least two choices`);
  return { kind: "blank", before, after, choices, correct: choices[0], answerText: before + choices[0] + after };
}

const PUNCT_TILE = /^[,.;:!?]+$/;

/** Build it: "My sister said|,|\"I|love|this|song.\"" → tiles in the right order. */
export function parseBuild(item) {
  const answers = [item.tiles, ...(item.alts || [])].map((spec) => spec.split("|"));
  return { tiles: answers[0], answers, answerText: joinTiles(answers[0]) };
}

export function joinTiles(tiles) {
  return tiles.reduce((out, tile) => (!out ? tile : PUNCT_TILE.test(tile) ? out + tile : `${out} ${tile}`), "");
}

export function checkBuild(parsed, order) {
  return parsed.answers.some((answer) => answer.length === order.length && answer.every((tile, i) => tile === order[i]));
}

/** Sort it: { bins: { "Past": ["walked", ...], "Present": [...] } } → bins in order and every tile. */
export function parseSort(item) {
  const bins = Object.entries(item.bins || {}).map(([name, tiles]) => ({ name, tiles: [...tiles] }));
  const tiles = bins.flatMap((bin) => bin.tiles.map((text) => ({ text, bin: bin.name })));
  return { bins, tiles, answerText: bins.map((bin) => `${bin.name.replace(/\s*\.\.\.$/, "")}: ${bin.tiles.join(", ")}`).join(". ") + "." };
}

/** placed: { tile text: bin name } for every tile. */
export function checkSort(parsed, placed) {
  return parsed.tiles.every((tile) => placed[tile.text] === tile.bin);
}

/** What read-aloud says for an item's sentence: plain words, no marks to place. */
export function spokenText(item) {
  if (item.type === "mark") return parseMark(item).words.join(" ");
  if (item.type === "fix") return parseFix(item).words.join(" ");
  if (item.type === "which") {
    const which = parseWhich(item);
    return which.kind === "blank" ? `${which.before}blank${which.after}` : "";
  }
  if (item.type === "sort") return parseSort(item).tiles.map((tile) => tile.text).join(", ");
  return "";
}

/** The right answer as a sentence, shown after a second miss. */
export function answerText(item) {
  if (item.type === "mark") {
    const parsed = parseMark(item);
    return markSentence(parsed.words, parsed.answers[0].gaps);
  }
  if (item.type === "fix") return parseFix(item).fixed;
  if (item.type === "which") return parseWhich(item).answerText;
  if (item.type === "build") return parseBuild(item).answerText;
  if (item.type === "sort") return parseSort(item).answerText;
  throw new Error(`Unknown item type: ${item.type}`);
}

export const ITEM_TYPES = ["mark", "fix", "which", "build", "sort"];

/** Throws if an item can't be shown or can't be answered. Used by the validator. */
export function validateItem(item) {
  if (!item.id || !item.skill || !item.level || !item.hint) throw new Error(`${item.id || "?"}: needs id, skill, level and hint`);
  if (!ITEM_TYPES.includes(item.type)) throw new Error(`${item.id}: unknown type ${item.type}`);
  if (item.type === "mark") {
    const parsed = parseMark(item);
    if (!parsed.answers[0].gaps.some((gap) => gap.marks && !gap.optional)) throw new Error(`${item.id}: nothing to place`);
    const right = parsed.answers[0].gaps.map((gap) => gap.marks);
    if (!checkMark(parsed, right)) throw new Error(`${item.id}: its own answer isn't accepted`);
    if (checkMark(parsed, right.map(() => ""))) throw new Error(`${item.id}: an empty answer is accepted`);
    for (const gap of parsed.answers[0].gaps) {
      for (const mark of gap.marks) if (!parsed.palette.includes(mark)) throw new Error(`${item.id}: ${mark} isn't in the palette`);
    }
  }
  if (item.type === "fix") {
    const parsed = parseFix(item);
    if (new Set(parsed.choices).size !== parsed.choices.length) throw new Error(`${item.id}: repeated choices`);
    if (parsed.words[parsed.target] === parsed.prefix + parsed.correct + parsed.suffix) throw new Error(`${item.id}: the shown word is already right`);
  }
  if (item.type === "which") {
    const parsed = parseWhich(item);
    if (new Set(parsed.choices).size !== parsed.choices.length) throw new Error(`${item.id}: repeated choices`);
  }
  if (item.type === "build") {
    const parsed = parseBuild(item);
    if (parsed.tiles.length < 3) throw new Error(`${item.id}: a build needs at least 3 tiles`);
    if (!checkBuild(parsed, parsed.tiles)) throw new Error(`${item.id}: its own answer isn't accepted`);
  }
  if (item.type === "sort") {
    const parsed = parseSort(item);
    if (parsed.bins.length < 2 || parsed.tiles.length < 4) throw new Error(`${item.id}: a sort needs 2+ bins and 4+ tiles`);
    if (new Set(parsed.tiles.map((t) => t.text)).size !== parsed.tiles.length) throw new Error(`${item.id}: repeated tiles`);
    if (parsed.bins.some((bin) => !bin.tiles.length)) throw new Error(`${item.id}: an empty bin`);
  }
  return true;
}
