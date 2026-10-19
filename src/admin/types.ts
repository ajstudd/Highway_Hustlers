import type { Place } from '../lib/gallery';
import type { Garage } from '../../shared/garage.mjs';
export type Publication = { revision: number; garageRevision: number; snapshotRevision: string; publishedAt: string; url: string };
export type EditorDocument = { places: Place[]; revision: number; garage: Garage; garageRevision: number; published: Publication | null; cloudName: string; cloudReady: boolean; publishReady: boolean; localPreview: boolean; snapshotUrl: string };
export type Section = 'places' | 'members' | 'bikes' | 'lineup';
