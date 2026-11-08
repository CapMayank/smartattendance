# Employee Portal Redesign, ToSchool Calendar, Professional Payslips & Punch Regularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the single-page employee dashboard into a feature-rich multi-page self-service portal featuring the ToSchool monthly calendar & compliance index, professional salary statements with server-generated vector A4 PDFs, raw punch logs, and a full punch regularization request & admin approval engine.

**Architecture:** A dedicated multi-route employee interface (`/`, `/to-school`, `/punch-requests`, `/payslips`) built on Next.js App Router and Tailwind CSS, backed by a new Prisma `PunchRequest` model. Approvals trigger `AttendanceLog` creation and the existing `recalculateAttendance` pipeline. Direct vector PDF generation via `pdf-lib` powers instant salary slip downloads.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Prisma 6 (PostgreSQL), `pdf-lib`, Tailwind CSS v4, Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-08-employee-portal-redesign.md`

## Global Constraints
- Strictly adhere to Next.js App Router conventions and existing auth patterns (`requireRole`).
- Every employee API endpoint must scope queries by `session.user.staffId` to prevent cross-account data leakage.
- Approvers must only see and decide punch requests for staff in their assigned departments (`getApproverDepartmentIds`).
- Attendance calculations must reuse `@/lib/attendance` (`recalculateAttendance`) to preserve policy consistency.
- Locked payroll months (`MonthlyPayroll.isLocked = true`) must never be modified by punch regularization.
- All existing 583 tests must continue to pass throughout implementation.

## Review Focus
1. Duplicate punch accumulation on approval: Verify that approving a punch request does not create invalid consecutive duplicate punches or break punch pairing in `attendance-day.ts`.
2. Locked month protection: Submitting or approving a punch request for a date in a locked payroll month must fail cleanly with HTTP 400.
3. Department boundary enforcement: An `APPROVER` for Department A must receive HTTP 403 when attempting to approve a request for a staff member in Department B.
4. Elapsed days calculation in compliance index: The ToSchool compliance index must calculate percentages against working days elapsed up to the current date, rather than the entire future quarter.
5. PDF streaming headers: The `/api/payroll/[id]/pdf` route must serve valid binary PDF streams with `Content-Disposition: attachment; filename="Payslip_...pdf"` without failing on mobile clients.

---

### Task 1: Data Model for Punch Regularization & Fixtures

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/test-utils/fake-prisma.ts`
- Modify: `src/lib/schema.test.ts`

**Interfaces:**
- Produces: `PunchRequest` model in Prisma with fields `id`, `staffId`, `date`, `punchType`, `requestedTime`, `requestedInTime`, `requestedOutTime`, `reason`, `explanation`, `status`, `decidedByUserId`, `decidedAt`, `decisionRemarks`, `createdAt`, `updatedAt`.
- Reverse relation: `Staff.punchRequests`.

- [ ] **Step 1: Write the failing schema test**

In `src/lib/schema.test.ts`, add a test block for `PunchRequest`:
```ts
describe('PunchRequest model', () => {
  it('defines PunchRequest with required fields, relations, and defaults', () => {
    const model = getModel('PunchRequest')
    expect(model).toBeDefined()
    const fieldNames = model!.fields.map((f) => f.name)
    expect(fieldNames).toEqual(
      expect.arrayContaining([
        'id', 'staffId', 'date', 'punchType', 'requestedTime',
        'requestedInTime', 'requestedOutTime', 'reason', 'explanation',
        'status', 'decidedByUserId', 'decidedAt', 'decisionRemarks',
        'createdAt', 'updatedAt', 'staff'
      ])
    )
    const statusField = model!.fields.find((f) => f.name === 'status')
    expect(statusField?.default).toBe('PENDING')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/schema.test.ts`
Expected: FAIL (PunchRequest model not defined).

- [ ] **Step 3: Update `prisma/schema.prisma` & `fake-prisma.ts`**

