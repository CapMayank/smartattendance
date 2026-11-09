# Punch Regularization & ToSchool Flow Integration Design

## Intent & The Why
Staff members currently face two disconnected, stranded experiences when viewing their attendance and regularizing missed punches:
1. `/to-school` provides a calendar view of monthly attendance with statuses (`PRESENT`, `HALF_DAY`, `ABSENT`), but when attendance is penalized due to a missing terminal punch (e.g., check-in is logged but check-out is missing, producing a `HALF_DAY`), the calendar cell offers no action to regularize that missing check-out. Only `isNoShow` days showed an action button.
2. `/punch-requests` previously dumped a raw, flat list of hardware timestamps (`2026-11-04 17:15:00 - OUT`), leaving employees to guess what day or which punch was missed, why their attendance was impacted, or what they need to request.
3. The reason categories across the portal referred to "swipe card" and "biometric card", whereas the campus uses facial recognition terminals and smart attendance scanners.

This integration unifies `/to-school` and `/punch-requests` into a cohesive attendance reconciliation experience with clear, actionable discrepancy resolution and generalized terminal copy.

## Goals, Non-Goals, Anti-Goals
- **Goals:**
  - Provide a single, seamless flow between the monthly calendar in `/to-school` and punch regularization in `/punch-requests`.
  - In `/to-school`, highlight incomplete days (Missing Check-Out, Missing Check-In, No Attendance) with 1-click contextual buttons to request regularization with prefilled punch types.
  - In `/punch-requests`, introduce an "Action Needed" discrepancy dashboard and a "Daily Reconciliation" ledger for the selected month, showing exact expected vs. actual punch status and 1-click regularization triggers.
  - Generalize all reason labels across the system for facial recognition and smart biometric terminals while maintaining existing DB enum values (`FORGOT_SWIPE`, `DUTY_OUTSIDE`, `DEVICE_OFFLINE`, `POWER_FAILURE`, `OTHER`).
  - Keep 100% test coverage and ensure all existing and new tests pass.
- **Non-Goals:**
  - Modifying the underlying database schema or changing Prisma enum values.
  - Changing the attendance calculation algorithm or rules for working hours.
- **Anti-Goals:**
  - Removing the raw hardware punch logs entirely (they must remain accessible in a dedicated tab for transparency/diagnostics).
  - Overcomplicating UI with unnecessary abstractions or multi-step wizards when a direct modal trigger is fastest.

## Constraints
- Next.js 15 App Router client/server boundaries must be respected.
- Prisma enum `PunchRequest.reason` must keep raw strings (`FORGOT_SWIPE`, `DUTY_OUTSIDE`, `DEVICE_OFFLINE`, `POWER_FAILURE`, `OTHER`) in API payloads and database records.
- All existing tests in `src/app/punches/requests/page.test.tsx`, `src/app/api/punch-requests/route.test.ts`, and `src/test/punch-regularization-e2e.test.ts` must pass.

## Approaches Considered
- **Approach A (Keep pages separate, add basic hyperlinks):** Add standard navigation links between `/to-school` and `/punch-requests`. Rejected because employees still cannot tell what punches are missing or why attendance was marked half-day.
- **Approach B (Unified Attendance & Regularization Hub — Selected):**
  - Connect `/to-school` and `/punch-requests` with shared month context and discrepancy awareness.
  - In `/to-school`, add contextual regularization buttons for missing check-out and missing check-in, plus an alert banner for pending discrepancies.
  - In `/punch-requests`, lead with actionable discrepancies and a daily ledger showing clock-in/out completion, keeping raw hardware logs in a secondary tab.
  - Modernize and generalize reason strings across the modal, employee client, and admin client.

## Specification Details

### 1. Generalized Reason Labels
| Enum Code | Current Label | Generalized Label |
|---|---|---|
| `FORGOT_SWIPE` | Forgot to swipe card / biometric card | Forgot to mark attendance / Missed terminal check |
| `DUTY_OUTSIDE` | Official outdoor school duty / sports event | Official on-duty assignment / Off-campus school duty |
| `DEVICE_OFFLINE` | Biometric device offline / card read error | Attendance terminal offline / Recognition error |
| `POWER_FAILURE` | Campus power failure / power failure at entrance | Campus power outage / Terminal unavailable |
| `OTHER` | Other reason | Other reason (specify details below) |

