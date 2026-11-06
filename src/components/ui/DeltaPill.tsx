import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

export type DeltaDirection = "up" | "down" | "flat";

export function DeltaPill({
  text,
  direction,
  good,
}: {
  text: string;
  direction: DeltaDirection;
  good: boolean;
}) {
  const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;
  const tone = direction === "flat" ? "tone-muted" : good ? "tone-present" : "tone-absent";
  return (
    <span
      className={cn(
        "num inline-flex items-center gap-[3px] rounded-full px-2 py-[3px] text-[11.5px]",
        tone,
        direction === "flat" ? "bg-card-hi text-muted" : "tint-pill",
      )}
    >
      <Icon size={11} strokeWidth={2.2} aria-hidden="true" />
      {text}
    </span>
  );
}
