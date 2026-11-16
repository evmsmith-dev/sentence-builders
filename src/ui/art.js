// Drawings made in code: Pip the foreman robot and the player's town.
import { DECOR, DISTRICTS, SCENE, WORLDS, skillsInWorldFor, worldOpenFor } from "../config.js";
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
const PER_STREET = 3; // skills that fit across one street
const ROW = 126; // height of one street: buildings, then grass with the labels

const D = 7; // depth of the side walls: drawn back and up to the right, so the town looks raised
const DY = 4;

/** A color made darker (f < 1) or lighter (f > 1), for shaded sides. */
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1)).toString(16).padStart(2, "0");
  return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

/** A box's right side and the shadow it casts on the ground. */
const sideWall = (x, top, ground, fill) => `<path d="M${x} ${ground}l${D} ${-DY}V${top - DY}l${-D} ${DY}z" fill="${fill}"/>`;
const groundShadow = (left, right, ground, h) => `<path d="M${left} ${ground}H${right}l${D + h * 0.35} ${-DY - 2}H${left + D + 4}z" fill="#000" opacity=".14"/>`;

function building(x, ground, skill, level, stars, gold) {
  const color = skill.color;
  const cx = x + LOT_W / 2;
  const star = stars ? `<text x="${cx}" y="${ground - [36, 54, 76][level - 1] - 6}" text-anchor="middle" font-size="9" fill="#f2a900">${"★".repeat(stars)}</text>` : "";
  if (level === 3 && gold) {
    // A lighthouse: the landmark for a mastered skill.
    return `<g>${groundShadow(cx - 9, cx + 9, ground, 62)}<path d="M${cx + 9} ${ground}L${cx + 6} ${ground - 62}h4L${cx + 13} ${ground - 3}z" fill="#c9d3e3"/>
      <path d="M${cx - 9} ${ground}L${cx - 6} ${ground - 62}h12L${cx + 9} ${ground}z" fill="#fff" stroke="${color}" stroke-width="2"/>
      <rect x="${cx - 7}" y="${ground - 44}" width="14" height="7" fill="${color}"/><rect x="${cx - 8}" y="${ground - 24}" width="16" height="7" fill="${color}"/>
      <rect x="${cx - 7}" y="${ground - 72}" width="14" height="10" rx="2" fill="#ffd54f" stroke="${color}" stroke-width="2"/>
      <path d="M${cx - 9} ${ground - 72}l9-8 9 8z" fill="${color}"/>${star}</g>`;
  }
  const h = [26, 44, 64][level - 1];
  const w = [26, 28, 24][level - 1];
  const left = cx - w / 2;
  const windows = Array.from({ length: level }, (_, row) =>
    `<rect x="${left + 5}" y="${ground - h + 7 + row * 18}" width="6" height="6" rx="1" fill="#fff8d6"/><rect x="${left + w - 11}" y="${ground - h + 7 + row * 18}" width="6" height="6" rx="1" fill="#fff8d6"/>`).join("");
  const top = ground - h;
  const right = left + w;
  // Front wall, a darker side wall, and a gable roof whose slope runs back to the right.
  return `<g>${groundShadow(left, right, ground, h)}${sideWall(right, top, ground, shade(color, 0.68))}
    <rect x="${left}" y="${top}" width="${w}" height="${h}" fill="${color}"/>
    <rect x="${left}" y="${top}" width="3" height="${h}" fill="#fff" opacity=".18"/>
    <path d="M${cx} ${top - 10}l${D} ${-DY}L${right + 3 + D} ${top - DY}L${right + 3} ${top}z" fill="#6e2c22"/>
    <path d="M${left - 3} ${top}L${cx} ${top - 10}L${right + 3} ${top}z" fill="#9c4434"/>${windows}
    <rect x="${cx - 3.5}" y="${ground - 10}" width="7" height="10" rx="1" fill="#5a3a22"/>${star}</g>`;
}

