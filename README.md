# Sentence Builders

A grammar and punctuation game for grades 3–5 that installs as an app on phones, tablets and computers (PWA) and works offline. Players fix and build sentences; each level they pass puts up a building in their town, and badges reward mastery and steady practice. Skills follow the 2020 Minnesota K–12 ELA standards.

Two worlds are playable: **Punctuation Port** and **Word Works**.

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

Sentence Studio and Flow Factory (Shurley Q&A Flow) are shown as "Coming soon".

## How it plays

- Up to 4 players per device, each with a name, avatar and grade. Levels at or below a player's grade start unlocked, so an older child can review anything.
- A level opens with a Tip Card (the rule and an example, with read-aloud), then 8 items: 6 on the skill and 2 review items from levels already passed.
- Five kinds of items: **Mark it** (tap a space, add the marks; where commas are the only choice, a tap adds or removes one), **Fix it** (find the wrong word and fix it), **Which is right?**, **Build it** (put the pieces in order) and **Sort it** (tap a word, then the box it belongs in).
- A first miss shows a hint and allows a second try; a second miss shows the answer, and the item comes back later.
- Points: 1 for right on the first try, ½ on the second. Stars at 6, 7 and 8 points; under 6 means "build it again", and nothing is lost.
- Gold on a skill: 7 or more on its level 3 on two different days. That turns its tower into a lighthouse.
- Badges: one per skill (Bronze, Silver, Gold), one per world (Port Champion, Works Wizard), First Brick, Builder's Week and Fix-It Pro.
- Settings per player: read every sentence aloud, Pip's comments, sounds, grade.
- **Grown-up view** (from the player screen or Settings, behind a "type this number" check): per child, minutes and days played this week, stars and badge for every skill, the sentences missed most, and a break reminder (off, 15, 20, 30 or 45 minutes). It also saves and restores a backup file.
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
