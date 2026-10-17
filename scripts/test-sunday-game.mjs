import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
const cache = new Map();
function load(path) {
  const url = new URL(path, import.meta.url);
  if (cache.has(url.href)) return cache.get(url.href);
  const sandbox = { exports: {}, require: name => name === 'three' ? THREE : name.endsWith('.json') ? JSON.parse(readFileSync(new URL(name, url), 'utf8')) : load(new URL(name + '.ts', url).href) };
  vm.runInNewContext(ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, sandbox);
  cache.set(url.href, sandbox.exports); return sandbox.exports;
}
const game = load('../src/components/sunday/game/controller.ts'), route = load('../src/components/sunday/game/route.ts');
const companions = load('../src/components/sunday/game/companions.ts');
const idle = { throttle: 0, brake: 0, steer: 0 };
for(let d=2;d<route.routeLength-2;d+=2.137) {
  const p=route.sampleRoad(d),projected=route.nearestRoad(p.x,p.z,d);
  assert.ok(Math.abs(projected.distance-d)<.001,'Route projection is continuous, including between metre samples');
  assert.ok(projected.away<.001,'The minimap and driving controller share the same road centre');
  const xy=route.mapPoint(p.x,p.z);
  assert.ok(xy[0]>=15&&xy[0]<=185&&xy[1]>=15&&xy[1]<=149,'The whole loop stays inside the minimap');
}
const state = game.createGame(); state.ready = true;
assert.equal(state.phase, 'garage'); assert.equal(game.act(state), true);
for (let i = 0; i < 240; i++) game.advanceGame(state, idle, 1 / 60);
assert.equal(state.speed, 0, 'Chassis stays still during helmet/mount choreography');
for (let i = 0; i < 600; i++) game.advanceGame(state, idle, 1 / 60);
assert.equal(state.phase, 'ride'); assert.equal(state.chapter, 1);
const before = state.distance;
for (let i = 0; i < 300; i++) game.advanceGame(state, { ...idle, throttle: 1 }, 1 / 60);
assert.ok(state.distance > before + 20, 'Throttle moves the bike through the real road world');
const moving = { x: state.x, z: state.z };
state.paused = true;
for (let i = 0; i < 300; i++) game.advanceGame(state, { ...idle, throttle: 1 }, 1 / 60);
assert.equal(state.x, moving.x); assert.equal(state.z, moving.z);
state.paused = false;
assert.equal(game.act(state), false, 'E cannot finish a checkpoint from the open road');
for (let i = 0; i < 180; i++) game.advanceGame(state, { ...idle, brake: 1 }, 1 / 60);
assert.equal(state.speed, 0, 'Braking reaches zero');
game.recover(state); assert.equal(state.speed, 0);

// Use the actual chase-camera screen basis, not world X: +Z faces the camera
// away from us, so its right-hand screen direction is local -X.
for (const assist of [false,true]) for (const heading of [0, Math.PI/2, Math.PI, -Math.PI/2]) for (const direction of [-1,1]) {
  const test=game.createGame();
  Object.assign(test,{ready:true,phase:'ride',chapter:1,assist,guided:true,heading,speed:6,x:0,z:0});
  for(let i=0;i<30;i++)game.advanceGame(test,{...idle,steer:direction},1/60);
  const camera=new THREE.PerspectiveCamera(53,1,.15,1700);
  camera.position.set(-Math.sin(heading)*6,2.5,-Math.cos(heading)*6);
  camera.lookAt(Math.sin(heading)*4.5,1.12,Math.cos(heading)*4.5);camera.updateMatrixWorld();
  const straight=new THREE.Vector3(Math.sin(heading)*3,0,Math.cos(heading)*3).project(camera);
  const turned=new THREE.Vector3(test.x,0,test.z).project(camera);
  assert.ok((turned.x-straight.x)*direction>0,'A/left and D/right must match the chase-camera screen direction at every heading');
  assert.ok(test.lean*direction>0,'Rider banks into the selected screen direction');
  assert.equal(test.guided,false,'Input takes control from automatic riding immediately');
}

