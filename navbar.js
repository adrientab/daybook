/* ============================================================
   navbar.js — auto-hiding bottom tab bar on narrow screens.

   Only active in the narrow (top-bar / bottom-bar) layout — wide mode with
   the left sidebar is untouched. Behaviour, Safari-style:
     - scroll down  -> collapse the bar to a thin blue strip
     - scroll up    -> reveal the full bar
     - tap the strip / hover it (mouse) -> reveal the full bar
   ============================================================ */

(function () {
  function isNarrow() { return window.matchMedia("(max-width: 720px)").matches; }

  var sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  var lastY = window.scrollY || 0;
  var THRESHOLD = 8;   // ignore tiny jitters

  function collapse() {
    if (isNarrow()) sidebar.classList.add("nav-collapsed");
  }
  function expand() {
    sidebar.classList.remove("nav-collapsed");
  }

  function onScroll() {
    if (!isNarrow()) { expand(); return; }   // wide mode: always full
    var y = window.scrollY || 0;
    var dy = y - lastY;

    if (Math.abs(dy) < THRESHOLD) return;

    if (dy > 0 && y > 40) {
      // scrolling down (and not right at the very top) -> hide
      collapse();
    } else if (dy < 0) {
      // scrolling up -> reveal
      expand();
    }
    lastY = y;
  }

  window.addEventListener("scroll", onScroll, { passive: true });

  // Tapping the collapsed strip reveals the bar. (Only meaningful while
  // collapsed; the tabs themselves are non-interactive in that state.)
  sidebar.addEventListener("click", function () {
    if (sidebar.classList.contains("nav-collapsed")) expand();
  });
  // Mouse hovering the strip (desktop narrow windows) reveals it too.
  sidebar.addEventListener("mouseenter", function () {
    if (isNarrow()) expand();
  });

  // If the window is resized back to wide, make sure the bar is fully shown.
  window.addEventListener("resize", function () {
    if (!isNarrow()) expand();
  });
})();