Add `PunchRequest` model to `prisma/schema.prisma`:
```prisma
model PunchRequest {
  id              String    @id @default(cuid())
  staffId         String
  date            String    // YYYY-MM-DD (IST day key)
  punchType       String    // "IN" | "OUT" | "BOTH"
  requestedTime   String?   // e.g. "09:00" if single punch
  requestedInTime String?   // e.g. "09:00" if BOTH
  requestedOutTime String?  // e.g. "16:30" if BOTH
  reason          String    // FORGOT_SWIPE | DUTY_OUTSIDE | DEVICE_OFFLINE | POWER_FAILURE | OTHER
  explanation     String?
  status          String    @default("PENDING") // PENDING | APPROVED | REJECTED | CANCELLED
  decidedByUserId String?
  decidedAt       DateTime?
  decisionRemarks String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  staff Staff @relation(fields: [staffId], references: [id], onDelete: Restrict)

  @@index([staffId, status])
  @@index([date])
  @@index([status])
}
```
Add `punchRequests PunchRequest[]` to `model Staff`.
Run `npx prisma generate` to refresh the client.
Update `fake-prisma.ts` to include `punchRequests: PunchRequestRow[]` in `Fixtures` and implement mock CRUD for `prisma.punchRequest`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/lib/schema.test.ts src/test-utils/fake-prisma.ts
git commit -m "feat(schema): add PunchRequest model and update fixtures"
```

---

### Task 2: Punch Regularization API Endpoints & Recalculation Engine

**Files:**
- Create: `src/app/api/punch-requests/route.ts`
- Create: `src/app/api/punch-requests/[id]/route.ts`
- Create: `src/app/api/punch-requests/route.test.ts`
- Create: `src/lib/punch-request-service.ts`

**Interfaces:**
- `POST /api/punch-requests`: Creates punch request. Payload: `{ date, punchType, requestedTime?, requestedInTime?, requestedOutTime?, reason, explanation? }`.
- `GET /api/punch-requests`: Queries requests. Query params: `status`, `staffId`, `date`, `month`.
- `PATCH /api/punch-requests/[id]`: Action: `{ action: "APPROVE" | "REJECT" | "CANCEL", decisionRemarks? }`.

- [ ] **Step 1: Write the failing API route tests**

Create `src/app/api/punch-requests/route.test.ts`:
- Test 1: Employee can create a valid punch request for a missing punch.
- Test 2: Fails with 400 if date is in a locked payroll month (`MonthlyPayroll.isLocked = true`).
- Test 3: Fails with 400 if an active `PENDING` request already exists for that staff and date.
- Test 4: Employee can cancel their own `PENDING` request.
- Test 5: Approver can approve a request: inserts `AttendanceLog`, marks request `APPROVED`, writes `AuditLog`, and calls `recalculateAttendance`.
- Test 6: Approver cannot approve a request for a staff member outside their department (HTTP 403).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/punch-requests/route.test.ts`
Expected: FAIL (route handlers not found).

- [ ] **Step 3: Implement `punch-request-service.ts` and routes**

1. In `src/lib/punch-request-service.ts`:
   - `createPunchRequest(staffId, data)`: checks employment, locked payroll months, existing pending requests, and `PUNCH_REQUEST_MAX_DAYS` setting.
   - `approvePunchRequest(requestId, reviewerUserId)`: verifies department authority, inserts `AttendanceLog` with proper timestamp in IST, marks request `APPROVED`, writes `AuditLog`, and calls `recalculateAttendance(targetDate, targetDate)`.
   - `rejectPunchRequest(requestId, reviewerUserId, remarks)`: marks request `REJECTED`, records remarks, writes `AuditLog`.
   - `cancelPunchRequest(requestId, staffId)`: marks request `CANCELLED` if currently `PENDING`.
