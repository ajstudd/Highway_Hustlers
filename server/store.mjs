import { neon } from '@neondatabase/serverless';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';

export async function createPostgresStore(connection, injectedSql) {
  const sql = injectedSql || neon(connection);
  await sql`CREATE TABLE IF NOT EXISTS hh_gallery (id INTEGER PRIMARY KEY CHECK (id=1), revision INTEGER NOT NULL DEFAULT 0, places JSONB NOT NULL DEFAULT '[]')`;
  await sql`CREATE TABLE IF NOT EXISTS hh_sessions (token TEXT PRIMARY KEY, credential TEXT NOT NULL, expires BIGINT NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS hh_login_limits (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires BIGINT NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS hh_site (id INTEGER PRIMARY KEY CHECK (id=1), revision INTEGER NOT NULL DEFAULT 0, garage JSONB NOT NULL, published JSONB, publish_token TEXT, publish_expires BIGINT NOT NULL DEFAULT 0)`;
  await sql`CREATE TABLE IF NOT EXISTS hh_bike_assets (public_id TEXT PRIMARY KEY, frame JSONB NOT NULL)`;
  return {
    async get(seed) {
      await sql`INSERT INTO hh_gallery (id,places) VALUES (1,${JSON.stringify(seed)}::jsonb) ON CONFLICT (id) DO NOTHING`;
      const [row] = await sql`SELECT revision,places FROM hh_gallery WHERE id=1`; return row;
    },
    async save(places, revision) {
      const [row] = await sql`UPDATE hh_gallery SET places=${JSON.stringify(places)}::jsonb, revision=revision+1 WHERE id=1 AND revision=${revision} RETURNING revision,places`;
      return row || null;
    },
    async getGarage(seed) {
      await sql`INSERT INTO hh_site (id,garage) VALUES (1,${JSON.stringify(seed)}::jsonb) ON CONFLICT (id) DO NOTHING`;
      const [row] = await sql`SELECT revision,garage,published FROM hh_site WHERE id=1`; return row;
    },
    async saveGarage(garage, revision) {
      const [row] = await sql`UPDATE hh_site SET garage=${JSON.stringify(garage)}::jsonb, revision=revision+1 WHERE id=1 AND revision=${revision} RETURNING revision,garage,published`;
      return row || null;
    },
    async acquirePublish(token, now) {
      const [row] = await sql`UPDATE hh_site SET publish_token=${token},publish_expires=${now + 300000} WHERE id=1 AND (publish_token IS NULL OR publish_expires<${now}) RETURNING id`;
      return !!row;
    },
    async finishPublish(token, published) {
      const [row] = await sql`UPDATE hh_site SET published=${JSON.stringify(published)}::jsonb,publish_token=NULL,publish_expires=0 WHERE id=1 AND publish_token=${token} RETURNING published`;
      return row || null;
    },
    async releasePublish(token) { await sql`UPDATE hh_site SET publish_token=NULL,publish_expires=0 WHERE id=1 AND publish_token=${token}`; },
    async knownBikeFrames(ids) { if (!ids.length) return []; const rows = await sql`SELECT frame FROM hh_bike_assets WHERE public_id=ANY(${ids}::text[])`; return rows.map(r => r.frame); },
    async rememberBikeFrame(frame) { await sql`INSERT INTO hh_bike_assets (public_id,frame) VALUES (${frame.publicId},${JSON.stringify(frame)}::jsonb) ON CONFLICT (public_id) DO NOTHING`; },
    async putSession(token, credential, expires) { await sql`DELETE FROM hh_sessions WHERE expires<${Date.now()}`; await sql`INSERT INTO hh_sessions (token,credential,expires) VALUES (${token},${credential},${expires})`; },
    async session(token, credential) { const [row] = await sql`SELECT token FROM hh_sessions WHERE token=${token} AND credential=${credential} AND expires>${Date.now()}`; return !!row; },
    async logout(token) { await sql`DELETE FROM hh_sessions WHERE token=${token}`; },
    async attempt(bucket, now) {
      const expires = now + 900000;
      await sql`DELETE FROM hh_login_limits WHERE expires<${now}`;
      const [row] = await sql`INSERT INTO hh_login_limits (bucket,attempts,expires) VALUES (${bucket},1,${expires}) ON CONFLICT (bucket) DO UPDATE SET attempts=CASE WHEN hh_login_limits.expires<${now} THEN 1 ELSE hh_login_limits.attempts+1 END, expires=CASE WHEN hh_login_limits.expires<${now} THEN ${expires} ELSE hh_login_limits.expires END RETURNING attempts`;
      return row.attempts;
    },
  };
}

// Opt-in local development only. Never use Vercel's ephemeral filesystem as a DB.
export function createLocalStore(filename) {
  let queue = Promise.resolve();
  async function transaction(fn) {
    const run = queue.then(async () => {
      let data; try { data = JSON.parse(await readFile(filename, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; data = { content: null, sessions: {}, limits: {} }; }
      const result = fn(data);
      await mkdir(path.dirname(filename), { recursive: true });
      await writeFile(`${filename}.tmp`, JSON.stringify(data), { mode: 0o600 }); await rename(`${filename}.tmp`, filename);
      return result;
    });
    queue = run.catch(() => {}); return run;
  }
  return {
    get: seed => transaction(d => { d.content ??= { revision: 0, places: seed }; return d.content; }),
    save: (places, revision) => transaction(d => { if (d.content?.revision !== revision) return null; d.content = { revision: revision+1, places }; return d.content; }),
    getGarage: seed => transaction(d => { d.site ??= { revision: 0, garage: seed, published: null }; return d.site; }),
    saveGarage: (garage, revision) => transaction(d => { if (d.site?.revision !== revision) return null; d.site = { ...d.site, revision: revision+1, garage }; return d.site; }),
    acquirePublish: (token, now) => transaction(d => { if (!d.site || (d.site.publishToken && d.site.publishExpires >= now)) return false; d.site.publishToken = token; d.site.publishExpires = now+300000; return true; }),
    finishPublish: (token, published) => transaction(d => { if (d.site?.publishToken !== token) return null; d.site.published = published; delete d.site.publishToken; delete d.site.publishExpires; return { published }; }),
    releasePublish: token => transaction(d => { if (d.site?.publishToken === token) { delete d.site.publishToken; delete d.site.publishExpires; } }),
    knownBikeFrames: ids => transaction(d => ids.map(id => d.assets?.[id]).filter(Boolean)),
    rememberBikeFrame: frame => transaction(d => { d.assets ??= {}; d.assets[frame.publicId] ??= frame; }),
    putSession: (token, credential, expires) => transaction(d => { for (const [k,v] of Object.entries(d.sessions)) if (v.expires<Date.now()) delete d.sessions[k]; d.sessions[token] = { credential, expires }; }),
    session: (token, credential) => transaction(d => d.sessions[token]?.credential === credential && d.sessions[token]?.expires > Date.now()),
    logout: token => transaction(d => { delete d.sessions[token]; }),
    attempt: (key, now) => transaction(d => { for (const [k,v] of Object.entries(d.limits)) if(v.expires<now) delete d.limits[k]; d.limits[key] ??= { attempts: 0, expires: now+900000 }; return ++d.limits[key].attempts; }),
  };
}
