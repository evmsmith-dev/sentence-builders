// What the noun table needs to know about the words labeled as nouns (SN, OP, DO, IO, PrN, OCN).
// A proper noun starts with a capital letter (Mia, Grandma used as a name); a common noun doesn't (my grandma).
// Every noun in a Q&A Flow sentence must be listed here as singular or plural; the item checker enforces it, so
// new sentences get a person's look before the game claims a noun is singular or plural.

/** Pronouns can fill a noun's job (DO, IO, OP) but aren't nouns: they're not circled or put in the noun table. */
export const PRONOUNS = new Set([
  "i", "me", "you", "(you)", "he", "him", "she", "her", "it", "we", "us", "they", "them",
  "myself", "yourself", "himself", "herself", "itself", "ourselves", "themselves",
]);

export const PLURAL_NOUNS = new Set([
  "children", "cookies", "crows", "geese", "girls", "hands", "judges", "kids", "kittens", "parents", "puppies",
  "runners", "scissors", "trees", "voters", "apples", "boys", "cats", "dogs", "players", "students", "birds",
  "people", "mice", "feet", "teeth", "men", "women", "ducks", "dishes", "friends", "flowers", "books", "games", "horses", "blocks", "trucks", "papers", "grapes", "snacks", "cousins", "helpers", "aunts", "fans", "teachers", "coaches", "cards", "photos", "pancakes", "captains", "carrots", "cheeks", "grandparents", "hikers", "fireworks", "partners", "sandwiches", "tomatoes", "nachos", "neighbors", "skaters", "tacos", "bleachers", "defenders", "coaches",
  "bees", "cows",
]);

export const SINGULAR_NOUNS = new Set([
  "ana", "ava", "bean", "biscuit", "dad", "grandma", "grandpa", "leo", "lincoln", "mia", "mom", "omar", "peanut", "sam",
  "aunt", "baby", "ball", "bear", "brother", "bus", "captain", "cat", "class", "coach", "couch", "crib", "desk",
  "dinner", "doctor", "dog", "door", "fence", "firefighter", "fort", "game", "gift", "hallway", "hamster", "hike",
  "homework", "kite", "lake", "lunch", "mammal", "mayor", "mouse", "movie", "museum", "music", "pie", "pool", "porch",
  "postcard", "president", "puppy", "rain", "room", "sister", "snow", "soup", "speech", "stick", "store", "story",
  "table", "teacher", "team", "trail", "train", "tree", "turn", "water", "whale", "winner", "yard", "jada", "max",
  "kai", "rosa", "ben", "lily", "maya", "home", "frog", "owl", "bed", "turtle", "car", "breeze", "picture", "chair",
  "floor", "book", "poem", "sunset", "sign", "pencil", "paper", "hug", "singer", "dancer", "package", "bat", "milk",
  "bread", "writer", "player", "hill", "bridge", "map", "pond", "family", "duluth", "saturday", "bird", "school",
  "shoe", "truck", "minneapolis", "uncle", "park", "breakfast", "river", "medal", "pizza", "wind", "birdhouse", "test",
  "maine", "stream", "neighbor", "pilot", "cookie",
  "june", "october", "bike", "blanket", "cake", "day", "drawing", "grass", "house", "ice", "mitten", "party", "principal",
  "roof", "squirrel", "time", "garden",
  "catcher", "concert", "crowd", "drone", "drummer", "field", "goalie", "lifeguard", "line", "locker", "mascot", "pass", "phone",
  "playlist", "quiz", "reminder", "ride", "robot", "slice", "ticket", "garage", "blizzard", "bolt", "laptop", "band", "static", "lab", "stage", "website",
  "apple", "artist", "baker", "bone", "box", "chef", "cousin", "dolphin", "friend", "girl", "hero", "kitten", "moon", "runner",
  "star", "meadow", "kitchen", "oven", "champion", "leader",
]);

const clean = (word) => word.replace(/[.?!,]+$/, "");

export const isPronoun = (word) => PRONOUNS.has(clean(word).toLowerCase());

/** Names are always proper nouns. Family words (Mom, Dad, Grandma) are proper only when used as a name, with a capital. */
const FAMILY = new Set(["mom", "dad", "grandma", "grandpa"]);
export const NAMES = new Set(["ana", "ava", "bean", "biscuit", "leo", "lincoln", "mia", "omar", "peanut", "sam", "jada", "max", "kai", "rosa", "ben", "lily", "maya"]);

/**
 * { number: "Singular" | "Plural" | null (not listed), kind: "Common" | "Proper" }. `index` is the word's place in
 * the sentence: the first word is capitalized anyway, so there a capital only counts for names.
 */
export function nounInfo(word, index = 1) {
  const w = clean(word);
  const key = w.toLowerCase();
  const number = PLURAL_NOUNS.has(key) ? "Plural" : SINGULAR_NOUNS.has(key) ? "Singular" : null;
  const capital = /^[A-Z]/.test(w);
  // A family word starting the sentence with nothing before it ("Grandma told us…") is being used as a name.
  const proper = NAMES.has(key) || (capital && (index > 0 || FAMILY.has(key)));
  return { number, kind: proper ? "Proper" : "Common" };
}
