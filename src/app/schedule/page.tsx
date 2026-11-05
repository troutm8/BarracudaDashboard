import Link from "next/link";
import type { Metadata } from "next";
import { Card, Empty } from "@/components/Card";
import { ListenLinks } from "@/components/ListenLinks";
import { TeamLogo } from "@/components/TeamLogo";
import { outcomeFor, type Outcome } from "@/lib/derive";
import { finalSuffix, fmtTime, fmtYmd } from "@/lib/format";
import { getFeaturedTeam, getTeamGames } from "@/lib/queries";
import { TEAM_ID, statusOf, todayPacific } from "@/lib/season";
import { gameView, teamView } from "@/lib/views";

export const metadata: Metadata = { title: "Schedule" };

const MONTH = (ymd: string) => fmtYmd(ymd, { month: "long", year: "numeric" });

export default async function SchedulePage() {
  const [featured, games] = await Promise.all([getFeaturedTeam(), getTeamGames(TEAM_ID)]);
  if (!featured) return <Empty>No data yet.</Empty>;
  const today = todayPacific();
  const list = games;

  // Running record after each regular-season game.
  let w = 0;
  let l = 0;
  let otl = 0;
  let sol = 0;
  const rows = list.map((g) => {
    const status = statusOf(g.gameState);
    const o: Outcome | null = g.gameType === 2 && status === "final" ? outcomeFor(TEAM_ID, g) : null;
    if (o === "W") w++;
    else if (o === "L") l++;
    else if (o === "OTL") otl++;
    else if (o === "SOL") sol++;
    return { g, status, o, rec: o ? `${w}-${l}-${otl}-${sol}` : null };
  });
  const months = new Map<string, typeof rows>();
  for (const r of rows) {
    const m = MONTH(r.g.gameDate);
    months.set(m, [...(months.get(m) ?? []), r]);
  }
  const home = list.filter((g) => g.gameType === 2 && g.homeTeamId === TEAM_ID).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">Schedule</h1>
        <p className="text-sm text-muted">
          {list.filter((g) => g.gameType === 2).length} regular-season games, {home} at home
        </p>
      </div>
      {[...months.entries()].map(([month, rs]) => (
        <Card key={month} title={month}>
          <div className="scroll-x">
            <table className="data w-full text-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Opponent</th>
                  <th>Result</th>
                  <th className="r">Record</th>
                  <th className="r">Crowd</th>
                  <th>Follow</th>
                </tr>
              </thead>
              <tbody>
                {rs.map(({ g, status, o, rec }) => {
                  const isHome = g.homeTeamId === TEAM_ID;
                  const opp = isHome ? g.away : g.home;
                  const mine = isHome ? g.homeScore : g.awayScore;
                  const theirs = isHome ? g.awayScore : g.homeScore;
                  const isToday = g.gameDate === today;
                  return (
                    <tr key={g.id} className={isToday ? "featured" : ""}>
                      <td className="text-muted">
                        {fmtYmd(g.gameDate)}
                      </td>
                      <td>
                        <Link href={`/games/${g.id}`} className="inline-flex items-center gap-2 hover:underline">
                          <TeamLogo team={teamView(opp)} size={22} />
                          <span className="text-muted">{isHome ? "vs" : "@"}</span> {opp.name}
                        </Link>
                      </td>
                      <td>
                        {status === "final" ? (
                          <Link href={`/games/${g.id}`} className="hover:underline">
                            <span className={`font-semibold ${o === "W" ? "text-win" : o === "L" ? "text-loss" : "text-otl"}`}>{o ?? "F"}</span>{" "}
                            <span className="tabular">
                              {mine}-{theirs}
                            </span>
                            {finalSuffix(g.lastPeriodType)}
                          </Link>
                        ) : status === "live" ? (
                          <Link href={`/games/${g.id}`} className="font-semibold text-live hover:underline">
                            Live {mine ?? 0}-{theirs ?? 0}
                          </Link>
                        ) : g.scheduleState && g.scheduleState !== "OK" ? (
                          <span className="text-otl">{g.scheduleState}</span>
                        ) : (
                          <span className="text-muted">{fmtTime(g.startTimeUtc)}</span>
                        )}
                      </td>
                      <td className="r text-muted tabular">{rec ?? ""}</td>
                      <td className="r text-muted tabular">{g.attendance?.toLocaleString("en-US") ?? ""}</td>
                      <td>{status !== "final" && <ListenLinks g={gameView(g)} featuredId={TEAM_ID} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}
