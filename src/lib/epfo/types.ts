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
