// Renders the Properties panel for a fully-selected generator group
// (calendar/checklist/schedule — see generators.js) and regenerates that
// group in place, via the same Generators.build*() function it was
// originally built with, whenever a field changes — see public/CLAUDE.md's
// "Layers panel" section for why (this is what makes an edit here apply to
// every shape in the group "as one," instead of needing to select and edit
// each of the group's individual objects one at a time).
//
// Fields bind on 'input' (fires continuously while dragging/typing) for a
// live preview. A bulk regenerate destroys and recreates every object in
// the group and briefly discards the active selection along the way —
// regenerate() wraps that whole sequence in CanvasEditor.suppressHistory so
// none of it fires a Properties-panel re-render out from under the user
// mid-interaction (see the suppressHistory doc comment in
// canvas-editor.js). render() below also skips rebuilding its own DOM when
// re-entered for the same group it's already showing (see its own
// comment), so the live field the user is interacting with keeps focus.
const GroupEditor = {
  MONTH_OPTIONS: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    .map((name, i) => [String(i + 1), name]),

  FIELD_SETS: {
    Calendar: {
      fields(p) {
        const isYear = p.view === 'year';
        const sizeFields = isYear
          ? '<p class="hint">Resize isn\'t available for the yearly overview.</p>'
          : propRow('Width (px)', `<input type="number" id="geWidth" min="100" value="${p.width || 620}" />`, 'geWidth')
            + propRow('Height (px)', `<input type="number" id="geRowHeight" min="10" value="${p.rowHeight || (p.view === 'week' ? 240 : 70)}" />`, 'geRowHeight');
        return [
          propRow('View', selectHtml('geView', [['month', 'Month grid'], ['week', 'Week strip'], ['year', 'Yearly overview']], p.view), 'geView'),
          propRow('Month', selectHtml('geMonth', GroupEditor.MONTH_OPTIONS, String(p.month)), 'geMonth'),
          propRow('Year', `<input type="number" id="geYear" min="1900" max="2200" value="${p.year}" />`, 'geYear'),
          propRow('Style', selectHtml('geStyle', [['minimal', 'Minimal'], ['boxed', 'Boxed grid'], ['dotted', 'Dotted']], p.style), 'geStyle'),
          sizeFields,
          fontFieldRow(p.fontFamily),
          colorRow('geHeaderColor', 'Header color', p.headerColor),
          colorRow('geTextColor', 'Text color', p.textColor),
          colorRow('geWeekendColor', 'Weekend color', p.weekendColor),
          colorRow('geHighlightColor', 'Today highlight', p.highlightColor),
          colorRow('geAccentColor', 'Line/border color', p.accentColor),
        ].join('');
      },
      bind(panelEl, params, onChange) {
        bindField(panelEl, 'geView', params, 'view', onChange);
        bindField(panelEl, 'geMonth', params, 'month', onChange, Number);
        bindField(panelEl, 'geYear', params, 'year', onChange, Number);
        bindField(panelEl, 'geStyle', params, 'style', onChange);
        bindField(panelEl, 'geWidth', params, 'width', onChange, Number);
        bindField(panelEl, 'geRowHeight', params, 'rowHeight', onChange, Number);
        bindFontField(panelEl, params, onChange);
        bindField(panelEl, 'geHeaderColor', params, 'headerColor', onChange);
        bindField(panelEl, 'geTextColor', params, 'textColor', onChange);
        bindField(panelEl, 'geWeekendColor', params, 'weekendColor', onChange);
        bindField(panelEl, 'geHighlightColor', params, 'highlightColor', onChange);
        bindField(panelEl, 'geAccentColor', params, 'accentColor', onChange);
      },
      build: (params) => Generators.buildCalendar(params),
    },

    Checklist: {
      fields(p) {
        const defaultWidth = p.cols > 1 ? 340 + p.cols * 26 : 320;
        return [
          propRow('Rows', `<input type="number" id="geRows" min="1" max="40" value="${p.rows}" />`, 'geRows'),
          propRow('Columns', `<input type="number" id="geCols" min="1" max="31" value="${p.cols}" />`, 'geCols'),
          propRow('Title', `<input type="text" id="geTitle" value="${(p.title || '').replace(/"/g, '&quot;')}" />`, 'geTitle'),
          propRow('Width (px)', `<input type="number" id="geWidth" min="100" value="${p.width || defaultWidth}" />`, 'geWidth'),
          propRow('Height (px)', `<input type="number" id="geRowHeight" min="10" value="${p.rowHeight || 28}" />`, 'geRowHeight'),
          fontFieldRow(p.fontFamily),
          colorRow('geHeaderColor', 'Header color', p.headerColor),
          colorRow('geTextColor', 'Text color', p.textColor),
          colorRow('geWeekendColor', 'Weekend color', p.weekendColor),
          colorRow('geAccentColor', 'Line/border color', p.accentColor),
        ].join('');
      },
      bind(panelEl, params, onChange) {
        bindField(panelEl, 'geRows', params, 'rows', onChange, Number);
        bindField(panelEl, 'geCols', params, 'cols', onChange, Number);
        bindField(panelEl, 'geTitle', params, 'title', onChange);
        bindField(panelEl, 'geWidth', params, 'width', onChange, Number);
        bindField(panelEl, 'geRowHeight', params, 'rowHeight', onChange, Number);
        bindFontField(panelEl, params, onChange);
        bindField(panelEl, 'geHeaderColor', params, 'headerColor', onChange);
        bindField(panelEl, 'geTextColor', params, 'textColor', onChange);
        bindField(panelEl, 'geWeekendColor', params, 'weekendColor', onChange);
        bindField(panelEl, 'geAccentColor', params, 'accentColor', onChange);
      },
      build: (params) => Generators.buildChecklist(params),
    },

    Schedule: {
      fields(p) {
        return [
          propRow('Title', `<input type="text" id="geTitle" value="${(p.title || '').replace(/"/g, '&quot;')}" />`, 'geTitle'),
          propRow('Start hour', `<input type="number" id="geStartHour" min="0" max="23" value="${p.startHour}" />`, 'geStartHour'),
          propRow('End hour', `<input type="number" id="geEndHour" min="1" max="24" value="${p.endHour}" />`, 'geEndHour'),
          propRow('Width (px)', `<input type="number" id="geWidth" min="100" value="${p.width || 480}" />`, 'geWidth'),
          propRow('Height (px)', `<input type="number" id="geRowHeight" min="10" value="${p.rowHeight || 32}" />`, 'geRowHeight'),
          fontFieldRow(p.fontFamily),
          colorRow('geHeaderColor', 'Header color', p.headerColor),
          colorRow('geTextColor', 'Text color', p.textColor),
          colorRow('geHighlightColor', 'Current-hour highlight', p.highlightColor),
          colorRow('geAccentColor', 'Line/border color', p.accentColor),
        ].join('');
      },
      bind(panelEl, params, onChange) {
        bindField(panelEl, 'geTitle', params, 'title', onChange);
        bindField(panelEl, 'geStartHour', params, 'startHour', onChange, Number);
        bindField(panelEl, 'geEndHour', params, 'endHour', onChange, Number);
        bindField(panelEl, 'geWidth', params, 'width', onChange, Number);
        bindField(panelEl, 'geRowHeight', params, 'rowHeight', onChange, Number);
        bindFontField(panelEl, params, onChange);
        bindField(panelEl, 'geHeaderColor', params, 'headerColor', onChange);
        bindField(panelEl, 'geTextColor', params, 'textColor', onChange);
        bindField(panelEl, 'geHighlightColor', params, 'highlightColor', onChange);
        bindField(panelEl, 'geAccentColor', params, 'accentColor', onChange);
      },
      build: (params) => Generators.buildSchedule(params),
    },
  },

  // True only when the active selection is exactly every object sharing
  // one generatorGroupId — never a partial/manual multi-select, so a
  // regenerate here can't silently drop objects the user didn't select.
  isFullGroupSelection(activeSelection) {
    const selected = activeSelection.getObjects ? activeSelection.getObjects() : [];
    if (!selected.length) return false;
    const groupId = selected[0].generatorGroupId;
    if (!groupId) return false;
    if (!selected.every((o) => o.generatorGroupId === groupId)) return false;
    const allMembers = CanvasEditor.canvas.getObjects().filter((o) => o.generatorGroupId === groupId);
    return allMembers.length === selected.length;
  },

  render(activeSelection, panelEl) {
    const members = activeSelection.getObjects();
    const first = members[0];
    const generatorGroupId = first.generatorGroupId;
    const generatorLabel = first.generatorLabel;
    const spec = this.FIELD_SETS[generatorLabel];
    if (!spec || !first.generatorParams) {
      delete panelEl.dataset.geGroupId;
      panelEl.innerHTML = '<p class="hint">This layer group can\'t be edited as a whole — expand it to edit individual pieces.</p>';
      return;
    }

    // A field edit's own regenerate() re-selects the group, which
    // re-triggers this same render() — if that's what's happening (still
    // showing this exact group), skip rebuilding the panel: it would
    // replace the very input the user is mid-drag/mid-typing in, dropping
    // focus and (for a color input) likely closing the native picker
    // popup. The marker lives on the panel element itself so it survives
    // this function's own `innerHTML` reassignment of the panel's
    // children; renderProperties()'s other branches clear it so switching
    // to a different object/group still forces a fresh render.
    if (panelEl.dataset.geGroupId === generatorGroupId) return;
    panelEl.dataset.geGroupId = generatorGroupId;

    const params = Object.assign({}, first.generatorParams);
    const heading = `<p class="hint">Editing all ${members.length} shapes in "${generatorLabel}" at once.</p>`;
    panelEl.innerHTML = heading + spec.fields(params);

    const onChange = () => this.regenerate(generatorGroupId, generatorLabel, params);
    spec.bind(panelEl, params, onChange);
  },

  regenerate(generatorGroupId, generatorLabel, newParams) {
    const canvas = CanvasEditor.canvas;
    const spec = this.FIELD_SETS[generatorLabel];
    const members = canvas.getObjects().filter((o) => o.generatorGroupId === generatorGroupId);
    if (!spec || !members.length) return;
    const wasLocked = members.every((o) => o.selectable === false);

    // Suppress history/layers-refresh/Properties-panel side effects for the
    // whole discard-through-reselect sequence below — a mid-batch
    // discardActiveObject() fires 'selection:cleared', which would otherwise
    // wipe the Properties panel's <input> the user is actively editing (see
    // the suppressHistory doc comment in canvas-editor.js).
    CanvasEditor.suppressHistory = true;

    // Discarding first (before reading members' bounds) matters: while
    // `members` are still part of the ActiveSelection that triggered this
    // edit, Fabric reports their left/top relative to that selection's own
    // coordinate frame, not the canvas. Discarding restores each member's
    // absolute left/top, which boundingTopLeft() below depends on.
    canvas.discardActiveObject();

    // Preserve rotation/flip across the rebuild — discardActiveObject()
    // above just baked the group's rigid rotate/flip into each member's own
    // angle/flipX/flipY (they're always rotated as one unit, never
    // individually), but spec.build() below always returns fresh objects at
    // angle 0 / flipX false / flipY false. Without this, any regenerate
    // (drag-resize or a bulk field edit) would silently snap a
    // rotated/flipped group back to unrotated/unflipped.
    const preservedAngle = members[0].angle || 0;
    const preservedFlipX = !!members[0].flipX;
    const preservedFlipY = !!members[0].flipY;

    const freshObjects = spec.build(newParams);
    if (!freshObjects.length) {
      CanvasEditor.suppressHistory = false;
      showToast('End hour must be after start hour');
      return;
    }

    // Preserve on-page position: the fresh batch lands at the generator's
    // default insert offset, so shift it by the delta between that and
    // where the existing group currently sits.
    const oldBounds = boundingTopLeft(members);
    const freshBounds = boundingTopLeft(freshObjects);
    const dx = oldBounds.left - freshBounds.left;
    const dy = oldBounds.top - freshBounds.top;
    freshObjects.forEach((o) => o.set({ left: (o.left || 0) + dx, top: (o.top || 0) + dy }));

    members.forEach((o) => canvas.remove(o));
    freshObjects.forEach((o) => {
      CanvasEditor.stampLayerIdentity(o, generatorLabel);
      o.set({ generatorGroupId, generatorLabel, generatorParams: newParams, selectable: !wasLocked, evented: !wasLocked });
      canvas.add(o);
    });

    // setCoords() guards against a stale/duplicate selection outline
    // lingering alongside the new one — see the matching comment on
    // CanvasEditor.addGeneratedObjects.
    const selection = new fabric.ActiveSelection(freshObjects, { canvas, selectable: !wasLocked, evented: !wasLocked });
    // Re-apply the preserved rotation/flip to the whole freshly-rebuilt
    // batch as one rigid transform — not to the individual fresh objects,
    // which must stay at angle 0 relative to each other to keep the
    // group's internal layout (e.g. a calendar's grid) coherent.
    selection.set({ angle: preservedAngle, flipX: preservedFlipX, flipY: preservedFlipY });
    selection.setCoords();
    canvas.setActiveObject(selection);

    CanvasEditor.suppressHistory = false;
    // Synchronous, unconditional repaint right after a batch rebuild — see
    // the matching comment on CanvasEditor.addGeneratedObjects.
    canvas.renderAll();
    CanvasEditor.pushHistory();
    CanvasEditor.notifyLayersChange();
  },

  // A generator group's side-handle drag lands here (wired to
  // 'object:modified' in canvas-editor.js). Fabric applies the resize as a
  // scale on the ActiveSelection wrapper, not on the underlying objects —
  // rather than let that stretch text, translate the requested final pixel
  // size into new width/rowHeight params and regenerate, which lays
  // everything out fresh at scale 1 (fontSize is never derived from
  // width/rowHeight in generators.js, so text is never touched).
  handleResize(target) {
    if (!target || target.type !== 'activeSelection') return;
    if (target.scaleX === 1 && target.scaleY === 1) return; // plain move, not a resize
    if (!this.isFullGroupSelection(target)) return;

    const first = target.getObjects()[0];
    const generatorGroupId = first.generatorGroupId;
    const generatorLabel = first.generatorLabel;
    if (!this.FIELD_SETS[generatorLabel] || !first.generatorParams) return;

    const params = Object.assign({}, first.generatorParams);
    if (generatorLabel === 'Calendar' && params.view === 'year') {
      showToast("Resize isn't available for the yearly overview");
      return;
    }

    params.width = Math.max(100, Math.round(target.getScaledWidth()));
    const newRowHeight = inverseRowHeight(generatorLabel, params, target.getScaledHeight());
    if (newRowHeight != null) params.rowHeight = Math.max(10, Math.round(newRowHeight));

    this.regenerate(generatorGroupId, generatorLabel, params);
  },
};

