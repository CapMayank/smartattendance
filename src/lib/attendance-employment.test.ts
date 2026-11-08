import { beforeAll, describe, expect, it } from "vitest";
import { computeRangeRecords, type RangeInputs } from "./attendance-range";
import { ensureSchoolTimezone } from "@/lib/timezone";
import { format } from "date-fns";

describe("Employment window filtering in attendance range computation", () => {
  beforeAll(() => {
    ensureSchoolTimezone();
  });

  const defaultPolicy = {
    lateArrivalAllow: "00:15",
    halfDayIfWorkHrsLessThan: "06:00",
    absentIfWorkHrsLessThan: "00:00",
    allInOut: "First IN Last OUT",
  };

  const createInputs = (staff: RangeInputs["staffList"], startStr: string, endStr: string): RangeInputs => {
    const startDate = new Date(`${startStr}T00:00:00+05:30`);
    const endDate = new Date(`${endStr}T23:59:59+05:30`);

    return {
      startDate,
      endDate,
      staffList: staff,
      shiftsById: new Map([
        [
          "sh1",
          { id: "sh1", name: "General", startTime: "09:00", endTime: "17:00" },
        ],
      ]),
      assignmentsByStaff: new Map(),
      policy: defaultPolicy,
      holidayKeys: new Set(),
      weekOffDays: [0], // Sunday
      lockedKeys: new Set(),
      lockedPayrolls: [],
      logsByStaffDay: new Map(),
    };
  };

  it("does not generate daily records or mark absent on days before employee joining date", () => {
    const staff = [
      {
        id: "s1",
        shiftId: "sh1",
        shift: { startTime: "09:00" },
        employmentPeriods: [{ startDate: "2026-06-15", endDate: null }],
      },
    ];

    const inputs = createInputs(staff, "2026-06-01", "2026-06-30");
    const records = computeRangeRecords(inputs, new Date("2026-07-01T00:00:00Z"));

    const dateKeys = records.map((r) => format(r.date, "yyyy-MM-dd"));

    // No records before joining date
    expect(dateKeys.some((d) => d < "2026-06-15")).toBe(false);

    // Records generated on or after joining date
    expect(dateKeys.includes("2026-06-15")).toBe(true);
    expect(dateKeys.includes("2026-06-30")).toBe(true);

    // Verify none of the pre-joining days are marked ABSENT
    const absentDates = records.filter((r) => r.status === "ABSENT").map((r) => format(r.date, "yyyy-MM-dd"));
    expect(absentDates.some((d) => d < "2026-06-15")).toBe(false);
  });

  it("does not generate daily records after employee last working day (exit)", () => {
    const staff = [
      {
        id: "s2",
        shiftId: "sh1",
        shift: { startTime: "09:00" },
        employmentPeriods: [{ startDate: "2026-01-01", endDate: "2026-06-10" }],
      },
    ];

    const inputs = createInputs(staff, "2026-06-01", "2026-06-30");
    const records = computeRangeRecords(inputs, new Date("2026-07-01T00:00:00Z"));

    const dateKeys = records.map((r) => format(r.date, "yyyy-MM-dd"));

    expect(dateKeys.includes("2026-06-01")).toBe(true);
    expect(dateKeys.includes("2026-06-10")).toBe(true);
    expect(dateKeys.some((d) => d > "2026-06-10")).toBe(false);
  });

  it("does not generate daily records in the gap between exit and rejoin", () => {
    const staff = [
      {
        id: "s3",
        shiftId: "sh1",
        shift: { startTime: "09:00" },
        employmentPeriods: [
          { startDate: "2025-01-01", endDate: "2025-03-31" },
          { startDate: "2025-06-01", endDate: null },
        ],
      },
    ];

    const inputs = createInputs(staff, "2025-03-01", "2025-06-30");
    const records = computeRangeRecords(inputs, new Date("2025-07-01T00:00:00Z"));

    const dateKeys = records.map((r) => format(r.date, "yyyy-MM-dd"));

    // Period 1 dates present
    expect(dateKeys.includes("2025-03-15")).toBe(true);
    expect(dateKeys.includes("2025-03-31")).toBe(true);

    // Gap dates absent
    expect(dateKeys.includes("2025-04-01")).toBe(false);
    expect(dateKeys.includes("2025-05-15")).toBe(false);
    expect(dateKeys.includes("2025-05-31")).toBe(false);

    // Period 2 dates present
    expect(dateKeys.includes("2025-06-01")).toBe(true);
    expect(dateKeys.includes("2025-06-30")).toBe(true);
  });

  it("preserves full generation across range for legacy staff without employment periods", () => {
    const legacyStaff = [
      {
        id: "s-legacy",
        shiftId: "sh1",
        shift: { startTime: "09:00" },
        employmentPeriods: [],
      },
    ];

    const inputs = createInputs(legacyStaff, "2026-06-01", "2026-06-05");
    const records = computeRangeRecords(inputs, new Date("2026-07-01T00:00:00Z"));

    const dateKeys = records.map((r) => format(r.date, "yyyy-MM-dd"));
    expect(dateKeys).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
    ]);
  });
});
