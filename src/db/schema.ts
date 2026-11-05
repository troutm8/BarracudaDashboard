import { boolean, date, index, integer, jsonb, numeric, pgTable, primaryKey, serial, text, timestamp } from "drizzle-orm/pg-core";

/** One row per AHL club, from the feed's bootstrap. Keyed by the HockeyTech team id (Barracuda = 405). */
export const teams = pgTable("teams", {
  id: integer("id").primaryKey(),
  abbrev: text("abbrev").notNull(),
  name: text("name").notNull(), // "San Jose Barracuda"
  commonName: text("common_name").notNull(), // "Barracuda"
  placeName: text("place_name").notNull(), // "San Jose"
  division: text("division"), // "Pacific"
  logoUrl: text("logo_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ThreeStar = {
  star: number;
  playerId: number;
  teamAbbrev: string;
  name: string;
  sweaterNumber: number | null;
  position: string;
  goals: number | null;
  assists: number | null;
  points: number | null;
  saves: number | null;
  goalsAgainst: number | null;
  isGoalie: boolean;
};

export type GoalSummary = {
  period: number;
  periodType: string;
  timeInPeriod: string;
  teamAbbrev: string;
  /** ev, pp, sh, en or ps. */
  strength: string;
  playerId: number;
  scorer: string;
  goalsToDate: number | null;
  assists: { playerId: number; name: string; assistsToDate: number | null }[];
  homeScore: number;
  awayScore: number;
  gameWinner: boolean;
};

export type PenaltySummary = {
  period: number;
  periodType: string;
  timeInPeriod: string;
  teamAbbrev: string;
  minutes: number | null;
  description: string;
  committedBy: string | null;
  servedBy: string | null;
  bench: boolean;
};

export type PeriodLine = { number: number; type: string; label: string; homeGoals: number; awayGoals: number; homeShots: number; awayShots: number };
export type ShootoutShot = { teamAbbrev: string; playerId: number; shooter: string; goalie: string; scored: boolean; winner: boolean };
export type TeamGameTotals = { shots: number; goals: number; ppGoals: number; ppOpps: number; pim: number };

export type GameSummary = {
  goals: GoalSummary[];
  penalties: PenaltySummary[];
  threeStars: ThreeStar[];
  periods: PeriodLine[];
  shootout: ShootoutShot[];
  home: TeamGameTotals | null;
  away: TeamGameTotals | null;
  officials: string[];
};

/**
 * Every AHL game of the season (schedule and scores for the league scoreboard and standings
 * context). Box scores and play-by-play are loaded for Barracuda games only.
 */
export const games = pgTable(
  "games",
  {
    id: integer("id").primaryKey(),
    season: integer("season").notNull(),
    gameType: integer("game_type").notNull(), // 2 regular, 3 playoffs
    /** The feed's calendar date for the game, local to the venue. */
    gameDate: date("game_date").notNull(),
    startTimeUtc: timestamp("start_time_utc", { withTimezone: true }),
    venue: text("venue"),
    venueTimezone: text("venue_timezone"),
    homeTeamId: integer("home_team_id").notNull().references(() => teams.id),
    awayTeamId: integer("away_team_id").notNull().references(() => teams.id),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    /** Only known from box scores, so only for Barracuda games. */
    homeSog: integer("home_sog"),
    awaySog: integer("away_sog"),
    /** FUT, LIVE or FINAL. */
    gameState: text("game_state").notNull(),
    /** OK, PPD (postponed) or CNCL. */
    scheduleState: text("schedule_state"),
    notes: text("notes"),
    period: integer("period"),
    periodType: text("period_type"),
    clock: text("clock"),
    inIntermission: boolean("in_intermission"),
    /** REG, OT or SO once final. */
    lastPeriodType: text("last_period_type"),
    attendance: integer("attendance"),
    homeAudioUrl: text("home_audio_url"),
    awayAudioUrl: text("away_audio_url"),
    videoUrl: text("video_url"),
    summary: jsonb("summary").$type<GameSummary>(),
    boxscoreLoaded: boolean("boxscore_loaded").notNull().default(false),
    pbpLoaded: boolean("pbp_loaded").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("games_date_idx").on(t.gameDate), index("games_home_idx").on(t.homeTeamId), index("games_away_idx").on(t.awayTeamId)],
);

export type DraftDetails = { league: string; team: string; year: number; round: number; overallPick: number | null };
export type CareerRow = { season: string; team: string; playoffs: boolean; gp: number; g: number; a: number; p: number; pim: number };

/** Anyone who has appeared on a roster or in a loaded box score. */
export const players = pgTable("players", {
  id: integer("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  position: text("position"), // F, C, LW, RW, D, G
  sweaterNumber: integer("sweater_number"),
  teamId: integer("team_id").references(() => teams.id),
  headshotUrl: text("headshot_url"),
  birthDate: date("birth_date"),
  birthPlace: text("birth_place"),
  heightIn: integer("height_in"),
  weightLb: integer("weight_lb"),
  shootsCatches: text("shoots_catches"),
  draft: jsonb("draft").$type<DraftDetails>(),
  career: jsonb("career").$type<CareerRow[]>(),
  /** True for the current Barracuda roster; cleared when a roster pull no longer lists them. */
  onRoster: boolean("on_roster").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gameSkaterStats = pgTable(
  "game_skater_stats",
  {
    gameId: integer("game_id").notNull().references(() => games.id),
    playerId: integer("player_id").notNull(),
    teamId: integer("team_id").notNull().references(() => teams.id),
    name: text("name").notNull(),
    sweaterNumber: integer("sweater_number"),
    position: text("position"),
    goals: integer("goals"),
    assists: integer("assists"),
    points: integer("points"),
    plusMinus: integer("plus_minus"),
    pim: integer("pim"),
    sog: integer("sog"),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.playerId] }), index("gss_player_idx").on(t.playerId), index("gss_team_idx").on(t.teamId)],
);

export const gameGoalieStats = pgTable(
  "game_goalie_stats",
  {
    gameId: integer("game_id").notNull().references(() => games.id),
    playerId: integer("player_id").notNull(),
    teamId: integer("team_id").notNull().references(() => teams.id),
    name: text("name").notNull(),
    sweaterNumber: integer("sweater_number"),
    starter: boolean("starter"),
    decision: text("decision"), // W, L, OTL, SOL
    shotsAgainst: integer("shots_against"),
    saves: integer("saves"),
    goalsAgainst: integer("goals_against"),
    savePctg: numeric("save_pctg", { precision: 6, scale: 4 }),
    toiSeconds: integer("toi_seconds"),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.playerId] }), index("ggs_player_idx").on(t.playerId)],
);

