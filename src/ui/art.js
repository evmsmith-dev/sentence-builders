// Drawings made in code: Pip the foreman robot, and Grammar Island with its areas.
import { DECOR, DISTRICTS, SCENE, WORLDS, skillsInWorldFor, worldOpenFor } from "../config.js";
import { isUnlocked, levelStars, skillTier } from "../lib/progress.js";
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
export function pipSays(text, on = true, action = "") {
  if (!on || !text) return "";
  return action ? `${pipSvg()}<div class="bubble"><p>${esc(text)}</p>${action}</div>` : `${pipSvg()}<p class="bubble">${esc(text)}</p>`;
}

const D = 7; // depth of side walls: drawn back and up to the right, so everything looks solid
const DY = 4;

/** A color made darker (f < 1) or lighter (f > 1), for shaded sides. */
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1)).toString(16).padStart(2, "0");
  return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

/* ==================== Buildings: one style per area ==================== */

const sideWall = (x, top, ground, fill) => `<path d="M${x} ${ground}l${D} ${-DY}V${top - DY}l${-D} ${DY}z" fill="${fill}"/>`;
const roofTop = (left, right, top, fill) => `<path d="M${left} ${top}l${D} ${-DY}H${right + D}l${-D} ${DY}z" fill="${fill}"/>`;
const groundShadow = (left, right, ground, h) => `<path d="M${left} ${ground}H${right}l${D + h * 0.3} ${-DY - 2}H${left + D + 4}z" fill="#000" opacity=".16"/>`;
const door = (cx, ground, fill = "#5a3a22") => `<rect x="${cx - 3.5}" y="${ground - 10}" width="7" height="10" rx="3" fill="${fill}"/>`;
const windowRows = (left, w, top, rows, fill = "#fff8d6") => Array.from({ length: rows }, (_, r) =>
  `<rect x="${left + 4}" y="${top + 6 + r * 13}" width="5" height="5" rx="1" fill="${fill}"/><rect x="${left + w - 9}" y="${top + 6 + r * 13}" width="5" height="5" rx="1" fill="${fill}"/>`).join("");
/** A plain box: front wall, shaded side and (for flat roofs) a lit top. */
const box = (left, top, w, ground, wall, side, roof) =>
  `${sideWall(left + w, top, ground, side)}<rect x="${left}" y="${top}" width="${w}" height="${ground - top}" fill="${wall}"/>${roof ? roofTop(left, left + w, top, roof) : ""}`;

