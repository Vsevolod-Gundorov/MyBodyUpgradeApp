// Вид: сканер штрихкода — видоискатель, состояние, фото и ввод цифр.
import { esc } from "../core/format.js";
import { icon } from "./icons.js";

export function scannerView() {
  return `
    <div class="ob-head sc-head">
      <button class="fs-close" id="sc-close" aria-label="Закрыть">${icon("close")}</button>
      <div class="np-title">Штрихкод</div>
      <span class="ob-head-pad"></span>
    </div>
    <div class="sc-stage" id="sc-stage">
      <video id="sc-video" playsinline muted autoplay aria-label="Камера"></video>
      <div class="sc-frame" aria-hidden="true"><i class="sc-laser"></i></div>
    </div>
    <div class="sc-status" id="sc-status" role="status" aria-live="polite"></div>
    <div class="sc-actions">
      <label class="btn-ghost sc-photo">Сфотографировать<input id="sc-file" type="file" accept="image/*" capture="environment" hidden /></label>
      <button class="btn-ghost" id="sc-manual-b">Ввести цифры</button>
    </div>
    <div class="sc-manual" id="sc-manual" hidden>
      <input id="sc-code" inputmode="numeric" pattern="[0-9]*" maxlength="14" autocomplete="off" placeholder="Цифры под штрихкодом" aria-label="Цифры штрихкода" />
      <button class="finish-btn" id="sc-go" style="margin-top:0">Найти</button>
    </div>`;
}

/** Состояние под видоискателем: подсказка, поиск, ошибка — и что можно сделать дальше. */
export function scanStatusView({ kind, code = "", text = "" }) {
  const c = code ? ` <span class="mono">${esc(code)}</span>` : "";
  if (kind === "aim") return `<span>Наведите камеру на штрихкод — он считается сам</span>`;
  if (kind === "nocam") return `<span>Камера недоступна. Сфотографируйте штрихкод или введите цифры под ним.</span>`;
  if (kind === "look") return `<span class="sc-spin" aria-hidden="true"></span><span>Ищу${c}…</span>`;
  if (kind === "bad") return `<span class="sc-err">${text || "Не похоже на штрихкод товара — проверьте цифры"}</span>`;
  if (kind === "nophoto") return `<span class="sc-err">На фото штрихкод не нашёлся. Снимите ближе и ровнее, при хорошем свете.</span>`;
  if (kind === "offline") return `<span class="sc-err">Нет связи с базой продуктов.</span><button class="link-btn" id="sc-retry">Повторить</button>`;
  if (kind === "notfound") return `<span>Товара${c} нет в базах.</span><button class="finish-btn sc-create" id="sc-create" style="margin-top:8px">Создать продукт с этим штрихкодом</button>`;
  return "";
}
