// Тема ставится до первой отрисовки: иначе при запуске мигает не та.
// Отдельным файлом, а не строкой в index.html: политика безопасности (CSP)
// запрещает встроенные скрипты — так их не сможет подсунуть и злоумышленник.
(function () {
  try {
    var t = localStorage.getItem("bodyupgrade.theme");
    if (t === "plain") {
      document.documentElement.dataset.theme = "plain";
      var m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute("content", "#080b11");
    }
  } catch (e) { /* без доступа к хранилищу — тема по умолчанию */ }
})();
