/* ============================================================
   ical-import.js — parse Google Calendar .ics exports into Daybook
   events (and a category per calendar).

   Google's export (from Settings > Import/Export, or Takeout) is a .zip of one
   .ics file per calendar. The user unzips it and feeds us the .ics text; we:
     - unfold folded lines (RFC 5545: a CRLF followed by a space/tab continues
       the previous line),
     - read each VEVENT's SUMMARY/DESCRIPTION/LOCATION/DTSTART/DTEND,
     - turn the calendar name (X-WR-CALNAME) into a category,
     - expand simple WEEKLY recurrences onto Daybook's own "weekdays" repeat,
     - convert UTC / TZID / all-day times into the app's local date + HH:MM.

   Output: { events:[...appShape], categoryName, warnings:[...] }.
   This module is pure (no DOM), so it can be unit-tested in node.
   ============================================================ */
(function (global) {
  "use strict";

  /* Unfold folded lines, then split into logical lines. */
  function unfold(text) {
    // Normalize newlines, then join any line that starts with space/tab onto
    // the previous one (that's iCal line folding).
    const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const out = [];
    raw.forEach(function (line) {
      if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) {
        out[out.length - 1] += line.slice(1);
      } else {
        out.push(line);
      }
    });
    return out;
  }

  /* Unescape iCal TEXT values: \n \, \; \\ */
  function unescapeText(v) {
    return String(v || "")
      .replace(/\\n/gi, "\n")
      .replace(/\\,/g, ",")
      .replace(/\\;/g, ";")
      .replace(/\\\\/g, "\\");
  }

  /* Split a content line "NAME;PARAM=x:value" into {name, params, value}. */
  function parseLine(line) {
    const colon = line.indexOf(":");
    if (colon === -1) return null;
    const left = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const semis = left.split(";");
    const name = semis[0].toUpperCase();
    const params = {};
    for (let i = 1; i < semis.length; i++) {
      const eq = semis[i].indexOf("=");
      if (eq > -1) params[semis[i].slice(0, eq).toUpperCase()] = semis[i].slice(eq + 1);
    }
    return { name: name, params: params, value: value };
  }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  /* Parse a DTSTART/DTEND value into a JS Date (local).
     Handles:
       20260506T160000Z         -> UTC instant
       20260113T090000          -> "floating"/TZID local wall time
       20260506  (VALUE=DATE)   -> all-day (midnight local)
     For TZID we treat the wall-clock time as local. That's not a full timezone
     library, but for a personal import from the user's own calendar (whose TZID
     is their home zone) it lands on the right local time in the common case. */
  function parseDT(value, params) {
    const isDateOnly = (params && params.VALUE === "DATE") || /^\d{8}$/.test(value);
    const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    const hh = m[4] ? +m[4] : 0, mi = m[5] ? +m[5] : 0, ss = m[6] ? +m[6] : 0;
    if (isDateOnly) return { date: new Date(y, mo - 1, d, 0, 0, 0), allDay: true };
    if (m[7] === "Z") return { date: new Date(Date.UTC(y, mo - 1, d, hh, mi, ss)), allDay: false };
    // No Z -> treat as local wall time.
    return { date: new Date(y, mo - 1, d, hh, mi, ss), allDay: false };
  }

  function dateKey(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function hhmm(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); }

  // iCal BYDAY codes -> JS getDay() (0=Sun).
  const DOW = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  /* Parse one RRULE value into a small object we understand. */
  function parseRRULE(v) {
    const out = {};
    v.split(";").forEach(function (part) {
      const eq = part.indexOf("=");
      if (eq > -1) out[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
    });
    return out;
  }

  /* Main entry: parse one .ics file's text.
     opts.horizonDays limits how far recurring events are materialized. */
  function parseICS(text, opts) {
    opts = opts || {};
    const horizon = opts.horizonDays || 365;
    const lines = unfold(text);

    let calName = "";
    const events = [];
    const warnings = [];

    let cur = null;       // current VEVENT accumulator
    let inEvent = false;
    let inOther = false;  // inside VTIMEZONE/VALARM etc. — skip

    lines.forEach(function (line) {
      const p = parseLine(line);
      if (!p) return;

      if (p.name === "BEGIN") {
        if (p.value === "VEVENT") { inEvent = true; cur = { extra: {} }; }
        else if (p.value !== "VCALENDAR") inOther = true;
        return;
      }
      if (p.name === "END") {
        if (p.value === "VEVENT") {
          inEvent = false;
          if (cur) finishEvent(cur);
          cur = null;
        } else if (p.value !== "VCALENDAR") inOther = false;
        return;
      }

      if (!inEvent) {
        if (p.name === "X-WR-CALNAME") calName = unescapeText(p.value).trim();
        return;
      }
      if (inOther) return; // skip nested components inside an event (alarms)

      switch (p.name) {
        case "SUMMARY":     cur.summary = unescapeText(p.value); break;
        case "DESCRIPTION": cur.description = unescapeText(p.value); break;
        case "LOCATION":    cur.location = unescapeText(p.value); break;
        case "DTSTART":     cur.dtstart = parseDT(p.value, p.params); break;
        case "DTEND":       cur.dtend = parseDT(p.value, p.params); break;
        case "RRULE":       cur.rrule = parseRRULE(p.value); break;
        case "STATUS":      cur.status = p.value; break;
        case "UID":         cur.uid = p.value; break;
        default: break;
      }
    });

    /* Turn one accumulated VEVENT into 1+ Daybook events. */
    function finishEvent(ev) {
      if (!ev.dtstart) { return; } // no start -> skip silently
      if (ev.status === "CANCELLED") return;

      const start = ev.dtstart.date;
      // Default 1-hour if no end; all-day gets a 0:00-23:59 span.
      let end;
      if (ev.dtend && ev.dtend.date) end = ev.dtend.date;
      else end = new Date(start.getTime() + 60 * 60000);

      const allDay = ev.dtstart.allDay;

      const base = {
        title: ev.summary || "(untitled)",
        notes: buildNotes(ev),
        start: allDay ? "00:00" : hhmm(start),
        end: allDay ? "23:59" : hhmm(end)
      };

      if (ev.rrule && ev.rrule.FREQ === "WEEKLY") {
        // Map to Daybook's weekly repeat: which weekdays, bounded by UNTIL/horizon.
        const byday = (ev.rrule.BYDAY || "").split(",").map(function (c) { return DOW[c.trim().toUpperCase()]; }).filter(function (x) { return x != null; });
        const days = byday.length ? byday : [start.getDay()];
        const until = ev.rrule.UNTIL ? parseDT(ev.rrule.UNTIL, {}) : null;
        const stopDate = until && until.date ? until.date : new Date(start.getTime() + horizon * 86400000);
        emitWeekly(base, start, days, stopDate);
      } else if (ev.rrule && ev.rrule.FREQ) {
        // Non-weekly recurrence (daily/monthly/yearly) — just the first
        // occurrence, noted, so we don't silently multiply or drop it.
        warnings.push('"' + base.title + '" repeats (' + ev.rrule.FREQ.toLowerCase() + '); imported the first occurrence only.');
        events.push(Object.assign({ date: dateKey(start) }, base));
      } else {
        events.push(Object.assign({ date: dateKey(start) }, base));
      }
    }

    function emitWeekly(base, start, days, stopDate) {
      // Walk from the start date to stopDate, adding an event on each matching
      // weekday. Cap the count so a runaway UNTIL can't create tens of thousands.
      const MAX = 500;
      let d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      let n = 0;
      while (d <= stopDate && n < MAX) {
        if (days.indexOf(d.getDay()) > -1) {
          events.push(Object.assign({ date: dateKey(d) }, base));
          n++;
        }
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      }
      if (n >= MAX) warnings.push('"' + base.title + '" has a very long repeat; capped at ' + MAX + ' occurrences.');
    }

    function buildNotes(ev) {
      const bits = [];
      if (ev.description) bits.push(ev.description.trim());
      if (ev.location) bits.push("Location: " + ev.location.trim());
      return bits.join("\n\n");
    }

    return { events: events, categoryName: calName, warnings: warnings };
  }

  global.DaybookICS = { parseICS: parseICS, _unfold: unfold, _parseDT: parseDT };
})(typeof window !== "undefined" ? window : globalThis);
