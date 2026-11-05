/** The 2026-27 regular season, as HockeyTech identifies it. Playoffs get their own season id. */
export const SEASON = Number(process.env.AHL_SEASON_ID ?? 94);
/** Shown in the header. */
export const SEASON_LABEL = "2026-27";
/** First game in the feed; backfills start here. */
export const SEASON_START = "2026-10-02";
/** Last day of the regular season. */
export const REGULAR_SEASON_END = "2027-04-11";
/** Every AHL team plays 72 games. */
export const TOTAL_GAMES = 72;

/** San Jose Barracuda in the HockeyTech feed. */
export const TEAM_ID = Number(process.env.FEATURED_TEAM_ID ?? 405);
export const TEAM_ABBREV = process.env.FEATURED_TEAM_ABBREV ?? "SJ";
export const TEAM_NAME = "Barracuda";

/** Regular season 2, playoffs 3. In the feed this is a property of the season id, not of the game. */
export const GAME_TYPE = { regular: 2, playoffs: 3 } as const;

/**
 * Playoff places and first-round byes by division: 23 of 32 teams qualify, 9 of them with a bye.
 * The format dates from 2022. Pacific's seven was seen in 2026; re-check the rest each season.
 */
export const PLAYOFF_FORMAT: Record<string, { spots: number; byes: number }> = {
  Atlantic: { spots: 6, byes: 2 },
  North: { spots: 5, byes: 3 },
  Central: { spots: 5, byes: 3 },
  Pacific: { spots: 7, byes: 1 },
};

export const MILESTONES: { date: string; label: string }[] = [
  { date: "2027-02-07", label: "All-Star Classic, Cleveland" },
  { date: "2027-04-11", label: "Regular season ends" },
];

/** Game states stored on `games`, collapsed from the feed's numeric status at the boundary. */
export type GameStatus = "pre" | "live" | "final";
export function statusOf(gameState: string): GameStatus {
  if (gameState === "LIVE") return "live";
  if (gameState === "FINAL") return "final";
  return "pre";
}

const PT = "America/Los_Angeles";

/** YYYY-MM-DD for an instant in a time zone. */
export function ymdIn(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** "Today" for the dashboard is the Pacific calendar date. The feed files each game under its venue's local date. */
export function todayPacific(): string {
  return ymdIn(new Date(), PT);
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function* dateRange(from: string, to: string): Generator<string> {
  for (let d = from; d <= to; d = addDays(d, 1)) yield d;
}

export function isValidYmd(s: string | undefined | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export function seasonLabel(): string {
  return SEASON_LABEL;
}
