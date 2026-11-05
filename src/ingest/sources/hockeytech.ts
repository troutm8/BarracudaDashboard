/**
 * HockeyTech's LeagueStat feed, which theahl.com itself renders from. Undocumented.
 *
 * The key is the one the AHL's public stats widget serves to every visitor, not a credential
 * issued to us. Keep requests gentle and server-side.
 *
 * Schemas are permissive: Zod strips unknown keys and everything we do not render is optional,
 * so an upstream addition never breaks ingestion while a removal of a field we rely on fails
 * loudly here rather than silently in the UI. Almost every number arrives as a string.
 */
import { z } from "zod";
import { fetchText } from "../http";
import { SEASON, TEAM_ID } from "@/lib/season";

export const HOCKEYTECH_BASE = (process.env.HOCKEYTECH_BASE ?? "https://lscluster.hockeytech.com/feed/index.php").replace(/\/$/, "");
const KEY = process.env.HOCKEYTECH_KEY || "ccb91f29d6744675";
const ASSETS = "https://assets.leaguestat.com/ahl";

export function feedUrl(params: Record<string, string | number>): string {
  const q = new URLSearchParams({ key: KEY, client_code: "ahl", site_id: "3", league_id: "4", lang: "en" });
  for (const [k, v] of Object.entries(params)) q.set(k, String(v));
  return `${HOCKEYTECH_BASE}?${q.toString()}`;
}

/** statviewfeed answers with JSON wrapped in parentheses; modulekit answers with plain JSON. */
export function parseFeed(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t.startsWith("(") && t.endsWith(")") ? t.slice(1, -1) : t);
  } catch {
    throw new Error(`Non-JSON response from the feed: ${t.slice(0, 120)}`);
  }
}

async function feed(params: Record<string, string | number>): Promise<unknown> {
  return parseFeed(await fetchText(feedUrl(params)));
}

const num = z.coerce.number();
/** A number, or null for "", null or missing. */
const numOpt = z
  .union([z.string(), z.number()])
  .nullable()
  .optional()
  .transform((v) => (v == null || v === "" ? null : Number(v)))
  .pipe(z.number().nullable());
/** A string, or null for "", null or missing. */
const strOpt = z
  .string()
  .nullable()
  .optional()
  .transform((v) => v || null);
/** "1" or 1 as true. */
const flag = z.union([z.string(), z.number(), z.boolean()]).nullable().optional().transform((v) => v === "1" || v === 1 || v === true);

/** The tabular views: rows sit at [0].sections[].data[].row, with links in .prop. */
function tableOf<T extends z.ZodTypeAny>(row: T) {
  return z
    .array(z.object({ sections: z.array(z.object({ title: z.string().nullable().optional(), data: z.array(z.object({ prop: z.any().optional(), row: z.record(z.string(), z.unknown()) })) })) }))
    .transform((pages) =>
      pages[0].sections.flatMap((section, sectionIndex) =>
        section.data.flatMap((d) => {
          const r = row.safeParse(d.row);
          return r.success ? [{ row: r.data as z.infer<T>, prop: d.prop as Record<string, Record<string, string>> | undefined, section: section.title ?? "", sectionIndex }] : [];
        }),
      ),
    );
}

// ----- teams --------------------------------------------------------------------------

export const bootstrapSchema = z.object({
  current_season_id: num,
  divisions: z.array(z.object({ id: z.string(), name: z.string() })),
  teamsNoAll: z.array(z.object({ id: num, name: z.string(), nickname: z.string(), team_code: z.string(), division_id: z.string(), logo: z.string().optional() })),
});

export function teamsOf(b: z.infer<typeof bootstrapSchema>) {
  const divisions = new Map(b.divisions.map((d) => [d.id, d.name.replace(/ Division$/, "")]));
  return b.teamsNoAll.map((t) => ({
    id: t.id,
    abbrev: t.team_code,
    name: t.name,
    commonName: t.nickname,
    placeName: t.name.endsWith(t.nickname) ? t.name.slice(0, -t.nickname.length).trim() : t.name,
    division: divisions.get(t.division_id) ?? null,
    logoUrl: t.logo ?? `${ASSETS}/logos/50x50/${t.id}.png`,
  }));
}

// ----- games --------------------------------------------------------------------------

/** One game, normalized from either the schedule or the scorebar. */
export type FeedGame = {
  id: number;
  season: number;
  gameDate: string;
  startTimeUtc: Date;
  venue: string | null;
  venueTimezone: string | null;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
  gameState: "FUT" | "LIVE" | "FINAL";
  scheduleState: string;
  notes: string | null;
  period: number | null;
  periodType: string | null;
  clock: string | null;
  inIntermission: boolean | null;
  lastPeriodType: string | null;
  attendance: number | null;
  homeAudioUrl: string | null;
  awayAudioUrl: string | null;
  videoUrl: string | null;
};

