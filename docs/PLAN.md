# San Jose Barracuda Dashboard — 2026-27 Season Plan

Written 2026-11-04. Status: built and tested locally 2026-11-04. See the build log in section 13.

This plan follows the Sharks dashboard (`~/SharksDashboard`, docs/PLAN.md there): same stack,
same conventions, same "derive, validate at the boundary" discipline. The shell carries over
almost unchanged. The data layer does not, because the AHL has its own feed and that feed
carries less than the NHL's. This document says what changes and why.

## 1. What we are building

A personal dashboard for the Barracuda's 2026-27 AHL season, with the rest of the league as
context. It answers at a glance: are they playing now and what is the score, when is the next
game and how can I watch or listen, how did the last one go, where do they sit against the
Pacific Division playoff line, and who just went up to or came down from the Sharks.

Assumptions:

- Personal, non-commercial, no auth, free tiers on Neon, Vercel and GitHub Actions.
- Scope is the 72-game regular season (36 home) and the Calder Cup Playoffs if they get there.
- Same pages and same navigation as the Sharks site unless section 3 says otherwise.

Where things stand on 2026-11-04: the Barracuda are 4-6-0-0, 8 points, 9th of 10 in the
Pacific, with 10 of 72 games played. Next game is tonight at Ontario, 7 p.m. Pacific.

## 2. The 2026-27 calendar

| Date | Event | Dashboard implication | Verified |
|---|---|---|---|
| 2026-10-02 | First AHL game in the feed | Backfill start | Feed |
| 2026-10-03 | Barracuda home opener | — | Press |
| 2027-02-07, 02-08 | All-Star Classic, Cleveland | Break; home page says so | Press |
| 2027-04-11 | Regular season ends | Standings freeze | Feed |
| Mid-April 2027 | Calder Cup Playoffs | New season id in the feed; bracket page | 2026 pattern |

Still to find before it goes in `MILESTONES`: the AHL trade deadline date. No source turned it
up, and the site should not show a guessed date.

## 3. What carries over, page by page

| Page | Verdict | What changes |
|---|---|---|
| Home | Keep | Records gain a fourth column. "Playoff odds" come from our own simulation. TV line becomes watch and listen links. |
| Scores | Keep | League scoreboard from the scorebar feed. |
| Schedule | Keep | 72 games; TV column becomes audio and video. Attendance added. |
| Game | Keep, thinner | Linescore, scoring, penalties, three stars, shot map, goalies stay. Team-stat panel shrinks to shots, power play and PIM. Box score columns drop to G, A, P, +/-, PIM, SOG. |
| Standings | Rebuild views | Division view with a playoff line. Wild-card view goes: the AHL has no wild card. Conference view goes: see section 4. League view stays. |
| Roster | Keep, thinner | No MoneyPuck toggle. Season columns drop to what the feed has. Adds rookie flag. |
| Player | Keep, thinner | No Advanced card, no TOI. Adds career by season and draft info from the feed. |
| Team | Keep, thinner | League ranks on goals, power play, penalty kill, shots. No underlying-numbers cards. |
| Stats | Keep | League leaders; drop TOI and S% where missing. Adds a rookies filter. |
| Rankings | Rework | Power rating without xG (section 7). Odds table from our simulation. |
| Transactions | **New** | Call-ups, loans and signings. The Barracuda's one real advantage over the Sharks site, since roster movement is the story of an AHL season. |
| Playoff bracket | **New, by April** | The feed serves brackets; verified against the 2026 playoffs. |

### Dropped, because the data does not exist

Checked across all 10 Barracuda games played so far, home and road:

- **Always zero in the box score:** hits, faceoffs, skater time on ice, blocked shots. The
  fields are present but never populated, so they must be left out, not shown as zeros.
- **Absent entirely:** giveaways, takeaways, shifts, goalie even-strength and power-play
  splits, highlight clips.
- **Play-by-play carries only** shots on goal, goals, penalties and goalie changes. No missed
  or blocked shots, so no Corsi or Fenwick. Shot type is always "Default".
