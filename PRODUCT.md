# Highway Hustlers

## Register

brand

## Users

Bhopal riders and prospective members exploring a friendly local riding community, often on a phone.

## Product Purpose

Introduce the people, Sunday ritual, and destinations of Highway Hustlers. Make joining feel welcoming for riders on any bike.

## Brand Personality

Cool, aesthetic, fun. Interactive and unique, with the warmth of a group of friends sharing the road and chai.

## Anti-references

Flat, generic decorative scenes, assembled miniature maps, disconnected visual keepsakes, and long passive timelines that fail to convey the experience of a Sunday ride.

## Design Principles

- Make the riding ritual tangible through visual storytelling.
- Use one continuous world: riders, camera, landscape, and time of day must move together smoothly.
- Tell the six-stop ritual with distinct actions and real pauses: kit up, meet up, open road, breakfast, ride destination, and home safe. Keep the pacing brisk and make each chapter interactive.
- Let visitors explore at their own pace.
- Use real Bhopal road geometry as a compact, F1-style route overlay inside the full-width illustrated ride. Keep the map text-free, with moving rider dots; retain a small data credit outside the scene. Mark the example route as illustrative in accessible labels and documentation until actual HH locations are supplied.
- The Sunday experience is a playable story-mode ride, not a scroll timeline. Use keyboard/touch acceleration, braking and steering, with optional steering assist and a guided ride. Page scrolling must never move the bike. Keep a simple read-only six-stop story alternative.
- Give the city, bridge, village, forest approach and lakeside destination distinct environments. Keep riders proportionate and recognizably human rather than capsule characters.
- Keep the playful details rooted in Bhopal and the group's actual bikes.
- Use rigged adult riders including a woman, physical hand/foot contact and different motorcycle silhouettes. Keep the live route HUD bottom-left and reserve scene space for the actual stop actions.
- Choreograph stops as steered, distance-based paths with braking to zero, followed by dismounting and walking. Reverse that order for departure; no lateral parking offsets or moving chassis during mounting. Keep every building footprint clear of the full road loop and paved parking access.
- Prioritize the friendly, inclusive community over speed or status.
- Preserve the established dark surfaces, marigold accent, and typography.
- Sunday game: low chase camera, sunrise into clear morning, green roadsides, blue-green lakes. The first playable uses a licensed, multipart Hunter 350; additional exact HH bike choices wait for authorised downloadable models. Do not substitute generic models or rip view-only assets. Visible credits must disclose the condensed route, interpreted scenery and in-game paint.
- Make favourite destinations a photo-led explorer with real, credited location imagery, immediate selection, Sunday/longer-trip filters, map links and a swipeable phone rail. Distinguish destination photographs from actual club ride photographs; do not use a delayed roulette animation.
- Manage places and HH photo/video albums at `/admin` on the same Vercel site. Require server-side password authentication, persistent content, published/draft controls, cover/media ordering and captions. Cloudinary serves media; Neon stores content and sessions. Keep the public explorer's established style and preserve legacy credits until replaced with actual club media. Do not expose credentials or use a frontend-only password gate.
- The dashboard also manages members, a reusable bike library, draft/hidden bikes and ordered hero assignments. Inactivating a member excludes their entries without deleting bikes. Save draft never changes the public website; explicit Publish creates a sanitized Cloudinary JSON snapshot. Public visits read that CDN file, not Neon, with no periodic database polling. Bootstrap the first snapshot before deploying this frontend. See `docs/gallery-admin.md` for rollout and recovery.
- Preserve original hero frames during Cloudinary migration. Import in resumable, verified batches; publish separately. Keep rotation downloads bounded to a small nearby-frame window and an 8/12-image decoded cache on phone/desktop. Stop offscreen work; never eagerly decode every bike or force a full opening spin.
- Keep copy short and specific. Avoid repeated slogans, redundant instructions and invented rider quotes. Instagram (`hhr_bhopal_`) is the only social call to action; no WhatsApp button.
- Preserve the fuller Our vibe paragraph: shared company, sunrise rides, dhaba chai, lakeside picnics, no ego or jealousy, any bike welcome, and treating riders as our own. Its culture and relaxed tone are intentional, not filler. Keep “We are not a racing club” removed.
- Identify Ninja 300 rider as Junaid K, and R15M/Pulsar N250 rider as Junaid A. Let the Sunday illustration occupy most of the available viewport, with compact controls kept visible.
- Hero colours: Hunter Tokyo Black, RR 310 Titanium Black, Classic Gun Grey, Xpulse Azure Blue, Raider Split Seat Blazing Blue, CB125 Hornet Pearl Igneous Black. Preserve rotation. Prefer manufacturer colour turntables; use deterministic masked paint adaptation where matching angle sets are unavailable, and disclose that adaptation in credits.
- RR 310 uses TVS Mexico's genuine 24-frame Negro Titanio turntable, not recoloured Racing Red frames. Preserve the factory decals, grey tank, black fairings and red trellis; only apply a shared crop/scale to fit the hero canvas.
- CB350RS uses Honda's Mat Axis Grey Metallic: matte dark-grey/black with neon-lime accents and its genuine 24-frame turntable, not the light-grey paint or a custom green tank. Speed 400 uses Lava Red Gloss / Storm Grey as selected in the supplied Triumph configurator: deeper red, a dark rear tank panel and a silver divider, not the old pale-tank set renamed MY24. Its matching 36-angle dealer turntable uses user-approved pixel-based white-background removal; retain factory paint, decals and complete rotation.

## Accessibility & Inclusion

Keyboard-operable controls, readable contrast, responsive layouts, and reduced-motion support. No additional specific requirements have been supplied.
