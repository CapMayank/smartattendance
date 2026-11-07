# Punch Photos and Profile Pictures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the machine's punch photos as thumbnails, use the newest as each teacher's profile picture (pinnable), expire punch photos after 90 days, and stop logging raw messages.

**Architecture:** The websocket server (`ws-server.js`, plain CommonJS, cannot import `src/*.ts`) gets small CommonJS helpers in `ws-lib/` (redaction, thumbnail, ingest) that Vitest tests directly. Photos live in a new `PunchPhoto` table; `Staff` points at its current profile copy. Next.js API routes serve images to signed-in users; retention runs throttled from the Staff page.

**Tech Stack:** Next.js 16 (read `node_modules/next/dist/docs/` before route handlers), Prisma 6 (PostgreSQL), `sharp`, Vitest 3, existing `fake-prisma` test util.

**Spec:** `docs/superpowers/specs/2026-11-07-punch-photos-design.md`

## Global Constraints

- Photo handling must never lose or delay a punch or its ACK: every photo step is wrapped so failure is logged (no image data) and ignored.
- Never log an `image` value or any string over 200 characters.
- Thumbnail: longest side 160 px, JPEG quality 60; accept only JPEG (magic bytes `FF D8`), at most 2 MB decoded.
- `PHOTO_RETENTION_DAYS = 90`; retention never deletes rows with `isProfile = true`.
- Schema changes are additive and safe for `prisma db push`; the working tree's `.env`, `prisma/dev.db` and the two characterization test files stay untouched.
- All photo endpoints return 401 without a session (`getServerSession(authOptions)` as in `src/app/api/staff/[id]/shift-history/route.ts`).
- Lint gate: changed files add no new problems and `npm run lint` reports at most 80 problems (baseline 71). `npm test` and `npm run build` pass. No dev servers, no `db push` against anything real; `npx prisma generate` is allowed after schema edits.
- Commit by explicit path with trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Nothing is deployed to the server by this plan.

## Review Focus

- A record whose `image` is missing, empty, not base64, not a JPEG, or over 2 MB: the punch is still saved and ACKed.
- The same `sendlog` delivered twice: one punch photo, no duplicate profile copy.
- An offline backfill (older `time`) arriving after a newer photo: the profile picture does not move backwards.
- A pinned profile picture: later punches never change it; removing it unpins and the next punch sets a new one.
- Retention while a teacher's profile copy is older than 90 days: the copy survives; deleting the source punch photo does not break the profile.

---

### Task 1: Log redaction and summary logging

**Files:**
- Create: `ws-lib/redact.js`, `ws-lib/redact.test.ts`
- Modify: `ws-server.js` (the received-data log at lines ~42-43, the skipped-record warning at ~160, the unknown-command log at ~243)

**Interfaces:**
- Produces: `redactForLog(value: unknown): unknown` and `summarizeMessage(data: object): string` exported from `ws-lib/redact.js` (CommonJS `module.exports`).

- [ ] **Step 1: Write failing tests** in `ws-lib/redact.test.ts` (import with `createRequire` or `import redact from "./redact.js"`): `redactForLog` replaces an `image` key's value and any string over 200 chars with `<redacted N chars>` (N = original length), recurses through arrays and nested objects, leaves short strings, numbers and null unchanged, and does not mutate its input. `summarizeMessage({cmd:"sendlog",sn:"A1",count:1,record:[{enrollid:7,time:"2026-11-05 17:32:25",image:"x".repeat(5000)}]})` returns a single-line string containing `sendlog`, `A1`, `enrollid 7` and the time, and never contains the image text; a message with no `record` still returns a line with the command.
- [ ] **Step 2: Run** `npx vitest run ws-lib/redact.test.ts`; expect FAIL (module missing).
- [ ] **Step 3: Implement** `redactForLog` and `summarizeMessage` in `ws-lib/redact.js`.
- [ ] **Step 4: Wire into `ws-server.js`:** replace `console.log(rawData)` with `console.log(summarizeMessage(data))` after parsing (move the log after the `JSON.parse` try/catch; for unparsable input log `unparsable message (N chars)`); change the skipped-record warning to log `redactForLog(record)`; and the unknown-command log to not print the payload.
- [ ] **Step 5: Run** `npm test`; expect PASS. Commit `fix(ws): stop logging raw machine messages and photos`.

### Task 2: Schema and configuration

**Files:**
- Modify: `prisma/schema.prisma`, `package.json` (add `sharp` as an explicit dependency at the version already installed, see `node_modules/sharp/package.json`)
- Create: `src/lib/photo-config.ts`

