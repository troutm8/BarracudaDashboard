import { describe, expect, it } from "vitest";
import { liveFromFeed, mergeLive, pollInterval } from "./live";
import type { GameView } from "./views";

const NOW = Date.parse("2026-11-04T20:00:00Z");
const at = (mins: number) => new Date(NOW + mins * 60_000).toISOString();
const feed = { id: 1, gameState: "LIVE", period: 2, periodType: "REG", clock: "4:10", inIntermission: false, homeScore: 2, awayScore: 1, lastPeriodType: null };

describe("liveFromFeed", () => {
  it("collapses status and attaches shots", () => {
    expect(liveFromFeed(feed, { home: 20, away: 11 })).toMatchObject({ status: "live", homeSog: 20, awaySog: 11 });
    expect(liveFromFeed(feed)).toMatchObject({ homeSog: null });
  });
});

describe("mergeLive", () => {
  const g = { id: 1, status: "pre", gameState: "FUT", period: null, homeScore: null, awayScore: null, homeSog: 30, awaySog: 28 } as unknown as GameView;
  it("overlays live state and keeps known shots when the scoreboard has none", () => {
    const m = mergeLive(g, liveFromFeed(feed));
    expect(m).toMatchObject({ status: "live", homeScore: 2, clock: "4:10", homeSog: 30 });
  });
});

describe("pollInterval", () => {
  it("polls fast with a live game or a start coming up", () => {
    expect(pollInterval([{ status: "live", startTime: at(-30) }], NOW)).toBe(20_000);
    expect(pollInterval([{ status: "pre", startTime: at(10) }], NOW)).toBe(20_000);
    expect(pollInterval([{ status: "pre", startTime: at(-5) }], NOW)).toBe(20_000);
  });
  it("polls slowly for a later start", () => expect(pollInterval([{ status: "pre", startTime: at(120) }], NOW)).toBe(300_000));
  it("stops once everything is final", () => expect(pollInterval([{ status: "final", startTime: at(-200) }], NOW)).toBe(0));
  it("gives up on a game long past its start, such as a postponement", () => {
    expect(pollInterval([{ status: "pre", startTime: at(-60 * 24) }], NOW)).toBe(0);
  });
});
