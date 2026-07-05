// Page size definitions in pixels at 96 DPI (screen) — export scales to 300 DPI for print.
const PAGE_SIZES = {
  letter: { name: 'US Letter', widthIn: 8.5, heightIn: 11 },
  a4: { name: 'A4', widthIn: 8.27, heightIn: 11.69 },
  a5: { name: 'A5', widthIn: 5.83, heightIn: 8.27 },
  halfLetter: { name: 'Half Letter', widthIn: 5.5, heightIn: 8.5 },
  happyPlannerClassic: { name: 'Happy Planner Classic', widthIn: 7, heightIn: 9.25 },
};

const SCREEN_DPI = 96;
const PRINT_DPI = 300;

function pageDimsPx(pageSizeKey, dpi = SCREEN_DPI) {
  const size = PAGE_SIZES[pageSizeKey] || PAGE_SIZES.letter;
  return {
    width: Math.round(size.widthIn * dpi),
    height: Math.round(size.heightIn * dpi),
  };
}

const FONT_CHOICES = [
  'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS'
];
