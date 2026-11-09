# Light Mode for Dashboards: Design Spec

Date: 2026-11-09  
Status: Proposal for review  
Topic: Light Theme implementation for Admin & Employee Dashboards  

---

## 1. Intent & The Why

**Goal:** Implement a first-class, meticulously designed light theme for both the school administration dashboard (`src/app/page.tsx`) and the personal employee portal dashboard (`EmployeeMyDashboard.tsx`), along with the enclosing app shell.

**The "Why":** The current application uses a fixed "Space Black" dark palette. In daytime school office environments with ambient glare or bright sunlight, dark interfaces can cause eye strain and poor readability, especially when viewing detailed attendance logs, monthly turnout charts, and biometric punches. A high-clarity, professional light mode provides comfortable daytime usability without sacrificing visual identity.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **Dual Dashboard Polish:** Both the Admin Dashboard (KPIs, StatusRing, ArrivalsChart, TrendChart, DepartmentTurnout, AttentionList, StaffToday timeline) and the Employee Portal Dashboard (profile & shift summary, today punches, month summary KPIs, daily attendance records, payslip cards) look cohesive, clear, and tactile in light mode.
- **Intentional Light Palette:** Avoid harsh, blinding pure white or flat gray bootstrap looks. Use a tailored architectural slate & paper palette with soft elevation, crisp hairline borders, and calibrated semantic status colors.
- **Zero-Flash Switching:** Seamless theme persistence in `localStorage` with a small inline head script to eliminate flash-of-dark-theme (FOUC).
- **Adaptive Recharts Visualizations:** All charts (`ArrivalsChart`, `StatusRing`, `TrendChart`) dynamically adapt grid lines, axis ticks, tooltips, and bar gradients to the active theme.
- **Accessible & Scalable:** Ensure all text, badges, and status indicators meet WCAG AA contrast ratios in both light and dark modes.

### Non-Goals
- Changing database schemas, server actions, route handlers, or attendance/payroll calculations.
- Overhauling layouts or information architecture (the layouts, routes, and data flows remain identical).

### Anti-Goals
- "Inverted Dark": Changing backgrounds to `#FFFFFF` while leaving text/accents unadjusted.
- Inconsistent shell vs. content: Having a dark sidebar with a light main panel or vice versa.
- Fragile hardcoded hex overrides scattered across JSX elements.

---

## 3. Constraints

1. **Tailwind CSS v4 `@theme` Architecture:** Tokens are declared in `src/app/globals.css`. CSS custom property overrides on `:root:not(.dark)` or `.light` must cleanly cascade to Tailwind utility classes (`bg-ground`, `bg-card`, `text-text`, `border-line`, etc.).
2. **Next.js App Router (React 19 & Next 16):** Avoid SSR hydration mismatch when reading theme from `localStorage`.
3. **Recharts Rendering:** Recharts renders SVG/Canvas elements and requires concrete color strings for props like `stroke`, `fill`, and tooltip styles, requiring dynamic theme awareness in `chart-theme.tsx`.

---

## 4. Approaches Considered

### Approach 1: Persistent Full-App ThemeProvider with Token-Based Light Theme (Selected)
- A lightweight `ThemeProvider` and `useTheme()` hook managing `"light" | "dark" | "system"`.
- Anti-flash inline script injected in `src/app/layout.tsx`.
- Refined semantic token mapping in `src/app/globals.css` applied under `.light` / default root.
- Dedicated theme toggle control with Sun / Moon icons in `TopStrip` and in `Sidebar` user profile dropdown.
- Dynamic Recharts palette in `src/lib/chart-theme.tsx`.
- **Trade-off:** Requires touching root layout and chart theme, but delivers a complete, cohesive, professional experience across the entire system.

### Approach 2: Dashboard-Only Local Toggle (Rejected)
- Toggle light mode strictly inside the `<main>` container of `src/app/page.tsx` and `EmployeeMyDashboard.tsx`.
- **Trade-off:** High visual friction; the dark sidebar and top strip clash severely with bright inner content cards, feeling half-baked.

---

## 5. Design System: The Light Slate-Paper Palette

