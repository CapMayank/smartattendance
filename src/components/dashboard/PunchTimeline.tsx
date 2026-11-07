import { istMinutes, parseHHMM } from "@/lib/dashboard-calc";
import { formatTime, formatHHmm } from "@/lib/format";
import { cn } from "@/lib/cn";

export type TimelinePunch = { at: string; type: "IN" | "OUT"; device: string | null };

const AXIS_START = 7 * 60;
const AXIS_END = 16 * 60;

export function formatDuration(mins: number) {
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

/**
 * Day timeline from 07:00 to 16:00 (widened to whole hours when the shift or a punch falls outside),
 * with the shift band (only when there is a shift), IN→OUT spans, markers and a now-line (only when `now` is given).
 */
export function PunchTimeline({
  punches,
  shift,
  now,
}: {
  punches: TimelinePunch[];
  shift: { start: string; end: string } | null;
  now: string | null;
}) {
  const marks = punches.map((p) => ({ ...p, min: istMinutes(new Date(p.at)) }));
  const nowMin = now ? istMinutes(new Date(now)) : null;
  const shiftMin = shift ? { start: parseHHMM(shift.start), end: parseHHMM(shift.end) } : null;

  const points = [...marks.map((m) => m.min), ...(shiftMin ? [shiftMin.start, shiftMin.end] : [])];
  const start = Math.min(AXIS_START, ...points.map((m) => Math.floor(m / 60) * 60));
  const end = Math.max(AXIS_END, ...points.map((m) => Math.ceil(m / 60) * 60));
  const span = end - start;
  const pos = (m: number) => `${(((Math.min(Math.max(m, start), end) - start) / span) * 100).toFixed(2)}%`;
  const width = (a: number, b: number) => `${((Math.max(0, Math.min(b, end) - Math.max(a, start)) / span) * 100).toFixed(2)}%`;

  // IN→OUT spans, paired the same way as dutyMinutes(): the first IN opens, the next OUT closes,
  // and an open IN runs to now (no span when there is no now).
  const spans: { from: number; to: number }[] = [];
  let openIn: number | null = null;
  for (const m of marks) {
    if (m.type === "IN") openIn ??= m.min;
    else if (openIn !== null) {
      spans.push({ from: openIn, to: m.min });
      openIn = null;
    }
  }
  if (openIn !== null && nowMin !== null && nowMin > openIn) spans.push({ from: openIn, to: nowMin });
  const showLabels = marks.length <= 6;

  const hours: number[] = [];
  for (let h = start; h <= end; h += 60) hours.push(h);
  const step = hours.length > 12 ? 2 : 1;

  return (
    <div className="relative mx-2 h-16 min-w-[560px] sm:mx-[54px] sm:ml-[62px]" aria-hidden="true">
      <div className="absolute inset-x-0 top-[22px] h-1.5 rounded-md bg-card-hi" />
      {shiftMin && shiftMin.end > shiftMin.start ? (
        <div
          className="absolute top-[22px] h-1.5 rounded-md border border-dashed border-acc-2/50 bg-acc-2/20"
          style={{ left: pos(shiftMin.start), width: width(shiftMin.start, shiftMin.end) }}
        />
      ) : null}
      {spans.map((s, i) => (
        <div
          key={i}
          className="absolute top-[22px] h-1.5 rounded-md bg-linear-to-r from-present to-acc-1"
          style={{ left: pos(s.from), width: width(s.from, s.to) }}
        />
      ))}
      {marks.map((m, i) => (
        <div key={i} className="absolute top-3.5 flex -translate-x-1/2 flex-col items-center" style={{ left: pos(m.min) }}>
          <i className={cn("mt-px block size-3.5 rounded-full border-[3px] border-canvas", m.type === "IN" ? "bg-present" : "bg-muted")} />
          {showLabels ? (
            <span className="num mt-2.5 whitespace-nowrap text-[11px] text-muted">
              {formatTime(new Date(m.at))} {m.type}
            </span>
          ) : null}
        </div>
      ))}
      {nowMin !== null && nowMin >= start && nowMin <= end ? (
        <div className="absolute top-2 h-[34px] border-l-[1.5px] border-text opacity-50" style={{ left: pos(nowMin) }} />
      ) : null}
      {hours.map((h, i) =>
        i % step === 0 ? (
          <span key={h} className="num absolute -bottom-0.5 -translate-x-1/2 text-[10.5px] text-subtle" style={{ left: pos(h) }}>
            {formatHHmm(`${String(Math.floor(h / 60)).padStart(2, "0")}:00`)}
          </span>
        ) : null,
      )}
    </div>
  );
}
