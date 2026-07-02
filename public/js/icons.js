// Self-hosted inline-SVG icon set — replaces raw emoji glyphs used
// throughout the UI. No icon-font/CDN dependency, matches the rest of the
// app's fully-local asset policy. Icons are decorative (aria-hidden); put
// the accessible label on the button/element that uses icon(), not here.
const ICON_PATHS = {
  brand: '<rect x="3.5" y="5" width="17" height="15" rx="3.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><circle cx="8" cy="14" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="14" r="1.1" fill="currentColor" stroke="none"/><circle cx="16" cy="14" r="1.1" fill="currentColor" stroke="none"/>',
  text: '<path d="M4 5h16M12 5v14"/>',
  line: '<path d="M5 19 19 5"/><circle cx="5" cy="19" r="1.3" fill="currentColor" stroke="none"/><circle cx="19" cy="5" r="1.3" fill="currentColor" stroke="none"/>',
  rectangle: '<rect x="4" y="6" width="16" height="12" rx="1.5"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16.5 15.7 11a1.5 1.5 0 0 0-2.2.1L4 19"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.8-.8 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8Z"/><circle cx="7.5" cy="10.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="10.5" cy="7" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="7.5" r="1.1" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  scissors: '<circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="18" r="2.2"/><path d="M20 6 8.5 12M20 18 8.5 12"/>',
  trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M10 11v6M14 11v6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  checklist: '<rect x="4" y="5" width="3" height="3" rx=".6"/><rect x="4" y="10.5" width="3" height="3" rx=".6"/><rect x="4" y="16" width="3" height="3" rx=".6"/><path d="M10 6.5h10M10 12h10M10 17.5h10"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  undo: '<path d="M7 7 3 11l4 4"/><path d="M3 11h11a6 6 0 0 1 0 12h-2"/>',
  redo: '<path d="M17 7l4 4-4 4"/><path d="M21 11H10a6 6 0 0 0 0 12h2"/>',
  forward: '<path d="M6 15l6-6 6 6"/>',
  backward: '<path d="M6 9l6 6 6-6"/>',
  zoom: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/>',
  'folder-open': '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1H5"/><path d="M3 8l1.5 10a2 2 0 0 0 2 1.7h9a2 2 0 0 0 2-1.7L19 10H5"/>',
  save: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.5l2.3 2.3L16 9.5"/>',
  download: '<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 19h14"/>',
  new: '<path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7 3.5Z"/><path d="M13.5 3.5V8h4.5"/><path d="M12 12v5M9.5 14.5h5"/>',
  duplicate: '<rect x="3.5" y="3.5" width="12.5" height="12.5" rx="2"/><path d="M9 16.5V18a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1.5"/>',
};

function icon(name, opts) {
  const { size = 18, className = '' } = opts || {};
  const paths = ICON_PATHS[name];
  if (!paths) return '';
  return `<svg class="icon icon-${name} ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

// Hydrates static markup: any element with data-icon="name" (and optional
// data-icon-size="N") gets that icon's SVG inserted as its content. Lets
// index.html stay plain HTML instead of duplicating SVG path data.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-icon]').forEach((el) => {
    const size = Number(el.getAttribute('data-icon-size')) || undefined;
    el.innerHTML = icon(el.getAttribute('data-icon'), size ? { size } : undefined) + el.innerHTML;
  });
});
