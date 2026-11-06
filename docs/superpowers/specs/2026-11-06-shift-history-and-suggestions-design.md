# Shift History and Automatic Shift Suggestions: Design Spec

Date: 2026-11-06
Status: Draft for review
Branch: `feature/shift-history`

## 1. Intent

**Goal.** Judge each teacher's lateness and half-days against their own real
timing, with little manual upkeep, and never rewrite past months when a timing
changes.

**Who uses it.** School administrators who run daily attendance and monthly payroll
for about 82 staff. Most follow the General shift; a handful have their own fixed
timing (for example 09:00 to 15:00).

**Success looks like this:**
- A teacher's shift can change on a given date, and days before that date are still
  judged by the old shift.
- The system notices when a teacher consistently arrives at a different time than
  their shift and suggests the change; nothing changes until an admin approves.
- Before approving, the admin sees which days would change; payroll months that are
  locked are never touched.
- Deploying this changes nothing by itself. Behaviour changes only after the first
  shift change is made.

## 2. Decisions from brainstorming

| Question | Decision |
|---|---|
| How do timings vary? | Fixed per teacher until changed (not by weekday, not day to day) |
| What does auto-detection do? | Suggests; the admin approves or dismisses |
| Past-dated changes? | Recalculate from the start date, skip locked payroll months, show a preview first |
| Approach | Shift history table (`ShiftAssignment`) plus suggestions on top |

## 3. Scope

**In scope:** shift history, per-day shift lookup, one shared day-evaluation function
used by both recalculation paths and by a preview, shift change flow with preview,
suggestion detection and review UI, a Dashboard line for pending suggestions, and a
warning when editing a shift's times.

**Out of scope (separate specs later):** one-day swaps and substitutions,
notifications (WhatsApp, SMS, email), a screen for editing detection thresholds, a
history of edits to a shift's own times, roles and permissions, punch photos.

## 4. Data model

All new date columns are plain India-time day keys (`YYYY-MM-DD` strings), not
timestamps, to avoid timezone drift.

### `ShiftAssignment`
| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | |
| `staffId` | String | relation to `Staff`, cascade delete |
| `shiftId` | String | relation to `Shift` |
| `effectiveFrom` | String | `YYYY-MM-DD` (IST day key) |
| `source` | String | `MANUAL`, `SUGGESTION` or `INITIAL` |
| `createdByUserId` | String? | the signed-in user |
| `createdAt` | DateTime | |

Constraints: unique `(staffId, effectiveFrom)`; index `(staffId, effectiveFrom)`.
There is no end date. A teacher's shift on day D is the assignment with the latest
`effectiveFrom` less than or equal to D. If there is none, fall back to
`Staff.shiftId` (see section 5).

### `ShiftSuggestion`
| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | |
| `staffId` | String | relation to `Staff`, cascade delete |
| `fromShiftId` | String? | the shift in force when detected |
| `suggestedShiftId` | String? | an existing matching shift, if any |
| `suggestedStart`, `suggestedEnd` | String | `HH:mm`; used to create a new shift when `suggestedShiftId` is null |
| `medianIn`, `medianOut` | String / String? | `HH:mm` |
| `daysObserved`, `daysWithinTolerance`, `lateDays` | Int | evidence |
| `patternSince` | String | `YYYY-MM-DD`; default start date |
| `status` | String | `PENDING`, `APPROVED` or `DISMISSED` |
| `dismissedUntil` | String? | `YYYY-MM-DD` |
| `decidedByUserId`, `decidedAt` | String?, DateTime? | |
| `createdAt`, `updatedAt` | DateTime | |

At most one `PENDING` suggestion per teacher (enforced in code).

### `Policy` (existing table)
One new nullable column, `shiftDetectionRanAt` (DateTime), used to throttle detection
(section 7). Additive, so safe for `prisma db push`.

`Staff.shiftId` is kept as "the shift today". It is refreshed whenever an assignment
is saved and re-synced when the staff list loads and when attendance is recalculated,
so a change dated in the future takes effect on its own.

## 5. Shift lookup

