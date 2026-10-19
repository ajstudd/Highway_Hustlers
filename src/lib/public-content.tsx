import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { cleanGarage, publicRiders, bikeFrameUrl, type PublicRider } from '../../shared/garage.mjs';
import { cleanPlaces } from '../../server/content.mjs';
import seed from '../data/garage-seed.json';
import type { Place } from './gallery';

export type PublicSnapshot = { schemaVersion: 1; revision: string; publishedAt: string; cloudName: string; places: Place[]; riders: PublicRider[] };
const cloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'jr5po5s7';
const id = import.meta.env.VITE_CONTENT_SNAPSHOT_ID || 'hh-site/published.json';
export const publicContentUrl = import.meta.env.DEV ? '/content.json' : `https://res.cloudinary.com/${encodeURIComponent(cloud)}/raw/upload/${id.split('/').map(encodeURIComponent).join('/')}`;
const paths = new Set(seed.bikes.flatMap(b => b.frames.map(f => f.path)));
const Content = createContext<{ snapshot: PublicSnapshot | null; status: 'loading' | 'ready' | 'offline' }>({ snapshot: null, status: 'loading' });

export function validateSnapshot(input: unknown): PublicSnapshot {
  const s = input as PublicSnapshot;
  if (!s || s.schemaVersion !== 1 || typeof s.revision !== 'string' || s.revision.length > 100 || typeof s.publishedAt !== 'string' || !Number.isFinite(Date.parse(s.publishedAt)) || !/^[a-zA-Z0-9_-]+$/.test(s.cloudName) || !Array.isArray(s.riders) || s.riders.length > 200) throw Error('Invalid published content.');
  if (new Set(s.riders.map(r => r.id)).size !== s.riders.length) throw Error('Duplicate published entry.');
  const riders = s.riders.flatMap(r => publicRiders(cleanGarage({
    members: [{ id: r.id, name: r.name, active: true, role: r.role || '', line: r.line || '' }],
    bikes: [{ ...r, id: r.id, status: 'published', frames: r.frameAssets }],
    lineup: [{ id: r.id, memberId: r.id, bikeId: r.id, visible: true }],
  }, paths)));
  return { schemaVersion: 1, revision: s.revision, publishedAt: s.publishedAt, cloudName: s.cloudName, places: cleanPlaces(s.places).filter((p: Place) => p.published), riders };
}

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
