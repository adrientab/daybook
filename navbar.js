/* ============================================================
   navbar.js — auto-hiding bottom tab bar on narrow screens.

   Only active in the narrow (bottom-bar) layout — wide mode with the left
   sidebar is untouched.
     - scroll down            -> collapse to a small "Menu" pill near the bottom
     - scroll up (touch only)  -> expand back to the full bar
     - tap the pill            -> expand (touch)
     - hover the pill (mouse)  -> expand (desktop; scroll-up does NOT expand)

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

    // Was the most recent scroll driven by touch? Mouse/trackpad scroll-up
    // should NOT expand the bar (only hover does on desktop); touch should.
    var touchActive = false;
    window.addEventListener("touchstart", function () { touchActive = true; }, { passive: true });
    window.addEventListener("mousemove", function () { touchActive = false; }, { passive: true });
    window.addEventListener("wheel", function () { touchActive = false; }, { passive: true });

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
      if (dy > 0 && y > 30) {
        collapse();                       // scrolling down -> collapse (any input)
      } else if (dy < 0 && touchActive) {
        expand();                         // scrolling up -> expand only on touch
      }
      lastY = y;
    }

    window.addEventListener("scroll", function () { handle(scrollTop()); }, { passive: true });
    document.addEventListener("scroll", function (e) { handle(scrollTop(e.target)); }, { passive: true, capture: true });

    // Tap the collapsed pill -> expand.
    sidebar.addEventListener("click", function () {
      if (sidebar.classList.contains("nav-collapsed")) expand();
    });
    // Hover the pill (mouse) -> expand. This is the desktop reveal.
    sidebar.addEventListener("mouseenter", function () {
      if (isNarrow()) expand();
    });

    window.addEventListener("resize", function () { if (!isNarrow()) expand(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
