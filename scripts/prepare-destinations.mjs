// Rebuild the licensed destination assets. Pass a Node package directory containing sharp.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
const require = createRequire(resolve(process.argv[2] || '.', 'package.json'));
const sharp = require('sharp');
const files = {
  bhojpur: 'Bhojpur Main Temple.jpg',
  kolar: 'Kolar Reservoir - October 2018.jpg',
  raisen: 'Raisen Fort 2024.jpg',
  sanchi: 'Stupa 1, Sanchi 02.jpg',
  bhimbetka: 'Rock Shelter 3, Bhimbetka 01.jpg',
  pachmarhi: 'Pachmarhi Dhoopgarh.jpg',
};
const api = new URL('https://commons.wikimedia.org/w/api.php');
api.search = new URLSearchParams({ action: 'query', format: 'json', titles: Object.values(files).map(f => `File:${f}`).join('|'), prop: 'imageinfo', iiprop: 'url', iiurlwidth: '1280' });
const response = await fetch(api);
if (!response.ok) throw new Error(`Commons: ${response.status}`);
const pages = Object.values((await response.json()).query.pages);
await mkdir('public/destinations', { recursive: true });
const sources = Object.entries(files).map(([id, file]) => [id, pages.find(p => p.title === `File:${file}`).imageinfo[0].thumburl]);
sources.push(['kerwa', 'https://pd.w.org/2023/10/20265211b62eddb37.46758429-1536x1152.jpg']);
await Promise.all(sources.map(async ([id, url]) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`${id}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await sharp(buffer).rotate().resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 82 }).toFile(`public/destinations/${id}.webp`);
  await sharp(buffer).rotate().resize(160, 110, { fit: 'cover' }).webp({ quality: 75 }).toFile(`public/destinations/${id}-thumb.webp`);
  console.log(`Prepared ${id}`);
}));
