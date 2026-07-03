// Handles the "Layers" panel: a Photoshop-style list of every object on the
// current page, top-of-stack first. Reads/writes Fabric objects on
// CanvasEditor.canvas directly (rather than adding more methods to
// CanvasEditor) to keep canvas-editor.js under this project's 500-line
// file-size limit — see public/CLAUDE.md.
//
// Generator output (calendar/checklist/schedule — see generators.js) is
// stamped with a shared `generatorGroupId`/`generatorLabel` by
// CanvasEditor.addGeneratedObjects and shown here as one collapsible group
// row. Selecting or dragging that row rebuilds a live fabric.ActiveSelection
// over every member every time (not just once at insert), which is what
// keeps a generator's border/grid/labels moving together as a unit.
const LayersPanel = {
  expandedGroups: new Set(),

  init() {
    this.listEl = document.getElementById('layersList');
    this.refresh();
  },

  canvas() {
    return CanvasEditor.canvas;
  },

  // Top-of-stack-first plain descriptors — mirrors the shape the panel
  // needs, independent of Fabric's own bottom-first object array order.
  getEntries() {
    return this.canvas().getObjects().slice().reverse().map((o) => ({
      id: o.id,
      name: o.name || o.type,
      type: o.type,
      visible: o.visible !== false,
      locked: o.selectable === false,
      generatorGroupId: o.generatorGroupId || null,
      generatorLabel: o.generatorLabel || null,
    }));
  },

  findObject(id) {
    return this.canvas().getObjects().find((o) => o.id === id);
  },

  // Collapses entries sharing a generatorGroupId into one group node,
  // positioned at that group's first (topmost) occurrence.
  buildTree() {
    const topLevel = [];
    const groups = {};
    this.getEntries().forEach((entry) => {
      if (entry.generatorGroupId) {
        let group = groups[entry.generatorGroupId];
        if (!group) {
          group = { isGroup: true, generatorGroupId: entry.generatorGroupId, label: entry.generatorLabel, members: [] };
          groups[entry.generatorGroupId] = group;
          topLevel.push(group);
        }
        group.members.push(entry);
      } else {
        topLevel.push(entry);
      }
    });
    return topLevel;
  },

  refresh() {
    if (!this.listEl) return;
    const tree = this.buildTree();
    const activeIds = new Set((this.canvas().getActiveObjects() || []).map((o) => o.id));

    this.listEl.innerHTML = '';
    if (!tree.length) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'Elements you add to the page will show up here as layers.';
      this.listEl.appendChild(empty);
      return;
    }

    tree.forEach((node, index) => {
      if (node.isGroup) {
        this.listEl.appendChild(this.buildGroupRow(node, index, activeIds));
      } else {
        this.listEl.appendChild(this.buildRow(node, index, activeIds, false));
      }
    });
  },

  buildGroupRow(group, orderIndex, activeIds) {
    const wrap = document.createElement('div');
    wrap.className = 'layer-group';

    const expanded = this.expandedGroups.has(group.generatorGroupId);
    const allActive = group.members.every((m) => activeIds.has(m.id));

    const header = document.createElement('div');
    header.className = 'layer-row layer-group-row' + (allActive ? ' active' : '');
    header.draggable = true;
    header.dataset.orderIndex = String(orderIndex);

    const toggle = document.createElement('button');
    toggle.className = 'layer-icon-btn layer-group-toggle' + (expanded ? ' expanded' : '');
    toggle.setAttribute('aria-label', expanded ? 'Collapse layer group' : 'Expand layer group');
    toggle.innerHTML = icon('chevron', { size: 14 });
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (expanded) this.expandedGroups.delete(group.generatorGroupId);
      else this.expandedGroups.add(group.generatorGroupId);
      this.refresh();
    });

    const name = document.createElement('span');
    name.className = 'layer-name';
    name.textContent = `${group.label || 'Group'} (${group.members.length})`;

    const allLocked = group.members.every((m) => m.locked);
    const lockBtn = document.createElement('button');
    lockBtn.className = 'layer-icon-btn' + (allLocked ? ' active' : '');
    lockBtn.setAttribute('aria-label', allLocked ? `Unlock all ${group.label || 'Group'} shapes` : `Lock all ${group.label || 'Group'} shapes`);
    lockBtn.innerHTML = icon('lock', { size: 14 });
    lockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setGroupLocked(group.generatorGroupId, !allLocked);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'layer-icon-btn layer-del-btn';
    delBtn.setAttribute('aria-label', `Delete ${group.label || 'Group'} layer group`);
    delBtn.innerHTML = icon('trash', { size: 14 });
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteGroup(group.generatorGroupId);
    });

    header.appendChild(toggle);
    header.appendChild(name);
    header.appendChild(lockBtn);
    header.appendChild(delBtn);
    header.addEventListener('click', () => this.selectGroup(group.generatorGroupId));
    this.wireDrag(header, orderIndex);

    wrap.appendChild(header);

    if (expanded) {
      group.members.forEach((member) => {
        wrap.appendChild(this.buildRow(member, orderIndex, activeIds, true));
      });
    }

    return wrap;
  },

  buildRow(entry, orderIndex, activeIds, indented) {
    const row = document.createElement('div');
    row.className = 'layer-row' + (activeIds.has(entry.id) ? ' active' : '') + (indented ? ' layer-row-indent' : '');
    row.draggable = !indented;
    row.dataset.orderIndex = String(orderIndex);

    if (!indented) {
      const grip = document.createElement('span');
      grip.className = 'layer-icon-btn layer-grip';
      grip.setAttribute('aria-hidden', 'true');
      grip.innerHTML = icon('grip', { size: 14 });
      row.appendChild(grip);
    }

    const visBtn = document.createElement('button');
    visBtn.className = 'layer-icon-btn';
    visBtn.setAttribute('aria-label', entry.visible ? 'Hide layer' : 'Show layer');
    visBtn.innerHTML = icon(entry.visible ? 'eye' : 'eye-off', { size: 14 });
    visBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setVisibility(entry.id, !entry.visible);
    });

    const lockBtn = document.createElement('button');
    lockBtn.className = 'layer-icon-btn' + (entry.locked ? ' active' : '');
    lockBtn.setAttribute('aria-label', entry.locked ? 'Unlock layer' : 'Lock layer');
    lockBtn.innerHTML = icon('lock', { size: 14 });
    lockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setLocked(entry.id, !entry.locked);
    });

    const name = document.createElement('span');
    name.className = 'layer-name';
    name.textContent = entry.name;

    const delBtn = document.createElement('button');
    delBtn.className = 'layer-icon-btn layer-del-btn';
    delBtn.setAttribute('aria-label', `Delete ${entry.name}`);
    delBtn.innerHTML = icon('trash', { size: 14 });
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteObject(entry.id);
    });

    row.appendChild(visBtn);
    row.appendChild(lockBtn);
    row.appendChild(name);
    row.appendChild(delBtn);
    row.addEventListener('click', () => this.selectSingle(entry.id));
    if (!indented) this.wireDrag(row, orderIndex);

    return row;
  },

  // -------- selection --------
  selectSingle(id) {
    const obj = this.findObject(id);
    if (!obj) return;
    this.canvas().setActiveObject(obj);
    this.canvas().requestRenderAll();
  },

  selectGroup(generatorGroupId) {
    const members = this.canvas().getObjects().filter((o) => o.generatorGroupId === generatorGroupId);
    if (!members.length) return;
    this.canvas().discardActiveObject();
    const selection = new fabric.ActiveSelection(members, { canvas: this.canvas() });
    selection.setCoords();
    this.canvas().setActiveObject(selection);
    this.canvas().requestRenderAll();
  },

  // -------- visibility / lock / delete --------
  setVisibility(id, visible) {
    const obj = this.findObject(id);
    if (!obj) return;
    obj.set('visible', visible);
    this.canvas().requestRenderAll();
    CanvasEditor.pushHistory();
    this.refresh();
  },

  setLocked(id, locked) {
    const obj = this.findObject(id);
    if (!obj) return;
    obj.set({ selectable: !locked, evented: !locked });
    if (locked && this.canvas().getActiveObject() === obj) this.canvas().discardActiveObject();
    this.canvas().requestRenderAll();
    CanvasEditor.pushHistory();
    this.refresh();
  },

  deleteObject(id) {
    const obj = this.findObject(id);
    if (!obj) return;
    this.canvas().remove(obj);
    this.canvas().requestRenderAll();
  },

  // Locks/unlocks every member of a generator group in one step — the
  // group-row equivalent of setLocked. Mixed lock states always resolve to
  // "lock all" on click (the row's own displayed state already reflects
  // whether every member is currently locked).
  setGroupLocked(generatorGroupId, locked) {
    const members = this.canvas().getObjects().filter((o) => o.generatorGroupId === generatorGroupId);
    if (!members.length) return;
    members.forEach((obj) => {
      obj.set({ selectable: !locked, evented: !locked });
      if (locked && this.canvas().getActiveObjects().includes(obj)) this.canvas().discardActiveObject();
    });
    this.canvas().requestRenderAll();
    CanvasEditor.pushHistory();
    this.refresh();
  },

  // Removes every member of a generator group in one step. Suppresses the
  // per-object history push (same suppressHistory flag
  // CanvasEditor.addGeneratedObjects uses for the reverse operation) so
  // deleting a 15-shape calendar is one undo step, not fifteen.
  deleteGroup(generatorGroupId) {
    const members = this.canvas().getObjects().filter((o) => o.generatorGroupId === generatorGroupId);
    if (!members.length) return;
    CanvasEditor.suppressHistory = true;
    members.forEach((obj) => this.canvas().remove(obj));
    CanvasEditor.suppressHistory = false;
    this.canvas().requestRenderAll();
    CanvasEditor.pushHistory();
    this.refresh();
  },

  // -------- drag-and-drop reorder --------
  wireDrag(el, orderIndex) {
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(orderIndex));
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drag-over');
      const fromIndex = Number(e.dataTransfer.getData('text/plain'));
      const toIndex = Number(el.dataset.orderIndex);
      if (Number.isNaN(fromIndex) || Number.isNaN(toIndex) || fromIndex === toIndex) return;
      this.reorder(fromIndex, toIndex);
    });
  },

  // Reorders top-level rows (each a single object or a whole generator
  // group moved as a unit), then rebuilds the canvas's bottom-first object
  // array to match via repeated Fabric moveTo calls.
  reorder(fromIndex, toIndex) {
    const tree = this.buildTree();
    const [moved] = tree.splice(fromIndex, 1);
    tree.splice(toIndex, 0, moved);

    const topFirstObjects = [];
    tree.forEach((node) => {
      if (node.isGroup) node.members.forEach((m) => topFirstObjects.push(this.findObject(m.id)));
      else topFirstObjects.push(this.findObject(node.id));
    });

    const bottomFirstObjects = topFirstObjects.slice().reverse().filter(Boolean);
    bottomFirstObjects.forEach((obj, i) => this.canvas().moveTo(obj, i));
    this.canvas().requestRenderAll();
    CanvasEditor.pushHistory();
    this.refresh();
  },
};
