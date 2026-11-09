# Light Mode for Dashboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a refined, high-clarity Light Mode across the entire application shell and both dashboards (Admin School Dashboard and Employee Portal Dashboard) with zero flash of dark theme, persistent preferences, and responsive Recharts visualizations.

**Architecture:** Client-side `ThemeProvider` context managing `"light" | "dark" | "system"` with `localStorage` persistence and an anti-flash `<head>` script in `layout.tsx`. Tailwind CSS v4 `@theme` tokens in `src/app/globals.css` dynamically overridden via CSS custom properties on `:root:not(.dark)` and `.light`. Recharts palette in `src/lib/chart-theme.tsx` dynamically adapts to active theme.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS 4, Recharts 3, Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-09-light-mode-dashboards-design.md`

## Global Constraints

- **Framework:** Next.js 16.2.9 with App Router and React 19.
- **Styling:** Tailwind CSS v4 with `@theme` token definitions in `src/app/globals.css`.
- **Zero FOUC:** Theme preference must resolve immediately before page paint without flickering dark/light.
- **No breaking changes:** All existing routes, authentication flows, and 702 unit tests must continue passing.
- **Color contrast:** Semantic status colors (`present`, `late`, `absent`, `leave`) must satisfy WCAG AA contrast standards in both light and dark modes.

## Review Focus

1. **Hydration Mismatch:** Server has no access to client `localStorage`, so `resolvedTheme` must not cause React SSR mismatch warning on initial mount.
2. **System Theme Changes:** When set to `"system"`, user changing OS appearance between dark and light must dynamically update app without page reload.
3. **Recharts Tooltip & Grid Contrast:** In light mode, Recharts tooltips and gridlines must not render with dark borders or dark backgrounds.
4. **Card Elevation & Depth:** Light mode cards on light canvas must have subtle, tactile border and soft elevation (`#E2E8F0` border + ambient shadow) rather than blending flatly into the background.
5. **Data Table Sticky Headers:** Sticky table headers in `StaffToday` and `EmployeeMyDashboard` must maintain opaque card background (`#FFFFFF`) in light mode so scrolling table rows do not show through.

---

### Task 1: Theme State Primitives (`ThemeProvider`, `useTheme`, `ThemeToggle`)

**Files:**
- Create: `src/components/ThemeProvider.tsx`
- Create: `src/components/ThemeProvider.test.tsx`
- Create: `src/components/ThemeToggle.tsx`
- Create: `src/components/ThemeToggle.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type Theme = "light" | "dark" | "system";
  export type ResolvedTheme = "light" | "dark";
  export interface ThemeContextValue {
    theme: Theme;
    resolvedTheme: ResolvedTheme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
  }
  export function useTheme(): ThemeContextValue;
  export function ThemeProvider({ children, defaultTheme = "system" }: { children: React.ReactNode; defaultTheme?: Theme }): React.JSX.Element;
  export function ThemeScript(): React.JSX.Element;
  export function ThemeToggle({ className }: { className?: string }): React.JSX.Element;
  ```

- [ ] **Step 1: Write the failing tests for ThemeProvider & ThemeToggle**

Create `src/components/ThemeProvider.test.tsx` and `src/components/ThemeToggle.test.tsx`:
- Test default theme initialization (reads `localStorage` or defaults to `system`).
- Test switching themes updates `document.documentElement` class list (`light` vs `dark`) and `data-theme` attribute.
- Test `ThemeToggle` renders button with appropriate label and triggers theme toggle on click.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ThemeProvider.test.tsx src/components/ThemeToggle.test.tsx`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `ThemeProvider` and `ThemeScript`**

Implement in `src/components/ThemeProvider.tsx`:
- Manage `theme` state stored in `localStorage` key `"theme"`.
- Listen to `window.matchMedia("(prefers-color-scheme: dark)")` for `"system"`.
- Apply `.dark` or `.light` class to `document.documentElement` and set `color-scheme` style.
- Export inline `ThemeScript` component that executes immediately in `<head>` before HTML paint.

- [ ] **Step 4: Implement `ThemeToggle`**

Implement in `src/components/ThemeToggle.tsx`:
- Renders an accessible button with Lucide `Sun` (when light) or `Moon` (when dark) icons.
- Adds `aria-label="Switch to light mode"` / `"Switch to dark mode"`.
- Click cycles between light and dark (or toggles).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/ThemeProvider.test.tsx src/components/ThemeToggle.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ThemeProvider.tsx src/components/ThemeProvider.test.tsx src/components/ThemeToggle.tsx src/components/ThemeToggle.test.tsx
git commit -m "feat(theme): implement ThemeProvider and ThemeToggle components"
```

---

