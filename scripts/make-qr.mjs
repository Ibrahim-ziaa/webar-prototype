// Generate the printable table card with the menu QR code, styled like the menu.
//
//   npm run qr -- --base https://your-site.example.com
//
// Writes:
//   qr/menu-card.pdf   A6 card (105 x 148 mm), ready to print
//   qr/menu-card.png   the same card as an image (1240 x 1748 px, 300 dpi)
//   qr/menu-qr.png     the bare QR code, for a designer or a sticker
// Uses your installed Google Chrome; set CHROME=/path/to/chrome if it lives elsewhere.

import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import puppeteer from 'puppeteer-core';
import { ROOT, readRestaurant, parseArgs, escapeHtml } from './lib.mjs';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const args = parseArgs(process.argv.slice(2));
const base = (args.base || process.env.BASE_URL || '').replace(/\/+$/, '');
if (!/^https:\/\//.test(base)) {
  console.error('Pass the public HTTPS address of the site: npm run qr -- --base https://example.com');
  process.exit(1);
}

const url = `${base}/`;
const restaurant = readRestaurant();
const outDir = path.join(ROOT, 'qr');
fs.mkdirSync(outDir, { recursive: true });

const qrOptions = { margin: 0, errorCorrectionLevel: 'M', color: { dark: '#14110f', light: '#f3ece0' } };
const qrSvg = await QRCode.toString(url, { ...qrOptions, type: 'svg' });
await QRCode.toFile(path.join(outDir, 'menu-qr.png'), url, { ...qrOptions, width: 1200, margin: 2 });

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500&display=swap">
<style>
  @page { size: 105mm 148mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 105mm; height: 148mm; background: #14110f; }
  .card {
    position: relative; width: 105mm; height: 148mm; padding: 9mm 8mm;
    display: flex; flex-direction: column; align-items: center; text-align: center;
    color: #f3ece0; font-family: Inter, sans-serif;
    background: radial-gradient(ellipse at top, rgba(201,164,92,0.16), transparent 65%), #14110f;
  }
  .card::before, .card::after { content: ''; position: absolute; border: 0.3mm solid rgba(201,164,92,0.55); border-radius: 2mm; }
  .card::before { inset: 4mm; }
  .card::after { inset: 5.2mm; border-color: rgba(201,164,92,0.25); }
  .eyebrow { margin-top: 3mm; font-size: 2.6mm; letter-spacing: 0.45em; text-transform: uppercase; color: #c9a45c; }
  h1 { margin: 2.5mm 0 1mm; font: 600 10mm/1.05 'Cormorant Garamond', serif; }
  .tagline { font: italic 500 4.4mm 'Cormorant Garamond', serif; color: #b5aa98; }
  .ornament { display: flex; align-items: center; gap: 2.5mm; width: 40mm; margin: 4.5mm 0; color: #c9a45c; font-size: 2.2mm; }
  .ornament span { flex: 1; height: 0.2mm; background: rgba(201,164,92,0.5); }
  .qr { width: 52mm; height: 52mm; padding: 4mm; background: #f3ece0; border-radius: 3mm; box-shadow: 0 0 0 0.4mm #c9a45c; }
  .qr svg { display: block; width: 100%; height: 100%; }
  .cta { margin-top: 6mm; font: 600 6.2mm 'Cormorant Garamond', serif; }
  .sub { margin-top: 1.5mm; max-width: 70mm; font-size: 2.9mm; line-height: 1.5; color: #b5aa98; }
  .foot { margin-top: auto; font-size: 2.2mm; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(201,164,92,0.8); }
</style></head>
<body><div class="card">
  <div class="eyebrow">Menu</div>
  <h1>${escapeHtml(restaurant.name)}</h1>
  <div class="tagline">${escapeHtml(restaurant.tagline)}</div>
  <div class="ornament"><span></span>◆<span></span></div>
  <div class="qr">${qrSvg}</div>
  <div class="cta">Scan to see our menu</div>
  <div class="sub">Open your camera, point it at the code, and see every dish on your table in 3D, at its real size.</div>
  <div class="foot">No app needed</div>
</div></body></html>`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  const page = await browser.newPage();
  // 105 mm at 96 css px per inch is about 397 px; scale 3.125 gives 300 dpi.
  await page.setViewport({ width: 397, height: 560, deviceScaleFactor: 3.125 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(outDir, 'menu-card.png'), clip: { x: 0, y: 0, width: 397, height: 559 } });
  await page.pdf({ path: path.join(outDir, 'menu-card.pdf'), width: '105mm', height: '148mm', printBackground: true });
} finally {
  await browser.close();
}

for (const f of ['menu-card.pdf', 'menu-card.png', 'menu-qr.png']) console.log(`qr/${f}`);
console.log(`QR opens: ${url}`);
