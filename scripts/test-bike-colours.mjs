import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import ts from 'typescript';
import { recolourBike } from './bike-paint.mjs';
import { stripFactoryStage } from './bike-cutouts.mjs';
import { APACHE_PANELS } from './apache-panels.mjs';
import { APACHE_TITANIUM_IDS, APACHE_TITANIUM_SOURCE, apacheTitaniumUrl } from './apache-titanium-source.mjs';

const source = await readFile(new URL('../src/data/site.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { RIDERS, frameSrc } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const expected = {
  'hunter-350': ['Tokyo Black', 36],
  'apache-rr310': ['Titanium Black', 24],
  'classic-350': ['Gun Grey', 36],
  'xpulse-210': ['Azure Blue', 12],
  'tvs-raider-125': ['Blazing Blue', 8],
  'cb125-hornet': ['Pearl Igneous Black', 24],
  'cb350rs': ['Mat Axis Grey Metallic', 24],
  'speed-400': ['Lava Red Gloss / Storm Grey', 36],
};
for (const [id, [colour, frames]] of Object.entries(expected)) {
  const rider = RIDERS.find(r => r.id === id);
  assert.equal(rider.colorName, colour);
  assert.equal(rider.frames, frames, `${id}: retain complete rotation`);
  assert.ok(rider.imageSet && rider.imageSet !== rider.id, 'new colours cannot use stale cached image paths');
  for (let i = 0; i < frames; i++) await access(new URL(`../public${frameSrc(id, i)}`, import.meta.url));
}
assert.equal(RIDERS.find(r => r.id === 'classic-350').model, 'Classic 350');
const raider = RIDERS.find(r => r.id === 'tvs-raider-125');
assert.equal(raider.name, 'Aryan');
assert.equal(raider.imageSet, 'tvs-raider-125-blazing-blue-v1');
assert.equal(raider.dir, -1); assert.equal(raider.facing, 'right');
const raiderManifest = JSON.parse(await readFile(new URL('./bike-sources/tvs-raider-125-blazing-blue.json', import.meta.url), 'utf8'));
assert.equal(raiderManifest.imageSet, raider.imageSet);
assert.equal(raiderManifest.variant, 'Split Seat');
assert.equal(raiderManifest.frames.length, raider.frames);
for (const [i, url] of raiderManifest.frames.entries()) {
  assert.equal(new URL(url).hostname, 'www.tvsmotor.com');
  assert.ok(url.endsWith(`/Blazing-blue/Blue/Webp/${i + 1}.webp`));
}
const hondaRs = RIDERS.find(r => r.id === 'cb350rs');
assert.equal(hondaRs.imageSet, 'cb350rs-mat-axis-grey-metallic-v1');
assert.equal(hondaRs.dir, 1); assert.equal(hondaRs.facing, 'right');
const hondaRsManifest = JSON.parse(await readFile(new URL('./bike-sources/cb350rs-mat-axis-grey-metallic.json', import.meta.url), 'utf8'));
assert.equal(hondaRsManifest.imageSet, hondaRs.imageSet);
assert.equal(hondaRsManifest.frames.length, hondaRs.frames);
assert.equal(new Set(hondaRsManifest.frames).size, hondaRs.frames);
for (const [i, url] of hondaRsManifest.frames.entries()) {
  assert.equal(new URL(url).hostname, 'edge.sitecorecloud.io');
  assert.ok(url.endsWith(`/Honda-Bigwing_RS_Mat-Axis-Gray-Metallic_360dgr/${i + 1}.png`));
}
const speed = RIDERS.find(r => r.id === 'speed-400');
assert.equal(speed.colorName, 'Lava Red Gloss / Storm Grey');
assert.equal(speed.frames, 36, 'Lava Red must retain the full rotation');
assert.equal(frameSrc(speed.id, 0), '/bikes/speed-400-lava-red-storm-grey-v2/00.webp', 'Lava Red must load the corrected matte, not stale cached v1 edges');
for (const id of ['hunter-350', 'classic-350']) {
  assert.ok(RIDERS.find(r => r.id === id).imageSet.endsWith('-v2'), 'corrected frames must not reuse the initial cached set');
}
const apache = RIDERS.find(r => r.id === 'apache-rr310');
assert.equal(apache.imageSet, 'apache-rr310-titanium-black-factory-v3', 'Apache must use genuine factory images, not the recoloured red set');
assert.equal(apache.dir, 1);
assert.equal(apache.facing, 'right');
assert.equal(new Set(APACHE_TITANIUM_IDS).size, 24, 'all manufacturer angles are unique');
assert.equal(new URL(APACHE_TITANIUM_SOURCE).hostname, 'mexico.tvsmotor.com');
assert.ok(apacheTitaniumUrl(0).includes('/2605884?'), 'right-side factory view starts the rotation');
assert.equal(APACHE_PANELS.length, 24, 'every Apache angle needs a panel tracing');
for (const panel of APACHE_PANELS) for (const points of [panel.tank, panel.frame]) {
  for (const [x, y] of points) assert.ok(x >= 0 && x <= 1200 && y >= 0 && y <= 720);
}

const width = 100, height = 100;
function fixture(colour) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 12; y < 33; y++) for (let x = 30; x < 70; x++) data.set([...colour, 255], (y * width + x) * 4);
  data.set([175, 175, 175, 255], (75 * width + 10) * 4); // unpainted metal
  data.set([190, 157, 70, 255], (50 * width + 90) * 4); // gold fork
  return data;
}
for (const [id, colour] of [['apache-rr310', [200, 40, 50]], ['cb125-hornet', [220, 240, 35]]]) {
  const input = fixture(colour), { data, changed } = recolourBike(input, width, height, id, 0);
  assert.ok(changed > 500);
  for (let i = 3; i < input.length; i += 4) assert.equal(data[i], input[i], 'alpha and silhouette must remain exact');
  for (const [x, y] of [[10, 75], [90, 50], [5, 5]]) {
    const i = (y * width + x) * 4;
    assert.deepEqual(data.subarray(i, i + 4), input.subarray(i, i + 4), 'metal, forks and background stay unchanged');
  }
  const i = (20 * width + 50) * 4;
  assert.ok(Math.max(...data.subarray(i, i + 3)) - Math.min(...data.subarray(i, i + 3)) < 12, 'paint becomes neutral black/grey');
  assert.ok(Math.max(...data.subarray(i, i + 3)) < Math.max(...colour), 'paint retains shaded dark tones');
}

