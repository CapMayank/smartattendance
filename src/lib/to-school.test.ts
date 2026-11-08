import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureSchoolTimezone } from "@/lib/timezone";
import { createFakePrisma } from "@/test-utils/fake-prisma";

const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return holder.client;
  },
}));

import {
  getToSchoolData,
  getHoursBracket,
  getIndianFinancialYear,
} from "./to-school";

beforeAll(() => {
  ensureSchoolTimezone();
});

describe("getHoursBracket", () => {
  it("returns '—' when 0 work minutes", () => {
    expect(getHoursBracket(0)).toBe("—");
  });

  it("returns '0-3 Hrs' when under 180 minutes", () => {
    expect(getHoursBracket(60)).toBe("0-3 Hrs");
    expect(getHoursBracket(179)).toBe("0-3 Hrs");
  });

  it("returns '3-5 Hrs' when between 180 and 299 minutes", () => {
    expect(getHoursBracket(180)).toBe("3-5 Hrs");
    expect(getHoursBracket(299)).toBe("3-5 Hrs");
  });

  it("returns '5-7 Hrs' when between 300 and 419 minutes", () => {
    expect(getHoursBracket(300)).toBe("5-7 Hrs");
    expect(getHoursBracket(419)).toBe("5-7 Hrs");
  });

  it("returns '7-9 Hrs' when 420 minutes or greater", () => {
    expect(getHoursBracket(420)).toBe("7-9 Hrs");
    expect(getHoursBracket(540)).toBe("7-9 Hrs");
    expect(getHoursBracket(600)).toBe("7-9 Hrs");
  });
});

describe("getIndianFinancialYear", () => {
  it("computes FY and Quarter for Apr-Dec (Q1, Q2, Q3)", () => {
    const apr = getIndianFinancialYear(2026, 4);
    expect(apr.financialYear).toBe("FY 26-27");
    expect(apr.quarter).toBe("Q1");
    expect(apr.quarterLabel).toBe("Q1, FY 26-27");

    const sep = getIndianFinancialYear(2026, 9);
    expect(sep.financialYear).toBe("FY 26-27");
    expect(sep.quarter).toBe("Q2");
    expect(sep.quarterLabel).toBe("Q2, FY 26-27");

    const nov = getIndianFinancialYear(2026, 11);
    expect(nov.financialYear).toBe("FY 26-27");
    expect(nov.quarter).toBe("Q3");
    expect(nov.quarterLabel).toBe("Q3, FY 26-27");
  });

  it("computes FY and Quarter for Jan-Mar (Q4)", () => {
    const feb = getIndianFinancialYear(2027, 2);
    expect(feb.financialYear).toBe("FY 26-27");
    expect(feb.quarter).toBe("Q4");
    expect(feb.quarterLabel).toBe("Q4, FY 26-27");
  });
});

