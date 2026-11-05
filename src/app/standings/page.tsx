import Link from "next/link";
import type { Metadata } from "next";
import type { StandingsRow, Team } from "@/db/schema";
import { Card, Empty } from "@/components/Card";
import { TeamLogo } from "@/components/TeamLogo";
import { groupStandings, playoffPicture, streaksByTeam } from "@/lib/derive";
import { fmtYmd, pct3, signed } from "@/lib/format";
import { getAllFinals, getLatestStandings, getTeamMap } from "@/lib/queries";
import { PLAYOFF_FORMAT, TEAM_ID } from "@/lib/season";
import { teamView } from "@/lib/views";

export const metadata: Metadata = { title: "Standings" };

const VIEWS = [
  ["division", "Division"],
  ["league", "League"],
] as const;
type View = (typeof VIEWS)[number][0];

function Table({ rows, teams, streaks, cutAfter, line }: { rows: StandingsRow[]; teams: Map<number, Team>; streaks: Map<number, string>; cutAfter?: number; line?: StandingsRow | null }) {
  return (
    <div className="scroll-x">
      <table className="data w-full text-sm">
        <thead>
          <tr>
            <th className="r">#</th>
            <th>Team</th>
            <th className="r">GP</th>
            <th className="r">W</th>
            <th className="r">L</th>
            <th className="r">OTL</th>
            <th className="r">SOL</th>
            <th className="r">PTS</th>
            <th className="r">P%</th>
            <th className="r">RW</th>
            <th className="r">ROW</th>
            <th className="r">GF</th>
            <th className="r">GA</th>
            <th className="r">DIFF</th>
            <th>Home</th>
            <th>Away</th>
            <th>L10</th>
            <th>Strk</th>
            {line && <th className="r">vs line</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const t = teams.get(r.teamId);
            const cls = [r.teamId === TEAM_ID ? "featured" : "", cutAfter != null && i === cutAfter - 1 ? "cutline" : ""].join(" ").trim();
            return (
              <tr key={r.teamId} className={cls}>
                <td className="r text-muted tabular">{i + 1}</td>
                <td>
                  {t ? (
                    <span className="inline-flex items-center gap-2 pr-2">
                      <TeamLogo team={teamView(t)} size={22} />
                      <span className="hidden sm:inline">{t.name}</span>
                      <span className="sm:hidden">{t.abbrev}</span>
                    </span>
                  ) : (
                    r.teamId
                  )}
                </td>
                <td className="r tabular">{r.gamesPlayed}</td>
                <td className="r tabular">{r.wins}</td>
                <td className="r tabular">{r.losses}</td>
                <td className="r tabular">{r.otLosses}</td>
                <td className="r tabular">{r.soLosses}</td>
                <td className="r font-semibold tabular">{r.points}</td>
                <td className="r tabular">{pct3(r.pointPctg)}</td>
                <td className="r tabular">{r.regulationWins ?? "—"}</td>
                <td className="r tabular">{r.regulationPlusOtWins ?? "—"}</td>
                <td className="r tabular">{r.goalsFor ?? "—"}</td>
                <td className="r tabular">{r.goalsAgainst ?? "—"}</td>
                <td className={`r tabular ${(r.goalDifferential ?? 0) > 0 ? "text-win" : (r.goalDifferential ?? 0) < 0 ? "text-loss" : ""}`}>{signed(r.goalDifferential)}</td>
                <td className="tabular">{r.home}</td>
                <td className="tabular">{r.road}</td>
                <td className="tabular">{r.l10}</td>
                <td className="tabular">{streaks.get(r.teamId) ?? "—"}</td>
                {line && <td className="r tabular text-muted">{signed(r.points - line.points)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function StandingsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const sp = await searchParams;
  const view: View = (VIEWS.find(([v]) => v === sp.view)?.[0] ?? "division") as View;
  const [standings, teams, finals] = await Promise.all([getLatestStandings(), getTeamMap(), getAllFinals()]);
  if (!standings) return <Empty>No standings loaded yet.</Empty>;
  const featuredDivision = teams.get(TEAM_ID)?.division;
  const streaks = streaksByTeam([...teams.keys()], finals);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">Standings</h1>
        <p className="text-xs text-muted">Through {fmtYmd(standings.date, { weekday: "long", month: "long", day: "numeric" })}. OTL overtime losses, SOL shootout losses, RW regulation wins, ROW regulation and overtime wins.</p>
      </div>
      <nav className="flex gap-1 text-sm">
        {VIEWS.map(([v, label]) => (
          <Link key={v} href={`/standings?view=${v}`} className={`rounded-md px-3 py-1.5 ${v === view ? "bg-teal text-white" : "border border-line hover:bg-soft"}`}>
            {label}
          </Link>
        ))}
      </nav>

      {view === "division" &&
        groupStandings(standings.rows, teams)
          .sort((a, b) => Number(b.name === featuredDivision) - Number(a.name === featuredDivision) || a.name.localeCompare(b.name))
          .map((g) => {
            const p = playoffPicture(standings.rows, teams, g.name, TEAM_ID);
            const format = PLAYOFF_FORMAT[g.name];
            return (
              <Card key={g.name} title={`${g.name} Division`}>
                <Table rows={g.rows} teams={teams} streaks={streaks} cutAfter={p.spots} line={p.cutLine} />
                {format && (
                  <p className="mt-2 text-[11px] text-muted">
                    Top {format.spots} make the playoffs, below the dashed line is out. {format.byes === 1 ? "The top team skips" : `The top ${format.byes} skip`} the first round. The last column is points relative to the last team in.
                  </p>
                )}
              </Card>
            );
          })}

      {view === "league" && (
        <Card title="League">
          <Table rows={[...standings.rows].sort((a, b) => (a.leagueRank ?? 99) - (b.leagueRank ?? 99))} teams={teams} streaks={streaks} />
        </Card>
      )}
    </div>
  );
}