/** The cottages, workshops, theaters, factories and libraries: bigger at each level. */
const STYLES = {
  // Punctuation Port: striped harbor cottages, and a lighthouse at level 3.
  port(cx, ground, level, color) {
    if (level === 3) {
      return `${groundShadow(cx - 10, cx + 10, ground, 70)}<path d="M${cx + 10} ${ground}L${cx + 7} ${ground - 62}h4L${cx + 15} ${ground - 3}z" fill="#c9d3e3"/>
        <path d="M${cx - 10} ${ground}L${cx - 7} ${ground - 62}h14L${cx + 10} ${ground}z" fill="#fff"/>
        <path d="M${cx - 9.4} ${ground - 14}h18.8l-.8 -9h-17.2z M${cx - 8.2} ${ground - 38}h16.4l-.7 -9h-15z" fill="${color}"/>
        <rect x="${cx - 7}" y="${ground - 72}" width="14" height="10" rx="2" fill="#ffd54f" stroke="${color}" stroke-width="2"/>
        <path d="M${cx - 9} ${ground - 72}l9-8 9 8z" fill="${color}"/>${door(cx, ground)}`;
    }
    const [w, h] = [[24, 22], [28, 36]][level - 1];
    const left = cx - w / 2;
    const top = ground - h;
    return `${groundShadow(left, left + w, ground, h)}${box(left, top, w, ground, "#f7f3ea", "#d9d1c0")}
      <rect x="${left}" y="${top + h * 0.42}" width="${w}" height="4" fill="${color}"/>
      <path d="M${cx} ${top - 11}l${D} ${-DY}L${left + w + 3 + D} ${top - DY}L${left + w + 3} ${top}z" fill="${shade(color, 0.6)}"/>
      <path d="M${left - 3} ${top}L${cx} ${top - 11}L${left + w + 3} ${top}z" fill="${color}"/>
      ${windowRows(left, w, top, level, "#bfe3ff")}${door(cx, ground, "#2f5d8a")}`;
  },
  // Word Works: brick workshops with saw-tooth roofs and smoking chimneys; a gear on the biggest.
  works(cx, ground, level, color) {
    const [w, h] = [[24, 22], [28, 34], [32, 46]][level - 1];
    const left = cx - w / 2;
    const top = ground - h;
    const teeth = `l${w / 3} -7v7`.repeat(3); // a saw-tooth roof
    const gear = level === 3 ? `<circle cx="${cx}" cy="${top + 16}" r="7" fill="none" stroke="#f2c200" stroke-width="4" stroke-dasharray="3 2.5"/><circle cx="${cx}" cy="${top + 16}" r="3" fill="#f2c200"/>` : "";
    return `${groundShadow(left, left + w, ground, h)}${box(left, top, w, ground, color, shade(color, 0.66))}
      <path d="M${left} ${top}${teeth}z" fill="#8a8f99"/>
      <rect x="${left + w - 8}" y="${top - 16}" width="5" height="16" fill="#5d5f66"/>
      <g class="smoke"><circle cx="${left + w - 5}" cy="${top - 21}" r="3.5" fill="#fff" opacity=".8"/><circle cx="${left + w - 1}" cy="${top - 27}" r="2.6" fill="#fff" opacity=".6"/></g>
      ${level === 3 ? gear : windowRows(left, w, top, level)}${door(cx, ground, "#3d3f45")}`;
  },
  // Sentence Studio: theaters with domes and a little flag; lights around the biggest.
  studio(cx, ground, level, color) {
    const [w, h] = [[24, 20], [28, 30], [32, 40]][level - 1];
    const left = cx - w / 2;
    const top = ground - h;
    const dome = w / 2;
    const lights = level === 3 ? Array.from({ length: 6 }, (_, k) => `<circle cx="${left + 3 + k * ((w - 6) / 5)}" cy="${top + 4}" r="1.6" fill="#ffd54f"/>`).join("") : "";
    return `${groundShadow(left, left + w, ground, h + dome)}${box(left, top, w, ground, "#fbf3e6", "#e0d2bb")}
      <path d="M${left + w} ${top}l${D} ${-DY}a${dome} ${dome * 0.8} 0 0 0 ${-dome} ${-dome * 0.8}z" fill="${shade(color, 0.62)}"/>
      <path d="M${left} ${top}a${dome} ${dome * 0.8} 0 0 1 ${w} 0z" fill="${color}"/>
      <path d="M${cx} ${top - dome * 0.8}v-10" stroke="#5a3a22" stroke-width="1.5"/><path d="M${cx} ${top - dome * 0.8 - 10}l8 3-8 3z" fill="#ff7a59"/>
      ${lights}${windowRows(left, w, top + (level === 3 ? 4 : 0), Math.min(level, 2), "#ffe9b0")}${door(cx, ground, "#a5395b")}`;
  },
  // Flow Factory: factories with a round silo; a tall striped smokestack on the biggest.
  flow(cx, ground, level, color) {
    const [w, h] = [[22, 22], [26, 32], [26, 40]][level - 1];
    const left = cx - w / 2 - 4;
    const top = ground - h;
    const silo = `<rect x="${left + w + 1}" y="${top - 6}" width="11" height="${h + 6}" fill="${color}"/><rect x="${left + w + 8}" y="${top - 6}" width="4" height="${h + 6}" fill="${shade(color, 0.7)}"/>
      <ellipse cx="${left + w + 6.5}" cy="${top - 6}" rx="5.5" ry="2.4" fill="${shade(color, 1.3)}"/>`;
    const stack = level === 3 ? `<rect x="${left + 4}" y="${top - 26}" width="6" height="26" fill="#eef0f5"/><rect x="${left + 4}" y="${top - 20}" width="6" height="4" fill="#e85d4a"/><rect x="${left + 4}" y="${top - 10}" width="6" height="4" fill="#e85d4a"/>
      <g class="smoke"><circle cx="${left + 7}" cy="${top - 31}" r="3.5" fill="#fff" opacity=".8"/><circle cx="${left + 11}" cy="${top - 37}" r="2.6" fill="#fff" opacity=".6"/></g>` : "";
    return `${groundShadow(left, left + w + 12, ground, h)}${stack}${box(left, top, w, ground, "#d9dce8", "#aab0c2", "#eef0f6")}${silo}
      ${windowRows(left, w, top, Math.min(level, 2), "#bfe3ff")}${door(left + w / 2, ground, "#4b4f63")}`;
  },
  // Revision Ridge: libraries with columns and a pediment; a clock tower on the biggest.
  desk(cx, ground, level, color) {
    const [w, h] = [[24, 20], [28, 28], [32, 34]][level - 1];
    const left = cx - w / 2;
    const top = ground - h;
    const cols = Array.from({ length: level + 2 }, (_, k) => `<rect x="${left + 3 + k * ((w - 8) / (level + 1))}" y="${top + 3}" width="2.5" height="${h - 6}" fill="#fffaf0"/>`).join("");
    const tower = level === 3 ? `${box(cx - 6, top - 30, 12, top - 8, "#f1e6cf", "#cdbf9f")}<circle cx="${cx}" cy="${top - 22}" r="4" fill="#fff" stroke="#5a4a2a" stroke-width="1"/>
      <path d="M${cx} ${top - 22}v-3M${cx} ${top - 22}h2.5" stroke="#5a4a2a" stroke-width="1"/><path d="M${cx - 7} ${top - 30}l7-8 7 8z" fill="${color}"/>` : "";
    return `${groundShadow(left - 2, left + w + 2, ground, h + 10)}${tower}${box(left, top, w, ground, "#efe2c6", "#cbbb98")}${cols}
      <path d="M${left + w + 2} ${top}l${D} ${-DY}l${-w / 2 - 2} -9l-${D} ${DY}z" fill="${shade(color, 0.62)}"/>
      <path d="M${left - 2} ${top}L${cx} ${top - 9}L${left + w + 2} ${top}z" fill="${color}"/>
      <rect x="${left - 3}" y="${ground - 3}" width="${w + 6}" height="3" fill="#d6c7a6"/>${door(cx, ground, "#6b4a2a")}`;
  },
};

/** A level's building on its pad, with its stars; a gold pennant once the skill is mastered. */
function building(area, cx, ground, skill, level, stars, gold) {
  const drawn = (STYLES[area] || STYLES.port)(cx, ground, level, skill.color);
  const tops = { port: [37, 51, 84], works: [26, 38, 70], studio: [36, 52, 74], flow: [32, 42, 70], desk: [34, 42, 74] }[area] || [40, 54, 84];
  const top = ground - tops[level - 1];
  const pennant = gold ? `<path d="M${cx + 12} ${top + 4}v-14" stroke="#7a5a1a" stroke-width="1.5"/><path d="M${cx + 12} ${top - 10}l10 3.5-10 3.5z" fill="#f2c200"/>` : "";
  return `<g>${drawn}${pennant}<text x="${cx}" y="${top - 2}" text-anchor="middle" font-size="9" fill="#f2a900" stroke="#fff" stroke-width="2" paint-order="stroke">${"★".repeat(stars)}</text></g>`;
}

