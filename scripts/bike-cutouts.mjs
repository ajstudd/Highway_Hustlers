import { components, erode } from './bike-paint.mjs';

function dilate(mask, width, height, radius) {
  const stride = width + 1, sums = new Uint32Array(stride * (height + 1)), out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += mask[y * width + x];
      sums[(y + 1) * stride + x + 1] = sums[y * stride + x + 1] + row;
    }
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const l = Math.max(0, x - radius), r = Math.min(width, x + radius + 1);
    const t = Math.max(0, y - radius), b = Math.min(height, y + radius + 1);
    out[y * width + x] = Number(sums[b * stride + r] - sums[b * stride + l] - sums[t * stride + r] + sums[t * stride + l] > 0);
  }
  return out;
}

function convexMask(mask, width, height) {
  const points = [];
  for (let y = 0; y < height; y++) {
    let left = width, right = -1;
    for (let x = 0; x < width; x++) if (mask[y * width + x]) { left = Math.min(left, x); right = x; }
    if (right >= left) points.push([left, y], [right, y]);
  }
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of points) { while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
  for (const p of [...points].reverse()) { while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)], out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    const cuts = [];
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i], b = hull[(i + 1) % hull.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) cuts.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
    }
    if (cuts.length < 2) continue;
    const left = Math.max(0, Math.floor(Math.min(...cuts))), right = Math.min(width - 1, Math.ceil(Math.max(...cuts)));
    out.fill(1, y * width + left, y * width + right + 1);
  }
  for (let p = 0; p < mask.length; p++) if (mask[p]) out[p] = 1;
  return out;
}

function inside(points, x, y) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}

// Frame 21 is an exception in the OEM set: its shadow is fully opaque, unlike
// the other 35 floor layers. Trace the two photographed tyre contours there.
const CLASSIC_21_TYRES = [
  [[370,840],[398,889],[442,925],[486,947],[526,954],[564,952],[610,936],[653,906],[683,870],[700,840]],
  [[1135,840],[1152,892],[1183,936],[1232,977],[1280,996],[1337,1003],[1390,998],[1440,978],[1484,939],[1514,893],[1525,840]],
];

export function stripFactoryStage(data, width, height, id, frame) {
  if (!['hunter-350', 'classic-350'].includes(id)) return;
  const original = Buffer.from(data);
  const hunter = id === 'hunter-350';
  if (hunter) {
    const foreground = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const p = y * width + x, i = p * 4;
      const lower = y >= height * .60;
      foreground[p] = Number(data[i + 3] >= 12 && (!lower || (Math.max(data[i], data[i + 1], data[i + 2]) > 4 && x >= width * .085 && x <= width * .915)));
    }
    // Close tiny zero-RGB gaps in the black tyre texture, without filling the
    // large spoke openings. A studio-plinth component never reaches the bike.
    const radius = Math.max(1, Math.round(width / 500));
    const closed = erode(dilate(foreground, width, height, radius), width, height, radius);
    const bike = new Uint8Array(foreground.length);
    const openingRadius = Math.max(2, Math.round(width / 200));
    for (const group of components(erode(closed, width, height, openingRadius), width, height)) {
      if (group.pixels.length < width * height * .0002 || group.top >= height * .76) continue;
      for (const p of group.pixels) bike[p] = 1;
    }
    const outline = dilate(convexMask(bike, width, height), width, height, openingRadius);
    const tyreEdge = dilate(bike, width, height, openingRadius + 1);
    for (let y = Math.floor(height * .60); y < height; y++) for (let x = 0; x < width; x++) {
      const p = y * width + x, i = p * 4;
      const edge = y >= height * .75 ? tyreEdge : outline;
      data[i + 3] = closed[p] && edge[p] ? original[i + 3] : 0;
    }
    return;
  }
  // The Classic studio-floor/shadow layer has alpha 6–235, while photographed
  // bike surfaces are opaque. Use that actual source-layer distinction instead
  // of a ground-height crop; preserve one pixel of the original AA outline.
  const opaque = new Uint8Array(width * height);
  for (let p = 0; p < opaque.length; p++) opaque[p] = Number(data[p * 4 + 3] >= 254);
  const bike = new Uint8Array(opaque.length);
  for (const group of components(opaque, width, height)) {
    if (group.pixels.length < width * height * .0002 || group.top >= height * .85) continue;
    for (const p of group.pixels) bike[p] = 1;
  }
  const edge = dilate(bike, width, height, 1);
  const radius = Math.max(1, Math.round(width / 800));
  const core = new Uint8Array(opaque.length);
  for (const group of components(erode(opaque, width, height, radius), width, height)) {
    if (group.pixels.length < width * height * .0002 || group.top >= height * .85) continue;
    for (const p of group.pixels) core[p] = 1;
  }
  const tyreEdge = dilate(core, width, height, radius + 1);
  for (let y = Math.floor(height * .67); y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x, i = p * 4;
    const outline = y >= height * .86 ? tyreEdge : edge;
    data[i + 3] = outline[p] && original[i + 3] >= 128 ? original[i + 3] : 0;
    if (frame === 21 && y >= height * .83 && !CLASSIC_21_TYRES.some(points => inside(points, x * 1920 / width, y * 1080 / height))) data[i + 3] = 0;
  }
}