/** An empty lot: a flat foundation marked out on the ground. */
function emptyLot(x, ground) {
  return `<path d="M${x + 4} ${ground - 1}h${LOT_W - 12}l${D} ${-DY * 2}h${-(LOT_W - 12)}z" fill="#ffffff" fill-opacity=".35" stroke="#7f8ea8" stroke-width="1.3" stroke-dasharray="3 2.5"/>`;
}

/** One street: one block per skill in the world, one lot per level. Each lot has a tap target for the map. */
function street(player, ground, rising, skills) {
  const blockW = LOT_W * 3 + 10;
  const start = (360 - skills.length * blockW + 10) / 2;
  const blocks = skills.map((skill, b) => {
    const x0 = start + b * blockW;
    const gold = skillTier(player, skill.id) === 3;
    const lots = [1, 2, 3].map((level) => {
      const stars = levelStars(player, skill.id, level);
      const x = x0 + (level - 1) * LOT_W;
      const label = `${skill.name}, level ${level}, ${stars ? `${stars} star${stars === 1 ? "" : "s"}` : "not built yet"}`;
      const hit = `<rect class="lot-hit" data-skill="${skill.id}" data-level="${level}" x="${x}" y="${ground - 84}" width="${LOT_W}" height="${102}" fill="transparent"><title>${esc(label)}</title></rect>`;
      if (!stars) return emptyLot(x, ground) + hit;
      const drawn = building(x, ground, skill, level, stars, gold);
      // The building just earned rises out of the ground (only when motion is allowed).
      return (rising === `${skill.id}-${level}` ? `<g class="rise">${drawn}</g>` : drawn) + hit;
    }).join("");
    return `<g data-skill="${skill.id}">${lots}<text x="${x0 + (LOT_W * 3) / 2}" y="${ground + 15}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#ffffff" pointer-events="none">${esc(skill.short)}</text></g>`;
  }).join("");
  // The street's top, then its front edge in shade, so it reads as a raised strip.
  return `<rect y="${ground - 8}" width="360" height="8" fill="#e9e3d4"/><rect y="${ground}" width="360" height="22" fill="#7f8997"/>
    <rect y="${ground + 22}" width="360" height="5" fill="#5c6573"/>${blocks}`;
}

const PARK = SCENE.water - SCENE.park; // the park strip under a district's streets
const BAND = SCENE.height - SCENE.water; // the lake along the bottom of each district

/** Placed decorations in one district with their catalog entry, drawn back to front (lower is nearer). */
function placedDecor(player, area) {
  return (player.decor || []).filter((p) => typeof p === "object" && (p.area || "square") === area)
    .map((p) => ({ ...p, item: DECOR.find((d) => d.id === p.id) }))
    .filter((p) => p.item)
    .sort((a, b) => a.y - b.y);
}

