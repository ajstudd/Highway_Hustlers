import assert from 'node:assert/strict';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { riderCardSvg } from '../shared/rider-card.mjs';
const id='HHR-1234567890ABCDEF12345678';
for(const name of ['Pranjal Kolhe','A very long rider name that needs to fit inside the card','A & B <script>alert("x")</script>']){
  const svg=riderCardSvg({id,name,bike:'Bajaj Pulsar NS 125',joinedAt:'2026-11-15T00:00:00Z'});
  assert(!svg.includes('<script>'));assert(!svg.includes('https://'));
  const {data,info}=await sharp(Buffer.from(svg)).resize(2000,1260).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const decoded=jsQR(new Uint8ClampedArray(data),info.width,info.height);
  assert.equal(decoded?.data,id,'QR must decode from the complete downloaded card at export resolution');
}
console.log('Rider card: exported card QR decodes to the full permanent ID, including long names and escaped text.');
