import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import policy from '../src/data/upload-policy.json' with {type:'json'};
export {policy};
export function validateUploadSize(body) {
  if (!['image','video'].includes(body.type)) throw new Error('Choose an image or video.');
  for (const size of [body.sourceBytes,body.bytes]) if (!Number.isSafeInteger(size) || size <= 0 || size > policy.maxSourceBytes) throw new Error('The limit is 25 MB per photo or video.');
  if (body.type === 'image' && body.bytes > policy.maxPhotoBytes) throw new Error('Prepare photos below 1.5 MB before uploading.');
}
export function uploadParameters(type, id, timestamp) {
  return { folder: 'hh-mornings', overwrite: 'false', backup: 'false', public_id: id, timestamp: String(timestamp), transformation: type === 'video' ? `c_limit,w_${policy.maxVideoDimension},h_${policy.maxVideoDimension},q_auto,vc_h264,ac_aac,f_mp4` : `c_limit,w_${policy.maxPhotoDimension},h_${policy.maxPhotoDimension},q_auto,f_jpg` };
}
export const uploadSignature = (params, secret) => createHash('sha256').update(Object.entries(params).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('&')+secret).digest('hex');
export function uploadTicket(data,secret) {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  return `${payload}.${createHmac('sha256',secret).update(payload).digest('hex')}`;
}
export function verifyUploadTicket(ticket,session,secret,now=Date.now()) {
  if (typeof ticket !== 'string' || ticket.length > 2048) throw new Error('Invalid upload confirmation.');
  const [payload,signature,...extra] = ticket.split('.');
  if (extra.length || !/^[a-f0-9]{64}$/.test(signature || '')) throw new Error('Invalid upload confirmation.');
  const expected = createHmac('sha256',secret).update(payload).digest();
  if (!timingSafeEqual(expected,Buffer.from(signature,'hex'))) throw new Error('Invalid upload confirmation.');
  const data = JSON.parse(Buffer.from(payload,'base64url').toString());
  if (data.session !== session || !Number.isFinite(data.expires) || data.expires < now || !['image','video'].includes(data.type) || !/^hh-mornings\/[a-f0-9]{24}$/.test(data.publicId)) throw new Error('This upload confirmation expired. Upload the file again.');
  return data;
}
