// Small DOM helpers shared by the screens.

export const $ = (id) => document.getElementById(id);

export function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const SCREENS = ["players", "add-player", "home", "world", "play", "badges", "parent", "rules"];

export function showScreen(id) {
  for (const screen of SCREENS) $(screen).hidden = screen !== id;
  document.body.dataset.screen = id;
  window.scrollTo(0, 0);
}

export function openOverlay(id) {
  $(id).hidden = false;
  $(id).querySelector(".primary, button")?.focus({ preventScroll: true });
}

export function closeOverlay(id) {
  $(id).hidden = true;
}

export const pick = (list, random = Math.random) => list[Math.floor(random() * list.length)];
