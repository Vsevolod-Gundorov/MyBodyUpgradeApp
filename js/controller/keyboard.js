// Контроллер экранной клавиатуры и жестов на телефоне.
import { kbdBarView } from "../view/components.js";

/* ================= клавиатура на телефоне ================= */
// У цифровой клавиатуры iOS нет кнопки «готово»: закрыть её можно только тапом
// мимо поля, а на экране квеста мимо поля — либо другое поле, либо кнопка.
// Поэтому пока поле в фокусе, над клавиатурой висит своя полоска «Готово»,
// и любой тап по пустому месту тоже снимает фокус.
export const isField = (el) => !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");

// на десктопе клавиатуры нет — полоска там только мешала бы нижним кнопкам
export const hasTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;

export let kbdBar = null;

export let kbdGuard = 0;   // пока свежий тап по «Готово» — полоску не убираем: на ней ещё гасится призрачный клик

export function placeKbdBar() {
  if (!kbdBar) return;
  const vv = window.visualViewport;
  if (vv) { kbdBar.style.top = `${Math.round(vv.offsetTop + vv.height)}px`; kbdBar.style.bottom = "auto"; }
  else { kbdBar.style.top = "auto"; kbdBar.style.bottom = "0px"; }
}

export function showKbdBar() {
  if (!hasTouch) return;
  if (!kbdBar) {
    kbdBar = document.createElement("div");
    kbdBar.className = "kbd-bar";
    kbdBar.innerHTML = kbdBarView();
    // pointerdown с preventDefault: поле не успевает потерять фокус до нажатия,
    // и клавиатура закрывается с первого касания, а не со второго
    // pointerdown с preventDefault: поле не успевает потерять фокус до нажатия,
    // и клавиатура закрывается с первого касания, а не со второго
    kbdBar.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      kbdGuard = Date.now();
      const el = document.activeElement;
      if (isField(el)) el.blur();
      // прячем не сразу: iOS дошлёт сюда клик, и если полоски уже нет, он
      // прилетит по тому, что под ней — например по вкладкам внизу
      setTimeout(hideKbdBar, 450);
    });
    kbdBar.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); });
    document.body.appendChild(kbdBar);
  }
  kbdBar.classList.add("on");
  // нижнее меню и плашка отдыха прибиты к низу окна, а на телефоне клавиатура
  // это «низ» сдвигает: полоски начинают жить своей жизнью посреди экрана.
  // Пока печатаем — убираем их, наверху и так висит своя кнопка «Готово»
  document.body.classList.add("kbd");
  placeKbdBar();
}

export function hideKbdBar() {
  if (!kbdBar || Date.now() - kbdGuard < 400) return;
  kbdBar.classList.remove("on");
  document.body.classList.remove("kbd");
  // iOS иногда оставляет fixed-элементы там, где был сдвинутый вьюпорт:
  // короткий толчок скролла ставит их на место
  requestAnimationFrame(() => window.scrollTo(window.scrollX, window.scrollY));
}

/** Подключить обработчики клавиатуры и жестов. Вызывается один раз при запуске. */
export function initKeyboard() {
  /* ================= запрет зума на всех экранах ================= */
  // Двойной тап и так не зумит: за это отвечает touch-action: manipulation в CSS.
  // Раньше здесь висел ещё и перехват touchend с preventDefault на любое второе
  // касание за 350 мс — он глушил быстрые тапы целиком, вместе с фокусом и блюром.
  // Из-за него клавиатуру нельзя было быстро закрыть и открыть заново: тап просто
  // не доходил до страницы.
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });

  document.addEventListener("focusin", (e) => { if (isField(e.target)) showKbdBar(); });
  document.addEventListener("focusout", (e) => {
    if (!isField(e.target)) return;
    // фокус мог уехать в соседнее поле — полоску прячем, только если ушли совсем
    setTimeout(() => { if (!isField(document.activeElement)) hideKbdBar(); }, 120);
  });
  // тап по пустому месту снимает фокус: на телефоне это главный способ убрать клавиатуру
  document.addEventListener("pointerdown", (e) => {
    const el = document.activeElement;
    if (!isField(el) || el === e.target) return;
    if (e.target.closest && e.target.closest("input, textarea, .kbd-bar")) return;
    el.blur();
  }, true);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", placeKbdBar);
    window.visualViewport.addEventListener("scroll", placeKbdBar);
  }
}
