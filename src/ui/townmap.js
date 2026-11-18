// Pan and zoom for the town map (the same feel as the World Geography map): drag to pan, pinch or
// ctrl+wheel to zoom, and + − ⤢ buttons. The first tap on a district zooms in to it; once zoomed in,
// tapping a building or an empty lot asks for that skill's level card.

const TAP = 8; // a press that moves less than this many pixels is a tap, not a drag
const MIN_W = 170; // closest zoom, in map units across
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * box: the element the SVG is drawn into. buttons: { zIn, zOut, zFit }.
 * onArea(id|null): the district in view changed (null: the whole map). onLot(skillId, level): a lot was tapped.
 * onBoard(): the Town Square's Notice Board was tapped. onPeak("summit"|"lake"): a peak or the lake was tapped.
 */
export function createTownMap(box, buttons, { onArea, onLot, onBoard = () => {}, onPeak = () => {}, insets = () => null }) {
  let svg = null;
  let layout = null;
  let vb = { x: 0, y: 0, w: 1, h: 1 };
  let anim = 0;
  let area = null;

  const aspect = () => {
    const r = box.getBoundingClientRect();
    return r.width && r.height ? r.height / r.width : 1.3;
  };
  const fitW = () => Math.max(layout.width, layout.height / aspect());
  const clampW = (w) => Math.min(fitW(), Math.max(MIN_W, w));
  // Closer than this counts as "inside a district" (a district fills the view; the island is far smaller).
  const zoomedIn = (w = vb.w) => w < fitW() * 0.6;

  function setVB(v) {
    if (!svg) return;
    const w = clampW(v.w);
    const h = w * aspect();
    // Smaller than the map: keep inside it. Bigger: center it, with sea around.
    // (Zoomed in on Island Home, the view may go a little past the edge, by what the floating buttons cover.)
    const sl = zoomedIn(w) ? slack : {};
    const x = w >= layout.width ? (layout.width - w) / 2 : Math.min(layout.width - w + (sl.right || 0), Math.max(-(sl.left || 0), v.x));
    const y = h >= layout.height ? (layout.height - h) / 2 : Math.min(layout.height - h + (sl.bottom || 0), Math.max(-(sl.top || 0), v.y));
    vb = { x, y, w, h };
    svg.setAttribute("viewBox", `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
    const full = w >= fitW() - 0.5;
    buttons.zOut.disabled = full;
    buttons.zFit.disabled = full;
    buttons.zIn.disabled = w <= MIN_W + 0.5;
    svg.classList.toggle("zoomed", zoomedIn(w));
  }

  function animateTo(t, done) {
    cancelAnimationFrame(anim);
    if (reduceMotion()) {
      setVB(t);
      done?.();
      return;
    }
    const from = { ...vb };
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / 280);
      const e = 1 - (1 - k) ** 3;
      setVB({ x: from.x + (t.x - from.x) * e, y: from.y + (t.y - from.y) * e, w: from.w + (t.w - from.w) * e });
      if (k < 1) anim = requestAnimationFrame(tick);
      else done?.();
    };
    anim = requestAnimationFrame(tick);
  }

  const zoomTarget = (k, px = vb.x + vb.w / 2, py = vb.y + vb.h / 2) => {
    const w = clampW(vb.w / k);
    const f = w / vb.w;
    return { x: px - (px - vb.x) * f, y: py - (py - vb.y) * f, w };
  };

  /** The view that fits one district, with a little room around it. */
  // Island Home: the tools row, Pip and the buttons float over the map, so a district is fitted into the part of the
  // screen they leave free (on iPad, the place's name sign sat under the tools row).
  let slack = { top: 0, left: 0 };
  function districtView(id) {
    const b = layout.areas[id];
    const r = box.getBoundingClientRect();
    const i = (r.width && insets()) || null;
    if (!i) {
      slack = { top: 0, left: 0 };
      const w = clampW(Math.max(b.w + 24, (b.h + 24) / aspect()));
      return { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - (w * aspect()) / 2, w };
    }
    const freeW = Math.max(120, r.width - i.left - i.right);
    const freeH = Math.max(120, r.height - i.top - i.bottom);
    const units = Math.max((b.w + 24) / freeW, (b.h + 24) / freeH); // map units per pixel
    const w = clampW(units * r.width);
    const k = w / r.width;
    slack = { top: i.top * k, left: i.left * k, right: i.right * k, bottom: i.bottom * k };
    return { x: b.x + b.w / 2 - (i.left + freeW / 2) * k, y: b.y + b.h / 2 - (i.top + freeH / 2) * k, w };
  }

  function report(next) {
    if (next === area) return;
    area = next;
    onArea(area);
  }

  /** Which district is in view: the one under the middle of the view, once zoomed in. */
  function settle() {
    if (!zoomedIn()) return report(null);
    const cx = vb.x + vb.w / 2;
    const cy = vb.y + vb.h / 2;
    const hit = Object.entries(layout.areas).find(([, b]) => cx >= b.x - 16 && cx <= b.x + b.w + 16 && cy >= b.y - 16 && cy <= b.y + b.h + 16);
    report(hit ? hit[0] : area);
  }

  function focus(id, animate = true) {
    if (!layout?.areas[id]) return;
    const view = districtView(id);
    if (animate) animateTo(view);
    else setVB(view);
    report(id);
  }

  function fit(animate = true) {
    const view = { x: 0, y: 0, w: fitW() };
    if (animate) animateTo(view);
    else setVB(view);
    report(null);
  }

  // ---- pointer: drag, pinch and tap ----
  const toMap = (cx, cy, v = vb) => {
    const r = svg.getBoundingClientRect();
    return [v.x + ((cx - r.left) / r.width) * v.w, v.y + ((cy - r.top) / r.height) * v.h];
  };
  const pts = new Map();
  let drag = null;
  let pinch0 = null;
  let dragged = false;

  box.addEventListener("pointerdown", (e) => {
    if (!svg || e.button > 0) return;
    box.setPointerCapture?.(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cancelAnimationFrame(anim);
    if (pts.size === 1) {
      drag = { x: e.clientX, y: e.clientY, vb: { ...vb } };
      dragged = false;
    }
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, m: [(a.x + b.x) / 2, (a.y + b.y) / 2], vb: { ...vb } };
      dragged = true;
    }
  });
  box.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = svg.getBoundingClientRect();
    if (pts.size === 1 && drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > TAP) dragged = true;
      if (dragged) {
        const s = drag.vb.w / r.width;
        setVB({ x: drag.vb.x - dx * s, y: drag.vb.y - dy * s, w: drag.vb.w });
      }
    } else if (pts.size === 2 && pinch0) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const m = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      const [px, py] = toMap(pinch0.m[0], pinch0.m[1], pinch0.vb);
      const w = clampW((pinch0.vb.w * pinch0.d) / d);
      setVB({ x: px - ((m[0] - r.left) / r.width) * w, y: py - ((m[1] - r.top) / r.height) * w * aspect(), w });
    }
  });
  function tap(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    // Grammar Peaks: the mountain tops start Summit Review and the lake Spelling Lake (once you're there).
    const peak = el?.closest?.(".peak-hit");
    if (peak) {
      if (zoomedIn() && area === "peaks") onPeak(peak.dataset.peak);
      else focus("peaks");
      return;
    }
    const district = el?.closest?.(".district");
    if (!district) return;
    const id = district.dataset.area;
    const lot = el.closest(".lot-hit");
    // The Town Square's Notice Board opens the Sentence of the Week, from near or far.
    if (el.closest(".board-hit") && (zoomedIn() && id === area)) { onBoard(); return; }
    // From far away, or on another district: go there first. Inside one: a lot opens its level card.
    if (!zoomedIn() || id !== area || !lot) {
      if (!zoomedIn() || id !== area) focus(id);
      return;
    }
    onLot(lot.dataset.skill, Number(lot.dataset.level));
  }
  function endPointer(e) {
    if (!pts.has(e.pointerId)) return;
    const isTap = e.type === "pointerup" && pts.size === 1 && !dragged;
    pts.delete(e.pointerId);
    if (isTap) tap(e);
    else if (!pts.size) settle();
    if (pts.size === 1) {
      const [p] = [...pts.values()];
      drag = { x: p.x, y: p.y, vb: { ...vb } };
      pinch0 = null;
    }
    if (!pts.size) {
      drag = null;
      pinch0 = null;
    }
  }
  box.addEventListener("pointerup", endPointer);
  box.addEventListener("pointercancel", endPointer);
  box.addEventListener("wheel", (e) => {
    // Trackpad pinch or ctrl+scroll zooms; plain scrolling still moves the page.
    if (!svg || (!e.ctrlKey && !e.metaKey)) return;
    e.preventDefault();
    cancelAnimationFrame(anim);
    const [px, py] = toMap(e.clientX, e.clientY);
    setVB(zoomTarget(Math.exp(-e.deltaY * 0.01), px, py));
    clearTimeout(box.settleTimer);
    box.settleTimer = setTimeout(settle, 200);
  }, { passive: false });
  buttons.zIn.addEventListener("click", () => animateTo(zoomTarget(1.8), settle));
  buttons.zOut.addEventListener("click", () => animateTo(zoomTarget(1 / 1.8), settle));
  buttons.zFit.addEventListener("click", () => fit());
  // The view keeps its shape when the window or phone turns.
  new ResizeObserver(() => {
    if (!svg) return;
    if (area) setVB(districtView(area));
    else setVB({ ...vb, w: zoomedIn() ? vb.w : fitW() });
  }).observe(box);

  return {
    /** Draws the map (SVG markup and its layout), showing a district (or the whole map when null). */
    show(html, nextLayout, id = null) {
      cancelAnimationFrame(anim);
      box.innerHTML = html;
      svg = box.querySelector("svg");
      layout = nextLayout;
      area = id && layout.areas[id] ? id : null;
      if (area) setVB(districtView(area));
      else setVB({ x: 0, y: 0, w: fitW() });
      onArea(area);
    },
    focus,
    fit,
    get area() {
      return area;
    },
  };
}
