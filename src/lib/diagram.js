// Sentence diagrams (Reed-Kellogg) built from the Shurley labels the game already has.
// Pure: buildDiagram works out what hangs where, layoutDiagram turns that into lines and word slots.

import { parseTags } from "./parse.js";

const NOUNS = ["SN", "SP", "CSN", "CSP", "DO", "CDO", "IO", "CIO", "PrN", "CPrN", "PrP", "CPrP", "OCN", "OP", "COP"];
const VERBS = ["V", "V-t", "LV", "HV"];
const COMPOUND_VERBS = ["CV", "CV-t", "CLV"];
const MODIFIERS = ["A", "Adj", "PPA", "PNA"];
const BASELINE_ROLES = ["subject", "verb", "DO", "PrN", "PrP", "PA", "OCN", "OCA", "CSN", "CSP", "CV", "CV-t", "CLV", "CDO", "CPrN", "CPrP", "CPA"];
// A compound complement and the kind of line it sits behind.
const COMPLEMENTS = { DO: "DO", PrN: "PrN", PrP: "PrN", PA: "PA" };
const COMPOUND_COMPLEMENTS = { CDO: "DO", CPrN: "PrN", CPrP: "PrN", CPA: "PA" };
const INTENSIFIERS = ["very", "really", "so", "too", "quite", "extremely", "rather", "almost", "most", "more", "super", "incredibly"];
const clean = (word) => word.replace(/[.?!,]+$/, "");

/**
 * The diagram's structure, or null if the sentence uses something not diagrammed yet (more than two compound
 * parts, a compound verb with a complement, a chain of adverbs).
 * A baseline part is a node or a fork { fork: true, parts: [node, node], conj: index }.
 * Each node: { indexes, mods: [{ kind: "slant", node } | { kind: "phrase", p: [index]|null, node }] }; a slanted
 * node can have its own slanted mods (very under loudly).
 * item.attach (optional) maps a word index to the index of the word it describes, when the default guess is wrong.
 */
