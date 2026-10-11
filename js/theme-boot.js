// Тема, язык, масштаб и яркость ставятся до первой отрисовки: иначе при запуске мигает не то.
// Отдельным файлом, а не строкой в index.html: политика безопасности (CSP)
// запрещает встроенные скрипты — так их не сможет подсунуть и злоумышленник.
(function () {
  var root = document.documentElement;
  try {
    var t = localStorage.getItem("bodyupgrade.theme");
    if (t === "plain") {
      root.dataset.theme = "plain";
      var m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute("content", "#080b11");
    }
  } catch (e) { /* без доступа к хранилищу — тема по умолчанию */ }
  try {
    var d = JSON.parse(localStorage.getItem("bodyupgrade.display") || "null");
    if (d) {
      if (d.lang === "en") root.lang = "en";
      var z = Number(d.zoom), b = Number(d.bright);
      if (z >= 0.8 && z <= 1.3) root.style.setProperty("--ui-zoom", String(z));
      if (b >= 60 && b <= 130) {
        if (b < 100) { root.style.setProperty("--dim-a", String((100 - b) / 100)); root.setAttribute("data-dim", ""); }
        if (b > 100) { root.style.setProperty("--lift", String(Math.round((b - 100) * 1.6))); root.setAttribute("data-lift", ""); }
      }
    }
  } catch (e) { /* испорченная копия — значения по умолчанию */ }
})();
