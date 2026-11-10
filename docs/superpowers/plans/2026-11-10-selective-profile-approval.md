# Selective Profile Approval & Edit Modal UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement selective (field-by-field) approval/rejection for employee profile change requests and redesign the employee edit modal with full pre-population, reassuring guidance banners, live modified indicators, and one-click re-submission for rejected fields.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 6, Tailwind CSS, `@/components/ui`, Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-selective-profile-approval-design.md`

---

## Task 1: Backend Selective Approval API & Tests

**Files:**
- Modify: `src/app/api/admin/profile-requests/[id]/decide/route.ts`
- Test: `src/app/api/admin/profile-requests/route.test.ts` (or add `src/app/api/admin/profile-requests/[id]/decide/route.test.ts`)

- [x] **Step 1: Write tests for selective approval endpoint**
  - Test approving a subset of fields (e.g. mobileNumber and bankAccount approved, pan rejected).
  - Assert that ONLY approved fields are written to `StaffPayrollInfo` / `Staff`.
  - Assert that request status is set to `PARTIALLY_APPROVED`.
  - Assert that structured remarks contain `approvedFields`, `rejectedFields`, and `fieldRemarks`.
  - Test all fields approved -> status `APPROVED`.
  - Test all fields rejected -> status `REJECTED`.

- [x] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/app/api/admin/profile-requests/`

- [x] **Step 3: Update `src/app/api/admin/profile-requests/[id]/decide/route.ts`**
  - Accept `action: "APPROVE" | "REJECT" | "SELECTIVE"`.
  - Support `approvedFields?: string[]`, `rejectedFields?: string[]`, `fieldRemarks?: Record<string, string>`.
  - Filter `requestedData` to only include keys present in `approvedFields` (if `action === "SELECTIVE"`).
  - Compute final status (`APPROVED`, `REJECTED`, or `PARTIALLY_APPROVED`).
  - Store structured metadata in `decisionRemarks` and record comprehensive audit log.

- [x] **Step 4: Run tests to verify they pass**
  Run: `npx vitest run src/app/api/admin/profile-requests/`

- [x] **Step 5: Commit backend changes**
  `git commit -m "feat(api): support selective field-level profile change request approval"`

---

## Task 2: Redesign `RequestProfileEditModal` UI/UX

**Files:**
- Modify: `src/components/profile/RequestProfileEditModal.tsx`
- Test: `src/components/profile/RequestProfileEditModal.test.tsx`

- [x] **Step 1: Write tests for pre-filled modal and change detection**
  - Assert that when `currentProfile` loads, inputs display existing saved values.
  - Assert that changing a field shows the `● Modified` chip and enables submission with dynamic count.
  - Assert that clicking `Revert` restores the saved value and resets modified state.
  - Assert that submitting sends only genuinely modified fields.

- [x] **Step 2: Run test to verify failure**
  Run: `npx vitest run src/components/profile/RequestProfileEditModal.test.tsx`

- [x] **Step 3: Implement pre-fill, change detection, and visual cues in `RequestProfileEditModal.tsx`**
  - When profile data loads, set both `initialValues` and `formValues`.
  - Compute modified fields map: `isModified(key) = formValues[key] !== initialValues[key]`.
  - Add friendly top reassurance banner: *"Your saved records are pre-filled below. Only edit what you need to change — untouched fields remain safe and unchanged."*
  - Add `● Modified` badge and `↺ Revert` button for each modified field.
  - Update footer button: `Submit X ${count === 1 ? 'Change' : 'Changes'} for Approval` (or `No Changes Made` when 0).
  - Support `initialTab` and highlight any rejected fields when re-submitting.

- [x] **Step 4: Run tests to verify they pass**
  Run: `npx vitest run src/components/profile/RequestProfileEditModal.test.tsx`

- [x] **Step 5: Commit modal redesign**
  `git commit -m "feat(profile): redesign edit modal with pre-filled fields and live change detection"`

---

## Task 3: Admin Review Interface with Selective Approval (`ProfileRequestsTab.tsx`)

**Files:**
- Modify: `src/app/requests/ProfileRequestsTab.tsx`
- Test: `src/app/requests/ProfileRequestsTab.test.tsx`

- [x] **Step 1: Write tests for selective approval UI**
  - Test toggling individual field to "Reject".
  - Test entering field-specific rejection reason.
  - Test submitting selective decision payload to API.

- [x] **Step 2: Run test to verify failure**
  Run: `npx vitest run src/app/requests/ProfileRequestsTab.test.tsx`

- [x] **Step 3: Implement per-field Approve/Reject controls in `ProfileRequestsTab.tsx`**
  - For each changed field, provide `[✓ Approve]` and `[✗ Reject]` toggles.
  - When rejected, provide an inline rejection reason input.
  - Track count of approved vs rejected fields.
  - In confirmation modal, show summary and submit `action: "SELECTIVE"`.

- [x] **Step 4: Run tests to verify they pass**
  Run: `npx vitest run src/app/requests/ProfileRequestsTab.test.tsx`

- [x] **Step 5: Commit admin review interface**
  `git commit -m "feat(requests): add per-field selective approval controls in admin profile requests"`

---

## Task 4: Employee Profile Hub & History Updates (`EmployeeProfileClient.tsx`)

**Files:**
- Modify: `src/app/profile/EmployeeProfileClient.tsx`
- Test: `src/app/profile/page.test.tsx`

- [x] **Step 1: Update test in `src/app/profile/page.test.tsx` for `PARTIALLY_APPROVED` status**
- [x] **Step 2: Update `EmployeeProfileClient.tsx`**
  - Handle `PARTIALLY_APPROVED` status chip with amber/indigo badge.
  - Render breakdown of approved vs rejected fields in history list.
  - Add **"Fix & Re-Submit Rejected Fields"** button that opens `RequestProfileEditModal` targeting rejected fields.
- [x] **Step 3: Run tests to verify they pass**
  Run: `npx vitest run src/app/profile/page.test.tsx`
- [x] **Step 4: Commit employee profile updates**
  `git commit -m "feat(profile): support partially approved requests and re-request CTA in employee profile"`

---

## Task 5: Full Regression Testing, Production Build & Merge

- [x] **Step 1: Run full vitest test suite** (`npx vitest run`)
- [x] **Step 2: Run Next.js production build** (`npm run build`)
- [ ] **Step 3: Checkout `main`, merge `--no-ff`, and push to `origin/main`**
