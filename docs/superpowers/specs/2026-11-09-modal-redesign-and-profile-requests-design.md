# Modal Experience Overhaul & Unified Request Management: Design Spec

Date: 2026-11-09
Status: Ready for approval
Part of: School Staff & Administration Portal (Apple Aesthetic UI/UX)

---

## 1. Intent & Context

### Goal
1. **Modal Experience Overhaul**: Replace the cramped, one-size-fits-all modal dialogs (`w-[min(32rem,...)]` and `max-h-[70vh]`) with a flexible, Apple-inspired modal system supporting proportional sizes (`sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `full`), frosted backdrop blur, spacious typography, and clean bento card grouping so complex forms (`StaffProfileModal`, `StaffOnboardModal`, `StaffBulkImportModal`, `RequestPunchModal`) breathe naturally.
2. **Employee Profile & KYC Edit Requests**: Enable teachers and school staff in "My Portal" to review their personal, contact, banking, and statutory info (PAN, Bank Account, IFSC, Name as per Bank, Aadhaar, UAN, DOB, Guardian name, etc.) and raise formal change requests to administrators with reasons.
3. **Comprehensive Admin Request Center**: Upgrade `/punches/requests` into a unified, Apple-class **Request Center** (`/requests` with seamless backward compatibility) that unifies:
   - **Punch Regularizations** (missed biometric IN/OUT punches)
   - **Profile & KYC Edits** (before/after visual diffs, 1-click Approve/Reject with remarks, atomic database updates to `Staff`, `StaffPayrollInfo`, and `User`, and audit logging).

### Why
- The existing `Modal.tsx` caps dialog width at 32rem (512px). Heavy multi-tab forms like `StaffProfileModal` (Overview, KYC, Employment, Statutory) and multi-step onboarding forms are severely compressed, resulting in excessive vertical scrolling, jammed inputs, and poor UX.
- Employees currently have no self-serve channel to report changes in banking details (for salary disbursement) or statutory numbers (PAN, Aadhaar, UAN, PF). They are forced to communicate via ad-hoc offline messages, creating administrative delays and compliance vulnerabilities.
- Administrators currently have no central inbox to review staff change requests alongside attendance corrections.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **Breathable Modal System**: Modals adapt to content complexity (`size="sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full"`) with generous vertical viewport allowance (`max-h-[85vh]`), subtle frosted glass backdrop, and Apple-grade segmented tab navigation.
- **Self-Serve Profile Update Flow**: Staff can view their registered data, input updated values, preview changes, track request status, and submit requests from their portal dashboard.
- **Visual Diff & 1-Click Sync**: Admins see clear Before vs. After diff badges (green for additions, amber for modifications) and can approve changes with automatic synchronization into `Staff`, `StaffPayrollInfo`, and `User`.
- **Role-Aware Security & Audit Trail**: 
  - **Punch Regularizations**: Both `ADMIN` and `APPROVER` (department-scoped) can approve/reject.
  - **Profile & KYC Updates**: Strictly restricted to `ADMIN` (financial/statutory data authority). Approvers have view-only access or focus on punches.
  - Every approved or rejected request generates an immutable `AuditLog` entry.
- **Zero Breaking Changes**: Existing tests, routes, and modal usages continue working seamlessly.

### Non-Goals
- **Direct Employee Self-Editing Without Approval**: Employees cannot directly overwrite statutory or banking records without administrator review, ensuring payroll integrity.
- **Salary / CTC Modifiers in Profile Requests**: Monthly CTC and salary breakdown changes remain under `/payroll/staff` managed by HR/Accounts.

### Anti-Goals
- **No Multi-Destination Inboxes**: Avoid fragmenting approvals across separate disconnected admin pages; provide one unified Request Center with tabbed filtering.
- **No Data Loss on Approval**: Ensure approvals run inside atomic database transactions so partial failures never leave records out of sync.

---

## 3. Approaches Considered

### Approach 1: Unified Request Center with Modular Apple Modal Engine (Selected)
- **Modal System**: Upgrade `Modal.tsx` to accept a `size` prop defaulting to `'md'`, with fluid scaling, Apple frosted glass blur, sticky/floating headers, and standard padding tokens.
- **Data Model**: Introduce `ProfileChangeRequest` in Prisma with JSON payloads for `requestedData` and `currentData` snapshots.
- **Admin Hub**: Upgrade `/punches/requests` to a unified `/requests` center supporting both Punch Requests and Profile/KYC Update Requests with a single pending badge count in navigation.
- **Why selected**: Delivers an integrated Apple-like experience, keeps the navigation clean, eliminates duplicate code, and prevents cognitive overload for school administrators.

### Approach 2: Separate Disconnected Admin Pages (`/punches/requests` + `/staff/profile-requests`)
- Keeps punch requests where they are and builds a totally new page for profile requests under the Staff menu.
- **Why rejected**: Forces administrators to toggle between multiple pages to see pending employee requests.

---

## 4. Detailed Specification

### 4.1. Apple-Class Modal System (`src/components/ui/Modal.tsx`)

#### New Props
```typescript
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: ModalSize; // Defaults to 'md'
  maxHeight?: string; // Defaults to 'max-h-[85vh]'
  children: ReactNode;
  footer?: ReactNode;
  headerAction?: ReactNode;
};
```

#### Size Classes Mapping
- `'sm'`: `w-[min(26rem,calc(100vw-2rem))]` (Confirmations, pin resets)
- `'md'`: `w-[min(34rem,calc(100vw-2rem))]` (Standard single-focus dialogues)
- `'lg'`: `w-[min(44rem,calc(100vw-2rem))]` (Punch requests, payslip preview, password change)
- `'xl'`: `w-[min(56rem,calc(100vw-2.5rem))]` (Staff Onboarding, Profile edit request)
- `'2xl'`: `w-[min(68rem,calc(100vw-3rem))]` (Staff Profile Hub, Bulk CSV imports)
- `'3xl'`: `w-[min(78rem,calc(100vw-3rem))]` (Deep analytical views)
- `'full'`: `w-[calc(100vw-2rem)] max-w-7xl` (Full workspace)

#### Visual & Interaction Refinements
- **Backdrop**: Smooth backdrop blur (`backdrop-blur-md` in light mode with `rgba(15, 23, 42, 0.45)`, and dark mode with `rgba(0, 0, 0, 0.75)`).
- **Header**: Refined typography (`text-[17px] font-semibold tracking-tight text-text`), optional subtitle (`text-xs text-muted mt-0.5`), sleek `IconButton` with smooth hover transition.
- **Content Container**: `max-h-[85vh]` overflow with custom neutral scrollbar, `p-6` interior padding (or `p-5` on mobile).
- **Footer**: Refined sticky or border-t separation with `px-6 py-4`, supporting Apple-style secondary (Cancel) and primary (Submit) action buttons.

#### Updating Key Modals
- `StaffProfileModal.tsx`: Set `size="2xl"`. Group sections into Apple-style bento cards with segmented tab controls.
- `StaffOnboardModal.tsx`: Set `size="xl"`. Clean 2-column and 3-column field layouts with visual section dividers.
- `StaffBulkImportModal.tsx`: Set `size="2xl"`. CSV preview table gets comfortable horizontal and vertical breathing room.
- `RequestPunchModal.tsx`: Set `size="lg"`.
- `EmployeeMyDashboard.tsx` (Payslip preview): Set `size="lg"`.

---

### 4.2. Data Model: `ProfileChangeRequest`

Add to `prisma/schema.prisma`:
```prisma
model ProfileChangeRequest {
  id              String    @id @default(cuid())
  staffId         String
  status          String    @default("PENDING") // "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  requestedData   String    // JSON string of requested changes (e.g., { pan, bankAccount, ifsc, mobileNumber, email, ... })
  currentData     String?   // JSON snapshot of current values when request was raised
  reason          String?   // Reason provided by employee
  decidedByUserId String?
  decidedAt       DateTime?
  decisionRemarks String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  staff Staff @relation(fields: [staffId], references: [id], onDelete: Restrict)

  @@index([staffId, status])
  @@index([status])
  @@index([createdAt])
}
```

Add relation in `Staff`:
```prisma
profileChangeRequests ProfileChangeRequest[]
```

Supported change fields in `requestedData`:
- **Personal & Contact**: `name`, `email`, `mobileNumber`, `dob`, `gender`, `fatherHusbandName`, `relationship`, `qualification`
- **Banking**: `bankAccount`, `ifsc`, `nameAsPerBank`
- **Statutory / KYC**: `pan`, `aadhaar`, `uan`

---

### 4.3. Employee Experience: Raising Edit Requests

1. **Access Point in `EmployeeMyDashboard`**:
   - In "My Profile & Shift" header, add an Apple-style secondary action button: `Request Details Edit` (with `FileText` or `Edit3` icon).
   - Display pending status tag if a request is already awaiting admin review: `Pending Profile Review` pill.
   - If a recent request was rejected, display a subtle warning pill: `Previous Request Rejected - View Reason` which opens the history tab in the modal.
2. **`RequestProfileEditModal` (`size="xl"`)**:
   - **Segmented Tabs**:
     - **Personal Info**: Full Name, Login/Personal Email, Mobile, DOB, Gender, Father/Husband Name.
     - **Bank Account**: Account Number, Confirm Account Number, IFSC Code (with auto-uppercase and validation), Account Holder Name.
     - **Statutory KYC**: PAN (10-char uppercase check `^[A-Z]{5}[0-9]{4}[A-Z]{1}$`), Aadhaar Number (12-digit check), UAN.
     - **Request History**: Timeline of previous change requests with submission dates, statuses (`PENDING`, `APPROVED`, `REJECTED`), changes requested, and administrator decision remarks.
   - For every field, display current registered value alongside the input for proposed new value. Only non-empty modified values are submitted.
   - "Reason for Request" text area (e.g., "Updated salary bank account to SBI", "Corrected spelling in PAN").
   - Summary diff section before final submission highlighting only fields being changed.
3. **Data Sourcing (`GET /api/employee/profile`)**:
   - Authenticated endpoint providing the employee's existing profile & statutory info (PAN, Bank Account, IFSC, Name on Bank, Aadhaar, UAN, phone, email, etc.) for the logged-in user's own `staffId`.
4. **API Route `POST /api/employee/profile-requests`**:
   - Authenticates session; ensures user role is `EMPLOYEE` or has a linked `staffId`.
   - Validates format of PAN, IFSC, Aadhaar, email, and phone.
   - If `email` is updated, verifies that no other `User` already uses that email.
   - Confirms at least one field has changed.
   - Creates `ProfileChangeRequest` record.

---

### 4.4. Admin Experience: Comprehensive Request Center

1. **Unified Navigation**:
   - In `src/components/shell/nav.ts`:
     - Under `Attendance`, replace `Punch requests` (`/punches/requests`) with **`Requests & Approvals`** pointing to `/requests` (with icon `CheckCircle2` or `Inbox`).
     - Live badge showing total pending count: `pendingPunches + pendingProfileRequests`.
   - Add permanent redirect or route handler at `/punches/requests` so existing bookmarks seamlessly redirect to `/requests?tab=punches`.
2. **Unified Page (`/requests`)**:
   - Top level tabs:
     - **All Requests**
     - **Punch Regularizations** (with pending count badge)
     - **Profile & KYC Updates** (with pending count badge, visible to `ADMIN`, and view-only or hidden for `APPROVER`)
   - Filter bar: Status (`PENDING`, `APPROVED`, `REJECTED`, `ALL`), Department dropdown, and Search input.
3. **Profile & KYC Request Card & Diff Inspector**:
   - Card displays: Employee Avatar, Name, Employee Code, Department, Submission Date, and Employee Reason.
   - **Visual Diff Inspector**:
     - Visual side-by-side comparison table:
       - Column 1: Field Name (e.g. Bank Account, PAN)
       - Column 2: Current Value (or "Not Set")
       - Column 3: Requested Value (highlighted with subtle accent badge)
   - Actions:
     - **Approve Button** (Strictly `ADMIN` role):
       - Upon approval, runs an atomic database transaction:
         - Updates `Staff` (`name` if changed).
         - Updates `StaffPayrollInfo` (all banking & statutory fields, email, mobile, DOB, etc.).
         - If employee has a linked `User` record, updates `User.name` (if name changed) and `User.email` (if email changed, with uniqueness guard).
         - Marks `ProfileChangeRequest` as `APPROVED` with `decidedByUserId` and `decidedAt`.
         - Writes an `AuditLog` entry (`action: "PROFILE_CHANGE_APPROVED"`).
     - **Reject Button** (Strictly `ADMIN` role):
       - Prompts for decision remarks / feedback in an Apple-style modal dialog so the employee knows why it was rejected. Sets status to `REJECTED`, records `decidedByUserId`, `decidedAt`, and `decisionRemarks`.
4. **API Endpoints**:
   - `GET /api/admin/profile-requests`: Supports `status`, `departmentId`, `staffId` query parameters. Filters by approver department permissions if role is `APPROVER`.
   - `POST /api/admin/profile-requests/[id]/decide`: Body `{ action: 'APPROVE' | 'REJECT', remarks?: string }`. Strictly enforces `ADMIN` role; Approvers receive 403 Forbidden.

---

## 5. UI/UX Design Standards (Apple Aesthetic & `ui-ux-pro-max`)

- **Palette**: Monochromatic slate/zinc surfaces with subtle indigo/violet accents (`--color-acc-1`, `--color-acc-2`).
- **Surface Elevation**: Frosted glass dialog overlay (`backdrop-blur-md`), cards with `rounded-2xl`, borders with `--color-line` and `--color-line-soft`.
- **Typography**: Clean hierarchy using system sans / Geist sans with tabular numerals (`.num`) for codes, account numbers, and dates.
- **Micro-interactions**: 150-200ms smooth transitions on hover, focus-visible accessibility outlines, no jarring layout shifts.
- **Icons**: Lucide SVG icons only. No raw emojis.

---

## 6. Testing & Verification

1. **Unit & API Tests**:
   - `src/components/ui/Modal.test.tsx`: Test size prop classes, backdrop rendering, keyboard accessibility (Escape, focus trap).
   - `src/app/api/employee/profile-requests/route.test.ts`: Employee submission, field validations (PAN, IFSC, Aadhaar), prevent duplicate pending requests, email collision prevention.
   - `src/app/api/admin/profile-requests/route.test.ts`: RBAC checks (`ADMIN` can approve/reject, `APPROVER` is 403 on decide), listing and filtering.
   - `src/app/api/admin/profile-requests/[id]/decide/route.test.ts`: Approval applies atomic updates to `Staff`, `StaffPayrollInfo`, and linked `User`; writes audit log; rejection stores remarks.
2. **Regression Verification**:
   - Run full Vitest suite (`npm test`) to ensure all 723 existing tests pass without regression.
   - Verify all existing modals render properly with new modal size classes.