/**
 * Shots on goal, including goals, for Barracuda games. The feed has no missed or blocked shots.
 * x and y are rink feet from centre ice (-100..100, -42.5..42.5), converted from the feed's 600 by 300 grid.
 */
export const gameEvents = pgTable(
  "game_events",
  {
    gameId: integer("game_id").notNull().references(() => games.id),
    eventId: integer("event_id").notNull(),
    period: integer("period").notNull(),
    timeInPeriod: text("time_in_period").notNull(),
    /** goal or shot-on-goal. */
    typeDescKey: text("type_desc_key").notNull(),
    teamId: integer("team_id"),
    x: integer("x"),
    y: integer("y"),
    /** The feed's own flag: did the scorer rate this a quality chance. */
    quality: boolean("quality"),
    player1Id: integer("player1_id"),
    goalieId: integer("goalie_id"),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.eventId] }), index("ge_type_idx").on(t.typeDescKey), index("ge_player_idx").on(t.player1Id)],
);

/** Official standings, one snapshot per team per day. The feed serves today's only. */
export const standingsSnapshots = pgTable(
  "standings_snapshots",
  {
    date: date("date").notNull(),
    teamId: integer("team_id").notNull().references(() => teams.id),
    season: integer("season").notNull(),
    gamesPlayed: integer("games_played").notNull(),
    gamesRemaining: integer("games_remaining"),
    wins: integer("wins").notNull(),
    losses: integer("losses").notNull(),
    otLosses: integer("ot_losses").notNull(),
    soLosses: integer("so_losses").notNull(),
    points: integer("points").notNull(),
    pointPctg: numeric("point_pctg", { precision: 7, scale: 6 }),
    regulationWins: integer("regulation_wins"),
    regulationPlusOtWins: integer("regulation_plus_ot_wins"),
    goalsFor: integer("goals_for"),
    goalsAgainst: integer("goals_against"),
    goalDifferential: integer("goal_differential"),
    pim: integer("pim"),
    home: text("home"), // "4-0-0-1"
    road: text("road"),
    l10: text("l10"),
    divisionRank: integer("division_rank"),
    leagueRank: integer("league_rank"),
  },
  (t) => [primaryKey({ columns: [t.date, t.teamId] }), index("standings_team_idx").on(t.teamId)],
);

