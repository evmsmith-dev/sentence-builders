// Read-aloud, sounds, a light buzz and confetti. All optional, all offline.

const CAN_SAY = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
let voice = null;

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return;
  const score = (v) => (/^en[-_]US/i.test(v.lang) ? 4 : /^en/i.test(v.lang) ? 3 : 0) + (v.localService ? 1 : 0)
    + (/natural|enhanced|premium|samantha|google us/i.test(v.name) ? 1 : 0);
  voice = [...voices].sort((a, b) => score(b) - score(a))[0];
  if (voice && !/^en/i.test(voice.lang)) voice = null;
}
if (CAN_SAY) {
  pickVoice();
  speechSynthesis.addEventListener?.("voiceschanged", pickVoice);
}

export const canSay = () => CAN_SAY;

/** Reads text aloud with the device's own voice. Marks like " and ' aren't spoken. */
export function say(text, { rate = 0.9 } = {}) {
  sayParts([text], { rate });
}

/** Reads several pieces one after another, with the voice's own pause between them (phrase-by-phrase dictation). */
export function sayParts(parts, { rate = 0.9 } = {}) {
  if (!CAN_SAY || !parts.length || !parts[0]) return;
  try {
    speechSynthesis.cancel();
    for (const part of parts) {
      const utterance = new SpeechSynthesisUtterance(part.replace(/["“”]/g, ""));
      utterance.lang = voice ? voice.lang : "en-US";
      if (voice) utterance.voice = voice;
      utterance.rate = rate;
      speechSynthesis.speak(utterance);
    }
  } catch {
    // No voice on this device.
  }
}

export function stopSaying() {
  if (CAN_SAY) speechSynthesis.cancel();
}

let audio = null;
const NOTES = {
  right: [[660, 0], [880, 0.09]],
  wrong: [[300, 0], [250, 0.12]],
  tap: [[740, 0]],
  done: [[523, 0], [659, 0.11], [784, 0.22], [1047, 0.33]],
};

export function sound(kind, enabled) {
  if (!enabled) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const start = audio.currentTime;
    for (const [freq, at] of NOTES[kind] || []) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start + at);
      gain.gain.exponentialRampToValueAtTime(kind === "tap" ? 0.05 : 0.14, start + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.22);
      osc.connect(gain).connect(audio.destination);
      osc.start(start + at);
      osc.stop(start + at + 0.25);
    }
  } catch {
    // No audio here.
  }
}

export function buzz(ms = 15) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Not supported.
  }
}

/** Confetti that grows with the stars: a small puff for one, a burst for two, bursts from both sides for three. */
export function celebrate(stars = 2) {
  if (typeof window.confetti !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const shot = (opts) => window.confetti({ disableForReducedMotion: true, origin: { y: 0.35 }, ...opts });
  if (stars <= 1) return shot({ particleCount: 40, spread: 50 });
  shot({ particleCount: 90, spread: 70 });
  if (stars >= 3) {
    setTimeout(() => shot({ particleCount: 70, angle: 60, spread: 60, origin: { x: 0, y: 0.6 } }), 250);
    setTimeout(() => shot({ particleCount: 70, angle: 120, spread: 60, origin: { x: 1, y: 0.6 } }), 400);
  }
}
