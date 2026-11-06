# Shift History and Automatic Shift Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each teacher dated shift assignments so changing a timing never rewrites past months, and suggest shift changes (for an admin to approve) when a teacher's real arrival pattern differs from their shift.

**Architecture:**
- The two copies of the attendance rules are first locked in by characterization tests, then merged into one pure `evaluateDay` plus one shared range module. The range module also gains a one-teacher scope, so preview and real recalculation use the same code.
- A new `ShiftAssignment` table plus a pure `shiftOn` lookup resolve the shift for each day. Until a teacher has an assignment, the lookup falls back to `Staff.shiftId`, so nothing changes at deploy.
- Every writer of `Staff.shiftId` goes through one change service (dry-run preview, apply in a transaction, scoped recalculation that skips locked payroll months). Detection of arrival patterns is a pure function; its results are stored as `ShiftSuggestion` rows and reviewed on the Shifts page.

**Tech Stack:** Next.js 16.2.9 (App Router; breaking changes, read `node_modules/next/dist/docs/` before Next-specific code), React 19, Prisma 6 (PostgreSQL in production), date-fns, Vitest 3 (`npm test`), existing design system in `src/components/ui`.

**Spec:** `docs/superpowers/specs/2026-11-06-shift-history-and-suggestions-design.md` (this plan amends it in Task 4: `ShiftAssignment.shiftId` is nullable, meaning "no shift from this date").

## Global Constraints

- All new date columns are plain India-time day keys, `YYYY-MM-DD` strings. Build them with `istDateKey` from `src/lib/dashboard-calc.ts`; never from `toISOString()` or the server's local time.
- `ShiftAssignment`: unique `(staffId, effectiveFrom)`, index `(staffId, effectiveFrom)`, `source` is one of `MANUAL`, `SUGGESTION`, `INITIAL`. A teacher's shift on day D is the assignment with the latest `effectiveFrom <= D`; none, or none yet effective: fall back to `Staff.shiftId`; no shift: never late.
- The "always" start date is the constant `ALWAYS = "2000-01-01"`.
- Nothing is migrated or backfilled at deploy; behaviour changes only after the first shift change is made.
- Detection defaults (one config file): window 28 calendar days; at least 10 working days with punches (15 for a suggestion to a later start); median arrival rounded to 5 minutes differs from shift start by 20 minutes or more; at least 70% of days within 15 minutes of the median; departure counts only with at least two punches 3 hours or more apart; an existing shift matches when its start is within 15 minutes of the median arrival (and its end within 30 minutes of the median departure when known); dismissed suggestions stay hidden 30 days unless the median moves 20 minutes or more; detection is skipped if it ran in the last 6 hours (`Policy.shiftDetectionRanAt`).
- Locked payroll months are never recalculated (same rule as today: `MonthlyPayroll.isLocked` per staff, month, year).
- The Dashboard refreshes every minute: nothing added to it may run detection or heavy queries on every load.
- UI uses components from `@/components/ui` and token classes (`bg-card`, `text-muted`, `border-line`, status tokens); no raw hex; status is shown as icon plus word plus colour; every control has a visible focus state.
- Route handlers copy the existing pattern: `getServerSession(authOptions)` first and `401` when missing; dynamic `[id]` routes take `{ params }: { params: Promise<{ id: string }> }` and `await params`.
- Prisma changes are additive. The local database cannot be reached from this checkout (the `.env` points to SQLite while the schema is PostgreSQL), so run `npx prisma generate`, never `prisma db push` or `migrate`.
- Date-dependent tests call `ensureSchoolTimezone()` (from `src/lib/timezone.ts`) in a top-level `beforeAll` and build dates as IST instants (for example `new Date("2026-11-02T09:20:00+05:30")`).
- Gates for every task: `npm test` passes; `npx eslint <changed files>` has no new problems; `npm run lint 2>&1 | tail -1` is at most 80 problems; `npm run build` passes.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Never push, never touch `dev.db`, `prisma/dev.db` or `.env`.

## File Structure

| File | Responsibility |
|---|---|
| `src/test-utils/fake-prisma.ts` (new) | In-memory Prisma double for the calls the attendance code makes |
| `src/lib/attendance-day.ts` (new) | Pure `evaluateDay` |
| `src/lib/attendance-range.ts` (new) | `loadRangeInputs`, pure `computeRangeRecords`, `persistRangeRecords`, `recalculateRange` |
| `src/lib/attendance.ts` (modify) | `recalculateAttendance` becomes a wrapper over the range module |
| `src/app/api/recalculate/route.ts` (modify) | Same JSON response, delegates to the range module |
| `src/lib/shift-lookup.ts` (new) | `ALWAYS`, `shiftOn`, `shiftStartForDay`, `currentShiftId` |
| `src/lib/shift-change.ts` (new) | Pure `planShiftChange`, `summarizeChange` |
| `src/lib/shift-change-service.ts` (new) | Prisma: `previewShiftChange`, `applyShiftChange`, `syncCurrentShifts` |
| `src/app/api/staff/[id]/shift/route.ts`, `shift-history/route.ts` (new) | Change and history endpoints |
| `src/lib/shift-suggestions-config.ts`, `shift-detect.ts` (new) | Config constants; pure detection and proposals |
| `src/lib/shift-suggestions.ts` (new) | Prisma: run detection (throttled), approve, dismiss |
| `src/app/api/shifts/suggestions/**` (new) | Suggestion endpoints |
| `prisma/schema.prisma` (modify) | `ShiftAssignment`, `ShiftSuggestion`, `Policy.shiftDetectionRanAt` |

