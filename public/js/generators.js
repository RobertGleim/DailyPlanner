// Builds Fabric.js objects for calendars, checklists, and daily schedules.
const Generators = {

  // ---------- Month / week calendar ----------
  buildCalendar({ view, monthValue, style }) {
    const objects = [];
    const width = 620;
    let monthDate;
    if (monthValue) {
      const [y, m] = monthValue.split('-').map(Number);
      monthDate = new Date(y, m - 1, 1);
    } else {
      monthDate = new Date();
    }

    if (view === 'week') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const colWidth = width / 7;
      const height = 240;
      objects.push(new fabric.Rect({
        left: 0, top: 0, width, height, fill: 'transparent',
        stroke: '#333', strokeWidth: style === 'boxed' ? 2 : 1,
      }));
      days.forEach((d, i) => {
        objects.push(new fabric.Line([i * colWidth, 0, i * colWidth, height], { stroke: '#999', strokeWidth: 1, strokeDashArray: style === 'dotted' ? [2, 3] : null }));
        objects.push(new fabric.Text(d, { left: i * colWidth + 8, top: 6, fontSize: 14, fontWeight: 'bold', fontFamily: 'Helvetica', lockScalingX: true, lockScalingY: true }));
      });
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

    objects.push(new fabric.Text(title, { left: 0, top: 0, fontSize: 20, fontWeight: 'bold', fontFamily: 'Helvetica', lockScalingX: true, lockScalingY: true }));

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayLabels.forEach((d, i) => {
      objects.push(new fabric.Text(d, { left: i * cellW + 4, top: 34, fontSize: 11, fill: '#666', fontFamily: 'Helvetica', lockScalingX: true, lockScalingY: true }));
    });

    // grid lines
    for (let r = 0; r <= rows; r++) {
      objects.push(new fabric.Line([0, 54 + r * cellH, width, 54 + r * cellH], { stroke: '#ccc', strokeWidth: 1, strokeDashArray: style === 'dotted' ? [2, 3] : null }));
    }
    for (let c = 0; c <= cols; c++) {
      objects.push(new fabric.Line([c * cellW, 54, c * cellW, 54 + rows * cellH], { stroke: '#ccc', strokeWidth: 1, strokeDashArray: style === 'dotted' ? [2, 3] : null }));
    }
    if (style === 'boxed') {
      objects.push(new fabric.Rect({ left: 0, top: 54, width, height: rows * cellH, fill: 'transparent', stroke: '#333', strokeWidth: 2 }));
    }

    let dayNum = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellIndex = r * cols + c;
        if (cellIndex >= firstDay && dayNum <= daysInMonth) {
          objects.push(new fabric.Text(String(dayNum), {
            left: c * cellW + 6, top: 54 + r * cellH + 4, fontSize: 13, fontFamily: 'Helvetica',
            lockScalingX: true, lockScalingY: true,
          }));
          dayNum++;
        }
      }
    }

    return placeGeneratedObjects(objects);
  },

  // ---------- Checklist / habit tracker ----------
  buildChecklist({ rows, cols, title }) {
    const objects = [];
    const rowH = 28;
    const width = cols > 1 ? 340 + cols * 26 : 320;
    const startY = 34;

    objects.push(new fabric.Text(title || 'Checklist', { left: 0, top: 0, fontSize: 18, fontWeight: 'bold', fontFamily: 'Helvetica', lockScalingX: true, lockScalingY: true }));

    if (cols <= 1) {
      for (let i = 0; i < rows; i++) {
        const y = startY + i * rowH;
        objects.push(new fabric.Rect({ left: 0, top: y, width: 18, height: 18, fill: 'transparent', stroke: '#333', strokeWidth: 1.5, rx: 3, ry: 3 }));
        objects.push(new fabric.Line([26, y + 16, width, y + 16], { stroke: '#ccc', strokeWidth: 1 }));
      }
    } else {
      // habit tracker grid: rows = habits, cols = days
      const labelW = 130;
      const cellW = (width - labelW) / cols;
      for (let i = 0; i < rows; i++) {
        const y = startY + i * rowH;
        objects.push(new fabric.Line([0, y + rowH - 4, width, y + rowH - 4], { stroke: '#eee', strokeWidth: 1 }));
        objects.push(new fabric.Text(`Habit ${i + 1}`, { left: 0, top: y, fontSize: 12, fontFamily: 'Helvetica', lockScalingX: true, lockScalingY: true }));
        for (let c = 0; c < cols; c++) {
          objects.push(new fabric.Rect({
            left: labelW + c * cellW, top: y, width: cellW - 4, height: 18,
            fill: 'transparent', stroke: '#999', strokeWidth: 1, rx: 3, ry: 3,
          }));
        }
      }
    }

    return placeGeneratedObjects(objects);
  },

  // ---------- Hourly daily schedule ----------
  buildSchedule({ startHour, endHour }) {
    const objects = [];
    const rowH = 32;
    const width = 480;
    const labelW = 70;
    let row = 0;
    for (let h = startHour; h < endHour; h++) {
      const y = row * rowH;
      const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
      objects.push(new fabric.Text(label, { left: 0, top: y + 6, fontSize: 11, fill: '#666', fontFamily: 'Helvetica', lockScalingX: true, lockScalingY: true }));
      objects.push(new fabric.Line([labelW, y + rowH, width, y + rowH], { stroke: '#ddd', strokeWidth: 1 }));
      row++;
    }
    objects.push(new fabric.Rect({ left: labelW, top: 0, width: width - labelW, height: row * rowH, fill: 'transparent', stroke: '#333', strokeWidth: 1.5 }));
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
