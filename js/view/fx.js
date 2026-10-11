// Вид: звук и тактильная отдача интерфейса.
import { tgHaptic } from "../telegram.js";
import { volumeNow } from "../model/settings.js";
import { S } from "../model/store.js";

/* ---- звук (WebAudio-синтез, без файлов) и тактильная отдача ---- */
export let audioCtx = null;

// Два рода звуков: щелчки интерфейса (выключаются тумблером «Звук интерфейса»)
// и сигналы — конец отдыха, сохранение (их громкость — «Громкость уведомлений»,
// 0 — без звука). Громкость 70 — прежний уровень.
const volume = () => volumeNow();
let kind = "ui";
const allowed = () => (kind === "ui" ? !!(S.settings && S.settings.sound) && volume() > 0 : volume() > 0);

export function ac() {
  if (!S.settings || !allowed()) return null;
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; } }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

export function tone(freq, dur, type = "sine", gain = 0.05, when = 0) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * (volume() / 70)), t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.03);
}

export function haptic(p) {
  if (!S.settings || !S.settings.haptics) return;
  if (tgHaptic(p)) return;                       // внутри Телеграма — системная отдача
  if (navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} }
}

export function fxTransition() { tone(300, 0.16, "triangle", 0.035); tone(470, 0.13, "sine", 0.025, 0.035); haptic(10); }

/** Сигнал: громкость — из настроек, тумблер щелчков интерфейса на него не влияет. */
export function fxChime() {
  kind = "signal";
  try { tone(660, 0.2, "sine", 0.05); tone(990, 0.24, "sine", 0.04, 0.07); tone(1320, 0.3, "sine", 0.03, 0.15); } finally { kind = "ui"; }
  haptic([14, 40, 22]);
}

export function fxTap() { tone(240, 0.05, "square", 0.02); haptic(7); }
