import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { createPerson, type Person } from './actors';
import { solveLimb, orientJoint } from './limbIK';

export type BikeStyle='roadster'|'sport'|'adventure';
let femaleTemplate:THREE.Group|undefined,maleTemplate:THREE.Group|undefined,headTemplate:THREE.Group|undefined;
let headColor:THREE.Texture|undefined,headNormal:THREE.Texture|undefined;
let pending:Promise<void>|undefined;
export function detailedRideActorsReady() { return !!femaleTemplate && !!maleTemplate && !!headTemplate; }

export function prepareRideActors() {
  if(pending)return pending;
  const loader=new GLTFLoader(),textures=new THREE.TextureLoader();
  pending=Promise.all([
    loader.loadAsync('/ride-actors/michelle.glb').then(g=>{femaleTemplate=g.scene;}),
    loader.loadAsync('/ride-actors/rider.glb').then(g=>{maleTemplate=g.scene;}),
    loader.loadAsync('/ride-actors/head.glb').then(g=>{headTemplate=g.scene;}),
    textures.loadAsync('/ride-actors/head-color.jpg').then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.flipY=false;headColor=t;}),
    textures.loadAsync('/ride-actors/head-normal.jpg').then(t=>{t.flipY=false;headNormal=t;}),
  ]).then(()=>undefined).catch(error=>{pending=undefined;console.warn('Detailed ride actors unavailable.',error);});
  return pending;
}

