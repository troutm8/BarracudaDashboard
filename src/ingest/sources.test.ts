import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { careerOf } from "./jobs/roster";
import { decisionOf, eventRow, rinkCoords, summaryOf } from "./jobs/boxscores";
import * as ht from "./sources/hockeytech";

const fixture = (name: string) => ht.parseFeed(readFileSync(path.join(__dirname, "fixtures", name), "utf8"));

describe("feed envelope", () => {
  it("unwraps parentheses and leaves plain JSON alone", () => {
    expect(ht.parseFeed('({"a":1})')).toEqual({ a: 1 });
    expect(ht.parseFeed('{"a":1}')).toEqual({ a: 1 });
    expect(() => ht.parseFeed("<html>")).toThrow(/Non-JSON/);
  });
});

describe("teams", () => {
  it("finds the Barracuda and all 32 clubs in four divisions", () => {
    const teams = ht.teamsOf(ht.bootstrapSchema.parse(fixture("bootstrap.txt")));
    expect(teams).toHaveLength(32);
    expect(new Set(teams.map((t) => t.division))).toEqual(new Set(["Atlantic", "North", "Central", "Pacific"]));
    expect(teams.find((t) => t.id === 405)).toMatchObject({ abbrev: "SJ", commonName: "Barracuda", placeName: "San Jose", division: "Pacific" });
  });
});

describe("games", () => {
  const schedule = ht.scheduleSchema.parse(fixture("schedule.json")).SiteKit.Schedule.map(ht.fromSchedule);

  it("uses the real instant, not the mislabelled local time", () => {
    const g = schedule.find((x) => x.id === 1029239)!;
    expect(g.startTimeUtc.toISOString()).toBe("2026-11-01T23:00:00.000Z");
  });
  it("reads finals, overtime and upcoming games", () => {
    const g = schedule.find((x) => x.id === 1029239)!;
    expect(g).toMatchObject({ gameState: "FINAL", lastPeriodType: "OT", homeScore: 3, awayScore: 2, attendance: 2037, clock: null });
    const next = schedule.find((x) => x.gameState === "FUT")!;
    expect(next).toMatchObject({ homeScore: null, awayScore: null, period: null, lastPeriodType: null });
  });
  it("normalizes the scoreboard to the same shape", () => {
    const games = ht.scorebarSchema.parse(fixture("scorebar.json")).SiteKit.Scorebar.map(ht.fromScorebar);
    expect(games.length).toBeGreaterThan(0);
    expect(games[0].gameState).toBe("FINAL");
    expect(games[0].startTimeUtc).toBeInstanceOf(Date);
  });
  it("collapses status codes and status text", () => {
    expect(ht.gameStateOf(1)).toBe("FUT");
    expect(ht.gameStateOf(2)).toBe("LIVE");
    expect(ht.gameStateOf(4)).toBe("FINAL");
    expect(ht.lastPeriodTypeOf("Final")).toBe("REG");
    expect(ht.lastPeriodTypeOf("Final OT")).toBe("OT");
    expect(ht.lastPeriodTypeOf("Final SO")).toBe("SO");
    expect(ht.lastPeriodTypeOf("7:00 pm PST")).toBeNull();
    expect(ht.scheduleStateOf("Postponed")).toBe("PPD");
  });
  it("cleans the clock", () => {
    expect(ht.clockOf("00:01:46")).toBe("1:46");
    expect(ht.clockOf("12:05")).toBe("12:05");
    expect(ht.clockOf(null)).toBeNull();
  });
});

