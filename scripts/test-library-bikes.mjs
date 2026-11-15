import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {seedGarage,offerDraftBikes} from '../shared/garage-seed.mjs';
import {publicRiders} from '../shared/garage.mjs';
const cases=[['honda-cbr650r','honda-cbr650r-grand-prix-red',36],['ducati-panigale-v4r','ducati-panigale-v4r-r-livery',18],['pulsar-n250-2023','pulsar-n250-2023-brooklyn-black',8]];
const base=JSON.parse(await readFile(new URL('../src/data/garage-seed.json',import.meta.url),'utf8'));
const offered=offerDraftBikes(base);assert.deepEqual(publicRiders(offered),publicRiders(base));assert.deepEqual(offered.lineup,base.lineup);assert.deepEqual(offered.members,base.members);assert.equal(offerDraftBikes(offered),offered);
for(const [id,name,count]of cases){
  const bike=seedGarage.bikes.find(b=>b.id===id);assert(bike);assert.equal(bike.status,'draft');assert.equal(bike.frames.length,count);assert.equal(bike.dir,-1);assert.equal(bike.facing,'right');
  const manifest=JSON.parse(await readFile(new URL(`./bike-sources/${name}.json`,import.meta.url),'utf8'));assert.equal(manifest.frames.length,count);assert.equal(new Set(manifest.frames).size,count);
  const hashes=new Set();for(const frame of bike.frames){const bytes=await readFile(new URL(`../public${frame.path}`,import.meta.url));hashes.add(createHash('sha256').update(bytes).digest('hex'));const meta=await sharp(bytes).metadata();assert.equal(meta.width,1200);assert.equal(meta.height,720);assert(meta.hasAlpha);const {data}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});let bottom=0;for(let y=0;y<720;y++)for(let x=0;x<1200;x++){const a=data[(y*1200+x)*4+3];if(a>200)bottom=Math.max(bottom,y);if((y===0||y===719||x===0||x===1199)&&a>0)throw Error(`${id} touches canvas edge`);}assert(bottom<=681&&bottom>560);}
  assert.equal(hashes.size,count,'no duplicate or fabricated repeated frames');
  const edited=structuredClone(offered);edited.bikes.find(b=>b.id===id).status='hidden';assert.equal(offerDraftBikes(edited).bikes.find(b=>b.id===id).status,'hidden');
}
assert.equal(base.bikes.find(b=>b.id==='pulsar-n250').model,'Pulsar N250','existing N250 is unchanged');
console.log('Library bikes: genuine 36/18/8-view manifests, complete transparent canvases, unique frames, draft-only visibility, preserved assignments and idempotent offers passed.');
