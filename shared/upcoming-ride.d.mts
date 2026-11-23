import type { Media } from '../src/lib/gallery';
export type UpcomingRide = {
  id?: string;
  enrollmentStart?: string;
  enrollmentEnd?: string;
  published: boolean;
  location: string;
  description: string;
  meetingPoint: string;
  meetingPointMapsUrl?: string;
  notes: string;
  mapsUrl: string;
  distanceKm?: number;
  date: string;
  meetingTime: string;
  images: Media[];
};
export function emptyUpcomingRide(): UpcomingRide;
export function cleanUpcomingRide(input: unknown, options?: { draft?: boolean }): UpcomingRide | null;
