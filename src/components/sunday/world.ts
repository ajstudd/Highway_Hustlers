import * as THREE from 'three';
import type { MutableRefObject } from 'react';
import { ACTION_DURATIONS, PHOTO_TIME, ROUTE_STOPS, routeAt, type RideMotion } from './journey';
import { posePerson, tailoredGeometry } from './actors';
import { createHuman, prepareRideActors, type BikeStyle } from './humanActors';
import { rideRoute, parkingPose, parkingApronGeometry, roadPose, trajectory, sampleTrajectory, stopChoreography, departureChoreography, departureDuration, footprintClearance, clearBuildingPosition, isParkingAccess, ROAD_CLEARANCE } from './rideKinematics';
export { prepareRideActors };

// One continuous world. The camera, road, riders and daylight all share the
// same journey coordinate, so a seek never swaps a background or teleports.
const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const lerp = THREE.MathUtils.lerp;
const route = rideRoute;
const routeSamples = route.getSpacedPoints(360);
const destinationPoint=route.getPointAt(ROUTE_STOPS[4]);
const destinationTangent=route.getTangentAt(ROUTE_STOPS[4]);
const lakeCenter=destinationPoint.clone().add(new THREE.Vector3(destinationTangent.z,0,-destinationTangent.x).multiplyScalar(30));
const meetPoint=route.getPointAt(ROUTE_STOPS[1]),meetTangent=route.getTangentAt(ROUTE_STOPS[1]);
const upperLakeCenter=meetPoint.clone().add(new THREE.Vector3(meetTangent.z,0,-meetTangent.x).multiplyScalar(36));
const lakeRadius=(x:number,z:number)=>Math.min(Math.sqrt(((x-lakeCenter.x)/22)**2+((z-lakeCenter.z)/24)**2),Math.sqrt(((x-upperLakeCenter.x)/28)**2+((z-upperLakeCenter.z)/22)**2));

