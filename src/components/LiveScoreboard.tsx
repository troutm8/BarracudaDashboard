"use client";

import { useEffect, useState } from "react";
import { mergeLive, pollInterval, type LiveDay, type LiveGame } from "@/lib/live";
import type { GameView } from "@/lib/views";
import { GameRow } from "./GameRow";

/** Renders a day's games and overlays live state from /api/live while any game is in progress or upcoming. */
export function LiveScoreboard({ games, date, featuredId }: { games: GameView[]; date: string; featuredId?: number }) {
  const [live, setLive] = useState<Map<number, LiveGame>>(new Map());
  const [updated, setUpdated] = useState<string | null>(null);
  const merged = games.map((g) => (live.get(g.id) ? mergeLive(g, live.get(g.id)!) : g));
  const interval = pollInterval(merged);

  useEffect(() => {
    if (!interval) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/live?date=${date}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as LiveDay;
        if (stop) return;
        setLive(new Map(data.games.map((e) => [e.id, e])));
        setUpdated(data.fetchedAt);
      } catch {
        /* keep the server-rendered state */
      }
    };
    tick();
    const t = setInterval(tick, interval);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [date, interval]);

  return (
    <div>
      {merged.map((g) => (
        <GameRow key={g.id} g={g} featuredId={featuredId} />
      ))}
      {updated && <p className="pt-2 text-right text-[11px] text-muted">Live scores updated {new Date(updated).toLocaleTimeString()}</p>}
    </div>
  );
}
