import { angleDelta, bays, checkpoints, nearestRoad, sampleRoad } from './route';
import type { GameState } from './controller';

export function createCompanion(index: number) {
  const bay = bays[1], offset = 2.6 + index * 2;
  return { x: bay.x + Math.cos(bay.heading) * offset, z: bay.z - Math.sin(bay.heading) * offset,
    heading: bay.heading, speed: 0, steering: 0, lean: 0, odometer: 0, distance: checkpoints[1] - 8, mounted: 0, walk: .15 };
}
export type Companion = ReturnType<typeof createCompanion>;
export function advanceCompanion(npc: Companion, index: number, player: GameState, dt: number) {
  if (player.paused || player.chapter < 2) return;
  const chapter = Math.min(5, player.chapter), bay = bays[chapter];
  const road = nearestRoad(npc.x, npc.z, npc.distance, checkpoints[chapter] + 12);
  const progressStep=Math.max(.15,npc.speed*dt*2);
  npc.distance+=Math.max(-progressStep,Math.min(progressStep,road.distance-npc.distance));
  const parking = chapter !== 2 && checkpoints[chapter] - npc.distance < 30;
  const offset = 2.6 + index * 2, parkingX = bay.x + Math.cos(bay.heading) * offset, parkingZ = bay.z - Math.sin(bay.heading) * offset;
  const gap = Math.hypot(npc.x - parkingX, npc.z - parkingZ);
  const arrived = parking && gap < 2.4 && npc.speed < .5;
  const wantsToRide = !arrived && player.phase !== 'complete';
  npc.mounted += ((wantsToRide ? 1 : 0) - npc.mounted) * Math.min(1, dt * 2.5);
  npc.walk = (1 - npc.mounted) * .15;
  if (npc.mounted < .97 && wantsToRide) return;
  const look = parking && checkpoints[chapter] - npc.distance < 18 ? { x: parkingX, z: parkingZ } : sampleRoad(npc.distance + 5 + npc.speed * .45, .9);
  const angle = angleDelta(Math.atan2(look.x - npc.x, look.z - npc.z), npc.heading);
  const desired = Math.abs(angle)>1.8 ? Math.sign(angle)*.58 : Math.atan2(2 * 1.37 * Math.sin(angle), Math.max(3, Math.hypot(look.x - npc.x, look.z - npc.z)));
  npc.steering += (desired - npc.steering) * Math.min(1, dt * 8);
  // Keep a loose group at the visitor's pace, rather than riding at a fixed
  // 6 m/s until the player leaves everyone far behind. Catch up by riding,
  // never by changing position or spawning a rider beside the camera.
  const spacing=player.distance+12+index*9-npc.distance;
  const cruising=player.phase==='ride' ? Math.max(0,Math.min(18.5,player.speed+spacing*.22)) : 9;
  let cornerSpeed=18.5;
  for(const ahead of [0,5,10,15]) {
    const a=sampleRoad(npc.distance+ahead),b=sampleRoad(npc.distance+ahead+5);
    const curve=Math.abs(angleDelta(b.heading,a.heading))/5;
    cornerSpeed=Math.min(cornerSpeed,Math.sqrt(2.8/Math.max(.008,curve)+4*ahead));
  }
  const target = arrived ? 0 : parking ? Math.min(5, Math.sqrt(Math.max(0, gap - 1.4) * 2)) : Math.abs(angle) > .8 || road.away > 4 ? 3 : Math.min(cruising,cornerSpeed,Math.abs(angle)>.35?7:18.5);
  npc.speed = Math.max(0, npc.speed + Math.max(-5.5 * dt, Math.min(2.1 * dt, target - npc.speed)));
  const turn = npc.speed * Math.tan(npc.steering) / 1.37;
  npc.heading += turn * dt; npc.x += Math.sin(npc.heading) * npc.speed * dt; npc.z += Math.cos(npc.heading) * npc.speed * dt;
  npc.odometer += npc.speed * dt; npc.lean += (-Math.atan2(npc.speed * turn, 9.81) - npc.lean) * Math.min(1, dt * 5);
}
