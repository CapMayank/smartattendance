# Selective Profile Approval & Edit Modal UX Redesign Specification

## 1. Intent & Context

When employees request updates to their profile and statutory KYC records (personal details, banking, EPFO/KYC documents), the current workflow has two major friction points:
1. **Modal Form Confusion:** When employees open `RequestProfileEditModal`, all inputs are empty strings (`""`) with faint grey placeholders. This creates anxiety that existing data has been wiped out or that all 28+ fields must be re-entered from scratch.
2. **All-or-Nothing Approval Bottleneck:** School administrators can only approve or reject the entire request as a monolithic block. If an employee submits an update with 3 correct fields (e.g. Mobile, Bank Account, IFSC) and 1 invalid field (e.g. PAN document mismatch), the administrator is forced to reject everything. The employee then has to re-enter all fields from scratch.

This spec defines:
1. An upgraded, reassuring employee edit modal with full pre-population, reassuring guidance, live modified indicators, and dynamic submission CTAs.
2. A field-level selective approval system allowing administrators to accept valid updates into the database, reject invalid fields with field-specific remarks, mark requests as `PARTIALLY_APPROVED`, and empower employees to fix and re-submit only the rejected items in one click.

---

## 2. Design System & UI/UX Principles (`ui-ux-pro-max`)

- **Pre-fill & Reassurance:** Every input is initialized with the employee's currently saved data. An explicit header banner confirms: *"Your saved records are pre-filled below. Only edit the fields you want to update. Untouched fields remain completely safe and unchanged."*
- **Modified State Clarity:** Any input modified by the user receives:
  - An inline `● Modified` chip in the field header.
  - A left accent highlight border (`border-acc-1/40`).
  - An inline `"↺ Revert"` button to instantly restore the original saved value.
  - An indicator below showing `Changed from: <original_value>`.
- **Dynamic & Transparent Actions:** The bottom bar displays an exact summary:
  - `0 fields modified`: Submit button is disabled (`No Changes Made`).
  - `X fields modified`: Submit button displays `Submit X Changes for Approval`.
- **Selective Decision Workspace (Admin):**
  - Diff table includes per-field toggle pills: `[✓ Approve]` (emerald) vs `[✗ Reject]` (rose).
  - Selecting `Reject` reveals an optional inline text field: `Rejection reason (e.g. document mismatch)`.
  - Action summary: `X of Y fields approved`.
  - Submit button dynamically updates to `Approve All`, `Reject All`, or `Confirm Decision (X Approved, Y Rejected)`.
- **Feedback & Re-Request Workflow:**
  - Statuses supported: `PENDING`, `APPROVED`, `REJECTED`, `PARTIALLY_APPROVED`.
  - Employee history cards display per-field status chips (`Approved ✓` or `Rejected ✗ (Reason)`).
  - For `PARTIALLY_APPROVED` or `REJECTED` requests: A direct button **"Fix & Re-Submit Rejected Details"** opens the modal focused on just the rejected fields with admin feedback attached.

---

## 3. Data Contracts & Interfaces

### 3.1. Decide Request Payload (`POST /api/admin/profile-requests/[id]/decide`)
```ts
export type DecideProfileRequestPayload = {
  action: "APPROVE" | "REJECT" | "SELECTIVE";
  approvedFields?: string[];      // Array of field keys approved (e.g. ["mobileNumber", "bankAccount"])
  rejectedFields?: string[];      // Array of field keys rejected (e.g. ["pan"])
  fieldRemarks?: Record<string, string>; // e.g. { "pan": "Name does not match PAN card" }
  decisionRemarks?: string;       // Overall administrator notes
};
```

### 3.2. Structured Decision Storage in `ProfileChangeRequest`
- `status`: `"APPROVED" | "REJECTED" | "PARTIALLY_APPROVED"`
- `decisionRemarks`: A structured JSON string (or human text with embedded JSON) storing:
  ```json
  {
    "note": "Approved banking and contact details. Please re-submit PAN.",
    "approvedFields": ["mobileNumber", "bankAccount"],
    "rejectedFields": ["pan"],
    "fieldRemarks": {
      "pan": "Name does not match PAN card"
    }
  }
  ```
- Backwards compatible with legacy plain-text remarks.

---

## 4. Components & Architecture

1. **`src/components/profile/RequestProfileEditModal.tsx`:**
   - Pre-fills `formValues` from `currentProfile`.
   - Tracks `initialValues` and detects diffs.
   - Renders reassurance banner and `● Modified` chips with `Revert` triggers.
   - Dynamic submit CTA and re-request mode.
2. **`src/app/api/admin/profile-requests/[id]/decide/route.ts`:**
   - Validates selective approval payload.
   - Updates `Staff` / `StaffPayrollInfo` / `User` ONLY for `approvedFields`.
   - Sets status to `APPROVED`, `REJECTED`, or `PARTIALLY_APPROVED`.
   - Records audit log with applied vs rejected field breakdown.
3. **`src/app/requests/ProfileRequestsTab.tsx`:**
   - Interactive diff table with Approve / Reject toggles per field.
   - Field rejection reason inputs.
   - Dynamic confirmation modal.
4. **`src/app/profile/EmployeeProfileClient.tsx`:**
   - Support `PARTIALLY_APPROVED` status chip with details breakdown.
   - Render "Fix & Re-Submit" CTA targeting rejected fields.