/** One decoration as an emoji; `fresh` pops in (just built). In the Build close-up it can be dragged. */
function decorSvg(p, y, { fresh = null, drag = false, selected = null, walk = true } = {}) {
  const d = p.item;
  const cls = ["decor", walk && d.walk ? "walk" : "", p.uid === fresh ? "pop" : "", drag ? "drag" : "", p.uid === selected ? "selected" : ""].filter(Boolean).join(" ");
  const size = d.zone === "square" && d.row === "back" ? 30 : 26;
  const handle = drag ? ` data-uid="${p.uid}" tabindex="0" role="button" aria-label="${d.name}: drag to move, or tap to select"` : "";
  const shadow = p.y >= SCENE.park ? `<ellipse cx="${p.x + 3}" cy="${y - 1}" rx="${size * 0.4}" ry="3.5" fill="#000" opacity=".16"/>` : "";
  if (!drag) return `<g class="${cls}">${shadow}<text x="${p.x}" y="${y}" text-anchor="middle" font-size="${size}">${d.emoji}<title>${d.name}</title></text></g>`;
  return `${shadow.replace("<ellipse", `<ellipse data-shadow="${p.uid}"`)}<text class="${cls}" x="${p.x}" y="${y}" text-anchor="middle" font-size="${size}"${handle}>${d.emoji}<title>${d.name}</title></text>`;
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

/** Districts on this player's map. One whose world isn't open yet (grade) shows as a locked region. */
export function mapDistricts(player) {
  return DISTRICTS.filter((d) => !d.world || WORLDS.find((w) => w.id === d.world)?.ready)
    .map((d) => ({ ...d, locked: Boolean(d.world) && !worldOpenFor(WORLDS.find((w) => w.id === d.world), player) }));
}

function districtHeight(district, player) {
  if (district.locked) return SCENE.height;
  const streets = Math.ceil(districtSkills(district, player).length / PER_STREET);
  return streets ? SCENE.park + 92 + (streets - 1) * ROW + 32 + PARK + BAND : SCENE.height;
}

/* ---- The island: a fixed geography. Each district is a region with its town plot in the middle. ---- */
const MAP_W = 1300;
const MAP_H = 1320;
const SLOT_H = SCENE.park + 92 + ROW + 32 + PARK + BAND; // the tallest town plot (two streets)
// Where each district's town plot sits (top left), and the region around it: corners, clockwise.
const REGIONS = {
  port: { slot: [70, 150], poly: [[0, 0], [450, 0], [450, 540], [450, 650], [0, 650]] },
  works: { slot: [870, 150], poly: [[850, 0], [1300, 0], [1300, 650], [850, 650], [850, 540]] },
  square: { slot: [470, 562], poly: [[450, 540], [850, 540], [850, 650], [850, 770], [450, 770], [450, 650]] },
  studio: { slot: [70, 742], poly: [[0, 650], [450, 650], [450, 770], [450, 1320], [0, 1320]] },
  desk: { slot: [470, 820], poly: [[450, 770], [850, 770], [850, 1320], [450, 1320]] },
  flow: { slot: [870, 742], poly: [[850, 650], [1300, 650], [1300, 1320], [850, 1320], [850, 770]] },
  peaks: { poly: [[450, 0], [850, 0], [850, 540], [450, 540]] },
};
// The ground of each region, seen from above.
const LAND = { square: "#9fd17f", port: "#ecd79c", works: "#c2bb98", studio: "#eab9cc", flow: "#bcadde", desk: "#d3c193", peaks: "#a9c98f" };

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

/** The coastline: a rounded shape with bays and headlands, well clear of every town plot. */
function coastPath() {
  const [x0, y0, x1, y1, r] = [22, 72, MAP_W - 22, MAP_H - 22, 90];
  const pts = [];
  const corners = [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]];
  let s = 0;
  const push = (x, y, nx, ny) => {
    s += 1;
    const off = 16 * Math.sin(s * 0.55) + 9 * Math.sin(s * 1.37 + 2);
    pts.push([x + nx * off, y + ny * off]);
  };
  corners.forEach(([cx, cy, a0], k) => {
    const [ex, ey] = corners[(k + 1) % 4];
    for (let a = a0; a < a0 + 90; a += 22.5) {
      const rad = (a * Math.PI) / 180;
      push(cx + r * Math.cos(rad), cy + r * Math.sin(rad), Math.cos(rad), Math.sin(rad));
    }
    // The straight run to the next corner.
    const rad = ((a0 + 90) * Math.PI) / 180;
    const [nx, ny] = [Math.cos(rad), Math.sin(rad)];
    const sx = cx + r * nx;
    const sy = cy + r * ny;
    const tx = ex + r * nx;
    const ty = ey + r * ny;
    const steps = Math.round(Math.hypot(tx - sx, ty - sy) / 60);
    for (let i = 0; i < steps; i++) push(sx + ((tx - sx) * i) / steps, sy + ((ty - sy) * i) / steps, nx, ny);
  });
  return smoothPath(pts);
}

