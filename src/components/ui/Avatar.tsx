import { cn } from "@/lib/cn";
import { toneClass, type Tone } from "./tone";

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?"
  );
}

export function Avatar({ name, status, size = 38 }: { name: string; status?: Tone; size?: 28 | 38 }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid flex-none place-items-center bg-card-hi font-semibold text-text",
        size === 38 ? "size-[38px] rounded-xl text-[12.5px]" : "size-7 rounded-lg text-[11px]",
        status && toneClass[status],
      )}
    >
      {initials(name)}
      {status ? (
        <span className="absolute -right-[3px] -bottom-[3px] size-[11px] rounded-full border-[2.5px] border-canvas bg-(--h)" />
      ) : null}
    </span>
  );
}