export function buildDiagram(item) {
  const words = parseTags(item.tags);
  const labels = words.map((w) => w.label);
  const nodes = {};
  const node = (indexes) => ({ indexes, mods: [] });
  const slotText = (indexes) => indexes.map((i) => clean(words[i].word)).join(" ");
  const find = (list) => labels.map((l, i) => (list.includes(l) ? i : -1)).filter((i) => i >= 0);
  const conjBetween = (a, b) => {
    const c = labels.findIndex((l, i) => l === "C" && i > a && i < b);
    return c;
  };

  // Subject: one SN/SP, or two compound subject parts joined by a conjunction.
  const compoundSubject = find(["CSN", "CSP"]);
  const single = find(["SN", "SP"]);
  let subject;
  if (compoundSubject.length) {
    if (compoundSubject.length !== 2 || single.length) return null;
    const conj = conjBetween(...compoundSubject);
    if (conj < 0) return null;
    subject = { fork: true, parts: compoundSubject.map((i) => node([i])), conj };
    subject.parts.forEach((n) => { nodes[n.indexes[0]] = n; });
  } else {
    if (single.length !== 1) return null;
    subject = node(single);
    nodes[single[0]] = subject;
  }

  // Verb: the verb with any helping verbs, or two compound verbs joined by a conjunction.
  const compoundVerb = find(COMPOUND_VERBS);
  const plainVerbs = find(VERBS);
  let verb;
  if (compoundVerb.length) {
    if (compoundVerb.length !== 2 || plainVerbs.length) return null;
    const conj = conjBetween(...compoundVerb);
    if (conj < 0) return null;
    verb = { fork: true, parts: compoundVerb.map((i) => node([i])), conj };
    verb.parts.forEach((n) => { nodes[n.indexes[0]] = n; });
  } else {
    if (!plainVerbs.length) return null;
    verb = node(plainVerbs);
    plainVerbs.forEach((i) => { nodes[i] = verb; });
  }
  const verbIndexes = compoundVerb.length ? compoundVerb : plainVerbs;
  // An adverb or phrase about the verb goes with the nearest verb before it (the first verb if none is before it).
  const verbFor = (i) => [...verbIndexes].reverse().find((v) => v < i) ?? verbIndexes[0];

  const tree = { subject, verb, complement: null, objectComplement: null };
  /** Two compound parts joined by a conjunction, as a fork (each part registered as a node), or null. */
  const fork = (indexes) => {
    if (indexes.length !== 2) return null;
    const conj = conjBetween(...indexes);
    if (conj < 0) return null;
    const f = { fork: true, parts: indexes.map((i) => node([i])), conj };
    f.parts.forEach((n) => { nodes[n.indexes[0]] = n; });
    return f;
  };
  const comp = labels.findIndex((l) => l in COMPLEMENTS);
  const compoundComp = find(Object.keys(COMPOUND_COMPLEMENTS));
  if (comp >= 0 && compoundComp.length) return null;
  const forks = [subject, verb].filter((p) => p.fork);
  if (comp >= 0) {
    tree.complement = { kind: COMPLEMENTS[labels[comp]], role: labels[comp], node: node([comp]) };
    nodes[comp] = tree.complement.node;
  } else if (compoundComp.length) {
    const f = fork(compoundComp);
    if (!f || COMPOUND_COMPLEMENTS[labels[compoundComp[0]]] !== COMPOUND_COMPLEMENTS[labels[compoundComp[1]]]) return null;
    tree.complement = { kind: COMPOUND_COMPLEMENTS[labels[compoundComp[0]]], node: f };
    forks.push(f);
  }
  const oc = labels.findIndex((l) => l === "OCN" || l === "OCA");
  if (oc >= 0) {
    if (!tree.complement || tree.complement.kind !== "DO" || tree.complement.node.fork) return null;
    tree.objectComplement = { kind: labels[oc], node: node([oc]) };
    nodes[oc] = tree.objectComplement.node;
  }
  labels.forEach((l, i) => { if (l === "OP" || l === "IO") nodes[i] = node([i]); });
  // Compound indirect objects hang together on one fork under the verb.
  const cio = find(["CIO"]);
  let ioFork = null;
  if (cio.length) {
    ioFork = fork(cio);
    if (!ioFork) return null;
    forks.push(ioFork);
  }
  // A compound object of the preposition: the two objects after one preposition.
  const copFor = {};
  for (const p of find(["P"])) {
    const first = labels.findIndex((l, j) => j > p && (l === "OP" || l === "COP"));
    if (first < 0 || labels[first] !== "COP") continue;
    const second = labels.findIndex((l, j) => j > first && l === "COP");
    const f = fork([first, second]);
    if (!f) return null;
    copFor[p] = f;
    forks.push(f);
  }
  if (find(["COP"]).length !== Object.keys(copFor).length * 2) return null;
  if (find(["C"]).length !== forks.length) return null;

  const placed = new Set([...find(["SN", "SP", "CSN", "CSP", "C", "CIO", "COP", ...COMPOUND_VERBS, ...Object.keys(COMPOUND_COMPLEMENTS)]), ...plainVerbs, comp, oc].filter((i) => i >= 0));
  const attach = item.attach || {};
  const slants = []; // [target, index]: describing words, attached after their targets exist
  const phrases = [];
  for (let i = 0; i < words.length; i++) {
    const l = labels[i];
    if (MODIFIERS.includes(l)) {
      const target = attach[i] ?? labels.findIndex((t, j) => j > i && NOUNS.includes(t));
      if (target < 0) return null;
      slants.push([target, i]);
      placed.add(i);
    } else if (l === "Adv") {
      const next = labels[i + 1];
      // An adverb right before an adjective describes it (very loud). Before another adverb, only words like very
      // and really describe it (very loudly); otherwise both tell about the verb (smiled proudly today).
      const intensifier = INTENSIFIERS.includes(clean(words[i].word).toLowerCase());
      const guess = next === "Adj" || next === "PA" || next === "OCA" || (next === "Adv" && intensifier) ? i + 1 : verbFor(i);
      slants.push([attach[i] ?? guess, i]);
      placed.add(i);
    } else if (l === "P") {
      if (copFor[i]) {
        phrases.push([attach[i] ?? verbFor(i), i, copFor[i]]);
      } else {
        const obj = labels.findIndex((t, j) => j > i && t === "OP");
        if (obj < 0) return null;
        phrases.push([attach[i] ?? verbFor(i), i, obj]);
        placed.add(obj);
      }
      placed.add(i);
    } else if (l === "IO") {
      phrases.push([verbFor(i), null, i]);
      placed.add(i);
    } else if (l === "CIO" && i === cio[0]) {
      phrases.push([verbFor(i), null, ioFork]);
    }
  }
  // Attach describing words whose target already has a place; repeat so "very" can wait for "loud".
  let pending = slants;
  for (let round = 0; pending.length && round < 4; round++) {
    const later = [];
    for (const [target, i] of pending) {
      if (!nodes[target]) { later.push([target, i]); continue; }
      nodes[i] = node([i]);
      nodes[target].mods.push({ kind: "slant", node: nodes[i] });
    }
    pending = later;
  }
  if (pending.length) return null;
  // Slanted words describing a slanted word: only one step deep.
  for (const n of Object.values(nodes)) {
    for (const m of n.mods) if (m.kind === "slant" && m.node.mods.some((mm) => mm.node.mods.length)) return null;
  }
  for (const n of Object.values(nodes)) n.mods.sort((a, b) => a.node.indexes[0] - b.node.indexes[0]);
  // Indirect objects first, then prepositional phrases, after the slanted describing words.
  phrases.sort((a, b) => (a[1] === null ? -1 : 0) - (b[1] === null ? -1 : 0));
  for (const [target, p, obj] of phrases) {
    if (!nodes[target]) return null;
    nodes[target].mods.push({ kind: "phrase", p: p === null ? null : [p], node: typeof obj === "object" ? obj : nodes[obj] });
  }
  if (placed.size !== words.length) return null;

  // role: subject, verb, DO, PrN, PA, OCN, OCA, CSN, CSP, CV, C, or the word's label when it hangs (A, Adj, PPA,
  // PNA, Adv, P, OP, IO). parent: the slot it hangs under (or, for a complement, the word it follows).
  const slots = [];
  const addSlot = (indexes, where, role, parent) => {
    const id = slots.length;
    slots.push({ id, indexes, text: slotText(indexes), where, role, parent });
    return id;
  };
  // A part is a node or a fork; a fork's parts each get their own line, and the conjunction sits between them.
  const walkPart = (part, role, parent = null) => {
    if (!part.fork) { walk(part, "line", role, parent); return; }
    part.parts.forEach((n) => walk(n, "line", labels[n.indexes[0]], parent));
    part.conjSlot = addSlot([part.conj], "conj", "C", part.parts[0].slot);
    slots[part.conjSlot].joins = part.parts.map((n) => n.slot);
    part.slot = part.parts[0].slot;
  };
  const walk = (n, where, role, parent = null) => {
    n.slot = addSlot(n.indexes, where, role, parent);
    for (const m of n.mods) {
      if (m.kind === "slant") walk(m.node, "slant", labels[m.node.indexes[0]], n.slot);
      else {
        m.pSlot = m.p ? addSlot(m.p, "slant", "P", n.slot) : null;
        walkPart(m.node, m.p ? "OP" : "IO", m.p ? m.pSlot : n.slot);
      }
    }
  };
  walkPart(subject, "subject");
  walkPart(verb, "verb");
  const verbSlot = verb.fork ? verb.parts[0].slot : verb.slot;
  if (tree.complement) walkPart(tree.complement.node, tree.complement.role || tree.complement.kind, verbSlot);
  if (tree.objectComplement) walk(tree.objectComplement.node, "line", tree.objectComplement.kind, tree.complement.node.slot);
  slots.forEach((slot) => {
    slot.baseline = slot.role === "C" ? slot.joins.every((id) => BASELINE_ROLES.includes(slots[id].role)) : BASELINE_ROLES.includes(slot.role);
  });
  tree.hasHelper = !verb.fork && plainVerbs.some((i) => labels[i] === "HV");
  tree.verbText = verb.fork ? verb.parts.map((n) => slots[n.slot].text).join(" and ") : slots[verb.slot].text;
  return { tree, slots, words };
}

