"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/initials";
import { toneClass, type Tone } from "./tone";

export function Avatar({ name, status, size = 38, src }: { name: string; status?: Tone; size?: 28 | 38; src?: string }) {
  // Remember which src failed so a new src (e.g. after a cache-busted refresh) is tried again.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImg = Boolean(src) && failedSrc !== src;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid flex-none place-items-center bg-card-hi font-semibold text-text",
        size === 38 ? "size-[38px] rounded-xl text-[12.5px]" : "size-7 rounded-lg text-[11px]",
        status && toneClass[status],
      )}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailedSrc(src ?? null)}
          className="absolute inset-0 size-full rounded-[inherit] object-cover"
        />
      ) : (
        initials(name)
      )}
      {status ? (
        <span className="absolute -right-[3px] -bottom-[3px] size-[11px] rounded-full border-[2.5px] border-canvas bg-(--h)" />
      ) : null}
    </span>
  );
}
