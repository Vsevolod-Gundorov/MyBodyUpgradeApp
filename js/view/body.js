// Вид: вес тела — карточка с графиком, запись взвешивания, история.
// График: один ряд — точки взвешиваний и линия тренда того же цвета. Легенда не нужна:
// заголовок говорит, что нарисовано. Сетка — волосяные линии цвета линий темы.
import { MONTHS, esc, fmt } from "../core/format.js";

const W = 340, H = 150, PL = 30, PR = 10, PT = 12, PB = 20;
const dayMs = 864e5;
const tOf = (iso) => new Date(iso + "T00:00:00Z").getTime();
const short = (iso) => { const d = new Date(iso + "T00:00:00Z"); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`; };

/** Геометрия графика: общая для вида и для касаний в контроллере. */
export function chartGeom(series, fromIso, toIso) {
  const pts = series.filter((p) => p.date >= fromIso && p.date <= toIso);
  if (!pts.length) return null;
  const vals = pts.flatMap((p) => [p.kg, p.trend]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max(0.3, (hi - lo) * 0.1);
  // круглые деления: шаг 0,5 / 1 / 2 / 5 кг, не больше четырёх промежутков
  const step = [0.5, 1, 2, 5, 10, 20, 50, 100].find((s) => Math.ceil((hi + pad) / s) - Math.floor((lo - pad) / s) <= 4) || 100;
  const n = Math.max(2, Math.ceil((hi + pad) / step) - Math.floor((lo - pad) / step));
  lo = Math.floor((lo - pad) / step) * step; hi = lo + step * n;
  const t0 = tOf(fromIso), t1 = Math.max(tOf(toIso), t0 + dayMs);
  const x = (iso) => PL + ((tOf(iso) - t0) / (t1 - t0)) * (W - PL - PR);
  const y = (v) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
  return { pts: pts.map((p) => ({ ...p, x: x(p.date), yk: y(p.kg), yt: y(p.trend) })), lo, hi, step, n, y, x, fromIso, toIso };
}

function chartSvg(g) {
  if (!g) return `<div class="wc-empty dim small">Здесь появится график, когда будет хотя бы одно взвешивание.</div>`;
  const grid = Array.from({ length: g.n + 1 }, (_, i) => {
    const v = g.lo + g.step * i, yy = g.y(v).toFixed(1);
    return `<line x1="${PL}" x2="${W - PR}" y1="${yy}" y2="${yy}" class="wc-grid"/><text x="${PL - 6}" y="${(+yy + 3.5).toFixed(1)}" class="wc-ax" text-anchor="end">${fmt(v)}</text>`;
  }).join("");
  const xl = [g.fromIso, g.toIso].map((iso, i) => `<text x="${i ? W - PR : PL}" y="${H - 4}" class="wc-ax" text-anchor="${i ? "end" : "start"}">${short(iso)}</text>`).join("");
  const line = g.pts.length > 1 ? `<path d="${g.pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.yt.toFixed(1)}`).join(" ")}" class="wc-trend"/>` : "";
  const dots = g.pts.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.yk.toFixed(1)}" r="4" class="wc-dot"/>`).join("");
  const last = g.pts[g.pts.length - 1];
  return `
    <svg class="wc-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Вес тела с ${short(g.fromIso)} по ${short(g.toIso)}: тренд ${fmt(last.trend)} кг">
      ${grid}${xl}${line}${dots}
      <circle cx="${last.x.toFixed(1)}" cy="${last.yt.toFixed(1)}" r="5" class="wc-end"/>
      <line class="wc-cross" id="wc-cross" x1="0" x2="0" y1="${PT}" y2="${H - PB}" visibility="hidden"/>
      <circle class="wc-hl" id="wc-hl" r="5" visibility="hidden"/>
    </svg>
    <div class="wc-tip" id="wc-tip" hidden></div>`;
}

export function weightCardView({ g, cur, change, rate, range, empty }) {
  const sign = (v) => (v > 0 ? "+" : v < 0 ? "−" : "±") + fmt(Math.abs(v));
  return `
    <section class="panel weight-card" aria-label="Вес тела">
      <div class="wc-head">
        <div class="wc-title">
          <span class="eyebrow">Вес тела</span>
          ${empty ? `<b class="wc-now">—</b>` : `<b class="wc-now mono">${fmt(cur)}<i> кг</i></b>`}
          <span class="wc-sub dim small">${empty ? "Пока нет взвешиваний" : [change != null ? `${sign(change)} кг за ${{ 30: "месяц", 90: "3 месяца", 3650: "всё время" }[range]}` : "", rate != null ? `${sign(rate)} кг/нед` : ""].filter(Boolean).join(" · ") || "тренд по взвешиваниям"}</span>
        </div>
        <button class="nx-btn add" id="wc-add">+ Вес</button>
      </div>
      ${empty ? "" : `<div class="wc-range ob-seg" role="group" aria-label="Период">
        ${[[30, "Месяц"], [90, "3 месяца"], [3650, "Всё"]].map(([d, n]) => `<button class="ob-seg-b ${range === d ? "on" : ""}" data-range="${d}" aria-pressed="${range === d}">${n}</button>`).join("")}
      </div>`}
      <div class="wc-chart" id="wc-chart">${empty ? "" : chartSvg(g)}</div>
      ${empty ? "" : `<button class="link-btn wc-hist-b" id="wc-hist">История взвешиваний</button>`}
    </section>`;
}

export const tipView = (p) => `<b class="mono">${fmt(p.kg)} кг</b><span>${short(p.date)} · тренд ${fmt(p.trend)}</span>`;

export function weightSheetView({ kg, date, max }) {
  return `
    <div class="portion-card">
      <div class="portion-name display">Взвешивание</div>
      <p class="dim small" style="margin:6px 0 14px">Лучше утром, натощак, в одно и то же время — так тренд точнее.</p>
      <div class="stepper">
        <button class="stp" data-step="-0.1" aria-label="Минус 100 г">−</button>
        <div class="stp-mid"><input id="ws-kg" inputmode="decimal" value="${fmt(kg)}" aria-label="Вес, кг" /><span class="stp-unit" style="text-decoration:none">кг</span></div>
        <button class="stp" data-step="0.1" aria-label="Плюс 100 г">+</button>
      </div>
      <label class="cf-field" style="margin-bottom:14px"><span>Дата</span><input id="ws-date" type="date" value="${date}" max="${max}" /></label>
      <div class="ob-error" id="ws-error" role="alert"></div>
      <div class="portion-actions">
        <button class="btn-ghost" id="ws-cancel">Отмена</button>
        <button class="finish-btn" id="ws-save" style="margin-top:0">Сохранить</button>
      </div>
    </div>`;
}

export function historyView({ rows }) {
  return `
    <div class="portion-card">
      <div class="portion-name display">История взвешиваний</div>
      <div class="wh-list">${rows.map((r) => `
        <div class="wh-row"><span>${short(r.date)} ${r.date.slice(0, 4)}</span><b class="mono">${fmt(r.kg)} кг</b>
          <button class="wh-del" data-del="${esc(r.date)}" aria-label="Удалить взвешивание ${short(r.date)}">✕</button></div>`).join("")}</div>
      <button class="btn-ghost" id="wh-close" style="width:100%">Готово</button>
    </div>`;
}
