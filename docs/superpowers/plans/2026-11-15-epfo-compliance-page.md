# EPFO Compliance Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move EPFO compliance out of Salary setup into its own dashboard page `/payroll/epfo` with an Overview, one tab per task (registration, KYC, exit), ECR history and an all-members list.

**Architecture:** Pure helper functions (`src/lib/epfo/summary.ts`) feed two new read-only admin APIs (`summary`, `ecr`). The 1,000-line `EpfoMembersTab.tsx` is split: its fetch/export/mark/undo logic becomes one hook, its table becomes small per-task tab components, and a new page composes them under the existing `Tabs` primitive. Existing export/mark APIs and file formats are untouched.

**Tech Stack:** Next.js (App Router, breaking-change version: read `node_modules/next/dist/docs/` before writing page or route code), React, TypeScript, Prisma, Vitest, existing `@/components/ui` primitives (`Tabs`, `KpiTile`, `ProgressTrack`, `Card`, `Chip`, `Button`, `Modal`, `EmptyState`, `PageHeader`).

**Spec:** `docs/superpowers/specs/2026-11-15-epfo-compliance-page-design.md`. Visual reference (not committed): `.superpowers/brainstorm/1402-1794682243/content/epfo-dashboard-v4.html`.

## Global Constraints

- Page path `/payroll/epfo`; sidebar label "EPFO compliance" in the Payroll group.
- Tab order and labels: Overview, New joinee registration, KYC, Exit (bulk), ECR history, All members. Tab bar directly under the page header; task tabs show a pending-count pill. Deep link via `?tab=` with ids `overview | registration | kyc | exit | ecr | all`; unknown value falls back to `overview`.
- Admin-only: `requireRole(session, ['ADMIN'])` on every new route.
- Palette/tokens from the approved dark redesign; use existing tokens and primitives, never the mockup's raw CSS. No emoji icons; lucide icons only.
- KYC defaults to Aadhaar and PAN only (`docTypes: ['P','A']`). File formats unchanged.
- Compliance % = `UP_TO_DATE / (all counts except HIDDEN)`, rounded; 0 when the denominator is 0.
- ECR due date = 15th of the month after the payroll month. Financial year runs April to March, formatted `2026-27`.
- Do not add "Download next batch"; keep "Mark as already filed".
- Salary setup (`src/app/payroll/staff/page.tsx`) loses the EPFO tab and its EPFO state; `/payroll/staff?tab=epfo` redirects to `/payroll/epfo`.

## Review Focus

1. A month whose payroll rows are all CASH or have `grossWage` 0 must not appear in ECR history (no empty "0 members" rows).
2. Zero EPF members (all counts 0) gives compliance 0%, not `NaN`, and the Overview still renders.
3. A staff member with `payrollInfo: null` appears in registration/needs-attention without crashing.
4. UAN entry that is not exactly 12 digits is rejected client-side and the Save button stays disabled.
5. A non-admin session gets 403 from both new routes; an invalid `?tab=` or `?month=abc` never throws.

---

### Task 1: Summary helpers

**Files:**
- Create: `src/lib/epfo/summary.ts`
- Test: `src/lib/epfo/summary.test.ts`

**Interfaces:**
- Produces:
  - `type EpfoCounts = Record<EpfoNextAction, number>`
  - `computeCompliancePercent(counts: EpfoCounts): number`
  - `interface NeedsAttentionItem { staffId: string; name: string; reason: string; kind: 'FIX' | 'ENTER_UAN' }`
  - `buildNeedsAttention(members: AttentionInput[], now: Date, limit?: number): NeedsAttentionItem[]` where `AttentionInput = { id: string; name: string; nextAction: EpfoNextAction; readiness: { ready: boolean; errors: { field: string; message: string }[] }; employmentPeriods?: EpfoPeriodRecord[] }`; default `limit` 5
  - `financialYearOf(month: number, year: number): string`
  - `ecrDueDate(month: number, year: number): string` (`YYYY-MM-DD`)
  - `interface EcrPayrollRow { month: number; year: number; isLocked: boolean; payGroup: string; staffPayGroup?: string | null; grossWage: number; epfWages: number; epsWages: number; edliWages: number; employeeEpf: number; employerEps: number; employerEpf: number; ncpDays: number }`
  - `interface EcrMonthSummary { month: number; year: number; label: string; financialYear: string; members: number; epfWages: number; epsWages: number; edliWages: number; employeeShare: number; employerEps: number; employerEpf: number; employerShare: number; total: number; ncpDays: number; locked: boolean; dueDate: string }`
  - `summarizeEcrMonths(rows: EcrPayrollRow[]): EcrMonthSummary[]` (newest first)
  - `describeEpfoAction(action: string, details: string | null): string`

