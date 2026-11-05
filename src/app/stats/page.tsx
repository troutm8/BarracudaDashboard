import Link from "next/link";
import type { Metadata } from "next";
import type { GoalieSeason, SkaterSeason } from "@/db/schema";
import { Card, Empty } from "@/components/Card";
import { TeamLogo } from "@/components/TeamLogo";
import { num, pct3, signed } from "@/lib/format";
import { getLatestGoalieSeason, getLatestSkaterSeason, getTeams } from "@/lib/queries";
import { TEAM_ABBREV, TEAM_NAME } from "@/lib/season";
import { teamView } from "@/lib/views";

export const metadata: Metadata = { title: "Stats" };

const pointsPerGame = (r: SkaterSeason) => (r.gamesPlayed ? (r.points ?? 0) / r.gamesPlayed : null);

const SKATER_SORTS = {
  points: { label: "P", get: (r: SkaterSeason) => r.points },
  goals: { label: "G", get: (r: SkaterSeason) => r.goals },
  assists: { label: "A", get: (r: SkaterSeason) => r.assists },
  plusMinus: { label: "+/-", get: (r: SkaterSeason) => r.plusMinus },
  ppGoals: { label: "PPG", get: (r: SkaterSeason) => r.ppGoals },
  shots: { label: "S", get: (r: SkaterSeason) => r.shots },
  pointsPerGame: { label: "P/GP", get: pointsPerGame },
} as const;
type SkaterSort = keyof typeof SKATER_SORTS;

const GOALIE_SORTS = {
  savePct: { label: "SV%", get: (r: GoalieSeason) => (r.savePct == null ? null : Number(r.savePct)), asc: false },
  gaa: { label: "GAA", get: (r: GoalieSeason) => (r.gaa == null ? null : Number(r.gaa)), asc: true },
  wins: { label: "W", get: (r: GoalieSeason) => r.wins, asc: false },
  shutouts: { label: "SO", get: (r: GoalieSeason) => r.shutouts, asc: false },
  saves: { label: "SV", get: (r: GoalieSeason) => r.saves, asc: false },
} as const;
type GoalieSort = keyof typeof GOALIE_SORTS;

