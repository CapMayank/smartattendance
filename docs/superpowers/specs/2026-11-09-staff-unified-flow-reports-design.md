# Staff Unified Flow, Profile Model View, & Lifecycle Reports: Design Spec

Date: 2026-11-09
Status: Draft for review
Part of: School HR & Staff Management Experience

---

## 1. Intent & Context

### Goal
Provide a unified, interconnected experience for school staff (teachers) lifecycle management:
1. **Unified Staff Profile Model View**: Consolidate teacher/staff information, portal credentials/roles, department/designation/shift setup, biometric ID, and personal/demographic/banking details into one comprehensive view/edit modal (leaving salary/CTC calculation for `/payroll/staff`).
2. **Dedicated Add & Reactivate Flow**: Replace embedded onboarding cards on `/staff` with a clean modal that explicitly checks: *"Is this member previously part of the organization?"* If yes, seamlessly search past exited members and reactivate them with preserved history; if no, perform standard onboarding.
3. **Restricted & Confined Delete Action**: Eliminate immediate table-row trash buttons. Relocate deletion into a protected "Danger Zone" inside the staff modal, strictly restricted to correcting accidental mistake records with zero attendance or payroll history.
4. **Active Members by Default**: Display only active staff members on the main directory page by default, with quick filter chips (`Active`, `Exited`, `All`) for admin review.
5. **Staff & Headcount Lifecycle Reports**: Introduce a dedicated `/reports/staff` page featuring All Members, Exited Members, Joinings (Yearwise and custom ranges), and Department/Role headcount distributions, complete with CSV exports.
6. **Organized Dashboard Navigation**: Restructure sidebar navigation in `src/components/shell/nav.ts` into 6 clear, logical groups (`Overview`, `Staff`, `Attendance`, `Payroll`, `Reports`, and `System`).

### Why
Currently, managing teachers and staff suffers from fragmentation and risky UI patterns:
- Adding staff and CSV imports occupy extensive vertical screen space as static embedded forms above the table.
- A red trash can on every table row encourages accidental hard-deletions, which fail anyway if attendance exists, causing user confusion.
- Staff records are divided between `/staff` and `/payroll/staff`, with no single place to view or edit a teacher's personal details, documents, emergency contact, or KYC info without jumping into payroll settings.
- Re-employing a former teacher was hidden inside the edit modal of exited members, instead of being an intuitive path when onboarding.
- Reports for total headcount, leavers, and annual recruitment were missing.
- Navigation grouped unrelated reports under Attendance and Payroll, while Staff was orphaned under Overview.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **All Information in One Place**: An administrator can view and edit a teacher's identity, portal access, biometric link, department, shift (with past date recalculation preview), personal demographics, and bank/statutory details in a single tabbed modal.
- **Safe Lifecycle Management**: Rejoining former staff preserves all historical attendance logs, payrolls, and past employment periods, adding a new active period and issuing fresh credentials.
- **Accident-Proof Deletions**: An admin cannot delete a staff member by accident. Deletions require navigating to the Danger Zone of an un-engaged record (0 attendance logs, 0 payrolls) and confirming the intent.
- **Comprehensive Lifecycle Reporting**: School administrators can audit active roster, leavers with reasons and tenure, and historical recruitment by year (2026, 2025, etc.) with 1-click CSV exports.
- **Intuitive Nav Structure**: Seamless, role-respecting navigation that categorizes People, Attendance, Payroll, and Reports cleanly.

### Non-Goals
- **Salary / CTC Calculation**: Managing monthly CTC, salary increments, and PF wage calculations remains in `/payroll/staff` and `/payroll/monthly`. The staff profile view displays statutory details (Bank, IFSC, PAN, Aadhaar, UAN, Pay Group) but does not duplicate monthly CTC editing.
- **Custom Biometric Driver Protocol**: Biometric communication uses existing device machine IDs; no hardware changes.

### Anti-Goals
- **No Cascading Deletion of Historical Records**: Never allow deleting a staff member who has existing attendance or payroll logs.
- **No Overlapping Employment Periods**: Prevent creating open periods for staff who already have an active employment period.

---

## 3. Approaches Considered

### Approach 1: Integrated Micro-Modals & Modular Shell Architecture (Selected)
- **Modal-driven workflows**: Clean dedicated modals for "Add / Reactivate Staff", "Bulk CSV Onboard", and "Staff Profile & Access".
- **Dedicated reports route**: A purpose-built `/reports/staff` page providing tabbed headcount, exits, and annual joining analytics.
- **Why selected**: Preserves user context without heavy page navigation; delivers an interconnected, lightning-fast SPA feel; fits Next.js App Router patterns already used across the codebase.

### Approach 2: Full-Page CRUD Routes (`/staff/new`, `/staff/[id]`, etc.)
- Replaces modals with dedicated routing for each action.
- **Why rejected**: Creates jarring context switching for quick administrative edits and increases layout load overhead.

---

## 4. Detailed Specification

### 4.1. Navigation Architecture (`src/components/shell/nav.ts`)
Restructure navigation into 6 clean groups for `ADMIN`:
1. **Overview**:
   - `Dashboard` (`/`)
