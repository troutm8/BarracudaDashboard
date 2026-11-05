import { and, eq, or } from "drizzle-orm";
import type { Db } from "@/db/client";
import { gameEvents, gameGoalieStats, gameSkaterStats, games, players, type GameSummary, type GoalSummary, type PenaltySummary } from "@/db/schema";
import { TEAM_ID } from "@/lib/season";
import * as ht from "../sources/hockeytech";
import { log, numStr, toiSeconds } from "./common";

const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.trim();

function periodKind(id: string, shortName: string | null): { number: number; type: string } {
  const number = Number(id);
  if (shortName === "SO") return { number, type: "SO" };
  return { number, type: number > 3 ? "OT" : "REG" };
}

/** "9:12" as seconds, for putting a period's goals in order. */
const clockSeconds = (t: string) => t.split(":").reduce((a, b) => a * 60 + Number(b), 0);

/** Turn the feed's game summary into the compact shape stored on the game row. */
export function summaryOf(s: ht.GameSummaryFeed): GameSummary {
  const homeId = s.homeTeam.info.id;
  const goals: GoalSummary[] = [];
  const penalties: PenaltySummary[] = [];
  let homeScore = 0;
  let awayScore = 0;
  for (const p of s.periods) {
    const { number, type } = periodKind(p.info.id, p.info.shortName);
    for (const g of [...p.goals].sort((a, b) => clockSeconds(a.time) - clockSeconds(b.time))) {
      if (g.team.id === homeId) homeScore++;
      else awayScore++;
      const pr = g.properties;
      goals.push({
        period: number,
        periodType: type,
        timeInPeriod: g.time,
        teamAbbrev: g.team.abbreviation,
        strength: pr.isPenaltyShot ? "ps" : pr.isEmptyNet ? "en" : pr.isPowerPlay ? "pp" : pr.isShortHanded ? "sh" : "ev",
        playerId: g.scoredBy.id,
        scorer: fullName(g.scoredBy),
        goalsToDate: g.scorerGoalNumber,
        assists: g.assists.map((a, i) => ({ playerId: a.id, name: fullName(a), assistsToDate: Number(g.assistNumbers[i]) || null })),
        homeScore,
        awayScore,
        gameWinner: pr.isGameWinningGoal,
      });
    }
    for (const x of p.penalties) {
      penalties.push({
        period: number,
        periodType: type,
        timeInPeriod: x.time,
        teamAbbrev: x.againstTeam.abbreviation,
        minutes: x.minutes,
        description: x.description,
        committedBy: x.takenBy ? fullName(x.takenBy) : null,
        servedBy: x.servedBy ? fullName(x.servedBy) : null,
        bench: x.isBench ?? false,
      });
    }
  }
  const totals = (side: ht.GameSummaryFeed["homeTeam"]) => ({
    shots: side.stats.shots ?? 0,
    goals: side.stats.goals ?? 0,
    ppGoals: side.stats.powerPlayGoals ?? 0,
    ppOpps: side.stats.powerPlayOpportunities ?? 0,
    pim: side.stats.penaltyMinuteCount ?? 0,
  });
  const so = s.shootoutDetails;
  return {
    goals,
    penalties,
    threeStars: s.mostValuablePlayers.map((m, i) => ({
      star: i + 1,
      playerId: m.player.info.id,
      teamAbbrev: m.team.abbreviation,
      name: fullName(m.player.info),
      sweaterNumber: m.player.info.jerseyNumber,
      position: m.player.info.position ?? "",
      goals: m.player.stats.goals,
      assists: m.player.stats.assists,
      points: m.player.stats.points,
      saves: m.player.stats.saves,
      goalsAgainst: m.player.stats.goalsAgainst,
      isGoalie: m.isGoalie ?? false,
    })),
    periods: s.periods.map((p) => {
      const { number, type } = periodKind(p.info.id, p.info.shortName);
      return {
        number,
        type,
        label: p.info.longName ?? p.info.id,
        homeGoals: p.stats.homeGoals ?? 0,
        awayGoals: p.stats.visitingGoals ?? 0,
        homeShots: p.stats.homeShots ?? 0,
        awayShots: p.stats.visitingShots ?? 0,
      };
    }),
    shootout: s.hasShootout && so
      ? [...so.visitingTeamShots, ...so.homeTeamShots].map((x) => ({
          teamAbbrev: x.shooterTeam.abbreviation,
          playerId: x.shooter.id,
          shooter: fullName(x.shooter),
          goalie: fullName(x.goalie),
          scored: x.isGoal,
          winner: x.isGameWinningGoal ?? false,
        }))
      : [],
    home: totals(s.homeTeam),
    away: totals(s.visitingTeam),
    officials: [...s.referees, ...s.linesmen].map(fullName),
  };
}

/** The feed's shots sit on a 600 by 300 grid; store rink feet from centre ice. */
export function rinkCoords(x: number | null, y: number | null): { x: number | null; y: number | null } {
  if (x == null || y == null) return { x: null, y: null };
  return { x: Math.round((x - 300) / 3), y: Math.round(((150 - y) * 85) / 300) };
}

