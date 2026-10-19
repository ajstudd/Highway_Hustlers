import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { loadSharp } from './prepare-bike-turntable.mjs';

const manifest = JSON.parse(await readFile(new URL('./bike-sources/speed-400-lava-red-storm-grey.json', import.meta.url), 'utf8'));
assert.equal(manifest.colour, 'Lava Red Gloss / Storm Grey');
assert.equal(manifest.frames.length, 36);
assert.equal(new Set(manifest.frames).size, 36);
assert.equal(manifest.startFrame, 0);
assert.equal(manifest.imageSet, 'speed-400-lava-red-storm-grey-v2');
for (const url of manifest.frames) assert.equal(new URL(url).hostname, 'cdn.room58.com');

if (process.argv[2] && process.argv[3]) {
  const sharp = loadSharp(process.argv[2]), cache = resolve(process.argv[3]), frames = [];
  const report = JSON.parse(await readFile(resolve(cache, 'matting-report-v2.json'), 'utf8'));
  assert.equal(report.length, 36);
  const box = { left: Infinity, top: Infinity, right: -1, bottom: -1 };
  for (let frame = 0; frame < 36; frame++) {
    const name = String(frame).padStart(2, '0');
    const original = await sharp(resolve(cache, `${name}.jpg`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { data, info } = original;
    const matte = await sharp(resolve(cache, `${name}-cutout-v2.png`)).ensureAlpha().raw().toBuffer();
    const converted = await sharp(resolve(cache, `${name}-srgb.png`)).ensureAlpha().raw().toBuffer();
    assert.deepEqual(converted, data, 'matting input must honour the JPEG colour profile');
    assert.equal(report[frame].sourceSha256, createHash('sha256').update(await readFile(resolve(cache, `${name}-srgb.png`))).digest('hex'));
    assert.equal(report[frame].guideSha256, createHash('sha256').update(await readFile(resolve('public/bikes/speed-400', `${name}.webp`))).digest('hex'));
    assert.ok(report[frame].inliers >= 20, 'every angle needs a valid geometry registration');
    assert.equal(matte.length, data.length);
    assert.equal(matte[3], 0, 'studio exterior must be transparent');
    let opaque = 0, partial = 0;
    for (let p = 0; p < info.width * info.height; p++) {
      const i = p * 4;
      if (matte[i + 3] === 255 && (matte[i] !== data[i] || matte[i + 1] !== data[i + 1] || matte[i + 2] !== data[i + 2])) throw Error(`Paint was edited: frame ${frame}, pixel ${p}`);
      if (matte[i + 3] === 255) opaque++;
      else if (matte[i + 3] > 0) partial++;
      if (matte[i + 3] < 12) continue;
      const x = p % info.width, y = Math.floor(p / info.width);
      box.left = Math.min(box.left, x); box.top = Math.min(box.top, y);
      box.right = Math.max(box.right, x); box.bottom = Math.max(box.bottom, y);
    }
    assert.ok(opaque > 15000, 'do not erase the motorcycle');
    assert.ok(partial > 500, 'fine outlines must have a continuous matte, not a binary threshold');
    if (frame === 0) {
      const alphaAt = (x, y) => matte[(y * info.width + x) * 4 + 3];
      for (const [x, y] of [[580, 208], [575, 212], [616, 124], [620, 130], [571, 227], [537, 238], [763, 367]]) {
        assert.equal(alphaAt(x, y), 255, 'tank highlights, mirror, red/grey panels and spokes must survive');
      }
      assert.equal(alphaAt(280, 407), 0, 'rear spoke opening stays transparent');
    }
    frames.push(await sharp(matte, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer());
  }
  const w = box.right - box.left + 1, h = box.bottom - box.top + 1;
  const scale = Math.min(1080 / w, 640 / h), outW = Math.round(w * scale), outH = Math.round(h * scale);
  for (let frame = 0; frame < 36; frame++) {
    const input = await sharp(frames[frame]).extract({ left: box.left, top: box.top, width: w, height: h }).resize(outW, outH).png().toBuffer();
    const expected = await sharp({ create: { width: 1200, height: 720, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input, left: Math.round((1200 - outW) / 2), top: 680 - outH }]).raw().toBuffer();
    const actual = await sharp(resolve('public/bikes', manifest.imageSet, `${String(frame).padStart(2, '0')}.webp`)).ensureAlpha().raw().toBuffer();
    assert.equal(actual.length, expected.length);
    for (let i = 0; i < actual.length; i += 4) {
      if (actual[i + 3] !== expected[i + 3]) throw Error(`Alpha mismatch in frame ${frame}`);
      if (actual[i + 3] && (actual[i] !== expected[i] || actual[i + 1] !== expected[i + 1] || actual[i + 2] !== expected[i + 2])) throw Error(`Source pixels changed in frame ${frame}`);
    }
  }
  console.log('Lava Red: all 36 source/guide hashes, profile conversion, opaque paint, soft edges, highlight/spoke regressions and shared-fit outputs passed.');
}
console.log('Lava Red: corrected v2 matte and ordered 36-frame provenance checks passed.');
