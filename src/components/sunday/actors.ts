import * as THREE from 'three';

type Arm = { upper: THREE.Group; forearm: THREE.Group; hand: THREE.Group };
type Leg = { upper: THREE.Group; calf: THREE.Group };
export type PhysicalPose={atStop?:boolean;stopBlend?:number;walkCycle?:number;walkWeight?:number;feet?:THREE.Vector3[];hands?:THREE.Vector3[]};
export type Person = { group: THREE.Group; left: Arm; right: Arm; legs: Leg[]; helmet: THREE.Group; cup: THREE.Group; phone: THREE.Mesh; materials: THREE.MeshStandardMaterial[]; applyPose?: (chapter:number,time:number,index:number,opacity:number,walking:boolean,riding:number,physical?:PhysicalPose)=>void };

// Tailored clothing has a shoulder line, waist and cuffs, not capsule silhouettes.
export function tailoredGeometry(rings: [number, number, number][]) {
  const positions: number[] = [], indices: number[] = [];
  const profile = [[-.72,-1],[.72,-1],[1,-.65],[1,.65],[.72,1],[-.72,1],[-1,.65],[-1,-.65]];
  rings.forEach(([y,width,depth]) => profile.forEach(([x,z]) => positions.push(x*width,y,z*depth)));
  for (let row=0;row<rings.length-1;row++) for(let j=0;j<8;j++) { const a=row*8+j,b=row*8+(j+1)%8,c=a+8,d=b+8; indices.push(a,c,b,b,c,d); }
  for(let j=1;j<7;j++) { indices.push(0,j,j+1); const last=(rings.length-1)*8; indices.push(last,last+j+1,last+j); }
  const geometry=new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

export function createPerson(jacketColor: string, skinColor: string): Person {
  const group = new THREE.Group();
  const materials: THREE.MeshStandardMaterial[] = [];
  const mat = (color: string, roughness = .8) => { const material = new THREE.MeshStandardMaterial({ color, roughness, transparent: true }); materials.push(material); return material; };
  const jacket = mat(jacketColor), pants = mat('#303a49'), shoes = mat('#192835'), skin = mat(skinColor), helmetMat = mat('#f4ead6', .24), visor = mat('#233d49', .18), hair = mat('#30302d');
  const mesh = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => {
    const item = new THREE.Mesh(geometry, material); item.position.set(x, y, z); item.castShadow = true; item.receiveShadow = true; parent.add(item); return item;
  };
  mesh(group, tailoredGeometry([[.94,.145,.095],[1.08,.16,.11],[1.35,.20,.12],[1.48,.225,.11],[1.55,.12,.095]]), jacket);
  const trim=mat('#303a3c'), reflective=mat('#ddd9c6');
  mesh(group,new THREE.BoxGeometry(.012,.48,.018),reflective,0,1.25,.127);
  mesh(group,new THREE.CylinderGeometry(.096,.087,.06,12),trim,0,1.56);
  mesh(group,new THREE.CylinderGeometry(.058,.066,.12,10),skin,0,1.62);
  // Adult proportions: a defined jaw, brow, ears and smaller head.
  const headProfile=[[-.145,.04],[-.115,.075],[-.07,.105],[.025,.116],[.085,.105],[.125,.08],[.145,.025]].map(([y,r])=>new THREE.Vector2(r,y));
  const head=mesh(group,new THREE.LatheGeometry(headProfile,20),skin,0,1.78,.005); head.scale.z=.84;
  const hairMesh=mesh(group,new THREE.SphereGeometry(.116,20,10,0,Math.PI*2,0,1.32),hair,0,1.81,-.014); hairMesh.scale.set(1,1.04,.89);
  mesh(group,new THREE.ConeGeometry(.023,.05,4),skin,0,1.78,.109).rotation.x=Math.PI/2;
  mesh(group,new THREE.BoxGeometry(.044,.006,.005),mat('#744c3e'),0,1.721,.086);
  for(const side of [-1,1]) {
    mesh(group,new THREE.SphereGeometry(.008,8,6),hair,side*.042,1.81,.098);
    mesh(group,new THREE.BoxGeometry(.034,.006,.008),hair,side*.043,1.829,.096);
    const ear=mesh(group,new THREE.SphereGeometry(.023,10,8),skin,side*.114,1.785); ear.scale.set(.4,1,.65);
    mesh(group,new THREE.BoxGeometry(.115,.025,.008),reflective,side*.115,1.43,.125);
    mesh(group,new THREE.BoxGeometry(.07,.095,.012),trim,side*.104,1.19,.12);
    mesh(group,new THREE.BoxGeometry(.055,.06,.014),jacket,side*.104,1.2,.128);
  }

  const arm = (side: number): Arm => {
    const upper = new THREE.Group(); upper.position.set(side*.23,1.46,0); group.add(upper);
    mesh(upper,new THREE.CylinderGeometry(.077,.059,.32,12),jacket,0,-.16);
    const shoulder=mesh(upper,new THREE.SphereGeometry(.079,12,8),trim); shoulder.scale.z=.8;
    const forearm = new THREE.Group(); forearm.position.y = -.32; upper.add(forearm);
    mesh(forearm,new THREE.CylinderGeometry(.06,.04,.29,12),jacket,0,-.145);
    mesh(forearm,new THREE.CylinderGeometry(.044,.044,.04,12),trim,0,-.28);
    const hand = new THREE.Group(); hand.position.y = -.33; forearm.add(hand);
    const palm=mesh(hand,new THREE.BoxGeometry(.063,.077,.032),skin); palm.rotation.z=side*.06;
    for(let finger=0;finger<4;finger++) mesh(hand,new THREE.CylinderGeometry(.007,.005,.049,6),skin,(finger-1.5)*.015,-.058,.003);
    const thumb=mesh(hand,new THREE.CylinderGeometry(.009,.006,.046,6),skin,-side*.038,-.005,.012); thumb.rotation.z=side*.42;
    return { upper,forearm,hand };
  };
  const left = arm(-1), right = arm(1);
  const legs = [-1,1].map(side => {
    const upper = new THREE.Group(); upper.position.set(side*.12,.96,0); group.add(upper);
    mesh(upper,new THREE.CylinderGeometry(.09,.07,.4,12),pants,0,-.2);
    mesh(upper,new THREE.BoxGeometry(.105,.1,.025),trim,0,-.36,.066);
    const calf = new THREE.Group(); calf.position.y = -.4; upper.add(calf);
    mesh(calf,new THREE.CylinderGeometry(.07,.045,.39,12),pants,0,-.2);
    mesh(calf,new THREE.BoxGeometry(.115,.18,.15),shoes,0,-.36,.025);
    const boot = mesh(calf,new THREE.BoxGeometry(.12,.085,.24),shoes,0,-.45,.07); boot.geometry.computeVertexNormals();
    mesh(calf,new THREE.BoxGeometry(.126,.022,.244),trim,0,-.498,.07);
    return { upper,calf };
  });
  const helmet = new THREE.Group(); helmet.position.set(0,1.78,.02); group.add(helmet);
  const shell = mesh(helmet,new THREE.SphereGeometry(.153,24,18),helmetMat); shell.scale.set(.95,1.09,1.05);
  const face = mesh(helmet,new THREE.SphereGeometry(.157,20,12,-.8,1.6,.72,1.1),visor,0,.01,.022);
  face.rotation.y = 0;
  mesh(helmet,new THREE.BoxGeometry(.035,.012,.21),mat(jacketColor),0,.166,0);
  mesh(helmet,new THREE.BoxGeometry(.08,.016,.025),trim,0,-.099,.132);

  const cup = new THREE.Group(); right.hand.add(cup); cup.position.set(.015,-.03,.035);
  mesh(cup,new THREE.CylinderGeometry(.08,.055,.12,12),mat('#d29761'),0,.035);
  const tea = mesh(cup,new THREE.CircleGeometry(.069,12),mat('#805131'),0,.097); tea.rotation.x = -Math.PI/2;
  const phone = mesh(left.hand,new THREE.BoxGeometry(.075,.135,.016),mat('#1a292d'),0,-.045,.02);
  const screen = mesh(phone,new THREE.PlaneGeometry(.06,.1),mat('#84cfb8'),0,0,.01); screen.castShadow = false;
  cup.visible = phone.visible = false;
  return { group,left,right,legs,helmet,cup,phone,materials };
}

export function posePerson(person: Person, chapter: number, time: number, index: number, opacity: number, walking=false, riding=0,physical?:PhysicalPose) {
  if(person.applyPose){person.applyPose(chapter,time,index,opacity,walking,riding,physical);return;}
  person.materials.forEach(material => { material.opacity = opacity; });
  person.group.visible = opacity > .025;
  person.helmet.visible = chapter < 3;
  person.helmet.position.set(0,1.78,.02);
  person.cup.visible = chapter === 3;
  person.phone.visible = chapter === 5;
  person.left.upper.rotation.set(-.08,0,-.1); person.right.upper.rotation.set(-.08,0,.1);
  person.left.forearm.rotation.x = person.right.forearm.rotation.x = -.08;
  person.legs.forEach(leg => { leg.upper.rotation.x = 0; leg.calf.rotation.x = 0; });
  if (chapter === 0) {
    const lift = THREE.MathUtils.smoothstep(time,.2,1.1);
    const lower = 1 - THREE.MathUtils.smoothstep(time,1.25,2.0);
    person.helmet.position.set(.14 * (1-lift),1.1 + lift*.68,.37*(1-lift)+.02);
    person.left.upper.rotation.x = person.right.upper.rotation.x = -2.4 * lower * lift;
    person.left.forearm.rotation.x = person.right.forearm.rotation.x = .65 * lift * lower;
  } else if (chapter === 1) {
    person.right.upper.rotation.x = -2.8;
    person.right.upper.rotation.z = .25 + Math.sin(time*7+index)*.16;
    person.right.forearm.rotation.x = -.2;
  } else if (chapter === 3) {
    person.legs.forEach(leg => { leg.upper.rotation.x = -1.35; leg.calf.rotation.x = 1.3; });
    const cheers = Math.sin(Math.min(1,time/2.4)*Math.PI);
    person.right.upper.rotation.x = -1.1 - cheers*.65;
    person.right.forearm.rotation.x = -.85 - cheers*.45;
    person.left.upper.rotation.x = -.7; person.left.forearm.rotation.x = -.5;
  } else if (chapter === 4) {
    person.right.upper.rotation.x = -2.6;
    person.right.upper.rotation.z = .3 + Math.sin(time*5+index)*.08;
    person.right.forearm.rotation.x = -.3;
  } else if (chapter === 5) {
    person.left.upper.rotation.x = -.75; person.left.forearm.rotation.x = -1.65;
    person.right.upper.rotation.x = -.8; person.right.forearm.rotation.x = -1.4 + (time<1.3 ? Math.sin(time*15)*.065 : 0);
  }
}
