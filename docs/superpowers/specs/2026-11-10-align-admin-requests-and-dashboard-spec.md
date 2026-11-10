# Align Admin Requests UI and Dashboard Pending Status Specification

## 1. Intent & Context

The user reported two critical usability and design issues:
1. **Design System Inconsistency in Admin Requests UI:** The admin-side request handling interface in `src/app/requests/` was using foreign CSS classes (`text-foreground`, `bg-accent`, `border-border/80`, custom segmented tabs) that diverge from the canonical `@/components/ui` tokens used throughout the rest of the application (such as `PunchRequestsAdminClient.tsx`, `Tabs`, `text-text`, `text-muted`, `border-line`, `bg-card`, `bg-canvas`).
2. **Missing Pending Request Status on Admin Dashboard:** When staff members submit punch regularizations or statutory KYC updates, there was no pending status indicator, KPI, or attention alert on the school-wide admin dashboard (`src/app/page.tsx`), leaving administrators blind to pending review backlogs unless they manually visited `/requests`.

---

## 2. Design System Alignment (`ui-ux-pro-max`)

### 2.1. Requests Hub Tabs (`RequestsHubClient.tsx`)
- Replace ad-hoc pill container with the official design system `Tabs` component:
  ```tsx
  <Tabs
    tabs={[
      { id: "all", label: "All Requests", count: totalPending },
      { id: "punches", label: "Punch Regularizations", count: pendingPunches },
      { id: "profile", label: "Profile & KYC Updates", count: pendingProfile },
    ]}
    value={activeTab}
    onChange={(tab) => handleTabChange(tab as "all" | "punches" | "profile")}
  />
  ```

### 2.2. Profile Requests Review Tab (`ProfileRequestsTab.tsx`)
- Standardize all tokens to match `PunchRequestsAdminClient.tsx`:
  - Text: `text-text`, `text-muted`, `text-subtle`, `font-mono`.
  - Cards & Backgrounds: `bg-card`, `bg-canvas`, `bg-card-hi`.
  - Borders: `border-line`, `border-line-soft`.
  - Status Badges:
    - Pending: `border border-late/30 bg-late/10 text-late`
    - Approved: `border border-present/30 bg-present/10 text-present`
    - Partially Approved: `border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400`
    - Rejected: `border border-absent/30 bg-absent/10 text-absent`
- Selective Decision Modal:
  - Clean layout with `border-line-soft`, `bg-canvas`, and standard `@/components/ui` `Button` variants.

---

## 3. Admin Dashboard Pending Status Integration

### 3.1. Dashboard Calculation (`src/lib/dashboard.ts`)
- Query pending counts:
  - `pendingPunchRequests`: `prisma.punchRequest.count({ where: { status: "PENDING", ...deptFilter } })`
  - `pendingProfileRequests`: `prisma.profileChangeRequest.count({ where: { status: "PENDING", ...deptFilter } })`
- Populate `DashboardData["kpis"].pendingRequests`:
  - `punches`: count
  - `profile`: count
  - `total`: sum
- Prioritize in `DashboardData["attention"]`:
  - When pending punches > 0:
    `{ kind: "pending-punch-requests", title: "${count} punch requests awaiting review", detail: "Staff missed punch regularizations needing approval", href: "/requests?tab=punches" }`
  - When pending profile updates > 0:
    `{ kind: "pending-profile-requests", title: "${count} profile & KYC requests awaiting review", detail: "Staff personal, banking, or EPFO modifications", href: "/requests?tab=profile" }`

### 3.2. Attention List (`src/components/dashboard/AttentionList.tsx`)
- Add visual configurations for:
  - `pending-punch-requests`: Icon `Clock`, tone `tone-late`
  - `pending-profile-requests`: Icon `ShieldCheck`, tone `tone-accent`

### 3.3. Dashboard View (`src/app/page.tsx`)
- Render a high-visibility Pending Requests card when `pendingRequests.total > 0`, featuring:
  - Total pending count
  - Breakdown by request type (Punch Regularizations vs Profile/KYC Updates)
  - Quick-action link to `/requests`

### 3.4. Shell Navigation Badges (`src/lib/shell-data.ts`)
- Include pending profile change requests in the count that populates the badge on the `Requests & Approvals` navigation item.
