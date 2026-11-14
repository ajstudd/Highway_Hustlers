import { publicRiders } from '../shared/garage.mjs';

export function profileBikeDetails(account, garage) {
  const assigned=garage.bikes.find(b=>b.id===account.bikeId);
  return {
    bikeId:assigned?.id||null,
    bikeName:assigned?`${assigned.brand} ${assigned.model}`.trim():account.bikeName||'',
    bikeColour:assigned?.colorName||account.bikeColour||'',
    bikeNickname:account.bikeNickname||'',
  };
}
export function profileBannerBike(account,garage) {
  const bike=garage.bikes.find(b=>b.id===account.bikeId);
  if(!bike?.frames.length||!bike.brand||!bike.model||!bike.colorName)return null;
  // Explicit private assignment may use a prepared draft without publishing it
  // to the public hero. Only this account's selected asset set is returned.
  return publicRiders({members:[{id:'profile-owner',name:account.name||'Your bike',active:true}],bikes:[{...bike,status:'published'}],lineup:[{id:'profile-bike',memberId:'profile-owner',bikeId:bike.id,visible:true}]})[0]||null;
}
export function rideRoster(state,ride,viewer,garage) {
  if(viewer.status!=='approved'||!state.allowed.includes(viewer.email))return [];
  return ride.participants.flatMap(id=>{
    const member=state.accounts.find(a=>a.id===id);
    if(!member||member.status!=='approved'||!state.allowed.includes(member.email))return [];
    const {bikeName,bikeColour,bikeNickname}=profileBikeDetails(member,garage);
    // Deliberate projection, not a profile spread: no email, phone, photo,
    // Google subject, account ID, library assets or moderation state here.
    return [{name:member.name,bikeName,bikeColour,bikeNickname}];
  });
}