// ---------- Layout ----------
const FONT = 16;
const charW = (text) => text.length * FONT * 0.56;
const ANGLE = Math.PI / 3; // slanted lines drop at 60°
const COS = Math.cos(ANGLE);
const SIN = Math.sin(ANGLE);
const SLANT_STEP = 30; // space between parallel slanted lines
const PAD = 14;
const STEP = 14; // the short flat line joining a slanted word to the word it describes
const FORK = 22; // how far the fork's arms reach sideways

const slantLen = (text) => Math.max(charW(text) + 26, 52);

/** A slanted word, with any slanted words describing it hanging from near its bottom end. */
function slantSize(diagram, n) {
  const len = slantLen(diagram.slots[n.slot].text);
  let right = len * COS;
  let below = len * SIN;
  let x = len * COS - 4 * COS + STEP;
  const y = len * SIN - 4 * SIN;
  for (const m of n.mods) {
    const l2 = slantLen(diagram.slots[m.node.slot].text);
    right = Math.max(right, x + l2 * COS);
    below = Math.max(below, y + l2 * SIN);
    x += l2 * COS + 6;
  }
  return { len, right, below };
}

/** Space a word line needs: its own text, or the things hanging under it. */
function lineSize(diagram, n) {
  const text = diagram.slots[n.slot].text;
  let modsW = PAD;
  let below = 0;
  n.mods.forEach((m, k) => {
    if (m.kind === "slant") {
      const sz = slantSize(diagram, m.node);
      const last = k === n.mods.length - 1;
      modsW += last ? sz.right + 6 : Math.max(SLANT_STEP, m.node.mods.length ? sz.right + 8 : 0);
      below = Math.max(below, sz.below);
    } else {
      const len = m.pSlot === null ? 40 : slantLen(diagram.slots[m.pSlot].text);
      const obj = hangSize(diagram, m.node);
      modsW += len * COS + obj.width + 10;
      below = Math.max(below, len * SIN + obj.below);
    }
  });
  return { width: Math.max(charW(text) + 2 * PAD, modsW), below };
}

