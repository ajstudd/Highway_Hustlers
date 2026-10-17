# Sunday story game — approved direction

## User decisions

Approved on 17 October 2026:

- Replace the passive Sunday story with a playable, checkpoint-led ride.
- Low third-person chase camera; realistic bikes and adult riders, including a woman.
- Vibrant, slightly stylized Bhopal scenery: sunrise into clear morning, green roadsides,
  blue-green lakes, and the existing charcoal/marigold interface.
- Use exact HH motorcycle models, not generic bikes renamed to match the club's bikes.
- Source free assets with suitable reuse licenses only. No paid purchases.
- The palette and gameplay-composition concept shown in this conversation are approved.

This is a new Sunday experience, not a redesign of the hero or other website sections.
Existing uncommitted hero-skill work is unrelated and must be preserved.

## Carry into implementation

- Large human-scale riding view, not a miniature tabletop scene or a static backdrop.
- Compact mission objective top-left; time/pause/fullscreen controls top-right.
- Real Bhopal route minimap bottom-left, player/companion positions, minimal labels.
- In-world marigold navigation chevrons, tied to the next actual route direction.
- Small speed readout; compact checkpoint progression. No racing leaderboard or lap timer.
- Existing typography: Bricolage Grotesque, Inter Tight, and restrained Instrument Serif accents.
- Keyboard and touch controls, optional fullscreen, pause on focus/visibility loss,
  reduced-motion camera treatment, and a non-driving alternative for accessibility.

The generated concept is an atmosphere/composition reference, not a functioning game,
proof of a downloadable Apache model, an exact map, or a performance benchmark. Build
the world in 3D with real geometry; implement HUD text and controls semantically.

## Playable loop

1. **05:30 — Garage:** choose an available exact HH bike, open the garage, mount and ride out.
2. **06:00 — Meet up:** follow the route, brake/steer into the meeting bay, park and greet riders.
3. **06:30 — Open road:** accelerate, steer, lean around corners and overtake companions.
4. **08:00 — Breakfast:** park before dismounting; interact with chai and poha at the dhaba.
5. **10:00 — Destination:** reach Kerwa, park, take a picture and save a ride postcard.
6. **11:30 — Home safe:** ride back, park at home and complete the mission.

Prefer a complete 5–7-minute first loop with three polished bike choices, subject to
genuine asset availability. The specific three models are not yet locked.

## Mechanical invariants

- Player input controls travel, not elapsed time or page scrolling disguised as driving.
- Steering follows wheel travel, with smooth speed-dependent lean and braking.
- Wheels roll from travelled distance; feet/hands contact the bike correctly.
- Stop before dismounting; remount before moving. No sideways parking slide.
- Roads, checkpoints, buildings, scenery and the minimap must share coherent positions.
- Checkpoints require their real activities, not just pressing a button from anywhere.
- Inspect at road level; avoid disproportionate buildings, hovering tyres and capsule riders.
- Keep the website usable before the game loads and after it exits; don't capture
  page-wide keys or disable page scrolling unless the game is actively focused.

## Asset findings and current dependency

These are candidates, not approved game-ready assets. License metadata was checked
through the public Sketchfab model API on 17 October 2026. The actual meshes, textures,
generation, colours, topology and movable parts still require inspection.

| Candidate | Source | Observed license | Geometry / status |
| --- | --- | --- | --- |
| Hunter 350 by keshavckm1 | https://sketchfab.com/3d-models/royal-enfield-hunter-350-181adce5a476412e8bcc272883225397 | CC BY 4.0 | Downloaded and inspected: proper multipart mesh. Prepared GLB: 136,563 triangles, 24 material batches, 5.21 MB, separate wheels/steering and contact markers. Source colours retained; Tokyo Black livery and rider fitting pending. |
| Classic 350 by Mansoor | https://sketchfab.com/3d-models/royal-enfield-classic-350-f6495bfbffe443e89c499a2ba8766c88 | CC BY 4.0 | Downloaded and rendered. Older spoked-wheel/sprung-saddle Classic, not Shivank's modern Gun Grey model. Do not use as an exact current-HH bike without resolving this mismatch. |

The user has signed into Sketchfab in the connected Chrome profile. Normal downloads
work; no additional extension is needed. Hunter and Classic were acquired through the
official download modal. Authentication is no longer the dependency. Do not extract
viewer-only resources, bypass disabled downloads, or ask for passwords/API secrets.

User-supplied listings checked while signed in, plus public metadata on 17 October:

