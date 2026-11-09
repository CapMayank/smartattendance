# Punch Regularization & ToSchool Flow Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify `/to-school` and `/punch-requests` into an integrated attendance reconciliation flow that highlights missing terminal punches, enables 1-click regularization with prefilled punch types, and updates reason terminology for facial recognition terminals.

**Architecture:** 
1. Generalize reason categories from swipe/card references to terminal and facial recognition language across all client components while preserving existing database enum codes.
2. Upgrade `RequestPunchModal` to accept `prefillPunchType` and `prefillTime` so contextual actions can immediately configure the modal.
3. Enhance `/to-school` calendar cells to render contextual buttons (`+ Request Out Punch`, `+ Request In Punch`) on half days with missing punches, and surface a discrepancy summary banner with a direct link to the regularization hub.
4. Redesign `/punch-requests` around monthly reconciliation: add month navigation synced with ToSchool, an "Action Needed" discrepancies dashboard, a daily attendance ledger, and keep raw logs in a dedicated audit tab.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide icons, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-09-punch-requests-toschool-integration-design.md`

## Global Constraints
- Retain existing Prisma enum codes: `FORGOT_SWIPE`, `DUTY_OUTSIDE`, `DEVICE_OFFLINE`, `POWER_FAILURE`, `OTHER` in all API requests and DB transactions.
- Keep responsive design down to mobile breakpoints (`sm:`, `md:`).
- All tests must pass: `npx vitest run` and `npm run build` must succeed with 0 errors.

## Review Focus
- A day with check-in at 09:15 AM but no check-out must offer a direct "Request Out Punch" action on both `/to-school` and `/punch-requests` prefilled with `punchType: "OUT"` and default time `16:30`.
- A day with no punches (`isNoShow`) must offer "Request Punch" prefilled with `punchType: "BOTH"`.
- A day that already has a pending regularization request (`hasPendingRequest: true`) must show "Request Pending" rather than a duplicate request button.
- Month selector on `/punch-requests` must read initial month/year from query params (`?month=11&year=2026`) when navigated from `/to-school`.
- Existing admin review inbox in `/punches/requests` must continue to render correctly with the generalized reason strings.

---

### Task 1: Generalize Reason Strings Across UI & Align Existing Tests

**Files:**
- Modify: `src/components/punches/RequestPunchModal.tsx:11-17`
- Modify: `src/app/to-school/ToSchoolClient.tsx:21-27,440-443`
- Modify: `src/app/punch-requests/PunchRequestsClient.tsx:56-62`
- Modify: `src/app/punches/requests/PunchRequestsAdminClient.tsx:70-76`
- Modify: `src/components/calendar/AttendanceIndexSidebar.tsx:135-140`
- Modify: `src/app/punches/requests/page.test.tsx:273`

**Interfaces:**
- Produces: Generalized human-readable labels for `FORGOT_SWIPE`, `DUTY_OUTSIDE`, `DEVICE_OFFLINE`, `POWER_FAILURE`, `OTHER`.
- Consumes: Prisma enum `PunchRequest.reason`.

- [ ] **Step 1: Write test assertion for generalized reason label in `src/app/punches/requests/page.test.tsx`**
  Update line 273 from `expect(html).toContain("Forgot to swipe card");` to `expect(html).toContain("Forgot to mark attendance / Missed terminal check");`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/app/punches/requests/page.test.tsx`
  Expected: FAIL asserting that the rendered HTML contains the new generalized label.

- [ ] **Step 3: Update reason dictionaries and copy across components**
  Update `PUNCH_REASONS` in `RequestPunchModal.tsx`, `REASONS` in `ToSchoolClient.tsx`, `REASON_MAP` in `PunchRequestsClient.tsx`, and `REASON_LABELS` in `PunchRequestsAdminClient.tsx` to:
  - `FORGOT_SWIPE`: "Forgot to mark attendance / Missed terminal check"
  - `DUTY_OUTSIDE`: "Official on-duty assignment / Off-campus school duty"
  - `DEVICE_OFFLINE`: "Attendance terminal offline / Recognition error"
  - `POWER_FAILURE`: "Campus power outage / Terminal unavailable"
  - `OTHER`: "Other reason (specify details below)"
  In `AttendanceIndexSidebar.tsx`, update "Missed swipes must be regularized within..." to "Missed punches must be regularized within...".

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/app/punches/requests/page.test.tsx`
  Expected: PASS

---

### Task 2: Enhance `RequestPunchModal` with Prefill Props

**Files:**
- Modify: `src/components/punches/RequestPunchModal.tsx:19-62`
- Create: `src/components/punches/RequestPunchModal.test.tsx`

**Interfaces:**
- Produces: Extended `RequestPunchModalProps` with `prefillPunchType?: PunchType` and `prefillTime?: string`.
- Consumes: `open`, `prefillDate`, `prefillPunchType`, `prefillTime`.

- [ ] **Step 1: Write tests for `RequestPunchModal` prefilling**
  Create `src/components/punches/RequestPunchModal.test.tsx` with tests verifying:
  - Renders modal when open=true.
  - Defaults to `punchType="BOTH"` when no prefill is provided.
  - Automatically selects `punchType="OUT"` and sets requested time when `prefillPunchType="OUT"` is provided.
  - Automatically selects `punchType="IN"` and sets requested time when `prefillPunchType="IN"` is provided.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/components/punches/RequestPunchModal.test.tsx`
  Expected: FAIL (types / behavior not yet matching).

