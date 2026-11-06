# Dark UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the glassmorphism look with a flat, professional graphite + blue dark UI across every page, without changing behavior.

**Architecture:** Design tokens in `globals.css` (Tailwind 4 `@theme`) feed a small set of primitives in `src/components/ui/`. A new sidebar/top-bar shell replaces the floating navbar. Pages are migrated class-by-class onto tokens/primitives; no logic, API or schema edits.

**Tech Stack:** Next.js 16.2.9 (App Router; read `node_modules/next/dist/docs/` before touching layout/font APIs), React 19, Tailwind 4, lucide-react, Recharts 3, Sonner, next-auth.

**Spec:** `docs/superpowers/specs/2026-11-06-dark-ui-redesign-design.md`

## Global Constraints

- Dark only. Tokens: bg `#0B0D10`, panel `#111418`, raised `#171B21`, hover `#1D222A`, border `#232831`, border-strong `#2E343F`, text `#E6E8EB`, muted `#9AA3AF`, subtle `#6B7480`, accent `#3B82F6` (hover `#2563EB`).
- Radii 6–10px. No decorative shadows (overlays only). No `backdrop-blur`, no gradient blobs, no gradient text.
- Font Inter; tabular numerals on data. Body ≥ 14px. Text contrast ≥ 4.5:1.
- Transitions 150–200ms on color/opacity only; honor `prefers-reduced-motion`; visible `:focus-visible` accent ring; touch targets ≥ 40px on mobile.
- Behavior must be identical: change markup/classes only. Do not touch `src/app/api/**`, `src/lib/**`, `prisma/**`, `ws-server.js`, `src/proxy.ts`.
- The repo has no test framework. Verification per task = `npm run lint`, `npm run build`, and the grep/browser checks named in the task. Do not add a test framework.
- Commit per task. Do NOT push until Task 9.

## Review Focus

- Wide tables (payroll monthly, member attendance matrix) must scroll inside their container at 390px, never the page.
- Sticky first column in tables keeps an opaque background (no text bleed-through when scrolled).
- Mobile drawer: Esc closes, route change closes, scrim click closes, body does not scroll behind it.
- `/login` must render with no sidebar/top bar and must not flash the shell when unauthenticated.
- Status meaning (present/absent/late, locked/unlocked) must never rely on color alone: keep text or icon labels.

---

### Task 1: Tokens and global styles

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: Tailwind color utilities `bg-bg`, `bg-panel`, `bg-raised`, `bg-hover`, `border-line`, `border-line-strong`, `text-fg`, `text-muted`, `text-subtle`, `bg-accent`, `text-accent`, `bg-accent-soft`, `bg-success-soft`/`text-success`, `bg-warning-soft`/`text-warning`, `bg-danger-soft`/`text-danger`; classes `.data-table`, `.data-matrix`; global `:focus-visible` ring.

- [ ] **Step 1:** In `globals.css` define the spec tokens in `@theme inline` (names above), set `body` to `bg-bg text-fg`, enable `font-variant-numeric: tabular-nums` via a `.tabular` utility and on `td`.
- [ ] **Step 2:** Replace `.glass-table`/`.glass-matrix` rules with `.data-table`/`.data-matrix`: `border-collapse: collapse`, sticky `thead th` (panel bg, 12px uppercase muted, 1px bottom border), row height ~40px, 1px `border-line` row dividers, hover `bg-hover`, `td.sticky`/`th.sticky` solid `bg-panel`. Keep `.glass-*` as temporary aliases of the new classes so unmigrated pages still render.
- [ ] **Step 3:** Add `:focus-visible { outline: 2px solid accent; outline-offset: 2px }`, a `@media (prefers-reduced-motion: reduce)` block disabling transitions/animations, and restyle the scrollbar neutral (no indigo).
- [ ] **Step 4:** Run `npm run build`. Expected: succeeds.
- [ ] **Step 5:** Commit `style: add dark design tokens and flat table styles`.

### Task 2: UI primitives

