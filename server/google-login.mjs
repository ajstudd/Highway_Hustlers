import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createHash } from 'node:crypto';
import { sessionToken, digest } from './security.mjs';
import { emailOf } from './member-state.mjs';

const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export const cookieValue = (req, name) => (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`))?.slice(name.length+1) || '';
export const memberCookieName = production => production ? '__Host-hhr_member' : 'hhr_member_dev';
export const oauthCookieName = production => production ? '__Host-hhr_oauth' : 'hhr_oauth_dev';
export const privateCookie = (name, value, production, seconds) => `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${production ? '; Secure' : ''}`;
export function authConfiguration(env) {
  try {
    const origin = new URL(env.MEMBER_APP_ORIGIN);
    const production = env.VERCEL === '1' || env.NODE_ENV === 'production';
    if (origin.origin !== env.MEMBER_APP_ORIGIN || origin.username || origin.password || (production ? origin.protocol !== 'https:' : !['http:','https:'].includes(origin.protocol))) return null;
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
    // Preview must have its own explicitly configured origin/OAuth redirect.
    if (env.VERCEL_ENV === 'preview' && !env.MEMBER_PREVIEW_AUTH_ENABLED) return null;
    return { origin: origin.origin, clientId: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET, callback: `${origin.origin}/api/member?action=callback`, production };
  } catch { return null; }
}
export async function beginGoogle(db, config, intent) {
  const state = sessionToken(), verifier = sessionToken(), nonce = sessionToken(), browser = sessionToken();
  await db.putOauth(digest(state), { verifier, nonce, browser: digest(browser), intent }, Date.now()+600000);
  const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.callback, response_type: 'code', scope: 'openid email profile', state, nonce, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', prompt: 'select_account' });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, cookie: privateCookie(oauthCookieName(config.production),browser,config.production,600) };
}
export async function verifyGoogleToken(token, config, nonce, keySet = keys) {
  const { payload } = await jwtVerify(token,keySet,{ issuer:['https://accounts.google.com','accounts.google.com'],audience:config.clientId,algorithms:['RS256'],requiredClaims:['exp','iat','sub','nonce','email'],maxTokenAge:'10m',clockTolerance:10 });
  if (payload.nonce !== nonce || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255 || payload.email_verified !== true || (payload.azp && payload.azp !== config.clientId)) throw Error('Google identity could not be verified.');
  const email = emailOf(payload.email);
  // Non-Google-managed third-party email addresses require a separate ownership
  // challenge before email allowlisting is safe. Fail closed in this first version.
  if (!email.endsWith('@gmail.com') && typeof payload.hd !== 'string') throw Error('Use a Gmail or Google Workspace account for HHR sign-in.');
  let photo = '';
  try { const p = new URL(payload.picture); if (p.protocol === 'https:' && /(^|\.)googleusercontent\.com$/.test(p.hostname)) photo = p.href; } catch {}
  return { sub: payload.sub, email, name: typeof payload.name === 'string' ? payload.name.slice(0,100) : '', photo };
}
export async function finishGoogle(db, config, req, url, fetcher = fetch, verifier = verifyGoogleToken) {
  const state = url.searchParams.get('state'), code = url.searchParams.get('code');
  if (!/^[a-f0-9]{64}$/.test(state || '') || !code || code.length > 4096 || url.searchParams.has('error')) throw Error('Google sign-in was not completed.');
  const attempt = await db.consumeOauth(digest(state));
  const browser = cookieValue(req,oauthCookieName(config.production));
  if (!attempt || !/^[a-f0-9]{64}$/.test(browser) || attempt.browser !== digest(browser)) throw Error('Sign-in expired. Start again.');
  const response = await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:config.clientId,client_secret:config.secret,redirect_uri:config.callback,grant_type:'authorization_code',code_verifier:attempt.verifier}),signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw Error('Google sign-in could not be completed.');
  const result = await response.json();
  return { identity: await verifier(result.id_token,config,attempt.nonce), intent: attempt.intent };
}