/** League-wide skater season lines. The latest snapshot is the table. */
export const skaterSeasonStats = pgTable(
  "skater_season_stats",
  {
    season: integer("season").notNull(),
    playerId: integer("player_id").notNull(),
    snapshotDate: date("snapshot_date").notNull(),
    fullName: text("full_name").notNull(),
    /** The latest team; the feed gives traded players one row. */
    teamAbbrev: text("team_abbrev"),
    position: text("position"),
    rookie: boolean("rookie"),
    gamesPlayed: integer("games_played"),
    goals: integer("goals"),
    assists: integer("assists"),
    points: integer("points"),
    plusMinus: integer("plus_minus"),
    pim: integer("pim"),
    ppGoals: integer("pp_goals"),
    ppAssists: integer("pp_assists"),
    shGoals: integer("sh_goals"),
    gwGoals: integer("gw_goals"),
    otGoals: integer("ot_goals"),
    shots: integer("shots"),
    shootingPct: numeric("shooting_pct", { precision: 6, scale: 2 }),
    shootoutGoals: integer("shootout_goals"),
    shootoutAttempts: integer("shootout_attempts"),
  },
  (t) => [primaryKey({ columns: [t.season, t.playerId, t.snapshotDate] }), index("sss_date_idx").on(t.snapshotDate)],
);

export const goalieSeasonStats = pgTable(
  "goalie_season_stats",
  {
    season: integer("season").notNull(),
    playerId: integer("player_id").notNull(),
    snapshotDate: date("snapshot_date").notNull(),
    fullName: text("full_name").notNull(),
    teamAbbrev: text("team_abbrev"),
    rookie: boolean("rookie"),
    gamesPlayed: integer("games_played"),
    wins: integer("wins"),
    losses: integer("losses"),
    otLosses: integer("ot_losses"),
    shotsAgainst: integer("shots_against"),
    saves: integer("saves"),
    goalsAgainst: integer("goals_against"),
    gaa: numeric("gaa", { precision: 7, scale: 4 }),
    savePct: numeric("save_pct", { precision: 7, scale: 5 }),
    shutouts: integer("shutouts"),
    minutes: integer("minutes"),
  },
  (t) => [primaryKey({ columns: [t.season, t.playerId, t.snapshotDate] }), index("gss2_date_idx").on(t.snapshotDate)],
);

/** Team season numbers: special teams from the feed, shots summed from the league player tables. */
export const teamSeasonStats = pgTable(
  "team_season_stats",
  {
    season: integer("season").notNull(),
    teamId: integer("team_id").notNull().references(() => teams.id),
    snapshotDate: date("snapshot_date").notNull(),
    gamesPlayed: integer("games_played"),
    ppPct: numeric("pp_pct", { precision: 7, scale: 5 }),
    pkPct: numeric("pk_pct", { precision: 7, scale: 5 }),
    ppGoals: integer("pp_goals"),
    ppOpps: integer("pp_opps"),
    ppGoalsAgainst: integer("pp_goals_against"),
    timesShorthanded: integer("times_shorthanded"),
    shGoalsFor: integer("sh_goals_for"),
    shGoalsAgainst: integer("sh_goals_against"),
    shotsFor: integer("shots_for"),
    /** Faced by goalies, so empty-net shots are missing. */
    shotsAgainst: integer("shots_against"),
  },
  (t) => [primaryKey({ columns: [t.season, t.teamId, t.snapshotDate] })],
);

/** Our own season simulation, one row per team per day. */
export const oddsSnapshots = pgTable(
  "odds_snapshots",
  {
    date: date("date").notNull(),
    teamId: integer("team_id").notNull().references(() => teams.id),
    madePlayoffs: numeric("made_playoffs", { precision: 6, scale: 4 }),
    firstRoundBye: numeric("first_round_bye", { precision: 6, scale: 4 }),
    wonDivision: numeric("won_division", { precision: 6, scale: 4 }),
    projectedPoints: numeric("projected_points", { precision: 6, scale: 1 }),
  },
  (t) => [primaryKey({ columns: [t.date, t.teamId] })],
);

/** Barracuda roster moves. The feed has no id, so the text is part of the key. */
export const transactions = pgTable(
  "transactions",
  {
    date: date("date").notNull(),
    playerName: text("player_name").notNull(),
    description: text("description").notNull(),
    playerId: integer("player_id"),
    position: text("position"),
    /** ADD or DEL. */
    kind: text("kind").notNull(),
  },
  (t) => [primaryKey({ columns: [t.date, t.playerName, t.description] }), index("tx_date_idx").on(t.date)],
);

export const ingestRuns = pgTable("ingest_runs", {
  id: serial("id").primaryKey(),
  job: text("job").notNull(),
  args: text("args"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  ok: boolean("ok"),
  rows: integer("rows"),
  error: text("error"),
});

export type Team = typeof teams.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Player = typeof players.$inferSelect;
export type GameSkaterStat = typeof gameSkaterStats.$inferSelect;
export type GameGoalieStat = typeof gameGoalieStats.$inferSelect;
export type GameEvent = typeof gameEvents.$inferSelect;
export type StandingsRow = typeof standingsSnapshots.$inferSelect;
export type SkaterSeason = typeof skaterSeasonStats.$inferSelect;
export type GoalieSeason = typeof goalieSeasonStats.$inferSelect;
export type TeamSeason = typeof teamSeasonStats.$inferSelect;
export type Odds = typeof oddsSnapshots.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
