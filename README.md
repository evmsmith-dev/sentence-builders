# Sentence Builders

A grammar and punctuation game for grades 3–8 that installs as an app on phones, tablets and computers (PWA) and works offline. Players fix and build sentences; each level they pass puts up a building in their town, and badges reward mastery and steady practice. Skills follow the 2020 Minnesota K–12 ELA standards.

Five worlds are playable: **Punctuation Port**, **Word Works**, **Sentence Studio**, **Flow Factory** (Shurley-style Q&A Flow) and, for grades 6–8, **Revision Ridge**.

| Skill | Level 1 | Level 2 | Level 3 |
| --- | --- | --- | --- |
| Commas and colons | Commas in a list (gr 3) | Commas with clauses (gr 4) | Yes/no, names, tag questions, colons (gr 5) |
| Dialogue | Speaker first (gr 4) | Speaker last (gr 4) | Split quotations (gr 5) |
| Apostrophes | One owner, contractions (gr 3) | Plural owners (gr 4) | its/it's and other sound-alikes (gr 5) |

| Skill | Level 1 | Level 2 | Level 3 |
| --- | --- | --- | --- |
| Verb tenses | Past tense, irregular verbs (gr 3) | was/is/will be + -ing (gr 4) | Keep the tense steady (gr 5) |
| Agreement | Subject and verb (gr 4) | In compound and complex sentences (gr 4) | Tricky subjects: of-phrases, each, everyone, there is/are (gr 5) |
| Pronouns | Reflexive pronouns (gr 3) | Pronouns that match (gr 4) | who, which, that, whose, where, when (gr 5) |

| Skill | Level 1 | Level 2 | Level 3 |
| --- | --- | --- | --- |
| Fragments and run-ons | Complete sentence or fragment (gr 3) | Fragments that start with because, when, if (gr 4) | Run-ons and comma splices (gr 5) |
| Compound sentences | and, but, so with a comma (gr 3) | The best joining word, including or and yet (gr 4) | Semicolons (gr 5) |
| Complex sentences | because, when, if, after, before (gr 4) | although, until, while, since (gr 4) | The comma: front or end (gr 5) |

| Skill | Level 1 | Level 2 | Level 3 |
| --- | --- | --- | --- |
| Q&A Flow | SN, SP, V, A, Adj, Adv; sentence kinds | adds P, OP, PPA, PNA, HV | adds V-t, DO, IO, LV, PrN, PA; patterns 1–5 |
| Advanced Q&A Flow (grade 6+) | Questions and commands with the understood (You), patterns 1–5 (gr 6) | Patterns 6 and 7: OCN, OCA (gr 7) | All seven patterns mixed (gr 8) |

Flow Factory levels are 5 items: 3 Q&A Flows, then 2 Build-from-labels sentences, which must be right for Gold. In a flow, players answer one question at a time (tap the word, then pick its label), and a **📘 Labels** button opens a reminder of every label at that level (name, meaning, how to find it) at no cost; a miss gives a hint for that step, and a second miss shows that step and moves on. Labels and question order follow Shurley English Levels 3–8 as commonly taught; the sentences are original. Advanced Q&A Flow only appears for players in grade 6 or higher.

### Revision Ridge (grades 6–8)

Opens for players in grade 6 or higher. Minnesota's grade 6–8 benchmarks (6.2.1.1, 7.2.1.1, 8.2.1.1) ask for correct punctuation, capitalization and grammar in edited writing, so the skills follow the usual middle-school sequence.

| Skill | Level 1 (gr 6) | Level 2 (gr 7) | Level 3 (gr 8) |
| --- | --- | --- | --- |
| Pronoun case and clarity | I or me; we or us | Clear pronouns, no shifts to you | who or whom |
| Proofreading | Paragraphs with 2 mistakes | 3 mistakes | 4 mistakes |

Proofreading levels are 5 paragraphs: tap a mistake, pick the fix. Still to come: dashes, hyphens and commas around extra information; compound-complex sentences; modifiers and voice.

## How it plays

