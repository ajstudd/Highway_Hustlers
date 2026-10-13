export const ACTION_DURATIONS = [5.0, 5.0, 4.4, 10.0, 8.4, 5.4] as const;
export const PHOTO_TIME = 6.55;
export const DISMOUNT_TIME=1.8;
export const WALK_TIME=3.2;
export const STOP_ACTION_TIME=DISMOUNT_TIME+WALK_TIME;
export const ROUTE_STOPS = [.03, .16, .37, .61, .77, .985] as const;
export type RiderState={riding:number;walk:number;sit:number;heading:number};
export type VehicleState={point:[number,number,number];heading:number};

export type RideMotion = {
  progress: number;
  vehicleProgress?: number;
  rigStage?:string;
  riderStates?:RiderState[];
  vehicleStates?:VehicleState[];
  departureRiders?:RiderState[];
  departureVehicles?:VehicleState[];
  actionReplay?:boolean;
  target: number;
  from: number;
  chapter: number;
  phase: 'travel' | 'action';
  travelTime: number;
  travelDuration: number;
  actionTime: number;
  actionVersion: number;
  actionRunning: boolean;
  playing: boolean;
  paused: boolean;
  ready: boolean;
  visible: boolean;
  reduced: boolean;
  wide: boolean;
  input: 'scroll' | 'manual' | 'play';
  scrollPosition: number;
  scrollTarget: number;
  pointer: { x: number; y: number };
};

export function createJourney(reduced: boolean): RideMotion {
  return { progress: 0, target: 0, from: 0, chapter: 0, phase: 'action', travelTime: 0, travelDuration: 7, actionTime: 0, actionVersion: 0, actionRunning: false, playing: false, paused: false, ready: false, visible: false, reduced, wide: false, input: 'scroll', scrollPosition: 0, scrollTarget: 0, pointer: { x: 0, y: 0 } };
}

export function routeAt(progress: number) {
  const position = Math.max(0, Math.min(1, progress)) * 5;
  const index = Math.min(4, Math.floor(position));
  return ROUTE_STOPS[index] + (ROUTE_STOPS[index + 1] - ROUTE_STOPS[index]) * (position - index);
}

export function timelineAt(progress: number) {
  const position = Math.max(0,Math.min(1,progress))*5;
  const stop = Math.floor(position), t = position-stop;
  const dwell = stop===2 ? 0 : .28;
  return (stop + (t < .00001 ? (stop===2 ? 0 : .14) : dwell+t*(1-dwell))) / 5.32;
}

export function seekJourney(ride: RideMotion, chapter: number, keepPlaying = false) {
  chapter = Math.max(0, Math.min(5, chapter));
  const sameStop=ride.phase==='action'&&ride.chapter===chapter;
  ride.actionReplay=sameStop;
  ride.input = keepPlaying ? 'play' : 'manual';
  ride.from = ride.vehicleProgress??ride.progress;
  ride.departureRiders=ride.riderStates?.map(state=>({...state}));
  ride.departureVehicles=ride.vehicleStates?.map(state=>({...state,point:[...state.point]}));
  ride.target = chapter / 5;
  ride.chapter = chapter;
  ride.travelTime = 0;
  ride.travelDuration = Math.max(14, Math.abs(ride.from - ride.target) * 34);
  ride.phase = Math.abs(ride.progress - ride.target) > .001 ? 'travel' : 'action';
  ride.actionTime = sameStop?(chapter===3||chapter===4?STOP_ACTION_TIME:chapter===5?DISMOUNT_TIME:0):0;
  ride.actionRunning = true;
  ride.actionVersion++;
  ride.playing = keepPlaying;
  ride.paused = false;
  if (ride.reduced) { ride.progress = ride.target; ride.phase = 'action'; ride.actionTime = ACTION_DURATIONS[chapter]; ride.actionRunning = false; }
}

