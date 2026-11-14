import { useState, type CSSProperties } from 'react';
import type { PublicRider } from '../../shared/garage.mjs';
import { BikeSpinner } from '../components/hero/BikeSpinner';

export function ProfileBike({bikes,cloudName}:{bikes:{rider:PublicRider;nickname:string}[];cloudName:string}){
  const [index,setIndex]=useState(0);
  const {rider:bike,nickname}=bikes[Math.min(index,bikes.length-1)];
  return <section className="member-bike-banner" style={{'--glow':bike.glow} as CSSProperties} aria-label={bikes.length>1?'Your motorcycles':'Your motorcycle'}>
    <div className="stage-light" aria-hidden="true"/>
    <div className="member-bike-caption"><h2>{nickname||bike.model}</h2><p>{nickname?`${bike.brand} ${bike.model} · ${bike.colorName}`:`${bike.brand} · ${bike.colorName}`}</p>
      {bikes.length>1&&<div className="member-bike-switch" role="group" aria-label="Choose a bike to view">{bikes.map((b,i)=><button key={b.rider.id} type="button" aria-pressed={i===index} onClick={()=>setIndex(i)}>{b.nickname||b.rider.model}</button>)}</div>}
    </div>
    <div className="member-bike-canvas"><BikeSpinner key={bike.id} rider={bike} cloudName={cloudName}/></div>
  </section>;
}
