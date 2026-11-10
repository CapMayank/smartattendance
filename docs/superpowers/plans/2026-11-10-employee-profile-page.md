# Employee Dedicated "My Profile" & EPFO/KYC Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a dedicated `/profile` page for employees displaying complete personal, employment, banking, and EPFO/KYC statutory details with real-time compliance status banners and integrated edit request workflows.

**Architecture:** Implement a Next.js App Router server page `src/app/profile/page.tsx` backed by `prisma` and `getEmployeePortalData` paired with an interactive client component `src/app/profile/EmployeeProfileClient.tsx`; add `/profile` navigation items to `EMPLOYEE_NAV` and sidebar user menu; wire section-level edit triggers to `RequestProfileEditModal`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 6, Lucide React, Tailwind CSS, `@/components/ui`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-employee-profile-page-design.md`

## Global Constraints

- Never allow direct client updates to `StaffPayrollInfo`; all employee modifications must pass through `ProfileChangeRequest` approval.
- Use Lucide React icons (`User`, `ShieldCheck`, `CreditCard`, `FileText`, `Clock`, etc.).
- Follow design system tokens from `@/components/ui` (`Card`, `Button`, `PageHeader`, `Avatar`, `Modal`, `EmptyState`).
- The page must be fully responsive across mobile (<600px) and desktop (>1024px) viewports.

## Review Focus

1. **Unauthenticated redirection:** Accessing `/profile` without an active session immediately redirects to `/login`.
2. **Missing KYC alert visibility:** A `BANK_EPF` employee with incomplete statutory details sees the high-priority mandatory alert banner with missing field descriptions and a direct "Complete KYC & EPFO Details" button.
3. **Pending request idempotency:** When an employee has an active `PENDING` request, an amber notification banner is displayed and conflicting duplicate requests are prevented.
4. **Targeted modal opening:** Clicking "Edit Banking Details" opens `RequestProfileEditModal` preset directly to the `banking` tab, while "Update Statutory & KYC" opens to the `statutory` tab.
5. **No alert for `CASH` payroll staff:** Staff members in the `CASH` pay group never see the mandatory EPF KYC alert banner.

---

### Task 1: Navigation & Sidebar Integration

**Files:**
- Modify: `src/components/shell/nav.ts`
- Modify: `src/components/shell/Sidebar.tsx`
- Modify: `src/components/dashboard/EmployeeMyDashboard.tsx`
- Test: `src/components/shell/nav.test.ts`

**Interfaces:**
- `EMPLOYEE_NAV`: Includes `{ label: "My Profile", href: "/profile", icon: User }`.
- `Sidebar.tsx`: Includes `<Link href="/profile">My Profile</Link>` in user dropdown.
- `EmployeeMyDashboard.tsx`: Includes a link to `/profile` in "My Profile & Shift" header.

- [x] **Step 1: Write failing test in `src/components/shell/nav.test.ts`**

Assert that `getNavForRole("EMPLOYEE")` contains an item with `href: "/profile"` and `label: "My Profile"`.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/shell/nav.test.ts`
Expected: FAIL.

- [x] **Step 3: Update `src/components/shell/nav.ts`, `Sidebar.tsx`, and `EmployeeMyDashboard.tsx`**

1. In `src/components/shell/nav.ts`: Add `User` icon from `lucide-react` and add `{ label: "My Profile", href: "/profile", icon: User }` to `EMPLOYEE_NAV`.
2. In `src/components/shell/Sidebar.tsx`: Add "My Profile" link with `User` icon inside the user menu dropdown.
3. In `src/components/dashboard/EmployeeMyDashboard.tsx`: Add `<Link href="/profile" className="...">View Full Profile →</Link>` next to "Request Details Edit".

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/shell/nav.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/components/shell/nav.ts src/components/shell/nav.test.ts src/components/shell/Sidebar.tsx src/components/dashboard/EmployeeMyDashboard.tsx
git commit -m "feat(nav): add My Profile navigation links for employee portal"
```

---

### Task 2: Employee Profile Page (`/profile`)

**Files:**
- Create: `src/app/profile/page.tsx`
- Create: `src/app/profile/EmployeeProfileClient.tsx`
- Create: `src/app/profile/page.test.tsx`

**Interfaces:**
- `src/app/profile/page.tsx`:
  - Enforces `requireRole(session, ["EMPLOYEE", "APPROVER", "ADMIN"])`.
  - Queries `staff` with `payrollInfo`, `department`, `designation`, `shift`, `user`, and `profileChangeRequests`.
  - Computes `epfoReadiness` via `evaluateEmployeeKycAndEpfoReadiness`.
  - Passes full profile and request history to `EmployeeProfileClient`.
- `src/app/profile/EmployeeProfileClient.tsx`:
  - Renders `PageHeader` with title "My Profile & Statutory KYC", subtitle, and primary button "Request Details Edit".
  - Renders compliance alert banner if incomplete, or pending review banner if pending.
  - Renders 5 distinct section cards:
    1. School Identity & Employment
    2. Personal & Contact Information (with "Edit Personal Info" button)
    3. Salary Bank Account (with "Edit Banking Details" button)
    4. Statutory Records & EPFO Compliance (with "Update Statutory & KYC" button)
    5. Profile Change Requests & Status History
  - Houses `<RequestProfileEditModal open={modalOpen} initialTab={modalTab} onClose={...} />`.

- [x] **Step 1: Write failing tests in `src/app/profile/page.test.tsx`**

Test cases for:
1. Redirecting to `/login` when session is null.
2. Rendering employee identity, personal details, banking, and EPFO statutory fields.
3. Rendering mandatory KYC alert banner when `ready === false` and `isBankEpf === true`.
4. Rendering pending review banner when `hasPendingRequest === true`.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/profile/page.test.tsx`
Expected: FAIL (module not found).

- [x] **Step 3: Implement `src/app/profile/EmployeeProfileClient.tsx` and `src/app/profile/page.tsx`**

1. Create `src/app/profile/EmployeeProfileClient.tsx` with all 5 sections, compliance banners, and `RequestProfileEditModal` integration.
2. Create `src/app/profile/page.tsx` with server session verification, data querying, and readiness computation.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/profile/page.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/app/profile/page.tsx src/app/profile/EmployeeProfileClient.tsx src/app/profile/page.test.tsx
git commit -m "feat(profile): implement dedicated employee My Profile page with full EPFO and KYC hub"
```

---

### Task 3: Regression Suite Verification & Production Build

**Files:**
- Test: All project vitest suites
- Build: Next.js production build (`npm run build`)

- [x] **Step 1: Run full vitest test suite**

Run: `npx vitest run`
Expected: 100% test files pass.

- [x] **Step 2: Run production build**

Run: `npm run build`
Expected: Exit code 0, all routes compiled cleanly including `/profile`.

- [x] **Step 3: Commit plan and final updates**

```bash
git add docs/superpowers/plans/2026-11-10-employee-profile-page.md
git commit -m "docs: complete implementation plan for employee profile page"
```
