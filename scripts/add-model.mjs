// Convert a scanned model to an optimized GLB at real-world size and register it.
//
//   npm run add-model -- <file> --id <slug> --name "<Display name>" [--height <cm>] [options]
//
// Size (pick ONE, the model is scaled uniformly to match it):
//   --height <cm>  --width <cm>  --depth <cm>
//   (omit all three to keep the size from the file; glTF units are meters)
//
// Options:
//   --texture-size <px>  max texture edge, default 2048
//   --simplify <ratio>   keep this fraction of triangles, e.g. 0.5 (useful for dense scans)
//   --meshopt            use Meshopt instead of Draco (smaller, but see README on Android)
//   --usdz <file>        a hand-made USDZ for iPhone (otherwise model-viewer generates one)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, draco, meshopt } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import obj2gltf from 'obj2gltf';
import { PUBLIC, readModels, writeModels, parseArgs, formatMB } from './lib.mjs';

const TARGET_BYTES = 5 * 1024 * 1024;

const args = parseArgs(process.argv.slice(2));
const input = args._[0];
if (!input || !args.id) {
  console.error('Usage: npm run add-model -- <file> --id <slug> --name "<Name>" [--height <cm>]');
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(args.id)) {
  console.error('--id must be lowercase letters, numbers and dashes (it becomes the URL).');
  process.exit(1);
}

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });

// 1. Load, converting to glTF first if needed.
const ext = path.extname(input).toLowerCase();
// A .gltf keeps its mesh and textures in separate files next to it, so count the whole folder.
const inputBytes = ext === '.gltf'
  ? fs.readdirSync(path.dirname(input), { recursive: true })
      .map((f) => fs.statSync(path.join(path.dirname(input), f)))
      .filter((st) => st.isFile())
      .reduce((sum, st) => sum + st.size, 0)
  : fs.statSync(input).size;
console.log(`Input: ${input} (${formatMB(inputBytes)})`);

let doc;
if (ext === '.glb' || ext === '.gltf') {
  doc = await io.read(input);
} else if (ext === '.obj') {
  const glb = await obj2gltf(input, { binary: true });
  doc = await io.readBinary(new Uint8Array(glb));
} else if (['.fbx', '.usdz', '.usd', '.usdc', '.usda'].includes(ext)) {
  doc = await io.read(convertWithBlender(input));
} else {
  console.error(`Unsupported format: ${ext}`);
  process.exit(1);
}

// 2. Scale to real size and stand the model on its base, centered.
const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
const before = getBounds(scene);
const size = before.max.map((v, i) => v - before.min[i]); // meters: [x=width, y=height, z=depth]

const wanted = [['width', 0], ['height', 1], ['depth', 2]].filter(([k]) => args[k] !== undefined);
if (wanted.length > 1) {
  console.error('Give only one of --width/--height/--depth. The model is scaled uniformly, so one is enough.');
  process.exit(1);
}
let scale = 1;
if (wanted.length === 1) {
  const [key, axis] = wanted[0];
  scale = Number(args[key]) / 100 / size[axis];
} else if (ext !== '.glb' && ext !== '.gltf') {
  console.warn('Warning: OBJ/FBX/USD files often use centimeters or millimeters. Pass --height <cm> to be sure of real size.');
}

const center = [(before.min[0] + before.max[0]) / 2, before.min[1], (before.min[2] + before.max[2]) / 2];
const wrapper = doc.createNode('real_world_scale')
  .setScale([scale, scale, scale])
  .setTranslation(center.map((c) => -c * scale));
for (const child of scene.listChildren()) {
  scene.removeChild(child);
  wrapper.addChild(child);
}
scene.addChild(wrapper);

// 3. Optimize: clean up, resize textures, compress geometry.
const steps = [dedup(), prune(), weld()];
if (args.simplify) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: Number(args.simplify), error: 0.001 }));
const textureSize = Number(args['texture-size'] || 2048);
steps.push(args.meshopt ? meshopt({ encoder: MeshoptEncoder }) : draco());
await doc.transform(...steps);
await compressTextures(doc, textureSize);

