"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { IconButton } from "@/components/ui";
import type { ShellData } from "@/lib/shell-data";
import { Sidebar } from "./Sidebar";

export function MobileNav({ shell }: { shell: ShellData }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const pathname = usePathname();

  // Close on route change.
  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname]);

  // Close if the viewport grows past the drawer breakpoint.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 981px)");
    const onChange = () => {
      if (mq.matches) dialogRef.current?.close();
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <span ref={wrapRef} className="contents">
      <IconButton
        icon={Menu}
        label="Open menu"
        aria-haspopup="dialog"
        className="min-[981px]:hidden"
        onClick={() => dialogRef.current?.showModal()}
      />
      <dialog
        ref={dialogRef}
        aria-label="Navigation menu"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        onClose={() => wrapRef.current?.querySelector<HTMLButtonElement>("button[aria-haspopup]")?.focus()}
        className="m-0 h-dvh max-h-none w-[280px] max-w-[85vw] border-r border-line bg-ground p-4 text-text backdrop:bg-ground/80 min-[981px]:hidden"
      >
        <Sidebar shell={shell} />
      </dialog>
    </span>
  );
}