/**
 * A fork for compound parts: two branches with room between them for the top branch's hanging words. On the
 * baseline the branches spread above and below it; hanging under a word (`down`), the first branch stays level
 * and the second drops below it.
 */
function forkSize(diagram, f, down = false) {
  const [a, b] = f.parts.map((n) => lineSize(diagram, n));
  const conjW = charW(diagram.slots[f.conjSlot].text) + 22;
  const inner = Math.max(a.width, b.width) + conjW;
  const gap = Math.max(a.below + (down ? 42 : 30), 64);
  return down
    ? { width: inner + 2 * FORK, inner, up: 0, gap, below: gap + b.below, a, b, conjW, down }
    : { width: inner + 2 * FORK, inner, up: gap / 2, gap, below: gap / 2 + b.below, a, b, conjW, down };
}

/** Space for something hanging under a word: a word line, or a fork when the object is compound. */
const hangSize = (diagram, n) => (n.fork ? forkSize(diagram, n, true) : lineSize(diagram, n));

/**
 * Lines to draw and boxes for each slot. Slot boxes: { id, x, y, angle (degrees), w, align } where (x, y) is where
 * the text sits on its line and angle 0 is a flat line. Dashed lines (the conjunction's) are in `dashes`.
 */
export function layoutDiagram(diagram) {
  const lines = [];
  const dashes = [];
  const boxes = [];

  function drawSlant(n, x, y) {
    const sz = slantSize(diagram, n);
    lines.push([x, y, x + sz.len * COS, y + sz.len * SIN]);
    boxes.push({ id: n.slot, x, y, angle: 60, w: sz.len, align: "start" });
    let ax = x + sz.len * COS - 4 * COS;
    const ay = y + sz.len * SIN - 4 * SIN;
    for (const m of n.mods) {
      const l2 = slantLen(diagram.slots[m.node.slot].text);
      lines.push([ax, ay, ax + STEP, ay]);
      lines.push([ax + STEP, ay, ax + STEP + l2 * COS, ay + l2 * SIN]);
      boxes.push({ id: m.node.slot, x: ax + STEP, y: ay, angle: 60, w: l2, align: "start" });
      ax += l2 * COS + 6;
    }
    return sz;
  }

  function drawLine(n, x, y, width) {
    lines.push([x, y, x + width, y]);
    boxes.push({ id: n.slot, x: x + width / 2, y, angle: 0, w: width - 8, align: "middle" });
    let cx = x + PAD;
    n.mods.forEach((m, k) => {
      if (m.kind === "slant") {
        const sz = drawSlant(m.node, cx, y);
        cx += k === n.mods.length - 1 ? sz.right + 6 : Math.max(SLANT_STEP, m.node.mods.length ? sz.right + 8 : 0);
      } else {
        const len = m.pSlot === null ? 40 : slantLen(diagram.slots[m.pSlot].text);
        const ex = cx + len * COS;
        const ey = y + len * SIN;
        lines.push([cx, y, ex, ey]);
        if (m.pSlot !== null) boxes.push({ id: m.pSlot, x: cx, y, angle: 60, w: len, align: "start" });
        const obj = hangSize(diagram, m.node);
        if (m.node.fork) drawFork(m.node, ex, ey, obj);
        else drawLine(m.node, ex, ey, obj.width);
        cx = ex + obj.width + 10;
      }
    });
  }

  function drawFork(f, x, y0, sz) {
    const yT = sz.down ? y0 : y0 - sz.up;
    const yB = sz.down ? y0 + sz.gap : y0 + sz.up;
    lines.push([x, y0, x + FORK, yT], [x, y0, x + FORK, yB]);
    drawLine(f.parts[0], x + FORK, yT, sz.inner);
    drawLine(f.parts[1], x + FORK, yB, sz.inner);
    const xr = x + FORK + sz.inner;
    lines.push([xr, yT, xr + FORK, y0], [xr, yB, xr + FORK, y0]);
    const xd = xr - 10;
    dashes.push([xd, yT, xd, yB]);
    boxes.push({ id: f.conjSlot, x: xd - sz.conjW / 2 + 2, y: (yT + yB) / 2 + 8, angle: 0, w: sz.conjW - 6, align: "middle" });
  }

  const { tree } = diagram;
  const parts = [tree.subject, tree.verb, tree.complement?.node, tree.objectComplement?.node].filter(Boolean);
  const sizes = parts.map((n) => (n.fork ? forkSize(diagram, n) : { ...lineSize(diagram, n), up: 26 }));
  const up = Math.max(26, ...sizes.map((s) => s.up));
  const y0 = 10 + up + 8;
  let x = 8;
  parts.forEach((n, k) => {
    if (k === 1) lines.push([x, y0 - 26, x, y0 + 12]); // subject | verb: crosses the baseline
    if (k === 2) {
      if (tree.complement.kind === "DO") lines.push([x, y0 - 26, x, y0]); // verb | direct object
      else lines.push([x, y0, x - 14, y0 - 26]); // verb \ predicate noun or adjective
    }
    if (k === 3) lines.push([x, y0, x - 14, y0 - 26]); // direct object \ object complement
    if (n.fork) {
      if (k === 0) { lines.push([x, y0, x + 8, y0]); x += 8; } // a short stub of baseline before the fork
      drawFork(n, x, y0, sizes[k]);
    } else drawLine(n, x, y0, sizes[k].width);
    x += sizes[k].width;
  });
  // A compound verb ends the sentence: finish the baseline past the fork.
  if (parts.at(-1).fork) { lines.push([x, y0, x + 10, y0]); x += 10; }
  const below = Math.max(...sizes.map((s) => s.below));
  return { lines, dashes, boxes, width: Math.ceil(x + 8), height: Math.ceil(y0 + below + 24), font: FONT };
}

