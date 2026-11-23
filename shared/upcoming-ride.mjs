import { cleanMedia } from '../server/content.mjs';
import { googleMapsUrl } from './maps-link.mjs';

export const emptyUpcomingRide = () => ({ published: false, location: '', description: '', meetingPoint: '', notes: '', mapsUrl: '', date: '', meetingTime: '', images: [] });
const text = (value, max) => {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw Error('Check the ride text fields and their lengths.');
  return value.trim();
};
const mapsLink = value => {
  const link = text(value ?? '', 2048);
  return link ? googleMapsUrl(link).href : '';
};
export function cleanUpcomingRide(value, { draft = false } = {}) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value) || typeof value.published !== 'boolean') throw Error('Choose whether to include the upcoming ride.');
  const ride = { published: !draft && value.published, location: text(value.location, 100), description: text(value.description, 600), meetingPoint: text(value.meetingPoint, 240), notes: text(value.notes ?? '', 1200), mapsUrl: mapsLink(value.mapsUrl), date: text(value.date ?? '', 10), meetingTime: text(value.meetingTime ?? '', 5), images: [] };
  const meetingPointMapsUrl = mapsLink(value.meetingPointMapsUrl);
  if (meetingPointMapsUrl) ride.meetingPointMapsUrl = meetingPointMapsUrl;
  if (value.distanceKm !== undefined) {
    if (!Number.isFinite(value.distanceKm) || value.distanceKm < 0 || value.distanceKm > 5000) throw Error('Enter a road distance between 0 and 5,000 km.');
    ride.distanceKm = value.distanceKm;
  }
  if (value.id !== undefined) { if (typeof value.id !== 'string' || !/^ride-[a-f0-9]{24}$/.test(value.id)) throw Error('Invalid ride identity. Reload the dashboard.'); ride.id = value.id; }
  for (const field of ['enrollmentStart','enrollmentEnd']) {
    if (value[field]) { if (typeof value[field] !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+05:30$/.test(value[field]) || !Number.isFinite(Date.parse(value[field])) || new Date(Date.parse(value[field])+19800000).toISOString().slice(0,16)!==value[field].slice(0,16)) throw Error('Choose a valid enrolment time in IST.'); ride[field] = value[field]; }
  }
  if (ride.enrollmentStart && ride.enrollmentEnd && Date.parse(ride.enrollmentStart) >= Date.parse(ride.enrollmentEnd)) throw Error('Enrolment must end after it starts.');
  if (ride.published && (!ride.location || !ride.description || !ride.meetingPoint)) throw Error('Add a location, description and meeting point before including the ride on publish.');
  if (ride.date && (!/^\d{4}-\d{2}-\d{2}$/.test(ride.date) || ride.date < '2000-01-01' || ride.date > '2199-12-31' || !Number.isFinite(Date.parse(`${ride.date}T00:00:00Z`)) || new Date(`${ride.date}T00:00:00Z`).toISOString().slice(0,10) !== ride.date)) throw Error('Choose a valid ride date.');
  if (ride.meetingTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(ride.meetingTime)) throw Error('Choose a valid meeting time.');
  if (!Array.isArray(value.images) || value.images.length > 6) throw Error('Use up to six photos for the upcoming ride.');
  ride.images = value.images.map(image => { const media = cleanMedia(image); if (media.type !== 'image') throw Error('Upcoming rides accept photos, not videos.'); return media; });
  if (new Set(ride.images.map(image => image.id)).size !== ride.images.length) throw Error('Each ride photo should appear only once.');
  return ride;
}
