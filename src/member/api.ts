import type { Media } from '../lib/gallery';
import type { UpcomingRide } from '../../shared/upcoming-ride.mjs';
import type { PublicRider } from '../../shared/garage.mjs';
export type BikeDetails={bikeName:string;bikeColour:string;bikeNickname:string};
export type ProfileBikeEntry=BikeDetails&{bikeId:string|null};
export type MemberAccount=BikeDetails&{id:string;email:string;name:string;phone:string;photo:string|Media;bikeId:string|null;bikeIds:string[];bikes:ProfileBikeEntry[];bikeNicknames?:Record<string,string>;status:'new'|'pending'|'approved'|'rejected'|'suspended';profileComplete:boolean;requestedAt:string|null;seenAt:string;joinedAt:string};
export type RideEntry={id:string;details:UpcomingRide;status:string;joined:boolean;enrollmentOpen:boolean;roster:(BikeDetails&{name:string})[];bikeId:string|null;photos:{id:string;status:string;media:Media|null}[];canUploadPhotos:boolean};
export type MemberHome={account:MemberAccount;bannerBikes:{rider:PublicRider;nickname:string}[];rides:RideEntry[];pastRides:RideEntry[];notifications:{id:string;title:string;message:string;createdAt:string}[];cloudName:string;photoUploads:boolean};
export async function memberRequest<T>(action:string,method='GET',body?:unknown):Promise<T>{
  const response=await fetch(`/api/member?action=${action}`,{method,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json','X-HHR-Member':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const result=await response.json().catch(()=>({error:'Could not read the response. Please try again.'}));if(!response.ok)throw Error(result.error||'Please try again.');return result;
}
