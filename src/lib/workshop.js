// Sentence Workshop: build your own sentence from word tiles to fit a pattern, then label it with the Q&A Flow.
// The structure is checked, not the exact words, so "The sleepy puppy napped outside." and "A brown kitten
// wiggled happily." are both right for the same goal. Every tile carries its part of speech:
//   A (the, a, an)  PPA (my, his, our…)  Adj  N (a thing or animal: asks "what?")  Np (a person: asks "who?")
//   V (an action with no object)  Vt (an action that needs an object)  LV (a linking verb)  Adv  P (preposition)
// Sentences use past-tense verbs, so the only agreement to check is was/were and a/an.
import { nounInfo } from "./nouns.js";

/** Articles and possessives stay in the bank and can be used again: kids say "the" before every noun, and
 * running out of them has nothing to do with the pattern being practiced. */
export const REUSABLE_KINDS = new Set(["A", "PPA"]);

export const WORKSHOP_KINDS = ["A", "PPA", "Adj", "N", "Np", "V", "Vt", "LV", "Adv", "P"];

/** Goals a level can ask for, besides the pattern itself. */
export const WORKSHOP_NEEDS = {
  Adj: "an adjective (a describing word before a noun)",
  Adv: "an adverb (how, when or where)",
  PP: "a prepositional phrase (on the porch, with my dad)",
  PPA: "a possessive pronoun (my, his, her, our, their)",
};

export const WORKSHOP_PATTERNS = {
  1: { name: "Pattern 1", line: "SN V", says: "subject noun + verb" },
  2: { name: "Pattern 2", line: "SN V-t DO", says: "subject noun + verb + direct object" },
  3: { name: "Pattern 3", line: "SN V-t IO DO", says: "subject noun + verb + indirect object + direct object" },
  4: { name: "Pattern 4", line: "SN LV PrN", says: "subject noun + linking verb + predicate noun" },
  5: { name: "Pattern 5", line: "SN LV PA", says: "subject noun + linking verb + predicate adjective" },
};

