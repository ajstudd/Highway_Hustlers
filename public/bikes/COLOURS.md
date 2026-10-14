# Hero colour sets

The original sets remain available for source/reference and the Sunday fallback. The hero uses versioned colour directories so cached images cannot mix old and new assets. Hunter and Classic use revision `-v2`; Apache uses `-factory-v3`, replacing the earlier paint approximation with genuine factory imagery.

| Bike | Colour | Frames | Method / official reference |
| --- | --- | --- | --- |
| Hunter 350 | Tokyo Black | 36 | Manufacturer turntable: https://www.royalenfield.com/in/en/motorcycles/hunter-350/ |
| Classic 350 | Gun Grey | 36 | Manufacturer turntable: https://www.royalenfield.com/in/en/motorcycles/classic-350/ |
| Xpulse 210 | Azure Blue | 12 | Manufacturer turntable: https://www.heromotocorp.com/en-in/motorcycles/performance/xpulse-210.html |
| Raider 125 | Black Panther | 8 | Manufacturer turntable: https://www.tvsmotor.com/tvs-raider |
| Apache RR 310 | Titanium Black (Negro Titanio) | 24 | Manufacturer turntable: https://mexico.tvsmotor.com/es/p/our-products/apache-rr-310-mx |
| CB125 Hornet | Pearl Igneous Black | 24 | Engineered paint match, using the existing yellow turntable and https://www.honda2wheelersindia.com/motorcycle/cb125-hornet as colour reference |

The RR 310 uses all 24 images from the Mexico page's `arr360["titanium-black"]` sequence. The ordered asset IDs are recorded in `scripts/apache-titanium-source.mjs`; the sequence begins at manufacturer frame 12 so the hero opens facing right and increasing indices turn the rear toward the viewer. No recolouring, decal replacement, highlight correction or generative editing is applied. The black fairings, silver-grey tank, red accents, graphic placement and reflections are the factory source's own pixels, uniformly resized onto the hero canvas and losslessly encoded.

Only the Honda still uses engineered paint. It preserves the original camera angles, alpha, geometry, lighting and graphic placement and approximates the requested scheme; it is not official photography of that colour variant. Its gold forks are retained, with gold wheel/decal tones.

Rebuild with `scripts/prepare-bike-colours.mjs`, passing a Node package directory containing Sharp. Optional trailing bike ids rebuild only those sets. `scripts/bike-paint.mjs` is the Honda's deterministic mask/colour implementation; no generative image model is used. The legacy Apache recolouring utilities remain available for comparison but are not used by the build pipeline or hero.

Each factory turntable is cropped/scaled once using its complete frame union and converted to WebP. `scripts/bike-cutouts.mjs` separates the Hunter display plinth and Classic floor matte, opens thin studio-shadow connections, retains substantive bike regions and restores their antialiased edges. The Classic's fully opaque shadow in frame 21 uses explicitly traced tyre contours. They share the hero's existing soft ground shadow rather than retaining long baked-in studio streaks. Engineered frames retain the original 1200×720 canvas and alpha, and use lossless WebP. All manufacturer imagery remains © its respective manufacturer; used to depict the members' bikes. See the site's Image credits disclosure.
