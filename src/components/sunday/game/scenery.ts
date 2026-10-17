import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { activityPoints, bays, cafeSite, home, nearestRoad, roadSamples, routeLength, sampleRoad } from './route';

const UP = new THREE.Vector3(0, 1, 0);
export const mat = (color: string, roughness = .85, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
function random(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geo, material); object.position.set(x, y, z); object.castShadow = object.receiveShadow = true; parent.add(object); return object;
}
function box(parent: THREE.Object3D, size: number[], position: number[], material: THREE.Material) { return mesh(parent, new THREE.BoxGeometry(...size as [number, number, number]), material, ...position as [number, number, number]); }
function batchStatic(group: THREE.Group) {
  // Local static detail is authored separately, then submitted by material.
  // Keep child groups (notably the animated garage shutter) independent.
  const batches = new Map<string, { parts: THREE.BufferGeometry[]; material: THREE.Material; originals: THREE.Mesh[] }>();
  for (const child of [...group.children]) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
    const material = child.material as THREE.MeshStandardMaterial;
    const key = [material.color?.getHex(), material.roughness, material.metalness, material.map?.uuid ?? '', material.side].join(':');
    if (!batches.has(key)) batches.set(key, { parts: [], material, originals: [] });
    child.updateMatrix(); const geometry = child.geometry.clone(); geometry.applyMatrix4(child.matrix);
    batches.get(key)!.parts.push(geometry); batches.get(key)!.originals.push(child);
  }
  batches.forEach(({ parts, material, originals }) => {
    if (parts.length < 2) { parts.forEach(p => p.dispose()); return; }
    const merged = mergeGeometries(parts); parts.forEach(p => p.dispose()); if (!merged) return;
    originals.forEach(o => { group.remove(o); o.geometry.dispose(); }); mesh(group, merged, material);
  });
}
function tubeGeometry(a: THREE.Vector3, b: THREE.Vector3, radius: number) {
  const direction = b.clone().sub(a), geometry = new THREE.CylinderGeometry(radius * .7, radius, direction.length(), 6);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize())); geometry.translate(...a.clone().add(b).multiplyScalar(.5).toArray()); return geometry;
}
function roadGeometry(width: number, y: number) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  roadSamples.forEach((p, i) => {
    for (const side of [-1, 1]) { positions.push(p.x + Math.cos(p.heading) * width / 2 * side, y, p.z - Math.sin(p.heading) * width / 2 * side); uvs.push(side < 0 ? 0 : 1, p.distance / 6); }
    if (i < roadSamples.length - 1) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
  });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(indices); geo.computeVertexNormals(); return geo;
}
export function makeSign(text: string, sub = '', color = '#eeb04b') {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = color; ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = '#192721'; ctx.textAlign = 'center'; ctx.font = '700 90px sans-serif'; ctx.fillText(text, 512, sub ? 120 : 160);
  if (sub) { ctx.font = '500 34px sans-serif'; ctx.fillText(sub, 512, 198); }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: .9, side: THREE.DoubleSide });
}
function foliageGeometry(seed: number) {
  const rand = random(seed), positions: number[] = [], colors: number[] = [];
  // Hundreds of individual leaves, distributed along a branching crown. No
  // sphere crowns: negative space and lit leaf edges define the silhouette.
  for (let branch = 0; branch < 9; branch++) {
    const angle = branch / 9 * Math.PI * 2, radius = branch === 0 ? .3 : 1.6 + rand() * .7;
    const center = new THREE.Vector3(Math.cos(angle) * radius, 4.6 + rand() * 1.6, Math.sin(angle) * radius);
    for (let leaf = 0; leaf < 58; leaf++) {
      const point = center.clone().add(new THREE.Vector3((rand() - .5) * 3, (rand() - .5) * 1.9, (rand() - .5) * 3));
      const a = rand() * Math.PI * 2, tilt = (rand() - .5) * 1.4, length = .26 + rand() * .33;
      const across = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(length * .43);
      const along = new THREE.Vector3(-Math.sin(a) * Math.cos(tilt), Math.sin(tilt), Math.cos(a) * Math.cos(tilt)).multiplyScalar(length);
      const verts = [point.clone().sub(along), point.clone().sub(across), point.clone().add(along), point.clone().sub(along), point.clone().add(along), point.clone().add(across)];
      const color = new THREE.Color().setHSL(.26 + rand() * .08, .52 + rand() * .23, .095 + rand() * .14);
      verts.forEach(v => { positions.push(...v.toArray()); colors.push(color.r, color.g, color.b); });
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals(); return geo;
}
function treeBark() {
  const pieces = [tubeGeometry(new THREE.Vector3(), new THREE.Vector3(.15, 4.4, .12), .20)];
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; pieces.push(tubeGeometry(new THREE.Vector3(.1, 2.5 + i * .14, .08), new THREE.Vector3(Math.cos(a) * 2, 4.7 + i % 3 * .35, Math.sin(a) * 2), .08)); }
  const geo = mergeGeometries(pieces)!; pieces.forEach(p => p.dispose()); return geo;
}
export function buildScenery(scene: THREE.Scene, mobile: boolean) {
  const rand = random(181), loader = new THREE.TextureLoader(), textures: THREE.Texture[] = [];
  const waterRegions = [1, 4].map(index => { const b = bays[index]; return { x: b.x + Math.cos(b.heading) * 105, z: b.z - Math.sin(b.heading) * 105 }; });
  const waterRadius = (x: number, z: number) => Math.min(...waterRegions.map(p => Math.hypot((x - p.x) / 85, (z - p.z) / 65)));
  const inWater = (x: number, z: number) => waterRadius(x, z) < 1.1;
  function texture(path: string, color = true) {
    const t = loader.load(path); if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = mobile ? 2 : 4; textures.push(t); return t;
  }
  const asphalt = texture('/ride-environment/asphalt_02-Diffuse.jpg'), normal = texture('/ride-environment/asphalt_02-nor_gl.jpg', false);
  const roadMaterial = new THREE.MeshStandardMaterial({ map: asphalt, normalMap: normal, normalScale: new THREE.Vector2(.18, .18), color: '#a6afb4', roughness: .94, side: THREE.DoubleSide });
  // The outbound and homebound route share some streets. Stencil writes make
  // overlapping ribbon triangles render once instead of fighting at equal depth.
  roadMaterial.stencilWrite = true; roadMaterial.stencilRef = 1;
  roadMaterial.stencilFunc = THREE.NotEqualStencilFunc; roadMaterial.stencilZPass = THREE.ReplaceStencilOp;
  const shoulderMaterial=mat('#b6a47b');
  shoulderMaterial.stencilWrite=true;shoulderMaterial.stencilRef=2;
  shoulderMaterial.stencilFunc=THREE.NotEqualStencilFunc;shoulderMaterial.stencilZPass=THREE.ReplaceStencilOp;
  mesh(scene, roadGeometry(9.3, .018), shoulderMaterial).castShadow = false;
  mesh(scene, roadGeometry(7.6, .045), roadMaterial).castShadow = false;
  const grass = texture('/ride-environment/grass_path_2-Diffuse.jpg'); grass.repeat.set(450, 450);
  const terrain = new THREE.PlaneGeometry(2600, 2600, 280, 280); terrain.rotateX(-Math.PI / 2);
  const groundPoints = terrain.getAttribute('position');
  for (let i = 0; i < groundPoints.count; i++) {
    const radius = waterRadius(groundPoints.getX(i) - 400, groundPoints.getZ(i) + 50);
    groundPoints.setY(i, -.025 - 3 * THREE.MathUtils.smoothstep(1 - radius, 0, .28));
  }
  terrain.computeVertexNormals();
  const ground = mesh(scene, terrain, new THREE.MeshStandardMaterial({ map: grass, color: '#8cb56d', roughness: 1 }), -400, 0, 50); ground.castShadow = false;
  const paint = mat('#f6f0db'), asphaltBay = mat('#777b74');
  const count = Math.ceil(routeLength / 11), matrix = new THREE.Object3D();
  const lines = new THREE.InstancedMesh(new THREE.BoxGeometry(.12, .014, 3.5), paint, count);
  let lineCount = 0;
  const otherRoad=(x:number,z:number,distance:number,radius:number)=>roadSamples.some((p,index)=>index%2===0&&Math.abs(p.distance-distance)>25&&Math.hypot(p.x-x,p.z-z)<radius);
  for (let i = 0; i < count; i++) {
    const point = sampleRoad(i * 11);
    if (otherRoad(point.x,point.z,point.distance,5.5)) continue;
    matrix.position.set(point.x, .065, point.z); matrix.rotation.set(0, point.heading, 0); matrix.scale.set(1, 1, 1); matrix.updateMatrix(); lines.setMatrixAt(lineCount++, matrix.matrix);
  }
  lines.count = lineCount;
  lines.receiveShadow = true; scene.add(lines);
  // Continuous curved edge paint, opened at junctions. Long straight boxes
  // cut across bends and drew X-shaped stripes over intersecting roads.
  const edgePositions:number[]=[],edgeIndices:number[]=[];
  for(let i=0;i<roadSamples.length-1;i++)for(const side of [-1,1]) {
    const a=roadSamples[i],b=roadSamples[i+1];
    const ax=a.x+Math.cos(a.heading)*side*3.55,az=a.z-Math.sin(a.heading)*side*3.55;
    const bx=b.x+Math.cos(b.heading)*side*3.55,bz=b.z-Math.sin(b.heading)*side*3.55;
    if(otherRoad(ax,az,a.distance,4.3)||otherRoad(bx,bz,b.distance,4.3))continue;
    const n=edgePositions.length/3;
    for(const p of [a,b])for(const width of [-.055,.055])edgePositions.push(p.x+Math.cos(p.heading)*(side*3.55+width),.065,p.z-Math.sin(p.heading)*(side*3.55+width));
    edgeIndices.push(n,n+2,n+1,n+1,n+2,n+3);
  }
  const edgeGeometry=new THREE.BufferGeometry();edgeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(edgePositions,3));edgeGeometry.setIndex(edgeIndices);edgeGeometry.computeVertexNormals();
  mesh(scene,edgeGeometry,paint).castShadow=false;
  bays.forEach((bay, i) => {
    if (i === 2) return;
    const group = new THREE.Group(); group.position.set(bay.x, .005, bay.z); group.rotation.y = bay.heading; scene.add(group);
    box(group, [10, .04, 23], [0, 0, 0], asphaltBay);
    for (const side of [-1, 1]) box(group, [.07, .02, 4], [side * 1.1, .05, 0], paint);
    box(group, [2.25, .02, .07], [0, .05, 2], paint);
  });
  const treePositions: THREE.Vector3[] = [];
  const treeSections: number[] = [];
  const gap = mobile ? 13 : 8;
  for (let d = 15; d < routeLength; d += gap) {
    for (const side of [-1, 1]) for (let row = 0; row < (mobile ? 2 : 3); row++) {
      const p = sampleRoad(d + rand() * 3, side * (8.5 + row * 12 + rand() * 8));
      if (inWater(p.x, p.z) || nearestRoad(p.x, p.z).away < 8 || bays.some(b => Math.hypot(p.x - b.x, p.z - b.z) < 21) || Math.hypot(p.x - home.x, p.z - home.z) < 18 || Math.hypot(p.x-cafeSite.x,p.z-cafeSite.z)<23) continue;
      treePositions.push(new THREE.Vector3(p.x, 0, p.z));
      treeSections.push(Math.floor(d / 140));
    }
  }
  const barkGeometry = treeBark(), leafGeometry = foliageGeometry(73), barkMaterial = mat('#655344');
  const leafMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, side: THREE.DoubleSide });
  for (let section = 0; section <= Math.ceil(routeLength / 140); section++) {
    const positions = treePositions.filter((_, index) => treeSections[index] === section); if (!positions.length) continue;
    const bark = new THREE.InstancedMesh(barkGeometry, barkMaterial, positions.length), leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, positions.length);
    positions.forEach(p => { const i = positions.indexOf(p); matrix.position.copy(p); matrix.rotation.set(0, rand() * Math.PI * 2, 0); matrix.scale.setScalar(.9 + rand() * 1.1); matrix.updateMatrix(); bark.setMatrixAt(i, matrix.matrix); leaves.setMatrixAt(i, matrix.matrix); });
    bark.computeBoundingSphere(); leaves.computeBoundingSphere(); bark.castShadow = true; leaves.castShadow = true; leaves.receiveShadow = true; scene.add(bark, leaves);
  }
  const bridgeParts: THREE.BufferGeometry[] = [];
  for (let distance = 0; distance < routeLength; distance += 6) {
    const center = sampleRoad(distance); if (!inWater(center.x, center.z)) continue;
    for (const side of [-1, 1]) {
      const p = sampleRoad(distance, side * 3.6), next = sampleRoad(Math.min(routeLength, distance + 6), side * 3.6);
      bridgeParts.push(tubeGeometry(new THREE.Vector3(p.x, .05, p.z), new THREE.Vector3(p.x, 1.05, p.z), .055));
      bridgeParts.push(tubeGeometry(new THREE.Vector3(p.x, 1.05, p.z), new THREE.Vector3(next.x, 1.05, next.z), .04));
    }
  }
  if (bridgeParts.length) { const bridge = mesh(scene, mergeGeometries(bridgeParts)!, mat('#e0d7bd', .7, .2)); bridgeParts.forEach(p => p.dispose()); bridge.castShadow = true; }
  // Roadside scrub and tall grass provide the human-scale foreground.
  const blade = new THREE.BufferGeometry(); blade.setAttribute('position', new THREE.Float32BufferAttribute([-.08, 0, 0, .08, 0, 0, .13, .7, .04, 0, 0, -.08, 0, 0, .08, -.10, .52, .05], 3)); blade.computeVertexNormals();
  const tuftCount = mobile ? 2400 : 6000, tufts = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({ color: '#72a346', roughness: 1, side: THREE.DoubleSide }), tuftCount);
  let placed = 0;
  for (let i = 0; i < tuftCount; i++) {
    const p = sampleRoad(rand() * routeLength, (rand() > .5 ? 1 : -1) * (5 + rand() * 13));
    if (inWater(p.x, p.z) || nearestRoad(p.x, p.z).away < 4.7 || bays.some(b => Math.hypot(p.x - b.x, p.z - b.z) < 10)) continue;
    matrix.position.set(p.x, 0, p.z); matrix.rotation.set(0, rand() * 7, 0); matrix.scale.setScalar(.4 + rand() * .9); matrix.updateMatrix(); tufts.setMatrixAt(placed++, matrix.matrix);
  }
  tufts.count = placed;
  scene.add(tufts);
  const wallColors = ['#e5caa2', '#a5b9ac', '#c8977a', '#d7d6bd', '#b3c0ce'];
  function house(distance: number, side: number, index: number) {
    const road = sampleRoad(distance, side * (18 + rand() * 8));
    if (nearestRoad(road.x, road.z).away < 14 || bays.some(b => Math.hypot(b.x - road.x, b.z - road.z) < 22) || Math.hypot(home.x - road.x, home.z - road.z) < 15) return;
    const house = new THREE.Group(); house.position.set(road.x, 0, road.z); house.rotation.y = road.heading - side * Math.PI / 2; scene.add(house);
    const plaster = mat(wallColors[index % wallColors.length]), trim = mat('#eddfc9'), dark = mat('#28494b'), iron = mat('#3d4b49');
    const height = index % 3 === 0 ? 7 : 4;
    box(house, [7, height, 6], [0, height / 2, 0], plaster); box(house, [7.5, .22, 6.4], [0, height, 0], trim);
    box(house, [1.4, 2.5, .12], [0, 1.25, 3.02], mat('#665443'));
    for (const x of [-2.2, 2.2]) for (const y of height > 5 ? [2, 5.2] : [2]) {
      box(house, [1.4, 1.55, .2], [x, y, 3.03], trim); box(house, [1.15, 1.3, .21], [x, y, 3.10], dark);
      for (let k = 0; k < 4; k++) box(house, [.024, 1.3, .02], [x - .43 + k * .28, y, 3.23], iron);
      box(house, [1.8, .13, .8], [x, y + .9, 3.3], plaster);
    }
    const tank = mesh(house, new THREE.CylinderGeometry(.7, .7, 1.3, 12), mat('#283331'), -2, height + .65, -.7);
    tank.castShadow = true;
    for (const x of [-3.2, 3.2]) box(house, [.2, .65, 6], [x, height + .32, 0], plaster);
    for (const side of [-1, 1]) { box(house, [.12, 1.2, 1.2], [side * 3.54, 2, -.7], trim); box(house, [.13, .98, .98], [side * 3.59, 2, -.7], dark); }
    if (index % 4 === 0) { box(house, [2.5, 1, .08], [0, 3.3, 3.15], makeSign('किराना', 'GENERAL STORE', '#f3d16b')); }
    batchStatic(house);
  }
  for (let i = 0; i < 15; i++) { house(35 + i * 13, i % 2 ? 1 : -1, i); house(routeLength - 230 + i * 12, i % 2 ? -1 : 1, i + 3); }

  const garage = new THREE.Group(); garage.position.set(home.x, 0, home.z); garage.rotation.y = home.heading; scene.add(garage);
  const plaster = mat('#d8c6aa'), concrete = mat('#9a9b8d'), shutterMat = mat('#425354', .55, .4);
  box(garage, [6.8, .15, 10], [0, -.02, 1], concrete);
  box(garage, [.25, 3.3, 6], [-3, 1.65, -1], plaster); box(garage, [.25, 3.3, 6], [3, 1.65, -1], plaster);
  box(garage, [6.2, 3.3, .25], [0, 1.65, -4], plaster); box(garage, [6.5, .25, 6.4], [0, 3.4, -1], plaster);
  box(garage, [6.4, .5, .3], [0, 3.15, 2.2], plaster);
  const door = new THREE.Group(); door.position.set(0, 0, 2.2); garage.add(door);
  box(door, [5.8, 3, .12], [0, 1.5, 0], shutterMat);
  for (let i = 0; i < 16; i++) box(door, [5.8, .025, .15], [0, .1 + i * .18, .02], mat('#768889', .5, .4));
  box(garage, [2.3, .60, .08], [0, 3.36, 2.42], makeSign('HH GARAGE', '', '#eab14e'));
  // Tools, helmet shelf and a workbench make the opening feel inhabited.
  box(garage, [1.7, .12, .65], [-1.8, .95, -2.5], mat('#936d43'));
  for (const x of [-2.5, -1.1]) box(garage, [.07, .9, .45], [x, .45, -2.5], shutterMat);
  for (let i = 0; i < 7; i++) box(garage, [.06, .35 + i % 2 * .08, .04], [-2.4 + i * .2, 1.8, -3.83], mat('#adb6b2', .3, .75));
  batchStatic(door); batchStatic(garage);

  const activities = activityPoints;
  const breakfast = new THREE.Group(); breakfast.position.set(cafeSite.x+Math.cos(cafeSite.heading)*7.8-Math.sin(cafeSite.heading)*2,0,cafeSite.z-Math.sin(cafeSite.heading)*7.8-Math.cos(cafeSite.heading)*2); breakfast.rotation.y = bays[3].heading; scene.add(breakfast);
  box(breakfast,[8.2,.08,8],[-7.8,0,3.5],concrete);
  box(breakfast, [7, 3.7, 5], [-7.8, 1.85, 2], mat('#dfbc7b'));
  box(breakfast, [6.7, 2.7, .05], [-7.8, 1.5, 4.53], mat('#354039'));
  box(breakfast, [7.7, 1.1, .12], [-7.8, 4.05, 4.6], makeSign('CHAI & POHA', 'RATIBAD · सुबह की चाय', '#eec855'));
  for (let i = 0; i < 12; i++) box(breakfast, [.65, .09, 3.2], [-11.7 + i * .65, 2.8, 5.8], mat(i % 2 ? '#c65f3f' : '#eee1b9'));
  for (const x of [-11.6, -4]) box(breakfast, [.08, 2.8, .08], [x, 1.4, 7.3], shutterMat);
  const table = new THREE.Group(); table.position.copy(activities[3]); table.rotation.y = bays[3].heading; scene.add(table);
  mesh(table, new THREE.CylinderGeometry(.65, .65, .09, 24), mat('#238d89'), 0, .86, .65);
  mesh(table, new THREE.CylinderGeometry(.06, .09, .8, 12), shutterMat, 0, .4, .65);
  mesh(table, new THREE.CylinderGeometry(.22, .22, .06, 16), mat('#b87542'), 0, .46, 0);
  mesh(table, new THREE.CylinderGeometry(.05, .04, .44, 8), shutterMat, 0, .22, 0);
  for (const x of [-.25, .25]) {
    mesh(table, new THREE.CylinderGeometry(.055, .04, .105, 16), mat('#be7952'), x, .96, .7);
    mesh(table, new THREE.CylinderGeometry(.21, .21, .025, 24), mat('#f3e5c6'), x, .93, .35);
    const poha = mesh(table, new THREE.SphereGeometry(1, 16, 8), mat('#e6c238'), x, .96, .35); poha.scale.set(.17, .04, .17);
    for (let i = 0; i < 7; i++) mesh(table, new THREE.SphereGeometry(.018, 5, 4), mat(i % 2 ? '#f4de86' : '#5b9a3e'), x + (rand() - .5) * .23, 1, .35 + (rand() - .5) * .23);
  }
  batchStatic(table); batchStatic(breakfast);
  const lakes: THREE.Mesh[] = [];
  for (const index of [1, 4]) {
    const bay = bays[index], center = new THREE.Vector3(bay.x + Math.cos(bay.heading) * 105, -.04, bay.z - Math.sin(bay.heading) * 105);
    const water = new THREE.MeshPhysicalMaterial({ color: '#087a86', roughness: .32, metalness: .05, clearcoat: .4 });
    const lake = mesh(scene, new THREE.CircleGeometry(1, 80), water, center.x, center.y, center.z); lake.rotation.x = -Math.PI / 2; lake.scale.set(85, 65, 1); lake.castShadow = false; lakes.push(lake);
    // Cut away the ground beneath the water with a raised, shoreline-scale bowl.
    lake.position.y = -.6;
    const rail = new THREE.Group(); rail.position.set(bay.x + Math.cos(bay.heading) * 12, 0, bay.z - Math.sin(bay.heading) * 12); rail.rotation.y = bay.heading; scene.add(rail);
    for (let i = -4; i <= 4; i++) box(rail, [.12, 1.1, .12], [0, .55, i * 2], concrete);
    box(rail, [.13, .10, 17], [0, 1.08, 0], plaster);
    box(rail, [.13, .10, 17], [0, .52, 0], plaster);
    if (index === 4) box(rail, [3.8, 1, .1], [-1.8, 2.5, 0], makeSign('KERWA', 'GOOD MORNING, BHOPAL', '#80b7a0'));
    batchStatic(rail);
  }
  // Distant hills sit outside the road envelope, rather than obstructing it.
  const hillMat = mat('#568965');
  for (let i = 0; i < 22; i++) {
    const p = sampleRoad(rand() * routeLength, (i % 2 ? 1 : -1) * (170 + rand() * 160));
    const rx=90+rand()*90,rz=80+rand()*80;
    if (nearestRoad(p.x, p.z).away < Math.max(rx,rz)+12) continue;
    const hill = mesh(scene, new THREE.SphereGeometry(1, 24, 12), hillMat, p.x, -15, p.z); hill.scale.set(rx,30+rand()*50,rz); hill.castShadow = false;
  }
  const ring = mesh(scene, new THREE.RingGeometry(1.4, 1.49, 64), new THREE.MeshBasicMaterial({ color: '#f5a524', transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2;
  const arrowGeo = new THREE.BufferGeometry(); arrowGeo.setAttribute('position', new THREE.Float32BufferAttribute([-.45, 0, -.55, 0, 0, -.15, .45, 0, -.55, .45, 0, -.32, 0, 0, .2, -.45, 0, -.32], 3)); arrowGeo.setIndex([0, 1, 5, 1, 4, 5, 1, 2, 3, 1, 3, 4]); arrowGeo.computeVertexNormals();
  const arrows = Array.from({ length: 5 }, () => mesh(scene, arrowGeo, new THREE.MeshBasicMaterial({ color: '#f5b934', side: THREE.DoubleSide, transparent: true, opacity: .78, depthWrite: false })));
  return { garage, door, activities, ring, arrows, lakes, textures };
}