- **No expected goals and no playoff odds.** MoneyPuck does not cover the AHL.
- **No standings for past dates.** The feed ignored a `date` parameter. See section 6.

### Gained, because the AHL feed has it

Attendance, game duration and officials; a rookie flag; shootout goals and attempts; a
good/poor shot-quality flag on every shot; transactions; audio and video links per game.

## 4. Hockey rules that differ from the NHL

- **Four-column records.** W-L-OTL-SOL. Overtime and shootout losses are separate columns, each
  worth one point. `outcomeFor`, `Split` and every record display change to match.
- **Uneven schedules.** Teams are at 9 to 12 games played right now, so points percentage
  matters more here. Show it next to points everywhere.
- **Playoff line by division, no wild card.** 23 of 32 teams qualify, and the Pacific sent its
  top seven in 2026. Cut lines are set per division, replacing `playoffPicture`. The 2026-27
  cut sizes are assumed from the format used since 2022 and need confirming; keep them in one
  committed constant.
- **Rank order.** The feed's `rank` currently follows points, not percentage: Tucson (16 pts,
  .727) sits above Abbotsford (15 pts, .750). Use the feed's rank and do not re-sort. The AHL's
  published rule still needs checking before the playoff line is trusted late in the season.
- **Conferences are not a thing in the feed.** Bootstrap lists conference rows with no id or
  name. Divisions are Atlantic (8), North (7), Central (7), Pacific (10).

## 5. Data source (probed 2026-11-04)

One source replaces all three: HockeyTech's LeagueStat feed, which theahl.com itself renders
from. Base `https://lscluster.hockeytech.com/feed/index.php`, with `client_code=ahl`,
`league_id=4`, `site_id=3`, `lang=en` and a `key`. The key is not a secret issued to us. It is
served to every visitor in the AHL's public widget script. See risks and decision 4.

| Need | Query | Verified result |
|---|---|---|
| Seasons, divisions, teams | `feed=statviewfeed&view=bootstrap&season=latest&pageName=schedule` | Current season 94; 32 teams; 4 divisions |
| League schedule and results | `feed=modulekit&view=schedule&season_id=94` | 1,152 games, 171 final, 2.2 MB |
| Barracuda schedule | `…&team_id=405` | 72 games, 36 home |
| Live scoreboard | `feed=modulekit&view=scorebar&numberofdaysahead=N&numberofdaysback=N` | Status, period, clock, score, records. No shots. |
| Standings | `feed=statviewfeed&view=teams&groupTeamsBy=division&context=overall&season=94&special=false` | W, L, OTL, SOL, RW, ROW, pts, pct, GF, GA, L10, remaining |
| Home and road | same with `context=home` | Separate record per context |
| Power play and kill | same with `special=true` | PP%, PK%, opportunities, shorthanded goals |
| Roster | `feed=statviewfeed&view=roster&team_id=405&season_id=94` | 15 F, 8 D, 2 G, with height, weight, birthplace |
| League skaters | `feed=statviewfeed&view=players&season=94&team=all&position=skaters&…` | 859 skaters; `statsType=expanded` adds GWG, S%, PP assists |
| League goalies | same with `position=goalies` | 79 goalies |
| Box score | `feed=statviewfeed&view=gameSummary&game_id=ID` | Skaters, goalies, goals, penalties, three stars, period shots, attendance |
| Play-by-play | `feed=statviewfeed&view=gameCenterPlayByPlay&game_id=ID` | Shots with x/y. Counts match box-score shots exactly in all 10 games. |
| Player | `feed=statviewfeed&view=player&player_id=ID&season_id=94&team_id=405&statsType=standard` | Bio, game log, career, draft, headshot |
| Transactions | `feed=statviewfeed&view=transactions&season=94` | League-wide, 50 rows, newest first |
| Bracket | `feed=modulekit&view=brackets&season_id=92` | Five rounds, 2026 data |
| Team logo | `assets.leaguestat.com/ahl/logos/50x50/{id}.png` | PNG; there is no dark variant |

Traps, all seen in real payloads:

