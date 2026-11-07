"use client";

import { useState, type SyntheticEvent } from "react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/initials";
import { PhotoLightbox } from "./PhotoLightbox";
import { toneClass, type Tone } from "./tone";

// Rows around an avatar often toggle or navigate on click; the photo button must not trigger them.
const stop = (e: SyntheticEvent) => e.stopPropagation();

export function Avatar({ name, status, size = 38, src }: { name: string; status?: Tone; size?: 28 | 38; src?: string }) {
  // Remember which src failed so a new src (e.g. after a cache-busted refresh) is tried again.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const showImg = Boolean(src) && failedSrc !== src;
  // Clickable only once the photo has really loaded; initials stay decorative.
  const viewable = showImg && loadedSrc === src;
  return (
    <>
      <span
        aria-hidden={viewable ? undefined : "true"}
        className={cn(
          "relative grid flex-none place-items-center bg-card-hi font-semibold text-text",
          size === 38 ? "size-[38px] rounded-xl text-[12.5px]" : "size-7 rounded-lg text-[11px]",
          status && toneClass[status],
        )}
      >
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={(el) => {
              // An image that finished loading before hydration never fires onLoad.
              if (el && src && el.complete && el.naturalWidth > 0 && loadedSrc !== src) setLoadedSrc(src);
            }}
            src={src}
            alt=""
            loading="lazy"
            onLoad={() => setLoadedSrc(src ?? null)}
            onError={() => setFailedSrc(src ?? null)}
            className="absolute inset-0 size-full rounded-[inherit] object-cover"
          />
        ) : (
          initials(name)
        )}
        {viewable ? (
          <button
            type="button"
            aria-label={`View photo of ${name}`}
            title={`View photo of ${name}`}
            onClick={(e) => {
              e.stopPropagation();
              setViewing(true);
            }}
            onKeyDown={stop}
            className={cn(
              // A transparent layer over the photo, grown to a 40 px hit area.
              "absolute cursor-zoom-in rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc-2",
              size === 38 ? "-inset-px" : "-inset-1.5",
            )}
          />
        ) : null}
        {status ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-[3px] -bottom-[3px] size-[11px] rounded-full border-[2.5px] border-canvas bg-(--h)"
          />
        ) : null}
      </span>
      {viewing && src ? <PhotoLightbox src={src} name={name} onClose={() => setViewing(false)} /> : null}
    </>
  );
}