function random(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function elevation(x: number, z: number) {
  const lake = lakeRadius(x,z);
  if (lake < 1) return .4;
  if (lake < 1.12) return lerp(.4, 1.75, (lake - 1) / .12);
  const radius = Math.hypot(x, z);
  return 1.72 + Math.sin(x * .12) * Math.cos(z * .1) * .12 + Math.max(0, radius - 85) * (.12 + .1 * Math.sin(x * .05) * Math.cos(z * .07));
}

function material(color: THREE.ColorRepresentation, roughness = .82, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function addMesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function limb(parent:THREE.Object3D,from:number[],to:number[],top:number,bottom:number,mat:THREE.Material) {
  const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),direction=b.clone().sub(a);
  const mesh=addMesh(parent,new THREE.CylinderGeometry(top,bottom,direction.length(),12),mat);
  mesh.position.copy(a.add(b).multiplyScalar(.5)); mesh.quaternion.setFromUnitVectors(UP,direction.normalize()); return mesh;
}

function tube(parent: THREE.Object3D, from: number[], to: number[], radius: number, mat: THREE.Material, sides = 8) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const direction = b.clone().sub(a);
  const mesh = addMesh(parent, new THREE.CylinderGeometry(radius, radius, direction.length(), sides), mat);
  mesh.position.copy(a.add(b).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
  return mesh;
}

function labelTexture(text: string, background: string, ink: string, sub?: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background; ctx.fillRect(0, 0, 512, 192);
  ctx.strokeStyle = ink; ctx.globalAlpha = .45; ctx.lineWidth = 3; ctx.strokeRect(10, 10, 492, 172); ctx.globalAlpha = 1;
  ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '600 54px sans-serif'; ctx.fillText(text, 256, sub ? 74 : 96, 462);
  if (sub) { ctx.font = '23px sans-serif'; ctx.fillText(sub, 256, 137); }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function asphaltTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const pixels = ctx.createImageData(128, 128); const rand = random(41);
  for (let i = 0; i < pixels.data.length; i += 4) { const value = 110 + rand() * 35; pixels.data[i] = value; pixels.data[i + 1] = value; pixels.data[i + 2] = value; pixels.data[i + 3] = 255; }
  ctx.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(1, 90); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function earthTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!, rand = random(98);
  ctx.fillStyle = '#c1bb9e'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4500; i++) {
    const x = rand() * 256, y = rand() * 256, size = .4 + rand() * 3;
    ctx.fillStyle = rand() > .5 ? '#92947c28' : '#e1d6b728'; ctx.beginPath(); ctx.ellipse(x, y, size * 2, size, rand() * TAU, 0, TAU); ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(30, 30); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function foliageTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!, rand = random(75);
  ctx.fillStyle = '#8b907c'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3600; i++) {
    const brightness = Math.floor(145 + rand() * 95);
    ctx.fillStyle = `rgb(${brightness},${brightness},${brightness - 8})`;
    ctx.beginPath(); ctx.ellipse(rand() * 256, rand() * 256, 1.1 + rand() * 3, .65 + rand(), rand() * TAU, 0, TAU); ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(2, 2); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function roadRibbon(width: number, height: number, mat: THREE.Material) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const count = 480;
  for (let i = 0; i <= count; i++) {
    const t = i / count, point = route.getPointAt(t), tangent = route.getTangentAt(t);
    const normal = new THREE.Vector3(tangent.z, 0, -tangent.x);
    const sectionWidth=width*(t>.68&&t<.86 ? .78 : t<.22||t>.90 ? 1.16 : 1);
    for (const side of [-1, 1]) { positions.push(point.x + normal.x * sectionWidth / 2 * side, point.y + height, point.z + normal.z * sectionWidth / 2 * side); uvs.push(side === -1 ? 0 : 1, t); }
    if (i < count) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, mat);
}

type Motorcycle = { group: THREE.Group; wheels: THREE.Group[]; wheelRadii:number[]; steering:THREE.Group; grips:THREE.Object3D[]; brakeMat:THREE.MeshStandardMaterial; rider: THREE.Group; stand: THREE.Mesh };

function motorcycle(color: string, jacketColor: string, style:BikeStyle): Motorcycle {
  const group = new THREE.Group();
  const steel = material('#24292b', .34, .72), chrome = material('#9fa6a4', .24, .9);
  const rubber = material('#161b1c', .96), paint = material(color, .28, .45), saddle = material('#282728', .94);
  const wheels: THREE.Group[] = [];
  const wheelRadii:number[]=[];
  for (const z of [-.77, .79]) {
    const radius=style==='adventure' && z>0?.35:.29;
    const outer=radius+(style==='sport'?.102:.082);wheelRadii.push(outer);
    const wheel = new THREE.Group(); wheel.position.set(0, outer, z);
    const tyre = addMesh(wheel, new THREE.TorusGeometry(radius, style==='sport'?.102:.082, 12, 32), rubber); tyre.rotation.y = Math.PI / 2;
    const rim = addMesh(wheel, new THREE.TorusGeometry(radius-.06, style==='sport'?.026:.015, 6, 24), style==='sport'?steel:chrome); rim.rotation.y = Math.PI / 2;
    const hub = addMesh(wheel, new THREE.CylinderGeometry(.065, .065, .19, 12), steel); hub.rotation.z = Math.PI / 2;
    const brake = addMesh(wheel, new THREE.CylinderGeometry(.15, .15, .016, 24), chrome, .083); brake.rotation.z = Math.PI / 2;
    for (let i = 0; i < (style==='sport'?5:12); i++) {
      const a = i * TAU / (style==='sport'?5:12);
      tube(wheel, [.02, 0, 0], [.025, Math.cos(a) * (radius-.055), Math.sin(a) * (radius-.055)], style==='sport'?.027:.009, style==='sport'?steel:chrome, 4);
    }
    group.add(wheel); wheels.push(wheel);
  }
  tube(group, [0, .4, -.77], [0, .77, -.02], .037, steel);
  tube(group, [0, .77, -.02], [0, 1.03, .56], .033, steel);
  tube(group, [0, 1.03, .56], [0, .5, .18], .037, steel);
  tube(group, [0, .5, .18], [0, .67, -.44], .035, steel);
  for (const side of [-1, 1]) {
    tube(group, [side * .13, .38, .79], [side * .13, 1.23, .59], .023, chrome);
    tube(group, [side * .18, .44, -.69], [side * .18, .97, -.39], .025, chrome);
    const spring = addMesh(group, new THREE.CylinderGeometry(.045, .045, .28, 10), steel, side * .18, .7, -.54); spring.rotation.x = -.45;
    tube(group, [side * .14, .61, .08], [side * .14, .47, -.77], .03, steel);
  }
  const tank = addMesh(group, new THREE.SphereGeometry(1, 20, 12), paint, 0, 1.06, .21); tank.scale.set(.24, .21, .4); tank.rotation.x = -.12;
  addMesh(group, new THREE.CylinderGeometry(.06, .06, .022, 12), chrome, 0, 1.26, .23);
  const seat = addMesh(group, new THREE.CapsuleGeometry(.12, .49, 4, 12), saddle, 0, 1.04, -.39); seat.rotation.x = Math.PI / 2; seat.scale.x = 1.45;
  addMesh(group, new THREE.BoxGeometry(.34, .28, .35), steel, 0, .65, .03);
  for (let i = 0; i < 6; i++) addMesh(group, new THREE.BoxGeometry(.32, .025, .27), chrome, 0, .72 + i * .035, .11);
  const engineCover = addMesh(group, new THREE.CylinderGeometry(.15, .15, .21, 16), steel, .15, .58, -.04); engineCover.rotation.z = Math.PI / 2;
  tube(group, [.18, .72, .28], [.24, .42, .36], .036, chrome);
  tube(group, [.24, .42, .36], [.26, .4, -.62], .041, chrome);
  const exhaust = addMesh(group, new THREE.CylinderGeometry(.065, .055, .66, 12), chrome, .27, .46, -.51); exhaust.rotation.x = Math.PI / 2;
  for(const side of [-1,1]){
    tube(group,[side*.13,.46,.08],[side*.30,.46,.08],.018,chrome);
    tube(group,[side*.20,.46,.08],[side*.30,.46,.08],.022,rubber);
  }
  const frontFender = addMesh(group, new THREE.TorusGeometry(.4, .055, 6, 20, Math.PI * .7), paint, 0, .39, .79); frontFender.rotation.y = Math.PI / 2; frontFender.rotation.z = .15;
  const rearFender = addMesh(group, new THREE.TorusGeometry(.41, .045, 6, 20, Math.PI * .8), steel, 0, .39, -.77); rearFender.rotation.y = Math.PI / 2;
  const barHeight=style==='sport'?1.23:style==='adventure'?1.49:1.40;
  tube(group, [-.36, barHeight-.04, .64], [.36, barHeight-.04, .64], .026, chrome);
  tube(group, [-.36, barHeight-.04, .64], [-.4, barHeight, .42], .032, rubber);
  tube(group, [.36, barHeight-.04, .64], [.4, barHeight, .42], .032, rubber);
  for (const side of [-1, 1]) {
    tube(group, [side * .3, 1.4, .69], [side * .37, 1.7, .69], .014, chrome);
    const mirror = addMesh(group, new THREE.SphereGeometry(1, 12, 8), steel, side * .37, 1.72, .69); mirror.scale.set(.07, .05, .018);
  }
  const headlight = addMesh(group, new THREE.CylinderGeometry(.113, .11, .14, 20), chrome, 0, 1.13, .83); headlight.rotation.x = Math.PI / 2;
  const glass = material('#f7eac8', .15); glass.emissive.set('#e8bc6b'); glass.emissiveIntensity = .9;
  const headGlass = addMesh(group, new THREE.CircleGeometry(.092, 20), glass, 0, 1.13, .907);
  headGlass.rotation.y = 0;
  const tailMat = material('#ad3626', .2); tailMat.emissive.set('#e85827'); tailMat.emissiveIntensity = .8;
  addMesh(group, new THREE.BoxGeometry(.11, .07, .03), tailMat, 0, .99, -.93);
  const plate = addMesh(group, new THREE.PlaneGeometry(.22, .12), new THREE.MeshStandardMaterial({ map: labelTexture('HH 01', '#e8e4d4', '#212621'), roughness: .8 }), 0, .76, -1.0); plate.rotation.y = Math.PI;
  for (const side of [-1, 1]) addMesh(group, new THREE.SphereGeometry(.035, 8, 6), material('#d69a37', .4), side * .18, .97, -.85);

  if(style==='sport') {
    headlight.visible=headGlass.visible=frontFender.visible=seat.visible=false;
    tank.scale.set(.26,.20,.33);tank.position.z=.08;
    for(const side of [-1,1]) {
      const panelGeometry=new THREE.BufferGeometry();
      panelGeometry.setAttribute('position',new THREE.Float32BufferAttribute([side*.23,1.35,.73, side*.32,1.02,.70, side*.29,.61,.18, side*.20,.75,-.19, side*.20,1.14,-.12],3));
      panelGeometry.setIndex([0,1,4,1,2,4,2,3,4]);panelGeometry.computeVertexNormals();
      addMesh(group,panelGeometry,new THREE.MeshStandardMaterial({color,metalness:.42,roughness:.29,side:THREE.DoubleSide}));
      tube(group,[side*.33,1.04,.66],[side*.29,.80,.1],.022,material('#e9e5d7'));
      const lamp=addMesh(group,new THREE.BoxGeometry(.145,.034,.03),glass,side*.13,1.29,.88);lamp.rotation.z=side*.19;
    }
    const screen=addMesh(group,new THREE.SphereGeometry(1,16,10,0,TAU,0,1.4),new THREE.MeshPhysicalMaterial({color:'#254551',roughness:.1,transparent:true,opacity:.68,side:THREE.DoubleSide}),0,1.46,.60);screen.scale.set(.27,.27,.34);screen.rotation.x=-.3;
    addMesh(group,new THREE.BoxGeometry(.36,.10,.39),saddle,0,1.06,-.33);
    const tail=addMesh(group,new THREE.BoxGeometry(.30,.12,.45),paint,0,1.20,-.70);tail.rotation.x=-.22;
    addMesh(group,new THREE.BoxGeometry(.25,.06,.24),saddle,0,1.30,-.75);
  } else if(style==='adventure') {
    frontFender.visible=false;
    const mudguard=addMesh(group,new THREE.BoxGeometry(.20,.065,.48),paint,0,1.02,.79);mudguard.rotation.x=-.12;
    const windshield=addMesh(group,new THREE.BoxGeometry(.38,.42,.024),new THREE.MeshPhysicalMaterial({color:'#b6d6dd',roughness:.12,transparent:true,opacity:.58}),0,1.57,.65);windshield.rotation.x=-.27;
    addMesh(group,new THREE.BoxGeometry(.29,.25,.21),paint,0,1.15,.76);
    addMesh(group,new THREE.BoxGeometry(.24,.14,.032),glass,0,1.17,.88);
    for(const side of [-1,1]) {
      tube(group,[side*.15,.45,.79],[side*.15,1.44,.59],.028,chrome);
      tube(group,[side*.36,1.49,.62],[side*.40,1.49,.42],.033,rubber);
      const handguard=addMesh(group,new THREE.BoxGeometry(.18,.10,.08),paint,side*.40,1.49,.46);handguard.rotation.y=side*.2;
      addMesh(group,new THREE.BoxGeometry(.29,.36,.45),material('#8c9d9d',.5,.6),side*.34,.95,-.65);
      for(const y of [.78,1.12])addMesh(group,new THREE.BoxGeometry(.31,.028,.47),steel,side*.34,y,-.65);
      for(const z of [-.86,-.44])addMesh(group,new THREE.BoxGeometry(.03,.36,.025),steel,side*.49,.95,z);
      tube(group,[side*.21,.66,.28],[side*.34,.77,.16],.026,steel);
    }
    addMesh(group,new THREE.BoxGeometry(.39,.025,.38),steel,0,1.14,-.84);
  }

  const rider = new THREE.Group();
  const jacket = material(jacketColor, .93), trousers = material('#353e43', .94), boots = material('#1c2529', .87), gloves = material('#292f2f', .84);
  const torso = addMesh(rider, tailoredGeometry([[-.25,.16,.11],[-.12,.16,.12],[.15,.225,.13],[.22,.22,.11],[.28,.10,.085]]), jacket, 0, 1.55, -.17); torso.rotation.x = .27;
  addMesh(rider, new THREE.BoxGeometry(.012, .43, .02), material('#8c9b98', .7), 0, 1.61, -.39);
  addMesh(rider,new THREE.BoxGeometry(.20,.075,.012),material('#d5d8cf'),0,1.72,-.34);
  const patch=addMesh(rider,new THREE.PlaneGeometry(.10,.07),new THREE.MeshStandardMaterial({map:labelTexture('HH','#343c3d','#f7d786'),side:THREE.DoubleSide}),0,1.57,-.31);patch.rotation.y=Math.PI;
  for (const side of [-1, 1]) {
    limb(rider, [side * .15, 1.14, -.32], [side * .27, .88, .19], .09, .07, trousers);
    limb(rider, [side * .27, .88, .19], [side * .27, .51, -.08], .07,.045, trousers);
    addMesh(rider,new THREE.BoxGeometry(.12,.11,.05),gloves,side*.27,.9,.23);
    addMesh(rider,new THREE.BoxGeometry(.12,.13,.23),boots,side*.27,.49,.01);
    limb(rider, [side * .22, 1.72, -.12], [side * .32, 1.4, .25], .077,.058, jacket);
    limb(rider, [side * .32, 1.4, .25], [side * .39, 1.41, .79], .057,.039, jacket);
    addMesh(rider,new THREE.BoxGeometry(.06,.07,.075),gloves,side*.39,1.41,.79);
    addMesh(rider,new THREE.BoxGeometry(.09,.08,.04),gloves,side*.24,1.71,-.15);
  }
  const helmetMat = material('#e1ded3', .28, .1);
  addMesh(rider,new THREE.CylinderGeometry(.06,.065,.10,10),material('#bd8d69'),0,1.86,-.04);
  const helmet = addMesh(rider, new THREE.SphereGeometry(.157, 24, 18), helmetMat, 0, 2.02, -.02); helmet.scale.set(.92, 1.09, 1.08);
  const visor = addMesh(rider, new THREE.SphereGeometry(.161, 20, 12, -.8, 1.6, .8, 1.06), material('#253638', .12, .4), 0, 2.03, .008); visor.rotation.y = 0;
  const helmetStripe = addMesh(rider, new THREE.BoxGeometry(.036, .012, .22), material(color, .3), 0, 2.192, -.01); helmetStripe.rotation.x = .1;
  addMesh(rider,new THREE.BoxGeometry(.06,.012,.021),gloves,0,1.928,.127);
  group.add(rider);
  const stand = tube(group,[.1,.45,-.1],[.36,.025,-.2],.017,steel);
  stand.visible = false;
  const steering=new THREE.Group();steering.position.set(0,1.1,.55);group.add(steering);group.updateMatrixWorld(true);
  [...group.children].forEach(part=>{if(part!==steering&&part.position.z>.45)steering.attach(part);});
  const grips=[-1,1].map(side=>{const grip=new THREE.Object3D();grip.position.set(side*.39,barHeight,.42);group.add(grip);group.updateMatrixWorld(true);steering.attach(grip);return grip;});
  return { group, wheels, wheelRadii, steering, grips, brakeMat:tailMat, rider, stand };
}

function roadsidePosition(u: number, offset: number) {
  const point = route.getPointAt((u + 1) % 1), tangent = route.getTangentAt((u + 1) % 1);
  const normal = new THREE.Vector3(tangent.z, 0, -tangent.x);
  point.addScaledVector(normal, offset); point.y = elevation(point.x, point.z);
  return { point, tangent, normal };
}

function building(scene: THREE.Scene, u: number, offset: number, color: string, cafe = false) {
  const { point, normal } = roadsidePosition(u, offset);
  const house = new THREE.Group(); house.position.copy(point); house.rotation.y = Math.atan2(normal.x, normal.z) + (cafe ? 0 : .15);
  house.userData.cameraObstacle = !cafe;
  const plaster = material(color), roofMat = material('#8c7060'), trim = material('#d5c2a3'), dark = material('#354446');
  const width = cafe ? 5.8 : 4.4, height = cafe ? 3.2 : 5.6;
  house.position.copy(clearBuildingPosition(point,normal,house.rotation.y,cafe?3.7:2.5,cafe?3.45:2.25,cafe?1.2:0));
  house.position.y=elevation(house.position.x,house.position.z);
  house.userData.roadFootprint={w:cafe?3.7:2.5,d:cafe?3.45:2.25,z:cafe?1.2:0};
  addMesh(house, new THREE.BoxGeometry(width, height, 4), plaster, 0, height / 2, 0);
  addMesh(house, new THREE.BoxGeometry(width + .35, .18, 4.3), roofMat, 0, height + .09, 0);
  for (const x of [-width / 2, width / 2]) addMesh(house, new THREE.BoxGeometry(.12, .5, 4), trim, x, height + .38, 0);
  addMesh(house, new THREE.BoxGeometry(width, .5, .12), trim, 0, height + .38, -2);
  const door = addMesh(house, new THREE.BoxGeometry(1.1, 2.2, .08), dark, 0, 1.1, 2.04);
  door.material = material('#443d33');
  for (const x of [-1.45, 1.45]) {
    addMesh(house, new THREE.BoxGeometry(1.03, 1.0, .08), trim, x, 1.7, 2.04);
    addMesh(house, new THREE.BoxGeometry(.86, .83, .09), dark, x, 1.7, 2.08);
    for (let i = 0; i < 4; i++) addMesh(house, new THREE.BoxGeometry(.016, .85, .035), trim, x - .3 + i * .2, 1.7, 2.14);
    if (!cafe) {
      addMesh(house, new THREE.BoxGeometry(.95, 1.14, .06), dark, x, 4.2, 2.07);
      addMesh(house, new THREE.BoxGeometry(1.26, .12, .42), trim, x, 3.6, 2.2);
    }
  }
  for (const side of [-1, 1]) {
    addMesh(house, new THREE.BoxGeometry(.08, 1.07, 1.2), trim, side * (width / 2 + .04), 1.7, .1);
    addMesh(house, new THREE.BoxGeometry(.09, .9, 1.02), dark, side * (width / 2 + .09), 1.7, .1);
    for (let i = 0; i < 5; i++) addMesh(house, new THREE.BoxGeometry(.03, .92, .018), trim, side * (width / 2 + .15), 1.7, -.32 + i * .21);
    if (cafe) {
      const sideSign = addMesh(house, new THREE.PlaneGeometry(1.6, .6), new THREE.MeshStandardMaterial({ map: labelTexture('चाय', '#ad8553', '#f1dbab', 'CHAI · POHA'), roughness: .9 }), side * (width / 2 + .1), 2.73, .1);
      sideSign.rotation.y = side * Math.PI / 2;
    }
  }
  addMesh(house, new THREE.BoxGeometry(width + .4, .18, 5.7), material('#9b8c71'), 0, .1, .65);
  if (cafe) {
    const sign = addMesh(house, new THREE.PlaneGeometry(4.4, 1.2), new THREE.MeshStandardMaterial({ map: labelTexture('CHAI & POHA', '#ccac69', '#433f2b'), roughness: .85, side: THREE.DoubleSide }), 0, 4.02, 1.95);
    sign.castShadow = false;
    for (const x of [-1.8, 1.8]) tube(house, [x,3.2,1.9], [x,4.6,1.9], .025, dark);
    for (const x of [-2.5, 2.5]) {
      addMesh(house, new THREE.CylinderGeometry(.22,.16,.45,12), material('#a17b55'), x,.25,2.4);
      for (let i = 0; i < 4; i++) {
        const plant = addMesh(house, new THREE.SphereGeometry(1,8,6), material('#637554'), x + Math.cos(i * Math.PI / 2) * .1,.65 + i * .025,2.4 + Math.sin(i * Math.PI / 2) * .1);
        plant.scale.set(.08,.24,.07); plant.rotation.z = i * .4;
      }
    }
    const clothCanvas = document.createElement('canvas'); clothCanvas.width = 64; clothCanvas.height = 8;
    const ctx = clothCanvas.getContext('2d')!; ctx.fillStyle = '#f6ddb0'; ctx.fillRect(0, 0, 64, 8); ctx.fillStyle = '#cc5936'; ctx.fillRect(0, 0, 32, 8);
    const clothMap = new THREE.CanvasTexture(clothCanvas); clothMap.wrapS = THREE.RepeatWrapping; clothMap.repeat.x = 5; clothMap.colorSpace = THREE.SRGBColorSpace;
    const awning = addMesh(house, new THREE.BoxGeometry(6, .07, 2.6), new THREE.MeshStandardMaterial({ map: clothMap, side: THREE.DoubleSide, roughness: .9 }), 0, 2.75, 3.2); awning.rotation.x = .15;
    for (const x of [-2.8, 2.8]) tube(house, [x, 0, 4.5], [x, 2.55, 4.5], .035, material('#726b50'));
    for (const x of [-1.65, 1.65]) {
      addMesh(house, new THREE.CylinderGeometry(.65, .65, .12, 20), material('#279a98'), x, .88, 3.6);
      tube(house, [x, 0, 3.6], [x, .85, 3.6], .065, dark);
      for (const dx of [-.25, .2]) {
        addMesh(house, new THREE.CylinderGeometry(.065, .05, .12, 12), material('#b78351'), x + dx, 1, 3.6);
        addMesh(house,new THREE.CylinderGeometry(.2,.2,.035,20),material('#f6ecd5'),x+dx,.968,3.36);
        const poha = addMesh(house,new THREE.SphereGeometry(1,12,8),material('#efc53c'),x+dx,1.002,3.36); poha.scale.set(.145,.035,.145);
        addMesh(house,new THREE.SphereGeometry(.027,8,6),material('#61a943'),x+dx+.08,1.025,3.4);
      }
      for (const dx of [-.85, .85]) {
        addMesh(house, new THREE.BoxGeometry(.55, .08, .55), material('#d4873d'), x + dx, .5, 3.6);
        for (const dz of [-.2, .2]) tube(house, [x + dx, 0, 3.6 + dz], [x + dx, .47, 3.6 + dz], .035, dark);
      }
    }
  } else {
    const waterTank = addMesh(house, new THREE.CylinderGeometry(.6, .6, 1.1, 12), material('#414849'), -.8, height + 1, -.5);
    waterTank.castShadow = true;
    addMesh(house, new THREE.BoxGeometry(1.3, .05, 1.3), dark, -.8, height + 1.57, -.5);
  }
  scene.add(house);
  return house;
}

function populateLandscape(scene: THREE.Scene, mobile: boolean) {
  const rand = random(107);
  const breakfastCenter = roadsidePosition(.61,-10).point;
  const destinationCenter = roadsidePosition(ROUTE_STOPS[4],8.2).point;
  const geometry = new THREE.PlaneGeometry(270, 270, 120, 120); geometry.rotateX(-Math.PI / 2);
  const vertices = geometry.getAttribute('position'), colors: number[] = [];
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), z = vertices.getZ(i), y = elevation(x, z);
    vertices.setY(i, y);
    const tint = new THREE.Color().setHSL(.27 + rand() * .035, .54 + rand() * .12, .35 + rand() * .06 + Math.min(.05, y / 250));
    colors.push(tint.r, tint.g, tint.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
  const ground = addMesh(scene, geometry, new THREE.MeshStandardMaterial({ vertexColors: true, map: earthTexture(), roughness: 1 })); ground.castShadow = false;
  const shoulder = roadRibbon(8.3, -.06, material('#938670')); shoulder.name='ride-surface';shoulder.receiveShadow = true; scene.add(shoulder);
  const road = roadRibbon(6.6, 0, new THREE.MeshStandardMaterial({ color: '#555650', map: asphaltTexture(), roughness: .96, side: THREE.DoubleSide }));road.name='ride-surface';road.receiveShadow = true; scene.add(road);
  // Proper level lay-bys, joined to the carriageway. Riders don't hop a curb
  // or float over lower terrain when leaving the asphalt.
  ROUTE_STOPS.forEach((station,stop)=>{
    if(stop===2)return;
    const apron=parkingApronGeometry(stop);
    const bay=addMesh(scene,apron,new THREE.MeshStandardMaterial({color:'#a6a08b',roughness:.92,side:THREE.DoubleSide}));bay.name='ride-surface';bay.receiveShadow=true;
    for(let index=0;index<3;index++){
      const park=parkingPose(stop,index),line=new THREE.Group();line.position.copy(park.point);line.rotation.y=park.heading;
      for(const side of [-1,1])addMesh(line,new THREE.BoxGeometry(.045,.012,2.4),material('#f1deb0'),side*.68,.009);
      scene.add(line);
    }
  });

  // Road paint and guardrail are instanced; hundreds of details stay cheap.
  const markings = new THREE.InstancedMesh(new THREE.BoxGeometry(.12, .018, 1.05), material('#d7c8a4'), 100);
  const matrix = new THREE.Object3D();
  for (let i = 0; i < 100; i++) { const p = route.getPointAt(i / 100), t = route.getTangentAt(i / 100); matrix.position.set(p.x, p.y + .025, p.z); matrix.rotation.set(0, Math.atan2(t.x, t.z), 0); matrix.updateMatrix(); markings.setMatrixAt(i, matrix.matrix); }
  scene.add(markings);
  for (const offset of [-3.18, 3.18]) {
    const points = route.getSpacedPoints(400).map((p, index) => { const t = route.getTangentAt(index / 400); return new THREE.Vector3(p.x + t.z * offset, p.y + .015, p.z - t.x * offset); });
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false), 400, .037, 4, false), material('#cfc2a2')));
  }

  // Acacia-like crowns: trunks, branching silhouettes, irregular leaf clusters.
  const trees: { x: number; z: number; size: number }[] = [];
  const count = mobile ? 180 : 320;
  for (let i = 0; i < count * 4 && trees.length < count; i++) {
    const x = (rand() - .5) * 182, z = (rand() - .5) * 182;
    const lake = lakeRadius(x,z);
    if (lake < 1.2 || routeSamples.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < 47)) continue;
    const nearest=routeSamples.reduce((best,p,index)=>p.distanceToSquared(new THREE.Vector3(x,p.y,z))<routeSamples[best].distanceToSquared(new THREE.Vector3(x,p.y,z))?index:best,0)/360;
    if ((nearest<.23 || nearest>.91) && rand()<.9) continue;
    if (x < -10 && z > 10 && Math.hypot(x + 30, z - 25) < 22) continue;
    if (Math.hypot(x-breakfastCenter.x,z-breakfastCenter.z)<10) continue;
    if (Math.hypot(x-destinationCenter.x,z-destinationCenter.z)<12) continue;
    trees.push({ x, z, size: 2.8 + rand() * 3.2 });
  }
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.09, .18, 1, 7), material('#655b48'), trees.length * 3);
  const leafGeometry = new THREE.SphereGeometry(1, 18, 12);
  const leafVertices = leafGeometry.getAttribute('position');
  for (let i = 0; i < leafVertices.count; i++) {
    const x = leafVertices.getX(i), y = leafVertices.getY(i), z = leafVertices.getZ(i);
    const radius = 1 + Math.sin(x * 17 + z * 13) * Math.cos(y * 14 - z * 11) * .08;
    leafVertices.setXYZ(i, x * radius, y * radius, z * radius);
  }
  leafGeometry.computeVertexNormals();
  const leafMap = foliageTexture();
  const leafMaterial = new THREE.MeshStandardMaterial({ color: '#d6dac2', map: leafMap, bumpMap: leafMap, bumpScale: .12, roughness: 1 });
  const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, trees.length * 5);
  trunks.castShadow = true; leaves.castShadow = true; leaves.receiveShadow = true;
  trees.forEach(({ x, z, size }, i) => {
    const y = elevation(x, z);
    matrix.position.set(x, y + size / 2, z); matrix.rotation.set(0, rand() * TAU, .03); matrix.scale.set(size * .26, size, size * .26); matrix.updateMatrix(); trunks.setMatrixAt(i * 3, matrix.matrix);
    for (let j = 0; j < 2; j++) { matrix.position.set(x + (j ? .35 : -.35), y + size * .8, z); matrix.rotation.z = j ? -.45 : .45; matrix.scale.set(size * .17, size * .5, size * .17); matrix.updateMatrix(); trunks.setMatrixAt(i * 3 + j + 1, matrix.matrix); }
    for (let j = 0; j < 5; j++) {
      const angle = j * TAU / 5;
      matrix.position.set(x + Math.cos(angle) * size * .37, y + size * (1 + rand() * .16), z + Math.sin(angle) * size * .37);
      matrix.rotation.set(rand() * .2, rand() * TAU, rand() * .2); matrix.scale.set(size * (.45 + rand() * .13), size * (.27 + rand() * .1), size * (.45 + rand() * .13)); matrix.updateMatrix(); leaves.setMatrixAt(i * 5 + j, matrix.matrix);
      const hue = .23 + rand() * .08;
      leaves.setColorAt(i * 5 + j, new THREE.Color().setHSL(hue, .54 + rand() * .18, .35 + rand() * .12));
    }
  });
  scene.add(trunks, leaves);

  const stones = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), material('#9b9580'), 95);
  for (let i = 0; i < 95; i++) { const u = i / 95 * TAU, size = .35 + rand() * .6; matrix.position.set(lakeCenter.x+Math.cos(u) * (22.8 + rand()), 1.2, lakeCenter.z+Math.sin(u) * (24.8 + rand())); matrix.rotation.set(rand(), rand(), rand()); matrix.scale.set(size, size * .55, size * .8); matrix.updateMatrix(); stones.setMatrixAt(i, matrix.matrix); }
  stones.receiveShadow = true; scene.add(stones);

  const grassCount = mobile ? 700 : 1400;
  const grassGeo = new THREE.BufferGeometry();
  grassGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    -.035,0,0, .025,0,0, .045,.27,0,
    -.035,0,0, .045,.27,0, .035,.49,0,
    0,0,-.035, 0,0,.025, -.035,.3,.035,
    0,0,-.035, -.035,.3,.035, -.075,.42,.045,
  ], 3)); grassGeo.computeVertexNormals();
  const grass = new THREE.InstancedMesh(grassGeo, new THREE.MeshStandardMaterial({ color: '#899271', roughness: 1, side: THREE.DoubleSide }), grassCount);
  let placed = 0;
  for (let i = 0; i < grassCount * 10 && placed < grassCount; i++) {
    const x = (rand() - .5) * 125, z = (rand() - .5) * 125;
    if (lakeRadius(x,z)<1.04 || routeSamples.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < 15)) continue;
    if (Math.hypot(x-destinationCenter.x,z-destinationCenter.z)<5) continue;
    matrix.position.set(x, elevation(x, z), z); matrix.rotation.set(0, rand() * TAU, (rand() - .5) * .2); const size = .35 + rand() * .8; matrix.scale.set(size, size, size); matrix.updateMatrix(); grass.setMatrixAt(placed++, matrix.matrix);
  }
  grass.count = placed; scene.add(grass);

  for (const [u, offset, color] of [[.012,-10,'#cc896f'],[.038,-11,'#d1bd8a'],[.065,-10,'#7a9ca7'],[.093,-11,'#b6bba0'],[.123,-12,'#c6ab8d'],[.15,-11,'#8faaa5'],[.19,-10,'#bfc4ad'],[.945,-10,'#a0ad96'],[.971,-10,'#bca277'],[.993,-10,'#d0bfa3']] as const) building(scene, u, offset, color);
  const cafe = building(scene, .61, -10, '#f2ad5a', true);

  const signMaterials: THREE.Material[] = [];
  for (const [u, text, sub] of [[.18,'BOAT CLUB','Bhopal · Upper Lake'],[.34,'BHADBHADA','Ratibad ahead'],[.52,'RATIBAD','chai & poha ahead'],[.72,'KERWA DAM','a moment to slow down']] as const) {
    const { point, tangent } = roadsidePosition(u, -4.9);
    const sign = new THREE.Group(); sign.position.copy(point); sign.rotation.y = Math.atan2(-tangent.x, -tangent.z);
    const mat = new THREE.MeshStandardMaterial({ map: labelTexture(text, '#425750', '#e3dac1', sub), roughness: .85, side: THREE.DoubleSide }); signMaterials.push(mat);
    tube(sign, [-.6, 0, 0], [-.6, 3.2, 0], .04, material('#8f9187')); tube(sign, [.6, 0, 0], [.6, 3.2, 0], .04, material('#8f9187'));
    addMesh(sign, new THREE.PlaneGeometry(2.7, 1.02), mat, 0, 2.75); scene.add(sign);
  }

  // Lake-side railing and benches make the route read as a real place.
  const railMat = material('#a5a99c', .4, .5);
  // Upper Lake gets a city promenade; Kerwa stays a woodland shore.
  for(let i=0;i<32;i++){
    const {point,tangent}=roadsidePosition(.10+i*.0045,7.5);
    if(isParkingAccess(.10+i*.0045,7.5))continue;
    const rail=new THREE.Group();rail.position.copy(point);rail.rotation.y=Math.atan2(tangent.x,tangent.z);
    tube(rail,[0,0,0],[0,1.0,0],.04,railMat);tube(rail,[0,1.0,-.68],[0,1.0,.68],.03,railMat);scene.add(rail);
  }
  for(const x of [-3.25,3.25]){
    const pot=new THREE.Group();cafe.add(pot);pot.position.set(x,0,3.5);
    addMesh(pot,new THREE.CylinderGeometry(.27,.19,.42,14),material('#be633a'),0,.21);
    const foliage=material('#2c7451'),bloom=material(x<0?'#e685a7':'#edbb37');
    for(let i=0;i<7;i++){const a=i*TAU/7;addMesh(pot,new THREE.SphereGeometry(.17,10,8),foliage,Math.cos(a)*.18,.58,Math.sin(a)*.18);addMesh(pot,new THREE.SphereGeometry(.065,8,6),bloom,Math.cos(a)*.23,.72,Math.sin(a)*.23);}
  }
  for (let i = 0; i < 23; i++) {
    const u = .70 + i * .0045, { point, tangent } = roadsidePosition(u, 4.2);
    if (u > .742 && u < .795) continue;
    const rail = new THREE.Group(); rail.position.copy(point); rail.rotation.y = Math.atan2(tangent.x, tangent.z);
    tube(rail, [0, 0, 0], [0, 1.1, 0], .035, railMat); tube(rail, [0, .6, -.6], [0, .6, .6], .025, railMat); tube(rail, [0, 1.05, -.6], [0, 1.05, .6], .025, railMat); scene.add(rail);
  }
  for (const u of [.75, .79]) {
    const { point, tangent } = roadsidePosition(u, 6);
    const bench = new THREE.Group(); bench.position.copy(point); bench.rotation.y = Math.atan2(tangent.x, tangent.z);
    for (let i = 0; i < 4; i++) { addMesh(bench, new THREE.BoxGeometry(.13, .07, 1.9), material('#81684b'), i * .15, .56); addMesh(bench, new THREE.BoxGeometry(.08, .13, 1.9), material('#81684b'), -.08, .76 + i * .13); }
    tube(bench, [0, 0, -.65], [0, 1.18, -.65], .037, railMat); tube(bench, [0, 0, .65], [0, 1.18, .65], .037, railMat); scene.add(bench);
  }

  // A faint skyline across the water, rather than landmarks used as stickers.
  const skylineMat = material('#aea99a');
  for (let i = 0; i < 19; i++) { const height=2+rand()*4,width=2.4+rand()*3,x=-68+i*3.1,z=55+rand()*7;
    if(footprintClearance(new THREE.Vector3(x,0,z),0,width/2,1.5)<ROAD_CLEARANCE)continue;
    const block=addMesh(scene,new THREE.BoxGeometry(width,height,3),skylineMat,x,elevation(x,z)+height/2,z);block.userData.roadFootprint={w:width/2,d:1.5,z:0};
  }
  return { cafe };
}

