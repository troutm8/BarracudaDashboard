import Link from "next/link";
import { Card, Empty } from "@/components/Card";
import { GameRow } from "@/components/GameRow";
import { LiveGameCard } from "@/components/LiveGameCard";
import { LiveScoreboard } from "@/components/LiveScoreboard";
import { FormStrip, Sparkline } from "@/components/Sparkline";
import { TeamLogo } from "@/components/TeamLogo";
import { computeRecord, playoffPicture, pointsPace, seasonSeries, splitOf, splitText } from "@/lib/derive";
import { daysUntil, fmtYmd, ordinal, pct1, signed } from "@/lib/format";
import { getFeaturedTeam, getGamesByDate, getLatestOdds, getLatestStandings, getOddsHistory, getTeamGames, getTeamMap, getTransactions } from "@/lib/queries";
import { MILESTONES, TEAM_ID, TOTAL_GAMES, todayPacific } from "@/lib/season";
import { gameView, sortForFeatured, teamView } from "@/lib/views";

export default async function HomePage() {
  const today = todayPacific();
  const featured = await getFeaturedTeam();
  if (!featured) {
    return (
      <Empty>
        No data yet. Run <code>pnpm ingest backfill</code> to load the season.
      </Empty>
    );
  }
  const [teamGames, todays, standings, odds, oddsHistory, teamMap, moves] = await Promise.all([
    getTeamGames(TEAM_ID),
    getGamesByDate(today),
    getLatestStandings(),
    getLatestOdds(),
    getOddsHistory(TEAM_ID),
    getTeamMap(),
    getTransactions(5),
  ]);

  const regular = teamGames.filter((g) => g.gameType === 2);
  const record = computeRecord(TEAM_ID, regular, teamMap);
  const finals = regular.filter((g) => g.gameState === "FINAL");
  const lastGame = finals[finals.length - 1] ?? null;
  const liveGame = regular.find((g) => g.gameState === "LIVE") ?? null;
  const todayGame = regular.find((g) => g.gameDate === today && g.gameState !== "FINAL") ?? null;
  const nextGame = regular.find((g) => g.gameState === "FUT" && g.gameDate >= today) ?? null;
  const featuredGame = liveGame ?? todayGame ?? nextGame;
  const upcoming = regular.filter((g) => g.gameState === "FUT" && g.gameDate >= today && g.id !== featuredGame?.id).slice(0, 5);

  const standingRow = standings?.rows.find((r) => r.teamId === TEAM_ID) ?? null;
  const picture = standings && featured.division ? playoffPicture(standings.rows, teamMap, featured.division, TEAM_ID) : null;
  const oddsRow = odds?.rows.find((r) => r.teamId === TEAM_ID) ?? null;
  const pace = pointsPace(record.points, record.gp);
  const cumPoints = record.results.reduce<number[]>((acc, o) => [...acc, (acc[acc.length - 1] ?? 0) + (o === "W" ? 2 : o === "L" ? 0 : 1)], []);

  const tv = teamView(featured);
  const todayViews = sortForFeatured(todays.map(gameView), TEAM_ID);
  const nextOpp = featuredGame ? (featuredGame.homeTeamId === TEAM_ID ? featuredGame.away : featuredGame.home) : null;
  const series = nextOpp ? seasonSeries(TEAM_ID, nextOpp.id, regular) : null;
  const oppStanding = nextOpp ? standings?.rows.find((r) => r.teamId === nextOpp.id) : null;
  const place = standingRow?.divisionRank ? `${ordinal(standingRow.divisionRank)} in the ${featured.division}` : `${featured.division} Division`;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-4">
        <TeamLogo team={tv} size={72} />
        <div>
          <h1 className="text-2xl font-bold">{featured.name}</h1>
          <p className="text-sm text-muted">
            <span className="font-semibold text-fg tabular">{splitText(record)}</span> · {record.points} pts · {place} · streak {record.streak}
          </p>
          <p className="mt-1 flex items-center gap-2 text-xs text-muted">
            Last 10: <FormStrip results={record.last10} /> <span className="tabular">{splitText(splitOf(record.last10))}</span>
          </p>
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card title={liveGame ? "Live now" : todayGame ? "Tonight" : "Next game"} className="lg:col-span-2">
          {featuredGame ? (
            <>
              <LiveGameCard game={gameView(featuredGame)} summary={featuredGame.summary ?? null} featuredId={TEAM_ID} />
              {nextOpp && (
                <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
                  {nextOpp.name}
                  {oppStanding ? ` are ${oppStanding.wins}-${oppStanding.losses}-${oppStanding.otLosses}-${oppStanding.soLosses}, ${oppStanding.points} pts` : ""}
                  {series && series.games.length ? ` · season series ${splitText(series.split)}` : " · first meeting this season"}
                </p>
              )}
            </>
          ) : (
            <Empty>No upcoming game on the schedule.</Empty>
          )}
        </Card>

        <Card title="Last result">{lastGame ? <LiveGameCard game={gameView(lastGame)} summary={lastGame.summary ?? null} featuredId={TEAM_ID} /> : <Empty>Season not under way.</Empty>}</Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Where we stand">
          {standingRow ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Points</dt>
              <dd className="tabular">
                {standingRow.points} in {standingRow.gamesPlayed} GP
              </dd>
              <dt className="text-muted">Pace</dt>
              <dd className="tabular">
                {pace} pts over {TOTAL_GAMES}
              </dd>
              <dt className="text-muted">Division</dt>
              <dd>{place}</dd>
              <dt className="text-muted">League</dt>
              <dd className="tabular">{standingRow.leagueRank ? `${ordinal(standingRow.leagueRank)} of 32` : "—"}</dd>
              <dt className="text-muted">Playoff line</dt>
              <dd className="tabular">
                {picture?.featured
                  ? picture.featured.inPlayoffs
                    ? `In, ${signed(picture.featured.pointsVsLine)} on the first team out`
                    : `${Math.abs(picture.featured.pointsVsLine)} back${picture.featured.gamesInHand > 0 ? `, ${picture.featured.gamesInHand} in hand` : picture.featured.gamesInHand < 0 ? `, ${-picture.featured.gamesInHand} more played` : ""}`
                  : "—"}
              </dd>
              <dt className="text-muted">Goal diff</dt>
              <dd className="tabular">
                {signed(standingRow.goalDifferential)} ({standingRow.goalsFor}-{standingRow.goalsAgainst})
              </dd>
              <dt className="text-muted">Home / Road</dt>
              <dd className="tabular">
                {splitText(record.home)} / {splitText(record.road)}
              </dd>
              <dt className="text-muted">One-goal games</dt>
              <dd className="tabular">{splitText(record.oneGoal)}</dd>
            </dl>
          ) : (
            <Empty>No standings loaded.</Empty>
          )}
          {cumPoints.length > 2 && (
            <div className="mt-3 text-teal">
              <Sparkline values={cumPoints} width={260} height={44} label="Points this season" />
              <p className="text-[11px] text-muted">Points, game by game</p>
            </div>
          )}
          <p className="mt-2 text-right text-xs">
            <Link href="/standings" className="text-teal hover:underline">
              Division race →
            </Link>
          </p>
        </Card>

        <Card title="Playoff odds" action={<span className="text-[11px] text-muted">Simulated here{odds ? `, ${fmtYmd(odds.date)}` : ""}</span>}>
          {oddsRow ? (
            <>
              <div className="flex items-end gap-3">
                <div className="text-4xl font-bold tabular text-teal">{pct1(oddsRow.madePlayoffs)}</div>
                <div className="pb-1 text-xs text-muted">to make the playoffs</div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted">Win the division</dt>
                <dd className="tabular">{pct1(oddsRow.wonDivision)}</dd>
                <dt className="text-muted">First-round bye</dt>
                <dd className="tabular">{pct1(oddsRow.firstRoundBye)}</dd>
                <dt className="text-muted">Projected points</dt>
                <dd className="tabular">{oddsRow.projectedPoints ? Number(oddsRow.projectedPoints).toFixed(0) : "—"}</dd>
              </dl>
              {oddsHistory.length > 2 && (
                <div className="mt-3 text-teal">
                  <Sparkline values={oddsHistory.map((o) => Number(o.madePlayoffs ?? 0) * 100)} min={0} max={100} baseline={50} width={260} height={44} label="Playoff odds history" />
                  <p className="text-[11px] text-muted">Playoff odds, day by day</p>
                </div>
              )}
              <p className="mt-2 text-right text-xs">
                <Link href="/rankings" className="text-teal hover:underline">
                  How this works →
                </Link>
              </p>
            </>
          ) : (
            <Empty>No odds yet.</Empty>
          )}
        </Card>

        <Card title="Coming up">
          {upcoming.length ? (
            <ul className="divide-y divide-line text-sm">
              {upcoming.map((g) => {
                const home = g.homeTeamId === TEAM_ID;
                const opp = home ? g.away : g.home;
                return (
                  <li key={g.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="flex items-center gap-2">
                      <TeamLogo team={teamView(opp)} size={22} />
                      <span>
                        <span className="text-muted">{home ? "vs" : "@"}</span> {opp.commonName}
                      </span>
                    </span>
                    <span className="text-right text-xs text-muted">
                      {fmtYmd(g.gameDate)}
                      <br />
                      {g.startTimeUtc ? new Intl.DateTimeFormat("en-US", { timeZone: process.env.NEXT_PUBLIC_DISPLAY_TZ ?? "America/Los_Angeles", hour: "numeric", minute: "2-digit" }).format(g.startTimeUtc) : "TBA"}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>Nothing scheduled.</Empty>
          )}
          <h3 className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Season milestones</h3>
          <ul className="space-y-1 text-sm">
            {MILESTONES.filter((m) => m.date >= today)
              .slice(0, 4)
              .map((m) => (
                <li key={m.date} className="flex justify-between gap-2">
                  <span className="truncate">{m.label}</span>
                  <span className="shrink-0 text-xs text-muted tabular">
                    {fmtYmd(m.date)} · {daysUntil(m.date, today)}d
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      </div>

      {moves.length > 0 && (
        <Card title="Roster moves" action={<Link href="/moves" className="text-xs text-teal hover:underline">All moves →</Link>}>
          <ul className="divide-y divide-line text-sm">
            {moves.map((m) => (
              <li key={`${m.date}${m.playerName}${m.description}`} className="flex items-baseline gap-3 py-1.5">
                <span className="w-14 shrink-0 text-xs text-muted tabular">{fmtYmd(m.date, { month: "short", day: "numeric" })}</span>
                <span className={`w-4 shrink-0 text-center font-semibold ${m.kind === "ADD" ? "text-win" : "text-loss"}`}>{m.kind === "ADD" ? "+" : "−"}</span>
                <span className="min-w-0 flex-1 truncate">
                  {m.playerName} <span className="text-muted">· {m.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        title={`Around the league · ${fmtYmd(today, { weekday: "long", month: "long", day: "numeric" })}`}
        action={
          <Link href={`/scores?date=${today}`} className="text-xs text-teal hover:underline">
            All scores →
          </Link>
        }
      >
        {todayViews.length ? <LiveScoreboard games={todayViews} date={today} featuredId={TEAM_ID} /> : <Empty>No AHL games today.</Empty>}
      </Card>

      {lastGame && finals.length > 1 && (
        <Card title="Recent results" action={<Link href="/schedule" className="text-xs text-teal hover:underline">Full schedule →</Link>}>
          {finals
            .slice(-6, -1)
            .reverse()
            .map((g) => (
              <GameRow key={g.id} g={gameView(g)} featuredId={TEAM_ID} showDate />
            ))}
        </Card>
      )}
    </div>
  );
}