/* ==================== Areas: a raised plateau with a winding path of levels ==================== */

const PARK = SCENE.water - SCENE.park; // the park under the path
const BAND = SCENE.height - SCENE.water; // the pond along the bottom
const ROW_H = 110; // one row of the path: two skills, six levels
const NODE_X = [40, 96, 152, 208, 264, 320];
const PATH_TOP = SCENE.park + 92; // the first row's ground
// The plateau's top, cliffs, and path for each area.
const THEMES = {
  square: { top: "#b5e09a", cliff: "#86603e", path: "#f2e6c7", edge: "#bfa67a" },
  port: { top: "#f4e3b0", cliff: "#a07648", path: "#fff6dc", edge: "#c9a86a" },
  works: { top: "#d3cfb4", cliff: "#7d705a", path: "#e3dfd2", edge: "#8f8a7c" },
  studio: { top: "#f6d3e0", cliff: "#9a6276", path: "#fff8fb", edge: "#d79ab3" },
  flow: { top: "#d3c9ec", cliff: "#6d5f94", path: "#b3b8cc", edge: "#6f7690" },
  desk: { top: "#e4d6b0", cliff: "#8a6f45", path: "#efd2b0", edge: "#b0835a" },
};
// Where the road from the Town Square meets each area's path, and which way the rows go.
const ENTRY = {
  port: { side: "right", up: true },
  works: { side: "left", up: true },
  studio: { side: "top", x: 320 },
  flow: { side: "top", x: 40 },
  desk: { side: "top", x: 320 },
};

/** Placed decorations in one district with their catalog entry, drawn back to front (lower is nearer). */
function placedDecor(player, area) {
  return (player.decor || []).filter((p) => typeof p === "object" && (p.area || "square") === area)
    .map((p) => ({ ...p, item: DECOR.find((d) => d.id === p.id) }))
    .filter((p) => p.item)
    .sort((a, b) => a.y - b.y);
}

/** One decoration as an emoji; `fresh` pops in (just built). In the Build close-up it can be dragged. */
function decorSvg(p, y, { fresh = null, drag = false, selected = null } = {}) {
  const d = p.item;
  const cls = ["decor", p.uid === fresh ? "pop" : "", drag ? "drag" : "", p.uid === selected ? "selected" : "",
    drag && d.move ? `idle-${d.move}` : ""].filter(Boolean).join(" ");
  // Each one starts at its own point in the loop, so two tractors don't move in step.
  const delay = d.move ? ` style="animation-delay:-${((p.x * 7 + y * 3) % 90) / 10}s"` : "";
  const size = d.zone === "square" && d.row === "back" ? 30 : 26;
  const handle = drag ? ` data-uid="${p.uid}" tabindex="0" role="button" aria-label="${d.name}: drag to move, or tap to select"` : "";
  const shadow = p.y >= SCENE.park ? `<ellipse cx="${p.x + 3}" cy="${y - 1}" rx="${size * 0.4}" ry="3.5" fill="#000" opacity=".16"/>` : "";
  if (!drag) {
    const body = `${shadow}<text x="${p.x}" y="${y}" text-anchor="middle" font-size="${size}">${d.emoji}<title>${d.name}</title></text>`;
    return `<g class="${cls}">${d.move ? `<g class="move move-${d.move}"${delay}>${body}</g>` : body}</g>`;
  }
  return `${shadow.replace("<ellipse", `<ellipse data-shadow="${p.uid}"`)}<text class="${cls}" x="${p.x}" y="${y}" text-anchor="middle" font-size="${size}"${handle}${delay}>${d.emoji}<title>${d.name}</title></text>`;
}

const wave = (y, x0 = 0, x1 = 360) => {
  let d = `M${x0} ${y}`;
  for (let x = x0; x < x1; x += 30) d += "q15-4 30 0";
  return `<path d="${d}" stroke="#ffffff" stroke-opacity=".45" stroke-width="2" fill="none"/>`;
};

/** The skills a district shows (none for the Town Square). */
export function districtSkills(district, player) {
  return district.world ? skillsInWorldFor(district.world, player) : [];
}

/** Districts on this player's map. One whose world isn't open yet (grade) shows as a locked area. */
export function mapDistricts(player) {
  return DISTRICTS.filter((d) => !d.world || WORLDS.find((w) => w.id === d.world)?.ready)
    .map((d) => ({ ...d, locked: Boolean(d.world) && !worldOpenFor(WORLDS.find((w) => w.id === d.world), player) }));
}

const pathRows = (district, player) => (district.locked ? 0 : Math.ceil(districtSkills(district, player).length / 2));

function districtHeight(district, player) {
  const rows = pathRows(district, player);
  return rows ? SCENE.park + rows * ROW_H + 20 + PARK + BAND : SCENE.height;
}

/**
 * The path through an area: each level's spot in order (skill by skill, levels 1 to 3), snaking back
 * and forth two skills to a row, from where the road comes in. Returns { nodes, d, start }.
 */
