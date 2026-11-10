# Employee EPFO & KYC Self-Service and Approval Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable employees to view all EPFO/statutory details, receive mandatory KYC completion alerts on their dashboard, submit change requests for missing or updated fields, and allow administrators/approvers to review, compare diffs, and approve them into `StaffPayrollInfo`.

**Architecture:** Extend `/api/employee/profile` to expose statutory fields and an action-scoped EPFO readiness check; enhance `/api/employee/profile-requests` with EPFO field sanitization and validation; update `/api/admin/profile-requests/[id]/decide` to persist approved fields to `StaffPayrollInfo`; show a prominent mandatory completion banner on `EmployeeMyDashboard`; expand `RequestProfileEditModal` with EPFO statutory fields; and map friendly labels in `ProfileRequestsTab`.

**Tech Stack:** Next.js App Router, TypeScript, Prisma 6, Lucide React, Tailwind CSS, `@/components/ui`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-employee-epfo-kyc-requests-design.md`

## Global Constraints

- Never allow direct client updates to `StaffPayrollInfo` from employee sessions; all changes must pass through `ProfileChangeRequest` approval.
- Aadhaar must be validated as 12 digits not starting with 0 or 1 (`^[2-9]\d{11}$`).
- IFSC code must have 11 characters with digit `'0'` at the 5th position (`^[A-Z]{4}0[A-Z0-9]{6}$`).
- Relationship is strictly restricted to `Father` (`F`) or `Husband` (`H`).
- Names entered for docs are stripped of honorific titles (`Mr`, `Dr`, etc.) and delimited characters (`#`, `~`, `\r`, `\n`) using `sanitizeEpfoName`.
- UI must use Lucide React icons, existing `@/components/ui` components (`Card`, `Button`, `Field`, `Input`, `Select`, `Modal`), and tone tokens (`tone-absent`, `tone-accent`, `tone-present`).

## Review Focus

1. **Aadhaar leading-digit rule:** An employee entering an Aadhaar number starting with `0` or `1` must be rejected with an immediate, clear validation error.
2. **IFSC 5th character rule:** An IFSC containing the letter `'O'` instead of the digit `'0'` at index 4 must fail validation.
3. **Pending request idempotency:** If an employee already has an active `PENDING` request, the dashboard displays a "Pending admin review" state and prevents duplicate conflicting submissions.
4. **Comprehensive approval persistence:** When an admin approves a request containing any of the 14 EPFO fields (e.g. `maritalStatus`, `nameOnAadhaar`, `isInternationalWorker`), all values are correctly persisted to `StaffPayrollInfo`.
5. **No alert for `CASH` payroll staff:** Staff members on `CASH` pay group with no EPF history should never receive the mandatory EPF KYC alert banner.

---

### Task 1: API Enhancements (Profile Read, Request Creation & Admin Approval)

**Files:**
- Modify: `src/app/api/employee/profile/route.ts`
- Modify: `src/app/api/employee/profile-requests/route.ts`
- Modify: `src/app/api/admin/profile-requests/[id]/decide/route.ts`
- Test: `src/app/api/employee/profile-requests/route.test.ts`
- Test: `src/app/api/admin/profile-requests/route.test.ts`

**Interfaces:**
- `GET /api/employee/profile` returns:
  ```typescript
  profile: {
    // existing fields...
    maritalStatus: string;
    relationship: string;
    nationality: string;
    qualification: string;
    nameOnAadhaar: string;
    nameOnPan: string;
    nameOnUan: string;
    previousMemberId: string;
    isInternationalWorker: string;
    countryOfOrigin: string;
    passportNumber: string;
    passportValidFrom: string;
    passportValidTill: string;
    isPhysicalHandicap: string;
    locomotive: string;
    hearing: string;
    visual: string;
    epfoReadiness: {
      isBankEpf: boolean;
      ready: boolean;
      missingFields: string[];
      hasPendingRequest: boolean;
    };
  }
  ```
- `POST /api/employee/profile-requests` accepts all EPFO fields and validates them.
- `POST /api/admin/profile-requests/[id]/decide` upserts all 14 EPFO fields into `StaffPayrollInfo` on `APPROVE`.

- [x] **Step 1: Write failing tests for EPFO fields in profile request creation & approval**