2. In `src/app/api/punch-requests/route.ts` and `src/app/api/punch-requests/[id]/route.ts`:
   - Implement `GET`, `POST`, and `PATCH` handlers using `requireRole`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/punch-requests/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/punch-request-service.ts src/app/api/punch-requests/
git commit -m "feat(api): implement punch request creation, approval, and cancellation"
```

---

### Task 3: Professional Payslip PDF Generator & API Endpoint

**Files:**
- Create: `src/lib/payslip-pdf.ts`
- Create: `src/lib/payslip-pdf.test.ts`
- Create: `src/app/api/payroll/[id]/pdf/route.ts`
- Create: `src/app/api/payroll/[id]/pdf/route.test.ts`

**Interfaces:**
- `generatePayslipPdf(payrollData: MonthlyPayrollWithDetails): Promise<Uint8Array>`
- `GET /api/payroll/[id]/pdf`: Streams downloadable PDF.

- [ ] **Step 1: Install `pdf-lib` dependency**

Run: `npm install pdf-lib`
Verify `package.json` updated with `pdf-lib`.

- [ ] **Step 2: Write the failing PDF generator and route tests**

Create `src/lib/payslip-pdf.test.ts`:
- Generates a PDF buffer and checks that output starts with `%PDF-`.
- Validates that text entries (employee code, basic wage, school name, net pay) are rendered without throwing.
Create `src/app/api/payroll/[id]/pdf/route.test.ts`:
- Employee can download their own payslip PDF (returns 200, `Content-Type: application/pdf`).
- Employee receives 403 when attempting to download another staff member's payslip PDF.
- Admin can download any payslip PDF.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/lib/payslip-pdf.test.ts src/app/api/payroll/[id]/pdf/route.test.ts`
Expected: FAIL (modules not implemented).

- [ ] **Step 4: Implement `src/lib/payslip-pdf.ts` and route handler**

1. Implement `generatePayslipPdf` in `src/lib/payslip-pdf.ts` using `pdf-lib`:
   - A4 dimensions (595.28 × 841.89 pt).
   - Letterhead banner with school crest/colors, title "SALARY SLIP", month & year.
   - Staff information table (Code, Machine ID, Name, Designation, Department, Date of Joining, Pay Group, UAN, PAN, Bank/IFSC).
   - Working days metrics (Total days, Paid days, NCP/LOP days, Bonus days).
   - Itemized two-column Earnings and Deductions table with borders.
   - Net salary callout banner with amount in numbers and Indian words (`amountInWords`).
   - Employer contributions summary.
   - Signature authorization boxes.
2. In `src/app/api/payroll/[id]/pdf/route.ts`:
   - Fetch `monthlyPayroll` with `staff`, `department`, `designation`, `payrollInfo`.
   - Validate access (`ADMIN` or owner `EMPLOYEE`).
   - Return `new NextResponse(pdfBuffer, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename=...' } })`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/payslip-pdf.test.ts src/app/api/payroll/[id]/pdf/route.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/payslip-pdf.ts src/lib/payslip-pdf.test.ts src/app/api/payroll/[id]/pdf/
git commit -m "feat(payroll): add high-fidelity vector PDF generation for salary slips"
```

---

### Task 4: Shell Navigation & Role Integration

**Files:**
- Modify: `src/components/shell/nav.ts`
- Modify: `src/components/shell/Sidebar.tsx`
- Modify: `src/components/shell/MobileNav.tsx`

**Interfaces:**
- `EMPLOYEE_NAV`: Updated to include `/`, `/to-school`, `/punch-requests`, `/payslips`, `/change-password`.
- `NAV`: Attendance group updated with `/punches/requests`.

- [ ] **Step 1: Write nav unit tests**

In `src/components/shell/nav.test.ts`:
- Verify `getNavForRole('EMPLOYEE')` returns all 5 employee routes.
- Verify `getNavForRole('ADMIN')` and `getNavForRole('APPROVER')` include `/punches/requests`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/shell/nav.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `nav.ts` and shell components**

Add items to `EMPLOYEE_NAV` and `NAV`. Ensure pending request badge can be displayed in sidebar when pending count > 0.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/shell/nav.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/
git commit -m "feat(nav): expand employee navigation and add punch requests link"
```

