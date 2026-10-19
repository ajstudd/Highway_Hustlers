import { cmsRequest } from '../lib/gallery';
import type { BikeFrame } from '../../shared/garage.mjs';

type Prepared = { file: File; hash: string };
export async function inspectBikeFrame(file: File): Promise<Prepared> {
  if (!/\.(png|webp)$/i.test(file.name) || !['image/png', 'image/webp', ''].includes(file.type) || !file.size || file.size > 10000000) throw Error(`${file.name}: use a prepared PNG/WebP below 10 MB.`);
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  try {
    if (bitmap.width !== 1200 || bitmap.height !== 720) throw Error(`${file.name}: prepare every angle on the same 1200 × 720 canvas first.`);
    canvas.width = 1200; canvas.height = 720;
    const context = canvas.getContext('2d'); if (!context) throw Error('Image inspection is unavailable in this browser.');
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, 1200, 720).data;
    let visible = 0, transparent = 0;
    for (let i = 3; i < pixels.length; i += 4) { if (pixels[i] > 12) visible++; else transparent++; }
    if (visible < 100 || transparent < 100) throw Error(`${file.name}: expected a visible motorcycle with a transparent background.`);
    const digest = await crypto.subtle.digest('SHA-256', pixels);
    return { file, hash: Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('') };
  } finally { bitmap.close(); canvas.width = canvas.height = 1; }
}

type SignedBatch = { ticket: string; cloudName: string; apiKey: string; uploads: { params: Record<string, string>; signature: string }[] };
const pendingBatches = new Map<string, { batch: SignedBatch; expires: number }>();
// A caller-owned memo makes retrying a failed selection skip confirmed images.
export async function uploadBikeBatch(files: Prepared[], memo: Map<string, BikeFrame>, notice: (message: string) => void): Promise<(BikeFrame | null)[]> {
  const results: (BikeFrame | null)[] = files.map(f => memo.get(f.hash) || null);
  const missing = files.map((_, i) => i).filter(i => !results[i]);
  if (!missing.length) return results;
  const key = missing.map(i => files[i].hash).join(':');
  const previous = pendingBatches.get(key);
  const signed = previous && previous.expires > Date.now() ? previous.batch : await cmsRequest<SignedBatch>('sign-bike-upload', { method: 'POST', body: JSON.stringify({ count: missing.length }) });
  pendingBatches.set(key, { batch: signed, expires: Date.now()+3000000 });
  if (pendingBatches.size > 64) pendingBatches.delete(pendingBatches.keys().next().value!);
  const uploaded = missing.map(() => false);
  for (let start = 0; start < missing.length; start += 2) await Promise.all(missing.slice(start, start+2).map(async (i, offset) => {
    const position = start+offset, request = signed.uploads[position], form = new FormData();
    form.set('file', files[i].file);
    Object.entries(request.params).forEach(([k,v]) => form.set(k,v));
    form.set('signature', request.signature); form.set('api_key', signed.apiKey);
    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, { method: 'POST', body: form, credentials: 'omit', signal: AbortSignal.timeout(60000) });
      uploaded[position] = response.ok;
    } catch { /* Confirm successful uploads in this batch before returning an error. */ }
  }));
  notice('Verifying the prepared bike images…');
  let confirmed: { frames: (BikeFrame | null)[]; errors: string[] };
  try { confirmed = await cmsRequest('confirm-bike-upload', { method: 'POST', body: JSON.stringify({ ticket: signed.ticket, uploaded }) }); }
  catch (error) { if (error instanceof Error && /ticket|session/i.test(error.message)) pendingBatches.delete(key); throw error; }
  missing.forEach((original, i) => { if (confirmed.frames[i]) { results[original] = confirmed.frames[i]; memo.set(files[original].hash, confirmed.frames[i]!); } });
  if (results.every(Boolean)) pendingBatches.delete(key);
  return results;
}

export async function uploadPreparedSet(files: File[], memo: Map<string, BikeFrame>, notice: (message: string) => void): Promise<BikeFrame[]> {
  if (!files.length || files.length > 144) throw Error('Choose 1–144 prepared frames.');
  const ordered = [...files].sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const prepared: Prepared[] = [], hashes = new Set<string>();
  for (const [i, file] of ordered.entries()) {
    notice(`Checking frame ${i+1} of ${ordered.length}…`);
    const frame = await inspectBikeFrame(file);
    if (hashes.has(frame.hash)) throw Error(`${file.name}: duplicate view. Remove repeated rotation endpoints before uploading.`);
    hashes.add(frame.hash); prepared.push(frame);
  }
  const result: BikeFrame[] = [];
  for (let start = 0; start < prepared.length; start += 12) {
    notice(`Uploading frames ${start+1}–${Math.min(start+12, prepared.length)} of ${prepared.length}…`);
    const frames = await uploadBikeBatch(prepared.slice(start, start+12), memo, notice);
    if (frames.some(f => !f)) throw Error('Some frames could not be uploaded or verified. The existing rotation is unchanged. Select the same files to retry; confirmed images will be reused in this tab.');
    result.push(...frames as BikeFrame[]);
  }
  return result;
}
