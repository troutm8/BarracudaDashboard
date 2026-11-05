import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { goalieSeasonStats, skaterSeasonStats, standingsSnapshots, teamSeasonStats } from "@/db/schema";
import { SEASON, todayPacific } from "@/lib/season";
import * as ht from "../sources/hockeytech";
import { log, numStr, teamIdByAbbrev } from "./common";

const record = (r: { wins: number; losses: number; ot_losses: number; shootout_losses: number } | undefined) => (r ? `${r.wins}-${r.losses}-${r.ot_losses}-${r.shootout_losses}` : null);

/** Today's standings. The feed has no history, so each day's snapshot is the only record of it. */
export async function ingestStandings(db: Db, date = todayPacific()): Promise<number> {
  const ids = await teamIdByAbbrev(db);
  const overall = await ht.fetchStandings("overall");
  const home = new Map((await ht.fetchStandings("home")).map((r) => [r.row.team_code, r.row]));
  const road = new Map((await ht.fetchStandings("visiting")).map((r) => [r.row.team_code, r.row]));
  const rows = [];
  for (const { row: r } of overall) {
    const teamId = ids.get(r.team_code);
    if (!teamId) {
      log(`standings: unknown team ${r.team_code}`);
      continue;
    }
    rows.push({
      date,
      teamId,
      season: SEASON,
      gamesPlayed: r.games_played,
      gamesRemaining: r.games_remaining,
      wins: r.wins,
      losses: r.losses,
      otLosses: r.ot_losses,
      soLosses: r.shootout_losses,
      points: r.points,
      pointPctg: numStr(r.percentage),
      regulationWins: r.regulation_wins,
      regulationPlusOtWins: r.row,
      goalsFor: r.goals_for,
      goalsAgainst: r.goals_against,
      goalDifferential: r.goals_for != null && r.goals_against != null ? r.goals_for - r.goals_against : null,
      pim: r.penalty_minutes,
      home: record(home.get(r.team_code)),
      road: record(road.get(r.team_code)),
      l10: r.past_10,
      divisionRank: r.rank,
      leagueRank: r.overall_rank,
    });
  }
  await db.delete(standingsSnapshots).where(eq(standingsSnapshots.date, date));
  if (rows.length) await db.insert(standingsSnapshots).values(rows);
  log(`standings ${date}: ${rows.length} teams`);
  return rows.length;
}

/** League skater and goalie lines, then team numbers built from them and the special-teams table. */
export async function ingestStats(db: Db, season = SEASON): Promise<number> {
  const date = todayPacific();
  const [skaters, goalies, special] = [await ht.fetchSkaters(season), await ht.fetchGoalies(season), await ht.fetchSpecialTeams(season)];

  const skaterRows = skaters.map(({ row: r }) => ({
    season,
    playerId: r.player_id,
    snapshotDate: date,
    fullName: r.name,
    teamAbbrev: r.team_code,
    position: r.position,
    rookie: r.rookie,
    gamesPlayed: r.games_played,
    goals: r.goals,
    assists: r.assists,
    points: r.points,
    plusMinus: r.plus_minus,
    pim: r.penalty_minutes,
    ppGoals: r.power_play_goals,
    ppAssists: r.power_play_assists,
    shGoals: r.short_handed_goals,
    gwGoals: r.game_winning_goals,
    otGoals: r.overtime_goals,
    shots: r.shots,
    shootingPct: numStr(r.shooting_percentage),
    shootoutGoals: r.shootout_goals,
    shootoutAttempts: r.shootout_attempts,
  }));
  await db.delete(skaterSeasonStats).where(and(eq(skaterSeasonStats.season, season), eq(skaterSeasonStats.snapshotDate, date)));
  for (let i = 0; i < skaterRows.length; i += 200) await db.insert(skaterSeasonStats).values(skaterRows.slice(i, i + 200));

  const goalieRows = goalies.map(({ row: r }) => ({
    season,
    playerId: r.player_id,
    snapshotDate: date,
    fullName: r.name,
    teamAbbrev: r.team_code,
    rookie: r.rookie,
    gamesPlayed: r.games_played,
    wins: r.wins,
    losses: r.losses,
    otLosses: r.ot_losses,
    shotsAgainst: r.shots,
    saves: r.saves,
    goalsAgainst: r.goals_against,
    gaa: numStr(r.goals_against_average),
    savePct: numStr(r.save_percentage),
    shutouts: r.shutouts,
    minutes: r.minutes_played == null ? null : Math.round(Number(String(r.minutes_played).split(":")[0])),
  }));
  await db.delete(goalieSeasonStats).where(and(eq(goalieSeasonStats.season, season), eq(goalieSeasonStats.snapshotDate, date)));
  if (goalieRows.length) await db.insert(goalieSeasonStats).values(goalieRows);

  // Team shots, summed from the player tables. Exact for the team a skater played all season for;
  // a traded skater's shots follow him, and goalies do not face empty-net shots.
  const sum = (rows: { teamAbbrev: string | null; n: number | null }[]) => {
    const out = new Map<string, number>();
    for (const r of rows) if (r.teamAbbrev) out.set(r.teamAbbrev, (out.get(r.teamAbbrev) ?? 0) + (r.n ?? 0));
    return out;
  };
  const shotsFor = sum(skaterRows.map((r) => ({ teamAbbrev: r.teamAbbrev, n: r.shots })));
  const shotsAgainst = sum(goalieRows.map((r) => ({ teamAbbrev: r.teamAbbrev, n: r.shotsAgainst })));

  const ids = await teamIdByAbbrev(db);
  const teamRows = special.flatMap(({ row: r }) => {
    const teamId = ids.get(r.team_code);
    if (!teamId) return [];
    return [
      {
        season,
        teamId,
        snapshotDate: date,
        gamesPlayed: r.games_played,
        ppPct: numStr(ht.pctOf(r.power_play_pct)),
        pkPct: numStr(ht.pctOf(r.penalty_kill_pct)),
        ppGoals: r.power_play_goals,
        ppOpps: r.power_plays,
        ppGoalsAgainst: r.power_play_goals_against,
        timesShorthanded: r.times_short_handed,
        shGoalsFor: r.short_handed_goals_for,
        shGoalsAgainst: r.short_handed_goals_against,
        shotsFor: shotsFor.get(r.team_code) ?? null,
        shotsAgainst: shotsAgainst.get(r.team_code) ?? null,
      },
    ];
  });
  await db.delete(teamSeasonStats).where(and(eq(teamSeasonStats.season, season), eq(teamSeasonStats.snapshotDate, date)));
  if (teamRows.length) await db.insert(teamSeasonStats).values(teamRows);

  log(`stats: ${skaterRows.length} skaters, ${goalieRows.length} goalies, ${teamRows.length} teams (${date})`);
  return skaterRows.length + goalieRows.length + teamRows.length;
}