/** Grammar Peaks: mountains with a lit side and a shaded side, and a lake below them. */
function peaksSvg() {
  const mountain = (x, base, w, h, snow) => `<path d="M${x - w / 2} ${base}L${x} ${base - h}L${x + w / 2} ${base}z" fill="#7d8f7a"/>
    <path d="M${x} ${base - h}L${x + w / 2} ${base}H${x + w * 0.08}z" fill="#5d6e5b"/>
    ${snow ? `<path d="M${x - w * 0.17} ${base - h * 0.66}L${x} ${base - h}L${x + w * 0.17} ${base - h * 0.66}l-${w * 0.06} 8l-${w * 0.06}-6l-${w * 0.05} 7z" fill="#fff"/>` : ""}`;
  const trees = [[500, 470], [540, 492], [790, 470], [760, 500], [612, 506], [700, 512]].map(([x, y]) =>
    `<ellipse cx="${x + 4}" cy="${y - 1}" rx="11" ry="3.5" fill="#000" opacity=".15"/><text x="${x}" y="${y}" text-anchor="middle" font-size="28">🌲</text>`).join("");
  return `<g class="peaks" pointer-events="none" aria-hidden="true">
    ${mountain(560, 330, 190, 170, true)}${mountain(740, 320, 200, 190, true)}${mountain(650, 360, 230, 240, true)}
    ${mountain(520, 400, 130, 90, false)}${mountain(790, 400, 140, 100, false)}
    <ellipse cx="652" cy="446" rx="118" ry="38" fill="#3f86c4"/><ellipse cx="652" cy="440" rx="112" ry="32" fill="#6fb6e8"/>
    ${wave(436, 590, 700)}${trees}</g>`;
}

// Scenery scattered over each region's open ground.
const SCENERY = { square: ["🌳", "🌳", "🌷"], port: ["🌴", "🌴", "🐚"], works: ["🪨", "🌲", "🪨"], studio: ["🌸", "🌳", "🌷"], flow: ["🌲", "🌲", "🪨"], desk: ["🌳", "🌲", "🌳"] };

/** Trees, rocks and flowers on a region's open ground: not on a town plot, a border or the beach. */
function scenerySvg(id, poly, boxes) {
  const xs = poly.map((c) => c[0]);
  const ys = poly.map((c) => c[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs) + 30, Math.max(...xs) - 26, Math.min(...ys) + 40, Math.max(...ys) - 18];
  const kinds = SCENERY[id];
  const out = [];
  let k = 0;
  for (let y = y0; y <= y1; y += 50) {
    for (let x = x0 + ((y / 50) % 2) * 26; x <= x1; x += 56) {
      k += 1;
      if (x < 90 || x > MAP_W - 80 || y < 140 || y > MAP_H - 70) continue; // the beach
      if (boxes.some((b) => x > b.x - 22 && x < b.x + b.w + 22 && y > b.y - 6 && y < b.y + b.h + 40)) continue;
      if ((k * 7) % 5 === 0) continue; // gaps, so it looks natural
      const kind = kinds[k % kinds.length];
      const size = kind === "🐚" || kind === "🌷" ? 18 : 28;
      out.push(`<ellipse cx="${x + 4}" cy="${y - 1}" rx="${size * 0.38}" ry="3.5" fill="#000" opacity=".15"/><text x="${x}" y="${y}" text-anchor="middle" font-size="${size}">${kind}</text>`);
    }
  }
  return out.join("");
}

