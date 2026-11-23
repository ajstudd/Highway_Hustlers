import { isDeepStrictEqual } from 'node:util';
import { cleanPlaces } from './content.mjs';
import { cleanUpcomingRide } from '../shared/upcoming-ride.mjs';
import { cleanGarage, publicRiders } from '../shared/garage.mjs';
import { localFramePaths } from '../shared/garage-seed.mjs';
import { rideExpired } from './ride-lifecycle.mjs';
import { digest } from './security.mjs';
import { publishedGarageFor, reviewGarage } from './garage-review.mjs';

export function reviewPublication(live, gallery, garage, closedRides, now = Date.now()) {
  const livePlaces = live?.places ?? [];
  const liveRiders = live?.riders ?? [];
  const liveRide = live?.upcomingRide ?? null;
  const changes = [];
  const placeUpdates = new Map();
  const placeRemovals = new Set();
  const savedPlaces = new Map(gallery.places.map(place => [place.id, place]));
  const livePlacesById = new Map(livePlaces.map(place => [place.id, place]));

  for (const draft of gallery.places) {
    const previous = livePlacesById.get(draft.id);
    const change = { id: `place:${draft.id}`, title: draft.name, area: 'Places & media', action: previous ? 'Update' : 'Add' };
    try {
      const [place] = cleanPlaces([{ ...draft, published: true }]);
      if (isDeepStrictEqual(place, previous)) continue;
      placeUpdates.set(change.id, place);
    } catch (error) { change.issue = error.message; }
    changes.push(change);
  }
  for (const place of livePlaces) {
    if (savedPlaces.has(place.id)) continue;
    const id = `remove-place:${place.id}`;
    changes.push({ id, title: place.name, area: 'Places & media', action: 'Remove' });
    placeRemovals.add(id);
  }
  const draftOrder = gallery.places.map(place => place.id);
  const liveOrder = livePlaces.map(place => place.id);
  const commonDraftOrder = draftOrder.filter(id => livePlacesById.has(id));
  const commonLiveOrder = liveOrder.filter(id => savedPlaces.has(id));
  if (!isDeepStrictEqual(commonDraftOrder, commonLiveOrder) || draftOrder.some((id, index) => !livePlacesById.has(id) && draftOrder.slice(index + 1).some(next => livePlacesById.has(next)))) {
    changes.push({ id: 'place-order', title: 'Place order', area: 'Places & media', action: 'Reorder', details: ['Apply the saved order to the albums on the website.'] });
  }

  const publishedGarage = publishedGarageFor(garage, live);
  const hero = reviewGarage(cleanGarage(garage.garage, localFramePaths), publishedGarage);
  changes.push(...hero.changes);

  let ride = null;
  const draftRide = gallery.upcomingRide;
  if (draftRide && !closedRides.has(draftRide.id)) {
    const change = { id: 'ride', title: draftRide.location || 'Upcoming ride', area: 'Upcoming ride', action: liveRide ? 'Update' : 'Add' };
    try {
      if (rideExpired(draftRide, now)) throw Error('Choose a future date before publishing this ride.');
      ride = cleanUpcomingRide({ ...draftRide, published: true });
    }
    catch (error) { change.issue = error.message; }
    if (change.issue || !isDeepStrictEqual(ride, liveRide)) changes.push(change);
  }
  if (liveRide) changes.push({ id: 'remove-ride', title: liveRide.location, area: 'Upcoming ride', action: 'Remove', details: ['Take the announcement off the website and close member enrolment.'] });

  const reviewId = digest(JSON.stringify([live?.revision, gallery.revision, garage.revision, publishedGarage, changes]));
  return {
    changes, reviewId, revision: gallery.revision, garageRevision: garage.revision,
    apply(selection) {
      const picked = new Set(selection);
      const places = new Map(livePlacesById);
      for (const [id, place] of placeUpdates) if (picked.has(id)) places.set(place.id, place);
      for (const id of placeRemovals) if (picked.has(id)) places.delete(id.slice('remove-place:'.length));
      let ordered = [...places.values()];
      if (picked.has('place-order')) {
        const sorted = draftOrder.filter(id => places.has(id)).map(id => places.get(id));
        let index = 0;
        ordered = ordered.map(place => savedPlaces.has(place.id) ? sorted[index++] : place);
      }
      const publishHero = hero.changes.some(change => picked.has(change.id));
      const nextGarage = publishHero ? hero.apply(picked) : publishedGarage;
      return { garage: nextGarage, publicContent: {
        places: ordered,
        riders: publishHero ? publicRiders(nextGarage) : liveRiders,
        upcomingRide: picked.has('remove-ride') ? null : picked.has('ride') ? ride : liveRide,
      } };
    },
  };
}
