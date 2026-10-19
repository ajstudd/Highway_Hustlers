---
name: hh-hero-bikes
description: Add a rider or motorcycle, or change a hero bike colour in the Highway Hustlers repository. Find accurate product imagery, prepare consistent transparent rotation frames, register metadata, and verify the hero without redesigning it.
---

# Highway Hustlers hero bikes

Use from the Highway Hustlers checkout. Locate it by `src/data/site.ts`,
`src/components/hero/BikeSpinner.tsx`, and `PRODUCT.md`; do not assume a machine-specific path.
For agents without skill support, this file is the entrypoint to the same workflow.

## Read only what the task needs

- Read the current `Rider` type and relevant entry in `src/data/site.ts`, the spinner,
  and `public/bikes/COLOURS.md` before changing assets.
- For finding a new source, read [resource discovery](references/resources.md).
- For preparing frames, registering a bike, and verifying the result, read
  [processing and integration](references/workflow.md).
- Existing sets can be rebuilt with `scripts/prepare-bike-colours.mjs`.
  For new ordered frame sets use `scripts/prepare-bike-turntable.mjs`; run `--help` first.

## Decisions that matter

1. Preserve the requested model, colour, rider identity and rotation. Ask when the
   missing detail would change those choices. Classic 350 is not Bullet 350.
2. Prefer a genuine manufacturer turntable of the **exact model/year/livery**.
   Regional manufacturer sites can expose a colour missing from the Indian page.
   Do not conclude that a set is unavailable after inspecting only a static image.
3. Compare panel finishes, decals, wheels, forks and frame accents, not just hue.
   Recolouring Racing Red frames was not an accurate Titanium Black Apache.
4. A single photograph cannot establish a perfect unseen-side 360°. If no matching
   turntable exists, report the evidence and get a choice between an approximate
   adaptation, approved single-photo tilt, or obtaining more assets. Do not silently
   downgrade an existing 360° bike, invent angles, or label generated views factory imagery.
5. Fit the whole rotation with **one shared crop, scale and placement**, never fit
   each angle separately. Preserve ordered frames, transparent edges and wheel contact.
   A PNG extension or an alpha channel alone does not prove a clean cutout.
6. Use a new versioned `imageSet` for a changed colour/source. Keep originals and
   unrelated edits. Do not leave obsolete generated sets in a commit by staging the
   entire `public/bikes` tree indiscriminately.
7. Keep source URLs/order and processing reproducible, and credit sources accurately.
   Public download availability does not itself establish reuse permission.
8. Finish only after inspecting **all angles on dark and light backgrounds**, testing
   drag/keyboard rotation in the actual hero and checking a narrow viewport. A successful
   build or a good side-profile thumbnail does not prove visual correctness.

Do not redesign the hero, change the Sunday motorcycles, modify unrelated rider
assignments, install persistent tools, or push changes as a side effect of adding a bike.
Respect the invoking agent's image-editing/tool permissions. Deterministic processing
here covers format/geometry normalization; aesthetic paint or background edits need
the applicable image-editing workflow and honest disclosure.
