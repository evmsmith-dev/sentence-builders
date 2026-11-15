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
export function say(text) {
  if (!CAN_SAY || !text) return;
  try {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/["“”]/g, ""));
    utterance.lang = voice ? voice.lang : "en-US";
    if (voice) utterance.voice = voice;
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
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

export function celebrate() {
  if (typeof window.confetti !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  window.confetti({ particleCount: 90, spread: 70, origin: { y: 0.35 }, disableForReducedMotion: true });
}
