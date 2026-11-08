import { describe, it, expect } from "vitest";
import {
  isEmployedOnDate,
  isEmployed,
  type StaffEmploymentProfile,
} from "./employment";

describe("employment", () => {
  describe("isEmployedOnDate", () => {
    describe("Rule 1: Legacy staff (undefined or empty periods)", () => {
      it("returns true on any date when periods is undefined", () => {
        const legacyStaff: StaffEmploymentProfile = { id: "legacy-1" };
        expect(isEmployedOnDate(legacyStaff, "2020-01-01")).toBe(true);
        expect(isEmployedOnDate(legacyStaff, "2024-06-15")).toBe(true);
        expect(isEmployedOnDate(legacyStaff, "2030-12-31")).toBe(true);
      });

      it("returns true on any date when periods is an empty array", () => {
        const legacyStaff: StaffEmploymentProfile = {
          id: "legacy-2",
          periods: [],
        };
        expect(isEmployedOnDate(legacyStaff, "2020-01-01")).toBe(true);
        expect(isEmployedOnDate(legacyStaff, "2024-06-15")).toBe(true);
        expect(isEmployedOnDate(legacyStaff, "2030-12-31")).toBe(true);
      });
    });

    describe("Rule 2: Active period check", () => {
      describe("Single open-ended period", () => {
        const staff: StaffEmploymentProfile = {
          id: "staff-open",
          periods: [{ startDate: "2024-06-01", endDate: null }],
        };

        it("returns false for dates before startDate", () => {
          expect(isEmployedOnDate(staff, "2024-05-31")).toBe(false);
          expect(isEmployedOnDate(staff, "2020-01-01")).toBe(false);
        });

        it("returns true for date matching startDate", () => {
          expect(isEmployedOnDate(staff, "2024-06-01")).toBe(true);
        });

        it("returns true for any date after startDate", () => {
          expect(isEmployedOnDate(staff, "2024-06-02")).toBe(true);
          expect(isEmployedOnDate(staff, "2025-01-01")).toBe(true);
          expect(isEmployedOnDate(staff, "2030-12-31")).toBe(true);
        });
      });

      describe("Single closed period", () => {
        const staff: StaffEmploymentProfile = {
          id: "staff-closed",
          periods: [{ startDate: "2024-06-01", endDate: "2024-08-31" }],
        };

        it("returns false before startDate", () => {
          expect(isEmployedOnDate(staff, "2024-05-31")).toBe(false);
        });

        it("returns true on startDate", () => {
          expect(isEmployedOnDate(staff, "2024-06-01")).toBe(true);
        });

        it("returns true on mid-period dates", () => {
          expect(isEmployedOnDate(staff, "2024-07-15")).toBe(true);
        });

        it("returns true on endDate (inclusive)", () => {
          expect(isEmployedOnDate(staff, "2024-08-31")).toBe(true);
        });

        it("returns false after endDate", () => {
          expect(isEmployedOnDate(staff, "2024-09-01")).toBe(false);
          expect(isEmployedOnDate(staff, "2024-12-31")).toBe(false);
        });
      });

      describe("Multiple periods (rejoin scenario)", () => {
        const staff: StaffEmploymentProfile = {
          id: "staff-rejoined",
          periods: [
            { startDate: "2022-01-01", endDate: "2022-12-31" },
            { startDate: "2024-01-01", endDate: null },
          ],
        };

        it("returns false before first period", () => {
          expect(isEmployedOnDate(staff, "2021-12-31")).toBe(false);
        });

        it("returns true during first period", () => {
          expect(isEmployedOnDate(staff, "2022-01-01")).toBe(true);
          expect(isEmployedOnDate(staff, "2022-06-15")).toBe(true);
          expect(isEmployedOnDate(staff, "2022-12-31")).toBe(true);
        });

        it("returns false during gap between periods", () => {
          expect(isEmployedOnDate(staff, "2023-01-01")).toBe(false);
          expect(isEmployedOnDate(staff, "2023-06-15")).toBe(false);
          expect(isEmployedOnDate(staff, "2023-12-31")).toBe(false);
        });

        it("returns true during active second period", () => {
          expect(isEmployedOnDate(staff, "2024-01-01")).toBe(true);
          expect(isEmployedOnDate(staff, "2024-07-10")).toBe(true);
          expect(isEmployedOnDate(staff, "2026-11-08")).toBe(true);
        });
      });

      describe("Multiple closed periods (seasonal/contract)", () => {
        const staff: StaffEmploymentProfile = {
          id: "staff-contracts",
          periods: [
            { startDate: "2021-01-01", endDate: "2021-06-30" },
            { startDate: "2022-01-01", endDate: "2022-06-30" },
          ],
        };

        it("returns false in gap after period 1", () => {
          expect(isEmployedOnDate(staff, "2021-07-01")).toBe(false);
          expect(isEmployedOnDate(staff, "2021-12-31")).toBe(false);
        });

        it("returns true in period 2", () => {
          expect(isEmployedOnDate(staff, "2022-03-15")).toBe(true);
        });

        it("returns false after period 2", () => {
          expect(isEmployedOnDate(staff, "2022-07-01")).toBe(false);
          expect(isEmployedOnDate(staff, "2023-01-01")).toBe(false);
        });
      });
    });

    describe("Edge cases", () => {
      it("returns false if staff is null or undefined", () => {
        expect(isEmployedOnDate(null as unknown as StaffEmploymentProfile, "2024-01-01")).toBe(false);
        expect(isEmployedOnDate(undefined as unknown as StaffEmploymentProfile, "2024-01-01")).toBe(false);
      });

      it("returns false if dateKey is empty or missing", () => {
        const legacyStaff: StaffEmploymentProfile = { id: "s1" };
        expect(isEmployedOnDate(legacyStaff, "")).toBe(false);
        expect(isEmployedOnDate(legacyStaff, null as unknown as string)).toBe(false);
      });
    });

    describe("isEmployed alias", () => {
      it("is an alias for isEmployedOnDate", () => {
        const staff: StaffEmploymentProfile = {
          id: "s1",
          periods: [{ startDate: "2024-01-01", endDate: null }],
        };
        expect(isEmployed(staff, "2024-05-01")).toBe(isEmployedOnDate(staff, "2024-05-01"));
        expect(isEmployed(staff, "2023-05-01")).toBe(isEmployedOnDate(staff, "2023-05-01"));
      });
    });
  });
});
