/* ============================================================
   navbar.js — auto-hiding bottom tab bar on narrow screens.
   TEMPORARY: includes an on-screen debug readout (top-left) so we can see
   what's happening. Remove the DEBUG block once it's working.
   ============================================================ */

(function () {
  function isNarrow() { return window.matchMedia("(max-width: 720px)").matches; }

  function init() {
    var sidebar = document.getElementById("sidebar");

    // --- DEBUG readout ---
    var dbg = document.createElement("div");
    dbg.style.cssText = "position:fixed;top:4px;left:4px;z-index:9999;background:rgba(0,0,0,.8);color:#fff;font:11px monospace;padding:4px 6px;border-radius:4px;pointer-events:none;max-width:60vw;";
    document.body.appendChild(dbg);
    function log(msg) { dbg.textContent = msg; }

    if (!sidebar) { log("navbar: #sidebar NOT FOUND"); return; }
    log("navbar: ready narrow=" + isNarrow());

    var lastY = null;
    var THRESHOLD = 6;

    function collapse() { if (isNarrow()) sidebar.classList.add("nav-collapsed"); }
    function expand() { sidebar.classList.remove("nav-collapsed"); }

    function scrollTop(t) {
      if (t && t !== document && t.scrollTop != null) return t.scrollTop;
      return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    }

    function handle(y, src) {
      var narrow = isNarrow();
      log("scroll " + src + " y=" + Math.round(y) + " narrow=" + narrow + " collapsed=" + sidebar.classList.contains("nav-collapsed"));
      if (!narrow) { expand(); lastY = y; return; }
      if (lastY == null) { lastY = y; return; }
      var dy = y - lastY;
      if (Math.abs(dy) < THRESHOLD) return;
      if (dy > 0 && y > 30) collapse();
      else if (dy < 0) expand();
      lastY = y;
    }

    window.addEventListener("scroll", function () { handle(scrollTop(), "win"); }, { passive: true });
    document.addEventListener("scroll", function (e) { handle(scrollTop(e.target), "doc"); }, { passive: true, capture: true });

    sidebar.addEventListener("click", function () {
      if (sidebar.classList.contains("nav-collapsed")) expand();
    });
    sidebar.addEventListener("mouseenter", function () { if (isNarrow()) expand(); });
    window.addEventListener("resize", function () { if (!isNarrow()) expand(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