- Up to 4 players per device, each with a name, avatar and grade. Levels at or below a player's grade start unlocked, so an older child can review anything.
- A level opens with a Tip Card (the rule and an example, with read-aloud), then 8 items: 6 on the skill and 2 review items from levels already passed (Flow Factory: 5 items, see above).
- Ten kinds of items: **Mark it** (tap a space, add the marks; where commas are the only choice, a tap adds or removes one), **Fix it** (find the wrong word and fix it), **Which is right?**, **Build it** (put the pieces in order) **Sort it** (tap a word, then the box it belongs in), **Sentence check** (complete, fragment or run-on, then the best fix) **Join it** (pick the joining word, then decide if a comma goes in), **Q&A Flow**, **Build from labels** and **Proofread**.
- A first miss shows a hint and allows a second try; a second miss shows the answer, and the item comes back later.
- Points: 1 for right on the first try, ½ on the second. Stars at 6, 7 and 8 points out of 8 (scaled for shorter levels); under 6 means "build it again", and nothing is lost.
- Gold on a skill: 7 or more on its level 3 on two different days. That raises a gold flag on its top building.
- Badges: one per skill (Bronze, Silver, Gold), one per world (Port Champion, Works Wizard, Studio Star, Chief Editor), First Brick, Builder's Week and Fix-It Pro.
- Settings per player: read every sentence aloud, Pip's comments, sounds, grade.
- **Looking back:** the results screen lists the round's mistakes ("Look again"), each written correctly with its rule, and a **Review the rule** button reopens that level's Tip Card and returns to the results. The **Rule Book** (home screen chip, or the 📘 button on a world) has a tab per world plus **Word lists** (articles, prepositions, helping and linking verbs, pronouns, joining words). The tabs wrap and stay pinned at the top; each skill folds to one line until tapped, then shows its unlocked rules with examples and read-aloud (plus labels and patterns in Flow Factory). Locked rules show only their title.
- **Back button:** the phone's Back gesture (or the browser's Back) closes the popup on top or steps back one screen, as in Bible Trivia and World Geography. Mid-round it asks before leaving; on the results it goes to the town; at the town it leaves the app.
- **📊 Progress** (on the home screen and on Who's playing?, open to everyone): per player, the current player first, minutes and days played this week, stars and badge for every skill and the sentences missed most.
- **Settings** (⚙️): read aloud, comments and greeting, sounds, look, and a break reminder (off, 15, 20, 30 or 45 minutes) for the current player, plus saving and restoring a backup file of every player on the device, and ℹ️ About this game (also on Who's playing?): how to play, the Minnesota standards and Shurley English basis, and privacy. Switch players by tapping your name; edit a player with ✏️ on their card.
- Everything is saved on the device (localStorage). No accounts, ads, tracking or network calls.

## Project layout

```
index.html            the screens
data/content.json     Tip Cards and items (see data/README.md for the item formats)
src/
  config.js           worlds, skills, levels, scoring, palettes, badges, Pip's lines
  main.js             startup and screens
  lib/                pure, unit-tested logic: parsing and checking items, choosing items, progress and badges
  ui/                 item types, town and Pip drawings, read-aloud and sounds, update banner
  storage.js          saving on the device
scripts/              build, local server, item validator
tests/unit, tests/e2e unit tests and browser tests (desktop, phone and tablet sizes)
```

## Development

```sh
npm install
npm start               # play the source at http://localhost:8080
npm test                # check the items, unit tests, then build and run the browser tests
npm run preview         # build and serve dist/ at http://localhost:8080
```

To run the browser tests with an installed Chrome instead of Playwright's download, set `CHROME_PATH` (for example `CHROME_PATH=/usr/bin/google-chrome npm test`).

Pushes to `main` are tested and deployed to GitHub Pages by `.github/workflows/deploy.yml`. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The site is then at `https://evmsmith-dev.github.io/sentence-builders/`.

The Fredoka font (SIL Open Font License) and canvas-confetti (ISC) are stored in `vendor/` so the game works offline.

## Revision Ridge (grades 6–8)

Pronoun case, Proofreading, Dashes, hyphens and extra information (hyphens and dashes, commas around extra information, dashes/parentheses/ellipses), Sentence types (simple/compound/complex, compound-complex, combining for variety) and Modifiers and voice (commas between adjectives, misplaced and dangling modifiers, active/passive voice and moods). Mark it supports `-`, `—`, `…`, `(` and `)`; hyphens and dashes join words with no spaces (write `twenty[-]one`).

Content: about 20 sentences per level, 12 Q&A Flows per Flow Factory level, 10 paragraphs per Proofreading level (840 items).

## Mark it up and Sentence Diagramming

After every Q&A Flow, **Mark it up** walks through the Shurley Skill Check on the same sentence: circle the nouns (noun check), put parentheses around each prepositional phrase, go back to the verb and divide the complete subject from the complete predicate with a slash (directly before the verb and its helping verb), then underline the complete subject once and the complete predicate twice. Predicate words in the complete subject (a helping or linking verb that starts a question, an adverb, or a prepositional phrase at the front) are underlined twice. On the first Q&A Flow sentence of each level (grade 4+), Shurley's **noun table** follows: for each noun, its job (SN, OP, DO…), singular or plural, and common or proper, then the simple subject and simple predicate. Pronouns doing a noun's job (me, us) aren't circled or listed. Each question shows a one-line reminder until the player has 12 right on the first try; 📘 Nouns (in the step) and a Kinds of nouns card in the Rule Book (Flow Factory and Word lists) explain common/proper and singular/plural. Word-ending cards (`SPELLING_RULES`: past tense -ed, irregular past tense verbs, plurals, future tense with will, -s and -ing) fold in the Rule Book's Word Works and Word lists tabs. Singular/plural comes from the reviewed noun list in `src/lib/nouns.js`; the item checker stops any new sentence whose nouns aren't on it. The flow itself asks for the sentence type (D, E, Int, Imp) and the pattern (SN V P1, …; levels 1–2 ask Pattern 1 or 2). The marks come from the word labels (`src/lib/markup.js`), so no extra content is needed.

**Sentence Diagramming** (Flow Factory, grade 5+, levels for grades 5/6/7, 5 sentences a level) starts with the same mark-up, then the player places each word on a Reed-Kellogg diagram drawn from the labels (`src/lib/diagram.js`): subject | verb on the baseline, direct objects behind a short line, predicate words and object complements behind a leaning line, describing words on slanted lines, prepositional phrases and indirect objects hanging below. The first diagram of each level is guided (one line at a time, with why the word goes there); **Walk me through it** replays that on any diagram (half credit), and every finished diagram lists why each word goes where it does. A word like *very* that describes a describing word hangs on its own slanted line joined to that word's line (an adverb before another adverb only does this for intensifiers like very and really; `attach` in an item overrides the guess). Compound subjects and verbs (Shurley labels CSN, CSP, CV and C, taught in Advanced Q&A Flow level 3 and Diagramming level 3) fork into two branches with the conjunction on a dashed line. Not yet diagrammed: three or more compound parts, and a compound verb with a direct object.

## Looks

Grades 6+ get the calmer **Studio** look by default (system font, slate and indigo, flatter cards, no cartoon helper); Settings → Look switches between Automatic, Bright and Studio for any player. To change a player's name, avatar or grade, tap ✏️ on their card in Who's playing?; changes save on Save, and Delete player is there too. 50 avatars in two groups (grade 6+ see Sports, music and more first).

## Bricks, Pip's homework and celebrations

- **Grammar Island** (`townSvg` in `src/ui/art.js`, pan and zoom in `src/ui/townmap.js`): the home screen's map. Each world is a region with its own ground, around the Town Square and Grammar Peaks, joined by roads that run from the Town Square to where each area's path begins. It works like the World Geography map: drag to pan, pinch or ctrl+wheel to zoom, and + − ⤢. The first tap on a region zooms in to it (taps that move more than 8px are drags). Each area is a raised plateau with one winding path, two skills to a row, with a numbered spot for each level; passing a level builds on its spot in that area's style (striped cottages and a lighthouse at the port, smoking workshops at Word Works, domed theaters at the Studio, silo factories at Flow Factory, columned libraries with a clock tower at Revision Ridge), and Gold on a skill raises a gold flag. Pip waits on each path by the next level to play. Tapping a spot opens that skill's level card. Under the map: the regions to jump to, or (zoomed in) that region's skills, **🧱 Decorate here** and All levels here. A region whose world isn't open yet (Revision Ridge before grade 6) shows locked and says when it opens. The **Next up** greeting and the Worlds list stay as quick, accessible ways in. After a level, the map opens on the region where the new building rises.
- **Bricks** (`BRICKS` in `src/config.js`): 2 per sentence right on the first try, 1 on the second, 3 per star, 10 the first time a level is passed. The **Build on the island** card on the home screen (under Pip's homework) shows the bricks and what they can build, and opens the Build screen, with a tab for each region (`DISTRICTS`). Each region can have 21 everyday decorations plus 7 of its own (`DECOR` items with an `area`: anchors and seals at the port, gears and a crane at Word Works, a piano and circus tent at the Studio, crates and a rocket at Flow Factory, books and a library at Revision Ridge), as many of each as they like. A new one appears at its usual spot, selected; kids drag any decoration anywhere in the close-up (sky, park or water) at any time, by mouse, finger or arrow keys, and tap one to put it away for a full refund. Saved as `{ uid, id, area, x, y }` in the close-up's units (`SCENE`); decorations from before the map are in the Town Square, where they were. Bricks only buy decorations.
- **📝 Pip's homework** (the card on the home screen): three of Pip's paragraphs to proofread (`homework` in `data/content.json`, 12 for grades 3–5 and 10 for grades 6–8), unseen ones first. Pip gets a grade (A+ when all three are right on the first try) and the player earns 6 bricks a paragraph (3 on the second try). It doesn't count toward levels or badges.
- **Celebrations:** confetti grows with the stars, results stars pop in one at a time, the building just earned rises in the town, buttons give under a tap, and phones buzz on a passed level. All motion is skipped when the device asks for reduced motion.

**Capital letters** (Punctuation Port, grades 3/4/5): first word, I, names, days, months and holidays (seasons lowercase); places, titles before names, Mom as a name vs. my mom; directions vs. regions (drove north / the North Shore), languages, titles and school subjects. A region wraps more than three skills onto another street.

## App icon

`icons/icon.svg` is the source: Grammar Island with a crane lifting an "Aa" block onto a building, and Pip in his hard hat, kept inside the center circle so it survives round masks. Make the PNGs with `rsvg-convert -w 512 -h 512 icons/icon.svg -o icons/icon-512.png` (and 192, 96, and 180 for `apple-touch-icon.png`).
