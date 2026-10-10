// Профиль атлета и расчёт его норм. Только чистые функции: ни хранилища, ни DOM.
//
// Нормы питания считаются отдельно для дня тренировки и дня отдыха — так, как их
// ведут тренеры, а не одной цифрой на всю неделю, как в большинстве счётчиков:
//   основной обмен — формула Миффлина — Сан Жеора (точнее Харриса — Бенедикта для
//     современных людей, Frankenfield 2005);
//   бытовая активность — коэффициент образа жизни без тренировок (NEAT);
//   тренировка — +4,4 ккал на кг веса тела (силовая ~70 мин, чистые ~4 MET);
//   цель — дефицит или профицит по выбранному темпу: 1 кг жира ≈ 7700 ккал,
//     дефицит не глубже 25% обмена и не ниже безопасного минимума;
//   белок — по весу тела (при ИМТ > 30 — по скорректированному весу),
//     жиры — по весу или остатком, углеводы — остаток; разница между днями
//     ложится на углеводы (на кето и низкоуглеводной — на жиры);
//   клетчатка — 14 г на 1000 ккал, вода — 35 мл/кг и +0,5 л в день тренировки.

export const SEXES = { m: "Мужской", f: "Женский" };

export const ACTIVITY = {
  sedentary: { name: "Сидячий", note: "Работа за столом, до 5 тыс. шагов", pal: 1.2 },
  light:     { name: "Малоподвижный", note: "Сидячая работа, прогулки, 5–8 тыс. шагов", pal: 1.3 },
  moderate:  { name: "Подвижный", note: "Много на ногах, 8–12 тыс. шагов", pal: 1.42 },
  active:    { name: "Активный", note: "Физическая работа, 12+ тыс. шагов", pal: 1.55 },
};
export const ACTIVITY_ORDER = ["sedentary", "light", "moderate", "active"];

export const DIRECTIONS = {
  cut:      { name: "Снизить вес", note: "Сжечь жир и сохранить мышцы" },
  maintain: { name: "Держать форму", note: "Вес на месте, сила растёт" },
  recomp:   { name: "Рекомпозиция", note: "Меньше жира, больше мышц при том же весе" },
  bulk:     { name: "Набрать массу", note: "Рост мышц с минимумом жира" },
};
export const DIRECTION_ORDER = ["cut", "maintain", "recomp", "bulk"];

// темп — кг в неделю; знак задаёт направление
export const PACES = {
  cut: [{ id: "slow", kg: 0.25, name: "Мягко" }, { id: "normal", kg: 0.5, name: "Оптимально" }, { id: "fast", kg: 0.75, name: "Быстро" }],
  bulk: [{ id: "slow", kg: 0.15, name: "Сухой набор" }, { id: "normal", kg: 0.25, name: "Оптимально" }, { id: "fast", kg: 0.4, name: "Быстро" }],
};

export const PROGRAMS = {
  balanced: { name: "Сбалансированная", note: "Классика спорта: умеренный белок и жиры, углеводы под тренировки" },
  protein:  { name: "Высокобелковая", note: "Больше белка — сытость и сохранение мышц на дефиците" },
  lowcarb:  { name: "Низкоуглеводная", note: "Углеводы ~20% калорий, остальное — белок и жиры" },
  keto:     { name: "Кетогенная", note: "До 30 г углеводов в день, энергия из жиров" },
  custom:   { name: "Своя", note: "Белок и жиры задаёте сами, углеводы — остаток" },
};
export const PROGRAM_ORDER = ["balanced", "protein", "lowcarb", "keto", "custom"];

export const EXPERIENCE = {
  novice:       { name: "Новичок", note: "Меньше 6 месяцев в зале" },
  beginner:     { name: "Начинающий", note: "От полугода до 2 лет" },
  intermediate: { name: "Средний уровень", note: "2–5 лет регулярных тренировок" },
  advanced:     { name: "Продвинутый", note: "Больше 5 лет, есть силовые результаты" },
};
export const EXPERIENCE_ORDER = ["novice", "beginner", "intermediate", "advanced"];

export const LIMITS = { age: [14, 90], height: [130, 230], weight: [35, 250] };

const KCAL_PER_KG_FAT = 7700;
const TRAINING_KCAL_PER_KG = 4.4;
const TRAINING_DAYS = 3;   // программа — 3 тренировки в неделю

const round = (x, step = 1) => Math.round(x / step) * step;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** Возраст по году рождения. */
export const ageOf = (birthYear, now = new Date()) => now.getFullYear() - birthYear;

/** Основной обмен, ккал/сутки (Миффлин — Сан Жеор). */
export function bmr({ sex, weight, height, age }) {
  return 10 * weight + 6.25 * height - 5 * age + (sex === "f" ? -161 : 5);
}

