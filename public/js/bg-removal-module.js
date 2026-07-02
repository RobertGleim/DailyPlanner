// This file is a native ES module (loaded via <script type="module">) so it can `import`
// the background-removal library, which ships as an ESM bundle. It exposes a simple
// global (window.BgRemoval) so the rest of the app's plain scripts can call it.
import { removeBackground } from '/vendor/bg-removal/background-removal.mjs';

window.BgRemoval = {
  // dataUrl: a data:image/png;base64,... string (or any Blob/URL the library accepts)
  // Returns an object URL pointing to the cutout PNG (transparent background).
  async removeFromDataUrl(dataUrl, onProgress) {
    const blob = await removeBackground(dataUrl, {
      output: { format: 'image/png', quality: 1 },
      progress: (key, current, total) => {
        if (onProgress) onProgress(key, current, total);
      },
    });
    return URL.createObjectURL(blob);
  },
};
