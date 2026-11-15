// Rebuild an approved library set from its recorded factory sources.
// For access-restricted HTTP clients, export the exact image assets using the
// manufacturer's normal viewer and save them as 00.source, 01.source ... in cache.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {prepareTurntable,loadSharp} from './prepare-bike-turntable.mjs';
import {stripJawaBobberFloor} from './prepare-jawa-bobber.mjs';

const [manifestFile,packageDir,cacheDir,python,modelsDir]=process.argv.slice(2);
if(!cacheDir)throw Error('Usage: node prepare-library-bike.mjs <manifest.json> <sharp package directory> <cache directory> [python for studio matte] [model cache]');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),manifest=JSON.parse(await readFile(manifestFile,'utf8')),sharp=loadSharp(packageDir),cache=resolve(cacheDir),frames=[];
await mkdir(cache,{recursive:true});
for(let i=0;i<manifest.frames.length;i++){
  const path=resolve(cache,`${String(i).padStart(2,'0')}.source`);
  try{await readFile(path);}catch(error){if(error.code!=='ENOENT')throw error;const response=await fetch(manifest.frames[i],{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`Frame ${i}: HTTP ${response.status}. Use a normal viewer export if necessary; do not bypass access restrictions.`);const bytes=Buffer.from(await response.arrayBuffer());await sharp(bytes).metadata();await writeFile(path,bytes);}
  frames.push(path.replace(/\.source$/,'.png'));
}
if(manifest.preparation==='studio-alpha'){
  if(!python)throw Error('Studio sources require the approved offline alpha-extraction Python environment.');
  execFileSync(python,[resolve(root,'scripts/matte-library-bike.py'),cache,modelsDir||resolve(cache,'models'),String(manifest.wheelRegionStart??.60)],{stdio:'inherit',timeout:1800000});
}else if(manifest.preparation==='factory-alpha-floor'){
  for(let i=0;i<frames.length;i++){const {data,info}=await sharp(resolve(cache,`${String(i).padStart(2,'0')}.source`)).ensureAlpha().raw().toBuffer({resolveWithObject:true});await sharp(stripJawaBobberFloor(data,info.width,info.height),{raw:{width:info.width,height:info.height,channels:4}}).png().toFile(frames[i]);}
}else throw Error('Specify an approved preparation method in the manifest.');
console.log(JSON.stringify(await prepareTurntable({...manifest,frames},{sharp,baseDir:cache,outputRoot:resolve(root,'public/bikes')}),null,2));
