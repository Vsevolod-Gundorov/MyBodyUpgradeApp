// Питание · рекомпозиция. Цели по типам дня из спецификации (раздел 7 плана).
export const NUTRITION = {
  athlete: { name: "Всеволод", height_cm: 180, weight_kg: 93, goal: "recomposition" },
  dayTypes: {
    training: { label: "Тренировочный", kcal: 3150, protein: 195, fat: 85, carbs: 400 },
    rest:     { label: "Отдых",         kcal: 2750, protein: 195, fat: 90, carbs: 285 },
  },
  constants: { fiber: [30, 40], water_ml: [3000, 3500], protein_per_meal: [40, 50], meals_per_day: 4 },
  timing: {
    pre:  { hours_before: 2, carbs: [60, 90],  protein: [30, 40] },
    post: { carbs: [80, 120], protein: [40, 50] },
  },
};
export const WATER_TARGET_ML = 3300;

// Локальный справочник (значения на 100 г): k=ккал, p=белок, f=жир, cb=углеводы, fb=клетчатка.
// Для мгновенного оффлайн-поиска; всё остальное подтягивается из Open Food Facts.
export const FOOD_CATS = [
  "Мясо и птица", "Рыба и морепродукты", "Яйца и молочка", "Крупы и гарниры",
  "Хлеб", "Овощи", "Фрукты и ягоды", "Орехи и жиры", "Снеки и спортпит", "Напитки",
];
export const FOODS = [
  // Мясо и птица
  { n: "Куриная грудка (варёная)", c: "Мясо и птица", k: 165, p: 31, f: 3.6, cb: 0, fb: 0 },
  { n: "Куриное бедро", c: "Мясо и птица", k: 209, p: 26, f: 11, cb: 0, fb: 0 },
  { n: "Индейка, филе", c: "Мясо и птица", k: 135, p: 29, f: 1, cb: 0, fb: 0 },
  { n: "Говядина постная", c: "Мясо и птица", k: 187, p: 26, f: 9, cb: 0, fb: 0 },
  { n: "Свинина нежирная", c: "Мясо и птица", k: 242, p: 27, f: 14, cb: 0, fb: 0 },
  { n: "Фарш говяжий", c: "Мясо и птица", k: 254, p: 26, f: 17, cb: 0, fb: 0 },
  { n: "Бекон", c: "Мясо и птица", k: 541, p: 37, f: 42, cb: 1, fb: 0 },
  { n: "Ветчина", c: "Мясо и птица", k: 145, p: 18, f: 8, cb: 1, fb: 0 },
  { n: "Печень говяжья", c: "Мясо и птица", k: 135, p: 20, f: 3.6, cb: 4, fb: 0 },
  // Рыба и морепродукты
  { n: "Лосось", c: "Рыба и морепродукты", k: 208, p: 20, f: 13, cb: 0, fb: 0 },
  { n: "Тунец (в собств. соку)", c: "Рыба и морепродукты", k: 116, p: 26, f: 1, cb: 0, fb: 0 },
  { n: "Треска", c: "Рыба и морепродукты", k: 82, p: 18, f: 0.7, cb: 0, fb: 0 },
  { n: "Скумбрия", c: "Рыба и морепродукты", k: 205, p: 19, f: 14, cb: 0, fb: 0 },
  { n: "Креветки", c: "Рыба и морепродукты", k: 99, p: 24, f: 0.3, cb: 0.2, fb: 0 },
  { n: "Сельдь", c: "Рыба и морепродукты", k: 158, p: 18, f: 9, cb: 0, fb: 0 },
  // Яйца и молочка
  { n: "Яйцо куриное", c: "Яйца и молочка", k: 155, p: 13, f: 11, cb: 1.1, fb: 0 },
  { n: "Яичный белок", c: "Яйца и молочка", k: 52, p: 11, f: 0.2, cb: 0.7, fb: 0 },
  { n: "Творог 5%", c: "Яйца и молочка", k: 121, p: 17, f: 5, cb: 3, fb: 0 },
  { n: "Творог обезжиренный", c: "Яйца и молочка", k: 71, p: 18, f: 0.6, cb: 1.8, fb: 0 },
  { n: "Греческий йогурт 2%", c: "Яйца и молочка", k: 73, p: 9, f: 2, cb: 4, fb: 0 },
  { n: "Йогурт натуральный", c: "Яйца и молочка", k: 60, p: 5, f: 3, cb: 7, fb: 0 },
  { n: "Молоко 2.5%", c: "Яйца и молочка", k: 52, p: 2.8, f: 2.5, cb: 4.7, fb: 0, drink: true, hy: 0.9 },
  { n: "Сыр твёрдый", c: "Яйца и молочка", k: 364, p: 25, f: 29, cb: 0, fb: 0 },
  { n: "Моцарелла", c: "Яйца и молочка", k: 280, p: 22, f: 17, cb: 2, fb: 0 },
  { n: "Протеин сывороточный (порошок)", c: "Яйца и молочка", k: 400, p: 80, f: 6, cb: 8, fb: 0 },
  // Крупы и гарниры (варёные)
  { n: "Рис белый (отварной)", c: "Крупы и гарниры", k: 130, p: 2.7, f: 0.3, cb: 28, fb: 0.4 },
  { n: "Рис бурый (отварной)", c: "Крупы и гарниры", k: 123, p: 2.7, f: 1, cb: 25, fb: 1.8 },
  { n: "Гречка (отварная)", c: "Крупы и гарниры", k: 92, p: 3.4, f: 0.6, cb: 20, fb: 2.7 },
  { n: "Овсянка на воде", c: "Крупы и гарниры", k: 88, p: 3, f: 1.7, cb: 15, fb: 1.7 },
  { n: "Овсяные хлопья (сухие)", c: "Крупы и гарниры", k: 379, p: 13, f: 7, cb: 67, fb: 10 },
  { n: "Макароны (отварные)", c: "Крупы и гарниры", k: 131, p: 5, f: 1.1, cb: 25, fb: 1.8 },
  { n: "Картофель (отварной)", c: "Крупы и гарниры", k: 87, p: 2, f: 0.1, cb: 20, fb: 1.8 },
  { n: "Киноа (отварная)", c: "Крупы и гарниры", k: 120, p: 4.4, f: 1.9, cb: 21, fb: 2.8 },
  { n: "Булгур (отварной)", c: "Крупы и гарниры", k: 83, p: 3, f: 0.2, cb: 19, fb: 4.5 },
  { n: "Фасоль (отварная)", c: "Крупы и гарниры", k: 127, p: 9, f: 0.5, cb: 22, fb: 6.4 },
  { n: "Чечевица (отварная)", c: "Крупы и гарниры", k: 116, p: 9, f: 0.4, cb: 20, fb: 8 },
  { n: "Нут (отварной)", c: "Крупы и гарниры", k: 164, p: 9, f: 2.6, cb: 27, fb: 7.6 },
  // Хлеб
  { n: "Хлеб цельнозерновой", c: "Хлеб", k: 247, p: 13, f: 3.4, cb: 41, fb: 7 },
  { n: "Хлеб белый", c: "Хлеб", k: 265, p: 9, f: 3.2, cb: 49, fb: 2.7 },
  { n: "Лаваш", c: "Хлеб", k: 275, p: 9, f: 1, cb: 56, fb: 2 },
  { n: "Хлебцы цельнозерновые", c: "Хлеб", k: 300, p: 10, f: 3, cb: 60, fb: 6 },
  // Овощи
  { n: "Брокколи", c: "Овощи", k: 34, p: 2.8, f: 0.4, cb: 7, fb: 2.6 },
  { n: "Огурец", c: "Овощи", k: 15, p: 0.7, f: 0.1, cb: 3.6, fb: 0.5 },
  { n: "Помидор", c: "Овощи", k: 18, p: 0.9, f: 0.2, cb: 3.9, fb: 1.2 },
  { n: "Морковь", c: "Овощи", k: 41, p: 0.9, f: 0.2, cb: 10, fb: 2.8 },
  { n: "Капуста белокочанная", c: "Овощи", k: 25, p: 1.3, f: 0.1, cb: 6, fb: 2.5 },
  { n: "Шпинат", c: "Овощи", k: 23, p: 2.9, f: 0.4, cb: 3.6, fb: 2.2 },
  { n: "Перец болгарский", c: "Овощи", k: 27, p: 1, f: 0.3, cb: 6, fb: 2.1 },
  { n: "Кабачок", c: "Овощи", k: 17, p: 1.2, f: 0.3, cb: 3, fb: 1 },
  { n: "Авокадо", c: "Овощи", k: 160, p: 2, f: 15, cb: 9, fb: 6.7 },
  { n: "Кукуруза", c: "Овощи", k: 86, p: 3.2, f: 1.2, cb: 19, fb: 2.7 },
  { n: "Грибы шампиньоны", c: "Овощи", k: 22, p: 3.1, f: 0.3, cb: 3.3, fb: 1 },
  // Фрукты и ягоды
  { n: "Банан", c: "Фрукты и ягоды", k: 89, p: 1.1, f: 0.3, cb: 23, fb: 2.6 },
  { n: "Яблоко", c: "Фрукты и ягоды", k: 52, p: 0.3, f: 0.2, cb: 14, fb: 2.4 },
  { n: "Апельсин", c: "Фрукты и ягоды", k: 47, p: 0.9, f: 0.1, cb: 12, fb: 2.4 },
  { n: "Груша", c: "Фрукты и ягоды", k: 57, p: 0.4, f: 0.1, cb: 15, fb: 3.1 },
  { n: "Виноград", c: "Фрукты и ягоды", k: 69, p: 0.7, f: 0.2, cb: 18, fb: 0.9 },
  { n: "Клубника", c: "Фрукты и ягоды", k: 33, p: 0.7, f: 0.3, cb: 8, fb: 2 },
  { n: "Черника", c: "Фрукты и ягоды", k: 57, p: 0.7, f: 0.3, cb: 14, fb: 2.4 },
  { n: "Манго", c: "Фрукты и ягоды", k: 60, p: 0.8, f: 0.4, cb: 15, fb: 1.6 },
  { n: "Финики", c: "Фрукты и ягоды", k: 277, p: 1.8, f: 0.2, cb: 75, fb: 6.7 },
  { n: "Изюм", c: "Фрукты и ягоды", k: 299, p: 3, f: 0.5, cb: 79, fb: 3.7 },
  // Орехи и жиры
  { n: "Миндаль", c: "Орехи и жиры", k: 579, p: 21, f: 50, cb: 22, fb: 12.5 },
  { n: "Грецкий орех", c: "Орехи и жиры", k: 654, p: 15, f: 65, cb: 14, fb: 6.7 },
  { n: "Арахис", c: "Орехи и жиры", k: 567, p: 26, f: 49, cb: 16, fb: 8.5 },
  { n: "Арахисовая паста", c: "Орехи и жиры", k: 588, p: 25, f: 50, cb: 20, fb: 6 },
  { n: "Кешью", c: "Орехи и жиры", k: 553, p: 18, f: 44, cb: 30, fb: 3.3 },
  { n: "Оливковое масло", c: "Орехи и жиры", k: 884, p: 0, f: 100, cb: 0, fb: 0 },
  { n: "Сливочное масло", c: "Орехи и жиры", k: 717, p: 0.9, f: 81, cb: 0.1, fb: 0 },
  { n: "Семена чиа", c: "Орехи и жиры", k: 486, p: 17, f: 31, cb: 42, fb: 34 },
  // Снеки и спортпит
  { n: "Протеиновый батончик", c: "Снеки и спортпит", k: 350, p: 30, f: 10, cb: 35, fb: 3 },
  { n: "Гейнер (порошок)", c: "Снеки и спортпит", k: 380, p: 15, f: 5, cb: 70, fb: 2 },
  { n: "Тёмный шоколад 70%", c: "Снеки и спортпит", k: 598, p: 7.8, f: 43, cb: 46, fb: 11 },
  { n: "Молочный шоколад", c: "Снеки и спортпит", k: 535, p: 7, f: 30, cb: 59, fb: 3 },
  { n: "Мёд", c: "Снеки и спортпит", k: 304, p: 0.3, f: 0, cb: 82, fb: 0.2 },
  { n: "Сахар", c: "Снеки и спортпит", k: 387, p: 0, f: 0, cb: 100, fb: 0 },
  // Напитки (drink: true, hy — индекс гидратации; вода из них засчитывается в «Вода»)
  { n: "Вода", c: "Напитки", k: 0, p: 0, f: 0, cb: 0, fb: 0, drink: true, hy: 1 },
  { n: "Минеральная вода", c: "Напитки", k: 0, p: 0, f: 0, cb: 0, fb: 0, drink: true, hy: 1 },
  { n: "Кофе чёрный (без сахара)", c: "Напитки", k: 2, p: 0.1, f: 0, cb: 0, fb: 0, drink: true, hy: 0.95 },
  { n: "Кофе с молоком", c: "Напитки", k: 35, p: 1.8, f: 1.8, cb: 3.4, fb: 0, drink: true, hy: 0.9 },
  { n: "Капучино", c: "Напитки", k: 40, p: 2, f: 2, cb: 4, fb: 0, drink: true, hy: 0.9 },
  { n: "Чай без сахара", c: "Напитки", k: 1, p: 0, f: 0, cb: 0.2, fb: 0, drink: true, hy: 0.95 },
  { n: "Зелёный чай", c: "Напитки", k: 1, p: 0, f: 0, cb: 0, fb: 0, drink: true, hy: 0.95 },
  { n: "Кола", c: "Напитки", k: 42, p: 0, f: 0, cb: 10.6, fb: 0, drink: true, hy: 0.9 },
  { n: "Кола без сахара (Zero)", c: "Напитки", k: 0.3, p: 0, f: 0, cb: 0, fb: 0, drink: true, hy: 0.95 },
  { n: "Энергетик", c: "Напитки", k: 45, p: 0, f: 0, cb: 11, fb: 0, drink: true, hy: 0.85 },
  { n: "Энергетик без сахара", c: "Напитки", k: 5, p: 0, f: 0, cb: 1, fb: 0, drink: true, hy: 0.85 },
  { n: "Сок апельсиновый", c: "Напитки", k: 45, p: 0.7, f: 0.2, cb: 10, fb: 0.2, drink: true, hy: 0.85 },
  { n: "Морс / компот", c: "Напитки", k: 40, p: 0, f: 0, cb: 10, fb: 0, drink: true, hy: 0.85 },
  { n: "Кефир 1%", c: "Напитки", k: 40, p: 3, f: 1, cb: 4, fb: 0, drink: true, hy: 0.9 },
  { n: "Протеиновый коктейль (на воде)", c: "Напитки", k: 120, p: 24, f: 2, cb: 3, fb: 0, drink: true, hy: 0.9 },
].map((x, i) => ({ id: "loc" + i, src: "loc", ...x }));

