import { randomBytes, scrypt as derive, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(derive);
export const digest = value => createHash('sha256').update(value).digest('hex');
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 14 || password.length > 1024) throw new Error('Use a password between 14 and 1024 characters.');
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
  return `scrypt$32768$8$3$${salt}$${hash.toString('hex')}`;
}
export const validPasswordHash = value => /^scrypt\$32768\$8\$3\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(value || '');
export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 1024 || !validPasswordHash(encoded)) return false;
  const [, , , , salt, expected] = encoded.split('$');
  const actual = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
export const sessionToken = () => randomBytes(32).toString('hex');
export const cookieName = production => production ? '__Host-hh_admin' : 'hh_admin_dev';
export function readToken(req, production) {
  const value = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName(production)}=`))?.split('=')[1];
  return /^[a-f0-9]{64}$/.test(value || '') ? value : '';
}
export function sessionCookie(token, production, clear = false) {
  return `${cookieName(production)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 28800}${production ? '; Secure' : ''}`;
}
export function sameOrigin(req, production) {
  try {
    const origin = new URL(req.headers.origin);
    return origin.host === req.headers.host && origin.protocol === (production ? 'https:' : 'http:') && req.headers['x-hh-admin'] === '1' && (req.headers['content-type'] || '').split(';')[0] === 'application/json';
  } catch { return false; }
}
