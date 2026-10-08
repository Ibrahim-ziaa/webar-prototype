// Render a thumbnail of every model for the menu cards (public/posters/<id>.webp).
// Uses your installed Google Chrome; set CHROME=/path/to/chrome if it lives elsewhere.
//
//   npm run posters

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { ROOT, PUBLIC, MODEL_VIEWER, readModels } from './lib.mjs';

const PORT = 8097;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const outDir = path.join(PUBLIC, 'posters');
fs.mkdirSync(outDir, { recursive: true });

const server = spawn(process.execPath, [path.join(ROOT, 'scripts/serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });
  await page.goto(`http://localhost:${PORT}/`); // same origin as the models, so they load
  for (const m of readModels()) {
    await page.setContent(`
      <script type="module" src="${MODEL_VIEWER}"></script>
      <style>body { margin: 0; } model-viewer { width: 800px; height: 600px; }</style>
      <model-viewer src="/models/${m.glb}" camera-orbit="25deg 62deg auto"
        shadow-intensity="1" environment-image="neutral" interaction-prompt="none"></model-viewer>`);
    const png = await page.evaluate(() => new Promise((resolve, reject) => {
      const v = document.querySelector('model-viewer');
      const shoot = () => requestAnimationFrame(() => requestAnimationFrame(async () => {
        const blob = await v.toBlob({ mimeType: 'image/png' });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        resolve(Array.from(bytes));
      }));
      v.addEventListener('poster-dismissed', shoot, { once: true });
      v.addEventListener('error', (e) => reject(new Error(JSON.stringify(e.detail))));
      setTimeout(() => reject(new Error('timed out loading model')), 60000);
    }));
    const file = path.join(outDir, `${m.id}.webp`);
    await sharp(Buffer.from(png)).trim().resize(640, 480, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 82 }).toFile(file);
    console.log(`${path.relative(ROOT, file)} (${Math.round(fs.statSync(file).size / 1024)} KB)`);
  }
} finally {
  await browser.close();
  server.kill();
}
