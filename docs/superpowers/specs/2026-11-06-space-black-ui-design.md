# Space Black UI Redesign: Design Spec

Date: 2026-11-06
Status: Draft for review
Approved mockup: [`assets/2026-11-06-dashboard-mockup.html`](assets/2026-11-06-dashboard-mockup.html)
(also published at https://claude.ai/artifact/XJXNeLGVcEZ9wBLNZypT7s, version 5)

## 1. Intent

**Goal.** Make the SEHSS Lakhnadon staff attendance and payroll portal look like a
professional, modern dark product. It should have depth and colour where they
carry meaning, and nothing that reads as a generic AI-generated dashboard.

**Who uses it.** School administrators doing daily attendance checks, manual
punches, monthly reports and payroll. Mostly desktop, sometimes a phone.

**Success looks like this:**
- Every page uses one visual system that matches the approved mockup.
- The Dashboard answers "who is in, who is late, what needs fixing" without scrolling.
- No feature, calculation, API, or database change. Same routes, same behaviour.
- The user reviews each stage in the browser before it is merged.

**What we learned from the reverted attempt (`5e19173`).** A flat graphite theme
was built straight into code without a preview, and it read as lifeless and
templated. This spec keeps the parts that worked (sidebar shell, shared
primitives, table density) and adds depth: lit tiles, gradient bars, sparklines,
and status colours with a fixed meaning.

## 2. Scope

**In scope:** `src/app/layout.tsx`, `src/app/globals.css`, all 18 pages under
`src/app/**/page.tsx` (except `api/` and `iclock/`), all 7 components in
`src/components/`, Recharts styling, Sonner toasts.

**Out of scope:**
- API routes and `iclock` device endpoints
- Prisma schema and payroll or attendance calculations
- Light mode
- New features. One exception: the new Dashboard widgets need new *read-only*
  queries over existing tables (section 7).
- **Leave tracking.** The schema has no leave model, so "On leave" from the
  mockup is deferred to a separate feature (section 10).

## 3. Design tokens

All tokens are defined once in `globals.css` with Tailwind 4 `@theme`, so
utilities like `bg-card` and `text-muted` exist. Components never use raw hex values.

### Surfaces and text (neutral, no blue tint)
| Token | Value | Use |
|---|---|---|
| `ground` | `#000000` | page background (space black) |
| `canvas` | `#060607` | main working panel |
| `card` | `#0C0C0E` | cards, KPI tiles |
| `card-hi` | `#161618` | hover, selected nav item, selected chip |
| `line` | `#1E1E22` | card borders, inputs |
| `line-soft` | `#141416` | table row dividers |
| `text` | `#F4F4F5` | primary text |
| `muted` | `#A1A1A8` | secondary text, labels |
| `subtle` | `#7C7C85` | captions, axis labels, placeholders (never body copy). Raised from the mockup's `#6B6B73` to reach 4.5:1 on `card`. |

### Accent: Indigo (chosen option A)
| Token | Value | Use |
|---|---|---|
| `acc-1` | `#A5ACFF` | top of gradients, light highlights |
| `acc-2` | `#7B85FF` | main accent: focus ring, active nav icon, links, tab underline |
| `acc-3` | `#3B3FB8` | bottom of gradients |

The accent never means a status.

### Status colours: one meaning each, everywhere
| Token | Value | Meaning |
|---|---|---|
| `present` | `#34D399` | present, on time, IN punch, device online |
| `late` | `#F5A524` | late arrival, warnings |
| `absent` | `#F7606C` | absent, errors, destructive, device offline |
| `leave` | `#A98BFF` | reserved for the future leave feature; also half day |

Tinted backgrounds use the status colour at about 9% alpha, and borders at
about 28%. Status is never shown by colour alone: it always comes with an icon
and a word (WCAG 1.4.1).

### Typography
- UI font: **Geist** (400/500/600) through `next/font/google`, replacing Inter.
- Numbers: **Geist Mono** with `tabular-nums` for times, IDs, counts and ₹ amounts.
- Scale: 11 / 12 / 13 / 14 (body) / 15 (card titles) / 17 (tabs) / 24 / 30 (page title).
- Weights stay at 400–500. Page titles are 500 with tight tracking.
- Section labels are 11.5px uppercase with 0.09em tracking, plus a hairline rule.
- Money uses Indian grouping (`₹18,42,350`) through `Intl.NumberFormat('en-IN')`.

### Shape, depth and motion
- Radii: 8px for controls, 10px for buttons and inputs, 16px for cards, 20px for the canvas, full for pills.
- **Lit surfaces:** cards get a 2.5–3% white top gradient. KPI tiles also get
  a radial glow in their status colour at about 9% in the top-right corner and a 1px top highlight.
- No glassmorphism, no `backdrop-blur`, no background blobs, no gradient text.
- Shadows only on popovers, tooltips and modals.
- Transitions are 120–180ms on colour, opacity and filter only. `prefers-reduced-motion` turns them off.
- Focus: a 2px `acc-2` outline with 2px offset on every interactive element.

## 4. App shell

- **Sidebar** (248px, sticky). Top to bottom:
  - Brand mark and school name.
  - User card (name, role, sign-out menu).
  - **White primary button "Manual punch"**, linking to `/attendance/manual`.
  - Grouped navigation:
    - **Overview:** Dashboard, Staff (with count)
    - **Attendance:** Calendar, Shifts, Manual punch, Reports, Member attendance
    - **Payroll:** Monthly payroll, Salary setup, Member payroll, Analytics
    - **System:** Departments, Designations, Devices (red count badge when any device is offline), Users, Settings
  - At the bottom: a **Punch devices** panel listing each device with an online dot and last ping, then Help.
- **Top strip** above the canvas:
  - Avatars of the 4 most recent punches.
  - "Live · last punch HH:MM at <device>" with a pulse dot.
  - Global search box (a visual placeholder for now; it filters nothing until a search feature is specced).
- **Canvas:** one rounded `canvas` panel per page, holding the page header and content.
- **Below 980px:** the sidebar becomes a slide-in drawer with a scrim, opened by a menu button. Esc closes it, focus is trapped inside, and focus returns to the menu button.
- `/login` has no shell: a centred card on `ground` with the brand mark.
- All routes in today's `Navbar.tsx` stay the same. `Navbar.tsx` is replaced by `Sidebar.tsx`, `TopStrip.tsx` and `MobileNav.tsx`.

## 5. Shared components (`src/components/ui/`)

| Component | Notes |
|---|---|
| `Button` | Variants: `primary` (white on black), `secondary` (outlined), `ghost`, `danger`. Sizes: sm, md. Has a `loading` state. |
| `IconButton` | Round outlined button. Always has an `aria-label`. |
| `Card` | `card` surface with the lit gradient. Optional `CardHeader` (title, caption, action link). |
| `PageHeader` | Title, a subline (date, policy or shift context), and an actions slot. |
| `SectionLabel` | Uppercase label followed by a hairline rule. |
| `KpiTile` | Icon in a tinted square, label, delta pill, big number, foot note, and an optional 7-day sparkline. Colour comes from a `tone` prop (present / late / absent / accent). |
| `DeltaPill` | Tones: good / bad / flat. The arrow direction is separate from the tone (a rise in late arrivals is bad). |
| `StatusBadge` | Icon + word + tint. Values: on duty, left, late, absent, half day, device online/offline. |
| `Chip` / `ChipGroup` | Filter pills with an optional colour dot and a count. Uses `aria-pressed`. |
| `Tabs` | Underlined tabs with count pills. Underline is an `acc-1`→`acc-2` gradient. Uses `role="tablist"`. |
| `Input`, `Select`, `Textarea`, `Field` | Visible label, helper text, and an error message under the field. Dark native `color-scheme`. |
| `Modal` | `card-hi` surface with a shadow, focus trap, and Esc to close. |
| `DataTable` styles | Replace `.glass-table` and `.glass-matrix`: sticky header, 44–52px rows, `line-soft` dividers, faint hover, opaque sticky first column, horizontal scroll inside its own wrapper. |
| `Avatar` | Neutral `#18181B` tile with initials and an optional status dot. Never coloured by department. |
| `ProgressTrack` | Thin track with an accent gradient fill, used for hours on duty and department turnout. |
| `Pagination`, `EmptyState`, `Skeleton` | Shared across tables. |

## 6. Charts (Recharts) and toasts

- One chart theme module, `src/lib/chart-theme.ts`: axis text in `subtle` at
  11px, dashed gridlines in `#18181B`, a flat tooltip on `card-hi` with a
  `line` border, and no gradients except on bars.
- Bars: vertical gradient `acc-1` → `acc-2` → transparent `acc-3`. The current
  or selected bar is brighter, and Saturdays are muted.
- Status bars (arrivals): `present` gradient for on time, `late` gradient for late.
- Rings: one segment per status in its status colour, rounded caps, a 2.6px gap, and a faint glow.
- Every chart has an `aria-label` summary and tooltips that also work on keyboard focus.
- Sonner toasts: `card-hi` background, `line` border, no blur, with the status colour on the icon only.

## 7. Dashboard (`/`), matching the mockup

Sections in order:
1. **PageHeader:** "Good morning, <name>", plus the date, time, shift and grace time.
   Actions: department filter, more menu, "Export today".
2. **Today: KPI tiles.**
   - **In today** `n / total` (present)
   - **Late arrivals** (late)
   - **Absent** (absent)
   - **Devices online** `n / total` (accent)

   Each tile has a 7-day sparkline and a delta against the same weekday last week.
3. **Today: cards grid** (two 7/5 rows):
   - **Arrivals this morning:** histogram of first-punch times in 15-minute
     slots, with a dashed line where the grace period ends (`shift.startTime + policy.lateArrivalAllow`).
   - **Where everyone is:** a status ring for on time, late and absent, with a
     turnout % in the centre and a legend with counts and percentages.
   - **Departments today:** present / total per department on accent tracks.
   - **Needs your attention:** at most 5 items, links only:
     - absent N+ days in a row
     - late 3+ times this week
     - device offline
     - missing OUT punch yesterday
4. **Last 3 weeks:** stacked bars of on-time and late staff per working day.
5. **Staff:** tabs for "Today's staff" and "Punch log".
   - Chips: All, On duty, Late, Absent. Plus a table search box.
   - Each row shows: avatar with a status dot, name, role and ID, department,
     first in (with late minutes), last out, hours on duty against the shift,
     punch markers, a status badge, a manual punch button, and an expand control.
   - An expanded row shows a 07:00–16:00 timeline with the shift band, punch
     markers, the current time, and the devices used.

**Differences from the mockup.** The mockup's "On leave" tile, ring segment,
chip and rows are left out (there is no leave data). The fourth tile becomes
"Devices online". Everything else matches.

**Data:** everything comes from existing tables (`Staff`, `AttendanceLog`,
`DailyRecord.lateMinutes`, `Shift`, `Policy`, `Device`, `Department`). New
server-side read queries go in `src/lib/dashboard.ts`. Present/absent logic and
punch-direction inference are reused unchanged from today's `page.tsx`.
`AutoRefresh` stays.

## 8. Other pages

Each page keeps its structure and behaviour. Only markup and classes change,
moving onto the shell, `PageHeader` and the shared components.

| Group | Pages | Notes |
|---|---|---|
| Setup | Staff, Departments, Designations, Shifts, Devices, Users, Settings | Forms in `Card` + `Field`. Lists in `DataTable`. Devices show an online/offline `StatusBadge`. |
| Attendance | Calendar, Manual punch, Reports, Member attendance | Calendar day cells are tinted by status colour. The report matrix uses `DataTable` matrix styles. |
| Payroll | Monthly payroll, Salary setup, Member payroll (+ detail), Payroll analytics | ₹ in Geist Mono with en-IN grouping. Locked months get a "Locked" badge. Analytics uses the chart theme. |
| Auth | Login | Centred card, no shell. |

## 9. Delivery and verification

**Build order.** Each stage is its own commit and is checked in the browser before moving on:
1. Tokens, fonts, `layout.tsx` shell (Sidebar, TopStrip, MobileNav), `ui/` primitives, chart theme
2. Login and Dashboard
3. Setup pages
4. Attendance pages
5. Payroll pages (`payroll/monthly` is 1,137 lines, so it gets class-only edits in small commits)
6. Cleanup: delete `.glass-*` CSS and the old `Navbar.tsx`

**Before Next.js code:** read the relevant guide in `node_modules/next/dist/docs/`
(this repo runs Next 16.2.9 with breaking changes, per `AGENTS.md`), especially for
`next/font`, layouts, and server/client component boundaries.

**Checks for every stage:**
- `npm run lint` and `npm run build` pass.
- A browser check at 1440px and 390px: no horizontal page scroll, tables scroll
  inside their wrapper, the drawer opens and closes with the keyboard, and focus is visible.
- Contrast: `text`, `muted` and `subtle` all meet ≥ 4.5:1 on `card`. Status colours meet ≥ 3:1 for icons and ≥ 4.5:1 for badge text.
- No leftovers once stage 6 is done: `backdrop-blur`, `glass-table`, `glass-matrix`, `bg-white/`, and gradient text (checked with grep).
- Behaviour unchanged: spot-check manual punch, staff create/edit, the monthly
  payroll generate and lock flow, and Excel exports.

**Release.** Push to `main` runs `.github/workflows/deploy.yml`, which runs
`prisma db push`. This redesign has no schema change. Push only after the
user has approved the stage in the browser.

## 10. Deferred (separate specs)

- **Leave tracking:** a model plus UI. Once it exists, it brings back the
  "On leave" tile, the ring segment and the badge using the reserved `leave` colour.
- **Global search** (Ctrl K).
- Light mode.

## 11. Risks

- **Large class-only diffs on the payroll and reports pages.** Mitigation: staged commits and a browser check per stage.
- **Dashboard queries touching every staff member's logs for 7 days.** Mitigation:
  one grouped query per widget, measured against current data before release.
- **Geist swap.** Mitigation: `next/font` with a system fallback stack, so there is no layout shift.
