// Deterministic colour engineering: preserve geometry, alpha, neutral metal and lights.
import { APACHE_LIGHTS, APACHE_PANELS, containsPanel } from './apache-panels.mjs';
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };

function hsv(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const h = !d ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, max ? d / max : 0, max];
}

export function components(mask, width, height) {
  const seen = new Uint8Array(mask.length), groups = [], queue = new Int32Array(mask.length);
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let head = 0, tail = 1, sx = 0, sy = 0, left = width, right = 0, top = height, bottom = 0;
    queue[0] = start; seen[start] = 1;
    while (head < tail) {
      const p = queue[head++], x = p % width, y = Math.floor(p / width);
      sx += x; sy += y; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (const q of [x ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y ? p - width : -1, y < height - 1 ? p + width : -1]) {
        if (q >= 0 && mask[q] && !seen[q]) { seen[q] = 1; queue[tail++] = q; }
      }
    }
    groups.push({ pixels: queue.slice(0, tail), x: sx / tail, y: sy / tail, left, right, top, bottom });
  }
  return groups;
}

function paint(out, src, p, rgb, weight = 1) {
  const i = p * 4;
  for (let c = 0; c < 3; c++) out[i + c] = Math.round(src[i + c] * (1 - weight) + clamp(rgb[c], 0, 255) * weight);
}

export function erode(mask, width, height, radius = 2) {
  const stride = width + 1, sums = new Uint32Array(stride * (height + 1)), out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += mask[y * width + x];
      sums[(y + 1) * stride + x + 1] = sums[y * stride + x + 1] + row;
    }
  }
  const area = (2 * radius + 1) ** 2;
  for (let y = radius; y < height - radius; y++) for (let x = radius; x < width - radius; x++) {
    const l = x - radius, r = x + radius + 1, t = y - radius, b = y + radius + 1;
    out[y * width + x] = Number(sums[b * stride + r] - sums[b * stride + l] - sums[t * stride + r] + sums[t * stride + l] === area);
  }
  return out;
}

export function recolourBike(src, width, height, id, frame) {
  if (!['apache-rr310', 'cb125-hornet'].includes(id)) throw new Error(`No paint preset for ${id}`);
  if (id === 'apache-rr310') return recolourApache(src, width, height, frame);
  const out = Buffer.from(src), pigment = new Uint8Array(width * height), neutral = new Uint8Array(width * height);
  const neutralTop = (frame >= 15 ? .42 : .36) * height, neutralBottom = .625 * height;
  for (let p = 0; p < pigment.length; p++) {
    const i = p * 4;
    if (src[i + 3] < 12) continue;
    const r = src[i], g = src[i + 1], b = src[i + 2], [h, s, v] = hsv(r, g, b);
    // Lime-yellow body/rims differ from the gold anodised forks (hue ~42°).
    pigment[p] = Number(h >= 53 && h <= 95 && s > .28 && v > 45);
    const x = p % width, y = Math.floor(p / width);
    neutral[p] = Number(x > width * .23 && x < width * .80 && y >= neutralTop && y < neutralBottom && v >= 120 && s < .20);
  }
  let changed = 0;
  for (const group of components(pigment, width, height)) {
    const gold = group.y > height * .425;
    for (const p of group.pixels) {
      const i = p * 4, [h, s, v] = hsv(src[i], src[i + 1], src[i + 2]);
      const tone = 12 + v * .23;
      const rgb = gold ? [v * .76, v * .68, v * .52] : [tone * .96, tone, tone * 1.035];
      const weight = smooth(.28, .45, s) * smooth(53, 57, h);
      paint(out, src, p, rgb, weight); changed++;
    }
  }
  if (id === 'cb125-hornet') {
    // Recolour only large connected side-panel surfaces. Reject cropped metal
    // at the lower boundary, small brackets, and the bright headlamp area.
    const panel = new Uint8Array(neutral.length);
    // Remove thin bridges into bright metal before region selection.
    for (const group of components(erode(neutral, width, height), width, height)) {
      const area = group.pixels.length, boxArea = (group.right - group.left + 1) * (group.bottom - group.top + 1);
      if (area < 700 || group.bottom >= neutralBottom - 7 || area / boxArea < .28) continue;
      for (const p of group.pixels) {
        const x = p % width, y = Math.floor(p / width);
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const xx = x + dx, yy = y + dy, q = yy * width + xx;
          if (xx >= 0 && xx < width && yy >= 0 && yy < height && neutral[q]) panel[q] = 1;
        }
      }
    }
    for (let p = 0; p < panel.length; p++) if (panel[p]) {
      const i = p * 4, tone = 8 + (src[i] + src[i + 1] + src[i + 2]) / 3 * .32;
      paint(out, src, p, [tone * .96, tone, tone * 1.035]); changed++;
    }
  }
  return { data: out, changed };
}

function recolourApache(src, width, height, frame) {
  const panels = APACHE_PANELS[frame];
  if (!panels) throw new Error(`Missing Apache panel tracing for frame ${frame}`);
  const out = Buffer.from(src);
  let changed = 0;
  for (let p = 0; p < width * height; p++) {
    const i = p * 4, x = p % width, y = Math.floor(p / width);
    if (src[i + 3] < 12) continue;
    const r = src[i], g = src[i + 1], b = src[i + 2], [h] = hsv(r, g, b);
    // Some original wheel/exhaust highlights clip to pure white for one angle
    // and disappear in the next. Compress only that lower-metal highlight band
    // so rotation retains metallic detail without a distracting white flash.
    const low = Math.min(r, g, b), high = Math.max(r, g, b);
    if (y > height * .58 && y < height * .82 && low > 210 && high - low < 25) {
      paint(out, src, p, [r * .65, g * .65, b * .65], smooth(210, 235, low));
      changed++;
      continue;
    }
    // Red pigment only: not neutral decals, chrome, gold forks or the tyres.
    if (h >= 30 && h <= 330) continue;
    const weight = smooth(1, 8, r - Math.max(g, b));
    if (!weight) continue;
    const warmTrellis = g > b * 1.08 && g < r * .5 && b < r * .35;
    if (warmTrellis && containsPanel(panels.frame, x, y, width, height)) continue;
    if ((APACHE_LIGHTS[frame] ?? []).some(points => containsPanel(points, x, y, width, height))) continue;
    // Preserve lamps/reflectors and the tiny engine logo outside the bodywork.
    if (y > height * .70 || (frame < 4 && y > height * .30 && x < width * .16)) continue;
    const tank = containsPanel(panels.tank, x, y, width, height);
    const specular = Math.min(g, b), diffuse = Math.max(0, r - specular);
    const tone = specular + diffuse * (tank ? .32 : .035) + (tank ? 5 : 2);
    paint(out, src, p, [tone, tone, tone], weight);
    changed++;
  }
  return { data: out, changed };
}
