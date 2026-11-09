# Modal Experience Overhaul & Unified Request Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the app's cramped modals into an Apple-inspired responsive dialog system with generous spacing, and implement a self-serve employee Profile/KYC edit request flow backed by a unified Admin Request Center (`/requests`).

**Architecture:**
1. Upgrade `Modal.tsx` to support responsive size tokens (`sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `full`), default `max-h-[85vh]`, and frosted backdrop blur; refactor key dense modals to breathe naturally.
2. Introduce `ProfileChangeRequest` in Prisma schema with JSON snapshots for `requestedData` and `currentData`.
3. Provide employee endpoints and a multi-tab `RequestProfileEditModal` in "My Portal" with inline validation, current vs. proposed values, and request status history with administrator decision remarks.
4. Upgrade the admin requests page into a unified `/requests` hub with Apple-style segmented tabs ("All", "Punch Regularizations", "Profile & KYC Updates"), side-by-side Before/After diff tables, and atomic 1-click Approve/Reject transactions updating `Staff`, `StaffPayrollInfo`, `User`, and `AuditLog`.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Prisma (PostgreSQL / FakePrisma for unit testing), NextAuth, Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-09-modal-redesign-and-profile-requests-design.md`

## Global Constraints

- Preserve all existing tests and ensure `npm test` runs with zero failures at all times.
- Modals must use Lucide SVG icons exclusively; no raw emojis in UI.
- `APPROVER` users can approve/reject punch regularizations for their assigned departments, but Profile & KYC request approvals are strictly restricted to `ADMIN`.
- Approval of Profile & KYC requests must execute in an atomic database transaction with `AuditLog` generation.
- Responsive design verified at mobile (375px), tablet (768px), and desktop (1024px+).

## Review Focus

1. **Email Uniqueness Collision**: An approved email change must not collide with an existing `User.email` in the database; both submission and approval endpoints must validate uniqueness.
2. **Atomic Approval Rollback**: If updating `User` or `StaffPayrollInfo` fails mid-transaction, all changes to `Staff` and `ProfileChangeRequest` must roll back cleanly.
3. **Empty Change Submission**: Submitting a profile change request without modifying any field must be rejected with 400 Bad Request.
4. **Approver Escalation Guard**: An `APPROVER` attempting to hit `POST /api/admin/profile-requests/[id]/decide` directly must receive `403 Forbidden`.
5. **Masked Field Safety**: When viewing current profile values, partial values must never accidentally overwrite real database fields; only explicitly provided new inputs are included in `requestedData`.

---

### Task 1: Modal System Upgrade (`Modal.tsx`) & Key Modals Resizing

**Files:**
- Modify: `src/components/ui/Modal.tsx`
- Test: `src/components/ui/Modal.test.tsx`
- Modify: `src/components/staff/StaffProfileModal.tsx:454`
- Modify: `src/components/staff/StaffOnboardModal.tsx:259`
- Modify: `src/components/staff/StaffBulkImportModal.tsx:75`
- Modify: `src/components/punches/RequestPunchModal.tsx:143`
- Modify: `src/components/dashboard/EmployeeMyDashboard.tsx:357`

**Interfaces:**
- Consumes: `IconButton`, `isOwnDialogEvent`
- Produces: `Modal(props: ModalProps)` where `size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full'`, `maxHeight?: string`, `subtitle?: string`, `headerAction?: ReactNode`

- [ ] **Step 1: Write failing tests for `Modal` size props and header enhancements**
  Create `src/components/ui/Modal.test.tsx` testing that passing `size="2xl"` renders the appropriate width class, `subtitle` renders, and default `size="md"` maintains backward compatibility.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/components/ui/Modal.test.tsx`
  Expected: FAIL (size and subtitle props not defined on Modal)

- [ ] **Step 3: Implement responsive size tokens, backdrop blur, and header subtitle in `src/components/ui/Modal.tsx`**
  Add `ModalSize` type:
  - `'sm'`: `w-[min(26rem,calc(100vw-2rem))]`
  - `'md'`: `w-[min(34rem,calc(100vw-2rem))]`
  - `'lg'`: `w-[min(44rem,calc(100vw-2rem))]`
  - `'xl'`: `w-[min(56rem,calc(100vw-2.5rem))]`
  - `'2xl'`: `w-[min(68rem,calc(100vw-3rem))]`
  - `'3xl'`: `w-[min(78rem,calc(100vw-3rem))]`
  - `'full'`: `w-[calc(100vw-2rem)] max-w-7xl`
  Default `max-h-[85vh]`, subtle frosted glass `backdrop-blur-md`, and smooth typography.

- [ ] **Step 4: Update key modal sizes**
  - In `src/components/staff/StaffProfileModal.tsx`, set `size="2xl"`.
  - In `src/components/staff/StaffOnboardModal.tsx`, set `size="xl"`.
  - In `src/components/staff/StaffBulkImportModal.tsx`, set `size="2xl"`.
  - In `src/components/punches/RequestPunchModal.tsx`, set `size="lg"`.
  - In `src/components/dashboard/EmployeeMyDashboard.tsx` (payslip view), set `size="lg"`.

- [ ] **Step 5: Run tests to verify they pass**
  Run: `npx vitest run src/components/ui/Modal.test.tsx`
  Expected: PASS

- [ ] **Step 6: Commit**
  ```bash
  git add src/components/ui/Modal.tsx src/components/ui/Modal.test.tsx src/components/staff/StaffProfileModal.tsx src/components/staff/StaffOnboardModal.tsx src/components/staff/StaffBulkImportModal.tsx src/components/punches/RequestPunchModal.tsx src/components/dashboard/EmployeeMyDashboard.tsx
  git commit -m "feat(ui): upgrade modal architecture with responsive sizes and Apple aesthetic"
  ```

---

### Task 2: Database Schema & Test Double Migration for `ProfileChangeRequest`

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/test-utils/fake-prisma.ts`

**Interfaces:**
- Produces: `prisma.profileChangeRequest` model with `create`, `findMany`, `findUnique`, `update`, `count` operations.

- [ ] **Step 1: Add `ProfileChangeRequest` model to `prisma/schema.prisma`**
  Add model with `id`, `staffId`, `status` (`PENDING`), `requestedData` (JSON string), `currentData` (JSON string), `reason`, `decidedByUserId`, `decidedAt`, `decisionRemarks`, `createdAt`, `updatedAt`, and relation to `Staff`.

- [ ] **Step 2: Add in-memory support to `src/test-utils/fake-prisma.ts`**
  Implement `fakePrisma.profileChangeRequest` table handling `create`, `findMany`, `findUnique`, `update`, `count`, and transactions.

- [ ] **Step 3: Run existing schema and prisma tests to verify integrity**
  Run: `npx vitest run src/lib/schema.test.ts`
  Expected: PASS

- [ ] **Step 4: Commit**
  ```bash
  git add prisma/schema.prisma src/test-utils/fake-prisma.ts
  git commit -m "feat(db): add ProfileChangeRequest model and test doubles"
  ```

---

### Task 3: Employee Profile Data & Change Request Submission APIs

**Files:**
- Create: `src/app/api/employee/profile/route.ts`
- Create: `src/app/api/employee/profile-requests/route.ts`
- Create: `src/app/api/employee/profile-requests/route.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/employee/profile`: Returns `{ profile: { id, name, employeeCode, email, mobileNumber, dob, gender, fatherHusbandName, bankAccount, ifsc, nameAsPerBank, pan, aadhaar, uan } }`
  - `POST /api/employee/profile-requests`: Body `{ requestedData: Record<string, string>, reason?: string }`
  - `GET /api/employee/profile-requests`: Returns array of employee's own requests.

- [ ] **Step 1: Write failing tests for employee profile and profile requests endpoints**
  In `src/app/api/employee/profile-requests/route.test.ts`:
  - Test unauthorized without session returns 401.
  - Test employee without linked staffId returns 400.
  - Test submitting with empty changes returns 400.
  - Test submitting with invalid PAN pattern returns 400.
  - Test submitting with invalid IFSC pattern returns 400.
  - Test submitting with conflicting existing user email returns 400.
  - Test valid submission creates `ProfileChangeRequest` with `PENDING` status.
  - Test `GET` returns list of requests.

- [ ] **Step 2: Run tests to verify they fail**
  Run: `npx vitest run src/app/api/employee/profile-requests/route.test.ts`
  Expected: FAIL (routes do not exist)

- [ ] **Step 3: Implement `GET /api/employee/profile/route.ts`**
  Read session; query `prisma.staff` including `payrollInfo` and `user` for the current user's staffId; return clean payload.

- [ ] **Step 4: Implement `POST` and `GET` in `src/app/api/employee/profile-requests/route.ts`**
  - Verify session & `staffId`.
  - Validate PAN (`/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/`), IFSC (`/^[A-Z]{4}0[A-Z0-9]{6}$/`), Aadhaar (`/^\d{12}$/`), and phone (`/^\d{10}$/`).
  - If email is requested, check `prisma.user.findUnique({ where: { email } })` to ensure no conflict with another user.
  - Store snapshot of current values in `currentData`.
  - Create record and return 201.

- [ ] **Step 5: Run tests to verify they pass**
  Run: `npx vitest run src/app/api/employee/profile-requests/route.test.ts`
  Expected: PASS

- [ ] **Step 6: Commit**
  ```bash
  git add src/app/api/employee/profile/route.ts src/app/api/employee/profile-requests/route.ts src/app/api/employee/profile-requests/route.test.ts
  git commit -m "feat(api): add employee profile retrieval and change request endpoints"
  ```

---

### Task 4: Employee UI - Request Profile Edit Modal & Portal Integration

**Files:**
- Create: `src/components/profile/RequestProfileEditModal.tsx`
- Create: `src/components/profile/RequestProfileEditModal.test.tsx`
- Modify: `src/components/dashboard/EmployeeMyDashboard.tsx`

**Interfaces:**
- Consumes: `Modal`, `Tabs`, `Field`, `Input`, `Select`, `Button`
- Produces: `RequestProfileEditModal({ open, onClose, staffId, onSubmitted })`

- [ ] **Step 1: Write failing component test for `RequestProfileEditModal`**
  In `src/components/profile/RequestProfileEditModal.test.tsx`:
  - Test renders 4 segmented tabs: Personal, Banking, Statutory KYC, and History.
  - Test inputs display current registered values and accept new values.
  - Test displays validation errors for malformed PAN or IFSC.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/components/profile/RequestProfileEditModal.test.tsx`
  Expected: FAIL (component not found)

- [ ] **Step 3: Implement `RequestProfileEditModal.tsx` (`size="xl"`)**
  - Apple-style segmented control tabs (`Personal & Contact`, `Banking`, `Statutory KYC`, `History & Status`).
  - Fetch current profile from `/api/employee/profile` and history from `/api/employee/profile-requests`.
  - Two-column grid per field: "Current Value" (subtle badge or text) vs "Proposed New Value" input.
  - Dynamic diff summary showing count of changed fields.
  - "Reason for Request" textarea.
  - History tab displaying previous submissions with date, status badges (`PENDING` amber, `APPROVED` green, `REJECTED` rose), and admin decision remarks.

- [ ] **Step 4: Integrate into `src/components/dashboard/EmployeeMyDashboard.tsx`**
  - In "My Profile & Shift" header, add `Request Details Edit` button with `FileText` icon.
  - If a request is `PENDING`, render an Apple-style badge `Pending Profile Review` that opens the modal directly to the History tab.
  - If the last request was `REJECTED`, render a `Request Rejected - View Reason` notice.

- [ ] **Step 5: Run tests to verify they pass**
  Run: `npx vitest run src/components/profile/RequestProfileEditModal.test.tsx`
  Expected: PASS

- [ ] **Step 6: Commit**
  ```bash
  git add src/components/profile/RequestProfileEditModal.tsx src/components/profile/RequestProfileEditModal.test.tsx src/components/dashboard/EmployeeMyDashboard.tsx
  git commit -m "feat(portal): add Apple-style profile edit request modal and portal integration"
  ```

---

### Task 5: Admin Profile Requests API & Atomic Approval/Rejection Engine

**Files:**
- Create: `src/app/api/admin/profile-requests/route.ts`
- Create: `src/app/api/admin/profile-requests/[id]/decide/route.ts`
- Create: `src/app/api/admin/profile-requests/route.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/admin/profile-requests`: Accepts `?status=...&departmentId=...&staffId=...`
  - `POST /api/admin/profile-requests/[id]/decide`: Body `{ action: 'APPROVE' | 'REJECT', remarks?: string }`

- [ ] **Step 1: Write failing tests for admin profile requests endpoints**
  In `src/app/api/admin/profile-requests/route.test.ts`:
  - Test non-admin/approver receives 401/403.
  - Test `GET` returns pending requests with staff details.
  - Test `APPROVER` attempting `POST /decide` receives 403 Forbidden.
  - Test `ADMIN` approving applies atomic updates to `Staff`, `StaffPayrollInfo`, linked `User`, updates status to `APPROVED`, and logs `AuditLog`.
  - Test `ADMIN` rejecting stores `decisionRemarks` and updates status to `REJECTED`.
  - Test rollback if updating `StaffPayrollInfo` fails.

- [ ] **Step 2: Run tests to verify they fail**
  Run: `npx vitest run src/app/api/admin/profile-requests/route.test.ts`
  Expected: FAIL

- [ ] **Step 3: Implement `src/app/api/admin/profile-requests/route.ts`**
  - Authenticate session with `requireRole(session, ["ADMIN", "APPROVER"])`.
  - If `APPROVER`, filter staff by `allowedDepartmentIds`.
  - Return requests with staff, department, and designation data.

- [ ] **Step 4: Implement `src/app/api/admin/profile-requests/[id]/decide/route.ts`**
  - Authenticate session strictly with `requireRole(session, ["ADMIN"])`.
  - In a Prisma transaction (`$transaction`):
    - Parse `requestedData`.
    - Update `Staff` (`name` if provided).
    - Update `StaffPayrollInfo` (all banking & statutory fields).
    - If staff has a linked `User`, update `User.name` and `User.email` (with uniqueness check).
    - Update `ProfileChangeRequest` status, `decidedByUserId`, `decidedAt`, `decisionRemarks`.
    - Create `AuditLog` entry (`action: "PROFILE_CHANGE_APPROVED"` or `"PROFILE_CHANGE_REJECTED"`).

- [ ] **Step 5: Run tests to verify they pass**
  Run: `npx vitest run src/app/api/admin/profile-requests/route.test.ts`
  Expected: PASS

- [ ] **Step 6: Commit**
  ```bash
  git add src/app/api/admin/profile-requests/route.ts src/app/api/admin/profile-requests/[id]/decide/route.ts src/app/api/admin/profile-requests/route.test.ts
  git commit -m "feat(api): add admin profile request query and atomic decision endpoints"
  ```

---

### Task 6: Unified Admin Request Center (`/requests`) & Navigation Upgrade

**Files:**
- Modify: `src/components/shell/nav.ts`
- Create: `src/app/requests/page.tsx`
- Create: `src/app/requests/RequestsHubClient.tsx`
- Create: `src/app/requests/ProfileRequestsTab.tsx`
- Create: `src/app/requests/page.test.tsx`
- Modify: `src/app/punches/requests/page.tsx` (redirect or delegate to `/requests?tab=punches`)

**Interfaces:**
- Produces: Unified `/requests` route with tabbed navigation: "All Requests", "Punch Regularizations", "Profile & KYC Updates".

- [ ] **Step 1: Write failing test for `/requests` page and nav links**
  In `src/app/requests/page.test.tsx`:
  - Test `/requests` renders page header "Requests & Approvals".
  - Test tabs switch between Punch Regularizations and Profile & KYC Updates.
  - Test Profile & KYC tab displays Before/After visual diff and decision action buttons for Admin.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/app/requests/page.test.tsx`
  Expected: FAIL

- [ ] **Step 3: Update `src/components/shell/nav.ts`**
  - Replace `{ label: "Punch requests", href: "/punches/requests", icon: CheckCircle2 }` with `{ label: "Requests & Approvals", href: "/requests", icon: CheckCircle2 }`.
  - Update `src/components/shell/nav.test.ts` to expect `/requests`.

- [ ] **Step 4: Create `ProfileRequestsTab.tsx`**
  - Apple-style bento card per request:
    - Employee Avatar, Name, Employee Code, Department, Submission Date.
    - Employee Reason quote block.
    - Before vs. After comparison table (Column 1: Field, Column 2: Current Value, Column 3: Requested Value with accent highlight).
    - Action controls: "Approve Changes" (confirm modal) and "Reject" (prompts for remarks in a sleek modal).

- [ ] **Step 5: Create `RequestsHubClient.tsx` and `src/app/requests/page.tsx`**
  - Top segmented control:
    - `All Requests`
    - `Punch Regularizations` (with pending count badge)
    - `Profile & KYC Updates` (with pending count badge)
  - Seamlessly embed `PunchRequestsAdminClient` for punch tab and `ProfileRequestsTab` for profile tab.
  - Add redirect in `src/app/punches/requests/page.tsx` to `/requests?tab=punches` for backward compatibility.

- [ ] **Step 6: Run tests to verify they pass**
  Run: `npx vitest run src/app/requests/page.test.tsx src/components/shell/nav.test.ts`
  Expected: PASS

- [ ] **Step 7: Commit**
  ```bash
  git add src/components/shell/nav.ts src/components/shell/nav.test.ts src/app/requests/page.tsx src/app/requests/RequestsHubClient.tsx src/app/requests/ProfileRequestsTab.tsx src/app/requests/page.test.tsx src/app/punches/requests/page.tsx
  git commit -m "feat(admin): build unified Request Center with profile diffs and nav upgrade"
  ```

---

### Task 7: Full Regression & Verification

**Files:**
- All touched files

- [ ] **Step 1: Run full Vitest test suite**
  Run: `npm test`
  Expected: 78+ test files passed, 740+ tests passed.

- [ ] **Step 2: Check Next.js build compilation**
  Run: `npm run build`
  Expected: Build succeeds with zero type or lint errors.

- [ ] **Step 3: Verification commit (if any touch-ups needed)**
  ```bash
  git commit --allow-empty -m "chore: verified full test suite and clean production build"
  ```
