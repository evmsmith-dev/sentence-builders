// Turns an item from data/content.json into what the screen shows and what counts as right.
// Pure functions, unit-tested. The formats are described in data/README.md.
import { FLOW_LABELS, FLOW_PATTERNS, MARK_ORDER, PALETTES, PATTERNS, SENTENCE_KINDS } from "../config.js";
import { buildDiagram } from "./diagram.js";
import { isPronoun, nounInfo } from "./nouns.js";

const flowLabels = (item) => (FLOW_LABELS[item.skill] || FLOW_LABELS.flow)[item.level - 1];
const flowPatterns = (item) => (FLOW_PATTERNS[item.skill] || FLOW_PATTERNS.flow)[item.level - 1];

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
  // A mark written inside a word (twenty[-]one, and[—]surprise) sits in the gap between two words.
  const spaced = text.replace(/([^\s\]])\[([^\]]*)\](?=[^\s[])/g, "$1[$2] ");
  const tokens = spaced.trim().split(/ +/);
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

/** Hyphens and dashes join the words on both sides with no space: twenty-one, and—surprise—it. */
export const JOINS = /[-—]$/;

/** The space between two words, given the marks hanging on the first. */
export const spaceAfter = (gap) => (JOINS.test(gap.after) && !gap.before ? "" : " ");

