import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { seedGarage } from '../shared/garage-seed.mjs';
import additions from '../src/data/garage-additions.json' with { type: 'json' };
import { cleanGarage, publicRiders } from '../shared/garage.mjs';
import { loadSharp } from './prepare-bike-turntable.mjs';

const pranjalAssignment = seedGarage.lineup.find(e => e.id === 'pranjal-pulsar-ns125');
assert(pranjalAssignment, 'Pranjal is in the seed lineup'); assert(additions.includes(pranjalAssignment.id), 'Pranjal is offered to existing catalogues');
const pranjalMember = seedGarage.members.find(m => m.id === pranjalAssignment.memberId);
const pranjalBike = seedGarage.bikes.find(b => b.id === pranjalAssignment.bikeId);
const paths = new Set(pranjalBike.frames.map(frame => frame.path));
const garage = cleanGarage({ members: [pranjalMember], bikes: [pranjalBike], lineup: [pranjalAssignment] }, paths);
const [rider] = publicRiders(garage);
assert.equal(rider.name, 'Pranjal Kolhe'); assert.equal(rider.model, 'Pulsar NS125'); assert.equal(rider.colorName, 'Black'); assert.equal(rider.frames, 16);
const sharp = process.argv[2] ? loadSharp(process.argv[2]) : null;
const output = process.argv[3]; if (output) await mkdir(output, { recursive: true });
const hashes = new Set(), contact = [];
for (const [i, frame] of pranjalBike.frames.entries()) {
  const bytes = await readFile(new URL(`../public${frame.path}`, import.meta.url));
  assert.equal(bytes.subarray(8,12).toString(), 'WEBP');
  if (sharp) {
    const meta = await sharp(bytes).metadata(); assert.equal(meta.width, 1200); assert.equal(meta.height, 720); assert(meta.hasAlpha);
    const pixels = await sharp(bytes).ensureAlpha().raw().toBuffer();
    const hash = createHash('sha256').update(pixels).digest('hex'); assert(!hashes.has(hash)); hashes.add(hash);
    let visible = 0, transparent = 0;
    for (let p = 3; p < pixels.length; p += 4) { if (pixels[p] > 12) visible++; else transparent++; }
    assert(visible > 1000 && transparent > 1000);
    if (output) for (const [row, background] of ['#171717', '#eee9df'].entries()) contact.push({ input: await sharp(bytes).resize(300,180).flatten({ background }).png().toBuffer(), left: (i % 4) * 300, top: row * 720 + Math.floor(i / 4) * 180 });
  }
}
if (contact.length) await sharp({ create: { width: 1200, height: 1440, channels: 3, background: '#171717' } }).composite(contact).png().toFile(resolve(output, 'pranjal-ns125-all-angles.png'));
console.log('Pranjal NS125: 16 unique transparent factory views, member assignment and public metadata passed.');