// Оценка клетчатки на 100 г, когда её нет в данных продукта.
// Клетчатка — часть углеводов; доля зависит от типа продукта (по названию/категориям).
// Принцип тот же, что с водой: если точных данных нет — прикидываем по формуле.
export function estimateFiber(name, categories, carbs) {
  if (!carbs || carbs <= 0) return 0;
  const s = ((name || "") + " " + (categories || []).join(" ")).toLowerCase();
  let frac;
  if (/мяс|meat|рыб|fish|птиц|курин|говяд|свин|сыр|cheese|яйц|egg|молок|milk|йогурт|yogurt|творог|масло|oil|butter|сахар|sugar|мёд|honey/.test(s)) frac = 0;
  else if (/овощ|vegetable|брокколи|капуст|шпинат|салат|морков|огур|помидор|перец|кабач|гриб/.test(s)) frac = 0.35;
  else if (/бобов|legume|фасол|чечевиц|нут|горох|bean|lentil|chickpea|pea/.test(s)) frac = 0.30;
  else if (/орех|nut|миндал|семеч|семена|seed|almond|chia|чиа|отруб|bran/.test(s)) frac = 0.20;
  else if (/цельнозерн|whole.?grain|овс|oat|гречк|buckwheat|булгур|киноа|quinoa/.test(s)) frac = 0.14;
  else if (/фрукт|fruit|ягод|berry|яблок|груш|банан|апельсин|манго|слив|чернослив/.test(s)) frac = 0.18;
  else if (/хлеб|bread|макарон|pasta|рис|rice|крупа|каша|злак|cereal|мука|flour/.test(s)) frac = 0.07;
  else frac = 0.05; // прочее — небольшой запас
  return Math.round(carbs * frac * 10) / 10;
}

