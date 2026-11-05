import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { games, oddsSnapshots, teams } from "@/db/schema";
import { GAME_TYPE, PLAYOFF_FORMAT, SEASON, todayPacific } from "@/lib/season";
import { simulateSeason } from "@/lib/simulate";
import { log, numStr } from "./common";

/** Seed from the date, so a re-run on the same day gives the same odds. */
const seedOf = (ymd: string) => Number(ymd.replaceAll("-", ""));

/** Simulate the season as it stood at the end of `date`. Replaces that date's rows. */
export async function ingestOdds(db: Db, date = todayPacific()): Promise<number> {
  const [allTeams, allGames] = await Promise.all([db.select().from(teams), db.select().from(games).where(eq(games.season, SEASON))]);
  const simGames = allGames
    .filter((g) => g.gameType === GAME_TYPE.regular && g.scheduleState !== "CNCL")
    .map((g) => ({ ...g, final: g.gameState === "FINAL" && g.gameDate <= date }));
  const results = simulateSeason(allTeams, simGames, PLAYOFF_FORMAT, { seed: seedOf(date) });
  await db.delete(oddsSnapshots).where(eq(oddsSnapshots.date, date));
  await db.insert(oddsSnapshots).values(
    results.map((r) => ({
      date,
      teamId: r.teamId,
      madePlayoffs: numStr(r.madePlayoffs),
      firstRoundBye: numStr(r.firstRoundBye),
      wonDivision: numStr(r.wonDivision),
      projectedPoints: numStr(r.projectedPoints),
    })),
  );
  log(`odds ${date}: ${results.length} teams`);
  return results.length;
}
