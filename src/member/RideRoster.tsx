import { Bike,UsersRound } from 'lucide-react';
import type { RideEntry } from './api';

export function RideRoster({ride}:{ride:RideEntry}){
  return <section className="member-ride-roster" aria-label={`Who’s riding to ${ride.details.location}`}><header><h3><UsersRound size={20} aria-hidden="true"/>Who’s riding</h3><span>{ride.roster.length} {ride.roster.length===1?'rider':'riders'}</span></header>
    {!ride.roster.length?<p>No one’s joined yet. Be the first?</p>:<ul>{ride.roster.map((member,index)=><li key={`${member.name}-${index}`}><Bike size={19} aria-hidden="true"/><div><strong>{member.name}</strong><p>{member.bikeName||'Bike details not added'}{member.bikeColour&&` · ${member.bikeColour}`}</p>{member.bikeNickname&&<span className="member-roster-nickname">{member.bikeNickname}</span>}</div></li>)}</ul>}
  </section>;
}
