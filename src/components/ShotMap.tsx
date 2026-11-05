import type { GameEvent } from "@/db/schema";

/**
 * A rink, 200 by 85 feet, with stored coordinates in feet from centre ice (x -100..100, y
 * -42.5..42.5). Shots are mirrored so the featured team always attacks to the right and the
 * opponent to the left, which makes a season of shots comparable. The feed carries shots on
 * goal only: no missed or blocked attempts.
 */
export type Shot = Pick<GameEvent, "typeDescKey" | "x" | "y" | "teamId" | "quality" | "period" | "timeInPeriod" | "player1Id">;

export function ShotMap({
  shots,
  featuredId,
  names,
  width = 600,
}: {
  shots: Shot[];
  featuredId: number;
  names?: Map<number, string>;
  width?: number;
}) {
  const scale = width / 200;
  const height = 85 * scale;
  const X = (x: number) => (x + 100) * scale;
  const Y = (y: number) => (42.5 - y) * scale;
  const r = 28 * scale; // corner radius, 28 ft

  const pts = shots
    .filter((s) => s.x != null && s.y != null)
    .map((s) => {
      const mine = s.teamId === featuredId;
      // Attack right for the featured team, left for the opponent.
      const flip = mine ? s.x! < 0 : s.x! > 0;
      return { ...s, mine, px: flip ? -s.x! : s.x!, py: flip ? -s.y! : s.y! };
    });

  const label = (s: (typeof pts)[number]) =>
    `${s.typeDescKey.replace(/-/g, " ")}${s.quality ? ", quality chance" : ""}${names?.get(s.player1Id ?? -1) ? ` by ${names.get(s.player1Id!)}` : ""}, period ${s.period} ${s.timeInPeriod}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Shot map">
      {/* ice */}
      <rect x={0} y={0} width={width} height={height} rx={r} ry={r} fill="var(--card)" stroke="var(--line)" strokeWidth={2} />
      {/* centre line and blue lines */}
      <line x1={X(0)} x2={X(0)} y1={0} y2={height} stroke="#c0392b" strokeWidth={1.5 * scale} strokeOpacity={0.7} />
      <line x1={X(-25)} x2={X(-25)} y1={0} y2={height} stroke="#2b6cb0" strokeWidth={1.5 * scale} strokeOpacity={0.7} />
      <line x1={X(25)} x2={X(25)} y1={0} y2={height} stroke="#2b6cb0" strokeWidth={1.5 * scale} strokeOpacity={0.7} />
      {/* goal lines */}
      <line x1={X(-89)} x2={X(-89)} y1={6 * scale} y2={height - 6 * scale} stroke="#c0392b" strokeWidth={scale * 0.6} strokeOpacity={0.7} />
      <line x1={X(89)} x2={X(89)} y1={6 * scale} y2={height - 6 * scale} stroke="#c0392b" strokeWidth={scale * 0.6} strokeOpacity={0.7} />
      {/* creases */}
      <path d={`M${X(-89)},${Y(4)} a${6 * scale},${6 * scale} 0 0 1 0,${8 * scale}`} fill="#2b6cb0" fillOpacity={0.15} stroke="#2b6cb0" strokeOpacity={0.5} strokeWidth={scale * 0.4} />
      <path d={`M${X(89)},${Y(4)} a${6 * scale},${6 * scale} 0 0 0 0,${8 * scale}`} fill="#2b6cb0" fillOpacity={0.15} stroke="#2b6cb0" strokeOpacity={0.5} strokeWidth={scale * 0.4} />
      {/* nets */}
      <rect x={X(-92)} y={Y(3)} width={3 * scale} height={6 * scale} fill="none" stroke="var(--muted)" strokeWidth={scale * 0.5} />
      <rect x={X(89)} y={Y(3)} width={3 * scale} height={6 * scale} fill="none" stroke="var(--muted)" strokeWidth={scale * 0.5} />
      {/* faceoff circles */}
      {[
        [0, 0],
        [-69, 22],
        [-69, -22],
        [69, 22],
        [69, -22],
      ].map(([cx, cy]) => (
        <circle key={`${cx},${cy}`} cx={X(cx)} cy={Y(cy)} r={15 * scale} fill="none" stroke={cx === 0 ? "#2b6cb0" : "#c0392b"} strokeOpacity={0.5} strokeWidth={scale * 0.5} />
      ))}
      {[
        [-20, 22],
        [-20, -22],
        [20, 22],
        [20, -22],
      ].map(([cx, cy]) => (
        <circle key={`${cx},${cy}`} cx={X(cx)} cy={Y(cy)} r={scale} fill="#c0392b" fillOpacity={0.6} />
      ))}
      {/* shots */}
      {pts.map((s, i) => {
        const color = s.mine ? "var(--teal)" : "var(--muted)";
        const cx = X(s.px);
        const cy = Y(s.py);
        if (s.typeDescKey === "goal")
          return (
            <g key={i}>
              <title>{label(s)}</title>
              <circle cx={cx} cy={cy} r={4.2 * scale} fill={color} stroke="var(--card)" strokeWidth={scale * 0.8} />
            </g>
          );
        return (
          <g key={i}>
            <title>{label(s)}</title>
            <circle cx={cx} cy={cy} r={2.6 * scale} fill="none" stroke={color} strokeWidth={scale * 0.9} />
          </g>
        );
      })}
    </svg>
  );
}

export function ShotMapLegend({ featuredName, opponentName }: { featuredName: string; opponentName?: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-full bg-teal" /> {featuredName} attack right
      </span>
      {opponentName && (
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-muted" /> {opponentName} attack left
        </span>
      )}
      <span>● goal</span>
      <span>○ shot on goal</span>
    </div>
  );
}
