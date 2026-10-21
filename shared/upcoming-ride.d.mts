import type { Media } from '../src/lib/gallery';
export type UpcomingRide = { published: boolean; location: string; description: string; meetingPoint: string; notes: string; mapsUrl: string; date: string; meetingTime: string; images: Media[] };
export function emptyUpcomingRide(): UpcomingRide;
export function cleanUpcomingRide(input: unknown): UpcomingRide | null;
