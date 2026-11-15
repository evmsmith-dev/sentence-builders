// Drawings made in code: Pip the foreman robot and the player's town.
import { SKILLS, skillsInWorld } from "../config.js";
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
const GROUND = 150;

function building(x, skill, level, stars, gold) {
  const color = skill.color;
  const cx = x + LOT_W / 2;
  const star = stars ? `<text x="${cx}" y="${GROUND - [36, 54, 76][level - 1] - 6}" text-anchor="middle" font-size="9" fill="#f2a900">${"★".repeat(stars)}</text>` : "";
  if (level === 3 && gold) {
    // A lighthouse: the landmark for a mastered skill.
    return `<g><path d="M${cx - 9} ${GROUND}L${cx - 6} ${GROUND - 62}h12L${cx + 9} ${GROUND}z" fill="#fff" stroke="${color}" stroke-width="2"/>
      <rect x="${cx - 7}" y="${GROUND - 44}" width="14" height="7" fill="${color}"/><rect x="${cx - 8}" y="${GROUND - 24}" width="16" height="7" fill="${color}"/>
      <rect x="${cx - 7}" y="${GROUND - 72}" width="14" height="10" rx="2" fill="#ffd54f" stroke="${color}" stroke-width="2"/>
      <path d="M${cx - 9} ${GROUND - 72}l9-8 9 8z" fill="${color}"/>${star}</g>`;
  }
  const h = [26, 44, 64][level - 1];
  const w = [26, 28, 24][level - 1];
  const left = cx - w / 2;
  const windows = Array.from({ length: level }, (_, row) =>
    `<rect x="${left + 5}" y="${GROUND - h + 7 + row * 18}" width="6" height="6" rx="1" fill="#fff8d6"/><rect x="${left + w - 11}" y="${GROUND - h + 7 + row * 18}" width="6" height="6" rx="1" fill="#fff8d6"/>`).join("");
  return `<g><rect x="${left}" y="${GROUND - h}" width="${w}" height="${h}" rx="2" fill="${color}"/>
    <path d="M${left - 3} ${GROUND - h}L${cx} ${GROUND - h - 10}L${left + w + 3} ${GROUND - h}z" fill="#8c3b2e"/>${windows}
    <rect x="${cx - 3.5}" y="${GROUND - 10}" width="7" height="10" rx="1" fill="#5a3a22"/>${star}</g>`;
}

function emptyLot(x) {
  return `<rect x="${x + 4}" y="${GROUND - 14}" width="${LOT_W - 8}" height="14" rx="2" fill="none" stroke="#9aa9c4" stroke-width="1.5" stroke-dasharray="3 3"/>`;
}

/** The Punctuation Port district: one block per skill, one lot per level. */
export function townSvg(player, worldId = "port") {
  const skills = skillsInWorld(worldId);
  const blockW = LOT_W * 3 + 10;
  const start = (360 - skills.length * blockW + 10) / 2;
  const blocks = skills.map((skill, b) => {
    const x0 = start + b * blockW;
    const gold = skillTier(player, skill.id) === 3;
    const lots = [1, 2, 3].map((level) => {
      const stars = levelStars(player, skill.id, level);
      return stars ? building(x0 + (level - 1) * LOT_W, skill, level, stars, gold) : emptyLot(x0 + (level - 1) * LOT_W);
    }).join("");
    return `<g data-skill="${skill.id}">${lots}<text x="${x0 + (LOT_W * 3) / 2}" y="${GROUND + 16}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#2c3e5c">${esc(skill.short)}</text></g>`;
  }).join("");
  const built = SKILLS.reduce((n, skill) => n + [1, 2, 3].filter((level) => levelStars(player, skill.id, level)).length, 0);
  return `<svg class="town" viewBox="0 0 360 224" role="img" aria-label="Your town: ${built} of ${SKILLS.length * 3} buildings built">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe6ff"/><stop offset="1" stop-color="#eef6ff"/></linearGradient></defs>
    <rect width="360" height="224" fill="url(#sky)"/>
    <circle cx="318" cy="34" r="14" fill="#ffd54f"/>
    <path d="M40 42q8-10 18 0q10-6 16 4H34q0-6 6-4z" fill="#fff"/><path d="M200 30q8-10 18 0q10-6 16 4h-40q0-6 6-4z" fill="#fff"/>
    <rect y="${GROUND}" width="360" height="26" fill="#9fd38a"/>
    <rect y="${GROUND + 26}" width="360" height="10" fill="#c9c3b5"/>
    <rect y="${GROUND + 36}" width="360" height="38" fill="#6fb6e8"/>
    <path d="M0 ${GROUND + 44}q15-4 30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0" stroke="#a9d8f5" stroke-width="2" fill="none"/>
    <g transform="translate(286 ${GROUND + 44})"><path d="M0 8h40l-6 10H6z" fill="#e85d4a"/><rect x="18" y="-14" width="2.5" height="22" fill="#5a3a22"/><path d="M21 -13l14 18H21z" fill="#fff"/></g>
    ${blocks}
  </svg>`;
}
