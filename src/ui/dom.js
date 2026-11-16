// Small DOM helpers shared by the screens.

export const $ = (id) => document.getElementById(id);

export function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const SCREENS = ["players", "add-player", "home", "world", "play", "badges", "parent", "rules", "about"];

// The phone's Back gesture (and the browser's Back button) should close the top popup or step back a
// screen, not leave the game, as in Bible Trivia and World Geography. Away from the home screen, one
// "guard" history entry sits on top; Back pops it, the game handles it, and the guard goes back if
// we're still away from home. At home there's no guard, so Back leaves the app as usual.
const GUARD = { sentenceBuilders: true };
const onGuard = () => Boolean(history.state?.sentenceBuilders);
let needsGuard = () => false;

export function syncBackGuard() {
  try {
    if (needsGuard() && !onGuard()) history.pushState(GUARD, "");
  } catch {
    // No history here (a sandboxed frame): everything works, Back just won't be caught.
  }
}

/** handleBack runs when Back is pressed; atHome says when Back should leave the app. */
export function initBackButton({ handleBack, atHome }) {
  needsGuard = () => !atHome();
  addEventListener("popstate", () => {
    handleBack();
    syncBackGuard();
  });
}

/** The popup on top, if any. */
export const topOverlay = () => [...document.querySelectorAll(".overlay")].find((o) => !o.hidden) || null;

export function showScreen(id) {
  for (const screen of SCREENS) $(screen).hidden = screen !== id;
  document.body.dataset.screen = id;
  window.scrollTo(0, 0);
  syncBackGuard();
}

export function openOverlay(id) {
  $(id).hidden = false;
  $(id).querySelector(".primary, button")?.focus({ preventScroll: true });
  syncBackGuard();
}

export function closeOverlay(id) {
  $(id).hidden = true;
}

export const pick = (list, random = Math.random) => list[Math.floor(random() * list.length)];