// A tiny disconnected paint highlight must not remain red (the old area cutoff
// skipped these); a hidden tank must never recolour the front fairing grey.
const isolated = Buffer.alloc(width * height * 4);
isolated.set([200, 40, 50, 255], (20 * width + 50) * 4);
const side = recolourBike(isolated, width, height, 'apache-rr310', 0).data;
const front = recolourBike(isolated, width, height, 'apache-rr310', 18).data;
const paintIndex = (20 * width + 50) * 4;
assert.equal(front[paintIndex], front[paintIndex + 1], 'isolated red highlight is neutralised');
assert.ok(side[paintIndex] > front[paintIndex] + 30, 'only the visible tank gets grey paint');
const frameFixture = Buffer.alloc(width * height * 4), frameIndex = (47 * width + 46) * 4;
frameFixture.set([200, 45, 10, 255], frameIndex);
assert.deepEqual(recolourBike(frameFixture, width, height, 'apache-rr310', 0).data, frameFixture, 'red trellis paint stays red');
const glare = Buffer.alloc(width * height * 4), rotorIndex = (68 * width + 20) * 4, upperChrome = (30 * width + 20) * 4;
glare.set([255, 255, 255, 255], rotorIndex);
glare.set([255, 255, 255, 255], upperChrome);
const balanced = recolourBike(glare, width, height, 'apache-rr310', 0).data;
assert.ok(balanced[rotorIndex] < 180, 'overexposed lower-metal reflection no longer flashes white');
assert.equal(balanced[upperChrome], 255, 'upper chrome and decals retain their highlights');