function areaPath(district, player) {
  const skills = districtSkills(district, player);
  const rows = pathRows(district, player);
  const entry = ENTRY[district.id] || { side: "left" };
  let leftToRight = entry.side === "left" || (entry.side === "top" && entry.x < 180);
  const nodes = [];
  for (let r = 0; r < rows; r++) {
    const visual = entry.up ? rows - 1 - r : r;
    const ground = PATH_TOP + visual * ROW_H;
    const inRow = skills.slice(r * 2, r * 2 + 2);
    const xs = leftToRight ? NODE_X : [...NODE_X].reverse();
    inRow.forEach((skill, s) => [1, 2, 3].forEach((level) => nodes.push({ skill, level, x: xs[s * 3 + level - 1], ground, row: r })));
    leftToRight = !leftToRight;
  }
  if (!nodes.length) return { nodes, d: "", start: null };
  const first = nodes[0];
  const start = entry.side === "top" ? [first.x, 0] : [entry.side === "left" ? 0 : 360, first.ground];
  let d = `M${start[0]} ${start[1]}L${first.x} ${first.ground}`;
  for (let i = 1; i < nodes.length; i++) {
    const [a, b] = [nodes[i - 1], nodes[i]];
    if (a.row === b.row) d += `L${b.x} ${b.ground}`;
    else {
      const out = a.x < 180 ? -32 : 32; // a U-turn out to the side, then into the next row
      d += `C${a.x + out} ${a.ground} ${b.x + out} ${b.ground} ${b.x} ${b.ground}`;
    }
  }
  return { nodes, d, start };
}

/** A plateau outline: a rounded box with gently uneven edges. */
function plateauPath(w, h) {
  const pts = [];
  const r = 26;
  const corners = [[w - r, r, -90], [w - r, h - r, 0], [r, h - r, 90], [r, r, 180]];
  let s = 0;
  corners.forEach(([cx, cy, a0], k) => {
    for (let a = a0; a < a0 + 90; a += 30) {
      const rad = (a * Math.PI) / 180;
      pts.push([cx + r * Math.cos(rad), cy + r * Math.sin(rad)]);
    }
    const [ex, ey] = corners[(k + 1) % 4];
    const rad = ((a0 + 90) * Math.PI) / 180;
    const [nx, ny] = [Math.cos(rad), Math.sin(rad)];
    const [sx, sy, tx, ty] = [cx + r * nx, cy + r * ny, ex + r * nx, ey + r * ny];
    const steps = Math.max(1, Math.round(Math.hypot(tx - sx, ty - sy) / 46));
    for (let i = 0; i < steps; i++) {
      s += 1;
      const off = 3.5 * Math.sin(s * 1.9);
      pts.push([sx + ((tx - sx) * i) / steps + nx * off, sy + ((ty - sy) * i) / steps + ny * off]);
    }
  });
  return smoothPath(pts);
}

/** Pip, small, standing on the map (his feet at x, y), bobbing gently. */
const pipOnMap = (x, y) => `<g pointer-events="none" transform="translate(${x - 17} ${y - 33}) scale(.53)"><g class="pip-map">
  <ellipse cx="32" cy="61" rx="16" ry="4" fill="#000" opacity=".18"/>
  <rect x="12" y="22" width="40" height="30" rx="9" fill="#5b8def"/><rect x="18" y="29" width="28" height="15" rx="6" fill="#e9f1ff"/>
  <circle cx="26" cy="36" r="3.2" fill="#1d2b4f"/><circle cx="38" cy="36" r="3.2" fill="#1d2b4f"/>
  <path d="M27 41.5q5 3 10 0" stroke="#1d2b4f" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M10 22q22-20 44 0z" fill="#ffc531"/><rect x="8" y="20" width="48" height="5" rx="2.5" fill="#f2a900"/>
  <rect x="21" y="52" width="6" height="7" rx="2" fill="#3c6bc9"/><rect x="37" y="52" width="6" height="7" rx="2" fill="#3c6bc9"/><title>Pip</title></g></g>`;