export function createHuman(jacketColor:string,skinColor:string,female:boolean,style:BikeStyle,fit?:{hipHeight:number;lean:number;seatedHipHeight?:number}):Person {
  const template=maleTemplate;
  if(!template || !headTemplate)return createPerson(jacketColor,skinColor);
  const group=new THREE.Group(),model=clone(template) as THREE.Group;
  model.rotation.y=Math.PI;
  group.add(model);group.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model);
  model.scale.multiplyScalar((female?1.74:1.84)/box.getSize(new THREE.Vector3()).y);
  group.updateMatrixWorld(true);
  const scaled=new THREE.Box3().setFromObject(model);
  model.position.y-=scaled.min.y;model.position.x-=scaled.getCenter(new THREE.Vector3()).x;
  group.updateMatrixWorld(true);
  const bones=new Map<string,THREE.Bone>();
  model.traverse(object=>{if(object instanceof THREE.Bone)bones.set(object.name.replace(/^mixamorig[:_]?/i,''),object);});
  const bone=(name:string)=>{const b=bones.get(name);if(!b)throw new Error('Missing actor joint: '+name);return b;};
  // Targets are screen/world sides, not anatomical labels: a rider facing +Z
  // has their anatomical right on -X. Keeping these aligned avoids crossed limbs.
  const left=[bone('RightArm'),bone('RightForeArm'),bone('RightHand')] as const;
  const right=[bone('LeftArm'),bone('LeftForeArm'),bone('LeftHand')] as const;
  const feet=[['RightUpLeg','RightLeg','RightFoot'],['LeftUpLeg','LeftLeg','LeftFoot']].map(names=>names.map(bone));
  const hips=bone('Hips'),head=bone('Head'),spine=bone('Spine');
  const rest=[...bones.values()].map(b=>({bone:b,q:b.quaternion.clone(),p:b.position.clone(),s:b.scale.clone()}));
  const modelOrigin=model.position.clone();
  const hipHeight=group.worldToLocal(hips.getWorldPosition(new THREE.Vector3())).y;
  const seatLift=(fit?.hipHeight??1.28)-hipHeight;
  const materials:THREE.MeshStandardMaterial[]=[];

  model.traverse(object=>{
    if(!(object instanceof THREE.SkinnedMesh))return;
    object.frustumCulled=false;object.castShadow=object.receiveShadow=true;
    const body=(object.material as THREE.MeshStandardMaterial).clone();body.transparent=true;body.roughness=.82;materials.push(body);
    if(/visor/i.test(body.name)){object.visible=false;return;}
    const jacket=body.clone();jacket.map=null;jacket.color.set(jacketColor);jacket.roughness=.86;materials.push(jacket);
    const pants=body.clone();pants.map=null;pants.color.set('#293945');materials.push(pants);
    const geometry=object.geometry.clone();object.geometry=geometry;
    const index=geometry.getIndex(),skinIndex=geometry.getAttribute('skinIndex'),skinWeight=geometry.getAttribute('skinWeight');
    if(index && skinIndex && skinWeight) {
      const groups=[[],[],[]] as number[][];
      const region=(vertex:number)=>{
        const weights={head:0,jacket:0,pants:0};
        for(let j=0;j<4;j++) {
          const name=object.skeleton.bones[skinIndex.getComponent(vertex,j)]?.name||'';
          const w=skinWeight.getComponent(vertex,j);
          if(/Head|Neck/i.test(name))weights.head+=w;
          if(/Spine|Shoulder|ForeArm|(?:Left|Right)Arm/i.test(name))weights.jacket+=w;
          if(/UpLeg|(?:Left|Right)Leg|Hips/i.test(name))weights.pants+=w;
        }
        if(weights.head>.28)return -1;
        return weights.jacket>.55?1:weights.pants>.65?2:0;
      };
      for(let i=0;i<index.count;i+=3){const triangle=[index.getX(i),index.getX(i+1),index.getX(i+2)];const regions=triangle.map(region);if(regions.includes(-1))continue;const category=regions.filter(r=>r===1).length>=2?1:regions.filter(r=>r===2).length>=2?2:0;groups[category].push(...triangle);}
      geometry.clearGroups();let start=0;const indices:number[]=[];
      groups.forEach((list,materialIndex)=>{indices.push(...list);geometry.addGroup(start,list.length,materialIndex);start+=list.length;});
      geometry.setIndex(indices);object.material=[body,jacket,pants];
    } else object.material=body;
  });

  const mat=(color:string,roughness=.6)=>{const m=new THREE.MeshStandardMaterial({color,roughness,transparent:true});materials.push(m);return m;};
  const mesh=(parent:THREE.Object3D,geometry:THREE.BufferGeometry,material:THREE.Material)=>{const m=new THREE.Mesh(geometry,material);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
  const replacementHead=new THREE.Group();group.add(replacementHead);
  if(!female){
    const scan=clone(headTemplate);replacementHead.add(scan);
    const bounds=new THREE.Box3().setFromObject(scan),size=bounds.getSize(new THREE.Vector3());
    scan.scale.multiplyScalar(.31/size.y);scan.updateMatrixWorld(true);
    const fitted=new THREE.Box3().setFromObject(scan),center=fitted.getCenter(new THREE.Vector3());
    scan.position.set(-center.x,-fitted.min.y-.035,-center.z+.005);
    scan.traverse(o=>{if(o instanceof THREE.Mesh){o.material=new THREE.MeshStandardMaterial({color:skinColor,map:headColor,normalMap:headNormal,normalScale:new THREE.Vector2(.55,.55),roughness:.68,transparent:true});materials.push(o.material as THREE.MeshStandardMaterial);o.castShadow=true;}});
  } else if(femaleTemplate) {
    // Preserve the woman's modeled face, but replace the fashion outfit with
    // the same protective jacket, trousers and boots as the other riders.
    const faceModel=clone(femaleTemplate),faceRoot=new THREE.Group();faceRoot.add(faceModel);faceRoot.updateMatrixWorld(true);
    const faceBounds=new THREE.Box3().setFromObject(faceModel);faceModel.scale.multiplyScalar(1.74/faceBounds.getSize(new THREE.Vector3()).y);faceRoot.updateMatrixWorld(true);
    let faceJoint:THREE.Bone|undefined;faceModel.traverse(o=>{if(o instanceof THREE.Bone && /mixamorig[:_]?Head$/i.test(o.name))faceJoint=o;});
    const faceOrigin=faceJoint!.getWorldPosition(new THREE.Vector3());
    faceModel.traverse(o=>{
      if(!(o instanceof THREE.SkinnedMesh))return;
      const positions=o.geometry.getAttribute('position'),weights=o.geometry.getAttribute('skinWeight'),indices=o.geometry.getAttribute('skinIndex'),sourceIndex=o.geometry.index!;
      const baked:THREE.Vector3[]=[],keep:boolean[]=[];
      for(let i=0;i<positions.count;i++){
        const v=new THREE.Vector3().fromBufferAttribute(positions,i);o.applyBoneTransform(i,v);v.applyMatrix4(o.matrixWorld).sub(faceOrigin);baked.push(v);
        let headWeight=0;for(let j=0;j<4;j++)if(/Head|Neck/.test(o.skeleton.bones[indices.getComponent(i,j)].name))headWeight+=weights.getComponent(i,j);
        keep.push(headWeight>.65 && Math.abs(v.x)<.115 && v.y<.27 && v.z>-.12 && v.z<.16);
      }
      const triangles:number[]=[];for(let i=0;i<sourceIndex.count;i+=3){const tri=[sourceIndex.getX(i),sourceIndex.getX(i+1),sourceIndex.getX(i+2)];if(tri.every(v=>keep[v]))triangles.push(...tri);}
      const faceGeometry=o.geometry.clone();faceGeometry.deleteAttribute('skinIndex');faceGeometry.deleteAttribute('skinWeight');faceGeometry.setAttribute('position',new THREE.Float32BufferAttribute(baked.flatMap(v=>v.toArray()),3));faceGeometry.setIndex(triangles);faceGeometry.clearGroups();faceGeometry.computeVertexNormals();
      const faceMaterial=(o.material as THREE.MeshStandardMaterial).clone();faceMaterial.metalness=0;faceMaterial.metalnessMap=null;faceMaterial.roughness=.8;faceMaterial.roughnessMap=null;faceMaterial.transparent=true;materials.push(faceMaterial);mesh(replacementHead,faceGeometry.toNonIndexed(),faceMaterial);faceGeometry.dispose();
    });
    const hair=mat('#211c1a',.88);
    const cap=mesh(replacementHead,new THREE.SphereGeometry(1,20,14),hair);cap.scale.set(.113,.14,.102);cap.position.set(0,.17,-.023);
    const ponytail=mesh(replacementHead,new THREE.CapsuleGeometry(.043,.16,6,12),hair);ponytail.position.set(0,.10,-.13);ponytail.rotation.x=-.3;
  }
  const helmet=new THREE.Group();group.add(helmet);
  const shell=mesh(helmet,new THREE.SphereGeometry(.16,24,16),mat(female?'#f0eee8':'#243640',.22));shell.scale.set(.95,1.09,1.1);
  mesh(helmet,new THREE.SphereGeometry(.165,20,12,Math.PI/2-.82,1.64,.75,1.07),mat('#122b3a',.12)).position.z=.018;
  const chin=mesh(helmet,new THREE.BoxGeometry(.23,.05,.06),mat(female?'#e8ebe7':'#243640',.3));chin.position.set(0,-.095,.14);
  const vent=mesh(chin,new THREE.BoxGeometry(.08,.012,.006),mat('#17282e'));vent.position.z=.033;
  const stripe=mesh(helmet,new THREE.BoxGeometry(.035,.012,.23),mat(jacketColor));stripe.position.y=.174;
  const cup=new THREE.Group();group.add(cup);
  mesh(cup,new THREE.CylinderGeometry(.056,.044,.1,16),mat('#d49055')).position.y=.03;
  const tea=mesh(cup,new THREE.CircleGeometry(.05,16),mat('#70442a'));tea.rotation.x=-Math.PI/2;tea.position.y=.083;
  const phone=mesh(group,new THREE.BoxGeometry(.073,.144,.015),mat('#193238',.25));
  const screen=mesh(phone,new THREE.PlaneGeometry(.060,.12),mat('#92d9be'));screen.position.z=.009;
  const dummyArm=()=>({upper:new THREE.Group(),forearm:new THREE.Group(),hand:new THREE.Group()});
  const local=(point:THREE.Vector3)=>group.worldToLocal(point);
  const world=(point:number[])=>group.localToWorld(new THREE.Vector3(...point));
  const follow=(object:THREE.Object3D,joint:THREE.Bone,offset:THREE.Vector3)=>object.position.copy(local(joint.getWorldPosition(new THREE.Vector3()))).add(offset);

  const applyPose:NonNullable<Person['applyPose']>=(chapter,time,index,opacity,walking,riding,physical)=>{
    group.visible=opacity>.02;materials.forEach(m=>{m.opacity=opacity;});
    rest.forEach(r=>{r.bone.quaternion.copy(r.q);r.bone.position.copy(r.p);r.bone.scale.copy(r.s);});
    model.position.copy(modelOrigin);model.position.y+=seatLift*THREE.MathUtils.smoothstep(riding,.62,1);
    if(!riding)head.rotateY(Math.sin(time*.9+index)*.06);
    group.updateWorldMatrix(true,true);
    const levelHead=head.getWorldQuaternion(new THREE.Quaternion());
    const lean=(fit?.lean??(style==='sport'?.95:style==='adventure'?.45:.65))*riding;
    const spinePosition=spine.getWorldPosition(new THREE.Vector3());
    orientJoint(spine,bone('Spine1'),spinePosition.add(new THREE.Vector3(0,Math.cos(lean),Math.sin(lean)).applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion()))));
    if(riding>.01){head.quaternion.copy(head.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(levelHead));head.updateWorldMatrix(false,true);}
    let lh=[-.25,1.05,.08],rh=[.25,1.05,.08];
    const atStop=physical?.atStop??(!walking&&riding<.1);
    const sit=chapter===3?(physical?.stopBlend??(atStop?1:0)):0;
    const seated=sit>.01;
    if(seated){model.position.y+=((fit?.seatedHipHeight??.87)-hipHeight)*sit;group.updateWorldMatrix(true,true);}
    const action=time;
    if(chapter===0){const lift=THREE.MathUtils.smoothstep(time,.25,1.55),release=THREE.MathUtils.smoothstep(time,1.8,2.7);const headY=local(head.getWorldPosition(new THREE.Vector3())).y+.11;helmet.position.set(0,THREE.MathUtils.lerp(1.08,headY,lift),THREE.MathUtils.lerp(.42,.04,lift));lh=[-.13,THREE.MathUtils.lerp(helmet.position.y,1.05,release),THREE.MathUtils.lerp(helmet.position.z+.04,.08,release)];rh=[.13,lh[1],lh[2]];}
    if(chapter===1){const greet=Math.sin(Math.min(1,time/2.7)*Math.PI);rh=[.30,1.04+greet*.30,.1+greet*.32];}
    if(seated){const toast=THREE.MathUtils.smoothstep(action,.15,1.0),sip=THREE.MathUtils.smoothstep(action,1.4,2.1)-THREE.MathUtils.smoothstep(action,2.65,3.3);rh=[.23,1.04+toast*.2+sip*.27,.40-sip*.18];lh=[-.21,.97,.39];}
    if(chapter===4 && atStop){const lift=THREE.MathUtils.smoothstep(action,.1,1);if(index===0)lh=[-.33,1.02+lift*.64,.18+lift*.52];else if(index===2)rh=[.34,1.04+lift*.43,.20+lift*.23];}
    if(chapter===5&&atStop){lh=[-.12,1.18,.39];rh=[.08,1.12+Math.sin(Math.min(time,1.9)*9)*.01,.41];head.rotateX(.12);}
    if(walking){const cycle=physical?.walkCycle??time*7,weight=physical?.walkWeight??1;lh=[-.25,1.05,.08+Math.sin(cycle)*.2*weight];rh=[.25,1.05,.08-Math.sin(cycle)*.2*weight];}
    const handleY=style==='sport'?1.23:style==='adventure'?1.49:1.40;
    const rideHands=[[-.39,handleY,.54],[.39,handleY,.54]];
    [lh,rh].forEach((target,i)=>{for(let j=0;j<3;j++)target[j]=THREE.MathUtils.lerp(target[j],rideHands[i][j],riding);});
    const handTargets=[world(lh),world(rh)].map((target,i)=>physical?.hands?.[i]?target.lerp(physical.hands[i],riding):target);
    solveLimb(...left,handTargets[0],world([-.65,1.22,.45]));solveLimb(...right,handTargets[1],world([.65,1.22,.45]));
    [left,right].forEach((arm,i)=>{
      const prefix=i===0?'Right':'Left',finger=bone(prefix+'HandMiddle1');
      const holding=riding>.1 || seated&&i===1 || chapter===0 || chapter===4&&index===0&&i===0 || chapter===5&&i===0;
      const direction=holding?[0,.04,.12]:[0,-.15,.025];
      if(chapter===4&&index===2&&i===1){direction[1]=.15;direction[2]=.02;}
      orientJoint(arm[2],finger,arm[2].getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(...direction).applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion()))));
      for(const name of ['Index','Middle','Ring','Pinky'])for(const segment of [1,2,3])bones.get(prefix+'Hand'+name+segment)?.rotateX(holding?.55:.12);
      arm[2].scale.setScalar(.80);
    });
    feet.forEach(([upper,lower,end],i)=>{
      const side=i===0?-1:1;
      const foot=[side*.12,THREE.MathUtils.lerp(.16,.55,sit),.4*sit];
      if(walking){const phase=(((physical?.walkCycle??time*7)/Math.PI/2+i*.5)%1+1)%1,weight=physical?.walkWeight??1;
        const swing=(phase-.62)/.38;foot[1]+=(phase<.62?0:.16*Math.sin(swing*Math.PI))*weight;
        foot[2]=(phase<.62?.42-phase/.62*.84:-.42+THREE.MathUtils.smoothstep(swing,0,1)*.84)*weight;
      }
      const target=[THREE.MathUtils.lerp(foot[0],side*.23,riding),THREE.MathUtils.lerp(foot[1],.62,riding),THREE.MathUtils.lerp(foot[2],.21,riding)];
      const footWorld=world(target);
      if(physical?.feet?.[i])footWorld.lerp(physical.feet[i],atStop?1:THREE.MathUtils.smoothstep(riding,0,1));
      solveLimb(upper,lower,end,footWorld,world([side*.26,.74,.9]));
      orientJoint(end,bone(i===0?'RightToeBase':'LeftToeBase'),footWorld.clone().add(new THREE.Vector3(0,-.035,.18).applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion()))));
      end.scale.setScalar(.88);
    });
    group.updateWorldMatrix(true,true);
    follow(replacementHead,head,new THREE.Vector3());const q=group.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(head.getWorldQuaternion(new THREE.Quaternion()));replacementHead.quaternion.copy(q);
    const headPosition=local(head.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0,.10,.015));
    if(chapter!==0 || riding>.1)helmet.position.copy(headPosition);
    helmet.quaternion.copy(q);
    helmet.visible=chapter<3 || !atStop;
    cup.visible=seated&&atStop;phone.visible=atStop&&((chapter===4&&index===0)||chapter===5);
    follow(cup,right[2],new THREE.Vector3(0,.03,.02));follow(phone,left[2],new THREE.Vector3(0,.012,.018));phone.rotation.set(-.12,chapter===4?Math.PI:0,0);
  };
  return {group,left:dummyArm(),right:dummyArm(),legs:[],helmet,cup,phone,materials,applyPose};
}