## Review Focus

1. **A writer of `Staff.shiftId` bypasses the service** (staff edit, bulk assign, CSV import update path): once a teacher has assignments the change would silently do nothing. Pinned in Task 7 by a grep check that no `shiftId` write remains outside the service, and in Task 6 by `planShiftChange` tests.
2. **Deleting a shift that assignments or suggestions use** would hit a database constraint and show a generic 500. Pinned in Task 11: a route test expects 409 with a readable message.
3. **A chronically late teacher gets a suggestion that excuses lateness.** Pinned in Task 9: 20 days at 09:30 on a 09:00 shift suggests a later start with `lateDays = 20`; only 12 such days suggests nothing.
4. **Day boundaries near midnight** (a punch at 23:50 IST or 00:10 IST must land on the right IST day, and an assignment starting that day applies from 00:00). Pinned in Task 4.
5. **First change must keep earlier days on the old shift** (the `INITIAL` assignment). Pinned in Task 6 (`planShiftChange`) and Task 5 (a range test where days before the start still use the old shift).

---

### Task 1: Characterization tests for the current recalculation

**Files:**
- Create: `src/test-utils/fake-prisma.ts`
- Create: `src/lib/attendance.characterization.test.ts`
- Create: `src/app/api/recalculate/route.characterization.test.ts`

**Interfaces:**
- Produces:
  - `type Fixtures = { staff: { id: string; name: string; shiftId: string | null; createdAt?: Date; shift: { id: string; name: string; startTime: string; endTime: string } | null }[]; policy: Record<string, unknown> | null; holidays: { date: Date; name: string }[]; lockedPayrolls: { staffId: string; month: number; year: number }[]; logs: { id: string; staffId: string; timestamp: Date; type: string }[] }`
  - `createFakePrisma(fixtures: Fixtures): { client: unknown; created: Record<string, unknown>[]; deleteCalls: unknown[] }`: implements `staff.findMany`, `policy.findFirst`, `holiday.findMany`, `monthlyPayroll.findMany`, `attendanceLog.findMany` (honouring the `timestamp.gte/lte` filter), and `$transaction(fn)` whose `tx.dailyRecord.deleteMany` pushes its argument to `deleteCalls` and `tx.dailyRecord.createMany({ data })` appends to `created`.

The scenarios use policy `lateArrivalAllow "00:15"`, `halfDayIfWorkHrsLessThan "06:00"`, `absentIfWorkHrsLessThan "00:00"`, `allInOut "First IN Last OUT"`, `weekOffDays "0"`, one shift `09:00–15:00`, and the week of Sun 1 Nov to Mon 2 Nov 2026 (IST).

- [ ] **Step 1: Write the fake Prisma and the lib characterization test.** One `it` per scenario, each calling `recalculateAttendance(day, day)` with `vi.mock("@/lib/prisma", ...)` (use `vi.hoisted` for the holder). Expected values for `created[0]` (staff A unless noted):

| Scenario | Punches (IST) | status | lateMinutes | workMinutes |
|---|---|---|---|---|
| on time | 08:55, 15:10 | `PRESENT` | 0 | 375 |
| inside grace | 09:10, 15:30 | `PRESENT` | 0 | 380 |
| late beyond grace | 09:20, 15:30 | `PRESENT` | 20 | 370 |
| half day | 09:00, 12:00 | `HALF_DAY` | 0 | 180 |
| single punch | 09:00 | `HALF_DAY` | 0 | 0 |
| absent | none (Mon 2 Nov) | `ABSENT` | 0 | 0 |
| holiday, no punches | none (holiday on 2 Nov) | `HOLIDAY` | 0 | 0 |
| holiday with punches | 09:00, 11:00 (holiday) | `PRESENT` | 0 | 120 |
| week off, no punches | none (Sun 1 Nov) | `WEEKOFF` | 0 | 0 |
| no shift | 10:00, 16:00, staff B with `shift: null` | `PRESENT` | 0 | 360 |
| every-IN-OUT policy | IN 09:00, OUT 12:00, IN 13:00, OUT 15:00 with `allInOut "Every IN OUT"` | `HALF_DAY` | 0 | 300 |

Also: a staff-month in `lockedPayrolls` produces no record for that staff; a future date with no punches produces no record; the delete range spans `startOfDay(start)` to `startOfDay(end)` and, with a locked payroll present, includes a `NOT: { OR: [...] }` clause.

- [ ] **Step 2: Run against the unmodified code and reconcile.** Run `npx vitest run src/lib/attendance.characterization.test.ts`. Expected: PASS. If a row of the table disagrees with what the current code does, the code is the truth: change the expected value to the current output and note it in a comment (`// characterized: ...`).

- [ ] **Step 3: Write the route characterization test.** Same scenarios (a representative subset: on time, late beyond grace, half day, absent, locked month) through `POST` of `src/app/api/recalculate/route.ts`, with `vi.mock("next-auth/next")` returning a session, `vi.mock("@/lib/auth", () => ({ authOptions: {} }))` and the fake Prisma. Assert the same `created` rows plus the response body `{ success: true, recalculatedDays: 1, processedRecords: <n> }`. Add one test with no `startDate` in the body and logs on 2 Nov: the start defaults to the earliest log and `recalculatedDays` is the number of days from it to today.

