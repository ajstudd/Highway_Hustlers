import type { Place } from '../lib/gallery';

export default function PlaceLocation({ place, change }: {
  place: Place; change: (values: Partial<Place>) => void;
}) {
  const distanceUnknown = place.distanceUnknown ?? Boolean(place.needsLocationReview && place.km === 0);

  return <div className="admin-place-location">
    <div className="admin-two">
      <label>Google Maps destination link
        <input type="url" inputMode="url" maxLength={2048} value={place.mapsUrl ?? ''} placeholder="Paste a Google Maps link"
          onChange={event => change({ mapsUrl: event.target.value, needsLocationReview: true })}/>
      </label>
      <label>One-way road distance from Bhopal (km, optional)
        <input type="number" min="0" max="5000" step="any" value={distanceUnknown ? '' : place.km}
          onChange={event => change({ km: event.target.value === '' ? 0 : event.target.valueAsNumber, distanceUnknown: event.target.value === '' })}/>
      </label>
    </div>
    <p className="admin-muted admin-small">You can paste a short link from Google Maps Share or the full URL for the place.</p>
  </div>;
}
