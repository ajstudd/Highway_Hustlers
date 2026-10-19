// Generic normalization only: no background removal, paint edits or angle synthesis.
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const maxBytes = 20 * 1024 * 1024;
export const loadSharp = packageDir => createRequire(resolve(packageDir, 'package.json'))('sharp');

export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Manifest must be an object');
  const { imageSet, sourcePage, frames, startFrame = 0, lossless = true, curl = false } = manifest;
  if (typeof imageSet !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(imageSet) || imageSet.length > 100) throw new Error('imageSet must be a safe lowercase directory name');
  if (typeof sourcePage !== 'string' || !sourcePage.startsWith('https://')) throw new Error('sourcePage must record the HTTPS source page');
  new URL(sourcePage);
  if (!Array.isArray(frames) || !frames.length || frames.length > 144 || frames.some(f => typeof f !== 'string' || !f.trim())) throw new Error('frames must contain 1–144 ordered URLs or local paths');
  if (!Number.isInteger(startFrame) || startFrame < 0 || startFrame >= frames.length) throw new Error('startFrame must be a valid zero-based index');
  if (typeof lossless !== 'boolean' || typeof curl !== 'boolean') throw new Error('lossless and curl must be booleans');
  return { imageSet, sourcePage, frames, startFrame, lossless, curl };
}

async function readSource(source, baseDir, useCurl) {
  if (source.startsWith('https://')) {
    const url = new URL(source);
    if (url.username || url.password) throw new Error('Do not store credential-bearing URLs in a source manifest');
    if (useCurl) return execFileSync('curl', ['-fLsS', '--max-time', '30', '-A', 'Mozilla/5.0', url.href], { maxBuffer: maxBytes });
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Image download failed (${response.status}): ${url.href}`);
    const chunks = []; let length = 0;
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > maxBytes) throw new Error('Image exceeds 20 MiB');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  if (!isAbsolute(source) && /^[a-z][a-z0-9+.-]*:/i.test(source)) throw new Error('Only HTTPS URLs or local file paths are supported');
  const buffer = await readFile(resolve(baseDir, source));
  if (buffer.length > maxBytes) throw new Error('Image exceeds 20 MiB');
  return buffer;
}

export async function prepareTurntable(manifest, { sharp, baseDir, outputRoot }) {
  const config = validateManifest(manifest), frames = [];
  const sources = [...config.frames.slice(config.startFrame), ...config.frames.slice(0, config.startFrame)];
  for (let first = 0; first < sources.length; first += 4) {
    frames.push(...await Promise.all(sources.slice(first, first + 4).map(async source => {
      const buffer = await readSource(source, baseDir, config.curl);
      const meta = await sharp(buffer, { limitInputPixels: 25_000_000 }).metadata();
      if (!['png', 'webp', 'jpeg', 'avif'].includes(meta.format) || !meta.hasAlpha) throw new Error(`Expected a transparent raster cutout: ${source}`);
      const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let left = info.width, top = info.height, right = -1, bottom = -1, transparent = false;
      for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
        const alpha = data[(y * info.width + x) * 4 + 3];
        if (alpha < 12) { transparent = true; continue; }
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
      if (right < left) throw new Error(`Empty frame: ${source}`);
      if (!transparent) throw new Error(`Opaque background despite alpha channel: ${source}`);
      return { buffer, info, bounds: { left, top, right, bottom }, hash: createHash('sha256').update(data).digest('hex') };
    })));
  }
  if (new Set(frames.map(f => f.hash)).size !== frames.length) throw new Error('Duplicate frames: remove repeated endpoints or verify the source sequence');
  if (frames.some(f => f.info.width !== frames[0].info.width || f.info.height !== frames[0].info.height)) throw new Error('Inconsistent frame canvases; resolve source alignment before processing');
  const box = {
    left: Math.min(...frames.map(f => f.bounds.left)), top: Math.min(...frames.map(f => f.bounds.top)),
    right: Math.max(...frames.map(f => f.bounds.right)), bottom: Math.max(...frames.map(f => f.bounds.bottom)),
  };
  const width = box.right - box.left + 1, height = box.bottom - box.top + 1;
  const scale = Math.min(1080 / width, 640 / height), w = Math.round(width * scale), h = Math.round(height * scale);
  const placement = { left: Math.round((1200 - w) / 2), top: 680 - h };
  const folder = resolve(outputRoot, config.imageSet);
  await mkdir(outputRoot, { recursive: true });
  // Exclusive creation refuses overwriting an existing set, including a symlink.
  await mkdir(folder);
  let bytes = 0;
  for (let i = 0; i < frames.length; i++) {
    const resized = await sharp(frames[i].buffer).extract({ left: box.left, top: box.top, width, height }).resize(w, h).png().toBuffer();
    const result = await sharp({ create: { width: 1200, height: 720, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: resized, ...placement }])
      .webp({ lossless: config.lossless, quality: 90, alphaQuality: 100 })
      .toFile(resolve(folder, `${String(i).padStart(2, '0')}.webp`));
    bytes += result.size;
  }
  return { folder, count: frames.length, sourcePage: config.sourcePage, crop: box, scale, placement, bytes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--help') {
    console.log('Usage: node scripts/prepare-bike-turntable.mjs <manifest.json> <package directory containing sharp> [output root]\nManifest: { imageSet, sourcePage, frames: [HTTPS URLs or local paths], startFrame?: 0, lossless?: true, curl?: false }\nLocal frame paths resolve relative to the manifest. Default output root: public/bikes. Existing sets are never overwritten.\nNormalization only: 1200x720, one shared union crop/scale, fit 1080x640, bottom y=680. No paint edits or background removal.');
  } else {
    try {
      if (!process.argv[2] || !process.argv[3]) throw new Error('Run with --help for manifest and Sharp package arguments');
      const manifestPath = resolve(process.argv[2]);
      const result = await prepareTurntable(JSON.parse(await readFile(manifestPath, 'utf8')), {
        sharp: loadSharp(process.argv[3]), baseDir: dirname(manifestPath), outputRoot: resolve(process.argv[4] || resolve(repoRoot, 'public/bikes')),
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