// Adverbs answer how, when or where; the Q&A Flow asks the right one ("Napped where?").
const WHEN = new Set(["today", "yesterday", "early", "late", "soon", "later", "again", "tonight", "first", "once", "already"]);
const WHERE = new Set(["away", "outside", "inside", "home", "there", "here", "everywhere", "upstairs", "downstairs", "nearby", "around", "back", "up", "down", "off", "ahead", "below", "above"]);
const HOW_OTHER = new Set(["hard", "fast", "well", "together", "straight"]);
export function adverbQuestion(word) {
  const w = word.toLowerCase();
  if (WHEN.has(w)) return "when";
  if (WHERE.has(w)) return "where";
  if (/ly$/.test(w) || HOW_OTHER.has(w)) return "how";
  return null;
}
const COUNT_WORDS = new Set(["two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "many", "several", "few", "some"]);
const VOWEL_SOUND = /^(?:[aeio]|u(?!ni|se|ku)|hour|honest)/i;

/** "the|A sleepy|Adj puppy|N napped|V" → [{ id, word, kind }]. */
export function parseWorkshop(item) {
  const tiles = item.tiles.trim().split(/\s+/).map((t, id) => {
    const [word, kind] = t.split("|");
    return { id, word, kind };
  });
  return { tiles, pattern: Number(item.pattern), need: item.need || [] };
}

/** The goal in words: "Build a Pattern 2 sentence (subject noun + verb + direct object) with an adjective." */
export function workshopGoal(item) {
  const p = WORKSHOP_PATTERNS[item.pattern];
  const needs = (item.need || []).map((n) => WORKSHOP_NEEDS[n].replace(/ \(.*\)$/, ""));
  const tail = needs.length ? ` with ${needs.length > 1 ? `${needs.slice(0, -1).join(", ")} and ${needs.at(-1)}` : needs[0]}` : "";
  return `Build a ${p.name} sentence (${p.says})${tail}.`;
}

const nounLike = (k) => k === "N" || k === "Np";
const plural = (w) => nounInfo(w).number === "Plural";

/**
 * Checks the tiles in the order the player put them. Returns { right, why, roles } where roles[i] is the
 * Q&A Flow label for placed[i] (SN, V-t, DO, OP…) when the structure is right, and `why` says what to fix.
 */
export function checkWorkshop(item, placed) {
  const pattern = Number(item.pattern);
  const need = item.need || [];
  const k = placed.map((t) => t.kind);
  const roles = placed.map(() => null);
  let i = 0;
  const fail = (why) => ({ right: false, why, roles: null });
  if (placed.length < 2) return fail("Put at least a subject and a verb in your sentence.");

  // A noun phrase: (A|PPA)? Adj* N. `job` is the noun's label (SN, DO, IO, PrN, OP).
  function nounPhrase(job) {
    const start = i;
    let det = null;
    if (k[i] === "A" || k[i] === "PPA") { det = placed[i]; roles[i] = k[i]; i += 1; }
    if (k[i] === "A" || k[i] === "PPA") return "Use just one of the, a, an, my or his before a noun.";
    while (k[i] === "Adj") { roles[i] = "Adj"; i += 1; }
    if (!nounLike(k[i])) {
      if (i === start) return null; // no noun phrase here at all
      return `${placed[i - 1].word[0].toUpperCase()}${placed[i - 1].word.slice(1)} needs a noun after it: a person, place, thing or idea.`;
    }
    const noun = placed[i];
    roles[i] = job;
    i += 1;
    if (!det && !plural(noun.word)) return `One ${noun.word} needs a word like the, a or my before it (the ${noun.word}).`;
    if (det && /^an?$/i.test(det.word) && plural(noun.word)) return `A and an go with one thing. Use the, or pick one ${noun.word.replace(/s$/, "")}.`;
    const next = placed[start + 1];
    if (det && /^a$/i.test(det.word) && VOWEL_SOUND.test(next.word)) return `Use an before a vowel sound: an ${next.word}.`;
    if (det && /^an$/i.test(det.word) && !VOWEL_SOUND.test(next.word)) return `Use a before a consonant sound: a ${next.word}.`;
    return true;
  }
  // After the verb: adverbs and prepositional phrases, in any order.
  function tail() {
    while (i < placed.length) {
      if (k[i] === "Adv") { roles[i] = "Adv"; i += 1; continue; }
      if (k[i] === "P") {
        roles[i] = "P";
        i += 1;
        const np = nounPhrase("OP");
        if (np === null) return `A preposition like ${placed[i - 1].word} needs an object: a noun after it (${placed[i - 1].word} the porch).`;
        if (np !== true) return np;
        continue;
      }
      return null;
    }
    return true;
  }

  const subject = nounPhrase("SN");
  if (subject === null) return fail("Start with the subject: who or what the sentence is about (a noun, with the, a or my and describing words before it if you like).");
  if (subject !== true) return fail(subject);
  const subjectNoun = placed[i - 1];

  const verbKind = pattern === 1 ? "V" : pattern <= 3 ? "Vt" : "LV";
  const verbWhy = {
    V: "Pattern 1 needs an action verb that doesn't need an object after it, like napped or ran.",
    Vt: "This pattern needs an action verb that does something to someone or something, like chased or gave.",
    LV: "This pattern needs a linking verb (was, were, seemed, became…) that joins the subject to a word that names or describes it.",
  }[verbKind];
  if (!["V", "Vt", "LV"].includes(k[i])) return fail(i >= placed.length ? "Your sentence needs a verb after the subject." : `After the subject comes the verb. ${verbWhy}`);
  if (k[i] !== verbKind) return fail(verbWhy);
  const verb = placed[i];
  if (verbKind === "LV" && /^(was|were)$/i.test(verb.word)) {
    const many = plural(subjectNoun.word);
    if (many !== (verb.word.toLowerCase() === "were")) return fail(`${many ? "Were" : "Was"} goes with ${many ? "more than one" : "one"}: the ${subjectNoun.word} ${many ? "were" : "was"}.`);
  }
  roles[i] = verbKind === "V" ? "V" : verbKind === "Vt" ? "V-t" : "LV";
  i += 1;

  if (pattern === 1) {
    if (nounLike(k[i]) || k[i] === "A" || k[i] === "PPA") return fail("Pattern 1 has no direct object. After the verb, add an adverb (how, when, where) or a prepositional phrase instead of a noun.");
  } else if (pattern === 2 || pattern === 3) {
    const first = nounPhrase(pattern === 2 ? "DO" : "IO");
    if (first === null) return fail(pattern === 2 ? "Pattern 2 needs a direct object: a noun after the verb that answers what? or whom?" : "Pattern 3 needs two nouns after the verb: who gets it (indirect object), then what (direct object).");
    if (first !== true) return fail(first);
    if (pattern === 3) {
      const second = nounPhrase("DO");
      if (second === null) return fail("Pattern 3 needs a second noun: the direct object (what was given, shown or sent).");
      if (second !== true) return fail(second);
    } else if (nounLike(k[i]) || k[i] === "A" || k[i] === "PPA") {
      return fail("Two nouns after the verb make Pattern 3. Pattern 2 has just one: the direct object.");
    }
  } else if (pattern === 4) {
    if (k[i] === "Adj" && !nounLike(k[i + 1]) && !nounLike(k[i + 2])) return fail("That describes the subject (Pattern 5). Pattern 4 needs a noun after the linking verb that renames the subject.");
    const prn = nounPhrase("PrN");
    if (prn === null) return fail("Pattern 4 needs a predicate noun: a noun after the linking verb that renames the subject.");
    if (prn !== true) return fail(prn);
  } else if (pattern === 5) {
    if (k[i] !== "Adj") return fail(nounLike(k[i]) || k[i] === "A" || k[i] === "PPA"
      ? "A noun there renames the subject (Pattern 4). Pattern 5 needs a describing word after the linking verb."
      : "Pattern 5 needs a predicate adjective: a describing word after the linking verb.");
    roles[i] = "PA";
    i += 1;
  }
  const rest = tail();
  if (rest === null) return fail(`${placed[i].word[0].toUpperCase()}${placed[i].word.slice(1)} doesn't fit there. Try it somewhere else, or leave it out.`);
  if (rest !== true) return fail(rest);

  const has = { Adj: roles.includes("Adj"), Adv: roles.includes("Adv"), PP: roles.includes("P"), PPA: roles.includes("PPA") };
  const missing = need.find((n) => !has[n]);
  if (missing) return fail(`Almost! This one also asks for ${WORKSHOP_NEEDS[missing]}.`);
  return { right: true, why: null, roles };
}

/** The sentence as written: first word capitalized, a period at the end. */
export function workshopText(placed) {
  const words = placed.map((t) => t.word);
  if (!words.length) return "";
  words[0] = words[0][0].toUpperCase() + words[0].slice(1);
  return `${words.join(" ")}.`;
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);

/**
 * A Q&A Flow item for the player's own sentence, with the questions asked in Shurley order: subject, verb,
 * the complements (and V-t or LV), then the rest of the predicate, then the describing words, right to left.
 * Played by the regular Q&A Flow screen, so labeling your own sentence works the same as any other.
 */
export function workshopFlowItem(item, placed, roles) {
  const words = placed.map((t) => t.word);
  words[0] = cap(words[0]);
  const last = words.length - 1;
  const tagWords = words.map((w, n) => (n === last ? `${w}.` : w));
  const bare = (n) => placed[n].word.toLowerCase();
  const sn = roles.indexOf("SN");
  const v = roles.findIndex((r) => r === "V" || r === "V-t" || r === "LV");
  const who = (n) => (placed[n].kind === "Np" ? "who" : "what");
  const phrase = (from, to) => placed.slice(from, to + 1).map((t) => t.word.toLowerCase()).join(" ");
  // Each noun's phrase starts at its article or describing words.
  const phraseStart = (n) => { let s = n; while (s > 0 && ["A", "PPA", "Adj"].includes(roles[s - 1])) s -= 1; return s; };
  const steps = [];
  steps.push([`${cap(who(sn))} ${phrase(v, last)}?`, sn]);
  steps.push([`What is being said about ${bare(sn)}?`, v, "V"]);
  const verbWord = bare(v);
  const subj = cap(bare(sn));
  const doI = roles.indexOf("DO");
  const ioI = roles.indexOf("IO");
  if (doI >= 0) steps.push([`${subj} ${verbWord} ${placed[doI].kind === "Np" ? "whom" : "what"}?`, doI]);
  if (ioI >= 0) steps.push([`${subj} ${verbWord} ${phrase(phraseStart(doI), doI)} to ${placed[ioI].kind === "Np" ? "whom" : "what"}?`, ioI]);
  const prn = roles.indexOf("PrN");
  if (prn >= 0) steps.push([`${subj} ${verbWord} ${who(prn)}?`, prn]);
  const pa = roles.indexOf("PA");
  if (pa >= 0) steps.push([`${subj} ${verbWord} what?`, pa]);
  if (roles[v] !== "V") steps.push([null, v]);
  // The rest of the predicate, left to right: adverbs, prepositions and their objects.
  const modifiers = (noun) => {
    for (let m = noun - 1; m >= 0 && ["A", "PPA", "Adj"].includes(roles[m]); m -= 1) {
      if (roles[m] === "A") steps.push([null, m]);
      else if (roles[m] === "PPA") steps.push([`Whose ${bare(noun)}?`, m]);
      else steps.push([`${COUNT_WORDS.has(bare(m)) ? "How many" : "What kind of"} ${bare(noun)}?`, m]);
    }
  };
  roles.forEach((r, n) => {
    if (n <= v) return;
    if (r === "Adv") steps.push([`${cap(verbWord)} ${adverbQuestion(placed[n].word) || "how"}?`, n]);
    if (r === "P") {
      steps.push([null, n]);
      const op = roles.findIndex((x, m) => m > n && x === "OP");
      steps.push([`${cap(bare(n))} ${placed[op].kind === "Np" ? "whom" : "what"}?`, op]);
      modifiers(op);
    }
  });
  for (const n of [doI, ioI, prn].filter((x) => x >= 0).sort((a, b) => b - a)) modifiers(n);
  modifiers(sn);
  const level = Number(item.level);
  return {
    id: item.id, skill: "flow", level, type: "flow", kind: "D",
    tags: tagWords.map((w, n) => `${w}|${roles[n]}`).join(" "),
    steps, pattern: Number(item.pattern), hint: item.hint, noMarkup: false,
  };
}

/** The item's own example: tile words in order ("the sleepy puppy napped outside") → placed tiles. */
export function workshopExample(item) {
  const { tiles } = parseWorkshop(item);
  const pool = [...tiles];
  return item.example.trim().split(/\s+/).map((w) => {
    const at = pool.findIndex((t) => t.word === w);
    if (at < 0) throw new Error(`${item.id}: "${w}" in the example isn't a tile`);
    return REUSABLE_KINDS.has(pool[at].kind) ? pool[at] : pool.splice(at, 1)[0];
  });
}
