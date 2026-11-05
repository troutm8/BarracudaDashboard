/**
 * Smoke tests for the main routes, run against the production build and a live database
 * (Neon in CI). The data changes every day, so these assert structure and invariants, never
 * specific scores or opponents. The Barracuda are the one fixed anchor.
 */
import { test, expect, type Page } from "@playwright/test";

const FEATURED = "San Jose Barracuda";
/** Set by CI on main: stale data fails instead of warning. */
const STRICT_FRESHNESS = process.env.E2E_STRICT_FRESHNESS === "1";

const rows = (page: Page, table = "table.data") => page.locator(`${table} tbody tr`);

async function visit(page: Page, path: string, status = 200) {
  const res = await page.goto(path);
  expect(res, `${path} gave no response`).not.toBeNull();
  expect(res!.status(), `${path} status`).toBe(status);
}

test.describe("home", () => {
  test("shows the Barracuda, their next or live game, the last result and the league slate", async ({ page }) => {
    await visit(page, "/");
    await expect(page.locator("h1")).toContainText(FEATURED);
    await expect(page.getByText(/\d+-\d+-\d+-\d+ · \d+ pts/)).toBeVisible();
    await expect(page.getByRole("heading", { name: /^(Next game|Tonight|Live now)$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Last result" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Box score and shot map/ }).first()).toHaveAttribute("href", /^\/games\/\d+$/);
    await expect(page.getByRole("heading", { name: "Where we stand" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Playoff odds" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Around the league/ })).toBeVisible();
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test("renders without horizontal overflow and keeps the nav reachable", async ({ page }) => {
      await visit(page, "/");
      await expect(page.locator("h1")).toContainText(FEATURED);
      for (const name of ["Scores", "Schedule"]) await expect(page.locator("nav").first().getByRole("link", { name })).toBeAttached();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, "page wider than the viewport").toBeLessThanOrEqual(0);
    });
  });
});

test.describe("scores and schedule", () => {
  test("scores defaults to today and pages by date", async ({ page }) => {
    await visit(page, "/scores");
    await expect(page.locator("h1")).toHaveText(/^\w+, \w+ \d+, 20\d\d$/);
    await expect(page.getByRole("link", { name: /Prev/ })).toHaveAttribute("href", /\/scores\?date=\d{4}-\d{2}-\d{2}/);
  });
  test("a past date with games lists them with Final status", async ({ page }) => {
    await visit(page, "/scores?date=2026-11-01");
    await expect(page.getByText(/^Final/).first()).toBeVisible();
  });
  test("the schedule lists 72 regular-season games grouped by month", async ({ page }) => {
    await visit(page, "/schedule");
    await expect(page.getByText(/72 regular-season games, 36 at home/)).toBeVisible();
    expect(await rows(page).count()).toBe(72);
    await expect(page.getByRole("heading", { name: "October 2026" })).toBeVisible();
  });
});

test.describe("game page", () => {
  test("is reached from the home page and shows a box score with a shot map", async ({ page }) => {
    await visit(page, "/");
    const href = await page.getByRole("link", { name: /Box score and shot map/ }).first().getAttribute("href");
    await visit(page, href!);
    await expect(page.getByRole("heading", { name: "Linescore" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Shot map" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Shot map" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Goalies" })).toBeVisible();
    expect(await rows(page).count()).toBeGreaterThan(30);
  });
  test("a game without the Barracuda says box scores are not stored", async ({ page }) => {
    await visit(page, "/games/1029232");
    await expect(page.getByText(/Box scores are stored for Barracuda games only/)).toBeVisible();
  });
  test("unknown ids are 404s", async ({ page }) => {
    await visit(page, "/games/1", 404);
    await visit(page, "/players/1", 404);
  });
});

test.describe("standings", () => {
  test("division view has four divisions and 32 teams with the Barracuda highlighted", async ({ page }) => {
    await visit(page, "/standings");
    expect(await rows(page).count()).toBe(32);
    for (const d of ["Pacific", "Central", "Atlantic", "North"]) await expect(page.getByRole("heading", { name: `${d} Division` })).toBeVisible();
    await expect(page.locator("tr.featured")).toHaveCount(1);
    await expect(page.locator("tr.featured")).toContainText(FEATURED);
  });
  test("each division draws a playoff line", async ({ page }) => {
    await visit(page, "/standings");
    await expect(page.locator("tr.cutline")).toHaveCount(4);
  });
  test("the league view lists everyone", async ({ page }) => {
    await visit(page, "/standings?view=league");
    expect(await rows(page).count()).toBe(32);
  });
});

test.describe("roster, players, team, moves", () => {
  test("roster lists skaters, goalies and links to a player page", async ({ page }) => {
    await visit(page, "/roster");
    await expect(page.getByRole("heading", { name: "Skaters", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Goalies", level: 2 })).toBeVisible();
    const link = page.locator("table.data tbody tr a").first();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/players\/\d+$/);
    await visit(page, href!);
    await expect(page.getByRole("heading", { name: "This season", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Game log" })).toBeVisible();
  });
  test("team page ranks every stat among 32 teams", async ({ page }) => {
    await visit(page, "/team");
    await expect(page.locator("h1")).toContainText(FEATURED);
    await expect(page.getByRole("heading", { name: "Season stats" })).toBeVisible();
    await expect(page.getByText(/^\d+(st|nd|rd|th)$/).first()).toBeVisible();
  });
  test("moves lists roster transactions by month", async ({ page }) => {
    await visit(page, "/moves");
    await expect(page.getByRole("heading", { name: "Roster moves", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "October 2026" })).toBeVisible();
  });
});

test.describe("stats and rankings", () => {
  test("league leaders show 50 skaters and switch to goalies", async ({ page }) => {
    await visit(page, "/stats");
    expect(await rows(page).count()).toBe(50);
    await visit(page, "/stats?scope=goalies");
    await expect(page.getByText(/Rate leaders need at least/)).toBeVisible();
  });
  test("rankings list all 32 teams with both methods explained", async ({ page }) => {
    await visit(page, "/rankings");
    await expect(page.getByRole("heading", { name: "Power rankings" })).toBeVisible();
    expect(await rows(page, "table.data").count()).toBeGreaterThanOrEqual(64);
    await expect(page.getByText(/Score out of 100/)).toBeVisible();
    await expect(page.getByText(/rest of the season played out/)).toBeVisible();
  });
});

test.describe("freshness", () => {
  test("the data is not stale", async ({ page }) => {
    await visit(page, "/");
    const stamp = await page.locator("footer time").getAttribute("datetime");
    const problems: string[] = [];
    if (!stamp) problems.push("no last-updated stamp in the footer");
    else {
      const age = (Date.now() - Date.parse(stamp)) / 86_400_000;
      if (!(age < 3)) problems.push(`last ingest ${age.toFixed(1)} days ago (${stamp})`);
    }
    if (problems.length) {
      if (STRICT_FRESHNESS) throw new Error(problems.join("; "));
      console.warn(`freshness warning: ${problems.join("; ")}`);
    }
  });
});
