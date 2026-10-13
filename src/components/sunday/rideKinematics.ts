import * as THREE from 'three';
import { ROUTE_STOPS, DISMOUNT_TIME, WALK_TIME, type RideMotion, type RiderState, type VehicleState } from './journey';

export const rideRoute=new THREE.CatmullRomCurve3([
  new THREE.Vector3(-48,2,42),new THREE.Vector3(-28,2.1,66),new THREE.Vector3(8,2.1,70),
  new THREE.Vector3(43,2.1,50),new THREE.Vector3(62,2,24),new THREE.Vector3(58,2.1,-5),
  new THREE.Vector3(39,2,-31),new THREE.Vector3(7,2,-49),new THREE.Vector3(-26,2.1,-40),
  new THREE.Vector3(-47,2,-11),new THREE.Vector3(-58,2,14),new THREE.Vector3(-52,2,34),
],true,'catmullrom',.35);
const length=rideRoute.getLength(),spacing=.012;
const wrap=(u:number)=>(u%1+1)%1;
const smooth=(x:number)=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
export const PARK_OFFSETS=[-5.9,5.9,0,-5.6,5.3,-5.9] as const;
export const DISMOUNT_SECONDS=DISMOUNT_TIME;
export const WALK_SECONDS=WALK_TIME;
export const STOP_ACTION_START=DISMOUNT_SECONDS+WALK_SECONDS;
export const ROAD_CLEARANCE=4.65;
export function roadPose(u:number,index=0){
  const point=rideRoute.getPointAt(wrap(u)),tangent=rideRoute.getTangentAt(wrap(u));
  const normal=new THREE.Vector3(tangent.z,0,-tangent.x);
  point.addScaledVector(normal,index%2?.75:-.75);point.y+=.006;
  return {point,tangent,normal,heading:Math.atan2(tangent.x,tangent.z)};
}
export function parkingPose(stop:number,index:number){
  const u=ROUTE_STOPS[stop]-index*.008;
  const {point,tangent,normal}=roadPose(u,index);
  point.addScaledVector(normal,PARK_OFFSETS[stop]-(index%2?.75:-.75));
  const heading=Math.atan2(tangent.x,tangent.z)+Math.sign(PARK_OFFSETS[stop])*.28;
  return {point,tangent:new THREE.Vector3(Math.sin(heading),0,Math.cos(heading)),normal:new THREE.Vector3(Math.cos(heading),0,-Math.sin(heading)),heading,u};
}
export function isParkingAccess(u:number,side:number){
  return ROUTE_STOPS.some((stop,index)=>index!==2 && Math.sign(side)===Math.sign(PARK_OFFSETS[index]) && Math.abs(((u-stop+.5)%1+1)%1-.5)<.066);
}
export function parkingApronGeometry(stop:number){
  const station=ROUTE_STOPS[stop],positions:number[]=[],indices:number[]=[];
  for(let i=0;i<=40;i++){
    const u=station-.063+i/40*.125,p=rideRoute.getPointAt(wrap(u)),t=rideRoute.getTangentAt(wrap(u)),side=Math.sign(PARK_OFFSETS[stop]);
    for(const offset of [side*3.12,side*7.0])positions.push(p.x+t.z*offset,p.y+.005,p.z-t.x*offset);
    if(i<40){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
class LaneCurve extends THREE.Curve<THREE.Vector3>{
  constructor(readonly start:number,readonly finish:number,readonly rider:number){super();this.arcLengthDivisions=180;}
  getPoint(t:number,target=new THREE.Vector3()){return target.copy(roadPose(THREE.MathUtils.lerp(this.start,this.finish,t),this.rider).point);}
}
export type Trajectory={path:THREE.CurvePath<THREE.Vector3>;length:number;exit:number;entry:number;from:number;to:number;fromStop:number;toStop:number;reverse:boolean};
const trajectories=new Map<string,Trajectory>();
export function trajectory(from:number,to:number,index:number,source?:VehicleState):Trajectory{
  const reverse=to<from;if(reverse)[from,to]=[to,from];
  const key=`${from.toFixed(6)}:${to.toFixed(6)}:${index}:${reverse}:${source?.point.join(',')}:${source?.heading}`;
  const cached=trajectories.get(key);if(cached)return cached;
  const fromIndex=Math.round(from*5),toIndex=Math.round(to*5);
  let fromStop=Math.abs(from-fromIndex/5)<.0001&&fromIndex!==2?fromIndex:-1;
  let toStop=Math.abs(to-toIndex/5)<.0001&&toIndex!==2?toIndex:-1;
  const routeU=(p:number)=>{const x=Math.min(4,Math.floor(p*5));return THREE.MathUtils.lerp(ROUTE_STOPS[x],ROUTE_STOPS[x+1],p*5-x);};
  const fromU=routeU(from)-index*spacing,toU=routeU(to)-index*spacing;
  const expected=reverse?(toStop>=0?parkingPose(toStop,index):roadPose(toU,index)):(fromStop>=0?parkingPose(fromStop,index):roadPose(fromU,index));
  const custom=source&&(new THREE.Vector3(...source.point).distanceTo(expected.point)>.02||Math.abs(Math.atan2(Math.sin(source.heading-expected.heading),Math.cos(source.heading-expected.heading)))>.02)?source:undefined;
  if(custom){if(reverse)toStop=-1;else fromStop=-1;}
  const span=Math.max(.0001,toU-fromU),turn=Math.min(17/length,span*.28);
  const startU=fromU+(fromStop>=0||custom&&!reverse?turn:0),endU=toU-(toStop>=0||custom&&reverse?turn:0);
  const path=new THREE.CurvePath<THREE.Vector3>();
  let exitLength=0,entryLength=0;
  if(fromStop>=0||custom&&!reverse){
    const park=custom&&!reverse?{point:new THREE.Vector3(...custom.point),tangent:new THREE.Vector3(Math.sin(custom.heading),0,Math.cos(custom.heading))}:parkingPose(fromStop,index),road=roadPose(startU,index);
    const exit=new THREE.CubicBezierCurve3(park.point,park.point.clone().addScaledVector(park.tangent,5),road.point.clone().addScaledVector(road.tangent,-6),road.point);
    path.add(exit);exitLength=exit.getLength();
  }
  path.add(new LaneCurve(startU,endU,index));
  if(toStop>=0||custom&&reverse){
    const park=custom&&reverse?{point:new THREE.Vector3(...custom.point),tangent:new THREE.Vector3(Math.sin(custom.heading),0,Math.cos(custom.heading))}:parkingPose(toStop,index),road=roadPose(endU,index);
    const entry=new THREE.CubicBezierCurve3(road.point,road.point.clone().addScaledVector(road.tangent,6),park.point.clone().addScaledVector(park.tangent,-5),park.point);
    path.add(entry);entryLength=entry.getLength();
  }
  const total=path.getLength();
  const result={path,length:total,exit:exitLength/total,entry:entryLength/total,from,to,fromStop,toStop,reverse};
  if(trajectories.size>60)trajectories.clear();trajectories.set(key,result);return result;
}
// Integral of a trapezoidal speed profile: zero speed at both parked endpoints,
// sustained cruise speed between them. The parameter measures wheel travel.
export function distanceProfile(time:number,startStopped=true,endStopped=true){
  const a=startStopped?.18:0,b=endStopped?.24:0,area=1-(a+b)/2;
  const t=THREE.MathUtils.clamp(time,0,1);
  if(a && t<a)return t*t/(2*a*area);
  if(b && t>1-b)return 1-(1-t)*(1-t)/(2*b*area);
  return (t-a/2)/area;
}
export function sampleTrajectory(track:Trajectory,time:number){
  const t=track.reverse?1-time:time;
  const s=distanceProfile(t,track.fromStop>=0,track.toStop>=0);
  const point=track.path.getPoint(s),tangent=track.path.getTangent(s).normalize();
  const before=track.path.getTangent(Math.max(0,s-.002)),after=track.path.getTangent(Math.min(1,s+.002));
  const curvature=Math.atan2(before.z*after.x-before.x*after.z,before.dot(after))/(Math.min(1,s+.002)-Math.max(0,s-.002))/track.length;
  const a=track.fromStop>=0?.18:0,b=track.toStop>=0?.24:0,area=1-(a+b)/2;
  const rate=a&&t<a?t/a/area:b&&t>1-b?(1-t)/b/area:1/area;
  return {point,tangent,heading:Math.atan2(tangent.x,tangent.z),curvature,distance:s*track.length,fraction:s,rate,
    stage:s<track.exit?'pull-out':s>1-track.entry?'pull-in':'cruise'};
}
export function stopChoreography(stop:number,time:number,arriving=false){
  if(stop===2)return {riding:1,walk:0,stage:'cruise',poseTime:time};
  if(stop===0&&!arriving)return {riding:0,walk:1,stage:'at-stop',poseTime:time};
  const riding=1-smooth(time/DISMOUNT_SECONDS);
  const walk=stop===3||stop===4?smooth((time-DISMOUNT_SECONDS)/WALK_SECONDS):0;
  return {riding,walk,stage:time<DISMOUNT_SECONDS?'dismount':(stop===3||stop===4)&&walk<1?'walk':'at-stop',poseTime:Math.max(0,time-(stop===3||stop===4?STOP_ACTION_START:DISMOUNT_SECONDS))};
}
export function departureChoreography(stop:number,time:number,initial?:RiderState){
  const walking=(stop===3||stop===4)&&(initial?.walk??1)>.001;
  const walk=walking?(initial?.walk??1)*(1-smooth((time-.10)/.50)):0;
  const mount=THREE.MathUtils.clamp((time-(walking?.60:0))/(walking?.40:1),0,1);
  const riding=THREE.MathUtils.lerp(initial?.riding??0,1,smooth((mount-.20)/.80));
  return {walk,riding,turn:smooth(mount/.20),sit:walking?(initial?.sit??(stop===3?1:0))*(1-smooth(time/.10)):0,stage:walking&&time<.10?'stand-up':walking&&time<.60?'walk-back':'mount'};
}
export function departureDuration(ride:RideMotion){
  const stop=Math.round(ride.from*5);
  if(Math.abs(ride.from-stop/5)>.0001||stop===2)return 0;
  const states=ride.departureRiders;
  const seconds=states?Math.max(...states.map(state=>(stop===3||stop===4?state.walk*3.6+state.sit*.6:0)+(1-state.riding)*2.2)):(stop===3?6.4:stop===4?5.8:2.2);
  return seconds/ride.travelDuration;
}

// Distance from every centerline sample to the actual oriented footprint,
// rather than testing just the building's center against its nearest station.
const roadSamples=rideRoute.getSpacedPoints(720);
export function footprintClearance(point:THREE.Vector3,heading:number,halfWidth:number,halfDepth:number){
  const c=Math.cos(heading),s=Math.sin(heading);let minimum=Infinity;
  for(const road of roadSamples){const dx=road.x-point.x,dz=road.z-point.z;
    const x=Math.abs(c*dx-s*dz),z=Math.abs(s*dx+c*dz);
    minimum=Math.min(minimum,Math.hypot(Math.max(0,x-halfWidth),Math.max(0,z-halfDepth)));
  }return minimum;
}
export function clearBuildingPosition(origin:THREE.Vector3,normal:THREE.Vector3,heading:number,halfWidth:number,halfDepth:number,localZ=0){
  const direction=normal.clone().multiplyScalar(Math.sign(origin.clone().sub(rideRoute.getPointAt(closestStation(origin))).dot(normal))||1);
  const position=origin.clone(),offset=new THREE.Vector3(Math.sin(heading)*localZ,0,Math.cos(heading)*localZ);
  for(let i=0;i<50;i++){
    const center=position.clone().add(offset);
    if(footprintClearance(center,heading,halfWidth,halfDepth)>=ROAD_CLEARANCE && !parkingConflict(center,heading,halfWidth,halfDepth))return position;
    position.addScaledVector(direction,1);
  }
  throw new Error('No safe roadside building footprint found');
}
function closestStation(point:THREE.Vector3){let min=Infinity,index=0;roadSamples.forEach((p,i)=>{const d=(p.x-point.x)**2+(p.z-point.z)**2;if(d<min){min=d;index=i;}});return index/720;}
function parkingConflict(center:THREE.Vector3,heading:number,w:number,d:number){
  const c=Math.cos(heading),s=Math.sin(heading);
  return ROUTE_STOPS.some((_,stop)=>stop!==2 && [0,1,2].some(index=>{
    const point=parkingPose(stop,index).point,dx=point.x-center.x,dz=point.z-center.z;
    return Math.hypot(Math.max(0,Math.abs(c*dx-s*dz)-w),Math.max(0,Math.abs(s*dx+c*dz)-d))<1.6;
  }));
}
