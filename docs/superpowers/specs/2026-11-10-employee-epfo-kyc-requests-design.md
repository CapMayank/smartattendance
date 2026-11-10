# Design: Employee EPFO & KYC Self-Service and Approval Flow

**Date:** 2026-11-10 · **Status:** Approved
**Scope:** Employee self-service visibility, mandatory completion alert banner, profile change request submission for all EPFO/KYC statutory fields, and admin/approver review & approval workflow.

---

## 1. Why

EPFO bulk registration and KYC seeding require complete, valid statutory records (Aadhaar not starting with 0/1, IFSC with 0 at 5th character, father/husband name, marital status, gender, nationality, and document names). Currently, administrators must track down missing fields manually. By surfacing all statutory fields to employees on their portal, showing a mandatory alert when records are incomplete, and allowing them to submit verified details via the existing `ProfileChangeRequest` workflow, employees take ownership of their compliance data while administrators maintain strict oversight and approval before anything updates in the database.

---

## 2. Goals / Non-goals / Anti-goals

### Goals
1. **Employee Visibility:** Expose all 14 EPFO/statutory fields on `GET /api/employee/profile`.
2. **Dashboard Compliance Alert:** Show a prominent mandatory alert on `EmployeeMyDashboard` when an active EPF member has missing statutory/KYC details, with a one-click CTA to open the edit modal.
3. **Comprehensive Edit Request Modal:** Expand `RequestProfileEditModal` so employees can view current values, enter corrections/additions for all EPFO fields, and submit a single `ProfileChangeRequest`.
4. **Strict Server Validation:** Validate submitted fields in `POST /api/employee/profile-requests` using EPFO statutory rules (Aadhaar `^[2-9]\d{11}$`, IFSC `^[A-Z]{4}0[A-Z0-9]{6}$`, etc.).
5. **Admin Approval & Persistence:** On approval via `POST /api/admin/profile-requests/[id]/decide`, update all approved EPFO fields on `StaffPayrollInfo` inside a Prisma transaction and log an audit event.
6. **Admin Diff Inspection:** Show human-friendly field labels in `ProfileRequestsTab` so admins and approvers can easily inspect the side-by-side diff before approving or rejecting.

### Non-goals
- Automatic bypassing of approval: employees can never directly write to `StaffPayrollInfo` without admin approval.
- Modifying salary CTC or pay group from the employee side.
- Direct uploads of binary scanned document attachments (this uses existing text/number verification).

---

## 3. Data Flow & Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Employee
    participant Dashboard as Employee Dashboard
    participant Modal as RequestProfileEditModal
    participant EmpAPI as /api/employee/profile-requests
    participant DB as PostgreSQL (Prisma)
    participant AdminUI as ProfileRequestsTab (/requests)
    actor Admin
    participant AdminAPI as /api/admin/profile-requests/[id]/decide

    Dashboard->>Employee: Display Mandatory Compliance Alert (if KYC incomplete)
    Employee->>Modal: Open Edit Request Modal
    Modal->>EmpAPI: POST { requestedData, reason }
    EmpAPI->>DB: Create ProfileChangeRequest (status: PENDING)
    AdminUI->>Admin: Show requested vs current diff with labels
    Admin->>AdminAPI: POST { action: 'APPROVE', remarks }
    AdminAPI->>DB: Upsert StaffPayrollInfo with EPFO fields, mark APPROVED, AuditLog
    DB->>Dashboard: Alert disappears; member is Ready in EPFO Compliance Hub
