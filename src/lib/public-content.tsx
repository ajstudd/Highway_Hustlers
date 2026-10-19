import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { bikeFrameUrl, type PublicRider } from '../../shared/garage.mjs';
import { validateSnapshot, type PublicSnapshot } from '../../shared/public-snapshot.mjs';
export { validateSnapshot, type PublicSnapshot } from '../../shared/public-snapshot.mjs';

const cloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'jr5po5s7';
const id = import.meta.env.VITE_CONTENT_SNAPSHOT_ID || 'hh-site/published.json';
export const publicContentUrl = import.meta.env.DEV ? '/content.json' : `https://res.cloudinary.com/${encodeURIComponent(cloud)}/raw/upload/${id.split('/').map(encodeURIComponent).join('/')}`;
const Content = createContext<{ snapshot: PublicSnapshot | null; status: 'loading' | 'ready' | 'offline' }>({ snapshot: null, status: 'loading' });

export function PublicContentProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<{ snapshot: PublicSnapshot | null; status: 'loading' | 'ready' | 'offline' }>({ snapshot: null, status: 'loading' });
  useEffect(() => {
    let active = true;
    let controller: AbortController;
    const cacheKey = `hh-published-v1:${publicContentUrl}`;
    async function load() {
      controller?.abort(); controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(publicContentUrl, { credentials: 'omit', cache: 'no-cache', signal: controller.signal });
        if (!response.ok || Number(response.headers.get('content-length')) > 1500000) throw Error('Content unavailable.');
        const text = await response.text(); if (text.length > 1500000) throw Error('Content too large.');
        const snapshot = validateSnapshot(JSON.parse(text));
        if (!active) return;
        setValue({ snapshot, status: 'ready' });
        try { localStorage.setItem(cacheKey, JSON.stringify(snapshot)); } catch { /* Storage is optional. */ }
      } catch {
        if (!active) return;
        setValue(previous => {
          if (previous.snapshot) return { ...previous, status: 'offline' };
          try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) return { snapshot: validateSnapshot(JSON.parse(cached)), status: 'offline' };
          } catch { /* Never resurrect the source catalogue as a fallback. */ }
          return { snapshot: null, status: 'offline' };
        });
      } finally { clearTimeout(timeout); }
    }
    void load();
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('hh-published') : null;
    if (channel) channel.onmessage = () => { void load(); };
    return () => { active = false; controller?.abort(); channel?.close(); };
  }, []);
  return <Content.Provider value={value}>{children}</Content.Provider>;
}
export const usePublicContent = () => useContext(Content);
export const riderFrameSrc = (rider: PublicRider, frame: number, cloudName: string, width = 1200) => bikeFrameUrl(rider.frameAssets[frame], cloudName, width);
