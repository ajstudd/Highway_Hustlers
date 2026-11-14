import { timingSafeEqual } from 'node:crypto';
import { createPostgresStore } from './store.mjs';
import { archiveExpiredRide, rideExpired } from './ride-lifecycle.mjs';
import { createPublisher, seedPlaces, seedGarage } from './publication.mjs';
import { validateSnapshot } from '../shared/public-snapshot.mjs';
import { sessionToken } from './security.mjs';
import { mutateMembers, notice, syncPublishedRide } from './member-state.mjs';

export function createRideCron(env=process.env,injectedStore,fetcher=fetch) {
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
    const send=(status,data)=>{res.statusCode=status;res.end(JSON.stringify(data));};
    const actual=Buffer.from(req.headers.authorization||''),expected=Buffer.from(`Bearer ${env.CRON_SECRET||''}`);
    if(req.method!=='GET'||!env.CRON_SECRET||actual.length!==expected.length||!timingSafeEqual(actual,expected))return send(401,{error:'Not authorised.'});
    if(env.VERCEL_ENV&&env.VERCEL_ENV!=='production')return send(200,{skipped:true});
    let db,lock;
    try{
      db=injectedStore||await createPostgresStore(env.DATABASE_URL);await db.getGarage(seedGarage);
      lock=sessionToken();if(!await db.acquirePublish(lock,Date.now()))return send(409,{error:'A publication is running. Retry shortly.'});
      const archived=await archiveExpiredRide(db,seedPlaces);
      await mutateMembers(db,state=>{for(const ride of state.rides.filter(r=>r.status==='open'&&rideExpired(r.details))){ride.status='completed';notice(state,'Ride completed',`${ride.details.location}: thanks for riding with HHR.`);}});
      const publisher=createPublisher(env,fetcher);
      const response=await fetcher(publisher.snapshotUrl,{cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw Error('No published content.');
      const text=await response.text();if(text.length>1500000)throw Error('Oversized snapshot.');
      const snapshot=validateSnapshot(JSON.parse(text));
      if(snapshot.cloudName!==publisher.cloudName)throw Error('Mismatched public media environment.');
      if(snapshot.upcomingRide&&rideExpired(snapshot.upcomingRide))await archiveExpiredRide(db,seedPlaces,Date.now(),snapshot.upcomingRide);
      let removed=false;
      if(snapshot.upcomingRide&&rideExpired(snapshot.upcomingRide)){
        const revision=`expiry-${lock.slice(0,24)}`,updated={...snapshot,upcomingRide:null,revision,publishedAt:new Date().toISOString()};
        const result=await publisher.publish(updated,revision);
        const garage=await db.getGarage(seedGarage);
        if(!await db.finishPublish(lock,{...result,...garage.published,upcomingRide:null,publishedAt:updated.publishedAt,snapshotRevision:revision,revision:-1}))throw Error('Publication status not saved.');
        removed=true;
      }
      // Reconcile state even when a previous run archived before a CDN outage.
      await syncPublishedRide(db,snapshot.upcomingRide&&!rideExpired(snapshot.upcomingRide)?snapshot.upcomingRide:null,`expiry-${lock.slice(0,12)}`);
      send(200,{archived:archived?.galleryId||null,removedExpiredAnnouncement:removed});
    }catch{send(503,{error:'Ride rollover could not finish. Saved data is safe; retry the job.'});}
    finally{if(db&&lock)try{await db.releasePublish(lock);}catch{/* The bounded lock expires; never replace a response or log provider secrets. */}}
  };
}
