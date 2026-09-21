/* Anti-flash de vertical IIMP — se ejecuta antes del primer paint.
   Aplica vert-* + data-vertical leyendo localStorage o ?theme= */
(function () {
  try {
    var allowed = ["proexplo", "wmc", "gess", "perumin"];
    var savedV = localStorage.getItem("iimp-vertical");
    var params = new URLSearchParams(window.location.search);
    var themeParam = params.get("theme");
    var vertical =
      allowed.indexOf(themeParam) !== -1
        ? themeParam
        : allowed.indexOf(savedV) !== -1
          ? savedV
          : "proexplo";
    document.documentElement.classList.add("vert-" + vertical);
    document.documentElement.setAttribute("data-vertical", vertical);
  } catch {}
})();
