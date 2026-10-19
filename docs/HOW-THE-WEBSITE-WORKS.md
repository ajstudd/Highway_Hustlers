# How the Highway Hustlers website works

A plain-language guide to the content dashboard, publishing, bike images and performance improvements.

Last updated: 19 October 2026.

**Rollout status at the time of writing:** the new architecture has been implemented and tested locally. The live bike-image migration, first Cloudinary content publication and production deployment are still pending. Adding this document to GitHub does not mean those application changes are live.

## The main idea

**The dashboard prepares content. The public website reads a ready-made published copy.**

Think of a restaurant: staff work on recipes in the kitchen, while customers read a menu. Every customer does not need to enter the kitchen.

Our database is the working area. The published content file is the menu. This separates frequent public visits from occasional administrative work.

## 1. What each technology does

| Technology | Its job in our website |
| --- | --- |
| React and TypeScript | Build the website and dashboard screens, interactions and content-handling logic. TypeScript helps catch mistakes while developing. |
| Vite | Runs the local development server and packages the frontend for production. |
| Vercel | Hosts the website and runs protected server code for login, saving, publishing and upload permissions. |
| Neon / Postgres | Stores editable content, members, bikes, assignments, publication status, verified image references, login sessions and rate limits. |
| Cloudinary | Stores and delivers photos, videos, prepared bike images and the published content file. |
| The visitor's browser | Reads the published content, renders the page and manages bike rotation and its temporary image cache. |

A **CDN**, or content delivery network, is a network of servers that delivers prepared files. It can serve the public copy without running our database queries.

An **API** is the doorway through which the dashboard asks the server to perform an action. Our protected dashboard API is `/api/cms`; our dashboard page is `/admin`.

## 2. Why we made these optimisations

The concern was not just how much space the bike photos occupy. We needed to address several different problems:

| Problem | What we changed | Why it helps |
| --- | --- | --- |
| Public content queries and every-minute refreshes can keep the database working unnecessarily. | Public pages read a published CDN file instead of Neon. We removed periodic and tab-focus database refreshes. | Public traffic no longer drives Neon-backed content queries. |
| An unfinished edit could become visible too early. | Separate Save draft from Publish. | We can prepare and review changes without changing the live website. |
| A member leaving previously required code changes. | Add member activity, bike status and assignment visibility controls. | We can hide or reassign entries without deleting their history or pictures. |
| Loading every angle consumes downloads and browser memory. | Load nearby frames progressively and cap the decoded-image cache. | The hero does less work, particularly on phones. |
| Reusing the album-photo compression pipeline could damage bike cutouts. | Give prepared bike frames their own upload pipeline. | Factory paint, transparency and rotation alignment stay intact. |
| An interrupted migration could waste uploads or lose ordering. | Verify uploads and save migration progress in batches. | We can resume safely without starting the entire migration again. |

The aim is a faster, easier-to-manage site that uses free resources carefully—not a promise of unlimited free hosting.

## 3. What happens when we save and publish

```text
Edit the dashboard
        |
        v
Save draft in Neon
        |
        v
Click Publish
        |
        v
Server validates and filters the saved content
        |
        v
Public JSON snapshot on Cloudinary
        |
        v
Visitors read that snapshot and its image links
```

**JSON** is structured text that computers can read. Our snapshot contains public destination details, visible rider/bike entries, their display order and image references.

For example, it can say that Anjali rides the Hunter 350 in Tokyo Black and list the image addresses for that bike's rotation. It contains the addresses—not the image files themselves.

The snapshot is a selected public copy, **not a complete database backup**. Drafts, hidden entries, passwords, sessions and API secrets are excluded.

### Save draft

This saves our work in Neon. Visitors continue seeing the previous publication. The dashboard indicates whether changes are unsaved, saved but unpublished, or published.

### Publish

The server validates the saved data, checks its revisions, creates an immutable recovery copy of the public snapshot, then updates the stable public content file on Cloudinary. It requests a CDN cache refresh.

The public file keeps a predictable address, so the website knows where to find it. Image references include asset versions so a changed image set can have a distinct address.

