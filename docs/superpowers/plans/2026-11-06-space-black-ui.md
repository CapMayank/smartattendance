# Space Black UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every page of the SEHSS attendance/payroll portal to the approved
space-black + indigo design system and rebuild the Dashboard as a "today first" view,
with no change to features, APIs, schema or calculations.

**Architecture:**
- Design tokens live once in `globals.css` (Tailwind 4 `@theme`).
- Shared primitives live in `src/components/ui/`.
- A new shell (`AppShell` → `Sidebar`, `TopStrip`, `MobileNav`) replaces `Navbar`.
- New Dashboard numbers come from pure, unit-tested functions in `src/lib/dashboard-calc.ts`, fed by read-only Prisma queries in `src/lib/dashboard.ts`.
- Every other page keeps its logic and swaps markup and classes only.

**Tech Stack:** Next.js 16.2.9 (App Router, breaking changes: read `node_modules/next/dist/docs/` first),
React 19, Tailwind 4, Recharts 3, lucide-react, sonner, Prisma 6, next-auth 4, Vitest (new, dev only).

**Spec:** `docs/superpowers/specs/2026-11-06-space-black-ui-design.md`
**Visual reference:** `docs/superpowers/specs/assets/2026-11-06-dashboard-mockup.html`. Open it in a browser and match it.

## Global Constraints

- Token values exactly as spec §3:
  - Surfaces: `ground #000000`, `canvas #060607`, `card #0C0C0E`, `card-hi #161618`, `line #1E1E22`, `line-soft #141416`
  - Text: `text #F4F4F5`, `muted #A1A1A8`, `subtle #7C7C85`
  - Accent: `acc-1 #A5ACFF`, `acc-2 #7B85FF`, `acc-3 #3B3FB8`
  - Status: `present #34D399`, `late #F5A524`, `absent #F7606C`, `leave #A98BFF`
- Components use token utilities (`bg-card`, `text-muted`, `border-line`…), never raw hex values. Exceptions: `globals.css` and `chart-theme.ts`.
- Fonts: Geist (400/500/600) for the UI, Geist Mono for numbers. Both through `next/font/google` with CSS variables `--font-geist` and `--font-geist-mono`.
- Every time, ID, count and ₹ amount gets the `num` class (Geist Mono + `tabular-nums`). Money goes through `formatINR()`, which uses `en-IN` grouping.
- All "today", hour and bin calculations use `SCHOOL_TZ = "Asia/Kolkata"`, never the server's local time.
- Banned anywhere in `src/` once Task 11 is done: `backdrop-blur`, `glass-table`, `glass-matrix`, `bg-white/`, `bg-black/`, `bg-clip-text`, blurred background blobs.
- Status is always shown by icon + word + colour, never colour alone.
- Every interactive element shows a visible focus outline: `outline-2 outline-acc-2 outline-offset-2`.
- Motion: 120–180ms on colour, opacity and filter only. A `prefers-reduced-motion` media rule in `globals.css` turns it off.
- No schema edits, no API route edits, no changes in `src/app/iclock`.
- Before writing Next-specific code (fonts, layout, server/client boundaries), read the matching file in `node_modules/next/dist/docs/01-app/`.
- Every restyle task ends with `npm run lint` and `npm run build` passing, plus a browser check at 1440px and 390px:
  - no horizontal page scroll
  - tables scroll inside their own wrapper
  - focus is visible
- Commits: one per task (or more), message prefix `style:` / `feat:` / `refactor:`, ending with the attribution line:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- **Do not push** until the user approves the result in the browser. Pushing to `main` deploys.

### Class migration table (use in every restyle task)

| Old pattern | New |
|---|---|
| `rounded-3xl bg-black/20 border border-white/[0.08] backdrop-blur-2xl …shadow-[…]` | `<Card>` |
| `h1 text-2xl sm:text-3xl font-bold text-white` + subtitle `p` | `<PageHeader title subtitle actions>` |
| gradient / glowing `button` | `<Button variant="primary">` (white) or `secondary` |
| red / delete button | `<Button variant="danger">` |
| `input/select` with `bg-white/5 border-white/10` | `<Input>`, `<Select>` inside `<Field label error>` |
| `table.glass-table` | `<table className="data-table">` inside `<div className="table-wrap">` |
| `.glass-matrix` | `.data-matrix` |
| `text-slate-400` / `text-gray-400` | `text-muted` |
| `text-slate-500` / `text-gray-500` | `text-subtle` |
| `text-white` | `text-text` (or inherit) |
| `border-white/5…/10` | `border-line` (dividers: `border-line-soft`) |
| status pill built by hand (green/red/amber) | `<StatusBadge status=…>` |
| custom modal overlay with blur | `<Modal>` |

