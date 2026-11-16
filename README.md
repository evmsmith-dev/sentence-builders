# Sentence Builders

A grammar and punctuation game for grades 3–8 that installs as an app on phones, tablets and computers (PWA) and works offline. Players fix and build sentences; each level they pass puts up a building on Grammar Island, and badges reward mastery and steady practice. Skills follow the 2020 Minnesota K–12 ELA standards.

Five places on **Grammar Island** hold the skills, as worlds: **Punctuation Port**, **Word Works**, **Sentence Studio**, **Flow Factory** (Shurley-style Q&A Flow) and, for grades 6–8, **Revision Ridge**. The tables list each level's Tip Card and grade; they're built from `SKILLS` in `src/config.js` and the Tip Cards in `data/content.json`.

### ⚓ Punctuation Port

Commas, colons, quotation marks and apostrophes.

| Skill | Level 1 | Level 2 | Level 3 |
| --- | --- | --- | --- |
| Commas and colons | Commas in a list (gr 3) | Commas with clauses (gr 4) | Commas and colons (gr 5) |
| Dialogue | Quotation marks (gr 4) | Speaker at the end (gr 4) | Split quotations (gr 5) |
| Apostrophes | Owners and contractions (gr 3) | More than one owner (gr 4) | Sound-alike words (gr 5) |
| Capital letters | Capital letters: names, days and months (gr 3) | Capital letters: places, family names and titles (gr 4) | Capital letters: directions, regions, titles and languages (gr 5) |

### ⚙️ Word Works

Verb tenses, agreement, pronouns, word parts and word choice.

| Skill | Level 1 | Level 2 | Level 3 |
| --- | --- | --- | --- |
| Verb tenses | Past tense verbs (gr 3) | Verbs that keep going (gr 4) | Keep the tense steady (gr 5) |
| Agreement | Subjects and verbs match (gr 4) | Match in longer sentences (gr 4) | Tricky subjects (gr 5) |
| Pronouns | Reflexive pronouns (gr 3) | Pronouns that match (gr 4) | Who, which, that, where, when (gr 5) |
| Word Parts | Prefixes and suffixes (gr 3) | Latin roots (gr 5) | Greek roots (gr 6) |
| Word Choice | Formal and informal (gr 4) | Shades of meaning (gr 5) | Denotation, connotation and precise words (gr 6) |

### 🎨 Sentence Studio

Fragments, run-ons, compound and complex sentences, figurative language and revising.

| Skill | Level 1 | Level 2 | Level 3 |
| --- | --- | --- | --- |
| Fragments and run-ons | Complete sentences (gr 3) | Fixing fragments (gr 4) | Run-ons (gr 5) |
| Compound sentences | Joining with and, but, so (gr 3) | Pick the best joining word (gr 4) | Semicolons (gr 5) |
| Complex sentences | Joining with because, when, if (gr 4) | More joining words (gr 4) | Commas in complex sentences (gr 5) |
| Figurative Language | Literal or figurative? Similes (gr 3) | Metaphors and idioms (gr 4) | Personification and hyperbole (gr 5) |
| Revising Sentences | Synonyms and antonyms (gr 3) | Revise with a new word (gr 4) | Add detail or cut extra words (gr 5) |

### 🏭 Flow Factory

Label every word with the Q&A Flow and the parts of speech, then mark it up (and diagram it, from grade 5).

| Skill | Level 1 | Level 2 | Level 3 |
| --- | --- | --- | --- |
| Q&A Flow | The Q&A Flow (gr 3) | Prepositions and possessives (gr 4) | Objects and patterns (gr 5) |
| Compound Q&A Flow | Compound subjects, verbs and objects (gr 3) | Compound direct objects (gr 4) | Every compound part (gr 5) |
| Parts of Speech | Nouns, verbs, adjectives and adverbs (gr 3) | All eight parts of speech (gr 4) | Same word, different job (gr 5) |
| Advanced Q&A Flow (grade 6+) | Questions and commands (gr 6) | Object complements (gr 7) | All seven patterns (gr 8) |
| Sentence Diagramming (grade 5+) | Diagram the subject and verb (gr 5) | Diagram phrases and complements (gr 6) | Indirect objects, compounds, object complements, questions and commands (gr 7) |

