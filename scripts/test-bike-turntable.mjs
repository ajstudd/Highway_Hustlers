import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { prepareTurntable, validateManifest, loadSharp } from './prepare-bike-turntable.mjs';

if (!process.argv[2]) throw new Error('Pass a Node package directory containing sharp');
const sharp = loadSharp(process.argv[2]);
const taskRoot = await mkdtemp(resolve(tmpdir(), 'hh-turntable-test-'));
const sourceRoot = resolve(taskRoot, 'sources'), outputRoot = resolve(taskRoot, 'output');
await mkdir(sourceRoot);
const colors = [[170, 20, 30, 255], [20, 170, 30, 255], [20, 30, 170, 255]];
const sourceBuffers = [];
for (let frame = 0; frame < 3; frame++) {
  const pixels = Buffer.alloc(100 * 80 * 4);
  // Different visible widths on the same stationary source canvas.
  for (let y = 20; y < 60; y++) for (let x = 20 + frame * 10; x < 80 - frame * 10; x++) pixels.set(colors[frame], (y * 100 + x) * 4);
  const path = resolve(sourceRoot, `${frame}.png`);
  await sharp(pixels, { raw: { width: 100, height: 80, channels: 4 } }).png().toFile(path);
  sourceBuffers.push(await readFile(path));
}
const manifest = { imageSet: 'fixture-blue-v1', sourcePage: 'https://manufacturer.example/fixture', frames: ['0.png', '1.png', '2.png'], startFrame: 2 };
const options = { sharp, baseDir: sourceRoot, outputRoot };
const result = await prepareTurntable(manifest, options);
assert.equal(result.count, 3);
assert.deepEqual(result.crop, { left: 20, top: 20, right: 79, bottom: 59 });
assert.equal(result.scale, 16, 'use the shared union, not each frame width');
assert.deepEqual(result.placement, { left: 120, top: 40 });
for (let frame = 0; frame < 3; frame++) {
  const sourceFrame = (frame + 2) % 3;
  const actualPath = resolve(result.folder, `${String(frame).padStart(2, '0')}.webp`);
  const { data: actual, info } = await sharp(actualPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 1200); assert.equal(info.height, 720);
  const input = await sharp(sourceBuffers[sourceFrame]).extract({ left: 20, top: 20, width: 60, height: 40 }).resize(960, 640).png().toBuffer();
  const expected = await sharp({ create: { width: 1200, height: 720, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input, left: 120, top: 40 }]).raw().toBuffer();
  for (let i = 0; i < actual.length; i += 4) {
    assert.equal(actual[i + 3], expected[i + 3], 'lossless alpha survives');
    if (actual[i + 3]) assert.deepEqual(actual.subarray(i, i + 3), expected.subarray(i, i + 3), 'normalized paint pixels remain unchanged');
  }
  assert.deepEqual([...actual.subarray((360 * 1200 + 600) * 4, (360 * 1200 + 600) * 4 + 4)], colors[sourceFrame], 'cyclic start order is preserved');
}
await assert.rejects(prepareTurntable(manifest, options), /EEXIST/, 'never overwrite an existing set');
assert.throws(() => validateManifest({ ...manifest, imageSet: '../escape' }), /safe lowercase/);
assert.throws(() => validateManifest({ ...manifest, startFrame: 3 }), /valid zero-based/);
await assert.rejects(prepareTurntable({ ...manifest, imageSet: 'duplicate-v1', startFrame: 0, frames: ['0.png', '0.png'] }, options), /Duplicate frames/);
await sharp({ create: { width: 100, height: 80, channels: 4, background: '#fff' } }).png().toFile(resolve(sourceRoot, 'opaque.png'));
await assert.rejects(prepareTurntable({ ...manifest, imageSet: 'opaque-v1', frames: ['opaque.png'], startFrame: 0 }, options), /Opaque background/);
await sharp({ create: { width: 100, height: 80, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toFile(resolve(sourceRoot, 'empty.png'));
await assert.rejects(prepareTurntable({ ...manifest, imageSet: 'empty-v1', frames: ['empty.png'], startFrame: 0 }, options), /Empty frame/);
await sharp(sourceBuffers[0]).resize(90, 80).png().toFile(resolve(sourceRoot, 'different-canvas.png'));
await assert.rejects(prepareTurntable({ ...manifest, imageSet: 'mismatch-v1', frames: ['0.png', 'different-canvas.png'], startFrame: 0 }, options), /Inconsistent frame canvases/);
// A real already-approved asset exercises decoding/normalization without network or live-site edits.
const real = await prepareTurntable({ imageSet: 'real-apache-test-v1', sourcePage: 'https://mexico.tvsmotor.com/es/p/our-products/apache-rr-310-mx', frames: [resolve('public/bikes/apache-rr310-titanium-black-factory-v3/00.webp')] }, options);
assert.equal(real.count, 1);
console.log(`Turntable helper passed: real asset, shared fit, cyclic ordering, lossless pixels, duplicate/opaque/empty/canvas validation and overwrite protection. Test artifacts: ${taskRoot}`);
