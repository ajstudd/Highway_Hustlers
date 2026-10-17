import { neon } from '@neondatabase/serverless';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';

export async function createPostgresStore(connection, injectedSql) {
  const sql = injectedSql || neon(connection);
  await sql`CREATE TABLE IF NOT EXISTS hh_gallery (id INTEGER PRIMARY KEY CHECK (id=1), revision INTEGER NOT NULL DEFAULT 0, places JSONB NOT NULL DEFAULT '[]')`;
  await sql`CREATE TABLE IF NOT EXISTS hh_sessions (token TEXT PRIMARY KEY, credential TEXT NOT NULL, expires BIGINT NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS hh_login_limits (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires BIGINT NOT NULL)`;
  return {
    async get(seed) {
      await sql`INSERT INTO hh_gallery (id,places) VALUES (1,${JSON.stringify(seed)}::jsonb) ON CONFLICT (id) DO NOTHING`;
      const [row] = await sql`SELECT revision,places FROM hh_gallery WHERE id=1`; return row;
    },
    async save(places, revision) {
      const [row] = await sql`UPDATE hh_gallery SET places=${JSON.stringify(places)}::jsonb, revision=revision+1 WHERE id=1 AND revision=${revision} RETURNING revision,places`;
      return row || null;
    },
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
    putSession: (token, credential, expires) => transaction(d => { for (const [k,v] of Object.entries(d.sessions)) if (v.expires<Date.now()) delete d.sessions[k]; d.sessions[token] = { credential, expires }; }),
    session: (token, credential) => transaction(d => d.sessions[token]?.credential === credential && d.sessions[token]?.expires > Date.now()),
    logout: token => transaction(d => { delete d.sessions[token]; }),
    attempt: (key, now) => transaction(d => { for (const [k,v] of Object.entries(d.limits)) if(v.expires<now) delete d.limits[k]; d.limits[key] ??= { attempts: 0, expires: now+900000 }; return ++d.limits[key].attempts; }),
  };
}