/** One area, drawn at 0,0 and 360 wide: a raised plateau with its path of levels, a park and a pond. */
function districtSvg(player, district, { fresh, rising }) {
  const h = districtHeight(district, player);
  const theme = THEMES[district.id] || THEMES.square;
  const outline = plateauPath(360, h);
  const clip = `clip-${district.id}`;
  // The plateau: a shadow on the ground, cliffs with a layer line, then the top.
  const base = `<clipPath id="${clip}"><path d="${outline}"/></clipPath>
    <path d="${outline}" fill="#1f3a18" opacity=".22" transform="translate(12 34)"/>
    <path d="${outline}" fill="${shade(theme.cliff, 0.8)}" transform="translate(0 24)"/>
    <path d="${outline}" fill="${theme.cliff}" transform="translate(0 14)"/>`;
  if (district.locked) {
    const world = WORLDS.find((w) => w.id === district.world);
    return `${base}<path d="${outline}" fill="#e3e6ec"/>
      <path d="${outline}" fill="none" stroke="#a9b4c6" stroke-width="3" stroke-dasharray="10 8"/>
      <text x="180" y="78" text-anchor="middle" font-size="26" font-weight="700" fill="#5b6b85">🔒 ${esc(district.name)}</text>
      <text x="180" y="110" text-anchor="middle" font-size="15" fill="#5b6b85">Opens in grade ${world.minGrade}</text>`;
  }
  const rows = pathRows(district, player);
  const park = rows ? SCENE.park + rows * ROW_H + 20 : SCENE.park;
  const water = park + PARK;
  const placed = placedDecor(player, district.id);
  const at = (p) => (p.y < SCENE.park ? p.y : park + (p.y - SCENE.park));
  const { nodes, d } = areaPath(district, player);
  // The level spots: a pad on the path, with its building once that level is passed.
  const bySkill = new Map();
  for (const n of nodes) {
    const stars = levelStars(player, n.skill.id, n.level);
    const open = isUnlocked(player, n.skill.id, n.level);
    const label = `${n.skill.name}, level ${n.level}, ${stars ? `${stars} star${stars === 1 ? "" : "s"}` : open ? "not built yet" : "locked"}`;
    const pad = `<ellipse cx="${n.x}" cy="${n.ground + 4}" rx="20" ry="8" fill="${shade(theme.edge, 0.8)}"/>
      <ellipse cx="${n.x}" cy="${n.ground}" rx="20" ry="8" fill="${open ? "#ffffff" : "#e2e4e9"}" stroke="${theme.edge}" stroke-width="1.5"/>`;
    const empty = `<text x="${n.x}" y="${n.ground + 4}" text-anchor="middle" font-size="10" font-weight="700" fill="${shade(theme.edge, 0.7)}">${open ? n.level : "🔒"}</text>`;
    let body = empty;
    if (stars) {
      const drawn = building(district.id, n.x, n.ground, n.skill, n.level, stars, skillTier(player, n.skill.id) === 3);
      body = rising === `${n.skill.id}-${n.level}` ? `<g class="rise">${drawn}</g>` : drawn;
    }
    const hit = `<rect class="lot-hit" data-skill="${n.skill.id}" data-level="${n.level}" x="${n.x - 22}" y="${n.ground - 86}" width="44" height="98" fill="transparent"><title>${esc(label)}</title></rect>`;
    if (!bySkill.has(n.skill.id)) bySkill.set(n.skill.id, { skill: n.skill, parts: [], xs: [], ground: n.ground });
    const group = bySkill.get(n.skill.id);
    group.parts.push(pad + body + hit);
    group.xs.push(n.x);
  }
  const skillGroups = [...bySkill.values()].map(({ skill, parts, xs, ground }) => {
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    return `<g data-skill="${skill.id}">${parts.join("")}<text x="${mid}" y="${ground + 26}" text-anchor="middle" font-size="11" font-weight="700" fill="#2c3e5c" stroke="#fff" stroke-width="3" paint-order="stroke" pointer-events="none">${esc(skill.short)}</text></g>`;
  }).join("");
  // Pip waits by the next level to play here (or at the end of the path once it's all built).
  const next = nodes.find((n) => isUnlocked(player, n.skill.id, n.level) && !levelStars(player, n.skill.id, n.level));
  const pipAt = next || nodes[nodes.length - 1];
  const showPip = player.settings?.pip !== false;
  const pip = !showPip ? "" : pipAt ? pipOnMap(pipAt.x + (pipAt.x > 300 ? -26 : 26), pipAt.ground + 12) : pipOnMap(300, park + 50);
  const nameW = district.name.length * 13.5 + 46;
  const entry = ENTRY[district.id];
  const signX = entry?.side === "top" && entry.x < 180 ? 350 - nameW : 10;
  const sign = district.id === "square" && !placed.length
    ? `<text x="180" y="${park + 42}" text-anchor="middle" class="park-sign">Town Square: build here with 🧱 bricks</text>` : "";
  return `${base}<g clip-path="url(#${clip})">
    <path d="${outline}" fill="${theme.top}"/>
    <g class="district-sign"><rect x="${signX}" y="14" width="${nameW}" height="38" rx="19" fill="#fff" opacity=".92"/>
      <text x="${signX + 12}" y="41" font-size="22" font-weight="700" fill="#2c3e5c" class="district-name">${district.emoji} ${esc(district.name)}</text></g>
    ${d ? `<g fill="none" stroke-linecap="round" stroke-linejoin="round" pointer-events="none">
      <path d="${d}" stroke="${shade(theme.edge, 0.75)}" stroke-width="22" transform="translate(0 4)"/>
      <path d="${d}" stroke="${theme.edge}" stroke-width="22"/><path d="${d}" stroke="${theme.path}" stroke-width="16"/>
      <path d="${d}" stroke="${theme.edge}" stroke-width="3" stroke-dasharray="1 11" opacity=".8"/></g>` : ""}
    <rect x="10" y="${park + 4}" width="340" height="${PARK - 8}" rx="16" fill="${district.ground}"/>
    ${sign}
    <rect x="8" y="${water + 2}" width="344" height="${BAND - 6}" rx="16" fill="${shade(district.water, 0.72)}"/>
    <rect x="8" y="${water + 6}" width="344" height="${BAND - 10}" rx="14" fill="${district.water}"/>${wave(water + 16, 20, 340)}
    ${skillGroups}
    ${placed.map((p) => decorSvg(p, at(p), { fresh })).join("")}
    ${pip}
  </g>`;
}

/* ==================== Grammar Island ==================== */

const MAP_W = 1300;
const MAP_H = 1450;
const SLOT_H = SCENE.park + 3 * ROW_H + 20 + PARK + BAND; // the tallest area (three rows of path)
// Where each area's plateau sits (top left), and the region around it: corners, clockwise.
const REGIONS = {
  port: { slot: [60, 130], poly: [[0, 0], [450, 0], [450, 570], [450, 712], [0, 712]] },
  works: { slot: [880, 130], poly: [[850, 0], [MAP_W, 0], [MAP_W, 712], [850, 712], [850, 570]] },
  square: { slot: [470, 596], poly: [[450, 570], [850, 570], [850, 712], [850, 812], [450, 812], [450, 712]] },
  studio: { slot: [60, 760], poly: [[0, 712], [450, 712], [450, 812], [450, MAP_H], [0, MAP_H]] },
  desk: { slot: [470, 862], poly: [[450, 812], [850, 812], [850, MAP_H], [450, MAP_H]] },
  flow: { slot: [880, 760], poly: [[850, 712], [MAP_W, 712], [MAP_W, MAP_H], [850, MAP_H], [850, 812]] },
  peaks: { poly: [[450, 0], [850, 0], [850, 570], [450, 570]] },
};
// The ground of each region, seen from above.
const LAND = { square: "#9fd17f", port: "#ecd79c", works: "#c2bb98", studio: "#eab9cc", flow: "#bcadde", desk: "#d3c193", peaks: "#a9c98f" };
const LAKE = [652, 470]; // the lake under Grammar Peaks

