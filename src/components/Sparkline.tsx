/** Inline SVG line for a series of numbers. */
export function Sparkline({
  values,
  width = 160,
  height = 40,
  min,
  max,
  baseline,
  className = "",
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  min?: number;
  max?: number;
  /** Draw a faint reference line at this value (e.g. 50% odds, 0 goal differential). */
  baseline?: number;
  className?: string;
  label?: string;
}) {
  if (values.length < 2) return null;
  const lo = min ?? Math.min(...values, baseline ?? Infinity);
  const hi = max ?? Math.max(...values, baseline ?? -Infinity);
  const span = hi - lo || 1;
  const pad = 4;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - lo) / span) * (height - pad * 2);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values[values.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label ?? `Trend, now ${last}`} className={className}>
      {baseline != null && <line x1={pad} x2={width - pad} y1={y(baseline)} y2={y(baseline)} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="2 3" />}
      <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(last)} r={3} fill="currentColor" />
    </svg>
  );
}

/** Win/loss strip: one square per game. */
export function FormStrip({ results }: { results: ("W" | "L" | "OTL" | "SOL")[] }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={results.join(" ")}>
      {results.map((r, i) => (
        <span key={i} className={`inline-block h-3 w-3 rounded-sm ${r === "W" ? "bg-win" : r === "L" ? "bg-loss" : "bg-otl"}`} title={r} />
      ))}
    </span>
  );
}