2. **Staff**:
   - `Staff Directory` (`/staff`, Icon: `Users`)
   - `Departments` (`/departments`, Icon: `Building2`)
   - `Designations` (`/designations`, Icon: `IdCard`)
3. **Attendance**:
   - `Calendar` (`/calendar`, Icon: `Calendar`)
   - `Shifts` (`/shifts`, Icon: `Clock`)
   - `Punch requests` (`/punches/requests`, Icon: `CheckCircle2`)
   - `Manual punch` (`/attendance/manual`, Icon: `PlusCircle`)
   - `Unmatched punches` (`/punches/unmatched`, Icon: `AlertCircle`)
4. **Payroll**:
   - `Monthly payroll` (`/payroll/monthly`, Icon: `Wallet`)
   - `Salary setup` (`/payroll/staff`, Icon: `IndianRupee`)
5. **Reports**:
   - `Staff & Headcount` (`/reports/staff`, Icon: `Users`)
   - `Attendance reports` (`/reports`, Icon: `BarChart3`)
   - `Member attendance` (`/reports/member-attendance`, Icon: `UserCheck`)
   - `Member payroll` (`/reports/member-payroll`, Icon: `Wallet`)
   - `Payroll analytics` (`/reports/payroll-analytics`, Icon: `PieChart`)
6. **System**:
   - `Devices` (`/devices`, Icon: `Server`)
   - `Settings` (`/settings`, Icon: `Settings`)
   - `Audit logs` (`/audit-logs`, Icon: `ScrollText`)

*Role adaptations & RBAC boundaries*:
- `ADMIN`: Full access to all 6 groups and all staff creation, update, lifecycle, and deletion operations.
- `APPROVER`: Restricted strictly from `/staff`, `/attendance/manual`, and `/punches/unmatched`. Under `Reports`, Approvers can access `/reports` and `/reports/member-attendance` scoped to their allowed departments. `/reports/staff` is an Admin HR tool (hidden from Approvers to protect school-wide staffing and exit confidentiality).
- `EMPLOYEE`: Unchanged `My Portal` navigation.

---

### 4.2. Staff Directory Page (`/staff`)
- **Header Actions**:
  - `Onboard Staff`: Opens the Add/Reactivate Staff modal.
  - `Import CSV`: Opens the Bulk CSV Import modal.
  - `Download Template`: Downloads the standard CSV onboarding template.
- **Default Filter**:
  - Filter mode initialized to `'active'`.
  - Filter chips: `Active` (count), `Needs joining date` (if any), `Admins & Approvers` (count), `Exited` (count), `All` (count).
- **Table Columns & Actions**:
  - Columns: Checkbox, Staff member (Avatar + name + email/joined), Employee ID & Machine, Access & Status, Department / Role, Pay group & Shift, Actions.
  - Row Action Buttons:
    1. `KeyRound`: Reset temporary password.
    2. `Calendar`: View Member Attendance (`/reports/member-attendance?staffId=...`).
    3. `Pencil`: Open Comprehensive Profile & Access Modal.
    4. *(Row Trash2 deleted entirely!)*
- **Bulk Operations**:
  - Bulk Delete is completely removed. Checkboxes support "Bulk Assign Shift" and "Bulk Export Selected to CSV".
- **URL Parameter Support**:
  - `/staff?rejoin=<id>`: If loaded with a `rejoin` query param (e.g. from the Exited Members report), automatically opens the Onboard modal in Flow A with that exited member selected.
- **Rejoin Date Semantics**:
  - If a staff member has multiple employment periods, their primary joining badge displays their active period start date, with a subtle indicator showing they are a rehire (e.g., `Rejoined 2026-06-01 · 2nd tenure`).

---

### 4.3. Onboarding & Reactivation Modal
- Replaces embedded top cards with a responsive `Modal`.
- **Top Choice Segment**:
  - *"Is this member returning to the organization?"* [No, New Member] / [Yes, Former Staff].
- **Flow A: Returning Staff Member (Rejoin)**:
  - Autocomplete / Search input against exited staff records.
  - Shows Exited Member Preview card: Name, past Employee ID (`SAR-YYYY-NNN`), past Department, and exit date/reason.
  - Re-employment form:
    - Biometric Machine ID (pre-filled with former machine ID, but editable if their physical biometric ID slot was reassigned to someone else during their absence; validated against active machine IDs).
    - New Joining Date (defaults to today; must be strictly after their last exit date).
    - Department, Designation, Assigned Shift.
    - Pay Group (`BANK_EPF` or `CASH`).
  - Calls `POST /api/staff/[id]/lifecycle` with action `'REJOIN'`.
  - Generates new login password while keeping the original Employee ID and preserving all prior logs and periods.
- **Flow B: New Staff Member**:
  - Sections:
    1. **Identity & Machine**: Full Name, Biometric Machine ID, Joining Date.
    2. **Role & Department**: Portal Access Role (`EMPLOYEE` / `APPROVER` / `ADMIN`), Approver department scope if approver, Department, Designation, Assigned Shift.
    3. **Personal & Contact (Optional)**: Mobile number, Unified Email (sets `User.email` for login and mirrors to `StaffPayrollInfo`), DOB, Gender, Father/Husband Name.
    4. **Pay Group**: Bank/EPF vs Cash.
  - Calls `POST /api/staff`, saves `StaffPayrollInfo` details, and generates new `SAR-YYYY-NNN` ID and temporary password.