In `src/app/api/employee/profile-requests/route.test.ts`, add test cases for:
1. Rejection of Aadhaar starting with 0/1 (`012345678901`).
2. Rejection of IFSC with 'O' instead of '0' (`SBINO001234`).
3. Acceptance of EPFO fields (`maritalStatus`, `nameOnAadhaar`, `nameOnPan`, `nameOnUan`, `previousMemberId`, `relationship`, `isInternationalWorker`, `passportNumber`).

In `src/app/api/admin/profile-requests/route.test.ts`, add test case for:
1. Approving request with `maritalStatus: 'Married'` and `nameOnAadhaar: 'RAMESH KUMAR'` updates `StaffPayrollInfo`.

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/employee/profile-requests/route.test.ts src/app/api/admin/profile-requests/route.test.ts`
Expected: FAIL.

- [x] **Step 3: Implement API changes**

1. In `src/app/api/employee/profile/route.ts`:
   - Include all 14 EPFO fields from `staff.payrollInfo`.
   - Check if a `PENDING` `ProfileChangeRequest` exists for this staff member.
   - Run `validateForRegistration` or `validateForKyc` (from `@/lib/epfo/validation`) if `payGroup === 'BANK_EPF'` to compute `epfoReadiness`.
2. In `src/app/api/employee/profile-requests/route.ts`:
   - Update `cleanRequestedData` processing and validate Aadhaar (`^[2-9]\d{11}$`), IFSC (`^[A-Z]{4}0[A-Z0-9]{6}$`), Relationship (`F` / `H` / `Father` / `Husband`).
   - Add new fields to `currentDataSnapshot`.
3. In `src/app/api/admin/profile-requests/[id]/decide/route.ts`:
   - Add all 14 EPFO statutory fields to `payrollFields`.

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/employee/profile-requests/route.test.ts src/app/api/admin/profile-requests/route.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/app/api/employee/profile/route.ts src/app/api/employee/profile-requests/route.ts src/app/api/admin/profile-requests/[id]/decide/route.ts src/app/api/employee/profile-requests/route.test.ts src/app/api/admin/profile-requests/route.test.ts
git commit -m "feat(epfo): support statutory KYC fields in employee profile requests and admin decide APIs"
```

---

### Task 2: Admin Requests Tab (`ProfileRequestsTab.tsx`) Labels & Diff View

**Files:**
- Modify: `src/app/requests/ProfileRequestsTab.tsx`
- Test: `src/app/requests/ProfileRequestsTab.test.tsx` (or update `src/app/requests/page.test.tsx`)

**Interfaces:**
- `PROFILE_FIELD_LABELS` updated with:
  ```typescript
  maritalStatus: "Marital Status",
  relationship: "Father / Husband Relationship",
  nationality: "Nationality",
  nameOnAadhaar: "Name as per Aadhaar",
  nameOnPan: "Name as per PAN",
  nameOnUan: "Name on UAN",
  previousMemberId: "Previous EPFO Member ID",
  isInternationalWorker: "International Worker (Y/N)",
  countryOfOrigin: "Country of Origin",
  passportNumber: "Passport Number",
  passportValidFrom: "Passport Valid From",
  passportValidTill: "Passport Valid Till",
  isPhysicalHandicap: "Disability Status (Y/N)",
  locomotive: "Locomotive Disability",
  hearing: "Hearing Disability",
  visual: "Visual Disability",
  ```

- [x] **Step 1: Write test for EPFO field label rendering**

Create or update test asserting that requested EPFO modifications render with their human-readable labels instead of raw camelCase keys.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/requests/page.test.tsx` (or new test file)
Expected: FAIL.

- [x] **Step 3: Update `PROFILE_FIELD_LABELS` in `ProfileRequestsTab.tsx`**

Add all mappings to `PROFILE_FIELD_LABELS`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/requests/page.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/app/requests/ProfileRequestsTab.tsx src/app/requests/ProfileRequestsTab.test.tsx
git commit -m "feat(requests): add human-readable labels for EPFO statutory fields in admin diff table"
```

---

### Task 3: Mandatory KYC & EPFO Alert on Employee Dashboard

**Files:**
- Modify: `src/lib/employee-portal.ts`
- Modify: `src/components/dashboard/EmployeeMyDashboard.tsx`
- Test: `src/test/dashboards-light-mode.test.tsx` or `src/app/payslips/page.test.tsx`