## Review Focus

1. **Staff with no shift assigned.** They can never be "late". They count as on time, and their expanded timeline has no shift band. Pinned in Task 3: `isLate returns false when shiftStart is null`.
2. **Server timezone isn't IST.** A punch at `2026-11-06T03:00:00Z` must land in the 08:30 IST bin, and "today" starts at IST midnight. Pinned in Task 3: `binArrivals uses Asia/Kolkata` and `istDayStart`.
3. **Holiday, Sunday, or no punches yet.** The Dashboard must render with zeroes and empty states. No `NaN%`, no divide-by-zero in the ring, and no grace line when no shift exists. Pinned in Task 3: `turnoutPercent(0,0) === null`. Rendering is checked in Task 6, step 4.
4. **Devices that never pinged, or zero devices.** The sidebar panel shows "No devices yet". Offline means `lastPing` is older than 5 minutes (same rule as today). Pinned in Task 3: `isDeviceOnline`.
5. **Long names, many departments, phone width.** Names truncate with a `title` tooltip. The department list wraps to one column below 600px. Checked in every task's 390px browser step.

---

### Task 1: Tokens, fonts, format helpers and the test runner

**Files:**
- Modify: `package.json` (add devDependency `vitest`, script `"test": "vitest run"`)
- Create: `vitest.config.ts` (node environment, `@` alias → `src`)
- Modify: `src/app/globals.css` (replace `:root`/`@theme`; keep the number-input reset; delete the indigo scrollbar)
- Modify: `src/app/layout.tsx` (fonts only in this task)
- Create: `src/lib/format.ts`
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Produces:
  - Tailwind utilities `bg-ground|canvas|card|card-hi`, `border-line|line-soft`, `text-text|muted|subtle`, `*-acc-1|2|3`, `*-present|late|absent|leave`, `font-sans` (Geist), `font-mono` (Geist Mono)
  - CSS classes `.num`, `.lit` (card top gradient), `.table-wrap`, `.data-table`, `.data-matrix`
  - `formatINR(amount: number, opts?: { paise?: boolean }): string`
  - `formatTime(d: Date): string` ("HH:mm" in IST)
  - `formatDateLong(d: Date): string` ("Friday, 6 November 2026" in IST)
  - `SCHOOL_TZ = "Asia/Kolkata"`

- [ ] **Step 1: Install Vitest and add the config and test script**

Run: `npm i -D vitest@3` and add `"test": "vitest run"`.
Expected: `npx vitest --version` prints 3.x.

- [ ] **Step 2: Write failing tests in `src/lib/format.test.ts`**

```ts
expect(formatINR(1842350)).toBe("₹18,42,350")
expect(formatINR(1842350, { paise: true })).toBe("₹18,42,350.00")
expect(formatINR(0)).toBe("₹0")
expect(formatTime(new Date("2026-11-06T04:12:00Z"))).toBe("09:42")
expect(formatDateLong(new Date("2026-11-05T19:00:00Z"))).toBe("Friday, 6 November 2026") // 00:30 IST
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npm test`. Expected: FAIL, module `./format` not found.

- [ ] **Step 4: Implement `src/lib/format.ts`**