- **Responses are wrapped in parentheses** on `statviewfeed`, so `JSON.parse` fails until they
  are stripped. `modulekit` returns plain JSON.
- **Numbers arrive as strings.** Use `z.coerce` at the boundary.
- **`date_time_played` is misleading:** it reads `15:00:00Z` for a 3 p.m. Pacific game. It is
  local time mislabelled UTC. Only `GameDateISO8601` is a true instant.
- **Table feeds nest rows** at `[0].sections[].data[].row`, with section titles often blank.
- **`streak` is not a streak.** It holds a record such as `7-0-2-0`. Derive streaks from games.
- **Scorebar with 0 days ahead and 0 back returned nothing** on a day with 7 games, so ask for
  a wider window and filter by date.
- **`team=405` did not filter transactions.** Filter in our code.
- **Playoffs are their own season id**, not a game type (92 for 2026). `gameType` becomes a
  lookup on season id. No preseason appears in season 94.
- **Ids are HockeyTech's**, not the NHL's: Barracuda 405, players unrelated to NHL ids.
- **Player-page shot coordinates differ** from play-by-play (values to 633, plus an
  `orientation` field). Use play-by-play only.

### Unverified until a game is live

The scorebar answers with `Cache-Control: max-age=240`. If live scores really are four minutes
stale, the Sharks' 20-second polling buys nothing. **Tonight's games settle this**: poll during
Ontario at 7 p.m. and record how fast score and clock move. If it lags, try
`gameSummary`/`gameCenterPlayByPlay` for the featured game, which are not the same endpoint.
Bootstrap also exposes a Firebase config, likely what the AHL's own site uses for live updates.
Leave that alone unless polling proves unusable, and raise it as a separate decision if so.

## 6. Data model

Start from the Sharks schema; ids become HockeyTech's and season becomes the feed's id.

- `teams`: keep. `conference` stays null. `logoDarkUrl` removed.
- `games`: keep, with `attendance`, `audioUrl`, `videoUrl` added and `broadcasts` removed.
  `homeSog`/`awaySog` come from box scores, since schedule feeds carry no shots.
- `players`: keep, with `rookie` added. Position arrives as F, D, G on rosters and C, LW, RW
  elsewhere, so store both.
- `game_skater_stats`: drop hits, faceoffs, TOI, blocks, shifts, giveaways, takeaways.
- `game_goalie_stats`: drop the strength splits; keep shots, saves, GA, TOI, starter.
- `game_events`: slim to shot, goal, penalty, goalie change. Add `quality`.
- `standings_snapshots`: keep the shape with `shootoutLosses` as a record column and
  `gamesRemaining` added; drop wild-card sequences.
- `skater_season_stats`, `goalie_season_stats`, `team_season_stats`: keep, trimmed to the feed.
- `transactions`: **new**. Date, player, team, type, text.
- `odds_snapshots`: kept, written by our own simulation.
- `advanced_team_stats`, `advanced_skater_stats`: removed.
- `ingest_runs`: unchanged.

**Standings history.** The feed has no past dates, so the backfill reconstructs daily points
from stored games, which works because every league game is stored. Live snapshots run from
then on.

**Shot maps.** Coordinates sit on a grid of roughly 600 by 300 (observed x 35-573, y 3-286). In
all 10 games the home team's shots cluster at low x and the visitor's at high x in every
period, so the feed already normalizes ends and mirroring depends only on home or road. The
exact scale to rink feet is inferred; calibrate against known goal locations in Phase 3. The
map shows goals and shots on goal only.

## 7. Replacing xG in the power rating

Published weights, as on the Sharks site, with the xG component replaced by all-situations shot
share, which is the closest measure the feed supports. Proposed: points percentage 40, goal
differential 25, shot share 20, last ten 15. Shots come from the league player feeds; see
decision 3.

## 8. Technology and reuse

Same stack: Next.js 15, Tailwind 4, Drizzle, PGlite locally, Neon in production, Zod, Vitest,
Playwright, GitHub Actions, Vercel in `cle1`, beside Neon's us-east-2. Copy the files rather than share a package, as
the Sharks plan decided.

