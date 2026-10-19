import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { prepareTurntable, loadSharp } from './prepare-bike-turntable.mjs';

if (!process.argv[2] || !process.argv[4]) throw Error('Usage: node scripts/prepare-speed-lava.mjs <Sharp package directory> <source cache> <Python executable> [isolated Python package directories...]');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(resolve(root, 'scripts/bike-sources/speed-400-lava-red-storm-grey.json'), 'utf8'));
const sharp = loadSharp(process.argv[2]);
const cache = resolve(process.argv[3] || resolve(tmpdir(), 'hh-speed-lava-source-cache'));
await mkdir(cache, { recursive: true });
for (let i = 0; i < manifest.frames.length; i++) {
  const name = String(i).padStart(2, '0'), jpg = resolve(cache, `${name}.jpg`);
  let buffer;
  try { buffer = await readFile(jpg); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    buffer = execFileSync('curl', ['-fLsS', '--max-time', '30', manifest.frames[i]], { maxBuffer: 20 * 1024 * 1024 });
    await writeFile(jpg, buffer);
  }
  // Honour the JPEG's embedded Display profile before geometry/matting work.
  await sharp(buffer).png().toFile(resolve(cache, `${name}-srgb.png`));
}
execFileSync(process.argv[4], [resolve(root, 'scripts/matte-speed-lava.py'), cache,
  resolve(root, 'public/bikes/speed-400'), ...process.argv.slice(5)], { stdio: 'inherit' });
const frames = manifest.frames.map((_, i) => resolve(cache, `${String(i).padStart(2, '0')}-cutout-v2.png`));
console.log(JSON.stringify(await prepareTurntable({ ...manifest, frames, curl: false }, {
  sharp, baseDir: cache, outputRoot: resolve(root, 'public/bikes'),
}), null, 2));
