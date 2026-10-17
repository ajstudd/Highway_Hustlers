# HEIC decoding

The dashboard loads the unmodified `heic-to` 1.6.6 CSP distribution only when
native HEIC decoding fails. It is licensed under LGPL-3.0; its underlying HEIF
decoder and dependencies retain their upstream licenses. The public license
notice is at `/licenses/heic-to.txt`.

- Upstream source, dependency/build information: https://github.com/hoppergee/heic-to
- Exact published sources: https://www.npmjs.com/package/heic-to/v/1.6.6
- To replace/relink: change the `heic-to` dependency/version, run `bun install`,
  and `bun run build`. The dependency is dynamically imported in
  `src/admin/uploads.ts`, not incorporated into the normal public-page bundle.

No upstream library code has been modified. Source/build scripts are included
in the published npm package. Keep license notices when redistributing it.
