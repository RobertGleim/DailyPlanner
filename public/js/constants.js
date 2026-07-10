// Page size definitions in pixels at 96 DPI (screen) — export scales to 300 DPI for print.
const PAGE_SIZES = {
  letter: { name: 'US Letter', widthIn: 8.5, heightIn: 11 },
  a4: { name: 'A4', widthIn: 8.27, heightIn: 11.69 },
  a5: { name: 'A5', widthIn: 5.83, heightIn: 8.27 },
  halfLetter: { name: 'Half Letter', widthIn: 5.5, heightIn: 8.5 },
  happyPlannerClassic: { name: 'Happy Planner Classic', widthIn: 7, heightIn: 9.25 },
};

// Book cover sizes: front + spine + back (spine width varies by page size)
const COVER_SIZES = {
  letter: { name: 'US Letter Book Cover', widthIn: 17.5, heightIn: 11, baseSize: 'letter', spineIn: 0.5 },
  a4: { name: 'A4 Book Cover', widthIn: 17.04, heightIn: 11.69, baseSize: 'a4', spineIn: 0.5 },
  a5: { name: 'A5 Book Cover', widthIn: 12.035, heightIn: 8.27, baseSize: 'a5', spineIn: 0.375 },
  halfLetter: { name: 'Half Letter Book Cover', widthIn: 11.375, heightIn: 8.5, baseSize: 'halfLetter', spineIn: 0.375 },
  happyPlannerClassic: { name: 'Happy Planner Classic Cover', widthIn: 14.375, heightIn: 9.25, baseSize: 'happyPlannerClassic', spineIn: 0.375 },
};

const SCREEN_DPI = 96;
const PRINT_DPI = 300;

function applyLandscape({ width, height }, isLandscape = false) {
  return isLandscape ? { width: height, height: width } : { width, height };
}

function pageDimsPx(pageSizeKey, dpi = SCREEN_DPI, isLandscape = false) {
  const size = PAGE_SIZES[pageSizeKey] || PAGE_SIZES.letter;
  const dims = {
    width: Math.round(size.widthIn * dpi),
    height: Math.round(size.heightIn * dpi),
  };
  return applyLandscape(dims, isLandscape);
}

function coverDimsPx(coverType, dpi = SCREEN_DPI, isLandscape = false) {
  const size = COVER_SIZES[coverType] || COVER_SIZES.letter;
  const dims = {
    width: Math.round(size.widthIn * dpi),
    height: Math.round(size.heightIn * dpi),
  };
  return applyLandscape(dims, isLandscape);
}

function pageDimsIn(pageSizeKey, isLandscape = false) {
  const size = PAGE_SIZES[pageSizeKey] || PAGE_SIZES.letter;
  return applyLandscape({ width: size.widthIn, height: size.heightIn }, isLandscape);
}

function coverDimsIn(coverType, isLandscape = false) {
  const size = COVER_SIZES[coverType] || COVER_SIZES.letter;
  return applyLandscape({ width: size.widthIn, height: size.heightIn }, isLandscape);
}

const FONT_CHOICES = [
  'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS'
];
