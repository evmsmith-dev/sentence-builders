// Drawings made in code: Pip the foreman robot and the player's town.
import { DECOR, WORLDS, skillsInWorldFor, worldOpenFor } from "../config.js";
import { levelStars, skillTier } from "../lib/progress.js";
import { esc } from "./dom.js";

export function pipSvg(size = 56) {
  return `<svg class="pip" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <rect x="12" y="22" width="40" height="30" rx="9" fill="#5b8def"/>
    <rect x="18" y="29" width="28" height="15" rx="6" fill="#e9f1ff"/>
    <circle cx="26" cy="36" r="3.2" fill="#1d2b4f"/><circle cx="38" cy="36" r="3.2" fill="#1d2b4f"/>
    <path d="M27 41.5q5 3 10 0" stroke="#1d2b4f" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M10 22q22-20 44 0z" fill="#ffc531"/><rect x="8" y="20" width="48" height="5" rx="2.5" fill="#f2a900"/>
    <rect x="21" y="52" width="6" height="7" rx="2" fill="#3c6bc9"/><rect x="37" y="52" width="6" height="7" rx="2" fill="#3c6bc9"/>
  </svg>`;
}

/** Pip with a speech bubble. Empty when the player turned Pip off. */
export function pipSays(text, on = true) {
  if (!on || !text) return "";
  return `${pipSvg()}<p class="bubble">${esc(text)}</p>`;
}

const LOT_W = 34;
const TOP = 34; // sky above the first street
const ROW = 126; // height of one street: buildings, then grass with the labels

function building(x, ground, skill, level, stars, gold) {
  const color = skill.color;
  const cx = x + LOT_W / 2;
  const star = stars ? `<text x="${cx}" y="${ground - [36, 54, 76][level - 1] - 6}" text-anchor="middle" font-size="9" fill="#f2a900">${"★".repeat(stars)}</text>` : "";
  if (level === 3 && gold) {
    // A lighthouse: the landmark for a mastered skill.
    return `<g><path d="M${cx - 9} ${ground}L${cx - 6} ${ground - 62}h12L${cx + 9} ${ground}z" fill="#fff" stroke="${color}" stroke-width="2"/>
      <rect x="${cx - 7}" y="${ground - 44}" width="14" height="7" fill="${color}"/><rect x="${cx - 8}" y="${ground - 24}" width="16" height="7" fill="${color}"/>
      <rect x="${cx - 7}" y="${ground - 72}" width="14" height="10" rx="2" fill="#ffd54f" stroke="${color}" stroke-width="2"/>
      <path d="M${cx - 9} ${ground - 72}l9-8 9 8z" fill="${color}"/>${star}</g>`;
  }
  const h = [26, 44, 64][level - 1];
  const w = [26, 28, 24][level - 1];
  const left = cx - w / 2;
  const windows = Array.from({ length: level }, (_, row) =>
    `<rect x="${left + 5}" y="${ground - h + 7 + row * 18}" width="6" height="6" rx="1" fill="#fff8d6"/><rect x="${left + w - 11}" y="${ground - h + 7 + row * 18}" width="6" height="6" rx="1" fill="#fff8d6"/>`).join("");
  return `<g><rect x="${left}" y="${ground - h}" width="${w}" height="${h}" rx="2" fill="${color}"/>
    <path d="M${left - 3} ${ground - h}L${cx} ${ground - h - 10}L${left + w + 3} ${ground - h}z" fill="#8c3b2e"/>${windows}
    <rect x="${cx - 3.5}" y="${ground - 10}" width="7" height="10" rx="1" fill="#5a3a22"/>${star}</g>`;
}

function emptyLot(x, ground) {
  return `<rect x="${x + 4}" y="${ground - 14}" width="${LOT_W - 8}" height="14" rx="2" fill="none" stroke="#9aa9c4" stroke-width="1.5" stroke-dasharray="3 3"/>`;
}

/** One street: one block per skill in the world, one lot per level. */
function street(player, world, ground, rising) {
  const skills = skillsInWorldFor(world.id, player);
  const blockW = LOT_W * 3 + 10;
  const start = (360 - skills.length * blockW + 10) / 2;
  const blocks = skills.map((skill, b) => {
    const x0 = start + b * blockW;
    const gold = skillTier(player, skill.id) === 3;
    const lots = [1, 2, 3].map((level) => {
      const stars = levelStars(player, skill.id, level);
      const x = x0 + (level - 1) * LOT_W;
      if (!stars) return emptyLot(x, ground);
      const drawn = building(x, ground, skill, level, stars, gold);
      // The building just earned rises out of the ground (only when motion is allowed).
      return rising === `${skill.id}-${level}` ? `<g class="rise">${drawn}</g>` : drawn;
    }).join("");
    return `<g data-skill="${skill.id}">${lots}<text x="${x0 + (LOT_W * 3) / 2}" y="${ground + 15}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#2c3e5c">${esc(skill.short)}</text></g>`;
  }).join("");
  return `<rect y="${ground}" width="360" height="22" fill="#9fd38a"/>
    <text x="8" y="${ground - 86}" font-size="10" font-weight="700" fill="#3d5a80">${esc(world.name)}</text>${blocks}`;
}

/** The player's town: a street for each world that's open, with the harbor at the bottom. */
const PARK = 74; // the park strip between the last street and the water
const SKY = 44; // extra sky, added once something flies there

