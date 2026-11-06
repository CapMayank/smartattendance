import {
  Home, Users, Calendar, Clock, PlusCircle, BarChart3, UserCheck, Wallet,
  IndianRupee, PieChart, Building2, IdCard, Server, UserCog, Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };
export type NavGroup = { group: "Overview" | "Attendance" | "Payroll" | "System"; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    group: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: Home },
      { label: "Staff", href: "/staff", icon: Users },
    ],
  },
  {
    group: "Attendance",
    items: [
      { label: "Calendar", href: "/calendar", icon: Calendar },
      { label: "Shifts", href: "/shifts", icon: Clock },
      { label: "Manual punch", href: "/attendance/manual", icon: PlusCircle },
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
      { label: "Users", href: "/users", icon: UserCog },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

/** Returns the href of the longest matching nav item for a pathname, or null. */
export function activeHref(pathname: string): string | null {
  let best: string | null = null;
  for (const g of NAV) {
    for (const { href } of g.items) {
      const match = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
      if (match && (best === null || href.length > best.length)) best = href;
    }
  }
  return best;
}