/* ================= продукт «на 100 г»: один расчёт для всего приложения =================
   Один и тот же продукт приходит из разных мест: свой справочник, Open Food Facts,
   общий каталог сервера, ввод пользователя «с этикетки». Всё сводится сюда, чтобы
   у каждого продукта были честные значения на 100 г (мл), клетчатка и признак
   напитка с индексом гидратации — от них считаются шкала клетчатки и вода. */

export const KJ_PER_KCAL = 4.184;
const r1 = (x) => Math.round(x * 10) / 10;

/** Напиток по названию или категориям: вода из него засчитывается в «Воду».
 *  Совпадение — только с начала слова и с подходящим окончанием: иначе «шоколад»
 *  ловился на «кола», а «тунец в собственном соку» — на «сок». */
const W = "(?<![a-zа-яё])";
export const DRINK_RE = new RegExp(W + "(вод[аыу](?![а-яё])|минерал|чай|кофе(?![а-яё])|кол[аыу](?![а-яё])|лимонад|газиров|морс|компот|квас|энергет|energ" +
  "|сок(?:и|а|ов)?(?![а-яё])|juice|смузи|коктейл|молок[оа](?![а-яё])|кефир|айран|латте|latte|капучино|cappuccino|americano|espresso" +
  "|эспрессо|тоник|tonic|нектар|напит|cola(?![a-z])|soda|drink|tea(?![a-z])|coffee|water(?![a-z]))", "i");