**Files:**
- Create: `src/components/ui/Card.tsx`, `Button.tsx`, `Field.tsx`, `Badge.tsx`, `PageHeader.tsx`, `StatCard.tsx`, `index.ts`

**Interfaces:**
- Produces (all use `clsx` + `tailwind-merge`, forward `className` and native props):
  - `Card({ className, children })`, `CardHeader({ title, actions })`
  - `Button({ variant?: 'primary'|'secondary'|'ghost'|'danger', size?: 'sm'|'md', loading?: boolean, ...ButtonHTMLAttributes })`
  - `Input`, `Select`, `Textarea` (forwardRef) and `Field({ label, error?, hint?, children })` with visible label and error text tied by `aria-describedby`
  - `Badge({ tone: 'neutral'|'success'|'warning'|'danger'|'accent', children })`
  - `PageHeader({ title, description?, actions? })`
  - `StatCard({ label, value, hint?, icon? })`

- [ ] **Step 1:** Implement each component using only Task 1 tokens (no raw hex, no `white/…` opacities).
- [ ] **Step 2:** `Button` shows a spinner and `disabled` + `aria-busy` when `loading`; min height 40px.
- [ ] **Step 3:** Run `npm run lint && npm run build`. Expected: pass.
- [ ] **Step 4:** Commit `feat(ui): add shared UI primitives`.

### Task 3: App shell (sidebar, top bar, layout)

**Files:**
- Modify: `src/app/layout.tsx`, `src/components/Navbar.tsx` (rewrite as sidebar navigation; keep the file and default export)
- Create: `src/components/AppShell.tsx`

**Interfaces:**
- Consumes: Task 1 tokens.
- Produces: `AppShell({ children })` client component: renders sidebar + top bar + `<main>` for authenticated routes, and only `children` for `/login`.

- [ ] **Step 1:** Move the nav data (five groups and routes currently in `Navbar.tsx`) into the 240px sidebar: group labels, lucide icons, active item = accent text + 2px left indicator + `bg-hover`; use `aria-current="page"`.
- [ ] **Step 2:** `AppShell`: top bar (page title from the active nav item, user email, sign-out button with `aria-label`). Below `lg` the sidebar is a drawer with scrim; Esc, scrim click and pathname change close it; lock body scroll while open; return focus to the menu button.
- [ ] **Step 3:** `layout.tsx`: remove the four blob divs and `bg-black/50`; wrap children in `AppShell`; restyle `Toaster` flat (panel bg, `border-line`, no blur). Check `node_modules/next/dist/docs/` before changing `next/font` usage; keep Inter.
- [ ] **Step 4:** Run `npm run build`; open `/login` and `/` in the browser. Expected: login has no shell; dashboard has sidebar + top bar; at 390px the drawer opens/closes with all three triggers.
- [ ] **Step 5:** Commit `feat(ui): sidebar and top bar app shell`.

### Task 4: Login and dashboard

**Files:** Modify `src/app/login/page.tsx`, `src/app/page.tsx`, `src/components/DashboardCards.tsx`, `AttendanceChart.tsx`, `DepartmentPieChart.tsx`, `RecentActivity.tsx`

**Interfaces:** Consumes `Card`, `StatCard`, `PageHeader`, `Badge`, `Button`, `Field`/`Input`.

- [ ] **Step 1:** Login: centered flat `Card`, `Field`+`Input` for email/password, primary `Button`, error text under the form with `role="alert"`. Leave the submit logic and state untouched (it currently pre-fills default credentials; flag to the user, do not change).
- [ ] **Step 2:** Dashboard: `PageHeader`, `StatCard` grid, flat charts: series colors from tokens (accent plus success/warning/danger for status), muted gridlines, flat tooltip with `border-line`.
- [ ] **Step 3:** `RecentActivity`: ruled list, `Badge` for IN/OUT with text labels.
- [ ] **Step 4:** Run `npm run lint && npm run build`; screenshot `/` at 1440px and 390px. Expected: no horizontal page scroll; no blur/gradient.
- [ ] **Step 5:** Commit `style: redesign login and dashboard`.