/** One decoration as an emoji in the SVG; `fresh` pops in (just built). */
function decorSvg(d, x, y, fresh) {
  const cls = ["decor", d.walk ? "walk" : "", d.id === fresh ? "pop" : ""].filter(Boolean).join(" ");
  return `<text class="${cls}" x="${x}" y="${y}" text-anchor="middle" font-size="${d.zone === "square" && d.row === "back" ? 30 : 24}">${d.emoji}<title>${d.name}</title></text>`;
}

export function townSvg(player, { fresh = null, rising = null } = {}) {
  const worlds = WORLDS.filter((world) => worldOpenFor(world, player));
  const owned = DECOR.filter((d) => (player.decor || []).includes(d.id));
  const sky = owned.some((d) => d.zone === "sky") ? SKY : 0;
  const grounds = worlds.map((_, r) => sky + TOP + 96 + r * ROW);
  const last = grounds[grounds.length - 1];
  const park = last + 32;
  const height = park + PARK + 38;
  const shownSkills = worlds.flatMap((w) => skillsInWorldFor(w.id, player));
  const built = shownSkills.reduce((n, skill) => n + [1, 2, 3].filter((level) => levelStars(player, skill.id, level)).length, 0);
  const total = shownSkills.length * 3;
  const water = park + PARK;
  const inPark = owned.filter((d) => d.zone === "square");
  return `<svg class="town" viewBox="0 0 360 ${height}" role="img" aria-label="Your town: ${built} of ${total} buildings built">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe6ff"/><stop offset="1" stop-color="#eef6ff"/></linearGradient></defs>
    <rect width="360" height="${height}" fill="url(#sky)"/>
    <circle cx="318" cy="28" r="13" fill="#ffd54f"/>
    <path d="M150 30q8-10 18 0q10-6 16 4h-40q0-6 6-4z" fill="#fff"/><path d="M230 22q8-10 18 0q10-6 16 4h-40q0-6 6-4z" fill="#fff"/>
    ${worlds.map((world, r) => street(player, world, grounds[r], rising)).join("")}
    <rect y="${last + 22}" width="360" height="10" fill="#c9c3b5"/>
    <rect y="${park}" width="360" height="${PARK}" fill="#a5d6a7"/>
    <path d="M0 ${park + 46}h360" stroke="#c8e6c9" stroke-width="10"/>
    ${inPark.length ? "" : `<text x="180" y="${park + 42}" text-anchor="middle" class="park-sign">Town park: build here with 🧱 bricks</text>`}
    ${inPark.filter((d) => d.row === "back").map((d) => decorSvg(d, d.x, park + 36, fresh)).join("")}
    ${inPark.filter((d) => d.row === "front").map((d) => decorSvg(d, d.x, park + 66, fresh)).join("")}
    ${owned.filter((d) => d.zone === "sky").map((d) => decorSvg(d, d.x, 44, fresh)).join("")}
    <rect y="${water}" width="360" height="38" fill="#6fb6e8"/>
    <path d="M0 ${water + 8}q15-4 30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0" stroke="#a9d8f5" stroke-width="2" fill="none"/>
    <g transform="translate(286 ${water + 8})"><path d="M0 8h40l-6 10H6z" fill="#e85d4a"/><rect x="18" y="-14" width="2.5" height="22" fill="#5a3a22"/><path d="M21 -13l14 18H21z" fill="#fff"/></g>
    ${owned.filter((d) => d.zone === "water").map((d) => decorSvg(d, d.x, water + 28, fresh)).join("")}
  </svg>`;
}

/** Close-up of the decorations for the Build screen: a strip of sky, the park and the water. */
export function parkSvg(player, { fresh = null } = {}) {
  const owned = DECOR.filter((d) => (player.decor || []).includes(d.id));
  const park = 64;
  const water = park + PARK;
  const height = water + 38;
  const inPark = owned.filter((d) => d.zone === "square");
  return `<svg class="town park-view" viewBox="0 0 360 ${height}" role="img" aria-label="Your town park: ${owned.length} of ${DECOR.length} decorations">
    <defs><linearGradient id="park-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe6ff"/><stop offset="1" stop-color="#eef6ff"/></linearGradient></defs>
    <rect width="360" height="${park}" fill="url(#park-sky)"/>
    <circle cx="330" cy="20" r="10" fill="#ffd54f"/>
    <rect y="${park - 8}" width="360" height="8" fill="#c9c3b5"/>
    <rect y="${park}" width="360" height="${PARK}" fill="#a5d6a7"/>
    <path d="M0 ${park + 46}h360" stroke="#c8e6c9" stroke-width="10"/>
    ${inPark.length ? "" : `<text x="180" y="${park + 42}" text-anchor="middle" class="park-sign">Town park: build here with 🧱 bricks</text>`}
    ${inPark.filter((d) => d.row === "back").map((d) => decorSvg(d, d.x, park + 36, fresh)).join("")}
    ${inPark.filter((d) => d.row === "front").map((d) => decorSvg(d, d.x, park + 66, fresh)).join("")}
    ${owned.filter((d) => d.zone === "sky").map((d) => decorSvg(d, d.x, 40, fresh)).join("")}
    <rect y="${water}" width="360" height="38" fill="#6fb6e8"/>
    <path d="M0 ${water + 8}q15-4 30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0" stroke="#a9d8f5" stroke-width="2" fill="none"/>
    ${owned.filter((d) => d.zone === "water").map((d) => decorSvg(d, d.x, water + 28, fresh)).join("")}
  </svg>`;
}