- [ ] **Step 4: Run both.** `npx vitest run src/lib/attendance.characterization.test.ts src/app/api/recalculate/route.characterization.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit.** `git add src/test-utils src/lib/attendance.characterization.test.ts src/app/api/recalculate/route.characterization.test.ts` then `git commit -m "test(attendance): characterize current recalculation in both implementations"`

---

### Task 2: Extract `evaluateDay`

**Files:**
- Create: `src/lib/attendance-day.ts`, `src/lib/attendance-day.test.ts`
- Modify: `src/lib/attendance.ts`, `src/app/api/recalculate/route.ts`

**Interfaces:**
- Produces:
  - `type DayLog = { timestamp: Date; type: string }`
  - `type DayPolicy = { lateArrivalAllow: string; halfDayIfWorkHrsLessThan: string; absentIfWorkHrsLessThan: string; allInOut: string }`
  - `type DayResult = { status: "PRESENT" | "ABSENT" | "HALF_DAY" | "HOLIDAY" | "WEEKOFF"; checkIn: Date | null; checkOut: Date | null; lateMinutes: number; workMinutes: number; overtimeMinutes: 0 }`
  - `evaluateDay(input: { date: Date; logs: DayLog[]; shift: { startTime: string } | null; policy: DayPolicy; isHoliday: boolean; isWeekOff: boolean }): DayResult` where `date` is the day's local start and `logs` are that person's punches that day, ascending.

- [ ] **Step 1: Write the failing tests** in `attendance-day.test.ts`: the same eleven scenarios and expected values as Task 1, calling `evaluateDay` directly (`ensureSchoolTimezone()` first). Assert the full `DayResult`, including `checkIn`/`checkOut` instants and `overtimeMinutes: 0`.

- [ ] **Step 2: Run to verify failure.** `npx vitest run src/lib/attendance-day.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement `evaluateDay`** in `src/lib/attendance-day.ts` by moving the per-person body of the existing loop unchanged (status, First-IN-Last-OUT and Every-IN-OUT work minutes, late minutes from `parse(shift.startTime, "HH:mm", date)` plus grace, half-day and absent rules, holiday and week-off statuses). Keep `parseTime` as a local helper. Do not alter any rule.

- [ ] **Step 4: Replace the inline body in both `attendance.ts` and the route** with a call to `evaluateDay`; the future-date skip and the locked-month skip stay where they are. Remove now-unused imports.

- [ ] **Step 5: Run everything.** `npm test`. Expected: all pass, including both characterization suites unchanged and `attendance-day.test.ts`.

- [ ] **Step 6: Commit.** `git add src/lib/attendance-day.ts src/lib/attendance-day.test.ts src/lib/attendance.ts src/app/api/recalculate/route.ts` then `git commit -m "refactor(attendance): extract pure evaluateDay shared by both recalculation paths"`

---

### Task 3: Shared range module with a one-teacher scope

**Files:**
- Create: `src/lib/attendance-range.ts`, `src/lib/attendance-range.test.ts`
- Modify: `src/lib/attendance.ts`, `src/app/api/recalculate/route.ts`

**Interfaces:**
- Consumes: `evaluateDay`, `DayResult` from Task 2; `createFakePrisma`, `Fixtures` from Task 1.
- Produces:
  - `type DailyRecordRow = DayResult & { staffId: string; date: Date }`
  - `type RangeInputs = { startDate: Date; endDate: Date; staffList: { id: string; shiftId: string | null; shift: { startTime: string } | null }[]; policy: DayPolicy & { weekOffDays?: string }; holidayKeys: Set<number>; weekOffDays: number[]; lockedKeys: Set<string>; lockedPayrolls: { staffId: string; month: number; year: number }[]; logsByStaffDay: Map<string, DayLog[]>; staffId?: string }` (`logsByStaffDay` is keyed `${staffId}|${startOfDay(date).getTime()}`)
  - `loadRangeInputs(opts: { startDate: Date; endDate: Date; staffId?: string }): Promise<RangeInputs>`
  - `computeRangeRecords(inputs: RangeInputs, now: Date): DailyRecordRow[]` (pure; skips future days with no punches and locked staff-months)
  - `persistRangeRecords(inputs: RangeInputs, records: DailyRecordRow[]): Promise<void>` (transaction: delete then `createMany` in chunks of 100; when `inputs.staffId` is set the delete is limited to that staff; locked staff-months are excluded as today)
  - `recalculateRange(opts: { startDate: Date; endDate: Date; staffId?: string }): Promise<{ days: number; records: number }>` where `days` is the number of calendar days in the range

- [ ] **Step 1: Write the failing tests** in `attendance-range.test.ts` using the fake Prisma: (a) `recalculateRange` over one day returns `{ days: 1, records: 2 }` and `created` matches the Task 1 values for two staff; (b) with `staffId: "A"` only staff A's record is created and the recorded `deleteMany` argument has `where.staffId === "A"`; (c) with a locked staff-month the record is not created and the delete has a `NOT` clause; (d) `computeRangeRecords` with `now` before the day skips a no-punch future day.

