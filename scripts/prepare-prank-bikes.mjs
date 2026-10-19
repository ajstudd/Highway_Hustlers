// Download/normalise factory cutouts only. No generated angles or paint edits.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { loadSharp, prepareTurntable } from './prepare-bike-turntable.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [sharpDir, cacheDir, ...names] = process.argv.slice(2);
if (!sharpDir || !cacheDir || !names.length) throw Error('Usage: node scripts/prepare-prank-bikes.mjs <Sharp package directory> <temporary source cache> <manifest names without .json>');
const sharp = loadSharp(sharpDir);
for (const name of names) {
  if (!/^[a-z0-9-]+$/.test(name)) throw Error('Invalid manifest name.');
  const manifest = JSON.parse(await readFile(resolve(root, 'scripts/bike-sources', `${name}.json`), 'utf8'));
  const folder = resolve(cacheDir, manifest.imageSet); await mkdir(folder, { recursive: true });
  const hashes = new Set(), files = [], images = [];
  for (const [index, url] of manifest.frames.entries()) {
    const file = resolve(folder, `source-${createHash('sha256').update(url).digest('hex').slice(0,16)}.png`);
    let bytes;
    try { bytes = await readFile(file); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          bytes = execFileSync('curl', ['-fLsS', '--max-time', '30', '-A', 'Mozilla/5.0', url], { maxBuffer: 20000000 });
          await sharp(bytes).metadata(); // Never cache HTML or error bodies as an image.
          break;
        } catch (error) {
          if (/captcha|just a moment|verify you are human/i.test(bytes?.subarray(0,10000).toString() || '')) throw Error('Source requires an interactive access check. Do not bypass it.');
          if (attempt === 2) throw error;
        }
      }
      await writeFile(file, bytes);
    }
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const hash = createHash('sha256').update(data).digest('hex');
    const duplicate = hashes.has(hash); hashes.add(hash);
    console.log(JSON.stringify({ name, source: index+1, width: info.width, height: info.height, duplicate }));
    images.push({ input: await sharp(bytes).resize(280,180,{fit:'contain',background:'#202020'}).flatten({background:'#202020'}).png().toBuffer(), left: (index%4)*280, top: Math.floor(index/4)*180 });
    if (!duplicate) files.push(file);
  }
  await sharp({ create: {width:1120,height:Math.ceil(images.length/4)*180,channels:3,background:'#202020'} }).composite(images).png().toFile(resolve(folder,'source-contact.png'));
  if (process.env.INSPECT_ONLY === '1') continue;
  const result = await prepareTurntable({ ...manifest, frames: files, startFrame: manifest.startFrame || 0, curl: false }, { sharp, baseDir: folder, outputRoot: resolve(root,'public/bikes') });
  console.log(JSON.stringify(result));
}
