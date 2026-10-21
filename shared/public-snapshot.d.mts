import type { PublicRider } from './garage.mjs';
import type { Place } from '../src/lib/gallery';
import type { UpcomingRide } from './upcoming-ride.mjs';
export type PublicSnapshot = { schemaVersion: 1; revision: string; publishedAt: string; cloudName: string; places: Place[]; riders: PublicRider[]; upcomingRide: UpcomingRide | null };
export function validateSnapshot(input: unknown): PublicSnapshot;
