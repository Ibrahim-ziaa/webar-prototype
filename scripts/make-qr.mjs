// Generate a printable QR code PNG for every model page.
//
//   npm run qr -- --base https://your-site.example.com
//
// Writes qr/<id>.png (1200 x 1400 px, about 10 x 12 cm at 300 dpi) with the item name underneath.

import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { ROOT, readModels, parseArgs, escapeHtml } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const base = (args.base || process.env.BASE_URL || '').replace(/\/+$/, '');
if (!/^https:\/\//.test(base)) {
  console.error('Pass the public HTTPS address of the site: npm run qr -- --base https://example.com');
  process.exit(1);
}

const outDir = path.join(ROOT, 'qr');
fs.mkdirSync(outDir, { recursive: true });

for (const m of readModels()) {
  const url = `${base}/m/${m.id}/`;
  const qr = await QRCode.toBuffer(url, { width: 1000, margin: 0, errorCorrectionLevel: 'M' });
  const label = Buffer.from(`<svg width="1200" height="300" xmlns="http://www.w3.org/2000/svg">
    <text x="600" y="110" font-family="Helvetica, Arial, sans-serif" font-size="80" font-weight="bold" text-anchor="middle">${escapeHtml(m.name)}</text>
    <text x="600" y="200" font-family="Helvetica, Arial, sans-serif" font-size="48" fill="#444" text-anchor="middle">Scan to see it on your table</text>
  </svg>`);

  const file = path.join(outDir, `${m.id}.png`);
  await sharp({ create: { width: 1200, height: 1400, channels: 3, background: '#ffffff' } })
    .composite([{ input: qr, top: 100, left: 100 }, { input: label, top: 1100, left: 0 }])
    .png()
    .toFile(file);
  console.log(`${path.relative(ROOT, file)}  ->  ${url}`);
}
