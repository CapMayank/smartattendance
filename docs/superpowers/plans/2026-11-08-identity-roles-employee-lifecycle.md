# Identity, Roles, Employee Lifecycle, Pay Groups & Setup Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the attendance and payroll management app into a secure employee service portal featuring role-based access control, permanent employee code logins (`SAR-YYYY-NNN`), staff lifecycle tracking (joining, exit, rejoin), separate cash/bank pay groups, an unmatched punches review tray, and an all-in-one activation setup wizard (`/setup`).

**Architecture:** 
- Additive Prisma schema models (`EmploymentPeriod`, `ApproverDepartment`, `UnmatchedPunch`, `AuditLog`, `SystemSetting`, `PayGroupChange`) preserving full backwards compatibility.
- Centralized role verification via `requireRole` and database-backed session freshness checks, with request filtering in `src/proxy.ts`.
- Pure utility libraries for employee code generation and case/hyphen normalization, employment window checks (`isEmployed`), and dual payroll calculation engines (`BANK_EPF` vs `CASH`).
- Setup wizard gate (`/setup`) guarded by `SETUP_SECRET` allowing zero-downtime bootstrap on first run.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, NextAuth v4 (JWT), Prisma ORM, PostgreSQL/SQLite, Tailwind CSS, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-08-identity-roles-and-employee-lifecycle-design.md`

## Global Constraints

- Never mutate past locked payrolls or delete historical records upon staff exit or rejoin.
- Timezone is fixed to `Asia/Kolkata` (IST) using YYYY-MM-DD day keys.
- Next.js 16 breaking change rules apply: read relevant guides in `node_modules/next/dist/docs/` before writing route/proxy code.
- Every role check must be backed by authoritative database lookups to guarantee immediate session revocation on role demotion or account deactivation.
- All 366 existing vitest tests must remain green.

## Review Focus

- **Input Normalization:** `SAR-2024-001`, `sar2024001`, `sar-2024-1` resolve to the identical employee code during login lookup.
- **Historical Employment Gaps:** Days prior to joining date or between exit and rejoin display as unrecorded/not-employed rather than accumulating false `ABSENT` penalties in reports.
- **Cash Payroll Math:** Members under the `CASH` pay group have zero EPF/EPS/EDLI deductions and do not export into EPFO ECR files.
- **Immediate Revocation:** Exited or disabled users attempting API requests with existing unexpired JWT tokens receive immediate 401/403 responses.
- **Setup Gate:** Unconfigured systems route all user navigation to `/setup` until `SETUP_SECRET` unlocks the bootstrap form.

---

### Task 1: Schema Updates & Database Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `src/lib/schema.test.ts`

**Interfaces:**
- Produces: Updated Prisma Client with `Role`, `EmploymentPeriod`, `ApproverDepartment`, `UnmatchedPunch`, `AuditLog`, `SystemSetting`, `PayGroupChange`, and `Staff.employeeCode`.

- [ ] **Step 1: Write test checking schema model definitions and Prisma type exports**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Update `prisma/schema.prisma` with additive models and fields**
- [ ] **Step 4: Push/generate Prisma Client and verify test passes**
- [ ] **Step 5: Commit**

---

### Task 2: Core Utility Libraries (Code Generator, Normalizer, and Employment Rules)

**Files:**
- Create: `src/lib/employee-code.ts`
- Create: `src/lib/employee-code.test.ts`
- Create: `src/lib/employment.ts`
- Create: `src/lib/employment.test.ts`
- Create: `ws-lib/employment.js`
- Create: `ws-lib/employment.test.ts`

**Interfaces:**
- Produces:
  - `generateEmployeeCode(year: number, sequence: number) -> string`
  - `normalizeLoginIdentifier(input: string) -> { type: 'email' | 'code'; value: string }`
  - `isEmployed(staff: { periods?: EmploymentPeriod[] }, dateKey: string) -> boolean`

- [ ] **Step 1: Write tests for employee code generator and login input normalizer**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement `src/lib/employee-code.ts`**
- [ ] **Step 4: Write tests for `isEmployed` (including legacy staff fallback)**
- [ ] **Step 5: Implement `src/lib/employment.ts` and CommonJS counterpart in `ws-lib/employment.js`**
- [ ] **Step 6: Run tests and verify all pass**
- [ ] **Step 7: Commit**

---

### Task 3: Dual Pay Group Calculation Engine (Cash vs Bank/EPF)

**Files:**
- Create: `src/lib/payroll-calc.ts`
- Create: `src/lib/payroll-calc.test.ts`
- Modify: `src/app/api/payroll/sync/route.ts`

**Interfaces:**
- Produces:
  - `calculateStaffPayroll(params: PayrollCalcParams) -> PayrollCalcResult`
  - Supports `payGroup: 'BANK_EPF' | 'CASH'`

- [ ] **Step 1: Write unit tests covering both BANK_EPF formula and CASH formula**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement `src/lib/payroll-calc.ts` and integrate into `sync/route.ts`**
- [ ] **Step 4: Verify all unit and characterization tests pass**
- [ ] **Step 5: Commit**

---

### Task 4: Auth, NextAuth Token Enhancement, and API Role Guard

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/types/next-auth.d.ts`
- Create: `src/lib/rbac.ts`
- Create: `src/lib/rbac.test.ts`
- Modify: `src/proxy.ts`

