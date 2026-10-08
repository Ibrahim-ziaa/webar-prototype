// Shared helpers for the build scripts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLIC = path.join(ROOT, 'public');
const MODELS_JSON = path.join(ROOT, 'models.json');

export function readModels() {
  return JSON.parse(fs.readFileSync(MODELS_JSON, 'utf8'));
}

export function writeModels(models) {
  fs.writeFileSync(MODELS_JSON, JSON.stringify(models, null, 2) + '\n');
}

// Tiny "--key value" / "--flag" parser. Positional args land in _.
export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { args._.push(a); continue; }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else { args[key] = next; i++; }
  }
  return args;
}

export function formatMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export const MODEL_VIEWER = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.3.1/model-viewer.min.js';

export function readRestaurant() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'restaurant.json'), 'utf8'));
}
