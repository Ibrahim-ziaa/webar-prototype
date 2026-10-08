// Generate the menu (public/index.html) from restaurant.json and models.json.
// One page, one QR code: every dish has a photo and a "See it on your table" button
// that opens the 3D viewer and AR in place.
//
//   npm run build

import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC, MODEL_VIEWER, readModels, readRestaurant, escapeHtml } from './lib.mjs';

const restaurant = readRestaurant();
const models = readModels();

// Per-dish pages from older versions are no longer used.
fs.rmSync(path.join(PUBLIC, 'm'), { recursive: true, force: true });
fs.writeFileSync(path.join(PUBLIC, 'index.html'), menuPage());
console.log(`Built menu with ${models.length} dish(es): public/index.html`);

function size(m) {
  const d = m.dimensionsCm;
  return `${Math.round(d.width)} × ${Math.round(d.depth)} cm, ${Math.round(d.height)} cm tall`;
}

function price(m) {
  return m.price ? `${restaurant.currency} ${m.price.toLocaleString('en-US')}` : '';
}

function dish(m) {
  return `
      <article class="dish" id="${m.id}">
        <button class="photo" data-id="${m.id}" aria-label="See ${escapeHtml(m.name)} in 3D">
          <img src="posters/${m.id}.webp" alt="${escapeHtml(m.name)}" loading="lazy" width="640" height="480">
          <span class="badge">3D · AR</span>
        </button>
        <h3><span>${escapeHtml(m.name)}</span><span class="leader"></span><span class="price">${price(m)}</span></h3>
        <p>${escapeHtml(m.description || '')}</p>
        <button class="see" data-id="${m.id}">See it on your table</button>
      </article>`;
}

function menuPage() {
  const categories = restaurant.categories.filter((c) => models.some((m) => m.category === c));
  const uncategorized = models.filter((m) => !restaurant.categories.includes(m.category));
  if (uncategorized.length) categories.push('More');
  const inCategory = (c) => models.filter((m) => (c === 'More' ? uncategorized.includes(m) : m.category === c));

  const sections = categories.map((c) => `
    <section id="cat-${c.toLowerCase()}">
      <h2>${escapeHtml(c)}</h2>
      <div class="grid">${inCategory(c).map(dish).join('')}
      </div>
    </section>`).join('');

  const data = Object.fromEntries(models.map((m) => [m.id, {
    name: m.name, price: price(m), size: size(m),
    glb: `models/${m.glb}`, usdz: m.usdz ? `models/${m.usdz}` : null, poster: `posters/${m.id}.webp`,
  }]));

  const credits = models.filter((m) => m.credit)
    .map((m) => `${escapeHtml(m.name)}: ${escapeHtml(m.credit.author)} / <a href="${m.credit.url}">${escapeHtml(m.credit.source)}</a> (${m.credit.license})`)
    .join('<br>');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#14110f">
  <link rel="icon" href="data:,">
  <title>${escapeHtml(restaurant.name)} · Menu</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500&display=swap">
  <link rel="stylesheet" href="style.css">
  <script type="module" src="${MODEL_VIEWER}"></script>
</head>
<body>
  <header class="masthead">
    <p class="eyebrow">Menu</p>
    <h1>${escapeHtml(restaurant.name)}</h1>
    <p class="tagline">${escapeHtml(restaurant.tagline)}</p>
    <div class="ornament"><span></span>◆<span></span></div>
    <p class="hint">Tap <em>See it on your table</em> to place any dish in front of you, at its real size.</p>
  </header>

  <nav class="tabs">${categories.map((c) => `<a href="#cat-${c.toLowerCase()}">${escapeHtml(c)}</a>`).join('')}</nav>

  <main>${sections}
  </main>

  <footer>
    <p>Prices in Pakistani Rupees, inclusive of tax.</p>
    <p class="credits">3D scans: ${credits}</p>
  </footer>

  <dialog id="viewer">
    <button class="close" aria-label="Close">✕</button>
    <model-viewer
      ar
      ar-modes="webxr scene-viewer quick-look"
      ar-scale="fixed"
      ar-placement="floor"
      camera-controls
      camera-orbit="25deg 62deg auto"
      touch-action="pan-y"
      shadow-intensity="1"
      environment-image="neutral">
      <button slot="ar-button" class="ar-button">View on your table</button>
    </model-viewer>
    <div class="viewer-info">
      <h3><span id="v-name"></span><span class="price" id="v-price"></span></h3>
      <p id="v-size"></p>
      <p id="v-help" class="warn" hidden>
        AR isn't available in this browser. On Android open this menu in Chrome, on iPhone in Safari.
        In-app browsers (WhatsApp, Instagram) usually block AR. You can still turn the dish around above.
      </p>
    </div>
  </dialog>

  <script>
    const DISHES = ${JSON.stringify(data)};
    const dialog = document.getElementById('viewer');
    const viewer = dialog.querySelector('model-viewer');
    const help = document.getElementById('v-help');

    function open(id) {
      const d = DISHES[id];
      if (!d) return;
      viewer.poster = d.poster;
      if (d.usdz) viewer.setAttribute('ios-src', d.usdz); else viewer.removeAttribute('ios-src');
      viewer.src = d.glb;
      viewer.alt = '3D model of ' + d.name;
      document.getElementById('v-name').textContent = d.name;
      document.getElementById('v-price').textContent = d.price;
      document.getElementById('v-size').textContent = 'Actual size: ' + d.size;
      help.hidden = true;
      dialog.showModal();
      history.replaceState(null, '', '#' + id);
    }

    document.querySelectorAll('.see, .photo').forEach((b) => b.addEventListener('click', () => open(b.dataset.id)));
    dialog.querySelector('.close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => history.replaceState(null, '', location.pathname));
    viewer.addEventListener('load', () => { help.hidden = viewer.canActivateAR; });
    viewer.addEventListener('ar-status', (e) => { if (e.detail.status === 'failed') help.hidden = false; });

    // A link like menu/#carrot-cake opens that dish straight away.
    if (DISHES[location.hash.slice(1)]) open(location.hash.slice(1));
  </script>
</body>
</html>
`;
}
