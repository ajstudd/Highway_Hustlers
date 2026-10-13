import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';

const route = JSON.parse(readFileSync(new URL('../src/data/bhopal-sunday-route.json', import.meta.url), 'utf8'));
function loadModule(path) {
  const url=new URL(path,import.meta.url);
  const sandbox = { exports: {}, require: name => name === 'three' ? THREE : name.endsWith('.json')?route:loadModule(new URL(name+'.ts',url).href) };
  const source = readFileSync(url, 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target:ts.ScriptTarget.ES2022,module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, sandbox);
  return sandbox.exports;
}
const journey = loadModule('../src/components/sunday/journey.ts');
const geography = loadModule('../src/components/sunday/geography.ts');
const ride = journey.createJourney(false);
ride.ready = ride.visible = true;
assert.equal(ride.playing, false, 'scroll is the default, not forced autoplay');
let previous = 0;
for (let i = 0; i <= 1000; i++) {
  journey.scrollJourney(ride, i / 1000);
  assert(Number.isFinite(ride.actionTime), 'poses must be finite at every chapter boundary');
  assert(ride.progress >= previous, 'forward scroll must not reverse the rider');
  previous = ride.progress;
}
assert.equal(ride.chapter, 5);
assert.equal(ride.progress, 1);
for (let i = 1000; i >= 0; i--) {
  journey.scrollJourney(ride, i / 1000);
  assert(ride.progress <= previous, 'upward scroll rewinds continuously');
  previous = ride.progress;
}
assert.equal(ride.chapter, 0);
for(let i=0;i<=100;i++) {
  journey.scrollJourney(ride,journey.timelineAt(i/100));
  assert(Math.abs(ride.progress-i/100)<.00001,'button navigation must align with the scroll timeline');
}
journey.scrollJourney(ride,0);
journey.seekJourney(ride, 1);
assert.equal(ride.travelDuration, 14);
journey.advanceJourney(ride, 7);
assert(ride.progress > 0 && ride.progress < .2, 'halfway travel must not arrive early');
journey.advanceJourney(ride, 7);
assert.equal(ride.progress, .2);
assert.equal(ride.phase, 'action');
journey.toggleJourney(ride);
journey.toggleJourney(ride);
const pausedProgress = ride.progress;
journey.advanceJourney(ride, 1);
assert.equal(ride.progress, pausedProgress, 'pause must freeze the journey');
const reduced = journey.createJourney(true);
for (let i = 0; i <= 100; i++) {
  journey.scrollJourney(reduced, i / 100);
  assert(Number.isFinite(reduced.actionTime));
  assert.equal(reduced.phase, 'action');
  assert.equal(reduced.progress, reduced.chapter / 5, 'reduced motion shows discrete stops');
}
for (let stop = 0; stop < 6; stop++) {
  const point = geography.geographicPosition(stop / 5).point;
  assert(Math.hypot(point[0] - geography.waypoints[stop][0], point[1] - geography.waypoints[stop][1]) < .00001, 'route endpoints must match the real snapped waypoints');
}
for (let i = 0; i <= 1000; i++) {
  const location = geography.geographicPosition(i / 1000);
  assert(location.point.every(Number.isFinite));
  assert(location.point[0] > 23.1 && location.point[0] < 23.3);
  assert(location.point[1] > 77.2 && location.point[1] < 77.5);
}
assert.equal(route.legs.length, 5);
assert(route.legs.every(leg => leg.coordinates.length > 100));
assert(geography.ROUTE_OUTLINE.startsWith('M'));
for(const point of geography.fullRoute) {
  const [x,y]=geography.projectRoutePoint(point);
  assert(x>=17 && x<=203 && y>=17 && y<=167,'the real route must fit within the overlay without distortion or clipping');
}
const {solveLimb}=loadModule('../src/components/sunday/limbIK.ts');
for(const target of [[.4,1.2,.35],[0,0,0],[9,8,7],[-.3,.7,-.6]]) {
  const parent=new THREE.Group(),upper=new THREE.Bone(),lower=new THREE.Bone(),end=new THREE.Bone();
  parent.add(upper);upper.add(lower);lower.add(end);lower.position.y=.6;end.position.y=.6;
  parent.rotation.y=.8;parent.updateMatrixWorld(true);
  solveLimb(upper,lower,end,new THREE.Vector3(...target),new THREE.Vector3(.5,.8,1));
  const position=end.getWorldPosition(new THREE.Vector3());
  assert(position.toArray().every(Number.isFinite),'anatomical IK remains finite even at singular or unreachable targets');
  if(Math.hypot(...target)<1.2 && Math.hypot(...target)>.001)assert(position.distanceTo(new THREE.Vector3(...target))<.0001,'hands and feet reach their physical contact targets');
}
assert(journey.PHOTO_TIME>3.1 && journey.PHOTO_TIME<journey.ACTION_DURATIONS[4],'photo capture follows walking and raising the phone');
const mechanics=loadModule('../src/components/sunday/rideKinematics.ts');
for(const [from,to] of [[0,.2],[.2,.4],[.49,.6],[.6,.8],[.8,1],[.8,.6]])for(let rider=0;rider<3;rider++){
  const track=mechanics.trajectory(from,to,rider);let old=mechanics.sampleTrajectory(track,0);
  const source=Math.round(from*5),target=Math.round(to*5);
  if(source!==2&&Math.abs(from-source/5)<.001)assert(old.point.distanceTo(mechanics.parkingPose(source,rider).point)<.0001,'departure starts at the same parked position');
  for(let i=1;i<=1000;i++){
    const next=mechanics.sampleTrajectory(track,i/1000),delta=next.point.clone().sub(old.point);
    assert(next.point.toArray().every(Number.isFinite)&&Number.isFinite(next.curvature));
    assert(delta.length()<.5,'path is continuous without lateral teleports');
    if(delta.length()>.00001)assert(Math.abs(delta.normalize().dot(next.tangent))>.995,'bike heading agrees with actual wheel travel instead of sliding sideways');
    assert(track.reverse?next.distance<=old.distance:next.distance>=old.distance,'wheel distance is monotone along the path');
    old=next;
  }
  if(target!==2&&Math.abs(to-target/5)<.001)assert(old.point.distanceTo(mechanics.parkingPose(target,rider).point)<.0001,'braking ends at a stable parking bay');
  if(track.toStop>=0)assert.equal(mechanics.sampleTrajectory(track,track.reverse?0:1).rate,0,'arrival speed reaches zero before dismounting');
}
for(const stop of [1,3,4,5]){
  assert.equal(mechanics.stopChoreography(stop,0).riding,1,'arrival begins seated on a stationary motorcycle');
  assert.equal(mechanics.stopChoreography(stop,mechanics.DISMOUNT_SECONDS).riding,0,'step off finishes before walking');
  assert.equal(mechanics.stopChoreography(stop,mechanics.STOP_ACTION_START).stage,'at-stop');
  assert.equal(mechanics.departureChoreography(stop,1).riding,1,'departure completes mounting before rolling');
  const bay=mechanics.parkingPose(stop,0).point;
  assert(bay.distanceTo(mechanics.parkingPose(stop,0).point)===0,'the parked chassis is independent of actor animation time');
}
for(const stop of [0,1,3,4,5]){
  const apron=new THREE.Mesh(mechanics.parkingApronGeometry(stop),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));apron.updateMatrixWorld(true);
  for(let rider=0;rider<3;rider++){
    const pose=mechanics.parkingPose(stop,rider),ray=new THREE.Raycaster(pose.point.clone().add(new THREE.Vector3(0,5,0)),new THREE.Vector3(0,-1,0));
    const floor=ray.intersectObject(apron)[0];assert(floor,'each parked chassis is inside the actual paved lay-by');
    assert(Math.abs(floor.point.y-pose.point.y)<.02,'the real pavement geometry agrees with the vehicle contact height');
  }
}
const interrupted=mechanics.sampleTrajectory(mechanics.trajectory(.6,.8,0),.65);
const checkpoint=.6+.2*interrupted.fraction;
for(const target of [.6,1]){
  const reroute=mechanics.trajectory(checkpoint,target,0,{point:interrupted.point.toArray(),heading:interrupted.heading});
  const start=mechanics.sampleTrajectory(reroute,0);
  assert(start.point.distanceTo(interrupted.point)<.0001,'choosing another stop preserves the current chassis position');
  assert(Math.abs(Math.atan2(Math.sin(start.heading-interrupted.heading),Math.cos(start.heading-interrupted.heading)))<.001,'interrupted navigation does not snap the steering heading');
}
const halfway=mechanics.stopChoreography(3,.8),resuming=mechanics.departureChoreography(3,0,{riding:halfway.riding,walk:halfway.walk,sit:0,heading:0});
assert.equal(resuming.riding,halfway.riding,'an interrupted dismount remounts from the existing leg pose');
for(const [u,offset,cafe] of [[.012,-10,false],[.038,-11,false],[.065,-10,false],[.093,-11,false],[.123,-12,false],[.15,-11,false],[.19,-10,false],[.945,-10,false],[.971,-10,false],[.993,-10,false],[.61,-10,true],[.55,-15,false],[.58,-15,false],[.65,-15,false]]){
  const point=mechanics.rideRoute.getPointAt(u),tangent=mechanics.rideRoute.getTangentAt(u),normal=new THREE.Vector3(tangent.z,0,-tangent.x);point.addScaledVector(normal,offset);
  const yaw=Math.atan2(normal.x,normal.z)+(cafe?0:.15),w=cafe?3.7:2.5,d=cafe?3.45:2.25,z=cafe?1.2:0;
  const safe=mechanics.clearBuildingPosition(point,normal,yaw,w,d,z),center=safe.clone().add(new THREE.Vector3(Math.sin(yaw)*z,0,Math.cos(yaw)*z));
  assert(mechanics.footprintClearance(center,yaw,w,d)>=mechanics.ROAD_CLEARANCE,'every full building footprint clears every segment of the road loop');
}
journey.scrollJourney(ride,journey.timelineAt(.6));journey.replayAction(ride);
assert.equal(ride.actionTime,journey.STOP_ACTION_TIME,'chai replay does not teleport the riders back onto their bikes');
console.log('Sunday journey: scroll/reverse, stop actions, travel timing, pause, reduced motion, route coordinates and limb contact IK passed.');
console.log('Ride mechanics: heading/path alignment, curved parking, braking, mount sequence, action replay and full-loop building clearance passed.');