### 5.1 Surface & Border Tokens
| Token | Dark Value | Light Value | Purpose |
|---|---|---|---|
| `--color-ground` | `#000000` | `#F1F3F7` | Deepest background beneath page grid |
| `--color-canvas` | `#060607` | `#F8FAFC` | Main content container & page background |
| `--color-card` | `#0c0c0e` | `#FFFFFF` | Elevated card surfaces (tiles, tables, modals) |
| `--color-card-hi` | `#161618` | `#F1F4F9` | Hovered rows, inputs, badge backgrounds |
| `--color-line` | `#1e1e22` | `#E2E8F0` | Structural borders (cards, outer tables) |
| `--color-line-soft` | `#141416` | `#EDF2F7` | Inner cell dividers and secondary rules |
| `--shadow-card` | `none` | `0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.03)` | Subtle card elevation |

### 5.2 Slate Typography Tokens
| Token | Dark Value | Light Value | Purpose |
|---|---|---|---|
| `--color-text` | `#F4F4F5` | `#0F172A` | Slate 900: High-clarity primary copy, headers, metrics |
| `--color-muted` | `#A1A1A8` | `#475569` | Slate 600: Secondary text, captions, subtitles |
| `--color-subtle` | `#7C7C85` | `#64748B` | Slate 500: Timestamps, table headers, metadata |

### 5.3 Brand & Semantic Status Tokens (Calibrated for WCAG AA on Light)
| Token | Dark Value | Light Value | Purpose |
|---|---|---|---|
| `--color-acc-1` | `#A5ACFF` | `#4338CA` | Deep Indigo (readable label & metric accent) |
| `--color-acc-2` | `#7B85FF` | `#4F46E5` | Royal Indigo (primary focus rings, badges, charts) |
| `--color-acc-3` | `#3B3FB8` | `#6366F1` | Soft Indigo (glows, gradient accents) |
| `--color-present` | `#34D399` | `#059669` | Emerald 600 (on-time arrival, present status) |
| `--color-late` | `#F5A524` | `#D97706` | Amber 600 (late check-in, grace warning) |
| `--color-absent` | `#F7606C` | `#DC2626` | Red 600 (absent day, offline alert) |
| `--color-leave` | `#A98BFF` | `#7C3AED` | Violet 600 (approved leave / holiday) |

---

## 6. Dashboard Component Adaptations

1. **KPI Tiles (`.kpi-tile`):**
   - In light mode, replace dark radial gradients with clean white surface, 1px `#E2E8F0` border, crisp top accent indicator line, and light tinted icon well (`bg: color-mix(in srgb, var(--h) 10%, #FFFFFF)`).
2. **Recharts Charts (`ArrivalsChart`, `StatusRing`, `TrendChart`):**
   - Gridlines switch from `#18181B` to `#E2E8F0`.
   - Tooltip container switches from dark slate `#161618` to `#FFFFFF` with `#E2E8F0` border, crisp shadow, and `#0F172A` text.
   - Status Ring background track adjusts to light muted track.
3. **Data Tables & Punch Timeline:**
   - Sticky table headers use `--color-card` (`#FFFFFF`) with `#475569` muted text.
   - Row hover highlights switch from white translucent overlay to subtle cool slate `#F8FAFC`.
   - Punch Timeline track (`bg-card-hi`) adapts to `#E2E8F0` with crisp high-contrast punch nodes.
4. **Employee My Dashboard:**
   - Profile identity card, check-in/out blocks, and punch chips retain strong contrast.
   - Payslip preview cards and salary breakdown modal render crisp on white.

---

## 7. What is Left to the Builder / Verification Plan

1. **Components to create:**
   - `src/components/ThemeProvider.tsx`: context, localStorage sync, anti-flash script.
   - `src/components/ThemeToggle.tsx`: accessible toggle button with Lucide `Sun` / `Moon` / `Laptop`.
2. **Components to modify:**
   - `src/app/layout.tsx`: integrate `ThemeProvider`, anti-flash `<script>`, dynamic `Toaster` theme.
   - `src/app/globals.css`: light theme token rules and CSS variable adjustments.
   - `src/components/shell/TopStrip.tsx` & `Sidebar.tsx`: embed theme toggle.
   - `src/lib/chart-theme.tsx`: theme-aware chart styles.
3. **Verification:**
   - Run vitest suite (`npm test`) to ensure zero regressions across existing tests.
   - Verify both dashboards toggle between dark and light smoothly without visual artifacts.
   - Verify localStorage persistence upon page reload.
