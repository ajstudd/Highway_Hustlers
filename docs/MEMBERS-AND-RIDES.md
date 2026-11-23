# HHR members and ride enrolment

## Rider cards, dream bikes and personal gallery

**Membership & enrolments** has tabs for **Requests**, **Allowed emails**,
**Ride enrolments**, **Bike requests**, **Profile links** and **Non-members**.
Use **Non-members** to remove an unconfirmed profile and end its member sessions.
The person can sign in again to create a new profile. The removal action protects
confirmed members and profiles with member or ride records.

In **Ride enrolments**, choose an upcoming or past ride to expand its roster.
An admin can add or remove approved members and use **Approve membership & add**
to approve a pending request and add that person in one step. Cancelled rides are
read-only. Members can self-enrol within the ride's enrolment window. Historical
additions notify the member and enable the two-photo contribution allowance.

Place editing uses a Google Maps destination link and an optional one-way road
distance from Bhopal. Paste the short link from **Share → Copy link** or the full
URL of the selected place. The album's **Find this place** link opens the saved
URL in Google Maps. When a full URL contains an explicit pin, its coordinates are
stored automatically. Existing albums with only coordinates keep working.

Upcoming rides have separate names and Google Maps links for the meeting point
and destination. Leave the distance blank to hide it from riders.