- [ ] **Step 2: Run to verify failure.** `npx vitest run src/lib/attendance-range.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the module.** One bounded `attendanceLog.findMany` for the whole range (instead of one per day), grouped by staff and local day, replaces the per-day queries; everything else follows the current code. Preserve the existing locked-month key format `${staffId}-${month}-${year}` and the existing delete conditions.

- [ ] **Step 4: Delegate from both callers.** `recalculateAttendance(startDate, endDate)` becomes `return (await recalculateRange({ startDate, endDate })).records`. The route keeps its start-date default and its response shape: `{ success: true, recalculatedDays: days, processedRecords: records }`.

- [ ] **Step 5: Run everything.** `npm test`. Expected: all pass, the Task 1 characterization suites unchanged.

- [ ] **Step 6: Commit.** `git add src/lib/attendance-range.ts src/lib/attendance-range.test.ts src/lib/attendance.ts src/app/api/recalculate/route.ts` then `git commit -m "refactor(attendance): one shared recalculation range module with per-staff scope"`

---

### Task 4: Schema and shift lookup

**Files:**
- Modify: `prisma/schema.prisma`, `docs/superpowers/specs/2026-11-06-shift-history-and-suggestions-design.md`
- Create: `src/lib/shift-lookup.ts`, `src/lib/shift-lookup.test.ts`

**Interfaces:**
- Consumes: `istDateKey` from `src/lib/dashboard-calc.ts`.
- Produces:
  - `const ALWAYS = "2000-01-01"`
  - `type ShiftLite = { id: string; name: string; startTime: string; endTime: string }`
  - `type AssignmentLite = { effectiveFrom: string; shiftId: string | null }`
  - `shiftOn(assignments: AssignmentLite[], fallbackShiftId: string | null, shiftsById: ReadonlyMap<string, ShiftLite>, dayKey: string): ShiftLite | null`
  - `shiftStartForDay(assignments: AssignmentLite[], fallbackShiftId: string | null, shiftsById: ReadonlyMap<string, ShiftLite>, dayKey: string): string | null`
  - `currentShiftId(assignments: AssignmentLite[], fallbackShiftId: string | null, todayKey: string): string | null`

- [ ] **Step 1: Amend the spec.** In section 4 of the spec change `ShiftAssignment.shiftId` to `String?` ("null means no shift from this date"), state `onDelete: Restrict` for the shift relation, and add one sentence to section 8 that every writer of `Staff.shiftId` (staff edit, bulk assign, CSV import update path) goes through the change service.

- [ ] **Step 2: Add the models to `prisma/schema.prisma`:**
  - `ShiftAssignment { id String @id @default(cuid()); staffId String; shiftId String?; effectiveFrom String; source String; createdByUserId String?; createdAt DateTime @default(now()); staff Staff @relation(fields: [staffId], references: [id], onDelete: Cascade); shift Shift? @relation(fields: [shiftId], references: [id], onDelete: Restrict); @@unique([staffId, effectiveFrom]); @@index([staffId, effectiveFrom]) }`
  - `ShiftSuggestion { id String @id @default(cuid()); staffId String; fromShiftId String?; suggestedShiftId String?; suggestedStart String; suggestedEnd String; medianIn String; medianOut String?; daysObserved Int; daysWithinTolerance Int; lateDays Int; patternSince String; direction String; status String @default("PENDING"); dismissedUntil String?; decidedByUserId String?; decidedAt DateTime?; createdAt DateTime @default(now()); updatedAt DateTime @updatedAt; staff Staff @relation(fields: [staffId], references: [id], onDelete: Cascade); suggestedShift Shift? @relation("SuggestedShift", fields: [suggestedShiftId], references: [id], onDelete: Restrict); @@index([staffId, status]) }`
  - Back-relations: `Staff.shiftAssignments`, `Staff.shiftSuggestions`, `Shift.assignments`, `Shift.suggestions`; `Policy.shiftDetectionRanAt DateTime?`.
  Run `npx prisma format` then `npx prisma generate`.

- [ ] **Step 3: Write the failing tests** in `shift-lookup.test.ts`:
  - `shiftOn` returns the earlier shift the day before a change, the new one on `effectiveFrom`, and the new one the day after; two changes in a row resolve to the latest on or before the day.
  - No assignments: returns the fallback shift. Assignments all in the future: fallback. An assignment with `shiftId: null` returns `null`. An assignment pointing at an id missing from the map returns `null`.
  - Midnight: with an assignment starting `2026-11-04`, `shiftOn(..., istDateKey(new Date("2026-11-03T18:25:00Z")))` (23:55 IST on 3 Nov) is the old shift and `istDateKey(new Date("2026-11-03T18:35:00Z"))` (00:05 IST on 4 Nov) is the new shift.
  - `currentShiftId(assignments, fallback, todayKey)` returns the id for `todayKey`; `shiftStartForDay` returns the resolved shift's `startTime` or `null`.

- [ ] **Step 4: Run to verify failure.** `npx vitest run src/lib/shift-lookup.test.ts`. Expected: FAIL.

- [ ] **Step 5: Implement `src/lib/shift-lookup.ts`.** Sort-free approach: scan for the assignment with the greatest `effectiveFrom <= dayKey` (string comparison on day keys is correct).

- [ ] **Step 6: Run gates.** `npm test`, `npm run build`. Expected: pass (the generated client has the new models).

- [ ] **Step 7: Commit.** `git add prisma/schema.prisma docs/superpowers/specs/2026-11-06-shift-history-and-suggestions-design.md src/lib/shift-lookup.ts src/lib/shift-lookup.test.ts` then `git commit -m "feat(shifts): shift assignment schema and per-day shift lookup"`

---

### Task 5: Use the lookup in recalculation and the Dashboard

**Files:**
- Modify: `src/lib/attendance-range.ts`, `src/lib/attendance-range.test.ts`, `src/lib/dashboard.ts`

**Interfaces:**
- Consumes: `shiftOn`, `shiftStartForDay`, `ShiftLite`, `AssignmentLite` (Task 4); `computeRangeRecords`, `RangeInputs` (Task 3).
- Produces: `RangeInputs` gains `shiftsById: Map<string, ShiftLite>` and `assignmentsByStaff: Map<string, AssignmentLite[]>`; `loadRangeInputs` loads them.

- [ ] **Step 1: Write the failing tests** in `attendance-range.test.ts`: staff A has assignments `[ALWAYS -> shift 09:00, 2026-11-04 -> shift 10:00]`, punches at 09:40 on 3 Nov and on 4 Nov. Expect on 3 Nov `lateMinutes` 40 (old shift) and on 4 Nov `lateMinutes` 0 (new shift, inside grace). A second test: a staff with no assignments and `shiftId` set behaves exactly as in Task 1. Extend `createFakePrisma` and `Fixtures` with `shifts` and `assignments` (`shiftAssignment.findMany`, `shift.findMany`).

- [ ] **Step 2: Run to verify failure.** `npx vitest run src/lib/attendance-range.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** In `computeRangeRecords` resolve the shift per staff and day with `shiftOn(assignmentsByStaff.get(id) ?? [], staff.shiftId, shiftsById, istDateKey(date))` and pass it to `evaluateDay`. In `loadRangeInputs` load all shifts and the assignments of the staff in scope.