/** Winding roads from the Town Square out to every district (and up to the lake). */
function roadsSvg(areas) {
  const sq = areas.square;
  const mid = (b, side) => [b.x + b.w / 2, side === "top" ? b.y : b.y + b.h];
  const roads = [];
  const add = (a, b, bend) => roads.push(`M${a[0]} ${a[1]}C${a[0] + bend[0]} ${a[1] + bend[1]} ${b[0] - bend[2]} ${b[1] - bend[3]} ${b[0]} ${b[1]}`);
  const left = [sq.x + 10, sq.y + sq.h / 2];
  const right = [sq.x + sq.w - 10, sq.y + sq.h / 2];
  if (areas.port) add(left, mid(areas.port, "bottom"), [-140, 0, 20, -90]);
  if (areas.studio) add(left, mid(areas.studio, "top"), [-140, 0, 20, 90]);
  if (areas.works) add(right, mid(areas.works, "bottom"), [140, 0, -20, -90]);
  if (areas.flow) add(right, mid(areas.flow, "top"), [140, 0, -20, 90]);
  if (areas.desk) add(mid(sq, "bottom"), mid(areas.desk, "top"), [30, 40, -30, 40]);
  add(mid(sq, "top"), [652, 478], [-30, -30, 30, 30]);
  const d = roads.join("");
  return `<g fill="none" stroke-linecap="round" pointer-events="none">
    <path d="${d}" stroke="#5c6573" stroke-width="30" transform="translate(0 5)"/><path d="${d}" stroke="#e9e3d4" stroke-width="30"/>
    <path d="${d}" stroke="#7f8997" stroke-width="22"/><path d="${d}" stroke="#ffffff" stroke-width="2.5" stroke-dasharray="12 12"/></g>`;
}

/** Where each district's town plot sits on the island, and the island's size. */
export function mapLayout(player) {
  const districts = mapDistricts(player);
  const areas = {};
  for (const d of districts) {
    const [x, y] = REGIONS[d.id].slot;
    const h = districtHeight(d, player);
    const room = d.id === "square" ? SCENE.height : SLOT_H;
    areas[d.id] = { x, y: y + Math.round((room - h) / 2), w: 360, h };
  }
  return { width: MAP_W, height: MAP_H, areas, districts };
}

/** One district's town plot, drawn at 0,0 and 360 wide: a raised plot with its streets, park and lake. */
function districtSvg(player, district, { fresh, rising }) {
  const h = districtHeight(district, player);
  const clip = `clip-${district.id}`;
  const land = LAND[district.id];
  // The plot is a raised slab: its front face shows below, and it casts a shadow on the region.
  const frame = `<clipPath id="${clip}"><rect width="360" height="${h}" rx="22"/></clipPath>`;
  if (district.locked) {
    const world = WORLDS.find((w) => w.id === district.world);
    return `${frame}<rect width="360" height="${h}" rx="22" fill="#dfe3ea"/>
      <rect width="360" height="${h}" rx="22" fill="none" stroke="#a9b4c6" stroke-width="3" stroke-dasharray="10 8"/>
      <text x="180" y="78" text-anchor="middle" font-size="26" font-weight="700" fill="#5b6b85">🔒 ${esc(district.name)}</text>
      <text x="180" y="110" text-anchor="middle" font-size="15" fill="#5b6b85">Opens in grade ${world.minGrade}</text>`;
  }
  const skills = districtSkills(district, player);
  const streets = Array.from({ length: Math.ceil(skills.length / PER_STREET) }, (_, k) => skills.slice(k * PER_STREET, (k + 1) * PER_STREET));
  const grounds = streets.map((_, r) => SCENE.park + 92 + r * ROW);
  const park = streets.length ? grounds[grounds.length - 1] + 32 : SCENE.park;
  const water = park + PARK;
  const placed = placedDecor(player, district.id);
  // Decorations keep their spot from the Build screen: high ones near the top, the rest in the park and lake.
  const at = (p) => (p.y < SCENE.park ? p.y : park + (p.y - SCENE.park));
  const sign = district.id === "square" && !placed.length
    ? `<text x="180" y="${park + 42}" text-anchor="middle" class="park-sign">Town park: build here with 🧱 bricks</text>` : "";
  const nameW = district.name.length * 13.5 + 46;
  return `${frame}<g clip-path="url(#${clip})">
    <g class="district-sign"><rect x="10" y="14" width="${nameW}" height="38" rx="19" fill="#fff" opacity=".9"/>
    <text x="22" y="41" font-size="22" font-weight="700" fill="#2c3e5c" class="district-name">${district.emoji} ${esc(district.name)}</text></g>
    ${streets.map((st, r) => street(player, grounds[r], rising, st)).join("")}
    <rect x="8" y="${park + 2}" width="344" height="${PARK - 6}" rx="16" fill="${district.ground}"/>
    <rect x="8" y="${park + PARK - 10}" width="344" height="6" rx="3" fill="#000" opacity=".08"/>
    ${sign}
    <rect x="6" y="${water + 2}" width="348" height="${BAND - 8}" rx="16" fill="${shade(district.water, 0.72)}"/>
    <rect x="6" y="${water + 6}" width="348" height="${BAND - 12}" rx="14" fill="${district.water}"/>${wave(water + 16, 20, 340)}
    ${placed.map((p) => decorSvg(p, at(p), { fresh })).join("")}
  </g>`;
}

