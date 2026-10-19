import type { PublicRider } from './garage.mjs';
import type { Place } from '../src/lib/gallery';
export type PublicSnapshot = { schemaVersion: 1; revision: string; publishedAt: string; cloudName: string; places: Place[]; riders: PublicRider[] };
export function validateSnapshot(input: unknown): PublicSnapshot;
