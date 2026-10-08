// Download a free (CC0) scanned model from Poly Haven into input/<asset>/.
//
//   npm run fetch-polyhaven -- <asset-id>      e.g. carrot_cake
//
// Browse models at https://polyhaven.com/models. The asset id is the last part of the URL.
// Prints the real size Poly Haven lists, to pass to add-model.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs } from './lib.mjs';

const id = parseArgs(process.argv.slice(2))._[0];
if (!id) {
  console.error('Usage: npm run fetch-polyhaven -- <asset-id>');
  process.exit(1);
}

const info = await getJson(`https://api.polyhaven.com/info/${id}`);
const files = await getJson(`https://api.polyhaven.com/files/${id}`);
const gltf = files.gltf?.['2k']?.gltf;
if (!gltf) {
  console.error(`No 2k glTF download for "${id}". Is it a model?`);
  process.exit(1);
}

const dir = path.join(ROOT, 'input', id);
const downloads = [[path.basename(gltf.url), gltf.url], ...Object.entries(gltf.include).map(([p, f]) => [p, f.url])];
for (const [rel, url] of downloads) {
  const dest = path.join(dir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} downloading ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

// Poly Haven lists dimensions in millimeters as [width, depth, height].
const [w, d, h] = (info.dimensions || []).map((mm) => Math.round(mm) / 10);
console.log(`Downloaded "${info.name}" to ${path.relative(ROOT, dir)}/`);
console.log(`Credit: ${Object.keys(info.authors).join(', ')} / Poly Haven (CC0)`);
if (w) console.log(`Real size: ${w} W x ${h} H x ${d} D cm  ->  use --width ${w}`);
console.log(`Next: npm run add-model -- ${path.relative(ROOT, path.join(dir, path.basename(gltf.url)))} --id <slug> --name "<Name>" --width ${w || '<cm>'}`);

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.json();
}
