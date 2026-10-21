# HH content dashboard

The existing Vite site stays on Vercel. `/admin` is the content dashboard;
`/api/cms` is its Vercel Node function. Neon stores draft content, publication status,
verified bike references, sessions and rate limits.
Cloudinary stores and delivers photos/videos, prepared bike frames and a published
JSON content snapshot. Normal public visits query **neither Neon nor the Cloudinary
Admin API**. Server secrets never use a `VITE_` prefix; only public delivery
configuration uses the optional `VITE_CLOUDINARY_CLOUD_NAME` / `VITE_CONTENT_SNAPSHOT_ID`.

## Upcoming ride

`/admin` → **Upcoming ride** manages one next ride, displayed between the favourite
mornings and the closing Instagram invitation. No sample ride is seeded in production.

- Set the location, description and meeting point. These are required when **Include
  on publish** is enabled. You can save an incomplete draft with that switch off.
- Date and meeting time are optional; meeting time is in India Standard Time (IST).
- Notes, an HTTPS Google Maps link and up to six photos are optional. Use the existing
  compressed uploader (25 MB source limit) or pick photos from the Cloudinary library.
  Change captions/order or remove references without deleting originals.
- **Preview section** shows the current draft without publishing. **Save draft** then
  **Publish website** makes the announcement live, like other content sections.
- After a ride, turn off **Include on publish**, save and publish to hide it. Dates do
  not automatically expire announcements. With no published ride, the entire section
  is omitted, including its space. The main Ride with us link targets the announcement
  when present, and the Instagram invitation otherwise.

Storage adds a nullable `upcoming_ride` JSONB column to `hh_gallery` through an
idempotent, non-destructive migration. Ride edits share the gallery's optimistic
revision counter, so stale saves/publications conflict rather than overwrite newer
work. Saving places preserves the ride and vice versa. The public JSON adds an
optional `upcomingRide`; older publications and last-good browser caches remain
valid. All publication paths (dashboard, first-build bootstrap, recovery script)
include only the eligible saved ride. Public delivery still makes zero Neon queries.
Hidden content is not private media; do not put sensitive details into a public ride.

## One-time production setup

1. In the existing **Vercel project → Storage**, connect a **Neon Postgres** database.
   Choose the free plan and connect the Production environment. Confirm it creates
   `DATABASE_URL`. Do not enable paid overages. Use a separate database/branch for
   Preview/Development so test edits cannot change the live gallery.
2. Run `npm run admin:password` in an interactive terminal. Choose a unique password
   of at least 14 characters. It masks input and prints a scrypt password hash.
3. Under **Vercel project → Settings → Environment Variables**, add:

   | Variable | Value |
   | --- | --- |
   | `ADMIN_PASSWORD_HASH` | The entire generated hash, including `$` separators, without quotes |
   | `CLOUDINARY_CLOUD_NAME` | `jr5po5s7` |
   | `CLOUDINARY_API_KEY` | The Cloudinary API key for this product environment |
   | `CLOUDINARY_API_SECRET` | The corresponding API secret |
   | `DATABASE_URL` | Added by the Neon integration; use its connection string |

   Set sensitive variables as **Sensitive** in Vercel. Do not paste them in chat,
   source code, screenshots, or a browser console. The Cloudinary cloud name is
   public; the API secret and DB connection string must remain server-only.
4. **Deploy normally. The first content publication is automatic.** The configured
   build command runs Vite first, then `scripts/ensure-production-content.mjs`.
   Only a Vercel Production build can perform automatic setup. It uses the existing
   Production credentials, preserves the saved gallery and seeds the 10 members /
   11 member bikes plus unassigned draft presets only if no catalogue exists. If no prior publication exists and the CDN
   file is missing, it publishes the eligible saved content and verifies the exact
   delivery URL before the build succeeds. No local environment file or manual
   terminal publishing is required. Local and Preview builds skip this step.
   Existing content is verified without querying Neon; subsequent deployments never
   publish newer drafts. A failed check blocks the build. If a previously published
   file is missing, restore it or explicitly publish in the dashboard; the build
   will not use that failure as permission to publish drafts. Original bike paths
   continue working until the separate migration finishes. The manual
   `scripts/publish-current-content.mjs` tool is retained for deliberate recovery,
   not routine setup. This guide does not itself authorize deploying or publishing.