Use `Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits })` and
`Intl.DateTimeFormat("en-GB", { timeZone: SCHOOL_TZ, … })`.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npm test`. Expected: 5 passed.

- [ ] **Step 6: Tokens and fonts**

- Read `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md`.
- In `layout.tsx`, replace `Inter` with `Geist` and `Geist_Mono` (`variable: "--font-geist"` and `"--font-geist-mono"`) on `<html>`.
- In `globals.css`, write every Global Constraints token as `--color-*` inside `@theme`.
- Set `--font-sans: var(--font-geist), ui-sans-serif, system-ui, "Segoe UI", sans-serif;` and `--font-mono: var(--font-geist-mono), ui-monospace, Consolas, monospace;`.
- Set `body { background: var(--color-ground); color: var(--color-text); }`.
- Set `color-scheme: dark`, plus the reduced-motion rule.
- Write `.data-table` to match the mockup's table: 12.5px muted header, 11–12px cell padding, `line-soft` row borders, hover `rgba(255,255,255,.025)`, sticky `thead`.
- Write `.data-matrix` as the same, plus a sticky first column on an opaque `card` background.
- Leave `.glass-*` in place until Task 11.

- [ ] **Step 7: Verify**

Run: `npm run lint && npm run build`. Expected: both succeed.
Old pages still render; they look mixed, which is expected at this stage.

- [ ] **Step 8: Commit**

`git commit -m "feat(ui): add space black tokens, Geist fonts, en-IN format helpers and vitest"`

---

### Task 2: UI primitives

**Files:**
- Create in `src/components/ui/`:
  - `Button.tsx`, `IconButton.tsx`
  - `Card.tsx` (exports `Card`, `CardHeader`)
  - `PageHeader.tsx`, `SectionLabel.tsx`
  - `KpiTile.tsx`, `DeltaPill.tsx`, `Sparkline.tsx`
  - `StatusBadge.tsx`, `Chip.tsx` (exports `Chip`, `ChipGroup`), `Tabs.tsx`
  - `Field.tsx` (exports `Field`, `Input`, `Select`, `Textarea`)
  - `Modal.tsx`, `Avatar.tsx`, `ProgressTrack.tsx`
  - `Pagination.tsx`, `EmptyState.tsx`, `Skeleton.tsx`
  - `index.ts`
- Create: `src/lib/cn.ts` (`cn(...inputs)` = `twMerge(clsx(inputs))`)
- Create: `src/app/ui-preview/page.tsx` (renders every primitive in every variant; calls `notFound()` when `process.env.NODE_ENV === "production"`; deleted in Task 11)

**Interfaces:**
- Consumes: tokens from Task 1.
- Produces:
  - `Button({ variant?: "primary"|"secondary"|"ghost"|"danger", size?: "sm"|"md", loading?: boolean, icon?: LucideIcon, ...ButtonHTMLAttributes })`
  - `IconButton({ icon: LucideIcon, label: string, ...ButtonHTMLAttributes })`. `label` becomes `aria-label`.
  - `Card({ className?, children, as? })`
  - `CardHeader({ title: string, caption?: ReactNode, action?: ReactNode })`
  - `PageHeader({ title: string, subtitle?: ReactNode, actions?: ReactNode })`
  - `SectionLabel({ children })`
  - `type Tone = "present"|"late"|"absent"|"leave"|"accent"`
  - `KpiTile({ tone: Tone, icon: LucideIcon, label: string, value: ReactNode, total?: number, delta?: { text: string, direction: "up"|"down"|"flat", good: boolean }, foot?: ReactNode, spark?: number[] })`
  - `DeltaPill({ text, direction, good })`
  - `Sparkline({ values: number[], tone: Tone, height?: number })`. SVG area plus a line plus an endpoint dot. Renders nothing if there are fewer than 2 values.
  - `type Status = "on-duty"|"left"|"late"|"absent"|"half-day"|"online"|"offline"|"locked"`
  - `StatusBadge({ status: Status, children? })`. Each status has a fixed icon, word and tone:
    - on-duty: `LogIn`, "On duty", present
    - left: `LogOut`, "Left", muted
    - late: `AlarmClock`, "Late", late
    - absent: `XCircle`, "Absent", absent
    - half-day: `CircleDashed`, "Half day", leave
    - online: `Wifi`, "Online", present
    - offline: `WifiOff`, "Offline", absent
    - locked: `Lock`, "Locked", muted
  - `Chip({ pressed: boolean, onClick, dot?: Tone, count?: number, children })`. Sets `aria-pressed`.
  - `Tabs({ tabs: { id: string, label: string, count?: number }[], value: string, onChange(id) })`. Has `role="tablist"` and arrow-key navigation.
  - `Field({ label, htmlFor, helper?, error?, children })`
  - `Input`, `Select`, `Textarea`: forwardRef, styled with `bg-ground border-line rounded-[10px] h-10`.
  - `Modal({ open, onClose, title, children, footer? })`. Uses native `<dialog>` with `showModal()`, so it gets Esc and a focus trap. Returns focus to the trigger.
  - `Avatar({ name: string, status?: Tone, size?: 28|38 })`. Initials come from the first two words. Neutral tile.
  - `ProgressTrack({ value: number, max: number })`
  - `Pagination({ page, pageCount, onPage })`
  - `EmptyState({ icon, title, hint? })`
  - `Skeleton({ className })`

- [ ] **Step 1: Implement the primitives**

Match the mockup CSS for sizes, radii and the KPI glow. The glow uses `color-mix(in srgb, var(--color-<tone>) 9%, transparent)`, set through a `--h` CSS variable from the `tone` prop.
Client components (`"use client"`): `Tabs`, `Modal`, `Chip`, `Pagination`. All others stay server-safe.

- [ ] **Step 2: Build `/ui-preview`**

It shows every variant and every `StatusBadge`, a `KpiTile` per tone with `spark=[70,74,71,76,78,75,73]`, an open Modal button, and a `data-table` with 3 rows.

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, open `http://localhost:3000/ui-preview`.
Expected:
- It matches the mockup's tiles, chips and badges.
- Tab moves focus through all controls with a visible indigo outline.
- Esc closes the Modal and focus returns to its button.
- At 390px the page doesn't scroll horizontally.

