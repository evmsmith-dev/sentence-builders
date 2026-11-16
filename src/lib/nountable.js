// Shurley's noun table, filled in after the mark-up on one sentence a level (grades 4+): for each noun, its job,
// singular or plural, and common or proper; then the simple subject and simple predicate.
// Pure: built from the word labels and the noun list in nouns.js.

import { LABELS } from "../config.js";
import { NOUN_LABELS, SUBJECT_LABELS, VERB_LABELS } from "./markup.js";
import { isPronoun, nounInfo } from "./nouns.js";

const clean = (word) => word.replace(/[.?!,]+$/, "");
const jobName = (label) => `${label} · ${LABELS[label].name}`;

/**
 * The questions, in order. Each: { id, noun (word index, for noun rows), column, prompt, choices, answer, hint }.
 * `jobs` is the set of noun labels taught at this level (for wrong job choices). Returns [] if the sentence has a
 * noun the noun list doesn't know yet.
 */
export function nounTableQuestions(labels, words, jobs = NOUN_LABELS) {
  const questions = [];
  const nouns = labels.map((l, i) => i).filter((i) => NOUN_LABELS.includes(labels[i]) && !isPronoun(words[i]));
  for (const i of nouns) {
    const w = clean(words[i]);
    const info = nounInfo(words[i], i);
    if (!info.number) return [];
    const label = labels[i];
    const others = jobs.filter((j) => j !== label && NOUN_LABELS.includes(j) && j !== "CSN").slice(0, 3);
    questions.push({
      id: `job-${i}`, noun: i, column: "job", prompt: `What job does ${w} do?`,
      choices: [label, ...others].map(jobName), answer: jobName(label),
      hint: `Look at the label above ${w}: ${label} means ${LABELS[label].name}.`,
    });
    questions.push({
      id: `number-${i}`, noun: i, column: "number", prompt: `Is ${w} singular or plural?`,
      choices: ["Singular", "Plural"], answer: info.number,
      hint: "Singular means one; plural means more than one.",
    });
    questions.push({
      id: `kind-${i}`, noun: i, column: "kind", prompt: `Is ${w} a common or a proper noun?`,
      choices: ["Common", "Proper"], answer: info.kind,
      hint: "A proper noun names one particular person, pet, place or thing and starts with a capital letter. A common noun doesn't.",
    });
  }
  if (!nouns.length) return [];
  const subject = labels.map((l, i) => i).filter((i) => SUBJECT_LABELS.includes(labels[i])).map((i) => clean(words[i])).join(", ");
  const verb = labels.map((l, i) => i).filter((i) => VERB_LABELS.includes(labels[i])).map((i) => clean(words[i])).join(" ");
  // Wrong choices: describing words and other nouns, which children most often mix up with the simple parts.
  const firstVerb = labels.findIndex((l) => VERB_LABELS.includes(l));
  const pickOthers = (avoid, n, afterVerbFirst = false) => {
    const skip = new Set(avoid.split(/[ ,]+/));
    let order = labels.map((l, i) => i).filter((i) => !["A", "P", "C", "HV"].includes(labels[i]));
    if (afterVerbFirst) order = [...order.filter((i) => i > firstVerb), ...order.filter((i) => i <= firstVerb)];
    const content = order.map((i) => clean(words[i]));
    return [...new Set(content.filter((w) => w && !skip.has(w)))].slice(0, n);
  };
  questions.push({
    id: "simple-subject", column: "subject", prompt: "What is the simple subject?",
    choices: [subject, ...pickOthers(subject, 2)], answer: subject,
    hint: "The simple subject is the subject noun or pronoun itself, without the words that describe it.",
  });
  questions.push({
    id: "simple-predicate", column: "predicate", prompt: "What is the simple predicate?",
    choices: [verb, ...pickOthers(verb, 2, true)], answer: verb,
    hint: "The simple predicate is the verb, with any helping verb.",
  });
  return questions;
}