---

### Task 5: ToSchool Calendar & Compliance Index Page (`/to-school`)

**Files:**
- Create: `src/lib/to-school.ts`
- Create: `src/lib/to-school.test.ts`
- Create: `src/app/api/employee/to-school/route.ts`
- Create: `src/app/to-school/page.tsx`
- Create: `src/app/to-school/ToSchoolClient.tsx`
- Create: `src/components/calendar/AttendanceIndexSidebar.tsx`

**Interfaces:**
- `getToSchoolData(staffId: string, year: number, month: number)`: Returns daily cells, holiday overlays, and quarterly/monthly compliance metrics.
- `GET /api/employee/to-school`: Serves calendar and compliance JSON for logged-in employee.

- [ ] **Step 1: Write calculation tests for ToSchool calendar & index**

Create `src/lib/to-school.test.ts`:
- Tests day cell classification: Present, Half Day, Absent/No Show, Sunday off, School Holiday.
- Tests elapsed-working-days quarterly compliance score and monthly rings.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/to-school.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/to-school.ts` and API route**

1. In `src/lib/to-school.ts`:
   - Compute month days, pull `DailyRecord`, `AttendanceLog`, and `Holiday`.
   - Calculate quarterly compliance (FY Q1: Apr-Jun, Q2: Jul-Sep, Q3: Oct-Dec, Q4: Jan-Mar) based on elapsed days.
   - Calculate monthly achievement percentages.
2. In `src/app/api/employee/to-school/route.ts`:
   - Verify `session.user.staffId`, call `getToSchoolData`, return JSON.
3. In `src/app/to-school/ToSchoolClient.tsx` & `AttendanceIndexSidebar.tsx`:
   - Render Month navigation and 7-day grid (Mon–Sun).
   - Render day cards with duration brackets (`7-9 Hrs`, `5-7 Hrs`, `0-3 Hrs`), In/Out times, and bold "No Show" alert styling with `+ Request Punch` link.
   - Render right-side compliance index sidebar with radial progress rings and FY quarter bars.
   - Modal for submitting a punch request prefilled with selected date.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/to-school.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/to-school.ts src/lib/to-school.test.ts src/app/api/employee/to-school/ src/app/to-school/ src/components/calendar/
git commit -m "feat(to-school): implement ToSchool monthly calendar and attendance index"
```

---

### Task 6: My Punches & Missed Punch Requests Page (`/punch-requests`)

**Files:**
- Create: `src/app/api/employee/punches/route.ts`
- Create: `src/app/punch-requests/page.tsx`
- Create: `src/app/punch-requests/PunchRequestsClient.tsx`
- Create: `src/components/punches/RequestPunchModal.tsx`

**Interfaces:**
- `GET /api/employee/punches`: Returns employee's raw swipe logs with date range filtering.
- Client component handles switching between Punch History and My Requests tabs.

- [ ] **Step 1: Write API test for employee punches route**

