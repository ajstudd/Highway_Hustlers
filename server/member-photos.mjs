import sharp from 'sharp';
import { createLocalStore,createPostgresStore } from './store.mjs';
import { digest } from './security.mjs';
import { cookieValue,memberCookieName } from './google-login.mjs';
import { approved,mutateMembers } from './member-state.mjs';
import { uploadSignature } from './uploads.mjs';
import { cleanMedia } from './content.mjs';

export const MEMBER_PHOTO_LIMIT=1500000;
class PhotoError extends Error{constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new PhotoError(status,message);};
export async function normalizeMemberPhoto(bytes){
  if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>MEMBER_PHOTO_LIMIT)fail(413,'Use a compressed photo below 1.5 MB.');
  if(bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff)fail(400,'Choose a photo and let the website prepare it before uploading.');
  try{
    const image=sharp(bytes,{failOn:'warning',limitInputPixels:2048*2048,unlimited:false,animated:false});
    const meta=await image.metadata();
    if(meta.format!=='jpeg'||!meta.width||!meta.height||meta.width>2048||meta.height>2048||(meta.pages||1)>1)fail(400,'Photos must be a single JPEG, no larger than 2048 × 2048.');
    const output=await image.rotate().jpeg({quality:80}).timeout({seconds:3}).toBuffer();
    if(output.length>MEMBER_PHOTO_LIMIT)fail(413,'This photo is too detailed to upload safely. Try a smaller version.');
    return output;
  }catch(error){if(error.status)throw error;fail(400,'This photo could not be decoded safely. Choose another image.');}
}
async function readBytes(req){
  if(req.body!==undefined){if(!Buffer.isBuffer(req.body))fail(400,'Send the prepared photo as binary data.');return req.body;}
  const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>MEMBER_PHOTO_LIMIT)fail(413,'Use a compressed photo below 1.5 MB.');chunks.push(chunk);}return Buffer.concat(chunks,length);
}
export function createMemberPhotos(env=process.env,injectedStore,fetcher=fetch){
  const production=env.VERCEL==='1'||env.NODE_ENV==='production',cloudName=env.CLOUDINARY_CLOUD_NAME||'jr5po5s7';
  let dbPromise,inFlight=0;const bursts=new Map();
  const store=()=>dbPromise??=Promise.resolve(injectedStore||(!production&&env.CMS_LOCAL_FILE?createLocalStore(env.CMS_LOCAL_FILE):createPostgresStore(env.DATABASE_URL))).catch(e=>{dbPromise=undefined;throw e;});
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store, private');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Content-Type','application/json');
    const send=(status,data)=>{res.statusCode=status;res.end(JSON.stringify(data));};let db,reservedId=null,providerStarted=false,counted=false;
    try{
      if(req.method!=='POST')fail(405,'Method not allowed.');
      const expected=env.MEMBER_APP_ORIGIN||(!production?`http://${req.headers.host}`:'');
      if(!expected||req.headers.origin!==expected||req.headers['x-hhr-member']!=='1'||req.headers['content-type']!=='application/octet-stream')fail(403,'Upload from your HHR profile.');
      const token=cookieValue(req,memberCookieName(production));if(!/^[a-f0-9]{64}$/.test(token))fail(401,'Sign in again to upload a photo.');
      if(Number(req.headers['content-length'])>MEMBER_PHOTO_LIMIT)fail(413,'Use a compressed photo below 1.5 MB.');
      const requestId=req.headers['x-hhr-upload'];if(typeof requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(requestId))fail(400,'Start a new photo upload from your profile.');
      const ip=digest(String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim()),now=Date.now();
      const recent=bursts.get(ip);if(recent&&recent.until>now&&recent.count>=20)fail(429,'Too many upload requests. Wait a minute.');
      bursts.set(ip,recent&&recent.until>now?{...recent,count:recent.count+1}:{count:1,until:now+60000});if(bursts.size>1000)bursts.delete(bursts.keys().next().value);
      if(inFlight>=4)fail(429,'The photo uploader is busy. Please try again shortly.');inFlight++;counted=true;
      if(!env.CLOUDINARY_API_KEY||!env.CLOUDINARY_API_SECRET)fail(503,'Photo uploads need the Cloudinary server settings.');
      if(!injectedStore&&!env.DATABASE_URL&&(production||!env.CMS_LOCAL_FILE))fail(503,'Photo storage is not configured.');
      db=await store();const accountId=await db.memberSession(digest(token));if(!accountId)fail(401,'Sign in again to upload a photo.');
      const {state}=await db.getMemberState(),account=state.accounts.find(a=>a.id===accountId);if(!account)fail(401,'Sign in again to upload a photo.');
      const url=new URL(req.url,'http://localhost'),purpose=url.searchParams.get('purpose')==='profile'?'profile':'ride';
      const id=digest(`${accountId}:${requestId}`).slice(0,24),rideId=purpose==='profile'?`profile-${id}`:url.searchParams.get('ride');
      if(purpose==='ride'){
        const ride=state.rides.find(r=>r.id===rideId);if(!approved(state,account)||!ride||!ride.participants.includes(accountId)||!['open','closed','completed'].includes(ride.status))fail(403,'Only approved members who joined this ride can contribute photos.');
        if(req.headers['x-hhr-photo-consent']!=='1')fail(400,'Confirm you have permission to share this photo on HHR.');
      }
      const existing=await db.photoById(id);
      if(existing&&(existing.accountId!==accountId||existing.rideId!==rideId||existing.purpose!==purpose))fail(409,'This upload ID belongs to a different photo request.');
      if(existing?.media){if(purpose==='profile')await mutateMembers(db,s=>{s.accounts.find(a=>a.id===accountId).photo=existing.media;});return send(200,{id,media:existing.media,status:existing.status});}
      if(existing?.status==='reserved'&&existing.expires>Date.now())fail(409,'This photo is already uploading. Wait before retrying.');
      const [personal,total,ipCount]=await Promise.all([db.attempt(`member-photos:${accountId}`,now,86400000),db.attempt('member-photos:global',now,86400000),db.attempt(`member-photos:ip:${ip}`,now)]);
      if(personal>4||total>50||ipCount>12)fail(429,'Photo upload allowance reached. Please try again later.');
      const folder=purpose==='ride'?`hh-ride-contributions/${rideId}/${accountId}`:`hh-profiles/${accountId}`;
      const publicId=`${folder}/${id}`;
      const entry={id,accountId,rideId,purpose,publicId};let reservation=await db.reservePhoto(entry,now);
      if(!reservation&&purpose==='ride')reservation=await db.reservePhoto(entry,now);
      if(!reservation)fail(409,'You can contribute at most two photos to each ride.');reservedId=id;
      const bytes=await normalizeMemberPhoto(await readBytes(req));
      const params={folder,public_id:id,timestamp:String(Math.floor(Date.now()/1000)),overwrite:'false',format:'jpg'};
      const form=new FormData();for(const [key,value]of Object.entries(params))form.set(key,value);form.set('api_key',env.CLOUDINARY_API_KEY);form.set('signature',uploadSignature(params,env.CLOUDINARY_API_SECRET));form.set('file',new Blob([bytes],{type:'image/jpeg'}),'photo.jpg');
      providerStarted=true;const response=await fetcher(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,{method:'POST',body:form,signal:AbortSignal.timeout(15000)});
      if(!response.ok)fail(502,'The photo upload could not be confirmed. Wait ten minutes before retrying; your existing photos are safe.');
      const result=await response.json();
      if(result.public_id!==publicId||result.resource_type!=='image'||result.format!=='jpg'||!Number.isFinite(result.bytes)||result.bytes>MEMBER_PHOTO_LIMIT||result.width>2048||result.height>2048||(result.pages||1)>1)fail(502,'The stored photo could not be verified. Please contact an administrator.');
      const media=cleanMedia({id:result.asset_id,type:'image',publicId,version:result.version,width:result.width,height:result.height,caption:''}),status=purpose==='profile'?'approved':'pending';
      if(!await db.finishPhoto(id,media,status))fail(503,'The upload reached storage but its status could not be saved. Please contact an administrator.');
      if(purpose==='profile')await mutateMembers(db,s=>{s.accounts.find(a=>a.id===accountId).photo=media;});
      send(200,{id,media,status});
    }catch(error){if(db&&reservedId&&!providerStarted)try{await db.releasePhoto(reservedId);}catch{};send(error.status||503,{error:error.status?error.message:'The photo service is unavailable. Try again shortly.'});}
    finally{if(counted)inFlight--;}
  };
}
