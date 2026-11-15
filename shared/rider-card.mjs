import QRCode from 'qrcode';
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function riderCardSvg({id,name,bike='',joinedAt=''}){
  const qr=QRCode.create(id,{errorCorrectionLevel:'M'}),n=qr.modules.size;
  const modules=[];for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.modules.get(y,x))modules.push(`M${x+4} ${y+4}h1v1h-1z`);
  const year=/^\d{4}/.exec(joinedAt)?.[0]||'—';
  const nameSize=Math.min(66,820/Math.max(12,Array.from(name).length)*1.6);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="630" viewBox="0 0 1000 630" role="img" aria-label="HHR rider card">
  <defs><linearGradient id="base" x2="1" y2="1"><stop stop-color="#232c2b"/><stop offset="1" stop-color="#111a19"/></linearGradient><linearGradient id="road" x2="0" y2="1"><stop stop-color="#f0bd54" stop-opacity=".4"/><stop offset="1" stop-color="#f0bd54" stop-opacity=".03"/></linearGradient><clipPath id="edge"><rect width="1000" height="630" rx="32"/></clipPath></defs>
  <g clip-path="url(#edge)"><rect width="1000" height="630" fill="url(#base)"/><g fill="none" stroke="url(#road)" stroke-width="1.5">${Array.from({length:12},(_,i)=>`<path d="M${520+i*22} -40 C${320+i*24} 120 ${920+i*18} 170 ${660+i*20} 370 S${530+i*22} 650 ${800+i*21} 700"/>`).join('')}</g>
  <rect x="24" y="24" width="952" height="582" rx="18" fill="none" stroke="#f3e6cb" stroke-opacity=".17"/>
  <g fill="#f2e8d4" font-family="Arial, sans-serif"><path d="M55 62h9v18h19V62h9v46h-9V89H64v19h-9zM104 62h9v18h19V62h9v46h-9V89h-19v19h-9z" fill="#f0bd54"/><text x="160" y="80" font-size="18" letter-spacing="3" font-weight="700">HIGHWAY HUSTLERS</text><text x="160" y="105" fill="#abafa5" font-size="13" letter-spacing="4">BHOPAL / RIDER COLLECTIVE</text>
  <rect x="795" y="64" width="148" height="33" rx="16" fill="#f0bd54"/><text x="869" y="86" text-anchor="middle" fill="#18221f" font-size="12" font-weight="700" letter-spacing="2">MEMBER CARD</text>
  <text x="55" y="195" fill="#f0bd54" font-size="12" letter-spacing="5">ONE CREW. MANY ROADS.</text>
  <text x="52" y="276" font-size="${nameSize}" font-weight="700" ${Array.from(name).length>24?'textLength="860" lengthAdjust="spacingAndGlyphs"':''}>${xml(name)}</text>
  <text x="55" y="316" font-size="19" fill="#b3b9ad" ${Array.from(bike).length>45?'textLength="830" lengthAdjust="spacingAndGlyphs"':''}>${xml(bike||'The road is better together.')}</text>
  <path d="M55 355h888" stroke="#f2e8d4" stroke-opacity=".2"/>
  <text x="55" y="402" font-size="11" letter-spacing="3" fill="#a1ab9e">RIDER IDENTIFICATION</text><text x="55" y="435" font-family="monospace" font-size="21" letter-spacing="1.2">${xml(id)}</text>
  <text x="55" y="487" font-size="11" letter-spacing="3" fill="#a1ab9e">MEMBER SINCE</text><text x="55" y="519" font-size="25">${xml(year)}</text>
  <text x="55" y="577" font-size="11" letter-spacing="2.5" fill="#f0bd54">RIDE KIND. RIDE CHILL.</text><text x="594" y="577" text-anchor="end" font-size="10" letter-spacing="1.2" fill="#a1ab9e">HHR / ${xml(year)}</text>
  </g><svg x="756" y="377" width="184" height="184" viewBox="0 0 ${n+8} ${n+8}"><rect width="100%" height="100%" fill="#fff"/><path d="${modules.join('')}" fill="#111a19" shape-rendering="crispEdges"/></svg><text x="848" y="582" text-anchor="middle" fill="#abafa5" font-family="Arial,sans-serif" font-size="10" letter-spacing="2">SCAN RIDER ID</text></g></svg>`;
}
