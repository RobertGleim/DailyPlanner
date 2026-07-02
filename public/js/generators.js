// Builds Fabric.js objects for calendars, checklists, and daily schedules.
// Every build*() function accepts fontFamily + color params (threaded from
// the matching sidebar section in index.html's #tab-generators, wired in
// app.js) instead of hardcoding fonts/colors, and returns a plain array of
// objects — never a fabric.Group — so each piece stays individually
// selectable/editable after insert. See public/CLAUDE.md's "Generator
// output convention" section.
const Generators = {

  // ---------- Month / week / year calendar ----------
  // `month` is 1-12 (matches the sidebar's <select>, not JS's 0-indexed
  // Date months) and `year` a 4-digit number — both plain numbers, not a
  // parsed string, so there's no date-format ambiguity to get wrong.
  buildCalendar({
    view, month, year, style,
    fontFamily = 'Helvetica', headerColor = '#1f2430', textColor = '#1f2430',
    weekendColor = '#e0574c', highlightColor = '#FFC93C', accentColor = '#333333',
  }) {
    const objects = [];
    const width = 620;
    const today = new Date();
    const resolvedYear = year || today.getFullYear();
    const resolvedMonth = month || today.getMonth() + 1;
    const monthDate = new Date(resolvedYear, resolvedMonth - 1, 1);

    if (view === 'week') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const colWidth = width / 7;
      const height = 240;
      objects.push(new fabric.Rect({
        left: 0, top: 0, width, height, fill: 'transparent',
        stroke: accentColor, strokeWidth: style === 'boxed' ? 2 : 1,
      }));
      days.forEach((d, i) => {
        const isWeekend = i === 5 || i === 6; // Sat, Sun in this Mon-start week strip
        objects.push(new fabric.Line([i * colWidth, 0, i * colWidth, height], {
          stroke: accentColor, strokeWidth: 1, strokeDashArray: style === 'dotted' ? [2, 3] : null,
        }));
        objects.push(new fabric.Text(d, {
          left: i * colWidth + 8, top: 6, fontSize: 14, fontWeight: 'bold', fontFamily,
          fill: isWeekend ? weekendColor : headerColor,
          lockScalingX: true, lockScalingY: true,
        }));
      });
      return placeGeneratedObjects(objects);
    }

    if (view === 'year') {
      const gridCols = 3;
      const miniW = 180, miniGapX = 20, miniGapY = 26;
      const miniCellW = miniW / 7, miniCellH = 14;
      const miniHeight = 34 + 6 * miniCellH;

      for (let m = 0; m < 12; m++) {
        const col = m % gridCols;
        const row = Math.floor(m / gridCols);
        const ox = col * (miniW + miniGapX);
        const oy = row * (miniHeight + miniGapY);
        const miniMonthDate = new Date(resolvedYear, m, 1);
        const miniFirstDay = miniMonthDate.getDay();
        const miniDaysInMonth = new Date(resolvedYear, m + 1, 0).getDate();
        const isCurrentMonth = today.getFullYear() === resolvedYear && today.getMonth() === m;

        objects.push(new fabric.Text(miniMonthDate.toLocaleString('default', { month: 'long' }), {
          left: ox, top: oy, fontSize: 13, fontWeight: 'bold', fontFamily, fill: headerColor,
          lockScalingX: true, lockScalingY: true,
        }));

        ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((d, i) => {
          const isWeekend = i === 0 || i === 6;
          objects.push(new fabric.Text(d, {
            left: ox + i * miniCellW + 2, top: oy + 18, fontSize: 8, fontFamily,
            fill: isWeekend ? weekendColor : headerColor,
            lockScalingX: true, lockScalingY: true,
          }));
        });

        const gridTop = oy + 32;
        let dayNum = 1;
        for (let r = 0; r < 6 && dayNum <= miniDaysInMonth; r++) {
          for (let c = 0; c < 7; c++) {
            const cellIndex = r * 7 + c;
            if (cellIndex >= miniFirstDay && dayNum <= miniDaysInMonth) {
              const isWeekend = c === 0 || c === 6;
              const isToday = isCurrentMonth && dayNum === today.getDate();
              if (isToday) {
                objects.push(new fabric.Rect({
                  left: ox + c * miniCellW, top: gridTop + r * miniCellH,
                  width: miniCellW - 1, height: miniCellH - 1, rx: 2, ry: 2,
                  fill: highlightColor,
                }));
              }
              objects.push(new fabric.Text(String(dayNum), {
                left: ox + c * miniCellW + 2, top: gridTop + r * miniCellH, fontSize: 8, fontFamily,
                fill: isWeekend ? weekendColor : textColor,
                lockScalingX: true, lockScalingY: true,
              }));
              dayNum++;
            }
          }
        }
      }
      return placeGeneratedObjects(objects);
    }

    // month grid
    const title = monthDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay(); // 0=Sun
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const cols = 7, rows = 6;
    const cellW = width / cols;
    const cellH = 70;
    const height = rows * cellH + 34;
    const isCurrentMonth = today.getFullYear() === monthDate.getFullYear() && today.getMonth() === monthDate.getMonth();

    objects.push(new fabric.Text(title, {
      left: 0, top: 0, fontSize: 20, fontWeight: 'bold', fontFamily, fill: headerColor,
      lockScalingX: true, lockScalingY: true,
    }));

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayLabels.forEach((d, i) => {
      const isWeekend = i === 0 || i === 6;
      objects.push(new fabric.Text(d, {
        left: i * cellW + 4, top: 34, fontSize: 11, fontFamily,
        fill: isWeekend ? weekendColor : headerColor,
        lockScalingX: true, lockScalingY: true,
      }));
    });

    // grid lines
    for (let r = 0; r <= rows; r++) {
      objects.push(new fabric.Line([0, 54 + r * cellH, width, 54 + r * cellH], { stroke: accentColor, strokeWidth: 1, strokeDashArray: style === 'dotted' ? [2, 3] : null }));
    }
    for (let c = 0; c <= cols; c++) {
      objects.push(new fabric.Line([c * cellW, 54, c * cellW, 54 + rows * cellH], { stroke: accentColor, strokeWidth: 1, strokeDashArray: style === 'dotted' ? [2, 3] : null }));
    }
    if (style === 'boxed') {
      objects.push(new fabric.Rect({ left: 0, top: 54, width, height: rows * cellH, fill: 'transparent', stroke: accentColor, strokeWidth: 2 }));
    }

    let dayNum = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellIndex = r * cols + c;
        if (cellIndex >= firstDay && dayNum <= daysInMonth) {
          const isWeekend = c === 0 || c === 6;
          const isToday = isCurrentMonth && dayNum === today.getDate();
          if (isToday) {
            objects.push(new fabric.Rect({
              left: c * cellW + 4, top: 54 + r * cellH + 4, width: 22, height: 20, rx: 4, ry: 4,
              fill: highlightColor,
            }));
          }
          objects.push(new fabric.Text(String(dayNum), {
            left: c * cellW + 6, top: 54 + r * cellH + 4, fontSize: 13, fontFamily,
            fill: isWeekend ? weekendColor : textColor,
            lockScalingX: true, lockScalingY: true,
          }));
          dayNum++;
        }
      }
    }

    return placeGeneratedObjects(objects);
  },

  // ---------- Checklist / habit tracker ----------
  buildChecklist({
    rows, cols, title,
    fontFamily = 'Helvetica', headerColor = '#1f2430', textColor = '#1f2430',
    weekendColor = '#e0574c', accentColor = '#333333',
  }) {
    const objects = [];
    const rowH = 28;
    const width = cols > 1 ? 340 + cols * 26 : 320;
    const startY = 34;

    objects.push(new fabric.Text(title || 'Checklist', {
      left: 0, top: 0, fontSize: 18, fontWeight: 'bold', fontFamily, fill: headerColor,
      lockScalingX: true, lockScalingY: true,
    }));

    if (cols <= 1) {
      for (let i = 0; i < rows; i++) {
        const y = startY + i * rowH;
        objects.push(new fabric.Rect({ left: 0, top: y, width: 18, height: 18, fill: 'transparent', stroke: accentColor, strokeWidth: 1.5, rx: 3, ry: 3 }));
        objects.push(new fabric.Line([26, y + 16, width, y + 16], { stroke: accentColor, strokeWidth: 1 }));
      }
    } else {
      // habit tracker grid: rows = habits, cols = days
      const labelW = 130;
      const cellW = (width - labelW) / cols;

      // Weekday-initial column headers only make sense for a full 7-day week.
      if (cols === 7) {
        ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((d, c) => {
          const isWeekend = c === 0 || c === 6;
          objects.push(new fabric.Text(d, {
            left: labelW + c * cellW + (cellW - 4) / 2 - 4, top: startY - 16, fontSize: 11, fontWeight: 'bold', fontFamily,
            fill: isWeekend ? weekendColor : headerColor,
            lockScalingX: true, lockScalingY: true,
          }));
        });
      }

      for (let i = 0; i < rows; i++) {
        const y = startY + i * rowH;
        objects.push(new fabric.Line([0, y + rowH - 4, width, y + rowH - 4], { stroke: accentColor, strokeWidth: 1 }));
        objects.push(new fabric.Text(`Habit ${i + 1}`, {
          left: 0, top: y, fontSize: 12, fontFamily, fill: textColor,
          lockScalingX: true, lockScalingY: true,
        }));
        for (let c = 0; c < cols; c++) {
          objects.push(new fabric.Rect({
            left: labelW + c * cellW, top: y, width: cellW - 4, height: 18,
            fill: 'transparent', stroke: accentColor, strokeWidth: 1, rx: 3, ry: 3,
          }));
        }
      }
    }

    return placeGeneratedObjects(objects);
  },

  // ---------- Hourly daily schedule ----------
  // Returns [] if the hour range is empty/inverted — callers (app.js) must
  // check for that instead of assuming a non-empty result.
  buildSchedule({
    startHour, endHour, title,
    fontFamily = 'Helvetica', headerColor = '#1f2430', textColor = '#1f2430',
    highlightColor = '#FFC93C', accentColor = '#333333',
  }) {
    if (endHour <= startHour) return [];

    const objects = [];
    const rowH = 32;
    const width = 480;
    const labelW = 70;
    const currentHour = new Date().getHours();
    let gridTop = 0;

    if (title) {
      objects.push(new fabric.Text(title, {
        left: 0, top: 0, fontSize: 16, fontWeight: 'bold', fontFamily, fill: headerColor,
        lockScalingX: true, lockScalingY: true,
      }));
      gridTop = 26;
    }

    let row = 0;
    for (let h = startHour; h < endHour; h++) {
      const y = gridTop + row * rowH;
      const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
      if (h === currentHour) {
        objects.push(new fabric.Rect({ left: 0, top: y, width, height: rowH, fill: highlightColor, opacity: 0.35 }));
      }
      objects.push(new fabric.Text(label, {
        left: 0, top: y + 6, fontSize: 11, fontFamily, fill: textColor,
        lockScalingX: true, lockScalingY: true,
      }));
      objects.push(new fabric.Line([labelW, y + rowH, width, y + rowH], { stroke: accentColor, strokeWidth: 1 }));
      row++;
    }
    objects.push(new fabric.Rect({ left: labelW, top: gridTop, width: width - labelW, height: row * rowH, fill: 'transparent', stroke: accentColor, strokeWidth: 1.5 }));

    return placeGeneratedObjects(objects);
  },
};

// Positions a generator's output at a fixed insert point and hands back
// plain objects (no fabric.Group wrapper) so every piece stays
// independently selectable/editable via the properties panel — see
// CanvasEditor.addGeneratedObjects, which selects them all together right
// after insert without permanently grouping them.
function placeGeneratedObjects(objects, dx = 60, dy = 60) {
  objects.forEach((o) => o.set({ left: (o.left || 0) + dx, top: (o.top || 0) + dy }));
  return objects;
}