- [ ] **Step 4: Dashboard.** In `getDashboardData` load `shiftAssignment.findMany()` and `shift.findMany()` in the existing `Promise.all`, replace `shiftStart: shiftStartOf(s.shift)` with a per-day `shiftStartForDay(...)` in `dayStats` and for today's row; today's `shift: { start, end }` comes from `shiftOn` for `todayKey`. `commonShift` keeps working from those values.

- [ ] **Step 5: Run gates.** `npm test`, `npm run build`. Expected: pass; all Task 1 and dashboard tests unchanged.

- [ ] **Step 6: Commit.** `git add src/lib/attendance-range.ts src/lib/attendance-range.test.ts src/test-utils/fake-prisma.ts src/lib/dashboard.ts` then `git commit -m "feat(shifts): recalculation and dashboard resolve each day's shift from history"`

---

### Task 6: Pure change planning and preview summary

**Files:**
- Create: `src/lib/shift-change.ts`, `src/lib/shift-change.test.ts`

**Interfaces:**
- Consumes: `ALWAYS`, `AssignmentLite` (Task 4); `DailyRecordRow` (Task 3).
- Produces:
  - `type ChangeRequest = { staffId: string; shiftId: string | null; effectiveFrom: string; source: "MANUAL" | "SUGGESTION"; createdByUserId?: string }`
  - `type ChangeOps = { createInitial: { effectiveFrom: string; shiftId: string | null } | null; upsert: { effectiveFrom: string; shiftId: string | null; source: "MANUAL" | "SUGGESTION" }; staffShiftId: string | null | undefined; recalcFrom: string | null }` (`staffShiftId` is the value for `Staff.shiftId` when the change is effective today or earlier, `undefined` when future-dated; `recalcFrom` is `effectiveFrom` when it is not in the future, else `null`)
  - `planShiftChange(existing: AssignmentLite[], currentShiftId: string | null, req: ChangeRequest, todayKey: string): ChangeOps`
  - `type StoredDay = { dayKey: string; status: string; lateMinutes: number }`
  - `type PreviewSummary = { recalculatedDays: number; changedDays: number; transitions: Record<string, number>; lockedSkippedDays: number }`
  - `summarizeChange(stored: StoredDay[], computed: { dayKey: string; status: string; lateMinutes: number }[], lockedSkippedDays: number): PreviewSummary`

- [ ] **Step 1: Write the failing tests.**
  - `planShiftChange` with no existing rows and `currentShiftId "s1"`: `createInitial` is `{ effectiveFrom: ALWAYS, shiftId: "s1" }` (review focus 5); with existing rows `createInitial` is `null`; a request on an existing `effectiveFrom` still returns `upsert` for that date; a request dated in the future gives `staffShiftId: undefined` and `recalcFrom: null`; dated today gives `staffShiftId` equal to the request's shift and `recalcFrom` equal to `todayKey`; `shiftId: null` is allowed ("no shift").
  - `summarizeChange`: labels are `LATE` (PRESENT with `lateMinutes > 0`), `ON_TIME` (PRESENT otherwise), or the status itself; a day whose label changes increments `transitions["LATE->ON_TIME"]`; a day with the same label but different `lateMinutes` counts in `changedDays` but not in `transitions`; `recalculatedDays` is `computed.length`; `lockedSkippedDays` is passed through; empty inputs give zeros.

