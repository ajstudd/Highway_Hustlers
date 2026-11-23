import { sessionToken, digest } from './security.mjs';
import { cleanUpcomingRide } from '../shared/upcoming-ride.mjs';
import { savedMapPin } from '../shared/maps-link.mjs';
import { mutateMembers, notice } from './member-state.mjs';
import { isDeepStrictEqual } from 'node:util';

export const todayIST = (now = Date.now()) => new Date(now + 19800000).toISOString().slice(0,10);
export const rideExpired = (ride, now = Date.now()) => !!ride?.date && ride.date < todayIST(now);
export const enrollmentOpen = (ride, now = Date.now()) => !rideExpired(ride, now) && (!ride.enrollmentStart || now >= Date.parse(ride.enrollmentStart)) && (!ride.enrollmentEnd || now < Date.parse(ride.enrollmentEnd));
export function identifiedRide(value, existing = null, options) {
  const ride = cleanUpcomingRide(value, options);
  if (!ride) return null;
  return { ...ride, id: existing?.id || `ride-${sessionToken().slice(0,24)}` };
}
export async function archiveExpiredRide(db, seed, now = Date.now(), publishedRide = null) {
  const row = await db.get(seed), ride = publishedRide || row.upcomingRide;
  if (!ride?.published || !rideExpired(ride, now)) return null;
  const id = ride.id || `legacy-${digest(JSON.stringify(ride)).slice(0,24)}`;
  const galleryId = `past-${id}`;
  const existing = row.places.find(place => place.id === galleryId);
  if (!existing && row.places.length >= 100) throw Error('The gallery is full. Make space before archiving this ride.');
  const pin = savedMapPin(ride.mapsUrl);
  const draft = {
    id: galleryId, name: ride.location, description: ride.description.slice(0,400), kind: 'Sunday morning',
    distanceUnknown: ride.distanceKm == null, km: ride.distanceKm ?? 0,
    lat: pin?.lat ?? 0, lon: pin?.lon ?? 0, published: false, media: ride.images,
    needsLocationReview: !ride.mapsUrl, sourceRideId: id, rideDate: ride.date, mapsUrl: ride.mapsUrl || '',
  };
  const retainDraft = publishedRide && row.upcomingRide && !isDeepStrictEqual({ ...row.upcomingRide, published: true }, publishedRide) ? row.upcomingRide : null;
  if(existing&&(!row.upcomingRide||retainDraft))return null;
  const saved = await db.finishRide(existing ? row.places : [draft,...row.places], row.revision,retainDraft);
  if (!saved) return null;
  await mutateMembers(db, state => {
    const archived = state.rides.find(r => r.id === id);
    if (archived && archived.status !== 'cancelled' && archived.status !== 'completed') { archived.status = 'completed'; notice(state, 'Ride completed', `${ride.location}: thanks for riding with HHR.`); }
  });
  return { ...saved, archivedRideId: id, galleryId };
}
