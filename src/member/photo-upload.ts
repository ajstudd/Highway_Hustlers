import { compressPhoto, validateUpload } from '../admin/uploads';
export async function uploadMemberPhoto(file:File,ride?:string){
  if(validateUpload(file)!=='image')throw Error('Choose a photo.');
  const prepared=await compressPhoto(file);
  const response=await fetch(`/api/member-photo?${ride?`ride=${encodeURIComponent(ride)}`:'purpose=profile'}`,{method:'POST',credentials:'same-origin',signal:AbortSignal.timeout(45000),headers:{'Content-Type':'application/octet-stream','X-HHR-Member':'1','X-HHR-Upload':crypto.randomUUID(),...(ride?{'X-HHR-Photo-Consent':'1'}:{})},body:prepared});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Photo upload failed.');return result;
}