Approved, allowlisted members see **Rider card** on their profile. Its permanent
identifier is `HHR-` followed by their complete immutable account ID, independent
of name, email or bike edits. The charcoal/marigold artwork downloads as a
2000 × 1260 PNG, generated entirely in the browser. The QR contains only this
identifier, with no contact details, session token or public profile link. It is
a club keepsake, not a login credential or proof of current membership; an old
download remains on its owner's device after membership changes. QR generation
uses [node-qrcode](https://github.com/soldair/node-qrcode), without an external QR
service. New downloads are shown only while membership is approved.

Any signed-in account can save a dream bike name (up to 180 characters) under
**Dream bike**. Administrators see it in **Membership & enrolments → Bike
requests** and can attach a prepared rotation from the saved bike library, or
remove that display. Sets with fewer than two frames are excluded. Admins should
match the requested model before assigning. Assignments notify the member and
appear immediately in their private profile; they need no public Publish step.
Changing or clearing the request clears its old display. A stale admin decision
is rejected if the member has changed the requested name. Dream assignments never
add an owned bike, alter the ride bike selector or change the public hero.

**Gallery** collects the signed-in member's completed ride photo uploads, with
pending/approved/not-selected labels, twelve thumbnails at a time and an
accessible full-image viewer. It includes contributions from cancelled rides and
rides they have left. Incomplete upload reservations are excluded; other members'
photos are never returned. Moderation determines public showcasing, not whether
owners can see their own uploads. The photo files still have unlisted public
Cloudinary URLs, as described below. Profile avatars are separate from ride photos.

No additional environment variables or manual database migration are required for
these features. Fields are additive in the existing member workspace; photos use
the existing account-scoped photo store. Public CDN snapshots remain unchanged.

Implemented locally, November 2026. Do not treat this document as evidence of
production deployment or a real Google sign-in test. No real member accounts or
emails are seeded. The separate demo server and all demo identities live outside
the repository.

## What members see

The public website keeps its existing layout, with a small person icon linking to
`/member`. The upcoming ride has a **Join this ride** link carrying the ride ID to
the profile. Member UI and photo-preparation code are lazy-loaded; merely visiting
the public website does not request a member session or query Neon.

Anyone with a supported Google account can sign in. Sign-in alone is not membership.

1. An email on the dashboard's allowlist receives approved membership at sign-in.
2. Everyone else completes their name and phone number. Saving submits a pending
   membership request, visible under **Membership & enrolments → Requests**.
3. An administrator approves or declines the request. Approval adds the exact email
   to the allowlist. No automatic matching to a hero rider's name is performed.
4. Only an approved, allowlisted account with a complete profile can join a ride.
5. Members edit their own name, phone and photo; they cannot edit email, approval,
   another profile or admin content. Email comes from verified Google claims.

Hero members (public rider names and bikes) and member accounts (private contact
details/access) are intentionally separate. Changing a profile does not silently
rename the public hero. Existing public rider names do not grant login privileges.

Google `sub` is the identity key, not the email. A verified email change requires
approval for the new address and removes open enrolments. The initial implementation
accepts Gmail and Google Workspace identities only: Google cannot authoritatively
vouch for continued ownership of arbitrary third-party email addresses. See
[Google's verification guidance](https://developers.google.com/identity/gsi/web/reference/js-reference).
Adding a separate email ownership challenge for other domains is future work.

## One-time setup before production use

Keep existing Neon, Cloudinary and admin password settings. Add these **server-only**
environment variables in the existing Vercel project's Production environment:

| Variable | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth Web application client ID |
| `GOOGLE_CLIENT_SECRET` | The corresponding client secret |
| `MEMBER_APP_ORIGIN` | Exact canonical site origin, e.g. `https://highway-hustlers.vercel.app`, with no trailing slash |
| `CRON_SECRET` | A new cryptographically random secret used only to protect scheduled rollover |
| `ADMIN_EMAILS` | Optional. Comma-separated Gmail/Google Workspace addresses allowed to sign in to `/admin` with Google |

Never put these into `VITE_` variables, chat, Git or documentation. Enter secrets
directly in Vercel. Existing database/media credentials remain server-side.

In Google Cloud / Google Auth Platform:

1. Create or select the project, set HHR branding/support contact and configure the
   audience/consent screen for external sign-in. Supply accurate privacy/terms links
   for the deployed service. This is owner configuration, not something deployment
   can invent or accept on your behalf.
2. Create an OAuth client of type **Web application**.
3. Register the exact redirect URI:
   `https://highway-hustlers.vercel.app/api/member?action=callback`
   (replace the origin if using a custom domain).
4. Configure test users while Google is in Testing mode; move to the appropriate
   published audience before expecting arbitrary members to sign in.
5. Put the client ID/secret and canonical origin into Vercel and deploy the code.
6. In `/admin` → **Membership & enrolments**, add your existing members' exact Google
   emails. Test one allowlisted account and one unlisted account end-to-end.

Local OAuth testing needs a separately registered loopback callback such as
`http://localhost:5174/api/member?action=callback` and a matching local origin.
Preview authentication defaults to disabled; enabling it requires an explicitly
configured separate origin/client and `MEMBER_PREVIEW_AUTH_ENABLED=1`. Preview
must also use a separate database and content path, as with the existing CMS.

Official setup/reference:
[Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).

## Administrator Google sign-in

With `ADMIN_EMAILS` set (and the Google variables above), `/admin` shows
**Continue with Google**. It reuses the member OAuth client and callback, so no
extra redirect URI is needed. Only an exact, verified email in `ADMIN_EMAILS` gets
a dashboard session; any other Google account is sent back to `/admin` with an
error and gets no session. Administrator sign-in never creates a member account,
and an admin session cannot act as a member, or the other way round.

The list lives in the Vercel environment rather than the database on purpose:
granting administrator access then requires Vercel access, so a stolen dashboard
session or a database write cannot create new administrators. Removing an email
(after redeploying) ends that person's sessions immediately. Rotating
`ADMIN_PASSWORD_HASH` ends every administrator session. The password login stays
available as a fallback, and `ADMIN_PASSWORD_HASH` is still required.

## Ride management and deadlines

The public **Join this ride** link only appears for a ride that has a ride ID.
For rides saved before the member feature, open `/admin` to assign an ID and
select the ride update in **Review & publish**.

Save the ride draft, then select it in **Review & publish** to announce it to
member profiles and the public site. A stable server-generated ride ID separates
one outing from the next; editing a location or date never transfers attendance to
a new ride accidentally.

Optional **Enrolment opens** and **Enrolment closes** fields use IST. Members can
join from the inclusive opening time up to, but not including, the closing time.
Omitted boundaries are unbounded. A ride whose date has ended in IST is always
closed. The server checks the current time, approved status and profile on every
join; disabling a button is not the security boundary.

Members can leave after enrolment closes. Admins can add approved, complete-profile
members after the deadline, and remove entries. They cannot enrol members in an
expired, completed or cancelled ride. Attendee names/emails/phones appear only in
the authenticated admin participant list, never in public JSON or another member's
API response. Removing an allowed email pauses access and removes open entries.

**Cancel ride & notify members** takes effect immediately in member profiles and
prevents further enrolment. It saves the announcement as excluded; use **Publish**
to remove the public CDN announcement. The confirmation states this distinction.
Cancellation does not turn a never-held ride into a favourite morning album.
Use **Start a new ride** after cancellation/closure rather than reusing a closed ID.

If member synchronisation fails after publishing, the dashboard reports a warning.
**Sync published ride** retries from recorded published content, not newer drafts.
Authenticated profile loading also reconciles recorded publication status. A
cancelled/completed ride cannot be reopened by an older CDN publication.

## Automatic upcoming ride → gallery draft

Vercel's scheduled `/api/ride-rollover` endpoint is configured once daily at
00:10 UTC (05:40 IST). Scheduling is not an exact midnight guarantee and requires
the deployment's cron support and `CRON_SECRET`. Monitor failed jobs in Vercel and
retry through its normal tooling. An unauthorised request cannot run the job.
Vercel's Hobby scheduler has hourly rather than exact-minute precision; see the
[official cron overview](https://vercel.com/i/event-driven-architecture).

After a dated ride has ended:

- Save one unpublished **Our favourite mornings** place draft, with the ride's
  location, up to 400 characters of description, photos and ride date/provenance.
- Carry over the destination link and one-way road distance. If the ride has no
  destination link, paste one before publishing the album.
- Mark the member ride completed, retain its attendees, and add a profile update.
- Remove an expired announcement from the existing public JSON, without publishing
  any other saved edits. The rest of that last publication stays unchanged.
- Do not duplicate the album when a job is retried. Original media is never deleted.

Opening the dashboard also catches up expired saved rides. The public component
hides a past-date announcement on the next render even if the scheduled job is
delayed. Undated rides need explicit admin management; there is no safe inferred
expiry date. An intentionally empty album remains draft until real media is added.

## Notifications and privacy

New/updated/cancelled/completed rides create persistent profile notifications.
Membership decisions and administrator enrolment changes create recipient-specific
updates. There is a read marker and unread count. Profiles refresh on entry/actions;
there is no minute polling, websocket, browser push, WhatsApp or email delivery.
Notifications are stored once, not copied into every member's record. The most
recent 200 are retained, with up to 60 relevant updates returned per profile load.

Name, email, phone, Google subject, access status, sessions and attendees live only
in Neon, not the Cloudinary JSON. Nothing private goes into public localStorage.
Only Google's basic `openid email profile` scopes are requested, not Drive,
contacts, Gmail or offline refresh access. Access/refresh/ID tokens are not saved.

Profile uploads reuse browser compression and a separate signed `hh-profiles/`
namespace, excluded from the album media picker. Source limit is 25 MB; processed
photos must be under 1.5 MB and 2048 pixels. Upload tickets bind to the account.
Changing a photo does not delete the original. **Photo files use public Cloudinary
URLs**; API privacy is not private-file storage. Do not upload sensitive photos.

Admins can see contact details to organise the ride. Publish an accurate privacy
notice and establish an owner process for account/data deletion and retention
before opening registration broadly. No marketing subscription is inferred.

## Rider list and profile bikes

Members can add a bike name, colour and nickname to their profile (all optional).
Approved members see a **Who's riding** list on each ride with each rider's name,
bike and nickname. Phone numbers and emails never appear in it. Pending, declined or
removed accounts get an empty list and are not shown in it.

Under **Membership & enrolments → Profiles & bikes**, an admin can link up to six
prepared library bikes to a profile (**Link bike**) and remove them one at a time
(**Unlink**). Each linked bike's 360° rotation appears in the member's profile
banner, with a switcher when there is more than one. Model and colour come from the
library and are read-only for the member; each bike has its own member-editable
nickname. Linking bikes does not change hero members, the hero lineup or approval.
When every bike is unlinked, the self-reported bike fields become editable again.

**Connecting a profile to a hero member.** When someone you already set up under
Hero members signs in, choose them in the profile's **Hero member** list and press
**Connect**. The bikes assigned to that hero member in **Hero lineup** become the
profile's bikes, and later lineup changes follow automatically. These are marked
*Hero lineup* and are changed in Hero lineup, not unlinked here. Extra library
bikes can still be linked, up to six bikes in total. A hero member with the same
name is listed first as a suggestion, but nothing connects automatically: name
matching would let anyone claim a rider's entry by signing up with their name.
Each hero member can be connected to one profile. Only saved hero members appear,
so press **Save draft** after adding someone new. Connecting changes nothing on the
public site; the hero still shows the published hero name and lineup.

A member with several linked bikes chooses which one they're **Riding** when they
join a ride, and can change it while they're on the ride, even after enrolment
closes. The rider list and the admin enrolment list show the chosen bike.
Unlinking a bike clears it as a ride choice; the rider list then falls back to the
member's first bike. Profiles saved before multiple bikes keep their single bike.

## Member ride photos

An approved member who joined a ride can contribute up to **two photos per ride**,
including after the ride is completed. They must confirm they have permission to
share the photos. Photos are compressed in the browser with the same pipeline as the
admin uploader, then sent to `/api/member-photo`. The server, not the browser, holds
the Cloudinary credentials and uploads the file; members never receive an upload
signature.

Server-side limits (browser compression is not trusted):

- Prepared JPEG under 1.5 MB, at most 2048 × 2048, single image; Sharp re-encodes
  it with metadata (including GPS) removed and rejects undecodable files.
- Two slots per member per ride, reserved transactionally. A rejected photo still
  uses its slot, so deleting and retrying cannot get around the limit.
- At most 4 upload attempts per member per day, 50 across the club per day, a
  per-IP budget, 20 requests per minute per IP, and 4 uploads processed at once.

Uploaded photos go to **Ride photos** in the dashboard as *Awaiting review*. An
admin can approve a photo, leave it unselected, or add an approved photo to any
album draft. The photo appears on the website after the album is selected and
published from **Review & publish**. Unselected photos stay in the catalogue for later
use. Like profile photos, uploaded files have unlisted but public Cloudinary URLs;
they are not private storage.

## Storage and security implementation

- `/api/member` is separate from `/api/cms`. Member cookies cannot authenticate the
  CMS, and admin cookies cannot impersonate member accounts.
- OAuth uses server-side code exchange with PKCE, nonce, one-time stored state and
  a browser-bound HTTP-only cookie. `jose` validates Google's RS256 signature,
  issuer, audience, expiry, token age and nonce using Google's public keys.
- Member sessions are random, last seven days and are stored as SHA-256 digests.
  Cookies are Secure in production, HTTP-only and SameSite=Lax (OAuth redirect).
- Mutating endpoints enforce the configured same origin, JSON and a custom header.
  Uploads and writes are size/rate limited. Provider exceptions/secrets are not
  returned to clients. The separate password-protected admin remains unchanged.
- `hh_member_workspace` holds private account/access/ride/notification state.
  Compare-and-swap revision updates retry conflicts, preventing duplicate joins
  and lost concurrent changes. This is a deliberately bounded small-club design:
  up to 500 accounts/allowed emails, 150 archived rides and 1.5 MB state. Growth
  beyond these limits requires relational tables/pagination and an archive policy,
  not silently dropping members. Profile requests never go through the CDN.
- Separate `hh_member_sessions` and `hh_oauth_attempts` tables hold expiring hashes
  and temporary OAuth attempts. Migrations are additive and idempotent.

Public browsing still queries no Neon content or membership endpoints. Signing in,
editing profiles, joining/leaving and viewing member updates necessarily use Neon.
Cron/admin activity also uses compute. No claim is made of unlimited free usage.

## Verification and rollout checklist

Automated tests cover actual Postgres-compatible schema/CAS, signed Google tokens,
wrong audience/nonce/unverified emails, OAuth replay, cookie separation, CSRF,
pending/approved/revoked membership, upload ownership/limits, joining/leaving,
duplicate/concurrent joins, server-side windows/admin override, cancellation,
private snapshots and automatic idempotent IST rollover preserving unrelated drafts.

Before production rollout, configure Google and cron, run a real Google sign-in for
both approval paths, verify a profile photo upload with the real Cloudinary account,
check one real enrolment and notification, and inspect a cron run. Local provider
fixtures and JWT tests are not proof of real Google consent or provider setup.

Existing development-tool dependency advisories were found for Vite/esbuild and
PostCSS tooling. They predate the member feature; no automatic major-version
upgrade is bundled into this change. Keep local dev servers private and plan a
separate tested toolchain update. No production `jose` vulnerability was reported.