/** Вес для расчёта белка: при ожирении — скорректированный (иначе нормы белка завышены). */
export function proteinWeight({ weight, height }) {
  const h = height / 100;
  const bmi = weight / (h * h);
  if (bmi <= 30) return weight;
  const ideal = 25 * h * h;
  return ideal + 0.25 * (weight - ideal);
}

/** Проверка ввода профиля. @returns {string|null} код ошибки */
export function checkProfile(p) {
  if (!SEXES[p.sex]) return "sex";
  const age = p.age ?? (p.birthYear ? ageOf(p.birthYear) : null);
  if (!(age >= LIMITS.age[0] && age <= LIMITS.age[1])) return "age";
  if (!(p.height >= LIMITS.height[0] && p.height <= LIMITS.height[1])) return "height";
  if (!(p.weight >= LIMITS.weight[0] && p.weight <= LIMITS.weight[1])) return "weight";
  if (!ACTIVITY[p.activity]) return "activity";
  if (!DIRECTIONS[p.direction]) return "direction";
  if (!PROGRAMS[p.program]) return "program";
  if (p.program === "custom") {
    const c = p.custom || {};
    if (!(c.protein >= 0.8 && c.protein <= 3.5)) return "custom_protein";
    if (!(c.fat >= 0.4 && c.fat <= 2.5)) return "custom_fat";
  }
  return null;
}

/**
 * Нормы на день тренировки и день отдыха.
 * @param p { sex, age|birthYear, height, weight, activity, direction, pace, program, custom?, adjust? }
 *   adjust — поправка ккал/день от сверки с реальным весом (см. adaptiveAdjust)
 */
export function computeTargets(p, now = new Date()) {
  const age = p.age ?? ageOf(p.birthYear, now);
  const base = bmr({ sex: p.sex, weight: p.weight, height: p.height, age });
  const pal = ACTIVITY[p.activity].pal;
  const restMaint = base * pal;
  const trainMaint = restMaint + TRAINING_KCAL_PER_KG * p.weight;
  const weekMaint = (restMaint * (7 - TRAINING_DAYS) + trainMaint * TRAINING_DAYS) / 7;

  // цель: суточная поправка в среднем по неделе
  let delta = 0, capped = false;
  const pace = (PACES[p.direction] || []).find((x) => x.id === p.pace) || (PACES[p.direction] || [])[1];
  if (p.direction === "cut") { const want = pace.kg * KCAL_PER_KG_FAT / 7; delta = -Math.min(want, 0.25 * weekMaint); capped = want > 0.25 * weekMaint; }
  if (p.direction === "bulk") { const want = pace.kg * KCAL_PER_KG_FAT / 7; delta = Math.min(want, 0.15 * weekMaint); capped = want > 0.15 * weekMaint; }
  delta += p.adjust || 0;
  const floor = Math.max(base, p.sex === "f" ? 1200 : 1500);

  // рекомпозиция: небольшой дефицит в дни отдыха, поддержание в дни тренировки
  let train = trainMaint + delta, rest = restMaint + delta;
  if (p.direction === "recomp") { train = trainMaint + (p.adjust || 0); rest = restMaint * 0.9 + (p.adjust || 0); }
  train = Math.max(train, floor); rest = Math.max(rest, floor);

  const pw = proteinWeight(p);
  const PROTEIN = {
    balanced: { cut: 2.0, maintain: 1.6, recomp: 2.0, bulk: 1.8 },
    protein:  { cut: 2.4, maintain: 2.2, recomp: 2.4, bulk: 2.2 },
    lowcarb:  { cut: 2.2, maintain: 2.0, recomp: 2.2, bulk: 2.0 },
    keto:     { cut: 2.0, maintain: 1.8, recomp: 2.0, bulk: 1.8 },
  };
  const protG = p.program === "custom" ? p.custom.protein : PROTEIN[p.program][p.direction];
  const protein = round(protG * pw);

  const day = (kcal, training) => {
    let fat, carbs;
    if (p.program === "keto") { carbs = 30; fat = (kcal - protein * 4 - carbs * 4) / 9; }
    else if (p.program === "lowcarb") { carbs = (kcal * 0.2) / 4; fat = (kcal - protein * 4 - carbs * 4) / 9; }
    else {
      const fatG = p.program === "custom" ? p.custom.fat : (p.program === "protein" ? 0.8 : 0.9);
      fat = Math.max(fatG * p.weight, (kcal * 0.2) / 9);            // жиров не меньше 20% калорий: гормоны
      carbs = (kcal - protein * 4 - fat * 9) / 4;
      if (carbs < 50) { carbs = 50; fat = Math.max(0, (kcal - protein * 4 - carbs * 4) / 9); }
    }
    return {
      kcal: round(kcal, 10), protein, fat: round(Math.max(0, fat)), carbs: round(Math.max(0, carbs)),
      fiber: Math.max(25, round((kcal / 1000) * 14)),
      water: round(clamp(35 * p.weight, 2000, 4500) + (training ? 500 : 0), 50),
    };
  };
  return {
    bmr: round(base), maintenance: { training: round(trainMaint, 10), rest: round(restMaint, 10) },
    training: day(train, true), rest: day(rest, false),
    weekly: round(((train * TRAINING_DAYS) + rest * (7 - TRAINING_DAYS)) / 7, 10),
    expectedKgPerWeek: p.direction === "recomp" ? 0 : Math.round(((delta - (p.adjust || 0)) * 7 / KCAL_PER_KG_FAT) * 100) / 100,
    capped,                                   // темп урезан до безопасного
    floor: round(floor, 10),                  // ниже этой калорийности не опускаемся
  };
}

