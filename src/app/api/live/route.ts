import { NextResponse } from "next/server";
import { summaryOf } from "@/ingest/jobs/boxscores";
import { feedUrl, fromScorebar, gameStateOf, gameSummaryParams, gameSummarySchema, lastPeriodTypeOf, parseFeed, scorebarParams, scorebarSchema } from "@/ingest/sources/hockeytech";
import { liveFromFeed, type LiveDay, type LiveGameDetail } from "@/lib/live";
import { isValidYmd, todayPacific } from "@/lib/season";

export const dynamic = "force-dynamic";

async function scorebar() {
  const res = await fetch(feedUrl(scorebarParams(1, 1)), { next: { revalidate: 20 } });
  if (!res.ok) throw new Error(`feed ${res.status}`);
  return scorebarSchema.parse(parseFeed(await res.text())).SiteKit.Scorebar.map(fromScorebar);
}

/**
 * Live overlay, proxied so the browser never talks to the feed directly.
 *   /api/live?date=YYYY-MM-DD   every game that day: state, period, clock, score
 *   /api/live?game=ID           one game with shots, its scoring summary and three stars
 * The scoreboard only reaches a day either side of today; other dates come back empty.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const gameParam = url.searchParams.get("game");
  try {
    if (gameParam && /^\d+$/.test(gameParam)) {
      const id = Number(gameParam);
      const [res, board] = await Promise.all([fetch(feedUrl(gameSummaryParams(id)), { next: { revalidate: 20 } }), scorebar()]);
      if (!res.ok) return NextResponse.json({ error: `feed ${res.status}` }, { status: 502 });
      const summary = gameSummarySchema.parse(parseFeed(await res.text()));
      const shots = { home: summary.homeTeam.stats.shots, away: summary.visitingTeam.stats.shots };
      const onBoard = board.find((g) => g.id === id);
      const body: LiveGameDetail = {
        fetchedAt: new Date().toISOString(),
        game: liveFromFeed(
          onBoard ?? {
            id,
            gameState: summary.details.final ? "FINAL" : gameStateOf(summary.details.started ? 2 : 1),
            period: null,
            periodType: null,
            clock: null,
            inIntermission: null,
            homeScore: summary.homeTeam.stats.goals,
            awayScore: summary.visitingTeam.stats.goals,
            lastPeriodType: lastPeriodTypeOf(summary.details.status ?? ""),
          },
          shots,
        ),
        summary: summaryOf(summary),
      };
      return NextResponse.json(body, { headers: { "cache-control": "public, max-age=15" } });
    }
    const q = url.searchParams.get("date") ?? undefined;
    const date = isValidYmd(q) ? q : todayPacific();
    const board = await scorebar();
    const body: LiveDay = { fetchedAt: new Date().toISOString(), date, games: board.filter((g) => g.gameDate === date).map((g) => liveFromFeed(g)) };
    return NextResponse.json(body, { headers: { "cache-control": "public, max-age=15" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
