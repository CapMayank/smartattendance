# EPFO Member Compliance Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the EPFO Member Compliance Hub inside `/payroll/staff` to track each EPF employee's lifecycle state, validate required statutory fields in place, and export EPFO-compliant `#~#` bulk text files for New Member Registration, Mark Exit, and KYC Seeding.

**Architecture:** Pure domain modules under `src/lib/epfo/` compute each member's lifecycle next action (`NEEDS_REGISTRATION`, `AWAITING_UAN`, `NEEDS_KYC`, `NEEDS_EXIT`, `UP_TO_DATE`), action-scoped readiness errors, and `#~#`-delimited file contents. Three admin-only Next.js API routes under `src/app/api/payroll/epfo/` serve enriched member rows, run server-revalidated transactional exports with audit logging, and handle mark-as-filed/undo operations. A second tab (`EPFO Members`) on `/payroll/staff` provides queue chips, readiness popovers, in-place profile fixing, pre-export review dialogs, and post-export undo.

**Tech Stack:** Next.js App Router (TypeScript), Prisma 6 (`postgresql`), NextAuth (`requireRole(['ADMIN'])`), Tailwind CSS + `@/components/ui` kit, Lucide React icons, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-epfo-member-management-design.md`

## Global Constraints

- Delimiter for all EPFO bulk files is `#~#` (Hash-Tilde-Hash), plain ASCII `.txt`, lines separated by `\n`, **no trailing blank line**.
- All field values must be trimmed, with `#`, `~`, `\r`, and `\n` stripped; names are uppercased with titles (`Mr`, `Mrs`, `Ms`, `Miss`, `Dr`, `Shri`, `Smt`, `Kumari`) removed.
- All dates in exported files use `DD/MM/YYYY`.
- Filenames: `EPFO_REG_YYYYMMDD_HHmm.txt`, `EPFO_EXIT_YYYYMMDD_HHmm.txt`, `EPFO_KYC_YYYYMMDD_HHmm.txt`.
- Column 12 (Registration Monthly Wages) must call `calculateStaffPayroll({ payGroup: 'BANK_EPF', monthlyCtc, presentDays: 30, totalDays: 30 }).epfWages` — never duplicate the wage formula.
- Mark Exit file is strictly 3 columns (`UAN#~#DATE_OF_EXIT#~#REASON_CODE` where code is `C | S | R | D | A | P`). The exit dialog cannot edit the last working day.
- KYC Seed file is strictly 5 columns (`UAN#~#DOC_TYPE#~#DOC_NUMBER#~#NAME_AS_PER_DOC#~#IFSC` where doc type is `B | P | A`). Missing/invalid docs are skipped and never emit empty placeholder lines.
- Export routes require `requireRole(session, ['ADMIN'])`, re-validate on the server, update tracking fields and write an `AuditLog` in a single `$transaction`, and never log raw Aadhaar, PAN, or bank account numbers in `AuditLog.details`.
- UI uses Lucide icons only (no emoji icons) and existing `tone-present / tone-accent / tone-absent` badge classes.

## Review Focus

1. **Delimiter and title characters in user-entered names:** A name or father's name containing `#~#`, `~`, `\r\n`, or prefixes like `"Dr. Ramesh Kumar"` must have delimiters/newlines stripped and titles dropped so column count in the 30-column registration file never shifts.
2. **Aadhaar leading-digit rule and IFSC 5th-character zero rule:** A 12-digit Aadhaar starting with `0` or `1`, or an 11-character IFSC whose 5th character is `'O'` instead of `'0'`, must fail validation with a clear field error before export.
3. **Rejoined staff member with previously exported closed period:** When period 1 has `epfoJoinExportedAt` and `epfoExitExportedAt` set, and a new active period 2 has both `null`, the member must evaluate to `NEEDS_REGISTRATION` and use period 2's `startDate` as DOJ.
4. **Mid-tenure switch from `CASH` to `BANK_EPF`:** A staff member who joined on `2024-06-15` under `CASH` and switched to `BANK_EPF` via `PayGroupChange` (`effectiveFromMonth: "2026-09"`) must get an EPF joining date of `2026-09-01` (`01/09/2026`), and Mark Exit must reject an exit date earlier than `2026-09-01`.
5. **Partial KYC export when one member has only a subset of valid docs and another has none:** A member with valid Bank + missing PAN emits only the `B` line and gets `epfoKycExportedAt` updated; a selected member with zero valid documents emits no lines and does **not** get `epfoKycExportedAt` marked as exported.

---

### Task 1: Schema Additions & Legacy `bulk-reg` Cleanup

**Files:**
- Modify: `prisma/schema.prisma:266-360`
- Modify: `src/lib/schema.test.ts:70-115`
- Modify: `src/app/api/payroll/export/[type]/route.ts:465-520`
- Modify: `src/app/api/payroll/export/[type]/route.test.ts:120-135`

**Interfaces:**
- Produces:
  - `EmploymentPeriod` fields: `epfoJoinExportedAt: Date | null`, `epfoExitExportedAt: Date | null`, `epfoExitCode: string | null`
  - `StaffPayrollInfo` fields: `epfoKycExportedAt: Date | null`, `epfoKycExportedHash: string | null`

- [x] **Step 1: Write failing schema and export route tests**