```

---

## 4. Detailed Component Changes

### 4.1 Employee Profile & Readiness API (`/api/employee/profile`)
Include all statutory fields on the returned `profile`:
- `maritalStatus`, `relationship`, `nationality`, `qualification`
- `nameOnAadhaar`, `nameOnPan`, `nameOnUan`, `previousMemberId`
- `isInternationalWorker`, `countryOfOrigin`, `passportNumber`, `passportValidFrom`, `passportValidTill`
- `isPhysicalHandicap`, `locomotive`, `hearing`, `visual`
- Compute `epfoReadiness`:
  - `isBankEpf`: boolean (`payGroup === 'BANK_EPF'`)
  - `ready`: boolean (result of `validateForRegistration` or `validateForKyc`)
  - `missingFields`: array of missing field display names
  - `hasPendingRequest`: boolean if a `PENDING` `ProfileChangeRequest` already exists

### 4.2 Dashboard Mandatory Alert (`EmployeeMyDashboard.tsx`)
When `profile.epfoReadiness.isBankEpf` is true and `ready` is false:
- If `hasPendingRequest`: Display an informational banner: *"KYC & EPFO details update request submitted — pending admin review."*
- If no pending request: Display a prominent mandatory action banner:
  *"Action Required: Complete Mandatory KYC & EPFO Details — Your statutory records are incomplete for EPF compliance ({N} fields missing). Please review and submit your details."*
  Includes button: **Complete KYC & EPFO Details** which opens `RequestProfileEditModal` directly on the `statutory` tab.

### 4.3 Employee Edit Modal (`RequestProfileEditModal.tsx`)
- Tab 1 (`personal`): Add `maritalStatus` (Select: Married, Unmarried, Widowed, Divorced), `relationship` (Select: Father, Husband), `nationality`.
- Tab 3 (`statutory`):
  - Identity document names: `nameOnAadhaar`, `nameOnPan`, `nameOnUan`, `previousMemberId`.
  - Collapsible `<details>` section for **Additional EPFO Details**:
    - International Worker (`isInternationalWorker`, `countryOfOrigin`, `passportNumber`, `passportValidFrom`, `passportValidTill`).
    - Disability (`isPhysicalHandicap`, `locomotive`, `hearing`, `visual`).

### 4.4 Employee Request API (`POST /api/employee/profile-requests`)
- Accepts and cleans all statutory EPFO fields.
- Validates:
  - Aadhaar: `^[2-9]\d{11}$` (12 digits not starting with 0 or 1).
  - IFSC: `^[A-Z]{4}0[A-Z0-9]{6}$` (11 chars with 0 at 5th character).
  - PAN: `^[A-Z]{5}\d{4}[A-Z]$`.
  - Relationship: strictly `Father` or `Husband` (or mapped F/H).
  - Passport validity dates if international worker is `Y`.
- Saves snapshot into `currentData` and changes into `requestedData`.

### 4.5 Admin Approval API (`POST /api/admin/profile-requests/[id]/decide`)
- Extends `payrollFields` to include all 14 EPFO fields.
- Upserts `StaffPayrollInfo` with the new values in a single `$transaction`.
- Writes `AuditLog` entry `PROFILE_CHANGE_APPROVED` with applied changes (and masks/redacts sensitive numbers if logged).

### 4.6 Admin Requests Tab (`ProfileRequestsTab.tsx`)
- Maps all field keys to human-readable labels in `PROFILE_FIELD_LABELS`:
  - `nameOnAadhaar`: "Name as per Aadhaar"
  - `nameOnPan`: "Name as per PAN"
  - `nameOnUan`: "Name on UAN"
  - `previousMemberId`: "Previous EPFO Member ID"
  - `maritalStatus`: "Marital Status"
  - `relationship`: "Father / Husband Relationship"
  - `nationality`: "Nationality"
  - `isInternationalWorker`: "International Worker"
  - `passportNumber`: "Passport Number"
  - `isPhysicalHandicap`: "Disability Status"
  - etc.

---

## 5. Testing Plan

1. **Unit & API Tests:**
   - Test `GET /api/employee/profile` returns statutory fields and readiness summary.
   - Test `POST /api/employee/profile-requests` validation: rejects malformed Aadhaar (leading 0/1) or invalid IFSC; accepts valid EPFO fields.
   - Test `POST /api/admin/profile-requests/[id]/decide` updates `StaffPayrollInfo` with all 14 statutory fields on approval.
2. **Component Tests:**
   - Test `EmployeeMyDashboard` renders mandatory alert banner when KYC is incomplete.
   - Test `RequestProfileEditModal` renders EPFO fields in statutory/personal tabs and submits change request.
   - Test `ProfileRequestsTab` renders labels and diffs for EPFO fields.
