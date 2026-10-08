// Generate public/index.html and one page per model (public/m/<id>/index.html) from models.json.
//
//   npm run build

import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC, readModels, escapeHtml } from './lib.mjs';

const MODEL_VIEWER = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.3.1/model-viewer.min.js';

const models = readModels();

// Remove pages for models that are no longer listed.
fs.rmSync(path.join(PUBLIC, 'm'), { recursive: true, force: true });

for (const m of models) {
  const dir = path.join(PUBLIC, 'm', m.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), modelPage(m));
}
fs.writeFileSync(path.join(PUBLIC, 'index.html'), indexPage(models));
console.log(`Built index + ${models.length} model page(s) in public/`);

function dims(m) {
  const d = m.dimensionsCm;
  return `${d.width} × ${d.height} × ${d.depth} cm`;
}

function modelPage(m) {
  const name = escapeHtml(m.name);
  // Pages live at m/<id>/, so assets are two levels up. Relative paths keep
  // the site working under a sub-path such as username.github.io/repo/.
  const iosSrc = m.usdz ? `\n    ios-src="../../models/${m.usdz}"` : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="data:,">
  <title>${name} in AR</title>
  <link rel="stylesheet" href="../../style.css">
  <script type="module" src="${MODEL_VIEWER}"></script>
</head>
<body>
  <header>
    <a href="../../">← All items</a>
    <h1>${name}</h1>
    <p class="dims">Actual size: ${dims(m)} (W × H × D)</p>
  </header>

  <model-viewer
    src="../../models/${m.glb}"${iosSrc}
    alt="3D model of ${name}"
    ar
    ar-modes="webxr scene-viewer quick-look"
    ar-scale="fixed"
    ar-placement="floor"
    camera-controls
    touch-action="pan-y"
    shadow-intensity="1"
    environment-image="neutral">
    <button slot="ar-button" class="ar-button">View on your table</button>
    <div slot="progress-bar"></div>
  </model-viewer>

  <p id="ar-help" class="help" hidden>
    AR is not available in this browser. On Android open this page in Chrome,
    on iPhone open it in Safari. In-app browsers (WhatsApp, Instagram) often block AR.
  </p>
  <p class="help">Point your camera at a table and move the phone slowly until the item appears.</p>

  <script>
    const viewer = document.querySelector('model-viewer');
    viewer.addEventListener('load', () => {
      document.getElementById('ar-help').hidden = viewer.canActivateAR;
    });
    viewer.addEventListener('ar-status', (e) => {
      if (e.detail.status === 'failed') document.getElementById('ar-help').hidden = false;
    });
  </script>
</body>
</html>
`;
}

function indexPage(models) {
  const items = models.length
    ? models.map((m) => `    <li><a href="m/${m.id}/"><strong>${escapeHtml(m.name)}</strong><span>${dims(m)}</span></a></li>`).join('\n')
    : '    <li>No models yet. Add one with npm run add-model.</li>';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="data:,">
  <title>AR Menu</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <h1>AR Menu</h1>
    <p>Tap an item, then "View on your table".</p>
  </header>
  <ul class="list">
${items}
  </ul>
</body>
</html>
`;
}