**Interfaces:**
- Produces: models/fields from spec section 5 plus `Policy.photoCleanupRanAt DateTime?`; `PHOTO_CONFIG = { retentionDays: 90, thumbMaxSide: 160, jpegQuality: 60, maxDecodedBytes: 2 * 1024 * 1024, cleanupThrottleHours: 6, profileHistory: 20 }`.

- [ ] **Step 1:** Add `PunchPhoto` (id, staffId cascade, `logId String? @unique` relation to `AttendanceLog` with `onDelete: SetNull`, takenAt, `data Bytes`, `isProfile Boolean @default(false)`, createdAt; indexes `(staffId, takenAt)` and `(takenAt)`), `Staff.profilePhotoId String?` (relation to `PunchPhoto`, `onDelete: SetNull`, named relation to avoid ambiguity with `Staff.punchPhotos`), `Staff.profilePhotoPinned Boolean @default(false)`, and `Policy.photoCleanupRanAt`. Add the back-relations on `AttendanceLog` and `Staff`.
- [ ] **Step 2:** `npx prisma validate` then `npx prisma generate`; expect success.
- [ ] **Step 3:** Create `src/lib/photo-config.ts` exporting `PHOTO_CONFIG`.
- [ ] **Step 4:** `npm run build`; expect PASS. Commit `feat(photos): schema and config`.

### Task 3: Thumbnail helper

**Files:**
- Create: `ws-lib/thumbnail.js`, `ws-lib/thumbnail.test.ts`

**Interfaces:**
- Produces: `async makeThumbnail(base64: unknown): Promise<Buffer | null>` (CommonJS). Returns null for anything invalid; never throws.

- [ ] **Step 1: Failing tests:** build a 640x480 JPEG in the test with `sharp` and base64 it: result is a Buffer whose JPEG metadata has longest side 160; a PNG, a non-base64 string, `""`, `undefined`, a number, and a JPEG larger than 2 MB decoded each return null (no throw).
- [ ] **Step 2:** Run `npx vitest run ws-lib/thumbnail.test.ts`; expect FAIL.
- [ ] **Step 3: Implement** with `Buffer.from(str, "base64")`, magic-byte and size checks, `sharp(buf).rotate().resize({width:160,height:160,fit:"inside",withoutEnlargement:true}).jpeg({quality:60})`, all inside try/catch.
- [ ] **Step 4:** Run the test; expect PASS. Commit `feat(photos): thumbnail helper`.

### Task 4: Ingest with profile selection

**Files:**
- Create: `ws-lib/photo-ingest.js`, `ws-lib/photo-ingest.test.ts`
- Modify: `ws-server.js` (call after `attendanceLog.create`, which must now keep its returned row), `src/test-utils/fake-prisma.ts` only if the fake lacks what the tests need (`punchPhoto` create/findFirst/delete/deleteMany, `staff.update`, `attendanceLog`)

**Interfaces:**
- Consumes: `makeThumbnail` (Task 3), `redactForLog` not needed.
- Produces: `async storePunchPhoto(prisma, { staff, log, image }): Promise<void>` where `staff` has `id`, `profilePhotoId`, `profilePhotoPinned`, and `log` is `{ id, timestamp }`. Never throws.

Behaviour: no thumbnail (null) -> return. Create `PunchPhoto{staffId, logId: log.id, takenAt: log.timestamp, data}`; a unique-violation on `logId` (redelivery) is ignored and stops the profile step. If `profilePhotoPinned` is false and the current profile photo is missing or has `takenAt <= log.timestamp`, create a second row with `isProfile: true` (same data and `takenAt`), set `Staff.profilePhotoId` to it, then delete the previous profile row when it was an automatic one. Every database step is inside one try/catch that logs `[photo] ingest failed:` plus the error message only.

- [ ] **Step 1: Failing tests** with the fake prisma: stores one photo and sets the profile for an unpinned teacher; second call with the same log id adds nothing (no second profile copy); an older `log.timestamp` than the current profile photo leaves the profile alone while still storing the punch photo; a pinned teacher keeps their profile; a thrown `punchPhoto.create` resolves without throwing; an invalid image stores nothing.
- [ ] **Step 2:** Run `npx vitest run ws-lib/photo-ingest.test.ts`; expect FAIL.
- [ ] **Step 3: Implement** `storePunchPhoto`; in `ws-server.js` require it, keep `const log = await prisma.attendanceLog.create(...)`, then `await storePunchPhoto(prisma, { staff, log, image: record.image })` before the "Saved punch" log. `staff` there already comes from `findUnique`, so it carries the new Staff columns.
- [ ] **Step 4:** `npm test`; expect PASS. Commit `feat(photos): store punch photos and pick the profile picture`.