Then run `npm run lint && npm run build`. Expected: pass.

- [ ] **Step 4: Commit**

`git commit -m "feat(ui): add shared design primitives and dev-only preview page"`

---

### Task 3: Dashboard calculations (pure, tested)

**Files:**
- Create: `src/lib/dashboard-calc.ts`
- Test: `src/lib/dashboard-calc.test.ts`

**Interfaces:**
- Consumes: `SCHOOL_TZ` from Task 1.
- Produces (all pure, no Prisma):
  - `istDayStart(d: Date): Date`: the instant of 00:00 IST on d's IST date
  - `istMinutes(d: Date): number`: minutes since IST midnight
  - `parseHHMM(s: string): number` ("08:30" → 510)
  - `isLate(firstPunch: Date, shiftStart: string|null, allow: string): boolean`: strictly after start + allow. `false` when `shiftStart` is null.
  - `lateMinutes(firstPunch: Date, shiftStart: string|null): number`: measured from shift start (same as `api/recalculate`); 0 when null
  - `binArrivals(firstPunches: { at: Date, late: boolean }[], fromHHMM = "07:45", toHHMM = "09:45", slot = 15): { label: string, onTime: number, late: number }[]`
  - `turnoutPercent(present: number, total: number): number|null`
  - `isDeviceOnline(lastPing: Date, now: Date): boolean`: under 5 minutes old
  - `absenceStreak(presentDates: Set<string> /*yyyy-MM-dd IST*/, workingDays: string[] /*newest first*/): number`
  - `weekdayDelta(today: number, sameWeekdayLastWeek: number): { text: string, direction: "up"|"down"|"flat" }`
  - `inferPunchTypes(logs: { type: string, timestamp: Date }[]): ("IN"|"OUT")[]`: moved unchanged from today's `page.tsx` logic, where a lone PUNCH counts as IN and with several punches the last is OUT
  - `dutyMinutes(punches: { at: Date, type: "IN"|"OUT" }[], now: Date): number`: sums IN→OUT pairs; an open IN runs until `now`

- [ ] **Step 1: Write failing tests**

