import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { seedGarage, localFramePaths, offerDraftBikes, offerNewRiders } from '../shared/garage-seed.mjs';
import { cleanGarage, publicRiders } from '../shared/garage.mjs';
import { loadSharp } from './prepare-bike-turntable.mjs';

const base = JSON.parse(await readFile(new URL('../src/data/garage-seed.json', import.meta.url),'utf8'));
const offered = offerDraftBikes(base);
assert.equal(base.bikes.length,12); assert.equal(offered.bikes.length,15);
assert.deepEqual(offered.members,base.members); assert.deepEqual(offered.lineup,base.lineup);
assert.deepEqual(publicRiders(offered),publicRiders(base),'adding draft bikes must not change the public hero');
assert.equal(offerDraftBikes(offered),offered,'reopening must not duplicate catalogue entries');
const edited = structuredClone(offered); edited.bikes.find(b => b.id === 'honda-navi').status = 'hidden';
assert.equal(offerDraftBikes(edited).bikes.find(b => b.id === 'honda-navi').status,'hidden','preserve saved edits');
// A catalogue saved before Jasmine was added is offered her member, bike and hero entry.
const before = structuredClone(base);
before.members = before.members.filter(m => m.id !== 'jasmine'); before.bikes = before.bikes.filter(b => b.id !== 'jawa-42-bobber'); before.lineup = before.lineup.filter(e => e.id !== 'jawa-42-bobber');
const withJasmine = offerNewRiders(before);
assert.deepEqual(cleanGarage(withJasmine,localFramePaths),cleanGarage(base,localFramePaths));
assert.equal(publicRiders(withJasmine).at(-1).name,'Jasmine');
assert.equal(offerNewRiders(withJasmine),withJasmine,'reopening must not duplicate new riders');
assert.equal(offerNewRiders(base),base);
const renamed = structuredClone(base); renamed.bikes.find(b => b.id === 'jawa-42-bobber').colorName = 'Edited'; renamed.lineup = renamed.lineup.filter(e => e.id !== 'jawa-42-bobber');
assert.equal(offerNewRiders(renamed),renamed,'an existing bike is never replaced or re-entered');
const reassigned = structuredClone(before); reassigned.members.push({ ...seedGarage.members.find(m => m.id === 'jasmine'), role: 'Saved role' });
assert.equal(offerNewRiders(reassigned).members.find(m => m.id === 'jasmine').role,'Saved role','preserve a saved member');
const presets = seedGarage.bikes.filter(b => ['tvs-xl100','honda-navi','honda-monkey'].includes(b.id));
assert.equal(presets.length,3); assert(presets.every(b => b.status === 'draft'));
assert.equal(presets.find(b => b.id === 'honda-monkey').frames.length,0,'Monkey stays pending, never fake 360 or unapproved tilt');
const invalid = structuredClone(seedGarage); invalid.bikes.find(b => b.id === 'honda-monkey').status = 'published';
assert.throws(() => cleanGarage(invalid,localFramePaths),'an image-less pending bike cannot be published');
const sharp = process.argv[2] ? loadSharp(process.argv[2]) : null;
if (process.argv[3]) await mkdir(process.argv[3],{recursive:true});
for (const bike of presets.filter(b => b.frames.length)) {
  assert.equal(bike.frames.length,8);
  const hashes = new Set(), contact = [];
  for (const [i,frame] of bike.frames.entries()) {
    const file = new URL(`../public${frame.path}`,import.meta.url), bytes = await readFile(file);
    assert.equal(bytes.subarray(8,12).toString(),'WEBP');
    if (sharp) {
      const meta = await sharp(bytes).metadata(); assert.equal(meta.width,1200); assert.equal(meta.height,720); assert(meta.hasAlpha);
      const pixels = await sharp(bytes).ensureAlpha().raw().toBuffer();
      const hash = createHash('sha256').update(pixels).digest('hex'); assert(!hashes.has(hash)); hashes.add(hash);
      let visible=0,transparent=0;
      for(let p=3;p<pixels.length;p+=4){ if(pixels[p]>12)visible++;else transparent++; }
      assert(visible>1000 && transparent>1000);
      if(process.argv[3]) for(const [row,bg] of ['#171717','#eee9df'].entries()) contact.push({ input:await sharp(bytes).resize(300,180).flatten({background:bg}).png().toBuffer(),left:(i%4)*300,top:row*360+Math.floor(i/4)*180 });
    }
  }
  if(contact.length) await sharp({create:{width:1200,height:720,channels:3,background:'#171717'}}).composite(contact).png().toFile(resolve(process.argv[3],`${bike.id}-all-angles.png`));
}
console.log('Prank catalogue: two eight-view factory rotations, pending Monkey, no invented members, draft-only visibility, existing edits preserved, duplicate prevention and local frames passed.');
