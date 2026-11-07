"use client";

import type { SyntheticEvent } from "react";
import { formatDateLong, formatTime } from "@/lib/format";
import { Modal } from "./Modal";

// Events inside the dialog still bubble through the React tree to the trigger's ancestors
// (for example a table row that toggles on click), so they stop here.
const stop = (e: SyntheticEvent) => e.stopPropagation();

/**
 * One large photo in a dialog. Render it only while open: it opens on mount and calls
 * `onClose` once closed (Escape, outside click or the close button); focus returns to the trigger.
 */
export function PhotoLightbox({
  src,
  name,
  takenAt,
  onClose,
}: {
  src: string;
  name: string;
  /** Punch time, for punch photos. */
  takenAt?: string | Date;
  onClose: () => void;
}) {
  const when = takenAt ? new Date(takenAt) : null;
  const whenText = when && !Number.isNaN(when.getTime()) ? `${formatTime(when)} IST, ${formatDateLong(when)}` : null;
  return (
    <span className="contents" onClick={stop} onKeyDown={stop} onPointerDown={stop} onPointerUp={stop}>
      <Modal open onClose={onClose} title={whenText ? "Punch photo" : "Photo"}>
        <figure className="flex flex-col items-center gap-3">
          {/* Natural size (400 px for new photos), never stretched to the dialog width; tiny legacy
              160 px photos get a modest minimum so they stay recognisable without much blur. */}
          <div className="flex w-full justify-center rounded-xl bg-ground p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={whenText ? `Punch photo of ${name} at ${whenText}` : `Photo of ${name}`}
              className="block h-auto max-h-[60vh] w-auto max-w-full min-w-[min(240px,100%)] rounded-lg object-contain"
            />
          </div>
          <figcaption className="text-center text-[13px] text-muted">
            <b className="block font-medium text-text">{name}</b>
            {whenText ? <span className="num">Punched at {whenText}</span> : null}
          </figcaption>
        </figure>
      </Modal>
    </span>
  );
}
