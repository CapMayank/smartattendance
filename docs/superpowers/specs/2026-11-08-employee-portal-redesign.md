# Employee Portal Redesign, ToSchool Calendar, Professional Payslips & Punch Regularization: Design Spec

Date: 2026-11-08
Status: Draft for review
Part of: "Employee Service Portal" roadmap (sub-project 2: Multi-Page Employee Portal, ToSchool Attendance Calendar, High-Fidelity Payslips & Punch Regularization Workflow).

---

## 1. Intent & Context

### Goal
Transform the Employee area from a basic single-page dashboard into a fully functional, multi-page self-service portal for school staff. This includes:
1. **ToSchool Calendar (`/to-school`)**: An interactive monthly attendance calendar inspired by enterprise WFO (Work-From-Office) portals, presenting daily swipe summaries, logged hours, holidays, leaves, and bold "No Show" attention states, complemented by an Attendance Compliance Index panel with quarterly progress and monthly achievement rings.
2. **Professional Payslips & Formatted PDF (`/payslips`)**: A comprehensive, publication-grade school salary statement incorporating institutional letterhead, complete earnings/deductions, bank/EPF specifics, net salary in Indian words, and an instant downloadable vector A4 PDF via `/api/payroll/[id]/pdf` (replacing screen print dialogs).
3. **Punch History & Missed Punch Regularization (`/punch-requests`)**: Self-service tracking of raw biometric swipes and a formal request mechanism for employees to regularize missing check-in/check-out punches with category and justification.
4. **Admin & Approver Review Inbox (`/punches/requests`)**: An approval dashboard for school administrators and department approvers to inspect requests alongside existing punches, approve or reject with remarks, and automatically trigger biometric log creation and daily attendance recalculation.

### Why
Staff members (teachers, lab assistants, administrative staff) at Sarvodaya Higher Secondary School need transparency regarding their attendance records, working hours, and salary calculations. Currently:
- The employee portal is a single page on `/` (`EmployeeMyDashboard.tsx`) with limited metrics and no dedicated calendar.
- Staff who missed a biometric punch due to school duties, gate congestion, power outages, or forgotten swipes have no structured digital way to request a correction; it requires offline paper slips or verbal requests.
- Payslips in the portal are simplified modals with no itemized breakdowns or true PDF downloads (`window.print()` prints browser chrome and layout artifacts).
- School leadership lacks a unified digital workflow to review and approve punch exceptions with audit logging.

---

## 2. Decisions & Approaches

