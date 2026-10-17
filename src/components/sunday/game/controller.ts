import { activityPoints, angleDelta, bays, checkpoints, home, nearestRoad, routeLength, sampleRoad } from './route';

export type RidePhase = 'garage' | 'mount' | 'ride' | 'dismount' | 'activity' | 'remount' | 'complete';
export type GameInput = { throttle: number; brake: number; steer: number };
export type GameState = {
  phase: RidePhase; chapter: number; x: number; z: number; heading: number; speed: number;
  steering: number; lean: number; distance: number; odometer: number; timer: number;
  paused: boolean; assist: boolean; guided: boolean; reduced: boolean; ready: boolean;
  actionDone: boolean; photo: number; overtakes: number; companions: number[]; passed: boolean[];
  offroad: number; elapsed: number; parkedX: number; parkedZ: number; parkedHeading: number;
};
export const CHAPTERS = ['Garage', 'Meet up', 'Open road', 'Breakfast', 'Kerwa', 'Home safe'];
export const TIMES = ['05:30', '06:00', '06:30', '08:00', '10:00', '11:30'];
export function createGame(reduced = false): GameState {
  return { phase: 'garage', chapter: 0, x: home.x, z: home.z, heading: home.heading, speed: 0,
    steering: 0, lean: 0, distance: 0, odometer: 0, timer: 0, paused: false, assist: true,
    guided: reduced, reduced, ready: false, actionDone: false, photo: 0, overtakes: 0,
    companions: [checkpoints[1] - 17, checkpoints[1] - 11], passed: [false, false], offroad: 0,
    elapsed: 0, parkedX: home.x, parkedZ: home.z, parkedHeading: home.heading };
}
export function walkingDuration(state: GameState) {
  const target = activityPoints[state.chapter];
  const x = state.parkedX - Math.cos(state.parkedHeading)*.7, z = state.parkedZ + Math.sin(state.parkedHeading)*.7;
  return Math.max(1.6,Math.hypot(target.x-x,target.z-z)/1.35);
}
export function targetDistance(state: GameState) { return checkpoints[Math.max(1, state.chapter)]; }
export function distanceToStop(state: GameState) {
  const bay = bays[state.chapter];
  return Math.hypot(state.x - bay.x, state.z - bay.z);
}
export function canPark(state: GameState) {
  return state.phase === 'ride' && state.chapter !== 2 && Math.abs(state.distance - targetDistance(state)) < 30 && distanceToStop(state) < 4 && state.speed < .55;
}
export function act(state: GameState) {
  if (!state.ready || state.paused) return false;
  if (state.phase === 'garage') { state.phase = 'mount'; state.timer = 0; return true; }
  if (canPark(state)) {
    state.phase = 'dismount'; state.timer = 0; state.speed = 0; state.lean = 0;
    state.parkedX = state.x; state.parkedZ = state.z; state.parkedHeading = state.heading;
    state.actionDone = false; return true;
  }
  if (state.phase === 'activity') {
    if (!state.actionDone) {
      state.actionDone = true; state.timer = 0;
      if (state.chapter === 5) state.phase = 'complete';
    } else {
      if (state.timer < 2.4) return false;
      state.phase = 'remount'; state.timer = 0;
    }
    return true;
  }
  return false;
}
export function recover(state: GameState) {
  if (state.phase !== 'ride') return;
  const road = sampleRoad(state.distance, -1.35);
  state.x = road.x; state.z = road.z; state.heading = road.heading; state.speed = 0;
  state.lean = state.steering = state.offroad = 0;
}
export function actionLabel(state: GameState) {
  if (state.phase === 'garage') return 'Open the garage';
  if (state.phase === 'mount') return 'Helmet on. Let’s go.';
  if (state.phase === 'dismount') return 'Parked. Stepping off…';
  if (state.phase === 'remount') return 'Getting back on…';
  if (state.phase === 'activity') {
    if (state.actionDone && state.timer < 2.4) return state.chapter === 4 ? 'Hold that pose…' : 'A moment well spent.';
    if (state.actionDone) return state.chapter === 4 ? 'Ride home' : 'Back to the bikes';
    return ({ 1: 'Say hello', 3: 'Chai & poha', 4: 'Take the photo', 5: 'Check in safe' } as Record<number, string>)[state.chapter];
  }
  return canPark(state) ? 'Park & step off' : 'Brake in the marked bay';
}
export function objective(state: GameState) {
  if (state.phase === 'complete') return 'Home safe.';
  if (state.phase === 'garage') return 'Bhopal → Kerwa → home';
  if (state.phase === 'mount') return 'Leaving the garage';
  if (state.phase === 'dismount') return 'Parked. Helmet off.';
  if (state.phase === 'remount') return 'Back on the bike';
  if (state.phase === 'activity') return state.actionDone ? 'Ready when you are.' : ({ 1: 'Meet the riders', 3: 'Chai & poha', 4: 'A photo by the lake', 5: 'Let the group know you’re home' } as Record<number, string>)[state.chapter];
  return ({ 1: 'Meet the group at Upper Lake', 2: 'Find your rhythm on the open road', 3: 'Chai and poha at Ratibad', 4: 'Take the green road to Kerwa', 5: 'Bring it home' } as Record<number, string>)[state.chapter];
}
export function advanceGame(state: GameState, input: GameInput, delta: number) {
  if (!state.ready || state.paused || state.phase === 'complete') return;
  const dt = Math.min(.05, Math.max(0, delta));
  state.timer += dt; state.elapsed += dt;
  if (state.phase === 'mount') {
    // Opening/helmet/mount take place on a stationary chassis. The short roll out
    // follows a curve with a tangent-aligned heading, never a lateral tween.
    if (state.timer < 4.2) return;
    const raw = Math.min(1,(state.timer-4.2)/7.5), t = raw*raw*(3-2*raw);
    const end = sampleRoad(13, -1.35), start = home;
    const c1 = { x: start.x + Math.sin(start.heading) * 8, z: start.z + Math.cos(start.heading) * 8 };
    const c2 = { x: end.x - Math.sin(end.heading) * 7, z: end.z - Math.cos(end.heading) * 7 };
    const a = 1 - t, previousX = state.x, previousZ = state.z, previousHeading = state.heading;
    state.x = a ** 3 * start.x + 3 * a * a * t * c1.x + 3 * a * t * t * c2.x + t ** 3 * end.x;
    state.z = a ** 3 * start.z + 3 * a * a * t * c1.z + 3 * a * t * t * c2.z + t ** 3 * end.z;
    const dx = 3 * a * a * (c1.x - start.x) + 6 * a * t * (c2.x - c1.x) + 3 * t * t * (end.x - c2.x);
    const dz = 3 * a * a * (c1.z - start.z) + 6 * a * t * (c2.z - c1.z) + 3 * t * t * (end.z - c2.z);
    state.heading = Math.atan2(dx, dz);
    const travelled = Math.hypot(state.x - previousX, state.z - previousZ);
    state.odometer += travelled; state.speed = travelled / Math.max(.001, dt);
    if (travelled > .0001) state.steering = Math.max(-.58,Math.min(.58,Math.atan(1.37*angleDelta(state.heading,previousHeading)/travelled)));
    const drivewayLean=-Math.max(-.45,Math.min(.45,Math.atan(state.speed*state.speed*Math.tan(state.steering)/1.37/9.81)));
    state.lean+=(drivewayLean-state.lean)*(1-Math.exp(-dt*6));
    if (t === 1) { state.phase = 'ride'; state.chapter = 1; state.distance = 13; state.timer = 0; }
    return;
  }
  if (state.phase === 'dismount') {
    if (state.timer >= 2.2 + walkingDuration(state)) { state.phase = 'activity'; state.timer = 0; }
    return;
  }
  if (state.phase === 'remount') {
    if (state.timer >= walkingDuration(state) + 2.4) {
      state.phase = 'ride'; state.chapter++; state.timer = 0; state.actionDone = false;
      if (state.chapter === 2) {
        state.companions = [state.distance + 13, state.distance + 24];
        state.passed = [false, false];
      }
    }
    return;
  }
  if (state.phase === 'activity') {
    if (state.chapter === 4 && state.actionDone && state.timer > 1.4 && state.photo === 0) state.photo = 1;
    return;
  }
  if (state.phase !== 'ride') return;
  // Driving input takes over immediately; assistance must never counter-steer
  // against a held direction or keep accelerating while the visitor brakes.
  if (input.throttle || input.brake || input.steer) state.guided=false;
  const road = nearestRoad(state.x, state.z, state.distance, targetDistance(state) + 12);
  // At tight switchbacks two valid projections can exchange which is nearest.
  // Keep route progress continuous instead of snapping the arrows between them.
  const progressStep=Math.max(.15,state.speed*dt*2);
  state.distance+=Math.max(-progressStep,Math.min(progressStep,road.distance-state.distance));
  state.offroad = road.away;
  const remaining = targetDistance(state) - state.distance;
  const bay = bays[state.chapter];
  const parkingApproach = state.chapter !== 2 && remaining < 33;
  const look = parkingApproach && remaining < 18 ? bay : sampleRoad(state.distance + 5 + state.speed * .45, -1.25);
  const targetHeading = Math.atan2(look.x - state.x, look.z - state.z);
  const error = angleDelta(targetHeading, state.heading);
  const assisted = Math.abs(error)>1.8 ? Math.sign(error)*.58 : Math.atan2(2 * 1.37 * Math.sin(error), Math.max(3, Math.hypot(look.x - state.x, look.z - state.z)));
  const steerLimit = .52 / (1 + state.speed * .17);
  // +Z is forward, so screen-right in the chase camera is local -X.
  // Input stays intuitive (+1 right); steering yaw uses world coordinates.
  const desiredSteer = (state.assist || state.guided ? assisted*(1-Math.min(1,Math.abs(input.steer))) : 0) - input.steer * steerLimit;
  state.steering += (Math.max(-.58, Math.min(.58, desiredSteer)) - state.steering) * (1 - Math.exp(-dt * 9));
  let throttle = input.throttle, brake = input.brake;
  if (state.guided) {
    const gap = Math.hypot(state.x - bay.x, state.z - bay.z);
    // Read the bend before entering it, rather than braking only after the
    // bike has already overshot and is circling back towards the route.
    let cornerSpeed=12;
    for(const ahead of [0,5,10,15]) {
      const a=sampleRoad(state.distance+ahead),b=sampleRoad(state.distance+ahead+5);
      const curvature=Math.abs(angleDelta(b.heading,a.heading))/5;
      const bendSpeed=Math.sqrt(2.8/Math.max(.015,curvature));
      cornerSpeed=Math.min(cornerSpeed,Math.sqrt(bendSpeed*bendSpeed+4*ahead));
    }
    const targetSpeed = parkingApproach ? Math.min(5, Math.sqrt(Math.max(0, gap - 1) * 2.3)) : road.away > 4.2 ? 3 : Math.min(cornerSpeed,Math.abs(error) > .8 ? 3 : Math.abs(error) > .35 ? 7 : 12);
    throttle = state.speed < targetSpeed ? .9 : 0;
    brake = state.speed > targetSpeed + .15 ? .5 : 0;
    if (parkingApproach && gap < 2.4) { brake = 1; throttle = 0; }
  }
  const drag = state.speed > 0 ? .35 + state.speed ** 2 * .005 : 0;
  const offroadDrag = road.away > ROAD_EDGE && state.speed > 3 ? 2.6 : 0;
  state.speed = Math.max(0, Math.min(16.5, state.speed + (throttle * 3.1 - brake * 7.2 - drag - offroadDrag) * dt));
  const yawRate = state.speed * Math.tan(state.steering) / 1.37;
  state.heading += yawRate * dt;
  const movement = state.speed * dt;
  state.x += Math.sin(state.heading) * movement; state.z += Math.cos(state.heading) * movement;
  state.odometer += movement;
  const desiredLean = -Math.max(-.52, Math.min(.52, Math.atan2(state.speed * yawRate, 9.81)));
  state.lean += (desiredLean - state.lean) * (1 - Math.exp(-dt * 6));
  if (state.chapter >= 2 && state.chapter <= 4) {
    state.companions.forEach((distance, index) => {
      if (!state.passed[index] && state.offroad < 4.6 && state.distance > distance + 2) { state.passed[index] = true; state.overtakes++; }
    });
  }
  if (state.chapter === 2 && state.distance >= checkpoints[2] - 5) { state.chapter = 3; state.timer = 0; }
  state.distance = Math.max(0, Math.min(routeLength, state.distance));
}
const ROAD_EDGE = 4.6;
