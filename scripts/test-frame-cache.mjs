import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import { FrameCache } from '../shared/frame-cache.mjs';

let resident = 0, maximum = 0, active = 0, maxActive = 0;
const load = async (index, signal) => {
  active++; maxActive = Math.max(maxActive, active);
  try { await wait(4, undefined, { signal }); }
  finally { active--; }
  resident++; maximum = Math.max(maximum, resident);
  let closed = false;
  return { index, close() { assert(!closed, 'never double-close a bitmap'); closed = true; resident--; } };
};
const cache = new FrameCache({ count: 40, capacity: 8, concurrency: 2, load });
cache.window(0); await wait(80);
assert(cache.get(0)); assert(cache.images.size <= 8); assert(maxActive <= 2);
assert(cache.images.size < 40, 'do not decode the full rotation upfront');
for (let i = 0; i < 40; i++) { cache.window(i); await wait(15); assert(cache.images.size <= 8); }
assert(maximum <= 9, 'keep memory bounded while replacing bitmaps');
cache.pause(true); await wait(20); assert(cache.images.size <= 1); assert.equal(active, 0);
cache.pause(false); await wait(50); assert(cache.images.size > 1);
cache.close(); await wait(20); assert.equal(resident, 0);
let lateClosed = false;
const late = new FrameCache({ count: 1, load: async () => { await wait(20); return { close() { lateClosed = true; } }; } });
late.window(0); await wait(2); late.close(); await wait(40); assert(lateClosed, 'close late decoder results after unmount');
let errors = 0, calls = 0;
const broken = new FrameCache({ count: 1, load: async () => { calls++; throw Error('offline'); }, onError: () => errors++ });
broken.window(0); await wait(20);
for (let i = 0; i < 50; i++) broken.window(0);
await wait(20); assert.equal(calls, 1, 'do not retry a failed image every animation tick'); assert.equal(errors, 1); broken.close();
console.log('Frame cache: progressive window, wraparound, bounded decoding/concurrency, offscreen release, late-result cleanup and failure backoff passed.');