/** A border between regions, wiggled like a real one. The same two ends always give the same line. */
function edge(p, q) {
  const onRim = (a, b) => (a[0] === b[0] && (a[0] === 0 || a[0] === MAP_W)) || (a[1] === b[1] && (a[1] === 0 || a[1] === MAP_H));
  if (onRim(p, q)) return [p, q];
  const flip = p[0] > q[0] || (p[0] === q[0] && p[1] > q[1]);
  const [a, b] = flip ? [q, p] : [p, q];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(2, Math.round(len / 34));
  const nx = -(b[1] - a[1]) / len;
  const ny = (b[0] - a[0]) / len;
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const s = a[0] * 0.37 + a[1] * 0.71 + i * 1.9; // a seed from where the border is
    const off = i === 0 || i === n ? 0 : 7 * Math.sin(s) + 4 * Math.sin(s * 2.3 + 1);
    return [a[0] + (b[0] - a[0]) * t + nx * off, a[1] + (b[1] - a[1]) * t + ny * off];
  });
  return flip ? pts.reverse() : pts;
}

/** A closed, smooth path through points (Catmull-Rom as curves). */
function smoothPath(pts) {
  const p = (i) => pts[(i + pts.length) % pts.length];
  let d = `M${p(0)[0].toFixed(1)} ${p(0)[1].toFixed(1)}`;
  for (let i = 0; i < pts.length; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return `${d}Z`;
}

function regionPath(poly) {
  const pts = poly.flatMap((c, i) => edge(c, poly[(i + 1) % poly.length]).slice(0, -1));
  return `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`;
}

/** The coastline: a rounded shape with bays and headlands, well clear of every area. */
function coastPath() {
  const [x0, y0, x1, y1, r] = [18, 64, MAP_W - 18, MAP_H - 18, 90];
  const pts = [];
  const corners = [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]];
  let s = 0;
  const push = (x, y, nx, ny) => {
    s += 1;
    const off = 14 * Math.sin(s * 0.55) + 8 * Math.sin(s * 1.37 + 2);
    pts.push([x + nx * off, y + ny * off]);
  };
  corners.forEach(([cx, cy, a0], k) => {
    const [ex, ey] = corners[(k + 1) % 4];
    for (let a = a0; a < a0 + 90; a += 22.5) {
      const rad = (a * Math.PI) / 180;
      push(cx + r * Math.cos(rad), cy + r * Math.sin(rad), Math.cos(rad), Math.sin(rad));
    }
    const rad = ((a0 + 90) * Math.PI) / 180;
    const [nx, ny] = [Math.cos(rad), Math.sin(rad)];
    const [sx, sy, tx, ty] = [cx + r * nx, cy + r * ny, ex + r * nx, ey + r * ny];
    const steps = Math.round(Math.hypot(tx - sx, ty - sy) / 60);
    for (let i = 0; i < steps; i++) push(sx + ((tx - sx) * i) / steps, sy + ((ty - sy) * i) / steps, nx, ny);
  });
  return smoothPath(pts);
}

// Where flags go up (the top of the tallest peak first) and where boats float on the lake.
const FLAG_SPOTS = [[650, 132], [740, 142], [560, 172], [688, 186], [612, 196], [770, 196], [536, 222], [652, 228], [716, 236], [588, 252], [790, 250], [512, 280]];
const BOAT_SPOTS = [[600, 470], [700, 476], [652, 458], [566, 480], [740, 462], [628, 486], [680, 492], [720, 488]];
const FLAG_COLORS = ["#e85d4a", "#f2a900", "#3c6bc9", "#2e9d5b", "#8e5bd8", "#e86fa4"];

/** Grammar Peaks: mountains with a lit side and a shaded side, a lake below, and the flags and boats earned there. */
function peaksSvg(summits = 0, boats = 0) {
  const mountain = (x, base, w, h, snow) => `<path d="M${x - w / 2} ${base}L${x} ${base - h}L${x + w / 2} ${base}z" fill="#7d8f7a"/>
    <path d="M${x} ${base - h}L${x + w / 2} ${base}H${x + w * 0.08}z" fill="#5d6e5b"/>
    ${snow ? `<path d="M${x - w * 0.17} ${base - h * 0.66}L${x} ${base - h}L${x + w * 0.17} ${base - h * 0.66}l-${w * 0.06} 8l-${w * 0.06}-6l-${w * 0.05} 7z" fill="#fff"/>` : ""}`;
  const trees = [[500, 500], [540, 522], [800, 500], [770, 530], [560, 548], [740, 552]].map(([x, y]) =>
    `<ellipse cx="${x + 4}" cy="${y - 1}" rx="11" ry="3.5" fill="#000" opacity=".15"/><text x="${x}" y="${y}" text-anchor="middle" font-size="28">🌲</text>`).join("");
  const [lx, ly] = LAKE;
  return `<g class="peaks" pointer-events="none" aria-hidden="true">
    ${mountain(560, 340, 190, 170, true)}${mountain(740, 330, 200, 190, true)}${mountain(650, 370, 230, 240, true)}
    ${mountain(520, 410, 130, 90, false)}${mountain(790, 410, 140, 100, false)}
    <ellipse cx="${lx}" cy="${ly}" rx="118" ry="38" fill="#3f86c4"/><ellipse cx="${lx}" cy="${ly - 6}" rx="112" ry="32" fill="#6fb6e8"/>
    ${wave(ly - 10, lx - 62, lx + 48)}${trees}
    ${BOAT_SPOTS.slice(0, boats).map(([x, y], k) => `<text class="boat" x="${x}" y="${y}" text-anchor="middle" font-size="22">${["⛵", "🛶", "🚣"][k % 3]}</text>`).join("")}
    ${FLAG_SPOTS.slice(0, summits).map(([x, y], k) => `<g class="summit-flag"><path d="M${x} ${y}v-30" stroke="#5a3a22" stroke-width="2.5"/>
      <path d="M${x} ${y - 30}l18 6-18 6z" fill="${FLAG_COLORS[k % FLAG_COLORS.length]}"/></g>`).join("")}</g>`;
}

