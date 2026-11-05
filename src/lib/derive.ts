/**
 * Pure derivations over stored rows: records, streaks, splits, season series, pace, the
 * division playoff picture. No database access here; everything is unit-tested on plain objects.
 */
import type { Game, StandingsRow, Team } from "@/db/schema";
import { PLAYOFF_FORMAT, TOTAL_GAMES } from "./season";

/** The AHL keeps overtime and shootout losses in separate columns; each is worth a point. */
export type Outcome = "W" | "L" | "OTL" | "SOL";

/** Only games that count: finished regular-season games (or a given type). */
export function finishedGames(games: Game[], gameType = 2): Game[] {
  return games.filter((g) => g.gameType === gameType && g.gameState === "FINAL" && g.homeScore != null && g.awayScore != null);
}

export function outcomeFor(teamId: number, g: Game): Outcome | null {
  if (g.homeScore == null || g.awayScore == null) return null;
  const isHome = g.homeTeamId === teamId;
  const mine = isHome ? g.homeScore : g.awayScore;
  const theirs = isHome ? g.awayScore : g.homeScore;
  if (mine > theirs) return "W";
  if (g.lastPeriodType === "SO") return "SOL";
  return g.lastPeriodType === "OT" ? "OTL" : "L";
}

export type Split = { w: number; l: number; otl: number; sol: number };
const split = (): Split => ({ w: 0, l: 0, otl: 0, sol: 0 });
function tally(s: Split, o: Outcome) {
  if (o === "W") s.w++;
  else if (o === "L") s.l++;
  else if (o === "OTL") s.otl++;
  else s.sol++;
}
export function splitText(s: Split): string {
  return `${s.w}-${s.l}-${s.otl}-${s.sol}`;
}
export function splitPoints(s: Split): number {
  return s.w * 2 + s.otl + s.sol;
}
export function splitOf(outcomes: Outcome[]): Split {
  const s = split();
  for (const o of outcomes) tally(s, o);
  return s;
}

export type TeamRecord = Split & {
  gp: number;
  points: number;
  pointPct: number;
  gf: number;
  ga: number;
  diff: number;
  home: Split;
  road: Split;
  oneGoal: Split;
  overtime: Split;
  vsDivision: Split;
  byMonth: { month: string; split: Split }[];
  last10: Outcome[];
  streak: string;
  regulationWins: number;
  results: Outcome[];
};

/** A team's record from its finished games in chronological order. `teams` supplies divisions for the splits. */
export function computeRecord(teamId: number, games: Game[], teams: Map<number, Pick<Team, "division">> = new Map()): TeamRecord {
  const r: TeamRecord = {
    ...split(),
    gp: 0,
    points: 0,
    pointPct: 0,
    gf: 0,
    ga: 0,
    diff: 0,
    home: split(),
    road: split(),
    oneGoal: split(),
    overtime: split(),
    vsDivision: split(),
    byMonth: [],
    last10: [],
    streak: "—",
    regulationWins: 0,
    results: [],
  };
  const me = teams.get(teamId);
  const months = new Map<string, Split>();
  for (const g of finishedGames(games)) {
    if (g.homeTeamId !== teamId && g.awayTeamId !== teamId) continue;
    const o = outcomeFor(teamId, g);
    if (!o) continue;
    const isHome = g.homeTeamId === teamId;
    const mine = isHome ? g.homeScore! : g.awayScore!;
    const theirs = isHome ? g.awayScore! : g.homeScore!;
    r.gp++;
    r.gf += mine;
    r.ga += theirs;
    r.results.push(o);
    tally(r, o);
    if (o === "W" && (g.lastPeriodType ?? "REG") === "REG") r.regulationWins++;
    tally(isHome ? r.home : r.road, o);
    if (Math.abs(mine - theirs) === 1) tally(r.oneGoal, o);
    if (g.lastPeriodType === "OT" || g.lastPeriodType === "SO") tally(r.overtime, o);
    const opp = teams.get(isHome ? g.awayTeamId : g.homeTeamId);
    if (me?.division && me.division === opp?.division) tally(r.vsDivision, o);
    const month = g.gameDate.slice(0, 7);
    if (!months.has(month)) months.set(month, split());
    tally(months.get(month)!, o);
  }
  r.points = splitPoints(r);
  r.pointPct = r.gp ? r.points / (r.gp * 2) : 0;
  r.diff = r.gf - r.ga;
  r.last10 = r.results.slice(-10);
  r.byMonth = [...months.entries()].map(([month, s]) => ({ month, split: s }));
  if (r.results.length) {
    const last = r.results[r.results.length - 1];
    let n = 0;
    for (let i = r.results.length - 1; i >= 0 && r.results[i] === last; i--) n++;
    r.streak = `${last}${n}`;
  }
  return r;
}

/** The feed's `streak` column is a record, not a streak, so streaks come from the games. */
export function streaksByTeam(teamIds: number[], games: Game[]): Map<number, string> {
  return new Map(teamIds.map((id) => [id, computeRecord(id, games).streak]));
}

/** Head-to-head this season, from the featured team's point of view. */
export function seasonSeries(teamId: number, oppId: number, games: Game[]): { split: Split; games: Game[] } {
  const gs = finishedGames(games).filter((g) => (g.homeTeamId === teamId && g.awayTeamId === oppId) || (g.homeTeamId === oppId && g.awayTeamId === teamId));
  const s = split();
  for (const g of gs) {
    const o = outcomeFor(teamId, g);
    if (o) tally(s, o);
  }
  return { split: s, games: gs };
}

