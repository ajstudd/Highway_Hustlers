import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as skeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {WebGLObjects} from 'three/src/renderers/webgl/WebGLObjects.js';
import path from 'node:path';

// Test real local skeletons without a browser image decoder. Material textures
// are irrelevant to anatomical contact and replaced only in this test process.
async function asset(name, folder='ride-actors') {
  const bytes=readFileSync(new URL('../public/'+folder+'/'+name,import.meta.url));
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
  const sandbox={exports:{},console,require:dep=>dep==='three'?THREE:dep.includes('GLTFLoader')?{GLTFLoader:LocalLoader}:dep.includes('SkeletonUtils')?skeletonUtils:load(path.posix.join(path.posix.dirname(name),dep))};
  const source=readFileSync(new URL('../src/components/sunday/'+name+'.ts',import.meta.url),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,sandbox);
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
const hunter=await asset('hunter-350.glb','ride-bikes');
const {createGameRider}=load('game/bike');
for(const female of [true,false]) {
  const rider=createGameRider(hunter.scene,female,'#ce9640','#171b1d');
  rider.setPose(0,0,0,0,.2,10,1,0,2,1,false,undefined,4);
  rider.root.updateMatrixWorld(true);
  for(const [side,joint] of [['Left','RightHand'],['Right','LeftHand']]) {
    let hand;rider.person.group.traverse(o=>{if(o instanceof THREE.Bone && o.name.endsWith(joint)) hand=o;});
    const grip=rider.bike.getObjectByName('Grip'+side).getWorldPosition(new THREE.Vector3());
    const target=grip.clone().add(new THREE.Vector3(0,.025,-.09).applyQuaternion(rider.bike.getObjectByName('Steering').getWorldQuaternion(new THREE.Quaternion())));
    const actual=hand.getWorldPosition(new THREE.Vector3());
    assert.ok(actual.distanceTo(target)<.035,`Hunter mounted ${female?'woman':'man'} ${side} wrist misses by ${actual.distanceTo(target).toFixed(3)} m`);
    let knuckle;rider.person.group.traverse(o=>{if(o instanceof THREE.Bone && o.name.endsWith(joint+'Middle1'))knuckle=o;});
    assert.ok(knuckle.getWorldPosition(new THREE.Vector3()).distanceTo(grip)<.10,'Palm/finger base stays at the actual handlebar, not at an unrelated procedural target');
  }
  const destination=new THREE.Vector3(4,0,3),direction=new THREE.Vector3(4.7,0,3.21).normalize();
  for(let step=1;step<90;step++) {
    const walk=step/90;
    rider.setPose(0,0,0,0,0,10,0,walk,1,step/30,false,destination,0);
    if(step>20) {
      const forward=new THREE.Vector3(0,0,1).applyQuaternion(rider.person.group.quaternion);
      assert.ok(forward.dot(direction)>.96,'Walking riders face the direction of foot travel, not the parked motorcycle heading');
    }
  }
}
console.log('Prepared Hunter: real handlebar/steering contacts verified against both adult skeletons.');

// Exercise the browser's actual per-frame riding path, including every joint.
for(const female of [true,false]) {
  const rider=createGameRider(hunter.scene,female,'#ce9640','#171b1d');
  const joints=[];rider.person.group.traverse(o=>{if(o instanceof THREE.Bone)joints.push(o);});
  const hip=joints.find(j=>/Hips$/.test(j.name));
  const foot=joints.find(j=>/RightFoot$/.test(j.name));
  assert.equal(rider.person.group.parent,rider.bike.parent,'Rider and motorcycle share one rigid lean frame');
  rider.setPose(0,0,0,0,0,0,1,0,2,1,false,undefined,.49);rider.root.updateMatrixWorld(true);
  const slow=foot.getWorldPosition(new THREE.Vector3());
  rider.setPose(0,0,0,0,0,0,1,0,2,1,false,undefined,.51);rider.root.updateMatrixWorld(true);
  assert.ok(slow.distanceTo(foot.getWorldPosition(new THREE.Vector3()))<.02,'Supporting boot lifts continuously');
  let saddleHip,previous;
  for(let frame=0;frame<180;frame++) {
    const t=frame/60,heading=t*.4,bank=.3*Math.sin(t*2),steer=.3*Math.sin(t*2);
    rider.setPose(100+t*4,1000+t*4,heading,bank,steer,t*4,1,0,2,t,false,undefined,4);
    rider.root.updateMatrixWorld(true);
    const current=joints.map(j=>rider.bike.worldToLocal(j.getWorldPosition(new THREE.Vector3())));
    const hipPosition=rider.bike.worldToLocal(hip.getWorldPosition(new THREE.Vector3()));
    if(frame===10)saddleHip=hipPosition;
    if(frame>10) {
      assert.ok(hipPosition.distanceTo(saddleHip)<.0001,'Pelvis must stay locked to the saddle as lean changes');
      for(let j=0;j<joints.length;j++)assert.ok(current[j].distanceTo(previous[j])<.025,`No riding joint may shake between rendered frames: ${joints[j].name}`);
    }
    for(const [side,name] of [['Left','RightHand'],['Right','LeftHand']]) {
      const grip=rider.bike.getObjectByName('Grip'+side).getWorldPosition(new THREE.Vector3());
      const target=grip.add(new THREE.Vector3(0,.025,-.09).applyQuaternion(rider.bike.getObjectByName('Steering').getWorldQuaternion(new THREE.Quaternion())));
      const hand=joints.find(j=>j.name.endsWith(name)).getWorldPosition(new THREE.Vector3());
      assert.ok(hand.distanceTo(target)<.035,`Hands and handlebar use the same rendered frame: ${female?'woman':'man'} frame ${frame} ${side} misses by ${hand.distanceTo(target)} m`);
    }
    previous=current;
  }
  // A constant riding pose must remain identical, including fingers, even as
  // the vehicle travels and turns through world coordinates.
  let baseline;
  for(let frame=0;frame<90;frame++) {
    const t=frame/60;
    rider.setPose(100+t*4,1000+t*4,t*.4,.15,.2,t*4,1,0,2,t,false,undefined,4);
    rider.root.updateMatrixWorld(true);
    const current=joints.map(j=>rider.bike.worldToLocal(j.getWorldPosition(new THREE.Vector3())));
    if(frame===10)baseline=current;
    if(frame>10)for(let j=0;j<joints.length;j++)assert.ok(current[j].distanceTo(baseline[j])<.0001,`Constant riding pose must not oscillate: ${joints[j].name}`);
  }
}
console.log('Riding rig: shared saddle/lean frame, every-frame grip contact, all-joint stability and smooth boot lift passed.');

// CPU joints and getVertexPosition bypass boneMatrices. Reproduce the actual
// WebGLObjects frame cache and compare the palette used by the vertex shader.
const {createSkinPaletteSync}=load('game/skinning');
function paletteVertex(mesh,index) {
  const position=mesh.geometry.attributes.position;
  const skinIndex=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
  const bound=new THREE.Vector4(position.getX(index),position.getY(index),position.getZ(index),1).applyMatrix4(mesh.bindMatrix);
  const skinned=new THREE.Vector4(0,0,0,0),matrix=new THREE.Matrix4();
  for(let i=0;i<4;i++) {
    matrix.fromArray(mesh.skeleton.boneMatrices,skinIndex.getComponent(index,i)*16);
    skinned.add(bound.clone().applyMatrix4(matrix).multiplyScalar(weights.getComponent(index,i)));
  }
  skinned.applyMatrix4(mesh.bindMatrixInverse).applyMatrix4(mesh.matrixWorld);
  return new THREE.Vector3(skinned.x,skinned.y,skinned.z);
}
function renderPaletteRegression(sync) {
  const scene=new THREE.Scene();
  const riders=[true,false].map(female=>createGameRider(hunter.scene,female,'#ce9640','#171b1d'));
  scene.add(...riders.map(r=>r.root));
  if(sync)scene.onBeforeRender=createSkinPaletteSync(riders.map(r=>r.person.group));
  const meshes=[];
  riders.forEach(r=>r.person.group.traverse(mesh=>{
    if(mesh instanceof THREE.SkinnedMesh && mesh.geometry.index?.count) {
      mesh.skeleton.computeBoneTexture();meshes.push(mesh);
    }
  }));
  const samples=meshes.flatMap(mesh=>{
    const indices=mesh.geometry.index,result=[];
    for(let i=0;i<indices.count;i+=Math.max(3,Math.floor(indices.count/45/3)*3))result.push({mesh,index:indices.getX(i)});
    return result;
  });
  const info={render:{frame:0}};
  const objects=WebGLObjects({}, {get:(_object,geometry)=>geometry,update:()=>{}}, {}, {}, info);
  let maxError=0,staleFrames=0;
  for(let frame=0;frame<90;frame++) {
    const t=frame/60;
    riders.forEach((r,i)=>r.setPose(100+t*12+i*3,700+t*12,t*.4,.15*Math.sin(t),.2,t*12,1,0,2,t,false,undefined,12));
    scene.updateMatrixWorld(true);
    const versions=meshes.map(mesh=>mesh.skeleton.boneTexture.version);
    scene.onBeforeRender();
    if(sync)meshes.forEach((mesh,i)=>assert.ok(mesh.skeleton.boneTexture.version>versions[i],'Final pose must also invalidate the GPU bone texture'));
    // Three r186: project main list, increment frame, optionally draw shadows.
    meshes.forEach(mesh=>objects.update(mesh));
    info.render.frame++;
    if(frame%3===0)meshes.forEach(mesh=>objects.update(mesh));
    let error=0;
    for(const {mesh,index} of samples) {
      const expected=mesh.localToWorld(mesh.getVertexPosition(index,new THREE.Vector3()));
      error=Math.max(error,expected.distanceTo(paletteVertex(mesh,index)));
    }
    maxError=Math.max(maxError,error);if(error>.01)staleFrames++;
  }
  objects.dispose();return {maxError,staleFrames};
}
const stale=renderPaletteRegression(false),synchronized=renderPaletteRegression(true);
assert.ok(stale.staleFrames>20 && stale.maxError>.1,'Control must reproduce stale clothing palettes with intermittent shadows');
assert.equal(synchronized.staleFrames,0,'No stale clothing frame with explicit final-pose synchronization');
assert.ok(synchronized.maxError<.0005,`GPU clothing must match the current skeleton, not the previous shadow frame: ${synchronized.maxError}m`);
console.log('GPU clothing palette:',{before:stale,after:synchronized});

if(process.env.RIDE_MESH_DIAGNOSTICS) {
  const rider=createGameRider(hunter.scene,true,'#ce9640','#171b1d');
  const scene=new THREE.Scene();scene.add(rider.root);
  const samples=[];
  rider.person.group.traverse(mesh=>{
    if(!(mesh instanceof THREE.SkinnedMesh)||!mesh.visible||!mesh.geometry.index?.count)return;
    const indices=mesh.geometry.index;
    for(let i=0;i<indices.count;i+=Math.max(3,Math.floor(indices.count/90/3)*3))samples.push({mesh,index:indices.getX(i)});
  });
  let previous,beforePrevious,max=0,beforeMax=0,who='';
  for(let frame=0;frame<90;frame++) {
    const t=frame/60;
    rider.setPose(100+t*12,700+t*12,t*.4,.15,.2,t*12,1,0,2,t,false,undefined,12);
    const before=samples.map(({mesh,index})=>rider.bike.worldToLocal(mesh.localToWorld(mesh.getVertexPosition(index,new THREE.Vector3()))));
    scene.updateMatrixWorld(true);samples.forEach(({mesh})=>mesh.skeleton.update());
    const after=samples.map(({mesh,index})=>rider.bike.worldToLocal(mesh.localToWorld(mesh.getVertexPosition(index,new THREE.Vector3()))));
    if(frame>5)for(let i=0;i<samples.length;i++){
      const d=after[i].distanceTo(previous[i]);if(d>max){max=d;who=samples[i].mesh.name+':'+samples[i].index;}
      beforeMax=Math.max(beforeMax,before[i].distanceTo(beforePrevious[i]));
    }
    previous=after;beforePrevious=before;
  }
  console.log('Rendered clothing vertex drift',{samples:samples.length,max,beforeMax,who});
}