export function eventRow(gameId: number, eventId: number, e: ht.PbpShot) {
  const d = e.details;
  return {
    gameId,
    eventId,
    period: Number(d.period.id),
    timeInPeriod: d.time,
    typeDescKey: d.isGoal ? "goal" : "shot-on-goal",
    teamId: d.shooterTeamId,
    ...rinkCoords(d.xLocation, d.yLocation),
    quality: d.shotQuality == null ? null : !/^non/i.test(d.shotQuality),
    player1Id: d.shooter.id,
    goalieId: d.goalie?.id || null,
  };
}

/** A goalie's decision. Relief goalies can log several rows, and only played goalies appear. */
export function decisionOf(log: { info: { id: number }; result: string | null }[], playerId: number): string | null {
  return log.filter((l) => l.info.id === playerId).map((l) => l.result).find((r) => !!r) ?? null;
}

/** Box score, summary and shots for one game. Idempotent. */
export async function loadGame(db: Db, gameId: number): Promise<void> {
  const [summary, shots] = await Promise.all([ht.fetchGameSummary(gameId), ht.fetchPlayByPlay(gameId)]);
  const sides = [summary.homeTeam, summary.visitingTeam];

  for (const side of sides) {
    for (const p of [...side.skaters, ...side.goalies]) {
      const row = { firstName: p.info.firstName, lastName: p.info.lastName, position: p.info.position, sweaterNumber: p.info.jerseyNumber, teamId: side.info.id, headshotUrl: ht.headshotUrl(p.info.id) };
      await db
        .insert(players)
        .values({ id: p.info.id, ...row })
        .onConflictDoUpdate({ target: players.id, set: { firstName: row.firstName, lastName: row.lastName, updatedAt: new Date() } });
    }
  }

  await db.delete(gameSkaterStats).where(eq(gameSkaterStats.gameId, gameId));
  await db.delete(gameGoalieStats).where(eq(gameGoalieStats.gameId, gameId));
  for (const side of sides) {
    const teamId = side.info.id;
    const skaters = side.skaters.map((s) => ({
      gameId,
      playerId: s.info.id,
      teamId,
      name: fullName(s.info),
      sweaterNumber: s.info.jerseyNumber,
      position: s.info.position,
      goals: s.stats.goals,
      assists: s.stats.assists,
      points: s.stats.points,
      plusMinus: s.stats.plusMinus,
      pim: s.stats.penaltyMinutes,
      sog: s.stats.shots,
    }));
    if (skaters.length) await db.insert(gameSkaterStats).values(skaters);
    // The dressed backup is listed too, with no ice time.
    const goalies = side.goalies
      .filter((g) => g.stats.timeOnIce && g.stats.timeOnIce !== "0:00")
      .map((g) => {
        const shotsAgainst = g.stats.shotsAgainst ?? 0;
        return {
          gameId,
          playerId: g.info.id,
          teamId,
          name: fullName(g.info),
          sweaterNumber: g.info.jerseyNumber,
          starter: g.starting,
          decision: decisionOf(side.goalieLog, g.info.id),
          shotsAgainst,
          saves: g.stats.saves,
          goalsAgainst: g.stats.goalsAgainst,
          savePctg: shotsAgainst ? numStr((g.stats.saves ?? 0) / shotsAgainst) : null,
          toiSeconds: toiSeconds(g.stats.timeOnIce),
        };
      });
    if (goalies.length) await db.insert(gameGoalieStats).values(goalies);
  }

  await db.delete(gameEvents).where(eq(gameEvents.gameId, gameId));
  const events = shots.map((e, i) => eventRow(gameId, i + 1, e));
  for (let i = 0; i < events.length; i += 200) await db.insert(gameEvents).values(events.slice(i, i + 200));

  await db
    .update(games)
    .set({
      summary: summaryOf(summary),
      homeSog: summary.homeTeam.stats.shots,
      awaySog: summary.visitingTeam.stats.shots,
      attendance: summary.details.attendance || null,
      boxscoreLoaded: true,
      pbpLoaded: true,
      updatedAt: new Date(),
    })
    .where(eq(games.id, gameId));
}

/** Load every finished featured-team game that lacks a box score. */
export async function ingestBoxscores(db: Db, opts: { limit?: number; refresh?: boolean; game?: number; teamId?: number } = {}): Promise<number> {
  const teamId = opts.teamId ?? TEAM_ID;
  const conds = [eq(games.gameState, "FINAL"), or(eq(games.homeTeamId, teamId), eq(games.awayTeamId, teamId))!];
  if (opts.game) conds.push(eq(games.id, opts.game));
  else if (!opts.refresh) conds.push(eq(games.boxscoreLoaded, false));
  const pending = await db
    .select({ id: games.id, gameDate: games.gameDate })
    .from(games)
    .where(and(...conds))
    .orderBy(games.gameDate);
  const list = opts.limit ? pending.slice(0, opts.limit) : pending;
  log(`boxscores: ${list.length} to load`);
  let n = 0;
  for (const g of list) {
    try {
      await loadGame(db, g.id);
      n++;
      log(`boxscore ${g.id} (${g.gameDate}) loaded`);
    } catch (err) {
      log(`boxscore ${g.id} failed:`, (err as Error).message);
    }
  }
  return n;
}
