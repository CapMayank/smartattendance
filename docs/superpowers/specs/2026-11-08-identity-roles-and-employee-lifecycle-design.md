# Identity, Roles and Employee Lifecycle: Design Spec

Date: 2026-11-08
Status: Draft for review
Part of: "Employee Service Portal" roadmap, sub-project 1 of 4 (next: "My" area, attendance
regularization, notices and notifications). This spec covers only sub-project 1 plus the
joining/leaving flow.

## 1. Intent

**Goal.** Turn the app from an admin-only tool into one that every employee can sign in to,
safely. Give each employee a permanent employee code to sign in with, give every signed-in
person a role that limits what they can see and do, and replace "add staff / delete staff"
with a real joining, leaving and rejoining flow that never loses history.

**Why.** The long-term aim is for an employee's dealings with school HR to run through this
app instead of paper and phone calls. Nothing in that roadmap can start until staff can sign
in and the app can tell an admin from a teacher. Today it cannot:

- Teachers have no login. `User` (NextAuth) has no role and no link to `Staff`.
- Any signed-in user can list, create and delete users (`/api/users`), and new users there
  get a plain SHA-256 password hash instead of bcrypt.
- Deleting a `Staff` row cascades to punches, daily records, payroll, shift history,
  suggestions and photos (seven `onDelete: Cascade` relations, plus a `SetNull` profile
  photo). A leaver's history is destroyed and a rejoin cannot be restored.
- Staff records are created implicitly (bulk import upsert, and `POST /api/attendance`
  auto-create), so there is no recorded "joining".

**Who uses it.** About 82 staff (teachers) of Sarvodaya Higher Secondary School, Lakhnadon,
one or two admins, and a Principal and Heads of Department as approvers.

**Success looks like this:**
- A teacher signs in with their employee code (for example `SAR-2024-012`) and a password
  they chose, and reaches only their own area. They cannot call an admin API.
- Existing admin logins keep working unchanged on day one.
- An admin can record a joining, an exit and a rejoining. Nothing is hard-deleted when
  someone leaves, and a rejoiner keeps their code and their entire history.
- Reports, the calendar and payroll no longer treat days outside someone's employment as
  absences.
- Punches from machine IDs that are not currently employed are kept for an admin to review
  instead of being dropped or auto-creating staff.
- Payroll and attendance numbers for people who have not been given a joining date are
  exactly as before.

## 2. Decisions

| Question | Decision | Source |
|---|---|---|
| Employee ID | Own `employeeCode`, format `SAR-<joining year>-<sequence>`, for example `SAR-2024-001`. Sequence restarts each year, 3 digits, grows to 4 past 999. Never edited, never reused, kept on rejoin (first joining year). | User |
| Machine ID as login | No. The machine ID belongs to the device and is guessable. | Recommendation, user agreed |
| Login screen | One box accepting email or employee code. Existing accounts become Admin. An admin who is also a teacher is linked to their staff record. | User |
| Roles | `ADMIN`, `APPROVER`, `EMPLOYEE` | User |
| Approver scope | Department-bound. Assigned departments only. The Principal is an Approver for all departments. | User |
| Approver visibility | Attendance, shifts and leave. No salary. The Principal can see payroll summaries only if an Admin turns that setting on. | User |
| First password and resets | Admin hands over a one-time temporary password. Employee must set their own at first login. Forgotten password is reset by an Admin. No email or SMS. | User |
| Access after leaving | None. Login off after the last working day. Admin prints or exports records on request. | User |
| Days outside employment | "Not employed": blank in the calendar, not counted as absent, late or NCP in reports and payroll. First and last month pay is still worked out from days present, as today. | User |
| Punches from non-employed IDs | Held in an Unmatched punches list for the Admin, who attaches them to a person or dismisses them. Nothing creates staff automatically on the device paths. | User |
| Rollout for existing staff | Everyone stays Active and nothing changes at deploy. A "Set joining dates" screen (CSV import and bulk edit) lists staff without a date. A code and login are issued only once the date is set. | User |
| Rejoin | Same person, same record, same code. New period, new joining date, prefilled and confirmed details, fresh shift assignment from the joining date. Old data is untouched. | User |
| Audit | Simple immutable audit log, visible to Admins only. | User |
| `POST /api/attendance` | Left as it is for now. Known open risk (see Section 11). | User |
| Build approach | Add to the existing model (Approach A, below). | User |