// Inverts each generator's own height formula to solve for the rowHeight
// that would produce a requested overall pixel height — best-effort (the
// habit-tracker header row's small offset above startY is ignored, for
// example), close enough for a drag-to-resize gesture. Returns null when
// the generator/view has no meaningful single row-height knob (Calendar's
// year view).
function inverseRowHeight(generatorLabel, params, requestedHeight) {
  if (generatorLabel === 'Calendar') {
    if (params.view === 'week') return requestedHeight;
    if (params.view === 'year') return null;
    return (requestedHeight - 34) / 6; // month grid: fixed 6 rows
  }
  if (generatorLabel === 'Checklist') {
    const rows = Number(params.rows) || 1;
    return (requestedHeight - 34) / rows;
  }
  if (generatorLabel === 'Schedule') {
    const gridTop = params.title ? 26 : 0;
    const rowCount = Math.max(1, (Number(params.endHour) || 0) - (Number(params.startHour) || 0));
    return (requestedHeight - gridTop) / rowCount;
  }
  return null;
}

// Every generators.js shape is axis-aligned and unrotated, so the plain
// left/top each object already carries is all the "top-left" we need — no
// call to getBoundingRect(true, true) (absolute canvas coords), which
// returns NaN for objects that aren't attached to a canvas yet (true for
// the freshly-built batch here, before it's been canvas.add()-ed) and
// poisons the whole reduce via Math.min(x, NaN) === NaN.
function boundingTopLeft(objects) {
  return objects.reduce((acc, o) => ({
    left: Math.min(acc.left, o.left || 0),
    top: Math.min(acc.top, o.top || 0),
  }), { left: Infinity, top: Infinity });
}