- [ ] **Step 1: Write failing tests** in `summary.test.ts`: `computeCompliancePercent({NEEDS_REGISTRATION:3,AWAITING_UAN:1,NEEDS_EXIT:1,NEEDS_KYC:2,UP_TO_DATE:38,HIDDEN:9})` is `84`; all zeros (HIDDEN excluded) is `0`. `financialYearOf(3,2026)` is `'2025-26'`, `financialYearOf(4,2026)` is `'2026-27'`. `ecrDueDate(12,2026)` is `'2027-01-15'`. `summarizeEcrMonths` ignores rows with `payGroup==='CASH'`, `staffPayGroup==='CASH'` or `grossWage<=0`, sums the rest per month with rounded integers, sets `employerShare = employerEps+employerEpf`, `total = employeeShare+employerShare`, `locked` true only when every counted row is locked, orders newest first, label `'October 2026'`. `buildNeedsAttention` returns `ENTER_UAN` items for `AWAITING_UAN` members whose latest period `epfoJoinExportedAt` is more than 7 days before `now` (reason text includes the day count) listed before `FIX` items for not-ready non-awaiting members (reason `Missing: ` + messages joined by `, `), capped at `limit`. `describeEpfoAction('EPFO_EXPORT_REG', '{"exportedStaffIds":["a","b"]}')` returns `'Registration file exported · 2 members'`; unknown `EPFO_` action returns a readable fallback and never throws on `null` or malformed JSON.
- [ ] **Step 2: Run** `npx vitest run src/lib/epfo/summary.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** the functions in `summary.ts` per the signatures above (pure, no I/O). Action names to map come from `grep -rn "action: 'EPFO_" src/app/api`.
- [ ] **Step 4: Run** the same command → PASS.
- [ ] **Step 5: Commit** `feat(epfo): summary and ECR helper functions`.

---

### Task 2: Summary and ECR APIs, ECR download audit

**Files:**
- Create: `src/app/api/payroll/epfo/summary/route.ts`, `src/app/api/payroll/epfo/ecr/route.ts`
- Modify: `src/app/api/payroll/export/[type]/route.ts` (write an audit entry on `ecr-text` and `ecr-final`)
- Test: `src/app/api/payroll/epfo/summary-ecr.test.ts` (copy the mocking pattern from `route.test.ts` in the same folder)

**Interfaces:**
- Consumes: Task 1 helpers; `getEpfoNextAction`, `validateForNextAction`, `getLatestEmploymentPeriod`.
- Produces:
  - `GET /api/payroll/epfo/summary` → `{ counts: EpfoCounts; compliancePercent: number; needsAttention: NeedsAttentionItem[]; latestEcr: EcrMonthSummary | null; recentActivity: Array<{ id: string; at: string; text: string }> }` (last 5 `AuditLog` rows whose `action` starts with `EPFO_`, newest first)
  - `GET /api/payroll/epfo/ecr` → `{ months: EcrMonthSummary[] }`
  - `GET /api/payroll/epfo/ecr?month=10&year=2026` → `{ month: EcrMonthSummary; members: Array<{ staffId: string; name: string; uan: string; epfWages: number; employeeEpf: number; ncpDays: number }> }`; 400 for non-numeric month/year, 404 when that month has no counted rows
  - Audit action `EPFO_ECR_DOWNLOAD` with `details` JSON `{ month, year, format: 'text' | 'excel' }`

- [ ] **Step 1: Write failing tests**: non-admin gets 403 on both routes; summary returns `compliancePercent` and a `latestEcr` matching the newest month of mocked payroll rows; ecr list excludes a CASH-only month (Review Focus 1); `?month=abc` returns 400; unknown month returns 404; a mocked ECR download call creates an `EPFO_ECR_DOWNLOAD` audit row.
- [ ] **Step 2: Run** `npx vitest run src/app/api/payroll/epfo/summary-ecr.test.ts` → FAIL.
- [ ] **Step 3: Implement** both routes (admin-only, `dynamic = 'force-dynamic'`) and the audit write in the export route. Reuse the members-route query shape for staff; query `prisma.monthlyPayroll.findMany` with `staff.payrollInfo` included for ECR.
- [ ] **Step 4: Run** the test file plus `npx vitest run src/app/api/payroll` → PASS.
- [ ] **Step 5: Commit** `feat(epfo): summary and ECR history APIs, log ECR downloads`.

---

### Task 3: Shared members hook

**Files:**
- Create: `src/components/payroll/epfo/use-epfo-members.ts`
- Test: `src/components/payroll/epfo/use-epfo-members.test.ts` (test the exported pure helpers only; no DOM)

**Interfaces:**
- Consumes: existing `/api/payroll/epfo/members`, `/api/payroll/epfo/export/[type]`, `/api/payroll/epfo/mark`, `/api/payroll/staff` (PUT).
- Produces:
  - Move `EpfoMemberRow` and `QueueFilter` types out of `EpfoMembersTab.tsx` into this file (re-exported).
  - `isValidUan(value: string): boolean` (exactly 12 digits)
  - `splitReadiness(members: EpfoMemberRow[]): { ready: EpfoMemberRow[]; skipped: Array<{ id: string; name: string; reasons: string[] }> }`
  - `useEpfoMembers(opts?: { refreshTrigger?: number }): { members; counts; loading; refresh(): Promise<void>; saveUan(staffId, uan): Promise<boolean>; exportFile(type: 'reg'|'exit'|'kyc', staffIds: string[], exitCodes?): Promise<boolean>; markFiled(staffIds, target): Promise<boolean>; resetToPending(member): Promise<boolean>; undo: UndoState | null; runUndo(): Promise<void>; dismissUndo(): void }` carrying the logic currently in `EpfoMembersTab.tsx` lines 104-397 (including `docTypes: ['P','A']` and file download via Content-Disposition name).

- [ ] **Step 1: Write failing tests** for `isValidUan` (`'100248330106'` true; `'12345'`, `'1002483301a6'`, `''` false) and `splitReadiness` (a member with `readiness.ready=false` lands in `skipped` with its error messages).
- [ ] **Step 2: Run** `npx vitest run src/components/payroll/epfo/use-epfo-members.test.ts` → FAIL.
- [ ] **Step 3: Implement** the hook and helpers by moving, not rewriting, the existing handlers; replace `alert(...)` failures with a returned boolean plus an `error: string | null` field on the hook.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `refactor(epfo): extract members hook from EpfoMembersTab`.

---

### Task 4: Task tabs (registration, KYC, exit, all members)

**Files:**
- Create: `src/components/payroll/epfo/MemberChecklist.tsx`, `EpfoRegistrationTab.tsx`, `EpfoKycTab.tsx`, `EpfoExitTab.tsx`, `EpfoAllMembersTab.tsx`
- Test: `src/components/payroll/epfo/task-tabs.test.tsx` (`renderToStaticMarkup`, same style as `EpfoMembersTab.test.tsx`)

**Interfaces:**
- Consumes: Task 3 hook return value (passed in as props `{ epfo: ReturnType<typeof useEpfoMembers>; onFixMember: (staffId: string, tab: 'statutory'|'kyc', fields: string[]) => void }`), existing `ExportSummaryDialog`, `MarkExitDialog`.
- Produces: each tab is a default-less named export taking those props. `MemberChecklist` takes `{ errors: { field: string; message: string }[] }` and renders one chip per required field label: green when absent from `errors`, red when present (fields: aadhaar, qualification, mobileNumber, fatherHusbandName, dob, gender, maritalStatus).
  - `EpfoRegistrationTab`: chips "To register · n" / "Awaiting UAN · n"; awaiting rows show inline 12-digit UAN input + Save (disabled until `isValidUan`); sticky action bar "Download registration file" using `ExportSummaryDialog`; "Mark as already filed" and per-row "Reset to pending" kept.
  - `EpfoKycTab`: shows documents per member (Aadhaar, PAN) and "n KYC lines will be generated"; note that bank KYC is not accepted from employers.
  - `EpfoExitTab`: reuses `MarkExitDialog`; shows UAN, last working day, per-person reason default, payroll-locked warning.
  - `EpfoAllMembersTab`: searchable list of all non-hidden members with status badge, UAN and last filing dates.

- [ ] **Step 1: Write failing tests**: registration tab with one ready and one not-ready member renders both names, a red chip for the missing field and the text `1 skipped` only after selection is simulated via `initialSelectedIds` prop (add that prop for testability); KYC tab renders the "bank KYC is not accepted" note; exit tab renders `31/10/2026`; a member with `payrollInfo: null` renders without throwing (Review Focus 3).
- [ ] **Step 2: Run** `npx vitest run src/components/payroll/epfo/task-tabs.test.tsx` → FAIL.
- [ ] **Step 3: Implement** the five components. Table on `md+`, cards below (as today). Match the mockup's hierarchy: note banner, toolbar with chips and search, rows, sticky bar.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(epfo): per-task tabs for registration, KYC, exit and all members`.

