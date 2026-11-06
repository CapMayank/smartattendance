import { toneVar, type Tone } from "./tone";

export function Sparkline({
  values,
  tone,
  height = 46,
}: {
  values: number[];
  tone: Tone;
  height?: number;
}) {
  if (values.length < 2) return null;
  const w = 200;
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${height} L0 ${height} Z`;
  const ly = pts[pts.length - 1][1];
  const color = toneVar[tone];
  return (
    <div className="relative" style={{ height }} aria-hidden="true">
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" width="100%" height={height} className="block">
        <path d={area} fill={`color-mix(in srgb, ${color} 14%, transparent)`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card"
        style={{ left: "100%", top: ly, background: color }}
      />
    </div>
  );
}