In `src/lib/schema.test.ts`, add assertions inside `StaffPayrollInfo and MonthlyPayroll additions` and `defines EmploymentPeriod`:
```typescript
expect(payrollInfo!.fields.map((f) => f.name)).toEqual(
  expect.arrayContaining(['epfoKycExportedAt', 'epfoKycExportedHash'])
)
expect(employmentPeriodModel!.fields.map((f) => f.name)).toEqual(
  expect.arrayContaining(['epfoJoinExportedAt', 'epfoExitExportedAt', 'epfoExitCode'])
)
```
In `src/app/api/payroll/export/[type]/route.test.ts`, replace `"bulk-reg export excludes CASH payGroup staff"` with:
```typescript
it("returns 400 for removed legacy bulk-reg export type", async () => {
  const req = new Request("http://localhost/api/payroll/export/bulk-reg?month=11&year=2026");
  const res = await GET(req, { params: Promise.resolve({ type: "bulk-reg" }) });
  expect(res.status).toBe(400);
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/schema.test.ts src/app/api/payroll/export/[type]/route.test.ts`
Expected: FAIL (`epfoKycExportedAt` missing in schema DMMF; `bulk-reg` returns 200 instead of 400).

- [x] **Step 3: Update `prisma/schema.prisma`, regenerate Prisma Client, and remove `bulk-reg` from `src/app/api/payroll/export/[type]/route.ts`**

Add to `StaffPayrollInfo` in `prisma/schema.prisma`:
```prisma
  epfoKycExportedAt     DateTime?
  epfoKycExportedHash   String?
```
Add to `EmploymentPeriod` in `prisma/schema.prisma`:
```prisma
  epfoJoinExportedAt DateTime?
  epfoExitExportedAt DateTime?
  epfoExitCode       String?   // C | S | R | D | A | P
```
Run `npx prisma generate`.
In `src/app/api/payroll/export/[type]/route.ts`, delete the `else if (type === "bulk-reg") { ... }` block (lines 466–516).

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/schema.test.ts src/app/api/payroll/export/[type]/route.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/lib/schema.test.ts src/app/api/payroll/export/[type]/route.ts src/app/api/payroll/export/[type]/route.test.ts
git commit -m "feat(epfo): add EPFO export tracking fields to schema and remove legacy bulk-reg"
```

---

### Task 2: EPFO Types, Value Mappings, Sanitisation, and KYC Hash

**Files:**
- Create: `src/lib/epfo/types.ts`
- Create: `src/lib/epfo/mappings.ts`
- Create: `src/lib/epfo/kyc-hash.ts`
- Test: `src/lib/epfo/mappings.test.ts`

**Interfaces:**
- Produces:
  - `src/lib/epfo/types.ts`:
    ```typescript
    export type EpfoNextAction =
      | 'NEEDS_EXIT'
      | 'NEEDS_REGISTRATION'
      | 'AWAITING_UAN'
      | 'NEEDS_KYC'
      | 'UP_TO_DATE'
      | 'HIDDEN';

    export type EpfoExitReasonCode = 'C' | 'S' | 'R' | 'D' | 'A' | 'P';
    export type EpfoDocType = 'B' | 'P' | 'A';

    export interface EpfoValidationError {
      field: string;
      message: string;
    }

    export interface EpfoValidationResult {
      ready: boolean;
      errors: EpfoValidationError[];
    }

    export interface EpfoPeriodRecord {
      id: string;
      startDate: string; // YYYY-MM-DD
      endDate: string | null;
      exitReason: string | null;
      epfoJoinExportedAt: Date | string | null;
      epfoExitExportedAt: Date | string | null;
      epfoExitCode: string | null;
    }

    export interface EpfoPayGroupChangeRecord {
      payGroup: string;
      effectiveFromMonth: string; // YYYY-MM
    }

    export interface EpfoPayrollInfoRecord {
      payGroup?: string | null;
      isActiveForPayroll?: boolean | null;
      monthlyCtc?: number | null;
      uan?: string | null;
      nameOnUan?: string | null;
      previousMemberId?: string | null;
      dob?: Date | string | null;
      doj?: Date | string | null;
      gender?: string | null;
      fatherHusbandName?: string | null;
      relationship?: string | null;
      mobileNumber?: string | null;
      email?: string | null;
      nationality?: string | null;
      qualification?: string | null;
      maritalStatus?: string | null;
      isInternationalWorker?: string | null;
      countryOfOrigin?: string | null;
      passportNumber?: string | null;
      passportValidFrom?: Date | string | null;
      passportValidTill?: Date | string | null;
      isPhysicalHandicap?: string | null;
      locomotive?: string | null;
      hearing?: string | null;
      visual?: string | null;
      bankAccount?: string | null;
      ifsc?: string | null;
      nameAsPerBank?: string | null;
      pan?: string | null;
      nameOnPan?: string | null;
      aadhaar?: string | null;
      nameOnAadhaar?: string | null;
      epfoKycExportedAt?: Date | string | null;
      epfoKycExportedHash?: string | null;
      payGroupChanges?: EpfoPayGroupChangeRecord[];
    }

    export interface EpfoMemberInput {
      id: string;
      machineId: string;
      employeeCode?: string | null;
      name: string;
      joiningDate?: string | null;
      payrollInfo?: EpfoPayrollInfoRecord | null;
      employmentPeriods?: EpfoPeriodRecord[];
    }
    ```
  - `src/lib/epfo/mappings.ts`:
    - `sanitizeEpfoText(val: string | null | undefined, maxLen?: number): string`
    - `sanitizeEpfoName(val: string | null | undefined, maxLen?: number): string`
    - `formatEpfoDate(val: Date | string | null | undefined): string`
    - `parseIsoDateKey(val: Date | string | null | undefined): string | null` (returns `YYYY-MM-DD`)
    - `mapGender(gender: string | null | undefined): 'M' | 'F' | 'T' | ''`
    - `mapRelationship(rel: string | null | undefined): 'F' | 'H' | null`
    - `mapMaritalStatus(ms: string | null | undefined): 'M' | 'U' | 'W' | 'D' | ''`
    - `computeEpfJoiningDate(member: EpfoMemberInput): string | null` (returns `YYYY-MM-DD`)
    - `defaultExitReasonCode(exitReason: string | null | undefined, dob: Date | string | null | undefined, exitDate: string | null | undefined): EpfoExitReasonCode`
  - `src/lib/epfo/kyc-hash.ts`:
    - `computeKycHash(info: EpfoPayrollInfoRecord | null | undefined): string`

- [x] **Step 1: Write failing unit tests in `src/lib/epfo/mappings.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import {
  sanitizeEpfoText,
  sanitizeEpfoName,
  formatEpfoDate,
  mapGender,
  mapRelationship,
  mapMaritalStatus,
  computeEpfJoiningDate,
  defaultExitReasonCode,
} from './mappings';
import { computeKycHash } from './kyc-hash';