`shiftOn(assignments, fallbackShiftId, shiftsById, dayKey) -> Shift | null` in
`src/lib/shift-lookup.ts` (pure, with tests; `assignments` is one teacher's rows,
`fallbackShiftId` is `Staff.shiftId`, `shiftsById` is a map of all shifts):
- latest assignment with `effectiveFrom <= dayKey` wins;
- no assignments, or none yet effective: fall back to the staff member's current
  `shiftId` (this keeps all history unchanged at deploy, with no backfill);
- no shift at all: returns `null` (never late).

**First change for a teacher.** When the first assignment is created for a teacher
who has none, the system also creates an `INITIAL` assignment from `2000-01-01` for
their previous shift, so the earlier days keep resolving to it.

Used by both recalculation paths and the Dashboard (section 6).

## 6. Shared day evaluation

The attendance rules are copied in two places today: `src/lib/attendance.ts` and
`src/app/api/recalculate/route.ts`. A trustworthy preview needs one implementation.

- Extract a pure `evaluateDay(input) -> DayResult` into `src/lib/attendance-day.ts`
  (inputs: the day's punches, the shift for that day, the policy, holiday and week-off
  flags; output: status, check-in, check-out, late minutes, work minutes, overtime).
- **Step 1 of the build:** before extracting, write characterization tests that record
  what both existing implementations produce for a set of sample days (on time, late,
  late beyond grace, half day, absent, holiday, week-off, single punch, "Every IN OUT"
  policy, no shift). The extracted function must reproduce those results exactly, and
  both existing paths then call it.
- The Dashboard's lateness and last-week comparison use `shiftOn` per day.

## 7. Detection

`detectShiftPattern(days, currentShift, options) -> Pattern | null` in
`src/lib/shift-detect.ts` (pure, with tests). Defaults live in one file,
`src/lib/shift-suggestions-config.ts`.

For each teacher, over the last 28 calendar days, skipping week-offs and holidays:
- per day: first punch (arrival) and, when there are at least two punches 3 hours or
  more apart, last punch (departure);
- at least 10 working days with punches (15 for a suggestion to a later start);
- median arrival rounded to 5 minutes differs from the shift start by 20 minutes or
  more;
- at least 70% of days within 15 minutes of the median.

**Proposal:** an existing shift whose start is within 15 minutes of the median (and
end within 30 minutes of the median departure when known); otherwise a new shift with
start rounded to 5 minutes and end equal to the median departure, or start plus the
current shift's length when departure data is thin.

**Pattern start** (`patternSince`): the first day of the most recent run of days that
fit the pattern.

**Detection runs on page load** of the Shifts, Staff and Dashboard pages, not in a
background job, and is idempotent: it updates the existing pending suggestion rather
than adding another. A dismissed suggestion stays hidden for 30 days unless the median
moves by 20 minutes or more.

**Throttle.** The Dashboard refreshes itself every minute, so detection must not run
on every load. It is skipped if it already ran in the last 6 hours; the time of the
last run is stored in a new nullable `Policy.shiftDetectionRanAt` column. The
Dashboard line only reads the stored pending count. Opening the Shifts page runs
detection if the stored results are older than 6 hours, and a "Check now" button on
that page forces a run.

## 8. Approval and change flow

`POST /api/shifts/suggestions/[id]/approve` and `POST /api/staff/[id]/shift` share one
service (`src/lib/shift-change.ts`). Both accept `dryRun: true`.

**Dry run** returns, for that teacher from the start date to today: the number of
working days recalculated, how many change status (for example late to on time, half
day to present), and how many days fall in locked payroll months and are skipped. It
runs the shared `evaluateDay` against the stored punches without writing anything,
with the proposed assignment applied in memory (so `shiftOn` sees the new shift from
the start date) and compares each day's result with the stored `DailyRecord`. A start
date in the future needs no recalculation, so the dry run reports zero changed days.

**Apply**, in one database transaction:
1. create the new `Shift` if the proposal is a new shift;
2. create the `INITIAL` assignment if the teacher has none;
3. create the `ShiftAssignment` for the chosen start date, replacing an existing one
   with the same `(staffId, effectiveFrom)`;
