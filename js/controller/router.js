// Контроллер: навигация между экранами, «назад», заставка и тема.
import { THEMES, themeOf } from "../../data/theme.js";
import { setBackButton } from "../telegram.js";
import { renderBuffs } from "./buffs.js";
import { renderCycle } from "./cycle.js";
import { renderPool } from "./pool.js";
import { renderProfile } from "./profile.js";
import { renderProgress } from "./progress.js";
import { renderResources } from "./resources.js";
import { buffsActionable } from "../model/buffs.js";
import { S, save } from "../model/store.js";
import { L, THEME_KEY, themeNow } from "../model/theme.js";
import { fxTransition } from "../view/fx.js";
import { icon } from "../view/icons.js";

export function applyTheme() {
  const id = themeNow();
  document.documentElement.dataset.theme = id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", themeOf(id).color);
  try { localStorage.setItem(THEME_KEY, id); } catch (e) { /* приватный режим */ }
}

export function setTheme(id) {
  if (!THEMES[id] || id === themeNow()) return;
  S.settings.theme = id;
  save(); applyTheme(); render();
}

export const VIEWS = ["profile", "cycle", "buffs", "resources", "progress"];

export let view = VIEWS.includes((location.hash || "").slice(1)) ? location.hash.slice(1) : "profile";

/** Подключить таббар и заставку. Вызывается один раз при запуске (main.js). */
export function initRouter() {
  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      if (t.dataset.view === view && !cycleSub) return;
      withLoader(() => { view = t.dataset.view; cycleSub = null; render(); });
    });
  });
  if (loaderEmblem) loaderEmblem.innerHTML = icon("sigil");
}

/* ---- анимированный лоадер между экранами ---- */
export const loaderEl = document.getElementById("loader");

export const loaderEmblem = document.getElementById("loader-emblem");

export const LOADER_WORDS = ["Пробуждение", "Сбор рун", "Врата открываются", "Судьба зовёт", "Кровь и сталь", "Восхождение"];

export const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export let loaderHideTimer = null;

export function withLoader(action) {
  // «Чистая» переключает экраны без заставки: межэкранная анимация с рунами —
  // часть саги, а в обычном интерфейсе это просто задержка на ровном месте
  if (reduceMotion || !loaderEl || themeNow() === "plain") { action(); return; }
  const word = document.getElementById("loader-word");
  if (word) word.textContent = LOADER_WORDS[Math.floor(Math.random() * LOADER_WORDS.length)];
  fxTransition();
  clearTimeout(loaderHideTimer);
  loaderEl.classList.remove("out");
  loaderEl.classList.add("show");
  setTimeout(() => {
    try { action(); }
    finally {
      // всегда прячем лоадер, даже если рендер бросил ошибку
      loaderEl.classList.add("out");
      loaderHideTimer = setTimeout(() => { loaderEl.classList.remove("show", "out"); }, 320);
    }
  }, 440);
}

export let cycleSub = null; // подстраница раздела квестов: null | "pool"
// Экран и подстраницу меняют и другие контроллеры (выход из квеста, из арсенала):
// импортированную переменную снаружи не переприсвоить, поэтому — через сеттеры.
export function setView(v) { view = v; }
export function setCycleSub(v) { cycleSub = v; }

export let backHandler = null; // что делает «назад» на текущем экране (и системная кнопка Телеграма)

export function setBack(fn) { backHandler = fn; setBackButton(!!fn); }

export function render() {
  setBack(null);
  // подпись и значок вкладки зависят от темы, поэтому ставятся на каждой отрисовке,
  // а не один раз при запуске: иначе после переключения темы таббар остаётся прежним
  const TAB_LEX = { profile: "tabHero", cycle: "tabQuests", buffs: "tabBuffs", resources: "tabFood", progress: "tabLog" };
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.view === view);
    const holder = t.querySelector(".tab-ico");
    if (holder && t.dataset.icon) holder.innerHTML = icon(t.dataset.icon);
    const lbl = t.querySelector("span:not(.tab-ico):not(.tab-badge)");
    const key = TAB_LEX[t.dataset.view];
    if (lbl && key) { lbl.textContent = L(key); t.setAttribute("aria-label", L(key)); }
  });
  updateBuffBadge();
  window.scrollTo(0, 0);
  if (view === "profile") renderProfile();
  else if (view === "cycle") { if (cycleSub === "pool") renderPool(); else renderCycle(); }
  else if (view === "buffs") renderBuffs();
  else if (view === "resources") renderResources();
  else if (view === "progress") renderProgress();
}

export function updateBuffBadge() {
  const badge = document.getElementById("buffs-badge");
  if (badge) badge.hidden = !buffsActionable();
}
