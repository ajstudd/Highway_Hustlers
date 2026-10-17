# Sunday game motorcycle assets

These are game meshes. They do not replace the photographic hero turntables.
An asset in this folder is not automatically a released player selection.

## Hunter 350 — source-colour preparation

- Model: [royal enfield hunter 350](https://sketchfab.com/3d-models/royal-enfield-hunter-350-181adce5a476412e8bcc272883225397)
- Author: [keshavckm1](https://sketchfab.com/keshavckm1)
- License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
- Downloaded through Sketchfab's authenticated download interface on 17 October 2026.
- Changes: metre calibration to 1.37 m axle spacing; reduced internal/tiny-part geometry;
  batching by material and moving assembly; separate rolling wheels, raked steering
  assembly, and rider contact markers. Original source colours retained.
- Source: approximately 549k triangles / 19.7 MB. Prepared: approximately 137k triangles
  / 5.2 MB / 24 material batches.
- Status: geometry/rig preparation, **not final HH Tokyo Black livery**. Source is blue
  with a reddish seat and lacks the final production-bike graphics. Do not label this
  export as a finished factory-colour match. Rider fitting and browser performance
  remain integration checks.

The game clones this source mesh and applies a black tank/dark saddle material pass
at runtime. Companion bikes use separate paint materials. This is disclosed in the
visible game credits as an in-game repaint, not a factory Tokyo Black decal match.
There is one player bike model in this release; Ninja/R15 view-only listings are not
included or presented as selectable assets.

Required visible credit when the game integrates this model:

“Hunter 350 by keshavckm1, CC BY 4.0. Modified for Highway Hustlers.”
Link the author/model and license in the game's accessible credits.

Rebuild with Blender (download the source yourself; do not commit the raw archive):

```sh
blender -b --python scripts/prepare-ride-hunter.py -- /absolute/path/royal_enfield_hunter_350.glb public/ride-bikes/hunter-350.glb
node scripts/test-ride-bikes.mjs
```

Rig uses glTF metres, Y up, +Z forward. `WheelFront` is parented to `Steering`;
`WheelRear` stays on the root. Wheel rotation is around local X. Steering's
`extras.axis` is expressed in the parent glTF coordinate frame. Wheel `extras.radius`
is in metres. Roll by signed distance/radius, not an arbitrary animation timer.
`GripLeft`/`GripRight` follow the steering; `SeatContact` and both foot markers follow
the chassis. Source-specific geometry IDs must not be reused for other motorcycles.