## 3. Scope

**In scope:**
- Roles on users, a shared authorization check on every API route, and page gating in `proxy.ts`.
- `/api/users` locked to Admin, with bcrypt for new passwords.
- `employeeCode` and `joiningDate`, the "Set joining dates" screen, code generation.
- Employee login by code, forced password change, rate limiting, Admin password reset.
- A minimal landing page for an employee (name, code, department, joining date, change password).
- Joining, exit and rejoin flows, `EmploymentPeriod`, a delete guard.
- Employment-aware calendar, reports, dashboard and payroll.
- Unmatched punches list.
- Audit log (table, helper, Admin view).
- Approver assignment to departments (data and enforcement on the existing screens an Approver may see).

**Out of scope (later sub-projects or later):**
- "My" area (attendance calendar, payslips, profile editing), regularization, leave requests,
  notices, notifications. This spec only creates the identity and role they will use.
- Hiring pipeline (vacancies, applicants, interviews). Joining covers people already hired.
- Final settlement or exit clearance checklists.
- Self-service password reset, phone-number login, email or SMS delivery.
- Securing `POST /api/attendance` (deferred by the user).
- Storing photos for punches that end up unmatched (consistent with the punch-photos spec).

**Anti-goals (a failure even if it technically works):**
- An exit or a delete that removes any past attendance, payroll or shift data.
- A teacher being able to read another person's data or any payroll data.
- Existing admins locked out at deploy, or payroll figures changing for staff with no joining date.

## 4. Constraints

- Stack stays as is: Next.js 16 (App Router), React 19, NextAuth v4 with credentials and JWT
  sessions, Prisma on PostgreSQL, vitest. `AGENTS.md` warns this Next.js has breaking changes:
  read the relevant guide in `node_modules/next/dist/docs/` before writing code. In particular
  `src/proxy.ts` is the request gate here, not `middleware.ts`.
- All calendar days are IST day keys (`YYYY-MM-DD`), as in the existing shift history. The
  process timezone is forced to `Asia/Kolkata`.
- Existing characterization tests (attendance, staff route) must keep passing.
- `ws-server.js` is plain Node outside Next. It and `/iclock/cdata` are device paths and do
  not use user sessions.
- Migrations must be additive and safe on a populated PostgreSQL database.

## 5. Approaches

**A. Add to what exists (chosen).** Keep `Staff` as the person. Add columns and new tables.
One shared role check on every route, one `isEmployed(staff, day)` helper. Touches the fewest
files and ships in independent slices. Cost: `Staff` keeps doing double duty as person and
current employee.

**B. Split person from employment (rejected).** Rename `Staff` to `Person` and hang
punches, payroll and shifts off a new `Employment` table. Cleaner model, but `Staff` is
referenced across most of the codebase and tests. Too much risk for this size of system.

(A plain status flag on `Staff` was considered and dropped: a rejoin would overwrite the earlier
dates and lose the history the user wants kept.)

## 6. Data model (additive)

Names are indicative. The builder owns exact naming and migration shape.

**`Staff`** adds:
- `employeeCode String? @unique`: null until a joining date exists.
- `joiningDate String?`: IST day key of the first joining. Set from the first period.

**`EmploymentPeriod`** (new):
- `id`, `staffId`, `startDate` (day key), `endDate` (day key, null while open, inclusive last working day),
  `exitReason` (`RESIGNED | TERMINATED | RETIRED | END_OF_CONTRACT | OTHER`, my call), `notes`,
  `createdByUserId`, `createdAt`.
