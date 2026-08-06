/* ============================================================
   navbar.js — auto-hiding bottom tab bar on narrow screens.

   Only active in the narrow (bottom-bar) layout — wide mode with the left
   sidebar is untouched.
     - starts COLLAPSED by default (a small ☰ pill near the bottom)
     - scroll down            -> collapse
     - scroll up (touch only)  -> expand
     - tap the pill            -> expand (and the tap is swallowed so it can't
                                  fall through to a tab)
     - hover the pill (mouse)  -> expand; mouse leaving -> collapse again
   ============================================================ */

(function () {
  function isNarrow() { return window.matchMedia("(max-width: 720px)").matches; }

  function init() {
    var sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    var lastY = null;
    var THRESHOLD = 10;         // ignore small scroll jitters
    var atBottomGuard = false;  // set briefly when we're at the very bottom

    var touchActive = false;
    window.addEventListener("touchstart", function () { touchActive = true; }, { passive: true });
    window.addEventListener("mousemove", function () { touchActive = false; }, { passive: true });
    window.addEventListener("wheel", function () { touchActive = false; }, { passive: true });

    function collapse() { if (isNarrow()) { sidebar.classList.add("nav-collapsed"); syncBottom(); } }
    function expand() { sidebar.classList.remove("nav-collapsed"); syncBottom(); }
    function collapsed() { return sidebar.classList.contains("nav-collapsed"); }

    if (isNarrow()) sidebar.classList.add("nav-collapsed");

    function scrollTop(t) {
      if (t && t !== document && t.scrollTop != null) return t.scrollTop;
      return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    }
    // How far the document can scroll (to detect the rubber-band at the bottom).
    function maxScroll() {
      var d = document.documentElement, b = document.body;
      return Math.max(d.scrollHeight, b.scrollHeight) - window.innerHeight;
    }

    function handle(y) {
      if (!isNarrow()) { expand(); lastY = y; return; }
      if (lastY == null) { lastY = y; return; }
      var dy = y - lastY;
      if (Math.abs(dy) < THRESHOLD) return;

      if (dy > 0 && y > 30) {
        collapse();
      } else if (dy < 0 && touchActive) {
        // iOS Safari "rubber-band" at the very bottom bounces the page up a few
        // px, which looks like a scroll-up we didn't make. Ignore upward motion
        // that happens right at the bottom edge so the bar doesn't pop open.
        if (!(y >= maxScroll() - 4)) expand();
      }
      lastY = y;
    }

    window.addEventListener("scroll", function () { handle(scrollTop()); }, { passive: true });
    document.addEventListener("scroll", function (e) { handle(scrollTop(e.target)); }, { passive: true, capture: true });

    // Tap-to-expand. Use pointerdown in CAPTURE phase so, when collapsed, we
    // expand and fully swallow the event before it can reach a tab underneath
    // (which otherwise navigated to whatever tab sat under your finger).
    sidebar.addEventListener("pointerdown", function (e) {
      if (collapsed()) {
        e.preventDefault();
        e.stopPropagation();
        expand();
      }
    }, true);
    // Belt-and-suspenders: also swallow the click that follows a collapsed tap.
    sidebar.addEventListener("click", function (e) {
      if (sidebar.dataset.justExpanded === "1") {
        e.preventDefault();
        e.stopPropagation();
        sidebar.dataset.justExpanded = "";
      }
    }, true);
    sidebar.addEventListener("pointerdown", function () {
      if (collapsed()) sidebar.dataset.justExpanded = "1";
    }, true);

    // Hover to expand; leaving collapses again (desktop).
    sidebar.addEventListener("mouseenter", function () { if (isNarrow()) expand(); });
    sidebar.addEventListener("mouseleave", function () { if (isNarrow()) collapse(); });

    // iOS Safari: position: fixed is measured against the layout viewport, so
    // the pill can float above the *visible* bottom when the toolbar shows.
    // When a visualViewport is available, keep the collapsed pill pinned to the
    // real visible bottom edge instead.
    function syncBottom() {
      var vv = window.visualViewport;
      if (!vv || !isNarrow()) { sidebar.style.removeProperty("bottom"); return; }
      var belowFold = document.documentElement.clientHeight - (vv.height + vv.offsetTop);
      if (belowFold < 0) belowFold = 0;
      if (sidebar.classList.contains("nav-collapsed")) {
        sidebar.style.bottom = (belowFold + 6) + "px";
      } else {
        sidebar.style.removeProperty("bottom");
      }
    }
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", syncBottom);
      window.visualViewport.addEventListener("scroll", syncBottom);
    }
    syncBottom();

    window.addEventListener("resize", function () {
      if (!isNarrow()) expand();
      else collapse();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
