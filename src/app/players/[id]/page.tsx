import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, Empty } from "@/components/Card";
import { Headshot } from "@/components/Headshot";
import { ShotMap, ShotMapLegend } from "@/components/ShotMap";
import { Sparkline } from "@/components/Sparkline";
import { TeamLogo } from "@/components/TeamLogo";
import { finalSuffix, fmtToi, fmtYmd, num, pct3, signed } from "@/lib/format";
import { getLatestGoalieSeason, getLatestSkaterSeason, getPlayer, getPlayerGameLog, getPlayerShotEvents, getTeam } from "@/lib/queries";
import { TEAM_ID } from "@/lib/season";
import { teamView } from "@/lib/views";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = /^\d+$/.test(id) ? await getPlayer(Number(id)) : null;
  return { title: p ? `${p.firstName} ${p.lastName}` : "Player" };
}

const height = (inches: number | null) => (inches ? `${Math.floor(inches / 12)}'${inches % 12}"` : null);
const POSITION: Record<string, string> = { G: "Goalie", D: "Defense", C: "Center", LW: "Left wing", RW: "Right wing", F: "Forward" };

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const playerId = Number(id);
  const player = await getPlayer(playerId);
  if (!player) notFound();
  const [team, log, skaters, goalies, shots] = await Promise.all([player.teamId ? getTeam(player.teamId) : null, getPlayerGameLog(playerId), getLatestSkaterSeason(), getLatestGoalieSeason(), getPlayerShotEvents(playerId)]);
  const isGoalie = player.position === "G";
  const goalieSeason = isGoalie ? goalies?.rows.find((r) => r.playerId === playerId) : null;
  const skaterSeason = !isGoalie ? skaters?.rows.find((r) => r.playerId === playerId) : null;
  const name = `${player.firstName} ${player.lastName}`;
  const regularLog = log.skater.filter((r) => r.game.gameType === 2);
  const regularGoalieLog = log.goalie.filter((r) => r.game.gameType === 2);
  const career = player.career ?? [];

  // Rolling 10-game points, for the chart.
  const pts = regularLog.map((r) => r.points ?? 0);
  const rolling = pts.map((_, i) => pts.slice(Math.max(0, i - 9), i + 1).reduce((a, b) => a + b, 0));
  const cumulative = pts.reduce<number[]>((acc, p) => [...acc, (acc[acc.length - 1] ?? 0) + p], []);

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-4">
        <Headshot src={player.headshotUrl} name={name} size={96} />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">
            {player.sweaterNumber != null && <span className="mr-2 text-muted">#{player.sweaterNumber}</span>}
            {name}
          </h1>
          <p className="text-sm text-muted">
            {POSITION[player.position ?? ""] ?? player.position}
            {team && (
              <>
                {" · "}
                <span className="inline-flex items-center gap-1 align-middle">
                  <TeamLogo team={teamView(team)} size={18} /> {team.name}
                </span>
              </>
            )}
            {player.shootsCatches && ` · ${isGoalie ? "Catches" : "Shoots"} ${player.shootsCatches}`}
          </p>
          <p className="text-xs text-muted">
            {[height(player.heightIn), player.weightLb ? `${player.weightLb} lb` : null, player.birthDate ? `born ${fmtYmd(player.birthDate, { month: "long", day: "numeric", year: "numeric" })}` : null, player.birthPlace].filter(Boolean).join(" · ")}
            {player.draft ? ` · Drafted ${player.draft.year}, round ${player.draft.round}${player.draft.overallPick ? `, #${player.draft.overallPick} overall` : ""} by ${player.draft.team}` : ""}
          </p>
        </div>
      </section>

      <Card title="This season">
        {skaterSeason ? (
          <dl className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm sm:grid-cols-6">
            {[
              ["GP", skaterSeason.gamesPlayed],
              ["G", skaterSeason.goals],
              ["A", skaterSeason.assists],
              ["P", skaterSeason.points],
              ["+/-", signed(skaterSeason.plusMinus)],
              ["PIM", skaterSeason.pim],
              ["PPG", skaterSeason.ppGoals],
              ["PPA", skaterSeason.ppAssists],
              ["GWG", skaterSeason.gwGoals],
              ["Shots", skaterSeason.shots],
              ["S%", num(skaterSeason.shootingPct, 1)],
              ["SO", `${skaterSeason.shootoutGoals ?? 0}/${skaterSeason.shootoutAttempts ?? 0}`],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt className="text-[11px] uppercase tracking-wide text-muted">{k}</dt>
                <dd className="text-lg font-semibold tabular">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
        ) : goalieSeason ? (
          <dl className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm sm:grid-cols-6">
            {[
              ["GP", goalieSeason.gamesPlayed],
              ["W-L-OTL", `${goalieSeason.wins}-${goalieSeason.losses}-${goalieSeason.otLosses}`],
              ["GAA", num(goalieSeason.gaa, 2)],
              ["SV%", pct3(goalieSeason.savePct)],
              ["SO", goalieSeason.shutouts],
              ["SA", goalieSeason.shotsAgainst],
              ["SV", goalieSeason.saves],
              ["GA", goalieSeason.goalsAgainst],
              ["Min", goalieSeason.minutes],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt className="text-[11px] uppercase tracking-wide text-muted">{k}</dt>
                <dd className="text-lg font-semibold tabular">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <Empty>No season line yet.</Empty>
        )}
        {rolling.length > 2 && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="text-teal">
              <Sparkline values={cumulative} width={280} height={48} label="Cumulative points" />
              <p className="text-[11px] text-muted">Points, cumulative, by game</p>
            </div>
            <div className="text-teal">
              <Sparkline values={rolling} width={280} height={48} min={0} label="Rolling 10-game points" />
              <p className="text-[11px] text-muted">Points over the last 10 games</p>
            </div>
          </div>
        )}
      </Card>

      {!isGoalie && shots.length > 0 && (
        <Card title="Shot map, this season">
          <ShotMap shots={shots.map((s) => s.e)} featuredId={player.teamId ?? TEAM_ID} width={720} />
          <ShotMapLegend featuredName={name} />
          <p className="mt-1 text-[11px] text-muted">
            {shots.filter((s) => s.e.typeDescKey === "goal").length} goals, {shots.filter((s) => s.e.typeDescKey === "shot-on-goal").length} other shots on goal, from Barracuda games.
          </p>
        </Card>
      )}

      <Card title="Game log">
        {regularLog.length ? (
          <div className="scroll-x">
            <table className="data w-full text-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Opponent</th>
                  <th>Result</th>
                  <th className="r">G</th>
                  <th className="r">A</th>
                  <th className="r">P</th>
                  <th className="r">+/-</th>
                  <th className="r">PIM</th>
                  <th className="r">SOG</th>
                </tr>
              </thead>
              <tbody>
                {[...regularLog].reverse().map((r) => {
                  const g = r.game;
                  const isHome = g.homeTeamId === r.teamId;
                  const opp = isHome ? g.away : g.home;
                  const mine = isHome ? g.homeScore : g.awayScore;
                  const theirs = isHome ? g.awayScore : g.homeScore;
                  return (
                    <tr key={g.id}>
                      <td className="text-muted">
                        <Link href={`/games/${g.id}`} className="hover:underline">
                          {fmtYmd(g.gameDate)}
                        </Link>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-2">
                          <TeamLogo team={teamView(opp)} size={20} />
                          <span className="text-muted">{isHome ? "vs" : "@"}</span> {opp.abbrev}
                        </span>
                      </td>
                      <td className="tabular">
                        <span className={(mine ?? 0) > (theirs ?? 0) ? "text-win" : "text-loss"}>{(mine ?? 0) > (theirs ?? 0) ? "W" : "L"}</span> {mine}-{theirs}
                        {finalSuffix(g.lastPeriodType)}
                      </td>
                      <td className="r tabular">{r.goals}</td>
                      <td className="r tabular">{r.assists}</td>
                      <td className="r font-semibold tabular">{r.points}</td>
                      <td className="r tabular">{signed(r.plusMinus)}</td>
                      <td className="r tabular">{r.pim}</td>
                      <td className="r tabular">{r.sog}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : regularGoalieLog.length ? (
          <div className="scroll-x">
            <table className="data w-full text-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Opponent</th>
                  <th>Result</th>
                  <th className="r">Dec</th>
                  <th className="r">SA</th>
                  <th className="r">SV</th>
                  <th className="r">GA</th>
                  <th className="r">SV%</th>
                  <th className="r">TOI</th>
                </tr>
              </thead>
              <tbody>
                {[...regularGoalieLog].reverse().map((r) => {
                  const g = r.game;
                  const isHome = g.homeTeamId === r.teamId;
                  const opp = isHome ? g.away : g.home;
                  const mine = isHome ? g.homeScore : g.awayScore;
                  const theirs = isHome ? g.awayScore : g.homeScore;
                  return (
                    <tr key={g.id}>
                      <td className="text-muted">
                        <Link href={`/games/${g.id}`} className="hover:underline">
                          {fmtYmd(g.gameDate)}
                        </Link>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-2">
                          <TeamLogo team={teamView(opp)} size={20} />
                          <span className="text-muted">{isHome ? "vs" : "@"}</span> {opp.abbrev}
                        </span>
                      </td>
                      <td className="tabular">
                        {mine}-{theirs}
                        {finalSuffix(g.lastPeriodType)}
                      </td>
                      <td className="r tabular">{r.decision ?? ""}</td>
                      <td className="r tabular">{r.shotsAgainst}</td>
                      <td className="r tabular">{r.saves}</td>
                      <td className="r tabular">{r.goalsAgainst}</td>
                      <td className="r tabular">{pct3(r.savePctg)}</td>
                      <td className="r tabular">{fmtToi(r.toiSeconds)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No games in the box scores we hold. Only Barracuda games are loaded.</Empty>
        )}
      </Card>

      {career.length > 0 && (
        <Card title="AHL career">
          <div className="scroll-x">
            <table className="data w-full text-sm">
              <thead>
                <tr>
                  <th>Season</th>
                  <th>Team</th>
                  <th className="r">GP</th>
                  <th className="r">G</th>
                  <th className="r">A</th>
                  <th className="r">P</th>
                  <th className="r">PIM</th>
                </tr>
              </thead>
              <tbody>
                {career.map((c, i) => (
                  <tr key={i}>
                    <td>{c.season}</td>
                    <td className="text-muted">{c.team}</td>
                    <td className="r tabular">{c.gp}</td>
                    <td className="r tabular">{c.g}</td>
                    <td className="r tabular">{c.a}</td>
                    <td className="r font-semibold tabular">{c.p}</td>
                    <td className="r tabular">{c.pim}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