- [Kawasaki Ninja-300 by Taras.Pimpyx](https://sketchfab.com/3d-models/kawasaki-ninja-300-9547013212f241128b21ccb064997cc0):
  54,093 triangles; no download button; API `isDownloadable: false`; no reuse license
  supplied. Viewing the model does not permit extracting or embedding its geometry.
- [Yamaha_R15 by davidmartinezg2014](https://sketchfab.com/3d-models/yamaha-r15-2af0e4bab37644ce8cf4ce5eb522c4d7):
  999,859 triangles; no download button; API `isDownloadable: false`; no reuse license
  supplied. R15M generation not verified. Needs creator-provided files and permission
  before integration, not a viewer rip.

The prepared Hunter export, reproducible Blender script and rig-budget regression are
available in `public/ride-bikes/`, `scripts/prepare-ride-hunter.py` and
`scripts/test-ride-bikes.mjs`. This is asset preparation, not a released game. The
hero is unchanged. The user subsequently approved a Hunter-only first playable and
explicitly requested removing the scroll-driven timeline entirely.

## First playable implementation

- `src/components/sunday/game/`: route projection, deterministic bicycle controller,
  companion controllers, prepared model/rider fitting, scenery, renderer and HUD.
- Native page scrolling no longer controls travel. The old timeline, scrubber,
  sticky scroll wrapper and unused scenic world have been removed, not hidden.
- The existing OSRM loop is uniformly condensed to approximately 3.7 km of game
  geometry. Map and road use the same source/path. Scenery is interpreted.
- First player bike: Hunter 350. Runtime black repaint is not claimed as an exact
  factory decal reproduction. Companions are Hunter variants, not fake other models.
- Keyboard/touch inputs, steering assist, guided mode, pause/visibility handling,
  an expanded riding view, recovery, restart and a read-only story alternative.
- Garage door, stationary mount, curved driveway exit, six chapter gates, physical
  parking before dismount, greeting, chai/poha, delayed photo capture/download and
  home-safe completion. Open-road checkpoint is a pass-through, not another stop.
- No external APIs required at play time; textures, lighting and meshes are local.
- Tests: `node scripts/test-sunday.mjs`, `node scripts/test-actors.mjs`,
  `node scripts/test-ride-bikes.mjs`. Full 60 Hz guided-controller loop ~544 seconds
  after continuous road projection and advance braking for bends.

Browser checks: the full non-fixture mission was completed through visible controls,
including parking, all activities and the home-safe check-in. Subsequent targeted
checks covered keyboard and touch left/right steering, the 390px phone HUD, pause
and control-menu settings, breakfast camera clearance and the Kerwa photo preview.
The production build and TypeScript checks pass. This is stylized interpreted scenery,
not a street-accurate Bhopal reconstruction or a full collision/traffic simulator.

Driving options belong in the controls menu, not persistent HUD badges. No on-screen
assist status, repeating keyboard hints or pass counters. At junctions, curved edge
paint opens around intersecting roads; navigation chevrons retire before the bay rather
than stacking. Local route projection and continuous progress prevent branch snapping.
Steering regressions project motion through a Three.js chase camera at four headings,
so keyboard and touch direction cannot silently regress to world-axis controls.

Start/rider fixes: the minimap is driving-only, and the garage card has a reserved
bottom area plus a compact short-landscape layout. The start button was hit-tested
at 390×844 and 844×390. Boot planting blends over speed rather than switching at
0.5 m/s. The earlier sampled-pose interpolation did not resolve the reported shake
and has been removed. Rider and bike now share one lean parent, with pose/grip
updates on every rendered frame; animated clothing does not receive its own
coarse, cached self-shadow. Forest shadow caching is retained for performance. The actor-test VM
now targets ES2022, matching browser iteration/reset behavior. Real-skeleton checks
cover every joint, fixed saddle-relative pelvis position through changing bank,
same-frame grip contact, constant-pose invariance and continuous boot lift.
Those CPU-joint checks alone did not detect the user's recorded clothing shake.
The recording isolated a stale GPU skin palette: Three r186 prepares the main
render list before incrementing its frame counter for shadows. A shadow refresh
can mark the next frame's skeleton as already updated; cached-shadow frames then
draw the body using the previous pose, while the rigid helmet/bike are current.
The scene's pre-render hook now publishes every rider's final bone palette after
world/bind matrices update, independent of the renderer's lazy frame cache.
The regression uses the real WebGLObjects cache and shader-equivalent vertex math,
including GPU texture invalidation. It reproduces 30 stale frames in 90 before
the fix (~0.287 m maximum mismatch), versus zero after (~0.000031 m float error).
Companions match the visitor's pace and wait nearby; they are hidden only beyond
fully opaque fog, not at the former visible 140 m cutoff. Live braking/restart
checks confirmed both companions rejoined in view without respawning/teleporting.

Observed desktop rendering after batching/pose throttling reached approximately 60fps
at 1280×800 in the local browser. This is not a physical-phone performance benchmark.
Photo capture/preview is checked; browser download delivery may depend on the host's
download support, so the full-size image also supports normal save-image interaction.

Rejected or unresolved findings:

- The paid Hunter Factory Black listing is marked editorial-only, not an approved free asset.
- The free "Toy Bike — Yamaha R15 inspired" is explicitly a toy approximation, not R15M.
- The Xpulse scan found is noncommercial/share-alike and not verified as the requested 210.
- No suitable free, exact Apache RR 310 or additional current-HH model has been validated yet.
- Factory 360-degree photos in the hero are not steerable 3D meshes.

Before integrating a candidate: inspect model identity and completeness, validate the
listed reuse license and attribution, optimise geometry/textures for browser/mobile,
separate/pivot wheels and steering where necessary, fit rider contact poses, and
confirm the requested colour/livery. Do not label a rough scan or procedural proxy
as an exact production bike.

## Delivery checks

Complete the full mission through actual keyboard and touch input. Test stopping,
cornering, overtaking, checkpoint gating, camera recovery, pause/resume, restart,
photo export, loading/error recovery, narrow layouts and reduced motion. Measure
render/loading performance on the actual assets. Compare the built composition
to the approved mock and disclose any deviations. Keep the old Sunday section
working until a genuinely playable replacement is ready. Do not commit/push without
a separate user request.