- Rule: periods for one staff member never overlap. Staff with zero periods are "legacy":
  treated as employed on every date.

**`User`** adds:
- `role` (`ADMIN | APPROVER | EMPLOYEE`), default `ADMIN` so every existing account keeps working.
- `staffId String? @unique` linking to `Staff` (null for admins who are not staff).
- `mustChangePassword Boolean @default(false)`.
- `disabledAt DateTime?`.
- `approvesAllDepartments Boolean @default(false)` (the Principal, my call).

**`ApproverDepartment`** (new): `userId`, `departmentId`, unique pair.

**`UnmatchedPunch`** (new): `id`, `machineId`, `timestamp`, `type`, `receivedAt`, `reason`
(`UNKNOWN_ID | NOT_EMPLOYED`), `resolvedAt`, `resolvedByUserId`, `resolution`
(`ATTACHED | DISMISSED`), `attachedStaffId`.

**`AuditLog`** (new): `id`, `at`, `actorUserId`, `action`, `targetType`, `targetId`,
`details` (JSON). No update or delete code path exists for it.

**Cascade change (my call):** change the seven cascading `Staff` relations
(`AttendanceLog`, `DailyRecord`, `StaffPayrollInfo`, `MonthlyPayroll`, `ShiftAssignment`,
`ShiftSuggestion`, `PunchPhoto`) from `onDelete: Cascade` to `Restrict`, so a stray delete
cannot wipe history even if the API guard is bypassed. The profile-photo `SetNull` relation
stays.

**Login lockout (my call):** applies to every identifier, admin emails included. 5 failed
attempts lock that identifier for 15 minutes. An Admin password reset clears the lockout;
otherwise it expires on its own. Builder chooses storage (a table survives restarts and
works across instances).

## 7. Authorization

One server helper, for example `requireRole(session, ...roles)` plus
`scopeStaffForApprover(user)`, used by every route handler. Pages are gated again in
`proxy.ts` by role (token must carry `role`, `staffId`, `mustChangePassword`).

| Area | Admin | Approver | Employee |
|---|---|---|---|
| Dashboard, Staff, Calendar, Reports, Member attendance, Shifts (view) | all | own departments only | no |
| Shifts (change), Manual punch, Holidays, Departments, Designations, Devices, Settings, Users | yes | no | no |
| Payroll: monthly, salary setup, member payroll, analytics | yes | no, except Principal summaries when the Admin setting is on | no |
| Joining, exit, rejoin, set joining dates, unmatched punches, audit log, password reset | yes | no | no |
| Own landing page, change own password | yes | yes | yes |

- A forced password change blocks every other page and API until done.
- Device endpoints (`/iclock/*`, `ws-server.js`, `POST /api/attendance`) are not role-gated
  (they are not user sessions).
- "Principal payroll summaries" setting lives with the other app settings, and the builder
  chooses the exact storage. Which summaries (monthly totals, not individual salaries) is
  left to the builder, defaulting to totals with no per-person salary.
- Any route currently open without a session check (`/api/payroll/export/[type]`,
  `/api/payroll/[id]`, `/api/photos/[id]`, `/api/staff/[id]/*`, `/api/shifts/[id]`,
  `/api/shifts/suggestions/[id]/*`) must be checked and gated. The route inventory is the
  builder's first task.

## 8. Employee code and login

- **Generation.** Inside a transaction: year = year of the first period's `startDate`;
  sequence = highest existing sequence for that year + 1; format `SAR-YYYY-NNN` (`SAR`
  from `SCHOOL_SHORT`-style config, a separate constant since `SCHOOL_SHORT` is `SEHSS`).
  A unique constraint is the backstop for concurrent creation.
- **Normalisation at login.** If the input contains `@` it is an email. Otherwise uppercase
  it, strip spaces and hyphens, and match against the normalised code (so `sar2024012`
  works).
