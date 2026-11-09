# Staff Unified Flow, Profile Model View, & Lifecycle Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify teacher/staff management by building a comprehensive profile modal, dedicated onboarding & rejoining flow with history preservation, safely confined deletion, active-only default directory, full staff lifecycle reports, and clean navigation grouping.

**Architecture:** 
- Restructure sidebar navigation into 6 cohesive domains (`Overview`, `Staff`, `Attendance`, `Payroll`, `Reports`, `System`).
- Extend `Staff` APIs to support reading, writing, and reactivating personal KYC, EPFO, and biometric machine IDs.
- Create modular modals (`StaffOnboardModal`, `StaffBulkImportModal`, `StaffProfileModal`) on `/staff`, removing bloated static cards and row-level delete buttons.
- Create a dedicated `/reports/staff` page backed by `GET /api/reports/staff` for roster, exits, yearwise joinings, and department headcount analytics with CSV exports.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Prisma ORM, Vitest, Lucide React, PapaParse.

**Spec:** `docs/superpowers/specs/2026-11-09-staff-unified-flow-reports-design.md`

## Global Constraints
- Do not edit or calculate monthly CTC in the staff profile view; salary computation stays in `/payroll/staff`.
- Deleting staff with existing `attendanceLogs` or `monthlyPayrolls` must be strictly blocked by the backend and disabled in the UI.
- Former staff rejoining must preserve all historical attendance logs, payrolls, and past `employmentPeriods`, issuing a fresh temporary password and a new open `employmentPeriod`.
- Approver role must not have access to `/staff` or `/reports/staff`.

## Review Focus
- **Rejoin with reassigned machine ID**: When rejoining, the administrator can assign a new machine ID if the old physical ID slot was reallocated.
- **Rejoin date strictly after last exit date**: The lifecycle API must reject a rejoining date that is on or before the last working day.
- **Directory default view**: When opening `/staff`, only active members render by default; exited members appear only when selecting the "Exited" chip or navigating from Reports.
- **Danger Zone deletion guard**: Staff with even 1 attendance punch or payroll log cannot be deleted under any circumstances; the delete button in the modal is visibly disabled with an explanation.
- **Clean Navigation**: The sidebar correctly renders all 6 groups without duplication, and active route highlighting works accurately.

---

### Task 1: Navigation Hierarchy Reorganization

**Files:**
- Modify: `src/components/shell/nav.ts`
- Test: `src/components/shell/nav.test.ts`

**Interfaces:**
- Produces: `NAV` with 6 groups: `Overview`, `Staff`, `Attendance`, `Payroll`, `Reports`, `System`.
- `APPROVER_HIDDEN_HREFS` updated to include `/reports/staff` in addition to `/staff`, `/attendance/manual`, and `/punches/unmatched`.

- [ ] **Step 1: Write the failing test**
Update `src/components/shell/nav.test.ts` to assert the 6 navigation groups and check that `/reports/staff` is under `Reports` and hidden from Approvers.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/shell/nav.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `nav.ts`**
Reorganize `NAV` array into 6 groups:
1. `Overview`: `Dashboard` (`/`)
2. `Staff`: `Staff Directory` (`/staff`), `Departments` (`/departments`), `Designations` (`/designations`)
3. `Attendance`: `Calendar` (`/calendar`), `Shifts` (`/shifts`), `Punch requests` (`/punches/requests`), `Manual punch` (`/attendance/manual`), `Unmatched punches` (`/punches/unmatched`)
4. `Payroll`: `Monthly payroll` (`/payroll/monthly`), `Salary setup` (`/payroll/staff`)
5. `Reports`: `Staff & Headcount` (`/reports/staff`), `Attendance reports` (`/reports`), `Member attendance` (`/reports/member-attendance`), `Member payroll` (`/reports/member-payroll`), `Payroll analytics` (`/reports/payroll-analytics`)
6. `System`: `Devices` (`/devices`), `Settings` (`/settings`), `Audit logs` (`/audit-logs`)
Update `APPROVER_HIDDEN_HREFS` to include `/reports/staff`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/shell/nav.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/components/shell/nav.ts src/components/shell/nav.test.ts
git commit -m "feat(nav): reorganize navigation into 6 cohesive domains"
```

---

### Task 2: Staff KYC & Rejoin Machine ID API Extensions

**Files:**
- Modify: `src/app/api/staff/route.ts`
- Modify: `src/app/api/staff/[id]/lifecycle/route.ts`
- Test: `src/app/api/staff/route.create.test.ts`
- Test: `src/app/api/staff/[id]/lifecycle/route.test.ts`

**Interfaces:**
- `GET /api/staff`: includes `payrollInfo` with `mobileNumber`, `dob`, `gender`, `fatherHusbandName`, `relationship`, `qualification`, `nationality`, `bankAccount`, `ifsc`, `nameAsPerBank`, `pan`, `aadhaar`, `uan`.
- `POST /api/staff` and `PUT /api/staff`: accepts these KYC fields and upserts `StaffPayrollInfo`.
- `POST /api/staff/[id]/lifecycle`: REJOIN action accepts optional `machineId`, validates uniqueness against other staff, and updates `staff.machineId`.

- [ ] **Step 1: Write failing tests**
- In `src/app/api/staff/route.create.test.ts`: test creating and updating staff with KYC fields (`mobileNumber`, `fatherHusbandName`, `bankAccount`, etc.).
- In `src/app/api/staff/[id]/lifecycle/route.test.ts`: test rejoining with a reassigned `machineId`.

- [ ] **Step 2: Run tests to verify they fail**
Run: `npx vitest run src/app/api/staff/route.create.test.ts src/app/api/staff/[id]/lifecycle/route.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement API changes**
- In `src/app/api/staff/route.ts`:
  - Extend `GET` `payrollInfo` select to include KYC and statutory fields.
  - In `POST` and `PUT`, extract KYC fields and upsert into `StaffPayrollInfo`. Mirror `email` to `User.email` if provided.
