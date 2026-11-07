# Punch Photos and Profile Pictures: Design Spec

Date: 2026-11-07
Status: Draft for review
Branch: `feature/punch-photos` (cut from `feature/shift-history`, which is not merged yet; both add to `prisma/schema.prisma`)

## 1. Intent

**Goal.** Use the face photo the attendance machine sends with every punch: show it as the
teacher's profile picture and next to their punches, keep it only as long as needed, and
stop writing photos into server logs.

**Who uses it.** School administrators (about 82 staff). The machine sends `image` (base64 JPEG)
with each `sendlog` record, next to `enrollid`, `time`, `mode`, `inout`, `event`.

**Success looks like this:**
- Raw machine messages, photos included, are no longer written to logs.
- A teacher's newest punch photo becomes their profile picture unless an admin pinned another.
- An admin can open a teacher's recent punch photos, pin one as the profile picture, or remove it.
- Punch photos older than 90 days are deleted automatically; the profile picture stays.
- Payroll and attendance calculations behave exactly as before.

## 2. Decisions

| Question | Decision |
|---|---|
| Scope | Profile picture plus a recent-punches strip with photos |
| Retention | Punch photos 90 days; profile picture kept |
| Storage | Small thumbnails in the database, in a table separate from `AttendanceLog` |
| Privacy | Stop logging raw messages first; photos served only to signed-in users |

## 3. Scope

**In scope:** log hygiene in `ws-server.js`, thumbnail creation and storage, a profile picture per
teacher (automatic or pinned), photo endpoints, UI on the Staff page, retention cleanup, README.

**Out of scope:** face matching or "is this the right person" checks, photos for unknown machine IDs,
notifications, a gallery page across all teachers, full-resolution storage, object storage (S3).

## 4. Log hygiene (ships first)

`ws-server.js` currently prints the whole received message (`console.log(rawData)`, around line 43)
and whole records it skips. Replace this with a one-line summary: command, device serial, record
count, and per record `enrollid` and `time`, never `image`. Any record logged for a warning has
`image` removed first (a pure `redactForLog(value)` helper with tests: replaces the `image` key and
any string longer than 200 characters with `<redacted N chars>`). Truncating the existing 164 MB
`websockets-out.log` on the server is done only with the owner's approval.

## 5. Data model (additive, safe for `prisma db push`)

### `PunchPhoto`
| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | |
| `staffId` | String | relation to `Staff`, cascade delete |
| `logId` | String? @unique | the `AttendanceLog` it came from; `onDelete: SetNull` |
| `takenAt` | DateTime | the punch time |
| `data` | Bytes | JPEG thumbnail |
| `isProfile` | Boolean @default(false) | a profile-picture copy; never deleted by retention |
| `createdAt` | DateTime | |

Indexes `(staffId, takenAt)` and `(takenAt)`.

### `Staff` (two additions)
- `profilePhotoId String?`: relation to `PunchPhoto`, `onDelete: SetNull`; the photo currently shown.
- `profilePhotoPinned Boolean @default(false)`: an admin chose it; automatic updates stop.

The profile picture must survive retention, so selecting it (automatically or by pinning) **copies**
the chosen photo into its own `PunchPhoto` row with `isProfile = true`.

## 6. Ingest

In the `sendlog` handler, after the punch is saved:
- If `record.image` is a non-empty string, decode it, check it is a JPEG (magic bytes `FF D8`) and at
  most 2 MB decoded, and create a thumbnail with `sharp`: longest side 160 px, JPEG quality 60.
- Store a `PunchPhoto` for that punch. A failure to decode or store a photo is logged (without the
  data) and never blocks the punch or its ACK.
- If the teacher has no pinned profile photo, make this photo the profile picture (one automatic
  profile row per teacher; the previous automatic copy is deleted). The profile picture only moves
  forward: a punch older than the current profile photo (an offline backfill) does not replace it.

`sharp` becomes an explicit dependency (already present through Next.js).
Size estimate: about 5 KB per thumbnail, roughly 30,000 punches in 90 days, about 150 MB.

## 7. Endpoints (all require a signed-in user)

- `GET /api/staff/[id]/photos?limit=20` lists `{ id, takenAt }` of recent punch photos.
- `GET /api/photos/[id]` returns the JPEG (`Cache-Control: private, max-age=86400`, 404 if missing).
- `GET /api/staff/[id]/photo` returns the profile picture or 404.
- `POST /api/staff/[id]/photo` with `{ photoId }` pins a punch photo as the profile picture.
- `DELETE /api/staff/[id]/photo` clears the profile picture and unpins it (the next punch sets a new one).
- `GET /api/staff` includes `hasPhoto` per teacher (no image bytes in the list).

## 8. UI

- Staff table and detail dialog show a round avatar from `/api/staff/[id]/photo`, falling back to initials.
- The detail dialog gets a "Recent punches" strip: thumbnails with time, click to enlarge,
  "Use as profile picture", and "Remove picture". Existing design system components and tokens.

## 9. Retention

A cleanup deletes `PunchPhoto` rows older than 90 days where `isProfile = false`. It is throttled to
at most once every 6 hours (claimed atomically through a nullable `Policy.photoCleanupRanAt`, the same
pattern as shift detection) and is triggered when the Staff page loads (`POST /api/photos/cleanup`,
session required, fire-and-forget). The same run deletes orphan profile copies: `isProfile = true` rows that no
Staff row references and that are older than 1 day (a pin race can leave these). `PHOTO_RETENTION_DAYS = 90`
lives in one config file.

## 10. Errors and edge cases

- No `image` in the record, or an invalid one: the punch is saved normally, with no photo.
- Unknown machine ID: nothing stored (as today).
- Redelivery of the same `sendlog`: `AttendanceLog` has no unique key, so a redelivered machine message already creates a duplicate punch; it also stores a duplicate thumbnail until retention removes it.
- Deleting a teacher deletes their photos (cascade).
- Deploy order: `prisma db push` runs before the new ws-server code starts, as for the shift feature.

## 11. Testing

- `redactForLog`: image key, long strings, nested records; short values unchanged.
- Thumbnail creation: a valid JPEG shrinks to 160 px; non-JPEG, empty and oversized input rejected.
- Ingest: photo stored with the punch; a photo failure does not block the punch; redelivery stores one
  photo; an unpinned profile follows the newest photo; a pinned one does not; an older backfill does
  not replace a newer profile photo.
- Endpoints: unauthenticated 401; pin copies the photo; delete unpins; the listing is limited.
- Retention: deletes only old non-profile rows; the profile copy survives.
- `npm test`, `npm run lint` (at most 80 problems), `npm run build`.

## 12. Build order

1. Log hygiene (`redactForLog`) and its tests. Can be deployed alone.
2. Schema and thumbnail helper.
3. Ingest with profile selection.
4. Endpoints.
5. Staff page UI.
6. Retention cleanup and README.

## 13. Rollout and risks

- **Deploy:** additive schema through the existing `prisma db push`; ws-server restarts under pm2.
- **Privacy:** photos are personal data: never public, never logged, expire after 90 days.
- **Storage:** about 150 MB at steady state; retention bounds it.
- **Ingest risk:** a photo problem must never lose a punch (guarded and tested).
