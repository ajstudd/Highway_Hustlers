import { createHmac, timingSafeEqual } from 'node:crypto';
import { uploadSignature } from './uploads.mjs';
import { cleanFrame } from '../shared/garage.mjs';

const mac = (payload, secret) => createHmac('sha256', secret).update(payload).digest();
export function signBikeBatch(count, batchId, session, secret, now = Date.now()) {
  if (!Number.isInteger(count) || count < 1 || count > 12) throw Error('Upload 1–12 prepared frames per batch.');
  const params = Array.from({ length: count }, (_, i) => ({ public_id: `hh-bikes/${batchId}/${String(i).padStart(2, '0')}`, timestamp: String(Math.floor(now/1000)), overwrite: 'false', backup: 'false', allowed_formats: 'png,webp' }));
  const payload = Buffer.from(JSON.stringify({ session, expires: now+3600000, ids: params.map(p => p.public_id) })).toString('base64url');
  return { ticket: `${payload}.${mac(payload, secret).toString('hex')}`, uploads: params.map(p => ({ params: p, signature: uploadSignature(p, secret) })) };
}
export function verifyBikeBatch(ticket, session, secret, now = Date.now()) {
  if (typeof ticket !== 'string' || ticket.length > 5000) throw Error('Invalid bike upload ticket.');
  const [payload, signature, ...extra] = ticket.split('.');
  if (extra.length || !/^[a-f0-9]{64}$/.test(signature || '') || !timingSafeEqual(mac(payload, secret), Buffer.from(signature, 'hex'))) throw Error('Invalid bike upload ticket.');
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (data.session !== session || !Number.isFinite(data.expires) || data.expires < now || !Array.isArray(data.ids) || data.ids.length < 1 || data.ids.length > 12 || data.ids.some(id => !/^hh-bikes\/[a-f0-9]{24}\/[0-9]{2}$/.test(id))) throw Error('This bike upload ticket expired. Upload the batch again.');
  return data;
}
export function confirmedBikeFrame(resource, id) {
  if (resource.public_id !== id || resource.resource_type !== 'image' || resource.width !== 1200 || resource.height !== 720 || !Number.isSafeInteger(resource.bytes) || resource.bytes < 1 || resource.bytes > 10000000) throw Error('Use prepared transparent 1200 × 720 PNG/WebP frames, below 10 MB each.');
  return cleanFrame({ source: 'cloudinary', publicId: id, version: resource.version, format: resource.format, width: resource.width, height: resource.height });
}