/** Индекс гидратации по названию: кофе и чай почти как вода, остальное чуть меньше. */
export function hydrationByName(name) {
  const n = name || "";
  if (/кофе|чай|coffee|tea/i.test(n)) return 0.95;
  if (/вода|минерал|water/i.test(n)) return 1;
  return 0.9;
}

/** Калории по белкам, жирам и углеводам (коэффициенты Этуотера 4/9/4). */
export const kcalFromMacros = ({ p = 0, f = 0, cb = 0 }) => 4 * p + 9 * f + 4 * cb;

const num = (v) => (v === "" || v == null ? null : (Number.isFinite(+v) ? +v : NaN));

/**
 * Привести продукт к значениям на 100 г (мл) и проверить на правдоподобие.
 * @param src { n, k?, p?, f?, cb?, fb?, per?=100, drink?, hy?, sv?, cats? }
 *   per — на сколько граммов (мл) даны значения: 100 — «на 100 г», 30 — «на порцию 30 г».
 *   k не задан — считается по БЖУ; fb не задана — оценивается по типу продукта.
 * @returns {{ ok: true, food, warn: string[] } | { ok: false, error: string }}
 */
export function per100(src) {
  const n = String(src.n || "").replace(/\s+/g, " ").trim();
  if (!n) return { ok: false, error: "no_name" };
  if (n.length > 120) return { ok: false, error: "name_too_long" };
  const per = num(src.per) ?? 100;
  if (!(per > 0 && per <= 2000)) return { ok: false, error: "bad_portion" };
  const raw = { k: num(src.k), p: num(src.p), f: num(src.f), cb: num(src.cb), fb: num(src.fb) };
  if (Object.values(raw).some((v) => Number.isNaN(v) || v < 0)) return { ok: false, error: "bad_number" };
  if (raw.k == null && raw.p == null && raw.f == null && raw.cb == null) return { ok: false, error: "no_values" };

  const scale = 100 / per;
  const p = r1((raw.p || 0) * scale), f = r1((raw.f || 0) * scale), cb = r1((raw.cb || 0) * scale);
  const k = Math.round(raw.k != null ? raw.k * scale : kcalFromMacros({ p, f, cb }));
  // на 100 г не бывает больше 100 г белка, жира или углеводов и больше 900 ккал (чистый жир)
  if (p > 100 || f > 100 || cb > 100 || p + f + cb > 105) return { ok: false, error: "macros_over_100" };
  if (k > 900) return { ok: false, error: "kcal_over_900" };

  const warn = [];
  const fromMacros = kcalFromMacros({ p, f, cb });
  if (raw.k != null && fromMacros > 0 && Math.abs(k - fromMacros) > Math.max(25, 0.25 * Math.max(k, fromMacros))) warn.push("kcal_mismatch");

  let fb = r1((raw.fb || 0) * scale), fbEst = false;
  if (fb > 100) return { ok: false, error: "macros_over_100" };
  if (!fb && cb > 0 && raw.fb == null) { fb = estimateFiber(n, src.cats, cb); fbEst = fb > 0; }

  const drink = src.drink === true || (src.drink !== false && DRINK_RE.test(n + " " + (src.cats || []).join(" ")));
  const hy = drink ? (num(src.hy) > 0 && num(src.hy) <= 1 ? num(src.hy) : hydrationByName(n)) : undefined;
  const sv = num(src.sv) > 0 && num(src.sv) <= 2000 ? r1(num(src.sv)) : (per !== 100 ? r1(per) : undefined);

  const food = { n, k, p, f, cb, fb };
  if (fbEst) food.fbEst = true;
  if (drink) { food.drink = true; food.hy = hy; }
  else if (DRINK_RE.test(n)) food.drink = false;   // явно «не напиток», хотя по названию похоже
  if (sv) food.sv = sv;
  return { ok: true, food, warn };
}

