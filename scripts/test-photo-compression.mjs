import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import policy from '../src/data/upload-policy.json' with {type:'json'};
let closed=0,draws=0,encodeCalls=0,oversized=false;
const canvas={width:0,height:0,getContext:()=>({fillStyle:'',fillRect(){},drawImage(){draws++;}}),toBlob(callback,type,quality){encodeCalls++;assert.equal(type,'image/jpeg'); callback(new Blob([new Uint8Array(quality>.7?1600000:500000)],{type}));}};
const sandbox={exports:{},require:name=>{assert(name.endsWith('upload-policy.json'));return policy;},File,Blob,URL,Image:class{},createImageBitmap:async()=>({width:oversized?100000:4000,height:3000,close(){closed++;}}),document:{createElement:type=>{assert.equal(type,'canvas');return canvas;}}};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/admin/uploads.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,sandbox);
const {validateUpload,photoDimensions,compressPhoto,fileSize}=sandbox.exports;
for(const type of ['image/jpeg','video/mp4']) {
  assert.equal(validateUpload({name:'test',type,size:25000000}),type.startsWith('image')?'image':'video');
  assert.throws(()=>validateUpload({name:'too-large',type,size:25000001}),/25 MB/);
  assert.throws(()=>validateUpload({name:'empty',type,size:0}));
}
assert.equal(validateUpload({name:'photo.heic',type:'',size:1000}),'image');
assert.throws(()=>validateUpload({name:'bad.svg',type:'image/svg+xml',size:1000}));
assert.throws(()=>validateUpload({name:'bad.pdf',type:'application/pdf',size:1000}));
assert.equal(fileSize(1000000),'1.0 MB');
assert.deepEqual({...photoDimensions(4000,3000)},{width:2048,height:1536});
assert.deepEqual({...photoDimensions(3000,4000)},{width:1536,height:2048});
assert.deepEqual({...photoDimensions(800,600)},{width:800,height:600});
assert.throws(()=>photoDimensions(100000,10000),/safely/);
const input=new File([new Uint8Array(3000000)],'photo.png',{type:'image/png'});
const output=await compressPhoto(input);
assert.equal(output.type,'image/jpeg');assert.equal(output.name,'photo.jpg');assert(output.size<=policy.maxPhotoBytes);assert(output.size<input.size);assert.equal(input.size,3000000);
assert.equal(encodeCalls,3,'quality is reduced until the output meets the size target');assert.equal(draws,1);assert.equal(closed,1);assert.equal(canvas.width,1,'canvas backing memory is released');
oversized=true;await assert.rejects(()=>compressPhoto(input),/safely/);assert.equal(closed,2,'decoded images are released even on failures');
console.log('Photo preparation: 25 MB boundaries, HEIC classification, unsupported/empty files, aspect ratios, no upscaling, compression target and cleanup passed.');
