// Shurley Skill Check ("Mark it up"): after the Q&A Flow, mark the sentence the way it's done on paper.
// Pure: works from the word labels, so every classified sentence can be marked without extra content.

export const NOUN_LABELS = ["SN", "OP", "DO", "IO", "PrN", "OCN"];
export const SUBJECT_LABELS = ["SN", "SP"];
export const VERB_LABELS = ["V", "V-t", "LV", "HV"];

/** Indexes of the words in prepositional phrases: from each P to its object (OP). */
export function phraseIndexes(labels) {
  const out = [];
  labels.forEach((label, i) => {
    if (label !== "P") return;
    const end = labels.findIndex((l, j) => j > i && l === "OP");
    if (end < 0) return;
    for (let j = i; j <= end; j++) out.push(j);
  });
  return out;
}

/** The index of the first word of the complete predicate (where the slash goes), or -1 when it doesn't apply. */
export function predicateStart(labels, kind) {
  if (kind === "Int") return -1; // in a question the verb comes before the subject
  const subject = labels.findIndex((l) => SUBJECT_LABELS.includes(l));
  return subject >= 0 && subject < labels.length - 1 ? subject + 1 : -1;
}

/**
 * The marking tasks for one sentence, in Shurley order.
 * mode "multi": tap every right word, then Done. mode "first": tap one word.
 */
export function markupTasks(labels, kind) {
  const pick = (list) => labels.map((l, i) => (list.includes(l) ? i : -1)).filter((i) => i >= 0);
  const tasks = [];
  const nouns = pick(NOUN_LABELS);
  if (nouns.length) {
    tasks.push({ id: "circle", mark: "circle", mode: "multi", answer: nouns,
      prompt: "Noun check: circle every noun.",
      hint: "Nouns are the words labeled SN, OP, DO, IO, PrN or OCN. Pronouns like he and we aren't circled." });
  }
  const phrases = phraseIndexes(labels);
  if (phrases.length) {
    tasks.push({ id: "parens", mark: "paren", mode: "multi", answer: phrases,
      prompt: "Put parentheses around each prepositional phrase: tap every word in it.",
      hint: "A prepositional phrase starts with the preposition (P) and ends with its object (OP)." });
  }
  const slash = predicateStart(labels, kind);
  if (slash >= 0) {
    tasks.push({ id: "slash", mark: "slash", mode: "first", answer: [slash],
      prompt: "Draw the slash: tap the first word of the complete predicate.",
      hint: "The complete subject is the subject and the words describing it. The predicate starts right after it." });
  }
  tasks.push({ id: "subject", mark: "u1", mode: "multi", answer: pick(SUBJECT_LABELS),
    prompt: "Underline the simple subject once.",
    hint: "The simple subject is the SN or SP: the word that answers who or what." });
  tasks.push({ id: "verb", mark: "u2", mode: "multi", answer: pick(VERB_LABELS),
    prompt: "Underline the verb twice. Include any helping verb.",
    hint: "The verb is labeled V, V-t or LV. A helping verb (HV) gets underlined too." });
  return tasks;
}

/** Is a set of tapped word indexes exactly the task's answer? */
export function checkMarkup(task, picked) {
  const want = [...task.answer].sort((a, b) => a - b);
  const got = [...new Set(picked)].sort((a, b) => a - b);
  return want.length === got.length && want.every((v, i) => v === got[i]);
}