/**
 * Продукт Open Food Facts → наш формат на 100 г. null — если данных не хватает
 * или они неправдоподобны (база пополняется людьми, ошибки там бывают).
 * Энергия: ккал на 100 г, иначе кДж → ккал, иначе по БЖУ. Если есть только
 * значения на порцию — пересчитываем на 100 г по весу порции.
 */
export function offProductToFood(pr) {
  if (!pr || typeof pr !== "object") return null;
  const nu = pr.nutriments || {};
  let name = String(pr.product_name_ru || pr.product_name || "").replace(/\s+/g, " ").trim().slice(0, 90);
  if (!name) return null;
  const brand = String(pr.brands || "").split(",")[0].replace(/\s+/g, " ").trim().slice(0, 28);
  if (brand && !name.toLowerCase().includes(brand.toLowerCase())) name += " · " + brand;

  const pick = (suffix) => {
    const kcal = num(nu["energy-kcal" + suffix]);
    const kj = num(nu["energy-kj" + suffix]) ?? num(nu["energy" + suffix]);   // energy_* в OFF — всегда кДж
    return {
      k: kcal != null && !Number.isNaN(kcal) ? kcal : (kj != null && !Number.isNaN(kj) ? kj / KJ_PER_KCAL : null),
      p: num(nu["proteins" + suffix]), f: num(nu["fat" + suffix]), cb: num(nu["carbohydrates" + suffix]), fb: num(nu["fiber" + suffix]),
    };
  };
  let vals = pick("_100g"), per = 100;
  const has = (v) => v.k != null || v.p != null || v.f != null || v.cb != null;
  const svq = num(pr.serving_quantity);
  if (!has(vals) && svq > 0) { vals = pick("_serving"); per = svq; }
  if (!has(vals)) return null;

  const cats = Array.isArray(pr.categories_tags) ? pr.categories_tags.slice(0, 30).map(String) : [];
  const drink = cats.some((t) => /beverage|drink|water|soda|juice|tea|coffee|smoothie/.test(t)) || DRINK_RE.test(name);
  const res = per100({ n: name, ...vals, per, cats, drink, sv: svq > 0 && svq <= 2000 ? svq : undefined });
  if (!res.ok) return null;
  const code = /^\d{4,32}$/.test(String(pr.code || "")) ? String(pr.code) : null;
  return { id: code ? "off" + code : "off-" + name.toLowerCase(), src: "off", code, ...res.food };
}

// Поиск в Open Food Facts (открытый API, без ключа, база на GitHub).
// Возвращает продукты в том же формате, что и локальные (на 100 г).
export async function offSearch(query, signal) {
  const url = "https://world.openfoodfacts.org/cgi/search.pl?" +
    "search_terms=" + encodeURIComponent(query) +
    "&search_simple=1&action=process&json=1&page_size=25&lc=ru" +
    "&fields=code,product_name,product_name_ru,brands,nutriments,categories_tags,serving_quantity";
  const res = await fetch(url, { signal });
  const data = await res.json();
  return (data.products || []).map(offProductToFood).filter(Boolean);
}
