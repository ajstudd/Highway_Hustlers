# Hero colour sets

## Unassigned prank-bike drafts

`src/data/garage-drafts.json` adds three unassigned catalogue drafts without changing
the existing public hero entries or the Sunday game. New databases include these
drafts. Existing dashboard catalogues are offered missing drafts on load, but the
administrator must Save draft to persist them; saved edits and existing IDs are
never overwritten. Assigning and publishing remain explicit admin actions.

| Bike | Colour | Prepared views | Source and processing |
| --- | --- | --- | --- |
| TVS XL100 Heavy Duty Alloy | Red | 8 | [TVS India](https://www.tvsmotor.com/tvs-xl100/tvs-xl100-heavy-duty-alloy), native transparent 700×500 WebP. Files 1–8 are retained; the page's swapped 7/8 positions are put in angular order, and file 9's repeated opening angle is omitted. `tvs-xl100-hd-alloy-red-v1` starts at source 4 (right profile), `dir: 1`. |
| Honda Navi | Yellow | 8 | [Honda Ecuador](https://motos.honda.com.ec/producto/navi-6), native transparent 1000×800 PNG `NAVI_1.png`–`NAVI_8.png`. `honda-navi-yellow-v1` starts at source 8 (right profile), `dir: -1`. |
| Honda Monkey 125 | Pending | 0 | [Honda Spain](https://www.honda.es/motorcycles/range/125cc/monkey/Overview.html) currently embeds a Sketchfab 3D viewer, not a downloadable photographic turntable. The user explicitly chose to leave it pending rather than use single-photo tilt or invented angles. No model was ripped, no imagery generated, and the empty draft cannot be published. |

The XL100 and Navi preserve factory RGB/alpha and their existing soft source
shadows, with only one shared crop, scale and placement per complete set. Outputs
are lossless transparent 1200×720 WebP. No paint changes or background removal.
Ordered URLs and cyclic offsets are recorded in `scripts/bike-sources/tvs-xl100-red.json`
and `scripts/bike-sources/honda-navi-yellow.json`. Rebuild with
`node scripts/prepare-prank-bikes.mjs <Sharp package directory> <temporary source cache> tvs-xl100-red honda-navi-yellow`.
The helper refuses to overwrite an existing output directory. For all-angle
light/dark audits, run `node scripts/test-prank-bikes.mjs <Sharp package directory> <audit output directory>`.

Manufacturer imagery remains © TVS/Honda. Public availability and attribution do
not establish an open reuse licence; these drafts are not automatically published.

## Existing members' bikes

The original sets remain available for source/reference and the Sunday fallback. The hero uses versioned colour directories so cached images cannot mix old and new assets. Hunter and Classic use revision `-v2`; Apache uses `-factory-v3`, replacing the earlier paint approximation with genuine factory imagery.

| Bike | Colour | Frames | Method / official reference |
| --- | --- | --- | --- |
| Hunter 350 | Tokyo Black | 36 | Manufacturer turntable: https://www.royalenfield.com/in/en/motorcycles/hunter-350/ |
| Classic 350 | Gun Grey | 36 | Manufacturer turntable: https://www.royalenfield.com/in/en/motorcycles/classic-350/ |
| Xpulse 210 | Azure Blue | 12 | Manufacturer turntable: https://www.heromotocorp.com/en-in/motorcycles/performance/xpulse-210.html |
| Raider 125 · Split Seat | Blazing Blue | 8 | Manufacturer turntable: https://www.tvsmotor.com/tvs-raider/colours |
| Apache RR 310 | Titanium Black (Negro Titanio) | 24 | Manufacturer turntable: https://mexico.tvsmotor.com/es/p/our-products/apache-rr-310-mx |
| CB350RS | Mat Axis Grey Metallic (matte dark grey/black with lime accents) | 24 | Manufacturer turntable: https://www.honda2wheelersindia.com/motorcycle/CB350RS |
| Speed 400 | Lava Red Gloss / Storm Grey | 36 | Matching manufacturer/dealer turntable via https://westcoasttriumph.com/showroom/5/triumph/3/motorcycles/22508/196646/2026speed400; selected configurator reference below. White studio background removed, no paint editing. |
| 42 Bobber (Jasmine) | Black Mirror | 16 | Manufacturer turntable: https://www.jawayezdimotorcycles.com/products/jawa-42-bobber?variant=49488743694630 ; translucent studio floor removed, no paint editing |
| CB125 Hornet | Pearl Igneous Black | 24 | Engineered paint match, using the existing yellow turntable and https://www.honda2wheelersindia.com/motorcycle/cb125-hornet as colour reference |

The RR 310 uses all 24 images from the Mexico page's `arr360["titanium-black"]` sequence. The ordered asset IDs are recorded in `scripts/apache-titanium-source.mjs`; the sequence begins at manufacturer frame 12 so the hero opens facing right and increasing indices turn the rear toward the viewer. No recolouring, decal replacement, highlight correction or generative editing is applied. The black fairings, silver-grey tank, red accents, graphic placement and reflections are the factory source's own pixels, uniformly resized onto the hero canvas and losslessly encoded.

The Raider uses the **Split Seat → Blazing Blue** factory viewer, not the Metallic Blue DD variant or a recoloured Black Panther image. `scripts/bike-sources/tvs-raider-125-blazing-blue.json` records the exact `Color-New-images/Split-Seat/OneDrive_1_21-3-2025/Blazing-blue/Blue/Webp/` sequence. The viewer loads 1.webp–9.webp; 9.webp is byte-identical to 1.webp, so only the eight unique angles are retained. The 769×480 WebPs already have factory alpha. `scripts/prepare-raider-blue.mjs` removes the translucent lower studio-floor layer while retaining every opaque bike pixel and its original one-pixel antialiased outline. It does not change RGB or recolour panels. All eight views share one crop, scale and placement, lossless 1200×720 WebP output, and the existing drag/keyboard rotation. Frame 00 faces right; increasing source indices bring the front toward the viewer (`dir: -1`). The new `tvs-raider-125-blazing-blue-v1` path avoids stale Black Panther caches; the old set remains untouched and inactive. Imagery © TVS; attribution is not a claim of an open reuse licence.

Rebuild the active Raider with `node scripts/prepare-raider-blue.mjs <Sharp package directory> <source cache>`, then audit with `node scripts/test-raider-blue.mjs <Sharp package directory> <source cache>`. The legacy `prepare-bike-colours.mjs` Raider entry rebuilds the inactive Black Panther set only.

The CB350RS uses the Honda page's complete DLX Pro `Imag360` sequence: 1.png–24.png in `Honda-Bigwing_RS_Mat-Axis-Gray-Metallic_360dgr`. The ordered URLs and processing settings are in `scripts/bike-sources/cb350rs-mat-axis-grey-metallic.json`. Its matte dark-grey/black tank, neon-lime pinstripes, graphics and factory shadow are preserved without paint editing. Every frame uses one shared union crop/scale, 1200×720 canvas and lossless WebP; frame 00 faces right, with increasing indices turning the rear toward the viewer. The earlier light-grey set is inactive and kept locally for reference only.

Speed 400 uses `speed-400-lava-red-storm-grey-v2`, replacing the pale-tank images and the rejected v1 white-key cutout. The requested colour is **Lava Red Gloss / Storm Grey**, selected in https://www.triumphmotorcycles.com/configure/bike/e810fd07-e32e-4c08-afb9-960d0101765a/configure#config . The public model API `/api/configurator/bikes/model/e810fd07-e32e-4c08-afb9-960d0101765a` associates it with colour ID `a9d06148-6aed-4bc9-961f-a38436231fd9`, code `CULI`, and the two `my24_carnival red`/`my24-carnival-red-revised` side-view filenames. Those historical filenames do not override the user's selected colour label or establish an additional turntable.

The full matching 36-angle sequence was observed in West Coast Triumph's `#bikeCarousel img` list. The dealer lists Lava Red Gloss / Storm Grey and distributes the turntable through Room 58. Ordered URLs are recorded in `scripts/bike-sources/speed-400-lava-red-storm-grey.json`. The sequence starts facing right and turns the rear toward the viewer; no frame reversal, mirroring or invented views. Dealer/manufacturer attribution is not a claim of an open reuse licence.

These originals are 1100×629 studio-white JPEGs. The user explicitly approved pixel-based background removal without AI redrawing. The rejected v1 threshold method left jagged white fringes and removed bright body highlights. The v2 pipeline first honours the JPEG's embedded Display profile with Sharp. `scripts/matte-speed-lava.py` registers the existing genuine Speed rotation using SIFT/RANSAC and refines its geometry with optical flow, solely to seed a foreground/unknown/background trimap. It does not copy the old paint or directly reuse its mismatched silhouette. Closed-form alpha matting resolves the actual new photo's outlines, fine spokes and bright tank/mirror highlights. Only partial-alpha edge RGB is unmixed from studio white; opaque factory RGB is unchanged. No generated imagery or per-frame resizing is used. The source JPEG resolution still limits very close zooms.

`scripts/prepare-speed-lava.mjs` applies one shared union crop/scale across all 36 cutouts and losslessly encodes 1200×720 outputs. The factory red, dark rear tank panel, silver divider, lighting and decals remain from the new source. Original and superseded sets stay untouched and inactive. Geometry-guide hashes and registration inlier counts are saved in the temporary source cache's `matting-report-v2.json`.

Rebuild with Node 20+, a Sharp package directory and a Python 3.12 interpreter. Install offline-processing dependencies into an isolated temporary directory, not the app: `python -m pip install --target <temporary-packages> opencv-python-headless==5.0.0.93 pymatting==1.1.16`. Then run `node scripts/prepare-speed-lava.mjs <sharp-package-directory> <source-cache> <python-executable> <temporary-packages>`. The cache keeps downloaded JPEGs; existing output directories are refused. Run `node scripts/test-speed-lava.mjs <sharp-package-directory> <source-cache>` and inspect all views on light/dark backgrounds after any processing change.

The Jawa 42 Bobber uses the **Jawa All Stars 42 Bobber → All Stars Black Mirror** factory viewer: the black and chrome tank on blacked-out cycle parts. The viewer's `data-image-list-x` lists `42_Black_Mirror_-_360_Angles_8.png`–`16.png`, then `1`–`5` and `7`. It skips `6`, which is in the same set on the CDN and is the angle between `5` (head-on front) and `7`, so all 16 files are used in numeric order for even 22.5° steps. The ordered URLs are in `scripts/bike-sources/jawa-42-bobber-black-mirror.json`. The 1000×750 PNGs have factory alpha but also a near-white translucent studio floor and contact shadow spanning the whole canvas, which glows on dark backgrounds. `scripts/prepare-jawa-bobber.mjs` removes that translucent layer and keeps every opaque bike pixel and its original 1px antialiased edge, the same rule as the Raider. RGB is unchanged. All views share one crop, scale and placement in lossless 1200×720 WebP. Frame 00 (source 1) faces right; increasing indices bring the front toward the viewer (`dir: -1`). Imagery © Jawa Yezdi Motorcycles (Classic Legends); attribution is not a claim of an open reuse licence.

Rebuild with `node scripts/prepare-jawa-bobber.mjs <Sharp package directory> <source cache>`. The existing output directory is refused.

Only the CB125 Hornet still uses engineered paint. It preserves the original camera angles, alpha, geometry, lighting and graphic placement and approximates the requested scheme; it is not official photography of that colour variant. Its gold forks are retained, with gold wheel/decal tones.

Rebuild with `scripts/prepare-bike-colours.mjs`, passing a Node package directory containing Sharp. Optional trailing bike ids rebuild only those sets. `scripts/bike-paint.mjs` is the Honda's deterministic mask/colour implementation; no generative image model is used. The legacy Apache recolouring utilities remain available for comparison but are not used by the build pipeline or hero.

Each factory turntable is cropped/scaled once using its complete frame union and converted to WebP. `scripts/bike-cutouts.mjs` separates the Hunter display plinth and Classic floor matte, opens thin studio-shadow connections, retains substantive bike regions and restores their antialiased edges. The Classic's fully opaque shadow in frame 21 uses explicitly traced tyre contours. They share the hero's existing soft ground shadow rather than retaining long baked-in studio streaks. Engineered frames retain the original 1200×720 canvas and alpha, and use lossless WebP. All manufacturer imagery remains © its respective manufacturer; used to depict the members' bikes. See the site's Image credits disclosure.
