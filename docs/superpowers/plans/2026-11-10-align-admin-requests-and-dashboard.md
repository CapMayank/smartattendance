# Align Admin Requests UI and Dashboard Pending Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize the Admin requests interface to strictly match the application design system and integrate real-time pending request counters and attention items into the Admin Dashboard and shell navigation.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 6, Tailwind CSS, `@/components/ui`, Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-align-admin-requests-and-dashboard-spec.md`

---

## Task 1: Dashboard Data & Attention Integration

**Files:**
- Modify: `src/lib/dashboard.ts`
- Modify: `src/components/dashboard/AttentionList.tsx`
- Modify: `src/lib/shell-data.ts`
- Test: `src/lib/dashboard-calc.test.ts` (or `src/app/page.test.tsx`)

- [ ] **Step 1: Write tests for dashboard pending requests and attention items**
- [ ] **Step 2: Update `src/lib/dashboard.ts` to query pending punch and profile requests and add to `attention`**
- [ ] **Step 3: Update `src/components/dashboard/AttentionList.tsx` with lookup configuration for pending request kinds**
- [ ] **Step 4: Update `src/lib/shell-data.ts` to include profile requests in shell badge count**
- [ ] **Step 5: Run tests to verify they pass**
- [ ] **Step 6: Commit**

---

## Task 2: Admin Dashboard Pending Requests Alert Card

**Files:**
- Modify: `src/app/page.tsx`
- Test: `src/app/page.test.tsx`

- [ ] **Step 1: Add test in `src/app/page.test.tsx` asserting pending requests banner renders on dashboard**
- [ ] **Step 2: Implement pending requests banner in `src/app/page.tsx`**
- [ ] **Step 3: Run tests to verify they pass**
- [ ] **Step 4: Commit**

---

## Task 3: Standardize Admin Requests Hub UI (`RequestsHubClient.tsx` & `ProfileRequestsTab.tsx`)

**Files:**
- Modify: `src/app/requests/RequestsHubClient.tsx`
- Modify: `src/app/requests/ProfileRequestsTab.tsx`
- Test: `src/app/requests/ProfileRequestsTab.test.tsx`
- Test: `src/app/requests/page.test.tsx`

- [ ] **Step 1: Update `src/app/requests/RequestsHubClient.tsx` to use design system `Tabs` component and canonical tokens**
- [ ] **Step 2: Standardize `src/app/requests/ProfileRequestsTab.tsx` with canonical theme tokens, badges, and card styles**
- [ ] **Step 3: Run tests in `src/app/requests/` to verify they pass**
- [ ] **Step 4: Commit**

---

## Task 4: Full Regression Testing, Production Build & Merge

- [ ] **Step 1: Run full vitest test suite** (`npx vitest run`)
- [ ] **Step 2: Run Next.js production build** (`npm run build`)
- [ ] **Step 3: Checkout `main`, merge `--no-ff`, and push to `origin/main`**