### Task 2: Global Light Theme Design Tokens & CSS Primitives in `globals.css`

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/test/theme-tokens.test.ts`

**Interfaces:**
- Consumes: Tailwind v4 `@theme` in `src/app/globals.css`.
- Produces: CSS variables mapped to light palette under `:root:not(.dark)` and `html.light`, and dark palette under `html.dark`.

- [ ] **Step 1: Write the failing test for theme token rules**

Create `src/test/theme-tokens.test.ts` to inspect `globals.css` contents and verify that both light mode variables and dark mode variables are defined with the exact spec hex values:
- `--color-ground: #F1F3F7` (light), `#000000` (dark)
- `--color-canvas: #F8FAFC` (light), `#060607` (dark)
- `--color-card: #FFFFFF` (light), `#0c0c0e` (dark)
- `--color-card-hi: #F1F4F9` (light), `#161618` (dark)
- `--color-line: #E2E8F0` (light), `#1e1e22` (dark)
- `--color-text: #0F172A` (light), `#f4f4f5` (dark)
- `--color-muted: #475569` (light), `#a1a1a8` (dark)
- `--color-subtle: #64748B` (light), `#7c7c85` (dark)
- `--color-present: #059669` (light), `#34d399` (dark)
- `--color-late: #D97706` (light), `#f5a524` (dark)
- `--color-absent: #DC2626` (light), `#f7606c` (dark)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/theme-tokens.test.ts`
Expected: FAIL (light tokens not yet defined in `globals.css`).

- [ ] **Step 3: Update `src/app/globals.css` with light and dark theme token blocks**

- Configure `:root` (default light mode or when `html:not(.dark)`):
  ```css
  :root, html.light {
    color-scheme: light;
    --color-ground: #F1F3F7;
    --color-canvas: #F8FAFC;
    --color-card: #FFFFFF;
    --color-card-hi: #F1F4F9;
    --color-line: #E2E8F0;
    --color-line-soft: #EDF2F7;
    --color-text: #0F172A;
    --color-muted: #475569;
    --color-subtle: #64748B;
    --color-acc-1: #4338CA;
    --color-acc-2: #4F46E5;
    --color-acc-3: #6366F1;
    --color-present: #059669;
    --color-late: #D97706;
    --color-absent: #DC2626;
    --color-leave: #7C3AED;
    --shadow-overlay: 0 20px 45px -10px rgba(15, 23, 42, 0.15);
    --shadow-card: 0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.03);
  }

  html.dark {
    color-scheme: dark;
    --color-ground: #000000;
    --color-canvas: #060607;
    --color-card: #0c0c0e;
    --color-card-hi: #161618;
    --color-line: #1e1e22;
    --color-line-soft: #141416;
    --color-text: #f4f4f5;
    --color-muted: #a1a1a8;
    --color-subtle: #7c7c85;
    --color-acc-1: #a5acff;
    --color-acc-2: #7b85ff;
    --color-acc-3: #3b3fb8;
    --color-present: #34d399;
    --color-late: #f5a524;
    --color-absent: #f7606c;
    --color-leave: #a98bff;
    --shadow-overlay: 0 24px 60px -12px rgba(0, 0, 0, 0.6);
    --shadow-card: none;
  }
  ```
- Update `.kpi-tile`:
  ```css
  .kpi-tile {
    box-shadow: var(--shadow-card);
    ...
  }
  html.dark .kpi-tile {
    background:
      radial-gradient(90% 120% at 100% 0%, color-mix(in srgb, var(--h) 9%, transparent), transparent 55%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent 50%),
      var(--color-card);
  }
  html:not(.dark) .kpi-tile {
    background:
      radial-gradient(90% 120% at 100% 0%, color-mix(in srgb, var(--h) 6%, transparent), transparent 60%),
      var(--color-card);
  }
  ```
- Update `.data-table tbody tr:hover td` and `.data-matrix tbody tr:hover td` so table hover uses `color-mix(in srgb, var(--color-text) 3%, var(--color-card))`.
- Update scrollbars for light theme legibility.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/theme-tokens.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/test/theme-tokens.test.ts
git commit -m "style(theme): add light mode tokens and adapted UI primitives"
```

---

### Task 3: App Shell & Navigation Integration

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/shell/TopStrip.tsx`
- Modify: `src/components/shell/Sidebar.tsx`
- Create: `src/components/shell/TopStrip.test.tsx`

**Interfaces:**
- Consumes: `ThemeProvider`, `ThemeScript`, `ThemeToggle` from Task 1.
- Produces: Integrated theme toggle in header top strip and sidebar user popover.

- [ ] **Step 1: Write test for TopStrip theme toggle presence**

Create `src/components/shell/TopStrip.test.tsx`:
- Render `TopStrip` with mock shell data wrapped in `ThemeProvider`.
- Verify the ThemeToggle button is rendered and accessible.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/shell/TopStrip.test.tsx`
Expected: FAIL (ThemeToggle not yet in TopStrip).

- [ ] **Step 3: Update `src/app/layout.tsx`**

- Remove hardcoded `dark` class from `<html>`: `<html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>`.
- Add `<ThemeScript />` inside `<head>`.
- Wrap children with `<ThemeProvider defaultTheme="system">` inside `<Providers>`.
- Update `Toaster` component with dynamic styling matching CSS variables.

- [ ] **Step 4: Update `src/components/shell/TopStrip.tsx`**

