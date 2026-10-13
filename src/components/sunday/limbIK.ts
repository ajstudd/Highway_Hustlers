import * as THREE from 'three';

const origin=new THREE.Vector3(),childPosition=new THREE.Vector3();
const from=new THREE.Vector3(),to=new THREE.Vector3();
const rotation=new THREE.Quaternion(),worldRotation=new THREE.Quaternion(),parentRotation=new THREE.Quaternion();

export function orientJoint(bone:THREE.Bone,child:THREE.Bone,target:THREE.Vector3) {
  bone.getWorldPosition(origin);child.getWorldPosition(childPosition);
  from.copy(childPosition).sub(origin).normalize();to.copy(target).sub(origin).normalize();
  rotation.setFromUnitVectors(from,to);
  bone.getWorldQuaternion(worldRotation);
  bone.parent?.getWorldQuaternion(parentRotation);
  bone.quaternion.copy(parentRotation.invert().multiply(rotation).multiply(worldRotation)).normalize();
  bone.updateWorldMatrix(false,true);
}

/** Two-bone IK with an explicit knee/elbow pole, independent of imported bone axes. */
export function solveLimb(upper:THREE.Bone,lower:THREE.Bone,end:THREE.Bone,target:THREE.Vector3,pole:THREE.Vector3) {
  const a=upper.getWorldPosition(new THREE.Vector3()),b=lower.getWorldPosition(new THREE.Vector3()),c=end.getWorldPosition(new THREE.Vector3());
  const lengthA=a.distanceTo(b),lengthB=b.distanceTo(c);
  const direction=target.clone().sub(a);
  const distance=THREE.MathUtils.clamp(direction.length(),Math.abs(lengthA-lengthB)+.00001,lengthA+lengthB-.00001);
  if(direction.lengthSq()<.00000001)direction.copy(c).sub(a);
  direction.normalize();
  const perpendicular=pole.clone().sub(a).addScaledVector(direction,-pole.clone().sub(a).dot(direction));
  if(perpendicular.lengthSq()<.000001)perpendicular.set(direction.y,-direction.x,.1);
  perpendicular.normalize();
  const along=(distance*distance+lengthA*lengthA-lengthB*lengthB)/(2*distance);
  const bend=Math.sqrt(Math.max(0,lengthA*lengthA-along*along));
  const joint=a.clone().addScaledVector(direction,along).addScaledVector(perpendicular,bend);
  orientJoint(upper,lower,joint);orientJoint(lower,end,a.clone().addScaledVector(direction,distance));
}