- **Passwords.** bcrypt, minimum 8 characters, must differ from the temporary password.
  The legacy SHA-256 upgrade path in `authorize()` stays.
- **Temporary password.** Generated server-side, shown to the Admin once, stored only as a
  bcrypt hash, `mustChangePassword = true`.
- **Disabled and exited.** `authorize()` refuses a user with `disabledAt` set, or whose linked
  staff has periods but none covering today.
- **Revocation is immediate (my call).** JWTs are not trusted for access on their own. The
  role helper (`requireRole`) re-reads the user (role, `disabledAt`, linked staff and
  periods, `mustChangePassword`) from the database on every API request, so an exit, a
  disable or a role change takes effect on the next request. With about 82 users the extra
  query is negligible. `proxy.ts` cannot query Prisma easily, so page gating there is
  token-based, and each protected page layout and every API route does the authoritative
  database check. A stale token can at worst load an empty shell, never data.
- **Rate limit.** As in Section 6.

## 9. Joining, exit, rejoin

**Set joining dates (rollout).** A screen listing staff with no period: CSV import (match by
machine ID) and bulk edit. Saving a date creates their first period, assigns the code and
creates the linked `EMPLOYEE` user with a temporary password. The admin gets a downloadable
sheet of codes and temporary passwords, shown once. No payroll or report change for anyone
until their date is set.

**Joining (new person).** Admin form: name, machine ID, department, designation, shift,
joining date (required). Creates `Staff`, first `EmploymentPeriod`, code, linked user with a
temporary password, and an initial shift assignment from the joining date. Payroll details
stay on the existing Salary setup page. There is no draft state (my call).

**Exit.** Admin picks a person, last working day, reason, notes. Sets the open period's
`endDate`. After that day the login stops working, the person leaves active lists, the
dashboard and future payroll, and all history stays. Exit in the future is allowed; it takes
effect on the day after.

**Rejoin.** Admin searches exited people by name, code or machine ID. The form is prefilled
from their last period (department, designation, machine ID, payroll info); the Admin
confirms or edits each. Creates a new period (it must start after the previous `endDate`),
a fresh shift assignment from the new start date, re-enables the user with a new temporary
password. The code does not change.

**Delete.** Allowed only for a record with no punches, daily records, payroll or shift
assignments other than the initial one (a mistaken duplicate). Anything else returns 409
telling the Admin to use Exit. The bulk delete path gets the same guard. Because the
relations become `Restrict`, the allowed delete removes the child rows that cascade used to
remove (`StaffPayrollInfo`, the initial `ShiftAssignment`, the period, the linked user)
explicitly, in one transaction.

**Creating staff (my call).** Once slice 2 ships, no route creates a dateless staff record.
`POST /api/staff` and new rows in the bulk CSV upsert go through the joining flow: a joining
date is required, and a bulk row without one for a new machine ID is rejected with a
per-row error. Existing records are untouched, and existing rows in a bulk upsert keep
updating details without a date. The "legacy" (no period) state therefore only ever holds
people who were already in the system at deploy. Until slice 2, these routes behave as
today.

**Bulk import.** The existing CSV upsert keeps updating details but never sets an exit, and
accepts an optional joining date column (required for rows that create a new person, as above).

**Users page (my call).** Admins manage logins from the existing Users page. It edits
`role`, the linked staff record (`staffId`) and approver departments, and can disable a
user and reset a password. Principal and Heads of Department are normally teachers, so
they are staff-linked users who sign in by employee code with a temporary password, like
employees. Admin-only accounts that are not staff keep signing in by email. An existing
admin who is also a teacher is linked to their staff record here. Changing the role of a
staff-linked user is allowed. The last remaining enabled Admin cannot be disabled or demoted.

## 10. Employment-aware reports, device punches, audit

