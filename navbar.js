/* ============================================================
   navbar.js — auto-hiding bottom tab bar on narrow screens.

   Only active in the narrow (bottom-bar) layout — wide mode with the left
   sidebar is untouched. Safari-style:
     - scroll down  -> collapse to a small "Menu" pill floating near the bottom
     - scroll up    -> reveal the full bar
     - tap / hover the pill -> reveal the full bar

   Scroll is listened for on window AND in the capture phase on document, so it
   works whether the page scrolls or an inner container (e.g. the calendar) does.
   ============================================================ */

(function () {
  function isNarrow() { return window.matchMedia("(max-width: 720px)").matches; }

  function init() {
    var sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    var lastY = null;
    var THRESHOLD = 6;

    function collapse() { if (isNarrow()) sidebar.classList.add("nav-collapsed"); }
    function expand() { sidebar.classList.remove("nav-collapsed"); }

    function scrollTop(t) {
      if (t && t !== document && t.scrollTop != null) return t.scrollTop;
      return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    }

    function handle(y) {
      if (!isNarrow()) { expand(); lastY = y; return; }
      if (lastY == null) { lastY = y; return; }
      var dy = y - lastY;
      if (Math.abs(dy) < THRESHOLD) return;
      if (dy > 0 && y > 30) collapse();
      else if (dy < 0) expand();
      lastY = y;
    }

    window.addEventListener("scroll", function () { handle(scrollTop()); }, { passive: true });
    document.addEventListener("scroll", function (e) { handle(scrollTop(e.target)); }, { passive: true, capture: true });

    // Tap the collapsed pill -> reveal the full bar.
    sidebar.addEventListener("click", function () {
      if (sidebar.classList.contains("nav-collapsed")) expand();
    });
    // Hover the pill (mouse, narrow desktop windows) -> reveal.
    sidebar.addEventListener("mouseenter", function () {
      if (isNarrow()) expand();
    });

    window.addEventListener("resize", function () { if (!isNarrow()) expand(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
