import seed from '../data/gallery-seed.json';

export type Media = { id: string; type: 'image' | 'video'; publicId: string; version: number; width: number; height: number; caption: string };
export type Place = { id: string; name: string; description: string; kind: 'Sunday morning' | 'Full day' | 'Weekend'; km: number; lat: number; lon: number; published: boolean; legacyId?: string; media: Media[] };
export type Gallery = { places: Place[]; cloudName: string };
export const initialPlaces = seed as Place[];
export const initialGallery: Gallery = { places: initialPlaces, cloudName: 'jr5po5s7' };

export function mediaUrl(media: Media, cloudName: string, width = 1280, poster = false) {
  const id = media.publicId.split('/').map(encodeURIComponent).join('/');
  const transform = media.type === 'video' ? (poster ? `so_0,f_jpg,q_auto,w_${width},c_limit` : `q_auto,w_${width},c_limit`) : `f_auto,q_auto,w_${width},c_limit`;
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/${media.type}/upload/${transform}/v${media.version}/${id}.${media.type === 'video' && !poster ? 'mp4' : 'jpg'}`;
}

export async function cmsRequest<T>(action: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/cms?action=${action}`, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-HH-Admin': '1', ...options.headers } });
  const result = await response.json().catch(() => ({ error: 'The server returned an unexpected response. Try again.' }));
  if (!response.ok) throw new Error(result.error || 'Could not complete that request.');
  return result;
}