// Scenery scattered over each region's open ground.
const SCENERY = { square: ["🌳", "🌳", "🌷"], port: ["🌴", "🌴", "🐚"], works: ["🪨", "🌲", "🪨"], studio: ["🌸", "🌳", "🌷"], flow: ["🌲", "🌲", "🪨"], desk: ["🌳", "🌲", "🌳"] };

/** Trees, rocks and flowers on a region's open ground: not on an area, a road, a border or the beach. */
function scenerySvg(id, poly, boxes, roads) {
  const xs = poly.map((c) => c[0]);
  const ys = poly.map((c) => c[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs) + 30, Math.max(...xs) - 26, Math.min(...ys) + 40, Math.max(...ys) - 18];
  const kinds = SCENERY[id];
  const out = [];
  let k = 0;
  const nearRoad = (x, y) => roads.some((pts) => pts.some(([rx, ry]) => Math.hypot(rx - x, ry - y) < 34));
  for (let y = y0; y <= y1; y += 50) {
    for (let x = x0 + ((y / 50) % 2) * 26; x <= x1; x += 56) {
      k += 1;
      if (x < 90 || x > MAP_W - 80 || y < 130 || y > MAP_H - 66) continue; // the beach
      if (boxes.some((b) => x > b.x - 24 && x < b.x + b.w + 30 && y > b.y - 8 && y < b.y + b.h + 50)) continue;
      if ((k * 7) % 5 === 0 || nearRoad(x, y)) continue;
      const kind = kinds[k % kinds.length];
      const size = kind === "🐚" || kind === "🌷" ? 18 : 28;
      out.push(`<ellipse cx="${x + 4}" cy="${y - 1}" rx="${size * 0.38}" ry="3.5" fill="#000" opacity=".15"/><text x="${x}" y="${y}" text-anchor="middle" font-size="${size}">${kind}</text>`);
    }
  }
  return out.join("");
}

/**
 * Roads from the Town Square to where each area's path begins (and up to the lake shore), as cubic
 * curves. Each is also sampled into points, to keep scenery off it.
 */
function roadCurves(player, areas, districts) {
  const sq = areas.square;
  const curves = [];
  const exits = { left: [sq.x + 8, sq.y + 88], right: [sq.x + sq.w - 8, sq.y + 88], top: [sq.x + sq.w / 2, sq.y + 6], bottom: [sq.x + sq.w / 2, sq.y + sq.h - 6] };
  for (const d of districts) {
    if (d.id === "square") continue;
    const b = areas[d.id];
    let end;
    let into;
    if (d.locked) {
      end = [b.x + b.w / 2, b.y + 4];
      into = [0, -1];
    } else {
      const { start } = areaPath(d, player);
      end = [b.x + start[0], b.y + start[1]];
      const side = ENTRY[d.id].side;
      into = side === "top" ? [0, -1] : side === "left" ? [-1, 0] : [1, 0];
    }
    const from = end[0] < sq.x ? exits.left : end[0] > sq.x + sq.w ? exits.right : end[1] > sq.y ? exits.bottom : exits.top;
    const out = from === exits.left ? [-1, 0] : from === exits.right ? [1, 0] : from === exits.bottom ? [0, 1] : [0, -1];
    const k = Math.max(60, Math.hypot(end[0] - from[0], end[1] - from[1]) * 0.45);
    curves.push([from, [from[0] + out[0] * k, from[1] + out[1] * k], [end[0] + into[0] * k, end[1] + into[1] * k], end]);
  }
  curves.push([exits.top, [exits.top[0], exits.top[1] - 50], [LAKE[0], LAKE[1] + 90], [LAKE[0], LAKE[1] + 36]]);
  return curves;
}

function roadsSvg(curves) {
  const d = curves.map(([a, b, c, e]) => `M${a[0]} ${a[1]}C${b[0]} ${b[1]} ${c[0]} ${c[1]} ${e[0]} ${e[1]}`).join("");
  return `<g fill="none" stroke-linecap="round" pointer-events="none">
    <path d="${d}" stroke="#5c6573" stroke-width="30" transform="translate(0 5)"/><path d="${d}" stroke="#e9e3d4" stroke-width="30"/>
    <path d="${d}" stroke="#7f8997" stroke-width="22"/><path d="${d}" stroke="#ffffff" stroke-width="2.5" stroke-dasharray="12 12"/></g>`;
}

const sampleCurve = ([a, b, c, e]) => Array.from({ length: 25 }, (_, i) => {
  const t = i / 24;
  const u = 1 - t;
  return [0, 1].map((j) => u * u * u * a[j] + 3 * u * u * t * b[j] + 3 * u * t * t * c[j] + t * t * t * e[j]);
});

/** Where each area sits on the island, and the island's size. */
export function mapLayout(player) {
  const districts = mapDistricts(player);
  const areas = {};
  for (const d of districts) {
    const [x, y] = REGIONS[d.id].slot;
    const h = districtHeight(d, player);
    const room = d.id === "square" ? SCENE.height : SLOT_H;
    areas[d.id] = { x, y: y + Math.round((room - h) / 2), w: 360, h };
  }
  areas.peaks = { x: 470, y: 110, w: 360, h: 450 }; // Grammar Peaks: nothing to build, but it can be visited
  return { width: MAP_W, height: MAP_H, areas, districts };
}

/**
 * Grammar Island: a region for the Town Square and one for each world, around Grammar Peaks, joined by
 * roads. The home screen pans and zooms it by changing the viewBox.
 */
