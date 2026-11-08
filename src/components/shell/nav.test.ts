import { describe, expect, it } from "vitest";
import { getNavForRole, activeHref, EMPLOYEE_NAV, NAV } from "./nav";

describe("Navigation Configuration & Role Integration", () => {
  describe("getNavForRole('EMPLOYEE')", () => {
    it("returns exactly the 5 employee routes under 'My Portal'", () => {
      const employeeNav = getNavForRole("EMPLOYEE");
      expect(employeeNav).toHaveLength(1);
      expect(employeeNav[0].group).toBe("My Portal");

      const items = employeeNav[0].items;
      expect(items).toHaveLength(5);
      expect(items.map((i) => ({ label: i.label, href: i.href }))).toEqual([
        { label: "My Overview", href: "/" },
        { label: "To School", href: "/to-school" },
        { label: "My Punches & Requests", href: "/punch-requests" },
        { label: "My Payslips", href: "/payslips" },
        { label: "Change password", href: "/change-password" },
      ]);
    });
  });

  describe("getNavForRole('ADMIN')", () => {
    it("includes '/punches/requests' under Attendance group", () => {
      const adminNav = getNavForRole("ADMIN");
      const attendance = adminNav.find((g) => g.group === "Attendance");
      expect(attendance).toBeDefined();

      const punchRequestItem = attendance?.items.find((i) => i.href === "/punches/requests");
      expect(punchRequestItem).toBeDefined();
      expect(punchRequestItem?.label).toBe("Punch requests");
    });
  });

  describe("getNavForRole('APPROVER')", () => {
    it("includes '/punches/requests' under Attendance group and excludes restricted hrefs", () => {
      const approverNav = getNavForRole("APPROVER");
      const attendance = approverNav.find((g) => g.group === "Attendance");
      expect(attendance).toBeDefined();

      const punchRequestItem = attendance?.items.find((i) => i.href === "/punches/requests");
      expect(punchRequestItem).toBeDefined();
      expect(punchRequestItem?.label).toBe("Punch requests");

      const hrefs = attendance?.items.map((i) => i.href) ?? [];
      expect(hrefs).not.toContain("/attendance/manual");
      expect(hrefs).not.toContain("/punches/unmatched");
      expect(hrefs).toContain("/punches/requests");
    });
  });

  describe("activeHref routing resolution", () => {
    it("resolves active route for employee portal items", () => {
      const employeeNav = getNavForRole("EMPLOYEE");
      expect(activeHref("/", employeeNav)).toBe("/");
      expect(activeHref("/to-school", employeeNav)).toBe("/to-school");
      expect(activeHref("/to-school/2026-11", employeeNav)).toBe("/to-school");
      expect(activeHref("/punch-requests", employeeNav)).toBe("/punch-requests");
      expect(activeHref("/punch-requests/new", employeeNav)).toBe("/punch-requests");
      expect(activeHref("/payslips", employeeNav)).toBe("/payslips");
      expect(activeHref("/change-password", employeeNav)).toBe("/change-password");
    });

    it("resolves active route for /punches/requests in admin and approver navigation", () => {
      const adminNav = getNavForRole("ADMIN");
      const approverNav = getNavForRole("APPROVER");

      expect(activeHref("/punches/requests", adminNav)).toBe("/punches/requests");
      expect(activeHref("/punches/requests/req-123", adminNav)).toBe("/punches/requests");

      expect(activeHref("/punches/requests", approverNav)).toBe("/punches/requests");
      expect(activeHref("/punches/requests/req-123", approverNav)).toBe("/punches/requests");

      // Default fallback groups is NAV
      expect(activeHref("/punches/requests")).toBe("/punches/requests");
    });
  });
});
