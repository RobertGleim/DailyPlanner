// Main application controller: wires toolbar, sidebars, canvas editor, pages, and persistence together.
(function () {
  let currentProjectId = null;
  let pendingSaveTimer = null;

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function captureActivePageIntoModel() {
    const serialized = CanvasEditor.serializePage();
    PagesManager.updateActivePage(serialized.json, serialized.thumbnail, serialized.background);
  }

  function switchToPage(index) {
    const page = PagesManager.pages[index];
    CanvasEditor.loadPage(page);
  }

  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
      });
    });
  }

  function initElementTools() {
    document.getElementById('addTextBtn').addEventListener('click', () => CanvasEditor.addText());
    document.getElementById('addLineBtn').addEventListener('click', () => CanvasEditor.addLine());
    document.getElementById('addRectBtn').addEventListener('click', () => CanvasEditor.addRect());
    document.getElementById('addCircleBtn').addEventListener('click', () => CanvasEditor.addCircle());

    document.getElementById('imageUploadInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const dataUrl = await fileToDataUrl(file);
      CanvasEditor.addImageFromUrl(dataUrl);
      e.target.value = '';
    });

    document.getElementById('backgroundUploadInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const dataUrl = await fileToDataUrl(file);
      CanvasEditor.setBackgroundImageFromUrl(dataUrl);
      e.target.value = '';
    });

    document.getElementById('bgColorPicker').addEventListener('input', (e) => {
      CanvasEditor.setBackgroundColor(e.target.value);
    });

    document.getElementById('deleteSelectedBtn').addEventListener('click', () => CanvasEditor.deleteSelected());
    document.getElementById('bringForwardBtn').addEventListener('click', () => CanvasEditor.bringForward());
    document.getElementById('sendBackwardBtn').addEventListener('click', () => CanvasEditor.sendBackward());
    document.getElementById('undoBtn').addEventListener('click', () => CanvasEditor.undo());
    document.getElementById('redoBtn').addEventListener('click', () => CanvasEditor.redo());
  }

  function initGenerators() {
    document.getElementById('insertCalendarBtn').addEventListener('click', () => {
      const view = document.getElementById('calViewSelect').value;
      const monthValue = document.getElementById('calMonthInput').value;
      const style = document.getElementById('calStyleSelect').value;
      const group = Generators.buildCalendar({ view, monthValue, style });
      CanvasEditor.addGroupObject(group);
    });

    document.getElementById('insertChecklistBtn').addEventListener('click', () => {
      const rows = Number(document.getElementById('checklistRows').value) || 8;
      const cols = Number(document.getElementById('checklistCols').value) || 1;
      const title = document.getElementById('checklistTitle').value;
      const group = Generators.buildChecklist({ rows, cols, title });
      CanvasEditor.addGroupObject(group);
    });

    document.getElementById('insertScheduleBtn').addEventListener('click', () => {
      const startHour = Number(document.getElementById('schedStart').value) || 6;
      const endHour = Number(document.getElementById('schedEnd').value) || 21;
      const group = Generators.buildSchedule({ startHour, endHour });
      CanvasEditor.addGroupObject(group);
    });
  }

  function initPageControls() {
    document.getElementById('addPageBtn').addEventListener('click', () => {
      captureActivePageIntoModel();
      PagesManager.addPage();
    });

    document.getElementById('pageSizeSelect').addEventListener('change', (e) => {
      CanvasEditor.setPageSize(e.target.value);
    });
  }

  function initModal() {
    document.getElementById('modalCloseBtn').addEventListener('click', () => {
      document.getElementById('modalOverlay').hidden = true;
    });
  }

  function openModalWithProjects(projects) {
    const overlay = document.getElementById('modalOverlay');
    const body = document.getElementById('modalBody');
    document.getElementById('modalTitle').textContent = 'Open Project';
    body.innerHTML = '';
    if (!projects.length) {
      body.innerHTML = '<p class="hint">No saved planners yet. Save your first one with the Save button.</p>';
    }
    projects.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'project-row';
      row.innerHTML = `
        <img src="${p.thumbnail || ''}" />
        <div class="proj-meta">
          <div class="name">${p.name}</div>
          <div class="sub">${p.pageCount} page(s) · ${PAGE_SIZES[p.pageSize]?.name || p.pageSize} · updated ${new Date(p.updatedAt).toLocaleString()}</div>
        </div>
        <button data-id="${p.id}">🗑</button>`;
      row.addEventListener('click', async (e) => {
        if (e.target.tagName === 'BUTTON') return;
        await loadProject(p.id);
        overlay.hidden = true;
      });
      row.querySelector('button').addEventListener('click', async (e) => {
        e.stopPropagation();
        await Api.deleteProject(p.id);
        const { projects: refreshed } = await Api.listProjects();
        openModalWithProjects(refreshed);
      });
      body.appendChild(row);
    });
    overlay.hidden = false;
  }

  async function loadProject(id) {
    const project = await Api.getProject(id);
    currentProjectId = project.id;
    document.getElementById('projectName').value = project.name;
    document.getElementById('pageSizeSelect').value = project.pageSize;
    CanvasEditor.setPageSize(project.pageSize);
    PagesManager.reset(project.pages);
    switchToPage(0);
    showToast(`Loaded "${project.name}"`);
  }

  function collectProjectPayload() {
    captureActivePageIntoModel();
    return {
      name: document.getElementById('projectName').value || 'Untitled Planner',
      pageSize: document.getElementById('pageSizeSelect').value,
      pages: PagesManager.pages,
    };
  }

  function initToolbarActions() {
    document.getElementById('newProjectBtn').addEventListener('click', () => {
      if (!confirm('Start a new planner? Unsaved changes will be lost.')) return;
      currentProjectId = null;
      document.getElementById('projectName').value = 'Untitled Planner';
      document.getElementById('pageSizeSelect').value = 'letter';
      CanvasEditor.setPageSize('letter');
      PagesManager.reset([]);
      switchToPage(0);
    });

    document.getElementById('openProjectBtn').addEventListener('click', async () => {
      const { projects } = await Api.listProjects();
      openModalWithProjects(projects);
    });

    document.getElementById('saveProjectBtn').addEventListener('click', async () => {
      const payload = collectProjectPayload();
      try {
        if (currentProjectId) {
          await Api.updateProject(currentProjectId, payload);
        } else {
          const created = await Api.createProject(payload);
          currentProjectId = created.id;
        }
        showToast('Planner saved');
      } catch (err) {
        showToast('Save failed: ' + err.message);
      }
    });

    document.getElementById('exportPdfBtn').addEventListener('click', async () => {
      const payload = collectProjectPayload();
      showToast('Generating PDF…');
      try {
        await ExportPdf.exportProject(payload);
        showToast('PDF downloaded');
      } catch (err) {
        console.error(err);
        showToast('PDF export failed: ' + err.message);
      }
    });
  }

  function insertLibraryAsset(item) {
    if (item.category === 'backgrounds') {
      CanvasEditor.setBackgroundImageFromUrl(item.url);
    } else {
      CanvasEditor.addImageFromUrl(item.url);
    }
  }

  async function boot() {
    initTabs();
    CanvasEditor.init();
    CanvasEditor.onChange = () => captureActivePageIntoModel();
    PagesManager.init({ onSwitchPage: switchToPage });
    initElementTools();
    initGenerators();
    initPageControls();
    initToolbarActions();
    initModal();
    await LibraryPanel.init(insertLibraryAsset);

    PagesManager.reset([]);
    switchToPage(0);
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
