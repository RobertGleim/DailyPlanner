// Compiles every page into a single print-ready multi-page PDF using jsPDF.
const ExportPdf = {
  async exportProject(project) {
    const { jsPDF } = window.jspdf;
    const firstPage = project.pages[0] || {};
    const firstPageMetrics = this.resolvePageMetrics(firstPage, project.pageSize);
    const doc = new jsPDF({
      orientation: firstPageMetrics.orientation,
      unit: 'in',
      format: [firstPageMetrics.printIn.width, firstPageMetrics.printIn.height],
      compress: true,
    });

    for (let i = 0; i < project.pages.length; i++) {
      const page = project.pages[i];
      const metrics = this.resolvePageMetrics(page, project.pageSize);
      const dataUrl = await this.renderPageToDataUrl(page, metrics);
      if (i > 0) {
        doc.addPage([metrics.printIn.width, metrics.printIn.height], metrics.orientation);
      }
      doc.addImage(dataUrl, 'PNG', 0, 0, metrics.printIn.width, metrics.printIn.height, undefined, 'FAST');
    }

    doc.save(`${(project.name || 'planner').replace(/[^a-z0-9\-_ ]/gi, '')}.pdf`);
  },

  resolvePageMetrics(page, defaultPageSize) {
    const isLandscape = Boolean(page?.isLandscape);
    if (page?.type === 'cover') {
      const coverType = page.coverType || defaultPageSize || 'letter';
      return {
        orientation: isLandscape ? 'landscape' : 'portrait',
        sourcePx: coverDimsPx(coverType, SCREEN_DPI, isLandscape),
        printPx: coverDimsPx(coverType, PRINT_DPI, isLandscape),
        printIn: coverDimsIn(coverType, isLandscape),
      };
    }
    const pageSize = defaultPageSize || 'letter';
    return {
      orientation: isLandscape ? 'landscape' : 'portrait',
      sourcePx: pageDimsPx(pageSize, SCREEN_DPI, isLandscape),
      printPx: pageDimsPx(pageSize, PRINT_DPI, isLandscape),
      printIn: pageDimsIn(pageSize, isLandscape),
    };
  },

  renderPageToDataUrl(page, metrics) {
    return new Promise((resolve) => {
      const offEl = document.createElement('canvas');
      offEl.width = metrics.printPx.width;
      offEl.height = metrics.printPx.height;
      const offCanvas = new fabric.StaticCanvas(offEl, { width: metrics.printPx.width, height: metrics.printPx.height });
      const scaleFactor = metrics.printPx.width / metrics.sourcePx.width;

      const finish = () => {
        offCanvas.setZoom(scaleFactor);
        offCanvas.setWidth(metrics.printPx.width);
        offCanvas.setHeight(metrics.printPx.height);
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
