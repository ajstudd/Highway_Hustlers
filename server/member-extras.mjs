import { profileBannerBikes } from './profile-bikes.mjs';
// The complete immutable account ID avoids collisions from shortened hashes.
export const riderCardId = account => `HHR-${account.id.toUpperCase()}`;
export function dreamBikeView(account, garage) {
  const name=account.dreamBikeName||'';
  const banner=account.dreamBikeId&&garage.bikes.some(b=>b.id===account.dreamBikeId&&b.frames.length>1)?profileBannerBikes({...account,heroMemberId:null,bikeIds:[account.dreamBikeId],bikeId:null,bikeNicknames:{},bikeNickname:''},garage)[0]?.rider||null:null;
  return {name,bikeId:account.dreamBikeId||null,requestedAt:account.dreamBikeRequestedAt||null,banner};
}
export function memberGallery(photos,state){
  return photos.filter(p=>p.media).map(p=>({id:p.id,media:p.media,status:p.status,ride:state.rides.find(r=>r.id===p.rideId)?.details.location||'A morning with HHR',createdAt:new Date(p.createdAt).toISOString()})).reverse();
}