- [ ] **Step 3: Implement prefill handling in `RequestPunchModal.tsx`**
  Add `prefillPunchType?: PunchType;` and `prefillTime?: string;` to `RequestPunchModalProps`. In `useEffect([open, prefillDate, prefillPunchType, prefillTime])`, populate:
  - `punchType`: `prefillPunchType || "BOTH"`
  - `requestedTime`: `prefillTime || (prefillPunchType === "OUT" ? "16:30" : "09:00")`
  - `requestedInTime`: `prefillPunchType === "IN" && prefillTime ? prefillTime : "09:00"`
  - `requestedOutTime`: `prefillPunchType === "OUT" && prefillTime ? prefillTime : "16:30"`

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/components/punches/RequestPunchModal.test.tsx`
  Expected: PASS

---

### Task 3: Upgrade `/to-school` Calendar with Contextual Missing-Punch Actions & Discrepancy Banner

**Files:**
- Modify: `src/app/to-school/ToSchoolClient.tsx`
- Create: `src/app/to-school/ToSchoolClient.test.tsx`

**Interfaces:**
- Produces: Discrepancy banner linking to `/punch-requests`, contextual action buttons on half-day cells (`+ Request Out Punch` / `+ Request In Punch`), and header link to Regularization Center.
- Consumes: `ToSchoolDay` status, `checkIn`, `checkOut`, `isNoShow`, `hasPendingRequest`.

- [ ] **Step 1: Write tests for `/to-school` calendar interactions**
  Create `src/app/to-school/ToSchoolClient.test.tsx` testing:
  - Displays discrepancy alert banner when days have missing check-in/out or no-shows.
  - Calendar cell with `checkIn="09:15"` and `checkOut=null` renders a button to request out punch.
  - Calendar cell with `checkIn=null` and `checkOut="16:30"` renders a button to request in punch.
  - Clicking "Request Out Punch" opens modal with `OUT` pre-selected and date prefilled.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/app/to-school/ToSchoolClient.test.tsx`
  Expected: FAIL

- [ ] **Step 3: Implement calendar upgrades in `ToSchoolClient.tsx`**
  - Compute `discrepancyCount`: count of working days where `(!day.checkOut && day.checkIn) || (!day.checkIn && day.checkOut) || (day.isNoShow && !day.isToday)` and `!day.hasPendingRequest`.
  - Add discrepancy alert banner below header if `discrepancyCount > 0`:
    "You have {discrepancyCount} attendance discrepancies needing regularization this month. [Review in Regularization Center →]"
  - In calendar header, add "Regularization Center" button linking to `/punch-requests?month=${selectedMonth}&year=${selectedYear}`.
  - In calendar cell bottom section:
    - If `day.status === "HALF_DAY"`:
      - If `day.checkIn && !day.checkOut`: render In time, Out missing indicator, and button `+ Request Out Punch`.
      - If `!day.checkIn && day.checkOut`: render In missing indicator, Out time, and button `+ Request In Punch`.
    - If `day.isNoShow`: render button `+ Request Punch`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/app/to-school/ToSchoolClient.test.tsx`
  Expected: PASS

---

### Task 4: Redesign `/punch-requests` into an Integrated Reconciliation Hub

**Files:**
- Modify: `src/app/punch-requests/PunchRequestsClient.tsx`
- Create: `src/app/punch-requests/PunchRequestsClient.test.tsx`

**Interfaces:**
- Produces: Integrated monthly reconciliation view with "Action Needed" discrepancies tab, daily ledger tab, my requests tab, and raw logs tab.
- Consumes: `/api/employee/to-school?month=&year=`, `/api/punch-requests`, `/api/employee/punches`.

- [ ] **Step 1: Write tests for `PunchRequestsClient`**
  Create `src/app/punch-requests/PunchRequestsClient.test.tsx` testing:
  - Reads initial month/year from query parameters or defaults to current month.
  - "Action Needed" tab displays list of discrepancies (dates with missing check-out, missing check-in, or no-shows).
  - Clicking "Regularize" on a discrepancy card opens `RequestPunchModal` with matching date and punch type.
  - Daily reconciliation ledger displays each day's shift, actual In/Out, duration, and status.
  - Navigation button links back to `/to-school?month=&year=`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/app/punch-requests/PunchRequestsClient.test.tsx`
  Expected: FAIL

- [ ] **Step 3: Implement `PunchRequestsClient.tsx` upgrades**
  - Parse `month` and `year` from URL query parameters (or default to current month).
  - Add Month Selector controls in the header (`< Month YYYY >`) and link `← Back to Monthly Calendar (/to-school?month=...&year=...)`.
  - Fetch `/api/employee/to-school?month=...&year=...` when month changes.
  - Tab 1: **"Action Needed"** (`id: "action-needed"`):
    - Lists all discrepancies (missing out punch, missing in punch, no-shows) with clear explanation of impact (e.g. "Marked as Half Day because check-out was not registered at terminal").
    - Action button `Regularize Out Punch`, `Regularize In Punch`, or `Regularize Day`.
    - Empty state when 0 discrepancies: "All attendance records for this month are reconciled and complete."
  - Tab 2: **"Daily Reconciliation"** (`id: "daily-reconciliation"`):
    - Ledger table showing Date, Day, Scheduled Status, Check-In, Check-Out, Duration, and Quick Action.
  - Tab 3: **"My Requests"** (`id: "requests"`):
    - Submitted requests, pending approval status, cancellation action.
  - Tab 4: **"Device Punch Logs"** (`id: "raw-logs"`):
    - Retains original raw terminal punch log table with date filters.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/app/punch-requests/PunchRequestsClient.test.tsx`
  Expected: PASS

---

### Task 5: Full Regression Testing & Next.js Build Verification

**Files:**
- Verify: Full test suite and Next.js production build

- [ ] **Step 1: Run complete test suite**
  Run: `npx vitest run`
  Expected: All tests pass.

- [ ] **Step 2: Run Next.js build**
  Run: `npm run build`
  Expected: Compiled successfully with zero type or route errors.
