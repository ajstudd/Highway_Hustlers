# Bhopal Sunday route

`bhopal-sunday-route.json` contains a public, illustrative road loop, not an official Highway Hustlers itinerary or a navigation service. City start/home, Boat Club, Bhadbhada, Ratibad and Kerwa are sample waypoints. No personal home or meeting location is recorded. The stop times come from the supplied Sunday ritual, not routing duration estimates.

The geometry was retrieved on 2026-10-13 using the [OSRM road-routing API](https://project-osrm.org/docs/v5.5.1/api/) with OpenStreetMap road data. The original request URL, snapped waypoints, leg distances and full road geometry are retained in the JSON. Road access and routing can change; this snapshot is for visual storytelling only.

The route is rendered as a north-up SVG outline in an F1-style corner overlay, using the retained real road coordinates. A gold trail and three rider dots share the scene's journey position. Stop dots support mouse and keyboard selection; accessible labels explain the example route without adding visible location text.

The tile-map side panel, map headers, coordinates, zoom controls and network-dependent notices were removed following user feedback. No map tiles or external mapping runtime are required. Visible [OpenStreetMap attribution](https://www.openstreetmap.org/copyright) is placed below the ride controller, outside the scene.

The full-width Three.js ride scene is explicitly an illustration: its scenic road, building placement, farms and lake are not a geographic 3D reconstruction. Both visuals share one six-stop journey coordinate.
