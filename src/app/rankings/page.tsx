import type { Metadata } from "next";
import { Card, Empty } from "@/components/Card";
import { TeamLogo } from "@/components/TeamLogo";
import { POWER_WEIGHTS, powerRankings, recordPoints, type PowerInput } from "@/lib/derive";
import { fmtYmd, pct1, signed } from "@/lib/format";
import { getLatestOdds, getLatestStandings, getLatestTeamSeason, getTeamMap } from "@/lib/queries";
import { TEAM_ID } from "@/lib/season";
import { SIM } from "@/lib/simulate";
import { teamView } from "@/lib/views";

export const metadata: Metadata = { title: "Rankings" };

export default async function RankingsPage() {
  const [standings, teamSeason, odds, teams] = await Promise.all([getLatestStandings(), getLatestTeamSeason(), getLatestOdds(), getTeamMap()]);
  if (!standings) return <Empty>No standings loaded yet.</Empty>;
  const shares = new Map((teamSeason?.rows ?? []).map((r) => [r.teamId, r.shotsFor != null && r.shotsAgainst != null && r.shotsFor + r.shotsAgainst > 0 ? r.shotsFor / (r.shotsFor + r.shotsAgainst) : null]));
  const inputs: PowerInput[] = standings.rows.map((r) => {
    const l10 = recordPoints(r.l10);
    return {
      teamId: r.teamId,
      gamesPlayed: r.gamesPlayed,
      pointPct: r.pointPctg == null ? (r.gamesPlayed ? r.points / (r.gamesPlayed * 2) : 0) : Number(r.pointPctg),
      goalDifferential: r.goalDifferential ?? 0,
      shotShare: shares.get(r.teamId) ?? null,
      l10Points: l10.points,
      l10Games: l10.games,
    };
  });
  const ranked = powerRankings(inputs);
  const standingsBy = new Map(standings.rows.map((r) => [r.teamId, r]));
  const oddsBy = new Map((odds?.rows ?? []).map((r) => [r.teamId, r]));
  const recordOf = (s: (typeof standings.rows)[number]) => `${s.wins}-${s.losses}-${s.otLosses}-${s.soLosses}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">Rankings</h1>
        <p className="text-xs text-muted">
          Standings through {fmtYmd(standings.date)}; odds {odds ? fmtYmd(odds.date) : "—"}.
        </p>
      </div>

      <Card title="Power rankings">
        <div className="scroll-x">
          <table className="data w-full text-sm">
            <thead>
              <tr>
                <th className="r">#</th>
                <th>Team</th>
                <th className="r">Score</th>
                <th className="r">Pts%</th>
                <th className="r">Goal diff</th>
                <th className="r">Shots</th>
                <th className="r">Last 10</th>
                <th className="r">Record</th>
                <th className="r">Standings</th>
                <th className="r">Playoffs</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => {
                const s = standingsBy.get(r.teamId)!;
                const t = teams.get(r.teamId);
                const o = oddsBy.get(r.teamId);
                const move = (s.leagueRank ?? r.rank) - r.rank;
                return (
                  <tr key={r.teamId} className={r.teamId === TEAM_ID ? "featured" : ""}>
                    <td className="r tabular">
                      {r.rank}
                      {move !== 0 && <span className={`ml-1 text-[10px] ${move > 0 ? "text-win" : "text-loss"}`}>{move > 0 ? `▲${move}` : `▼${-move}`}</span>}
                    </td>
                    <td>
                      {t && (
                        <span className="inline-flex items-center gap-2">
                          <TeamLogo team={teamView(t)} size={22} />
                          <span className="hidden sm:inline">{t.name}</span>
                          <span className="sm:hidden">{t.abbrev}</span>
                        </span>
                      )}
                    </td>
                    <td className="r font-semibold tabular">{r.score.toFixed(1)}</td>
                    <td className="r text-muted tabular">{r.components.points.toFixed(1)}</td>
                    <td className="r text-muted tabular">{r.components.goalDiff.toFixed(1)}</td>
                    <td className="r text-muted tabular">{r.components.shots.toFixed(1)}</td>
                    <td className="r text-muted tabular">{r.components.form.toFixed(1)}</td>
                    <td className="r tabular">{recordOf(s)}</td>
                    <td className="r tabular">{s.leagueRank}</td>
                    <td className="r tabular">{pct1(o?.madePlayoffs)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-muted">
          Score out of 100: points percentage ({POWER_WEIGHTS.points}), goal differential per game scaled from -1.5 to +1.5 ({POWER_WEIGHTS.goalDiff}), share of shots on goal scaled from 40% to 60% ({POWER_WEIGHTS.shots}), points over the last ten games ({POWER_WEIGHTS.form}). The arrow compares with the team&apos;s place in the league standings. Computed here; nothing official about it.
        </p>
      </Card>

      <Card title="Playoff odds" action={<span className="text-[11px] text-muted">Simulated here</span>}>
        {odds ? (
          <div className="scroll-x">
            <table className="data w-full text-sm">
              <thead>
                <tr>
                  <th className="r">#</th>
                  <th>Team</th>
                  <th>Division</th>
                  <th className="r">Record</th>
                  <th className="r">Proj. pts</th>
                  <th className="r">Playoffs</th>
                  <th className="r">Bye</th>
                  <th className="r">Win division</th>
                </tr>
              </thead>
              <tbody>
                {odds.rows.map((o, i) => {
                  const t = teams.get(o.teamId);
                  const s = standingsBy.get(o.teamId);
                  return (
                    <tr key={o.teamId} className={o.teamId === TEAM_ID ? "featured" : ""}>
                      <td className="r text-muted tabular">{i + 1}</td>
                      <td>
                        {t && (
                          <span className="inline-flex items-center gap-2">
                            <TeamLogo team={teamView(t)} size={22} />
                            <span className="hidden sm:inline">{t.name}</span>
                            <span className="sm:hidden">{t.abbrev}</span>
                          </span>
                        )}
                      </td>
                      <td className="text-muted">{t?.division}</td>
                      <td className="r tabular">{s ? recordOf(s) : "—"}</td>
                      <td className="r tabular">
                        {o.projectedPoints ? Number(o.projectedPoints).toFixed(0) : "—"}
                        {s && o.projectedPoints && <span className="ml-1 text-[10px] text-muted">({signed(Math.round(Number(o.projectedPoints)) - s.points)})</span>}
                      </td>
                      <td className="r font-semibold tabular">{pct1(o.madePlayoffs)}</td>
                      <td className="r tabular">{pct1(o.firstRoundBye)}</td>
                      <td className="r tabular">{pct1(o.wonDivision)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No odds yet.</Empty>
        )}
        <p className="mt-3 text-[11px] text-muted">
          The rest of the season played out {SIM.iterations.toLocaleString("en-US")} times. A team&apos;s strength is its goal differential per game, pulled toward average by {SIM.priorGames} imaginary average games and given random uncertainty each run. Home teams get a small edge and {Math.round(SIM.overtimeRate * 100)}% of games go past regulation, giving the loser a point. Nobody publishes AHL odds, so treat these as a rough guide, especially early in the season.
        </p>
      </Card>
    </div>
  );
}
