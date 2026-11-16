// Shurley Skill Check ("Mark it up"): after the Q&A Flow, mark the sentence the way it's done on paper.
// Pure: works from the word labels, so every classified sentence can be marked without extra content.
//
// Shurley's steps after classifying: write the pattern (asked in the flow), put parentheses around each
// prepositional phrase, write the sentence type (asked in the flow), go back to the verb and divide the complete
// subject from the complete predicate with a slash, then underline the complete subject once and the complete
// predicate twice. "Predicate words in the complete subject" (a helping verb that starts a question, an adverb or
// a prepositional phrase at the front) are underlined twice. The noun check (circle the nouns) comes first here.

import { isPronoun } from "./nouns.js";

export const NOUN_LABELS = ["SN", "CSN", "OP", "COP", "DO", "CDO", "IO", "CIO", "PrN", "CPrN", "OCN"];
export const SUBJECT_LABELS = ["SN", "SP", "CSN", "CSP"];
export const VERB_LABELS = ["V", "V-t", "LV", "HV", "CV", "CV-t", "CLV"];

/**
 * Indexes of the words in prepositional phrases: from each P to its object (OP), or through the last part of a
 * compound object (to Mia and Leo).
 */
export function phraseIndexes(labels) {
  const out = [];
  labels.forEach((label, i) => {
    if (label !== "P") return;
    let end = labels.findIndex((l, j) => j > i && (l === "OP" || l === "COP"));
    if (end < 0) return;
    if (labels[end] === "COP") {
      for (let j = end + 1; j < labels.length && ["C", "COP", "A", "Adj", "PPA", "PNA"].includes(labels[j]); j++) if (labels[j] === "COP") end = j;
    }
    for (let j = i; j <= end; j++) out.push(j);
  });
  return out;
}

/**
 * Where the slash goes: directly before the verb (with its helping verb) that follows the subject. In a question
 * that starts with its verb ("Is the pool open?") there's no verb after the subject, so the slash goes right after
 * the complete subject. -1 when there's no subject.
 */
export function slashIndex(labels) {
  const lastSubject = labels.findLastIndex((l) => SUBJECT_LABELS.includes(l));
  if (lastSubject < 0) return -1;
  let verb = labels.findIndex((l, i) => i > lastSubject && VERB_LABELS.includes(l));
  if (verb < 0) return lastSubject < labels.length - 1 ? lastSubject + 1 : -1;
  // Step back over a helping verb right before the verb: "The children / are swimming."
  while (verb - 1 > lastSubject && labels[verb - 1] === "HV") verb -= 1;
  return verb;
}

/** Words before the slash that belong to the predicate: verbs (a helping or linking verb starting a question),
 *  adverbs that tell about the verb, and prepositional phrases before the subject. */
export function frontPredicate(labels) {
  const slash = slashIndex(labels);
  if (slash < 0) return [];
  const firstSubject = labels.findIndex((l) => SUBJECT_LABELS.includes(l));
  const front = new Set();
  labels.forEach((l, i) => {
    if (i >= slash) return;
    if (VERB_LABELS.includes(l)) front.add(i);
    if (l === "Adv" && labels[i + 1] !== "Adj") front.add(i); // "very" in "very tall man" belongs to the subject
  });
  for (const i of phraseIndexes(labels)) if (i < firstSubject) front.add(i);
  return [...front].sort((a, b) => a - b);
}

/**
 * The marking tasks for one sentence, in order.
 * mode "multi": tap every right word, then Done. mode "first": tap one word (tap another to move it), then Done.
 */
export function markupTasks(labels, words = []) {
  const pick = (list) => labels.map((l, i) => (list.includes(l) ? i : -1)).filter((i) => i >= 0);
  const tasks = [];
  // A pronoun can do a noun's job (Hike made us hungry: us is the DO) but isn't a noun.
  const nouns = pick(NOUN_LABELS).filter((i) => !words[i] || !isPronoun(words[i]));
  if (nouns.length) {
    const pronounSubject = labels.some((l, i) => l === "SP" || l === "CSP" || (NOUN_LABELS.includes(l) && words[i] && isPronoun(words[i])));
    tasks.push({ id: "circle", mark: "circle", mode: "multi", answer: nouns,
      prompt: pronounSubject ? "Noun check: circle every noun. Pronouns like (You), me and us aren't nouns." : "Noun check: circle every noun.",
      hint: `Nouns are the words labeled ${[...new Set(labels.filter((l) => NOUN_LABELS.includes(l)))].join(", ")}. Pronouns like he and we aren't circled.` });
  }
  const phrases = phraseIndexes(labels);
  if (phrases.length) {
    tasks.push({ id: "parens", mark: "paren", mode: "multi", answer: phrases,
      prompt: "Put parentheses around each prepositional phrase: tap every word in it.",
      hint: "A prepositional phrase starts with the preposition (P) and ends with its object (OP)." });
  }
  const slash = slashIndex(labels);
  if (slash >= 0) {
    const front = new Set(frontPredicate(labels));
    const all = labels.map((_, i) => i);
    // In a question that starts with its verb and has no verb after the subject ("Are the cookies / warm?"),
    // the slash goes right after the complete subject instead.
    const verbFirst = !VERB_LABELS.includes(labels[slash]);
    const word = (i) => (words[i] || "").replace(/[.?!,]+$/, "");
    // An interjection (Wow,) stands apart: it's in neither the subject nor the predicate.
    const inSentence = (i) => labels[i] !== "I";
    const subjectWords = labels.map((_, i) => i).filter((i) => i < slash && !front.has(i) && inSentence(i)).map(word).join(" ");
    tasks.push({ id: "slash", mark: "slash", mode: "first", answer: [slash],
      prompt: verbFirst
        ? "Divide the complete subject from the complete predicate with a slash."
        : "Go back to the verb: divide the complete subject from the complete predicate with a slash.",
      hint: verbFirst
        ? `This question starts with its verb${words.length ? `, ${word(labels.findIndex((l) => VERB_LABELS.includes(l)))}` : ""}, so the slash goes right after the complete subject${subjectWords.trim() ? `, ${subjectWords}` : ""}.`
        : "The slash goes right before the verb and its helping verb." });
    tasks.push({ id: "subject", mark: "u1", mode: "multi", answer: all.filter((i) => i < slash && !front.has(i) && inSentence(i)),
      prompt: "Underline the complete subject once.",
      hint: "The complete subject is the subject and the words that describe it: the words before the slash." });
    tasks.push({ id: "verb", mark: "u2", mode: "multi", answer: all.filter((i) => (i >= slash || front.has(i)) && inSentence(i)),
      prompt: front.size
        ? "Underline the complete predicate twice. This sentence has predicate words in the complete subject."
        : "Underline the complete predicate twice.",
      hint: front.size
        ? "The complete predicate is the verb and every word after the slash, plus the predicate words at the front: a helping verb, an adverb or a prepositional phrase."
        : "The complete predicate is the verb and every word after the slash." });
  }
  return tasks;
}

/** Is a set of tapped word indexes exactly the task's answer? */
export function checkMarkup(task, picked) {
  const want = [...task.answer].sort((a, b) => a - b);
  const got = [...new Set(picked)].sort((a, b) => a - b);
  return want.length === got.length && want.every((v, i) => v === got[i]);
}