5. Open `https://YOUR-DOMAIN/admin`, sign in, and choose a place. Use **Choose from
   Cloudinary** to select the four existing uploads. New uploads go directly from
   the browser to Cloudinary using a signature from the authenticated API.
6. Reorder media: the first item becomes the cover. Add captions and coordinates,
   choose **Include on publish**, then **Save draft**. This saves to Neon without
   changing the live site. **Publish website** validates the saved content, writes an
   immutable recovery snapshot, replaces the public JSON alias and requests CDN
   invalidation. Other visitors get the publication on their next load; an already
   open tab is not polled every minute. Same-browser publications notify open website
   tabs once. CDN/browser caches can take a short time to refresh. No redeploy is
   needed for subsequent editorial changes.

Neon tables are created idempotently on the first **private/admin** request. The initial
seven destinations keep their existing images and attribution; adding club media
replaces that place's legacy photo. New places start as drafts and need media to
publish. No photo is assigned to an invented location automatically.

### Inactivity and free-tier availability

Neon scales idle compute to zero after five minutes and wakes automatically on
the next database query. It does not require a weekly manual project restore.
The first request after sleep can take a little longer. This is different from
running out of free resources: compute-hour or transfer allowance exhaustion can
suspend service until the next billing period or an upgrade. Monitor the Neon
usage dashboard; a free plan is not an unlimited availability guarantee.
Do not add artificial keep-alive pings: they waste compute and can exhaust the
free allowance. See [scale to zero](https://neon.com/docs/introduction/scale-to-zero)
and [free-plan limits](https://neon.com/docs/introduction/plans).

## Security and content behavior

- Single shared administrator password, verified by server-side scrypt
  (N=32768, r=8, p=3). No public registration or frontend password comparison.
- Cryptographically random 8-hour sessions; only token hashes are stored in Neon.
  Cookies are HttpOnly, SameSite=Strict, Secure and `__Host-` prefixed on Vercel.
  Logout revokes the session; password-hash rotation invalidates all old sessions.
- Mutation requests require same-origin JSON and a custom header. Login attempts
  are rate-limited in the DB across serverless instances (10 per IP / 15 minutes,
  plus a global limit). Upload signing has an authenticated rate limit.
- Cloudinary uploads use fixed folder/random public IDs/non-overwrite signatures.
  API secrets never reach the browser. Library browsing is authenticated and paged.
- Published snapshots filter out drafts; they contain no session or credential data.
  The public API is only a database-free redirect for legacy clients. The new
  public frontend reads the Cloudinary JSON directly, with no API/session request.
  Static admin UI code is public like any login screen; all private data/actions
  are protected at the API. `/admin` is excluded from search indexing.
- Edits use optimistic revisions: stale tabs cannot silently overwrite a save.
  Removing media or places never deletes original files in Cloudinary. Removing
  a place is confirmed in the UI and takes effect only after saving and publishing.
- Draft means hidden from this website, **not private Cloudinary files**. The
  chosen Cloudinary upload type is public. Do not upload private/sensitive media.
- New dashboard uploads accept **25 MB per source photo or video** (25,000,000
  bytes). The full selection is checked before any file is uploaded. Oversized
  source files are rejected rather than silently uploaded for compression.
- Photos are prepared **in the browser before transfer**: preserve aspect ratio,
  never upscale, cap the longest edge at 2048 px, and encode as JPEG targeting
  at most 1.5 MB. Source metadata is not copied. The original local file is unchanged.
  HEIC is decoded natively where supported, otherwise a lazy-loaded HEIC decoder
  prepares it locally. Raster formats only; animated images/SVGs are not accepted.
  This keeps uploaded photos below Cloudinary's separate 10 MB account limit.
- Videos below 25 MB transfer directly to Cloudinary, then signed **incoming**
  transformations cap dimensions to 1280 px and encode H.264/AAC MP4 with automatic
  quality **before storage**. This is server-side compression, not pre-transfer
  browser video compression. It consumes Cloudinary processing credits. No large
  browser video encoder or extra processing service is loaded.
- The authenticated signing API rejects missing/oversized declared sizes. Fixed
  compression transformations are included in the signature; arbitrary client
  transformations cannot replace them. A session-bound confirmation ticket then
  checks the actual Cloudinary asset size/dimensions before adding it to the album.
  Provider verification failure preserves any earlier successful uploads in the
  same batch and leaves a clear error. Unattached originals remain in Cloudinary
  for the admin to review/remove; confirmation never deletes an existing asset.
- Cloudinary does **not** support per-upload-preset size limits. The 25 MB source
  cap is enforced by this trusted-admin UI and checked in declared signing metadata;
  it is not a claim that a malicious administrator cannot bypass the direct-upload
  client or Cloudinary's own console. Stored assets are independently checked on
  confirmation. A public/untrusted uploader would need a different upload boundary.
  See [upload presets](https://cloudinary.com/documentation/upload_presets).
- Clips play only when opened; not on page load. Cloudinary's storage, processing
  and transfer still consume the free allowance. Previously uploaded library
  assets aren't destructively recompressed or removed by this change.
- Keep secure backups of the database. Free tiers have limits; monitor both
  dashboards. The app does not purchase or upgrade services automatically.

## Members, bike library and hero lineup

The library includes unassigned draft presets for the TVS XL100 (Red), Honda Navi
(Yellow) and Honda Monkey 125. XL100/Navi have eight factory rotation views each;
Monkey remains image-less and pending until a genuine rotation is available.
They do not appear in the public hero until explicitly prepared, assigned and
published. Existing catalogues are offered missing draft presets without changing
saved bikes or assignments; use Save draft to retain those additions. Their paths
are validated alongside the original checked-in sets. Existing Cloudinary-hosted
frames and admin changes are not overwritten.

- **Members**: the initial catalogue deduplicates Junaid A's two entries into one
  member, while keeping Junaid K separate. Deactivating a member excludes all their
  hero entries from the next publication. It does not delete their bikes or images.
- **Bike library**: metadata and image sets are separate from members. Draft and
  hidden bikes are never exported. Published status means eligible for the hero;
  a visible lineup assignment and an active member are still required.
- **Hero lineup**: assign/reassign members and bikes, toggle individual entries,
  change order and preview the actual hero before publishing. Multiple members may
  reference the same image set without duplicating the files. An empty lineup is
  intentional and shows the HH introduction without fetching fallback bikes.
- **New images**: select an ordered set of 1–144 prepared transparent PNG/WebP
  images, each 1200×720 and below 10 MB (the provider's image-file cap). Browser
  validation checks the complete selection's dimensions, nonempty alpha and duplicate
  raster endpoints before uploading. Files are uploaded unchanged, **not** through the
  album JPEG compressor. Use one shared fit for the whole rotation; this uploader does
  not create new camera angles or remove backgrounds. Fine cutout quality still needs
  a human visual check. One photo uses tilt. Uploading a replacement sets the bike to
  Draft until reviewed. Every confirmed asset's format, size and dimensions are checked
  server-side and recorded in `hh_bike_assets`; unconfirmed references cannot be saved.
  Transparency inspection is client-side in this trusted-admin workflow, not a claim
  that an administrator cannot bypass it with an arbitrary API client.
- Original uploads use immutable random IDs under `hh-bikes/`. Frame confirmations
  are session-bound, time-limited, and cached in Neon to avoid repeated Admin API
  lookups on retry. Completed files from a failed replacement selection can be reused
  by selecting the same files again in that tab; refreshing the tab loses that memo.
  Unattached files remain in Cloudinary, never automatically deleted.
- **Migration**: save any edits first, then use “Move existing frames to Cloudinary”.
  Only the current catalogue's original paths are imported, in batches of up to 12,
  with two upload transfers at a time. Confirmed batches are saved as drafts. Missing
  originals remain in their exact frame positions, allowing a failed migration to
  resume without losing order. The migration never publishes or deletes local files.
  Review previews and publish after completion. The initial 257 confirmations consume
  Cloudinary Admin API allowance; pause and resume later if your account is rate-limited.
- The Sunday game's motorcycles are separate and deliberately unchanged.

## Publishing, outages and quotas

The saved editorial data stays in Neon (`hh_gallery` + `hh_site`). The publication
contains only whitelisted visible fields and media references. No draft catalogue,
member activity flags, sessions, passwords or API credentials are included. A
five-minute publication lock serializes publishers; optimistic revisions reject stale
tabs. Cloudinary requests have shorter timeouts than that lock. If the function dies,
the lock expires so the admin can retry. A lost response or failure after the public
alias upload can make publication status uncertain; retrying safely republishes the
saved draft. Ordinary upload failures leave the preceding public alias intact.

Default public JSON: `https://res.cloudinary.com/jr5po5s7/raw/upload/hh-site/published.json`.
To use another Cloudinary product environment or snapshot namespace, set the server's
`CLOUDINARY_CLOUD_NAME` / `CONTENT_SNAPSHOT_ID` **and** matching public build variables
`VITE_CLOUDINARY_CLOUD_NAME` / `VITE_CONTENT_SNAPSHOT_ID`. Only these public names/paths
belong in `VITE_` variables. Preview deployments must have an explicit separate
`CONTENT_SNAPSHOT_ID` or publishing is refused; use a separate development DB/branch
and a matching preview public path as well.

Public clients request the snapshot on load, then retain the last successfully
validated copy in optional browser storage for outages. They never substitute the
hard-coded rider catalogue after a missing/empty publication; cached content can be
older while offline. Cloudinary public images are not private merely because their
website entry is hidden. Admin edits cannot be made while Neon is suspended, but an
already published site remains database-independent. Cloudinary/CDN outages and free
transfer/storage/transformation limits still apply; this architecture is not an
unlimited availability promise. No keep-alive or periodic public DB requests exist.

The hero loads its opening view and a small moving neighbourhood, rather than decoding
the full set. Transfers are limited to two per spinner; decoded images are limited to
12 on desktop / 8 on phone, plus in-flight work. Offscreen/hidden-tab rendering pauses
and releases all but the current cached view. Mobile delivery uses 720px frames,
thumbnails use 160px Cloudinary derivatives, and originals remain untouched. Large
decorative initial spins no longer force downloading the entire first bike.

## Local development

`src/data/garage-seed.json` bootstraps **new** databases; it does not overwrite an
existing saved catalogue. Keep it aligned with `src/data/site.ts` when changing
checked-in bike assets (`scripts/seed-garage.mjs` prints a reviewable patch;
`npm run test:site` catches drift). Once a database has a catalogue, make its
member, bike and assignment changes in the dashboard and publish explicitly.

Set `ADMIN_PASSWORD_HASH` and either a separate development `DATABASE_URL`, or
explicitly set `CMS_LOCAL_FILE=.hh-local/content.json` in ignored `.env.local`.
Also add the three Cloudinary variables for real library browsing/uploads. Restart
Vite after changing these values. The Vite middleware runs the exact same handler.
There is no default password and no unauthenticated demo mode. Local filesystem
storage is refused in production and on Vercel; production requires Postgres.

Run `npm run test:admin`. It executes the Postgres schema/queries against an
in-memory PostgreSQL engine, mocks Cloudinary network calls, checks draft/publication
isolation and migration retries, and tests bounded frame caching. Real provider
credentials and a live Vercel deployment still need the production smoke test:
unauthorized edits rejected, login, select an existing image, upload an image,
save a draft, publish, check public feed, sign out, verify saved-session rejection.
