# Writing items

Write every sentence yourself. Don't copy sentences, examples, jingles or explanations from Shurley English books, other curricula, worksheets or websites; the game is a practice supplement with its own content.

`content.json` holds the Tip Cards (`tips`, one per skill and level, keyed like `commas-2`) and the items. Run `npm run validate:items` after any change; it checks that every item can be shown and answered.

Every item has `id`, `skill`, `level` (1–3), `type` and `hint` (shown after a first miss). Ids are permanent: progress is saved by id, so don't reuse or renumber them.

In every format, **the first choice is the right one**; the game shuffles choices.

| Type | Field | Example | Notes |
| --- | --- | --- | --- |
| `mark` | `text` | `We packed apples[,] grapes[,?] and crackers.` | Brackets hold the marks to place. `[,?]` is optional (right either way). Several marks in one space: `[,"]` (order matters). Punctuation outside brackets is given. `alts`: other complete answers, written the same way. `marks`: replace the default palette (from `src/config.js`). |
| `fix` | `text` | `[Mayas\|Maya's\|Mayas'] bike has a flat tire.` | Shown word, right word, then wrong choices. |
| `which` | `text` or `options` | `The team lost [its\|it's] first game.` or `"options": ["Right sentence.", "Wrong one."]` | A blank in a sentence, or whole sentences or short answers. `prompt` (optional) replaces the question shown, e.g. `"prompt": "What does unhappy mean?"` with `"options": ["not happy", "happy again"]`. |
| `sort` | `bins` | `{"Past": ["walked", "swam"], "Present": ["jumps", "eats"]}` | Two to four boxes, in the order shown, each with the words (or short sentences) that belong in it. Every tile appears once. `prompt` (optional) replaces the instruction. |
| `check` | `text`, `kind`, `fixes` | `"text": "Ran to the park.", "kind": "fragment", "fixes": ["My dog ran to the park.", "And ran to the park."]` | `kind` is `complete`, `fragment` or `runon` (run-on is only offered in level 3). No `fixes` for a complete sentence. |
| `join` | `first`, `second`, `words`, `result` | `"first": "It was hot.", "second": "We went swimming.", "words": ["so", "but", "or"], "result": "It was hot[,] so we went swimming."` | `result` is written like a `mark` item, with commas only; it may need no comma at all. |
| `combine` | `parts`, `answers`, `use` (optional) | `"parts": ["It was raining.", "We stayed inside."], "use": "so", "answers": ["It was raining, so we stayed inside."]` | Typed. List every right way to write it (both orders where both work); the first is shown after a second miss. `use` shows the joining word to use. The checker makes sure each answer is accepted and the parts as given aren't. |
| `flow` | `tags`, `steps`, `kind`, `pattern` | `"tags": "Sam\|SN kicked\|V-t the\|A ball.\|DO", "steps": [["Who kicked the ball?", 0], ["What is being said about Sam?", 1, "V"], ["Sam kicked what?", 3], [null, 1], [null, 2]], "kind": "D", "pattern": 2` | `tags`: each word with its final label. `steps`: the question order; `null` means "label this word"; a third value gives a label for that step only (the verb is V before it becomes V-t or LV). Every word must be labeled; the last step for a word must give its final label. `kind`: D, Int, E or Imp. `pattern` when the level asks for one (`FLOW_PATTERNS` in `src/config.js`). Labels must be taught by the item's skill and level (`FLOW_LABELS`). Compounds: the question's step labels the first part (`["Who sang?", 0, "CSN"]`), then `[null, …]` steps label the second part and the conjunction C; a player may answer with either part. |
| `labels` | `tiles` | `"tiles": "The\|A tiny\|Adj frog\|SN jumped\|V away.\|Adv"` | Words in the right order with their labels. The end mark is shown after the last space, not on a tile. The two parts of a compound may swap ("Jada and Sam", "bread and milk"), and two names may start the sentence either way; "I" stays last ("Leo and I"). Nothing else moves. |
| `proofread` | `text` | `Last weekend we [drive\|drove\|drives] to the lake.` | A paragraph; each mistake is written like a `fix` word: shown, right, other wrong choices. 2+ mistakes. |
| `build` | `tiles` | `My sister said\|,\|"I\|love\|this\|song."` | Pieces in the right order, separated by `\|`. Lone punctuation joins the word before it. `alts`: other right orders. |

Tense: keep a sentence's verbs in one time frame (all past, all present, or all future). Shifts are fine only where the grammar calls for them: a present-tense if/when part with a future result ("If it rains, we will stay inside"), and quoted words, which keep the speaker's own tense. Avoid verbs that look the same in past and present (read, lead), because read-aloud may say the wrong one.

Style: sentences under 15 words, about things students care about (pets, sports, games, science, weather; for grades 6–8, topics like school events, history, jobs and travel work well), a mix of names, no trick questions. Hints name the rule in one sentence.

Q&A Flow questions must be correct English too: *who* and *what* take a singular verb ("Who is swimming?", "Who calls me Bean?"); a command's subject question uses *should* ("Who should close the door?"); a question with *did* asks in the past tense ("What ate its dinner?", "Dog ate what?").

In Proofreading and Pip's homework, the **first** word in each bracket is the mistake shown on screen and the **second** is the fix: `[smiles|smiled|smiling]` shows "smiles" and fixes it to "smiled". Read each one back both ways before adding it: the shown word must be wrong in its sentence, and the fix right.

## Spelling Lake and word study

`spelling` (beside `items`) holds the Spelling Lake questions: `which` items with `skill` `"spelling"`, `level` 1 (grades 3–5) or 2 (grades 6–8), and `rule`, the id of the Rule Book spelling card they practice (`SPELLING_RULES` in `src/config.js`). The hint states that rule. The checker wants at least 24 per level.

Word Parts, Word Choice and Figurative Language items are ordinary `which` and `sort` items, usually with a `prompt` ("What does preheat mean?", "Which sentence uses a simile?"). For meaning questions, give three choices, the right one first, with wrong ones that use the other parts of the word ("heat again", "not heat"). The prefixes, suffixes and roots taught are listed in `WORD_PARTS` (`src/config.js`), which also feeds the Rule Book.