/** Is every slot filled with the right words? `filled` maps slot id → text placed. Returns the wrong slot ids. */
export function wrongSlots(diagram, filled) {
  const wrong = new Set(diagram.slots.filter((s) => filled[s.id] !== s.text).map((s) => s.id));
  // The two parts of a compound may go on either branch of their fork (Leo and Mia, or Mia and Leo).
  for (const conj of diagram.slots.filter((s) => s.joins)) {
    const [a, b] = conj.joins.map((id) => diagram.slots[id]);
    if (filled[a.id] === b.text && filled[b.id] === a.text) { wrong.delete(a.id); wrong.delete(b.id); }
  }
  return [...wrong];
}

// ---------- Teaching: where each word goes, and why ----------

/** The order a guided walk-through places words: the baseline first, then what hangs from it. */
export function guideOrder(diagram) {
  return [...diagram.slots.filter((s) => s.baseline), ...diagram.slots.filter((s) => !s.baseline)];
}

/** One plain sentence saying what job a word does and why that puts it where it goes on the diagram. */
export function explainSlot(diagram, slot) {
  const w = slot.text;
  const parent = diagram.slots[slot.parent]?.text;
  const verb = diagram.tree.verbText;
  switch (slot.role) {
    case "subject":
      return `${w} is the simple subject, so it goes on the baseline, before the line that crosses it.`;
    case "verb":
      return `${w} is the verb${diagram.tree.hasHelper ? " with its helping verb" : ""}, so it goes on the baseline, after the line that crosses it.`;
    case "DO":
      return `${w} is the direct object: it answers "${verb} what?" It goes on the baseline after the verb, behind a short line that stops at the baseline.`;
    case "PrN":
      return `${w} is a predicate noun: it renames the subject. It goes after the verb, behind a line that leans back toward the subject.`;
    case "PA":
      return `${w} is a predicate adjective: it describes the subject. It goes after the verb, behind a line that leans back toward the subject.`;
    case "OCN":
      return `${w} is an object complement noun: it renames the direct object, ${parent}. It goes after ${parent}, behind a line that leans back toward it.`;
    case "OCA":
      return `${w} is an object complement adjective: it describes the direct object, ${parent}. It goes after ${parent}, behind a line that leans back toward it.`;
    case "A":
      return `${w} is an article that points to ${parent}, so it goes on a slanted line under ${parent}.`;
    case "Adj":
      return `${w} is an adjective that describes ${parent}, so it goes on a slanted line under ${parent}.`;
    case "PPA":
    case "PNA":
      return `${w} tells whose ${parent}, so it goes on a slanted line under ${parent}.`;
    case "CSN":
    case "CSP":
      return `${w} is one part of a compound subject, so it goes on its own branch of the subject's fork.`;
    case "CV":
    case "CV-t":
    case "CLV":
      return `${w} is one part of a compound verb, so it goes on its own branch of the verb's fork.`;
    case "CDO":
      return `${w} is one part of a compound direct object: it answers "${verb} what?" It goes on its own branch of a fork after the verb.`;
    case "CPrN":
    case "CPrP":
      return `${w} is one part of a compound predicate ${slot.role === "CPrP" ? "pronoun" : "noun"}: it renames the subject. It goes on its own branch of a fork after the verb.`;
    case "PrP":
      return `${w} is a predicate pronoun: it means the same person as the subject. It goes after the verb, behind a line that leans back toward the subject.`;
    case "CPA":
      return `${w} is one part of a compound predicate adjective: it describes the subject. It goes on its own branch of a fork after the verb.`;
    case "COP":
      return `${w} is one part of a compound object of the preposition ${parent}, so it goes on its own branch of the fork hanging from ${parent}.`;
    case "CIO":
      return `${w} is one part of a compound indirect object: it tells to whom or for whom. It goes on its own branch of the fork hanging under ${parent}.`;
    case "C": {
      const [a, b] = slot.joins.map((id) => diagram.slots[id].text);
      return `${w} is the conjunction joining ${a} and ${b}, so it goes beside the dashed line between the two branches.`;
    }
    case "Adv":
      if (diagram.slots[slot.parent].where === "slant") {
        return `${w} is an adverb that tells how ${parent}, so it goes on its own slanted line, joined to ${parent}'s line.`;
      }
      return ["verb", "CV", "CV-t", "CLV"].includes(diagram.slots[slot.parent].role)
        ? `${w} is an adverb that tells how, when or where about ${parent}, so it goes on a slanted line under ${parent}.`
        : `${w} is an adverb that tells how ${parent}, so it goes on a slanted line under ${parent}.`;
    case "P":
      return `${w} is a preposition. Its phrase tells more about ${parent}, so ${w} goes on a slanted line under ${parent}.`;
    case "OP":
      return `${w} is the object of the preposition ${parent}, so it goes on the flat line at the bottom of ${parent}'s slanted line.`;
    case "IO":
      return `${w} is the indirect object: it tells to whom or for whom. It hangs under ${parent} on a flat line, joined by an empty slanted line.`;
    default:
      return `${w} goes here.`;
  }
}
