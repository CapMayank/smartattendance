"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { isOwnDialogEvent } from "./dialog-events";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "w-[min(26rem,calc(100vw-2rem))]",
  md: "w-[min(34rem,calc(100vw-2rem))]",
  lg: "w-[min(44rem,calc(100vw-2rem))]",
  xl: "w-[min(56rem,calc(100vw-2.5rem))]",
  "2xl": "w-[min(68rem,calc(100vw-3rem))]",
  "3xl": "w-[min(78rem,calc(100vw-3rem))]",
  full: "w-[calc(100vw-2rem)] max-w-7xl",
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = "md",
  maxHeight = "max-h-[85vh]",
  headerAction,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: ModalSize;
  maxHeight?: string;
  headerAction?: ReactNode;
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

  // Prevent background body scroll when modal is active
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={(e) => {
        // A nested dialog (e.g. a photo lightbox) closing must not close this one.
        if (!isOwnDialogEvent(e)) return;
        returnTo.current?.focus();
        returnTo.current = null;
        onClose();
      }}
      onPointerDown={(e) => {
        downOnBackdrop.current = isOwnDialogEvent(e);
      }}
      onPointerUp={(e) => {
        upOnBackdrop.current = isOwnDialogEvent(e);
      }}
      onClick={(e) => {
        if (downOnBackdrop.current && upOnBackdrop.current && isOwnDialogEvent(e)) ref.current?.close();
        downOnBackdrop.current = false;
        upOnBackdrop.current = false;
      }}
      className={`ui-dialog m-auto flex flex-col overflow-hidden max-h-[calc(100dvh-2.5rem)] ${sizeClass} rounded-2xl border border-line bg-card p-0 text-text shadow-overlay transition-all`}
    >
      <div className="flex flex-none items-center justify-between gap-3 border-b border-line-soft px-6 py-4.5">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-[17px] font-semibold tracking-tight text-text">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {headerAction}
          <IconButton icon={X} label="Close" className="size-8" onClick={() => ref.current?.close()} />
        </div>
      </div>
      <div ref={bodyRef} className={`flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-5 ${maxHeight}`}>{children}</div>
      {footer ? (
        <div className="flex flex-none flex-wrap items-center justify-end gap-2.5 border-t border-line-soft px-6 py-4">{footer}</div>
      ) : null}
    </dialog>
  );
}
