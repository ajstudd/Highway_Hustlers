const view = row => row ? { ...row, createdAt:Number(row.createdAt),expires:Number(row.expires) } : null;
export async function postgresPhotos(sql){
  await sql`CREATE TABLE IF NOT EXISTS hh_member_photos (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, ride_id TEXT NOT NULL, purpose TEXT NOT NULL CHECK (purpose IN ('ride','profile')), slot INTEGER NOT NULL CHECK (slot IN (0,1)), status TEXT NOT NULL CHECK (status IN ('reserved','pending','approved','rejected')), public_id TEXT NOT NULL UNIQUE, media JSONB, created_at BIGINT NOT NULL, expires BIGINT NOT NULL, UNIQUE(account_id,ride_id,slot))`;
  await sql`CREATE INDEX IF NOT EXISTS hh_member_photos_review ON hh_member_photos (purpose,status,created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS hh_member_photos_account ON hh_member_photos (account_id,purpose)`;
  const columns = row => view(row);
  return {
    async photoById(id){const [row]=await sql`SELECT id,account_id AS "accountId",ride_id AS "rideId",purpose,slot,status,public_id AS "publicId",media,created_at AS "createdAt",expires FROM hh_member_photos WHERE id=${id}`;return columns(row);},
    async reservePhoto({id,accountId,rideId,purpose,publicId},now){
      const slots=purpose==='ride'?2:1;
      const [row]=await sql`INSERT INTO hh_member_photos (id,account_id,ride_id,purpose,slot,status,public_id,created_at,expires)
        SELECT ${id},${accountId},${rideId},${purpose},candidate,'reserved',${publicId},${now},${now+600000}
        FROM generate_series(0,${slots-1}) AS candidate WHERE NOT EXISTS (SELECT 1 FROM hh_member_photos p WHERE p.account_id=${accountId} AND p.ride_id=${rideId} AND p.slot=candidate AND (p.status<>'reserved' OR p.expires>${now})) ORDER BY candidate LIMIT 1
        ON CONFLICT(account_id,ride_id,slot) DO UPDATE SET id=EXCLUDED.id,status='reserved',public_id=EXCLUDED.public_id,media=NULL,created_at=EXCLUDED.created_at,expires=EXCLUDED.expires WHERE hh_member_photos.status='reserved' AND hh_member_photos.expires<=${now}
        RETURNING id,slot`;
      return row||null;
    },
    async finishPhoto(id,media,status){const [row]=await sql`UPDATE hh_member_photos SET media=${JSON.stringify(media)}::jsonb,status=${status},expires=0 WHERE id=${id} AND status='reserved' RETURNING id`;return !!row;},
    async releasePhoto(id){await sql`UPDATE hh_member_photos SET expires=0 WHERE id=${id} AND status='reserved'`;},
    async accountPhotos(accountId){return(await sql`SELECT id,ride_id AS "rideId",status,media,expires,created_at AS "createdAt" FROM hh_member_photos WHERE account_id=${accountId} AND purpose='ride' AND (status<>'reserved' OR expires>${Date.now()}) ORDER BY created_at`).map(view);},
    async reviewPhotos(status='',offset=0){return(await sql`SELECT id,account_id AS "accountId",ride_id AS "rideId",status,media,created_at AS "createdAt" FROM hh_member_photos WHERE purpose='ride' AND status<>'reserved' AND (${status}='' OR status=${status}) ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET ${offset}`).map(view);},
    async moderatePhoto(id,status,expected){const [row]=await sql`UPDATE hh_member_photos SET status=${status} WHERE id=${id} AND purpose='ride' AND status=${expected} AND media IS NOT NULL RETURNING id`;return !!row;},
  };
}

export function localPhotos(transaction){
  return {
    photoById:id=>transaction(d=>d.photos?.[id]||null),
    reservePhoto:(entry,now)=>transaction(d=>{
      d.photos??={};const maximum=entry.purpose==='ride'?2:1;
      for(let slot=0;slot<maximum;slot++){
        const used=Object.values(d.photos).find(p=>p.accountId===entry.accountId&&p.rideId===entry.rideId&&p.slot===slot);
        if(used&&(used.status!=='reserved'||used.expires>now))continue;
        if(used)delete d.photos[used.id];
        d.photos[entry.id]={...entry,slot,status:'reserved',media:null,createdAt:now,expires:now+600000};return {id:entry.id,slot};
      }return null;
    }),
    finishPhoto:(id,media,status)=>transaction(d=>{const p=d.photos?.[id];if(!p||p.status!=='reserved')return false;p.media=media;p.status=status;p.expires=0;return true;}),
    releasePhoto:id=>transaction(d=>{const p=d.photos?.[id];if(p?.status==='reserved')p.expires=0;}),
    accountPhotos:accountId=>transaction(d=>Object.values(d.photos||{}).filter(p=>p.accountId===accountId&&p.purpose==='ride'&&(p.status!=='reserved'||p.expires>Date.now())).sort((a,b)=>a.createdAt-b.createdAt)),
    reviewPhotos:(status='',offset=0)=>transaction(d=>Object.values(d.photos||{}).filter(p=>p.purpose==='ride'&&p.status!=='reserved'&&(!status||p.status===status)).sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id)).slice(offset,offset+51)),
    moderatePhoto:(id,status,expected)=>transaction(d=>{const p=d.photos?.[id];if(!p||p.purpose!=='ride'||p.status!==expected||!p.media)return false;p.status=status;return true;}),
  };
}
