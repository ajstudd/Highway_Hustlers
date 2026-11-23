const fullHosts = new Set(['google.com', 'www.google.com', 'maps.google.com', 'google.co.in', 'www.google.co.in']);

export function googleMapsUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) throw Error('Paste a Google Maps link.');
  let url;
  try { url = new URL(value); } catch { throw Error('Use a full HTTPS Google Maps link.'); }
  const allowed = (fullHosts.has(url.hostname) && (url.hostname === 'maps.google.com' || /^\/maps(?:\/|$)/.test(url.pathname)))
    || url.hostname === 'maps.app.goo.gl' || (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps/'));
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !allowed) throw Error('Use a Google Maps place link.');
  return url;
}

function coordinatePair(value) {
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(value || '');
  if (!match) return null;
  const lat = Number(match[1]), lon = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

export function coordinatesFromLink(value) {
  const url = googleMapsUrl(value);
  let decoded;
  try { decoded = decodeURIComponent(url.href); } catch { throw Error('The link has invalid encoding.'); }
  // Explicit pins take precedence. The @lat,lon pair is only the camera centre.
  const pin = [...decoded.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)].at(-1);
  if (pin) {
    const coords = coordinatePair(`${pin[1]},${pin[2]}`);
    if (coords) return coords;
  }
  for (const key of ['destination', 'query', 'q', 'll']) {
    const coords = coordinatePair(url.searchParams.get(key));
    if (coords) return coords;
  }
  return null;
}

export function savedMapPin(value) {
  if (!value) return null;
  try { return coordinatesFromLink(value); } catch { return null; }
}
