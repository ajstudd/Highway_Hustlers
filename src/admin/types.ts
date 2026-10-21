import type { Place } from '../lib/gallery';
import type { Garage } from '../../shared/garage.mjs';
import type { UpcomingRide } from '../../shared/upcoming-ride.mjs';
export type Publication = { revision: number; garageRevision: number; snapshotRevision: string; publishedAt: string; url: string };
export type EditorDocument = { places: Place[]; upcomingRide: UpcomingRide | null; revision: number; garage: Garage; garageRevision: number; published: Publication | null; cloudName: string; cloudReady: boolean; publishReady: boolean; localPreview: boolean; snapshotUrl: string };
export type Section = 'places' | 'upcoming' | 'members' | 'bikes' | 'lineup';
