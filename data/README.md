# Writing items

`content.json` holds the Tip Cards (`tips`, one per skill and level, keyed like `commas-2`) and the items. Run `npm run validate:items` after any change; it checks that every item can be shown and answered.

Every item has `id`, `skill`, `level` (1–3), `type` and `hint` (shown after a first miss). Ids are permanent: progress is saved by id, so don't reuse or renumber them.

In every format, **the first choice is the right one**; the game shuffles choices.

| Type | Field | Example | Notes |
| --- | --- | --- | --- |
| `mark` | `text` | `We packed apples[,] grapes[,?] and crackers.` | Brackets hold the marks to place. `[,?]` is optional (right either way). Several marks in one space: `[,"]` (order matters). Punctuation outside brackets is given. `alts`: other complete answers, written the same way. `marks`: replace the default palette (from `src/config.js`). |
| `fix` | `text` | `[Mayas\|Maya's\|Mayas'] bike has a flat tire.` | Shown word, right word, then wrong choices. |
| `which` | `text` or `options` | `The team lost [its\|it's] first game.` or `"options": ["Right sentence.", "Wrong one."]` | A blank in a sentence, or whole sentences. |
| `sort` | `bins` | `{"Past": ["walked", "swam"], "Present": ["jumps", "eats"]}` | Two or three boxes, in the order shown, each with the words that belong in it. Every word appears once. |
| `check` | `text`, `kind`, `fixes` | `"text": "Ran to the park.", "kind": "fragment", "fixes": ["My dog ran to the park.", "And ran to the park."]` | `kind` is `complete`, `fragment` or `runon` (run-on is only offered in level 3). No `fixes` for a complete sentence. |
| `join` | `first`, `second`, `words`, `result` | `"first": "It was hot.", "second": "We went swimming.", "words": ["so", "but", "or"], "result": "It was hot[,] so we went swimming."` | `result` is written like a `mark` item, with commas only; it may need no comma at all. |
| `build` | `tiles` | `My sister said\|,\|"I\|love\|this\|song."` | Pieces in the right order, separated by `\|`. Lone punctuation joins the word before it. `alts`: other right orders. |

Tense: keep a sentence's verbs in one time frame (all past, all present, or all future). Shifts are fine only where the grammar calls for them: a present-tense if/when part with a future result ("If it rains, we will stay inside"), and quoted words, which keep the speaker's own tense. Avoid verbs that look the same in past and present (read, lead), because read-aloud may say the wrong one.

Style: sentences under 15 words, about things kids care about (pets, sports, games, science, weather), a mix of names, no trick questions. Hints name the rule in one sentence.
