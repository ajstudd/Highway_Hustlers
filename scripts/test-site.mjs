import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/data/site.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { RIDERS, LINKS, MANIFESTO, SUNDAY, frameSrc } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
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
for (const rider of RIDERS) await access(new URL(`../public${frameSrc(rider.id, 0)}`, import.meta.url));
const join = await readFile(new URL('../src/components/Join.tsx', import.meta.url), 'utf8');
assert.equal(/whatsapp/i.test(join), false);
assert.equal(join.includes("LINKS.instagram || '#join'"), false);
console.log('Site content: rider ownership, Instagram-only contact, six-stop schedule and bike assets passed.');