- In `src/app/api/staff/[id]/lifecycle/route.ts`:
  - In `REJOIN`, accept `machineId`. If provided and different from current, verify no collision with other staff, then update `staff.machineId`.

- [ ] **Step 4: Run tests to verify they pass**
Run: `npx vitest run src/app/api/staff/route.create.test.ts src/app/api/staff/[id]/lifecycle/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/app/api/staff/route.ts src/app/api/staff/[id]/lifecycle/route.ts src/app/api/staff/route.create.test.ts src/app/api/staff/[id]/lifecycle/route.test.ts
git commit -m "feat(api): support staff KYC attributes and machineId re-assignment on rejoin"
```

---

### Task 3: Staff Lifecycle & Headcount Reports API

**Files:**
- Create: `src/app/api/reports/staff/route.ts`
- Test: `src/app/api/reports/staff/route.test.ts`

**Interfaces:**
- `GET /api/reports/staff`:
  - Returns `{ members: StaffReportMember[], exits: StaffReportExit[], joinings: StaffReportJoining[], departments: StaffReportDept[] }`
  - Requires `ADMIN` role.

- [ ] **Step 1: Write failing test**
Create `src/app/api/reports/staff/route.test.ts` verifying authentication guard (rejects `APPROVER` or unauthenticated) and checking returned payload structure for members, exits, yearwise joinings, and department headcount.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/app/api/reports/staff/route.test.ts`
Expected: FAIL (route does not exist)

- [ ] **Step 3: Implement `src/app/api/reports/staff/route.ts`**
Query `prisma.staff.findMany` with `department`, `designation`, `shift`, `user`, `payrollInfo`, and `employmentPeriods`.
Compute:
1. `members`: List of all staff with status (`ACTIVE`, `EXITED`, `NEEDS_JOINING_DATE`), contact info, department, designation, pay group.
2. `exits`: All completed employment periods (`endDate !== null`) with duration days, exit reason, notes, staff details.
3. `joinings`: All employment periods mapped to joining year, start date, tenure index, and current staff status.
4. `departments`: Headcount per department, active count, share percentage, and breakdown by designation.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/app/api/reports/staff/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/app/api/reports/staff/route.ts src/app/api/reports/staff/route.test.ts
git commit -m "feat(api): implement staff lifecycle and headcount reports endpoint"
```

---

### Task 4: Modular Staff Modals (`StaffOnboardModal`, `StaffBulkImportModal`, `StaffProfileModal`)

**Files:**
- Create: `src/components/staff/StaffOnboardModal.tsx`
- Create: `src/components/staff/StaffBulkImportModal.tsx`
- Create: `src/components/staff/StaffProfileModal.tsx`

**Interfaces:**
- `StaffOnboardModal`:
  - Props: `open: boolean`, `onClose: () => void`, `onSuccess: (creds?: IssuedCredential) => void`, `exitedStaffList: Staff[]`, `depts: Department[]`, `desigs: Designation[]`, `shifts: Shift[]`, `initialRejoinStaffId?: string | null`
  - Allows selecting "Returning Member" vs "New Staff Member". In Returning mode, selects exited member, prefills data, enables editable machineId, and calls `REJOIN`. In New mode, captures basic, role/shift, and personal KYC data.
