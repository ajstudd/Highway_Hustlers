// Small decoded-image LRU. Work is bounded even when the user flings a 144-frame set.
export class FrameCache {
  constructor({ count, load, capacity = 12, concurrency = 2, onChange = () => {}, onError = () => {} }) {
    Object.assign(this, { count, load, capacity, concurrency, onChange, onError });
    this.images = new Map(); this.pending = new Map(); this.queue = []; this.failed = new Map();
    this.center = 0; this.paused = false; this.closed = false;
  }
  index(i) { return ((i % this.count) + this.count) % this.count; }
  get(i) {
    const image = this.images.get(this.index(i));
    if (image) { this.images.delete(this.index(i)); this.images.set(this.index(i), image); }
    return image;
  }
  window(center) {
    this.center = this.index(center);
    if (this.paused || this.closed) return;
    const wanted = [...new Set([0,1,-1,2,-2,3,-3].map(d => this.index(this.center+d)))];
    this.queue = wanted.filter(i => !this.images.has(i) && !this.pending.has(i) && (this.failed.get(i) || 0) < Date.now());
    this.drain();
  }
  drain() {
    while (!this.closed && !this.paused && this.pending.size < this.concurrency && this.queue.length) {
      const i = this.queue.shift(), controller = new AbortController();
      this.pending.set(i, controller);
      Promise.resolve().then(() => this.load(i, controller.signal)).then(image => {
        if (this.closed || controller.signal.aborted || this.paused) { image.close(); return; }
        this.images.set(i, image);
        while (this.images.size > this.capacity) {
          const oldest = this.images.keys().next().value;
          this.images.get(oldest).close(); this.images.delete(oldest);
        }
        this.onChange(i);
      }).catch(error => {
        if (!controller.signal.aborted && !this.closed) { this.failed.set(i, Date.now()+15000); this.onError(i, error); }
      }).finally(() => { this.pending.delete(i); this.drain(); });
    }
  }
  pause(paused) {
    this.paused = paused;
    if (paused) {
      this.queue = [];
      for (const controller of this.pending.values()) controller.abort();
      for (const [i, image] of this.images) if (i !== this.center) { image.close(); this.images.delete(i); }
    } else this.window(this.center);
  }
  close() {
    this.closed = true; this.queue = [];
    for (const controller of this.pending.values()) controller.abort();
    for (const image of this.images.values()) image.close();
    this.images.clear();
  }
}
