// Compiles every page into a single print-ready multi-page PDF using jsPDF.
const ExportPdf = {
  async exportProject(project) {
    const { jsPDF } = window.jspdf;
    const size = PAGE_SIZES[project.pageSize] || PAGE_SIZES.letter;
    const orientation = 'portrait';
    const doc = new jsPDF({ orientation, unit: 'in', format: [size.widthIn, size.heightIn], compress: true });

    // Render each page's fabric JSON offscreen at print resolution, then add to PDF.
    const dims = pageDimsPx(project.pageSize, PRINT_DPI);

    for (let i = 0; i < project.pages.length; i++) {
      const page = project.pages[i];
      const dataUrl = await this.renderPageToDataUrl(page, dims);
      if (i > 0) doc.addPage([size.widthIn, size.heightIn], orientation);
      doc.addImage(dataUrl, 'PNG', 0, 0, size.widthIn, size.heightIn, undefined, 'FAST');
    }

    doc.save(`${(project.name || 'planner').replace(/[^a-z0-9\-_ ]/gi, '')}.pdf`);
  },

  renderPageToDataUrl(page, dims) {
    return new Promise((resolve) => {
      const offEl = document.createElement('canvas');
      offEl.width = dims.width;
      offEl.height = dims.height;
      const offCanvas = new fabric.StaticCanvas(offEl, { width: dims.width, height: dims.height });
      const scaleFactor = dims.width / (CanvasEditor.baseWidth || dims.width);

      const finish = () => {
        offCanvas.setZoom(scaleFactor);
        offCanvas.setWidth(dims.width);
        offCanvas.setHeight(dims.height);
        offCanvas.renderAll();
        resolve(offEl.toDataURL('image/png', 1.0));
        offCanvas.dispose();
      };

      offCanvas.setBackgroundColor(page.background || '#ffffff', () => {
        if (page.json) {
          offCanvas.loadFromJSON(page.json, finish);
        } else {
          finish();
        }
      });
    });
  },
};
