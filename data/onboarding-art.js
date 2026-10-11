// Картинки знакомства: силуэты для выбора пола и пиктограммы уровней.
// Рисованные, без внешних файлов: цвет берут из currentColor, поэтому
// одинаково ложатся на обе темы. Только разметка SVG, без логики.

const svg = (vb, inner, cls = "") => `<svg class="ob-art ${cls}" viewBox="${vb}" aria-hidden="true">${inner}</svg>`;

/** Силуэт мужчины: широкие плечи, прямой корпус. */
export const MALE = svg("0 0 80 120", `
  <circle cx="40" cy="15" r="10" fill="currentColor"/>
  <path d="M20 31c6-4 13-5 20-5s14 1 20 5l5 30c.4 2.5-1.6 4.6-4 4.2l-3.6-.6L56 49l-2 21H26l-2-21-1.4 15.6-3.6.6c-2.4.4-4.4-1.7-4-4.2z" fill="currentColor"/>
  <path d="M27 72h11l-1 40c0 2.2-1.8 4-4 4s-4-1.8-4-4zM42 72h11l-2 40c0 2.2-1.8 4-4 4s-4-1.8-4-4z" fill="currentColor"/>`);

/** Силуэт женщины: талия, более узкие плечи. */
export const FEMALE = svg("0 0 80 120", `
  <circle cx="40" cy="15" r="10" fill="currentColor"/>
  <path d="M25 31c5-3 10-4.5 15-4.5s10 1.5 15 4.5l5 28c.4 2.4-1.5 4.5-3.9 4.1l-3.3-.6L52 47c-2 6-3 10-1 16l6 15H23l6-15c2-6 1-10-1-16l-1.8 15.5-3.3.6c-2.4.4-4.3-1.7-3.9-4.1z" fill="currentColor"/>
  <path d="M30 80h9l-1 32c0 2.2-1.8 4-4 4s-4-1.8-4-4zM41 80h9l-.5 32c0 2.2-1.8 4-4 4s-4-1.8-4-4z" fill="currentColor"/>`);

/** Уровень 1–4 столбиками: насколько подвижный день или большой опыт — видно без слов. */
export const levelBars = (n, of = 4) => svg(`0 0 ${of * 12} 34`,
  Array.from({ length: of }, (_, i) => {
    const h = 10 + i * 8;
    return `<rect x="${i * 12 + 1}" y="${34 - h}" width="8" height="${h}" rx="2.5" fill="currentColor" opacity="${i < n ? 1 : 0.18}"/>`;
  }).join(""), "ob-bars");
