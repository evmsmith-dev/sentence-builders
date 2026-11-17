// Names in sentences: a player can give their own name, family and friends' names and a pet's name, and some
// practice sentences then use them in place of the game's own story names. Each story name is a he or a she
// (the sentences around it use his, her, himself…), so it is only swapped for a name of the same kind.

import { NAMES, PLURAL_NOUNS, PRONOUNS, SINGULAR_NOUNS } from "./nouns.js";

/** The game's story names, by the pronoun the sentences use for them. */
export const STORY_NAMES = {
  he: ["Leo", "Ben", "Omar", "Kai", "Sam", "Max"],
  she: ["Mia", "Ana", "Rosa", "Ava", "Lily", "Jada", "Maya"],
  pet: ["Biscuit", "Peanut"],
};

/** About half the sentences with a story name in them get one of the player's names. */
export const PERSONAL_SHARE = 0.5;
export const MAX_PEOPLE = 4;
export const NAME_MAX = 12;

const BLOCKED = new Set(["I", "A", "An", "The", "And", "But", "Or", "So", "Not"]);

/** A name as it goes into a sentence: letters (and a hyphen) only, first letter capital. "" if it can't be used. */
export function cleanName(raw) {
  const name = String(raw || "").trim();
  if (!/^[A-Za-z][A-Za-z-]{0,11}$/.test(name) || /-$/.test(name)) return "";
  const out = name[0].toUpperCase() + name.slice(1);
  const key = out.toLowerCase();
  // A name that is also a word the game labels (bear, it…) would confuse the noun table.
  if (BLOCKED.has(out) || PRONOUNS.has(key) || (!NAMES.has(key) && (SINGULAR_NOUNS.has(key) || PLURAL_NOUNS.has(key)))) return "";
  return out;
}

/** The player's names to use, or null when the setting is off or there are none. { he: [], she: [], pet: [] } */
export function namesFor(player) {
  const set = player?.settings?.names;
  if (!set?.on) return null;
  const out = { he: [], she: [], pet: [] };
  for (const person of set.people || []) {
    const name = cleanName(person?.name);
    if (name && (person.pronoun === "he" || person.pronoun === "she") && !out[person.pronoun].includes(name)) out[person.pronoun].push(name);
  }
  const pet = cleanName(set.pet);
  if (pet) out.pet.push(pet);
  return out.he.length || out.she.length || out.pet.length ? out : null;
}

/** The noun table and capital-letter checks need to know a player's names are names. */
export function registerNames(names) {
  for (const name of [...names.he, ...names.she, ...names.pet]) {
    const key = name.toLowerCase();
    NAMES.add(key);
    if (!PLURAL_NOUNS.has(key)) SINGULAR_NOUNS.add(key);
  }
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The name as a whole word, also with 's, s or s' after it (Maya's, Mayas'), in any of its three spellings. */
const formsOf = (name) => [name, name.toLowerCase(), name.toUpperCase()];
const nameRegex = (form) => new RegExp(`\\b${escape(form)}(?=(?:s'|'s|s|')?(?![A-Za-z]))`, "g");
const suffixRegex = (name) => new RegExp(`\\b${escape(name)}(?:s'|'s|s|')`, "i");

function mapStrings(value, fn, key = "") {
  if (typeof value === "string") return ["id", "skill", "type", "band"].includes(key) ? value : fn(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn, k)]));
  return value;
}

function shuffled(list, rand) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The item with some of its story names swapped for the player's names (or the item itself). Every string in
 * the item is changed the same way, so the answer, the labels and the hint still agree. A name already in the
 * sentence isn't used again, and a person's name never replaces a pet's ("a puppy named Max").
 */
export function personalize(item, names, { rand = Math.random, share = PERSONAL_SHARE } = {}) {
  if (!names) return item;
  const text = JSON.stringify(mapStrings(item, (s) => s));
  // Names only in the hint (a shared example like "Leo and Mia like pizza") don't count as the sentence's own.
  const { hint, ...rest } = item;
  const main = JSON.stringify(rest);
  const inText = (name, where) => formsOf(name).some((form) => nameRegex(form).test(where));
  const present = (name) => inText(name, text);
  const swaps = [];
  for (const kind of ["he", "she", "pet"]) {
    const found = STORY_NAMES[kind].filter((name) => inText(name, main) && (kind === "pet" || !new RegExp(`named \\[?${name}\\b`, "i").test(text)));
    const mine = shuffled(names[kind].filter((name) => !present(name)), rand);
    found.forEach((story, i) => {
      const own = mine[i];
      // Maya's → James's is fine, but Mayas' → Jamess' isn't: names ending in s skip sentences that add to the name.
      if (own && !(own.endsWith("s") && suffixRegex(story).test(text))) swaps.push([story, own]);
    });
  }
  if (!swaps.length || rand() >= share) return item;
  return mapStrings(item, (s) => swaps.reduce((out, [story, own]) =>
    formsOf(story).reduce((acc, form, k) => acc.replace(nameRegex(form), formsOf(own)[k]), out), s));
}