| Topic | Decision | Justification |
|---|---|---|
| **Information Architecture** | Dedicated multi-route portal (`/`, `/to-school`, `/punch-requests`, `/payslips`, `/change-password`). | Clean separation of concerns, persistent bookmarkable URLs, fast navigation, and ample space for rich calendar and analytics views. |
| **PDF Generation Engine** | Server-side vector PDF generation using `pdf-lib` via `/api/payroll/[id]/pdf`. | Zero browser-dependency, pixel-perfect A4 typography, custom school header/crest, works on mobile devices, downloads clean file without invoking browser print dialog. |
| **Punch Regularization Data Model** | New `PunchRequest` model in Prisma with relations to `Staff` and reviewer `User`. | Immutable history, status tracking (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`), and clear auditability. |
| **Approval Side-Effects** | On approval, insert `AttendanceLog` records, write an `AuditLog`, mark request `APPROVED`, and trigger `recalculateAttendance(date, date)`. | Reuses proven attendance recalculation engine; automatically updates `DailyRecord` status, work minutes, and late arrival calculations. |
| **Deduplication & Missing Punch Restrictions** | Request modal only allows requesting punch types (`IN`, `OUT`, `BOTH`) that are actually missing on that date. Approval strictly appends the requested punch without deleting raw logs. | Prevents duplicate consecutive punches, respects sequential pairing in `attendance-day.ts`, and protects raw device swipe auditability. |
| **Locked Months Guard** | Requests for dates in finalized payroll months (`isLocked = true`) are blocked with a clear notice. | Prevents silent inconsistency with `attendance-range.ts`, which refuses to alter locked historical payroll records. |
| **Submission Window & Admin Strictness Setting** | Default is flexible (any date in unlocked months). An admin configuration setting (`PUNCH_REQUEST_MAX_DAYS`, default `0` / Unlimited) allows admins to optionally enforce strict cutoffs (e.g., 3, 7, 14 days) in the future. | User directive: no strictness for now, with admin control to activate it as needed. |
| **Attendance Index Formula** | `(presentDays + 0.5 * halfDays) / elapsedWorkingDays * 100`, where elapsed working days exclude Sundays and declared holidays up to today. | Provides meaningful, non-penalizing compliance scores during ongoing months/quarters based on the Indian Financial Year (Q1: Apr-Jun, Q2: Jul-Sep, Q3: Oct-Dec, Q4: Jan-Mar). |
| **Leave vs. No Show** | Unpunched working days are marked as "No Show" (Absent); declared holidays and Sundays show distinct badges. Full multi-day leave management is reserved for sub-project 3. | Aligns with existing schema without premature complexity while matching the reference visual style. |
| **Request Cancellation & Resubmission** | Employees can cancel their own `PENDING` requests. Only one active `PENDING` request is allowed per date, but resubmissions are allowed if a previous request was rejected or cancelled. | Clean UX, prevents race conditions, and gives employees control over accidental submissions. |
| **Approver Permissions** | Department-scoped for `APPROVER` role; global for `ADMIN` and `approvesAllDepartments` users. | Consistent with existing RBAC rules in `src/lib/rbac.ts`. |
| **ToSchool Calendar Aesthetics** | Grounded in school vernacular with high-contrast status coding (Present in soft green, Holiday in soft lavender, Sunday off in subtle slate, No-Show in highlighted alert red) and right-side quarterly index rings. | Conforms to `/frontend-design` principles and the provided reference model without cliché SaaS templates. |

---

## 3. Scope & Non-Goals

### In Scope
- Database schema update: `PunchRequest` model, migrations, and seed/mock updates.
- Extended `EMPLOYEE_NAV` in `src/components/shell/nav.ts` with new routes.
- Extended `NAV` under "Attendance" for Admins/Approvers with live pending request badge.
- Pages:
  - Employee:
    - `/` (Updated My Overview with quick status, weekly summary, and recent requests)
    - `/to-school` (Full ToSchool monthly calendar, day details, and Compliance Index sidebar)
    - `/punch-requests` (My raw punch history + regularization request list + submit modal)
    - `/payslips` (My payslips archive + detailed viewer + PDF download)
  - Admin/Approver:
    - `/punches/requests` (Review and approve/reject punch regularization requests)
- Backend APIs:
  - `GET /api/employee/to-school` (Calendar day records, holiday overlays, quarterly compliance stats)
  - `GET /api/employee/punches` (Punches list with date filtering)
  - `GET /api/punch-requests` (List requests: scoped to employee if EMPLOYEE; scoped to dept if APPROVER; all if ADMIN)
  - `POST /api/punch-requests` (Submit new regularization request)
  - `PATCH /api/punch-requests/[id]` (Approve or Reject with remarks)
  - `GET /api/payroll/[id]/pdf` (Binary A4 PDF generator with streaming response)

### Non-Goals
- GPS/geofenced mobile mobile punching (all actual punches still originate from biometric hardware or approved manual requests).
- Overhauling EPF calculation formulas (all salary math builds on existing `payroll-calc.ts`).
- Leave management system (full multi-day leave application workflows are scheduled for sub-project 3).

---

## 4. Data Model Changes

### Prisma Schema (`prisma/schema.prisma`)

```prisma
model PunchRequest {
  id              String    @id @default(cuid())
  staffId         String
  date            String    // YYYY-MM-DD (IST day key)
  punchType       String    // "IN" | "OUT" | "BOTH"
  requestedTime   String?   // e.g. "09:00" if single punch
  requestedInTime String?   // e.g. "09:00" if BOTH
  requestedOutTime String?  // e.g. "16:30" if BOTH
  reason          String    // e.g. "FORGOT_SWIPE" | "DEVICE_OFFLINE" | "DUTY_OUTSIDE" | "POWER_FAILURE" | "OTHER"
  explanation     String?   // User-provided narrative explanation
  status          String    @default("PENDING") // "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
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

Add reverse relation on `Staff`:
```prisma
model Staff {
  // ... existing fields ...
  punchRequests PunchRequest[]
}
```

---

## 5. UI Architecture & Design

### 5.1 ToSchool Calendar (`/to-school`)
- **Header**:
  - Month/Year selector with quick jump controls.
  - Color-coded legend:
    - *Present*: Soft emerald tint (`tone-present`)
    - *Half Day*: Amber tint (`tone-late`)
    - *Holiday*: Soft lavender/indigo tint
    - *Sunday / Week Off*: Subtle slate tint
    - *Leave*: Cyan/Sky blue tint
    - *No Show / Missed*: Red alert border and badge (`tone-absent`)
- **Calendar Grid**:
  - 7 columns: Monday through Sunday.
  - Cells display:
    - Day number (e.g., `01`, `14`, `25`).
    - Work Duration bracket (e.g. `7-9 Hrs`, `5-7 Hrs`, `0-3 Hrs`, or `—`).
    - Location / Campus: "Lakhandon Campus".
    - Check-in & Check-out times if present (`In: 08:58 · Out: 16:32`).
    - If a working day has missing punches or absent status, display a prominent red **"No Show"** or **"Missed Swipe"** badge and a `+ Regularize` link that launches the pre-populated request modal.
- **Right Sidebar — My School Attendance Index**:
  - **Quarterly Compliance**: e.g., "Q3, FY 26-27" overall score with progress bar (e.g. 96%).
  - **Monthly Radial Achievement Rings**: Circular progress gauges for current and preceding 2 months (e.g., Jul 100%, Aug 98%, Sep 92%).
  - **Attendance Stats**: Total working days, Days Present, Late arrivals count, Average daily hours.
  - **Guidelines Box**: Institutional policy note detailing submission deadlines (e.g., "Requests must be raised within 3 working days of missed swipe").

### 5.2 My Punches & Regularization Requests (`/punch-requests`)
- **Header**: Tab switcher between *Punch History* and *My Requests*, with a prominent primary button `+ Request Missed Punch`.
- **Punch History Tab**:
  - Filters: Date range picker.
  - List of biometric records: Time (e.g., `09:02 AM`), Type badge (`IN` / `OUT`), Machine ID / Device name, and verification status.
- **My Requests Tab**:
  - Cards showing request status:
    - Badge: `PENDING` (yellow), `APPROVED` (green), `REJECTED` (red).
    - Details: Date, Punch type, Requested time, Reason, Submission date.
    - If decided: Approver's name and decision remarks.
- **Request Modal**:
  - Date input (defaults to today or selected calendar day).
  - Punch Type selector: `Check-in (IN)`, `Check-out (OUT)`, or `Both (Full Day)`.
  - Time input(s): Clean HH:MM picker.
  - Reason Category dropdown:
    - *Forgot to swipe biometric card*
    - *Assigned to official outdoor school duty / sports event*
    - *Biometric machine offline / network issue*
    - *Power failure at campus entrance*
    - *Other (specify below)*
  - Explanation textarea: Up to 300 characters.

### 5.3 Professional Payslips & PDF Export (`/payslips` & `/api/payroll/[id]/pdf`)
- **Online Payslip Viewer**:
  - Full-width card with institutional header:
    - "Sarvodaya English Higher Secondary School, Lakhnadon"
    - School logo / crest, affiliation details, address.
  - Employee Profile block: Name, Employee Code, Machine ID, Designation, Department, Date of Joining, Pay Group (`Bank / EPF` or `Cash`).
  - Attendance & Working Days metric strip: Total Days, Paid Days, LOP/NCP Days, Bonus Days.
  - Side-by-side Earnings & Deductions ledger:
    - **Earnings**: Basic Wage, Allowances/Bonus, Gross Salary.
    - **Deductions**: Employee EPF (12%), Advance Recovery, Total Deductions.
    - **Net Payable**: Highlighted in currency numeral (`₹ 18,450`) and written in words (`Rupees Eighteen Thousand Four Hundred Fifty Only`).
    - **Employer Contributions**: Employer EPF, Employer EPS, Total CTC.
    - **Signatures**: Institutional signature blocks (Accountant, Principal).
- **Direct PDF Export**:
  - Button `Download PDF` triggers `GET /api/payroll/[id]/pdf`.
  - Generated using `pdf-lib`:
    - Strict A4 dimensions (595.28 × 841.89 pt) with 36 pt margins.
    - Clean typography, institutional borders, colored status headers, tabular alignment.
    - Directly returned as binary `application/pdf` with immediate browser download.

### 5.4 Admin / Approver Review Inbox (`/punches/requests`)
- **Navigation**:
  - Placed under "Attendance" in `NAV`.
  - Dynamic pill badge showing count of pending requests (e.g. `3`).
- **Inbox Interface**:
  - Filter bar: Status (`Pending`, `Approved`, `Rejected`, `All`), Department filter, Date search.
  - Request Review Card / Table:
    - Staff Avatar, Name, Employee Code, Department.
    - Target Date and Requested Punch Details (`IN at 09:00 AM, OUT at 04:30 PM`).
    - Reason & Explanation.
    - Existing Punches context: Shows any biometric swipes already recorded for that staff member on that date (prevents duplicate logs).
    - Actions:
      - `Approve`: Confirms action, creates `AttendanceLog`, triggers `recalculateAttendance`, writes `AuditLog`.
      - `Reject`: Opens quick dialog for reason, marks `REJECTED`, writes `AuditLog`.

---

## 6. RBAC & Security

1. **`EMPLOYEE` Role**:
   - Authorized routes: `/`, `/to-school`, `/punch-requests`, `/payslips`, `/change-password`.
   - Data scoping: Enforced via `session.user.staffId`. An employee can never query or mutate another employee's records.
2. **`APPROVER` Role**:
   - Authorized to access `/punches/requests`.
   - Scoped strictly to staff members belonging to the departments assigned in `ApproverDepartment` (unless `approvesAllDepartments: true`).
3. **`ADMIN` Role**:
   - Global visibility across all departments and staff.

---

## 7. Verification & Success Criteria

1. **Schema & Database**:
   - Prisma schema validates and compiles cleanly.
   - Vitest suite covers `PunchRequest` model operations, status transitions, and cascade guards.
2. **Attendance Recalculation Integrity**:
   - Approving a punch request updates `DailyRecord` status (e.g. absent -> present) with correct worked minutes.
3. **PDF Generation**:
   - Calling `/api/payroll/[id]/pdf` returns a valid binary PDF with correct A4 layout, fonts, amounts, and headers.
4. **UI Performance & Responsiveness**:
   - Calendar renders smoothly on both mobile and desktop screens.
   - Clean keyboard accessibility and aria-labels for modal dialogues and calendar day cells.
5. **Existing Tests**:
   - All 583 existing tests continue to pass without regression.
