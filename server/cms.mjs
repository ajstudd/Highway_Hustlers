import seed from '../src/data/gallery-seed.json' with { type: 'json' };
import { createPostgresStore, createLocalStore } from './store.mjs';
import { cleanPlaces, cleanMedia } from './content.mjs';
import { digest, validPasswordHash, verifyPassword, sessionToken, readToken, sessionCookie, sameOrigin } from './security.mjs';
import { validateUploadSize, uploadParameters, uploadSignature, uploadTicket, verifyUploadTicket, policy } from './uploads.mjs';
import { cleanGarage } from '../shared/garage.mjs';
import { createPublisher, snapshotOf, seedGarage, localFramePaths } from './publication.mjs';
import { signBikeBatch, verifyBikeBatch, confirmedBikeFrame } from './bike-uploads.mjs';
import { cleanUpcomingRide } from '../shared/upcoming-ride.mjs';

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };
export function createCms(env = process.env, injectedStore, fetcher = fetch) {
  const production = env.VERCEL === '1' || env.NODE_ENV === 'production';
  const local = !production && env.CMS_LOCAL_FILE;
  const configured = !!(env.DATABASE_URL || local || injectedStore) && validPasswordHash(env.ADMIN_PASSWORD_HASH);
  const cloudName = env.CLOUDINARY_CLOUD_NAME || 'jr5po5s7';
  const cloudReady = !!(env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
  const publisher = createPublisher(env, fetcher);
  let storePromise;
  const store = () => {
    if (!env.DATABASE_URL && !local && !injectedStore) fail(503, 'Connect a Neon database in Vercel Storage to enable the dashboard.');
    return storePromise ??= Promise.resolve(injectedStore || (local ? createLocalStore(local) : createPostgresStore(env.DATABASE_URL))).catch(e => { storePromise = undefined; throw e; });
  };
  async function cloud(path, timeout = 15000) {
    if (!cloudReady) fail(503, 'Add the Cloudinary API key and secret to the server environment to browse or upload media.');
    const response = await fetcher(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${path}`, { headers: { Authorization: `Basic ${Buffer.from(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`).toString('base64')}` }, signal: AbortSignal.timeout(timeout) });
    const result = await response.json();
    if (!response.ok) fail(response.status === 429 ? 429 : 502, response.status === 429 ? 'Cloudinary is rate-limiting requests. Wait a moment before refreshing.' : 'Cloudinary could not load the library. Check the server credentials.');
    return result;
  }
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const send = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const action = url.searchParams.get('action') || 'public';
      if (!['GET', 'POST', 'PUT'].includes(req.method)) { res.setHeader('Allow', 'GET, POST, PUT'); fail(405, 'Method not allowed.'); }
      if (req.method !== 'GET' && !sameOrigin(req, production)) fail(403, 'This request must come from the HH dashboard.');
      let body = {};
      if (req.method !== 'GET') {
        if (req.body !== undefined) {
          if (Buffer.byteLength(JSON.stringify(req.body)) > 2000000) fail(413, 'That update is too large. Use fewer items.');
          body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } else {
          let content = ''; for await (const chunk of req) { content += chunk; if (Buffer.byteLength(content) > 2000000) fail(413, 'That update is too large.'); }
          body = content ? JSON.parse(content) : {};
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Invalid request.');
      }
      if (action === 'public' && req.method === 'GET') {
        // Deliberately before authentication/store(): public reads NEVER wake Neon.
        if (publisher.development) return send(200, await publisher.readLocal());
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=3600');
        res.setHeader('Location', publisher.snapshotUrl); res.statusCode = 302; return res.end();
      }
      if (action === 'session' && req.method === 'GET' && !configured) return send(200, { authenticated: false, setupRequired: true });
      if (!configured) fail(503, 'Finish the server setup before signing in: database and admin password hash are required.');
      const db = await store(), credential = digest(env.ADMIN_PASSWORD_HASH);
      if (action === 'login' && req.method === 'POST') {
        const ip = production ? String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim() : req.socket?.remoteAddress || 'local';
        const now = Date.now();
        const [attempts, total] = await Promise.all([db.attempt(`ip:${digest(ip)}`, now), db.attempt('global', now)]);
        if (attempts > 10 || total > 100) { res.setHeader('Retry-After', '900'); fail(429, 'Too many sign-in attempts. Try again in 15 minutes.'); }
        if (!await verifyPassword(body.password, env.ADMIN_PASSWORD_HASH)) fail(401, 'That password is not correct.');
        const token = sessionToken(); await db.putSession(digest(token), credential, now + 28800000);
        res.setHeader('Set-Cookie', sessionCookie(token, production));
        return send(200, { authenticated: true });
      }
      const token = readToken(req, production);
      const authenticated = !!token && await db.session(digest(token), credential);
      if (action === 'session' && req.method === 'GET') return send(200, { authenticated, setupRequired: false });
      if (action === 'logout' && req.method === 'POST') {
        if (token) await db.logout(digest(token));
        res.setHeader('Set-Cookie', sessionCookie('', production, true)); return send(200, { authenticated: false });
      }
      if (!authenticated) fail(401, 'Your session has ended. Sign in again; unsaved work is still in this tab.');
      if (action === 'editor' && req.method === 'GET') {
        const [places, garage] = await Promise.all([db.get(seed), db.getGarage(seedGarage)]);
        return send(200, { places: places.places, upcomingRide: places.upcomingRide ?? null, revision: places.revision, garage: garage.garage, garageRevision: garage.revision, published: garage.published, cloudName, cloudReady, publishReady: publisher.ready, localPreview: publisher.local, snapshotUrl: publisher.snapshotUrl });
      }
      if (action === 'upcoming-ride' && req.method === 'PUT') {
        if (!Number.isInteger(body.revision) || body.revision < 0) fail(400, 'Invalid content revision. Reload the dashboard.');
        let ride; try { ride = cleanUpcomingRide(body.upcomingRide); } catch (e) { fail(400, e.message); }
        await db.get(seed);
        const saved = await db.saveUpcomingRide(ride, body.revision);
        if (!saved) fail(409, 'Another tab changed the content. Your edits are still here; reload before saving.');
        return send(200, saved);
      }
      if (action === 'garage' && req.method === 'PUT') {
        if (!Number.isInteger(body.revision) || body.revision < 0) fail(400, 'Invalid garage revision. Reload the dashboard.');
        let garage; try { garage = cleanGarage(body.garage, localFramePaths); } catch (e) { fail(400, e.message); }
        const cloudFrames = garage.bikes.flatMap(b => b.frames.filter(f => f.source === 'cloudinary'));
        const verified = new Map((await db.knownBikeFrames([...new Set(cloudFrames.map(f => f.publicId))])).map(f => [f.publicId, f]));
        if (cloudFrames.some(f => { const known = verified.get(f.publicId); return !known || known.version !== f.version || known.format !== f.format || known.width !== f.width || known.height !== f.height; })) fail(400, 'One or more bike frames have not been confirmed by this dashboard. Upload and verify them first.');
        await db.getGarage(seedGarage);
        const saved = await db.saveGarage(garage, body.revision);
        if (!saved) fail(409, 'Another tab changed the garage. Your edits are still here; reload before saving.');
        return send(200, saved);
      }
      if (action === 'publish' && req.method === 'POST') {
        if (!publisher.ready) fail(503, 'Publishing needs Cloudinary credentials. Preview deployments also need a separate CONTENT_SNAPSHOT_ID.');
        if (![body.revision, body.garageRevision].every(n => Number.isInteger(n) && n >= 0)) fail(400, 'Save your draft before publishing.');
        await db.getGarage(seedGarage);
        const lock = sessionToken();
        if (!await db.acquirePublish(lock, Date.now())) fail(409, 'A publication is already running. Wait for it to finish before retrying.');
        try {
          const [places, garage] = await Promise.all([db.get(seed), db.getGarage(seedGarage)]);
          if (places.revision !== body.revision || garage.revision !== body.garageRevision) fail(409, 'Another tab saved newer content. Reload before publishing.');
          const revision = `${places.revision}-${garage.revision}-${lock.slice(0,12)}`;
          const snapshot = snapshotOf(places.places, garage.garage, cloudName, revision, undefined, places.upcomingRide);
          let published;
          try { published = await publisher.publish(snapshot, revision); } catch { fail(502, 'Publishing could not be confirmed. Your saved draft is safe. The previous publication remains available if the upload failed; retry publishing.'); }
          const state = { ...published, revision: places.revision, garageRevision: garage.revision, snapshotRevision: revision };
          if (!await db.finishPublish(lock, state)) fail(503, 'Content was uploaded but its status could not be saved. Refresh and retry publishing.');
          return send(200, { published: state });
        } finally { await db.releasePublish(lock); }
      }
      if (action === 'places' && req.method === 'GET') return send(200, { ...await db.get(seed), cloudName, cloudReady });
      if (action === 'places' && req.method === 'PUT') {
        if (!Number.isInteger(body.revision) || body.revision < 0) fail(400, 'Invalid revision. Reload the dashboard.');
        let places; try { places = cleanPlaces(body.places); } catch (e) { fail(400, e.message); }
        const saved = await db.save(places, body.revision);
        if (!saved) fail(409, 'Another tab changed these places. Copy any unsaved text, then reload before saving.');
        return send(200, saved);
      }
      if (action === 'library' && req.method === 'GET') {
        const type = url.searchParams.get('type') === 'video' ? 'video' : 'image';
        const cursor = url.searchParams.get('cursor') || '';
        if (cursor.length > 512) fail(400, 'Invalid library page.');
        const params = new URLSearchParams({ max_results: '30', ...(cursor ? { next_cursor: cursor } : {}) });
        const result = await cloud(`resources/${type}/upload?${params}`);
        const media = result.resources.filter(r => !r.public_id.startsWith('hh-bikes/')).map(r => { try { return cleanMedia({ id: r.asset_id, type, publicId: r.public_id, version: r.version, width: r.width, height: r.height, caption: '' }); } catch { return null; } }).filter(Boolean);
        return send(200, { media, cursor: result.next_cursor || '', cloudName });
      }
      if (action === 'sign-bike-upload' && req.method === 'POST') {
        if (!cloudReady) fail(503, 'Add the Cloudinary server credentials before uploading bikes.');
        if (await db.attempt(`bike-uploads:${digest(token)}`, Date.now()) > 50) fail(429, 'Bike upload limit reached. Save completed batches and continue in 15 minutes.');
        let signed;
        try { signed = signBikeBatch(body.count, sessionToken().slice(0,24), digest(token), env.CLOUDINARY_API_SECRET); } catch (e) { fail(400, e.message); }
        return send(200, { ...signed, apiKey: env.CLOUDINARY_API_KEY, cloudName });
      }
      if (action === 'confirm-bike-upload' && req.method === 'POST') {
        if (!cloudReady) fail(503, 'Cloudinary credentials are missing.');
        let ticket;
        try { ticket = verifyBikeBatch(body.ticket, digest(token), env.CLOUDINARY_API_SECRET); } catch (e) { fail(400, e.message); }
        if (!Array.isArray(body.uploaded) || body.uploaded.length !== ticket.ids.length || body.uploaded.some(v => typeof v !== 'boolean')) fail(400, 'Invalid bike batch confirmation.');
        const frames = [], errors = [];
        const cached = new Map((await db.knownBikeFrames(ticket.ids)).map(f => [f.publicId,f]));
        // Bounded verification avoids a burst against the Cloudinary Admin API.
        for (let start = 0; start < ticket.ids.length; start += 3) {
          await Promise.all(ticket.ids.slice(start, start+3).map(async (id, j) => {
            const index = start+j;
            if (cached.has(id)) { frames[index] = cached.get(id); return; }
            try {
              frames[index] = confirmedBikeFrame(await cloud(`resources/image/upload/${encodeURIComponent(id)}`, 8000), id);
              await db.rememberBikeFrame(frames[index]);
            }
            catch { frames[index] = null; errors.push(`Frame ${index+1} could not be verified. Keep the completed frames and retry the missing ones.`); }
          }));
        }
        return send(200, { frames, errors });
      }
      if (action === 'sign-upload' && req.method === 'POST') {
        if (!cloudReady) fail(503, 'Add the Cloudinary server credentials before uploading.');
        try { validateUploadSize(body); } catch (e) { fail(400,e.message); }
        const attempts = await db.attempt(`uploads:${digest(token)}`, Date.now());
        if (attempts > 50) fail(429, 'Upload limit reached. Try again in 15 minutes.');
        // Only sign our own fixed parameters; never sign arbitrary client input.
        const params = uploadParameters(body.type,sessionToken().slice(0,24),Math.floor(Date.now()/1000));
        const signature = uploadSignature(params,env.CLOUDINARY_API_SECRET);
        const ticket = uploadTicket({publicId:`${params.folder}/${params.public_id}`,type:body.type,session:digest(token),expires:Date.now()+3600000},env.CLOUDINARY_API_SECRET);
        return send(200, { params, signature, ticket, apiKey: env.CLOUDINARY_API_KEY, cloudName, type: body.type });
      }
      if (action === 'confirm-upload' && req.method === 'POST') {
        if (!cloudReady) fail(503, 'Cloudinary credentials are missing.');
        let ticket; try { ticket = verifyUploadTicket(body.ticket,digest(token),env.CLOUDINARY_API_SECRET); } catch (e) { fail(400,e.message); }
        const id = encodeURIComponent(ticket.publicId);
        const resource = await cloud(`resources/${ticket.type}/upload/${id}`);
        if (resource.public_id !== ticket.publicId || resource.resource_type !== ticket.type) fail(502,'Cloudinary returned an unexpected upload.');
        if (!Number.isSafeInteger(resource.bytes) || resource.bytes <= 0 || resource.bytes > policy.maxSourceBytes) fail(400,'The stored file exceeds 25 MB. It was not added to the album. Remove this upload from Cloudinary and try a smaller file.');
        const dimension = ticket.type === 'image' ? policy.maxPhotoDimension : policy.maxVideoDimension;
        if (Math.max(resource.width,resource.height) > dimension) fail(400,'This upload was not optimized correctly. It was not added to the album.');
        return send(200,{ media:cleanMedia({ id:resource.asset_id,type:ticket.type,publicId:resource.public_id,version:resource.version,width:resource.width,height:resource.height,caption:'' }) });
      }
      fail(404, 'Not found.');
    } catch (error) {
      const status = error instanceof SyntaxError ? 400 : error.status || 503;
      // Never send provider exceptions, URLs, SQL or credentials to the browser/log.
      send(status, { error: error.status ? error.message : status === 400 ? 'Invalid JSON request.' : 'The content service is unavailable. Try again shortly or check the server setup.' });
    }
  };
}