const full = game.createGame(); full.ready = true; full.guided = true; game.act(full);
const npcs = [companions.createCompanion(0), companions.createCompanion(1)];
const visited = new Set(), actions = new Set();
for (let tick = 0; tick < 60 * 1000 && full.phase !== 'complete'; tick++) {
  if(process.env.RIDE_DIAGNOSTICS && !visited.has(full.chapter)) console.log('Chapter',full.chapter,'seconds',full.elapsed,'distance',full.distance,'odometer',full.odometer);
  visited.add(full.chapter);
  if (game.canPark(full)) { actions.add(`park:${full.chapter}`); game.act(full); }
  if (full.phase === 'activity' && full.timer > 2.8) game.act(full);
  const previous = { x: full.x, z: full.z, phase: full.phase, distance:full.distance };
  game.advanceGame(full, idle, 1 / 60);
  npcs.forEach((npc,index)=>{
    const old={x:npc.x,z:npc.z};companions.advanceCompanion(npc,index,full,1/60);full.companions[index]=npc.distance;
    assert.ok(Math.hypot(npc.x-old.x,npc.z-old.z)<.32,'Companions steer/roll rather than teleport to a stop');
    if(full.chapter===2 && full.timer>12) assert.ok(Math.abs(full.distance-npc.distance)<130,`Companions keep pace on the open road, rather than vanishing far behind: ${full.distance-npc.distance} m`);
    assert.ok([npc.x,npc.z,npc.heading,npc.speed,npc.steering].every(Number.isFinite));
  });
  assert.ok([full.x, full.z, full.heading, full.speed, full.lean].every(Number.isFinite));
  assert.ok(Math.hypot(full.x - previous.x, full.z - previous.z) < .4, 'No lateral teleports');
  if(previous.phase==='ride') assert.ok(Math.abs(full.distance-previous.distance)<3,`Navigation progress must not jump to a nearby return branch: ${previous.distance} → ${full.distance}, chapter ${full.chapter}, offroad ${full.offroad}`);
  if (['activity', 'dismount', 'remount'].includes(previous.phase)) {
    assert.equal(full.x, previous.x, 'Bike stays parked while rider is off'); assert.equal(full.z, previous.z);
  }
}
assert.equal(full.phase, 'complete', `Guided loop stalled: ${JSON.stringify({ chapter: full.chapter, phase: full.phase, distance: full.distance, target: game.targetDistance(full), offroad: full.offroad, speed: full.speed, gap: game.distanceToStop(full), heading: full.heading })}`);
assert.equal(visited.size, 6); assert.equal(full.photo, 1);
assert.ok(full.overtakes<=2,'Each companion pass counts at most once');
assert.ok(actions.has('park:1') && actions.has('park:3') && actions.has('park:4') && actions.has('park:5'));
assert.ok(full.elapsed > 230 && full.elapsed < 650, `Loop pacing: ${full.elapsed}s`);
assert.ok(route.routeLength > 3000 && route.routeLength < 4500);
assert.ok(route.nearestRoad(route.cafeSite.x,route.cafeSite.z).away>10.5,'The whole dhaba/awning footprint clears all road segments');
assert.ok(route.nearestRoad(route.home.x,route.home.z).away>7.8,'Garage stays clear of the road');
const walk=game.createGame();walk.chapter=3;walk.parkedX=route.bays[3].x;walk.parkedZ=route.bays[3].z;walk.parkedHeading=route.bays[3].heading;
assert.ok(game.walkingDuration(walk)>5,'Longer walks to the dhaba must not be compressed into a 2-second slide');
const waiting=game.createGame();Object.assign(waiting,{ready:true,phase:'ride',chapter:2,distance:1000,speed:0});
const waitingRoad=route.sampleRoad(1000,-1.25);waiting.x=waitingRoad.x;waiting.z=waitingRoad.z;waiting.heading=waitingRoad.heading;
const waitingNpc=companions.createCompanion(0);Object.assign(waitingNpc,route.sampleRoad(1000,.9),{mounted:1,walk:0});
for(let i=0;i<600;i++)companions.advanceCompanion(waitingNpc,0,waiting,1/60);
assert.ok(waitingNpc.distance<waiting.distance+45,'Companions wait nearby when a visitor stops instead of riding out of view');
console.log(`Playable Sunday: full six-chapter loop, ${Math.round(full.elapsed)} seconds; controls, parking gates, photo, dismount/remount, pause and recovery passed.`);
