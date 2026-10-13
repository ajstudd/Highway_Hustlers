import data from '../../data/bhopal-sunday-route.json';

export const ROUTE_PLACES = ['Bhopal · city start', 'Boat Club · Upper Lake', 'Bhadbhada · heading out', 'Ratibad · breakfast stop', 'Kerwa Dam · lakeside', 'Bhopal · home again'];
export const waypoints = data.waypoints.map(([lng, lat]) => [lat, lng] as [number, number]);
export const legs = data.legs.map(leg => {
  const points = leg.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
  const lengths = [0];
  points.slice(1).forEach((point, i) => {
    const previous = points[i];
    lengths.push(lengths[i] + Math.hypot((point[0] - previous[0]), (point[1] - previous[1]) * Math.cos(point[0] * Math.PI / 180)));
  });
  return { points, lengths, length: lengths[lengths.length - 1] };
});
export const fullRoute = legs.flatMap(leg => leg.points);

// Geographic aspect ratio and north-up orientation for the race-style HUD.
const longitudeScale = Math.cos(23.2*Math.PI/180);
const eastings = fullRoute.map(point=>point[1]*longitudeScale);
const latitudes = fullRoute.map(point=>point[0]);
const west = Math.min(...eastings), east = Math.max(...eastings);
const south = Math.min(...latitudes), north = Math.max(...latitudes);
const scale = Math.min(184/(east-west),148/(north-south));
const insetX = (220-(east-west)*scale)/2;
const insetY = (184-(north-south)*scale)/2;

export function projectRoutePoint([lat,lng]:[number,number]):[number,number] {
  return [insetX+(lng*longitudeScale-west)*scale,insetY+(north-lat)*scale];
}
export function routePath(points:[number,number][]) {
  return points.map((point,index)=>{const [x,y]=projectRoutePoint(point);return `${index===0?'M':'L'}${x.toFixed(2)},${y.toFixed(2)}`;}).join(' ');
}
export const ROUTE_OUTLINE = routePath(fullRoute);

export function geographicPosition(progress: number) {
  const position = Math.max(0, Math.min(1, progress)) * 5;
  const index = Math.min(4, Math.floor(position));
  const leg = legs[index], distance = (position - index) * leg.length;
  let cursor = 1;
  while (cursor < leg.points.length - 1 && leg.lengths[cursor] < distance) cursor++;
  const a = leg.points[cursor - 1], b = leg.points[cursor];
  const fraction = (distance - leg.lengths[cursor - 1]) / Math.max(.000000001, leg.lengths[cursor] - leg.lengths[cursor - 1]);
  const point: [number, number] = [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction];
  return { point, index, traveled: [...legs.slice(0, index).flatMap(l => l.points), ...leg.points.slice(0, cursor), point] };
}