---

### Task 5: Overview and ECR history tabs

**Files:**
- Create: `src/components/payroll/epfo/EpfoOverviewTab.tsx`, `EpfoEcrHistoryTab.tsx`
- Test: `src/components/payroll/epfo/overview-ecr.test.tsx`

**Interfaces:**
- Consumes: `GET /api/payroll/epfo/summary` and `/api/payroll/epfo/ecr` from Task 2; `payroll/export/ecr-text` download (existing, `?month=&year=`).
- Produces: `EpfoOverviewTab({ onOpenTab, onFixMember, data?: SummaryResponse })` and `EpfoEcrHistoryTab({ data?: { months: EcrMonthSummary[] } })`; both accept optional `data` so tests render without fetching. `onOpenTab(tab: 'registration'|'kyc'|'exit'|'ecr'|'all')`.
  - Overview: five `KpiTile`s (pending registration, awaiting UAN, KYC pending, exits due, compliance %), pending-work bars with `ProgressTrack`, needs-attention list (Fix / Enter UAN), status ring, latest ECR card with download, recent activity.
  - ECR history: financial-year filter, month rows (members, EPF wages, employee 12%, employer, total, Locked/Draft badge, Download ECR), expandable row fetching `?month=&year=` for EPS 8.33%, EPF A/c 01 3.67%, EDLI wages, NCP days and the member table.