**Interfaces:**
- Produces:
  - `requireRole(session: Session | null, allowedRoles: Role[]) -> Promise<{ user: User; staff: Staff | null }>`
  - NextAuth JWT containing `role`, `staffId`, `mustChangePassword`, `employeeCode`

- [ ] **Step 1: Write unit tests for `requireRole` with mock sessions, role checks, and deactivation detection**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Update `src/lib/auth.ts` credentials provider to support code-based login and token claims**
- [ ] **Step 4: Implement `src/lib/rbac.ts` and update `src/proxy.ts`**
- [ ] **Step 5: Run tests and verify all pass**
- [ ] **Step 6: Commit**

---

### Task 5: Gate Existing API Routes with `requireRole`

**Files:**
- Modify: All existing route handlers in `src/app/api/` (users, staff, shifts, payroll, reports, etc.)
- Create: `src/test-utils/rbac-route-tests.test.ts`

**Interfaces:**
- Consumes: `requireRole` from `src/lib/rbac.ts`
- Produces: Fully secured endpoints rejecting unauthorized roles with 401/403.

- [ ] **Step 1: Write integration tests verifying non-admins are blocked from `/api/users`, `/api/payroll`, and `/api/shifts`**
- [ ] **Step 2: Run tests to verify failures**
- [ ] **Step 3: Apply `requireRole` across the API routes**
- [ ] **Step 4: Run tests and verify all pass**
- [ ] **Step 5: Commit**

---

### Task 6: Staff Lifecycle Management (Joining, Exit, Rejoin, Delete Guard)

**Files:**
- Create: `src/app/api/staff/[id]/lifecycle/route.ts`
- Create: `src/app/api/staff/[id]/lifecycle/route.test.ts`
- Modify: `src/app/api/staff/route.ts`
- Modify: `src/app/api/staff/bulk/route.ts`

**Interfaces:**
- Produces:
  - `POST /api/staff`: validates required `joiningDate` and creates initial `EmploymentPeriod` + code
  - `POST /api/staff/[id]/lifecycle`: handles `action: 'EXIT' | 'REJOIN'`
  - `DELETE /api/staff`: restricts deletion if punches, payroll, or records exist

- [ ] **Step 1: Write tests for exit, rejoin, and delete-guard failure modes**
- [ ] **Step 2: Run tests to verify failures**
- [ ] **Step 3: Implement lifecycle route and modify staff creation/deletion routes**
- [ ] **Step 4: Run tests and verify all pass**
- [ ] **Step 5: Commit**

---

### Task 7: Unmatched Punches Ingestion & Review Queue

**Files:**
- Modify: `ws-server.js`
- Create: `src/app/api/punches/unmatched/route.ts`
- Create: `src/app/api/punches/unmatched/route.test.ts`
- Create: `src/app/punches/unmatched/page.tsx`

**Interfaces:**
- Produces:
  - `ws-server.js` inserts into `UnmatchedPunch` for unknown or not-employed IDs
  - `GET /api/punches/unmatched` & `POST /api/punches/unmatched/[id]/resolve` (Attach or Dismiss)

- [ ] **Step 1: Write tests for unmatched punch resolution and attendance log replay**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Update `ws-server.js` to log unmatched punches and implement resolution API**
- [ ] **Step 4: Create UI review table in `src/app/punches/unmatched/page.tsx`**
- [ ] **Step 5: Run tests and verify all pass**
- [ ] **Step 6: Commit**

---

### Task 8: Initial Setup Wizard (`/setup`) & Final Integration

**Files:**
- Create: `src/app/setup/page.tsx`
- Create: `src/app/api/setup/route.ts`
- Create: `src/app/api/setup/route.test.ts`
- Modify: `src/proxy.ts`

**Interfaces:**
- Produces:
  - `/setup` page requiring `SETUP_SECRET`
  - Setup API that creates admin staff record, imports joining dates, sets `setupCompleted = true`
  - `proxy.ts` intercepts requests and redirects to `/setup` if setup is incomplete

- [ ] **Step 1: Write test for setup authentication and bootstrap endpoint**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement setup API and UI page with secret code verification**
- [ ] **Step 4: Run tests and verify all pass**
- [ ] **Step 5: Commit**

---

### Task 9: Full Regression & Whole-Branch Review

**Files:**
- Run full vitest suite
- Verify Next.js build (`npm run build`)
- Check graph update and documentation

- [ ] **Step 1: Run all 33+ test files and new tests**
- [ ] **Step 2: Run `npm run build` to verify type safety and Next.js 16 compile**
- [ ] **Step 3: Update knowledge graph (`graphify update .`)**
- [ ] **Step 4: Commit**
