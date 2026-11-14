# EPFO Compliance page - design

Date: 2026-11-15. Status: awaiting approval.

## Intent and why

The admin uses EPFO compliance whenever a new person joins, someone leaves, or KYC is due. Today it is a tab inside Salary setup; the user finds the UI confusing and the flow poor. They want a **separate page that feels like a dashboard** (the important numbers up front) with **one tab per pending task**: new joinee registration, KYC, bulk exit. It must also show **all ECR history with details**.

## Goals

- New page `/payroll/epfo`, sidebar entry "EPFO compliance" in the Payroll group.
- Tab bar directly under the page header, sticky: Overview, New joinee registration, KYC, Exit (bulk), ECR history, All members. Each task tab shows a pending-count pill.
- **Overview** (default tab): five tiles (pending registration, awaiting UAN, KYC pending, exits due, compliance %), pending-work bars, needs-attention list (people blocking an export, with Fix / Enter UAN), member status ring, latest ECR card, recent EPFO activity.
- **New joinee registration** tab: filter chips "To register" and "Awaiting UAN". Rows show per-field readiness chips (Aadhaar, Qualification, Mobile, Father name, ...), a Fix button for incomplete people, inline 12-digit UAN entry for awaiting-UAN rows, sticky action bar with "Download registration file".
- **KYC** tab: Aadhaar and PAN only (bank KYC is not accepted from employers). Shows documents per person and how many KYC lines will be generated. Download KYC file.
- **Exit (bulk)** tab: per-person exit reason select (default from existing `defaultExitReasonCode`), last working day, UAN, readiness. "Mark exit and download file".
- **ECR history** tab: one row per month from locked payroll (members, EPF wages, employee 12%, employer share, total) with financial-year filter; expanding a month shows EPS 8.33%, EPF A/c 01 3.67%, EDLI wages, NCP days and a member-wise table; Download ECR per month (existing text export).
- **All members** tab: searchable list of every EPF member with status, UAN and last filing dates (today's "All EPF" view).
- Keep working behaviour: mark as already filed, reset to pending, post-export undo banner, export summary dialog, profile "Fix" modal.
- Salary setup page loses the EPFO tab and goes back to pay group / CTC only; `/payroll/staff?tab=epfo` redirects to `/payroll/epfo`.

## Non-goals

- No changes to the bulk file formats (done earlier: filename, qualification code, KYC columns, name cleaning).
- No automatic submission to the EPFO portal; files are still downloaded and uploaded by hand.
- No new database tables. No change to payroll calculation.

## Anti-goals

- No wall of numbers: the Overview must not push the task lists out of reach (tabs live above it, not below).
- No hidden next step: every person always shows what is blocking them in plain words, not only in a hover tooltip.

## Constraints

- Next.js in this repo has breaking changes (AGENTS.md): read `node_modules/next/dist/docs/` before writing page/route code.
- Visual language is the approved one: black `#000` page, `#060607` canvas, `#0C0C0E` cards, `#1E1E22` borders, indigo accent, fixed status colours, white primary buttons, Geist. Use existing UI primitives (`Card`, `Chip`, `Button`, `Modal`, `EmptyState`) and tokens, not the throwaway mockup CSS.
- Admin-only (same `requireRole(['ADMIN'])` as the existing EPFO APIs).
- Must work at phone width (tabs scroll horizontally; tables fall back to cards as today).
- The mockup is `.superpowers/brainstorm/.../epfo-dashboard-v4.html` (not committed; `.superpowers/` should be git-ignored).

## Approaches considered

1. **New route, split the existing component, reuse APIs (chosen by me).** Reuses tested export/mark/undo behaviour; needs two small read-only endpoints. Lowest risk.
2. Full rewrite of the EPFO UI and APIs. Cleaner on paper, but re-opens logic that was just fixed against EPFO's validators. Rejected.
3. Keep it inside Salary setup and only restyle. Rejected: the user explicitly wants a separate page.

On layout, three options were mocked (task tabs with a joinee flow, one worklist page, pipeline board). The user chose **tabs per task with a dashboard overview**, then asked for the tab bar to sit directly under the header with Overview as the first tab (final mockup v4).

## Decisions

Made by the user: separate page; dashboard feel; tabs for registration, KYC, exit; ECR history with details; tab bar under the header.

My calls (flag if wrong):
- Compliance % = members whose next action is `UP_TO_DATE` divided by all EPF members (excluding `HIDDEN`).
- ECR history lists months that have payroll rows for EPF-group staff, newest first; a month is "Locked" when its payroll is locked, otherwise shown as "Draft" with download still allowed. Totals are computed from `MonthlyPayroll` fields (`epfWages`, `employeeEpf`, `employerEps`, `employerEpf`, `edliWages`, `ncpDays`).
- ECR due date shown as the 15th of the following month.
- "Recent activity" reads EPFO entries from the existing `AuditLog` (`EPFO_EXPORT_REG`, `..._EXIT`, `..._KYC`, reset/mark actions). ECR downloads are not logged today; I will add an `EPFO_ECR_DOWNLOAD` audit entry so they appear.
- Header buttons: keep "Mark as already filed"; drop "Download next batch" from the mockup (ambiguous across three file types).
- "Awaiting UAN" sits inside the registration tab as a filter chip, matching the user's mental model (joinee flow), not as its own tab.
- Exit tab warns when the exit month payroll is locked (existing `exitMonthPayrollLocked`).

## Left to the builder

- Exact component split and file names under `src/components/payroll/epfo/`.
- Response shape of the summary and ECR endpoints (e.g. `GET /api/payroll/epfo/summary`, `GET /api/payroll/epfo/ecr`), as long as they are admin-only, read-only and tested.
- Empty, loading and error states for each tab and tile.
- Moving/updating `EpfoMembersTab.test.tsx` and adding tests for the new endpoints and tabs.
- Accessible tab semantics (`role=tablist`, keyboard arrows) and deep-linkable tab state (e.g. `?tab=kyc`).