### 2. `RequestPunchModal` Props & Behavior
Extend `RequestPunchModalProps`:
```ts
export interface RequestPunchModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prefillDate?: string;
  prefillPunchType?: PunchType; // "IN" | "OUT" | "BOTH"
  prefillTime?: string;
}
```
When opened:
- If `prefillPunchType` is passed, set `punchType` state to that value.
- If `punchType === "IN"`, set `requestedTime` to `prefillTime || "09:00"`.
- If `punchType === "OUT"`, set `requestedTime` to `prefillTime || "16:30"`.
- If `punchType === "BOTH"`, set `requestedInTime` to "09:00" and `requestedOutTime` to "16:30".
- Use generalized `PUNCH_REASONS`.

### 3. `/to-school` Calendar Integration (`ToSchoolClient.tsx`)
- **Discrepancy Banner:**
  When `data.days` contains any working day where `(!day.checkOut && day.checkIn)` or `(!day.checkIn && day.checkOut)` or `(day.isNoShow)` without a pending request, display a prominent banner at the top of the calendar:
  - Text: `"You have X attendance discrepancies needing regularization this month."`
  - Action button: `"Review & Regularize →"` linking to `/punch-requests?month=${selectedMonth}&year=${selectedYear}`.
- **Day Cell Actions:**
  - If `!day.checkOut && day.checkIn`: Display a badge or indicator for missing check-out and a button `+ Request Out Punch` that triggers `openRegularizationModal(day)` with punchType="OUT".
  - If `!day.checkIn && day.checkOut`: Display a badge or indicator for missing check-in and a button `+ Request In Punch` that triggers `openRegularizationModal(day)` with punchType="IN".
  - If `day.isNoShow`: Button `+ Request Punch` (punchType="BOTH").
- **Header Action:**
  - Add button in calendar header: `"Regularization Center"` navigating to `/punch-requests?month=${selectedMonth}&year=${selectedYear}`.

### 4. `/punch-requests` Redesign (`PunchRequestsClient.tsx`)
- **Header:**
  - Add Month Selector (`[<] Month YYYY [>]`) matching `/to-school`.
  - Add link `[← Back to Monthly Calendar]` (`/to-school?month=${month}&year=${year}`).
- **Data Loading:**
  - Fetches `/api/employee/to-school?month=${month}&year=${year}` alongside `/api/punch-requests` and `/api/employee/punches`.
- **Tabs:**
  1. **"Action Needed" (Discrepancies):**
     - Filter days with missing punches or no-shows that lack approved/pending requests, plus items with pending requests.
     - Each item displays:
       - Date formatted clearly.
       - Discrepancy label: `"Missing Check-Out (Check-In was 09:15 AM)"` or `"Missing Check-In (Check-Out was 16:30 PM)"` or `"No Attendance Recorded"`.
       - Status impact: `"Recorded as Half Day"` or `"Recorded as Absent"`.
       - Direct action button: `"Regularize Out Punch"`, `"Regularize In Punch"`, or `"Regularize Day"`.
     - When empty: `"All attendance records for this month are reconciled and complete."`
  2. **"Daily Reconciliation" (Monthly Ledger):**
     - Table listing every day of the selected month:
       - Date & Day Name
       - Status badge (`Present`, `Half Day`, `Absent`, `Holiday`, `Sunday`)
       - Terminal Check-In (`09:12 AM` or `Missing`)
       - Terminal Check-Out (`04:30 PM` or `Missing`)
       - Recorded Work Hours
       - Action: Regularize button if incomplete, or View details.
  3. **"My Requests":**
     - Lists submitted regularization requests with live statuses (`Pending`, `Approved`, `Rejected`, `Cancelled`), decision remarks, and cancellation action for pending requests.
  4. **"Device Punch Logs":**
     - Retains raw hardware log stream with from/to date filters for debugging and audit transparency.

### 5. Admin Interface Alignment (`PunchRequestsAdminClient.tsx` & tests)
- Update `REASON_LABELS` with generalized terminal phrasing.
- Update `src/app/punches/requests/page.test.tsx` line 273 to assert generalized label.
