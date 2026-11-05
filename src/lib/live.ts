/** Shapes served by /api/live and merged into server-rendered views on the client. Pure; tested. */
import type { GameSummary } from "@/db/schema";
import { statusOf, type GameStatus } from "./season";
import type { GameView } from "./views";

export type LiveGame = {
  id: number;
  gameState: string;
  status: GameStatus;
  period: number | null;
  periodType: string | null;
  clock: string | null;
  inIntermission: boolean | null;
  homeScore: number | null;
  awayScore: number | null;
  homeSog: number | null;
  awaySog: number | null;
  lastPeriodType: string | null;
};

export type LiveDay = { fetchedAt: string; date: string; games: LiveGame[] };
export type LiveGameDetail = { fetchedAt: string; game: LiveGame; summary: GameSummary };

export function liveFromFeed(
  g: {
    id: number;
    gameState: string;
    period: number | null;
    periodType: string | null;
    clock: string | null;
    inIntermission: boolean | null;
    homeScore: number | null;
    awayScore: number | null;
    lastPeriodType: string | null;
  },
  shots?: { home: number | null; away: number | null },
): LiveGame {
  return {
    id: g.id,
    gameState: g.gameState,
    status: statusOf(g.gameState),
    period: g.period,
    periodType: g.periodType,
    clock: g.clock,
    inIntermission: g.inIntermission,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    homeSog: shots?.home ?? null,
    awaySog: shots?.away ?? null,
    lastPeriodType: g.lastPeriodType,
  };
}

export function mergeLive(g: GameView, live: LiveGame): GameView {
  return {
    ...g,
    gameState: live.gameState,
    status: live.status,
    period: live.period ?? g.period,
    periodType: live.periodType ?? g.periodType,
    clock: live.clock,
    inIntermission: live.inIntermission,
    homeScore: live.homeScore ?? g.homeScore,
    awayScore: live.awayScore ?? g.awayScore,
    homeSog: live.homeSog ?? g.homeSog,
    awaySog: live.awaySog ?? g.awaySog,
    lastPeriodType: live.lastPeriodType ?? g.lastPeriodType,
  };
}

const LIVE_POLL_MS = 20_000;
/** A game this long past its start that never went live was postponed or the feed is stuck. */
const STALE_START_MS = 6 * 3_600_000;

/** How often the client should ask again, in ms, or 0 to stop. */
export function pollInterval(games: { status: GameStatus; startTime: string | null }[], now = Date.now()): number {
  if (games.some((g) => g.status === "live")) return LIVE_POLL_MS;
  const upcoming = games.filter((g) => g.status === "pre" && g.startTime && Date.parse(g.startTime) > now - STALE_START_MS);
  if (!upcoming.length) return 0;
  const soonest = Math.min(...upcoming.map((g) => Date.parse(g.startTime!)));
  // Within 15 minutes of a start, or past it (the feed flips to live a little late), poll like a live game.
  if (soonest - now < 15 * 60_000) return LIVE_POLL_MS;
  return 5 * 60_000;
}