In `src/app/api/employee/punches/route.test.ts`:
- Verifies employee only receives their own biometric punches.
- Verifies date range filtering (`from`, `to`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/employee/punches/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement employee punches API and frontend interface**

1. Implement `src/app/api/employee/punches/route.ts`.
2. Implement `PunchRequestsClient.tsx`:
   - Tab 1: Raw punch timeline with date filter.
   - Tab 2: Requests tracker showing status badges (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`), approver notes, and self-cancellation button.
3. Implement `RequestPunchModal.tsx`:
   - Form with Date, Punch type, Time, Reason dropdown, and narrative justification.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/employee/punches/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/employee/punches/ src/app/punch-requests/ src/components/punches/
git commit -m "feat(employee): add punch history view and regularization request interface"
```

---

### Task 7: My Payslips Page & High-Fidelity Salary Slip Viewer (`/payslips`)

**Files:**
- Create: `src/app/payslips/page.tsx`
- Create: `src/app/payslips/MyPayslipsClient.tsx`
- Modify: `src/components/dashboard/EmployeeMyDashboard.tsx`

**Interfaces:**
- `/payslips`: Lists all payslips with instant "Download PDF" button and full modal viewer.
- Updated `EmployeeMyDashboard.tsx`: Replaces old basic modal with high-fidelity viewer and PDF download.

- [ ] **Step 1: Implement `src/app/payslips/page.tsx` & `MyPayslipsClient.tsx`**

- Render list of monthly payslips with month, pay group, paid days, net pay, and direct PDF download button (`/api/payroll/[id]/pdf`).
- Modal viewer showing institutional letterhead, two-column earnings/deductions breakdown, and signoff blocks.
- Update `EmployeeMyDashboard.tsx` to link to `/payslips` and use the direct PDF download action.

- [ ] **Step 2: Verify page and links build cleanly**

Run: `npx eslint src/app/payslips/ src/components/dashboard/EmployeeMyDashboard.tsx`
Expected: Clean linting.

- [ ] **Step 3: Commit**

```bash
git add src/app/payslips/ src/components/dashboard/EmployeeMyDashboard.tsx
git commit -m "feat(payslips): add dedicated payslips page and direct PDF downloads"
```

---

### Task 8: Admin & Approver Punch Requests Review Inbox (`/punches/requests`)

**Files:**
- Create: `src/app/punches/requests/page.tsx`
- Create: `src/app/punches/requests/PunchRequestsAdminClient.tsx`
- Modify: `src/app/settings/page.tsx` (Add `PUNCH_REQUEST_MAX_DAYS` setting control)

**Interfaces:**
- `/punches/requests`: Review inbox for Admins and Approvers.
- Displays request details, reason, existing swipes context, and Approve/Reject controls.

- [ ] **Step 1: Write integration tests for Admin requests inbox**

In `src/app/punches/requests/admin.test.ts`:
- Department approver only sees requests from their assigned departments.
- Approving request immediately updates attendance log and recalculates day.
- Admin setting for submission window updates cleanly.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/punches/requests/admin.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `PunchRequestsAdminClient.tsx` and settings toggle**

1. Build `PunchRequestsAdminClient.tsx` with:
   - Filter chips: `Pending`, `Approved`, `Rejected`, `All`.
   - Department selector for admins.
   - Cards showing employee avatar, code, requested time, reason, and existing punches on that day.
   - Approve action with confirmation and Reject action with reason dialog.
   - Setting card to configure `PUNCH_REQUEST_MAX_DAYS` (0 for Unlimited, or 3, 7, 14 days).
2. Wire page into `/punches/requests`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/punches/requests/admin.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/punches/requests/ src/app/settings/page.tsx
git commit -m "feat(admin): implement punch requests review inbox and cutoff configuration"
```

---

### Task 9: Full Integration Verification & Regression Suite

**Files:**
- Create: `src/test/punch-regularization-e2e.test.ts`

- [ ] **Step 1: Write comprehensive end-to-end flow test**

Test Scenario:
1. Staff member has a missed check-out on 2026-11-02.
2. Employee submits punch request for missing `OUT` punch at 16:30.
3. Department Approver reviews request, sees existing `IN` punch at 09:00, and clicks Approve.
4. Verify `AttendanceLog` is created.
5. Verify `DailyRecord` is recalculated to `PRESENT` with correct work minutes.
6. Verify PDF download endpoint returns valid PDF with net pay.

- [ ] **Step 2: Run all tests across the repository**

Run: `npm test`
Expected: ALL test files pass (56+ files, 600+ tests).

- [ ] **Step 3: Run production build check**

Run: `npm run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/test/
git commit -m "test(e2e): add punch regularization end-to-end integration test"
```
