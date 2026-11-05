import { and, desc, eq, gte, inArray, lte, or } from "drizzle-orm";
import { db } from "@/db/client";
import {
  gameEvents,
  gameGoalieStats,
  gameSkaterStats,
  games,
  goalieSeasonStats,
  ingestRuns,
  oddsSnapshots,
  players,
  skaterSeasonStats,
  standingsSnapshots,
  teamSeasonStats,
  teams,
  transactions,
  type Game,
  type Team,
} from "@/db/schema";
import { SEASON, TEAM_ID } from "./season";
import type { GameWithTeams } from "./views";

export async function getTeams(): Promise<Team[]> {
  const d = await db();
  return d.select().from(teams).orderBy(teams.name);
}

export async function getTeamMap(): Promise<Map<number, Team>> {
  return new Map((await getTeams()).map((t) => [t.id, t]));
}

export async function getTeam(id: number): Promise<Team | null> {
  const d = await db();
  const [t] = await d.select().from(teams).where(eq(teams.id, id));
  return t ?? null;
}

export async function getFeaturedTeam(): Promise<Team | null> {
  return getTeam(TEAM_ID);
}

export async function attachTeams(rows: Game[]): Promise<GameWithTeams[]> {
  if (!rows.length) return [];
  const d = await db();
  const ids = [...new Set(rows.flatMap((g) => [g.homeTeamId, g.awayTeamId]))];
  const ts = await d.select().from(teams).where(inArray(teams.id, ids));
  const byId = new Map(ts.map((t) => [t.id, t]));
  return rows.map((g) => ({ ...g, home: byId.get(g.homeTeamId)!, away: byId.get(g.awayTeamId)! }));
}

export async function getGamesByDate(ymd: string): Promise<GameWithTeams[]> {
  const d = await db();
  const rows = await d.select().from(games).where(eq(games.gameDate, ymd)).orderBy(games.startTimeUtc, games.id);
  return attachTeams(rows);
}

export async function getGamesInRange(from: string, to: string): Promise<GameWithTeams[]> {
  const d = await db();
  const rows = await d
    .select()
    .from(games)
    .where(and(gte(games.gameDate, from), lte(games.gameDate, to)))
    .orderBy(games.gameDate, games.startTimeUtc);
  return attachTeams(rows);
}

/** All of a team's games this season, chronological. */
export async function getTeamGames(teamId = TEAM_ID, season = SEASON): Promise<GameWithTeams[]> {
  const d = await db();
  const rows = await d
    .select()
    .from(games)
    .where(and(eq(games.season, season), or(eq(games.homeTeamId, teamId), eq(games.awayTeamId, teamId))))
    .orderBy(games.gameDate, games.startTimeUtc);
  return attachTeams(rows);
}

/** Every finished regular-season game league-wide, for records and streaks. */
export async function getAllFinals(season = SEASON): Promise<Game[]> {
  const d = await db();
  return d
    .select()
    .from(games)
    .where(and(eq(games.season, season), eq(games.gameType, 2), eq(games.gameState, "FINAL")))
    .orderBy(games.gameDate, games.startTimeUtc);
}

export async function getGame(id: number) {
  const d = await db();
  const [g] = await d.select().from(games).where(eq(games.id, id));
  if (!g) return null;
  const [withTeams] = await attachTeams([g]);
  const [skaters, goalies, events] = await Promise.all([
    d.select().from(gameSkaterStats).where(eq(gameSkaterStats.gameId, id)).orderBy(desc(gameSkaterStats.points), desc(gameSkaterStats.goals), gameSkaterStats.name),
    d.select().from(gameGoalieStats).where(eq(gameGoalieStats.gameId, id)).orderBy(desc(gameGoalieStats.starter)),
    d.select().from(gameEvents).where(eq(gameEvents.gameId, id)).orderBy(gameEvents.eventId),
  ]);
  return { game: withTeams, skaters, goalies, events };
}

export async function getLatestStandings(): Promise<{ date: string; rows: (typeof standingsSnapshots.$inferSelect)[] } | null> {
  const d = await db();
  const [latest] = await d.select({ date: standingsSnapshots.date }).from(standingsSnapshots).orderBy(desc(standingsSnapshots.date)).limit(1);
  if (!latest) return null;
  const rows = await d.select().from(standingsSnapshots).where(eq(standingsSnapshots.date, latest.date)).orderBy(standingsSnapshots.leagueRank);
  return { date: latest.date, rows };
}

export async function getLatestOdds(): Promise<{ date: string; rows: (typeof oddsSnapshots.$inferSelect)[] } | null> {
  const d = await db();
  const [latest] = await d.select({ date: oddsSnapshots.date }).from(oddsSnapshots).orderBy(desc(oddsSnapshots.date)).limit(1);
  if (!latest) return null;
  const rows = await d.select().from(oddsSnapshots).where(eq(oddsSnapshots.date, latest.date)).orderBy(desc(oddsSnapshots.madePlayoffs));
  return { date: latest.date, rows };
}

export async function getOddsHistory(teamId = TEAM_ID) {
  const d = await db();
  return d.select().from(oddsSnapshots).where(eq(oddsSnapshots.teamId, teamId)).orderBy(oddsSnapshots.date);
}