```ts
test("binArrivals uses Asia/Kolkata", () => {
  const bins = binArrivals([{ at: new Date("2026-11-06T03:00:00Z"), late: false }]) // 08:30 IST
  expect(bins.find(b => b.label === "08:30")!.onTime).toBe(1)
  expect(bins.map(b => b.label)).toEqual(["07:45","08:00","08:15","08:30","08:45","09:00","09:15","09:30"])
})
test("istDayStart", () => expect(istDayStart(new Date("2026-11-06T04:00:00Z")).toISOString()).toBe("2026-11-05T18:30:00.000Z"))
test("isLate respects grace", () => {
  expect(isLate(new Date("2026-11-06T03:15:00Z"), "08:30", "00:15")).toBe(false) // 08:45 exactly
  expect(isLate(new Date("2026-11-06T03:16:00Z"), "08:30", "00:15")).toBe(true)
})
test("isLate returns false when shiftStart is null", () => expect(isLate(new Date(), null, "00:15")).toBe(false))
test("lateMinutes from shift start", () => expect(lateMinutes(new Date("2026-11-06T04:08:00Z"), "08:30")).toBe(68))
test("turnoutPercent", () => { expect(turnoutPercent(73, 82)).toBe(89); expect(turnoutPercent(0, 0)).toBeNull() })
test("isDeviceOnline", () => {
  const now = new Date("2026-11-06T04:15:00Z")
  expect(isDeviceOnline(new Date("2026-11-06T04:11:00Z"), now)).toBe(true)
  expect(isDeviceOnline(new Date("2026-11-06T04:09:59Z"), now)).toBe(false)
})
test("absenceStreak counts consecutive missing working days", () =>
  expect(absenceStreak(new Set(["2026-10-31"]), ["2026-11-06","2026-11-05","2026-11-04","2026-11-03","2026-11-02","2026-10-31"])).toBe(5))
test("weekdayDelta", () => { expect(weekdayDelta(73, 67)).toEqual({ text: "+6", direction: "up" }); expect(weekdayDelta(4, 4).direction).toBe("flat") })
test("inferPunchTypes", () => expect(inferPunchTypes([{type:"PUNCH",timestamp:new Date(1)},{type:"PUNCH",timestamp:new Date(2)}])).toEqual(["IN","OUT"]))
test("dutyMinutes subtracts time stepped out", () => {
  const p = (t: string, type: "IN"|"OUT") => ({ at: new Date(`2026-11-06T${t}:00+05:30`), type })
  expect(dutyMinutes([p("07:46","IN"), p("08:51","OUT"), p("09:20","IN")], new Date("2026-11-06T09:45:00+05:30"))).toBe(90)
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `dashboard-calc.ts`**

Get IST parts with `Intl.DateTimeFormat("en-CA", { timeZone: SCHOOL_TZ, hour12: false, … }).formatToParts`. Don't use `setHours`.
`inferPunchTypes`: copy the rule from `src/app/page.tsx` lines with the `// Dynamic inference for PUNCH` comment, extended to a per-log array:
- explicit `IN`/`OUT` keep their type
- a single PUNCH is IN
- with several punches, odd indexes and the last are OUT (same as `api/recalculate`)

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test`. Expected: all pass.

- [ ] **Step 5: Commit**

`git commit -m "feat(dashboard): pure IST-aware attendance calculations with tests"`

---

### Task 4: App shell (Sidebar, TopStrip, MobileNav)

**Files:**
- Create: `src/components/shell/AppShell.tsx` (client; when `usePathname() === "/login"` it renders `children` bare, otherwise the shell)
- Create: `src/components/shell/Sidebar.tsx`, `TopStrip.tsx`, `MobileNav.tsx`
- Create: `src/components/shell/nav.ts`
- Create: `src/lib/shell-data.ts`
- Modify: `src/app/layout.tsx` (remove the 4 blob divs and the `max-w-7xl pt-24` main; render `<AppShell shell={await getShellData()}>`; Toaster options per Task 5)

**Interfaces:**
- Consumes: primitives from Task 2, `formatTime` from Task 1, `isDeviceOnline` from Task 3.
- Produces:
  - `NAV: { group: "Overview"|"Attendance"|"Payroll"|"System", items: { label: string, href: string, icon: LucideIcon }[] }[]`
    - **Overview:** Dashboard `/`, Staff `/staff`
    - **Attendance:** Calendar `/calendar`, Shifts `/shifts`, Manual punch `/attendance/manual`, Reports `/reports`, Member attendance `/reports/member-attendance`
    - **Payroll:** Monthly payroll `/payroll/monthly`, Salary setup `/payroll/staff`, Member payroll `/reports/member-payroll`, Analytics `/reports/payroll-analytics`
    - **System:** Departments `/departments`, Designations `/designations`, Devices `/devices`, Users `/users`, Settings `/settings`
  - `getShellData(): Promise<ShellData | null>`. Returns `null` when there is no session.
  - `ShellData = { userName: string, userRole: string, staffCount: number, devices: { id, name, online: boolean, lastPing: string /*ISO*/ }[], recentPunches: { name: string, time: string /*ISO*/, device: string|null }[] /*4 most recent today*/ }`
  - `AppShell({ shell: ShellData|null, children })`

- [ ] **Step 1: Implement the shell**

Read `node_modules/next/dist/docs/01-app/01-getting-started/` on layouts and server/client components first.

Sidebar contents:
- brand mark "SE" + "SEHSS Lakhnadon / Staff attendance"
- user card, whose menu holds "Sign out" via `signOut()`
- `<Button variant="primary">` "Manual punch", a Link to `/attendance/manual`
- NAV groups, with active state = exact match, or prefix match for non-root
- Staff count on the Staff item
- Devices item shows an absent-tone count badge when any device is offline
- footer device panel ("No devices yet" when empty) and Help

TopStrip contents:
- avatar stack of `recentPunches`
- "Live · last punch HH:MM at <device>", or "No punches yet today"
- a decorative search input

MobileNav: below 980px a menu IconButton opens the Sidebar in a `<dialog>` drawer with a scrim. Esc closes it, focus returns to the button, and the drawer closes on route change.

Leave `Navbar.tsx` unused; it is deleted in Task 11.

- [ ] **Step 2: Verify**

Run: `npm run dev`.
Expected:
- Every route opens with the new shell. `/login` opens with no shell.
- The active item highlights on `/reports/member-attendance` (not on `/reports`).
- Sign out works.
- At 390px the drawer opens, closes with Esc, and the keyboard reaches every link.

Then run `npm run lint && npm run build`. Expected: pass.

- [ ] **Step 3: Commit**

`git commit -m "feat(ui): replace floating navbar with sidebar shell and mobile drawer"`

---

### Task 5: Chart theme and toasts

**Files:**
- Create: `src/lib/chart-theme.ts`
- Modify: `src/app/layout.tsx` (Sonner `toastOptions.className`: `bg-card-hi border border-line text-text`, no blur)
- Modify: `src/app/reports/payroll-analytics/PayrollAnalyticsClient.tsx` (apply the theme)

**Interfaces:**
- Produces:
  - `chartTheme = { axisTick: { fill: "#7C7C85", fontSize: 11 }, grid: { stroke: "#18181B", strokeDasharray: "3 3" }, tooltip: { contentStyle, labelStyle, itemStyle, cursor } }`
  - `barGradient(id: string, tone: "accent"|"present"|"late")`: returns a `<linearGradient>` element (acc-1 → acc-2 → acc-3 at 35%)
  - `STATUS_HEX: Record<"present"|"late"|"absent"|"leave", string>`
  - `ACCENT_HEX: { a1, a2, a3 }`

- [ ] **Step 1: Implement the theme and apply it to the analytics charts**

Recharts can't read CSS variables in every prop, so hex values live only in this file.

- [ ] **Step 2: Verify**

Open `/reports/payroll-analytics`. Expected: indigo gradient bars, dashed dark grid, flat tooltip.
Trigger any toast (save a department). Expected: flat dark toast.
Then run `npm run lint && npm run build`.

- [ ] **Step 3: Commit**

`git commit -m "style(charts): shared recharts theme and flat toasts"`

---

### Task 6: Dashboard page

**Files:**
- Create: `src/lib/dashboard.ts` (server only, Prisma reads)
- Create in `src/components/dashboard/`:
  - `ArrivalsChart.tsx`, `StatusRing.tsx`, `TrendChart.tsx`: client components, Recharts plus the chart theme
  - `DepartmentTurnout.tsx`, `AttentionList.tsx`
  - `StaffToday.tsx` (client: Tabs, Chips, search, expandable rows), `PunchTimeline.tsx`
- Modify: `src/app/page.tsx` (rewrite rendering; keep the session redirect and `AutoRefresh`)
- Delete: `src/components/DashboardCards.tsx`, `AttendanceChart.tsx`, `DepartmentPieChart.tsx`, `RecentActivity.tsx` (only used by the Dashboard)

**Interfaces:**
- Consumes: Task 3 functions, Task 2 primitives, Task 5 theme.
- Produces:
  - `getDashboardData(now: Date): Promise<DashboardData>`
  - `DashboardData = {`
    - `kpis: { inToday, total, late, absent, devicesOnline, devicesTotal, deltas: { in, late, absent } (from weekdayDelta), spark: { in: number[], late: number[], absent: number[], devices: number[] } /*7 working days*/ }`
    - `arrivals: ReturnType<typeof binArrivals>`
    - `graceLabel: string|null` (most common shift start + allow, e.g. "08:45"; null when no staff have a shift)
    - `ring: { onTime, late, absent }`
    - `departments: { name, present, total }[]`
    - `attention: { kind: "absent-streak"|"late-repeat"|"device-offline"|"missing-out", title: string, detail: string, href: string }[]` (max 5)
    - `trend: { date: string /*yyyy-MM-dd*/, label: string, weekday: string, onTime: number, late: number, saturday: boolean }[]` (15 working days, Sundays and `Holiday` dates skipped)
    - `staff: { id, name, role, empId, department, shift: { start, end }|null, punches: { at: string, type: "IN"|"OUT", device: string|null }[], status: "on-duty"|"left"|"late"|"absent", lateBy: number, dutyMinutes: number }[]`
    - `punchLog: { at: string, name: string, empId: string, device: string|null, type: "IN"|"OUT" }[]`
  - `}`

  Rules:
  - The definition of present/absent matches today's `page.tsx`: present = at least one punch today.
  - The "Needs attention" rules come from spec §7: absent ≥ 3 working days in a row, late ≥ 3 times in the current Mon–Sat week, device offline, and yesterday's `DailyRecord` with `checkIn` and no `checkOut` (or `checkIn == checkOut`).

- [ ] **Step 1: Implement `getDashboardData`**

Use at most one `findMany` per source: staff (with department, designation, shift), logs from `istDayStart(now) − 21 days`, devices, holidays, yesterday's `DailyRecord`s, and policy. Do the grouping in memory with Task 3 functions. Export the type.

- [ ] **Step 2: Implement the widgets**

Match the mockup layout:
- `PageHeader`: "Good morning|afternoon|evening, <first name>", plus the IST date and time, shift and grace
- `SectionLabel` "Today"
- 4 `KpiTile`s:
  - In today: present tone, `CheckCircle2` icon
  - Late arrivals: late tone, `AlarmClock`. A rising delta has `good: false`.
  - Absent: absent tone, `XCircle`. A falling delta has `good: true`.
  - Devices online: accent tone, `Fingerprint`
- grid `lg:grid-cols-12`, cards span 7/5:
  - `ArrivalsChart` with a `ReferenceLine` at `graceLabel` labelled "Grace ends HH:MM"
  - `StatusRing` with 3 segments and `turnoutPercent` in the centre, showing "—" when null
  - `DepartmentTurnout`
  - `AttentionList`, or `EmptyState` "Nothing needs attention"
- `SectionLabel` "Last 3 weeks" + `TrendChart` (stacked onTime + late; Saturday bars muted)
- `SectionLabel` "Staff" + `StaffToday`:
  - tabs "Today's staff (n)" and "Punch log (n)"
  - chips All / On duty / Late / Absent
  - search on name, role and empId
  - 12 rows per page with `Pagination`
  - each row has a manual punch IconButton linking to `/attendance/manual?staffId=<id>`. If the manual page ignores the parameter, it still opens the page, and nothing on that page changes.
- `PunchTimeline`: 07:00–16:00 axis, shift band only when a shift exists, markers, a now-line only on today

- [ ] **Step 3: Verify against the mockup**

Run: `npm run dev`, log in, open `/`.
Expected:
- The section order and look match `assets/2026-11-06-dashboard-mockup.html`, without "On leave".
- The numbers agree with today's `/reports` page for the same date.

- [ ] **Step 4: Verify edge cases** (Review Focus 1–5)

- Temporarily set `now` to a Sunday (via a `?at=2026-11-08T10:00` query param read only when `NODE_ENV !== "production"`). Expected: no NaN, empty states show, no grace line.
- At 390px: the cards stack, the staff table scrolls inside its wrapper, and long names truncate.

- [ ] **Step 5: Lint, test, build**

Run: `npm run lint && npm test && npm run build`. Expected: all pass.

- [ ] **Step 6: Commit**

`git commit -m "feat(dashboard): today-first dashboard with arrivals, attention list and staff timeline"`

---

### Task 7: Login page

**Files:** Modify `src/app/login/page.tsx`

- [ ] **Step 1: Restyle**

- centred `Card` (max-w 400px) on `ground`
- the brand mark
- `Field` + `Input` for email and password
- full-width primary `Button` with `loading` while signing in
- the error appears under the form in absent tone with an icon

Keep the `signIn` call exactly as it is.

- [ ] **Step 2: Verify**

Check a wrong password (error shows) and a correct one (redirects to `/`). At 390px there is no scroll.
Run `npm run lint && npm run build`.

- [ ] **Step 3: Commit**

`git commit -m "style(login): space black login card"`

---

### Task 8: Setup pages

**Files:** Modify in `src/app/`:
- `staff/page.tsx` (637 lines, own commit)
- `departments/page.tsx`, `designations/page.tsx`, `shifts/page.tsx`
- `devices/page.tsx`, `users/page.tsx`, `settings/page.tsx`

- [ ] **Step 1: Staff page**

Apply the class migration table:
- the list becomes a `data-table` with `Avatar` (no status) and department text
- forms and modals move to `Field` and `Modal`
- bulk upload controls become `Button variant="secondary"`

Keep every handler, fetch call and state variable unchanged.

- [ ] **Step 2: Verify Staff**

Create a staff member, edit them, delete them, and bulk import the sample CSV. Expected: same results as before. Check 390px.
Run `npm run lint && npm run build`.

- [ ] **Step 3: Commit Staff**

`git commit -m "style(staff): migrate staff directory to design system"`

- [ ] **Step 4: Departments, Designations and Shifts (one commit)**

Same migration. Shifts show times in `num`.

- [ ] **Step 5: Devices, Users and Settings (one commit)**

- Devices: `StatusBadge` online/offline using `isDeviceOnline`, and last ping via `formatTime`.
- Settings: group the policy fields into `Card` sections with `Field` helper text.

- [ ] **Step 6: Verify and commit**

Run CRUD on each page once. Check 390px. Run `npm run lint && npm run build`.
Two commits: `style(setup): departments, designations, shifts` and `style(system): devices, users, settings`.

---

### Task 9: Attendance pages

**Files:** Modify:
- `src/app/calendar/page.tsx`
- `src/app/attendance/manual/page.tsx`
- `src/app/reports/page.tsx` (913 lines)
- `src/app/reports/member-attendance/page.tsx`

- [ ] **Step 1: Calendar and Manual punch**

- Calendar day cells: holiday in a `leave` tint, today with an `acc-2` ring, and status counts as small `num` text.
- Manual punch: `Field` form, IN/OUT shown as `Chip`s, and on submit a toast.

- [ ] **Step 2: Verify and commit**

Add a holiday, then remove it. Add a manual punch and check it appears on the Dashboard punch log.
Run `npm run lint && npm run build`.
Commit: `style(attendance): calendar and manual punch`.

- [ ] **Step 3: Reports and Member attendance**

- The matrix becomes `.data-matrix`.
- P/A/L/HD cells use status tints and letters (never colour alone).
- Export buttons become `Button variant="secondary" icon={Download}`.
- Member attendance logs show IN/OUT `StatusBadge`s.

- [ ] **Step 4: Verify and commit**

Generate the October report. The Excel export downloads and opens. At 390px the matrix scrolls inside its wrapper and the first column stays visible.
Run `npm run lint && npm run build`.
Commit: `style(reports): attendance matrix and member attendance`.

---

### Task 10: Payroll pages

**Files:** Modify:
- `src/app/payroll/monthly/page.tsx` (1,137 lines)
- `src/app/payroll/staff/page.tsx`
- `src/app/reports/member-payroll/page.tsx`
- `src/app/reports/member-payroll/[id]/page.tsx`
- `src/app/reports/payroll-analytics/page.tsx`

- [ ] **Step 1: Monthly payroll, in three commits by section**

1. header and filters
2. bonus and EPF controls and banners
3. the payroll table and lock flow

Rules:
- Use `formatINR` only where the code already formats money for display. Never touch calculation code.
- Locked months get `StatusBadge status="locked"`.
- The master bonus switch becomes a `Chip` or toggle styled with tokens, and its behaviour stays the same.

- [ ] **Step 2: Verify Monthly payroll**

On a copy of `dev.db`, generate November → edit bonus days → toggle the external EPF switch → lock → export ECR.
Expected: totals and the ECR file are byte-identical to the same flow on commit `5ab768f`. Compare by running both and diffing the export.

- [ ] **Step 3: Salary setup, Member payroll + detail, Analytics**

Same migration. Analytics already uses the chart theme from Task 5.

- [ ] **Step 4: Verify and commit**

Open each page and check 390px. Run `npm run lint && npm run build`.
Commit: `style(payroll): salary setup, member payroll, analytics`.

---

### Task 11: Cleanup and final verification

**Files:**
- Delete: `src/components/Navbar.tsx`, `src/app/ui-preview/`
- Modify: `src/app/globals.css` (remove `.glass-table`, `.glass-matrix`, `.custom-scrollbar` if unused)

- [ ] **Step 1: Delete the leftovers**

Remove the files above and the dead CSS.

- [ ] **Step 2: Check for banned patterns**

Run: `grep -rnE "backdrop-blur|glass-table|glass-matrix|bg-white/|bg-black/|bg-clip-text|blur-\[" src`
Expected: no output.

- [ ] **Step 3: Full verification**

Run: `npm run lint && npm test && npm run build`. Expected: all pass.

Browser pass over all 18 routes at 1440px and 390px:
- no horizontal page scroll
- focus is visible
- no console errors

Contrast check: `text`, `muted` and `subtle` are each ≥ 4.5:1 on `#0C0C0E`. Use the devtools contrast picker.

- [ ] **Step 4: Commit**

`git commit -m "refactor(ui): remove glass styles, old navbar and ui preview"`

- [ ] **Step 5: Hand-off**

Show the user the running app. **Do not push** until they approve.
Pushing to `main` triggers `deploy.yml`. There is no schema change, so `prisma db push` is a no-op.
