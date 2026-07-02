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

    document.getElementById('deleteSelectedBtn').addEventListener('click', () => CanvasEditor.deleteSelected());
    document.getElementById('bringForwardBtn').addEventListener('click', () => CanvasEditor.bringForward());
    document.getElementById('sendBackwardBtn').addEventListener('click', () => CanvasEditor.sendBackward());
    document.getElementById('undoBtn').addEventListener('click', () => CanvasEditor.undo());
    document.getElementById('redoBtn').addEventListener('click', () => CanvasEditor.redo());
  }

  function initBackgroundControls() {
    const solidControls = document.getElementById('bgSolidControls');
    const imageControls = document.getElementById('bgImageControls');
    const gradientControls = document.getElementById('bgGradientControls');
    const panelsByType = { solid: solidControls, image: imageControls, gradient: gradientControls };

    document.querySelectorAll('.bg-type-chips .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.bg-type-chips .chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        Object.values(panelsByType).forEach((el) => { el.hidden = true; });
        panelsByType[chip.dataset.bgtype].hidden = false;
      });
    });

    document.getElementById('bgColorPicker').addEventListener('input', (e) => {
      CanvasEditor.setBackgroundColor(e.target.value);
    });

    document.getElementById('backgroundUploadInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const dataUrl = await fileToDataUrl(file);
      const tile = document.getElementById('bgTileToggle').checked;
      CanvasEditor.setBackgroundImageFromUrl(dataUrl, { tile });
      e.target.value = '';
    });

    document.getElementById('bgTileToggle').addEventListener('change', (e) => {
      if (!CanvasEditor.currentBackgroundImage) return;
      CanvasEditor.setBackgroundImageFromUrl(CanvasEditor.currentBackgroundImage, { tile: e.target.checked });
    });

    document.getElementById('bgImageOpacity').addEventListener('input', (e) => {
      CanvasEditor.setBackgroundImageOpacity(Number(e.target.value) / 100);
    });

    const applyBackgroundTint = () => {
      const color = document.getElementById('bgImageTintColor').value;
      const intensity = Number(document.getElementById('bgImageTintIntensity').value) / 100;
      CanvasEditor.setBackgroundImageTint(color, intensity);
    };
    document.getElementById('bgImageTintColor').addEventListener('input', applyBackgroundTint);
    document.getElementById('bgImageTintIntensity').addEventListener('input', applyBackgroundTint);

    document.getElementById('removeBackgroundBtn').addEventListener('click', () => {
      CanvasEditor.removeBackgroundImage();
      document.getElementById('bgTileToggle').checked = false;
      document.getElementById('bgImageOpacity').value = 100;
      document.getElementById('bgImageTintIntensity').value = 0;
      document.querySelectorAll('.bg-type-chips .chip').forEach((c) => c.classList.remove('active'));
      document.querySelector('.bg-type-chips .chip[data-bgtype="solid"]').classList.add('active');
      Object.values(panelsByType).forEach((el) => { el.hidden = true; });
      solidControls.hidden = false;
    });

    const applyGradient = () => {
      const color1 = document.getElementById('bgGradientColor1').value;
      const color2 = document.getElementById('bgGradientColor2').value;
      const angle = document.getElementById('bgGradientAngle').value;
      CanvasEditor.setBackgroundGradient(color1, color2, angle);
    };
    document.getElementById('bgGradientColor1').addEventListener('input', applyGradient);
    document.getElementById('bgGradientColor2').addEventListener('input', applyGradient);
    document.getElementById('bgGradientAngle').addEventListener('change', applyGradient);
  }

  function initGenerators() {
    document.getElementById('insertCalendarBtn').addEventListener('click', () => {
      const view = document.getElementById('calViewSelect').value;
      const monthValue = document.getElementById('calMonthInput').value;
      const style = document.getElementById('calStyleSelect').value;
      const objects = Generators.buildCalendar({ view, monthValue, style });
      CanvasEditor.addGeneratedObjects(objects);
    });

    document.getElementById('insertChecklistBtn').addEventListener('click', () => {
      const rows = Number(document.getElementById('checklistRows').value) || 8;
      const cols = Number(document.getElementById('checklistCols').value) || 1;
      const title = document.getElementById('checklistTitle').value;
      const objects = Generators.buildChecklist({ rows, cols, title });
      CanvasEditor.addGeneratedObjects(objects);
    });

    document.getElementById('insertScheduleBtn').addEventListener('click', () => {
      const startHour = Number(document.getElementById('schedStart').value) || 6;
      const endHour = Number(document.getElementById('schedEnd').value) || 21;
      const objects = Generators.buildSchedule({ startHour, endHour });
      CanvasEditor.addGeneratedObjects(objects);
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

      const img = document.createElement('img');
      img.src = p.thumbnail || '';

      const meta = document.createElement('div');
      meta.className = 'proj-meta';
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = p.name;
      const sub = document.createElement('div');
      sub.className = 'sub';
      sub.textContent = `${p.pageCount} page(s) · ${PAGE_SIZES[p.pageSize]?.name || p.pageSize} · updated ${new Date(p.updatedAt).toLocaleString()}`;
      meta.appendChild(name);
      meta.appendChild(sub);

      const delBtn = document.createElement('button');
      delBtn.dataset.id = p.id;
      delBtn.setAttribute('aria-label', `Delete ${p.name}`);
      delBtn.innerHTML = icon('trash', { size: 14 });

      row.appendChild(img);
      row.appendChild(meta);
      row.appendChild(delBtn);

      row.addEventListener('click', async (e) => {
        if (e.target.tagName === 'BUTTON') return;
        await loadProject(p.id);
        overlay.hidden = true;
      });
      delBtn.addEventListener('click', async (e) => {
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
    await FontLoader.ensureAllInJSON(project.pages);
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
        await FontLoader.ensureAllInJSON(payload.pages);
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
      const tile = document.getElementById('bgTileToggle').checked;
      CanvasEditor.setBackgroundImageFromUrl(item.url, { tile });
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
    initBackgroundControls();
    initGenerators();
    initPageControls();
    initToolbarActions();
    initModal();
    await Promise.all([FontLoader.init(), LibraryPanel.init(insertLibraryAsset)]);

    PagesManager.reset([]);
    switchToPage(0);
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