/** 1 not started, 4 final. Anything between is treated as in progress. */
export function gameStateOf(status: number): FeedGame["gameState"] {
  if (status === 4) return "FINAL";
  return status === 1 ? "FUT" : "LIVE";
}

/** "Final OT" and "Final SO" are the only place the feed says plainly how a game ended. */
export function lastPeriodTypeOf(statusText: string): string | null {
  if (!/final/i.test(statusText)) return null;
  if (/SO/.test(statusText)) return "SO";
  return /OT/.test(statusText) ? "OT" : "REG";
}

export function scheduleStateOf(statusText: string): string {
  if (/postpone/i.test(statusText)) return "PPD";
  return /cancel/i.test(statusText) ? "CNCL" : "OK";
}

/** "00:01:46" and "01:46" both to "1:46". */
export function clockOf(clock: string | null | undefined): string | null {
  if (!clock) return null;
  const parts = clock.split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  const [m, s] = parts.slice(-2);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function periodTypeOf(period: number | null, shortName?: string | null): string | null {
  if (period == null) return null;
  if (shortName === "SO" || shortName === "OT") return shortName;
  return period > 3 ? "OT" : "REG";
}

export const scheduleGame = z.object({
  game_id: num,
  season_id: num,
  date_played: z.string(),
  /** A true instant. `date_time_played` looks like UTC but is local time with a Z. */
  GameDateISO8601: z.string(),
  home_team: num,
  visiting_team: num,
  home_goal_count: numOpt,
  visiting_goal_count: numOpt,
  period: numOpt,
  period_trans: strOpt,
  game_clock: strOpt,
  status: num,
  game_status: z.string(),
  intermission: flag,
  schedule_notes: strOpt,
  attendance: numOpt,
  timezone: strOpt,
  venue_name: strOpt,
  home_audio_url: strOpt,
  visiting_audio_url: strOpt,
  flo_core_event_id: strOpt,
});

export function fromSchedule(g: z.infer<typeof scheduleGame>): FeedGame {
  const gameState = gameStateOf(g.status);
  const live = gameState === "LIVE";
  const started = gameState !== "FUT";
  return {
    id: g.game_id,
    season: g.season_id,
    gameDate: g.date_played,
    startTimeUtc: new Date(g.GameDateISO8601),
    venue: g.venue_name,
    venueTimezone: g.timezone,
    homeTeamId: g.home_team,
    awayTeamId: g.visiting_team,
    homeScore: started ? g.home_goal_count : null,
    awayScore: started ? g.visiting_goal_count : null,
    gameState,
    scheduleState: scheduleStateOf(g.game_status),
    notes: g.schedule_notes,
    period: started ? g.period : null,
    periodType: started ? periodTypeOf(g.period, g.period_trans) : null,
    clock: live ? clockOf(g.game_clock) : null,
    inIntermission: live ? g.intermission : null,
    lastPeriodType: lastPeriodTypeOf(g.game_status),
    attendance: g.attendance || null,
    homeAudioUrl: g.home_audio_url,
    awayAudioUrl: g.visiting_audio_url,
    videoUrl: g.flo_core_event_id ? `https://flohockey.tv/events/${g.flo_core_event_id}` : null,
  };
}

export const scorebarGame = z.object({
  ID: num,
  SeasonID: num,
  Date: z.string(),
  GameDateISO8601: z.string(),
  Timezone: strOpt,
  HomeID: num,
  VisitorID: num,
  HomeGoals: numOpt,
  VisitorGoals: numOpt,
  Period: numOpt,
  PeriodNameShort: strOpt,
  GameClock: strOpt,
  GameStatus: num,
  GameStatusStringLong: z.string(),
  Intermission: flag,
  venue_name: strOpt,
  HomeAudioUrl: strOpt,
  VisitorAudioUrl: strOpt,
  FloHockeyUrl: strOpt,
});
export type ScorebarGame = z.infer<typeof scorebarGame>;

export function fromScorebar(g: ScorebarGame): FeedGame {
  const gameState = gameStateOf(g.GameStatus);
  const live = gameState === "LIVE";
  const started = gameState !== "FUT";
  return {
    id: g.ID,
    season: g.SeasonID,
    gameDate: g.Date,
    startTimeUtc: new Date(g.GameDateISO8601),
    venue: g.venue_name,
    venueTimezone: g.Timezone,
    homeTeamId: g.HomeID,
    awayTeamId: g.VisitorID,
    homeScore: started ? g.HomeGoals : null,
    awayScore: started ? g.VisitorGoals : null,
    gameState,
    scheduleState: scheduleStateOf(g.GameStatusStringLong),
    notes: null,
    period: started ? g.Period : null,
    periodType: started ? periodTypeOf(g.Period, g.PeriodNameShort) : null,
    clock: live ? clockOf(g.GameClock) : null,
    inIntermission: live ? g.Intermission : null,
    lastPeriodType: lastPeriodTypeOf(g.GameStatusStringLong),
    attendance: null,
    homeAudioUrl: g.HomeAudioUrl,
    awayAudioUrl: g.VisitorAudioUrl,
    videoUrl: g.FloHockeyUrl,
  };
}

export const scheduleSchema = z.object({ SiteKit: z.object({ Schedule: z.array(scheduleGame) }) });
export const scorebarSchema = z.object({ SiteKit: z.object({ Scorebar: z.array(scorebarGame) }) });

// ----- standings and team stats -------------------------------------------------------

const standingsRow = z.object({
  team_code: z.string(),
  name: z.string(),
  games_played: num,
  games_remaining: numOpt,
  wins: num,
  losses: num,
  ot_losses: num,
  shootout_losses: num,
  points: num,
  percentage: numOpt,
  regulation_wins: numOpt,
  row: numOpt,
  goals_for: numOpt,
  goals_against: numOpt,
  penalty_minutes: numOpt,
  past_10: strOpt,
  rank: numOpt,
  overall_rank: numOpt,
});
export const standingsSchema = tableOf(standingsRow);

/** "25.9%" to 0.259. */
export function pctOf(s: unknown): number | null {
  if (typeof s !== "string" || s === "") return null;
  const n = Number(s.replace("%", ""));
  return Number.isFinite(n) ? n / 100 : null;
}

const specialTeamsRow = z.object({
  team_code: z.string(),
  games_played: num,
  power_play_goals: numOpt,
  power_play_goals_against: numOpt,
  short_handed_goals_for: numOpt,
  short_handed_goals_against: numOpt,
  power_play_pct: z.string().optional(),
  penalty_kill_pct: z.string().optional(),
  power_plays: numOpt,
  times_short_handed: numOpt,
});
export const specialTeamsSchema = tableOf(specialTeamsRow);

// ----- players ------------------------------------------------------------------------

const skaterRow = z.object({
  player_id: num,
  name: z.string(),
  position: strOpt,
  rookie: flag,
  team_code: strOpt,
  games_played: numOpt,
  goals: numOpt,
  assists: numOpt,
  points: numOpt,
  plus_minus: numOpt,
  penalty_minutes: numOpt,
  power_play_goals: numOpt,
  power_play_assists: numOpt,
  short_handed_goals: numOpt,
  game_winning_goals: numOpt,
  overtime_goals: numOpt,
  shots: numOpt,
  shooting_percentage: numOpt,
  shootout_goals: numOpt,
  shootout_attempts: numOpt,
});
export const skatersSchema = tableOf(skaterRow);
export type SkaterRow = z.infer<typeof skaterRow>;

const goalieRow = z.object({
  player_id: num,
  name: z.string(),
  rookie: flag,
  team_code: strOpt,
  games_played: numOpt,
  minutes_played: z.union([z.string(), z.number()]).nullable().optional(),
  saves: numOpt,
  shots: numOpt,
  save_percentage: numOpt,
  goals_against: numOpt,
  goals_against_average: numOpt,
  shutouts: numOpt,
  wins: numOpt,
  losses: numOpt,
  ot_losses: numOpt,
});
export const goaliesSchema = tableOf(goalieRow);
export type GoalieRow = z.infer<typeof goalieRow>;

const rosterRow = z.object({
  player_id: num,
  name: z.string(),
  position: z.string(),
  tp_jersey_number: numOpt,
  shoots: strOpt,
  catches: strOpt,
  height_hyphenated: strOpt,
  w: numOpt,
  birthdate: strOpt,
  birthplace: strOpt,
});
export const rosterSchema = z.object({ roster: tableOf(rosterRow) });
export type RosterRow = z.infer<typeof rosterRow>;

/** "6-1" to 73. */
export function heightInches(h: string | null | undefined): number | null {
  const m = h?.match(/^(\d+)-(\d+)$/);
  return m ? Number(m[1]) * 12 + Number(m[2]) : null;
}

export function headshotUrl(playerId: number): string {
  return `${ASSETS}/240x240/${playerId}.jpg`;
}

const careerRow = z.object({
  season_name: z.string(),
  team_name: strOpt,
  games_played: numOpt,
  goals: numOpt,
  assists: numOpt,
  points: numOpt,
  penalty_minutes: numOpt,
});
const draftRow = z.object({ draft_league: strOpt, draft_team: strOpt, draft_year: numOpt, draft_round: numOpt, draft_rank: numOpt });
export const playerSchema = z.object({
  info: z.object({ firstName: z.string(), lastName: z.string(), profileImage: strOpt }).loose(),
  careerStats: tableOf(careerRow),
  draftInfo: tableOf(draftRow).catch([]),
});

const transactionRow = z.object({ transaction_date: z.string(), player_name: z.string(), transaction_type: z.string(), transaction: z.string() });
export const transactionsSchema = tableOf(transactionRow);

/** "Libor Hájek (D)" to name and position. */
export function splitPlayerName(s: string): { name: string; position: string | null } {
  const m = s.match(/^(.*?)\s*\(([A-Z]+)\)$/);
  return m ? { name: m[1], position: m[2] } : { name: s, position: null };
}

// ----- one game -----------------------------------------------------------------------

const person = z.object({ id: num, firstName: z.string(), lastName: z.string(), jerseyNumber: numOpt, position: strOpt, birthDate: strOpt });
export type Person = z.infer<typeof person>;
const teamRef = z.object({ id: num, abbreviation: z.string() });
const period = z.object({ id: z.string(), shortName: strOpt, longName: strOpt });

const skaterLine = z.object({
  info: person,
  stats: z.object({ goals: numOpt, assists: numOpt, points: numOpt, penaltyMinutes: numOpt, plusMinus: numOpt, shots: numOpt }),
  starting: flag,
});
const goalieLine = z.object({
  info: person,
  stats: z.object({ timeOnIce: strOpt, shotsAgainst: numOpt, goalsAgainst: numOpt, saves: numOpt }),
  starting: flag,
});
const summarySide = z.object({
  info: teamRef.extend({ name: z.string().optional() }),
  stats: z.object({ shots: numOpt, goals: numOpt, powerPlayGoals: numOpt, powerPlayOpportunities: numOpt, penaltyMinuteCount: numOpt }),
  media: z.object({ audioUrl: strOpt, videoUrl: strOpt }).optional(),
  skaters: z.array(skaterLine),
  goalies: z.array(goalieLine),
  goalieLog: z.array(z.object({ info: person, result: strOpt })).optional().default([]),
});
const summaryGoal = z.object({
  team: teamRef,
  period,
  time: z.string(),
  scorerGoalNumber: numOpt,
  scoredBy: person,
  assists: z.array(person).optional().default([]),
  assistNumbers: z.array(z.union([z.string(), z.number()])).optional().default([]),
  properties: z.object({ isPowerPlay: flag, isShortHanded: flag, isEmptyNet: flag, isPenaltyShot: flag, isGameWinningGoal: flag }),
});
const summaryPenalty = z.object({
  period,
  time: z.string(),
  againstTeam: teamRef,
  minutes: numOpt,
  description: z.string(),
  takenBy: person.nullable().optional(),
  servedBy: person.nullable().optional(),
  isBench: z.boolean().optional(),
});
const shootoutShot = z.object({ shooter: person, goalie: person, isGoal: z.boolean(), isGameWinningGoal: z.boolean().optional(), shooterTeam: teamRef });
export const gameSummarySchema = z.object({
  details: z.object({ id: num, venue: strOpt, attendance: numOpt, status: strOpt, started: flag, final: flag, floHockeyUrl: strOpt }),
  referees: z.array(z.object({ firstName: z.string(), lastName: z.string() })).optional().default([]),
  linesmen: z.array(z.object({ firstName: z.string(), lastName: z.string() })).optional().default([]),
  mostValuablePlayers: z
    .array(
      z.object({
        team: teamRef,
        isGoalie: z.boolean().optional(),
        player: z.object({
          info: person,
          stats: z.object({ goals: numOpt, assists: numOpt, points: numOpt, saves: numOpt, goalsAgainst: numOpt }),
        }),
      }),
    )
    .optional()
    .default([]),
  homeTeam: summarySide,
  visitingTeam: summarySide,
  periods: z.array(
    z.object({
      info: period,
      stats: z.object({ homeGoals: numOpt, homeShots: numOpt, visitingGoals: numOpt, visitingShots: numOpt }),
      goals: z.array(summaryGoal),
      penalties: z.array(summaryPenalty),
    }),
  ),
  hasShootout: z.boolean().optional(),
  shootoutDetails: z.object({ homeTeamShots: z.array(shootoutShot).optional().default([]), visitingTeamShots: z.array(shootoutShot).optional().default([]) }).optional(),
});
export type GameSummaryFeed = z.infer<typeof gameSummarySchema>;

const pbpShot = z.object({
  event: z.literal("shot"),
  details: z.object({
    shooter: person,
    /** An empty-net shot has a goalie object with null names. */
    goalie: z.object({ id: numOpt }).nullable().optional(),
    shooterTeamId: num,
    period,
    time: z.string(),
    isGoal: z.boolean(),
    shotQuality: strOpt,
    xLocation: numOpt,
    yLocation: numOpt,
  }),
});
/** Only shots are stored: goals appear twice in the feed, as a shot with isGoal and again as a goal event. */
export const playByPlaySchema = z.array(z.object({ event: z.string() }).loose()).transform((events) =>
  events.flatMap((e) => {
    if (e.event !== "shot") return [];
    return [pbpShot.parse(e)];
  }),
);
export type PbpShot = z.infer<typeof pbpShot>;

// ----- fetchers -----------------------------------------------------------------------

export async function fetchBootstrap() {
  return bootstrapSchema.parse(await feed({ feed: "statviewfeed", view: "bootstrap", season: "latest", pageName: "schedule" }));
}

/** Every game of the season, or one team's. */
export async function fetchSchedule(season = SEASON, teamId?: number) {
  const p = await feed({ feed: "modulekit", view: "schedule", season_id: season, ...(teamId ? { team_id: teamId } : {}) });
  return scheduleSchema.parse(p).SiteKit.Schedule.map(fromSchedule);
}

export const scorebarParams = (daysBack: number, daysAhead: number) => ({ feed: "modulekit", view: "scorebar", numberofdaysback: daysBack, numberofdaysahead: daysAhead });

/** Asking for zero days either way came back empty on a day with games, so always ask for a window. */
export async function fetchScorebar(daysBack = 2, daysAhead = 1) {
  return scorebarSchema.parse(await feed(scorebarParams(daysBack, daysAhead))).SiteKit.Scorebar.map(fromScorebar);
}

export async function fetchStandings(context: "overall" | "home" | "visiting", season = SEASON) {
  return standingsSchema.parse(await feed({ feed: "statviewfeed", view: "teams", groupTeamsBy: "division", context, season, special: "false" }));
}

export async function fetchSpecialTeams(season = SEASON) {
  return specialTeamsSchema.parse(await feed({ feed: "statviewfeed", view: "teams", groupTeamsBy: "division", context: "overall", season, special: "true" }));
}

const playersParams = (season: number) => ({ feed: "statviewfeed", view: "players", season, team: "all", rookies: 0, rosterstatus: "undefined", first: 0, limit: 2000 });

export async function fetchSkaters(season = SEASON) {
  return skatersSchema.parse(await feed({ ...playersParams(season), position: "skaters", statsType: "expanded", sort: "points", order_direction: "DESC" }));
}

export async function fetchGoalies(season = SEASON) {
  return goaliesSchema.parse(await feed({ ...playersParams(season), position: "goalies", statsType: "standard", sort: "gaa", qualified: "all", order_direction: "ASC" }));
}

export async function fetchRoster(teamId = TEAM_ID, season = SEASON) {
  return rosterSchema.parse(await feed({ feed: "statviewfeed", view: "roster", team_id: teamId, season_id: season, rosterstatus: "undefined" })).roster;
}

export async function fetchPlayer(playerId: number, teamId = TEAM_ID, season = SEASON) {
  return playerSchema.parse(await feed({ feed: "statviewfeed", view: "player", player_id: playerId, season_id: season, team_id: teamId, statsType: "standard" }));
}

export async function fetchTransactions(teamId = TEAM_ID, season = SEASON) {
  return transactionsSchema.parse(await feed({ feed: "statviewfeed", view: "transactions", season, team_id: teamId }));
}

export const gameSummaryParams = (gameId: number) => ({ feed: "statviewfeed", view: "gameSummary", game_id: gameId });

export async function fetchGameSummary(gameId: number) {
  return gameSummarySchema.parse(await feed(gameSummaryParams(gameId)));
}

export async function fetchPlayByPlay(gameId: number) {
  return playByPlaySchema.parse(await feed({ feed: "statviewfeed", view: "gameCenterPlayByPlay", game_id: gameId }));
}
