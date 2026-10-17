# HH places and media dashboard

The existing Vite site stays on Vercel. `/admin` is the content dashboard;
`/api/cms` is its Vercel Node function. Neon stores places, sessions and rate limits.
Cloudinary stores and delivers photos/videos. The public site never calls the
Cloudinary Admin API, and no credentials use a `VITE_` prefix.

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
4. Deploy these code changes, then redeploy after changing environment variables.
   This guide does not itself authorize a push or deployment.
5. Open `https://YOUR-DOMAIN/admin`, sign in, and choose a place. Use **Choose from
   Cloudinary** to select the four existing uploads. New uploads go directly from
   the browser to Cloudinary using a signature from the authenticated API.
6. Reorder media: the first item becomes the cover. Add captions, set coordinates,
   choose Published/Draft, then **Save changes**. Refresh the public section to
   check it. Open website tabs refresh on focus, after same-browser saves, and
   every 60 seconds while visible. No redeploy is needed for subsequent edits.

Neon tables are created idempotently on the first configured request. The initial
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
- The public API filters out drafts; it contains no session or credential data.
  Static admin UI code is public like any login screen; all private data/actions
  are protected at the API. `/admin` is excluded from search indexing.
- Edits use optimistic revisions: stale tabs cannot silently overwrite a save.
  Removing media or places never deletes original files in Cloudinary. Removing
  a place is confirmed in the UI and takes effect only after saving.
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

## Local development

Set `ADMIN_PASSWORD_HASH` and either a separate development `DATABASE_URL`, or
explicitly set `CMS_LOCAL_FILE=.hh-local/content.json` in ignored `.env.local`.
Also add the three Cloudinary variables for real library browsing/uploads. Restart
Vite after changing these values. The Vite middleware runs the exact same handler.
There is no default password and no unauthenticated demo mode. Local filesystem
storage is refused in production and on Vercel; production requires Postgres.

Run `npm run test:admin`. It executes the Postgres schema/queries against an
in-memory PostgreSQL engine and mocks Cloudinary network calls. Real provider
credentials and a live Vercel deployment still need the production smoke test:
unauthorized edits rejected, login, select an existing image, upload an image,
save a draft, publish, check public feed, sign out, verify saved-session rejection.
