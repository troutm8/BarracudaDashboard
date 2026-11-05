"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GameSummary } from "@/db/schema";
import { finalSuffix, fmtDateTime, periodLabel } from "@/lib/format";
import { mergeLive, pollInterval, type LiveGameDetail } from "@/lib/live";
import type { GameView } from "@/lib/views";
import { ListenLinks } from "./ListenLinks";
import { TeamLogo } from "./TeamLogo";

function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const ms = Date.parse(to) - now;
  if (ms <= 0) return <span>Starting soon</span>;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const d = Math.floor(h / 24);
  if (d >= 1) return <span>in {d} day{d === 1 ? "" : "s"}, {h % 24}h</span>;
  return <span>in {h}h {m}m</span>;
}

function Score({ g, side, featuredId }: { g: GameView; side: "home" | "away"; featuredId: number }) {
  const team = g[side];
  const score = side === "home" ? g.homeScore : g.awayScore;
  const sog = side === "home" ? g.homeSog : g.awaySog;
  const other = side === "home" ? g.awayScore : g.homeScore;
  const winning = g.status !== "pre" && (score ?? 0) > (other ?? 0);
  return (
    <div className={`flex flex-1 flex-col items-center gap-1 ${team.id === featuredId ? "text-teal" : ""}`}>
      <TeamLogo team={team} size={56} />
      <div className="text-sm font-semibold">{team.commonName}</div>
      {g.status !== "pre" && <div className={`text-4xl tabular ${winning ? "font-bold" : "font-semibold text-muted"}`}>{score ?? 0}</div>}
      {g.status !== "pre" && sog != null && <div className="text-[11px] text-muted">{sog} shots</div>}
    </div>
  );
}

/**
 * The featured team's game of the day. Polls /api/live for score, clock and the scoring
 * summary while the game is upcoming or in progress; once final, shows the stored summary.
 */
export function LiveGameCard({ game, summary, featuredId }: { game: GameView; summary: GameSummary | null; featuredId: number }) {
  const [live, setLive] = useState<LiveGameDetail | null>(null);
  const g = live ? mergeLive(game, live.game) : game;
  const s = live?.summary ?? summary;
  const interval = pollInterval([g]);

  useEffect(() => {
    if (!interval) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/live?game=${game.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as LiveGameDetail;
        if (!stop) setLive(data);
      } catch {
        /* keep what we have */
      }
    };
    tick();
    const t = setInterval(tick, interval);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [game.id, interval]);

  const status =
    g.status === "final" ? `Final${finalSuffix(g.lastPeriodType)}` : g.status === "live" ? (g.inIntermission ? `${periodLabel(g.period, g.periodType)} intermission` : `${periodLabel(g.period, g.periodType)} · ${g.clock ?? ""}`) : fmtDateTime(g.startTime);

  const featuredAbbrev = g.home.id === featuredId ? g.home.abbrev : g.away.abbrev;
  const goals = s?.goals ?? [];

  return (
    <div>
      <div className="flex items-start gap-2">
        <Score g={g} side="away" featuredId={featuredId} />
        <div className="flex w-28 flex-col items-center gap-1 pt-4 text-center sm:w-40">
          <div className={`text-sm font-semibold ${g.status === "live" ? "text-live" : "text-muted"}`}>{status}</div>
          {g.status === "pre" && g.startTime && (
            <div className="text-xs text-muted">
              <Countdown to={g.startTime} />
            </div>
          )}
          <div className="text-[11px] text-muted">{g.home.id === featuredId ? "Home" : `at ${g.home.placeName}`}</div>
          {g.venue && <div className="hidden text-[11px] text-muted sm:block">{g.venue}</div>}
          {g.status !== "final" && <ListenLinks g={g} featuredId={featuredId} />}
        </div>
        <Score g={g} side="home" featuredId={featuredId} />
      </div>

      {goals.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-t border-line text-sm">
          {goals.map((goal, i) => (
            <li key={i} className={`flex items-baseline gap-3 py-1.5 ${goal.teamAbbrev === featuredAbbrev ? "" : "text-muted"}`}>
              <span className="w-16 shrink-0 text-xs tabular">
                {periodLabel(goal.period, goal.periodType)} {goal.timeInPeriod}
              </span>
              <span className="w-10 shrink-0 text-xs font-semibold">{goal.teamAbbrev}</span>
              <span className="min-w-0 flex-1">
                <span className="font-medium text-fg">{goal.scorer}</span>
                {goal.goalsToDate != null && <span className="text-xs"> ({goal.goalsToDate})</span>}
                {goal.assists.length > 0 && <span className="text-xs"> · {goal.assists.map((a) => a.name).join(", ")}</span>}
                {goal.strength !== "ev" && <span className="ml-1 rounded bg-soft px-1 text-[10px] uppercase">{goal.strength}</span>}
              </span>
              <span className="shrink-0 text-xs tabular">
                {goal.awayScore}-{goal.homeScore}
              </span>
            </li>
          ))}
        </ul>
      )}

      {g.status === "final" && s?.threeStars?.length ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {s.threeStars.map((t) => (
            <span key={t.star}>
              <span className="text-orange">{"★".repeat(t.star)}</span> {t.name} ({t.teamAbbrev})
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 text-right text-xs">
        <Link href={`/games/${g.id}`} className="text-teal hover:underline">
          {g.status === "final" ? "Box score and shot map →" : "Game page →"}
        </Link>
      </div>
    </div>
  );
}
