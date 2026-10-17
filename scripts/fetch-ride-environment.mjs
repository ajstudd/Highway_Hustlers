import { mkdir, writeFile } from 'node:fs/promises';
const directory = new URL('../public/ride-environment/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const [id, maps] of [['asphalt_02', ['Diffuse', 'nor_gl']], ['grass_path_2', ['Diffuse']]]) {
  const response = await fetch(`https://api.polyhaven.com/files/${id}`);
  if (!response.ok) throw new Error(`${id}: ${response.status}`);
  const manifest = await response.json();
  for (const map of maps) {
    const resource = manifest[map]['1k'].jpg;
    const file = await fetch(resource.url);
    if (!file.ok) throw new Error(`${resource.url}: ${file.status}`);
    const name = `${id}-${map}.jpg`;
    await writeFile(new URL(name, directory), Buffer.from(await file.arrayBuffer()));
    console.log(name, resource.size);
  }
}
const manifest = await (await fetch('https://api.polyhaven.com/files/small_rural_road_02')).json();
const resource = manifest.hdri['1k'].hdr;
const hdr = await fetch(resource.url);
if (!hdr.ok) throw new Error(`HDRI: ${hdr.status}`);
await writeFile(new URL('sunrise.hdr', directory), Buffer.from(await hdr.arrayBuffer()));
console.log('sunrise.hdr', resource.size);
