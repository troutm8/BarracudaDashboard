/**
 * Playoff odds. Nobody publishes these for the AHL, so we play out the rest of the season many
 * times. Pure and seeded: the same games and seed give the same odds.
 *
 * Each team's strength is its goal differential per game, shrunk toward zero with twenty phantom
 * average games so an early hot streak does not count for too much. Every simulated season
 * also jitters each team's strength, because we do not really know how good anyone is.
 */
export const SIM = {
  iterations: 10_000,
  /** Phantom games of goal differential zero. */
  priorGames: 20,
  /** Logit points per goal of strength gap: a one-goal edge wins about 66% of the time. */
  goalWeight: 0.65,
  /** About a 54% win rate at home between equal teams. */
  homeEdge: 0.16,
  /** Share of games that reach overtime, measured over the first 171 games of 2026-27. */
  overtimeRate: 0.19,
  /** Standard deviation, in goals per game, of the season-long jitter. */
  strengthNoise: 0.3,
} as const;

export type SimTeam = { id: number; division: string | null };
export type SimGame = { homeTeamId: number; awayTeamId: number; homeScore: number | null; awayScore: number | null; lastPeriodType: string | null; final: boolean };
export type SimFormat = Record<string, { spots: number; byes: number }>;
export type SimResult = { teamId: number; madePlayoffs: number; firstRoundBye: number; wonDivision: number; projectedPoints: number };

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** Win probability for the home side given the two strengths. */
export function homeWinProbability(home: number, away: number): number {
  return 1 / (1 + Math.exp(-(SIM.homeEdge + SIM.goalWeight * (home - away))));
}

export function simulateSeason(teams: SimTeam[], games: SimGame[], format: SimFormat, opts: { iterations?: number; seed?: number } = {}): SimResult[] {
  const iterations = opts.iterations ?? SIM.iterations;
  const rand = mulberry32(opts.seed ?? 1);
  const index = new Map(teams.map((t, i) => [t.id, i]));
  const n = teams.length;

  // What has already happened.
  const points = new Float64Array(n);
  const regWins = new Float64Array(n);
  const played = new Float64Array(n);
  const diff = new Float64Array(n);
  const remaining: [number, number][] = [];
  for (const g of games) {
    const h = index.get(g.homeTeamId);
    const a = index.get(g.awayTeamId);
    if (h == null || a == null) continue;
    if (!g.final || g.homeScore == null || g.awayScore == null) {
      remaining.push([h, a]);
      continue;
    }
    played[h]++;
    played[a]++;
    diff[h] += g.homeScore - g.awayScore;
    diff[a] += g.awayScore - g.homeScore;
    const winner = g.homeScore > g.awayScore ? h : a;
    const loser = winner === h ? a : h;
    const extra = g.lastPeriodType === "OT" || g.lastPeriodType === "SO";
    points[winner] += 2;
    if (extra) points[loser] += 1;
    else regWins[winner]++;
  }
  const strength = Array.from({ length: n }, (_, i) => diff[i] / (played[i] + SIM.priorGames));

  const divisions = new Map<string, number[]>();
  teams.forEach((t, i) => {
    const d = t.division ?? "?";
    divisions.set(d, [...(divisions.get(d) ?? []), i]);
  });

  const made = new Float64Array(n);
  const bye = new Float64Array(n);
  const won = new Float64Array(n);
  const totalPoints = new Float64Array(n);
  const pts = new Float64Array(n);
  const reg = new Float64Array(n);
  const s = new Float64Array(n);
  const tiebreak = new Float64Array(n);

  for (let it = 0; it < iterations; it++) {
    pts.set(points);
    reg.set(regWins);
    for (let i = 0; i < n; i++) {
      s[i] = strength[i] + SIM.strengthNoise * gaussian(rand);
      tiebreak[i] = rand();
    }
    for (const [h, a] of remaining) {
      const homeWon = rand() < homeWinProbability(s[h], s[a]);
      const winner = homeWon ? h : a;
      const loser = homeWon ? a : h;
      pts[winner] += 2;
      if (rand() < SIM.overtimeRate) pts[loser] += 1;
      else reg[winner]++;
    }
    for (const [name, members] of divisions) {
      const f = format[name] ?? { spots: 0, byes: 0 };
      // Every team finishes on 72 games, so points order is points-percentage order.
      const order = [...members].sort((x, y) => pts[y] - pts[x] || reg[y] - reg[x] || tiebreak[y] - tiebreak[x]);
      order.forEach((team, place) => {
        if (place === 0) won[team]++;
        if (place < f.byes) bye[team]++;
        if (place < f.spots) made[team]++;
      });
    }
    for (let i = 0; i < n; i++) totalPoints[i] += pts[i];
  }

  return teams.map((t, i) => ({
    teamId: t.id,
    madePlayoffs: made[i] / iterations,
    firstRoundBye: bye[i] / iterations,
    wonDivision: won[i] / iterations,
    projectedPoints: totalPoints[i] / iterations,
  }));
}
