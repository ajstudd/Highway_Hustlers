import policy from '../data/upload-policy.json';

export { policy as uploadPolicy };
export const fileSize = (bytes: number) => bytes >= 1_000_000 ? `${(bytes/1_000_000).toFixed(1)} MB` : `${Math.max(1,Math.round(bytes/1000))} KB`;

export function validateUpload(file: Pick<File, 'name' | 'type' | 'size'>): 'image' | 'video' {
  if (!Number.isSafeInteger(file.size) || file.size <= 0) throw new Error(`${file.name}: this file is empty or unreadable.`);
  if (file.size > policy.maxSourceBytes) throw new Error(`${file.name}: the limit is 25 MB per photo or video. Choose a smaller file or trim the video first.`);
  if (file.type.startsWith('video/') || (!file.type && /\.(mp4|mov|m4v|webm|3gp|avi|mkv)$/i.test(file.name))) return 'video';
  if (['image/jpeg','image/png','image/webp','image/avif','image/heic','image/heif','image/heic-sequence','image/heif-sequence'].includes(file.type) || ((!file.type || file.type === 'application/octet-stream') && /\.(jpe?g|png|webp|avif|heic|heif)$/i.test(file.name))) return 'image';
  throw new Error(`${file.name}: choose a JPEG, PNG, WebP, AVIF or HEIC photo, or a video.`);
}

export function photoDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width*height > 60_000_000) throw new Error('This photo is too large to process safely. Export a version below 60 megapixels.');
  const ratio = Math.min(1,policy.maxPhotoDimension/Math.max(width,height));
  return { width: Math.max(1,Math.round(width*ratio)), height: Math.max(1,Math.round(height*ratio)) };
}

async function decodePhoto(file: File): Promise<{ image: CanvasImageSource; width: number; height: number; release: () => void }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    if (/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
      // Only load the HEIC decoder when the browser cannot decode a HEIC itself.
      try {
        const { heicTo } = await import('heic-to/csp');
        const bitmap = await heicTo({ blob: file, type: 'bitmap' });
        return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
      } catch { throw new Error('This HEIC photo could not be prepared. Export it as JPEG and try again.'); }
    }
    const url = URL.createObjectURL(file), image = new Image();
    try { image.src = url; await image.decode(); return { image, width: image.naturalWidth, height: image.naturalHeight, release: () => { image.src = ''; URL.revokeObjectURL(url); } }; }
    catch { URL.revokeObjectURL(url); throw new Error('This photo could not be decoded. Export it as JPEG and try again.'); }
  }
}

/** Resize, strip source metadata and encode one photo at a time before networking. */
export async function compressPhoto(file: File): Promise<File> {
  validateUpload(file);
  const decoded = await decodePhoto(file), canvas = document.createElement('canvas');
  try {
    const size = photoDimensions(decoded.width,decoded.height);
    canvas.width = size.width; canvas.height = size.height;
    const context = canvas.getContext('2d'); if (!context) throw new Error('Photo preparation is unavailable in this browser. Try another browser.');
    context.fillStyle = '#fff'; context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(decoded.image,0,0,canvas.width,canvas.height);
    for (const quality of [.84,.74,.64,.54,.44]) {
      const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not compress this photo. Try exporting it as JPEG.')), 'image/jpeg', quality));
      if (blob.type !== 'image/jpeg') throw new Error('This browser cannot prepare a JPEG photo.');
      if (blob.size <= policy.maxPhotoBytes) return new File([blob], `${file.name.replace(/\.[^.]+$/,'')}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
    }
    throw new Error('Could not reduce this photo below 1.5 MB. Export a smaller JPEG and try again.');
  } finally { decoded.release(); canvas.width = canvas.height = 1; }
}