function routeScenery(scene:THREE.Scene) {
  const charcoal=material('#454b47'), concrete=material('#a3a497'), yellow=material('#d7b23e'), black=material('#343b39');
  // City stretch: pavements, painted curbs, shop fronts and utility wires.
  for(let i=0;i<76;i++) {
    const u=(i<54 ? .005+i*.0038 : .925+(i-54)*.003);
    for(const side of [-1,1]) {
      if(isParkingAccess(u,side*4.8))continue;
      const spot=roadsidePosition(u,side*4.8);
      const curb=new THREE.Group();curb.position.copy(spot.point);curb.rotation.y=Math.atan2(spot.tangent.x,spot.tangent.z);
      addMesh(curb,new THREE.BoxGeometry(1.3,.12,1.18),concrete,side*.55,.15);
      addMesh(curb,new THREE.BoxGeometry(.17,.21,1.18),i%2?yellow:black,0,.22);scene.add(curb);
    }
  }
  for(const u of [.025,.07,.115,.19,.945,.985]) {
    const a=roadsidePosition(u,-7),b=roadsidePosition(u+.025,-7);
    tube(scene,[a.point.x,a.point.y,a.point.z],[a.point.x,a.point.y+6.6,a.point.z],.065,concrete);
    const wire=new THREE.CatmullRomCurve3([a.point.clone().addScaledVector(UP,6.3),a.point.clone().lerp(b.point,.5).addScaledVector(UP,5.8),b.point.clone().addScaledVector(UP,6.3)]);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(wire,16,.012,4,false),charcoal));
  }
  const home=roadsidePosition(ROUTE_STOPS[0],-11);
  const garage=new THREE.Group();garage.position.copy(home.point);garage.rotation.y=Math.atan2(home.normal.x,home.normal.z);
  garage.position.copy(clearBuildingPosition(home.point,home.normal,garage.rotation.y,2.1,1.2));garage.position.y=elevation(garage.position.x,garage.position.z);garage.userData.roadFootprint={w:2.1,d:1.2,z:0};
  garage.userData.cameraObstacle = true;
  addMesh(garage,new THREE.BoxGeometry(4,3.2,2.2),material('#9aab9c'),0,1.6);
  addMesh(garage,new THREE.BoxGeometry(3.4,2.4,.06),charcoal,0,1.22,1.14);
  for(let i=0;i<12;i++)addMesh(garage,new THREE.BoxGeometry(3.4,.022,.07),concrete,0,.2+i*.19,1.18);
  addMesh(garage,new THREE.PlaneGeometry(2.8,.56),new THREE.MeshStandardMaterial({map:labelTexture('HH','#344944','#f7e6b2'),side:THREE.DoubleSide}),0,2.85,1.16);scene.add(garage);
  // Bhadbhada stretch: a bridge, water below, striped parapets and chevrons.
  const bridge=roadsidePosition(ROUTE_STOPS[2],0);
  const river=addMesh(scene,new THREE.PlaneGeometry(38,10),material('#508e91',.28),bridge.point.x,1.84,bridge.point.z);river.rotation.x=-Math.PI/2;river.rotation.z=-Math.atan2(bridge.tangent.x,bridge.tangent.z);
  for(let i=0;i<18;i++)for(const side of [-1,1]) {
    const spot=roadsidePosition(.35+i*.0024,side*3.7);
    const wall=new THREE.Group();wall.position.copy(spot.point);wall.rotation.y=Math.atan2(spot.tangent.x,spot.tangent.z);
    addMesh(wall,new THREE.BoxGeometry(.38,.7,.92),i%2?yellow:charcoal,0,.35);scene.add(wall);
  }
  // Ratibad is a slower village road: small homes and farm rows around the chai stop.
  for(const [u,color] of [[.55,'#b39b79'],[.58,'#acb49b'],[.65,'#a49375']] as const)building(scene,u,-15,color);
  const field=roadsidePosition(.51,14);
  const crops=new THREE.InstancedMesh(new THREE.ConeGeometry(.15,.7,4),material('#b4b47a'),360);
  const matrix=new THREE.Object3D();
  for(let i=0;i<360;i++){const row=Math.floor(i/24),col=i%24;matrix.position.set(field.point.x+row*.55,elevation(field.point.x+row*.55,field.point.z+col*.5)+.35,field.point.z+col*.5);matrix.rotation.y=i*.42;matrix.updateMatrix();crops.setMatrixAt(i,matrix.matrix);}scene.add(crops);
  // Forest approach: narrower tarmac with reflective bollards rather than city curbs.
  for(let i=0;i<28;i++)for(const side of [-1,1]) {
    const spot=roadsidePosition(.67+i*.004,side*3.3);
    const bollard=new THREE.Group();bollard.position.copy(spot.point);
    addMesh(bollard,new THREE.BoxGeometry(.13,.55,.13),concrete,0,.275);
    addMesh(bollard,new THREE.BoxGeometry(.14,.09,.14),yellow,0,.48);scene.add(bollard);
  }
}

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color('#526176') }, bottom: { value: new THREE.Color('#d0a083') }, sunDirection: { value: new THREE.Vector3(.3, .2, -.8).normalize() }, time: { value: 0 } },
    vertexShader: 'varying vec3 vDirection; void main(){vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 vDirection; uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDirection; uniform float time;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
      void main(){vec3 d=normalize(vDirection); float elevation=max(d.y,0.); vec3 color=mix(bottom,top,smoothstep(0.,.8,elevation)); float sun=max(dot(d,sunDirection),0.); color+=vec3(1.,.65,.3)*pow(sun,70.)*.45+vec3(1.,.9,.65)*pow(sun,2400.)*2.;
      vec2 p=d.xz/(abs(d.y)+.25)*2.5+vec2(time*.001,0.);float clouds=noise(p)*.57+noise(p*2.1)*.28+noise(p*4.2)*.15; clouds=smoothstep(.55,.78,clouds)*smoothstep(.05,.3,d.y);color=mix(color,vec3(.85,.83,.77),clouds*.30);gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
}

function lakeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, tint: { value: new THREE.Color('#687f7c') }, light: { value: .5 } },
    transparent: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vWorld; void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}',
    fragmentShader: `varying vec3 vWorld; uniform float time;uniform vec3 tint; uniform float light;
      void main(){float ripples=sin(vWorld.x*2.2+vWorld.z*.7+time*.6)*sin(vWorld.z*3.1-time*.4); float thin=pow(max(0.,ripples),12.);vec3 color=tint+vec3(.12,.11,.08)*thin*light;float reflection=exp(-pow((vWorld.x-4.)*.13,2.))*.07; color+=vec3(.7,.47,.2)*reflection*(.5+thin);gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
}

function createDestination(scene: THREE.Scene) {
  const { point, normal } = roadsidePosition(ROUTE_STOPS[4],8.2);
  const deck = new THREE.Group(); deck.position.set(point.x,1.9,point.z); deck.rotation.y = Math.atan2(-normal.x,-normal.z);
  const wood = material('#b7844e');
  for(let i=0;i<15;i++) addMesh(deck,new THREE.BoxGeometry(.52,.18,5.4),wood,-3.8+i*.54,0,0);
  const rails = material('#ede0b2');
  for(const x of [-3.7,3.7]) {
    tube(deck,[x,-1.5,-2.5],[x,3.6,-2.5],.065,rails);
    tube(deck,[x,0,2.5],[x,1.1,2.5],.06,rails);
    tube(deck,[x,1.1,-2.5],[x,1.1,2.5],.035,rails);
  }
  tube(deck,[-3.7,1.1,-2.5],[3.7,1.1,-2.5],.035,rails);
  const banner = addMesh(deck,new THREE.PlaneGeometry(6.5,.9),new THREE.MeshStandardMaterial({map:labelTexture('KERWA DAM','#336d76','#f7e6b2'),side:THREE.DoubleSide,roughness:.9}),0,3.12,-2.5);
  banner.castShadow = false;
  for(const side of [-1,1]) {
    const flag = addMesh(deck,new THREE.PlaneGeometry(.85,.65),material(side<0?'#d56c48':'#e2b848'),side*3.7+side*.42,3.45,-2.5); flag.rotation.y = side*.2;
  }
  scene.add(deck);
  const meet = roadsidePosition(ROUTE_STOPS[1],8.5);
  const sign = new THREE.Group(); sign.position.copy(meet.point); sign.rotation.y = Math.atan2(-meet.normal.x,-meet.normal.z);
  for(const x of [-1.1,1.1]) tube(sign,[x,0,0],[x,3.1,0],.04,rails);
  addMesh(sign,new THREE.PlaneGeometry(2.9,1.1),new THREE.MeshStandardMaterial({map:labelTexture('HH · MEET UP','#d88c44','#fff0c6'),side:THREE.DoubleSide,roughness:.85}),0,2.6);
  scene.add(sign);
  return deck;
}

export function createRideWorld(host: HTMLDivElement, motion: MutableRefObject<RideMotion>) {
  const mobile = host.clientWidth < 700;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.35 : 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.24;
  renderer.domElement.setAttribute('aria-hidden', 'true'); host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2('#c1ae91', .008);
  const camera = new THREE.PerspectiveCamera(48, 1, .2, 350);
  const hemisphere = new THREE.HemisphereLight('#d3eaff', '#8ba577', 1.85); scene.add(hemisphere);
  const sunlight = new THREE.DirectionalLight('#ffd8a4', 2.1); sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  sunlight.shadow.camera.left = sunlight.shadow.camera.bottom = -34; sunlight.shadow.camera.right = sunlight.shadow.camera.top = 34;
  sunlight.shadow.camera.near = 1; sunlight.shadow.camera.far = 135; sunlight.shadow.bias = -.00008; sunlight.shadow.normalBias = .012;
  scene.add(sunlight, sunlight.target);
  const sky = skyMaterial(); const dome = new THREE.Mesh(new THREE.SphereGeometry(280, 24, 16), sky); dome.renderOrder = -1; scene.add(dome);
  const water = lakeMaterial(); const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 96), water); lake.rotation.x = -Math.PI / 2; lake.scale.set(22.2, 24.2, 1); lake.position.set(lakeCenter.x,1.23,lakeCenter.z); scene.add(lake);
  const upperLake=new THREE.Mesh(new THREE.CircleGeometry(1,96),water);upperLake.rotation.x=-Math.PI/2;upperLake.scale.set(28,22,1);upperLake.position.set(upperLakeCenter.x,1.23,upperLakeCenter.z);scene.add(upperLake);
  const { cafe } = populateLandscape(scene, mobile);
  routeScenery(scene);
  const destination = createDestination(scene);
  scene.updateMatrixWorld(true);
  let buildingCount=0,minimumClearance=Infinity;
  scene.traverse(object=>{const footprint=object.userData.roadFootprint;if(!footprint)return;
    buildingCount++;const center=object.localToWorld(new THREE.Vector3(0,0,footprint.z));
    minimumClearance=Math.min(minimumClearance,footprintClearance(center,object.rotation.y,footprint.w,footprint.d));
  });
  host.dataset.buildingsChecked=String(buildingCount);host.dataset.roadClearance=minimumClearance.toFixed(3);
  const cameraObstacles:{group:THREE.Object3D;box:THREE.Box3;materials:THREE.MeshStandardMaterial[];opacity:number}[]=[];
  scene.traverse(group=>{
    if(!group.userData.cameraObstacle)return;
    const materials=new Set<THREE.MeshStandardMaterial>();
    group.traverse(object=>{if(object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial){object.material.transparent=true;materials.add(object.material);}});
    cameraObstacles.push({group,box:new THREE.Box3().setFromObject(group),materials:[...materials],opacity:1});
  });
  const sightline=new THREE.Ray(),obstacleHit=new THREE.Vector3();
  const floorRay=new THREE.Raycaster(),driveSurfaces=scene.children.filter(object=>object.name==='ride-surface');
  const lampGlow = material('#eedfc1', .5); lampGlow.emissive.set('#efb971');
  for (const u of [.97, .015, .055, .09]) {
    const { point, normal } = roadsidePosition(u, -4.6);
    const lamp = new THREE.Group(); lamp.position.copy(point);
    tube(lamp, [0,0,0], [0,5.3,0], .035, material('#71756d', .5, .5));
    tube(lamp, [0,5.3,0], [normal.x * .8,5.3,normal.z * .8], .03, material('#71756d', .5, .5));
    addMesh(lamp, new THREE.BoxGeometry(.4,.06,.25), lampGlow, normal.x * .8, 5.24, normal.z * .8);
    scene.add(lamp);
  }
  const riders = [motorcycle('#258fc8', '#23a59c','roadster'), motorcycle('#d64939', '#537da6','sport'), motorcycle('#dfad31', '#41785d','adventure')];
  riders.forEach(bike => scene.add(bike.group));
  const people = [createHuman('#25a79e','#bf9879',true,'roadster'),createHuman('#477baa','#dbb095',false,'sport'),createHuman('#527a45','#c29574',false,'adventure')];
  people.forEach(person=>scene.add(person.group));
  host.dataset.actors=people.every(p=>p.applyPose)?'rigged-female-and-male':'lightweight-fallback';host.dataset.bikes='roadster,sport,adventure';

  const headlight = new THREE.SpotLight('#ffe0a3', 12, 18, .42, .7, 1.5);
  headlight.position.set(0, 1.14, .92); headlight.target.position.set(0, .1, 10); riders[0].group.add(headlight, headlight.target);
  const smokeTextureCanvas = document.createElement('canvas'); smokeTextureCanvas.width = smokeTextureCanvas.height = 64;
  const smokeCtx = smokeTextureCanvas.getContext('2d')!;
  const gradient = smokeCtx.createRadialGradient(32, 32, 0, 32, 32, 32); gradient.addColorStop(0, '#f4ecdc66'); gradient.addColorStop(.4, '#f4ecdc22'); gradient.addColorStop(1, '#f4ecdc00'); smokeCtx.fillStyle = gradient; smokeCtx.fillRect(0, 0, 64, 64);
  const smokeMap = new THREE.CanvasTexture(smokeTextureCanvas);
  const steam = Array.from({ length: 6 }, () => { const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeMap, transparent: true, opacity: .5, depthWrite: false })); cafe.add(sprite); return sprite; });

  const targetCamera = new THREE.Vector3(), lookAt = new THREE.Vector3(), smoothLookAt = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const sunDirection = new THREE.Vector3();
  const dawnTop = new THREE.Color('#6b91cb'), dayTop = new THREE.Color('#278fd0');
  const dawnHorizon = new THREE.Color('#f4ba7c'), dayHorizon = new THREE.Color('#b5e4ed');
  const dawnFog = new THREE.Color('#e5bb91'), dayFog = new THREE.Color('#a5dce4');
  const dawnWater = new THREE.Color('#729d9e'), dayWater = new THREE.Color('#129fa9');
  let disposed = false, raf = 0, previous = performance.now(), elapsed = 0, oldProgress = motion.current.progress;
  let view = 0, cameraReady = false, frameCount = 0, fpsStart = previous;
  let needsRender = true, lastStaticProgress = -1, lastStaticWide = false;
  let parked = 1, lastActionTime = -1;
  let photoVersion = -1;
  const walkPaths=new Map<string,THREE.CatmullRomCurve3>();
  const wheelTravel=riders.map(()=>({distance:0,odometer:0,track:undefined as ReturnType<typeof trajectory>|undefined,road:motion.current.progress}));
  const floorCache=riders.map(()=>({x:Infinity,z:Infinity,y:0}));
  let contactReported=0;
  for(const stop of [3,4])for(let index=0;index<3;index++){
    const park=parkingPose(stop,index),off=park.point.clone().addScaledVector(park.normal,.7);
    if(stop===3){
      const end=cafe.localToWorld(new THREE.Vector3([-2.5,-.8,.8][index],0,3.6));
      walkPaths.set(`${stop}:${index}`,new THREE.CatmullRomCurve3([off,off.clone().addScaledVector(park.tangent,1.8),park.point.clone().addScaledVector(park.tangent,2.3).addScaledVector(park.normal,-1.4),end],false,'centripetal'));
    }else{
      const entry=destination.localToWorld(new THREE.Vector3((index-1)*1.25,.10,3.3));
      const end=destination.localToWorld(new THREE.Vector3((index-1)*1.25,.10,.8));
      walkPaths.set(`${stop}:${index}`,new THREE.CatmullRomCurve3([off,off.clone().addScaledVector(park.tangent,.8),entry,end],false,'centripetal'));
    }
  }

  const resize = () => { const width = host.clientWidth, height = host.clientHeight; if (!width || !height) return; renderer.setSize(width, height, false); camera.aspect = width / height; camera.fov = width < 600 ? 57 : 48; camera.updateProjectionMatrix(); needsRender = true; };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();

  const draw = (now: number) => {
    if (disposed) return;
    raf = requestAnimationFrame(draw);
    const dt = Math.min(.05, (now - previous) / 1000); previous = now;
    const ride = motion.current;
    if ((!ride.visible || document.hidden || !host.clientWidth) && cameraReady) return;
    elapsed += ride.reduced ? 0 : dt;
    const p = ride.progress;
    if (ride.reduced && !needsRender && p === lastStaticProgress && ride.wide === lastStaticWide) return;
    const journeyDelta=p-oldProgress;
    const distance = Math.abs(journeyDelta)*route.getLength(); oldProgress=p;
    const u = routeAt(p);
    const leadPoint=route.getPointAt(u), leadTangent=route.getTangentAt(u);
    const travel=ride.travelTime/ride.travelDuration;
    const departure=Math.min(5,Math.round(ride.from*5));
    const hold=ride.phase==='travel'?departureDuration(ride):0;
    const preparing=ride.phase==='travel'&&hold>0&&travel<hold;
    const movingTime=THREE.MathUtils.clamp((travel-hold)/Math.max(.001,1-hold),0,1);
    const tracks=ride.phase==='travel'?riders.map((_,index)=>trajectory(ride.from,ride.target,index,ride.departureVehicles?.[index])):undefined;
    const leadSample=tracks?sampleTrajectory(tracks[0],movingTime):undefined;
    const poseChapter=ride.phase==='action'?ride.chapter:preparing?departure:leadSample?.stage==='pull-in'?ride.chapter:departure;
    const previousPark=parked;
    parked=ride.phase==='action'?Number(ride.chapter!==2):preparing?1:leadSample?.stage==='pull-out'?1-THREE.MathUtils.smoothstep(leadSample.fraction,0,tracks![0].exit):leadSample?.stage==='pull-in'?THREE.MathUtils.smoothstep(leadSample.fraction,1-tracks![0].entry,1):0;
    ride.vehicleProgress=ride.phase==='action'?p:preparing?ride.from:lerp(ride.from,ride.target,tracks![0].reverse?1-leadSample!.fraction:leadSample!.fraction);
    let physicalStage='at-stop';
    const riderStates:NonNullable<RideMotion['riderStates']>=[],vehicleStates:NonNullable<RideMotion['vehicleStates']>=[];
    riders.forEach((bike,index)=>{
      const sample=tracks?sampleTrajectory(tracks[index],movingTime):undefined;
      const stop=ride.phase==='action'?ride.chapter:preparing?departure:ride.chapter;
      const parkedPose=parkingPose(stop,index);
      const road=roadPose(u-index*.012,index);
      const vehicle=sample??(stop===2?{...road,curvature:0,distance:u*route.getLength(),stage:'cruise'}:{...parkedPose,curvature:0,distance:ROUTE_STOPS[stop]*route.getLength(),stage:'at-stop'});
      const moving=ride.phase==='travel'&&!preparing || ride.phase==='action'&&stop===2;
      const departurePose=preparing?departureChoreography(departure,travel/hold,ride.departureRiders?.[index]):undefined;
      const choreography=moving?{riding:1,walk:0,stage:vehicle.stage,poseTime:0}:departurePose?{...departurePose,poseTime:0}:stopChoreography(stop,Math.max(0,ride.actionTime-index*.12),stop===0&&ride.from>.001);
      const speed=moving?(sample?sample.rate*tracks![index].length/(ride.travelDuration*(1-hold)):Math.abs(distance/dt)):0;
      const lean=moving?THREE.MathUtils.clamp(-Math.atan(speed*speed*vehicle.curvature/9.81),-.22,.22):- .055*(1-THREE.MathUtils.smoothstep(choreography.riding,.65,.95));
      bike.group.position.copy(vehicle.point);bike.group.rotation.set(0,vehicle.heading,lean);
      const contact=floorCache[index];
      if(vehicle.stage==='cruise'&&moving){bike.group.position.y=vehicle.point.y;}
      else{
        if(Math.hypot(contact.x-vehicle.point.x,contact.z-vehicle.point.z)>.005){
          floorRay.set(vehicle.point.clone().addScaledVector(UP,5),new THREE.Vector3(0,-1,0));
          const floor=floorRay.intersectObjects(driveSurfaces,false)[0];contact.x=vehicle.point.x;contact.z=vehicle.point.z;contact.y=floor?floor.point.y+.002:vehicle.point.y;
        }
        bike.group.position.y=contact.y;
      }
      bike.steering.rotation.y=moving?THREE.MathUtils.clamp(Math.atan(1.56*vehicle.curvature),-.52,.52):0;
      const roll=wheelTravel[index];
      if(sample){if(roll.track===tracks![index])roll.odometer+=sample.distance-roll.distance;roll.track=tracks![index];roll.distance=sample.distance;}
      else{if(stop===2)roll.odometer+=(p-roll.road)*route.getLength();roll.track=undefined;}
      roll.road=p;bike.wheels.forEach((wheel,i)=>{wheel.rotation.x=-roll.odometer/bike.wheelRadii[i];});
      if(index===0)physicalStage=choreography.stage;
      const atStop=choreography.stage==='at-stop';
      const riding=choreography.riding,walk=choreography.walk;
      const sit=stop===3?(departurePose?.sit??(atStop?(ride.actionReplay?1:THREE.MathUtils.smoothstep(choreography.poseTime,0,.55)):0)):0;
      bike.brakeMat.emissiveIntensity=moving&&movingTime>.76?2.5:moving?.5:choreography.riding>.99?1:.03;
      bike.rider.visible=!people[index].applyPose&&riding>.96;
      bike.stand.visible=!moving&&riding<.6;
      bike.group.updateMatrixWorld(true);
      const tangent=new THREE.Vector3(Math.sin(vehicle.heading),0,Math.cos(vehicle.heading)),side=new THREE.Vector3(tangent.z,0,-tangent.x);
      const mounted=bike.group.localToWorld(new THREE.Vector3(0,0,-.12));
      const off=bike.group.position.clone().addScaledVector(side,.7);off.y=bike.group.position.y;
      const person=people[index],bodyShift=THREE.MathUtils.smoothstep(riding,.22,.80);
      person.group.position.copy(off).lerp(mounted,bodyShift);
      let angle=vehicle.heading,walkCycle=0,walkWeight=0;
      const walkPath=walkPaths.get(`${stop}:${index}`);
      if(walkPath&&riding<.001){
        person.group.position.copy(walkPath.getPointAt(walk));
        const direction=walkPath.getTangentAt(THREE.MathUtils.clamp(walk,.001,.999));if(choreography.stage==='walk-back')direction.negate();
        const destinationAngle=stop===3?cafe.rotation.y+(index===1?-Math.PI/2:Math.PI/2):destination.rotation.y;
        const walkingAngle=Math.atan2(direction.x,direction.z);
        const settle=THREE.MathUtils.smoothstep(walk,.91,1);
        angle=walkingAngle+Math.atan2(Math.sin(destinationAngle-walkingAngle),Math.cos(destinationAngle-walkingAngle))*settle;
        if(atStop||choreography.stage==='stand-up')angle=destinationAngle;
        const meters=walkPath.getLength()*(choreography.stage==='walk-back'?1-walk:walk);walkCycle=meters/1.35*Math.PI*2;
        walkWeight=THREE.MathUtils.smoothstep(walk,0,.07)*(1-THREE.MathUtils.smoothstep(walk,.93,1));
        if(stop===3)person.group.position.y-=.37*sit;
      }else if(atStop&&riding<.001){
        const target=stop===1?Math.atan2(-side.x,-side.z):Math.atan2(side.x,side.z);
        const turn=THREE.MathUtils.smoothstep(choreography.poseTime,0,.5);angle+=Math.atan2(Math.sin(target-angle),Math.cos(target-angle))*turn;
      }
      if(departurePose&&choreography.stage==='mount'){
        const initial=ride.departureRiders?.[index]?.riding?ride.departureRiders[index].heading:walkPath?Math.atan2(-walkPath.getTangentAt(.001).x,-walkPath.getTangentAt(.001).z):ride.departureRiders?.[index]?.heading??vehicle.heading+(stop===1?-Math.PI/2:Math.PI/2);
        angle=initial+Math.atan2(Math.sin(vehicle.heading-initial),Math.cos(vehicle.heading-initial))*departurePose.turn;
      }
      person.group.rotation.set(0,angle,lean*riding);
      person.group.updateMatrixWorld(true);
      let feet:THREE.Vector3[]|undefined;
      if(!walkPath||walk<.0001||riding>.001){
        feet=[0,1].map(i=>{
          const ground=bike.group.position.clone().addScaledVector(side,i===0?.56:.84).addScaledVector(tangent,.02);ground.y=bike.group.position.y+.16;
          const peg=bike.group.localToWorld(new THREE.Vector3(i===0?-.23:.23,.62,.09));
          if(i===0){
            // Lift behind the saddle, clear it horizontally, THEN lower onto
            // the far peg. A diagonal foot lerp cuts straight through the seat.
            const phase=THREE.MathUtils.smoothstep(riding,.08,.90),lift=THREE.MathUtils.smoothstep(phase,0,.22),cross=THREE.MathUtils.smoothstep(phase,.22,.72),lower=THREE.MathUtils.smoothstep(phase,.75,1);
            const x=lerp(lerp(.56,-.38,cross),-.23,lower),z=lerp(lerp(.02,-.62,lift),.09,lower),y=lerp(lerp(.16,1.36,lift),.62,lower);
            return bike.group.position.clone().addScaledVector(side,x).addScaledVector(tangent,z).addScaledVector(UP,y);
          }
          const step=THREE.MathUtils.smoothstep(riding,.10,.35),phase=THREE.MathUtils.smoothstep(riding,.62,1);
          ground.addScaledVector(side,-.44*step).addScaledVector(UP,.10*Math.sin(step*Math.PI));
          return ground.lerp(peg,phase);
        });
        if(atStop)feet=undefined;
      }
      posePerson(person,stop,choreography.poseTime,index,1,walkWeight>.001,riding,{atStop,stopBlend:sit,walkCycle,walkWeight,feet,hands:bike.grips.map(grip=>grip.getWorldPosition(new THREE.Vector3()))});
      riderStates.push({riding,walk,sit,heading:angle});vehicleStates.push({point:bike.group.position.toArray() as [number,number,number],heading:vehicle.heading});
    });
    ride.riderStates=riderStates;ride.vehicleStates=vehicleStates;
    host.dataset.stage=physicalStage;
    ride.rigStage=physicalStage;
    leadPoint.copy(riders[0].group.position);
    leadTangent.set(Math.sin(riders[0].group.rotation.y),0,Math.cos(riders[0].group.rotation.y));
    host.dataset.vehicleProgress=ride.vehicleProgress.toFixed(4);host.dataset.vehicleX=leadPoint.x.toFixed(3);host.dataset.vehicleZ=leadPoint.z.toFixed(3);
    host.dataset.heading=riders[0].group.rotation.y.toFixed(3);host.dataset.steering=riders[0].steering.rotation.y.toFixed(3);

    view=ride.reduced ? Number(ride.wide) : lerp(view,Number(ride.wide),1-Math.exp(-dt*4));
    const rearPoint=riders[2].group.position, rearTangent=new THREE.Vector3(Math.sin(riders[2].group.rotation.y),0,Math.cos(riders[2].group.rotation.y));
    normal.set(rearTangent.z,0,-rearTangent.x);
    const pointerX=ride.reduced ? 0 : ride.pointer.x, pointerY=ride.reduced ? 0 : ride.pointer.y;
    targetCamera.copy(rearPoint).addScaledVector(rearTangent,-lerp(4.8,12,view)).addScaledVector(normal,-1.6-pointerX*.8).add(new THREE.Vector3(0,lerp(2.7,7.5,view)-pointerY*.45,0));
    lookAt.copy(rearPoint).addScaledVector(rearTangent,5.1); lookAt.y+=1.1;

    const stageLook=new THREE.Vector3();
    const stageCamera=new THREE.Vector3();
    const facing=new THREE.Vector3();
    const groupLook=people.reduce((center,person)=>center.add(person.group.position),new THREE.Vector3()).multiplyScalar(1/people.length).add(new THREE.Vector3(0,1.05,0));
    if(poseChapter===3){
      stageLook.copy(groupLook);
      facing.set(Math.sin(cafe.rotation.y),0,Math.cos(cafe.rotation.y));
      stageCamera.copy(stageLook).addScaledVector(facing,lerp(9.2,14,view)*(host.clientWidth<700?1.15:1)).add(new THREE.Vector3(facing.z*1.8,lerp(2.4,4.8,view),-facing.x*1.8));
    } else if(poseChapter===4){
      stageLook.copy(groupLook);
      facing.set(Math.sin(destination.rotation.y),0,Math.cos(destination.rotation.y));
      stageCamera.copy(stageLook).addScaledVector(facing,lerp(6.5,12,view)*(host.clientWidth<700?1.15:1)).add(new THREE.Vector3(facing.z*2.6,lerp(1.9,4,view),-facing.x*2.6));
    } else {
      stageLook.copy(people[1].group.position).add(new THREE.Vector3(0,1.1,0));
      const tangent=route.getTangentAt(ROUTE_STOPS[poseChapter]);
      facing.set(tangent.z,0,-tangent.x);
      if(poseChapter===1)facing.negate();
      stageCamera.copy(stageLook).addScaledVector(facing,lerp(6.5,12,view)*(host.clientWidth<700?1.18:1)).addScaledVector(tangent,-1.4).add(new THREE.Vector3(0,lerp(1.65,4.5,view),0));
    }
    stageCamera.addScaledVector(facing,pointerX*.65); stageCamera.y-=pointerY*.35;
    const parkedCamera=THREE.MathUtils.smoothstep(parked,.1,.9);
    targetCamera.lerp(stageCamera,parkedCamera);
    lookAt.lerp(stageLook,parkedCamera);
    // A taller portrait canvas has a narrower horizontal field of view.
    // Dolly back, rather than widening the lens, so the whole group stays in frame.
    const portraitFraming=Math.max(1,Math.min(2.5,1.05/camera.aspect));
    targetCamera.sub(lookAt).multiplyScalar(portraitFraming).add(lookAt);
    if(!cameraReady || ride.reduced){camera.position.copy(targetCamera);smoothLookAt.copy(lookAt);cameraReady=true;}
    else{camera.position.lerp(targetCamera,1-Math.exp(-dt*8));smoothLookAt.lerp(lookAt,1-Math.exp(-dt*8));}
    camera.lookAt(smoothLookAt);
    // Cut away an obstructing shop front while the chase camera passes it.
    // Buildings return smoothly as soon as the line of sight clears.
    sightline.origin.copy(camera.position);sightline.direction.copy(smoothLookAt).sub(camera.position).normalize();
    const sightDistance=camera.position.distanceTo(smoothLookAt);
    let cutawayChanged=false;
    cameraObstacles.forEach(obstacle=>{
      const hit=sightline.intersectBox(obstacle.box,obstacleHit);
      const hidden=obstacle.box.containsPoint(camera.position) || camera.position.distanceTo(obstacle.group.position)<8.5 || !!hit && camera.position.distanceTo(hit)<sightDistance-.6;
      const next=ride.reduced ? Number(!hidden) : lerp(obstacle.opacity,Number(!hidden),1-Math.exp(-dt*12));
      if(Math.abs(next-obstacle.opacity)>.001)cutawayChanged=true;
      obstacle.opacity=next;obstacle.group.visible=next>.015;
      obstacle.materials.forEach(mat=>{mat.opacity=next;});
    });
    const shadowMotion=distance>.000001 || Math.abs(parked-previousPark)>.0001 || ride.actionTime!==lastActionTime;
    lastActionTime=ride.actionTime;

    const day = THREE.MathUtils.smoothstep(ride.vehicleProgress, 0, .7);
    sky.uniforms.top.value.copy(dawnTop).lerp(dayTop, day); sky.uniforms.bottom.value.copy(dawnHorizon).lerp(dayHorizon, day); sky.uniforms.time.value = elapsed;
    sunDirection.set(-.55 + p * .8, .11 + day * .8, -.8).normalize(); sky.uniforms.sunDirection.value.copy(sunDirection);
    sunlight.position.copy(leadPoint).addScaledVector(sunDirection, 80); sunlight.target.position.copy(leadPoint);
    sunlight.intensity = lerp(1.7, 2.65, day); sunlight.color.setRGB(1, lerp(.73, .96, day), lerp(.46, .91, day));
    hemisphere.intensity = lerp(1.65, 1.85, day);
    (scene.fog as THREE.FogExp2).color.copy(dawnFog).lerp(dayFog, day);
    (scene.fog as THREE.FogExp2).density = lerp(.0085, .0038, day);
    water.uniforms.tint.value.copy(dawnWater).lerp(dayWater, day); water.uniforms.light.value = lerp(.6, 1, day); water.uniforms.time.value = elapsed;
    headlight.intensity = lerp(15, 0, day);
    lampGlow.emissiveIntensity = lerp(2, .05, day);
    steam.forEach((sprite, index) => { const cycle = (elapsed * .25 + index / 6) % 1; sprite.position.set(-1.6 + Math.sin(cycle * 3) * .08, 1.06 + cycle * .85, 3.6); sprite.scale.setScalar(.15 + cycle * .45); (sprite.material as THREE.SpriteMaterial).opacity = Math.sin(cycle * Math.PI) * .4; });
    renderer.shadowMap.needsUpdate = needsRender || shadowMotion || cutawayChanged;
    renderer.render(scene, camera);
    if(ride.phase==='action' && ride.chapter===4 && ride.actionTime>PHOTO_TIME && ride.actionVersion!==photoVersion) {
      photoVersion=ride.actionVersion;
      host.dispatchEvent(new CustomEvent('sunday-photo',{bubbles:true,detail:renderer.domElement.toDataURL('image/jpeg',.9)}));
    }
    needsRender = false; lastStaticProgress = p; lastStaticWide = ride.wide;
    frameCount++;
    if (now - fpsStart > 2000) { host.dataset.fps = String(Math.round(frameCount / ((now - fpsStart) / 1000))); frameCount = 0; fpsStart = now; }
    host.dataset.progress = p.toFixed(4);
    host.dataset.motion = ride.reduced ? 'reduced' : 'full';
    host.dataset.chapter = String(ride.chapter);
    host.dataset.phase = ride.phase;
    host.dataset.parked = parked.toFixed(3);
    host.dataset.action = ride.actionTime.toFixed(2);
    if(now-contactReported>800){
      contactReported=now;const front=riders[0].wheels[1].getWorldPosition(new THREE.Vector3());
      floorRay.set(front.clone().addScaledVector(UP,5),new THREE.Vector3(0,-1,0));const floorHit=floorRay.intersectObjects(driveSurfaces,false)[0];
      host.dataset.tireGroundGap=floorHit?(front.y-riders[0].wheelRadii[1]*Math.cos(riders[0].group.rotation.z)-floorHit.point.y).toFixed(4):'outside-surface';
    }
  };
  raf = requestAnimationFrame(draw);

  return () => {
    disposed = true; cancelAnimationFrame(raf); observer.disconnect();
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
        if (object instanceof THREE.Mesh) geometries.add(object.geometry);
        const mats = Array.isArray(object.material) ? object.material : [object.material];
        mats.forEach(mat => { materials.add(mat); for (const value of Object.values(mat)) if (value instanceof THREE.Texture) textures.add(value); });
      }
    });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(mat => mat.dispose()); textures.forEach(texture => texture.dispose());
    sunlight.shadow.map?.dispose(); renderer.dispose(); renderer.domElement.remove();
  };
}