/* ---------------- сверка с реальным весом (как у MacroFactor) ----------------
   Формула — только оценка: у одного и того же веса и роста обмен отличается
   на ±10%. Раз в неделю сравниваем тренд веса с запланированным темпом и
   предлагаем поправку калорий. Тренд — по линейной регрессии за 21 день,
   нужно не меньше 6 взвешиваний на 14+ днях, иначе шум воды важнее. */
export function weightTrend(entries, now = new Date(), days = 21) {
  const t0 = now.getTime() - days * 864e5;
  const pts = (entries || []).filter((e) => new Date(e.date).getTime() >= t0 && e.kg > 0)
    .map((e) => ({ x: (new Date(e.date).getTime() - t0) / 864e5, y: e.kg }));
  if (pts.length < 6) return null;
  const span = Math.max(...pts.map((q) => q.x)) - Math.min(...pts.map((q) => q.x));
  if (span < 14) return null;
  const n = pts.length, mx = pts.reduce((a, q) => a + q.x, 0) / n, my = pts.reduce((a, q) => a + q.y, 0) / n;
  const slope = pts.reduce((a, q) => a + (q.x - mx) * (q.y - my), 0) / pts.reduce((a, q) => a + (q.x - mx) ** 2, 0);
  return { kgPerWeek: Math.round(slope * 7 * 100) / 100, points: n, spanDays: Math.round(span) };
}

/**
 * Поправка калорий по факту: разница между реальным и запланированным темпом,
 * переведённая в ккал/день, шагом 50 и не больше ±300 за раз.
 * @returns {{ kcal, actual, planned } | null} — null, если всё идёт по плану или данных мало
 */
export function adaptiveAdjust(entries, plannedKgPerWeek, now = new Date()) {
  const tr = weightTrend(entries, now);
  if (!tr) return null;
  const diff = tr.kgPerWeek - plannedKgPerWeek;
  if (Math.abs(diff) < 0.15) return null;
  const kcal = clamp(round(-diff * KCAL_PER_KG_FAT / 7, 50), -300, 300);
  return kcal ? { kcal, actual: tr.kgPerWeek, planned: plannedKgPerWeek } : null;
}

/* ---------------- стартовые рабочие максимумы ----------------
   Новичку нельзя давать чужие цифры. По уровню подготовки и весу тела берём
   нижнюю границу силовых нормативов (соотношение 1ПМ к весу тела) и ещё 10%
   запаса: первые тренировки сами поднимут вес по двойной прогрессии, а лишний
   вес на старте — это травма и отбитое желание ходить в зал. */
const STANDARDS = {
  m: { bench: [0.5, 0.75, 1.0, 1.35], squat: [0.7, 1.0, 1.4, 1.85], deadlift: [0.9, 1.25, 1.7, 2.2], ohp: [0.35, 0.5, 0.68, 0.9] },
  f: { bench: [0.3, 0.45, 0.65, 0.9], squat: [0.5, 0.75, 1.05, 1.4], deadlift: [0.65, 0.95, 1.3, 1.7], ohp: [0.2, 0.3, 0.45, 0.6] },
};
export const LIFTS = ["bench", "squat", "deadlift", "ohp"];

/** Оценка 1ПМ базовых движений по полу, весу, возрасту и опыту. */
export function estimateMaxes({ sex, weight, age, experience }) {
  const lvl = Math.max(0, EXPERIENCE_ORDER.indexOf(experience));
  const ageK = age > 40 ? Math.max(0.7, 1 - 0.01 * (age - 40)) : (age < 18 ? 0.85 : 1);
  const out = {};
  for (const lift of LIFTS) out[lift] = Math.max(20, round(STANDARDS[sex === "f" ? "f" : "m"][lift][lvl] * weight * ageK * 0.9, 2.5));
  return out;
}

/** 1ПМ по подходу (вес × повторы): среднее Эпли и Бжицки, повторы до 10. */
export function oneRepMax(w, r) {
  if (!(w > 0 && r > 0)) return 0;
  const reps = Math.min(r, 10);
  if (reps === 1) return w;
  return round((w * (1 + reps / 30) + w * 36 / (37 - reps)) / 2, 2.5);
}
