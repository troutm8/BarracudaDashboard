import { describe, expect, it } from "vitest";
import { SIM, homeWinProbability, simulateSeason, type SimGame } from "./simulate";

const FORMAT = { East: { spots: 2, byes: 1 } };
const teams = [1, 2, 3, 4].map((id) => ({ id, division: "East" }));

/** Everyone plays everyone home and away, `rounds` times. */
function roundRobin(rounds: number, final = false): SimGame[] {
  const out: SimGame[] = [];
  for (let r = 0; r < rounds; r++) for (const h of teams) for (const a of teams) if (h.id !== a.id) out.push({ homeTeamId: h.id, awayTeamId: a.id, homeScore: null, awayScore: null, lastPeriodType: null, final });
  return out;
}

const result = (homeTeamId: number, awayTeamId: number, homeScore: number, awayScore: number, lastPeriodType = "REG"): SimGame => ({ homeTeamId, awayTeamId, homeScore, awayScore, lastPeriodType, final: true });

describe("win probability", () => {
  it("favors the home side between equals, by a little", () => {
    const p = homeWinProbability(0, 0);
    expect(p).toBeGreaterThan(0.52);
    expect(p).toBeLessThan(0.56);
  });
  it("rises with strength", () => expect(homeWinProbability(1, 0)).toBeGreaterThan(homeWinProbability(0, 0)));
});

describe("simulateSeason", () => {
  const opts = { iterations: 2000, seed: 7 };

  it("fills exactly the places on offer in every run", () => {
    const r = simulateSeason(teams, roundRobin(5), FORMAT, opts);
    const sum = (f: (x: (typeof r)[number]) => number) => r.reduce((a, x) => a + f(x), 0);
    expect(sum((x) => x.madePlayoffs)).toBeCloseTo(2);
    expect(sum((x) => x.firstRoundBye)).toBeCloseTo(1);
    expect(sum((x) => x.wonDivision)).toBeCloseTo(1);
  });
  it("is reproducible for a seed and differs across seeds", () => {
    const games = roundRobin(5);
    expect(simulateSeason(teams, games, FORMAT, opts)).toEqual(simulateSeason(teams, games, FORMAT, opts));
    expect(simulateSeason(teams, games, FORMAT, opts)).not.toEqual(simulateSeason(teams, games, FORMAT, { ...opts, seed: 8 }));
  });
  it("treats equal teams about equally", () => {
    for (const t of simulateSeason(teams, roundRobin(5), FORMAT, opts)) expect(t.madePlayoffs).toBeCloseTo(0.5, 0);
  });
  it("counts results already played and leaves a finished season alone", () => {
    const games = [result(1, 2, 3, 0), result(3, 4, 2, 1, "OT"), result(1, 3, 3, 2, "SO")];
    const r = simulateSeason(teams, games, FORMAT, opts);
    expect(r.find((t) => t.teamId === 1)).toMatchObject({ projectedPoints: 4, madePlayoffs: 1, wonDivision: 1 });
    expect(r.find((t) => t.teamId === 3)?.projectedPoints).toBe(3);
    expect(r.find((t) => t.teamId === 4)?.projectedPoints).toBe(1);
  });
  it("gives a dominant team better odds, without certainty early on", () => {
    const played = [result(1, 2, 4, 1), result(1, 3, 4, 1), result(1, 4, 4, 1)];
    const r = simulateSeason(teams, [...played, ...roundRobin(6)], FORMAT, opts);
    const best = r.find((t) => t.teamId === 1)!;
    expect(best.madePlayoffs).toBeGreaterThan(r.find((t) => t.teamId === 2)!.madePlayoffs);
    expect(best.wonDivision).toBeLessThan(1);
  });
  it("adds about the overtime rate of extra points", () => {
    const r = simulateSeason(teams, roundRobin(10), FORMAT, opts);
    const total = r.reduce((a, t) => a + t.projectedPoints, 0);
    expect(total / 120).toBeCloseTo(2 + SIM.overtimeRate, 1);
  });
});
