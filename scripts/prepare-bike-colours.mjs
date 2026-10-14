// Official colour assets and deterministic paint-panel processing for the hero.
// Usage: node scripts/prepare-bike-colours.mjs <Node package directory containing sharp>
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { recolourBike } from './bike-paint.mjs';
import { stripFactoryStage } from './bike-cutouts.mjs';
import { apacheTitaniumUrl } from './apache-titanium-source.mjs';

const require = createRequire(resolve(process.argv[2] || '.', 'package.json'));
const sharp = require('sharp');
const selected = process.argv.slice(3);
const sourceCache = resolve(tmpdir(), 'hh-bike-colour-source-cache');
await mkdir(sourceCache, { recursive: true });
const sets = [
  { id: 'apache-rr310', folder: 'apache-rr310-titanium-black-factory-v3', count: 24, url: apacheTitaniumUrl, curl: true, lossless: true },
  { id: 'hunter-350', folder: 'hunter-350-tokyo-black-v2', count: 36, url: i => `https://www.royalenfield.com/content/dam/royal-enfield/motorcycles/hunter/colors/tokyo-black/tokyo-black${i + 1}.png` },
  { id: 'classic-350', folder: 'classic-350-gun-grey-v2', count: 36, url: i => `https://www.royalenfield.com/content/dam/royal-enfield/motorcycles/new-classic-350/revamp/colors/gun-grey/gun-grey${i + 1}.png` },
  { id: 'xpulse-210', folder: 'xpulse-210-azure-blue', count: 12, url: i => `https://www.heromotocorp.com/content/dam/hero-commerce/in/en/products/performance/xpulse-210/HXPLBTDSSFIABL/360/${i + 1}.png` },
  { id: 'tvs-raider-125', folder: 'tvs-raider-125-black-panther', count: 8, url: i => `https://www.tvsmotor.com/tvs-raider/-/media/Brand-Pages-Webp/Raider/Raider-360/360-raider/SSE/SSE-Webpp/Black-Panther/${i + 1}.webp`, curl: true },
];

async function download(url, curl = false) {
  if (curl) return execFileSync('curl', ['-fLsS', '--max-time', '30', '-A', 'Mozilla/5.0', url], { maxBuffer: 10 * 1024 * 1024 });
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function alphaBounds(data, width, height) {
  let left = width, top = height, right = 0, bottom = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] < 12) continue;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  if (right <= left || bottom <= top) throw new Error('Empty bike image');
  return { left, top, right, bottom };
}

for (const set of sets) {
  if (selected.length && !selected.includes(set.id)) continue;
  const frames = [];
  // Bounded downloads avoid overwhelming the manufacturer servers.
  for (let i = 0; i < set.count; i += 4) {
    frames.push(...await Promise.all(Array.from({ length: Math.min(4, set.count - i) }, async (_, n) => {
      const cachePath = resolve(sourceCache, `${set.folder}-${i + n}.png`);
      let buffer;
      try { buffer = await readFile(cachePath); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        buffer = await download(set.url(i + n), set.curl);
        await sharp(buffer).png().toFile(cachePath);
      }
      const meta = await sharp(buffer).metadata();
      if (!meta.hasAlpha) throw new Error(`Expected a transparent manufacturer cutout: ${set.url(i + n)}`);
      const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      stripFactoryStage(data, info.width, info.height, set.id, i + n);
      const cleaned = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
      return { buffer: cleaned, info, bounds: alphaBounds(data, info.width, info.height) };
    })));
  }
  const [first] = frames;
  if (frames.some(f => f.info.width !== first.info.width || f.info.height !== first.info.height)) throw new Error(`Inconsistent frame canvases: ${set.id}`);
  // One union crop/scale for the complete turntable; never fit each angle separately.
  const box = { left: Math.min(...frames.map(f => f.bounds.left)), top: Math.min(...frames.map(f => f.bounds.top)), right: Math.max(...frames.map(f => f.bounds.right)), bottom: Math.max(...frames.map(f => f.bounds.bottom)) };
  const width = box.right - box.left + 1, height = box.bottom - box.top + 1;
  const scale = Math.min(1080 / width, 640 / height);
  const w = Math.round(width * scale), h = Math.round(height * scale);
  const folder = `public/bikes/${set.folder}`;
  await mkdir(folder, { recursive: true });
  for (let i = 0; i < frames.length; i++) {
    const resized = await sharp(frames[i].buffer).extract({ left: box.left, top: box.top, width, height }).resize(w, h).png().toBuffer();
    await sharp({ create: { width: 1200, height: 720, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: resized, left: Math.round((1200 - w) / 2), top: 680 - h }])
      .webp({ quality: 87, alphaQuality: 100, lossless: set.lossless ?? false }).toFile(`${folder}/${String(i).padStart(2, '0')}.webp`);
  }
  console.log(`${set.id}: ${frames.length} official colour frames prepared`);
}

for (const [id, colour] of [['cb125-hornet', 'pearl-igneous-black']]) {
  if (selected.length && !selected.includes(id)) continue;
  const folder = `public/bikes/${id}-${colour}`;
  await mkdir(folder, { recursive: true });
  for (let frame = 0; frame < 24; frame++) {
    const name = `${String(frame).padStart(2, '0')}.webp`;
    const { data, info } = await sharp(`public/bikes/${id}/${name}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const result = recolourBike(data, info.width, info.height, id, frame);
    if (result.changed < 800) throw new Error(`Paint mask missing: ${id} frame ${frame}`);
    // Lossless output keeps every unmasked pixel and the complete alpha channel exact.
    await sharp(result.data, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ lossless: true, effort: 4 }).toFile(`${folder}/${name}`);
  }
  console.log(`${id}: 24 pixel-aligned engineered colour frames prepared`);
}
