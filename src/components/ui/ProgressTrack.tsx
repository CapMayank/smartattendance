export function ProgressTrack({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-[7px] overflow-hidden rounded-full bg-card-hi"
    >
      <div className="h-full rounded-full bg-linear-to-r from-acc-2 to-acc-1" style={{ width: `${pct}%` }} />
    </div>
  );
}