- [ ] **Step 2: Run to verify failure.** `npx vitest run src/lib/shift-change.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement both functions** as pure code in `src/lib/shift-change.ts`.

- [ ] **Step 4: Run gates and commit.** `npm test` then `git add src/lib/shift-change.ts src/lib/shift-change.test.ts` and `git commit -m "feat(shifts): pure shift change planning and preview summary"`

---

### Task 7: Change service, endpoints, and every `shiftId` writer

**Files:**
- Create: `src/lib/shift-change-service.ts`, `src/lib/shift-change-service.test.ts`, `src/app/api/staff/[id]/shift/route.ts`, `src/app/api/staff/[id]/shift-history/route.ts`
- Modify: `src/app/api/staff/route.ts`, `src/app/api/staff/bulk/route.ts`, `src/lib/attendance-range.ts`

**Interfaces:**
- Consumes: Task 3 range functions, Task 4 lookup, Task 6 planning.
- Produces:
  - `previewShiftChange(req: ChangeRequest, now?: Date): Promise<PreviewSummary>` (writes nothing; applies the proposed assignment in memory to `RangeInputs.assignmentsByStaff`, runs `computeRangeRecords` for that staff from `effectiveFrom` to today, compares with stored `DailyRecord` rows, counts staff-days in locked months as `lockedSkippedDays`)
  - `applyShiftChange(req: ChangeRequest, now?: Date): Promise<{ assignmentSaved: true; recalculated: boolean; summary: PreviewSummary; error?: string }>` (one transaction: create `INITIAL` if planned, upsert the assignment, refresh `Staff.shiftId` when `staffShiftId !== undefined`; then `recalculateRange({ staffId, ... })` from `recalcFrom`; a recalculation failure leaves the assignment and returns `recalculated: false` with `error`)
  - `syncCurrentShifts(now?: Date): Promise<void>` (for each staff that has assignments, set `Staff.shiftId = currentShiftId(...)` when it differs)
  - Endpoints: `POST /api/staff/[id]/shift` body `{ shiftId: string | null; effectiveFrom?: string; dryRun?: boolean }` (default `effectiveFrom` is today's IST key; `400` for an invalid date or unknown shift) returns the preview when `dryRun`, else the apply result; `GET /api/staff/[id]/shift-history` returns the assignments newest first with the shift name.

- [ ] **Step 1: Write the failing tests** in `shift-change-service.test.ts` (fake Prisma extended with `shiftAssignment.create/upsert`, `staff.update`, `dailyRecord.findMany`):
  - `previewShiftChange` writes nothing (no `created`, no staff update) and returns `changedDays` for a teacher whose late days become on time under the proposed shift.
  - The preview's `recalculatedDays` and changed counts equal what `applyShiftChange` then produces in `created` for the same request.
  - `applyShiftChange` with a locked staff-month reports `lockedSkippedDays > 0` and creates no record for those days.
  - A failing `recalculateRange` (fake that throws) still leaves the assignment saved and returns `recalculated: false`.
  - `syncCurrentShifts` flips `Staff.shiftId` for a teacher whose future-dated assignment has arrived.

- [ ] **Step 2: Run to verify failure.** `npx vitest run src/lib/shift-change-service.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the service** in `src/lib/shift-change-service.ts` and call `syncCurrentShifts()` at the start of `recalculateRange` (not in dry runs) and in `GET /api/staff`.

- [ ] **Step 4: Add the two route files** following the conventions in Global Constraints.

- [ ] **Step 5: Route every other writer through the service.** `PUT /api/staff`: when `updateData.shiftId` differs from the teacher's current `Staff.shiftId`, call `applyShiftChange` with `effectiveFrom` from the body or today, and stop writing `shiftId` in the `staff.update`. `PUT /api/staff/bulk` with `shiftId`: call `applyShiftChange` from today for each selected teacher whose shift differs. `POST /api/staff/bulk` (CSV): for rows whose staff already exists and whose shift differs, use the service from today; new staff keep `shiftId` in the create, with no assignment.

- [ ] **Step 6: Verify no writer bypasses the service.** Run `grep -rn "shiftId" src/app/api src/lib --include=*.ts | grep -v test`. Expected: `shiftId` is written to `Staff` only inside `src/lib/shift-change-service.ts` and in the two create paths (single create and CSV create for new staff).

- [ ] **Step 7: Run gates and commit.** `npm test`, `npm run build`, then `git add src/lib/shift-change-service.ts src/lib/shift-change-service.test.ts src/app/api/staff src/lib/attendance-range.ts src/test-utils/fake-prisma.ts` and `git commit -m "feat(shifts): shift change service with preview, history endpoints, all writers routed through it"`

---

### Task 8: Staff page: change a shift with a start date and a preview

**Files:**
- Modify: `src/app/staff/page.tsx`

**Interfaces:**
- Consumes: `POST /api/staff/[id]/shift` and `GET /api/staff/[id]/shift-history` (Task 7).

- [ ] **Step 1: Edit modal.** When the shift select changes to a different value, show a "Starts on" date field (default today, IST) and a "Preview" step: call the endpoint with `dryRun: true` and render "N working days recalculated, X change (for example 9 late to on time), Y locked days skipped" using `Field`, `Card` and `StatusBadge`-style rows; the save button stays disabled until the preview has loaded for the current date and shift. Saving sends the real request (not `PUT /api/staff` for the shift field) and shows the "Recalculate" retry button when `recalculated` is `false`.
- [ ] **Step 2: Bulk assign shift.** Keep the existing control; its confirmation text says the new shift applies from today and that earlier days keep their shift.
- [ ] **Step 3: History.** In the edit modal show the teacher's shift history (start date, shift name, source) from the history endpoint.
- [ ] **Step 4: Gates.** `npx eslint src/app/staff/page.tsx` (no new problems), `npm test`, `npm run build`.
- [ ] **Step 5: Commit.** `git add src/app/staff/page.tsx` then `git commit -m "feat(staff): change a teacher's shift from a date, with preview and history"`

---

### Task 9: Detection (pure)

**Files:**
- Create: `src/lib/shift-suggestions-config.ts`, `src/lib/shift-detect.ts`, `src/lib/shift-detect.test.ts`

