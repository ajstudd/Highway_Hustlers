import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { stripRaiderBlueFloor } from './prepare-raider-blue.mjs';
import { loadSharp } from './prepare-bike-turntable.mjs';

const input = Buffer.alloc(100 * 100 * 4);
for (let y = 70; y < 98; y++) for (let x = 0; x < 100; x++) input.set([200, 200, 200, 140], (y * 100 + x) * 4);
for (let y = 10; y < 95; y++) for (let x = 20; x < 45; x++) input.set([35, 40, 90, 255], (y * 100 + x) * 4);
input.set([35, 40, 90, 120], (90 * 100 + 19) * 4);
const output = stripRaiderBlueFloor(input, 100, 100), alpha = (x, y) => output[(y * 100 + x) * 4 + 3];
assert.equal(alpha(80, 90), 0, 'detached studio floor must be removed');
assert.equal(alpha(30, 94), 255, 'tyres must survive below the floor-cleanup threshold');
assert.equal(alpha(19, 90), 120, 'retain original antialiased tyre edges');
assert.equal(input[(90 * 100 + 80) * 4 + 3], 140, 'do not mutate the original');
for (let i = 0; i < input.length; i += 4) assert.deepEqual(output.subarray(i, i + 3), input.subarray(i, i + 3), 'no paint, decal or lighting edits');

if (process.argv[2] && process.argv[3]) {
  const sharp = loadSharp(process.argv[2]), cache = resolve(process.argv[3]);
  const manifest = JSON.parse(await readFile(new URL('./bike-sources/tvs-raider-125-blazing-blue.json', import.meta.url), 'utf8'));
  const frames = [], box = { left: Infinity, top: Infinity, right: -1, bottom: -1 };
  for (let frame = 0; frame < 8; frame++) {
    const { data, info } = await sharp(resolve(cache, `${frame + 1}.webp`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const cleaned = stripRaiderBlueFloor(data, info.width, info.height);
    let removed = 0;
    for (let p = 0; p < info.width * info.height; p++) {
      const i = p * 4;
      assert.deepEqual(cleaned.subarray(i, i + 3), data.subarray(i, i + 3));
      if (data[i + 3] >= 254) assert.equal(cleaned[i + 3], data[i + 3], 'opaque motorcycle silhouette must remain exact');
      if (data[i + 3] && !cleaned[i + 3]) removed++;
      if (cleaned[i + 3] < 12) continue;
      const x = p % info.width, y = Math.floor(p / info.width);
      box.left = Math.min(box.left, x); box.top = Math.min(box.top, y);
      box.right = Math.max(box.right, x); box.bottom = Math.max(box.bottom, y);
    }
    assert.ok(removed > 50, 'floor cleanup should actually remove the studio layer');
    frames.push(await sharp(cleaned, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer());
  }
  const width = box.right - box.left + 1, height = box.bottom - box.top + 1;
  const scale = Math.min(1080 / width, 640 / height), w = Math.round(width * scale), h = Math.round(height * scale);
  for (let frame = 0; frame < 8; frame++) {
    const resized = await sharp(frames[frame]).extract({ left: box.left, top: box.top, width, height }).resize(w, h).png().toBuffer();
    const expected = await sharp({ create: { width: 1200, height: 720, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: resized, left: Math.round((1200 - w) / 2), top: 680 - h }]).raw().toBuffer();
    const actual = await sharp(resolve('public/bikes', manifest.imageSet, `${String(frame).padStart(2, '0')}.webp`)).ensureAlpha().raw().toBuffer();
    for (let i = 0; i < actual.length; i += 4) {
      assert.equal(actual[i + 3], expected[i + 3]);
      if (actual[i + 3]) assert.deepEqual(actual.subarray(i, i + 3), expected.subarray(i, i + 3), 'lossless output must match factory colour and shared fit');
    }
  }
  console.log('Raider: eight factory views retain RGB/opaque geometry and match one shared lossless fit.');
}
console.log('Raider: floor removal, low tyre contour, antialiased edge, original isolation and paint preservation passed.');