### 📝 Revision Ridge (grades 6–8)

Grades 6–8: pronouns, punctuation, sentence types, modifiers and proofreading.

| Skill | Level 1 | Level 2 | Level 3 |
| --- | --- | --- | --- |
| Pronoun case and clarity | I or me? (gr 6) | Clear pronouns (gr 7) | Who or whom? (gr 8) |
| Proofreading | Proofreading (gr 6) | Proofreading: 3 mistakes (gr 7) | Proofreading: 4 mistakes (gr 8) |
| Dashes, hyphens and extra information | Hyphens and dashes (gr 6) | Commas around extra information (parentheticals) (gr 7) | Dashes, parentheses and ellipses (gr 8) |
| Sentence types | Simple, compound, complex (gr 6) | Compound-complex sentences (gr 7) | Sentence variety (gr 8) |
| Modifiers and voice | Commas between adjectives (gr 6) | Misplaced and dangling modifiers (gr 7) | Active voice, passive voice and moods (gr 8) |

Flow Factory levels are 5 items: 3 Q&A Flows, then 2 Build-from-labels sentences, which must be right for Gold. In a flow, players answer one question at a time (tap the word, then pick its label), and a **📘 Labels** button opens a reminder of every label at that level (name, meaning, how to find it) at no cost; a miss gives a hint for that step, and a second miss shows that step and moves on. Labels and question order follow Shurley English Levels 3–8 as commonly taught; the sentences are original. Advanced Q&A Flow only appears for players in grade 6 or higher. Grades 3–5 Q&A Flow levels include commands with the understood subject (You), questions, sentences with not (an adverb) and inverted word order (Down the hill rolled the ball): in an inverted sentence the subject comes last, so its mark-up is the noun check and parentheses, without a slash. **Parts of Speech** (grades 3–5) asks the test-style question (what part of speech is this word here?): nouns, verbs, adjectives and adverbs; then all eight; then the same word doing different jobs. **Compound Q&A Flow** (grades 3–5) teaches Shurley's compound parts by grade, following Shurley's Level 3–5 label lists: level 1 compound subjects (CSN, CSP), verbs (CV), objects of the preposition (COP), the conjunction (C) and interjections (I); level 2 adds compound direct objects (CDO) and transitive verbs (CV-t); level 3 adds compound indirect objects (CIO), predicate nouns (CPrN), predicate adjectives (CPA), linking verbs (CLV), adjectives (CAdj), adverbs (CAdv) and predicate pronouns (PrP, CPrP). Advanced Q&A Flow level 3 uses every label. In the mark-up, compound nouns are circled, a prepositional phrase runs through its last compound object, and an interjection is in neither the subject nor the predicate. Diagrams (level 3) fork any compound: subjects, verbs (including a compound verb sharing one direct object), direct objects, predicate nouns, pronouns and adjectives on the baseline, and compound objects of a preposition or compound indirect objects where they hang; compound adjectives, adverbs and interjections aren't diagrammed yet.

Revision Ridge opens for players in grade 6 or higher. Minnesota's grade 6–8 benchmarks (6.2.1.1, 7.2.1.1, 8.2.1.1) ask for correct punctuation, capitalization and grammar in edited writing, so its skills follow the usual middle-school sequence. Proofreading levels are 5 paragraphs: tap a mistake, pick the fix.

**Revising Sentences** (Sentence Studio, grades 3–5): synonyms and antonyms; revising with a synonym, an antonym or a word change; then adding detail or deleting extra words.

Word study and style (added to cover more of the 2020 Minnesota benchmarks): **Word Parts** (prefixes and suffixes, many from Old English; Latin roots; Greek roots: 3.1.1.1, 4.2.1.2, 5.2.1.2, 6.2.1.2), **Word Choice** (formal and informal; connotation; precise words: 4.2.3.2, 5.1.8.1, 6.2.3.2) and **Figurative Language** (similes; metaphors and idioms; personification and hyperbole: 3.1.8.1, 4.1.8.1, 5.2.6.1). Agreement level 1 includes collective nouns (team, class, flock: 3.2.1.3), and pronoun case level 2 includes intensive pronouns (I made it myself: 7.2.1.3). The Rule Book's word-part cards (`WORD_PARTS`) list common prefixes, suffixes and roots with their meanings.

