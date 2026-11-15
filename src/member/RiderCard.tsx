import { useMemo,useState } from 'react';
import { Download } from 'lucide-react';
import { riderCardSvg } from '../../shared/rider-card.mjs';
import type { MemberAccount } from './api';
export function RiderCard({id,account}:{id:string;account:MemberAccount}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const svg=useMemo(()=>riderCardSvg({id,name:account.name,bike:account.bikeName,joinedAt:account.joinedAt}),[id,account.name,account.bikeName,account.joinedAt]);
  const src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  async function download(){setBusy(true);setError('');let url='';try{const image=new Image();image.src=src;await image.decode();const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=1260;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Download is unavailable in this browser.');ctx.drawImage(image,0,0,2000,1260);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Could not create the card.')),'image/png'));url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${id}-rider-card.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){setError(e instanceof Error?e.message:'Please try again.');if(url)URL.revokeObjectURL(url);}finally{setBusy(false);}}
  return <section id="member-card" className="member-card-section"><div className="member-section-heading"><div><p className="member-eyebrow">YOUR PLACE IN THE CREW</p><h2>Carry the <em>collective.</em></h2></div><button type="button" disabled={busy} onClick={()=>void download()}><Download size={16}/>{busy?'Preparing…':'Download card'}</button></div><div className="member-card-display"><img src={src} alt={`HHR member card for ${account.name}, rider ID ${id}`}/></div><p className="member-small">Your QR contains only your rider ID. A keepsake from the crew; it does not grant access or verify current membership.</p>{error&&<p role="alert">{error}</p>}</section>;
}