/** Points pace over a full season. */
export function pointsPace(points: number, gp: number, totalGames = TOTAL_GAMES): number {
  return gp ? Math.round((points / gp) * totalGames) : 0;
}

export type PlayoffPicture = {
  division: string;
  inside: StandingsRow[];
  outside: StandingsRow[];
  /** The last team in: the line to beat. */
  cutLine: StandingsRow | null;
  spots: number;
  /** Points relative to the line (positive is above) and games in hand (positive means fewer played). */
  featured: { row: StandingsRow; pointsVsLine: number; gamesInHand: number; inPlayoffs: boolean; bye: boolean } | null;
};

/**
 * One division's playoff picture. The AHL has no wild card: each division sends its own top
 * teams, so the picture is a cut through the feed's own division order.
 */
export function playoffPicture(rows: StandingsRow[], teams: Map<number, Team>, division: string, featuredId: number): PlayoffPicture {
  const { spots, byes } = PLAYOFF_FORMAT[division] ?? { spots: 0, byes: 0 };
  const members = rows.filter((r) => teams.get(r.teamId)?.division === division).sort((a, b) => (a.divisionRank ?? 99) - (b.divisionRank ?? 99));
  const inside = members.slice(0, spots);
  const outside = members.slice(spots);
  const cutLine = inside[inside.length - 1] ?? null;
  const index = members.findIndex((r) => r.teamId === featuredId);
  let featured: PlayoffPicture["featured"] = null;
  if (index >= 0) {
    const row = members[index];
    const inPlayoffs = index < spots;
    const ref = inPlayoffs ? outside[0] ?? null : cutLine;
    featured = {
      row,
      pointsVsLine: ref ? row.points - ref.points : 0,
      gamesInHand: ref ? ref.gamesPlayed - row.gamesPlayed : 0,
      inPlayoffs,
      bye: index < byes,
    };
  }
  return { division, inside, outside, cutLine, spots, featured };
}

/** Group a league standings snapshot by division, in the feed's own order. */
export function groupStandings(rows: StandingsRow[], teams: Map<number, Team>): { name: string; rows: StandingsRow[] }[] {
  const groups = new Map<string, StandingsRow[]>();
  for (const r of rows) {
    const key = teams.get(r.teamId)?.division ?? "?";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.entries()]
    .map(([name, rs]) => ({ name, rows: rs.sort((a, b) => (a.divisionRank ?? 99) - (b.divisionRank ?? 99)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Power rating out of 100, from four published components. Deliberately simple so it can be
 * argued with on the /rankings page; nothing here is an AHL product. Shot share stands in for
 * the expected-goals share the Sharks site uses, since nobody models xG for the AHL.
 */
export const POWER_WEIGHTS = { points: 40, goalDiff: 25, shots: 20, form: 15 } as const;

export type PowerInput = {
  teamId: number;
  gamesPlayed: number;
  pointPct: number;
  goalDifferential: number;
  /** Shots for over shots for and against, 0..1, or null when unavailable. */
  shotShare: number | null;
  l10Points: number;
  l10Games: number;
};

export type PowerRating = {
  teamId: number;
  score: number;
  components: { points: number; goalDiff: number; shots: number; form: number };
  rank: number;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function powerRating(t: PowerInput): Omit<PowerRating, "rank"> {
  const gdPerGame = t.gamesPlayed ? t.goalDifferential / t.gamesPlayed : 0;
  const components = {
    points: POWER_WEIGHTS.points * clamp01(t.pointPct),
    // A goal differential of +1.5 per game is elite, -1.5 is dreadful.
    goalDiff: POWER_WEIGHTS.goalDiff * clamp01((gdPerGame + 1.5) / 3),
    // Shot share between 40% and 60% covers nearly the whole league. Unknown is neutral, not zero.
    shots: t.shotShare == null ? POWER_WEIGHTS.shots / 2 : POWER_WEIGHTS.shots * clamp01((t.shotShare - 0.4) / 0.2),
    form: POWER_WEIGHTS.form * (t.l10Games ? clamp01(t.l10Points / (t.l10Games * 2)) : 0.5),
  };
  return { teamId: t.teamId, score: components.points + components.goalDiff + components.shots + components.form, components };
}

export function powerRankings(inputs: PowerInput[]): PowerRating[] {
  return inputs
    .map(powerRating)
    .sort((a, b) => b.score - a.score || a.teamId - b.teamId)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/** "7-1-2-0" as points and games. */
export function recordPoints(text: string | null): { points: number; games: number } {
  const [w = 0, l = 0, otl = 0, sol = 0] = (text ?? "").split("-").map(Number);
  return { points: w * 2 + otl + sol, games: w + l + otl + sol };
}

/** Rank of a value among all values (1 = best). `higherIsBetter` false for goals against and the like. */
export function rankOf(value: number | null, all: (number | null)[], higherIsBetter = true): number | null {
  if (value == null) return null;
  const vals = all.filter((v): v is number => v != null);
  const better = vals.filter((v) => (higherIsBetter ? v > value : v < value)).length;
  return better + 1;
}
