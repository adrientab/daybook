/* ============================================================
   navbar.js — auto-hiding bottom tab bar on narrow screens.

   Only active in the narrow (bottom-bar) layout — wide mode with the left
   sidebar is untouched.
     - starts COLLAPSED by default (a small ☰ pill near the bottom)
     - scroll down            -> collapse
     - scroll up (touch only)  -> expand
     - tap the pill            -> expand (touch)
     - hover the pill (mouse)  -> expand; mouse leaving -> collapse again
   ============================================================ */

(function () {
  function isNarrow() { return window.matchMedia("(max-width: 720px)").matches; }

  function init() {
    var sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    var lastY = null;
    var THRESHOLD = 6;

    var touchActive = false;
    window.addEventListener("touchstart", function () { touchActive = true; }, { passive: true });
    window.addEventListener("mousemove", function () { touchActive = false; }, { passive: true });
    window.addEventListener("wheel", function () { touchActive = false; }, { passive: true });

    function collapse() { if (isNarrow()) sidebar.classList.add("nav-collapsed"); }
    function expand() { sidebar.classList.remove("nav-collapsed"); }

    // Start collapsed on narrow screens.
    if (isNarrow()) sidebar.classList.add("nav-collapsed");

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
      else if (dy < 0 && touchActive) expand();
      lastY = y;
    }

    window.addEventListener("scroll", function () { handle(scrollTop()); }, { passive: true });
    document.addEventListener("scroll", function (e) { handle(scrollTop(e.target)); }, { passive: true, capture: true });

    // Tap the collapsed pill -> expand (touch).
    sidebar.addEventListener("click", function () {
      if (sidebar.classList.contains("nav-collapsed")) expand();
    });
    // Hover to expand; leaving collapses again (desktop).
    sidebar.addEventListener("mouseenter", function () { if (isNarrow()) expand(); });
    sidebar.addEventListener("mouseleave", function () { if (isNarrow()) collapse(); });

    window.addEventListener("resize", function () {
      if (!isNarrow()) expand();
      else if (lastY == null) collapse();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