- [ ] **Step 1: Write failing tests**: overview with zero counts shows `0%` and no `NaN` (Review Focus 2); needs-attention item renders its reason and a Fix button; ECR tab with two months renders both labels newest first and a `Draft` badge for an unlocked one; empty `months` renders an `EmptyState`.
- [ ] **Step 2: Run** `npx vitest run src/components/payroll/epfo/overview-ecr.test.tsx` → FAIL.
- [ ] **Step 3: Implement** both components, with loading skeletons and an inline error state with Retry.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(epfo): overview dashboard and ECR history tabs`.

---

### Task 6: Page, navigation and Salary setup cleanup

**Files:**
- Create: `src/app/payroll/epfo/page.tsx`
- Modify: `src/components/shell/nav.ts` (add `{ label: "EPFO compliance", href: "/payroll/epfo", icon: ShieldCheck }` after "Salary setup"), `src/app/payroll/staff/page.tsx` (remove the top dual tabs, EPFO state, `EpfoMembersTab` and `StaffProfileModal` fix flow; redirect `?tab=epfo`), shell tests that assert nav items if any
- Delete: `src/components/payroll/epfo/EpfoMembersTab.tsx`, move still-valid assertions of `EpfoMembersTab.test.tsx` into the new test files and delete it
- Test: `src/app/payroll/epfo/page.test.tsx`, plus update `nav` tests

**Interfaces:**
- Consumes: Tasks 3-5 components; `Tabs` from `@/components/ui` (`TabItem = { id; label; count? }`); `StaffProfileModal` props as used in `payroll/staff/page.tsx` (`staff, open, onClose, onSaved, onDeleted, depts, desigs, shifts, initialTab, highlightedFields`), loading `fullStaffList`, depts, desigs, shifts exactly as that page's `fetchMeta` does.
- Produces: page component with `parseTab(value: string | null): TabId` exported for testing (invalid → `'overview'`); tab counts from `counts` (registration = `NEEDS_REGISTRATION + AWAITING_UAN`, kyc = `NEEDS_KYC`, exit = `NEEDS_EXIT`, ecr = months count, all = non-hidden total).

- [ ] **Step 1: Write failing tests**: `parseTab('kyc')` is `'kyc'`, `parseTab('bogus')` and `parseTab(null)` are `'overview'`; nav test expects an "EPFO compliance" item at `/payroll/epfo` in the Payroll group and hidden for approvers if the payroll group already is.
- [ ] **Step 2: Run** `npx vitest run src/app/payroll src/components/shell` → FAIL.
- [ ] **Step 3: Implement** the page (header "EPFO compliance" with "Mark as already filed" and "Staff directory" links, `Tabs`, active tab body, profile-fix modal wiring) and the Salary setup cleanup. Use `router.replace` to keep `?tab=` in the URL.
- [ ] **Step 4: Run** `npx vitest run` (whole suite) → PASS apart from the pre-existing type-only test-file errors; run `npx tsc --noEmit | grep -v "test.ts"` → no output.
- [ ] **Step 5: Verify in the browser**: start the dev server via `preview_start`, sign in with the project's seeded admin, open `/payroll/epfo`, switch every tab, resize to phone width, confirm `/payroll/staff?tab=epfo` redirects and Salary setup shows no EPFO tab. Capture a screenshot of Overview and one task tab.
- [ ] **Step 6: Commit** `feat(epfo): separate EPFO compliance dashboard page`.
