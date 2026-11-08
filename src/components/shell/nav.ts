import {
  Home, Users, Calendar, Clock, PlusCircle, BarChart3, UserCheck, Wallet,
  IndianRupee, PieChart, Building2, IdCard, Server, Settings,
  AlertCircle, KeyRound, ScrollText, CheckCircle2,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number | string;
};

export type NavGroup = {
  group: "Overview" | "Attendance" | "Payroll" | "System" | "My Portal";
  items: NavItem[];
};

const APPROVER_HIDDEN_HREFS = new Set(["/staff", "/attendance/manual", "/punches/unmatched"]);

export const NAV: NavGroup[] = [
  {
    group: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: Home },
      { label: "Staff & Access", href: "/staff", icon: Users },
    ],
  },
  {
    group: "Attendance",
    items: [
      { label: "Calendar", href: "/calendar", icon: Calendar },
      { label: "Shifts", href: "/shifts", icon: Clock },
      { label: "Punch requests", href: "/punches/requests", icon: CheckCircle2 },
      { label: "Manual punch", href: "/attendance/manual", icon: PlusCircle },
      { label: "Unmatched punches", href: "/punches/unmatched", icon: AlertCircle },
      { label: "Reports", href: "/reports", icon: BarChart3 },
      { label: "Member attendance", href: "/reports/member-attendance", icon: UserCheck },
    ],
  },
  {
    group: "Payroll",
    items: [
      { label: "Monthly payroll", href: "/payroll/monthly", icon: Wallet },
      { label: "Salary setup", href: "/payroll/staff", icon: IndianRupee },
      { label: "Member payroll", href: "/reports/member-payroll", icon: Wallet },
      { label: "Analytics", href: "/reports/payroll-analytics", icon: PieChart },
    ],
  },
  {
    group: "System",
    items: [
      { label: "Departments", href: "/departments", icon: Building2 },
      { label: "Designations", href: "/designations", icon: IdCard },
      { label: "Devices", href: "/devices", icon: Server },
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Audit logs", href: "/audit-logs", icon: ScrollText },
    ],
  },
];

export const EMPLOYEE_NAV: NavGroup[] = [
  {
    group: "My Portal",
    items: [
      { label: "My Overview", href: "/", icon: Home },
      { label: "To School", href: "/to-school", icon: Calendar },
      { label: "My Punches & Requests", href: "/punch-requests", icon: Clock },
      { label: "My Payslips", href: "/payslips", icon: Wallet },
      { label: "Change password", href: "/change-password", icon: KeyRound },
    ],
  },
];

export function getNavForRole(role?: string): NavGroup[] {
  if (role === "EMPLOYEE") return EMPLOYEE_NAV;
  if (role === "APPROVER") {
    return NAV.filter((g) => g.group === "Overview" || g.group === "Attendance").map((g) => ({
      ...g,
      items: g.items.filter((item) => !APPROVER_HIDDEN_HREFS.has(item.href)),
    }));
  }
  return NAV;
}

/** Returns the href of the longest matching nav item for a pathname, or null. */
export function activeHref(pathname: string, groups: NavGroup[] = NAV): string | null {
  let best: string | null = null;
  for (const g of groups) {
    for (const { href } of g.items) {
      const match = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
      if (match && (best === null || href.length > best.length)) best = href;
    }
  }
  return best;
}
