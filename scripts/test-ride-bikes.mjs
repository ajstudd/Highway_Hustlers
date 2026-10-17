import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';

// Inspect the actual exported GLB without a DOM, network, or texture decoder.
const path = new URL('../public/ride-bikes/hunter-350.glb', import.meta.url);
const bytes = await readFile(path);
assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length);
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
const nodes = gltf.nodes.map(node => {
  const object = new THREE.Object3D();
  object.name = node.name;
  if (node.matrix) object.applyMatrix4(new THREE.Matrix4().fromArray(node.matrix));
  else {
    if (node.translation) object.position.fromArray(node.translation);
    if (node.rotation) object.quaternion.fromArray(node.rotation);
    if (node.scale) object.scale.fromArray(node.scale);
  }
  object.userData = node.extras ?? {};
  return object;
});
gltf.nodes.forEach((node, index) => node.children?.forEach(child => nodes[index].add(nodes[child])));
const scene = new THREE.Group();
gltf.scenes[gltf.scene ?? 0].nodes.forEach(index => scene.add(nodes[index]));
scene.updateMatrixWorld(true);
const find = name => {
  const object = scene.getObjectByName(name);
  assert.ok(object, `Missing rig node: ${name}`);
  return object;
};
const front = find('WheelFront'), rear = find('WheelRear'), steering = find('Steering');
assert.equal(front.parent, steering, 'The front wheel must turn with the steering assembly');
assert.equal(find('GripLeft').parent, steering);
assert.equal(find('GripRight').parent, steering);
assert.equal(rear.parent, find('Hunter350'));
assert.equal(find('Hunter350').userData.license, 'CC-BY-4.0');
const axle = object => object.getWorldPosition(new THREE.Vector3());
const wheelbase = axle(front).z - axle(rear).z;
assert.ok(Math.abs(wheelbase - 1.37) < .002, `Wheelbase is ${wheelbase}, expected 1.37 m`);
assert.ok(axle(front).z > axle(rear).z, 'Motorcycle must face +Z');
const boundsFor = parent => {
  const bounds = new THREE.Box3();
  gltf.nodes.forEach((node, index) => {
    let current = nodes[index];
    while (current && current !== parent) current = current.parent;
    if (!current || node.mesh === undefined) return;
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      const accessor = gltf.accessors[primitive.attributes.POSITION];
      bounds.union(new THREE.Box3(new THREE.Vector3(...accessor.min), new THREE.Vector3(...accessor.max)).applyMatrix4(nodes[index].matrixWorld));
    }
  });
  return bounds;
};
const bounds = boundsFor(find('Hunter350'));
const size = bounds.getSize(new THREE.Vector3());
assert.ok(size.z > 2 && size.z < 2.15, `Unexpected length ${size.z}`);
assert.ok(size.y > 1.15 && size.y < 1.35, `Unexpected height ${size.y}`);
assert.ok(size.x > .7 && size.x < .9, `Unexpected width ${size.x}`);
assert.ok(Math.abs(bounds.min.y) < .003, 'Tyres must sit on the ground');
for (const wheel of [front, rear]) {
  const before = axle(wheel);
  const wheelBounds = boundsFor(wheel);
  assert.ok(Math.abs(wheelBounds.min.y) < .02, `${wheel.name} floats above the ground`);
  assert.ok(wheelBounds.getSize(new THREE.Vector3()).y > .55, 'Missing tyre geometry');
  wheel.rotateX(Math.PI * .71);
  scene.updateMatrixWorld(true);
  assert.ok(before.distanceTo(axle(wheel)) < 1e-6, 'Wheel rotation must not orbit the axle');
  wheel.rotation.x = 0;
}
scene.updateMatrixWorld(true);
const previousFront = axle(front), previousRear = axle(rear);
const frontOrientation = front.getWorldQuaternion(new THREE.Quaternion());
const gripBefore = axle(find('GripLeft'));
steering.quaternion.setFromAxisAngle(new THREE.Vector3(...steering.userData.axis).normalize(), .3);
scene.updateMatrixWorld(true);
assert.ok(front.getWorldQuaternion(new THREE.Quaternion()).angleTo(frontOrientation) > .29, 'Front wheel orientation must follow steering');
assert.ok(axle(front).distanceTo(previousFront) < .03, 'The raked axis must pass close to the axle, not orbit the front wheel around the tank');
assert.ok(axle(rear).distanceTo(previousRear) < 1e-6, 'Rear axle must not steer');
assert.ok(axle(find('GripLeft')).distanceTo(gripBefore) > .03, 'Grips must follow steering');
const triangles = gltf.meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((n, primitive) => n + gltf.accessors[primitive.indices].count / 3, 0), 0);
assert.ok(triangles < 150_000, `${triangles} exceeds geometry budget`);
assert.ok(gltf.meshes.length < 40, 'Parts must be batched by animated assembly');
assert.ok(bytes.length < 6_000_000, 'Asset exceeds download budget');
console.log(`Hunter rig verified: ${triangles.toLocaleString()} triangles; ${gltf.meshes.length} batches; ${(bytes.length / 1e6).toFixed(2)} MB; ${wheelbase.toFixed(3)} m wheelbase.`);
