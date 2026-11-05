import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { GameGoalieStat, GameSkaterStat, Team } from "@/db/schema";
import { Card, Empty } from "@/components/Card";
import { LiveGameCard } from "@/components/LiveGameCard";
import { ShotMap, ShotMapLegend } from "@/components/ShotMap";
import { TeamLogo } from "@/components/TeamLogo";
import { finalSuffix, fmtDateTime, fmtToi, fmtYmdLong, pct3, periodLabel, signed } from "@/lib/format";
import { getGame, getTeamGames } from "@/lib/queries";
import { TEAM_ID, statusOf } from "@/lib/season";
import { gameView, teamView } from "@/lib/views";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = /^\d+$/.test(id) ? await getGame(Number(id)) : null;
  return { title: data ? `${data.game.away.abbrev} at ${data.game.home.abbrev}, ${data.game.gameDate}` : "Game" };
}

function SkaterTable({ rows, team }: { rows: GameSkaterStat[]; team: Team }) {
  return (
    <div className="scroll-x">
      <table className="data w-full text-sm">
        <thead>
          <tr>
            <th>{team.commonName}</th>
            <th className="r">G</th>
            <th className="r">A</th>
            <th className="r">P</th>
            <th className="r">+/-</th>
            <th className="r">PIM</th>
            <th className="r">SOG</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.playerId}>
              <td>
                <Link href={`/players/${s.playerId}`} className="hover:underline">
                  <span className="mr-1 text-xs text-muted tabular">{s.sweaterNumber}</span>
                  {s.name} <span className="text-xs text-muted">{s.position}</span>
                </Link>
              </td>
              <td className="r tabular">{s.goals}</td>
              <td className="r tabular">{s.assists}</td>
              <td className="r font-semibold tabular">{s.points}</td>
              <td className="r tabular">{signed(s.plusMinus)}</td>
              <td className="r tabular">{s.pim}</td>
              <td className="r tabular">{s.sog}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GoalieTable({ rows }: { rows: GameGoalieStat[] }) {
  return (
    <div className="scroll-x">
      <table className="data w-full text-sm">
        <thead>
          <tr>
            <th>Goalie</th>
            <th className="r">Dec</th>
            <th className="r">SA</th>
            <th className="r">SV</th>
            <th className="r">GA</th>
            <th className="r">SV%</th>
            <th className="r">TOI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.playerId}>
              <td>
                <Link href={`/players/${g.playerId}`} className="hover:underline">
                  <span className="mr-1 text-xs text-muted tabular">{g.sweaterNumber}</span>
                  {g.name}
                  {g.starter ? "" : <span className="ml-1 text-xs text-muted">(relief)</span>}
                </Link>
              </td>
              <td className="r tabular">{g.decision ?? ""}</td>
              <td className="r tabular">{g.shotsAgainst}</td>
              <td className="r tabular">{g.saves}</td>
              <td className="r tabular">{g.goalsAgainst}</td>
              <td className="r tabular">{pct3(g.savePctg)}</td>
              <td className="r tabular">{fmtToi(g.toiSeconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const data = await getGame(Number(id));
  if (!data) notFound();
  const { game, skaters, goalies, events } = data;
  const g = gameView(game);
  const status = statusOf(game.gameState);
  const featuredIn = game.homeTeamId === TEAM_ID || game.awayTeamId === TEAM_ID;
  const featuredId = featuredIn ? TEAM_ID : game.homeTeamId;
  const loaded = game.boxscoreLoaded && skaters.length > 0;
  const summary = game.summary;
  const periods = summary?.periods ?? [];
  const qualityShots = (teamId: number) => events.filter((e) => e.teamId === teamId && e.quality).length;
  const oppId = game.homeTeamId === TEAM_ID ? game.awayTeamId : game.homeTeamId;

  // Season series, for the footer.
  const seriesGames = featuredIn ? (await getTeamGames(TEAM_ID)).filter((x) => x.gameType === 2 && (x.homeTeamId === oppId || x.awayTeamId === oppId)) : [];

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        <Link href={`/scores?date=${game.gameDate}`} className="hover:underline">
          ← Scores, {fmtYmdLong(game.gameDate)}
        </Link>
      </p>
      <Card>
        <LiveGameCard game={g} summary={summary ?? null} featuredId={featuredId} />
        <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
          {fmtDateTime(game.startTimeUtc)}
          {game.venue ? ` · ${game.venue}` : ""}
          {game.attendance ? ` · ${game.attendance.toLocaleString("en-US")} fans` : ""}
          {game.gameType === 3 ? " · Playoffs" : ""}
          {status === "final" ? ` · Final${finalSuffix(game.lastPeriodType)}` : ""}
          {game.notes ? ` · ${game.notes}` : ""}
        </p>
      </Card>

      {status !== "pre" && periods.length > 0 && (
        <Card title="Linescore">
          <table className="data w-auto text-sm">
            <thead>
              <tr>
                <th></th>
                {periods.map((p) => (
                  <th key={p.number} className="r">
                    {periodLabel(p.number, p.type)}
                  </th>
                ))}
                {summary!.shootout.length > 0 && <th className="r">SO</th>}
                <th className="r">T</th>
              </tr>
            </thead>
            <tbody>
              {(["away", "home"] as const).map((side) => {
                const t = game[side];
                const total = side === "home" ? game.homeScore : game.awayScore;
                const sog = side === "home" ? game.homeSog : game.awaySog;
                return (
                  <tr key={side} className={t.id === featuredId && featuredIn ? "featured" : ""}>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <TeamLogo team={teamView(t)} size={20} /> {t.abbrev}
                      </span>
                    </td>
                    {periods.map((p) => (
                      <td key={p.number} className="r tabular">
                        {side === "home" ? p.homeGoals : p.awayGoals}
                        <span className="ml-1 text-[10px] text-muted">({side === "home" ? p.homeShots : p.awayShots})</span>
                      </td>
                    ))}
                    {summary!.shootout.length > 0 && <td className="r tabular">{summary!.shootout.filter((s) => s.teamAbbrev === t.abbrev && s.scored).length}</td>}
                    <td className="r font-semibold tabular">
                      {total}
                      {sog != null && <span className="ml-1 text-[10px] font-normal text-muted">({sog})</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-muted">Goals, with shots on goal in parentheses.</p>
        </Card>
      )}

      {summary && summary.shootout.length > 0 && (
        <Card title="Shootout">
          <ul className="divide-y divide-line text-sm">
            {summary.shootout.map((s, i) => (
              <li key={i} className="flex items-baseline gap-3 py-1.5">
                <span className="w-10 shrink-0 text-xs font-semibold">{s.teamAbbrev}</span>
                <span className="min-w-0 flex-1 truncate">
                  {s.shooter} <span className="text-muted">on {s.goalie}</span>
                </span>
                <span className={`shrink-0 text-xs ${s.scored ? "text-win" : "text-muted"}`}>{s.scored ? (s.winner ? "Winner" : "Goal") : "No goal"}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {loaded ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Shot map" className="lg:col-span-2">
              <ShotMap shots={events} featuredId={featuredId} names={new Map(skaters.map((s) => [s.playerId, s.name] as [number, string]))} />
              <ShotMapLegend featuredName={(game.homeTeamId === TEAM_ID ? game.home : game.away).commonName} opponentName={(game.homeTeamId === TEAM_ID ? game.away : game.home).commonName} />
            </Card>
            <Card title="Team stats">
              <table className="data w-full text-sm">
                <thead>
                  <tr>
                    <th>{game.away.abbrev}</th>
                    <th className="text-center"></th>
                    <th className="r">{game.home.abbrev}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Shots on goal", summary?.away?.shots, summary?.home?.shots],
                    ["Quality shots", qualityShots(game.awayTeamId), qualityShots(game.homeTeamId)],
                    ["Power play", `${summary?.away?.ppGoals ?? 0}/${summary?.away?.ppOpps ?? 0}`, `${summary?.home?.ppGoals ?? 0}/${summary?.home?.ppOpps ?? 0}`],
                    ["Penalty minutes", summary?.away?.pim, summary?.home?.pim],
                  ].map(([label, a, h]) => (
                    <tr key={String(label)}>
                      <td className="tabular">{a ?? "—"}</td>
                      <td className="text-center text-xs text-muted">{label}</td>
                      <td className="r tabular">{h ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {summary && summary.officials.length > 0 && <p className="mt-3 text-[11px] text-muted">Officials: {summary.officials.join(", ")}</p>}
            </Card>
          </div>

          {summary && summary.penalties.length > 0 && (
            <Card title="Penalties">
              <ul className="divide-y divide-line text-sm">
                {summary.penalties.map((p, i) => (
                  <li key={i} className="flex items-baseline gap-3 py-1.5">
                    <span className="w-16 shrink-0 text-xs text-muted tabular">
                      {periodLabel(p.period, p.periodType)} {p.timeInPeriod}
                    </span>
                    <span className="w-10 shrink-0 text-xs font-semibold">{p.teamAbbrev}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {p.bench ? "Bench" : p.committedBy ?? "Team"} <span className="text-muted">· {p.description}</span>
                      {p.servedBy && p.servedBy !== p.committedBy && <span className="text-xs text-muted"> (served by {p.servedBy})</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted tabular">{p.minutes ?? ""} min</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title={`${game.away.name} skaters`}>
            <SkaterTable rows={skaters.filter((s) => s.teamId === game.awayTeamId)} team={game.away} />
          </Card>
          <Card title={`${game.home.name} skaters`}>
            <SkaterTable rows={skaters.filter((s) => s.teamId === game.homeTeamId)} team={game.home} />
          </Card>
          <Card title="Goalies">
            <GoalieTable rows={goalies} />
          </Card>
        </>
      ) : status === "final" ? (
        <Card>
          <Empty>{featuredIn ? "Box score not loaded yet. It arrives with the next ingest." : "Box scores are stored for Barracuda games only."}</Empty>
        </Card>
      ) : null}

      {seriesGames.length > 1 && (
        <Card title="Season series">
          <ul className="divide-y divide-line text-sm">
            {seriesGames.map((x) => {
              const isHome = x.homeTeamId === TEAM_ID;
              const mine = isHome ? x.homeScore : x.awayScore;
              const theirs = isHome ? x.awayScore : x.homeScore;
              const done = statusOf(x.gameState) === "final";
              return (
                <li key={x.id} className={`flex items-center justify-between py-1.5 ${x.id === game.id ? "font-semibold" : ""}`}>
                  <Link href={`/games/${x.id}`} className="hover:underline">
                    {fmtYmdLong(x.gameDate)} · {isHome ? "home" : "away"}
                  </Link>
                  <span className="tabular">{done ? `${mine! > theirs! ? "W" : "L"} ${mine}-${theirs}${finalSuffix(x.lastPeriodType)}` : "upcoming"}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