4. refresh `Staff.shiftId`;
5. mark the suggestion `APPROVED` with who and when.

Then recalculate that teacher from the start date to today, excluding locked months
(both recalculation paths already skip locked payroll; the preview reports the same
days). If the recalculation fails, the assignment is kept and the UI offers a
"Recalculate" retry (the recalculation is idempotent).

`POST /api/shifts/suggestions/[id]/dismiss` sets `DISMISSED` and `dismissedUntil`.
`GET /api/staff/[id]/shift-history` lists a teacher's assignments.

Any signed-in user can use these (the app has no roles yet).

## 9. UI

- **Shifts page:** a "Suggestions" section with one card per pending suggestion:
  teacher, "usually arrives about 10:00 (09:55 to 10:10), shift is 09:00 to 15:00,
  late on 17 of 20 days", the proposed shift, an editable start date (default
  `patternSince`), **Approve** (opens the dry-run confirmation) and **Dismiss**.
- **Staff page:** changing a teacher's shift asks for a start date (default today)
  and shows the same dry-run confirmation. A new staff member or a CSV import creates
  the shift without a history row (the lookup falls back to `Staff.shiftId`).
- **Dashboard:** one line in "Needs your attention": "N shift suggestions to review",
  linking to the Shifts page.
- **Shift times warning:** when editing the start or end time of a shift that staff
  use, a notice says it changes every day that used the shift, including past months,
  and suggests creating a new shift instead.
- All new UI uses the existing design system components and tokens.

## 10. Errors and edge cases

- A teacher with no shift is never late and never gets a suggestion.
- Only one suggestion can be pending per teacher, so two cannot be approved at once.
  A manual change followed by an approved suggestion simply adds another dated
  assignment; the lookup always picks the latest start date on or before the day.
- A start date before the teacher's first punch is allowed.
- A start date in a locked payroll month: the assignment is saved, but days in locked
  months keep their stored results (the confirmation says how many are skipped).
- A future start date: allowed; `Staff.shiftId` and the Dashboard follow it when the
  date arrives (section 4).
- A teacher who is chronically late on the General shift can produce a suggestion
  that would make the lateness official. Mitigations: approval is manual, later-start
  suggestions need 15 days of evidence, and each card shows late days out of days
  observed.

## 11. Testing

- `shiftOn`: day before, day of and day after a change; two changes in a row; no
  assignments; no shift.
- Characterization tests for the two existing recalculation paths (section 6).
- `evaluateDay`: the same sample days, plus a day evaluated with two different shifts.
- `detectShiftPattern`: steady different arrival; consistent late arrival; too few days;
  inconsistent days; later-start needing 15 days; holidays and week-offs skipped;
  matching an existing shift versus proposing a new one.
- Change flow: transaction applies all five steps; failed recalculation keeps the
  assignment; locked months skipped; dry run matches the real recalculation; replace on
  the same date; first change creates the `INITIAL` assignment.
- All checks run with `npm test`, `npm run lint` and `npm run build`.

## 12. Build order

Each step is its own commit and is checked before the next.
1. Characterization tests, then extract `evaluateDay`; results must be identical.
2. Schema: `ShiftAssignment` and `ShiftSuggestion` (additive, safe for the deploy's
   `prisma db push`).
3. `shiftOn`, wired into both recalculation paths and the Dashboard.
4. Change flow: services, endpoints, Staff page flow, dry-run confirmation.
5. Detection, suggestions endpoints, Shifts page section, Dashboard line.
6. Shift times warning.

## 13. Rollout and risks

- **Rollout:** additive schema through the existing deploy; no behaviour change until
  the first shift change is made.
- **Refactor risk (step 1):** mitigated by characterization tests that must pass
  unchanged before anything builds on the extraction.
- **Timezone risk:** all new dates are IST day keys, and the server process is pinned
  to Asia/Kolkata from the previous release.
- **Detection excusing lateness:** see section 10.