- **Copy nearly as is:** `db/client.ts`, `db/migrate.ts`, `ingest/http.ts`, `cli.ts` skeleton,
  `format.ts`, `Card`, `Sparkline`, `Headshot`, `TeamName`, configs, both workflows.
- **Adapt:** `schema.ts`, `derive.ts`, `live.ts`, `views.ts`, `queries.ts`, `season.ts`, every
  page, `ShotMap`, `TeamLogo`, `GameRow`, `LiveGameCard`, the smoke tests.
- **Write new:** `sources/hockeytech.ts` with fixtures, all ingest jobs, playoff line logic,
  transactions page, bracket page.
- **Leave behind:** `moneypuck.ts`, `nhl-web.ts`, `nhl-stats.ts`, advanced stats UI.

Hardcoded "Sharks" text and the teal palette get replaced throughout, with colors taken from
the Barracuda logo. One fix not to copy: `pollInterval` polls every 20 seconds forever for a
game whose start time has passed but never goes live, such as a postponement.

## 9. Build steps

Each phase ends with something that runs. Same-session pace is plausible; the Sharks site was
built in one.

- **Phase 0, scaffold.** Copy the shell, rename, recolor. Confirm the feed answers an honest
  `barracuda-dashboard/0.1` user agent, since today's probes used a browser one. Record the
  live-latency result.
- **Phase 1, data in.** `sources/hockeytech.ts` with saved fixtures and parser tests. Ingest
  jobs and the `today`, `nightly`, `backfill` bundles. Reconstructed standings history.
- **Phase 2, core pages.** Home, `/api/live`, scores, schedule, game, division standings.
- **Phase 3, players and team.** Roster, player, team, stats, shot maps with calibration.
- **Phase 4, what is new.** Transactions, rankings, odds simulation.
- **Phase 5, deploy.** Neon, secrets, Vercel, crons, CI with smoke tests.
- **By April.** Bracket page, playoff season id handling.

## 10. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Key rotated or access blocked | Medium; it is a vendor's commercial feed, not meant for us | Key in an env var; gentle rate limit; site keeps serving stored data; refetch key from the public widget script |
| Terms of use | Low for personal use, but less clear than NHL's | Non-commercial, attributed, server-side, cached, no redistribution API |
| Live scores lag | Unknown until tonight | See section 5; label freshness on the page |
| Payload changes | Medium | Zod, fixtures, one adapter file, loud failure |
| AHL roster churn | Certain | Nightly roster and transactions; game stats keep team at game time |
| Fields start populating or stop | Low | Parser tests; zero-only columns stay out of the UI |
| GitHub Actions minutes | See decision 2 | Public repo, or skip idle days |
| PGlite two-process corruption | Medium | Same rule as Sharks: one process at a time |

## 11. Decisions (made 2026-11-04)

1. Playoff odds: build our own Monte Carlo simulation over the remaining schedule.
2. Repository: public, like Sharks, made so just before the first push.
3. Box scores and play-by-play for Barracuda games only. Other games keep schedule and score.
   This overrides section 7's source for shots: team shot totals are summed from the league
   skater and goalie feeds and checked against real Barracuda totals. If they do not hold up,
   shot share is dropped and its weight spread over the other three components.
4. The AHL site's public feed key is acceptable for this personal project.
5. Hosting: a new Neon project and a Vercel project named `barracuda-dashboard`.

## 12. Sources

