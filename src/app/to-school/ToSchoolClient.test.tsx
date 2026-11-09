import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ToSchoolClient } from "./ToSchoolClient";
import type { ToSchoolData } from "@/lib/to-school";

describe("ToSchoolClient Calendar Upgrades", () => {
  const sampleData: ToSchoolData = {
    staff: {
      id: "staff-1",
      name: "Ramesh Sharma",
      employeeCode: "SEHSS-042",
      machineId: "1042",
      departmentName: "Mathematics",
      designationName: "Senior Teacher",
    },
    year: 2026,
    month: 11,
    monthLabel: "November 2026",
    compliance: {
      financialYear: "FY 26-27",
      quarter: "Q3",
      quarterLabel: "Q3, FY 26-27",
      quarterMonths: "Oct - Dec",
      attendanceScore: 88,
      elapsedWorkingDays: 6,
      presentDays: 4,
      halfDays: 1,
      lateArrivalsCount: 0,
      avgDailyMinutes: 410,
      totalWorkMinutes: 2460,
      monthlyAchievements: [],
    },
    summary: {
      elapsedWorkingDays: 6,
      presentDays: 4,
      halfDays: 1,
      lateArrivalsCount: 0,
      avgDailyMinutes: 410,
      totalWorkMinutes: 2460,
    },
    days: [
      {
        dateKey: "2026-11-01",
        dayNumber: 1,
        dayOfWeek: 0,
        isSunday: true,
        isHoliday: false,
        holidayName: null,
        isEmployed: true,
        isToday: false,
        status: "SUNDAY",
        checkIn: null,
        checkOut: null,
        workMinutes: 0,
        hoursBracket: "—",
        isNoShow: false,
        hasPendingRequest: false,
        punchRequestId: null,
        lateMinutes: 0,
      },
      {
        dateKey: "2026-11-02",
        dayNumber: 2,
        dayOfWeek: 1,
        isSunday: false,
        isHoliday: false,
        holidayName: null,
        isEmployed: true,
        isToday: false,
        status: "PRESENT",
        checkIn: "09:05",
        checkOut: "16:35",
        workMinutes: 450,
        hoursBracket: "7-9 Hrs",
        isNoShow: false,
        hasPendingRequest: false,
        punchRequestId: null,
        lateMinutes: 0,
      },
      {
        dateKey: "2026-11-03",
        dayNumber: 3,
        dayOfWeek: 2,
        isSunday: false,
        isHoliday: false,
        holidayName: null,
        isEmployed: true,
        isToday: false,
        status: "HALF_DAY",
        checkIn: "09:12",
        checkOut: null, // MISSING CHECK-OUT
        workMinutes: 240,
        hoursBracket: "3-5 Hrs",
        isNoShow: false,
        hasPendingRequest: false,
        punchRequestId: null,
        lateMinutes: 0,
      },
      {
        dateKey: "2026-11-04",
        dayNumber: 4,
        dayOfWeek: 3,
        isSunday: false,
        isHoliday: false,
        holidayName: null,
        isEmployed: true,
        isToday: false,
        status: "HALF_DAY",
        checkIn: null, // MISSING CHECK-IN
        checkOut: "16:40",
        workMinutes: 240,
        hoursBracket: "3-5 Hrs",
        isNoShow: false,
        hasPendingRequest: false,
        punchRequestId: null,
        lateMinutes: 0,
      },
      {
        dateKey: "2026-11-05",
        dayNumber: 5,
        dayOfWeek: 4,
        isSunday: false,
        isHoliday: false,
        holidayName: null,
        isEmployed: true,
        isToday: false,
        status: "ABSENT",
        checkIn: null,
        checkOut: null,
        workMinutes: 0,
        hoursBracket: "—",
        isNoShow: true, // NO SHOW
        hasPendingRequest: false,
        punchRequestId: null,
        lateMinutes: 0,
      },
    ],
  };

  it("renders discrepancy alert banner when days have missing punches or no-shows", () => {
    const html = renderToStaticMarkup(<ToSchoolClient initialData={sampleData} />);
    expect(html).toContain("attendance discrepancies needing regularization");
    expect(html).toContain("href=\"/punch-requests?month=11&amp;year=2026\"");
    expect(html).toContain("Regularization Hub");
  });

  it("renders contextual Request Out Punch action for half day with missing check-out", () => {
    const html = renderToStaticMarkup(<ToSchoolClient initialData={sampleData} />);
    expect(html).toContain("In: 9:12 am");
    expect(html).toContain("Out: Missing");
    expect(html).toContain("Request Out Punch");
  });

  it("renders contextual Request In Punch action for half day with missing check-in", () => {
    const html = renderToStaticMarkup(<ToSchoolClient initialData={sampleData} />);
    expect(html).toContain("In: Missing");
    expect(html).toContain("Out: 4:40 pm");
    expect(html).toContain("Request In Punch");
  });

  it("renders Request Punch action for no-show days", () => {
    const html = renderToStaticMarkup(<ToSchoolClient initialData={sampleData} />);
    expect(html).toContain("Request Punch");
  });
});
