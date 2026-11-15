// Everything is saved in this browser's localStorage. Nothing leaves the device.
// Reads never throw: private browsing or blocked storage just means progress isn't kept.
const PREFIX = "sentenceBuilders_";

export function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the game still works, it just isn't saved.
  }
}

export const loadPlayers = () => readJson("players", []);
export const savePlayers = (players) => writeJson("players", players);
export const loadCurrentId = () => readJson("current", null);
export const saveCurrentId = (id) => writeJson("current", id);
