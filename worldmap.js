/* ============================================================
   worldmap.js — a reusable, interactive SVG world map.

   Loads the bundled country paths (world-map-data.json), renders them as an
   SVG, and supports drag-to-pan and wheel/pinch-to-zoom by manipulating the
   SVG viewBox. Countries are individually selectable/shadeable, which is what
   the study mode needs ("shade this country — name it", and the reverse).

   Usage:
     const map = WorldMap.create(containerEl, { onPick: fn });
     await map.load();                 // fetches + draws (once)
     map.highlight("France");          // shade a country
     map.zoomToCountry("France");      // frame it
     map.clearHighlight(); map.reset();

   No external libraries; pure SVG + DOM. The data file ships with the app.
   ============================================================ */
(function (global) {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";
  let cachedData = null;   // parsed world-map-data.json, loaded once and shared

  function loadData() {
    if (cachedData) return Promise.resolve(cachedData);
    return fetch("world-map-data.json")
      .then(function (r) {
        if (!r.ok) throw new Error("map data " + r.status);
        return r.json();
      })
      .then(function (d) { cachedData = d; return d; });
  }

  function create(container, opts) {
    opts = opts || {};
    const state = {
      container: container,
      svg: null,
      vb: { x: 0, y: 0, w: 2000, h: 1000 },  // current viewBox
      full: { w: 2000, h: 1000 },            // data's native size
      pathsByName: {},                        // name -> <path>
      selectedName: null,
      onPick: opts.onPick || null,
      interactive: opts.interactive !== false, // pan/zoom on by default
      // drag state
      dragging: false, dragMoved: false, lastX: 0, lastY: 0,
      captured: false, pointerId: null,
      // pinch state
      pinchDist: 0
    };

    function build(data) {
      state.full = { w: data.width, h: data.height };
      state.vb = { x: 0, y: 0, w: data.width, h: data.height };

      const svg = document.createElementNS(SVGNS, "svg");
      svg.setAttribute("class", "worldmap-svg");
      svg.setAttribute("viewBox", vbStr());
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

      // Ocean background rect (so clicks on empty sea deselect).
      const bg = document.createElementNS(SVGNS, "rect");
      bg.setAttribute("x", 0); bg.setAttribute("y", 0);
      bg.setAttribute("width", data.width); bg.setAttribute("height", data.height);
      bg.setAttribute("class", "worldmap-ocean");
      bg.addEventListener("click", function () {
        if (!state.dragMoved && state.onPick) state.onPick(null);
      });
      svg.appendChild(bg);

      // Country paths.
      data.countries.forEach(function (c) {
        const p = document.createElementNS(SVGNS, "path");
        p.setAttribute("d", c.d);
        p.setAttribute("class", "worldmap-country");
        p.setAttribute("data-name", c.name);
        p.addEventListener("click", function (e) {
          e.stopPropagation();
          if (state.dragMoved) return;   // ignore click that ended a drag
          if (state.onPick) state.onPick(c.name);
        });
        svg.appendChild(p);
        state.pathsByName[c.name] = p;
      });

      container.innerHTML = "";
      container.appendChild(svg);
      state.svg = svg;

      if (state.interactive) attachInteractions();
    }

    function vbStr() {
      return state.vb.x + " " + state.vb.y + " " + state.vb.w + " " + state.vb.h;
    }
    function applyVB() { state.svg.setAttribute("viewBox", vbStr()); }

    /* Convert a client (pixel) point to SVG-space coordinates given the viewBox. */
    function clientToSvg(clientX, clientY) {
      const rect = state.svg.getBoundingClientRect();
      // account for preserveAspectRatio meet letterboxing
      const scale = Math.min(rect.width / state.vb.w, rect.height / state.vb.h);
      const drawnW = state.vb.w * scale, drawnH = state.vb.h * scale;
      const offX = (rect.width - drawnW) / 2, offY = (rect.height - drawnH) / 2;
      const sx = (clientX - rect.left - offX) / scale + state.vb.x;
      const sy = (clientY - rect.top - offY) / scale + state.vb.y;
      return { x: sx, y: sy };
    }

    /* Zoom by factor around an SVG-space focal point (keeps that point fixed). */
    function zoomAt(focal, factor) {
      const minW = 40;                        // deepest zoom (map units)
      const maxW = state.full.w;              // fully zoomed out
      let newW = state.vb.w / factor;
      let newH = state.vb.h / factor;
      // clamp
      if (newW > maxW) { const k = maxW / newW; newW *= k; newH *= k; }
      if (newW < minW) { const k = minW / newW; newW *= k; newH *= k; }
      // keep focal point stationary: its fractional position stays constant
      const fx = (focal.x - state.vb.x) / state.vb.w;
      const fy = (focal.y - state.vb.y) / state.vb.h;
      state.vb.w = newW; state.vb.h = newH;
      state.vb.x = focal.x - fx * newW;
      state.vb.y = focal.y - fy * newH;
      clampPan();
      applyVB();
    }

    /* Keep the view within the map bounds (no panning into empty space). */
    function clampPan() {
      const maxX = state.full.w - state.vb.w;
      const maxY = state.full.h - state.vb.h;
      if (state.vb.w >= state.full.w) state.vb.x = (state.full.w - state.vb.w) / 2;
      else state.vb.x = Math.max(0, Math.min(maxX, state.vb.x));
      if (state.vb.h >= state.full.h) state.vb.y = (state.full.h - state.vb.h) / 2;
      else state.vb.y = Math.max(0, Math.min(maxY, state.vb.y));
    }

    function attachInteractions() {
      const svg = state.svg;

      // Wheel zoom (focal at cursor).
      svg.addEventListener("wheel", function (e) {
        e.preventDefault();
        const focal = clientToSvg(e.clientX, e.clientY);
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        zoomAt(focal, factor);
      }, { passive: false });

      // Pointer drag to pan. IMPORTANT: we do NOT capture the pointer on
      // pointerdown — capturing would redirect the subsequent "click" to the
      // <svg> and the country <path> would never receive it. We only capture
      // once the pointer has actually moved (a real drag), and release on up.
      svg.addEventListener("pointerdown", function (e) {
        if (e.pointerType === "touch") return; // touch handled below for pinch
        state.dragging = true; state.dragMoved = false; state.captured = false;
        state.pointerId = e.pointerId;
        state.lastX = e.clientX; state.lastY = e.clientY;
      });
      svg.addEventListener("pointermove", function (e) {
        if (!state.dragging) return;
        const dx = e.clientX - state.lastX, dy = e.clientY - state.lastY;
        if (Math.abs(dx) + Math.abs(dy) > 3) {
          state.dragMoved = true;
          if (!state.captured) {   // begin capturing only now that it's a real drag
            try { svg.setPointerCapture(state.pointerId); state.captured = true; } catch (_) {}
          }
        }
        if (!state.dragMoved) return;   // below threshold -> treat as a potential click, don't pan yet
        const rect = svg.getBoundingClientRect();
        const scale = Math.min(rect.width / state.vb.w, rect.height / state.vb.h);
        state.vb.x -= dx / scale; state.vb.y -= dy / scale;
        clampPan(); applyVB();
        state.lastX = e.clientX; state.lastY = e.clientY;
      });
      function endDrag(e) {
        if (state.captured) { try { svg.releasePointerCapture(state.pointerId); } catch (_) {} }
        state.captured = false;
        state.dragging = false;
        // let the click handler see dragMoved, then reset shortly after
        setTimeout(function () { state.dragMoved = false; }, 0);
      }
      svg.addEventListener("pointerup", endDrag);
      svg.addEventListener("pointercancel", endDrag);

      // Touch: one finger pans, two fingers pinch-zoom.
      svg.addEventListener("touchstart", function (e) {
        if (e.touches.length === 1) {
          state.dragging = true; state.dragMoved = false;
          state.lastX = e.touches[0].clientX; state.lastY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
          state.dragging = false;
          state.pinchDist = touchDist(e.touches);
        }
      }, { passive: true });
      svg.addEventListener("touchmove", function (e) {
        if (e.touches.length === 1 && state.dragging) {
          const t = e.touches[0];
          const dx = t.clientX - state.lastX, dy = t.clientY - state.lastY;
          if (Math.abs(dx) + Math.abs(dy) > 3) state.dragMoved = true;
          const rect = svg.getBoundingClientRect();
          const scale = Math.min(rect.width / state.vb.w, rect.height / state.vb.h);
          state.vb.x -= dx / scale; state.vb.y -= dy / scale;
          clampPan(); applyVB();
          state.lastX = t.clientX; state.lastY = t.clientY;
        } else if (e.touches.length === 2) {
          e.preventDefault();
          const d = touchDist(e.touches);
          if (state.pinchDist) {
            const mid = touchMid(e.touches);
            const focal = clientToSvg(mid.x, mid.y);
            zoomAt(focal, d / state.pinchDist);
          }
          state.pinchDist = d;
        }
      }, { passive: false });
      svg.addEventListener("touchend", function () {
        state.dragging = false; state.pinchDist = 0;
        setTimeout(function () { state.dragMoved = false; }, 0);
      });
    }

    function touchDist(t) {
      const dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
      return Math.hypot(dx, dy);
    }
    function touchMid(t) {
      return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 };
    }

    /* ---- public-ish API ---- */
    function highlight(name) {
      clearHighlight();
      const p = state.pathsByName[name];
      if (p) { p.classList.add("worldmap-selected"); state.selectedName = name; }
    }
    function clearHighlight() {
      if (state.selectedName && state.pathsByName[state.selectedName]) {
        state.pathsByName[state.selectedName].classList.remove("worldmap-selected");
      }
      state.selectedName = null;
    }
    function pathBBoxSvg(name) {
      const p = state.pathsByName[name];
      if (!p || !p.getBBox) return null;
      try { return p.getBBox(); } catch (_) { return null; }
    }
    function zoomToCountry(name, pad) {
      const bb = pathBBoxSvg(name);
      if (!bb) return;
      pad = pad == null ? 0.6 : pad;
      let w = bb.width * (1 + pad), h = bb.height * (1 + pad);
      // keep aspect ratio close to the container's
      const rect = state.svg.getBoundingClientRect();
      const aspect = rect.width / rect.height || 2;
      if (w / h < aspect) w = h * aspect; else h = w / aspect;
      // clamp to sensible zoom
      w = Math.max(60, Math.min(state.full.w, w));
      h = Math.max(30, Math.min(state.full.h, h));
      state.vb.w = w; state.vb.h = h;
      state.vb.x = bb.x + bb.width / 2 - w / 2;
      state.vb.y = bb.y + bb.height / 2 - h / 2;
      clampPan(); applyVB();
    }
    function reset() {
      state.vb = { x: 0, y: 0, w: state.full.w, h: state.full.h };
      applyVB();
    }
    function hasCountry(name) { return !!state.pathsByName[name]; }
    function allCountryNames() { return Object.keys(state.pathsByName); }

    function load() {
      return loadData().then(function (data) { build(data); return api; });
    }

    const api = {
      load: load,
      highlight: highlight,
      clearHighlight: clearHighlight,
      zoomToCountry: zoomToCountry,
      reset: reset,
      hasCountry: hasCountry,
      allCountryNames: allCountryNames,
      getData: function () { return cachedData; }
    };
    return api;
  }

  global.WorldMap = { create: create, loadData: loadData };
})(typeof window !== "undefined" ? window : globalThis);