- Live probes on 2026-11-04 of every query in section 5.
- [Barracuda home opener date (The Hockey News)](https://thehockeynews.com/nhl/san-jose-sharks/latest-news/san-jose-barracuda-announce-date-of-home-opener)
- [Cleveland to host 2027 AHL All-Star Classic (AHL)](https://theahl.com/news/cleveland-host-2027-ahl-all-star-classic)
- [AHL All-Star Challenge listing (Rocket Arena)](https://www.rocketarena.com/events/detail/ahl-all-star-challenge-cleveland-oh-tickets-02-08-2027)
- [AHL playoff format explained (FloHockey)](https://www.flohockey.tv/articles/14107248-ahl-playoff-format-here-is-how-the-calder-cup-playoffs-work)
- [2026 Calder Cup playoffs (Wikipedia)](https://en.wikipedia.org/wiki/2026_Calder_Cup_playoffs)
- [HockeyTech and AHL partnership (HockeyTech)](https://www.hockeytech.com/hockeytech-and-ahl-extend-partnership/)

## 13. Build log and deviations from the plan

Append here when a piece of work is finished. This is the handoff between sessions and machines.

**2026-11-04.** Plan written. Sharks code read end to end; AHL feed probed. Nothing built.

**2026-11-04, later.** Phases 0 through 4 built in one session on the Mac, against PGlite.
Everything in sections 3 and 9 except the bracket page exists and renders from real data.

What was built:

- **Schema** (`src/db/schema.ts`): `teams`, `games` (every AHL game), `players`,
  `game_skater_stats`, `game_goalie_stats`, `game_events` (shots with rink coordinates),
  `standings_snapshots`, `skater_season_stats`, `goalie_season_stats`, `team_season_stats`,
  `odds_snapshots`, `transactions`, `ingest_runs`. One migration.
- **Ingest** (`src/ingest`): one Zod adapter with 13 fixtures from real payloads; jobs for teams,
  schedule, scores, standings, box scores, roster with player enrichment, transactions, stats,
  odds; bundles `today`, `nightly`, `backfill`. A full backfill takes under a minute: 32 teams,
  1,152 games, 10 box scores with 622 shots, 859 skaters, 79 goalies, 19 transactions and
  27 days of odds.
- **Pages**: home, scores, schedule, game, standings (division and league), roster, player,
  team, stats, rankings, and the new moves page.
- **Odds** (`src/lib/simulate.ts`): 10,000 seeded runs of the remaining schedule. Every run
  fills exactly 23 playoff places, 9 byes and 4 division titles.
- **Tests**: 51 Vitest tests on real fixtures, 17 Playwright smoke tests on every route.

Checked against reality: records computed from stored games match the official standings for
all 32 teams on games played, wins, all three loss columns and goals for. Shot events match
box-score shots in all 10 games. Barracuda shots summed from the league skater table are 325,
exactly their real total. Goals average 23 feet from the net line and 9 feet off centre, which
confirms the coordinate conversion.

Deviations from the plan above, and why:

- **Standings history is not reconstructed.** The points sparkline reads straight from games,
  which needs no extra table. Daily snapshots run from 2026-11-04.
- **Odds history is replayed** from stored games back to 2026-10-09, so the sparkline has the
  whole season. The plan assumed it would start on the day of the first run.
- **No conference column.** The feed has none worth storing, so it went from the schema.
- **Only shots are stored as events.** Goals appear twice in the feed, and penalties are on the
  game summary already.
- **Shots against undercount slightly.** Goalies faced 292 shots against a true 297, since empty
  nets have no goalie. Small enough for shot share; the team page says so.
- **Simulation settings were tuned by eye** after the first run put Tucson at 99.7% after 11
  games: 20 phantom games, 0.65 logit per goal, 0.3 goals of noise. Nothing here is fitted to
  past seasons. Backtesting on 2025-26 is the obvious improvement.
- **The bracket page is deferred** to April, when the playoff season id exists.

**Live latency, measured 2026-11-04** on five Eastern games, polling every 15 seconds for about
three minutes: despite `Cache-Control: max-age=240`, each game's clock changed every 30 to 160
seconds, at different moments per game, so there is no single four-minute cache. The clock
moves when the scorer updates it, not every second, so expect it to jump. Live games report
status 2 with clock text like `18:36`. No goal was scored in the sample, so how fast a goal
appears is still unmeasured, as are status 3 and intermission values. The 20-second poll stays.

Still to do, in order: connect Neon and Vercel; confirm the AHL trade deadline and the
non-Pacific playoff places; set the playoff season id and build the bracket page by April.
