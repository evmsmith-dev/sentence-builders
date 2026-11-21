// Turns an item from data/content.json into what the screen shows and what counts as right.
// Pure functions, unit-tested. The formats are described in data/README.md.
import { FLOW_LABELS, FLOW_PATTERNS, LABELS, MARK_ORDER, PALETTES, PATTERNS, SENTENCE_KINDS } from "../config.js";
import { buildDiagram } from "./diagram.js";
import { NAMES, isPronoun, nounInfo } from "./nouns.js";
import { WORKSHOP_KINDS, WORKSHOP_NEEDS, adverbQuestion, checkWorkshop, parseWorkshop, workshopExample, workshopFlowItem, workshopText } from "./workshop.js";

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
  if (item.type === "labelfix") return parseProofread(item).words.map((w) => w.split("^")[0]).join(" ");
  if (item.type === "combine") return item.parts.join(" ");
  if (item.type === "dictate") return item.text;
  if (item.type === "workshop") return parseWorkshop(item).tiles.map((t) => t.word).join(", ");
  return "";
}

/* ---------- Sentence combining: type one sentence that joins two ---------- */

const CONTRACTIONS = [[/\bcan't\b/g, "cannot"], [/\bcan not\b/g, "cannot"], [/\bwon't\b/g, "will not"], [/\b(\w+)n't\b/g, "$1 not"],
  [/\bit's\b/g, "it is"], [/\bthat's\b/g, "that is"], [/\bthey're\b/g, "they are"], [/\bwe're\b/g, "we are"]];

/** Typed text tidied up: straight quotes, single spaces, no space before a mark, contractions spelled out. */
export function tidyTyped(text) {
  let out = String(text || "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().replace(/\s+([,.!?;:])/g, "$1");
  for (const [from, to] of CONTRACTIONS) {
    out = out.replace(new RegExp(from.source, "gi"), (m, stem) => {
      const full = stem === undefined ? to : to.replace("$1", stem);
      return /^[A-Z]/.test(m) ? full[0].toUpperCase() + full.slice(1) : full;
    });
  }
  return out;
}
const loose = (text) => tidyTyped(text).toLowerCase().replace(/[^a-z0-9' ]/g, "").replace(/\s+/g, " ").trim();

/** Letters to add, drop or change (two letters swapped count as one slip) to turn a into b. */
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

export function parseCombine(item) {
  return { parts: [...item.parts], answers: [...item.answers], use: item.use || null, answerText: item.answers[0] };
}

/**
 * { right, hint }: right when the typed sentence matches one of the answers exactly (capitals and marks too).
 * Otherwise a hint for the closest kind of slip: a capital, the end mark, a comma, spelling, or the joining word.
 */
export function checkCombine(parsed, typed) {
  const mine = tidyTyped(typed);
  const answers = parsed.answers.map(tidyTyped);
  if (answers.includes(mine)) return { right: true, hint: null };
  const sameWords = answers.find((a) => loose(a) === loose(mine));
  if (sameWords) {
    const endOf = (s) => (s.match(/[.!?]$/) || [""])[0];
    if (endOf(mine) !== endOf(sameWords)) {
      const mark = { ".": "a period", "?": "a question mark", "!": "an exclamation point" }[endOf(sameWords)];
      return { right: false, hint: `Check the end of your sentence. It needs ${mark}.` };
    }
    if (mine[0] !== sameWords[0]) return { right: false, hint: "Start your sentence with a capital letter." };
    const a = sameWords.replace(/[^A-Za-z' ]/g, "").split(" ");
    const b = mine.replace(/[^A-Za-z' ]/g, "").split(" ");
    const capital = a.findIndex((w, i) => i > 0 && w !== b[i] && w.toLowerCase() === b[i]?.toLowerCase());
    if (capital > 0) {
      return { right: false, hint: /^[A-Z]/.test(a[capital])
        ? `${a[capital]} is a name (or I), so it starts with a capital letter.`
        : `Only the first word, names and I need capital letters. Look at "${b[capital]}".` };
    }
    const commas = (s) => (s.match(/,/g) || []).length;
    if (commas(mine) < commas(sameWords)) return { right: false, hint: "Your words are right. Now check the commas: one is missing." };
    if (commas(mine) > commas(sameWords)) return { right: false, hint: "Your words are right, but there's a comma that doesn't belong." };
    return { right: false, hint: "Your words are right. Check the punctuation." };
  }
  if (parsed.use && !new RegExp(`\\b${parsed.use}\\b`, "i").test(mine)) return { right: false, hint: `Use the word ${parsed.use} to join them.` };
  const near = answers.find((a) => loose(a).split(" ").length === loose(mine).split(" ").length && editDistance(loose(a), loose(mine)) <= 2);
  if (near) {
    const a = loose(near).split(" ");
    const b = loose(mine).split(" ");
    const k = a.findIndex((w, i) => w !== b[i]);
    return { right: false, hint: `So close! Check the spelling of "${b[k]}".` };
  }
  return { right: false, hint: null };
}

/* ---------- Listen and Write: type a sentence read aloud ---------- */

const HOMOPHONES = [["there", "their", "theyre"], ["to", "too", "two"], ["your", "youre"], ["its"], ["were", "where", "wear"], ["hear", "here"], ["know", "no"], ["right", "write"], ["by", "buy", "bye"]];
const homophones = (a, b) => HOMOPHONES.some((set) => set.includes(a) && set.includes(b));

/** A typed or target word split into leading marks, the word itself and trailing marks. */
function dictToken(raw) {
  const m = raw.match(/^([^A-Za-z0-9']*)([A-Za-z0-9'-]*[A-Za-z0-9]'?|[A-Za-z0-9])?(.*)$/) || [];
  const core = m[2] || "";
  return { raw, lead: m[1] || "", core, trail: m[3] || "", key: core.toLowerCase().replace(/'/g, "") };
}
const dictTokens = (text) => {
  const toks = String(text || "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+([,.!?;:])/g, "$1")
    .trim().split(/\s+/).filter(Boolean).map(dictToken);
  // Names (a capital mid-sentence, or a name the game knows): heard, they can't always be spelled.
  toks.forEach((tok, i) => {
    const first = i === 0 || /[.!?]"?$/.test(toks[i - 1].trail) || /^"/.test(tok.lead);
    tok.name = tok.core !== "I" && /^[A-Z]/.test(tok.core) && (!first || NAMES.has(tok.key));
  });
  return toks;
};
const similar = (a, b) => a === b || editDistance(a, b) <= Math.max(1, Math.floor(Math.max(a.length, b.length) / 3));

/** Lines up two word lists (a typo still lines up with its word). [[targetIndex|null, typedIndex|null], ...] */
function alignWords(t, u) {
  // A name can sound like another (Mia, Maya), so any word in a name's place lines up with it.
  const cost = (i, j) => (t[i].key === u[j].key ? 0 : similar(t[i].key, u[j].key) || t[i].name ? 0.4 : 1.2);
  const d = Array.from({ length: t.length + 1 }, (_, i) => Array.from({ length: u.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= t.length; i++) {
    for (let j = 1; j <= u.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost(i - 1, j - 1));
  }
  const pairs = [];
  let i = t.length;
  let j = u.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && Math.abs(d[i][j] - (d[i - 1][j - 1] + cost(i - 1, j - 1))) < 1e-9) { pairs.unshift([i - 1, j - 1]); i--; j--; }
    else if (i > 0 && Math.abs(d[i][j] - (d[i - 1][j] + 1)) < 1e-9) { pairs.unshift([i - 1, null]); i--; }
    else { pairs.unshift([null, j - 1]); j--; }
  }
  return pairs;
}

const END_MARKS = { ".": "a period", "?": "a question mark", "!": "an exclamation point" };

/**
 * Dictation is about capitals and punctuation, so those count; a misspelled word doesn't (it's listed to fix
 * gently), except a missing apostrophe or a name's capital. Returns { right, hint, spelling: [{ typed, word }],
 * issues: [{ index, text }] } where index is the target word the issue is on.
 */
export function checkDictation(target, typed) {
  const t = dictTokens(target);
  const u = dictTokens(typed);
  const issues = [];
  const spelling = [];
  const add = (index, text, first = false) => (first ? issues.unshift({ index, text }) : issues.push({ index, text }));
  for (const [i, j] of alignWords(t, u)) {
    if (j === null) { add(i, `A word is missing. Listen again for "${t[i].core}".`, true); continue; }
    if (i === null) { add(Math.max(0, t.length - 1), `"${u[j].core}" isn't in the sentence. Listen again.`, true); continue; }
    const want = t[i];
    const got = u[j];
    if (want.key !== got.key) {
      if (homophones(want.key, got.key) && want.core.includes("'") === got.core.includes("'")) spelling.push({ typed: got.core, word: want.core, homophone: true });
      else if (want.name && /^[A-Za-z]+$/.test(got.core)) spelling.push({ typed: got.core, word: want.core, name: true }); // Mia for Maya
      else if (!similar(want.key, got.key)) { add(i, `Listen again: one word is different from "${got.core}".`, true); continue; }
      else spelling.push({ typed: got.core, word: want.core });
    }
    if (want.core.includes("'") !== got.core.includes("'")) {
      add(i, want.core.includes("'") ? `${want.core} needs an apostrophe.` : `${got.core} doesn't need an apostrophe.`);
    }
    if (want.core[0] && got.core[0] && (want.core[0] === want.core[0].toUpperCase()) !== (got.core[0] === got.core[0].toUpperCase())) {
      const first = i === 0 || /[.!?]"?$/.test(t[i - 1].trail) || /^"/.test(want.lead);
      add(i, want.core[0] === want.core[0].toUpperCase()
        ? (first ? `Start with a capital letter: ${want.core}.` : `${want.core} needs a capital letter (names, places, days, months and I always do).`)
        : `${got.core} doesn't need a capital letter here.`);
    }
    if (want.lead !== got.lead) add(i, want.lead.includes('"') ? `Put quotation marks before "${want.core}", where the talking starts.` : `Check the marks before "${got.core}".`);
    // A read-aloud voice can't show an exclamation point, so a period counts too (and the other way round).
    const calm = (trail) => trail.replace(/!/g, ".");
    if (want.trail !== got.trail && calm(want.trail) !== calm(got.trail)) {
      const last = i === t.length - 1;
      const end = want.trail.replace(/"/g, "");
      if (want.trail.includes('"') !== got.trail.includes('"')) add(i, want.trail.includes('"') ? `Close the quotation marks after "${want.core}".` : `There's no quotation mark after "${got.core}".`);
      else if (last && END_MARKS[end.slice(-1)]) add(i, `End the sentence with ${END_MARKS[end.slice(-1)]}.`);
      else if (want.trail.includes(",") && !got.trail.includes(",")) add(i, `Add a comma after "${want.core}".`);
      else if (!want.trail.includes(",") && got.trail.includes(",")) add(i, `There's no comma after "${got.core}".`);
      else add(i, `Check the mark after "${want.core}".`);
    }
  }
  // A period where the sentence has ! counts (a voice can't show it), but the answer says so.
  const lastWant = t.at(-1)?.trail || "";
  const lastGot = u.at(-1)?.trail || "";
  const exclaim = lastWant.includes("!") && !lastGot.includes("!");
  return { right: issues.length === 0, hint: issues[0]?.text || null, spelling, issues, exclaim };
}

/** The sentence's words without capitals or marks, for players who read instead of listen. */
export const dictationWords = (text) => dictTokens(text).map((tok) => tok.core.toLowerCase().replace(/'/g, "")).join(" ");

/** Where to pause when reading phrase by phrase: after commas, quotation marks and end marks. */
export function dictationPhrases(text) {
  const out = [];
  let cur = [];
  for (const tok of dictTokens(text)) {
    cur.push(tok.raw);
    if (/[,;:.!?"]/.test(tok.trail) || cur.length >= 5) { out.push(cur.join(" ")); cur = []; }
  }
  if (cur.length) out.push(cur.join(" "));
  return out;
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
  if (item.type === "labelfix") return parseProofread(item).answerText.split(" ").map((t) => t.replace("^", "/")).join(" ");
  if (item.type === "combine") return parseCombine(item).answerText;
  if (item.type === "dictate") return item.text;
  if (item.type === "workshop") return `${workshopText(workshopExample(item))} (one sentence that works)`;
  throw new Error(`Unknown item type: ${item.type}`);
}

export const ITEM_TYPES = ["mark", "fix", "which", "build", "sort", "check", "join", "flow", "labels", "proofread", "diagram", "combine", "dictate", "labelfix", "workshop"];

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
  // Flow Factory's final draft: every word carries a known label ("word^LABEL"), and each mistake offers real labels.
  if (item.type === "labelfix") {
    const parsed = parseProofread(item);
    if (parsed.errors.length < 2) throw new Error(`${item.id}: needs 2+ wrong labels`);
    const known = (l) => Object.prototype.hasOwnProperty.call(LABELS, l);
    for (const [i, w] of parsed.words.entries()) {
      const e = parsed.errors.find((x) => x.index === i);
      const labels = e ? [e.shown, ...e.choices] : [w.split("^")[1]];
      if (!w.includes("^")) throw new Error(`${item.id}: "${w}" has no label`);
      for (const l of labels) if (!known(l)) throw new Error(`${item.id}: "${l}" isn't a label`);
      if (e && (e.shown === e.correct || new Set(e.choices).size !== e.choices.length || e.choices.includes(e.shown))) throw new Error(`${item.id}: "${w}" needs a wrong label and different choices`);
    }
  }
  if (item.type === "labels") {
    const parsed = parseLabels(item);
    if (parsed.tiles.length < 3) throw new Error(`${item.id}: needs 3+ words`);
    if (!parsed.line.every((l) => flowLabels(item).includes(l))) throw new Error(`${item.id}: uses a label not taught by level ${item.level}`);
    if (new Set(parsed.tiles.map((t) => t.word)).size !== parsed.tiles.length) throw new Error(`${item.id}: repeated words`);
    if (!checkLabels(parsed, parsed.tiles.map((t) => t.word))) throw new Error(`${item.id}: its own answer isn't accepted`);
  }
  if (item.type === "dictate") {
    if (!/^["A-Z]/.test(item.text) || !/[.!?]"?$/.test(item.text)) throw new Error(`${item.id}: needs a capital and an end mark`);
    if (!checkDictation(item.text, item.text).right) throw new Error(`${item.id}: its own sentence isn't accepted`);
    if (checkDictation(item.text, dictationWords(item.text)).right) throw new Error(`${item.id}: nothing to capitalize or punctuate`);
  }
  if (item.type === "combine") {
    const parsed = parseCombine(item);
    if (parsed.parts.length < 2 || !parsed.answers.length) throw new Error(`${item.id}: needs 2+ parts and an answer`);
    for (const answer of parsed.answers) {
      if (!/^[A-Z]/.test(answer) || !/[.!?]$/.test(answer)) throw new Error(`${item.id}: "${answer}" needs a capital and an end mark`);
      if (!checkCombine(parsed, answer).right) throw new Error(`${item.id}: its own answer "${answer}" isn't accepted`);
      if (parsed.use && !new RegExp(`\\b${parsed.use}\\b`, "i").test(answer)) throw new Error(`${item.id}: "${answer}" doesn't use ${parsed.use}`);
    }
    if (checkCombine(parsed, parsed.parts.join(" ")).right) throw new Error(`${item.id}: the two sentences as they are count as right`);
  }
  if (item.type === "workshop") {
    const { tiles, pattern, need } = parseWorkshop(item);
    if (![1, 2, 3, 4, 5].includes(pattern)) throw new Error(`${item.id}: pattern must be 1 to 5`);
    const allowed = { 1: ["A", "Adj", "N", "Np", "V", "Adv"], 2: ["A", "Adj", "N", "Np", "V", "Adv", "P", "PPA"] }[item.level] || WORKSHOP_KINDS;
    for (const t of tiles) {
      if (!WORKSHOP_KINDS.includes(t.kind)) throw new Error(`${item.id}: "${t.word}" has an unknown kind ${t.kind}`);
      if (!allowed.includes(t.kind)) throw new Error(`${item.id}: ${t.kind} tiles aren't used at level ${item.level}`);
      if (/[A-Z.,!?]/.test(t.word)) throw new Error(`${item.id}: tiles are lowercase words without marks ("${t.word}")`);
      if ((t.kind === "N" || t.kind === "Np") && !nounInfo(t.word).number) throw new Error(`${item.id}: add "${t.word}" to the singular or plural noun list in src/lib/nouns.js`);
      if (t.kind === "Adv" && !adverbQuestion(t.word)) throw new Error(`${item.id}: say whether "${t.word}" answers how, when or where (adverbQuestion in src/lib/workshop.js)`);
    }
    for (const n of need) if (!WORKSHOP_NEEDS[n]) throw new Error(`${item.id}: unknown need ${n}`);
    if (new Set(tiles.map((t) => t.word)).size !== tiles.length) throw new Error(`${item.id}: repeated tiles`);
    if (tiles.length < 7) throw new Error(`${item.id}: needs 7+ tiles, with a few that don't fit`);
    const example = workshopExample(item);
    const result = checkWorkshop(item, example);
    if (!result.right) throw new Error(`${item.id}: its own example isn't accepted: ${result.why}`);
    validateItem(workshopFlowItem(item, example, result.roles));
  }
  return true;
}

const SUBJECT_PRONOUNS = new Set(["i", "he", "she", "we", "they", "who", "whoever"]);
const OBJECT_PRONOUNS = new Set(["me", "him", "her", "us", "them", "whom", "whomever", "myself", "himself", "herself", "ourselves", "themselves"]);
const SOUND_ALIKES = [["than", "that"], ["threw", "through"], ["passed", "past"], ["their", "there", "they're"], ["its", "it's"], ["to", "too", "two"], ["your", "you're"], ["whose", "who's"], ["are", "our", "hour"], ["then", "than"], ["affect", "effect", "affects", "effects"], ["lose", "loose"], ["accept", "except"]];
const POSSESSIVES = new Set(["mine", "yours", "his", "hers", "ours", "theirs", "my", "your", "our", "their", "its"]);
// Irregular past tenses and other verb forms that don't end in -s, -ed or -ing.
const VERB_FORMS = new Set(["is", "are", "was", "were", "be", "am", "has", "have", "had", "do", "does", "did", "went", "go", "saw", "see", "seen",
  "ran", "run", "took", "take", "made", "make", "gave", "give", "came", "come", "lay", "lie", "laid", "win", "won", "ride", "rode", "drive", "drove",
  "drink", "drank", "teach", "taught", "catch", "caught", "build", "built", "fly", "flew", "swim", "swam", "blow", "blew", "throw", "threw",
  "grow", "grew", "know", "knew", "tell", "told", "bring", "brought", "think", "thought", "sit", "sat", "set", "eat", "ate", "send", "sent", "beat", "pay", "paid",
  "dig", "dug", "find", "found", "get", "got", "wear", "wore", "freeze", "froze", "rise", "rose", "wake", "woke", "can", "could",
  "don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't"]);
const PERSONAL = new Set(["i", "me", "you", "he", "him", "she", "her", "it", "we", "us", "they", "them"]);
const RELATIVE = new Set(["who", "whom", "which", "that", "whose"]);
const JOINERS = new Set(["and", "but", "or", "so", "because", "before", "after", "when", "where", "while", "although", "since", "if", "unless", "until"]);
const COMPARE = new Set(["good", "better", "best", "goodest", "bad", "worse", "worst", "baddest", "less", "fewer", "least", "more", "most", "much", "many"]);

/**
 * What kind of slip a proofreading mistake is, from the word shown and its fix, so a miss can say more than
 * "read it slowly": a capital, an apostrophe, a mark, a sound-alike word, a pronoun, a verb, or spelling.
 */
export function mistakeKind(shown, correct) {
  // Marks can hang on either end of a word: a missing opening quote or parenthesis is punctuation too.
  const bare = (w) => w.replace(/^[“"(‘]+/, "").replace(/[.,!?;:"”)]+$/, "");
  const a = shown.trim();
  const b = correct.trim();
  if (a.toLowerCase() === b.toLowerCase()) return "Capital letters: should this word start with a capital (a name, a place, the first word) or not?";
  if (bare(a) === bare(b) || bare(a).replace(/[—–-]+$/, "") === bare(b).replace(/[—–-]+$/, "")) {
    return "Punctuation: which mark, if any, belongs here? Check where the sentence ends, where quoted words start and stop, and the comma rules (lists, joining words, starting parts, extra information).";
  }
  const la = bare(a).toLowerCase();
  const lb = bare(b).toLowerCase();
  if (SOUND_ALIKES.some((set) => set.includes(la) && set.includes(lb))) return "Sound-alike or look-alike words: they sound or look almost the same but mean different things. Which one fits this sentence?";
  if (POSSESSIVES.has(lb) && /'/.test(la)) return "Possessive pronouns: mine, yours, ours and theirs already show ownership, with no apostrophe.";
  const noMark = (w) => w.replace(/'/g, "");
  if (noMark(la) === noMark(lb) || (/'/.test(la + lb) && noMark(la).replace(/s+$/, "") === noMark(lb).replace(/s+$/, ""))) {
    if (POSSESSIVES.has(lb)) return "Possessive pronouns: mine, yours, ours and theirs already show ownership, with no apostrophe.";
    return "Apostrophes: is this word showing who owns something, a contraction, or just more than one?";
  }
  if (/sel(f|ves|fs)$/.test(la) && /sel(f|ves|fs)$/.test(lb)) return "Pronouns: myself, himself, themselves… pick the -self word that matches who it points back to (one or more than one).";
  if (RELATIVE.has(la) && RELATIVE.has(lb)) return "Pronouns: use who for people and which for things (that works for either); whom when it receives the action.";
  const reflexive = (w) => /sel(f|ves)$/.test(w);
  if (reflexive(la) !== reflexive(lb) && (PERSONAL.has(la) || PERSONAL.has(lb))) return "Pronouns: use a -self word (myself, herself) only when it points back to the subject of the same sentence.";
  if ((SUBJECT_PRONOUNS.has(la) || OBJECT_PRONOUNS.has(la)) && (SUBJECT_PRONOUNS.has(lb) || OBJECT_PRONOUNS.has(lb)) && SUBJECT_PRONOUNS.has(la) !== SUBJECT_PRONOUNS.has(lb)) {
    return "Pronouns: does this one do the action (I, he, she, we, they, who) or receive it (me, him, her, us, them, whom)?";
  }
  if (PERSONAL.has(la) && PERSONAL.has(lb)) return "Pronouns: which pronoun matches the noun it stands for (and stays the same through the sentence)?";
  if (JOINERS.has(la) && JOINERS.has(lb)) return "Joining words: which one shows how the two ideas connect (adding, choosing, a reason, a time, a contrast)?";
  if (COMPARE.has(la) && COMPARE.has(lb)) return "Comparisons: better for two, best for three or more; fewer for things you can count, less for amounts.";
  const verbish = (w) => /(ed|ing)$/.test(w) || VERB_FORMS.has(w) || (/s$/.test(w) && VERB_FORMS.has(w.replace(/e?s$/, "")));
  if (POSSESSIVES.has(la) || POSSESSIVES.has(lb)) return "Pronouns: which form shows who owns it, or who does the action?";
  const stems = (x) => new Set([x, x.replace(/ies$/, "y"), x.replace(/s$/, ""), x.replace(/es$/, ""), x.replace(/ed$/, ""), x.replace(/d$/, ""), x.replace(/ing$/, ""), x.replace(/ing$/, "e"),
    x.replace(/ied$/, "y"), x.replace(/(.)\1(ed|ing)$/, "$1")]);
  const stem = (x) => x.replace(/ies$/, "y").replace(/(es|s|ed|ing)$/, "");
  const lyPair = (x, y) => /ly$/.test(y) && !/ly$/.test(x) && (y.replace(/l?ly$/, "") === x.replace(/(ness|e)$/, "") || y === `${x}ly`);
  if (lyPair(la, lb) || lyPair(lb, la) || (/ness$/.test(la + lb) && stem(la.replace(/ly$|ness$/, "")) === stem(lb.replace(/ly$|ness$/, "")))) {
    return "Adjective or adverb: an adjective describes a noun (a careful driver); an adverb tells how (drives carefully).";
  }
  const sa = stems(la);
  const sameStem = la !== lb && [...stems(lb)].some((x) => x.length > 1 && sa.has(x));
  // Tense and agreement only when it's the same verb (walk/walked, go/went, is/are, a made-up -ed form, was + -ing);
  // two different verbs (strolled/went) are a word choice.
  const verbForm = (w) => VERB_FORMS.has(w) || VERB_FORMS.has(w.replace(/e?s$/, "")) || VERB_FORMS.has(w.replace(/s$/, ""));
  const madeUp = (x, y) => /ed$/.test(x) && !/ed$/.test(y) && (x[0] === y[0] || (verbForm(y) && !verbForm(x) && VERB_FORMS.has(x.replace(/e?d$/, ""))));
  const helper = (x, y) => /ing$/.test(x) && /^(is|am|are|was|were)$/.test(y);
  const phrase = (x, y) => / /.test(x + y) && /ing$/.test(x) && /ing$/.test(y) && /\b(is|am|are|was|were|will|be)\b/.test(x + " " + y);
  if (la.length > 3 && editDistance(la, lb) === 1 && !sameStem && !verbForm(la) && !verbForm(lb)) return "Spelling: look closely, letter by letter.";
  if ((sameStem && !/'/.test(la + lb)) || (verbForm(la) && verbForm(lb)) || phrase(la, lb) || madeUp(la, lb) || madeUp(lb, la) || helper(la, lb) || helper(lb, la)) {
    return "Verbs: check the tense (when it happened) and whether the verb agrees with its subject.";
  }
  if (verbish(la) || verbish(lb) || /ed$/.test(la + lb)) return "Word choice: both could fit, so which word gives the exact meaning (or the right tone) here?";
  return "Word form or spelling: which version is the right word for this spot?";
}
