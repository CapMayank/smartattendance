"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const downOnBackdrop = useRef(false);
  const upOnBackdrop = useRef(false);
  const returnTo = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      returnTo.current = document.activeElement as HTMLElement | null;
      dlg.showModal();
      const target =
        bodyRef.current?.querySelector<HTMLElement>("[data-autofocus]") ??
        bodyRef.current?.querySelector<HTMLElement>(
          "input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled])",
        );
      target?.focus();
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => {
        returnTo.current?.focus();
        returnTo.current = null;
        onClose();
      }}
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === ref.current;
      }}
      onPointerUp={(e) => {
        upOnBackdrop.current = e.target === ref.current;
      }}
      onClick={(e) => {
        if (downOnBackdrop.current && upOnBackdrop.current && e.target === ref.current) ref.current?.close();
        downOnBackdrop.current = false;
        upOnBackdrop.current = false;
      }}
      className="ui-dialog m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card-hi p-0 text-text shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
        <h2 id={titleId} className="text-[15px] font-medium">
          {title}
        </h2>
        <IconButton icon={X} label="Close" className="size-8" onClick={() => ref.current?.close()} />
      </div>
      <div ref={bodyRef} className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      {footer ? (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line-soft px-5 py-3">{footer}</div>
      ) : null}
    </dialog>
  );
}