**Interfaces:**
- Consumes: `ShiftLite` (Task 4); `parseHHMM` from `src/lib/dashboard-calc.ts`.
- Produces:
  - `SHIFT_DETECTION = { windowDays: 28, minDays: 10, minDaysLater: 15, minDeviationMin: 20, consistencyRatio: 0.7, toleranceMin: 15, departureMinGapMin: 180, matchStartMin: 15, matchEndMin: 30, dismissDays: 30, throttleHours: 6 }`
  - `type ObservedDay = { dayKey: string; firstIn: string; lastOut: string | null }` (times as `HH:mm`)
  - `buildObservedDays(punchesByDay: Map<string, Date[]>, skipDayKeys: ReadonlySet<string>): ObservedDay[]` (oldest first; `lastOut` only with at least two punches and last minus first at least 180 minutes; times in IST)
  - `type Pattern = { medianIn: string; medianOut: string | null; daysObserved: number; daysWithinTolerance: number; lateDays: number; patternSince: string; direction: "EARLIER" | "LATER" }`
  - `detectShiftPattern(days: ObservedDay[], shift: { startTime: string; endTime: string }, allow: string): Pattern | null`
  - `proposeShift(pattern: Pattern, shifts: ShiftLite[], currentShift: ShiftLite): { shiftId: string | null; start: string; end: string }`
  - `roundToFive(hhmm: string): string`

- [ ] **Step 1: Write the failing tests** (build 28-day fixtures with a helper):
  - Steady different arrival: 20 days around 10:00 (09:55 to 10:10) against a 09:00 shift gives `medianIn "10:00"`, `direction "LATER"`, `daysObserved 20`.
  - Steady earlier arrival: 12 days at 08:25 against a 09:00 shift gives `direction "EARLIER"` (12 days is enough for earlier).
  - Too few days: 9 days returns `null`; 12 days of a later pattern returns `null` (later needs 15); 15 days of a later pattern is accepted.
  - Chronically late teacher (review focus 3): 20 days at 09:30 on a 09:00 shift (allow `"00:15"`) returns a `LATER` pattern with `lateDays === 20`; only 12 such days returns `null`.
  - Deviation under 20 minutes (median 09:15 on a 09:00 shift) returns `null`.
  - Inconsistent days (arrivals spread 08:30 to 10:30, under 70% within 15 minutes of the median) returns `null`.
  - `patternSince` is the first day of the latest run of in-tolerance days: with three odd days then 15 matching days, it is the first matching day.
  - `buildObservedDays`: skipped day keys (holidays, week-offs) are excluded; one punch gives `lastOut: null`; two punches 2 hours apart give `lastOut: null`; two punches 6 hours apart give `lastOut` set; punch times are read in IST.
  - `proposeShift`: an existing shift within 15 minutes of the median start (and 30 of the median end) is returned with its id; otherwise `shiftId: null` with start rounded to 5 minutes and end equal to the median departure, or start plus the current shift's length when `medianOut` is `null`.
  - `roundToFive("10:02")` is `"10:00"`, `"10:03"` is `"10:05"`.

- [ ] **Step 2: Run to verify failure.** `npx vitest run src/lib/shift-detect.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** `shift-suggestions-config.ts` (the constants above, verbatim) and `shift-detect.ts` (median of minutes, then `roundToFive`; pattern-since by walking back from the newest observed day while the day is within tolerance of the median).

- [ ] **Step 4: Run gates and commit.** `npm test`, then `git add src/lib/shift-suggestions-config.ts src/lib/shift-detect.ts src/lib/shift-detect.test.ts` and `git commit -m "feat(shifts): pure detection of arrival patterns and shift proposals"`

---

### Task 10: Suggestions service and endpoints

**Files:**
- Create: `src/lib/shift-suggestions.ts`, `src/lib/shift-suggestions.test.ts`, `src/app/api/shifts/suggestions/route.ts`, `src/app/api/shifts/suggestions/[id]/approve/route.ts`, `src/app/api/shifts/suggestions/[id]/dismiss/route.ts`

**Interfaces:**
- Consumes: Task 9 (`detectShiftPattern`, `buildObservedDays`, `proposeShift`, `SHIFT_DETECTION`); Task 7 (`previewShiftChange`, `applyShiftChange`).
- Produces:
  - `shouldRunDetection(lastRanAt: Date | null, now: Date, force: boolean): boolean` (true when forced, never run, or at least 6 hours ago)
  - `isSuppressed(dismissed: { dismissedUntil: string | null; medianIn: string } | null, newMedianIn: string, todayKey: string): boolean` (suppressed while `todayKey <= dismissedUntil` unless the median differs by 20 minutes or more)
  - `runDetection(opts?: { force?: boolean; now?: Date }): Promise<{ ran: boolean; pending: number }>` (updates `Policy.shiftDetectionRanAt`, creates the policy row if none; for each staff with a current shift builds observed days over the last 28 days skipping week-offs and holidays, detects, and creates or updates the single `PENDING` suggestion, never a duplicate; removes a pending suggestion whose pattern disappeared)
  - `listPendingSuggestions(): Promise<{ id: string; staffId: string; staffName: string; fromShiftName: string | null; medianIn: string; medianOut: string | null; daysObserved: number; daysWithinTolerance: number; lateDays: number; patternSince: string; direction: string; suggestedShiftId: string | null; suggestedStart: string; suggestedEnd: string }[]>`
  - `approveSuggestion(id: string, startDate: string, opts: { dryRun?: boolean; userId?: string }): Promise<PreviewSummary | { assignmentSaved: true; recalculated: boolean; summary: PreviewSummary; error?: string }>` (creates a `Shift` named `"${start}-${end}"` when `suggestedShiftId` is null; applies with source `SUGGESTION`; marks the suggestion `APPROVED` with `decidedByUserId` and `decidedAt`; a dry run changes nothing)
  - `dismissSuggestion(id: string, userId?: string): Promise<void>` (sets `DISMISSED` and `dismissedUntil` thirty days ahead)
  - Endpoints: `GET /api/shifts/suggestions?refresh=1` (runs detection when due, or when `refresh=1`, then lists pending); `POST .../[id]/approve` body `{ startDate: string; dryRun?: boolean }`; `POST .../[id]/dismiss`.

- [ ] **Step 1: Write the failing tests** (pure helpers directly; the rest with the fake Prisma): `shouldRunDetection` (never run, 5 hours ago, 6 hours ago, forced); `isSuppressed` (inside the window with the same median, inside the window with a 25-minute shift of median, after the window); a second `runDetection` within 6 hours does not run; `runDetection` twice with the same data leaves one `PENDING` row; approving with `dryRun: true` creates no shift and no assignment; approving a suggestion whose `suggestedShiftId` is null creates the shift first.

- [ ] **Step 2: Run to verify failure.** `npx vitest run src/lib/shift-suggestions.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the service and the three routes** (conventions in Global Constraints; `400` for a malformed `startDate`, `404` for an unknown or already-decided suggestion).