### Task 5: Organization pages

**Files:** Modify `src/app/staff/page.tsx`, `departments/page.tsx`, `designations/page.tsx`, `shifts/page.tsx`, `calendar/page.tsx`

- [ ] **Step 1:** Per page: `PageHeader` with actions, `Card` containers, `data-table` for lists (replace `glass-table`), `Field/Input/Select/Button` for forms and modals (modal = `bg-panel`, `border-line-strong`, scrim, no blur), `Badge` for statuses.
- [ ] **Step 2:** Staff page (637 lines): preserve bulk-import/CSV flows exactly; only classes/markup change.
- [ ] **Step 3:** Calendar: day cells flat; holiday/weekend meaning conveyed by label or icon plus color.
- [ ] **Step 4:** Run `npm run lint && npm run build`; browser-check each page at 1440/390. Expected: pass; tables scroll inside their container.
- [ ] **Step 5:** Commit `style: redesign organization pages`.

### Task 6: System pages

**Files:** Modify `src/app/devices/page.tsx`, `users/page.tsx`, `settings/page.tsx`

- [ ] **Step 1:** Same treatment as Task 5; device online/offline via `Badge` with text.
- [ ] **Step 2:** Run `npm run lint && npm run build`; browser-check. Commit `style: redesign system pages`.

### Task 7: Attendance and reports

**Files:** Modify `src/app/attendance/manual/page.tsx`, `reports/page.tsx` (913 lines), `reports/member-attendance/page.tsx`

- [ ] **Step 1:** Convert to primitives. The monthly matrix uses `data-matrix`: day cells flat, status by tint plus the existing letter/label, sticky name column opaque.
- [ ] **Step 2:** Filter rows use `Field`/`Select`/`Input`; export buttons use `Button variant="secondary"`.
- [ ] **Step 3:** Run `npm run lint && npm run build`; browser-check matrix scroll at 390px. Commit `style: redesign attendance and reports`.

### Task 8: Payroll pages

**Files:** Modify `src/app/payroll/monthly/page.tsx` (1137 lines), `payroll/staff/page.tsx`, `reports/member-payroll/page.tsx`, `reports/member-payroll/[id]/page.tsx`, `reports/payroll-analytics/page.tsx`, `reports/payroll-analytics/PayrollAnalyticsClient.tsx`

- [ ] **Step 1:** Class/markup-only migration; do not alter any calculation, state or handler. Numbers right-aligned with tabular numerals; locked/unlocked and bonus on/off use `Badge` with text.
- [ ] **Step 2:** Analytics charts use the token palette, flat tooltips, labeled legends.
- [ ] **Step 3:** Review `git diff` of the monthly page: only `className`/markup lines changed; handlers and calculations untouched.
- [ ] **Step 4:** Run `npm run lint && npm run build`; browser-check the monthly generation table at 1440/390. Commit `style: redesign payroll pages`.

### Task 9: Cleanup, final verification, push

**Files:** Modify `src/app/globals.css` (remove `.glass-*` aliases); fix any straggler found by grep.

- [ ] **Step 1:** Run `grep -rnE "backdrop-blur|bg-clip-text|bg-gradient|glass-table|glass-matrix|rounded-3xl|blur-\[" src`. Expected: no matches. Fix stragglers, then delete the `.glass-*` aliases.
- [ ] **Step 2:** Run `npm run lint && npm run build`. Expected: both pass with no new warnings.
- [ ] **Step 3:** Run the app and walk every sidebar route at 1440px and 390px: no horizontal page scroll, drawer works, focus ring visible via keyboard Tab, no console errors.
- [ ] **Step 4:** Confirm no changes under logic paths: `git diff --stat origin/main...HEAD -- src/app/api src/lib prisma` is empty.
- [ ] **Step 5:** Commit `style: remove legacy glass styles`, then `git push origin main` (triggers the deploy workflow). Report the workflow run status.