/**
 * The player's town map: an island with a region for the Town Square and one for each world, around
 * Grammar Peaks. The home screen pans and zooms it by changing the viewBox.
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
    return `<path class="region${d ? " district" : ""}" ${d ? `data-area="${id}"` : ""} d="${regionPath(r.poly)}" fill="${fill}"/>`;
  }).join("");
  const borders = Object.values(REGIONS).map((r) => `<path d="${regionPath(r.poly)}"/>`).join("");
  const plots = layout.districts.map((d) => {
    const box = layout.areas[d.id];
    return `<g class="district${d.locked ? " locked" : ""}" data-area="${d.id}" transform="translate(${box.x} ${box.y})">${districtSvg(player, d, { fresh, rising })}</g>`;
  }).join("");
  // Big name flags, for seeing the whole island at once (hidden once zoomed in).
  const flags = [...layout.districts.map((d) => ({ id: d.id, text: `${d.locked ? "🔒" : d.emoji} ${d.name}`, box: layout.areas[d.id] })),
    { id: "peaks", text: "⛰️ Grammar Peaks", box: { x: 470, y: 60, w: 360, h: 0 } }].map(({ id, text, box }) => {
    const w = text.length * 21 + 40;
    const cy = id === "peaks" ? 150 : box.y + Math.min(box.h / 2, 150);
    return `<g class="region-label" pointer-events="none"><rect x="${box.x + 180 - w / 2}" y="${cy - 34}" width="${w}" height="64" rx="32" fill="#fff" opacity=".92"/>
      <text x="${box.x + 180}" y="${cy + 12}" text-anchor="middle" font-size="38" font-weight="700" fill="#1d2b4f">${esc(text)}</text></g>`;
  }).join("");
  return `<svg class="town town-map" viewBox="0 0 ${MAP_W} ${MAP_H}" role="img" aria-label="Your town: ${built} of ${total} buildings built">
    <defs><clipPath id="island"><path d="${coast}"/></clipPath>
      <radialGradient id="sun" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <rect x="-3000" y="-3000" width="${MAP_W + 6000}" height="${MAP_H + 6000}" fill="#5aa7de"/>
    ${[[120, 40], [980, 30], [60, 700], [1250, 520], [300, 1306], [1100, 1300]].map(([x, y]) => wave(y, x, x + 90)).join("")}
    <path d="${coast}" fill="#2f6f9e" opacity=".45" transform="translate(10 30)"/>
    <path d="${coast}" fill="#8a6342" transform="translate(0 22)"/>
    <path d="${coast}" fill="#a57a52" transform="translate(0 12)"/>
    <g clip-path="url(#island)">${regions}
      <g fill="none" stroke="#ffffff" stroke-opacity=".75" stroke-width="5" stroke-dasharray="14 10" stroke-linecap="round" pointer-events="none">${borders}</g>
      ${peaksSvg()}${roadsSvg(layout.areas)}
      <g class="scenery" pointer-events="none" aria-hidden="true">${layout.districts.map((d) => scenerySvg(d.id, REGIONS[d.id].poly, Object.values(layout.areas))).join("")}</g></g>
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
    ${placed.map((p) => decorSvg(p, p.y, { fresh, drag: true, selected, walk: false })).join("")}
  </svg>`;
}
