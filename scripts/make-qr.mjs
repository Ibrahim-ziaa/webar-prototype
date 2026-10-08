// Generate the printable QR code for the menu.
//
//   npm run qr -- --base https://your-site.example.com
//
// Writes qr/menu.png (1200 x 1500 px, about 10 x 12.7 cm at 300 dpi) with the restaurant name.
// Add --dish <id> to also make a code that opens one dish directly (qr/<id>.png).

import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { ROOT, readModels, readRestaurant, parseArgs, escapeHtml } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const base = (args.base || process.env.BASE_URL || '').replace(/\/+$/, '');
if (!/^https:\/\//.test(base)) {
  console.error('Pass the public HTTPS address of the site: npm run qr -- --base https://example.com');
  process.exit(1);
}

const restaurant = readRestaurant();
fs.mkdirSync(path.join(ROOT, 'qr'), { recursive: true });

await makeCode(`${base}/`, 'menu', restaurant.name, 'Scan for our menu. See every dish on your table.');
if (args.dish) {
  const dish = readModels().find((m) => m.id === args.dish);
  if (!dish) throw new Error(`No dish with id "${args.dish}"`);
  await makeCode(`${base}/#${dish.id}`, dish.id, dish.name, 'Scan to see it on your table');
}

async function makeCode(url, fileId, title, subtitle) {
  const qr = await QRCode.toBuffer(url, { width: 1000, margin: 0, errorCorrectionLevel: 'M' });
  const label = Buffer.from(`<svg width="1200" height="360" xmlns="http://www.w3.org/2000/svg">
    <text x="600" y="120" font-family="Georgia, serif" font-size="84" font-weight="bold" text-anchor="middle">${escapeHtml(title)}</text>
    <text x="600" y="215" font-family="Helvetica, Arial, sans-serif" font-size="44" fill="#444" text-anchor="middle">${escapeHtml(subtitle)}</text>
  </svg>`);
  const file = path.join(ROOT, 'qr', `${fileId}.png`);
  await sharp({ create: { width: 1200, height: 1500, channels: 3, background: '#ffffff' } })
    .composite([{ input: qr, top: 100, left: 100 }, { input: label, top: 1120, left: 0 }])
    .png()
    .toFile(file);
  console.log(`${path.relative(ROOT, file)}  ->  ${url}`);
}