describe('EPFO mappings & sanitisation', () => {
  it('strips #~# delimiters, newlines, and honorific titles from names (Review Focus #1)', () => {
    expect(sanitizeEpfoName('Dr. Ramesh#~# Kumar\r\n')).toBe('RAMESH KUMAR');
    expect(sanitizeEpfoName('Smt. Priya   Sharma')).toBe('PRIYA SHARMA');
    expect(sanitizeEpfoName('Mr Anil~Verma#')).toBe('ANIL VERMA');
    expect(sanitizeEpfoText('ABC#~#123\n456')).toBe('ABC123 456');
  });

  it('formats ISO dates and Date objects to DD/MM/YYYY', () => {
    expect(formatEpfoDate('2026-09-17')).toBe('17/09/2026');
    expect(formatEpfoDate(new Date('2000-01-05T00:00:00.000Z'))).toBe('05/01/2000');
    expect(formatEpfoDate(null)).toBe('');
  });

  it('maps stored gender, relationship, and marital status to EPFO single-char codes', () => {
    expect(mapGender('Male')).toBe('M');
    expect(mapGender('Female')).toBe('F');
    expect(mapGender('Other')).toBe('T');
    expect(mapRelationship('Father')).toBe('F');
    expect(mapRelationship('Husband')).toBe('H');
    expect(mapRelationship('Mother')).toBeNull();
    expect(mapRelationship('Other')).toBeNull();
    expect(mapMaritalStatus('Married')).toBe('M');
    expect(mapMaritalStatus('Unmarried')).toBe('U');
    expect(mapMaritalStatus('Single')).toBe('U');
    expect(mapMaritalStatus('Widowed')).toBe('W');
    expect(mapMaritalStatus('Divorced')).toBe('D');
  });

  it('computes EPF joining date as later of period startDate and latest BANK_EPF PayGroupChange (Review Focus #4)', () => {
    const switchedMember = {
      id: 's1',
      machineId: '1',
      name: 'Test',
      joiningDate: '2024-06-15',
      employmentPeriods: [
        { id: 'p1', startDate: '2024-06-15', endDate: null, exitReason: null, epfoJoinExportedAt: null, epfoExitExportedAt: null, epfoExitCode: null },
      ],
      payrollInfo: {
        payGroup: 'BANK_EPF',
        payGroupChanges: [
          { payGroup: 'CASH', effectiveFromMonth: '2024-06' },
          { payGroup: 'BANK_EPF', effectiveFromMonth: '2026-09' },
        ],
      },
    };
    expect(computeEpfJoiningDate(switchedMember)).toBe('2026-09-01');
  });

  it('maps retirement exit reason to S when age >= 58 on exit date, else R, and others to C', () => {
    expect(defaultExitReasonCode('RETIREMENT', '1965-03-10', '2026-03-31')).toBe('S'); // age 61
    expect(defaultExitReasonCode('RETIRED', '1975-03-10', '2026-03-31')).toBe('R');    // age 51
    expect(defaultExitReasonCode('RESIGNATION', '1990-01-01', '2026-03-31')).toBe('C');
    expect(defaultExitReasonCode('RESIGNED', '1990-01-01', '2026-03-31')).toBe('C');
    expect(defaultExitReasonCode('TERMINATION', '1990-01-01', '2026-03-31')).toBe('C');
  });

  it('computes deterministic KYC hash that changes when any KYC field changes', () => {
    const h1 = computeKycHash({
      bankAccount: ' 12345678901 ',
      ifsc: 'sbin0001234',
      nameAsPerBank: 'Ramesh Kumar',
      pan: 'abcde1234f',
      nameOnPan: 'Ramesh Kumar',
      aadhaar: '234567890123',
      nameOnAadhaar: 'Ramesh Kumar',
    });
    const h2 = computeKycHash({
      bankAccount: '12345678901',
      ifsc: 'SBIN0001234',
      nameAsPerBank: 'RAMESH KUMAR',
      pan: 'ABCDE1234F',
      nameOnPan: 'RAMESH KUMAR',
      aadhaar: '234567890123',
      nameOnAadhaar: 'RAMESH KUMAR',
    });
    const h3 = computeKycHash({
      bankAccount: '99999999999',
      ifsc: 'SBIN0001234',
      nameAsPerBank: 'RAMESH KUMAR',
    });
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(computeKycHash({})).toBe('');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/epfo/mappings.test.ts`
Expected: FAIL (`Cannot find module './mappings'`)

- [x] **Step 3: Implement `src/lib/epfo/types.ts`, `src/lib/epfo/mappings.ts`, and `src/lib/epfo/kyc-hash.ts`**

- In `sanitizeEpfoName`: strip `#`, `~`, `\r`, `\n`, replace multiple spaces, strip leading `(?:MR|MRS|MS|MISS|DR|SHRI|SMT|KUMARI)\.?\s+` (case-insensitive), uppercase, slice to `maxLen` (default 100).
- In `computeEpfJoiningDate`: pick latest `EmploymentPeriod` (sorted by `startDate` desc); base date is `latestPeriod.startDate || parseIsoDateKey(member.payrollInfo?.doj) || member.joiningDate`. Find latest `PayGroupChange` with `payGroup === 'BANK_EPF'`; if its `${effectiveFromMonth}-01` > base date, return `${effectiveFromMonth}-01`, else return base date.
- In `computeKycHash`: use Node's `crypto.createHash('sha256')` over `[bankAccount, ifsc, nameAsPerBank, pan, nameOnPan, aadhaar, nameOnAadhaar]` after trimming and uppercasing (with `sanitizeEpfoName` on names). Return `""` if `bankAccount`, `pan`, and `aadhaar` are all empty.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/epfo/mappings.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/epfo/types.ts src/lib/epfo/mappings.ts src/lib/epfo/kyc-hash.ts src/lib/epfo/mappings.test.ts
git commit -m "feat(epfo): add value mappings, name sanitiser, EPF DOJ resolver, and KYC hash"
```

---

### Task 3: Next-Action Lifecycle Engine & Action-Scoped Validator

**Files:**
- Create: `src/lib/epfo/next-action.ts`
- Create: `src/lib/epfo/validation.ts`
- Test: `src/lib/epfo/validation.test.ts`

**Interfaces:**
- Consumes: `EpfoMemberInput`, `EpfoNextAction`, `EpfoDocType`, `EpfoValidationResult` from `src/lib/epfo/types.ts`; helpers from `src/lib/epfo/mappings.ts` and `src/lib/epfo/kyc-hash.ts`.
- Produces:
  - `getLatestEmploymentPeriod(member: EpfoMemberInput): EpfoPeriodRecord | null`
  - `getEpfoNextAction(member: EpfoMemberInput): EpfoNextAction`
  - `validateForRegistration(member: EpfoMemberInput): EpfoValidationResult`
  - `validateForExit(member: EpfoMemberInput): EpfoValidationResult`
  - `validateForKyc(member: EpfoMemberInput, docTypes?: EpfoDocType[]): EpfoValidationResult & { validDocs: EpfoDocType[]; skippedDocs: Array<{ docType: EpfoDocType; reason: string }> }`
  - `validateForNextAction(member: EpfoMemberInput, action?: EpfoNextAction): EpfoValidationResult`

- [x] **Step 1: Write failing tests in `src/lib/epfo/validation.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { getEpfoNextAction } from './next-action';
import { validateForRegistration, validateForExit, validateForKyc, validateForNextAction } from './validation';
import { computeKycHash } from './kyc-hash';
import type { EpfoMemberInput } from './types';

const baseReadyMember: EpfoMemberInput = {
  id: 's1',
  machineId: '101',
  name: 'Ramesh Kumar',
  joiningDate: '2026-01-10',
  employmentPeriods: [
    { id: 'p1', startDate: '2026-01-10', endDate: null, exitReason: null, epfoJoinExportedAt: null, epfoExitExportedAt: null, epfoExitCode: null },
  ],
  payrollInfo: {
    payGroup: 'BANK_EPF',
    monthlyCtc: 22400,
    dob: '1992-05-15',
    gender: 'Male',
    fatherHusbandName: 'Suresh Kumar',
    relationship: 'Father',
    mobileNumber: '9876543210',
    maritalStatus: 'Married',
    bankAccount: '123456789012',
    ifsc: 'SBIN0001234',
    nameAsPerBank: 'RAMESH KUMAR',
    pan: 'ABCDE1234F',
    nameOnPan: 'RAMESH KUMAR',
    aadhaar: '234567890123',
    nameOnAadhaar: 'RAMESH KUMAR',
  },
};

describe('getEpfoNextAction & action-scoped validation', () => {
  it('places active BANK_EPF member with existing UAN in NEEDS_REGISTRATION when epfoJoinExportedAt is null', () => {
    const m: EpfoMemberInput = {
      ...baseReadyMember,
      payrollInfo: { ...baseReadyMember.payrollInfo, uan: '100234567890' },
    };
    expect(getEpfoNextAction(m)).toBe('NEEDS_REGISTRATION');
    expect(validateForNextAction(m).ready).toBe(true);
  });

  it('transitions to AWAITING_UAN -> NEEDS_KYC -> UP_TO_DATE -> NEEDS_KYC on KYC edit', () => {
    const awaitingUan: EpfoMemberInput = {
      ...baseReadyMember,
      employmentPeriods: [{ ...baseReadyMember.employmentPeriods![0], epfoJoinExportedAt: new Date() }],
    };
    expect(getEpfoNextAction(awaitingUan)).toBe('AWAITING_UAN');

    const withUan: EpfoMemberInput = {
      ...awaitingUan,
      payrollInfo: { ...baseReadyMember.payrollInfo, uan: '100234567890' },
    };
    expect(getEpfoNextAction(withUan)).toBe('NEEDS_KYC');

    const hash = computeKycHash(withUan.payrollInfo);
    const upToDate: EpfoMemberInput = {
      ...withUan,
      payrollInfo: { ...withUan.payrollInfo, epfoKycExportedAt: new Date(), epfoKycExportedHash: hash },
    };
    expect(getEpfoNextAction(upToDate)).toBe('UP_TO_DATE');

    const editedBank: EpfoMemberInput = {
      ...upToDate,
      payrollInfo: { ...upToDate.payrollInfo, bankAccount: '999999999999' },
    };
    expect(getEpfoNextAction(editedBank)).toBe('NEEDS_KYC');
  });

  it('evaluates rejoined staff member to NEEDS_REGISTRATION for the new period (Review Focus #3)', () => {
    const rejoined: EpfoMemberInput = {
      ...baseReadyMember,
      employmentPeriods: [
        { id: 'p2', startDate: '2026-10-01', endDate: null, exitReason: null, epfoJoinExportedAt: null, epfoExitExportedAt: null, epfoExitCode: null },
        { id: 'p1', startDate: '2024-01-01', endDate: '2025-12-31', exitReason: 'RESIGNATION', epfoJoinExportedAt: new Date('2024-02-01'), epfoExitExportedAt: new Date('2026-01-05'), epfoExitCode: 'C' },
      ],
    };
    expect(getEpfoNextAction(rejoined)).toBe('NEEDS_REGISTRATION');
  });

  it('rejects Aadhaar starting with 0/1, IFSC without 0 at 5th char, and Mother relationship (Review Focus #2)', () => {
    const bad: EpfoMemberInput = {
      ...baseReadyMember,
      payrollInfo: {
        ...baseReadyMember.payrollInfo,
        relationship: 'Mother',
        aadhaar: '123456789012',
        ifsc: 'SBINO001234', // letter O instead of digit 0
      },
    };
    const res = validateForRegistration(bad);
    expect(res.ready).toBe(false);
    expect(res.errors.map((e) => e.field)).toEqual(
      expect.arrayContaining(['relationship', 'aadhaar', 'ifsc'])
    );
  });

  it('rejects exit when exitDate is earlier than EPF joining date after CASH->BANK_EPF switch (Review Focus #4)', () => {
    const exitedBeforeSwitch: EpfoMemberInput = {
      ...baseReadyMember,
      employmentPeriods: [
        { id: 'p1', startDate: '2024-01-01', endDate: '2026-08-15', exitReason: 'RESIGNATION', epfoJoinExportedAt: new Date(), epfoExitExportedAt: null, epfoExitCode: null },
      ],
      payrollInfo: {
        ...baseReadyMember.payrollInfo,
        uan: '100234567890',
        payGroupChanges: [{ payGroup: 'BANK_EPF', effectiveFromMonth: '2026-09' }],
      },
    };
    const res = validateForExit(exitedBeforeSwitch);
    expect(res.ready).toBe(false);
    expect(res.errors.some((e) => e.field === 'endDate')).toBe(true);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/epfo/validation.test.ts`
Expected: FAIL (`Cannot find module './next-action'`)

- [x] **Step 3: Implement `src/lib/epfo/next-action.ts` and `src/lib/epfo/validation.ts`**

Validation rules to enforce:
- **Registration (`validateForRegistration`):**
  - `uan`: optional, but if present must match `/^\d{12}$/`.
  - `dob`: required, valid date, and at least 14 years before EPF joining date.
  - `doj` (via `computeEpfJoiningDate`): required.
  - `gender`: `mapGender` must be `'M' | 'F' | 'T'`.
  - `fatherHusbandName`: non-empty after `sanitizeEpfoName`.
  - `relationship`: `mapRelationship` must be `'F' | 'H'` (blocks `Mother`/`Other` with message `"EPFO accepts only Father (F) or Husband (H)"`).
  - `mobileNumber`: `/^[6-9]\d{9}$/`.
  - `maritalStatus`: `mapMaritalStatus` must be `'M' | 'U' | 'W' | 'D'`.
  - `monthlyCtc`: `> 0`.
  - `aadhaar`: `/^[2-9]\d{11}$/` (12 digits, cannot start with 0 or 1).
  - If `isInternationalWorker === 'Y'`: `passportNumber`, `passportValidFrom`, `passportValidTill` required.
  - Optional KYC fields if filled on registration: `ifsc` `/^[A-Z]{4}0[A-Z0-9]{6}$/`, `bankAccount` `/^\d{9,18}$/`, `pan` `/^[A-Z]{5}\d{4}[A-Z]$/`.
- **Exit (`validateForExit`):**
  - `uan`: required, `/^\d{12}$/`.
  - Latest period `endDate`: required, valid `YYYY-MM-DD`, and `>= computeEpfJoiningDate(member)`.
  - `exitReason`: required.
- **KYC (`validateForKyc`):**
  - `uan`: required, `/^\d{12}$/`.
  - Checks each requested docType (`['B', 'P', 'A']` by default):
    - `'B'`: requires `bankAccount` (`/^\d{9,18}$/`), `ifsc` (`/^[A-Z]{4}0[A-Z0-9]{6}$/`), and non-empty `nameAsPerBank` (or fallback `name`).
    - `'P'`: requires `pan` (`/^[A-Z]{5}\d{4}[A-Z]$/`) and non-empty `nameOnPan` (or fallback `name`).
    - `'A'`: requires `aadhaar` (`/^[2-9]\d{11}$/`) and non-empty `nameOnAadhaar` (or fallback `name`).
  - `ready` is `true` if `uan` is valid and `validDocs.length > 0`. Any missing/invalid requested doc is reported in `errors` and `skippedDocs`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/epfo/validation.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/epfo/next-action.ts src/lib/epfo/validation.ts src/lib/epfo/validation.test.ts
git commit -m "feat(epfo): implement member lifecycle state machine and action-scoped validator"
```

---

### Task 4: Bulk Text File Builders (`src/lib/epfo/formats.ts`)

**Files:**
- Create: `src/lib/epfo/formats.ts`
- Test: `src/lib/epfo/formats.test.ts`

**Interfaces:**
- Consumes: `calculateStaffPayroll` from `src/lib/payroll-calc.ts`; mappings and validators from Tasks 2–3.
- Produces:
  - `EPFO_DELIMITER = '#~#'`
  - `buildRegistrationLine(member: EpfoMemberInput): string`
  - `buildRegistrationFile(members: EpfoMemberInput[]): string`
  - `buildExitLine(member: EpfoMemberInput, overrideReasonCode?: EpfoExitReasonCode): string`
  - `buildExitFile(items: Array<{ member: EpfoMemberInput; reasonCode?: EpfoExitReasonCode }>): string`
  - `buildKycFile(members: EpfoMemberInput[], docTypes?: EpfoDocType[]): { content: string; exportedStaffIds: string[]; skipped: Array<{ staffId: string; staffName: string; docType: EpfoDocType; reason: string }> }`

- [x] **Step 1: Write failing tests in `src/lib/epfo/formats.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import {
  buildRegistrationLine,
  buildRegistrationFile,
  buildExitFile,
  buildKycFile,
} from './formats';
import type { EpfoMemberInput } from './types';

const sampleMember: EpfoMemberInput = {
  id: 's1',
  machineId: '101',
  name: 'Mr. Ramesh Kumar',
  joiningDate: '2026-09-01',
  employmentPeriods: [
    { id: 'p1', startDate: '2026-09-01', endDate: '2026-10-31', exitReason: 'RESIGNATION', epfoJoinExportedAt: new Date(), epfoExitExportedAt: null, epfoExitCode: null },
  ],
  payrollInfo: {
    payGroup: 'BANK_EPF',
    monthlyCtc: 16800, // 16800 / 1.12 = 15000 epfWages
    uan: '100248330106',
    nameOnUan: 'RAMESH KUMAR',
    dob: '1990-04-15',
    gender: 'Male',
    fatherHusbandName: 'Shri Suresh Kumar',
    relationship: 'Father',
    mobileNumber: '9876543210',
    email: 'ramesh@example.com',
    nationality: 'INDIAN',
    qualification: 'GRADUATE',
    maritalStatus: 'Married',
    bankAccount: '123456789012',
    ifsc: 'HDFC0001234',
    nameAsPerBank: 'RAMESH KUMAR',
    pan: 'ABCDE1234F',
    nameOnPan: 'RAMESH KUMAR',
    aadhaar: '234567890123',
    nameOnAadhaar: 'RAMESH KUMAR',
  },
};

describe('EPFO bulk file builders', () => {
  it('builds a 30-column #~# registration line using calculateStaffPayroll epfWages and mapped codes', () => {
    const line = buildRegistrationLine(sampleMember);
    const cols = line.split('#~#');
    expect(cols).toHaveLength(30);
    expect(cols[0]).toBe('100248330106'); // UAN
    expect(cols[2]).toBe('RAMESH KUMAR'); // Name
    expect(cols[3]).toBe('15/04/1990');   // DOB
    expect(cols[4]).toBe('01/09/2026');   // DOJ
    expect(cols[5]).toBe('M');            // Gender mapped
    expect(cols[6]).toBe('SURESH KUMAR'); // Father name with 'Shri' stripped
    expect(cols[7]).toBe('F');            // Relationship mapped
    expect(cols[11]).toBe('15000');       // Column 12: epfWages from calculateStaffPayroll
    expect(cols[13]).toBe('M');           // Marital status mapped
    expect(cols[23]).toBe('123456789012');
    expect(cols[24]).toBe('HDFC0001234');
    expect(cols[28]).toBe('234567890123');
    expect(buildRegistrationFile([sampleMember]).endsWith('\n')).toBe(false);
  });

  it('builds a 3-column Mark Exit file without trailing newline', () => {
    const txt = buildExitFile([{ member: sampleMember }]);
    expect(txt).toBe('100248330106#~#31/10/2026#~#C');
  });

  it('builds 5-column KYC lines for valid docs only and tracks exportedStaffIds accurately (Review Focus #5)', () => {
    const partialMember: EpfoMemberInput = {
      ...sampleMember,
      id: 's-partial',
      payrollInfo: { ...sampleMember.payrollInfo, pan: null }, // Bank + Aadhaar valid, PAN missing
    };
    const noValidDocsMember: EpfoMemberInput = {
      ...sampleMember,
      id: 's-empty',
      payrollInfo: { ...sampleMember.payrollInfo, bankAccount: null, pan: null, aadhaar: '012345678901' }, // invalid aadhaar
    };

    const res = buildKycFile([partialMember, noValidDocsMember], ['B', 'P', 'A']);
    const lines = res.content.split('\n');
    expect(lines).toEqual([
      '100248330106#~#B#~#123456789012#~#RAMESH KUMAR#~#HDFC0001234',
      '100248330106#~#A#~#234567890123#~#RAMESH KUMAR#~#',
    ]);
    expect(res.exportedStaffIds).toEqual(['s-partial']);
    expect(res.skipped.some((s) => s.staffId === 's-partial' && s.docType === 'P')).toBe(true);
    expect(res.skipped.some((s) => s.staffId === 's-empty' && s.docType === 'A')).toBe(true);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/epfo/formats.test.ts`
Expected: FAIL (`Cannot find module './formats'`)

- [x] **Step 3: Implement `src/lib/epfo/formats.ts`**

- Column 3 (Member Name): `sanitizeEpfoName(info.uan ? (info.nameOnUan || info.nameOnAadhaar || member.name) : (info.nameOnAadhaar || info.nameOnUan || member.name))`.
- Column 12 (Monthly Wages): `calculateStaffPayroll({ payGroup: 'BANK_EPF', monthlyCtc: info.monthlyCtc || 0, presentDays: 30, totalDays: 30 })?.epfWages ?? 0`.
- All `.txt` builders join lines with `'\n'` and never append a trailing newline.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/epfo/formats.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/epfo/formats.ts src/lib/epfo/formats.test.ts
git commit -m "feat(epfo): implement 30-col registration, 3-col exit, and 5-col KYC file builders"
```

---

### Task 5: EPFO Backend API Routes (`members`, `export/[type]`, `mark`)

**Files:**
- Create: `src/app/api/payroll/epfo/members/route.ts`
- Create: `src/app/api/payroll/epfo/export/[type]/route.ts`
- Create: `src/app/api/payroll/epfo/mark/route.ts`
- Test: `src/app/api/payroll/epfo/route.test.ts`

**Interfaces:**
- Consumes: `src/lib/epfo/{types,mappings,kyc-hash,next-action,validation,formats}.ts`
- Produces:
  - `GET /api/payroll/epfo/members` -> `{ members: EpfoMemberRow[], counts: Record<EpfoNextAction, number> }`
  - `POST /api/payroll/epfo/export/[type]` (`type` in `'reg' | 'exit' | 'kyc'`)
    - Request body: `{ staffIds: string[]; exitCodes?: Record<string, EpfoExitReasonCode>; docTypes?: EpfoDocType[] }`
    - Response: `200 text/plain` with headers `Content-Disposition: attachment; filename="EPFO_..."` and `X-Epfo-Summary: JSON`, or `422` `{ error, skipped }` when 0 valid lines can be produced.
  - `POST /api/payroll/epfo/mark`
    - Request body: `{ staffIds: string[]; mode: 'MARK_FILED' | 'RESET_PENDING'; target: 'REG' | 'EXIT' | 'KYC' }`
    - Response: `200 { updatedCount: number }`

- [x] **Step 1: Write failing route tests in `src/app/api/payroll/epfo/route.test.ts`**

Test cases to include:
1. `GET /api/payroll/epfo/members` returns 403 for non-ADMIN and returns enriched rows with `nextAction`, `readiness`, `defaultExitCode`, and `exitMonthPayrollLocked` for ADMIN.
2. `POST /api/payroll/epfo/export/reg` skips invalid members on the server, generates the 30-column `.txt` for valid members, sets `epfoJoinExportedAt` on the active `EmploymentPeriod`, and writes an `AuditLog` (`action: 'EPFO_EXPORT_REG'`) containing no Aadhaar/PAN/bank numbers.
3. `POST /api/payroll/epfo/export/exit` returns 422 when all selected rows fail exit validation, and when valid sets `epfoExitExportedAt` and `epfoExitCode` on the latest `EmploymentPeriod` without modifying `endDate` or `exitReason`.
4. `POST /api/payroll/epfo/export/kyc` updates `epfoKycExportedAt` and `epfoKycExportedHash` only for members who had at least 1 valid KYC line exported (Review Focus #5).
5. `POST /api/payroll/epfo/mark` supports both `MARK_FILED` (onboarding already-registered staff) and `RESET_PENDING` (undo/reset).

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/payroll/epfo/route.test.ts`
Expected: FAIL (`Cannot find module './members/route'`)

- [x] **Step 3: Implement `members/route.ts`, `export/[type]/route.ts`, and `mark/route.ts`**

- In `members/route.ts`: query `prisma.staff.findMany` with `department`, `designation`, `payrollInfo: { include: { payGroupChanges: true } }`, `employmentPeriods: { orderBy: { startDate: 'desc' } }`. For any member with `nextAction === 'NEEDS_EXIT'` and a valid `endDate`, check whether a `MonthlyPayroll` row for that `(staffId, month, year)` exists with `isLocked: true` to set `exitMonthPayrollLocked: boolean`.
- In `export/[type]/route.ts`: inside `prisma.$transaction`, update `employmentPeriod` or `staffPayrollInfo` and create `auditLog` with `details: JSON.stringify({ type, exportedStaffIds, skipped })` (strictly IDs and field names, never PII values).
- In `mark/route.ts`: for `MARK_FILED`, set `epfoJoinExportedAt = now` (for `REG`), `epfoExitExportedAt = now` (for `EXIT`), or `epfoKycExportedAt = now` + `epfoKycExportedHash = computeKycHash(info)` (for `KYC`). For `RESET_PENDING`, clear those fields back to `null`. Record an `AuditLog` (`action: 'EPFO_MARK_FILED'` or `'EPFO_RESET_PENDING'`).

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/payroll/epfo/route.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/app/api/payroll/epfo/members/route.ts src/app/api/payroll/epfo/export/[type]/route.ts src/app/api/payroll/epfo/mark/route.ts src/app/api/payroll/epfo/route.test.ts
git commit -m "feat(epfo): add members, bulk export, and mark/reset API routes"
```

---

### Task 6: Staff API & `StaffProfileModal` Support for Missing EPFO Fields

**Files:**
- Modify: `src/app/api/staff/route.ts:55-76,130-165,470-525`
- Modify: `src/components/staff/StaffProfileModal.tsx:65-150,200-220,310-335,720-805,930-1015`
- Test: `src/app/api/staff/route.epfo-fields.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/staff` and `PUT /api/staff` support for: `maritalStatus`, `nameOnUan`, `nameOnPan`, `nameOnAadhaar`, `previousMemberId`, `isInternationalWorker`, `countryOfOrigin`, `passportNumber`, `passportValidFrom`, `passportValidTill`, `isPhysicalHandicap`, `locomotive`, `hearing`, `visual`.
  - `StaffProfileModalProps` extended with optional `initialTab?: 'general' | 'kyc' | 'shift' | 'statutory'` and `highlightedFields?: string[]`.

- [x] **Step 1: Write failing test in `src/app/api/staff/route.epfo-fields.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Verify PUT /api/staff persists maritalStatus, nameOnAadhaar, nameOnPan, nameOnUan, previousMemberId,
// and international worker / disability fields into prisma.staffPayrollInfo.upsert.
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/staff/route.epfo-fields.test.ts`
Expected: FAIL (`maritalStatus` and `nameOnAadhaar` not passed to `staffPayrollInfo.upsert`)

- [x] **Step 3: Update `src/app/api/staff/route.ts` and `src/components/staff/StaffProfileModal.tsx`**

- In `src/app/api/staff/route.ts`:
  - Add the 14 EPFO fields to `payrollInfo.select` in `GET`, to `POST` creation, and to `hasPayrollOrKyc` + `payrollUpdateData` in `PUT`.
- In `src/components/staff/StaffProfileModal.tsx`:
  - Accept `initialTab?: 'general' | 'kyc' | 'shift' | 'statutory'` and `highlightedFields?: string[]`. When `open` becomes true with `initialTab`, set `activeTab` to `initialTab`.
  - In Tab 2 (`kyc`), add `Marital Status` select (`Married`, `Unmarried`, `Widowed`, `Divorced`).
  - In Tab 4 (`statutory`), add an **EPFO Member Details** section with inputs for `Name on Aadhaar`, `Name on PAN`, `Name on UAN`, and `Previous Member ID`, plus a collapsible `<details>` group **Additional EPFO Fields (International Worker & Disability)** containing `isInternationalWorker`, `countryOfOrigin`, `passportNumber`, `passportValidFrom`, `passportValidTill`, `isPhysicalHandicap`, `locomotive`, `hearing`, `visual`.
  - Highlight any field whose key appears in `highlightedFields` with an amber ring/helper badge.

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/staff/route.epfo-fields.test.ts src/app/api/staff/route.create.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/app/api/staff/route.ts src/components/staff/StaffProfileModal.tsx src/app/api/staff/route.epfo-fields.test.ts
git commit -m "feat(staff): expose all EPFO statutory and KYC fields in Staff API and profile modal"
```

---

### Task 7: EPFO Members Tab, Dialogs, and Dual-Tab Integration on `/payroll/staff`

**Files:**
- Create: `src/components/payroll/epfo/ExportSummaryDialog.tsx`
- Create: `src/components/payroll/epfo/MarkExitDialog.tsx`
- Create: `src/components/payroll/epfo/EpfoMembersTab.tsx`
- Modify: `src/app/payroll/staff/page.tsx`
- Test: `src/components/payroll/epfo/EpfoMembersTab.test.tsx`

**Interfaces:**
- Consumes: `GET /api/payroll/epfo/members`, `POST /api/payroll/epfo/export/[type]`, `POST /api/payroll/epfo/mark`, `PUT /api/payroll/staff`, and `StaffProfileModal` from Task 6.
- Produces:
  - `ExportSummaryDialog` (shows ready members vs skipped members with reasons before triggering download)
  - `MarkExitDialog` (shows read-only Last Working Day, per-row `C/S/R/D/A/P` reason selector, and unlocked exit-month payroll warning)
  - `EpfoMembersTab` (queue chips, readiness popover + `Fix` button, inline 12-digit UAN input on `AWAITING_UAN` rows, bulk `Mark as already filed`, sticky export footer, and post-export Undo toast/banner)

- [x] **Step 1: Write failing component tests in `src/components/payroll/epfo/EpfoMembersTab.test.tsx`**

Test cases to include:
1. Renders queue chips (`Needs registration`, `Awaiting UAN`, `Needs exit`, `KYC pending`, `Up to date`, `All EPF`) with counts from `/api/payroll/epfo/members`.
2. Clicking a row's `⚠ N missing` badge or `Fix` button invokes `onFixMember(staffId, tab, missingFieldKeys)` with the exact missing fields.
3. In the `Awaiting UAN` queue, entering a 12-digit UAN and clicking Save calls `PUT /api/payroll/staff` and refreshes the member list.
4. Selecting rows in `Needs exit` opens `MarkExitDialog` with read-only exit dates, editable reason codes (`C/S/R/D/A/P`), and shows a non-blocking warning when `exitMonthPayrollLocked` is `false`.
5. After an export completes, an Undo banner appears and clicking **Undo** calls `POST /api/payroll/epfo/mark` with `mode: 'RESET_PENDING'` for the just-exported `staffIds`.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/payroll/epfo/EpfoMembersTab.test.tsx`
Expected: FAIL (`Cannot find module './EpfoMembersTab'`)

- [x] **Step 3: Implement `ExportSummaryDialog.tsx`, `MarkExitDialog.tsx`, `EpfoMembersTab.tsx`, and wire into `src/app/payroll/staff/page.tsx`**

- Follow `@/components/ui` components (`Card`, `Chip`, `ChipGroup`, `Button`, `Modal`, `Input`, `Select`) and Lucide icons (`CheckCircle2`, `AlertTriangle`, `Download`, `RotateCcw`, `FileText`, `Wrench`).
- Sync active tab on `/payroll/staff` with URL search parameter `?tab=epfo` (defaulting to Salary & Pay Groups).
- Include a pre-upload verification notice in the export dialog reminding the admin to compare the first generated file against the current sample template on the EPFO Unified Employer Portal before final submission.

- [x] **Step 4: Run test suite to verify everything passes**

Run: `npx vitest run`
Expected: All test suites PASS with zero regressions.

- [x] **Step 5: Commit**

```bash
git add src/components/payroll/epfo/ExportSummaryDialog.tsx src/components/payroll/epfo/MarkExitDialog.tsx src/components/payroll/epfo/EpfoMembersTab.tsx src/components/payroll/epfo/EpfoMembersTab.test.tsx src/app/payroll/staff/page.tsx
git commit -m "feat(epfo): add EPFO Members compliance tab, dialogs, and undo flow in /payroll/staff"
```