**`isEmployed(staff, day)`** is the single rule: true if the staff has no periods (legacy)
or any period covers the day (`startDate <= day` and `endDate` null or `>= day`). It is used
by the calendar, reports, member attendance, dashboard counts and payroll. A day outside
employment is blank, not absent. The payroll formula (pay on days present over total days
in the month) is unchanged; only absent, late and NCP counts stop including non-employed days.

**Past data and locked months (my call).** `isEmployed` is applied at read time, in the
readers. Saving a joining date never rewrites or deletes existing `DailyRecord` rows, and a
`MonthlyPayroll` that is already locked is never modified: figures already issued stay as
issued. `recalculateRange` (`attendance-range`) stops writing records for non-employed
days, so future recalculation of unlocked months is clean. If a joining date falls inside a
locked month, saving it is allowed and the screen shows a warning that the locked payroll
is unchanged. Unlocked months pick up the new rule the next time they are recalculated, and
the "Set joining dates" screen offers a recalculate option for affected unlocked months.

**Device punches.** For a punch received by `ws-server.js` (the only path that writes
`AttendanceLog` today; `/iclock/cdata` only logs and returns OK, and stays that way) whose
machine ID matches no staff, or matches staff who are not employed on the punch date, store
an `UnmatchedPunch` and do not touch attendance. `ws-server.js` is plain CommonJS Node and
cannot import the TypeScript `isEmployed`, so the rule is duplicated as a small JS module in
`ws-lib/`, with a test that checks it agrees with the TypeScript version on the same cases.
The Admin list offers Attach (to a person, creating the `AttendanceLog` and triggering
recalculation) or Dismiss. Legacy staff (no periods) always match, so nothing changes at
deploy. `POST /api/attendance` is not changed (Section 11).

**Audit log** records: joining, exit, rejoin, joining-date edits, role changes, approver
department changes, password resets, user create and delete, unmatched punch decisions.
Admin-only read view, newest first, filter by actor, target and action.

## 11. Known risks left open

- `POST /api/attendance` is unauthenticated, auto-creates staff and accepts forged punches.
  The user chose to defer it. Until it is closed, "nothing creates staff automatically"
  holds for the device paths (`ws-server.js`, `/iclock`) only.
- Staff with no joining date have no login. This is intended during rollout, but it means
  roll-out speed depends on the Admin entering joining dates.
- Cascade to Restrict will make any code or script that deletes staff directly fail. The
  builder should grep for such usage (the staff routes and bulk route are the known ones).

## 12. Delivery slices (each shippable on its own)

1. **Roles and lockdown.** Schema (`role`, `staffId`, `ApproverDepartment`, `AuditLog`),
   `requireRole` (with the per-request database check) on all routes, `proxy.ts` gating,
   `/api/users` Admin-only with bcrypt, Users page edits role, staff link and approver
   departments, session carries role, audit helper. Security fix, goes first. Existing
   accounts are Admin so nobody loses access.
2. **Joining dates, codes, employee login.** `EmploymentPeriod` table, Set-joining-dates
   screen, the Joining (new person) form, code generation, employee login, forced password
   change, rate limit, Admin reset, employee landing page, and the rule that no route creates
   dateless staff.
3. **Exit, rejoin, employment-aware reports.** Exit and rejoin flows, `isEmployed`
   everywhere (including `recalculateRange`), delete guard, Cascade to Restrict.
4. **Unmatched punches and audit view.** `ws-server.js` change and `ws-lib` rule, review
   list, audit read UI.

Tests: unit tests for the code generator, login normalisation, `isEmployed`, role helper and
rate limit. Route tests (existing fake-prisma pattern) for every gated route covering each role.
The existing characterization tests stay green.

## 13. Left to the builder

- Exact table and column names, migration order, and the lockout storage.
- Which screens exist for approvers in slice 1 versus later (the matrix in Section 7 is the rule).
- UI layout for the joining, exit, rejoin, set-joining-dates, unmatched and audit screens,
  following the existing Space Black UI.
- Exact wording, validation messages and CSV column names.
- The Principal payroll-summary content and where its setting is stored.