export function townSvg(player, { fresh = null, rising = null } = {}) {
  const layout = mapLayout(player);
  const open = layout.districts.filter((d) => !d.locked);
  const shownSkills = open.flatMap((d) => districtSkills(d, player));
  const built = shownSkills.reduce((n, skill) => n + [1, 2, 3].filter((level) => levelStars(player, skill.id, level)).length, 0);
  const total = shownSkills.length * 3;
  const coast = coastPath();
  const regions = Object.entries(REGIONS).filter(([id]) => id === "peaks" || layout.areas[id]).map(([id, r]) => {
    const d = layout.districts.find((x) => x.id === id);
    const fill = d?.locked ? "#c9ced6" : LAND[id];
    return `<path class="region district" data-area="${id}" d="${regionPath(r.poly)}" fill="${fill}"/>`;
  }).join("");
  const borders = Object.values(REGIONS).map((r) => `<path d="${regionPath(r.poly)}"/>`).join("");
  const curves = roadCurves(player, layout.areas, layout.districts);
  const roadPts = curves.map(sampleCurve);
  const boxes = layout.districts.map((d) => layout.areas[d.id]);
  const plots = layout.districts.map((d) => {
    const b = layout.areas[d.id];
    return `<g class="district${d.locked ? " locked" : ""}" data-area="${d.id}" transform="translate(${b.x} ${b.y})">${districtSvg(player, d, { fresh, rising })}</g>`;
  }).join("");
  // Big name flags, for seeing the whole island at once (they fade once zoomed in).
  const flags = [...layout.districts.map((d) => ({ id: d.id, text: `${d.locked ? "🔒" : d.emoji} ${d.name}`, box: layout.areas[d.id] })),
    { id: "peaks", text: "⛰️ Grammar Peaks", box: { x: 470, y: 60, w: 360, h: 0 } }].map(({ id, text, box: b }) => {
    const w = text.length * 21 + 40;
    const cy = id === "peaks" ? 150 : b.y + Math.min(b.h / 2, 150);
    return `<g class="region-label" pointer-events="none"><rect x="${b.x + 180 - w / 2}" y="${cy - 34}" width="${w}" height="64" rx="32" fill="#fff" opacity=".92"/>
      <text x="${b.x + 180}" y="${cy + 12}" text-anchor="middle" font-size="38" font-weight="700" fill="#1d2b4f">${esc(text)}</text></g>`;
  }).join("");
  return `<svg class="town town-map" viewBox="0 0 ${MAP_W} ${MAP_H}" role="img" aria-label="Grammar Island: ${built} of ${total} buildings built">
    <defs><clipPath id="island"><path d="${coast}"/></clipPath>
      <radialGradient id="sun" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <rect x="-3000" y="-3000" width="${MAP_W + 6000}" height="${MAP_H + 6000}" fill="#5aa7de"/>
    ${[[120, 34], [980, 26], [40, 700], [1240, 520], [300, 1440], [1100, 1436]].map(([x, y]) => wave(y, x, x + 90)).join("")}
    <path d="${coast}" fill="#2f6f9e" opacity=".45" transform="translate(10 30)"/>
    <path d="${coast}" fill="#8a6342" transform="translate(0 22)"/>
    <path d="${coast}" fill="#a57a52" transform="translate(0 12)"/>
    <g clip-path="url(#island)">${regions}
      <g fill="none" stroke="#ffffff" stroke-opacity=".75" stroke-width="5" stroke-dasharray="14 10" stroke-linecap="round" pointer-events="none">${borders}</g>
      ${peaksSvg(player.summits || 0, player.lakeWins || 0)}${roadsSvg(curves)}
      <g class="scenery" pointer-events="none" aria-hidden="true">${layout.districts.map((d) => scenerySvg(d.id, REGIONS[d.id].poly, boxes, roadPts)).join("")}</g></g>
    <path d="${coast}" fill="none" stroke="#f3e2ae" stroke-width="16"/>
    <path d="${coast}" fill="none" stroke="#ffffff" stroke-opacity=".6" stroke-width="3" transform="translate(0 -1)"/>
    <rect width="${MAP_W}" height="${MAP_H}" fill="url(#sun)" pointer-events="none"/>
    ${plots}
    ${flags}
  </svg>`;
}

/** Close-up of one district's decorations for the Build screen: sky, park and water, where kids drag things. */
export function parkSvg(player, { area = "square", fresh = null, selected = null } = {}) {
  const district = DISTRICTS.find((d) => d.id === area) || DISTRICTS[0];
  const placed = placedDecor(player, district.id);
  const { park, water, height } = SCENE;
  return `<svg class="town park-view" viewBox="0 0 360 ${height}" role="group" aria-label="${esc(district.name)}: ${placed.length} decoration${placed.length === 1 ? "" : "s"}. Drag one to move it.">
    <defs><linearGradient id="park-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe6ff"/><stop offset="1" stop-color="#eef6ff"/></linearGradient></defs>
    <rect width="360" height="${park}" fill="url(#park-sky)"/>
    <circle cx="330" cy="20" r="10" fill="#ffd54f"/>
    <rect y="${park - 8}" width="360" height="8" fill="#c9c3b5"/>
    <rect y="${park}" width="360" height="${water - park}" fill="${district.ground}"/>
    <path d="M0 ${park + 46}h360" stroke="#ffffff" stroke-opacity=".35" stroke-width="10"/>
    ${placed.length ? "" : `<text x="180" y="${park + 42}" text-anchor="middle" class="park-sign">${esc(district.name)}: build here with 🧱 bricks</text>`}
    <rect y="${water}" width="360" height="${height - water}" fill="${district.water}"/><rect y="${water}" width="360" height="6" fill="${shade(district.water, 0.75)}"/>${wave(water + 12)}
    ${placed.map((p) => decorSvg(p, p.y, { fresh, drag: true, selected })).join("")}
  </svg>`;
}
