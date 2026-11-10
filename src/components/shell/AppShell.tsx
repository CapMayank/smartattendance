"use client";

import { usePathname } from "next/navigation";
import type { ShellData } from "@/lib/shell-data";
import { Sidebar } from "./Sidebar";
import { TopStrip } from "./TopStrip";

export function AppShell({ shell, children }: { shell: ShellData | null; children: React.ReactNode }) {
  const pathname = usePathname();
  if (
    pathname === "/login" ||
    pathname.startsWith("/setup") ||
    pathname.startsWith("/change-password") ||
    !shell
  ) {
    return <>{children}</>;
  }

  return (
    <div className="grid min-h-screen grid-cols-[248px_minmax(0,1fr)] gap-5 p-5 max-[980px]:grid-cols-1 max-[600px]:p-4 print:block print:p-0">
      <aside className="sticky top-5 h-[calc(100vh-40px)] min-h-0 max-[980px]:hidden print:hidden">
        <Sidebar shell={shell} />
      </aside>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="print:hidden">
          <TopStrip shell={shell} />
        </div>
        <main className="min-w-0 rounded-[20px] border border-line-soft bg-canvas p-[26px] max-[600px]:rounded-2xl max-[600px]:p-4 print:rounded-none print:border-0 print:bg-transparent print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
