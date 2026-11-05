import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { games, teams } from "@/db/schema";
import { GAME_TYPE, SEASON } from "@/lib/season";
import * as ht from "../sources/hockeytech";
import { log } from "./common";

/** The 32 clubs and their divisions. */
export async function ingestTeams(db: Db): Promise<number> {
  const rows = ht.teamsOf(await ht.fetchBootstrap());
  for (const t of rows) {
    await db.insert(teams).values(t).onConflictDoUpdate({ target: teams.id, set: { ...t, updatedAt: new Date() } });
  }
  log(`teams: ${rows.length} clubs`);
  return rows.length;
}

const excluded = (column: string) => sql.raw(`excluded.${column}`);

/** Columns both feeds carry. The schedule adds the rest. Box-score columns are never touched here. */
const LIVE_COLUMNS = {
  gameState: excluded("game_state"),
  scheduleState: excluded("schedule_state"),
  homeScore: excluded("home_score"),
  awayScore: excluded("away_score"),
  period: excluded("period"),
  periodType: excluded("period_type"),
  clock: excluded("clock"),
  inIntermission: excluded("in_intermission"),
  lastPeriodType: excluded("last_period_type"),
  updatedAt: excluded("updated_at"),
};
const SCHEDULE_COLUMNS = {
  ...LIVE_COLUMNS,
  gameDate: excluded("game_date"),
  startTimeUtc: excluded("start_time_utc"),
  venue: excluded("venue"),
  venueTimezone: excluded("venue_timezone"),
  homeTeamId: excluded("home_team_id"),
  awayTeamId: excluded("away_team_id"),
  notes: excluded("notes"),
  attendance: excluded("attendance"),
  homeAudioUrl: excluded("home_audio_url"),
  awayAudioUrl: excluded("away_audio_url"),
  videoUrl: excluded("video_url"),
};

async function upsertGames(db: Db, feed: ht.FeedGame[], set: Record<string, unknown>): Promise<void> {
  const rows = feed.map((g) => ({ ...g, gameType: g.season === SEASON ? GAME_TYPE.regular : GAME_TYPE.playoffs, updatedAt: new Date() }));
  for (let i = 0; i < rows.length; i += 200) {
    await db.insert(games).values(rows.slice(i, i + 200)).onConflictDoUpdate({ target: games.id, set });
  }
}

/** Every game of the season in one call. Re-run nightly: postponements move. */
export async function ingestSchedule(db: Db): Promise<number> {
  const feed = await ht.fetchSchedule();
  await upsertGames(db, feed, SCHEDULE_COLUMNS);
  log(`schedule: ${feed.length} games`);
  return feed.length;
}

/** Recent and upcoming games from the live scoreboard: state, period, clock, score. */
export async function ingestScores(db: Db): Promise<number> {
  const feed = await ht.fetchScorebar();
  await upsertGames(db, feed, LIVE_COLUMNS);
  log(`scores: ${feed.length} games`);
  return feed.length;
}