export function replayAction(ride: RideMotion) {
  if (ride.chapter === 1 || ride.chapter === 2) { seekJourney(ride, ride.chapter + 1); return; }
  ride.actionTime = ride.reduced ? ACTION_DURATIONS[ride.chapter] : ride.chapter===3||ride.chapter===4?STOP_ACTION_TIME:ride.chapter===5?DISMOUNT_TIME:0;
  ride.input = 'manual';
  ride.actionReplay=true;
  ride.actionVersion++;
  ride.actionRunning = !ride.reduced;
  ride.playing = false;
  ride.paused = false;
}

export function toggleJourney(ride: RideMotion) {
  if (ride.playing) { ride.playing = false; ride.paused = true; return; }
  if (ride.chapter === 5 && ride.phase === 'action') { seekJourney(ride, 0, true); }
  else { ride.input = 'play'; ride.playing = true; ride.paused = false; ride.actionRunning = true; }
}

// Native page scrolling is the timeline. Each stop gets a quiet action window,
// followed by a continuous road journey; reversing the scroll reverses the ride.
export function scrollJourney(ride: RideMotion, position: number) {
  ride.departureRiders=undefined;ride.departureVehicles=undefined;
  ride.actionReplay=false;
  const timeline = Math.max(0, Math.min(1, position)) * 5.32;
  const stop = Math.min(5, Math.floor(timeline));
  const local = timeline - stop;
  const dwell = stop === 2 ? 0 : .28;
  const isStop = stop === 5 || (stop !== 2 && local <= dwell);
  const chapter = ride.reduced ? stop : isStop ? stop : stop + 1;
  if (chapter !== ride.chapter) ride.actionVersion++;
  ride.chapter = chapter;
  ride.playing = false;
  ride.paused = false;
  ride.actionRunning = false;
  ride.from = stop / 5;
  ride.target = chapter / 5;
  ride.phase = isStop ? 'action' : 'travel';
  ride.travelDuration = 14;
  const t = isStop ? 0 : Math.min(1, (local - dwell) / (1 - dwell));
  // Linear road motion, soft pull-away and arrival handled by the scene's rig.
  ride.travelTime = t * ride.travelDuration;
  ride.progress = isStop ? stop / 5 : (stop + t) / 5;
  ride.actionTime = isStop ? Math.min(1, local / (stop === 5 ? .32 : dwell)) * ACTION_DURATIONS[stop] : 0;
  if (ride.reduced) { ride.progress = stop / 5; ride.phase = 'action'; ride.actionTime = ACTION_DURATIONS[stop]; }
}

// A chapter is an actual stop with its own action, followed by a short journey.
// Open road is the one chapter whose action is riding; all the others park.
export function advanceJourney(ride: RideMotion, dt: number) {
  if (!ride.ready || !ride.visible || ride.paused) return;
  if (ride.input === 'scroll') {
    ride.scrollPosition = ride.reduced ? ride.scrollTarget : ride.scrollPosition + (ride.scrollTarget - ride.scrollPosition) * (1 - Math.exp(-dt * 12));
    scrollJourney(ride, ride.scrollPosition);
    return;
  }
  if (ride.phase === 'travel') {
    ride.travelTime = Math.min(ride.travelDuration, ride.travelTime + dt);
    const t = ride.reduced ? 1 : ride.travelTime / ride.travelDuration;
    const eased = t * t * (3 - 2 * t);
    ride.progress = ride.from + (ride.target - ride.from) * eased;
    if (t === 1) { ride.progress = ride.target; ride.phase = 'action'; ride.actionTime = 0; ride.actionRunning = true;ride.actionReplay=false; }
    return;
  }
  if (!ride.actionRunning) return;
  const duration = ACTION_DURATIONS[ride.chapter];
  ride.actionTime = ride.reduced ? duration : Math.min(duration, ride.actionTime + dt);
  if (ride.chapter === 2) ride.progress = .4 + .09 * (ride.actionTime / duration);
  if (ride.actionTime >= duration) {
    ride.actionRunning = false;
    if (ride.playing && ride.chapter < 5) seekJourney(ride, ride.chapter + 1, true);
    else if (ride.chapter === 5) ride.playing = false;
  }
}
