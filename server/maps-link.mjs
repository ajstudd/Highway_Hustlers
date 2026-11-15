const fullHosts=new Set(['google.com','www.google.com','maps.google.com','google.co.in','www.google.co.in']);
export function googleMapsUrl(value){
  if(typeof value!=='string'||value.length>2048)throw Error('Paste a Google Maps link.');
  let url;try{url=new URL(value);}catch{throw Error('Use a full HTTPS Google Maps link.');}
  const allowed=(fullHosts.has(url.hostname)&&(url.hostname==='maps.google.com'||/^\/maps(?:\/|$)/.test(url.pathname)))||url.hostname==='maps.app.goo.gl'||(url.hostname==='goo.gl'&&url.pathname.startsWith('/maps/'));
  if(url.protocol!=='https:'||url.port||url.username||url.password||!allowed)throw Error('Use a Google Maps place link.');return url;
}
const pair=value=>{const match=/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(value||'');if(!match)return null;const lat=Number(match[1]),lon=Number(match[2]);return Math.abs(lat)<=90&&Math.abs(lon)<=180?{lat,lon}:null;};
export function coordinatesFromLink(value){
  const url=googleMapsUrl(value);let decoded;try{decoded=decodeURIComponent(url.href);}catch{throw Error('The link has invalid encoding.');}
  const pins=[...decoded.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)];
  // Pin coordinates, never the @lat,lon camera centre.
  if(pins.length){const pin=pins.at(-1),coords=pair(`${pin[1]},${pin[2]}`);if(coords)return coords;}
  for(const key of ['destination','query','q','ll']){const coords=pair(url.searchParams.get(key));if(coords)return coords;}
  return null;
}
export async function resolveMapsLink(value,fetcher=fetch){
  let url=googleMapsUrl(value);const signal=AbortSignal.timeout(7000);
  for(let step=0;step<5;step++){
    const coords=coordinatesFromLink(url.href);
    if(coords){let name='';try{name=decodeURIComponent(url.pathname.match(/\/place\/([^/]+)/)?.[1]||'').replace(/\+/g,' ').slice(0,100);}catch{}return {...coords,name,mapsUrl:url.href,distanceAvailable:false};}
    if(fullHosts.has(url.hostname))break;
    const response=await fetcher(url.href,{redirect:'manual',signal,headers:{Accept:'text/html'}});await response.body?.cancel();
    if(![301,302,303,307,308].includes(response.status))break;
    const location=response.headers.get('location');if(!location)break;url=googleMapsUrl(new URL(location,url).href);
  }
  throw Error('This link does not contain a place pin. Select the destination in Google Maps and copy its full place link, or enter coordinates under Advanced.');
}