### Task 5: Photo endpoints

**Files:**
- Create: `src/app/api/photos/[id]/route.ts`, `src/app/api/staff/[id]/photos/route.ts`, `src/app/api/staff/[id]/photo/route.ts`, and a test file next to each (`route.test.ts`, mock `getServerSession` as the existing route tests do)
- Modify: `src/app/api/staff/route.ts` (GET adds `hasPhoto: boolean`, from `profilePhotoId !== null`, never bytes)

**Interfaces:**
- Produces: the endpoints in spec section 7. `GET /api/photos/[id]` responds `Content-Type: image/jpeg`, `Cache-Control: private, max-age=86400`. `GET .../photos?limit=` returns `[{ id, takenAt }]`, newest first, default 20, max 50, excluding `isProfile` rows. `GET .../photo` streams the profile row or 404. `POST .../photo` with `{ photoId }` (400 if missing, 404 if the photo does not belong to that staff or is a profile row) copies it into a new `isProfile` row, points `Staff.profilePhotoId` at it, sets `profilePhotoPinned: true`, deletes the previous profile row. `DELETE .../photo` deletes the profile row, sets `profilePhotoId: null`, `profilePhotoPinned: false`.

- [ ] **Step 1: Failing tests** per route: 401 without a session; listing limited and ordered; image route sets headers and 404s; pin copies, sets pinned, replaces the old profile row, rejects another teacher's photo; delete unpins.
- [ ] **Step 2:** Run the new tests; expect FAIL.
- [ ] **Step 3: Implement** the routes (read the Next 16 route-handler docs for `params` as a Promise and `Response`/`Buffer` body handling).
- [ ] **Step 4:** `npm test` and `npm run build`; expect PASS. Commit `feat(photos): photo endpoints`.

### Task 6: Staff page UI

**Files:**
- Modify: `src/components/ui/Avatar.tsx` (optional `src?: string` prop: render an `<img>` filling the avatar with `alt=""`, fallback to initials on load error), `src/app/staff/page.tsx`

**Interfaces:**
- Consumes: `hasPhoto` from `GET /api/staff`, and the endpoints from Task 5.

- [ ] **Step 1:** Extend `Avatar` with `src` (keep `aria-hidden`, sizes and tone behaviour; use a plain `<img>`, with the existing lint rule disabled on that line only if required).
- [ ] **Step 2:** In `staff/page.tsx` pass `src={`/api/staff/${staff.id}/photo`}` when `staff.hasPhoto`; in the detail dialog add a "Recent punches" strip (fetches `/api/staff/{id}/photos?limit=12`, thumbnails from `/api/photos/{id}` with the punch time, click to enlarge in the existing `Modal`, "Use as profile picture" posts `{ photoId }` then refreshes, "Remove picture" calls DELETE) using existing `Button`, `Modal`, `EmptyState`, `Skeleton` components and tokens.
- [ ] **Step 3:** `npm run build` and lint on changed files; expect no new problems. Verify at 375 px width that nothing overflows (a browser check against a temporary local setup is optional and must be torn down; never touch `prisma/dev.db`).
- [ ] **Step 4:** Commit `feat(photos): avatars and recent punches on the Staff page`.

### Task 7: Retention cleanup and README

**Files:**
- Create: `src/lib/photo-retention.ts`, `src/lib/photo-retention.test.ts`
- Modify: `src/app/staff/page.tsx` server entry or a small route (use `POST /api/photos/cleanup`, signed-in only, called once from the Staff page on load, fire-and-forget), `README.md`

**Interfaces:**
- Produces: `async runPhotoCleanup(now = new Date()): Promise<{ ran: boolean; deleted: number }>`. Claims the run atomically via `policy.updateMany` with `photoCleanupRanAt` null or older than 6 hours (same pattern as `src/lib/shift-suggestions.ts` detection throttle; create the Policy row if none exists), then `punchPhoto.deleteMany({ where: { isProfile: false, takenAt: { lt: now - 90 days } } })`.

- [ ] **Step 1: Failing tests:** deletes only old non-profile rows (profile copy older than 90 days survives); a second call within 6 hours returns `ran: false` and deletes nothing; first run creates/claims the policy marker.
- [ ] **Step 2:** Run; expect FAIL. **Step 3:** implement and wire the route plus the page call. **Step 4:** `npm test`, lint, build; expect PASS.
- [ ] **Step 5:** README: add "Punch photos" (what is stored, 90-day retention, profile picture rules, log redaction, deploy note: run `prisma db push` and restart `websockets` under pm2; existing `websockets-out.log` may still contain old photos and should be truncated by the owner). Commit `feat(photos): 90-day retention and docs`.