- Import `ThemeToggle` from `@/components/ThemeToggle`.
- Render `<ThemeToggle />` right before the search bar in the top strip (visible on both desktop and mobile).

- [ ] **Step 5: Update `src/components/shell/Sidebar.tsx`**

- Add a theme toggle row inside the user profile popover menu (`menuOpen`), displaying the current mode and allowing the user to toggle.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/components/shell/TopStrip.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/layout.tsx src/components/shell/TopStrip.tsx src/components/shell/Sidebar.tsx src/components/shell/TopStrip.test.tsx
git commit -m "feat(shell): integrate ThemeProvider, ThemeScript, and ThemeToggle"
```

---

### Task 4: Dynamic Recharts Chart Theme Adaptation

**Files:**
- Modify: `src/lib/chart-theme.tsx`
- Modify: `src/components/dashboard/ArrivalsChart.tsx`
- Modify: `src/components/dashboard/StatusRing.tsx`
- Modify: `src/components/dashboard/TrendChart.tsx`
- Create: `src/lib/chart-theme.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function useChartTheme(): {
    isDark: boolean;
    statusHex: Record<"present" | "late" | "absent" | "leave", string>;
    accentHex: { a1: string; a2: string; a3: string };
    chartTheme: {
      axisTick: { fill: string; fontSize: number };
      grid: { stroke: string; strokeDasharray: string };
      tooltip: {
        contentStyle: CSSProperties;
        labelStyle: CSSProperties;
        itemStyle: CSSProperties;
        cursor: { fill: string };
      };
    };
    barGradient: (id: string, tone: "accent" | "accentLight" | "neutral" | "present" | "late") => React.JSX.Element;
  };
  ```

- [ ] **Step 1: Write test for chart theme adaptation**

Create `src/lib/chart-theme.test.ts`:
- Test that when dark mode is active, dark status hexes and dark tooltip background (`#161618`) are returned.
- Test that when light mode is active, light status hexes and light tooltip background (`#FFFFFF`) with `#E2E8F0` border are returned.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/chart-theme.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `src/lib/chart-theme.tsx`**

- Implement `useChartTheme()` hook combining `useTheme()` with light and dark palette configs.
- Provide light & dark stops for `barGradient`.
- Keep backward compatibility for any static references.

- [ ] **Step 4: Update `ArrivalsChart.tsx`, `StatusRing.tsx`, `TrendChart.tsx`**

- Use `useChartTheme()` in `ArrivalsChart`, `StatusRing`, and `TrendChart`.
- Ensure gridlines, axes, tooltips, reference lines, and bar fills dynamically reflect the current theme.

- [ ] **Step 5: Run chart tests to verify they pass**

Run: `npx vitest run src/lib/chart-theme.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/chart-theme.tsx src/components/dashboard/ArrivalsChart.tsx src/components/dashboard/StatusRing.tsx src/components/dashboard/TrendChart.tsx src/lib/chart-theme.test.ts
git commit -m "feat(charts): add dynamic theme adaptation for Recharts visualizations"
```

---

### Task 5: Dashboard Visual Polish & Full System Verification

**Files:**
- Modify: `src/components/dashboard/EmployeeMyDashboard.tsx` (ensure machine ID, shift card, and payslips look crisp in light mode)
- Modify: `src/components/dashboard/PunchTimeline.tsx` (ensure timeline track and duty span look sharp in light mode)
- Modify: `src/components/dashboard/DepartmentTurnout.tsx`
- Modify: `src/components/dashboard/AttentionList.tsx`
- Modify: `src/components/dashboard/StaffToday.tsx`
- Create: `src/test/dashboards-light-mode.test.tsx`

**Interfaces:**
- Consumes: All updated tokens, ThemeProvider, and chart theme.
- Produces: Flawless visual display in both light and dark themes on both dashboards.

- [ ] **Step 1: Write integration tests for both dashboards in light mode**

Create `src/test/dashboards-light-mode.test.tsx`:
- Render `EmployeeMyDashboard` within `ThemeProvider` in light mode; assert key elements render with correct contrast classes.
- Render Admin Dashboard widgets (`AttentionList`, `DepartmentTurnout`, `StaffToday`) in light mode; assert proper tone classes and borders.

- [ ] **Step 2: Run tests to verify initial results**

Run: `npx vitest run src/test/dashboards-light-mode.test.tsx`

- [ ] **Step 3: Refine styling in dashboard components if needed**

- In `PunchTimeline.tsx`: ensure the axis background `bg-card-hi` and now-line have clean contrast against light card backgrounds.
- In `EmployeeMyDashboard.tsx`: verify payslip modal backdrop, employee code badge (`bg-acc-2/10 text-acc-1`), and first check-in/out card cards.
- In `StaffToday.tsx`: verify filter chips and search bar border/focus in light mode.

- [ ] **Step 4: Run the complete test suite**

Run: `npm test`
Expected: All 71+ test suites pass (700+ tests).

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Next.js production build succeeds with no type errors or lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/ src/test/dashboards-light-mode.test.tsx
git commit -m "feat(dashboard): polish light theme across Admin and Employee dashboards"
```
