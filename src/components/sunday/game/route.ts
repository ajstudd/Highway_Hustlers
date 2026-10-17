import * as THREE from 'three';
import data from '../../../data/bhopal-sunday-route.json';

// The real OSRM Bhopal loop, condensed to human-scale scenery for a short game.
// This is not a street-accurate simulator: the route keeps its geographic shape,
// but tiny junctions are rounded and distance is compressed uniformly.
const FACTOR = 111_320 * .085;
const ORIGIN = data.waypoints[0];
export const ROAD_HALF = 3.8;
export function geoToWorld(lng: number, lat: number) {
  return new THREE.Vector3((lng - ORIGIN[0]) * Math.cos(23.2 * Math.PI / 180) * FACTOR, 0, -(lat - ORIGIN[1]) * FACTOR);
}
export const routeCurves = data.legs.map(leg => {
  const points: THREE.Vector3[] = [];
  leg.coordinates.forEach(([lng, lat], index) => {
    const point = geoToWorld(lng, lat);
    if (!points.length || point.distanceTo(points[points.length - 1]) > 7 || index === leg.coordinates.length - 1) points.push(point);
  });
  return new THREE.CatmullRomCurve3(points, false, 'centripetal');
});
export const checkpoints = [0];
routeCurves.forEach(curve => checkpoints.push(checkpoints[checkpoints.length - 1] + curve.getLength()));
export const routeLength = checkpoints[5];
export type RoadSample = { x: number; z: number; heading: number; distance: number };
export const roadSamples: RoadSample[] = [];
routeCurves.forEach((curve, leg) => {
  const count = Math.ceil(curve.getLength());
  for (let index = 0; index < count; index++) {
    const point = curve.getPointAt(index / count), tangent = curve.getTangentAt(index / count);
    roadSamples.push({ x: point.x, z: point.z, heading: Math.atan2(tangent.x, tangent.z), distance: checkpoints[leg] + curve.getLength() * index / count });
  }
});
const last = routeCurves[4].getPointAt(1), lastDirection = routeCurves[4].getTangentAt(1);
roadSamples.push({ x: last.x, z: last.z, heading: Math.atan2(lastDirection.x, lastDirection.z), distance: routeLength });
export function angleDelta(a: number, b: number) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
export function sampleRoad(distance: number, offset = 0): RoadSample {
  distance = THREE.MathUtils.clamp(distance, 0, routeLength);
  let lo = 0, hi = roadSamples.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (roadSamples[mid].distance < distance) lo = mid; else hi = mid; }
  const a = roadSamples[lo], b = roadSamples[hi], blend = (distance - a.distance) / Math.max(.001, b.distance - a.distance);
  const heading = a.heading + angleDelta(b.heading, a.heading) * blend;
  return { x: THREE.MathUtils.lerp(a.x, b.x, blend) + Math.cos(heading) * offset,
    z: THREE.MathUtils.lerp(a.z, b.z, blend) - Math.sin(heading) * offset, heading, distance };
}
export function nearestRoad(x: number, z: number, around?: number, maximum = routeLength) {
  let best = Infinity, result = roadSamples[0];
  // Project onto continuous segments, not metre-spaced points. Restrict live
  // progress to the local branch so a nearby return road cannot steal it.
  const minimum = around === undefined ? 0 : Math.max(0, around - 8);
  const limit = Math.min(maximum, around === undefined ? routeLength : around + 14);
  let lo=0,hi=roadSamples.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(roadSamples[mid].distance<minimum)lo=mid;else hi=mid;}
  for (let index = lo; index < roadSamples.length - 1; index++) {
    const a = roadSamples[index], b = roadSamples[index + 1];
    if (a.distance > limit) break;
    if (b.distance < minimum) continue;
    const dx = b.x - a.x, dz = b.z - a.z, span = b.distance - a.distance;
    const t = THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/Math.max(.000001,dx*dx+dz*dz),
      Math.max(0,(minimum-a.distance)/span),Math.min(1,(limit-a.distance)/span));
    const px = a.x+dx*t, pz = a.z+dz*t, distance = (px-x)**2+(pz-z)**2;
    if (distance < best) {
      best = distance;
      result = {x:px,z:pz,heading:a.heading+angleDelta(b.heading,a.heading)*t,distance:a.distance+span*t};
    }
  }
  return { ...result, away: Math.sqrt(best), lateral: (x - result.x) * Math.cos(result.heading) - (z - result.z) * Math.sin(result.heading) };
}
export const bays = checkpoints.map((distance, index) => {
  const road = sampleRoad(index === 5 ? distance - 8 : distance + (index === 0 ? 9 : -8));
  // Each bay is on a real, clear apron. The player steers in before interacting.
  return { x: road.x + Math.cos(road.heading) * 6.8, z: road.z - Math.sin(road.heading) * 6.8, heading: road.heading, distance };
});
const homeRoad = sampleRoad(0);
export const home = (() => {
  let point={x:homeRoad.x,z:homeRoad.z,heading:homeRoad.heading-Math.PI/2};
  for(let offset=16;offset<90;offset+=2) {
    point={x:homeRoad.x+Math.cos(homeRoad.heading)*offset,z:homeRoad.z-Math.sin(homeRoad.heading)*offset,heading:homeRoad.heading-Math.PI/2};
    if(nearestRoad(point.x,point.z).away>10.5)break;
  }
  return point;
})();
// Keep the whole dhaba footprint off every road, including return segments.
export const cafeSite = (() => {
  const bay = bays[3];
  let point = { x: bay.x, z: bay.z, heading: bay.heading };
  for (let offset = 12; offset < 90; offset += 2) {
    point = { x: bay.x + Math.cos(bay.heading) * offset + Math.sin(bay.heading) * 2,
      z: bay.z - Math.sin(bay.heading) * offset + Math.cos(bay.heading) * 2, heading: bay.heading };
    if (nearestRoad(point.x, point.z).away > 10.5) break;
  }
  return point;
})();
export const activityPoints = bays.map((bay,index) => {
  if (index === 3) return new THREE.Vector3(cafeSite.x + Math.sin(bay.heading)*4.4,.025,cafeSite.z + Math.cos(bay.heading)*4.4);
  const side = index === 1 ? 1.8 : -2.8;
  return new THREE.Vector3(bay.x + Math.cos(bay.heading)*side + Math.sin(bay.heading)*2.4,.025,bay.z - Math.sin(bay.heading)*side + Math.cos(bay.heading)*2.4);
});
export const mapBounds = roadSamples.reduce((b, p) => ({ minX: Math.min(b.minX, p.x), maxX: Math.max(b.maxX, p.x), minZ: Math.min(b.minZ, p.z), maxZ: Math.max(b.maxZ, p.z) }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
export function mapPoint(x: number, z: number) {
  const scale = Math.min(164 / (mapBounds.maxX - mapBounds.minX), 132 / (mapBounds.maxZ - mapBounds.minZ));
  return [100 + (x - (mapBounds.minX + mapBounds.maxX) / 2) * scale, 82 + (z - (mapBounds.minZ + mapBounds.maxZ) / 2) * scale];
}
export const mapPath = roadSamples.filter((_, i) => i % 4 === 0).map((p, i) => `${i ? 'L' : 'M'}${mapPoint(p.x, p.z).map(v => v.toFixed(1)).join(',')}`).join(' ');
