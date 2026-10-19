# Processing and integrating a bike

## Ordered source manifest

Use Node 20+ and a package directory containing `sharp`. Sharp is not currently a
repo dependency. Discover an available runtime/package directory; do not copy a
previous agent's machine-specific cache path. If unavailable, use an isolated
temporary package directory with a normal registry installation rather than changing
project dependencies just for image preparation.

For a new set, save a JSON manifest (for example under `scripts/bike-sources/`):

```json
{
  "imageSet": "example-bike-exact-colour-v1",
  "sourcePage": "https://manufacturer.example/product",
  "startFrame": 0,
  "lossless": true,
  "frames": [
    "https://manufacturer.example/verified-first-frame.png",
    "https://manufacturer.example/verified-second-frame.png"
  ]
}
```

The URLs above are schema examples, **not resources to fetch**. Replace them with
the complete verified sequence. `frames` also accepts local paths relative to the
manifest, useful for approved/cleaned images. Do not commit private paths, tokens or
signed credentials. `curl: true` optionally uses curl with a normal browser user-agent.
`startFrame` rotates the sequence cyclically without reversing or mirroring it.

```sh
node scripts/prepare-bike-turntable.mjs --help
node scripts/prepare-bike-turntable.mjs scripts/bike-sources/example.json /path/to/sharp-package-directory
```

The helper rejects opaque/empty assets, duplicate frames, inconsistent canvases and
existing output directories. It creates `public/bikes/<imageSet>/00.webp` onward:
1200×720, one union crop, fit within 1080×640, horizontally centered, bottom at y=680.
It does **not** remove backgrounds/plinths, recolour paint or repair source alignment.
Use a new version suffix to revise a set. A failed run can leave a partial new output;
inspect it and move it aside recoverably or choose another version before retrying.
The optional third argument is an output root for isolated testing, not the hero path.

For the six existing colour sets, the existing script already captures vendor ordering
and model-specific cleanup:

```sh
node scripts/prepare-bike-colours.mjs /path/to/sharp-package-directory apache-rr310
```

Do not run that hard-coded script for an unknown model and assume it added anything.

## Alpha, floor and paint traps

- Composite onto both near-black and light backgrounds before deciding whether a
  transparent preview is broken. Invisible RGB beneath alpha 0 can appear as coloured
  rectangles in some image viewers; do not “repair” a clean alpha based on that alone.
- A factory alpha image may still include a solid podium or long studio shadow. Hunter
  had a black opaque plinth; Classic had a semi-transparent floor and **one fully opaque
  shadow in source frame 21**. Check every angle, not just frame 00.
- Preserve tyres, spokes, forks, mirrors, exhaust, lamps and anti-aliased edges. A fixed
  bottom crop amputates tyres at some angles. A global alpha threshold or “remove black”
  mask can remove the actual motorcycle. `bike-cutouts.mjs` contains model-specific
  examples, **not a universal mask for new bikes**.
- If approved recolouring is necessary, preserve geometry and original alpha; inspect
  frame-specific panel masks. Neutral decals/chrome, gold forks, red frame accents,
  reflectors and coloured lamps are not interchangeable with painted body panels.
  A global red/yellow hue filter produces scattered patches and changes unrelated parts.
- Do not reuse old Apache hand-traced masks on a new model or source camera set. Apache
  now uses factory imagery and bypasses the old recolour path entirely.
- Keep one shared fit across all frames. Changing crop, scale or baseline per angle
  makes the bike pulse, slide or bounce while rotating.
- Lossless WebP preserves normalized pixels but can be larger. If choosing lossy output,
  inspect decals and metallic detail and report any fidelity tradeoff; total set bytes
  and loading time matter, not just the first image's size.

## Register the bike

`src/data/site.ts` is the source of truth. For a new rider append a `Rider`; for a
colour change update the existing entry. Use real supplied rider details, not invented
names or testimonials. IDs are unique; a colour change keeps the same rider/bike ID.
If adding two riders with the same bike model, give each entry a unique ID and use
`imageSet` to share the assets when appropriate.

```ts
{
  id: 'example-bike', name: 'Supplied rider name',
  brand: 'Manufacturer', model: 'Exact model', cc: 300,
  character: 'Short bike category', colorName: 'Exact colour',
  imageSet: 'example-bike-exact-colour-v1',
  glow: '#82909c', frames: 24, dir: 1, facing: 'right',
}
```

- `frames`: actual number of prepared images, not a guessed target of 24/36.
- `facing`: direction the bike faces in prepared `00.webp`.
- `dir`: `1` if increasing image indices bring the bike's rear toward the viewer from
  the opening profile, `-1` otherwise. Verify visually; do not assume manufacturer order.
- `imageSet`: directory name, **not** a URL or path. `frameSrc(rider.id, i)` resolves it.
  Use a new versioned set to avoid mixing cached old/new colours.
- The spinner uses canvas frames with drag/inertia and arrow keys; ≤16 frames currently
  blend neighbours. A single frame uses tilt. Preserve reduced-motion behavior.
- Do not edit `BikeSpinner.tsx` or `Hero.tsx` for ordinary asset registration. They are
  already data-driven and load using `imageSet`.
- If the **first** rider's frame-00 path changes, update its preload in `index.html`.
- Update `public/bikes/COLOURS.md` with provenance/count/method and footer image credits
  in `src/components/Join.tsx`. Disclose adaptations without verbose marketing copy.
- `PRODUCT.md` records specific user choices; amend it only when those choices change.
- Hero frame registration does not automatically update the Sunday world's 3D bikes
  or fallback illustration; those are separate work and outside this workflow by default.

## Verification and handoff

1. Inspect a contact sheet of **every frame** on dark and light backgrounds. Check
   livery, edge halos, floor artifacts, centering, tyre contact, sequential angles,
   duplicate/missing views, wraparound, and reflections across the full rotation.
2. `npm run test:site` validates every registered rider's frame paths and basic metadata.
   `npm run test:bike-colours` protects the existing six sets; update that baseline only
   when intentionally changing one of those colour choices, not to bypass failures.
3. For the new preparation helper run
   `node scripts/test-bike-turntable.mjs /path/to/sharp-package-directory`.
4. Run `npx tsc --noEmit`, `npm run build` and `git diff --check` with a compatible Node.
5. In the actual hero select the rider, let the transition finish, drag through a full
   turn, test both arrow keys, switch away/back, and check the initial view. Inspect a
   narrow phone viewport too. Confirm the bike is visible, correctly named and usable
   without disturbing the established layout. Do not change React internals from a browser.
6. Save a screenshot of the final hero with surrounding context. Report source/fidelity,
   rotation mode, tests and any remaining limitation. Do not say “perfect” for an approximation.
7. Commit/push only if requested. Stage the active set and source/processing/metadata
   changes specifically; exclude temporary previews, raw source caches and superseded sets.

Completion means the requested bike/colour appears accurately in the actual hero,
the real interaction works, every angle has been checked, and the provenance is recorded.
