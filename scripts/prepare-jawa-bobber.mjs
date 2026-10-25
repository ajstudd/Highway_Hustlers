// Source-specific alpha-layer cleanup; never recolours or redraws the bike.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { prepareTurntable, loadSharp } from './prepare-bike-turntable.mjs';

export function stripJawaBobberFloor(input, width, height) {
  const output = Buffer.from(input);
  // OEM bike surfaces are opaque; Jawa's near-white studio floor haze and its
  // contact shadow are translucent and span the whole canvas. Retain every
  // opaque pixel and its original 1px AA edge, at every angle.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (input[i + 3] >= 254) continue;
    let edge = false;
    for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < width && yy >= 0 && yy < height && input[(yy * width + xx) * 4 + 3] >= 254) { edge = true; break; }
    }
    if (!edge) output[i + 3] = 0;
  }
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2] || !process.argv[3]) throw Error('Usage: node scripts/prepare-jawa-bobber.mjs <Sharp package directory> <source cache> [output root]');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const manifest = JSON.parse(await readFile(resolve(root, 'scripts/bike-sources/jawa-42-bobber-black-mirror.json'), 'utf8'));
  const sharp = loadSharp(process.argv[2]), cache = resolve(process.argv[3]), frames = [];
  await mkdir(cache, { recursive: true });
  for (let i = 0; i < manifest.frames.length; i++) {
    const source = resolve(cache, `${i + 1}.png`);
    let buffer;
    try { buffer = await readFile(source); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      buffer = execFileSync('curl', ['-fLsS', '--max-time', '30', '-A', 'Mozilla/5.0', manifest.frames[i]], { maxBuffer: 20 * 1024 * 1024 });
      await writeFile(source, buffer);
    }
    if (!(await sharp(buffer).metadata()).hasAlpha) throw Error(`Expected factory alpha: ${source}`);
    const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const cleaned = resolve(cache, `${i + 1}-cleaned.png`);
    await sharp(stripJawaBobberFloor(data, info.width, info.height), { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(cleaned);
    frames.push(cleaned);
  }
  console.log(JSON.stringify(await prepareTurntable({ ...manifest, frames, curl: false }, {
    sharp, baseDir: cache, outputRoot: resolve(process.argv[4] || resolve(root, 'public/bikes')),
  }), null, 2));
}