// 4. Write the GLB (and copy a USDZ if one was supplied).
const outFile = path.join(PUBLIC, 'models', `${args.id}.glb`);
await io.write(outFile, doc);
const outBytes = fs.statSync(outFile).size;

let usdz = null;
if (args.usdz) {
  usdz = `${args.id}.usdz`;
  fs.copyFileSync(args.usdz, path.join(PUBLIC, 'models', usdz));
}

// 5. Record it and report.
const after = getBounds(scene);
const dimensionsCm = after.max.map((v, i) => Math.round((v - after.min[i]) * 1000) / 10);
// Re-running for an existing id keeps its menu details (category, price, description, credit).
const models = readModels();
const existing = models.find((m) => m.id === args.id);
const entry = {
  ...existing,
  id: args.id,
  name: args.name || existing?.name || args.id,
  glb: `${args.id}.glb`,
  usdz: usdz || existing?.usdz || null,
  dimensionsCm: { width: dimensionsCm[0], height: dimensionsCm[1], depth: dimensionsCm[2] },
};
if (existing) models[models.indexOf(existing)] = entry;
else models.push(entry);
writeModels(models);

console.log(`Output: ${path.relative(process.cwd(), outFile)} (${formatMB(outBytes)})`);
console.log(`Real size: ${dimensionsCm[0]} W x ${dimensionsCm[1]} H x ${dimensionsCm[2]} D cm`);
if (outBytes > TARGET_BYTES) {
  console.log(`Over the 5 MB target. Try --texture-size 1024 and/or --simplify 0.5.`);
} else {
  console.log('Under the 5 MB target.');
}
console.log('Run "npm run build" to regenerate the pages.');

// Resize every texture to fit maxSize. Opaque images become JPEG (much smaller);
// images with real transparency stay PNG so cut-outs keep working.
async function compressTextures(doc, maxSize) {
  for (const texture of doc.getRoot().listTextures()) {
    const image = texture.getImage();
    if (!image) continue;
    const img = sharp(image).resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true });
    const { width, height } = await sharp(image).metadata();
    const { isOpaque } = await sharp(image).stats();
    const [data, mime] = isOpaque
      ? [await img.jpeg({ quality: 85, mozjpeg: true }).toBuffer(), 'image/jpeg']
      : [await img.png({ compressionLevel: 9, palette: false }).toBuffer(), 'image/png'];
    if (data.length < image.length || mime !== texture.getMimeType() || Math.max(width, height) > maxSize) {
      texture.setImage(new Uint8Array(data)).setMimeType(mime);
      const uri = texture.getURI();
      if (uri) texture.setURI(uri.replace(/\.\w+$/, mime === 'image/jpeg' ? '.jpg' : '.png'));
    }
  }
}

function convertWithBlender(file) {
  const candidates = [process.env.BLENDER, 'blender', '/Applications/Blender.app/Contents/MacOS/Blender'].filter(Boolean);
  const blender = candidates.find((b) => {
    try { execFileSync(b, ['--version'], { stdio: 'ignore' }); return true; } catch { return false; }
  });
  if (!blender) {
    console.error(
      `Converting ${path.extname(file)} needs Blender (free), which is not installed.\n` +
      'Easiest fix: export GLB directly from your scanning app (Polycam, Scaniverse, Luma and KIRI all can).\n' +
      'Or install Blender and run again (set BLENDER=/path/to/blender if it is not found).'
    );
    process.exit(1);
  }
  const out = path.join(os.tmpdir(), `webar-${Date.now()}.glb`);
  const py = [
    'import bpy, sys',
    'src, dst = sys.argv[sys.argv.index("--") + 1:]',
    'bpy.ops.wm.read_factory_settings(use_empty=True)',
    'bpy.ops.import_scene.fbx(filepath=src) if src.lower().endswith(".fbx") else bpy.ops.wm.usd_import(filepath=src)',
    'bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB")',
  ].join('\n');
  console.log(`Converting with Blender: ${blender}`);
  execFileSync(blender, ['-b', '--python-expr', py, '--', path.resolve(file), out], { stdio: 'inherit' });
  return out;
}
