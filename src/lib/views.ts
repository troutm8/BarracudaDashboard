import type { Game, Team } from "@/db/schema";
import { statusOf, type GameStatus } from "./season";

export type TeamView = {
  id: number;
  abbrev: string;
  name: string;
  commonName: string;
  placeName: string;
  logo: string | null;
  division: string | null;
};

export type GameView = {
  id: number;
  season: number;
  gameType: number;
  gameDate: string;
  startTime: string | null;
  status: GameStatus;
  gameState: string;
  scheduleState: string | null;
  notes: string | null;
  period: number | null;
  periodType: string | null;
  clock: string | null;
  inIntermission: boolean | null;
  lastPeriodType: string | null;
  home: TeamView;
  away: TeamView;
  homeScore: number | null;
  awayScore: number | null;
  homeSog: number | null;
  awaySog: number | null;
  venue: string | null;
  attendance: number | null;
  homeAudioUrl: string | null;
  awayAudioUrl: string | null;
  videoUrl: string | null;
  hasBoxscore: boolean;
};

export type GameWithTeams = Game & { home: Team; away: Team };

export function teamView(t: Team): TeamView {
  return {
    id: t.id,
    abbrev: t.abbrev,
    name: t.name,
    commonName: t.commonName,
    placeName: t.placeName,
    logo: t.logoUrl,
    division: t.division,
  };
}

export function gameView(g: GameWithTeams): GameView {
  return {
    id: g.id,
    season: g.season,
    gameType: g.gameType,
    gameDate: g.gameDate,
    startTime: g.startTimeUtc ? g.startTimeUtc.toISOString() : null,
    status: statusOf(g.gameState),
    gameState: g.gameState,
    scheduleState: g.scheduleState,
    notes: g.notes,
    period: g.period,
    periodType: g.periodType,
    clock: g.clock,
    inIntermission: g.inIntermission,
    lastPeriodType: g.lastPeriodType,
    home: teamView(g.home),
    away: teamView(g.away),
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    homeSog: g.homeSog,
    awaySog: g.awaySog,
    venue: g.venue,
    attendance: g.attendance,
    homeAudioUrl: g.homeAudioUrl,
    awayAudioUrl: g.awayAudioUrl,
    videoUrl: g.videoUrl,
    hasBoxscore: g.boxscoreLoaded,
  };
}

/** Sort key: featured team first, then live games, then by start time. */
export function sortForFeatured(views: GameView[], featuredId: number): GameView[] {
  const score = (g: GameView) => {
    let s = 0;
    if (g.home.id === featuredId || g.away.id === featuredId) s -= 1000;
    if (g.status === "live") s -= 100;
    return s;
  };
  return [...views].sort((a, b) => score(a) - score(b) || (a.startTime ?? "").localeCompare(b.startTime ?? ""));
}

export function involves(g: { home: { id: number }; away: { id: number } } | { homeTeamId: number; awayTeamId: number }, teamId: number): boolean {
  if ("home" in g) return g.home.id === teamId || g.away.id === teamId;
  return g.homeTeamId === teamId || g.awayTeamId === teamId;
}
