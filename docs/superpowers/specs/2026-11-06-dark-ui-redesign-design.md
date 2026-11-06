# Dark UI/UX Redesign — Design Spec

Date: 2026-11-06
Status: Draft for review

## Goal
Make the attendance/payroll portal look like a professional, modern dark-theme
product instead of a generic "AI-generated" glassmorphism UI. Audience: school
administrators doing daily attendance and payroll work. Priorities: density,
legibility, trust. Visual change only.

## Decisions (from brainstorming)
- Tone: graphite neutrals + single blue accent.
- Dark theme only (no light mode).
- Scope: all pages (~20) plus shared components.
- Delivery: push to `main`; GitHub Action `deploy.yml` builds and deploys.

## Non-goals
Business logic, API routes, Prisma schema, payroll calculations, features,
light mode, rewriting page structure beyond what the new shell requires.

## Problems in the current UI
- Four blurred gradient blobs fixed behind every page (`layout.tsx`).
- Glassmorphism (`bg-white/5`, `backdrop-blur`) used for cards, nav, tables.
- Gradient text logo; glowing button shadows; floating pill navbar.
- `.glass-table` renders puffy rounded-3xl row strips; poor density.
- ~320 ad-hoc `border-white/…` utilities; no shared tokens or primitives.
- Mixed blue/indigo accents with no semantic rule.

## Design tokens (`src/app/globals.css`, Tailwind 4 `@theme`)
| Token | Value |
|---|---|
| bg | #0B0D10 |
| panel | #111418 |
| raised | #171B21 |
| hover | #1D222A |
| border | #232831 |
| border-strong | #2E343F |
| text | #E6E8EB |
| text-muted | #9AA3AF |
| text-subtle | #6B7480 |
| accent | #3B82F6 (hover #2563EB, soft = 12% tint) |
| success / warning / danger | emerald / amber / rose, muted tint bg + readable text |

Radii 6–10px. No decorative shadows (overlays only). Font: Inter, tabular
numerals for data. Scale: 12/13/14/16/20/24px. Body ≥ 14px, line-height 1.5.
Text/background contrast ≥ 4.5:1; muted text ≥ 4.5:1 on panel.

## App shell
- Fixed 240px left sidebar, grouped: Overview, Organization, Attendance,
  Payroll, System (same routes as today's `Navbar.tsx`), clear active state.
- Slim top bar: page title/breadcrumb, user email, sign-out.
- Below `lg`: sidebar becomes slide-in drawer with scrim, focus-managed, Esc closes.
- `/login` renders without sidebar: centered flat card.
- Blobs and global blur removed from `layout.tsx`.

## Shared primitives (`src/components/ui/`)
`Card`, `Button` (primary/secondary/ghost/danger, sizes, loading), `Input`/
`Select`/`Textarea` (visible label, error text), `Badge` (status variants),
`PageHeader` (title, description, actions), `StatCard`, `Modal` styling,
and flat `.data-table` / `.data-matrix` classes replacing `.glass-table` /
`.glass-matrix` (sticky header, compact rows, hairline row dividers, subtle hover,
sticky first column keeps opaque panel background).

## Charts and toasts
Recharts: palette from tokens, quiet gridlines, flat tooltip, no gradients
unless encoding data. Sonner toasts: flat panel, border, no blur.

## Interaction
Transitions 150–200ms on color/opacity only; `prefers-reduced-motion` respected;
visible `:focus-visible` ring (accent); touch targets ≥ 40px on mobile; no
hover-only affordances; no layout shift on state change.

## Migration order
1. Tokens + layout + sidebar/topbar + primitives
2. Login, Dashboard (`page.tsx`, DashboardCards, charts, RecentActivity)
3. Staff, Departments, Designations, Shifts, Calendar, Devices, Users, Settings
4. Attendance (manual), Reports, Member Attendance
5. Payroll (monthly, staff), Member Payroll (+ detail), Payroll Analytics
Each step must keep behavior identical; only markup/classes change.

## Verification
- `npm run lint` and `npm run build` pass.
- Manual browser check of key pages at ~1440px and 390px: no horizontal page
  scroll, tables scroll inside their container, drawer works.
- No leftover `backdrop-blur`/gradient-blob/gradient-text usage (grep).
- Only after green build: commit and push to `main` (triggers deploy).

## Risks
- Large diff on 1,100-line payroll page: mitigated by class-only changes and
  staged commits.
- Deploy runs on push to main with `prisma db push`; this change has no schema
  edits, so DB is unaffected.