- `StaffBulkImportModal`:
  - Props: `open: boolean`, `onClose: () => void`, `onSuccess: (creds?: IssuedCredential[]) => void`
  - Handles CSV parsing and upload with template download.
- `StaffProfileModal`:
  - Props: `staff: Staff | null`, `open: boolean`, `onClose: () => void`, `onSaved: () => void`, `onDeleted: () => void`, `depts: Department[]`, `desigs: Designation[]`, `shifts: Shift[]`
  - 4 tabs: `Overview & Access`, `Personal & KYC`, `Employment & Shift`, `Banking & Statutory`.
  - Danger Zone at bottom of Overview: "Delete Mistake Entry" button, strictly disabled if attendance or payroll records exist, requiring confirmation dialog.

- [ ] **Step 1: Build `StaffOnboardModal.tsx`**
Implement the component with the "Has this person worked here before?" toggle, exited staff search, and clean inputs.

- [ ] **Step 2: Build `StaffBulkImportModal.tsx`**
Implement the modal with file dropzone/upload, template download, and status messages.

- [ ] **Step 3: Build `StaffProfileModal.tsx`**
Implement the 4-tab model. Include photo display/removal, portal role and approver scopes, KYC inputs (DOB, mobile, gender, father/husband, qualification), shift change preview, statutory details (bank, IFSC, PAN, Aadhaar, UAN), and Danger Zone deletion.

- [ ] **Step 4: Commit**
```bash
git add src/components/staff/StaffOnboardModal.tsx src/components/staff/StaffBulkImportModal.tsx src/components/staff/StaffProfileModal.tsx
git commit -m "feat(staff): create modular staff onboard, bulk import, and profile modals"
```

---

### Task 5: Staff Directory Page Refactor (`/staff`)

**Files:**
- Modify: `src/app/staff/page.tsx`

**Interfaces:**
- Top actions: `Onboard Staff`, `Import CSV`, `Download Template`.
- Table columns: Staff member, Employee ID & Machine, Access & Status, Department / Role, Pay group & Shift, Actions.
- Actions: `KeyRound` (reset temporary password), `Calendar` (view attendance), `Pencil` (opens `StaffProfileModal`). Row Trash icon is removed!
- Default filter: `active`.
- Query param `?rejoin=<id>` triggers Onboard modal in Rejoin mode automatically.

- [ ] **Step 1: Refactor `src/app/staff/page.tsx`**
- Remove static embedded onboarding and CSV cards from above the table.
- Add PageHeader action buttons: `Onboard Staff`, `Import CSV`, `Download Template`.
- Replace inline edit modal and form states with `StaffOnboardModal`, `StaffBulkImportModal`, and `StaffProfileModal`.
- Remove table row `Trash2` button.
- Default `filterMode` to `'active'`.
- Wire `useSearchParams` to detect `?rejoin=<id>` and open the Onboard modal in Rejoin mode.

- [ ] **Step 2: Verify in browser / Vitest**
Run: `npx vitest run src/app/api/staff`
Expected: PASS

- [ ] **Step 3: Commit**
```bash
git add src/app/staff/page.tsx
git commit -m "feat(staff): modernize staff directory with active default, modular modals, and safe delete"
```

---

### Task 6: Staff & Headcount Reports Page (`/reports/staff`)

**Files:**
- Create: `src/app/reports/staff/page.tsx`

**Interfaces:**
- 4 Tabs:
  1. `All Members`: Complete searchable list with department and pay group breakdown.
  2. `Exited Members`: List of leavers with tenure, reason, and a "Reactivate" button linking to `/staff?rejoin=${staff.id}`.
  3. `Joinings by Year`: Year dropdown selector (2026, 2025, 2024, All), recruitment count, and retention rate KPI.
  4. `Department Distribution`: Distribution bar / cards with headcount and percentage of total active staff.
- CSV export for each active tab.

- [ ] **Step 1: Implement `src/app/reports/staff/page.tsx`**
Fetch data from `/api/reports/staff`. Implement tab switching, KPI cards, tables, search, year filtering, and PapaParse CSV export.

- [ ] **Step 2: Verify build and compile**
Run: `npx vitest run` and verify no TypeScript or lint regressions.

- [ ] **Step 3: Commit**
```bash
git add src/app/reports/staff/page.tsx
git commit -m "feat(reports): build staff & headcount reports page with tenure and annual recruitment"
```

---

### Task 7: Full System Verification

**Files:**
- None (verification task)

- [ ] **Step 1: Run full test suite**
Run: `npm test`
Expected: 100% pass across all test suites.

- [ ] **Step 2: Run Next.js production build**
Run: `npm run build`
Expected: Successful build with no route errors or type errors.

- [ ] **Step 3: Commit any final polish**
```bash
git status
```
