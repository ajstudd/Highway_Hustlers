import type { CSSProperties } from 'react';
import type { PublicRider } from '../../shared/garage.mjs';
import { BikeSpinner } from '../components/hero/BikeSpinner';
import type { MemberAccount } from './api';

export function ProfileBike({bike,account,cloudName}:{bike:PublicRider;account:MemberAccount;cloudName:string}){
  return <section className="member-bike-banner" style={{'--glow':bike.glow} as CSSProperties} aria-label="Your motorcycle">
    <div className="stage-light" aria-hidden="true"/>
    <div className="member-bike-caption"><h2>{account.bikeNickname||bike.model}</h2><p>{account.bikeNickname?`${bike.brand} ${bike.model} · ${bike.colorName}`:`${bike.brand} · ${bike.colorName}`}</p></div>
    <div className="member-bike-canvas"><BikeSpinner key={JSON.stringify(bike)} rider={bike} cloudName={cloudName}/></div>
  </section>;
}