- [ ] **Step 4: Run gates and commit.** `npm test`, `npm run build`, then `git add src/lib/shift-suggestions.ts src/lib/shift-suggestions.test.ts src/app/api/shifts/suggestions src/test-utils/fake-prisma.ts` and `git commit -m "feat(shifts): throttled detection, suggestion storage and approve/dismiss endpoints"`

---

### Task 11: Shifts page suggestions, Dashboard line, delete guard, edit warning

**Files:**
- Modify: `src/app/shifts/page.tsx`, `src/app/api/shifts/route.ts`, `src/app/api/shifts/[id]/route.ts`, `src/lib/dashboard.ts`, `src/components/dashboard/AttentionList.tsx`
- Create: `src/app/api/shifts/route.delete.test.ts`

**Interfaces:**
- Consumes: Task 10 endpoints and `listPendingSuggestions`/`runDetection`.
- Produces: attention item kind `"shift-suggestions"` with `href: "/shifts"`.

- [ ] **Step 1: Write the failing test (review focus 2).** With the fake Prisma, `DELETE /api/shifts?id=...` for a shift referenced by a `ShiftAssignment` returns status `409` with an `error` containing "in use"; a shift with no references still deletes (`200`). Same for `DELETE /api/shifts/[id]`.
- [ ] **Step 2: Run to verify failure.** `npx vitest run src/app/api/shifts/route.delete.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the guard** in both delete handlers: count `shiftAssignment`, `shiftSuggestion` (as proposed shift) and `staff` rows that reference the shift; if any, return `409` with `"This shift is in use by N teachers or shift changes. Move them to another shift first."`.
- [ ] **Step 4: Shifts page.** Add a "Suggestions" section above the shift list: fetch `GET /api/shifts/suggestions` (refresh when the page opens); one `Card` per suggestion with text like "usually arrives about 10:00 (09:55 to 10:10), shift is 09:00 to 15:00, late on 17 of 20 days" built from the fields, the proposed shift, a "Starts on" date defaulting to `patternSince`, **Approve** (loads the dry-run summary, then confirms) and **Dismiss**, plus a "Check now" button (`refresh=1`) and an `EmptyState` when none. When editing the start or end time of a shift, show a notice that it changes every day that used the shift including past months and suggest creating a new shift instead.
- [ ] **Step 5: Dashboard line.** In `getDashboardData`, call `runDetection()` inside a try/catch (so a failure never breaks the page; it is throttled to once per 6 hours) and, if pending suggestions exist, add one attention item `"N shift suggestions to review"` of kind `"shift-suggestions"` (counted in the same maximum of items, and with the same priority as the other items, after missing OUT); update the `AttentionList` kind map for its icon and tone.
- [ ] **Step 6: Gates.** `npx eslint` on the changed files, `npm test`, `npm run build`.
- [ ] **Step 7: Commit.** `git add src/app/shifts src/app/api/shifts src/lib/dashboard.ts src/components/dashboard/AttentionList.tsx` then `git commit -m "feat(shifts): suggestions on the Shifts page and Dashboard, delete guard, edit warning"`

---

### Task 12: Final verification and documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README.** Add a "Shifts and shift history" section: how assignments and the "always" start date work, that nothing changes until the first shift change, that suggestions need approval, that editing a shift's own times still changes past days, and that deploy runs `prisma db push` for the three additive schema changes.
- [ ] **Step 2: Full gates.** `npm test`, `npm run lint 2>&1 | tail -1` (at most 80), `npm run build`.
- [ ] **Step 3: Writers check.** Re-run the grep from Task 7 step 6; expected output unchanged.
- [ ] **Step 4: Local manual check (controller, not committed).** With a temporary SQLite copy of the schema generated outside the repo's tracked files (as in the earlier redesign), seed two teachers and check: changing a shift from a past date shows a preview, saves history and leaves a locked month untouched; a future-dated change flips `Staff.shiftId` on its date; the Shifts page shows a seeded suggestion and Approve/Dismiss work; deleting a used shift shows the 409 message; the Dashboard line appears. Restore the generated Prisma client to PostgreSQL afterwards (`npx prisma generate`) and `git restore prisma/dev.db`.
- [ ] **Step 5: Commit.** `git add README.md` then `git commit -m "docs: shift history and suggestions"`