## How it plays

- Up to 4 players per device, each with a name, avatar and grade. Levels at or below a player's grade start unlocked, so an older child can review anything.
- A level opens with a Tip Card (the rule and an example, with read-aloud), then 8 items: 6 on the skill and 2 review items from levels already passed (Flow Factory: 5 items, see above).
- Ten kinds of items: **Mark it** (tap a space, add the marks; where commas are the only choice, a tap adds or removes one), **Fix it** (find the wrong word and fix it), **Which is right?**, **Build it** (put the pieces in order) **Sort it** (tap a word, then the box it belongs in), **Sentence check** (complete, fragment or run-on, then the best fix) **Join it** (pick the joining word, then decide if a comma goes in), **Q&A Flow**, **Build from labels** and **Proofread**.
- A first miss shows a hint and allows a second try; a second miss shows the answer, and the item comes back later.
- Points: 1 for right on the first try, ½ on the second. Stars at 6, 7 and 8 points out of 8 (scaled for shorter levels); under 6 means "build it again", and nothing is lost.
- Gold on a skill: 7 or more on its level 3 on two different days. That raises a gold flag on its top building.
- Badges: one per skill (Bronze, Silver, Gold); one per world for every skill at Silver (Port Champion, Works Wizard, Studio Star, Factory Foreman, Chief Editor; only the skills open at the player's grade count); and habits: First Brick, Builder's Week, Fix-It Pro, Summit Climber (5 flags from Summit Reviews) and Spelling Sailor (5 boats from Spelling Lake).
- Settings per player: read every sentence aloud, Pip's comments, sounds, grade.
- **Looking back:** the results screen lists the round's mistakes ("Look again"), each written correctly with its rule, and a **Review the rule** button reopens that level's Tip Card and returns to the results. The **Rule Book** (home screen chip, or the 📘 button on a world) has a tab per place, named as on the island map, plus **📚 Reference**. A **Find a rule** box at the top searches every unlocked rule, word list, kind-of-noun and spelling card, and every Q&A Flow label (try comma, its, plural or CDO). The search box and tabs wrap and stay pinned at the top. In a place's tab, **Skills** come first: each folds to one line until tapped, then shows its unlocked rules with examples and read-aloud (plus labels and patterns in Flow Factory); locked rules show only their title. Every reference card has one home, the **Reference** tab: word lists (articles, prepositions, helping and linking verbs, pronouns, joining words), kinds of nouns, word parts (prefixes, suffixes, Latin and Greek roots), and spelling patterns. Word Works and Flow Factory end with a link to it.
- **Back button:** the phone's Back gesture (or the browser's Back) closes the popup on top or steps back one screen, as in Bible Trivia and World Geography. Mid-round it asks before leaving; on the results it goes to the island; on the island it leaves the app.
- **📊 Progress** (on the home screen and on Who's playing?, open to everyone), like Bible Trivia and World Geography: **Me** has the current player's full details (minutes and days played this week, stars and badge for every skill, and the sentences missed most); **Everyone** (2+ players) has a short card each: buildings built, badges and minutes this week. From Who's playing, with no one picked, it shows Everyone.
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
  ui/                 item types, Grammar Island map and Pip drawings, read-aloud and sounds, update banner
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

## Content

Mark it supports `-`, `—`, `…`, `(` and `)`; hyphens and dashes join words with no spaces (write `twenty[-]one`). About 16–20 items per level, 12 or more Q&A Flows per Flow Factory level, 10 paragraphs per Proofreading level: 1207 items in all, plus 22 homework paragraphs and 90 Spelling Lake questions. `data/README.md` explains how items are written.

## Mark it up and Sentence Diagramming

After every Q&A Flow, **Mark it up** walks through the Shurley Skill Check on the same sentence: circle the nouns (noun check), put parentheses around each prepositional phrase, go back to the verb and divide the complete subject from the complete predicate with a slash (directly before the verb and its helping verb), then underline the complete subject once and the complete predicate twice. Predicate words in the complete subject (a helping or linking verb that starts a question, an adverb, or a prepositional phrase at the front) are underlined twice. On the first Q&A Flow sentence of each level (grade 4+), Shurley's **noun table** follows: for each noun, its job (SN, OP, DO…), singular or plural, and common or proper, then the simple subject and simple predicate. Pronouns doing a noun's job (me, us) aren't circled or listed. Each question shows a one-line reminder until the player has 12 right on the first try; 📘 Nouns (in the step) and a Kinds of nouns card in the Rule Book's Reference tab explain common/proper and singular/plural. Word-ending cards (`SPELLING_RULES`: past tense -ed, irregular past tense verbs, plurals, future tense with will, -s and -ing) fold in the Rule Book's Reference tab. Singular/plural comes from the reviewed noun list in `src/lib/nouns.js`; the item checker stops any new sentence whose nouns aren't on it. The flow itself asks for the sentence type (D, E, Int, Imp) and the pattern (SN V P1, …; levels 1–2 ask Pattern 1 or 2). The marks come from the word labels (`src/lib/markup.js`), so no extra content is needed.

**Sentence Diagramming** (Flow Factory, grade 5+, levels for grades 5/6/7, 5 sentences a level) starts with the same mark-up, then the player places each word on a Reed-Kellogg diagram drawn from the labels (`src/lib/diagram.js`): subject | verb on the baseline, direct objects behind a short line, predicate words and object complements behind a leaning line, describing words on slanted lines, prepositional phrases and indirect objects hanging below. The first diagram of each level is guided (one line at a time, with why the word goes there); **Walk me through it** replays that on any diagram (half credit), and every finished diagram lists why each word goes where it does. A word like *very* that describes a describing word hangs on its own slanted line joined to that word's line (an adverb before another adverb only does this for intensifiers like very and really; `attach` in an item overrides the guess). Compound parts (taught in Compound Q&A Flow, Advanced Q&A Flow level 3 and Diagramming level 3) fork into two branches with the conjunction on a dashed line: subjects, verbs (a compound verb can share one direct object), direct objects, predicate nouns, pronouns and adjectives on the baseline, and compound objects of a preposition or compound indirect objects where they hang. The two parts may go on either branch. Not yet diagrammed: three or more compound parts, compound adjectives and adverbs, and interjections.

## Looks

Grades 6+ get the calmer **Studio** look by default (system font, slate and indigo, flatter cards, no cartoon helper); Settings → Look switches between Automatic, Bright and Studio for any player. To change a player's name, avatar or grade, tap ✏️ on their card in Who's playing?; changes save on Save, and Delete player is there too. 50 avatars in two groups (grade 6+ see Sports, music and more first).

## Bricks, Pip's homework and celebrations

- **Grammar Island** (`townSvg` in `src/ui/art.js`, pan and zoom in `src/ui/townmap.js`): the home screen's map. Each world is a region with its own ground, around the Town Square and Grammar Peaks, joined by roads that run from the Town Square to where each area's path begins. It works like the World Geography map: drag to pan, pinch or ctrl+wheel to zoom, and + − ⤢. The first tap on a region zooms in to it (taps that move more than 8px are drags). Each area is a raised plateau with one winding path, two skills to a row, with a numbered spot for each level; passing a level builds on its spot in that area's style (striped cottages and a lighthouse at the port, smoking workshops at Word Works, domed theaters at the Studio, silo factories at Flow Factory, columned libraries with a clock tower at Revision Ridge), and Gold on a skill raises a gold flag. Pip waits on each path by the next level to play. Tapping a spot opens that skill's level card. Under the map: a hint for the whole island (the Worlds list below names every place), or (zoomed in) that place's skills, **🧱 Decorate here** and All levels here. Grammar Peaks has nothing to build, but holds two practice rounds (below). Pip's greeting has a **▶ Play** button for the next level. A region whose world isn't open yet (Revision Ridge before grade 6) shows locked and says when it opens. The Play button and the Worlds list (every place, including a Grammar Peaks card with its flags and boats) are the quick, accessible ways in. The header shows the app icon as its logo. After a level, the map opens on the region where the new building rises.
- **Bricks** (`BRICKS` in `src/config.js`): 2 per sentence right on the first try, 1 on the second, 3 per star, 10 the first time a level is passed. The **Build on the island** card on the home screen (under Pip's homework) shows the bricks and what they can build, and opens the Build screen, with a tab for each region (`DISTRICTS`). Each region can have 21 everyday decorations plus 7 of its own (`DECOR` items with an `area`: anchors and seals at the port, gears and a crane at Word Works, a piano and circus tent at the Studio, crates and a rocket at Flow Factory, books and a library at Revision Ridge), as many of each as they like. A new one appears at its usual spot, selected; kids drag any decoration anywhere in the close-up (sky, park or water) at any time, by mouse, finger or arrow keys, and tap one to put it away for a full refund. Saved as `{ uid, id, area, x, y }` in the close-up's units (`SCENE`); decorations from before the map are in the Town Square, where they were. Bricks only buy decorations.
- **🤖 Pip, the mascot:** Pip, the island's foreman, welcomes each new player with four short bubbles (`PIP_INTRO`, plainer wording for grade 6 and up), shown once and replayable from About ("Meet Pip again"); existing players meet him once too. He presents each Tip Card ("Pip's tip"), gives hints after a miss with his face beside them, greets on the home screen, comments on results and waits on each area's path. He shows in both looks; Settings can turn him off, which also skips the welcome.
- **⛰️ Grammar Peaks** (tap the mountains on the map): two rounds of 8 (`PRACTICE_PER_ROUND`) that never change levels or badges. Each earns bricks (2 per answer right on the first try, 1 on the second) and keeps each question's history.
  - **🚩 Summit Review** mixes questions from every level the player has passed, one skill at a time in turn, so each question asks which rule applies (interleaved, spaced review). Missed questions come back first, then unseen ones, then the longest ago (`pickSummitItems` in `src/lib/select.js`). Long Q&A Flow, labels and diagram items stay in their own levels. It opens once any level is passed. 6 or more right on the first try (`PRACTICE_GOAL`) plants a flag on the mountains.
  - **💧 Spelling Lake** asks "Which spelling is right?" about the Rule Book's spelling rules: -ed endings, irregular past tense, plurals, the future, and -s and -ing (`spelling` in `data/content.json`: 50 for grades 3–5, 40 harder ones for grades 6–8, each with a `rule` id and the rule as its hint). 6 or more right floats a boat on the lake.
- **📝 Pip's homework** (the card on the home screen): three of Pip's paragraphs to proofread (`homework` in `data/content.json`, 12 for grades 3–5 and 10 for grades 6–8), unseen ones first. Pip gets a grade (A+ when all three are right on the first try) and the player earns 6 bricks a paragraph (3 on the second try). It doesn't count toward levels or badges.
- **Celebrations:** confetti grows with the stars, results stars pop in one at a time, the building just earned rises on the island, buttons give under a tap, and phones buzz on a passed level. All motion is skipped when the device asks for reduced motion.

**Capital letters** (Punctuation Port, grades 3/4/5): first word, I, names, days, months and holidays (seasons lowercase); places, titles before names, Mom as a name vs. my mom; directions vs. regions (drove north / the North Shore), languages, titles and school subjects. A region wraps more than three skills onto another street.

## App icon

`icons/icon.svg` is the source: Grammar Island with a crane lifting an "Aa" block onto a building, and Pip in his hard hat, kept inside the center circle so it survives round masks. Make the PNGs with `rsvg-convert -w 512 -h 512 icons/icon.svg -o icons/icon-512.png` (and 192, 96, and 180 for `apple-touch-icon.png`).

## Original content

Sentence Builders is a practice supplement for skills students have already been taught, or are assumed to have been taught, in class. Every sentence, hint, Tip Card and explanation is written for this game. It follows the Shurley English method (the Q&A Flow, its label abbreviations, the sentence patterns and the Skill Check steps) and the 2020 Minnesota standards, but copies no text, examples or jingles from Shurley's books or any other curriculum, and isn't made by or connected to Shurley Instructional Materials or the Minnesota Department of Education. The app icon and drawings are original too; the decorations are the device's own emoji.