describe("tables", () => {
  it("reads standings with all four record columns", () => {
    const rows = ht.standingsSchema.parse(fixture("standings.txt"));
    expect(rows).toHaveLength(32);
    const sj = rows.find((r) => r.row.team_code === "SJ")!.row;
    expect(sj.wins + sj.losses + sj.ot_losses + sj.shootout_losses).toBe(sj.games_played);
    expect(sj.points).toBe(sj.wins * 2 + sj.ot_losses + sj.shootout_losses);
  });
  it("reads percentages with a sign", () => {
    expect(ht.pctOf("25.9%")).toBeCloseTo(0.259);
    expect(ht.pctOf("")).toBeNull();
    expect(ht.specialTeamsSchema.parse(fixture("special-teams.txt"))).toHaveLength(32);
  });
  it("reads league skaters and goalies", () => {
    expect(ht.skatersSchema.parse(fixture("skaters.txt"))[0].row.points).toBeGreaterThan(0);
    expect(ht.goaliesSchema.parse(fixture("goalies.txt")).length).toBeGreaterThan(0);
  });
  it("reads the roster without team staff", () => {
    const rows = ht.rosterSchema.parse(fixture("roster.txt")).roster;
    const players = rows.filter((r) => r.section !== "Team Personnel");
    expect(players.length).toBeGreaterThan(20);
    expect(ht.heightInches("6-1")).toBe(73);
  });
  it("reads a player page, keeping playoffs apart", () => {
    const p = ht.playerSchema.parse(fixture("player.txt"));
    const career = careerOf(p.careerStats);
    expect(career.some((c) => c.playoffs)).toBe(true);
    expect(career.some((c) => !c.playoffs)).toBe(true);
    expect(p.draftInfo[0].row).toMatchObject({ draft_year: 2014, draft_round: 2 });
  });
  it("reads transactions and skips the count row", () => {
    const rows = ht.transactionsSchema.parse(fixture("transactions.txt"));
    expect(rows.length).toBe(19);
    expect(ht.splitPlayerName("Libor Hájek (D)")).toEqual({ name: "Libor Hájek", position: "D" });
  });
});

describe("one game", () => {
  const feed = ht.gameSummarySchema.parse(fixture("game-summary.txt"));
  const s = summaryOf(feed);

  it("rebuilds the running score from the goals", () => {
    const last = s.goals[s.goals.length - 1];
    expect([last.homeScore, last.awayScore]).toEqual([3, 2]);
    expect(last.periodType).toBe("OT");
  });
  it("carries the linescore and three stars", () => {
    expect(s.periods.map((p) => p.type)).toEqual(["REG", "REG", "REG", "OT"]);
    expect(s.periods.reduce((a, p) => a + p.homeShots, 0)).toBe(s.home?.shots);
    expect(s.threeStars.map((t) => t.star)).toEqual([1, 2, 3]);
  });
  it("has no shootout in an overtime game and a full one in a shootout game", () => {
    expect(s.shootout).toEqual([]);
    const so = summaryOf(ht.gameSummarySchema.parse(fixture("game-summary-shootout.txt")));
    expect(so.shootout.length).toBeGreaterThan(1);
    expect(so.shootout.filter((x) => x.winner)).toHaveLength(1);
  });
  it("finds a goalie's decision among several log rows", () => {
    const log = [{ info: { id: 1 }, result: null }, { info: { id: 1 }, result: "SOL" }, { info: { id: 2 }, result: "W" }];
    expect(decisionOf(log, 1)).toBe("SOL");
    expect(decisionOf(log, 3)).toBeNull();
  });
});

describe("shots", () => {
  const shots = ht.playByPlaySchema.parse(fixture("play-by-play.txt"));

  it("keeps each goal once, as a shot, and matches the box score", () => {
    const s = summaryOf(ht.gameSummarySchema.parse(fixture("game-summary.txt")));
    expect(shots).toHaveLength((s.home?.shots ?? 0) + (s.away?.shots ?? 0));
    expect(shots.filter((x) => x.details.isGoal)).toHaveLength(s.goals.length);
  });
  it("maps the feed's grid to rink feet", () => {
    expect(rinkCoords(300, 150)).toEqual({ x: 0, y: 0 });
    expect(rinkCoords(0, 0)).toEqual({ x: -100, y: 43 });
    expect(rinkCoords(null, 10)).toEqual({ x: null, y: null });
  });
  it("reads the quality flag and tolerates an empty net", () => {
    const row = eventRow(1, 1, shots[0]);
    expect(row.typeDescKey).toBe("shot-on-goal");
    expect(row.quality).toBe(false);
    const emptyNet = ht.playByPlaySchema.parse([
      { event: "shot", details: { ...shots[0].details, goalie: { id: 0, firstName: null, lastName: null } } },
    ]);
    expect(eventRow(1, 1, emptyNet[0]).goalieId).toBeNull();
  });
});
