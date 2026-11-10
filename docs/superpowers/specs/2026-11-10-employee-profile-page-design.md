# Design Specification: Dedicated Employee "My Profile" & EPFO/KYC Hub

## 1. Overview & Goal

Currently, employees only have access to a small summary card on their overview dashboard (`/`) and a popup modal (`RequestProfileEditModal`) to view/request changes. There is no dedicated `/profile` route or permanent place where an employee can view all of their recorded details in full (Personal, Employment, Banking, and EPFO Statutory KYC) and manage ongoing compliance.

The goal is to deliver a dedicated `/profile` page with comprehensive visibility into all fields, compliance status alerts, and integrated "Request Edit" CTAs connecting directly to the established `ProfileChangeRequest` approval workflow.

---

## 2. User Journey & Requirements

1. **Navigation to Profile**:
   - Employees see a prominent **My Profile** navigation link in `EMPLOYEE_NAV` (`/profile` with Lucide `User` icon).
   - In the sidebar user card dropdown, clicking their profile or "My Profile" navigates to `/profile`.
   - On `EmployeeMyDashboard`, a link "View Full Profile →" allows direct navigation from the overview page.

2. **Compliance & Alert Visibility**:
   - If an employee is on `BANK_EPF` pay group and has missing/incomplete statutory KYC details (`epfoReadiness.ready === false`):
     - A high-priority banner displays: *"Action Required: Complete Mandatory KYC & EPFO Details"*, listing the specific missing fields, with a CTA button **"Complete KYC & EPFO Details"** (which opens `RequestProfileEditModal` preset to `statutory`).
   - If an employee has already submitted an update request that is pending admin approval:
     - An informational amber banner displays: *"EPFO & KYC Update Pending Admin Review"*.
   - If compliance is complete (`ready === true`) or pay group is `CASH`:
     - A clean verification badge displays: *"EPFO Statutory Compliance: Up to Date"*.

3. **Information Organization (5 Detail Sections)**:
   - **School Identity & Employment**:
     - Employee Code, Machine ID, Department, Designation, Assigned Shift & Timings, Date of Joining, Pay Group (`Bank / EPF` or `Cash`), School Email.
   - **Personal & Contact Information**:
     - Full Name, Personal/Login Email, Mobile Number, Date of Birth, Gender, Father/Husband Name & Relationship, Marital Status, Nationality, Educational Qualification.
     - Section CTA: *"Edit Personal Details"*.
   - **Salary Bank Account**:
     - Bank Account Number (masked/formatted), Bank IFSC Code, Account Holder Name as per Bank.
     - Section CTA: *"Edit Banking Details"*.
   - **Statutory & EPFO KYC**:
     - Universal Account Number (UAN) & Name on UAN, Aadhaar Number & Name on Aadhaar, Permanent Account Number (PAN) & Name on PAN, Previous Member ID.
     - International Worker status, Country of Origin, Passport Number, Validity Dates (From & Till).
     - Physical Disability status (Locomotive, Hearing, Visual).
     - Section CTA: *"Update Statutory & KYC"*.
   - **Request History & Audit Log**:
     - Side-by-side or chronological card list of past change requests submitted by this employee, showing date, requested changes, current status (Pending / Approved / Rejected), and administrator remarks.

4. **Change Request Interaction**:
   - Clicking any section edit button or the primary header CTA opens `RequestProfileEditModal` focused on that specific tab (`personal`, `banking`, `statutory`, or `history`).
   - Submissions go through `POST /api/employee/profile-requests` requiring administrator decision before updating `StaffPayrollInfo`.

---

## 3. Technical Architecture

### 3.1 Data Flow & Page Fetching
- **Server Component (`src/app/profile/page.tsx`)**:
  - Validates session with `getServerSession(authOptions)`.
  - Ensures role is authenticated (`EMPLOYEE`, `APPROVER`, or `ADMIN`).
  - Calls `getEmployeePortalData(staffId)` (or queries prisma) to fetch identity, employment, KYC details, and `epfoReadiness`.
  - Queries `prisma.profileChangeRequest.findMany({ where: { staffId }, orderBy: { createdAt: "desc" } })` for full request history.
  - Passes data into `EmployeeProfileClient`.

### 3.2 Client Component (`src/app/profile/EmployeeProfileClient.tsx`)
- Manages:
  - `profileEditModalOpen`: boolean
  - `profileEditInitialTab`: `"personal" | "banking" | "statutory" | "history"`
  - Rendering formatted UI cards using design tokens (`@/components/ui`, Tailwind, Lucide React).
  - Refreshing data via `router.refresh()` on request submission.

### 3.3 Navigation (`src/components/shell/nav.ts` & `Sidebar.tsx`)
- Add `My Profile` item to `EMPLOYEE_NAV`:
  ```typescript
  { label: "My Profile", href: "/profile", icon: User }
  ```
- Add `My Profile` link to sidebar user dropdown in `Sidebar.tsx`.
- Update `nav.test.ts` to assert that `getNavForRole("EMPLOYEE")` contains `/profile`.

---

## 4. Testing & Verification

1. **Unit & Component Tests**:
   - `src/app/profile/page.test.tsx`:
     - Test that `/profile` redirects to `/login` when not authenticated.
     - Test that `/profile` renders the employee's personal details, banking, and EPFO fields.
     - Test that the mandatory KYC alert banner renders when compliance is incomplete.
     - Test that the pending review banner renders when a request is pending.
     - Test that clicking edit buttons opens the modal on the corresponding tab.
   - `src/components/shell/nav.test.ts`:
     - Update tests to assert that `/profile` is present in employee navigation.
2. **Regression Testing**:
   - Run full vitest suite (`npx vitest run`).
   - Run Next.js production build (`npm run build`) ensuring clean compilation.
