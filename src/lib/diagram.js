// Sentence diagrams (Reed-Kellogg) built from the Shurley labels the game already has.
// Pure: buildDiagram works out what hangs where, layoutDiagram turns that into lines and word slots.

import { parseTags } from "./parse.js";

const NOUNS = ["SN", "SP", "DO", "IO", "PrN", "OCN", "OP"];
const VERBS = ["V", "V-t", "LV", "HV"];
const MODIFIERS = ["A", "Adj", "PPA", "PNA"];
const clean = (word) => word.replace(/[.?!,]+$/, "");

/**
 * The diagram's structure, or null if the sentence uses something not diagrammed yet
 * (an adverb describing another describing word, a compound part).
 * Each node: { slot, mods: [{ kind: "slant", node } | { kind: "phrase", p: slot|null, node }] }.
 */
export function buildDiagram(item) {
  const words = parseTags(item.tags);
  const labels = words.map((w) => w.label);
  const nodes = {};
  const node = (indexes) => ({ indexes, mods: [] });
  const slotText = (indexes) => indexes.map((i) => clean(words[i].word)).join(" ");

  const subject = labels.findIndex((l) => l === "SN" || l === "SP");
  const verbs = labels.map((l, i) => (VERBS.includes(l) ? i : -1)).filter((i) => i >= 0);
  if (subject < 0 || !verbs.length) return null;
  if (labels.filter((l) => l === "SN" || l === "SP").length > 1) return null;
  const tree = { subject: node([subject]), verb: node(verbs), complement: null, objectComplement: null };
  nodes[subject] = tree.subject;
  verbs.forEach((i) => { nodes[i] = tree.verb; });
  const comp = labels.findIndex((l) => l === "DO" || l === "PrN" || l === "PA");
  if (comp >= 0) {
    tree.complement = { kind: labels[comp], node: node([comp]) };
    nodes[comp] = tree.complement.node;
  }
  const oc = labels.findIndex((l) => l === "OCN" || l === "OCA");
  if (oc >= 0) {
    if (!tree.complement || tree.complement.kind !== "DO") return null;
    tree.objectComplement = { kind: labels[oc], node: node([oc]) };
    nodes[oc] = tree.objectComplement.node;
  }
  labels.forEach((l, i) => { if (l === "OP" || l === "IO") nodes[i] = node([i]); });

  const placed = new Set([subject, ...verbs, comp, oc].filter((i) => i >= 0));
  const attach = item.attach || {};
  const slants = [];
  const phrases = [];
  for (let i = 0; i < words.length; i++) {
    const l = labels[i];
    if (MODIFIERS.includes(l)) {
      const target = labels.findIndex((t, j) => j > i && NOUNS.includes(t));
      if (target < 0) return null;
      slants.push([target, i]);
    } else if (l === "Adv") {
      const next = labels[i + 1];
      if (next === "Adj" || next === "Adv") return null;
      slants.push([next === "PA" || next === "OCA" ? i + 1 : verbs[0], i]);
    } else if (l === "P") {
      const obj = labels.findIndex((t, j) => j > i && t === "OP");
      if (obj < 0) return null;
      phrases.push([attach[i] ?? verbs[0], i, obj]);
      placed.add(obj);
    } else if (l === "IO") {
      phrases.push([verbs[0], null, i]);
    } else if (!placed.has(i)) {
      if (l !== "OP") return null; // a label this diagram doesn't know
    }
    if (MODIFIERS.includes(l) || l === "Adv" || l === "P" || l === "IO") placed.add(i);
  }
  for (const [target, i] of slants) {
    if (!nodes[target]) return null;
    nodes[i] = node([i]);
    nodes[target].mods.push({ kind: "slant", node: nodes[i] });
  }
  // Indirect objects first, then prepositional phrases, after the slanted describing words.
  phrases.sort((a, b) => (a[1] === null ? -1 : 0) - (b[1] === null ? -1 : 0));
  for (const [target, p, obj] of phrases) {
    if (!nodes[target]) return null;
    nodes[target].mods.push({ kind: "phrase", p: p === null ? null : [p], node: nodes[obj] });
  }
  if (placed.size !== words.length) return null;

  // Every place a word (or words) goes, with the words that belong there.
  // role: subject, verb, DO, PrN, PA, OCN, OCA, or the word's label when it hangs (A, Adj, PPA, PNA, Adv, P, OP, IO).
  // parent: the slot it hangs under (or, for an object complement, the direct object).
  const slots = [];
  const addSlot = (indexes, where, role, parent) => {
    const id = slots.length;
    slots.push({ id, indexes, text: slotText(indexes), where, role, parent, baseline: parent === null });
    return id;
  };
  const walk = (n, where, role, parent = null) => {
    n.slot = addSlot(n.indexes, where, role, parent);
    for (const m of n.mods) {
      if (m.kind === "slant") walk(m.node, "slant", labels[m.node.indexes[0]], n.slot);
      else {
        m.pSlot = m.p ? addSlot(m.p, "slant", "P", n.slot) : null;
        walk(m.node, "line", m.p ? "OP" : "IO", m.p ? m.pSlot : n.slot);
      }
    }
  };
  walk(tree.subject, "line", "subject");
  walk(tree.verb, "line", "verb");
  if (tree.complement) walk(tree.complement.node, "line", tree.complement.kind);
  if (tree.objectComplement) walk(tree.objectComplement.node, "line", tree.objectComplement.kind);
  const verbSlot = tree.verb.slot;
  if (tree.complement) slots[tree.complement.node.slot].parent = verbSlot;
  if (tree.objectComplement) slots[tree.objectComplement.node.slot].parent = tree.complement.node.slot;
  slots.forEach((slot) => { slot.baseline = ["subject", "verb", "DO", "PrN", "PA", "OCN", "OCA"].includes(slot.role); });
  tree.hasHelper = verbs.some((i) => labels[i] === "HV");
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

const slantLen = (text) => Math.max(charW(text) + 26, 52);

/** Space a word line needs: its own text, or the things hanging under it. */
function lineSize(diagram, n) {
  const text = diagram.slots[n.slot].text;
  let modsW = PAD;
  let below = 0;
  n.mods.forEach((m, k) => {
    if (m.kind === "slant") {
      const len = slantLen(diagram.slots[m.node.slot].text);
      const tail = len * COS;
      modsW += k === n.mods.length - 1 ? tail + 6 : SLANT_STEP;
      below = Math.max(below, len * SIN);
    } else {
      const len = m.pSlot === null ? 40 : slantLen(diagram.slots[m.pSlot].text);
      const obj = lineSize(diagram, m.node);
      modsW += len * COS + obj.width + 10;
      below = Math.max(below, len * SIN + obj.below);
    }
  });
  return { width: Math.max(charW(text) + 2 * PAD, modsW), below };
}

/**
 * Lines to draw and boxes for each slot. Slot boxes: { id, x, y, angle (degrees), w, h } where (x, y) is where
 * the text starts on its line and angle 0 is a flat line.
 */
export function layoutDiagram(diagram) {
  const lines = [];
  const boxes = [];
  const top = 34;
  const y0 = top + 4;

  function drawLine(n, x, y, width) {
    lines.push([x, y, x + width, y]);
    boxes.push({ id: n.slot, x: x + width / 2, y, angle: 0, w: width - 8, align: "middle" });
    let cx = x + PAD;
    n.mods.forEach((m, k) => {
      if (m.kind === "slant") {
        const len = slantLen(diagram.slots[m.node.slot].text);
        lines.push([cx, y, cx + len * COS, y + len * SIN]);
        boxes.push({ id: m.node.slot, x: cx, y, angle: 60, w: len, align: "start" });
        cx += k === n.mods.length - 1 ? len * COS + 6 : SLANT_STEP;
      } else {
        const len = m.pSlot === null ? 40 : slantLen(diagram.slots[m.pSlot].text);
        const ex = cx + len * COS;
        const ey = y + len * SIN;
        lines.push([cx, y, ex, ey]);
        if (m.pSlot !== null) boxes.push({ id: m.pSlot, x: cx, y, angle: 60, w: len, align: "start" });
        const obj = lineSize(diagram, m.node);
        drawLine(m.node, ex, ey, obj.width);
        cx = ex + obj.width + 10;
      }
    });
  }

  const { tree } = diagram;
  const parts = [tree.subject, tree.verb, tree.complement?.node, tree.objectComplement?.node].filter(Boolean);
  const sizes = parts.map((n) => lineSize(diagram, n));
  let x = 8;
  parts.forEach((n, k) => {
    if (k === 1) lines.push([x, y0 - 26, x, y0 + 12]); // subject | verb: crosses the baseline
    if (k === 2) {
      if (tree.complement.kind === "DO") lines.push([x, y0 - 26, x, y0]); // verb | direct object
      else lines.push([x, y0, x - 14, y0 - 26]); // verb \ predicate noun or adjective
    }
    if (k === 3) lines.push([x, y0, x - 14, y0 - 26]); // direct object \ object complement
    drawLine(n, x, y0, sizes[k].width);
    x += sizes[k].width;
  });
  const below = Math.max(...sizes.map((s) => s.below));
  return { lines, boxes, width: Math.ceil(x + 8), height: Math.ceil(y0 + below + 24), font: FONT };
}

/** Is every slot filled with the right words? `filled` maps slot id → text placed. Returns the wrong slot ids. */
export function wrongSlots(diagram, filled) {
  return diagram.slots.filter((s) => filled[s.id] !== s.text).map((s) => s.id);
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
  const verb = diagram.slots[diagram.tree.verb.slot].text;
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
    case "Adv":
      return diagram.slots[slot.parent].role === "verb"
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