describe("getToSchoolData", () => {
  const STAFF = {
    id: "staff-1",
    name: "Rajesh Kumar",
    employeeCode: "TCH001",
    machineId: "201",
    shiftId: null,
    shift: null,
    departmentId: "dept-1",
    department: { id: "dept-1", name: "High School" },
    designationId: "desig-1",
    designation: { id: "desig-1", name: "Senior Teacher" },
    employmentPeriods: [{ startDate: "2024-01-01", endDate: null }],
  };

  const NOW = new Date("2026-09-15T12:00:00+05:30"); // 15 Sep 2026

  beforeEach(() => {
    const f = createFakePrisma({
      staff: [STAFF],
      policy: null,
      holidays: [
        {
          date: new Date("2026-09-05T00:00:00+05:30"),
          name: "Teacher's Day",
        },
      ],
      lockedPayrolls: [],
      logs: [],
      dailyRecords: [
        {
          id: "dr-1",
          staffId: "staff-1",
          date: new Date("2026-09-01T00:00:00+05:30"), // Tuesday
          status: "PRESENT",
          checkIn: new Date("2026-09-01T08:55:00+05:30"),
          checkOut: new Date("2026-09-01T16:45:00+05:30"),
          lateMinutes: 0,
          workMinutes: 470,
        },
        {
          id: "dr-2",
          staffId: "staff-1",
          date: new Date("2026-09-02T00:00:00+05:30"), // Wednesday
          status: "HALF_DAY",
          checkIn: new Date("2026-09-02T09:00:00+05:30"),
          checkOut: new Date("2026-09-02T13:30:00+05:30"),
          lateMinutes: 0,
          workMinutes: 270,
        },
        {
          id: "dr-3",
          staffId: "staff-1",
          date: new Date("2026-09-03T00:00:00+05:30"), // Thursday: Absent / 0 workMinutes
          status: "ABSENT",
          checkIn: null,
          checkOut: null,
          lateMinutes: 0,
          workMinutes: 0,
        },
        {
          id: "dr-4",
          staffId: "staff-1",
          date: new Date("2026-09-04T00:00:00+05:30"), // Friday: Missed swipe (checkIn but 0 workMinutes)
          status: "PRESENT",
          checkIn: new Date("2026-09-04T09:05:00+05:30"),
          checkOut: null,
          lateMinutes: 5,
          workMinutes: 0,
        },
      ],
      punchRequests: [
        {
          id: "pr-1",
          staffId: "staff-1",
          date: "2026-09-03",
          punchType: "BOTH",
          requestedInTime: "08:50",
          requestedOutTime: "16:30",
          reason: "FORGOT_SWIPE",
          status: "PENDING",
        },
      ],
    });
    holder.client = f.client;
  });

  it("returns complete monthly calendar structure for September 2026", async () => {
    const data = await getToSchoolData("staff-1", 2026, 9, NOW);
    expect(data).not.toBeNull();
    expect(data!.year).toBe(2026);
    expect(data!.month).toBe(9);
    expect(data!.days).toHaveLength(30);

    // Day 1 (Tuesday, Sep 1): PRESENT
    const day1 = data!.days[0];
    expect(day1.dateKey).toBe("2026-09-01");
    expect(day1.dayNumber).toBe(1);
    expect(day1.dayOfWeek).toBe(2); // Tuesday
    expect(day1.isSunday).toBe(false);
    expect(day1.isHoliday).toBe(false);
    expect(day1.isEmployed).toBe(true);
    expect(day1.status).toBe("PRESENT");
    expect(day1.checkIn).toBe("08:55");
    expect(day1.checkOut).toBe("16:45");
    expect(day1.workMinutes).toBe(470);
    expect(day1.hoursBracket).toBe("7-9 Hrs");
    expect(day1.isNoShow).toBe(false);
    expect(day1.hasPendingRequest).toBe(false);

    // Day 2 (Wednesday, Sep 2): HALF_DAY
    const day2 = data!.days[1];
    expect(day2.status).toBe("HALF_DAY");
    expect(day2.hoursBracket).toBe("3-5 Hrs");
    expect(day2.isNoShow).toBe(false);

    // Day 3 (Thursday, Sep 3): ABSENT with PENDING punch request -> isNoShow: true, hasPendingRequest: true
    const day3 = data!.days[2];
    expect(day3.status).toBe("ABSENT");
    expect(day3.isNoShow).toBe(true);
    expect(day3.hasPendingRequest).toBe(true);
    expect(day3.punchRequestId).toBe("pr-1");

    // Day 4 (Friday, Sep 4): Missed swipe (workMinutes: 0) -> isNoShow: true
    const day4 = data!.days[3];
    expect(day4.workMinutes).toBe(0);
    expect(day4.isNoShow).toBe(true);

    // Day 5 (Saturday, Sep 5): Holiday (Teacher's Day)
    const day5 = data!.days[4];
    expect(day5.isHoliday).toBe(true);
    expect(day5.holidayName).toBe("Teacher's Day");
    expect(day5.status).toBe("HOLIDAY");
    expect(day5.isNoShow).toBe(false);

    // Day 6 (Sunday, Sep 6): Sunday
    const day6 = data!.days[5];
    expect(day6.isSunday).toBe(true);
    expect(day6.status).toBe("SUNDAY");
    expect(day6.isNoShow).toBe(false);

    // Day 20 (Sunday, Sep 20): Future Sunday
    const day20 = data!.days[19];
    expect(day20.isSunday).toBe(true);
    expect(day20.isNoShow).toBe(false);

    // Day 25 (Friday, Sep 25): Future working day (> NOW)
    const day25 = data!.days[24];
    expect(day25.isNoShow).toBe(false); // Future day must NEVER be marked as no-show
  });

  it("calculates compliance index and quarterly attendance score based on elapsed working days", async () => {
    const data = await getToSchoolData("staff-1", 2026, 9, NOW);
    expect(data).not.toBeNull();
    const compliance = data!.compliance;

    expect(compliance.financialYear).toBe("FY 26-27");
    expect(compliance.quarter).toBe("Q2");
    expect(compliance.quarterLabel).toBe("Q2, FY 26-27");
    expect(compliance.quarterMonths).toContain("Jul");
    expect(typeof compliance.attendanceScore).toBe("number");
    expect(compliance.attendanceScore).toBeGreaterThanOrEqual(0);
    expect(compliance.attendanceScore).toBeLessThanOrEqual(100);

    // Monthly achievements: 3 items (Jul, Aug, Sep)
    expect(compliance.monthlyAchievements).toHaveLength(3);
    const months = compliance.monthlyAchievements.map((m) => m.month);
    expect(months).toEqual([7, 8, 9]);

    // Summary statistics
    expect(data!.summary).toBeDefined();
    expect(data!.summary.presentDays).toBeGreaterThanOrEqual(1);
    expect(data!.summary.halfDays).toBeGreaterThanOrEqual(1);
  });

  it("handles employee joining midway through the month", async () => {
    const STAFF_JOINED_LATE = {
      ...STAFF,
      id: "staff-late",
      employmentPeriods: [{ startDate: "2026-09-10", endDate: null }],
    };

    const f = createFakePrisma({
      staff: [STAFF_JOINED_LATE],
      policy: null,
      holidays: [],
      lockedPayrolls: [],
      logs: [],
      dailyRecords: [],
    });
    holder.client = f.client;

    const data = await getToSchoolData("staff-late", 2026, 9, NOW);
    expect(data).not.toBeNull();
    // Days 1..9 should be NOT_EMPLOYED
    const day1 = data!.days[0];
    expect(day1.isEmployed).toBe(false);
    expect(day1.status).toBe("NOT_EMPLOYED");
    expect(day1.isNoShow).toBe(false);

    // Day 10 should be employed
    const day10 = data!.days[9];
    expect(day10.isEmployed).toBe(true);
  });
});
