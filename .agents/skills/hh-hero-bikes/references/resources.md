# Finding the correct resources

These are observed working examples, not permanent vendor API contracts. Re-check
the actual page when sourcing a new model or colour. Do not extrapolate filenames
or asset IDs as if they were verified resources.

## Discovery order

1. Inspect the user's reference and the current bike. Confirm model/generation,
   colour name, decal layout and which parts change colour.
2. Open the manufacturer's product page and select the colour. Inspect its visible
   rotation UI, page HTML/inline configuration and public image requests using the
   permitted browser or HTTP tools. Relevant terms: `360`, `arr360`, `has360`,
   `image`, `color`, `media_gallery`, `ThreeSixty`.
3. If that page only has a static photo, inspect an official regional product page
   for the same generation. For Apache, Mexico exposed the actual Negro Titanio set.
4. Extract the **ordered list** the viewer uses. Asset IDs and lexical filename order
   need not be angle order. Record the source page, selected colour, frame URLs and
   any cyclic start offset in a manifest or source module.
5. Verify downloads are images, not HTML error/challenge bodies. Inspect source
   dimensions, actual alpha, side/front/rear views and the wraparound. Remove a
   duplicated endpoint before preparing a rotation; do not invent missing angles.

Avoid blind URL grids. A fetch failure is not proof that a colour is unavailable.
Try the normal browser path when relevant, or a normal browser user-agent for a
public asset. Do not bypass authentication, anti-bot challenges or access restrictions.

## Proven manufacturer patterns in this repo

| Source | Where the usable set was found | Local implementation |
| --- | --- | --- |
| [TVS Mexico RR 310](https://mexico.tvsmotor.com/es/p/our-products/apache-rr-310-mx) | `arr360["titanium-black"]`, 24 explicit media IDs; selected label **Negro Titanio** | `scripts/apache-titanium-source.mjs` |
| [Royal Enfield Hunter](https://www.royalenfield.com/in/en/motorcycles/hunter-350/) | `content/dam/royal-enfield/motorcycles/hunter/colors/tokyo-black/tokyo-black1.png` through the page's 36-frame sequence | `scripts/prepare-bike-colours.mjs` |
| [Royal Enfield Classic](https://www.royalenfield.com/in/en/motorcycles/classic-350/) | `content/dam/royal-enfield/motorcycles/new-classic-350/revamp/colors/gun-grey/gun-grey1.png`, 36 frames | Same script; Classic is kept as Classic |
| [Hero Xpulse](https://www.heromotocorp.com/en-in/motorcycles/performance/xpulse-210.html) | Product JSON `media_gallery` for Azure Blue SKU `HXPLBTDSSFIABL`, 12 frames | Same script |
| [TVS Raider](https://www.tvsmotor.com/tvs-raider) | `Raider-360/360-raider/SSE/SSE-Webpp/Black-Panther/1.webp`, 8 frames | Same script uses `curl` with a normal user-agent |
| [Honda CB125 Hornet](https://www.honda2wheelersindia.com/motorcycle/cb125-hornet) | Black reference was static; the available 24-frame yellow set was adapted | `scripts/bike-paint.mjs`; explicitly disclosed as approximate |

The exact current URLs for the four patterned sets are in `prepare-bike-colours.mjs`.
The Honda finding is historical, not a claim that no factory black set can exist now.

## Stop and resolve fidelity when necessary

If the only asset is a static photo, offer photo + tilt as a clearly different
interaction, not fake 360°. If adaptation is approved, distinguish a paint-only
change from a full livery change. Match graphics as well as surfaces when needed,
and maintain coherent geometry/decals across every frame. Do not promise perfect
reconstruction from one reference image.

For each source retain provenance and check the applicable reuse rights. Manufacturer
attribution is not a replacement for permission. Do not strip required credits or
watermarks; obtain an appropriate source if those conflict with the design.