Content changes do not require rebuilding the website after this architecture is deployed. Code, layout and feature changes still require a deployment.

## 4. How this changes Neon usage

With the new architecture:

- Signing in, editing, saving, verifying uploads and publishing use Neon.
- Normal public browsing does not query Neon or the Cloudinary Admin API for content.
- Public content loads on page load rather than through an every-minute refresh.
- Publishing can notify open website tabs in the same browser once. Other visitors normally receive updates on their next load, subject to caching.

Therefore, **1,000 public visits do not become 1,000 database content requests**.

Neon's compute allowance is about processing resources used over time, not a simple visitor counter. We reduce the workload by removing public content requests from the database path. We do not add artificial keep-alive pings.

This does not remove other limits. Images and videos still consume Cloudinary storage, delivery bandwidth and processing resources. Vercel also has usage limits. Actual consumption should be checked in the provider dashboards; free plans and allowances can change.

## 5. How members, bikes and assignments work

We keep three separate concepts:

- **Member:** the person's name, optional description and active/inactive setting.
- **Bike:** model, colour, engine size, display settings, image set and draft/published/hidden status.
- **Assignment:** which member rides which bike, whether that entry is visible and where it appears in the hero.

This avoids storing another copy of the images every time ownership or an assignment changes. Junaid A can have both the R15M and Pulsar N250, while Junaid K has the Ninja 300.

An entry is eligible for the public snapshot only when:

**The member is active + the bike is marked published + the assignment is visible.**

The bike also needs valid details and prepared images. Marking a bike published inside the draft catalogue does not itself update the live site; the separate Publish action does that.

For example, if a member leaves:

1. Mark the member inactive.
2. Save the draft.
3. Preview the intended lineup.
4. Publish when ready.

Their entries disappear from the next public snapshot, but their bikes and images remain available for later reassignment. An intentionally empty lineup shows the HH introduction rather than silently restoring old bikes.

## 6. How bike rotation and image migration work

The hero's bike rotation is a **photographic flipbook, not a live 3D model**. Each prepared image shows another angle. Dragging or using arrow keys changes the frame displayed on a canvas.

The initial migration baseline is 257 frames across 11 bike entries. This is a dated inventory, not a permanent limit. Only the active prepared sets are selected, not superseded or experimental folders.

The importer:

1. Reads the existing prepared frames in order.
2. Checks their dimensions and transparency.
3. Uploads them in small batches to Cloudinary.
4. Verifies the provider's asset details.
5. Saves confirmed references to the draft catalogue.
6. Leaves remaining local references intact so the import can resume.

Local originals are retained. Migration does not publish automatically, repaint bikes, generate angles or remove backgrounds again. A single supplied photo stays a single-photo presentation with tilt; it does not become an invented 360-degree rotation.

New bike uploads accept prepared transparent PNG/WebP frames on a shared 1200 × 720 canvas, up to 10 MB each. The dashboard checks ordering, dimensions, visible content, transparency and duplicate views. These checks do not replace a human review of every angle.

### Why bike uploads differ from ride-album uploads

Album photos can be compressed into JPEGs to reduce upload size. Bike cutouts need transparency, which JPEG cannot preserve.

The album uploader accepts source photos/videos up to 25 MB each. Photos are compressed in the browser before transfer; video optimisation happens through Cloudinary rather than a large browser video encoder. The bike pipeline instead preserves the prepared PNG/WebP file and its alpha channel—the transparency information around the motorcycle.

## 7. Why moving files to Cloudinary is not enough for performance

There are three different resources to consider:

- **Storage:** how much space the saved files occupy.
- **Bandwidth:** how much data visitors download.
- **Browser memory:** the space needed to display decoded pictures and run the page.

A small compressed image can expand into a much larger decoded image in memory. Hosting it elsewhere does not remove that cost.

Our frame loader therefore:

- Prioritises the current angle and a small neighbourhood of nearby angles.
- Downloads at most two frames simultaneously per spinner.
- Keeps up to eight decoded frames on mobile or twelve on desktop, plus in-flight work.
- Releases older decoded frames instead of retaining a full rotation indefinitely.
- Uses 720-pixel-wide delivery on mobile and small Cloudinary thumbnail versions.
- Stops unnecessary animation and downloads when offscreen or in a hidden tab.
- Avoids the large decorative opening spin that would force a full-set download.

These are image-cache limits, not limits on the browser's total memory. Rotating through a whole bike can still download its whole set over time. Revisited frames may be served from the browser's ordinary file cache, but that is separate from our decoded-image cache.

Hidden/draft bikes are absent from the public snapshot, so the public hero does not request their rotation images. The existing drag, keyboard and reduced-motion behaviour remains; the Sunday game and its bike selection are not changed by this work.

## 8. Security, caching and failure handling

### Protected actions

The server checks the administrator's password and session. This is not just a password form hiding frontend buttons: the API protects private reads and writes too.

Database credentials and Cloudinary secrets stay on the server. For an upload, the browser receives a limited, time-bound signed request rather than the Cloudinary secret. The server verifies uploaded bike assets before accepting their references into the catalogue.

### Conflicting edits

Saved content has revision numbers. If another tab has already saved newer data, the server rejects a stale save instead of silently overwriting it. A publication lock prevents simultaneous publishers from competing to replace the public copy.

### Publishing failures

An ordinary failed upload leaves the previous public copy available and the draft saved. If the upload succeeded but the response or status update was lost, the exact publication status can be uncertain; the dashboard reports that rather than claiming nothing changed. Retrying republishes the saved content.

An already published site can continue serving its Cloudinary snapshot even when Neon is unavailable. The admin may be unable to save or publish until the database recovers.

### Cached copies

After publishing, we request invalidation: Cloudinary is asked to refresh cached copies of the content file. Delivery is not guaranteed to update everywhere instantly. See [Cloudinary's cache invalidation documentation](https://cloudinary.com/documentation/invalidate_cached_media_assets_on_the_cdn).

The browser can retain its last successfully validated public snapshot as a fallback. That copy may be older during an outage. A first-time visitor with no saved copy cannot rely on this fallback, and it does not make the entire website or every media file available offline.

**Hidden does not mean private.** Excluding a bike or photo from the website does not delete or restrict its public Cloudinary URL. Cached copies can also outlive a website edit. Do not upload private or sensitive media to this public-media workflow.

## 9. Verification and safe rollout

Local checks cover authentication, private APIs, draft/publication separation, inactive members, hidden bikes, reassignment, ordering, empty lineups, publication failures, migration verification and bounded frame caching. We also check the real hero preview and phone layout.

A key automated test makes repeated public content requests and asserts that they execute **zero database queries**. Builds and TypeScript checks help catch integration errors, but do not replace a live provider smoke test.

The first content publication is now automatic during a Vercel Production build, using the credentials already configured there. No private local environment file or manual publishing command is needed. After building the frontend, the build checks the public content file. If there has never been a publication and the file is missing, it creates the first snapshot from eligible saved content and verifies delivery before allowing the build to succeed. This avoids launching a site with a missing content feed.

Later builds verify the existing file without querying Neon or publishing newer drafts. Local and Preview builds do not run automatic setup. If a previously published file disappears, deployment stops rather than silently publishing drafts; recovery or an explicit dashboard publication is required. A failed build check does not roll back an upload that has already reached Cloudinary, so a retry can reuse that first publication. Local bike paths remain usable while the separate image migration is completed and reviewed.

For the owner, the simplified process is: **deploy once, then use `/admin` → Save draft → Publish website for future updates.** The separate Cloudinary bike-image migration remains a resumable dashboard action, not a prerequisite for the first deployment.

Production and preview environments should use separate editorial data and content-snapshot paths. Never paste credentials into chat, documents or source control.

For operational setup, environment variables and recovery details, see [the content dashboard guide](gallery-admin.md). This document is an explanation, not permission to deploy, delete originals, upgrade paid services or expose credentials.

## In one sentence

**We edit in Neon, publish a clean public copy to Cloudinary, and let visitors read that copy while their browser loads only the bike images it currently needs.**
