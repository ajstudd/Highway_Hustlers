import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as skeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Test real local skeletons without a browser image decoder. Material textures
// are irrelevant to anatomical contact and replaced only in this test process.
async function asset(name) {
  const bytes=readFileSync(new URL('../public/ride-actors/'+name,import.meta.url));
  const size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size));
  json.materials=json.materials?.map(m=>({name:m.name,doubleSided:m.doubleSided,pbrMetallicRoughness:{metallicFactor:0}}));
  const chunk=Buffer.from(JSON.stringify(json));
  const padded=Buffer.alloc(Math.ceil(chunk.length/4)*4,32);chunk.copy(padded);
  const bin=bytes.subarray(20+size),header=Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length+bin.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const glb=Buffer.concat([header,padded,bin]);
  return new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'');
}
const cache=Object.fromEntries(await Promise.all(['michelle.glb','rider.glb','head.glb'].map(async name=>[name,await asset(name)])));
class LocalLoader {async loadAsync(url){return cache[url.split('/').pop()];}}
THREE.TextureLoader.prototype.loadAsync=async()=>new THREE.Texture();
const modules=new Map();
function load(name) {
  if(modules.has(name))return modules.get(name);
  const sandbox={exports:{},console,require:dep=>dep==='three'?THREE:dep.includes('GLTFLoader')?{GLTFLoader:LocalLoader}:dep.includes('SkeletonUtils')?skeletonUtils:load(dep.replace('./',''))};
  const source=readFileSync(new URL('../src/components/sunday/'+name+'.ts',import.meta.url),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,sandbox);
  modules.set(name,sandbox.exports);return sandbox.exports;
}
const {prepareRideActors,createHuman}=load('humanActors');
await prepareRideActors();
for(const female of [true,false])for(const style of ['roadster','sport','adventure']) {
  const actor=createHuman('#258f9b','#bf9879',female,style);
  assert(actor.applyPose);
  for(const chapter of [0,3,4,5]) {
    actor.applyPose(chapter,6,0,1,false,0);
    actor.group.updateMatrixWorld(true);
    if(chapter===0)actor.group.traverse(o=>{if(/(?:LeftFoot|RightFoot|LeftHand|RightHand)$/.test(o.name)){const point=o.getWorldPosition(new THREE.Vector3());assert(/Left/.test(o.name)?point.x>0:point.x<0,'limbs remain on their anatomical side rather than crossing through the body');}});
    const bounds=new THREE.Box3().setFromObject(actor.group,true),size=bounds.getSize(new THREE.Vector3());
    assert(size.toArray().every(Number.isFinite));
    assert(size.y>(chapter===3?1.2:1.4),'riders retain adult proportions rather than shrinking inside the scene');
    if(chapter!==3)assert(Math.abs(bounds.min.y)<.08,'standing boots remain planted on the ground');
  }
  for(const mounting of [0,.25,.5,.75,1]) {
    actor.applyPose(2,1,0,1,false,mounting);actor.group.updateMatrixWorld(true);
    actor.group.traverse(object=>assert(object.matrixWorld.elements.every(Number.isFinite),'mount and riding transforms stay finite'));
  }
  actor.group.traverse(object=>{
    if(!/(?:RightHand|LeftHand)$/.test(object.name))return;
    const hand=object.getWorldPosition(new THREE.Vector3()),side=/RightHand/.test(object.name)?-1:1,height=style==='sport'?1.23:style==='adventure'?1.49:1.40;
    assert(hand.distanceTo(new THREE.Vector3(side*.39,height,.54))<.045,`mounted grip contact: ${female?'woman':'man'} ${style} ${object.name}: ${hand.toArray().join(',')}`);
  });
}
console.log('Local rider assets: woman and men, adult proportions, all stop poses and planted standing boots passed.');
