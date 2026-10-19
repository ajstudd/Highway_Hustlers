import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';
import { cleanGarage, publicRiders } from '../shared/garage.mjs';

const source = await readFile(new URL('../src/data/site.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { RIDERS, LINKS, MANIFESTO, SUNDAY, frameSrc } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const seed = JSON.parse(await readFile(new URL('../src/data/garage-seed.json', import.meta.url), 'utf8'));
const seedPaths = new Set(RIDERS.flatMap(r => Array.from({ length: r.frames }, (_, i) => frameSrc(r.id, i))));
const seededRiders = publicRiders(cleanGarage(seed, seedPaths));
assert.deepEqual(seededRiders, RIDERS.map(r => ({
  id: r.id, name: r.name, ...(r.role ? { role: r.role } : {}), ...(r.line ? { line: r.line } : {}),
  brand: r.brand, model: r.model, cc: r.cc, character: r.character, colorName: r.colorName,
  glow: r.glow, dir: r.dir, facing: r.facing, frames: r.frames,
  frameAssets: Array.from({ length: r.frames }, (_, i) => ({ source: 'local', path: frameSrc(r.id, i), width: 1200, height: 720 })),
})), 'Keep the new-database garage seed synchronized with the checked-in hero catalogue. Existing CMS drafts are managed separately.');
assert.equal(RIDERS.find(r => r.id === 'ninja-300').name, 'Junaid K');
assert.equal(RIDERS.find(r => r.id === 'pulsar-n250').name, 'Junaid A');
assert.equal(RIDERS.find(r => r.id === 'yamaha-r15m').name, 'Junaid A');
assert.equal(RIDERS.filter(r => r.name === 'Junaid A').length, 2);
assert.equal(RIDERS.filter(r => r.name === 'Junaid K').length, 1);
assert.equal(RIDERS.some(r => r.name === 'Junaid'), false);
assert.equal(LINKS.instagram, 'https://instagram.com/hhr_bhopal_');
assert.equal('whatsapp' in LINKS, false);
assert.equal(MANIFESTO.includes('We are not a racing club'), false);
for (const phrase of ['each other’s company', 'No ego, no jealousy', 'everyone is welcome', 'Ride kind, ride chill', 'treat every rider like one of our own']) {
  assert.ok(MANIFESTO.includes(phrase), `Preserve the club culture: ${phrase}`);
}
assert.deepEqual(SUNDAY.map(s => s.time), ['05:30', '06:00', '06:30', '08:00', '10:00', '11:30']);
assert.equal(new Set(RIDERS.map(r => r.id)).size, RIDERS.length, 'each rider entry needs a unique id');
for (const rider of RIDERS) {
  assert.ok(Number.isInteger(rider.frames) && rider.frames > 0, `${rider.id}: positive integer frame count`);
  assert.ok([1, -1].includes(rider.dir), `${rider.id}: valid rotation direction`);
  assert.ok(['left', 'right'].includes(rider.facing), `${rider.id}: valid opening direction`);
  assert.match(rider.imageSet ?? rider.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'frame directories cannot escape public/bikes');
  for (let frame = 0; frame < rider.frames; frame++) await access(new URL(`../public${frameSrc(rider.id, frame)}`, import.meta.url));
}
const join = await readFile(new URL('../src/components/Join.tsx', import.meta.url), 'utf8');
assert.equal(/whatsapp/i.test(join), false);
assert.equal(join.includes("LINKS.instagram || '#join'"), false);
console.log('Site content: rider ownership, Instagram-only contact, six-stop schedule and bike assets passed.');
