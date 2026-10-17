import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createHuman, detailedRideActorsReady, prepareRideActors } from '../humanActors';
import { posePerson } from '../actors';

export async function loadGameAssets() {
  const [bike] = await Promise.all([new GLTFLoader().loadAsync('/ride-bikes/hunter-350.glb'), prepareRideActors()]);
  if (!detailedRideActorsReady()) throw new Error('Detailed rider assets could not load. Please retry.');
  return bike.scene;
}
export function createGameRider(template: THREE.Group, female: boolean, jacket: string, paint: string) {
  const root = new THREE.Group(), lean = new THREE.Group(); root.add(lean);
  const bike = template.clone(true); lean.add(bike);
  const materialCopies = new Map<THREE.Material, THREE.Material>();
  bike.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = object.receiveShadow = true;
    const cloneMaterial = (source: THREE.MeshStandardMaterial) => {
      if (!materialCopies.has(source)) {
        const mat = source.clone(); materialCopies.set(source, mat);
        // This is a documented in-game repaint of the licensed mesh, not a claim
        // to reproduce every factory Tokyo Black decal from a photograph.
        if (/Surface28/.test(mat.name)) { mat.color.set(paint); mat.metalness = .5; mat.roughness = .26; }
        if (/Surface33/.test(mat.name)) { mat.color.set('#211e1b'); mat.metalness = 0; mat.roughness = .87; }
        if (/Surface32/.test(mat.name)) { mat.metalness = .15; mat.roughness = .65; }
      }
      return materialCopies.get(source)!;
    };
    object.material = Array.isArray(object.material) ? object.material.map(m => cloneMaterial(m as THREE.MeshStandardMaterial)) : cloneMaterial(object.material as THREE.MeshStandardMaterial);
  });
  const front = bike.getObjectByName('WheelFront')!, rear = bike.getObjectByName('WheelRear')!, steering = bike.getObjectByName('Steering')!;
  const grips = ['GripLeft', 'GripRight'].map(name => bike.getObjectByName(name)!);
  const pegs = ['FootLeft', 'FootRight'].map(name => bike.getObjectByName(name)!);
  const person = createHuman(jacket, '#d2a180', female, 'roadster', { hipHeight: .92, lean: .68, seatedHipHeight: .66 });
  // This game never crossfades actor opacity. Opaque gear avoids doubled
  // transparent draw passes and improves depth/shadow stability around hands.
  person.materials.forEach(material => { material.transparent = false; material.needsUpdate = true; });
  // Keep the ground shadow, but do not reproject a delayed/coarse shadow-map
  // silhouette back onto the animated jacket and limbs (visible as flicker).
  person.group.traverse(object=>{if(object instanceof THREE.Mesh)object.receiveShadow=false;});
  // The seated rider belongs to the same rigid lean frame as the motorcycle.
  // Banking two siblings independently made the pelvis slip across the saddle.
  lean.add(person.group);
  const steeringAxis = new THREE.Vector3(...steering.userData.axis).normalize();
  let oldOdometer = 0, previousWalk = 0, personYaw = 0;
  const handTargets = grips.map(() => new THREE.Vector3()), footTargets = pegs.map(() => new THREE.Vector3());
  const updateVehicle = (x:number,z:number,heading:number,bank:number,steer:number,odometer:number) => {
    root.position.set(x, .055, z); root.rotation.y = heading;
    lean.rotation.z = bank; steering.quaternion.setFromAxisAngle(steeringAxis, steer);
    const travel = odometer - oldOdometer; oldOdometer = odometer;
    front.rotation.x += travel / Number(front.userData.radius); rear.rotation.x += travel / Number(rear.userData.radius);
  };
  const setPose = (x: number, z: number, heading: number, bank: number, steer: number, odometer: number,
    mounted: number, walk: number, chapter: number, time: number, atStop: boolean, destination?: THREE.Vector3, speed = 1, facing = heading) => {
    updateVehicle(x,z,heading,bank,steer,odometer);
    person.group.position.set(-.70 * (1 - mounted) - .8 * walk, 0, -.21 + 1.8 * walk);
    let desiredYaw = atStop ? facing-heading : 0, walkLength = 3;
    const walkingBack = walk < previousWalk-.00001;
    const walking = Math.abs(walk-previousWalk)>.00001 && walk>.001 && walk<.999;
    if (destination && walk > 0) {
      root.updateMatrixWorld(true);
      const target = root.worldToLocal(destination.clone()); target.y = 0;
      const start = new THREE.Vector3(-.7,0,-.21);
      walkLength = target.distanceTo(start);
      person.group.position.lerpVectors(start, target, walk);
      if (walking) desiredYaw = Math.atan2(target.x-start.x,target.z-start.z) + (walkingBack ? Math.PI : 0);
    }
    person.group.position.y = -.035 * (1 - mounted);
    personYaw += Math.atan2(Math.sin(desiredYaw-personYaw),Math.cos(desiredYaw-personYaw))*.28;
    person.group.rotation.set(0,personYaw,0);
    root.updateMatrixWorld(true);
    // IK targets the wrist joint, not the palm: the curled fingers extend from
    // the wrist onto the grip. Targeting the grip itself overextends both arms.
    grips.forEach((grip, i) => { grip.getWorldPosition(handTargets[i]); handTargets[i].add(new THREE.Vector3(0, .025, -.09).applyQuaternion(steering.getWorldQuaternion(new THREE.Quaternion()))); });
    pegs.forEach((peg, i) => { peg.getWorldPosition(footTargets[i]); footTargets[i].y += .10; });
    const planted = 1 - THREE.MathUtils.smoothstep(speed, .15, 1.8);
    if (mounted > 0 && planted > 0) footTargets[0].lerp(root.localToWorld(new THREE.Vector3(-.32, .12, -.2)), planted);
    const seatedFeet = atStop && chapter === 3 ? [-1, 1].map(side => person.group.localToWorld(new THREE.Vector3(side * .16, .12, .36))) : undefined;
    posePerson(person, chapter, time, 0, 1, walking, mounted,
      { hands: handTargets, feet: seatedFeet ?? (mounted > 0 ? footTargets : undefined), atStop, walkCycle: (walkingBack ? 1-walk : walk) * walkLength * 4.5, walkWeight: 1, stopBlend: atStop ? 1 : 0 });
    previousWalk = walk;
  };
  return { root, bike, person, setPose, updateVehicle };
}