const POS = ["all", "F", "D"] as const;

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ scope?: string; sort?: string; pos?: string; n?: string; rookies?: string }> }) {
  const sp = await searchParams;
  const scope = sp.scope === "goalies" ? "goalies" : "skaters";
  const limit = sp.n === "all" ? Infinity : 50;
  const [skaters, goalies, teams] = await Promise.all([getLatestSkaterSeason(), getLatestGoalieSeason(), getTeams()]);
  const teamByAbbrev = new Map(teams.map((t) => [t.abbrev, t]));
  const isFeatured = (abbrev: string | null) => abbrev === TEAM_ABBREV;
  const teamCell = (abbrev: string | null) => {
    const t = abbrev ? teamByAbbrev.get(abbrev) : null;
    return (
      <span className="inline-flex items-center gap-1">
        {t && <TeamLogo team={teamView(t)} size={18} />}
        <span className="text-xs text-muted">{abbrev}</span>
      </span>
    );
  };
  const href = (q: Record<string, string>) => `/stats?${new URLSearchParams({ scope, ...q }).toString()}`;

  if (scope === "goalies") {
    const sort: GoalieSort = (Object.keys(GOALIE_SORTS) as GoalieSort[]).includes(sp.sort as GoalieSort) ? (sp.sort as GoalieSort) : "savePct";
    const s = GOALIE_SORTS[sort];
    // Rate stats need a minimum workload: a quarter of the busiest goalie's games.
    const maxGp = Math.max(0, ...(goalies?.rows ?? []).map((r) => r.gamesPlayed ?? 0));
    const minGp = sort === "savePct" || sort === "gaa" ? Math.max(1, Math.floor(maxGp / 4)) : 0;
    const rows = (goalies?.rows ?? [])
      .filter((r) => (r.gamesPlayed ?? 0) >= minGp)
      .sort((a, b) => {
        const av = s.get(a);
        const bv = s.get(b);
        if (av == null) return 1;
        if (bv == null) return -1;
        return s.asc ? av - bv : bv - av;
      })
      .slice(0, limit);
    return (
      <div className="space-y-4">
        <Header scope={scope} date={goalies?.date} />
        <nav className="flex flex-wrap gap-1 text-sm">
          {(Object.keys(GOALIE_SORTS) as GoalieSort[]).map((k) => (
            <Link key={k} href={href({ sort: k })} className={`rounded-md px-3 py-1 ${k === sort ? "bg-teal text-white" : "border border-line hover:bg-soft"}`}>
              {GOALIE_SORTS[k].label}
            </Link>
          ))}
        </nav>
        <Card>
          {rows.length ? (
            <div className="scroll-x">
              <table className="data w-full text-sm">
                <thead>
                  <tr>
                    <th className="r">#</th>
                    <th>Goalie</th>
                    <th>Team</th>
                    <th className="r">GP</th>
                    <th className="r">W</th>
                    <th className="r">L</th>
                    <th className="r">OTL</th>
                    <th className="r">SA</th>
                    <th className="r">SV</th>
                    <th className="r">GA</th>
                    <th className="r">GAA</th>
                    <th className="r">SV%</th>
                    <th className="r">SO</th>
                    <th className="r">Min</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.playerId} className={isFeatured(r.teamAbbrev) ? "featured" : ""}>
                      <td className="r text-muted tabular">{i + 1}</td>
                      <td>
                        <Link href={`/players/${r.playerId}`} className="hover:underline">
                          {r.fullName}
                        </Link>
                      </td>
                      <td>{teamCell(r.teamAbbrev)}</td>
                      <td className="r tabular">{r.gamesPlayed}</td>
                      <td className="r tabular">{r.wins}</td>
                      <td className="r tabular">{r.losses}</td>
                      <td className="r tabular">{r.otLosses}</td>
                      <td className="r tabular">{r.shotsAgainst}</td>
                      <td className="r tabular">{r.saves}</td>
                      <td className="r tabular">{r.goalsAgainst}</td>
                      <td className="r tabular">{num(r.gaa, 2)}</td>
                      <td className="r font-semibold tabular">{pct3(r.savePct)}</td>
                      <td className="r tabular">{r.shutouts}</td>
                      <td className="r tabular">{r.minutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No goalie stats loaded.</Empty>
          )}
          {minGp > 0 && <p className="mt-2 text-[11px] text-muted">Rate leaders need at least {minGp} games.</p>}
          <More limit={limit} href={href({ sort, n: "all" })} />
        </Card>
      </div>
    );
  }

  const sort: SkaterSort = (Object.keys(SKATER_SORTS) as SkaterSort[]).includes(sp.sort as SkaterSort) ? (sp.sort as SkaterSort) : "points";
  const pos = POS.includes(sp.pos as (typeof POS)[number]) ? (sp.pos as (typeof POS)[number]) : "all";
  const rookies = sp.rookies === "1";
  const s = SKATER_SORTS[sort];
  const rows = (skaters?.rows ?? [])
    .filter((r) => pos === "all" || (pos === "D" ? r.position === "D" : r.position !== "D"))
    .filter((r) => !rookies || r.rookie)
    .filter((r) => sort !== "pointsPerGame" || (r.gamesPlayed ?? 0) >= 5)
    .sort((a, b) => (s.get(b) ?? -Infinity) - (s.get(a) ?? -Infinity) || (b.points ?? 0) - (a.points ?? 0))
    .slice(0, limit);

  return (
    <div className="space-y-4">
      <Header scope={scope} date={skaters?.date} />
      <nav className="flex flex-wrap items-center gap-1 text-sm">
        {(Object.keys(SKATER_SORTS) as SkaterSort[]).map((k) => (
          <Link key={k} href={href({ sort: k, pos })} className={`rounded-md px-3 py-1 ${k === sort ? "bg-teal text-white" : "border border-line hover:bg-soft"}`}>
            {SKATER_SORTS[k].label}
          </Link>
        ))}
        <span className="mx-2 text-muted">·</span>
        {POS.map((p) => (
          <Link key={p} href={href({ sort, pos: p })} className={`rounded-md px-3 py-1 ${p === pos ? "bg-soft font-semibold" : "hover:bg-soft"}`}>
            {p === "all" ? "All" : p === "F" ? "Forwards" : "Defense"}
          </Link>
        ))}
        <Link href={href({ sort, pos, ...(rookies ? {} : { rookies: "1" }) })} className={`rounded-md px-3 py-1 ${rookies ? "bg-soft font-semibold" : "hover:bg-soft"}`}>
          Rookies
        </Link>
      </nav>
      <Card>
        {rows.length ? (
          <div className="scroll-x">
            <table className="data w-full text-sm">
              <thead>
                <tr>
                  <th className="r">#</th>
                  <th>Player</th>
                  <th>Team</th>
                  <th>Pos</th>
                  <th className="r">GP</th>
                  <th className="r">G</th>
                  <th className="r">A</th>
                  <th className="r">P</th>
                  <th className="r">P/GP</th>
                  <th className="r">+/-</th>
                  <th className="r">PIM</th>
                  <th className="r">PPG</th>
                  <th className="r">PPA</th>
                  <th className="r">SHG</th>
                  <th className="r">GWG</th>
                  <th className="r">S</th>
                  <th className="r">S%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.playerId} className={isFeatured(r.teamAbbrev) ? "featured" : ""}>
                    <td className="r text-muted tabular">{i + 1}</td>
                    <td>
                      <Link href={`/players/${r.playerId}`} className="hover:underline">
                        {r.fullName}
                      </Link>
                    </td>
                    <td>{teamCell(r.teamAbbrev)}</td>
                    <td className="text-muted">{r.position}</td>
                    <td className="r tabular">{r.gamesPlayed}</td>
                    <td className={`r tabular ${sort === "goals" ? "font-semibold" : ""}`}>{r.goals}</td>
                    <td className={`r tabular ${sort === "assists" ? "font-semibold" : ""}`}>{r.assists}</td>
                    <td className={`r tabular ${sort === "points" ? "font-semibold" : ""}`}>{r.points}</td>
                    <td className="r tabular">{num(pointsPerGame(r), 2)}</td>
                    <td className="r tabular">{signed(r.plusMinus)}</td>
                    <td className="r tabular">{r.pim}</td>
                    <td className="r tabular">{r.ppGoals}</td>
                    <td className="r tabular">{r.ppAssists}</td>
                    <td className="r tabular">{r.shGoals}</td>
                    <td className="r tabular">{r.gwGoals}</td>
                    <td className="r tabular">{r.shots}</td>
                    <td className="r tabular">{num(r.shootingPct, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No skater stats loaded.</Empty>
        )}
        <More limit={limit} href={href({ sort, pos, n: "all" })} />
      </Card>
    </div>
  );
}

function Header({ scope, date }: { scope: string; date?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h1 className="text-2xl font-bold">League leaders</h1>
      <nav className="flex gap-1 text-sm">
        <Link href="/stats?scope=skaters" className={`rounded-md px-3 py-1.5 ${scope === "skaters" ? "bg-teal text-white" : "border border-line hover:bg-soft"}`}>
          Skaters
        </Link>
        <Link href="/stats?scope=goalies" className={`rounded-md px-3 py-1.5 ${scope === "goalies" ? "bg-teal text-white" : "border border-line hover:bg-soft"}`}>
          Goalies
        </Link>
      </nav>
      <p className="w-full text-xs text-muted">Regular season, through {date ?? "—"}. {TEAM_NAME} highlighted.</p>
    </div>
  );
}

function More({ limit, href }: { limit: number; href: string }) {
  if (limit === Infinity) return null;
  return (
    <p className="mt-2 text-right text-xs">
      <Link href={href} className="text-teal hover:underline">
        Show everyone →
      </Link>
    </p>
  );
}
