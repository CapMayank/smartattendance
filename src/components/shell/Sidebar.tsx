"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { ChevronDown, HelpCircle, KeyRound, LogOut, Moon, Plus, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/initials";
import { formatTime } from "@/lib/format";
import type { ShellData } from "@/lib/shell-data";
import { IntimeLockup, SchoolBadge } from "@/components/brand/Brand";
import { getNavForRole, activeHref } from "./nav";
import { useTheme } from "@/components/ThemeProvider";

export function Sidebar({
  shell,
  className,
  pendingPunchRequestsCount,
}: {
  shell: ShellData;
  className?: string;
  pendingPunchRequestsCount?: number;
}) {
  const pathname = usePathname();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navGroups = getNavForRole(shell.roleCode);
  const active = activeHref(pathname, navGroups);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const offline = shell.devices.filter((d) => !d.online).length;
  const online = shell.devices.length - offline;
  const isEmployee = shell.roleCode === "EMPLOYEE";
  const isAdmin = shell.roleCode === "ADMIN";
  const pendingRequests =
    pendingPunchRequestsCount ??
    (shell as { pendingPunchRequestsCount?: number }).pendingPunchRequestsCount;

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-[18px]", className)}>
      <div className="flex flex-col gap-2.5">
        <Link href="/" className="rounded-[10px] px-1.5 py-1" aria-label="Intime home">
          <IntimeLockup />
        </Link>
        <div className="rounded-xl border border-line-soft bg-canvas px-2.5 py-2">
          <SchoolBadge />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-canvas">
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((o) => !o)}
          className="flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left"
        >
          <span
            aria-hidden="true"
            className="grid size-8 flex-none place-items-center rounded-full bg-card-hi text-[11.5px] font-semibold"
          >
            {initials(shell.userName)}
          </span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[13.5px] font-medium">{shell.userName}</b>
            <span className="block truncate text-xs text-subtle">
              {shell.employeeCode ? (
                <>
                  {shell.userRole} · <span className="num text-acc-1">{shell.employeeCode}</span>
                </>
              ) : (
                shell.userRole
              )}
            </span>
          </span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={cn("flex-none text-subtle transition-transform duration-150", menuOpen && "rotate-180")}
          />
        </button>
        {menuOpen ? (
          <div id={menuId} className="space-y-0.5 border-t border-line-soft p-1.5">
            <Link
              href="/change-password"
              onClick={() => setMenuOpen(false)}
              className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] text-muted transition-colors duration-150 hover:bg-card hover:text-text"
            >
              <KeyRound size={15} aria-hidden="true" />
              Change password
            </Link>
            <button
              type="button"
              onClick={() => toggleTheme()}
              className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] text-muted transition-colors duration-150 hover:bg-card hover:text-text"
            >
              {resolvedTheme === "dark" ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
              {resolvedTheme === "dark" ? "Light theme" : "Dark theme"}
            </button>
            <button
              type="button"
              onClick={async () => {
                await signOut({ redirect: false });
                window.location.href = "/login";
              }}
              className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] text-muted transition-colors duration-150 hover:bg-card hover:text-absent"
            >
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </button>
          </div>
        ) : null}
      </div>

      {isAdmin && (
        <Link
          href="/attendance/manual"
          className="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] bg-text text-[13.5px] font-medium text-ground transition-colors duration-150 hover:bg-white"
        >
          <Plus size={16} aria-hidden="true" />
          Manual punch
        </Link>
      )}

      <nav aria-label="Main navigation" className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
        {navGroups.map((g) => (
          <div key={g.group} className="flex flex-col gap-0.5">
            <div className="px-3 pt-3.5 pb-1.5 text-[11px] tracking-[0.08em] text-subtle uppercase first:pt-0.5">
              {g.group}
            </div>
            {g.items.map(({ label, href, icon: Icon, badge }) => {
              const isActive = href === active;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex h-[38px] items-center gap-3 rounded-[9px] px-3 transition-colors duration-150",
                    isActive
                      ? "bg-card-hi text-text shadow-[inset_0_1px_0_color-mix(in_srgb,var(--color-text)_5%,transparent)]"
                      : "text-muted hover:bg-card hover:text-text",
                  )}
                >
                  <Icon size={18} aria-hidden="true" className={cn("flex-none", isActive && "text-acc-2")} />
                  {label}
                  {href === "/staff" ? (
                    <span className="num ml-auto text-[11.5px] text-subtle">{shell.staffCount}</span>
                  ) : null}
                  {href === "/devices" && offline > 0 ? (
                    <span className="num ml-auto rounded-full bg-absent/15 px-[7px] text-[11px] text-absent">
                      <span className="sr-only">Offline devices: </span>
                      {offline}
                    </span>
                  ) : null}
                  {href === "/punches/requests" && typeof pendingRequests === "number" && pendingRequests > 0 ? (
                    <span className="num ml-auto rounded-full bg-acc-1/15 px-[7px] text-[11px] font-semibold text-acc-1">
                      <span className="sr-only">Pending requests: </span>
                      {pendingRequests}
                    </span>
                  ) : badge !== undefined && badge !== null && badge !== "" ? (
                    <span className="num ml-auto rounded-full bg-card-hi px-[7px] text-[11px] font-semibold text-subtle">
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {!isEmployee && (
        <div className="mt-auto flex flex-col gap-2.5">
          <div className="rounded-xl border border-line bg-canvas p-3">
            <div className="mb-1 flex justify-between text-[13px] font-medium">
              <span>Punch devices</span>
              {shell.devices.length > 0 ? (
                <span className="num text-muted">
                  {online} / {shell.devices.length}
                </span>
              ) : null}
            </div>
            {shell.devices.length === 0 ? (
              <p className="py-1 text-[12.5px] text-muted">No devices yet</p>
            ) : (
              shell.devices.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2 py-[3px] text-[12.5px] text-muted">
                  <span className="flex min-w-0 items-center">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "status-dot mr-2 size-[7px] flex-none rounded-full",
                        d.online ? "tone-present" : "tone-absent",
                      )}
                    />
                    <span className="truncate">{d.name}</span>
                    <span className="sr-only">{d.online ? " online" : " offline"}</span>
                  </span>
                  <span className="num flex-none">{d.online ? formatTime(new Date(d.lastPing)) : "Offline"}</span>
                </div>
              ))
            )}
          </div>
          {isAdmin && (
            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-[9px] px-3 py-2 text-muted transition-colors duration-150 hover:text-text"
            >
              <HelpCircle size={18} aria-hidden="true" />
              Help &amp; guide
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