for (const id of ['hunter-350', 'classic-350']) {
  const fw = 120, fh = 100, data = Buffer.alloc(fw * fh * 4);
  // Separate studio floor/plinth and an opaque bike reaching below the old crop.
  for (let y = 60; y < fh; y++) for (let x = 0; x < fw; x++) data.set(id === 'hunter-350' ? [0, 0, 0, 255] : [252, 252, 252, 30], (y * fw + x) * 4);
  for (let y = 10; y < 90; y++) for (let x = 40; x < 80; x++) data.set([40, 40, 40, 255], (y * fw + x) * 4);
  for (let x = 5; x < 115; x++) data.set([0, 0, 0, 255], (95 * fw + x) * 4);
  stripFactoryStage(data, fw, fh, id);
  assert.equal(data[(95 * fw + 10) * 4 + 3], 0, 'detached studio-shadow streak is removed');
  assert.equal(data[(85 * fw + 60) * 4 + 3], 255, 'real tyre below the former fixed cutoff survives');
  assert.equal(data[(80 * fw + 5) * 4 + 3], 0, 'plinth/floor away from the bike is transparent');
}
const anomaly = Buffer.alloc(120 * 100 * 4);
for (let y = 10; y < 96; y++) for (let x = 30; x < 95; x++) anomaly.set([40, 40, 40, 255], (y * 120 + x) * 4);
stripFactoryStage(anomaly, 120, 100, 'classic-350', 21);
assert.equal(anomaly[(91 * 120 + 60) * 4 + 3], 0, 'frame 21 opaque floor between the tyres is removed');
assert.equal(anomaly[(85 * 120 + 32) * 4 + 3], 255, 'frame 21 front tyre survives its traced contour');
assert.equal(anomaly[(90 * 120 + 84) * 4 + 3], 255, 'frame 21 rear tyre survives its traced contour');
console.log('Hero colours: eight colour sets, 200 rotation frames, new Lava Red Speed assets, genuine Honda/TVS manifests, cache revisions and legacy paint/floor regressions passed.');

// Optional full raster audit: pass a Node package directory containing Sharp.
if (process.argv[2]) {
  const sharp = createRequire(resolve(process.argv[2], 'package.json'))('sharp');
  for (const id of Object.keys(expected)) {
    const rider = RIDERS.find(r => r.id === id);
    for (let frame = 0; frame < rider.frames; frame++) {
      const outputPath = new URL(`../public${frameSrc(id, frame)}`, import.meta.url);
      const { data: output, info } = await sharp(outputPath.pathname).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(info.width, 1200);
      assert.equal(info.height, 720);
      if (id !== 'cb125-hornet') continue;
      const inputPath = new URL(`../public/bikes/${id}/${String(frame).padStart(2, '0')}.webp`, import.meta.url);
      const input = await sharp(inputPath.pathname).ensureAlpha().raw().toBuffer();
      const engineered = recolourBike(input, info.width, info.height, id, frame);
      assert.ok(engineered.changed > 800, `${id}/${frame}: paint mask must exist`);
      for (let i = 0; i < output.length; i += 4) {
        assert.equal(output[i + 3], input[i + 3], `${id}/${frame}: silhouette changed`);
        // Encoders can normalise RGB under fully transparent pixels.
        if (output[i + 3]) assert.deepEqual(output.subarray(i, i + 3), engineered.data.subarray(i, i + 3));
      }
    }
  }
  // Reconstruct the shared crop/scale directly from the cached factory pixels.
  // Compare all 24 outputs to prove no paint or decal adaptation was applied.
  const factoryFrames = [], box = { left: Infinity, top: Infinity, right: 0, bottom: 0 };
  for (let frame = 0; frame < apache.frames; frame++) {
    const buffer = await readFile(resolve(tmpdir(), 'hh-bike-colour-source-cache', `${apache.imageSet}-${frame}.png`));
    const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 12) continue;
      box.left = Math.min(box.left, x); box.top = Math.min(box.top, y);
      box.right = Math.max(box.right, x); box.bottom = Math.max(box.bottom, y);
    }
    factoryFrames.push(buffer);
  }
  const width = box.right - box.left + 1, height = box.bottom - box.top + 1;
  const scale = Math.min(1080 / width, 640 / height), w = Math.round(width * scale), h = Math.round(height * scale);
  for (let frame = 0; frame < apache.frames; frame++) {
    const resized = await sharp(factoryFrames[frame]).extract({ left: box.left, top: box.top, width, height }).resize(w, h).png().toBuffer();
    const expected = await sharp({ create: { width: 1200, height: 720, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: resized, left: Math.round((1200 - w) / 2), top: 680 - h }]).raw().toBuffer();
    const actual = await sharp(new URL(`../public${frameSrc(apache.id, frame)}`, import.meta.url).pathname).ensureAlpha().raw().toBuffer();
    for (let i = 0; i < actual.length; i += 4) {
      assert.equal(actual[i + 3], expected[i + 3], `factory Apache/${frame}: alpha changed`);
      if (actual[i + 3]) assert.deepEqual(actual.subarray(i, i + 3), expected.subarray(i, i + 3), `factory Apache/${frame}: source paint/decals changed`);
    }
  }
  console.log('Raster audit: 200 canvases valid; 24 genuine Apache frames match the uniformly resized manufacturer source; 24 engineered CB125 frames retain exact alpha and visible pixels.');
}
