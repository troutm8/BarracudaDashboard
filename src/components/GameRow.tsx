import Link from "next/link";
import type { GameView } from "@/lib/views";
import { finalSuffix, fmtTime, periodLabel } from "@/lib/format";
import { TeamName } from "./TeamName";

export function StatusText({ g }: { g: GameView }) {
  if (g.scheduleState && g.scheduleState !== "OK") return <span className="text-xs font-semibold text-otl">{g.scheduleState === "PPD" ? "Postponed" : g.scheduleState}</span>;
  if (g.status === "final") return <span className="text-xs font-semibold text-muted">Final{finalSuffix(g.lastPeriodType)}</span>;
  if (g.status === "live") {
    const label = g.inIntermission ? `${periodLabel(g.period, g.periodType)} Int` : `${periodLabel(g.period, g.periodType)} ${g.clock ?? ""}`;
    return <span className="text-xs font-semibold text-live">{label.trim() || "Live"}</span>;
  }
  return <span className="text-xs text-muted">{fmtTime(g.startTime)}</span>;
}

/** One game as a compact block: away team on top, home on the bottom. */
export function GameRow({ g, featuredId, showDate = false }: { g: GameView; featuredId?: number; showDate?: boolean }) {
  const decided = g.status === "final";
  const homeWon = decided && (g.homeScore ?? 0) > (g.awayScore ?? 0);
  const awayWon = decided && (g.awayScore ?? 0) > (g.homeScore ?? 0);
  const isFeatured = (id: number) => featuredId != null && id === featuredId;
  const showScore = g.status !== "pre";
  return (
    <div className="border-b border-line py-2 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <TeamName team={g.away} bold={awayWon} featured={isFeatured(g.away.id)} />
            <span className={`w-8 text-right text-sm tabular ${awayWon ? "font-bold" : "text-muted"}`}>{showScore ? g.awayScore ?? 0 : ""}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <TeamName team={g.home} bold={homeWon} featured={isFeatured(g.home.id)} />
            <span className={`w-8 text-right text-sm tabular ${homeWon ? "font-bold" : "text-muted"}`}>{showScore ? g.homeScore ?? 0 : ""}</span>
          </div>
        </div>
        <div className="w-28 shrink-0 text-right sm:w-40">
          <Link href={`/games/${g.id}`} className="block hover:underline">
            <StatusText g={g} />
          </Link>
          {showDate && <div className="text-xs text-muted">{g.gameDate}</div>}
          <div className="truncate text-[11px] text-muted">
            {g.status === "live" && g.homeSog != null ? `SOG ${g.awaySog ?? 0}-${g.homeSog ?? 0}` : `at ${g.home.abbrev}`}
          </div>
        </div>
      </div>
    </div>
  );
}
