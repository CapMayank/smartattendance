import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import {
  isEmployedOnDate as isEmployedOnDateTS,
  type StaffEmploymentProfile,
} from "../src/lib/employment";

const require = createRequire(import.meta.url);
const { isEmployedOnDate, isEmployed } = require("./employment.js");

describe("ws-lib/employment.js", () => {
  it("exports isEmployedOnDate function and isEmployed alias", () => {
    expect(typeof isEmployedOnDate).toBe("function");
    expect(typeof isEmployed).toBe("function");
    expect(isEmployed).toBe(isEmployedOnDate);
  });

  const testCases: Array<{
    description: string;
    staff: StaffEmploymentProfile | null | undefined;
    dateKey: string;
  }> = [
    {
      description: "legacy staff with undefined periods",
      staff: { id: "leg-1" },
      dateKey: "2024-05-15",
    },
    {
      description: "legacy staff with empty periods",
      staff: { id: "leg-2", periods: [] },
      dateKey: "2024-05-15",
    },
    {
      description: "active staff before start date",
      staff: {
        id: "act-1",
        periods: [{ startDate: "2024-06-01", endDate: null }],
      },
      dateKey: "2024-05-31",
    },
    {
      description: "active staff on start date",
      staff: {
        id: "act-1",
        periods: [{ startDate: "2024-06-01", endDate: null }],
      },
      dateKey: "2024-06-01",
    },
    {
      description: "active staff after start date",
      staff: {
        id: "act-1",
        periods: [{ startDate: "2024-06-01", endDate: null }],
      },
      dateKey: "2024-07-01",
    },
    {
      description: "exited staff on end date",
      staff: {
        id: "exit-1",
        periods: [{ startDate: "2024-01-01", endDate: "2024-05-31" }],
      },
      dateKey: "2024-05-31",
    },
    {
      description: "exited staff after end date",
      staff: {
        id: "exit-1",
        periods: [{ startDate: "2024-01-01", endDate: "2024-05-31" }],
      },
      dateKey: "2024-06-01",
    },
    {
      description: "rejoined staff during period 1",
      staff: {
        id: "rej-1",
        periods: [
          { startDate: "2022-01-01", endDate: "2022-12-31" },
          { startDate: "2024-01-01", endDate: null },
        ],
      },
      dateKey: "2022-06-01",
    },
    {
      description: "rejoined staff in between periods (gap)",
      staff: {
        id: "rej-1",
        periods: [
          { startDate: "2022-01-01", endDate: "2022-12-31" },
          { startDate: "2024-01-01", endDate: null },
        ],
      },
      dateKey: "2023-06-01",
    },
    {
      description: "rejoined staff in period 2",
      staff: {
        id: "rej-1",
        periods: [
          { startDate: "2022-01-01", endDate: "2022-12-31" },
          { startDate: "2024-01-01", endDate: null },
        ],
      },
      dateKey: "2024-06-01",
    },
    {
      description: "null staff",
      staff: null,
      dateKey: "2024-06-01",
    },
    {
      description: "undefined staff",
      staff: undefined,
      dateKey: "2024-06-01",
    },
    {
      description: "empty dateKey",
      staff: { id: "leg-1" },
      dateKey: "",
    },
  ];

  for (const tc of testCases) {
    it(`matches TypeScript implementation for: ${tc.description}`, () => {
      const tsResult = isEmployedOnDateTS(
        tc.staff as StaffEmploymentProfile,
        tc.dateKey
      );
      const jsResult = isEmployedOnDate(tc.staff, tc.dateKey);
      expect(jsResult).toBe(tsResult);
    });
  }
});
