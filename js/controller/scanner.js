// Контроллер: сканер штрихкода.
//
// Камера → кадры → распознавание. Если браузер умеет BarcodeDetector (Android/Chrome),
// работает он; иначе — ZXing, который подгружается только при открытии сканера
// (assets/vendor/zxing). Код принимается, только если прочитан дважды подряд и сошлась
// контрольная цифра: так случайная ошибка камеры не приводит к чужому товару.
// Без камеры (запрет, старый телефон, веб-версия Telegram) — фото штрихкода или ввод цифр.
import { normalizeBarcode } from "../../data/barcode.js";
import { lookupBarcode } from "../model/foods.js";
import { overlayRoot } from "../view/dom.js";
import { fxChime, fxTap, haptic } from "../view/fx.js";
import { scanStatusView, scannerView } from "../view/scanner.js";

const ZXING_SRC = "assets/vendor/zxing/zxing-0.21.3.min.js";
const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];
let zxingLoad = null;

function loadZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  zxingLoad ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = ZXING_SRC;
    s.onload = () => (window.ZXing ? resolve(window.ZXing) : reject(new Error("zxing")));
    s.onerror = () => { zxingLoad = null; reject(new Error("zxing")); };
    document.head.appendChild(s);
  });
  return zxingLoad;
}

/** Распознаватель: native BarcodeDetector или ZXing. decode(canvas|bitmap) → { text, format } | null */
async function makeDecoder() {
  if ("BarcodeDetector" in window) {
    try {
      const sup = await window.BarcodeDetector.getSupportedFormats();
      if (FORMATS.some((f) => sup.includes(f))) {
        const det = new window.BarcodeDetector({ formats: FORMATS.filter((f) => sup.includes(f)) });
        return async (src) => { const r = await det.detect(src); return r[0] ? { text: r[0].rawValue, format: r[0].format } : null; };
      }
    } catch (e) { /* падаем на ZXing */ }
  }
  const Z = await loadZXing();
  const hints = new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  const reader = new Z.MultiFormatReader();
  reader.setHints(hints);
  return async (canvas) => {
    try {
      const bmp = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(canvas)));
      const r = reader.decode(bmp);
      const f = Z.BarcodeFormat[r.getBarcodeFormat()] || "";
      return { text: r.getText(), format: String(f).toLowerCase() };
    } catch (e) { return null; }   // на кадре штрихкода нет — это обычное дело
    finally { reader.reset(); }
  };
}

/**
 * Открыть сканер.
 * @param onFound(food) — товар найден (свой, из каталога или Open Food Facts)
 * @param onCreate(code) — товара нет нигде: создать свой продукт с этим штрихкодом
 */
export function openScanner({ onFound, onCreate }) {
  const o = document.createElement("div");
  o.className = "overlay food-sheet ob-sheet sc-sheet";
  o.setAttribute("role", "dialog");
  o.setAttribute("aria-label", "Сканер штрихкода");
  o.innerHTML = scannerView();
  overlayRoot.appendChild(o);
  const $ = (q) => o.querySelector(q);
  const video = $("#sc-video");
  const canvas = document.createElement("canvas");
  let stream = null, decode = null, timer = null, busy = false, closed = false, last = null;

  const status = (s) => {
    $("#sc-status").innerHTML = scanStatusView(s);
    const retry = $("#sc-retry"); if (retry) retry.onclick = () => find(s.code, s.format);
    const create = $("#sc-create"); if (create) create.onclick = () => { close(); onCreate(s.code); };
  };
  const stopCam = () => { clearTimeout(timer); if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; };
  const close = () => { closed = true; stopCam(); document.removeEventListener("visibilitychange", onVis); o.remove(); };
  const onVis = () => { if (document.hidden) stopCam(); else if (!closed && !busy) startCam(); };

  async function find(raw, format = "") {
    const code = normalizeBarcode(raw, format);
    if (!code) { status({ kind: "bad" }); return; }
    busy = true; stopCam();
    haptic(25);
    status({ kind: "look", code });
    const r = await lookupBarcode(code, format);
    if (closed) return;
    busy = false;
    if (r && r.food) { fxChime(); close(); onFound(r.food); return; }
    if (r && r.error === "offline") { status({ kind: "offline", code, format }); return; }
    status({ kind: "notfound", code: r ? r.code : code });
  }

  /** Кадр с камеры: центральная полоса, уменьшенная до 720 px — быстрее и точнее. */
  async function tick() {
    if (closed || busy || !stream) return;
    if (video.readyState >= 2 && video.videoWidth) {
      const vw = video.videoWidth, vh = video.videoHeight;
      const cw = Math.min(720, vw), scale = cw / vw;
      const bandH = Math.round(vh * 0.5);
      canvas.width = cw; canvas.height = Math.round(bandH * scale);
      canvas.getContext("2d", { willReadFrequently: true }).drawImage(video, 0, (vh - bandH) / 2, vw, bandH, 0, 0, canvas.width, canvas.height);
      const r = await decode(canvas).catch(() => null);
      if (r && r.text) {
        // дважды подряд одно и то же — значит, прочитано верно
        if (last === r.text && normalizeBarcode(r.text, r.format)) { find(r.text, r.format); return; }
        last = r.text;
      }
    }
    timer = setTimeout(tick, 180);
  }

  async function startCam() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { status({ kind: "nocam" }); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      if (closed) { stopCam(); return; }
      video.srcObject = stream;
      await video.play().catch(() => {});
      status({ kind: "aim" });
      decode ||= await makeDecoder();
      tick();
    } catch (e) {
      stopCam();
      $("#sc-stage").classList.add("off");
      status({ kind: "nocam" });
    }
  }

  // фото штрихкода: и как запасной путь, и для тех, у кого камера в приложении запрещена
  $("#sc-file").onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    stopCam();
    status({ kind: "look" });
    try {
      decode ||= await makeDecoder();
      const img = await createImageBitmap(file);
      let r = null;
      for (const rot of [0, 90]) {             // штрихкод на фото бывает повёрнут
        const w = rot ? img.height : img.width, h = rot ? img.width : img.height;
        const k = Math.min(1, 1600 / Math.max(w, h));
        canvas.width = Math.round(w * k); canvas.height = Math.round(h * k);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.save();
        if (rot) { ctx.translate(canvas.width, 0); ctx.rotate(Math.PI / 2); }
        ctx.drawImage(img, 0, 0, img.width * k, img.height * k);
        ctx.restore();
        r = await decode(canvas).catch(() => null);
        if (r) break;
      }
      if (r && r.text) find(r.text, r.format); else status({ kind: "nophoto" });
    } catch (err) { status({ kind: "nophoto" }); }
    e.target.value = "";
  };
  $("#sc-manual-b").onclick = () => { fxTap(); const m = $("#sc-manual"); m.hidden = false; $("#sc-code").focus(); };
  $("#sc-go").onclick = () => find($("#sc-code").value);
  $("#sc-code").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); find($("#sc-code").value); } };
  $("#sc-close").onclick = close;
  document.addEventListener("visibilitychange", onVis);

  status({ kind: "aim" });
  startCam();
  return { close };
}
