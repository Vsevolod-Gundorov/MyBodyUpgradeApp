// Модель: характеристики и класс персонажа.
import { baselines, currentWeight } from "./profile.js";
import { S } from "./store.js";
import { themeNow } from "./theme.js";
import { bestE1RM } from "./training.js";

export function heroStats() {
  const lifts = {};
  let strengthGain = 0;
  const BASE = baselines();
  Object.keys(BASE).forEach((k) => {
    const cur = Math.max(bestE1RM(k), 0);
    lifts[k] = { base: BASE[k], cur: cur || BASE[k] };
    strengthGain += Math.max(0, (lifts[k].cur - BASE[k]) / BASE[k]);
  });
  const level = Math.floor(Math.sqrt(S.xp / 40)) + 1;
  const nextXp = 40 * Math.pow(level, 2);
  const prevXp = 40 * Math.pow(level - 1, 2);
  const lvlProgress = Math.min(1, (S.xp - prevXp) / Math.max(1, nextXp - prevXp));

  // Сила: старт 62, растёт от прибавок e1RM
  const str = Math.min(99, Math.round(62 + strengthGain * 220));
  // Мощь: суммарный расчётный 1ПМ относительно веса тела (relative strength)
  const totalE1RM = Object.values(lifts).reduce((a, v) => a + v.cur, 0);
  const bw = currentWeight();
  const pow = Math.min(99, Math.round((totalE1RM / bw) * 13));
  // Выносливость: средний тоннаж последних 6 сессий (т)
  const tonn = S.sessions.slice(-6).map((s) => {
    let t = 0; Object.values(s.entries).forEach((sets) => sets.forEach(({ w, r }) => (t += (w || 0) * (r || 0))));
    return t / 1000;
  });
  const avgT = tonn.length ? tonn.reduce((a, b) => a + b, 0) / tonn.length : 0;
  const endr = Math.min(99, Math.round(40 + avgT * 2.4));
  // Объём: суммарный тоннаж всех походов за всё время (т)
  let lifetimeT = 0;
  S.sessions.forEach((s) => Object.values(s.entries).forEach((sets) => sets.forEach(({ w, r }) => (lifetimeT += (w || 0) * (r || 0)))));
  lifetimeT /= 1000;
  const vol = Math.min(99, Math.round(Math.sqrt(lifetimeT) * 13));
  // Дисциплина: сессии за последние 14 дней против плана 6
  const cutoff = Date.now() - 14 * 864e5;
  const recent = S.sessions.filter((s) => new Date(s.date).getTime() >= cutoff).length;
  const disc = Math.min(99, Math.round((recent / 6) * 99));
  // Стойкость: средний счёт всех сессий
  const avgScore = S.sessions.length ? S.sessions.reduce((a, s) => a + s.score, 0) / S.sessions.length : 0;
  const grit = Math.round(avgScore * 0.99);

  const stats = { СИЛА: str, МОЩЬ: pow, ВЫНОСЛ: endr, ОБЪЁМ: vol, ДИСЦИПЛ: disc, СТОЙКОСТЬ: grit };
  return { level, lvlProgress, lifts, stats, cls: classInfo(stats, S.sessions.length) };
}

/* ================= классы и подклассы (из роста характеристик) ================= */
export const CLASS_NOUN = { СИЛА: "Титан", МОЩЬ: "Громовержец", ВЫНОСЛ: "Марафонец", ОБЪЁМ: "Колосс", ДИСЦИПЛ: "Паладин", СТОЙКОСТЬ: "Несгибаемый" };

export const CLASS_EPITHET = { СИЛА: "Могучий", МОЩЬ: "Яростный", ВЫНОСЛ: "Неутомимый", ОБЪЁМ: "Исполинский", ДИСЦИПЛ: "Праведный", СТОЙКОСТЬ: "Стойкий" };

// Во второй редакции это не класс персонажа, а профиль подготовки: то же самое
// число, но названное так, как это называют тренеры.
export const CLASS_NOUN_PLAIN = { СИЛА: "Силовой тип", МОЩЬ: "Скоростно-силовой", ВЫНОСЛ: "Выносливостный", ОБЪЁМ: "Объёмный тип", ДИСЦИПЛ: "Системный", СТОЙКОСТЬ: "Устойчивый" };

export const CLASS_EPITHET_PLAIN = { СИЛА: "с упором на силу", МОЩЬ: "с упором на мощность", ВЫНОСЛ: "с упором на выносливость", ОБЪЁМ: "с упором на объём", ДИСЦИПЛ: "с упором на регулярность", СТОЙКОСТЬ: "с упором на стабильность" };

export const CLASS_ICON = { СИЛА: "muscle", МОЩЬ: "lightning", ВЫНОСЛ: "flame", ОБЪЁМ: "weight", ДИСЦИПЛ: "shield", СТОЙКОСТЬ: "gem" };

export function classInfo(stats, sessionsCount) {
  const e = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  const [p1, v1] = e[0], [p2, v2] = e[1];
  const pl = themeNow() === "plain";
  const NOUN = pl ? CLASS_NOUN_PLAIN : CLASS_NOUN;
  const EPI = pl ? CLASS_EPITHET_PLAIN : CLASS_EPITHET;
  if (sessionsCount < 1 || v1 < 58) {
    return { name: pl ? "Базовый уровень" : "Странник", sub: pl ? "профиль ещё не набран" : "Новобранец",
      primary: p1, secondary: p2, icon: "helm", novice: true, hybrid: false };
  }
  // две сильные стороны вплотную — профиль смешанный (напр. «Силовой тип + Системный»)
  const hybrid = (v1 - v2) <= 5 && v2 >= 55;
  if (hybrid) {
    return { name: pl ? `${NOUN[p1]} + ${NOUN[p2]}` : `${CLASS_NOUN[p1]}-${CLASS_NOUN[p2]}`,
      sub: pl ? "смешанный профиль" : "Гибридный билд", primary: p1, secondary: p2, icon: CLASS_ICON[p1], novice: false, hybrid: true };
  }
  return { name: NOUN[p1], sub: EPI[p2], primary: p1, secondary: p2, icon: CLASS_ICON[p1], novice: false, hybrid: false };
}