---

### 4.4. Unified Staff Profile Modal ("Profile & Access")
Tabbed modal with 4 tabs + Danger Zone:

1. **Tab 1: Overview & Access**:
   - Profile photo display, pin/unpin or remove picture, upload/change picture.
   - Basic identity: Full name, Machine ID (editable), Employee ID badge (`SAR-YYYY-NNN`), Joining Date.
   - Portal access: System Role (`ADMIN`, `APPROVER`, `EMPLOYEE`), Unified Email login, Approver department multi-select (if Approver), and Temporary password reset button.
   - Status badge (`ACTIVE` / `EXITED`). If active, provides quick "Record Exit" action. If exited, provides "Reactivate Staff" action.
2. **Tab 2: Personal & KYC**:
   - Mobile number, Gender, Date of Birth.
   - Father / Husband Name, Relationship.
   - Highest Qualification, Nationality.
3. **Tab 3: Employment & Shift**:
   - Department and Designation dropdowns.
   - Current Shift assignment.
   - Shift Change with Retroactive Preview (days to recalculate, transition rows, locked payroll day warning).
   - Employment Period Timeline: Chronological list of joining dates, exit dates, exit reasons, and notes across all past stints.
4. **Tab 4: Banking & Statutory**:
   - Pay group (`BANK_EPF` or `CASH`).
   - Bank Account Number, IFSC Code, Name as per Bank.
   - PAN, Aadhaar Number, UAN (Universal Account Number).
   - *(Note: Monthly CTC is explicitly noted as configured in Salary Setup to avoid split-brain salary edits).*
5. **Danger Zone (Bottom of Overview/Admin tab)**:
   - "Delete Staff Member Record":
   - Guarded check: Disabled if `attendanceLogs.length > 0` or `monthlyPayrolls.length > 0` with tooltip *"Cannot delete staff with existing attendance or payroll history. Use 'Record Exit' instead."*
   - If 0 logs (genuine mistake addition): Requires clicking "Delete Mistake Entry" and confirming with double-check modal.

---

### 4.5. Staff & Headcount Reports Page (`/reports/staff`)
- **Page Header**: "Staff & Headcount Reports" — with CSV export button.
- **Tabs**:
  1. **All Members**:
     - Filterable by department, designation, and status.
     - Summary KPI cards: Total Staff (all time), Active Staff, Exited Count, Bank vs Cash count.
     - Table: Employee ID, Name, Department, Role, Machine ID, Joining Date, Pay Group, Status.
  2. **Exited Members**:
     - Summary KPI: Total Exits, Most Common Exit Reason, Average Tenure.
     - Table: Employee ID, Name, Department, Initial Joining, Last Working Day, Exit Reason, Notes, Total Tenure, Action button "Reactivate" (navigates to `/staff?rejoin=${id}`).
  3. **Joinings by Year**:
     - Year Selector: Dropdown of years (e.g., 2026, 2025, 2024, etc.) or "All Years".
     - Metric cards: New Joiners in Selected Year, Retention Rate (`[Staff who joined in Year X and remain Active] / [Total who joined in Year X] * 100`).
     - Table: Employee ID, Name, Joining Date (for that stint), Department, Role, Current Status. Rejoiners are included in each year they joined.
  4. **Department Distribution**:
     - Headcount and percentage share per department (`dept active / total active * 100`).
     - Breakdown by Designation within each department.
- **CSV Exports**:
  - Contextual CSV export reflecting the currently active report tab with formatted dates and headers.

---

### 4.6. API Endpoints

1. `GET /api/staff` & `PUT /api/staff`:
   - Updated to support reading and saving KYC/personal fields (`mobileNumber`, `dob`, `gender`, `fatherHusbandName`, `qualification`, `bankAccount`, `ifsc`, `pan`, `aadhaar`, `uan`) via relation to `StaffPayrollInfo`.
2. `GET /api/reports/staff`:
   - Dedicated endpoint returning structured data for `/reports/staff`:
     - `members`: full list with employment periods, pay groups, and demographic counts.
     - `exits`: list of exited periods with duration, reasons, and notes.
     - `joinings`: list of joining events with year, date, tenure stint, and current status.
     - `departments`: headcount aggregates and percentage share per department and designation.
3. `POST /api/staff/[id]/lifecycle`:
   - REJOIN action updated to optionally accept a new `machineId` if the previous ID was reallocated, validating uniqueness against active staff.
4. `DELETE /api/staff?id=...`:
   - Existing guard verified: checks logs and payrolls, blocks if any exist.

---

## 5. What's Left to the Builder
- UI micro-interactions, modal open/close transitions, and toast notifications.
- Visual token alignment (`tone-accent`, `tone-present`, `tone-absent`) matching the school's theme.
- Form validation handling (e.g. valid IFSC pattern, mobile length).

