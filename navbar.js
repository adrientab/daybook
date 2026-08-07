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
    var downAccum = 0;              // accumulated downward scroll since last reversal
    var COLLAPSE_DISTANCE = 120;    // must scroll down this many px before collapsing
    var atBottomGuard = false;  // set briefly when we're at the very bottom

    var touchActive = false;
    window.addEventListener("touchstart", function () { touchActive = true; }, { passive: true });
    window.addEventListener("mousemove", function () { touchActive = false; }, { passive: true });
    window.addEventListener("wheel", function () { touchActive = false; }, { passive: true });

    function collapse() { if (isNarrow()) { sidebar.classList.add("nav-collapsed"); syncBottom(); } }
    function expand() { sidebar.classList.remove("nav-collapsed"); syncBottom(); }
    function collapsed() { return sidebar.classList.contains("nav-collapsed"); }

    if (isNarrow()) { sidebar.classList.remove("collapsed"); sidebar.classList.add("nav-collapsed"); }

    // When the window crosses the narrow/wide breakpoint (e.g. you shrink the
    // window into mobile layout, or rotate a device), react: entering narrow
    // starts collapsed (matching a fresh load); entering wide clears the class
    // so the left sidebar is never stuck in a collapsed state. Without this the
    // bar only collapsed at initial load, so resizing INTO narrow left the full
    // menu showing.
    var narrowMq = window.matchMedia("(max-width: 720px)");
    var onLayoutChange = function (e) {
      if (e.matches) {
        // Entering narrow: the wide-mode icon-rail collapse (.collapsed) is
        // meaningless here and its width:64px fights the bottom-bar layout, so
        // drop it. Then start collapsed as the pill.
        sidebar.classList.remove("collapsed");
        sidebar.classList.add("nav-collapsed");
        syncBottom();
      } else {
        // Entering wide: the bottom-bar pill state is meaningless; clear it so
        // the left sidebar renders normally, and restore the user's saved
        // wide-mode collapse (icon-rail) preference.
        sidebar.classList.remove("nav-collapsed");
        var saved = false;
        try { saved = (typeof Store !== "undefined" && Store.get("sidebarCollapsed") === "1"); } catch (_) {}
        sidebar.classList.toggle("collapsed", saved);
      }
    };
    if (narrowMq.addEventListener) narrowMq.addEventListener("change", onLayoutChange);
    else if (narrowMq.addListener) narrowMq.addListener(onLayoutChange); // older Safari

    // Ignore scroll events fired right after load (some browsers emit a scroll
    // as the page settles); without this a phantom upward delta could expand the
    // bar immediately, defeating the "starts collapsed" behaviour.
    var startupGuard = true;
    setTimeout(function () { startupGuard = false; }, 350);

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
      if (startupGuard) { lastY = y; downAccum = 0; return; }   // stay collapsed at load
      if (lastY == null) { lastY = y; downAccum = 0; return; }
      var dy = y - lastY;
      lastY = y;
      if (Math.abs(dy) < 2) return;   // ignore sub-pixel jitter

      if (dy > 0) {
        // Accumulate downward distance; only collapse once the user has scrolled
        // down a meaningful amount, so a small nudge doesn't tuck the bar away.
        downAccum += dy;
        if (downAccum >= COLLAPSE_DISTANCE && y > 30) collapse();
      } else {
        // Any upward motion resets the accumulator and (on touch) reveals.
        downAccum = 0;
        if (touchActive && !(y >= maxScroll() - 4)) expand();
      }
    }

    window.addEventListener("scroll", function () { handle(scrollTop()); }, { passive: true });
    document.addEventListener("scroll", function (e) { handle(scrollTop(e.target)); }, { passive: true, capture: true });

    // Tap-to-expand. Use pointerdown in CAPTURE phase so, when collapsed, we
    // expand and fully swallow the event before it can reach a tab underneath
    // Tap-to-expand. When collapsed, expand and fully swallow the tap so it
    // can't fall through to a tab underneath. We handle it on pointerdown in the
    // capture phase, and also guard the following click. If iOS consumes the
    // first tap to restore its toolbar, the bar simply stays collapsed and the
    // next tap expands it — state and visuals stay in sync because resize no
    // longer re-collapses.
    function swallow(e) { e.preventDefault(); e.stopPropagation(); }

    sidebar.addEventListener("pointerdown", function (e) {
      if (collapsed()) {
        swallow(e);
        sidebar.dataset.justExpanded = "1";
        expand();
      }
    }, true);
    sidebar.addEventListener("click", function (e) {
      if (sidebar.dataset.justExpanded === "1") {
        swallow(e);
        sidebar.dataset.justExpanded = "";
      }
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

    // Resize fires constantly on iOS as Safari's toolbar slides in/out. Do NOT
    // collapse here — that was fighting the user's tap (tap expands, toolbar
    // reveal fires resize, resize re-collapsed it -> state/visual desync). Just
    // re-sync the pill's position, and restore the full bar in wide mode.
    window.addEventListener("resize", function () {
      if (!isNarrow()) expand();
      syncBottom();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();