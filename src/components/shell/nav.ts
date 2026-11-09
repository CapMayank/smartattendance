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
  group: "Overview" | "Staff" | "Attendance" | "Payroll" | "Reports" | "System" | "My Portal";
  items: NavItem[];
};

const APPROVER_HIDDEN_HREFS = new Set([
  "/staff",
  "/attendance/manual",
  "/punches/unmatched",
  "/reports/staff",
]);

export const NAV: NavGroup[] = [
  {
    group: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: Home },
    ],
  },
  {
    group: "Staff",
    items: [
      { label: "Staff Directory", href: "/staff", icon: Users },
      { label: "Departments", href: "/departments", icon: Building2 },
      { label: "Designations", href: "/designations", icon: IdCard },
    ],
  },
  {
    group: "Attendance",
    items: [
      { label: "Calendar", href: "/calendar", icon: Calendar },
      { label: "Shifts", href: "/shifts", icon: Clock },
      { label: "Requests & Approvals", href: "/requests", icon: CheckCircle2 },
      { label: "Manual punch", href: "/attendance/manual", icon: PlusCircle },
      { label: "Unmatched punches", href: "/punches/unmatched", icon: AlertCircle },
    ],
  },
  {
    group: "Payroll",
    items: [
      { label: "Monthly payroll", href: "/payroll/monthly", icon: Wallet },
      { label: "Salary setup", href: "/payroll/staff", icon: IndianRupee },
    ],
  },
  {
    group: "Reports",
    items: [
      { label: "Staff & Headcount", href: "/reports/staff", icon: Users },
      { label: "Attendance reports", href: "/reports", icon: BarChart3 },
      { label: "Member attendance", href: "/reports/member-attendance", icon: UserCheck },
      { label: "Member payroll", href: "/reports/member-payroll", icon: Wallet },
      { label: "Payroll analytics", href: "/reports/payroll-analytics", icon: PieChart },
    ],
  },
  {
    group: "System",
    items: [
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
    return NAV.filter((g) => g.group === "Overview" || g.group === "Attendance" || g.group === "Reports")
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => !APPROVER_HIDDEN_HREFS.has(item.href)),
      }))
      .filter((g) => g.items.length > 0);
  }
  return NAV;
}

/** Returns the href of the longest matching nav item for a pathname, or null. */
export function activeHref(pathname: string, groups: NavGroup[] = NAV): string | null {
  const normalized = pathname === "/punches/requests" || pathname.startsWith("/punches/requests/") ? "/requests" : pathname;
  let best: string | null = null;
  for (const g of groups) {
    for (const { href } of g.items) {
      const match = href === "/" ? normalized === "/" : normalized === href || normalized.startsWith(href + "/");
      if (match && (best === null || href.length > best.length)) best = href;
    }
  }
  return best;
}