**Interfaces:**
- `EmployeePortalData["profile"]` includes:
  ```typescript
  epfoReadiness?: {
    isBankEpf: boolean;
    ready: boolean;
    missingFields: string[];
    hasPendingRequest: boolean;
  };
  ```
- `EmployeeMyDashboard.tsx` renders:
  - If `isBankEpf` is true and `ready` is false:
    - If `hasPendingRequest`: Amber banner informing them an update request is already pending admin review.
    - If not `hasPendingRequest`: Red/amber high-priority mandatory alert banner with message *"Action Required: Complete Mandatory KYC & EPFO Details"* and button **Complete KYC & EPFO Details** which sets `profileEditModalOpen(true)` and targets the `statutory` tab.

- [x] **Step 1: Write failing test for mandatory KYC alert on dashboard**

In `src/test/dashboards-light-mode.test.tsx` or component test, assert that when `profile.epfoReadiness.ready === false` and `isBankEpf === true`, the mandatory KYC alert banner renders with the CTA button.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/dashboards-light-mode.test.tsx`
Expected: FAIL.

- [x] **Step 3: Implement readiness computation in `employee-portal.ts` and banner in `EmployeeMyDashboard.tsx`**

- In `src/lib/employee-portal.ts`: query `payrollInfo` and active `ProfileChangeRequest`, calculate `epfoReadiness`.
- In `src/components/dashboard/EmployeeMyDashboard.tsx`: render alert banner right below `PageHeader` when compliance details are missing.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/dashboards-light-mode.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/lib/employee-portal.ts src/components/dashboard/EmployeeMyDashboard.tsx src/test/dashboards-light-mode.test.tsx
git commit -m "feat(dashboard): show mandatory KYC and EPFO completion alert on employee dashboard"
```

---

### Task 4: Employee Profile Edit Modal (`RequestProfileEditModal.tsx`) Statutory & KYC Inputs

**Files:**
- Modify: `src/components/profile/RequestProfileEditModal.tsx`
- Test: `src/components/profile/RequestProfileEditModal.test.tsx`

**Interfaces:**
- `ProfileData` and `edits` state extended with:
  `maritalStatus`, `relationship`, `nationality`, `nameOnAadhaar`, `nameOnPan`, `nameOnUan`, `previousMemberId`, `isInternationalWorker`, `countryOfOrigin`, `passportNumber`, `passportValidFrom`, `passportValidTill`, `isPhysicalHandicap`, `locomotive`, `hearing`, `visual`.
- Tab 1 (`personal`): Add `maritalStatus`, `relationship`, `nationality`.
- Tab 3 (`statutory`): Add `nameOnAadhaar`, `nameOnPan`, `nameOnUan`, `previousMemberId`, and collapsible section for International Worker & Disability.

- [x] **Step 1: Write failing tests for EPFO fields in RequestProfileEditModal**

In `src/components/profile/RequestProfileEditModal.test.tsx`, add test asserting that opening the modal with `initialTab="statutory"` renders input fields for `Name on Aadhaar`, `Name on PAN`, `Name on UAN`, and `Marital Status`.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/profile/RequestProfileEditModal.test.tsx`
Expected: FAIL.

- [x] **Step 3: Update `RequestProfileEditModal.tsx`**

1. Update `edits` state and initialization.
2. Render Marital Status, Relationship, and Nationality in Personal tab.
3. Render Name on Aadhaar, Name on PAN, Name on UAN, and Previous Member ID in Statutory KYC tab.
4. Render collapsible `<details>` group for International Worker and Disability fields.
5. In `handleSubmit`, collect only modified fields and send to `/api/employee/profile-requests`.

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/profile/RequestProfileEditModal.test.tsx`
Expected: PASS.

- [x] **Step 5: Run full test suite and production build**

Run: `npx vitest run` and `npm run build`
Expected: All tests pass, Next.js build succeeds with 0 errors.

- [x] **Step 6: Commit**

```bash
git add src/components/profile/RequestProfileEditModal.tsx src/components/profile/RequestProfileEditModal.test.tsx
git commit -m "feat(profile): add full EPFO statutory and KYC field inputs to employee edit modal"
```
