import { describe, expect, it } from "vitest";
import { selectSettledPayrolls } from "./payroll-analytics";

const row = (year: number, month: number, gross: number, isLocked = false) => ({ year, month, grossWage: gross, netPayment: gross, isLocked });
const NOV_15 = new Date("2026-11-15T06:00:00Z");

describe("selectSettledPayrolls", () => {
  it("drops the in-progress month and reports it as pending", () => {
    const { rows, pendingMonth } = selectSettledPayrolls([row(2026, 9, 100), row(2026, 10, 110), row(2026, 11, 20)], NOV_15);
    expect(rows.map((r) => r.month)).toEqual([9, 10]);
    expect(pendingMonth).toEqual({ year: 2026, month: 11 });
  });

  it("keeps the current month once it is locked", () => {
    const { rows, pendingMonth } = selectSettledPayrolls([row(2026, 10, 110), row(2026, 11, 120, true)], NOV_15);
    expect(rows.map((r) => r.month)).toEqual([10, 11]);
    expect(pendingMonth).toBeNull();
  });

  it("skips finished months that are all zero", () => {
    const { rows } = selectSettledPayrolls([row(2026, 9, 0), row(2026, 10, 110)], NOV_15);
    expect(rows.map((r) => r.month)).toEqual([10]);
  });

  it("uses school time at the month boundary", () => {
    // 2026-10-31 20:00 UTC is already 1 Nov in IST
    const { rows } = selectSettledPayrolls([row(2026, 10, 110)], new Date("2026-10-31T20:00:00Z"));
    expect(rows).toHaveLength(1);
  });
});