// Mirrors CanvasEditor.propRow — kept local rather than reached into across
// modules, same one-line template either way.
function propRow(label, inputHtml, forId) {
  const forAttr = forId ? ` for="${forId}"` : '';
  return `<div class="prop-row"><label${forAttr}>${label}</label>${inputHtml}</div>`;
}

function colorRow(id, label, value) {
  return propRow(label, `<input type="color" id="${id}" value="${value || '#000000'}" />`, id);
}

function selectHtml(id, options, selectedValue) {
  const opts = options.map(([value, label]) => `<option value="${value}"${value === selectedValue ? ' selected' : ''}>${label}</option>`).join('');
  return `<select id="${id}">${opts}</select>`;
}

function fontFieldRow(fontFamily) {
  return propRow('Font', `<div class="font-picker">
    <input type="text" id="geFontInput" autocomplete="off" placeholder="Search fonts…" value="${(fontFamily || '').replace(/"/g, '&quot;')}" />
    <div id="geFontResults" class="font-picker-results" hidden></div>
  </div>`, 'geFontInput');
}

function bindField(panelEl, id, params, key, onChange, transform) {
  const el = panelEl.querySelector('#' + id);
  if (!el) return;
  el.addEventListener('input', () => {
    params[key] = transform ? transform(el.value) : el.value;
    onChange();
  });
}

function bindFontField(panelEl, params, onChange) {
  FontLoader.attachPicker({
    inputEl: panelEl.querySelector('#geFontInput'),
    resultsEl: panelEl.querySelector('#geFontResults'),
    initialValue: params.fontFamily || '',
    onSelect: (family) => {
      params.fontFamily = family;
      onChange();
    },
  });
}