/** The sentence with an answer's marks in place, spaced naturally. */
export function markSentence(words, gaps) {
  let out = gaps[0].before;
  words.forEach((word, i) => {
    const gap = gaps[i + 1];
    out += word + gap.after + (i < words.length - 1 ? spaceAfter(gap) : "") + gap.before;
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

/** Sentence check: is it complete, a fragment or a run-on? Then, if it isn't complete, pick the best fix. */
export const CHECK_KINDS = { complete: "Complete sentence", fragment: "Fragment", runon: "Run-on" };

export function parseCheck(item) {
  // Run-ons are taught in level 3, so earlier levels only ask complete or fragment.
  const kinds = item.labels || (item.level >= 3 ? ["complete", "fragment", "runon"] : ["complete", "fragment"]);
  const fixes = item.fixes ? [...item.fixes] : [];
  const kindName = CHECK_KINDS[item.kind];
  return {
    text: item.text, kind: item.kind, kinds, fixes, fix: fixes[0] || null,
    answerText: item.kind === "complete" ? `${item.text} (${kindName.toLowerCase()})` : `${kindName}. Fix: ${fixes[0]}`,
  };
}

/** Join it: pick the joining word for two sentences, then decide where (if anywhere) the comma goes. */
export function parseJoin(item) {
  const result = parseMarkText(item.result);
  return {
    first: item.first, second: item.second, words: [...item.words], word: item.words[0],
    result, answerText: markSentence(result.words, result.gaps),
  };
}

export const parseTags = (tags) => tags.trim().split(/ +/).map((pair) => {
  const at = pair.lastIndexOf("|");
  return { word: pair.slice(0, at), label: pair.slice(at + 1) };
});

/** Q&A Flow: the sentence's words with their final labels, the question steps in order, then kind (and pattern). */
export function parseFlow(item) {
  const words = parseTags(item.tags);
  const steps = item.steps.map(([question, index, label]) => ({ question, index, label: label || words[index].label }));
  return {
    words, steps, kind: item.kind, pattern: item.pattern || null,
    labels: flowLabels(item),
    patternChoices: flowPatterns(item),
    labelLine: words.map((w) => w.label).join(" "),
    answerText: `${words.map((w) => w.word).join(" ")} → ${words.map((w) => w.label).join(" ")}`
      + (item.pattern ? ` · ${PATTERNS[item.pattern]}` : "") + ` · ${SENTENCE_KINDS[item.kind].split(":")[0].toLowerCase()}`,
  };
}

/**
 * Build from labels: tiles in the right order, each with its label. The end mark is kept apart (`end`) and
 * shown after the last space, so any word can be last: "milk and bread" or "bread and milk".
 */
export function parseLabels(item) {
  const tiles = parseTags(item.tiles);
  const end = tiles.at(-1).word.match(/[.?!]+$/)?.[0] || "";
  return {
    tiles: tiles.map((t, i) => (i === tiles.length - 1 && end ? { ...t, word: t.word.slice(0, -end.length) } : t)),
    end, line: tiles.map((t) => t.label), answerText: tiles.map((t) => t.word).join(" "),
  };
}

/** A word that keeps its capital letter anywhere in a sentence: a name (Sam, Mom), not "The" or "I". */
const alwaysCapital = (word) => /^[A-Z]/.test(word) && word !== "I" && nounInfo(word, 0).kind === "Proper";

/**
 * placed: the tile words in slot order (the end mark stays after the last space). Right when every word's label
 * matches its slot and the first word can start the sentence: the capitalized first word, or (when that first
 * word is a name) another name with the same label, so "Jada and Sam" is as right as "Sam and Jada". Words
 * with the same label may swap places anywhere else (two adjectives, the parts of a compound).
 */
export function checkLabels(parsed, placed) {
  if (placed.length !== parsed.tiles.length) return false;
  const words = parsed.tiles.map((t) => t.word);
  const pairs = compoundPairs(parsed.tiles.map((t) => t.label), words);
  const swappable = (a, b) => pairs.some(([x, y]) => (words[x] === a && words[y] === b) || (words[x] === b && words[y] === a));
  return placed.every((word, i) => word === words[i]
    || (swappable(word, words[i]) && (i > 0 || (alwaysCapital(word) && alwaysCapital(words[0])))));
}

// Labels that are two parts of one compound even when they differ (Leo and I: CSN and CSP).
const COMPOUND_GROUP = { CSN: "subject", CSP: "subject", CPrN: "prn", CPrP: "prn" };

/**
 * The two parts of each compound, as [index, index]: the compound-labeled words on each side of a conjunction
 * (C) with the same job. Either order is right ("Jada and Sam", "bread and milk"), except a part that's "I",
 * which goes last by courtesy ("Leo and I").
 */
export function compoundPairs(labels, words = []) {
  const group = (l) => COMPOUND_GROUP[l] || l;
  const pairs = [];
  labels.forEach((l, c) => {
    if (l !== "C") return;
    let a = c - 1;
    while (a >= 0 && !/^C./.test(labels[a])) a -= 1;
    let b = c + 1;
    while (b < labels.length && !/^C./.test(labels[b])) b += 1;
    if (a < 0 || b >= labels.length || group(labels[a]) !== group(labels[b])) return;
    if ([a, b].some((i) => (words[i] || "").replace(/[.?!,]+$/, "") === "I")) return;
    pairs.push([a, b]);
  });
  return pairs;
}

/** Proofread: a paragraph where each mistake is written [shown|right|other wrong choices]. */
export function parseProofread(item) {
  const tokens = item.text.trim().split(/ +/);
  const errors = [];
  const words = tokens.map((token, index) => {
    const match = token.match(/^(.*)\[([^\]]+)\](.*)$/);
    if (!match) return token;
    const [, prefix, inner, suffix] = match;
    const [shown, correct, ...wrong] = inner.split("|");
    errors.push({ index, prefix, suffix, shown, correct, choices: [correct, ...wrong], fixed: prefix + correct + suffix });
    return prefix + shown + suffix;
  });
  const fixedWords = words.map((word, i) => errors.find((e) => e.index === i)?.fixed || word);
  return { words, errors, answerText: fixedWords.join(" ") };
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
  if (item.type === "check") return item.text;
  if (item.type === "join") return `${item.first} ${item.second}`;
  if (item.type === "flow" || item.type === "diagram") return parseFlow({ ...item, steps: [] }).words.map((w) => w.word).join(" ");
  if (item.type === "labels") return parseLabels(item).line.join(", ");
  if (item.type === "proofread") return parseProofread(item).words.join(" ");
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
  if (item.type === "check") return parseCheck(item).answerText;
  if (item.type === "join") return parseJoin(item).answerText;
  if (item.type === "flow") return parseFlow(item).answerText;
  if (item.type === "diagram") return diagramText(item);
  if (item.type === "labels") return parseLabels(item).answerText;
  if (item.type === "proofread") return parseProofread(item).answerText;
  throw new Error(`Unknown item type: ${item.type}`);
}

export const ITEM_TYPES = ["mark", "fix", "which", "build", "sort", "check", "join", "flow", "labels", "proofread", "diagram"];

/** A diagram in words, for the results review: the baseline, then what hangs under each word. */
export function diagramText(item) {
  const { tree, slots } = buildDiagram(item);
  const t = (n) => (n.fork ? `${slots[n.parts[0].slot].text} ${slots[n.conjSlot].text} ${slots[n.parts[1].slot].text}` : slots[n.slot].text);
  let base = `${t(tree.subject)} | ${t(tree.verb)}`;
  if (tree.complement) base += tree.complement.kind === "DO" ? ` | ${t(tree.complement.node)}` : ` \\ ${t(tree.complement.node)}`;
  if (tree.objectComplement) base += ` \\ ${t(tree.objectComplement.node)}`;
  const hangs = [];
  const walk = (n) => {
    if (n.fork) { n.parts.forEach(walk); return; }
    n.mods.forEach((m) => {
      if (m.kind === "slant") hangs.push(`${t(m.node)} under ${t(n)}`);
      else hangs.push(`${m.pSlot === null ? "" : `${slots[m.pSlot].text} `}${t(m.node)} under ${t(n)}`);
      walk(m.node);
    });
  };
  [tree.subject, tree.verb, tree.complement?.node, tree.objectComplement?.node].filter(Boolean)
    .flatMap((n) => (n.fork ? n.parts : [n])).forEach(walk);
  return `${base}${hangs.length ? `; ${hangs.join("; ")}` : ""}`;
}

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
  if (item.type === "check") {
    const parsed = parseCheck(item);
    if (!parsed.kinds.includes(item.kind)) throw new Error(`${item.id}: kind ${item.kind} isn't one of the choices at this level`);
    if (item.kind === "complete" && item.fixes) throw new Error(`${item.id}: a complete sentence has no fixes`);
    if (item.kind !== "complete" && (parsed.fixes.length < 2 || new Set(parsed.fixes).size !== parsed.fixes.length)) throw new Error(`${item.id}: needs 2+ different fixes, the right one first`);
  }
  if (item.type === "join") {
    const parsed = parseJoin(item);
    if (parsed.words.length < 2 || new Set(parsed.words).size !== parsed.words.length) throw new Error(`${item.id}: needs 2+ different joining words`);
    if (!parsed.result.words.join(" ").includes(parsed.word)) throw new Error(`${item.id}: the result doesn't use ${parsed.word}`);
    if (parsed.result.gaps.some((gap) => gap.marks && gap.marks !== ",")) throw new Error(`${item.id}: a join result can only place commas`);
  }
  if (item.type === "flow") {
    const parsed = parseFlow(item);
    const allowed = parsed.labels;
    const finalLabel = {};
    for (const step of parsed.steps) {
      if (!parsed.words[step.index]) throw new Error(`${item.id}: a step points past the last word`);
      if (!allowed.includes(step.label)) throw new Error(`${item.id}: ${step.label} isn't taught by level ${item.level}`);
      finalLabel[step.index] = step.label;
    }
    parsed.words.forEach((w, i) => {
      if (!(i in finalLabel)) throw new Error(`${item.id}: no step labels "${w.word}"`);
      if (finalLabel[i] !== w.label) throw new Error(`${item.id}: the last step for "${w.word}" gives ${finalLabel[i]}, not ${w.label}`);
    });
    if (!SENTENCE_KINDS[item.kind]) throw new Error(`${item.id}: unknown sentence kind ${item.kind}`);
    const choices = flowPatterns(item);
    if (choices.length > 1 && !choices.includes(item.pattern)) throw new Error(`${item.id}: needs a pattern from ${choices.join(", ")}`);
    if (choices.length === 1 && item.pattern) throw new Error(`${item.id}: patterns aren't asked at this level`);
    if (!/[.!?]$/.test(parsed.words.at(-1).word)) throw new Error(`${item.id}: the last word needs its end mark`);
  }
  if (item.type === "flow" || item.type === "diagram") {
    for (const w of parseTags(item.tags)) {
      if (["SN", "CSN", "OP", "COP", "DO", "CDO", "IO", "CIO", "PrN", "CPrN", "OCN"].includes(w.label) && !isPronoun(w.word) && !nounInfo(w.word).number) {
        throw new Error(`${item.id}: add "${w.word.replace(/[.?!,]+$/, "")}" to the singular or plural noun list in src/lib/nouns.js`);
      }
    }
  }
  if (item.type === "diagram") {
    if (!buildDiagram(item)) throw new Error(`${item.id}: this sentence can't be diagrammed yet`);
    if (!SENTENCE_KINDS[item.kind]) throw new Error(`${item.id}: unknown sentence kind ${item.kind}`);
    const labels = parseTags(item.tags).map((w) => w.label);
    const bad = labels.find((l) => !flowLabels(item).includes(l));
    if (bad) throw new Error(`${item.id}: ${bad} isn't taught by level ${item.level}`);
  }
  if (item.type === "proofread") {
    const parsed = parseProofread(item);
    if (parsed.errors.length < 2) throw new Error(`${item.id}: a paragraph needs 2+ mistakes`);
    for (const e of parsed.errors) {
      if (e.choices.length < 2 || new Set(e.choices).size !== e.choices.length) throw new Error(`${item.id}: "${e.shown}" needs 2+ different choices`);
      if (e.shown === e.correct || !e.shown) throw new Error(`${item.id}: "${e.shown}" isn't a mistake`);
    }
  }
  if (item.type === "labels") {
    const parsed = parseLabels(item);
    if (parsed.tiles.length < 3) throw new Error(`${item.id}: needs 3+ words`);
    if (!parsed.line.every((l) => flowLabels(item).includes(l))) throw new Error(`${item.id}: uses a label not taught by level ${item.level}`);
    if (new Set(parsed.tiles.map((t) => t.word)).size !== parsed.tiles.length) throw new Error(`${item.id}: repeated words`);
    if (!checkLabels(parsed, parsed.tiles.map((t) => t.word))) throw new Error(`${item.id}: its own answer isn't accepted`);
  }
  return true;
}
