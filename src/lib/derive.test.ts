import { describe, expect, it } from "vitest";
import type { Game, StandingsRow, Team } from "@/db/schema";
import { computeRecord, groupStandings, outcomeFor, playoffPicture, pointsPace, powerRankings, powerRating, rankOf, recordPoints, seasonSeries, splitPoints, splitText, streaksByTeam } from "./derive";

const SJ = 405;

function game(over: Partial<Game> & { homeTeamId: number; awayTeamId: number; homeScore: number; awayScore: number }): Game {
  return { id: Math.floor(Math.random() * 1e9), season: 94, gameType: 2, gameDate: "2026-10-10", gameState: "FINAL", lastPeriodType: "REG", ...over } as Game;
}

const team = (id: number, division: string) => ({ id, division }) as Team;
const standing = (teamId: number, divisionRank: number, points: number, gamesPlayed = 20) => ({ teamId, divisionRank, points, gamesPlayed }) as StandingsRow;

describe("outcomes", () => {
  it("keeps overtime and shootout losses apart", () => {
    expect(outcomeFor(SJ, game({ homeTeamId: SJ, awayTeamId: 1, homeScore: 3, awayScore: 1 }))).toBe("W");
    expect(outcomeFor(SJ, game({ homeTeamId: SJ, awayTeamId: 1, homeScore: 1, awayScore: 3 }))).toBe("L");
    expect(outcomeFor(SJ, game({ homeTeamId: 1, awayTeamId: SJ, homeScore: 3, awayScore: 2, lastPeriodType: "OT" }))).toBe("OTL");
    expect(outcomeFor(SJ, game({ homeTeamId: 1, awayTeamId: SJ, homeScore: 3, awayScore: 2, lastPeriodType: "SO" }))).toBe("SOL");
  });
});

describe("computeRecord", () => {
  const games = [
    game({ homeTeamId: SJ, awayTeamId: 1, homeScore: 4, awayScore: 1, gameDate: "2026-10-03" }),
    game({ homeTeamId: 1, awayTeamId: SJ, homeScore: 2, awayScore: 1, lastPeriodType: "OT", gameDate: "2026-10-05" }),
    game({ homeTeamId: SJ, awayTeamId: 2, homeScore: 2, awayScore: 3, lastPeriodType: "SO", gameDate: "2026-11-02" }),
    game({ homeTeamId: 2, awayTeamId: SJ, homeScore: 5, awayScore: 1, gameDate: "2026-11-04" }),
    game({ homeTeamId: 3, awayTeamId: 4, homeScore: 5, awayScore: 1, gameDate: "2026-11-04" }),
  ];
  const r = computeRecord(SJ, games, new Map([[SJ, team(SJ, "Pacific")], [1, team(1, "Pacific")], [2, team(2, "North")]]));

  it("counts a four-column record and ignores other teams' games", () => {
    expect(splitText(r)).toBe("1-1-1-1");
    expect(r.gp).toBe(4);
    expect(r.points).toBe(4);
    expect(r.pointPct).toBeCloseTo(0.5);
    expect(r.gf).toBe(8);
    expect(r.ga).toBe(11);
  });
  it("splits home, road, one-goal, division and month", () => {
    expect(splitText(r.home)).toBe("1-0-0-1");
    expect(splitText(r.road)).toBe("0-1-1-0");
    expect(splitText(r.oneGoal)).toBe("0-0-1-1");
    expect(splitText(r.vsDivision)).toBe("1-0-1-0");
    expect(r.byMonth.map((m) => m.month)).toEqual(["2026-10", "2026-11"]);
  });
  it("skips unfinished games", () => {
    const pending = game({ homeTeamId: SJ, awayTeamId: 1, homeScore: 0, awayScore: 0, gameState: "LIVE" });
    expect(computeRecord(SJ, [pending]).gp).toBe(0);
  });
  it("derives streaks", () => {
    expect(r.streak).toBe("L1");
    const wins = [1, 2, 3].map(() => game({ homeTeamId: SJ, awayTeamId: 1, homeScore: 2, awayScore: 1 }));
    expect(streaksByTeam([SJ, 1], wins)).toEqual(new Map([[SJ, "W3"], [1, "L3"]]));
  });
});

describe("small derivations", () => {
  it("scores a split", () => expect(splitPoints({ w: 2, l: 1, otl: 1, sol: 1 })).toBe(6));
  it("paces over 72 games", () => expect(pointsPace(8, 10)).toBe(58));
  it("reads a record string", () => expect(recordPoints("7-1-2-0")).toEqual({ points: 16, games: 10 }));
  it("ranks with ties and direction", () => {
    expect(rankOf(3, [1, 2, 3, 3])).toBe(1);
    expect(rankOf(3, [1, 2, 3, 3], false)).toBe(3);
    expect(rankOf(null, [1])).toBeNull();
  });
  it("sums a series", () => {
    const s = seasonSeries(SJ, 1, [game({ homeTeamId: SJ, awayTeamId: 1, homeScore: 1, awayScore: 0 }), game({ homeTeamId: SJ, awayTeamId: 2, homeScore: 1, awayScore: 0 })]);
    expect(s.games).toHaveLength(1);
    expect(s.split.w).toBe(1);
  });
});

describe("playoffPicture", () => {
  const ids = Array.from({ length: 10 }, (_, i) => i + 1);
  const teams = new Map(ids.map((id) => [id, team(id, "Pacific")]));
  const rows = ids.map((id) => standing(id, id, 30 - id * 2, id === 9 ? 18 : 20));

  it("cuts the Pacific after seven", () => {
    const p = playoffPicture(rows, teams, "Pacific", 9);
    expect(p.inside).toHaveLength(7);
    expect(p.outside).toHaveLength(3);
    expect(p.cutLine?.teamId).toBe(7);
  });
  it("measures a team outside against the last team in", () => {
    const f = playoffPicture(rows, teams, "Pacific", 9).featured!;
    expect(f).toMatchObject({ inPlayoffs: false, pointsVsLine: -4, gamesInHand: 2, bye: false });
  });
  it("measures a team inside against the first team out, and spots the bye", () => {
    const f = playoffPicture(rows, teams, "Pacific", 1).featured!;
    expect(f).toMatchObject({ inPlayoffs: true, pointsVsLine: 14, bye: true });
  });
  it("groups in the feed's order", () => {
    const groups = groupStandings([...rows].reverse(), teams);
    expect(groups[0].rows[0].teamId).toBe(1);
  });
});

describe("power rating", () => {
  const input = { teamId: 1, gamesPlayed: 10, pointPct: 0.5, goalDifferential: 0, shotShare: 0.5, l10Points: 10, l10Games: 10 };
  it("sits at fifty for an average team", () => expect(powerRating(input).score).toBeCloseTo(50));
  it("is neutral when shots are unknown", () => {
    expect(powerRating({ ...input, shotShare: null }).components.shots).toBe(10);
  });
  it("ranks better teams first", () => {
    const r = powerRankings([input, { ...input, teamId: 2, pointPct: 0.7 }]);
    expect(r.map((x) => [x.teamId, x.rank])).toEqual([[2, 1], [1, 2]]);
  });
});
