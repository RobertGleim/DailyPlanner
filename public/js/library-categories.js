// Taxonomies for the Asset Library's drill-down navigation (library-panel.js).
// Borders and Backgrounds are seeded with well-formed `url` filenames that
// encode their taxonomy, so those are parsed from the url — NOT the `name`
// field, which has a pre-existing em-dash placement bug for the "Lavender"
// background variant (e.g. "Bevel — Circle Lavender" instead of
// "Bevel Circle — Lavender") that would silently misgroup it if grouped by
// name instead. Icons have no such embedded metadata, so their categories
// are a hand-authored lookup below.

const BORDER_THEMES = {
  baby: 'Baby & Nursery',
  balloons: 'Balloons & Celebration',
  florals: 'Watercolor Florals',
  kids: 'Kids & Playful',
  parent: 'Parent & Family',
  seasonal: 'Seasonal',
  teacher: 'Teacher & School',
  vines: 'Vines & Botanical',
};

const BORDER_STYLES = {
  corner: 'Corner Accent',
  frame: 'Full Frame',
  side: 'Side Border',
  top: 'Top Border',
  topside: 'Top+Side Corner Wrap',
};

const BORDER_STYLE_SLUGS = Object.keys(BORDER_STYLES);

// "/library-files/borders/baby-corner-bottomleft-footprints-bows-03.png"
// -> { themeSlug: 'baby', styleSlug: 'corner' }
function parseBorderUrl(url) {
  const file = url.split('/').pop().replace(/\.png$/, '');
  const parts = file.split('-');
  const themeParts = [];
  let i = 0;
  while (i < parts.length && !BORDER_STYLE_SLUGS.includes(parts[i])) {
    themeParts.push(parts[i]);
    i++;
  }
  return { themeSlug: themeParts.join('-'), styleSlug: parts[i] };
}

const BACKGROUND_MOTIF_LABELS = {
  'bevel-circle': 'Bevel Circle',
  boxes: 'Boxes',
  'circles-and-squares': 'Circles And Squares',
  'diagonal-lines': 'Diagonal Lines',
  'diagonal-stripes': 'Diagonal Stripes',
  'floor-tile': 'Floor Tile',
  'four-point-stars': 'Four Point Stars',
  'graph-paper': 'Graph Paper',
  hexagons: 'Hexagons',
  houndstooth: 'Houndstooth',
  leaf: 'Leaf',
  'overlapping-circles': 'Overlapping Circles',
  'pixel-dots': 'Pixel Dots',
  plus: 'Plus',
  'polka-dots': 'Polka Dots',
  stripes: 'Stripes',
  'tic-tac-toe': 'Tic Tac Toe',
  topography: 'Topography',
  wiggle: 'Wiggle',
  'zig-zag': 'Zig Zag',
};

const BACKGROUND_COLOR_SLUGS = ['blush-pink', 'powder-blue', 'sage-green', 'warm-cream', 'lavender'];

// "/library-files/backgrounds/bg-bevel-circle-blush-pink.png"
// -> { motifSlug: 'bevel-circle' }
function parseBackgroundUrl(url) {
  const file = url.split('/').pop().replace(/\.png$/, '').replace(/^bg-/, '');
  const colorSlug = BACKGROUND_COLOR_SLUGS.find((c) => file.endsWith(c));
  const motifSlug = colorSlug ? file.slice(0, file.length - colorSlug.length - 1) : file;
  return { motifSlug };
}

// Hand-authored grouping — icons carry no category metadata, so every one
// of the 121 preloaded icon names is assigned here. If a new icon is added
// to server/data/library/icons/ without adding it here, it still displays
// fine (unmapped icons fall into an "Other" bucket in library-panel.js)
// but won't be searchable by category until added.
const ICON_CATEGORIES = {
  'Nature & Weather': [
    'Cactus', 'Cloud Rain', 'Cloud', 'Droplet', 'Droplets', 'Feather', 'Fish', 'Flower', 'Leaf',
    'Moon Stars', 'Moon', 'Mountain', 'Paw', 'Plant', 'Rainbow', 'Recycle', 'Seedling', 'Snowflake',
    'Sun High', 'Sun', 'Tree', 'Umbrella', 'Wave Square', 'Wind', 'World',
  ],
  'Food & Drink': ['Apple', 'Bread', 'Cake', 'Cherry', 'Coffee', 'Cup', 'Glass', 'Ice Cream', 'Pizza', 'Salad'],
  'Health & Fitness': [
    'Activity', 'Barbell', 'Bath', 'First Aid Kit', 'Pill', 'Run', 'Stethoscope', 'Swimming', 'Vaccine', 'Wash', 'Yoga',
  ],
  'Study & Planning': [
    'Alarm', 'Backpack', 'Book', 'Bookmark', 'Calendar Event', 'Calendar Star', 'Calendar', 'Clock',
    'Folder', 'Hourglass', 'Notebook', 'Paperclip', 'Pencil',
  ],
  'Travel & Places': ['Anchor', 'Bike', 'Car', 'Compass', 'Map', 'Plane', 'Rocket'],
  'Money & Shopping': ['Briefcase', 'Coin', 'Credit Card', 'Receipt', 'Shopping Bag', 'Shopping Cart', 'Tag', 'Wallet'],
  'Celebration & Mood': [
    'Balloon', 'Candle', 'Confetti', 'Crown', 'Gift', 'Medal', 'Mood Crazy Happy', 'Mood Happy', 'Mood Kid',
    'Mood Sad', 'Mood Smile', 'Mood Wink', 'Sparkles', 'Target', 'Trophy',
  ],
  'Home & Living': ['Bed', 'Home', 'Sofa', 'Vacuum Cleaner'],
  'Symbols & Shapes': [
    'Alert Circle', 'Arrow Right', 'Asterisk', 'Check', 'Checks', 'Chevron Right', 'Circle Check', 'Circle Solid',
    'Circle', 'Diamond', 'Dots', 'Hash', 'Heart Solid', 'Heart', 'Infinity', 'Square Solid', 'Square',
    'Star Solid', 'Star', 'Triangle Solid', 'Triangle', 'X',
  ],
  'Tech & Creative': ['Bulb', 'Camera', 'Mail', 'Music', 'Palette', 'Phone'],
};

const ICON_CATEGORY_LOOKUP = (() => {
  const map = new Map();
  Object.entries(ICON_CATEGORIES).forEach(([category, names]) => {
    names.forEach((name) => map.set(name, category));
  });
  return map;
})();

function iconCategoryOf(name) {
  return ICON_CATEGORY_LOOKUP.get(name) || 'Other';
}