export async function getPlayer(id: number) {
  const d = await db();
  const [p] = await d.select().from(players).where(eq(players.id, id));
  return p ?? null;
}

/** A player's game-by-game line from the box scores we hold (Barracuda games only). */
export async function getPlayerGameLog(playerId: number) {
  const d = await db();
  const skater = await d
    .select({ s: gameSkaterStats, g: games })
    .from(gameSkaterStats)
    .innerJoin(games, eq(games.id, gameSkaterStats.gameId))
    .where(eq(gameSkaterStats.playerId, playerId))
    .orderBy(games.gameDate);
  const goalie = await d
    .select({ s: gameGoalieStats, g: games })
    .from(gameGoalieStats)
    .innerJoin(games, eq(games.id, gameGoalieStats.gameId))
    .where(eq(gameGoalieStats.playerId, playerId))
    .orderBy(games.gameDate);
  const withTeams = await attachTeams([...skater.map((r) => r.g), ...goalie.map((r) => r.g)]);
  const gm = new Map(withTeams.map((g) => [g.id, g]));
  return { skater: skater.map((r) => ({ ...r.s, game: gm.get(r.g.id)! })), goalie: goalie.map((r) => ({ ...r.s, game: gm.get(r.g.id)! })) };
}

export async function getLatestSkaterSeason(season = SEASON) {
  const d = await db();
  const [latest] = await d.select({ date: skaterSeasonStats.snapshotDate }).from(skaterSeasonStats).where(eq(skaterSeasonStats.season, season)).orderBy(desc(skaterSeasonStats.snapshotDate)).limit(1);
  if (!latest) return null;
  const rows = await d
    .select()
    .from(skaterSeasonStats)
    .where(and(eq(skaterSeasonStats.season, season), eq(skaterSeasonStats.snapshotDate, latest.date)))
    .orderBy(desc(skaterSeasonStats.points), desc(skaterSeasonStats.goals));
  return { date: latest.date, rows };
}

export async function getLatestGoalieSeason(season = SEASON) {
  const d = await db();
  const [latest] = await d.select({ date: goalieSeasonStats.snapshotDate }).from(goalieSeasonStats).where(eq(goalieSeasonStats.season, season)).orderBy(desc(goalieSeasonStats.snapshotDate)).limit(1);
  if (!latest) return null;
  const rows = await d
    .select()
    .from(goalieSeasonStats)
    .where(and(eq(goalieSeasonStats.season, season), eq(goalieSeasonStats.snapshotDate, latest.date)))
    .orderBy(desc(goalieSeasonStats.wins));
  return { date: latest.date, rows };
}

export async function getLatestTeamSeason(season = SEASON) {
  const d = await db();
  const [latest] = await d.select({ date: teamSeasonStats.snapshotDate }).from(teamSeasonStats).where(eq(teamSeasonStats.season, season)).orderBy(desc(teamSeasonStats.snapshotDate)).limit(1);
  if (!latest) return null;
  const rows = await d.select().from(teamSeasonStats).where(and(eq(teamSeasonStats.season, season), eq(teamSeasonStats.snapshotDate, latest.date)));
  return { date: latest.date, rows };
}

/** Shots and goals across every stored game a team was in, for season shot maps. */
export async function getTeamShotEvents(teamId = TEAM_ID) {
  const d = await db();
  return d
    .select({ e: gameEvents, gameDate: games.gameDate })
    .from(gameEvents)
    .innerJoin(games, eq(games.id, gameEvents.gameId))
    .where(and(eq(games.gameType, 2), or(eq(games.homeTeamId, teamId), eq(games.awayTeamId, teamId))))
    .orderBy(games.gameDate, gameEvents.eventId);
}

/** One player's shots across stored games. */
export async function getPlayerShotEvents(playerId: number) {
  const d = await db();
  return d
    .select({ e: gameEvents, gameDate: games.gameDate })
    .from(gameEvents)
    .innerJoin(games, eq(games.id, gameEvents.gameId))
    .where(eq(gameEvents.player1Id, playerId))
    .orderBy(games.gameDate, gameEvents.eventId);
}

/** Players linked to a team (current roster first), for the roster page. */
export async function getTeamPlayers(teamId = TEAM_ID) {
  const d = await db();
  return d.select().from(players).where(eq(players.teamId, teamId)).orderBy(desc(players.onRoster), players.lastName);
}

export async function getTransactions(limit?: number) {
  const d = await db();
  const q = d.select().from(transactions).orderBy(desc(transactions.date), transactions.playerName);
  return limit ? q.limit(limit) : q;
}

/** Which of these ids have a player page. */
export async function getKnownPlayerIds(ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const d = await db();
  const rows = await d.select({ id: players.id }).from(players).where(inArray(players.id, ids));
  return new Set(rows.map((r) => r.id));
}

export async function getLastIngest(): Promise<Date | null> {
  const d = await db();
  const [r] = await d.select({ t: ingestRuns.finishedAt }).from(ingestRuns).where(eq(ingestRuns.ok, true)).orderBy(desc(ingestRuns.finishedAt)).limit(1);
  return r?.t ?? null;
}
