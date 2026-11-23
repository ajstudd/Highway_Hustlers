import { googleMapsUrl, coordinatesFromLink } from '../shared/maps-link.mjs';
export { googleMapsUrl, coordinatesFromLink } from '../shared/maps-link.mjs';

export async function resolveMapsLink(value,fetcher=fetch){
  let url=googleMapsUrl(value);const signal=AbortSignal.timeout(7000);
  for(let step=0;step<5;step++){
    const coords=coordinatesFromLink(url.href);
    if(coords){let name='';try{name=decodeURIComponent(url.pathname.match(/\/place\/([^/]+)/)?.[1]||'').replace(/\+/g,' ').slice(0,100);}catch{}return {...coords,name,mapsUrl:url.href,distanceAvailable:false};}
    if(url.hostname!=='maps.app.goo.gl'&&url.hostname!=='goo.gl')break;
    const response=await fetcher(url.href,{redirect:'manual',signal,headers:{Accept:'text/html'}});await response.body?.cancel();
    if(![301,302,303,307,308].includes(response.status))break;
    const location=response.headers.get('location');if(!location)break;url=googleMapsUrl(new URL(location,url).href);
  }
  throw Error('This link does not contain a place pin. Select the destination in Google Maps and copy the full URL for the place.');
}
